import { Enemy } from '../Enemy.js?v=7';
import { CollisionSystem } from '../../physics/CollisionSystem.js?v=7';

/**
 * Clase Base para Mini-Jefes del juego.
 * Extiende de Enemy para integrarse en el bucle de actualización, colisiones y combate.
 * Gestiona barras de vida estilizadas, estados de combate, telegrafiado de ataques,
 * música de combate dinámica y desbloqueo de habilidades.
 */
export class Boss extends Enemy {
  constructor({
    id,
    name,
    title = 'Mini-Jefe Corrupto',
    x,
    y,
    width = 24,
    height = 24,
    hp = 24,
    speed = 35,
    sceneId,
    trackName,
    rewardAbility,
    rewardName,
    themeColor = '#38bdf8',
    requiresIntroCutscene = false
  }) {
    super({
      id,
      name,
      x,
      y,
      hp,
      speed,
      sceneId,
      boundingBox: { offsetX: 3, offsetY: 4, width: width - 6, height: height - 6 }
    });

    this.width = width;
    this.height = height;
    this.title = title;
    this.trackName = trackName;
    this.rewardAbility = rewardAbility;
    this.rewardName = rewardName;
    this.themeColor = themeColor;
    this.requiresIntroCutscene = requiresIntroCutscene;
    this.introCutscenePlayed = false;

    this.isBoss = true;
    this.activeCombat = false;
    this.defeated = false;
    this.invulnerable = false;
    this.phase = 1;
    this.statusText = '';
    this.combatTriggerDistance = 140;

    this.projectiles = [];
    this.hazardPuddles = [];
    this.minions = [];
    this.defeatBannerTimer = 0;
  }

  /**
   * Reinicia el estado de combate, proyectiles, charcos y posición del jefe
   * cuando el jugador muere o abandona la sala sin haberlo derrotado.
   */
  get hurtbox() {
    return {
      x: this.x + 2,
      y: this.y + 2,
      width: Math.max(12, this.width - 4),
      height: Math.max(12, this.height - 4)
    };
  }

  get isStunned() {
    return (
      (typeof this.stunTimer === 'number' && this.stunTimer > 0) ||
      this.state === 'stunned' ||
      (typeof this.stunnedTimer === 'number' && this.stunnedTimer > 0)
    );
  }

  resetCombatState() {
    if (this.dead) {
      this.projectiles = [];
      this.hazardPuddles = [];
      this.minions = [];
      this.defeatBannerTimer = 0;
      return;
    }
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.hp = this.maxHp;
    this.activeCombat = false;
    this.invulnerable = false;
    this.statusText = '';
    this.hitFlashTimer = 0;
    this.knockbackTimer = 0;
    this.attackCooldown = 0;
    this.projectiles = [];
    this.hazardPuddles = [];
    this.minions = [];
  }

  /**
   * Recibe un impacto de la espada del jugador o de un ataque especial.
   */
  takeSwordHit(player, soundEngine = null, customDamage = null) {
    if (this.dead || this.hitFlashTimer > 0) return false;

    // Si el jefe está temporalmente invulnerable (ej: Ciclo de Calentamiento del Microondas)
    if (this.invulnerable) {
      if (soundEngine && typeof soundEngine.playMetalClink === 'function') {
        soundEngine.playMetalClink();
      }
      return false;
    }

    const baseDamage = customDamage !== null ? customDamage : 1;
    const damage = this.isStunned ? baseDamage * 2 : baseDamage;
    this.hp = Math.max(0, this.hp - damage);
    this.hitFlashTimer = 0.22;

    if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
      soundEngine.playEnemyHit();
    }

    // Comprobar muerte del jefe
    if (this.hp <= 0 && !this.dead) {
      this.triggerBossDefeat(player, soundEngine);
    }

