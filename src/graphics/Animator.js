/**
 * Sistema de Animación por Frames para Spritesheets de Personajes y Animales.
 */

import { ATLAS_SCALE } from './SpriteSheetGenerator.js?v=8';

const DIRECTION_ROW = {
  down: 0,
  up: 1,
  left: 2,
  right: 3
};

export class SpriteAnimator {
  constructor(
    spriteSheet,
    characterIndex = 0,
    frameWidth = 16,
    frameHeight = 16,
    frameDuration = 0.14
  ) {
    this.spriteSheet = spriteSheet;
    this.characterIndex = characterIndex;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.frameDuration = frameDuration;

    this.direction = 'down';
    this.isMoving = false;
    this.currentFrame = 0;
    this.timer = 0;
  }

  update(dt, direction, isMoving) {
    const dirChanged = this.direction !== direction;
    this.direction = direction;

    if (!isMoving) {
      this.isMoving = false;
      this.currentFrame = 0;
      this.timer = 0;
      return;
    }

    if (!this.isMoving || dirChanged) {
      this.isMoving = true;
      this.currentFrame = 1;
      this.timer = 0;
      return;
    }

    this.timer += dt;
    if (this.timer >= this.frameDuration) {
      this.timer -= this.frameDuration;
      this.currentFrame = (this.currentFrame + 1) % 4;
    }
  }

  draw(ctx, screenX, screenY) {
    const dirRow = DIRECTION_ROW[this.direction] ?? 0;
    const atlasRow = this.characterIndex * 4 + dirRow;
    const sx = this.currentFrame * this.frameWidth;
    const sy = atlasRow * this.frameHeight;

    ctx.drawImage(
      this.spriteSheet,
      sx * ATLAS_SCALE,
      sy * ATLAS_SCALE,
      this.frameWidth * ATLAS_SCALE,
      this.frameHeight * ATLAS_SCALE,
      Math.round(screenX),
      Math.round(screenY),
      this.frameWidth,
      this.frameHeight
    );
  }
}

