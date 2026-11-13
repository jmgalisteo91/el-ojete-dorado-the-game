/**
 * RenderPipeline.js · Pipeline 2.5D estilizado (HD-2D) sobre Canvas 2D
 *
 * Orden de composición por fotograma:
 *
 *  CAPA 0  · Suelo ............ hierba, baldosas, alfombras y agua con ondulación (renderGround)
 *            + decals del suelo (objetos recogibles, bytes, portales) mediante `frame.onGround`.
 *  SOMBRAS · Elipses traslúcidas bajo cada entidad móvil, orientadas por el reloj solar.
 *  CAPA 1  · Entidades y obstáculos Y-sorted ... jugador, NPCs, animales, enemigos y tiles sólidos
 *            (troncos, muros, mobiliario, monolitos) ordenados cada fotograma por `y + height`.
 *  CAPA 2  · Estructuras elevadas ........ copas de árboles, tejados, carteles de jefes (siempre encima).
 *  CAPA 3  · Atmósfera y profundidad de campo: niebla ambiental ligera → iluminación dinámica
 *            diferida (multiply) → viñeteado suave en los márgenes verticales (lente focal).
 *
 * Todas las texturas auxiliares (viñeta, niebla) se pre-renderizan una sola vez; el pipeline
 * reutiliza sus buffers entre fotogramas para no generar basura y mantener los 60 FPS.
 */

const FOG_TEXTURE_WIDTH = 192;
const FOG_TEXTURE_HEIGHT = 96;

/** Sol «de interior»: luz cenital suave → sombras cortas y casi circulares. */
const INTERIOR_SUN = { dx: 0.15, dy: 0.2, length: 0.55, alphaScale: 0.85, isDay: true, elevation: 1 };

function compareBySortY(a, b) {
  return a.sortY - b.sortY;
}

export class RenderPipeline {
  constructor(viewportWidth = 320, viewportHeight = 180) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    this._drawList = [];
    this._casters = [];
    this.clock = 0;

    this._vignette = null;
    this._fogTexture = null;
    // (BLOQUE 3.2) Buffer de bloom barato a 1/4 de resolución.
    this._bloomCanvas = null;
    this._bloomCtx = null;

    // (BLOQUE 1/2) Efectos configurables y buffers de post-proceso.
    this.effects = { bloom: true, scanlines: true, particles: true, parallax: true };
    this._scanlinePattern = null;
    this._parallax = null;
    this._cameraX = 0;
    this._ambientParticles = [];
    this._ambientKey = null;
    this._ambientConfig = null;
    this._ambientSpawnAccumulator = 0;

    // (FIX M2.6) Calidad gráfica: 'low' desactiva niebla y viñeta
    this.quality = 'normal';

