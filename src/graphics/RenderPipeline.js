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

    this.stats = { sorted: 0, props: 0, entities: 0, shadows: 0 };
  }

  /** Avanza el reloj interno de la niebla (llamar una vez por update lógico). */
  update(dt) {
    this.clock += dt;
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

    // ── CAPA 0 · Suelo ───────────────────────────────────────────────────────
    tilemap.renderGround(ctx, camera);
    if (typeof frame.onGround === 'function') {
      frame.onGround(ctx);
    }

    // ── Sombras proyectadas (bajo todas las entidades móviles) ───────────────
    const sun = isInterior ? INTERIOR_SUN : dayNight.getSunState();
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
    if (!isInterior) {
      this._renderFog(ctx, camera, dayNight);
    }

    if (!frame.skipLighting) {
      dayNight.render(ctx, camera, tilemap.lightSources, player, isInterior, tilemap.windowLights);
    }

    this._renderVignette(ctx, isInterior);
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
    const vh = this.viewportHeight;

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

  _renderVignette(ctx, isInterior) {
    this._ensureVignette();
    if (!this._vignette) return;
    ctx.save();
    ctx.globalAlpha = isInterior ? 0.75 : 1;
    ctx.drawImage(this._vignette, 0, 0, this.viewportWidth, this.viewportHeight);
    ctx.restore();
  }
}

