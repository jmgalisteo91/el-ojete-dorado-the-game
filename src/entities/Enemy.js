import { Entity } from './Entity.js?v=7';
import { CollisionSystem } from '../physics/CollisionSystem.js?v=7';
import { EnemyBrain, AI_STATE, inferArchetype } from '../ai/EnemyBrain.js?v=7';

const SHOT_SPEED = 78;
const SHOT_LIFE = 2.4;
const CONTACT_RANGE = 12.5;

/**
 * Enemigo / Esbirro de las Tinieblas de Mister AI Alex.
 * La toma de decisiones vive en EnemyBrain (estados + arquetipos + A*); esta clase gestiona
 * el cuerpo: movimiento con colisiones, daño, aturdimiento, proyectiles y render.
 */
export class Enemy extends Entity {
  constructor({
    id = null,
    name = 'Centinela de AI Alex',
    x,
    y,
    animator,
    hp = 2,
    maxHp = null,
    speed = 36,
    aggroRange = 54,
    patrolPoints = [],
    sceneId = 'first_stage',
    nightOnly = false,
    archetype = null,
    boundingBox = { offsetX: 3, offsetY: 6, width: 10, height: 8 }
  }) {
    super({
      x,
      y,
      width: 16,
      height: 16,
      speed,
      boundingBox,
      animator,
      sceneId
    });

    const startHp = maxHp !== null ? maxHp : hp;
    this.id = id;
    this.name = name;
    this.nightOnly = Boolean(nightOnly);
    this.spawnX = x;
    this.spawnY = y;
    this.maxHp = startHp;
    this.hp = startHp;
    this.aggroRange = aggroRange;
    this.patrolPoints = patrolPoints.length > 0 ? patrolPoints : [{ x, y }];
    this.currentWaypointIndex = 0;

    this.dead = false;
    this.hitFlashTimer = 0;
    this.knockbackVx = 0;
    this.knockbackVy = 0;
    this.knockbackTimer = 0;
    this.attackCooldown = 0;
    this.stunTimer = 0;
    this.revealedTimer = 0;
    this.speedScale = 1;
    this.deathParticles = [];
    this.shots = [];
    this._lastTick = 0;

    // Los jefes (isBoss) gestionan su propia IA; los enemigos normales usan EnemyBrain
    this.archetype = archetype || inferArchetype(id || '');
    this.brain = new EnemyBrain(this, this.archetype);
  }

