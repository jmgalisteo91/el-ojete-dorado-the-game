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
  }

  get renderX() {
    return Math.round(this.x);
  }

  get renderY() {
    return Math.round(this.y);
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

