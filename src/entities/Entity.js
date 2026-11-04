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

