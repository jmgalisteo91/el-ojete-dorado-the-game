/**
 * Camera2D con seguimiento suave (lerp) al objetivo y confinamiento a los límites del mapa.
 * Si el mapa es más pequeño que el viewport (ej. interior de una vivienda), centra el mapa.
 */
export class Camera2D {
  constructor(viewportWidth, viewportHeight, worldWidth, worldHeight) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    this.x = 0;
    this.y = 0;
    this.lerpSpeed = 8.0;

    // (FIX 1.2) Sacudida de pantalla en gameplay: offset temporal sumado a renderX/renderY
    this.shakeTimer = 0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;

    // (FIX CÁMARA) Capa cinematográfica suavizada; NUNCA se toca x/y a lo bruto.
    this.cinematicZoom = 1.0;
    this.targetCinematicZoom = 1.0;
    this.cinematicOffset = { x: 0, y: 0 };
    this.targetCinematicOffset = { x: 0, y: 0 };
  }

  /**
   * (FIX 1.2) Sacude la cámara del mundo. La intensidad está en píxeles lógicos
   * (1 px lógico = RENDER_SCALE px en pantalla), así que 1-2 se lee como un golpe seco.
   * La sacudida más intensa gana; la duración más larga se conserva.
   */
  shake(intensity = 2, duration = 0.25) {
    const i = Math.max(0, Number(intensity) || 0);
    const d = Math.max(0, Number(duration) || 0);
    if (i <= 0 || d <= 0) return;
    this.shakeIntensity = Math.max(this.shakeIntensity, i);
    this.shakeDuration = Math.max(this.shakeDuration, d);
    this.shakeTimer = Math.max(this.shakeTimer, d);
  }

  /** Decae la sacudida y recalcula el offset con ruido por frame. */
  updateShake(dt) {
    if (this.shakeTimer <= 0) {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeIntensity = 0;
      this.shakeDuration = 0;
      return;
    }

    this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    // Amplitud con caída lineal: arranca fuerte y se apaga suave
    const decay = this.shakeDuration > 0 ? this.shakeTimer / this.shakeDuration : 0;
    const amp = this.shakeIntensity * decay;

    if (this.shakeTimer <= 0) {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeIntensity = 0;
      this.shakeDuration = 0;
      return;
    }

    this.shakeOffsetX = (Math.random() * 2 - 1) * amp;
    this.shakeOffsetY = (Math.random() * 2 - 1) * amp;
  }

  setWorldBounds(worldWidth, worldHeight) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  snapTo(target) {
    const targetX = target.x + target.width / 2 - this.viewportWidth / 2;
    const targetY = target.y + target.height / 2 - this.viewportHeight / 2;
    this.x = this._clampX(targetX);
    this.y = this._clampY(targetY);
  }

  update(target, dt) {
    const desiredX = this._clampX(
      target.x + target.width / 2 - this.viewportWidth / 2
    );
    const desiredY = this._clampY(
      target.y + target.height / 2 - this.viewportHeight / 2
    );

    const factor = 1 - Math.exp(-this.lerpSpeed * dt);
    this.x += (desiredX - this.x) * factor;
    this.y += (desiredY - this.y) * factor;

    this.x = this._clampX(this.x);
    this.y = this._clampY(this.y);

    // Suavizado cinematográfico (5/s) independiente del seguimiento normal.
    const cineFactor = 1 - Math.exp(-5 * Math.max(0, dt));
    this.cinematicZoom += (this.targetCinematicZoom - this.cinematicZoom) * cineFactor;
    this.cinematicOffset.x += (this.targetCinematicOffset.x - this.cinematicOffset.x) * cineFactor;
    this.cinematicOffset.y += (this.targetCinematicOffset.y - this.cinematicOffset.y) * cineFactor;
    if (Math.abs(this.targetCinematicZoom - this.cinematicZoom) < 0.0005) {
      this.cinematicZoom = this.targetCinematicZoom;
    }
    if (Math.abs(this.targetCinematicOffset.x - this.cinematicOffset.x) < 0.05) {
      this.cinematicOffset.x = this.targetCinematicOffset.x;
    }
    if (Math.abs(this.targetCinematicOffset.y - this.cinematicOffset.y) < 0.05) {
      this.cinematicOffset.y = this.targetCinematicOffset.y;
    }

    this.updateShake(dt);
  }

  /** Fija el objetivo cinematográfico; el update lo interpola suavemente. */
  setCinematicTarget(zoom = 1, offsetX = 0, offsetY = 0) {
    this.targetCinematicZoom = Math.max(0.5, Math.min(3, Number(zoom) || 1));
    this.targetCinematicOffset.x = Number(offsetX) || 0;
    this.targetCinematicOffset.y = Number(offsetY) || 0;
  }

  /** Vuelve a la cámara de gameplay normal (zoom 1, sin offset). */
  resetCinematic() {
    this.cinematicZoom = 1.0;
    this.targetCinematicZoom = 1.0;
    this.cinematicOffset = { x: 0, y: 0 };
    this.targetCinematicOffset = { x: 0, y: 0 };
  }

  get renderX() {
    return Math.round(this.x + this.shakeOffsetX + this.cinematicOffset.x);
  }

  get renderY() {
    return Math.round(this.y + this.shakeOffsetY + this.cinematicOffset.y);
  }

  _clampX(x) {
    if (this.worldWidth <= this.viewportWidth) {
      return -(this.viewportWidth - this.worldWidth) / 2;
    }
    const maxX = this.worldWidth - this.viewportWidth;
    return Math.max(0, Math.min(x, maxX));
  }

  _clampY(y) {
    if (this.worldHeight <= this.viewportHeight) {
      return -(this.viewportHeight - this.worldHeight) / 2;
    }
    const maxY = this.worldHeight - this.viewportHeight;
    return Math.max(0, Math.min(y, maxY));
  }
}

