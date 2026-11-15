import { Entity } from './Entity.js?v=8';
import { CollisionSystem } from '../physics/CollisionSystem.js?v=8';
import { EnemyBrain, AI_STATE, inferArchetype } from '../ai/EnemyBrain.js?v=8';
import { GameLoop } from '../core/GameLoop.js?v=8';


// (FIX M2.6) Escala de partículas (1 = normal, 0.45 = gama baja). main la ajusta.
let particleScale = 1;

/** @param {number} scale 0.15..1 */
export function setParticleScale(scale) {
  const value = Number(scale);
  particleScale = Number.isFinite(value) ? Math.max(0.15, Math.min(1, value)) : 1;
}


const SHOT_SPEED = 78;
const SHOT_LIFE = 2.4;
const CONTACT_RANGE = 12.5;
// (FIX 3.4) Aviso previo del golpe cuerpo a cuerpo: 0.3 s para poder esquivarlo
const CONTACT_WINDUP = 0.3;

// (FIX 1.1) Frames de freeze por impacto: 3 al golpear, 4 al rematar (~0.05-0.066 s)
const HITSTOP_ON_HIT = 3;
const HITSTOP_ON_KILL = 4;

// (FIX 1.3) Paletas de partículas
const HIT_PARTICLE_COLORS = ['#ffffff', '#fecaca', '#ef4444'];
const DEATH_PARTICLE_COLORS = {
  drone: ['#f43f5e', '#fda4af', '#fb7185'],
  knight: ['#a855f7', '#c4b5fd', '#7c3aed'],
  glitch: ['#22d3ee', '#67e8f9', '#0ea5e9'],
  sentinel: ['#fbbf24', '#f59e0b', '#fde047'],
  grunt: ['#fbbf24', '#f59e0b', '#fde047']
};

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
    xpReward = null,
    respawnOnEnter = false,
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
    this.xpReward = Number.isFinite(xpReward) ? xpReward : null;
    this.respawnOnEnter = Boolean(respawnOnEnter);
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
    this.windupTimer = 0;
    this.stunTimer = 0;
    this.revealedTimer = 0;
    this.speedScale = 1;
    this.slowTimer = 0;
    this.slowFactor = 0.45;
    // (FIX 1.3) Un único pool de partículas: chispas de impacto + estallido de muerte
    this.particles = [];
    this.shots = [];

    // Los jefes (isBoss) gestionan su propia IA; los enemigos normales usan EnemyBrain
    this.archetype = archetype || inferArchetype(id || '');
    this.brain = new EnemyBrain(this, this.archetype);
  }

  reset() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.hp = this.maxHp;
    this.dead = false;
    this.xpGranted = false;
    this.coinsDropped = false;
    this.lootDropped = false;
    this.hitFlashTimer = 0;
    this.knockbackTimer = 0;
    this.attackCooldown = 0;
    this.windupTimer = 0;
    this.stunTimer = 0;
    this.revealedTimer = 0;
    this.particles = [];
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
    this.windupTimer = 0; // (FIX 3.4) un aturdimiento interrumpe el ataque anunciado
    if (this.brain) this.brain.cancelAction();
  }

  /** Ralentiza temporalmente al enemigo (p. ej. parry con Carpeta de Plástico). */
  applySlow(seconds = 2.0, factor = 0.45) {
    this.slowTimer = Math.max(this.slowTimer || 0, seconds);
    this.slowFactor = Math.max(0.1, Math.min(1, factor));
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

  /**
   * (FIX 1.3) Emite partículas radiales desde el centro del enemigo.
   * Estructura: { x, y, vx, vy, life, maxLife, gravity, color, size }.
   */
  _emitParticles(count, colors, speedMin, speedMax, life, gravity = 0) {
    // (FIX M2.6) Densidad global ajustable desde main según el perfil de rendimiento
    const total = Math.max(1, Math.round(count * particleScale));
    for (let i = 0; i < total; i++) {
      const angle = (i / total) * Math.PI * 2 + Math.random() * 0.7;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      this.particles.push({
        x: this.centerX,
        y: this.centerY + 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 10,
        life,
        maxLife: life,
        gravity,
        color: colors[i % colors.length],
        size: i % 2 === 0 ? 2 : 1
      });
    }
  }

  /** Color del estallido de muerte según el arquetipo del enemigo. */
  _deathParticleColors() {
    return DEATH_PARTICLE_COLORS[this.archetype] || DEATH_PARTICLE_COLORS.grunt;
  }

  /**
   * (FIX 3.1) Comunica al cerebro dónde está el jugador. Un golpe a distancia debe
   * enseñar el objetivo aunque el enemigo no lo esté viendo.
   */
  _alertBrainToPlayer(player) {
    if (!this.brain || !player || this.dead) return;
    const x = typeof player.centerX === 'number' ? player.centerX : player.x;
    const y = typeof player.centerY === 'number' ? player.centerY : player.y;
    this.brain.lastKnown = { x, y };
    this.brain.loseTimer = 0;
    this.brain.forceAlert(x, y);
  }

  _applyDamage(amount, player, soundEngine) {
    this.hp -= amount;
    this.hitFlashTimer = 0.25;
    // (FIX 3.4) Recibir un golpe interrumpe el windup del ataque
    this.windupTimer = 0;

    // (FIX 1.3) 4-6 chispas blancas/rojas en cada impacto
    this._emitParticles(5, HIT_PARTICLE_COLORS, 42, 84, 0.22);

    const gameRef = player?.game || (typeof window !== 'undefined' ? window.game : globalThis?.game);
    if (gameRef && typeof gameRef.spawnFloatingText === 'function' && amount > 0) {
      const dmgVal = Math.round(amount * 10) / 10;
      gameRef.spawnFloatingText({
        text: `-${dmgVal}`,
        x: this.centerX || this.x,
        y: this.y - 2,
        life: 0.8,
        color: amount > 2 ? '#ffd700' : '#ffffff'
      });
    }

    const dx = this.centerX - player.centerX;
    const dy = this.centerY - player.centerY;
    const dist = Math.max(1, Math.hypot(dx, dy));
    this.knockbackVx = (dx / dist) * 125;
    this.knockbackVy = (dy / dist) * 125;
    this.knockbackTimer = 0.14;
    if (this.brain) this.brain.cancelAction();

    if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
      soundEngine.playEnemyHit(Boolean(this.isBoss));
    }

    if (this.hp <= 0) {
      this.dead = true;
      this.shots = [];
      // (FIX 1.3) 8-10 partículas del color del enemigo que se dispersan con gravedad
      this._emitParticles(10, this._deathParticleColors(), 30, 66, 0.5, 60);
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
    // (FIX 3.1) El impacto revela la posición del jugador al cerebro del enemigo
    this._alertBrainToPlayer(player);
    // (FIX 1.1) Freeze frames: el remate congela un frame más que un golpe normal
    GameLoop.triggerHitstop(this.dead ? HITSTOP_ON_KILL : HITSTOP_ON_HIT);
    return true;
  }

  /** Impacto de un `console.log()` arrojadizo: daño leve, revela al enemigo y lo aturde brevemente. */
  takeLogHit(player, soundEngine = null) {
    if (this.dead) return false;
    this.revealedTimer = 4;
    this._applyDamage(1, player, soundEngine);
    if (!this.dead) {
      this.stun(0.6);
      this._alertBrainToPlayer(player);
    }
    // (FIX 1.1) Impacto percusivo más sutil que un espadazo
    GameLoop.triggerHitstop(this.dead ? HITSTOP_ON_KILL : 2);
    return true;
  }

  update(dt, tilemap, player, paused = false, soundEngine = null, ai = null) {
    if (this.dead) {
      // (FIX 1.3) Las partículas de muerte siguen viviendo aunque el enemigo ya no actúe
      this._updateParticles(dt);
      return { hitPlayer: false };
    }

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }
    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    }
    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
    }
    if (this.slowTimer > 0) {
      this.slowTimer = Math.max(0, this.slowTimer - dt);
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

    // (FIX 1.3) Chispas y estallidos se animan con la misma cadencia que la simulación
    this._updateParticles(dt);

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
            if (player.skills?.log_2 && typeof player.triggerLogExplosion === 'function') {
              player.triggerLogExplosion(log.x, log.y, 20, 1, this);
            }
            if (this.dead) return { hitPlayer: false };
          }
        }
      }
      if (player.hasSword && Array.isArray(player.energySlashes)) {
        for (const slash of player.energySlashes) {
          if (slash.life > 0 && Math.hypot(this.centerX - slash.x, this.centerY - slash.y) <= 13) {
            slash.life = 0;
            this.takeSwordHit(player, soundEngine, slash.damage || 2);
            if (this.dead) return { hitPlayer: false };
          }
        }
      }
    }

    // Proyectiles propios (drones)
    if (this._updateShots(dt, tilemap, player, soundEngine)) {
      hitPlayer = true;
    }

    // (FIX 3.4) Windup del golpe cuerpo a cuerpo: el enemigo se queda clavado avisando
    // y solo aplica el daño al terminar, si el jugador sigue en rango (esquivable).
    if (this.windupTimer > 0) {
      this.windupTimer = Math.max(0, this.windupTimer - dt);
      this.isMoving = false;

      if (this.windupTimer === 0) {
        if (player && player.hp > 0 && this.distanceTo(player) <= CONTACT_RANGE * 1.35) {
          this.attackCooldown = Math.max(this.attackCooldown, 0.35);
          const didHit = player.takeHit(soundEngine, this);
          return { hitPlayer: didHit || hitPlayer, enemyName: this.name };
        }
        // Falló el golpe (el jugador se apartó): reintenta antes que si hubiera conectado
        this.attackCooldown = 0.35;
      }

      super.update(dt);
      return { hitPlayer, enemyName: this.name };
    }

    // (FIX 1.4) Obstáculos dinámicos: jugador, NPCs y otros enemigos vivos de la escena.
    // main.js ya precalcula la lista una vez por frame y la comparte en aiContext.obstacles.
    const obstacles = (ai && Array.isArray(ai.obstacles))
      ? ai.obstacles
      : this._buildObstacleList(player, ai);

    // Retroceso tras recibir un espadazo
    if (this.knockbackTimer > 0) {
      this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
      CollisionSystem.moveWithCollisions(
        this,
        this.knockbackVx * dt,
        this.knockbackVy * dt,
        tilemap,
        obstacles
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

    const slowMul = this.slowTimer > 0 ? (this.slowFactor || 0.45) : 1;
    const speed = this.speed * (intent.speedMul || 1) * this.speedScale * slowMul;
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
        obstacles
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
    if (
      player &&
      canContact &&
      this.attackCooldown <= 0 &&
      this.distanceTo(player) <= CONTACT_RANGE
    ) {
      // La carga del caballero ya viene telegrafiada (0.5 s de aviso + lunge): si se le
      // añadiera otro windup se quedaría clavado a mitad de la embestida.
      if (this.brain.isCharging) {
        this.attackCooldown = 0.75;
        const didHit = player.takeHit(soundEngine, this);
        return { hitPlayer: didHit || hitPlayer, enemyName: this.name };
      }

      // (FIX 3.4) No golpea al instante: anuncia el ataque y lo resuelve 0.3 s después
      this.windupTimer = CONTACT_WINDUP;
      this.attackCooldown = 0.75 + CONTACT_WINDUP;
      this.isMoving = false;
      return { hitPlayer, enemyName: this.name };
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

  /**
   * (FIX 1.4) Lista de entidades sólidas contra las que colisionar.
   * Fallback para cuando Enemy.update se llama sin el contexto de IA de main.js.
   */
  _buildObstacleList(player = null, ai = null) {
    const list = [];
    if (ai && Array.isArray(ai.enemies)) {
      for (const other of ai.enemies) {
        if (other && other !== this && !other.dead) list.push(other);
      }
    }
    if (ai && Array.isArray(ai.npcs)) {
      for (const npc of ai.npcs) {
        if (npc && npc !== this) list.push(npc);
      }
    }
    if (player) list.push(player);
    return list;
  }

  /** (FIX 1.3) Integra posición, vida, rozamiento y gravedad de cada partícula. */
  _updateParticles(dt) {
    if (this.particles.length === 0) return;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = Math.max(0, 1 - 4 * dt);
      p.vx *= drag;
      p.vy *= drag;
    }
  }

  /** (FIX 1.3) Pinta las partículas con su color y desvanecimiento. */
  _renderParticles(ctx, camera) {
    if (this.particles.length === 0) return;
    ctx.save();
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(
        Math.round(p.x - camera.renderX),
        Math.round(p.y - camera.renderY),
        p.size,
        p.size
      );
    }
    ctx.restore();
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
      // (FIX 1.3) El estallido de muerte sobrevive al enemigo
      this._renderParticles(ctx, camera);
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
    // (FIX 3.4) Durante el windup parpadea en rojo para avisar del golpe inminente
    const windupOn = this.windupTimer > 0;
    const windupBlink = windupOn && Math.floor(this.windupTimer * 16) % 2 === 0;

    ctx.save();
    ctx.fillStyle =
      this.hitFlashTimer > 0
        ? 'rgba(255, 255, 255, 0.65)'
        : windupOn
          ? (windupBlink ? 'rgba(239, 68, 68, 0.92)' : 'rgba(255, 255, 255, 0.5)')
          : 'rgba(239, 68, 68, 0.24)';
    ctx.beginPath();
    ctx.arc(sx + 8, sy + 11, windupOn ? 10 : 8, 0, Math.PI * 2);
    ctx.fill();

    if (windupOn) {
      ctx.strokeStyle = windupBlink ? '#ef4444' : '#fca5a5';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx + 8, sy + 11, 11, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    super.render(ctx, camera);

    this._renderParticles(ctx, camera);
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
