/**
 * Ciclo de Día/Noche con ritmo de reloj natural (1 minuto de juego cada 0.5 s reales = 12 min por día completo)
 * y soporte de iluminación interior cálida cuando el jugador entra en una vivienda.
 */
export class DayNightCycle {
  constructor(viewportWidth = 320, viewportHeight = 180, dayDurationSeconds = 720) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.dayDurationSeconds = dayDurationSeconds;

    // Empieza a las 08:30 AM
    this.timeOfDayHours = 8.5;
    this.pulseTimer = 0;

    this.lightScale = 4;
    this.lightCanvas = document.createElement('canvas');
    this.lightCanvas.width = viewportWidth * this.lightScale;
    this.lightCanvas.height = viewportHeight * this.lightScale;
    this.lightCtx = this.lightCanvas.getContext('2d');

    this.keyframes = [
      { hour: 0,  r: 12,  g: 18,  b: 48,  a: 0.72 },
      { hour: 4,  r: 16,  g: 22,  b: 56,  a: 0.68 },
      { hour: 6,  r: 235, g: 130, b: 95,  a: 0.30 },
      { hour: 8,  r: 255, g: 225, b: 160, a: 0.08 },
      { hour: 12, r: 255, g: 255, b: 240, a: 0.00 },
      { hour: 16, r: 255, g: 230, b: 170, a: 0.06 },
      { hour: 18, r: 235, g: 110, b: 55,  a: 0.36 },
      { hour: 20, r: 30,  g: 32,  b: 78,  a: 0.58 },
      { hour: 22, r: 14,  g: 20,  b: 52,  a: 0.70 },
      { hour: 24, r: 12,  g: 18,  b: 48,  a: 0.72 }
    ];
  }

  update(dt) {
    const hoursPerSecond = 24 / this.dayDurationSeconds;
    this.timeOfDayHours = (this.timeOfDayHours + hoursPerSecond * dt) % 24;
    this.pulseTimer += dt * 3.2;
  }

  skipHours(hours = 2) {
    this.timeOfDayHours = (this.timeOfDayHours + hours) % 24;
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

  getFormattedTime() {
    const hours = Math.floor(this.timeOfDayHours);
    const minutes = Math.floor((this.timeOfDayHours - hours) * 60);
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  render(ctx, camera, worldLights = [], player = null, isInterior = false) {
    const tint = isInterior
      ? { r: 24, g: 18, b: 32, a: 0.25 }
      : this.getCurrentTint();

    if (tint.a <= 0.01) return;

    const lctx = this.lightCtx;
    lctx.save();
    lctx.setTransform(this.lightScale, 0, 0, this.lightScale, 0, 0);
    lctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);

    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${tint.a.toFixed(3)})`;
    lctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

    const darknessFactor = isInterior
      ? 0.65
      : Math.max(0, Math.min(1, (tint.a - 0.15) / 0.55));

    if (darknessFactor > 0.05) {
      const flicker = Math.sin(this.pulseTimer) * 1.5;
      lctx.globalCompositeOperation = 'destination-out';

      if (player) {
        const px = Math.round(player.centerX - camera.renderX);
        const py = Math.round(player.centerY - camera.renderY);
        const playerRadius = player.hasLanternEquipped ? 56 : 28;
        const playerStrength = player.hasLanternEquipped ? 0.92 : 0.65;
        this._punchLightHole(
          lctx,
          px,
          py,
          playerRadius + flicker * 0.5,
          playerStrength * darknessFactor
        );
      }

      for (const light of worldLights) {
        const sx = Math.round(light.x - camera.renderX);
        const sy = Math.round(light.y - camera.renderY);
        if (
          sx < -light.radius ||
          sx > this.viewportWidth + light.radius ||
          sy < -light.radius ||
          sy > this.viewportHeight + light.radius
        ) {
          continue;
        }
        this._punchLightHole(
          lctx,
          sx,
          sy,
          light.radius + flicker,
          light.intensity * darknessFactor
        );
      }
    }
    lctx.restore();

    ctx.save();
    ctx.drawImage(
      this.lightCanvas,
      0,
      0,
      this.lightCanvas.width,
      this.lightCanvas.height,
      0,
      0,
      this.viewportWidth,
      this.viewportHeight
    );

    if (darknessFactor > 0.1) {
      for (const light of worldLights) {
        const sx = Math.round(light.x - camera.renderX);
        const sy = Math.round(light.y - camera.renderY);
        if (
          sx < -light.radius ||
          sx > this.viewportWidth + light.radius ||
          sy < -light.radius ||
          sy > this.viewportHeight + light.radius
        ) {
          continue;
        }

        const grad = ctx.createRadialGradient(sx, sy, 1, sx, sy, light.radius * 0.75);
        const glowAlpha = (0.22 * darknessFactor * light.intensity).toFixed(3);
        grad.addColorStop(0, `rgba(255, 220, 120, ${glowAlpha})`);
        grad.addColorStop(1, 'rgba(255, 180, 70, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, light.radius * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  _punchLightHole(lctx, x, y, radius, strength) {
    const grad = lctx.createRadialGradient(x, y, 2, x, y, radius);
    grad.addColorStop(0, `rgba(0, 0, 0, ${Math.min(1, strength * 0.95).toFixed(3)})`);
    grad.addColorStop(0.55, `rgba(0, 0, 0, ${(strength * 0.45).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    lctx.fillStyle = grad;
    lctx.beginPath();
    lctx.arc(x, y, radius, 0, Math.PI * 2);
    lctx.fill();
  }
}
