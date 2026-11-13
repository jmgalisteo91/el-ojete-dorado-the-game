/**
 * TonyCuleiro.js · Expansión "El Resurgir de Mister Alex IA" (v2.0).
 * Fixer del futuro corporativo. Placeholder in-engine sin IA de patrulla.
 */
import { NPC } from '../../entities/NPC.js?v=8';
import { EXPANSION_NPCS } from '../ExpansionData.js?v=8';

export class TonyCuleiro extends NPC {
  constructor({ x = 160, y = 120, animator = null, sceneId = 'valleverde_corrupto', dialogues = null } = {}) {
    const data = EXPANSION_NPCS.tony_culeiro;
    super({
      name: data.name,
      jobTitle: data.role,
      homeSceneId: sceneId,
      x,
      y,
      animator,
      sceneId,
      behavior: 'idle',
      dialogues: dialogues || data.dialogues,
      initialDirection: 'down'
    });
    this.expansionId = data.id;
    this.spriteColor = data.spriteColor;
    this.boundingBox = { offsetX: 3, offsetY: 10, width: 10, height: 6 };
  }

  /** Placeholder: quieto, solo respira/mira. Sin patrulla en esta fase. */
  update(dt, tilemap, obstacles, isTalking = false, player = null, threat = null) {
    this.isTalking = Boolean(isTalking);
    this.isMoving = false;
    this.jobAnimTimer += dt;
    this.promptBobTimer += dt * 4.5;
    if (this.animator) this.animator.update(dt, this.direction, false);
  }

  render(ctx, camera) {
    const sx = Math.round(this.centerX - camera.renderX);
    const sy = Math.round(this.y - camera.renderY);
    ctx.save();
    ctx.strokeStyle = `${this.spriteColor}aa`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 15, 8, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `${this.spriteColor}22`;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 15, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    super.render(ctx, camera);
  }
}
