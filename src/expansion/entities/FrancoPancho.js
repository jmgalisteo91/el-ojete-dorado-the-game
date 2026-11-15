import { NPC } from '../../entities/NPC.js?v=8';
import { CollisionSystem } from '../../physics/CollisionSystem.js?v=8';
import { EXPANSION_NPCS } from '../ExpansionData.js?v=8';

const FOLLOW_MIN_DIST = 20;
const FOLLOW_WARP_DIST = 110;
const ATTACK_RANGE = 19;
const COMBAT_AGGRO_RANGE = 88;

export class FrancoPancho extends NPC {
  constructor({
    x = 3 * 16,
    y = 4 * 16,
    animator = null,
    sceneId = 'vertedero_piso_3',
    dialogues = null,
    onRecruit = null
  } = {}) {
    const data = EXPANSION_NPCS.franco_pancho;
    super({
      name: data.name,
      jobTitle: data.role,
      homeSceneId: 'valleverde_corp',
      x,
      y,
      animator,
      sceneId,
      behavior: 'idle',
      talkSfx: data.talkSfx || null,
      dialogues: dialogues || data.dialogues,
      initialDirection: 'down'
    });
    this.expansionId = data.id;
    this.spriteColor = data.spriteColor;
    this.talkSfx = data.talkSfx || null;
    this.boundingBox = { offsetX: 3, offsetY: 10, width: 10, height: 6 };

    this.speed = 64;
    this.attackDamage = 1;
    this.attackCooldown = 0;
    this.attackSlashTimer = 0;
    this.rescued = false;
    this.isCompanion = false;
    this.onRecruit = typeof onRecruit === 'function' ? onRecruit : null;
  }

  /**
   * Activa el rescate de Franco y su modo acompañante de combate.
   */
  recruitCompanion() {
    this.rescued = true;
    this.isCompanion = true;
    if (this.onRecruit) {
      this.onRecruit(this);
    }
  }

  /**
   * Diálogo contextual: antes de rescatarle ofrece sacarle del Vertedero.
   */
  resolveDialogues(dialogueBox = null) {
    if (!this.rescued) {
      return {
        lines: ['¿Eres el nuevo? Llevo 3 meses escoltando a empleados que no existen.'],
        choices: [
          {
            label: 'Te saco de aquí',
            onSelect: () => {
              this.recruitCompanion();
              if (dialogueBox && typeof dialogueBox.showMessage === 'function') {
                dialogueBox.showMessage(this.name, [
                  '¡Gracias, compañero! Me pego a tu espalda. ¡Vamos a salir de este Vertedero!'
                ]);
              }
            }
          },
          {
            label: 'Ahora vuelvo',
            onSelect: () => {
              if (dialogueBox && typeof dialogueBox.close === 'function') {
                dialogueBox.close();
              }
            }
          }
        ]
      };
    }

    if (this.isCompanion) {
      return [
        '¡Cubriéndote las espaldas, jefe! Si aparece algún proceso corrupto le reparto leña.'
      ];
    }

    return this.dialogues;
  }

  _findNearestEnemy(enemies) {
    if (!Array.isArray(enemies) || enemies.length === 0) return null;
    let closest = null;
    let closestDist = COMBAT_AGGRO_RANGE;
    for (const enemy of enemies) {
      if (!enemy || enemy.dead) continue;
      if (enemy.sceneId && enemy.sceneId !== this.sceneId) continue;
      const ex = typeof enemy.centerX === 'number' ? enemy.centerX : enemy.x;
      const ey = typeof enemy.centerY === 'number' ? enemy.centerY : enemy.y;
      const d = Math.hypot(ex - this.centerX, ey - this.centerY);
      if (d <= closestDist) {
        closestDist = d;
        closest = enemy;
      }
    }
    return closest ? { enemy: closest, dist: closestDist } : null;
  }

