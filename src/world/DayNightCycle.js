/**
 * DayNightCycle.js · Reloj solar + Iluminación Dinámica Diferida (HD-2D sobre Canvas 2D)
 *
 *  - Reloj natural: 12 minutos reales por día completo (24 h de juego).
 *  - getSunState(): dirección, longitud y opacidad de las sombras proyectadas según la hora
 *    (mañana → sombras largas hacia el oeste, mediodía → cortas, tarde → largas hacia el este,
 *    noche → luz lunar tenue).
 *  - Iluminación diferida: un lienzo secundario en memoria (`lightingCanvas`, 320×180) se rellena con el
 *    tinte ambiental de la hora, se perforan las fuentes de luz con `destination-out`
 *    (farolas/antorchas con flicker procedural, destello cian de la Espada de la Recursividad,
 *    ventanas de las casas al anochecer) y finalmente se proyecta sobre la escena con `multiply`.
 *  - Los halos cálidos/cian se añaden con mezcla aditiva ('lighter') tras el multiply.
 *
 * Los sprites de luz (gradientes radiales) se pre-renderizan una sola vez y se escalan con drawImage,
 * evitando crear gradientes cada fotograma (mantiene los 60 FPS).
 */

const LIGHT_SPRITE_SIZE = 64;

const GLOW_PALETTES = {
  warm: [255, 214, 120],
  amber: [255, 176, 82],
  cyan: [96, 232, 255]
};

export class DayNightCycle {
  constructor(viewportWidth = 320, viewportHeight = 180, dayDurationSeconds = 720) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.dayDurationSeconds = dayDurationSeconds;

    // Empieza a las 08:30 AM
    this.timeOfDayHours = 8.5;
    this.pulseTimer = 0;
    this.flickerClock = 0;

    // Lienzo secundario en memoria (diferido) de 320×180 px
    this.lightingCanvas = null;
    this.lightingCtx = null;
    this._holeSprite = null;
    this._glowSprites = {};

    this.keyframes = [
      { hour: 0,  r: 28,  g: 40,  b: 96,  a: 0.66 },
      { hour: 4,  r: 32,  g: 46,  b: 104, a: 0.62 },
      { hour: 6,  r: 255, g: 150, b: 110, a: 0.30 },
      { hour: 8,  r: 255, g: 232, b: 180, a: 0.08 },
      { hour: 12, r: 255, g: 255, b: 245, a: 0.00 },
      { hour: 16, r: 255, g: 236, b: 185, a: 0.07 },
      { hour: 18, r: 255, g: 128, b: 70,  a: 0.34 },
      { hour: 19, r: 150, g: 70,  b: 120, a: 0.44 },
      { hour: 20, r: 50,  g: 52,  b: 120, a: 0.56 },
      { hour: 22, r: 30,  g: 42,  b: 98,  a: 0.64 },
      { hour: 24, r: 28,  g: 40,  b: 96,  a: 0.66 }
    ];

