import { Entity } from './Entity.js?v=6';
import { CollisionSystem } from '../physics/CollisionSystem.js?v=6';

/**
 * Enemigo / Esbirro de las Tinieblas de Mister AI Alex.
 * Patrulla su territorio en el Primer Escenario, persigue al jugador si se acerca demasiado,
 * y le quita toda la vida (llegando a 0) si el jugador está indefenso sin su Armadura.
 * Puede ser derrotado cuando el jugador consigue su primera Espada.
 */
export class Enemy extends Entity {
  constructor({
    name = 'Centinela de AI Alex',
    x,
    y,
    animator,
    hp = 2,
    speed = 36,
    aggroRange = 54,
    patrolPoints = [],
    sceneId = 'first_stage',
    nightOnly = false
  }) {
    super({
      x,
      y,
      width: 16,
      height: 16,
      speed,
      boundingBox: { offsetX: 3, offsetY: 6, width: 10, height: 8 },
      animator,
      sceneId
    });

    this.name = name;
    this.nightOnly = Boolean(nightOnly);
    this.spawnX = x;
    this.spawnY = y;
    this.maxHp = hp;
    this.hp = hp;
    this.aggroRange = aggroRange;
    this.patrolPoints = patrolPoints.length > 0 ? patrolPoints : [{ x, y }];
    this.currentWaypointIndex = 0;

    this.dead = false;
    this.hitFlashTimer = 0;
    this.knockbackVx = 0;
    this.knockbackVy = 0;
    this.knockbackTimer = 0;
    this.attackCooldown = 0;
    this.deathParticles = [];
  }

  reset() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.hp = this.maxHp;
    this.dead = false;
    this.hitFlashTimer = 0;
    this.knockbackTimer = 0;
    this.attackCooldown = 0;
    this.deathParticles = [];
  }

  takeSwordHit(player, soundEngine = null) {
    if (this.dead || this.hitFlashTimer > 0) return false;

    this.hp -= 1;
    this.hitFlashTimer = 0.25;

    const dx = this.centerX - player.centerX;
    const dy = this.centerY - player.centerY;
    const dist = Math.max(1, Math.hypot(dx, dy));
    this.knockbackVx = (dx / dist) * 125;
    this.knockbackVy = (dy / dist) * 125;
    this.knockbackTimer = 0.14;

    if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
      soundEngine.playEnemyHit();
    }

    if (this.hp <= 0) {
      this.dead = true;
      this.deathParticles = Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return {
          x: this.centerX,
          y: this.centerY,
          vx: Math.cos(angle) * (24 + (i % 3) * 12),
          vy: Math.sin(angle) * (24 + (i % 3) * 12),
          life: 0.45
        };
      });
    }
    return true;
  }

  update(dt, tilemap, player, paused = false, soundEngine = null) {
    if (this.dead) {
      for (const p of this.deathParticles) {
        if (p.life > 0) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life = Math.max(0, p.life - dt);
        }
      }
      return { hitPlayer: false };
    }

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }
    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    }

    if (paused) {
      this.isMoving = false;
      super.update(dt);
      return { hitPlayer: false };
    }

    // Comprobar si el tajo de espada del jugador alcanza a este enemigo
    const swordBox = player ? player.getSwordHitbox() : null;
    if (swordBox && CollisionSystem.checkAABB(swordBox, this.worldBoundingBox)) {
      this.takeSwordHit(player, soundEngine);
      if (this.dead) return { hitPlayer: false };
    }

    // Retroceso tras recibir un espadazo
    if (this.knockbackTimer > 0) {
      this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
      CollisionSystem.moveWithCollisions(
        this,
        this.knockbackVx * dt,
        this.knockbackVy * dt,
        tilemap,
        []
      );
      super.update(dt);
      return { hitPlayer: false };
    }

    // Movimiento: perseguir al jugador si entra en rango (salvo en el santuario inicial del Sabio)
    const inSafeSanctuary =
      player && player.x >= 13 * 16 && player.x <= 21 * 16 && player.y >= 17 * 16;
    const distToPlayer = player ? this.distanceTo(player) : Infinity;

    let targetX;
    let targetY;
    let currentSpeed = this.speed;

    if (player && !inSafeSanctuary && distToPlayer <= this.aggroRange) {
      targetX = player.x;
      targetY = player.y;
      currentSpeed = this.speed * 1.15;
    } else {
      const wp = this.patrolPoints[this.currentWaypointIndex];
      targetX = wp.x;
      targetY = wp.y;
      if (Math.hypot(targetX - this.x, targetY - this.y) <= 2.5) {
        this.currentWaypointIndex =
          (this.currentWaypointIndex + 1) % this.patrolPoints.length;
      }
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 1.5) {
      const nx = dx / dist;
      const ny = dy / dist;
      if (Math.abs(nx) >= Math.abs(ny)) {
        this.direction = nx > 0 ? 'right' : 'left';
      } else {
        this.direction = ny > 0 ? 'down' : 'up';
      }

      const { blockedX, blockedY } = CollisionSystem.moveWithCollisions(
        this,
        nx * currentSpeed * dt,
        ny * currentSpeed * dt,
        tilemap,
        []
      );
      this.isMoving = !blockedX || !blockedY;
      if (blockedX && blockedY) {
        this.currentWaypointIndex =
          (this.currentWaypointIndex + 1) % this.patrolPoints.length;
      }
    } else {
      this.isMoving = false;
    }

    super.update(dt);

    // Comprobar si alcanza y golpea al jugador
    if (player && this.attackCooldown <= 0 && this.distanceTo(player) <= 12.5) {
      this.attackCooldown = 0.75;
      const didHit = player.takeHit(soundEngine);
      return { hitPlayer: didHit, enemyName: this.name };
    }

    return { hitPlayer: false };
  }

  render(ctx, camera) {
    if (this.dead) {
      ctx.save();
      for (const p of this.deathParticles) {
        if (p.life > 0) {
          ctx.fillStyle = p.life > 0.22 ? '#fbbf24' : '#a855f7';
          ctx.beginPath();
          ctx.arc(
            p.x - camera.renderX,
            p.y - camera.renderY,
            1.8,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
      ctx.restore();
      return;
    }

    const sx = this.x - camera.renderX;
    const sy = this.y - camera.renderY;

    // Aura sombría de Mister AI Alex bajo el enemigo
    ctx.save();
    ctx.fillStyle =
      this.hitFlashTimer > 0
        ? 'rgba(255, 255, 255, 0.65)'
        : 'rgba(239, 68, 68, 0.24)';
    ctx.beginPath();
    ctx.arc(sx + 8, sy + 11, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    super.render(ctx, camera);

    // Pequeña barra de vida sobre el enemigo si ha recibido daño
    if (this.hp < this.maxHp) {
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(sx + 2, sy - 4, 12, 2.5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(sx + 2.5, sy - 3.5, (11 * this.hp) / this.maxHp, 1.5);
      ctx.restore();
    }
  }
}