    return true;
  }

  /**
   * Secuencia de derrota del jefe: desbloquea la habilidad correspondiente,
   * detiene la música con la fanfarria de victoria y genera partículas.
   */
  triggerBossDefeat(player, soundEngine = null) {
    this.dead = true;
    this.defeated = true;
    this.invulnerable = false;
    this.activeCombat = false;
    this.statusText = '¡DERROTADO!';
    this.defeatBannerTimer = 6.0;
    this.projectiles = [];
    this.hazardPuddles = [];
    this.minions = [];

    // Detener música de jefe y reproducir fanfarria retro
    if (soundEngine && typeof soundEngine.stopBossMusic === 'function') {
      soundEngine.stopBossMusic(true);
    }

    // Otorgar la habilidad al jugador
    if (player && this.rewardAbility) {
      player[this.rewardAbility] = true;
    }

    // Partículas de explosión del jefe
    this.deathParticles = Array.from({ length: 32 }, (_, i) => {
      const angle = (i / 32) * Math.PI * 2;
      const speed = 25 + Math.random() * 45;
      return {
        x: this.centerX,
        y: this.centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.85 + Math.random() * 0.45,
        color: i % 2 === 0 ? this.themeColor : '#ffd885'
      };
    });
  }

  update(dt, tilemap, player, paused = false, soundEngine = null) {
    // Si ya está derrotado, actualizar partículas y temporizador del banner
    if (this.dead) {
      if (this.defeatBannerTimer > 0) {
        this.defeatBannerTimer = Math.max(0, this.defeatBannerTimer - dt);
      }
      for (const p of this.deathParticles) {
        if (p.life > 0) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life = Math.max(0, p.life - dt);
        }
      }
      return { hitPlayer: false };
    }

    if (paused) return { hitPlayer: false };

    // Activar combate y música de jefe si el jugador está en la sala
    const distToPlayer = player ? this.distanceTo(player) : Infinity;
    if (!this.activeCombat && player && distToPlayer <= this.combatTriggerDistance) {
      if (this.requiresIntroCutscene && !this.introCutscenePlayed) {
        // Bloquear combate automático hasta que la cinemática de presentación termine
        return { hitPlayer: false };
      }
      this.activeCombat = true;
      if (soundEngine && typeof soundEngine.playBossMusic === 'function') {
        soundEngine.playBossMusic(this.trackName);
      }
    }

    // Chequeo de impacto con el Corte en Cascada (360° Spin Attack) del jugador
    const spinHitbox = player ? player.getSpinHitbox() : null;
    if (spinHitbox) {
      const dist = Math.hypot(this.centerX - spinHitbox.centerX, this.centerY - spinHitbox.centerY);
      if (dist <= spinHitbox.radius + this.width / 2) {
        this.takeSwordHit(player, soundEngine, spinHitbox.damage);
        if (this.dead) return { hitPlayer: false };
      }
    }

    // Chequeo de impacto con Tajos de Energía (Espada Overclockeada)
    if (player && Array.isArray(player.energySlashes)) {
      for (const slash of player.energySlashes) {
        if (slash.life > 0 && Math.hypot(this.centerX - slash.x, this.centerY - slash.y) <= (this.width / 2 + 8)) {
          slash.life = 0;
          this.takeSwordHit(player, soundEngine, slash.damage || 2);
          if (this.dead) return { hitPlayer: false };
        }
      }
    }

    // Chequeo de espadazo estándar
    const swordBox = player ? player.getSwordHitbox() : null;
    const targetHitbox = this.hurtbox || this.worldBoundingBox;
    if (swordBox && CollisionSystem.checkAABB(swordBox, targetHitbox)) {
      this.takeSwordHit(player, soundEngine, player.getSwordDamage());
      if (this.dead) return { hitPlayer: false };
    }

    // Disminución del parpadeo de daño y temporizador de aturdimiento
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }
    if (typeof this.stunTimer === 'number' && this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
    }

    // Actualización de proyectiles genéricos
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life = Math.max(0, p.life - dt);

      // Comprobar colisión con el jugador
      if (player && p.life > 0) {
        const d = Math.hypot(p.x - player.centerX, p.y - player.centerY);
        if (d <= (p.radius || 4) + 6) {
          // Si la barrera está activa, absorbe el proyectil
          if (player.barrierActive) {
            p.life = 0;
            if (soundEngine && typeof soundEngine.playBarrier === 'function') {
              soundEngine.playBarrier();
            }
          } else {
            player.takeHit(soundEngine);
            p.life = 0;
          }
        }
      }

      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    // Actualización de charcos dañinos
    for (let i = this.hazardPuddles.length - 1; i >= 0; i--) {
      const pud = this.hazardPuddles[i];
      pud.life -= dt;
      if (player && pud.life > 0) {
        const d = Math.hypot(pud.x - player.centerX, pud.y - player.centerY);
        if (d <= pud.radius + 5) {
          if (!player.barrierActive) {
            player.takeHit(soundEngine);
          }
        }
      }
      if (pud.life <= 0) {
        this.hazardPuddles.splice(i, 1);
      }
    }

    return { hitPlayer: false };
  }

  render(ctx, camera) {
    // Si está muerto, renderizar las partículas de explosión
    if (this.dead) {
      ctx.save();
      for (const p of this.deathParticles) {
        if (p.life > 0) {
          ctx.fillStyle = p.color || this.themeColor;
          ctx.beginPath();
          ctx.arc(p.x - camera.renderX, p.y - camera.renderY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      return;
    }

    // Renderizar charcos de ácido / trampas en el suelo
    for (const pud of this.hazardPuddles) {
      const px = pud.x - camera.renderX;
      const py = pud.y - camera.renderY;
      ctx.save();
      ctx.fillStyle = pud.color || 'rgba(16, 185, 129, 0.45)';
      ctx.beginPath();
      ctx.arc(px, py, pud.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pud.borderColor || 'rgba(52, 211, 153, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }

    // Renderizar proyectiles
    for (const p of this.projectiles) {
      const px = p.x - camera.renderX;
      const py = p.y - camera.renderY;
      ctx.save();
      ctx.fillStyle = p.color || '#f97316';
      ctx.beginPath();
      ctx.arc(px, py, p.radius || 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
}