  reset() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.hp = this.maxHp;
    this.dead = false;
    this.hitFlashTimer = 0;
    this.knockbackTimer = 0;
    this.attackCooldown = 0;
    this.stunTimer = 0;
    this.revealedTimer = 0;
    this.deathParticles = [];
    this.shots = [];
    if (this.brain) {
      this.brain.setState(AI_STATE.PATROL);
      this.brain.cancelAction();
    }
  }

  faceTowards(px, py) {
    const dx = px - this.centerX;
    const dy = py - this.centerY;
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.direction = dx > 0 ? 'right' : 'left';
    } else {
      this.direction = dy > 0 ? 'down' : 'up';
    }
  }

  /** Aturde al enemigo (parry perfecto, impacto de log): no se mueve ni ataca. */
  stun(seconds) {
    this.stunTimer = Math.max(this.stunTimer, seconds);
    if (this.brain) this.brain.cancelAction();
  }

  get aiState() {
    return this.brain ? this.brain.state : 'N/A';
  }

  get isTelegraphing() {
    return Boolean(this.brain && this.brain.isTelegraphing);
  }

  get isVulnerable() {
    return this.stunTimer > 0 || Boolean(this.brain && this.brain.isVulnerable);
  }

  fireShot(dirX, dirY, soundEngine = null) {
    this.shots.push({
      x: this.centerX,
      y: this.centerY,
      vx: dirX * SHOT_SPEED,
      vy: dirY * SHOT_SPEED,
      life: SHOT_LIFE
    });
    if (soundEngine && typeof soundEngine.playDashSound === 'function') {
      soundEngine.playDashSound();
    }
  }

  _applyDamage(amount, player, soundEngine) {
    this.hp -= amount;
    this.hitFlashTimer = 0.25;

    const dx = this.centerX - player.centerX;
    const dy = this.centerY - player.centerY;
    const dist = Math.max(1, Math.hypot(dx, dy));
    this.knockbackVx = (dx / dist) * 125;
    this.knockbackVy = (dy / dist) * 125;
    this.knockbackTimer = 0.14;
    if (this.brain) this.brain.cancelAction();

    if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
      soundEngine.playEnemyHit();
    }

    if (this.hp <= 0) {
      this.dead = true;
      this.shots = [];
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
  }

  takeSwordHit(player, soundEngine = null, customDamage = null) {
    if (this.dead || this.hitFlashTimer > 0) return false;
    let damage = customDamage !== null
      ? customDamage
      : (typeof player.getSwordDamage === 'function' ? player.getSwordDamage() : 1);
    // Punto débil: aturdido o expuesto tras una carga => doble daño
    if (this.isVulnerable) damage *= 2;
    this._applyDamage(damage, player, soundEngine);
    return true;
  }

  /** Impacto de un `console.log()` arrojadizo: daño leve, revela al enemigo y lo aturde brevemente. */
  takeLogHit(player, soundEngine = null) {
    if (this.dead) return false;
    this.revealedTimer = 4;
    this._applyDamage(1, player, soundEngine);
    if (!this.dead) this.stun(0.6);
    return true;
  }

  update(dt, tilemap, player, paused = false, soundEngine = null, ai = null) {
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

    // Proyectiles obsoletos de una escena en la que el jugador no estaba presente
    const now = performance.now();
    if (this._lastTick && now - this._lastTick > 500) {
      this.shots.length = 0;
    }
    this._lastTick = now;

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }
    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    }
    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
    }
    if (this.revealedTimer > 0) {
      this.revealedTimer = Math.max(0, this.revealedTimer - dt);
    }

    if (paused) {
      this.isMoving = false;
      super.update(dt);
      return { hitPlayer: false };
    }

    let hitPlayer = false;

    // Impactos del jugador: espada, corte en cascada y logs arrojadizos
    if (player) {
      const swordBox = player.getSwordHitbox();
      if (swordBox && CollisionSystem.checkAABB(swordBox, this.worldBoundingBox)) {
        this.takeSwordHit(player, soundEngine);
        if (this.dead) return { hitPlayer: false };
      }
      const spin = player.getSpinHitbox();
      if (spin && Math.hypot(this.centerX - spin.centerX, this.centerY - spin.centerY) <= spin.radius + 8) {
        this.takeSwordHit(player, soundEngine, spin.damage);
        if (this.dead) return { hitPlayer: false };
      }
      if (Array.isArray(player.thrownLogs)) {
        for (const log of player.thrownLogs) {
          if (log.life > 0 && Math.hypot(this.centerX - log.x, this.centerY - log.y) <= 9) {
            log.life = 0;
            this.takeLogHit(player, soundEngine);
            if (this.dead) return { hitPlayer: false };
          }
        }
      }
    }

    // Proyectiles propios (drones)
    if (this._updateShots(dt, tilemap, player, soundEngine)) {
      hitPlayer = true;
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
      return { hitPlayer, enemyName: this.name };
    }

    // Aturdido: inmóvil e indefenso
    if (this.stunTimer > 0) {
      this.isMoving = false;
      super.update(dt);
      return { hitPlayer, enemyName: this.name };
    }

    // Decisión de IA
    const context = {
      tilemap,
      player,
      soundEngine,
      enemies: ai ? ai.enemies : null,
      attackers: ai ? ai.attackers : null
    };
    const intent = player
      ? this.brain.update(dt, context)
      : this._patrolWithoutPlayer(dt);

    const speed = this.speed * (intent.speedMul || 1) * this.speedScale;
    if (intent.dirX !== 0 || intent.dirY !== 0) {
      if (this.brain.state !== AI_STATE.ALERT && !this.brain.isCharging) {
        if (Math.abs(intent.dirX) >= Math.abs(intent.dirY)) {
          this.direction = intent.dirX > 0 ? 'right' : 'left';
        } else {
          this.direction = intent.dirY > 0 ? 'down' : 'up';
        }
      }
      const { blockedX, blockedY } = CollisionSystem.moveWithCollisions(
        this,
        intent.dirX * speed * dt,
        intent.dirY * speed * dt,
        tilemap,
        []
      );
      this.isMoving = !blockedX || !blockedY;
      if (blockedX && blockedY) {
        // Atascado: forzar recálculo de ruta y, si patrulla, saltar al siguiente punto
        this.brain.path = [];
        this.brain.repathTimer = 0;
        if (this.brain.state === AI_STATE.PATROL) {
          this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.patrolPoints.length;
        }
        if (this.brain.isCharging) this.brain.cancelAction();
      }
    } else {
      this.isMoving = false;
    }

    super.update(dt);

    // Contacto: solo atacantes con "turno" en CHASE (o cargando) golpean al jugador
    const canContact =
      this.archetype !== 'drone' &&
      (this.brain.isCharging || this.brain.state === AI_STATE.CHASE) &&
      !this.brain.isTelegraphing;
    if (player && canContact && this.attackCooldown <= 0 && this.distanceTo(player) <= CONTACT_RANGE) {
      this.attackCooldown = 0.75;
      const didHit = player.takeHit(soundEngine, this);
      return { hitPlayer: didHit || hitPlayer, enemyName: this.name };
    }

    return { hitPlayer, enemyName: this.name };
  }

  _patrolWithoutPlayer(dt) {
    const wp = this.patrolPoints[this.currentWaypointIndex];
    const dx = wp.x - this.x;
    const dy = wp.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d <= 2.5) {
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.patrolPoints.length;
      return { dirX: 0, dirY: 0, speedMul: 1 };
    }
    return { dirX: dx / d, dirY: dy / d, speedMul: 1 };
  }

  /** Mueve los proyectiles; devuelve true si alguno impactó al jugador. */
  _updateShots(dt, tilemap, player, soundEngine) {
    let hit = false;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      const box = { x: s.x - 2, y: s.y - 2, width: 4, height: 4 };
      if (s.life <= 0 || CollisionSystem.collidesWithMap(box, tilemap)) {
        this.shots.splice(i, 1);
        continue;
      }
      if (player && CollisionSystem.checkAABB(box, player.worldBoundingBox)) {
        this.shots.splice(i, 1);
        if (player.takeHit(soundEngine, this)) hit = true;
      }
    }
    return hit;
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

    // Proyectiles de dron
    if (this.shots.length > 0) {
      ctx.save();
      for (const shot of this.shots) {
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(Math.round(shot.x - camera.renderX - 2), Math.round(shot.y - camera.renderY - 2), 4, 4);
        ctx.fillStyle = '#fecdd3';
        ctx.fillRect(Math.round(shot.x - camera.renderX - 1), Math.round(shot.y - camera.renderY - 1), 2, 2);
      }
      ctx.restore();
    }

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

    this._renderStatusIndicators(ctx, sx, sy);

    // Pequeña barra de vida sobre el enemigo si ha recibido daño (o está revelado por un log)
    if (this.hp < this.maxHp || this.revealedTimer > 0) {
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(sx + 2, sy - 4, 12, 2.5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(sx + 2.5, sy - 3.5, (11 * this.hp) / this.maxHp, 1.5);
      ctx.restore();
    }
  }

  /** Iconos de estado de la IA: alerta "!", búsqueda "?", telegrafiado, aturdido o expuesto. */
  _renderStatusIndicators(ctx, sx, sy) {
    if (!this.brain) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 8px monospace';
    const cx = sx + 8;
    if (this.stunTimer > 0) {
      ctx.fillStyle = '#fde047';
      ctx.fillText('✦', cx, sy - 8);
    } else if (this.brain.isTelegraphing) {
      ctx.fillStyle = '#ef4444';
      ctx.fillText('‼', cx, sy - 8);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, sy + 11, 10, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.brain.isVulnerable) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('◇', cx, sy - 8);
    } else if (this.brain.state === AI_STATE.ALERT) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('!', cx, sy - 8);
    } else if (this.brain.state === AI_STATE.SEARCH) {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('?', cx, sy - 8);
    }
    ctx.restore();
  }
}