    this.stats = { sorted: 0, props: 0, entities: 0, shadows: 0 };
  }

  /** (BLOQUE 1/2) Permite desactivar bloom/scanlines/partículas/parallax desde opciones. */
  setEffects(partial = {}) {
    this.effects = { ...this.effects, ...partial };
    return this.effects;
  }

  /** (FIX M2.6) Ajusta la calidad gráfica según el perfil de rendimiento. */
  setQuality(profile) {
    this.quality = profile === 'low' ? 'low' : profile === 'high' ? 'high' : 'normal';
    return this.quality;
  }

  /** Avanza el reloj y las partículas ambientales (congeladas si paused). */
  update(dt, context = {}) {
    this.clock += dt;
    if (context && context.paused) return;
    this._updateAmbientParticles(dt, context);
  }

  /**
   * Renderiza el mundo completo.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{
   *   tilemap: Tilemap, camera: Camera2D, dayNight: DayNightCycle, player: Player,
   *   npcs: Array, animals: Array, enemies: Array,
   *   onGround?: (ctx: CanvasRenderingContext2D) => void,
   *   skipLighting?: boolean
   * }} frame
   */
  render(ctx, frame) {
    const { tilemap, camera, dayNight, player, npcs, animals, enemies } = frame;
    const isInterior = tilemap.isInterior();
    const sun = isInterior ? INTERIOR_SUN : dayNight.getSunState();
    this._cameraX = camera.renderX;

    // (BLOQUE 2.1) Fondo con capas de parallax (visible en el vacío/cielo).
    this._renderParallaxBackdrop(ctx, camera, dayNight, tilemap);

    // ── CAPA 0 · Suelo + decals + sombras de edificios ───────────────────────
    tilemap.renderGround(ctx, camera, sun);
    if (typeof frame.onGround === 'function') {
      frame.onGround(ctx);
    }

    // (BLOQUE 2.1) Sombras de nubes con paralaje sobre el suelo (día, exteriores).
    this._renderCloudShadows(ctx, camera, dayNight, tilemap);

    // ── Sombras proyectadas (bajo todas las entidades móviles) ───────────────
    const casters = this._casters;
    casters.length = 0;
    casters.push(player);
    for (const n of npcs) casters.push(n);
    for (const a of animals) casters.push(a);
    for (const e of enemies) casters.push(e);

    let shadows = 0;
    for (const caster of casters) {
      if (!caster || caster.isSleeping || typeof caster.renderShadow !== 'function') continue;
      caster.renderShadow(ctx, camera, sun);
      shadows++;
    }

    // ── CAPA 1 · Entidades y obstáculos Y-sorted ─────────────────────────────
    const list = this._drawList;
    list.length = 0;
    tilemap.collectYSortedProps(camera, list);
    const propCount = list.length;
    for (const c of casters) {
      if (c) list.push(c);
    }
    list.sort(compareBySortY);

    for (const entry of list) {
      if (entry.isTileProp) {
        tilemap.drawProp(ctx, camera, entry);
      } else {
        entry.render(ctx, camera);
      }
    }

    this.stats.sorted = list.length;
    this.stats.props = propCount;
    this.stats.entities = list.length - propCount;
    this.stats.shadows = shadows;

    // ── CAPA 2 · Estructuras elevadas ────────────────────────────────────────
    tilemap.renderOverhead(ctx, camera, enemies, player);

    // ── CAPA 3 · Atmósfera y profundidad de campo ────────────────────────────
    // (FIX M2.6) En gama baja se omite la niebla (relleno de pantalla completo)
    if (!isInterior && this.quality !== 'low') {
      this._renderFog(ctx, camera, dayNight);
    }

    if (!frame.skipLighting) {
      // (BLOQUE 3.1) El pase de ciclo día/noche ya usa su canvas offscreen 320x180 y
      // destination-out con gradientes radiales para jugador, antorchas y ventanas.
      dayNight.render(ctx, camera, tilemap.lightSources, player, isInterior, tilemap.windowLights);
    }

    // (BLOQUE 2.3) Viñeta radial de cueva/mazmorra en la capa de atmósfera.
    this._renderCaveVignette(ctx, tilemap);

    // (BLOQUE 4) Niebla baja de cloacas + partículas ambientales por zona.
    this._renderLowFog(ctx, tilemap.currentSceneId);
    this._renderAmbientParticles(ctx, camera);

    // (BLOQUE 1.2) Bloom solo del mundo: antes de viñeta, scanlines y HUD.
    this._renderBloom(ctx);

    // (FIX M2.6) La viñeta también se omite en gama baja
    if (this.quality !== 'low') {
      this._renderVignette(ctx, isInterior);
    }

    // (BLOQUE 1.3) Scanlines CRT; solo mundo, antes del overlay/HUD.
    this._renderScanlines(ctx);

    // ── CAPA 4 · WORLD_HUD_OVERLAY (Bocadillos, globos flotantes y prompts de acción) ──
    // Se dibuja DESPUÉS de las entidades Y-Sorted, DESPUÉS de estructuras altas (tejados/árboles)
    // y DESPUÉS de la iluminación/noche para garantizar 100% nitidez y legibilidad sin sombras.
    if (typeof frame.onWorldHudOverlay === 'function') {
      frame.onWorldHudOverlay(ctx);
    }
  }

  // ===========================================================================
  // Texturas auxiliares pre-renderizadas
  // ===========================================================================

  _ensureVignette() {
    if (this._vignette || typeof document === 'undefined') return;
    const w = this.viewportWidth;
    const h = this.viewportHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d');

    // Desenfoque de lente: bandas superior e inferior que oscurecen suavemente
    const bandTop = 34;
    const top = g.createLinearGradient(0, 0, 0, bandTop);
    top.addColorStop(0, 'rgba(4, 6, 14, 0.46)');
    top.addColorStop(1, 'rgba(4, 6, 14, 0)');
    g.fillStyle = top;
    g.fillRect(0, 0, w, bandTop);

    const bandBottom = 38;
    const bottom = g.createLinearGradient(0, h - bandBottom, 0, h);
    bottom.addColorStop(0, 'rgba(4, 6, 14, 0)');
    bottom.addColorStop(1, 'rgba(4, 6, 14, 0.52)');
    g.fillStyle = bottom;
    g.fillRect(0, h - bandBottom, w, bandBottom);

    // Esquinas: refuerzo radial muy sutil para evitar bordes duros
    const radial = g.createRadialGradient(w / 2, h / 2, h * 0.55, w / 2, h / 2, w * 0.62);
    radial.addColorStop(0, 'rgba(0, 0, 0, 0)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
    g.fillStyle = radial;
    g.fillRect(0, 0, w, h);

    this._vignette = canvas;
  }

  _ensureFogTexture() {
    if (this._fogTexture || typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = FOG_TEXTURE_WIDTH;
    canvas.height = FOG_TEXTURE_HEIGHT;
    const g = canvas.getContext('2d');

    // Nubes de niebla deterministas (LCG con semilla fija) con wrap horizontal para tilear sin costuras
    let seed = 1337;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < 16; i++) {
      const bx = rand() * FOG_TEXTURE_WIDTH;
      const by = 10 + rand() * (FOG_TEXTURE_HEIGHT - 20);
      const br = 18 + rand() * 26;
      for (const ox of [-FOG_TEXTURE_WIDTH, 0, FOG_TEXTURE_WIDTH]) {
        const grad = g.createRadialGradient(bx + ox, by, 1, bx + ox, by, br);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        g.fillStyle = grad;
        g.fillRect(bx + ox - br, by - br, br * 2, br * 2);
      }
    }
    this._fogTexture = canvas;
  }

  // ===========================================================================
  // Capa 3
  // ===========================================================================

  /** Niebla ambiental ligera con paralaje: más densa al amanecer/atardecer y de noche. */
  _renderFog(ctx, camera, dayNight) {
    this._ensureFogTexture();
    if (!this._fogTexture) return;

    const h = dayNight.timeOfDayHours;
    let density;
    if (h >= 5 && h < 8) density = 0.1;        // bruma del amanecer
    else if (h >= 8 && h < 17) density = 0.03; // día despejado
    else if (h >= 17 && h < 20) density = 0.07;
    else density = 0.08;                       // noche

    const tex = this._fogTexture;
    const vw = this.viewportWidth;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';

    const layers = [
      { speed: 3.0, parallax: 0.16, y: 6, alpha: density, scale: 1.0 },
      { speed: -1.7, parallax: 0.3, y: 70, alpha: density * 0.75, scale: 1.25 }
    ];

    for (const layer of layers) {
      const tw = tex.width * layer.scale;
      const th = tex.height * layer.scale;
      let offset = -(this.clock * layer.speed + camera.renderX * layer.parallax) % tw;
      if (offset > 0) offset -= tw;
      ctx.globalAlpha = layer.alpha;
      for (let x = offset; x < vw; x += tw) {
        ctx.drawImage(tex, x, layer.y, tw, th);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }


  // ===========================================================================
  // BLOQUE 2.1 · Parallax de fondo y sombras de nubes
  // ===========================================================================

  _ensureParallax() {
    if (this._parallax || typeof document === 'undefined') return;
    let seed = 7331;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const make = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    };

    // Estrellas
    const stars = make(320, 100);
    const sg = stars.getContext('2d');
    for (let i = 0; i < 56; i++) {
      const x = rand() * 320;
      const y = rand() * 92;
      const a = 0.25 + rand() * 0.7;
      sg.fillStyle = `rgba(${200 + Math.floor(rand() * 55)}, ${220 + Math.floor(rand() * 35)}, 255, ${a.toFixed(2)})`;
      const sz = rand() > 0.88 ? 2 : 1;
      sg.fillRect(Math.floor(x), Math.floor(y), sz, sz);
    }

    // Montañas lejanas y cercanas
    const mountains = make(320, 110);
    const mg = mountains.getContext('2d');
    const ridge = (baseY, color, amp, step) => {
      mg.fillStyle = color;
      mg.beginPath();
      mg.moveTo(0, 110);
      for (let x = 0; x <= 320; x += step) {
        const y = baseY - Math.sin(x * 0.045 + baseY) * amp - rand() * amp * 0.4;
        mg.lineTo(x, y);
      }
      mg.lineTo(320, 110);
      mg.closePath();
      mg.fill();
    };
    ridge(62, 'rgba(30, 41, 59, 0.85)', 16, 20);
    ridge(82, 'rgba(15, 23, 42, 0.95)', 11, 16);

    // Nubes suaves (día)
    const clouds = make(320, 80);
    const cg = clouds.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const bx = rand() * 320;
      const by = 10 + rand() * 55;
      const br = 14 + rand() * 20;
      const grad = cg.createRadialGradient(bx, by, 1, bx, by, br);
      grad.addColorStop(0, 'rgba(226, 240, 255, 0.32)');
      grad.addColorStop(1, 'rgba(226, 240, 255, 0)');
      cg.fillStyle = grad;
      cg.fillRect(bx - br, by - br, br * 2, br * 2);
    }

    // Nubes oscuras para sombras sobre el suelo
    const shadow = make(320, 80);
    const shg = shadow.getContext('2d');
    for (let i = 0; i < 7; i++) {
      const bx = rand() * 320;
      const by = 10 + rand() * 55;
      const br = 18 + rand() * 26;
      const grad = shg.createRadialGradient(bx, by, 1, bx, by, br);
      grad.addColorStop(0, 'rgba(8, 14, 30, 0.32)');
      grad.addColorStop(1, 'rgba(8, 14, 30, 0)');
      shg.fillStyle = grad;
      shg.fillRect(bx - br, by - br, br * 2, br * 2);
    }

    this._parallax = { stars, mountains, clouds, shadow };
  }

  _drawParallaxLayer(ctx, canvas, factor, y, alpha, speed = 0) {
    if (!canvas) return;
    const w = canvas.width;
    let offset = -(this._cameraX * factor + this.clock * speed) % w;
    if (offset > 0) offset -= w;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let x = offset; x < this.viewportWidth; x += w) {
      ctx.drawImage(canvas, x, y);
    }
    ctx.restore();
  }

  _renderParallaxBackdrop(ctx, camera, dayNight, tilemap) {
    if (!this.effects.parallax || this.quality === 'low' || tilemap.isInterior()) return;
    this._ensureParallax();
    if (!this._parallax) return;
    const hour = dayNight.timeOfDayHours;
    const isNight = hour < 6 || hour >= 20;
    const vh = this.viewportHeight;

    ctx.save();
    ctx.fillStyle = isNight ? '#050916' : '#0f1a2b';
    ctx.fillRect(0, 0, this.viewportWidth, vh);

    // (BLOQUE 3) Respiración vertical muy sutil de nubes/estrellas.
    const breath = Math.sin(this.clock * 0.6) * 1.5;
    if (isNight) {
      this._drawParallaxLayer(ctx, this._parallax.stars, 0.1, Math.round(breath * 0.3), 0.9, 0.4);
    } else {
      this._drawParallaxLayer(ctx, this._parallax.clouds, 0.35, Math.round(6 + breath), 0.55, 1.1);
    }
    this._drawParallaxLayer(ctx, this._parallax.mountains, 0.28, vh - 100, isNight ? 0.55 : 0.72, 0.2);
    this._drawParallaxLayer(ctx, this._parallax.mountains, 0.6, vh - 74, isNight ? 0.35 : 0.5, 0.4);
    ctx.restore();
  }

  _renderCloudShadows(ctx, camera, dayNight, tilemap) {
    if (!this.effects.parallax || this.quality === 'low' || tilemap.isInterior()) return;
    const hour = dayNight.timeOfDayHours;
    if (hour < 7 || hour >= 19) return;
    this._ensureParallax();
    if (!this._parallax) return;
    this._drawParallaxLayer(ctx, this._parallax.shadow, 0.35, -8, 0.11, 2.0);
    this._drawParallaxLayer(ctx, this._parallax.shadow, 0.6, 34, 0.08, 3.2);
  }

  // ===========================================================================
  // BLOQUE 1.3 · Scanlines CRT
  // ===========================================================================

  _ensureScanlines(ctx) {
    if (this._scanlinePattern) return;
    if (typeof document === 'undefined' || !ctx || typeof ctx.createPattern !== 'function') return;
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 2;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(0, 0, 0, 1)';
    g.fillRect(0, 0, 1, 1);
    this._scanlinePattern = ctx.createPattern(c, 'repeat');
  }

  _renderScanlines(ctx) {
    if (!this.effects.scanlines || this.quality === 'low') return;
    this._ensureScanlines(ctx);
    if (!this._scanlinePattern) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = this._scanlinePattern;
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
    ctx.restore();
  }

  // ===========================================================================
  // BLOQUE 2.2 · Partículas ambientales por zona
  // ===========================================================================

  _ambientConfigFor(sceneId, isNight) {
    const id = String(sceneId || '');
    if (/^(overworld|first_stage|valley|north_peaks|south_swamp|west_wastes)/.test(id)) {
      return isNight
        ? { type: 'firefly', max: 20, rate: 5.0, colors: ['#fde047', '#a3e635', '#67e8f9'] }
        : { type: 'valley', max: 20, rate: 6.0, colors: ['#84cc16', '#fde047', '#f9a8d4', '#fef3c7'] };
    }
    if (id.startsWith('sewers')) return { type: 'sewer', max: 20, rate: 7.0, colors: ['#67e8f9', '#86efac', '#64748b'] };
    if (id.startsWith('mines')) return { type: 'mine', max: 20, rate: 6.0, colors: ['#cbd5e1', '#f59e0b', '#78716c'] };
    if (id.startsWith('forge')) return { type: 'forge', max: 20, rate: 7.0, colors: ['#f97316', '#fde047', '#cbd5e1'] };
    if (/^(ai_|quantum|condemned|citadel)/.test(id)) return { type: 'citadel', max: 20, rate: 7.0, colors: ['#22d3ee', '#c084fc', '#4ade80'] };
    if (/jail|temple|condemned/.test(id)) return { type: 'tomb', max: 20, rate: 5.0, colors: ['#a855f7', '#fde047', '#94a3b8'] };
    return { type: 'dust', max: 20, rate: 4.0, colors: ['#94a3b8', '#cbd5e1'] };
  }

  _makeAmbientParticle(camera, cfg) {
    const vw = this.viewportWidth;
    const vh = this.viewportHeight;
    const camX = camera ? camera.renderX : 0;
    const camY = camera ? camera.renderY : 0;
    const x = camX - 12 + Math.random() * (vw + 24);
    const y = camY - 12 + Math.random() * (vh + 24);
    const color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
    const base = {
      x, y, vx: 0, vy: 0, life: 4, maxLife: 4, size: 1, color,
      phase: Math.random() * Math.PI * 2, rot: 0, char: '0', glow: false
    };
    let type = cfg.type;
    if (type === 'valley') {
      const r = Math.random();
      type = r < 0.48 ? 'leaf' : r < 0.82 ? 'pollen' : 'butterfly';
    } else if (type === 'sewer') {
      const r = Math.random();
      type = r < 0.46 ? 'drip' : r < 0.8 ? 'bubble' : 'fly';
    } else if (type === 'mine') {
      const r = Math.random();
      type = r < 0.5 ? 'dust' : r < 0.8 ? 'spark' : 'rock';
    } else if (type === 'forge') {
      type = Math.random() < 0.6 ? 'spark' : 'steam';
    } else if (type === 'citadel') {
      const r = Math.random();
      type = r < 0.4 ? 'glitch' : r < 0.75 ? 'data' : 'static';
    } else if (type === 'temple') {
      type = Math.random() < 0.6 ? 'ember' : 'dust';
    } else if (type === 'tomb') {
      type = Math.random() < 0.35 ? 'web' : 'dust';
    }

    const p = { ...base, type };
    if (type === 'web') {
      p.vx = 1; p.vy = 0;
      p.life = p.maxLife = 4 + Math.random() * 3;
      p.size = 2 + Math.random() * 2;
      p.color = '#94a3b8';
    } else if (type === 'leaf') {
      p.vx = 6 + Math.random() * 9; p.vy = 4 + Math.random() * 6;
      p.life = p.maxLife = 5 + Math.random() * 4; p.size = 1.5 + Math.random(); p.rot = Math.random() * 6;
    } else if (type === 'pollen') {
      p.vx = 1.5 + Math.random() * 2; p.vy = 1 + Math.random() * 2;
      p.life = p.maxLife = 4 + Math.random() * 3; p.size = 0.8; p.color = '#fef3c7';
    } else if (type === 'butterfly') {
      p.vx = 7 + Math.random() * 8; p.vy = -2 + Math.random() * 4;
      p.life = p.maxLife = 4 + Math.random() * 3; p.size = 1.6; p.color = cfg.colors[2];
    } else if (type === 'firefly') {
      p.vx = 1.5; p.vy = 1; p.life = p.maxLife = 3 + Math.random() * 3;
      p.size = 1.1; p.glow = true;
    } else if (type === 'drip') {
      p.x = camX + Math.random() * vw; p.y = camY - 4;
      p.vx = 0; p.vy = 35 + Math.random() * 25; p.life = p.maxLife = 2.5; p.size = 1;
    } else if (type === 'bubble') {
      p.x = camX + Math.random() * vw; p.y = camY + vh + 2;
      p.vx = 0; p.vy = -8 - Math.random() * 8; p.life = p.maxLife = 3.5; p.size = 1 + Math.random() * 1.5;
    } else if (type === 'fly') {
      p.vx = (Math.random() - 0.5) * 18; p.vy = (Math.random() - 0.5) * 10;
      p.life = p.maxLife = 2.5 + Math.random() * 2; p.size = 1; p.color = '#334155';
    } else if (type === 'dust') {
      p.vx = 2 + Math.random() * 3; p.vy = 1 + Math.random() * 2;
      p.life = p.maxLife = 3 + Math.random() * 3; p.size = 0.8; p.color = '#cbd5e1';
    } else if (type === 'spark') {
      p.x = camX + Math.random() * vw; p.y = camY + vh + 2;
      p.vx = (Math.random() - 0.5) * 24; p.vy = -26 - Math.random() * 26;
      p.life = p.maxLife = 0.8 + Math.random() * 0.8; p.size = 1;
    } else if (type === 'rock') {
      p.x = camX + Math.random() * vw; p.y = camY - 4;
      p.vx = (Math.random() - 0.5) * 8; p.vy = 22 + Math.random() * 20;
      p.life = p.maxLife = 2.4; p.size = 1.5; p.color = '#78716c';
    } else if (type === 'steam') {
      p.x = camX + Math.random() * vw; p.y = camY + vh + 2;
      p.vx = (Math.random() - 0.5) * 6; p.vy = -7 - Math.random() * 6;
      p.life = p.maxLife = 2.5 + Math.random() * 2; p.size = 1.5; p.color = '#cbd5e1';
    } else if (type === 'glitch') {
      p.vx = 0; p.vy = 0; p.life = p.maxLife = 0.12 + Math.random() * 0.25;
      p.size = 1 + Math.random() * 3; p.color = Math.random() < 0.5 ? '#22d3ee' : '#c084fc';
    } else if (type === 'data') {
      p.vx = 0; p.vy = 9 + Math.random() * 8; p.life = p.maxLife = 2.5 + Math.random() * 2;
      p.size = 4; p.color = '#4ade80'; p.char = Math.random() < 0.5 ? '0' : '1';
    } else if (type === 'static') {
      p.vx = 0; p.vy = 0; p.life = p.maxLife = 0.12 + Math.random() * 0.15;
      p.size = 2 + Math.random() * 3; p.color = '#e2e8f0';
    } else if (type === 'ember') {
      p.x = camX + Math.random() * vw; p.y = camY + vh + 2;
      p.vx = (Math.random() - 0.5) * 12; p.vy = -18 - Math.random() * 16;
      p.life = p.maxLife = 1 + Math.random() * 1.4; p.size = 1; p.glow = true;
    }
    return p;
  }

  _updateAmbientParticles(dt, context = {}) {
    if (!this.effects.particles || this.quality === 'low') {
      this._ambientParticles.length = 0;
      return;
    }
    const sceneId = context.sceneId || null;
    if (!sceneId) return;
    const isNight = Boolean(context.isNight);
    const key = `${sceneId}|${isNight ? 'n' : 'd'}`;
    if (key !== this._ambientKey) {
      this._ambientKey = key;
      this._ambientConfig = this._ambientConfigFor(sceneId, isNight);
      this._ambientParticles.length = 0;
      this._ambientSpawnAccumulator = 0;
      const prefill = Math.floor(this._ambientConfig.max * 0.45);
      for (let i = 0; i < prefill; i++) {
        this._ambientParticles.push(this._makeAmbientParticle(context.camera, this._ambientConfig));
      }
    }
    // (BLOQUE 1.3) Humo de chimeneas de Valleverde.
    if (context.chimneys && context.chimneys.length > 0) {
      this._smokeSpawnAccumulator = (this._smokeSpawnAccumulator || 0) + dt * 2.4;
      while (this._smokeSpawnAccumulator >= 1 && this._ambientParticles.length < 20) {
        this._smokeSpawnAccumulator -= 1;
        const ch = context.chimneys[Math.floor(Math.random() * context.chimneys.length)];
        this._ambientParticles.push({
          type: 'smoke',
          x: ch.x + (Math.random() - 0.5) * 3,
          y: ch.y - 2,
          vx: (Math.random() - 0.5) * 4,
          vy: -7 - Math.random() * 5,
          life: 3 + Math.random() * 2,
          maxLife: 5,
          size: 1.5 + Math.random() * 1.5,
          color: '#9ca3af',
          phase: Math.random() * Math.PI * 2,
          rot: 0,
          char: '0',
          glow: false
        });
      }
    }
    const cfg = this._ambientConfig;
    if (!cfg || !context.camera) return;
    const vw = this.viewportWidth;
    const vh = this.viewportHeight;
    const cam = context.camera;
    this._ambientSpawnAccumulator += dt * cfg.rate;
    let guard = 0;
    while (this._ambientSpawnAccumulator >= 1 && this._ambientParticles.length < cfg.max && guard++ < 8) {
      this._ambientSpawnAccumulator -= 1;
      this._ambientParticles.push(this._makeAmbientParticle(cam, cfg));
    }
    const t = this.clock;
    for (let i = this._ambientParticles.length - 1; i >= 0; i--) {
      const p = this._ambientParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this._ambientParticles.splice(i, 1);
        continue;
      }
      switch (p.type) {
        case 'leaf':
          p.x += p.vx * dt + Math.sin(t * 1.6 + p.phase) * 5 * dt;
          p.y += p.vy * dt + Math.cos(t * 1.3 + p.phase) * 2 * dt;
          p.rot += dt * 2.2;
          break;
        case 'pollen':
          p.x += p.vx * dt + Math.sin(t + p.phase) * 1.5 * dt;
          p.y += p.vy * dt;
          break;
        case 'butterfly':
          p.x += p.vx * dt;
          p.y += Math.sin(t * 2.5 + p.phase) * 12 * dt;
          break;
        case 'firefly':
          p.x += Math.sin(t * 2.1 + p.phase) * 6 * dt;
          p.y += Math.cos(t * 1.7 + p.phase) * 4 * dt;
          break;
        case 'drip':
          p.vy += 55 * dt;
          p.y += p.vy * dt;
          break;
        case 'bubble':
          p.y += p.vy * dt;
          p.x += Math.sin(t * 2 + p.phase) * 5 * dt;
          break;
        case 'fly':
          p.vx += (Math.random() - 0.5) * 40 * dt;
          p.vy += (Math.random() - 0.5) * 40 * dt;
          p.vx = Math.max(-20, Math.min(20, p.vx));
          p.vy = Math.max(-16, Math.min(16, p.vy));
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        case 'dust':
          p.x += p.vx * dt + Math.sin(t + p.phase) * 2 * dt;
          p.y += p.vy * dt;
          break;
        case 'spark':
          p.vy += 28 * dt;
          p.vx *= 0.99;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        case 'rock':
          p.vy += 48 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        case 'steam':
          p.y += p.vy * dt;
          p.size += dt * 0.7;
          p.x += Math.sin(t + p.phase) * 3 * dt;
          break;
        case 'data':
          p.y += p.vy * dt;
          break;
        case 'glitch':
        case 'static':
          break;
        case 'ember':
          p.vy += 8 * dt;
          p.x += p.vx * dt + Math.sin(t * 2 + p.phase) * 3 * dt;
          p.y += p.vy * dt;
          break;
        case 'web':
          // Telaraña mecida por el viento.
          p.x += Math.sin(t * 0.8 + p.phase) * 3 * dt;
          p.y += Math.sin(t * 0.5 + p.phase) * 2 * dt;
          break;
        case 'smoke':
          p.y += p.vy * dt;
          p.x += Math.sin(t * 0.7 + p.phase) * 4 * dt;
          p.size += dt * 0.8;
          break;
        default:
          p.x += p.vx * dt;
          p.y += p.vy * dt;
      }
      const margin = 26;
      if (p.x < cam.renderX - margin || p.x > cam.renderX + vw + margin ||
          p.y < cam.renderY - margin || p.y > cam.renderY + vh + margin) {
        this._ambientParticles.splice(i, 1);
      }
    }
  }

  /** (BLOQUE 2.3) Oscurecimiento radial de esquinas en mazmorras/minas. */
  _renderCaveVignette(ctx, tilemap) {
    if (this.quality === 'low') return;
    const id = String(tilemap.currentSceneId || '');
    if (!/sewers|mines|forge|temple|jail|condemned|quantum|citadel|ai_/.test(id)) return;
    const W = this.viewportWidth;
    const H = this.viewportHeight;
    ctx.save();
    const corners = [[0, 0], [W, 0], [0, H], [W, H]];
    for (const [cx, cy] of corners) {
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 130);
      g.addColorStop(0, 'rgba(0, 0, 0, 0.38)');
      g.addColorStop(0.55, 'rgba(0, 0, 0, 0.12)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  /** (BLOQUE 4) Niebla baja de cloacas, independiente de la niebla atmosférica. */
  _renderLowFog(ctx, sceneId) {
    if (!this.effects.particles || this.quality === 'low') return;
    if (!sceneId || !String(sceneId).startsWith('sewers')) return;
    const t = this.clock;
    const w = this.viewportWidth;
    const h = this.viewportHeight;
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const y = h - 34 + i * 12 + Math.sin(t * 0.8 + i * 1.7) * 2;
      const g = ctx.createLinearGradient(0, y, 0, h);
      g.addColorStop(0, 'rgba(148,163,184,0)');
      g.addColorStop(0.55, `rgba(148,163,184,${(0.05 + i * 0.02).toFixed(3)})`);
      g.addColorStop(1, 'rgba(148,163,184,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, w, h - y);
    }
    ctx.restore();
  }

  _renderAmbientParticles(ctx, camera) {
    if (!this.effects.particles || this.quality === 'low') return;
    if (!this._ambientParticles.length) return;
    const t = this.clock;
    ctx.save();
    for (const p of this._ambientParticles) {
      const sx = p.x - camera.renderX;
      const sy = p.y - camera.renderY;
      if (sx < -8 || sx > this.viewportWidth + 8 || sy < -8 || sy > this.viewportHeight + 8) continue;
      const lifeRatio = Math.max(0, Math.min(1, p.life / Math.max(0.01, p.maxLife)));
      if (p.type === 'leaf') {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.rot);
        ctx.globalAlpha = 0.35 + lifeRatio * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.6, p.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'butterfly') {
        ctx.globalAlpha = 0.45 + lifeRatio * 0.5;
        ctx.fillStyle = p.color;
        const flap = Math.sin(t * 12 + p.phase) * 1.5;
        ctx.beginPath();
        ctx.ellipse(sx - 1.5, sy + flap, 1.6, 1, -0.5, 0, Math.PI * 2);
        ctx.ellipse(sx + 1.5, sy + flap, 1.6, 1, 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'firefly') {
        const pulse = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.4 + p.phase));
        ctx.globalAlpha = pulse;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size + 1.6, 0, Math.PI * 2);
        ctx.globalAlpha = pulse * 0.25;
        ctx.fill();
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'drip') {
        ctx.globalAlpha = 0.55 + lifeRatio * 0.4;
        ctx.fillStyle = p.color;
        ctx.fillRect(sx, sy, 1, 3);
      } else if (p.type === 'bubble') {
        ctx.globalAlpha = 0.25 + lifeRatio * 0.4;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'fly') {
        ctx.globalAlpha = 0.5 + Math.random() * 0.3;
        ctx.fillStyle = p.color;
        ctx.fillRect(sx, sy, 1, 1);
      } else if (p.type === 'spark' || p.type === 'ember') {
        ctx.globalAlpha = 0.5 + lifeRatio * 0.5;
        ctx.fillStyle = p.color;
        ctx.fillRect(sx, sy, 1, 2);
      } else if (p.type === 'rock') {
        ctx.globalAlpha = 0.6 + lifeRatio * 0.3;
        ctx.fillStyle = p.color;
        ctx.fillRect(sx, sy, p.size, p.size);
      } else if (p.type === 'steam') {
        ctx.globalAlpha = 0.08 + lifeRatio * 0.12;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'glitch') {
        ctx.globalAlpha = 0.5 + Math.random() * 0.4;
        ctx.fillStyle = p.color;
        ctx.fillRect(sx, sy, p.size * 2, Math.max(0.6, p.size * 0.5));
      } else if (p.type === 'data') {
        ctx.globalAlpha = 0.3 + lifeRatio * 0.5;
        ctx.fillStyle = p.color;
        ctx.font = '4px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.char, sx, sy);
      } else if (p.type === 'static') {
        ctx.globalAlpha = 0.15 + Math.random() * 0.2;
        ctx.fillStyle = p.color;
        ctx.fillRect(sx, sy, p.size, 1);
      } else if (p.type === 'smoke') {
        ctx.globalAlpha = Math.max(0, (lifeRatio * 0.22));
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'web') {
        ctx.globalAlpha = 0.08 + lifeRatio * 0.10;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.6;
        const wind = Math.sin(t * 0.8 + p.phase) * 1.5;
        for (let k = 0; k < 4; k++) {
          const a = p.phase + k * (Math.PI / 4);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a) * p.size * 3 + wind, sy + Math.sin(a) * p.size * 3);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(sx + wind, sy, p.size * 1.4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.globalAlpha = 0.25 + lifeRatio * 0.4;
        ctx.fillStyle = p.color;
        ctx.fillRect(sx, sy, Math.max(0.8, p.size), Math.max(0.8, p.size));
      }
    }
    ctx.restore();
  }

  _ensureBloom() {
    if (this._bloomCanvas || typeof document === 'undefined') return;
    const w = Math.max(1, Math.floor(this.viewportWidth / 4));
    const h = Math.max(1, Math.floor(this.viewportHeight / 4));
    this._bloomCanvas = document.createElement('canvas');
    this._bloomCanvas.width = w;
    this._bloomCanvas.height = h;
    this._bloomCtx = this._bloomCanvas.getContext('2d');
  }

  /**
   * (BLOQUE 3.2) Bloom barato: copia el mundo a 1/4, lo desenfoca/realza y lo
   * superpone con 'lighter' al 40%. Se ejecuta antes de viñeta, overlays y HUD.
   */
  _renderBloom(ctx) {
    if (!this.effects.bloom || this.quality === 'low') return;
    if (!ctx || !ctx.canvas) return;
    this._ensureBloom();
    if (!this._bloomCtx) return;

    const bctx = this._bloomCtx;
    const bw = this._bloomCanvas.width;
    const bh = this._bloomCanvas.height;
    const source = ctx.canvas;
    if (!source.width || !source.height) return;

    bctx.save();
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalCompositeOperation = 'source-over';
    bctx.globalAlpha = 1;
    bctx.clearRect(0, 0, bw, bh);
    try {
      bctx.filter = 'blur(3px) brightness(0.8) contrast(2.5)';
    } catch {}
    bctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, bw, bh);
    bctx.filter = 'none';
    bctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(this._bloomCanvas, 0, 0, bw, bh, 0, 0, this.viewportWidth, this.viewportHeight);
    ctx.restore();
  }

  _renderVignette(ctx, isInterior) {
    this._ensureVignette();
    if (!this._vignette) return;
    ctx.save();
    ctx.globalAlpha = isInterior ? 0.75 : 1;
    ctx.drawImage(this._vignette, 0, 0, this.viewportWidth, this.viewportHeight);
    ctx.restore();
  }
}