  _moveToward(tx, ty, speed, dt, tilemap, obstacles) {
    const dx = tx - this.centerX;
    const dy = ty - this.centerY;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return false;

    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;
    if (Math.abs(vx) > Math.abs(vy)) {
      this.direction = vx >= 0 ? 'right' : 'left';
    } else {
      this.direction = vy >= 0 ? 'down' : 'up';
    }

    const solidObstacles = Array.isArray(obstacles)
      ? obstacles.filter((o) => o && o !== this && !o.isCompanion)
      : [];
    const prevX = this.x;
    const prevY = this.y;
    CollisionSystem.moveWithCollisions(this, vx * dt, vy * dt, tilemap, solidObstacles);
    return Math.hypot(this.x - prevX, this.y - prevY) > 0.05;
  }

  _attackEnemy(enemy, player, soundEngine) {
    this.faceEntity(enemy);
    this.attackCooldown = 0.65;
    this.attackSlashTimer = 0.18;
    if (typeof enemy._applyDamage === 'function') {
      enemy._applyDamage(this.attackDamage, this, soundEngine);
      if (typeof enemy._alertBrainToPlayer === 'function' && player) {
        enemy._alertBrainToPlayer(player);
      }
    } else if (typeof enemy.takeSwordHit === 'function') {
      enemy.takeSwordHit(player || this, soundEngine, this.attackDamage);
    }
  }

  update(dt, tilemap, obstacles, isTalking = false, player = null, threat = null, enemies = null, soundEngine = null) {
    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    }
    if (this.attackSlashTimer > 0) {
      this.attackSlashTimer = Math.max(0, this.attackSlashTimer - dt);
    }

    if (isTalking) {
      this.tickReactionTimers(dt);
      if (this.animator) {
        this.animator.update(dt, this.direction, false);
      }
      return;
    }

    if (this.isCompanion && player) {
      let moved = false;
      const targetInfo = this._findNearestEnemy(enemies);
      if (targetInfo) {
        const { enemy, dist } = targetInfo;
        const ex = typeof enemy.centerX === 'number' ? enemy.centerX : enemy.x;
        const ey = typeof enemy.centerY === 'number' ? enemy.centerY : enemy.y;
        if (dist <= ATTACK_RANGE) {
          this.faceEntity(enemy);
          if (this.attackCooldown <= 0) {
            this._attackEnemy(enemy, player, soundEngine);
          }
        } else {
          moved = this._moveToward(ex, ey, this.speed * 1.05, dt, tilemap, obstacles);
        }
      } else {
        const px = typeof player.centerX === 'number' ? player.centerX : player.x + 8;
        const py = typeof player.centerY === 'number' ? player.centerY : player.y + 8;
        const distToPlayer = Math.hypot(px - this.centerX, py - this.centerY);
        if (distToPlayer > FOLLOW_WARP_DIST) {
          const offsetX = player.direction === 'left' ? 16 : -16;
          this.x = player.x + offsetX;
          this.y = player.y;
          this.direction = player.direction || 'down';
        } else if (distToPlayer > FOLLOW_MIN_DIST) {
          moved = this._moveToward(px, py, Math.min(this.speed * 1.15, distToPlayer * 3), dt, tilemap, obstacles);
        } else {
          this.faceEntity(player);
        }
      }

      if (this.animator) {
        this.animator.update(dt, this.direction, moved);
      }
      return;
    }

    super.update(dt, tilemap, obstacles, isTalking, player, threat);
  }

  render(ctx, camera) {
    const camX = Math.round(camera ? camera.renderX : 0);
    const camY = Math.round(camera ? camera.renderY : 0);
    const rx = Math.round(this.x - camX);
    const ry = Math.round(this.y - camY);

    ctx.save();
    ctx.fillStyle = this.isCompanion ? 'rgba(74, 222, 128, 0.34)' : 'rgba(77, 124, 15, 0.28)';
    ctx.beginPath();
    ctx.ellipse(rx + 8, ry + 14, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    super.render(ctx, camera);

    if (this.attackSlashTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#a3e635';
      ctx.lineWidth = 1.5;
      let sx = rx + 8;
      let sy = ry + 8;
      if (this.direction === 'left') sx -= 10;
      else if (this.direction === 'right') sx += 10;
      else if (this.direction === 'up') sy -= 10;
      else sy += 10;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 1.4);
      ctx.stroke();
      ctx.restore();
    }
  }
}