    this._sun = { dx: -1, dy: 0.18, length: 1, alphaScale: 1, isDay: true, elevation: 0 };
  }

  update(dt) {
    const hoursPerSecond = 24 / this.dayDurationSeconds;
    this.timeOfDayHours = (this.timeOfDayHours + hoursPerSecond * dt) % 24;
    this.pulseTimer += dt * 3.2;
    this.flickerClock += dt;
  }

  getCurrentTint() {
    const h = this.timeOfDayHours;
    let prev = this.keyframes[0];
    let next = this.keyframes[this.keyframes.length - 1];

    for (let i = 0; i < this.keyframes.length - 1; i++) {
      if (h >= this.keyframes[i].hour && h <= this.keyframes[i + 1].hour) {
        prev = this.keyframes[i];
        next = this.keyframes[i + 1];
        break;
      }
    }

    const span = next.hour - prev.hour || 1;
    const t = (h - prev.hour) / span;

    return {
      r: Math.round(prev.r + (next.r - prev.r) * t),
      g: Math.round(prev.g + (next.g - prev.g) * t),
      b: Math.round(prev.b + (next.b - prev.b) * t),
      a: prev.a + (next.a - prev.a) * t
    };
  }

  /**
   * Estado del «reloj solar» para proyectar sombras:
   *  dx ∈ [-1, 1]  → hacia dónde apunta la sombra (negativo = oeste/izquierda)
   *  dy            → ligera caída hacia el espectador (profundidad pseudo-3D)
   *  length        → multiplicador de longitud (corta a mediodía, larga al amanecer/atardecer)
   *  alphaScale    → opacidad relativa (la luna proyecta sombras tenues)
   *
   * Devuelve siempre el mismo objeto (sin asignaciones por fotograma).
   */
  getSunState() {
    const h = this.timeOfDayHours;
    const sun = this._sun;
    if (h >= 6 && h < 18) {
      const t = (h - 6) / 12;
      const elevation = Math.sin(Math.PI * t);
      sun.dx = -Math.cos(Math.PI * t);
      sun.dy = 0.18;
      sun.length = 0.6 + (1 - elevation) * 3.2;
      sun.alphaScale = Math.min(1, 0.6 + elevation * 0.6);
      sun.isDay = true;
      sun.elevation = elevation;
    } else {
      // Luz lunar: dirección fija y sombra suave
      sun.dx = 0.45;
      sun.dy = 0.2;
      sun.length = 1.5;
      sun.alphaScale = 0.45;
      sun.isDay = false;
      sun.elevation = 0;
    }
    return sun;
  }

  getPhaseLabel() {
    const h = this.timeOfDayHours;
    if (h >= 5.5 && h < 8) return 'Amanecer';
    if (h >= 8 && h < 17) return 'Día';
    if (h >= 17 && h < 20) return 'Atardecer';
    return 'Noche';
  }

  isNight() {
    const h = this.timeOfDayHours;
    return h >= 20 || h < 6;
  }

  /** Las ventanas se encienden desde el atardecer hasta el amanecer. */
  areWindowsLit() {
    const h = this.timeOfDayHours;
    return h >= 18.5 || h < 6.5;
  }

  getFormattedTime() {
    const hours = Math.floor(this.timeOfDayHours);
    const minutes = Math.floor((this.timeOfDayHours - hours) * 60);
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /** Parpadeo procedural suave y determinista por fuente de luz (1 ± ~10 %). */
  _flicker(light, amplitude = 1) {
    const p = light.x * 0.37 + light.y * 0.91;
    const t = this.flickerClock;
    const v =
      0.07 * Math.sin(t * 5.1 + p) +
      0.05 * Math.sin(t * 11.7 + p * 1.9) +
      0.03 * Math.sin(t * 23.3 + p * 0.7);
    return 1 + v * amplitude;
  }

  _ensureBuffers() {
    if (this.lightingCanvas || typeof document === 'undefined') return;
    this.lightingCanvas = document.createElement('canvas');
    this.lightingCanvas.width = this.viewportWidth;
    this.lightingCanvas.height = this.viewportHeight;
    this.lightingCtx = this.lightingCanvas.getContext('2d');

    // Sprite de agujero (alfa) pre-renderizado
    const hole = document.createElement('canvas');
    hole.width = LIGHT_SPRITE_SIZE;
    hole.height = LIGHT_SPRITE_SIZE;
    const hctx = hole.getContext('2d');
    const c = LIGHT_SPRITE_SIZE / 2;
    const hg = hctx.createRadialGradient(c, c, 2, c, c, c);
    hg.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    hg.addColorStop(0.55, 'rgba(0, 0, 0, 0.45)');
    hg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    hctx.fillStyle = hg;
    hctx.fillRect(0, 0, LIGHT_SPRITE_SIZE, LIGHT_SPRITE_SIZE);
    this._holeSprite = hole;

    // Sprites de halo de color pre-renderizados
    for (const [name, [r, g, b]] of Object.entries(GLOW_PALETTES)) {
      const glow = document.createElement('canvas');
      glow.width = LIGHT_SPRITE_SIZE;
      glow.height = LIGHT_SPRITE_SIZE;
      const gctx = glow.getContext('2d');
      const gg = gctx.createRadialGradient(c, c, 1, c, c, c);
      gg.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
      gg.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, 0.28)`);
      gg.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      gctx.fillStyle = gg;
      gctx.fillRect(0, 0, LIGHT_SPRITE_SIZE, LIGHT_SPRITE_SIZE);
      this._glowSprites[name] = glow;
    }
  }

  /**
   * Reúne las luces activas en coordenadas de pantalla: fuentes del mapa (con flicker),
   * ventanas nocturnas, destello de la Espada y linterna/aura del jugador.
   */
  _gatherLights(camera, worldLights, windowLights, player, extraLights) {
    const out = [];
    const vw = this.viewportWidth;
    const vh = this.viewportHeight;

    const push = (light, flickerAmp, kind) => {
      const sx = light.x - camera.renderX;
      const sy = light.y - camera.renderY;
      const radius = light.radius * this._flicker(light, flickerAmp);
      if (sx < -radius || sx > vw + radius || sy < -radius || sy > vh + radius) return;
      out.push({
        x: Math.round(sx),
        y: Math.round(sy),
        radius,
        intensity: light.intensity ?? 0.8,
        glow: light.glow || (kind === 'window' ? 'amber' : 'warm'),
        kind
      });
    };

    for (const l of worldLights || []) push(l, 1, l.kind || 'lamp');

    if (windowLights && windowLights.length > 0 && this.areWindowsLit()) {
      for (const w of windowLights) push(w, 0.35, 'window');
    }

    for (const l of extraLights || []) push(l, 0, l.kind || 'extra');

    if (player) {
      const px = player.centerX - camera.renderX;
      const py = player.centerY - camera.renderY;
      const lantern = Boolean(player.hasLanternEquipped);
      out.push({
        x: Math.round(px),
        y: Math.round(py),
        radius: (lantern ? 56 : 28) + Math.sin(this.pulseTimer) * 0.8,
        intensity: lantern ? 0.92 : 0.65,
        glow: 'warm',
        kind: 'player',
        glowScale: lantern ? 0.7 : 0
      });

      // Destello cian de la Espada de la Recursividad durante el ataque
      if (player.hasSword && player.isAttacking && player.attackDuration > 0) {
        const progress = 1 - player.attackTimer / player.attackDuration;
        const pulse = Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI);
        const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const d = dirs[player.direction] || dirs.down;
        out.push({
          x: Math.round(px + d[0] * 11),
          y: Math.round(py + d[1] * 11),
          radius: 20 + pulse * 22,
          intensity: 0.55 + pulse * 0.45,
          glow: 'cyan',
          kind: 'sword',
          glowScale: 1.1 * pulse,
          alwaysGlow: true
        });
      }
    }
    return out;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx   contexto principal (escala lógica 320×180)
   * @param {Camera2D} camera
   * @param {Array} worldLights  fuentes de luz fijas de la escena
   * @param {Player|null} player
   * @param {boolean} isInterior
   * @param {Array} windowLights ventanas de las casas (solo se encienden de noche)
   * @param {Array} extraLights  luces dinámicas adicionales
   */
  render(ctx, camera, worldLights = [], player = null, isInterior = false, windowLights = [], extraLights = []) {
    this._ensureBuffers();
    if (!this.lightingCtx) return;

    const tint = isInterior
      ? { r: 60, g: 44, b: 70, a: 0.3 }
      : this.getCurrentTint();

    const lights = this._gatherLights(camera, worldLights, isInterior ? [] : windowLights, player, extraLights);
    const hasSwordFlash = lights.some((l) => l.alwaysGlow);

    if (tint.a <= 0.01 && !hasSwordFlash) return;

    const darkness = isInterior
      ? 0.65
      : Math.max(0, Math.min(1, (tint.a - 0.1) / 0.5));

    const lctx = this.lightingCtx;
    lctx.save();
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.globalAlpha = 1;
    lctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);

    // 1. Tinte ambiental según la hora
    if (tint.a > 0.01) {
      lctx.fillStyle = `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${tint.a.toFixed(3)})`;
      lctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
    }

    // 2. Perforar las fuentes de luz (destination-out)
    if (darkness > 0.04) {
      lctx.globalCompositeOperation = 'destination-out';
      for (const light of lights) {
        const d = light.radius * 2;
        lctx.globalAlpha = Math.min(1, light.intensity * darkness);
        lctx.drawImage(this._holeSprite, light.x - light.radius, light.y - light.radius, d, d);
      }
    }
    lctx.restore();

    // 3. Proyección multiplicativa sobre la escena
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(this.lightingCanvas, 0, 0, this.viewportWidth, this.viewportHeight);

    // 4. Halos aditivos de color (cálido, ámbar de ventanas, cian de la espada)
    ctx.globalCompositeOperation = 'lighter';
    for (const light of lights) {
      let strength;
      if (light.alwaysGlow) {
        strength = 0.55 * (light.glowScale ?? 1);
      } else if (darkness > 0.1) {
        strength = 0.3 * darkness * light.intensity * (light.glowScale ?? 1);
        if (light.kind === 'player' && !light.glowScale) continue;
      } else {
        continue;
      }
      if (strength <= 0.01) continue;
      const sprite = this._glowSprites[light.glow] || this._glowSprites.warm;
      const gr = light.radius * 0.8;
      ctx.globalAlpha = Math.min(1, strength);
      ctx.drawImage(sprite, light.x - gr, light.y - gr, gr * 2, gr * 2);
    }
    ctx.restore();
  }
}
