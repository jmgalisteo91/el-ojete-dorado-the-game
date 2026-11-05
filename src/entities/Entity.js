/**
 * Clase base Entity para todas las entidades del mundo (Player, NPC, Animal, WorldItem).
 */
export class Entity {
  constructor({
    x = 0,
    y = 0,
    width = 16,
    height = 16,
    speed = 60,
    boundingBox = { offsetX: 3, offsetY: 8, width: 10, height: 7 },
    animator = null,
    sceneId = 'overworld'
  }) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = speed;
    this.boundingBox = boundingBox;
    this.animator = animator;
    this.sceneId = sceneId;

    this.direction = 'down';
    this.isMoving = false;
  }

  getBoundingBoxAt(posX, posY) {
    return {
      x: posX + this.boundingBox.offsetX,
      y: posY + this.boundingBox.offsetY,
      width: this.boundingBox.width,
      height: this.boundingBox.height
    };
  }

  get worldBoundingBox() {
    return this.getBoundingBoxAt(this.x, this.y);
  }

  get centerX() {
    return this.x + this.width / 2;
  }

  get centerY() {
    return this.y + this.height / 2;
  }

  distanceTo(other) {
    return Math.hypot(this.centerX - other.centerX, this.centerY - other.centerY);
  }

  /** Coordenadas de los pies (centro inferior de la hitbox) en el mundo. */
  get feetX() {
    return this.x + this.boundingBox.offsetX + this.boundingBox.width / 2;
  }

  get feetY() {
    return this.y + this.boundingBox.offsetY + this.boundingBox.height;
  }

  /**
   * Clave de ordenación Y para el renderizado 2.5D: borde inferior del sprite (y + height).
   * Mayor valor → más cerca del espectador → se dibuja después.
   */
  get sortY() {
    return this.y + this.height;
  }

  /**
   * Sombra proyectada pseudo-3D: elipse traslúcida en el suelo bajo los pies, cuya longitud,
   * dirección e inclinación dependen del reloj solar (getSunState).
   */
  renderShadow(ctx, camera, sun) {
    if (this.dead || this.hideShadow) return;

    const stretch = sun ? sun.length : 1;
    const dx = sun ? sun.dx : 0;
    const dy = sun ? sun.dy : 0.18;
    const alphaScale = sun ? sun.alphaScale : 1;

    const baseRx = this.boundingBox.width * 0.62 + 1;
    const baseRy = baseRx * 0.38;
    const rx = baseRx * (1 + 0.35 * stretch * Math.abs(dx));
    const ry = baseRy * (1 + 0.12 * stretch);
    const cx = this.feetX - camera.renderX + dx * baseRx * 0.45 * stretch;
    const cy = this.feetY - camera.renderY - 1 + dy * stretch * 1.2;
    const tilt = dx * 0.22;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alphaScale));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(Math.round(cx), Math.round(cy), rx, ry, tilt, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  update(dt) {
    if (this.animator) {
      this.animator.update(dt, this.direction, this.isMoving);
    }
  }

  render(ctx, camera) {
    const screenX = this.x - camera.renderX;
    const screenY = this.y - camera.renderY;

    if (this.animator) {
      this.animator.draw(ctx, screenX, screenY);
    } else {
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(Math.round(screenX), Math.round(screenY), this.width, this.height);
    }
  }
}

