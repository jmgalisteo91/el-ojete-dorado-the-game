import { Enemy } from '../../entities/Enemy.js?v=8';
import { CollisionSystem } from '../../physics/CollisionSystem.js?v=8';

export const DEMON_GAME_OVER_MESSAGE = 'Has sido juzgado por el Señor de las Ovejas. Muestra respeto.';

/**
 * Demonio Vengador ("El Señor de las Ovejas"):
 * Mecánica secreta tipo Zelda (Cucco) al atacar a cualquier animal del pueblo.
 * Es inmortal (999 HP), más rápido que el jugador (speed = 100), ignora enemigos
 * y mata al instante (9999 de daño) al hacer contacto con el jugador.
 */
export class DemonVengador extends Enemy {
  constructor({ x, y, sceneId = 'overworld' } = {}) {
    super({
      id: 'demon_vengador',
      name: 'Señor de las Ovejas',
      x,
      y,
      animator: null,
      hp: 999,
      maxHp: 999,
      speed: 100,
      aggroRange: 9999,
      sceneId,
      archetype: 'sentinel',
      xpReward: 0,
      boundingBox: { offsetX: 4, offsetY: 6, width: 16, height: 16 }
    });

    this.width = 24;
    this.height = 24;
    this.hp = 999;
    this.maxHp = 999;
    this.speed = 100;
    this.isBoss = true;
    this.isDemonVengador = true;
    this.isImmortal = true;
    this.ignoresEnemies = true;
    this.fatalDamage = 9999;

    this.auraTimer = 0;
    this.auraParticles = [];
    this.hasKilledPlayer = false;
  }

  /**
   * El Demonio Vengador es completamente inmortal: absorbe cualquier impacto y conserva 999 HP.
   */
  _applyDamage(amount, player, soundEngine) {
    this.hp = this.maxHp;
    this.dead = false;
    this.hitFlashTimer = 0.14;
    this._emitParticles(6, ['#dc2626', '#09090b', '#facc15'], 30, 75, 0.25);
    if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
      soundEngine.playEnemyHit(true);
    }
  }

  takeSwordHit(player, soundEngine = null, customDamage = null) {
    if (this.hitFlashTimer > 0) return false;
    this._applyDamage(customDamage || 1, player, soundEngine);
    return true;
  }

  /**
   * Persecución implacable hacia el jugador ignorando enemigos normales.
   */
  update(dt, tilemap, player, paused = false, soundEngine = null) {
    this.auraTimer += dt;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }

    this._updateParticles(dt);
    this._updateAuraParticles(dt);

    if (paused || !player || this.dead) {
      this.isMoving = false;
      return { hitPlayer: false, enemyName: this.name };
    }

    const dx = player.centerX - this.centerX;
    const dy = player.centerY - this.centerY;
    const dist = Math.hypot(dx, dy);

    this.faceTowards(player.centerX, player.centerY);

    if (dist > 0.5) {
      const vx = (dx / dist) * this.speed * dt;
      const vy = (dy / dist) * this.speed * dt;
      this.isMoving = true;

      if (tilemap) {
        const { blockedX, blockedY } = CollisionSystem.moveWithCollisions(this, vx, vy, tilemap, []);
        // Deslizamiento extra en esquina para no quedar frenado persiguiendo al jugador
        if (blockedX && Math.abs(vy) < 0.05 && Math.abs(dy) > 1) {
          CollisionSystem.moveWithCollisions(this, 0, Math.sign(dy) * this.speed * dt * 0.85, tilemap, []);
        } else if (blockedY && Math.abs(vx) < 0.05 && Math.abs(dx) > 1) {
          CollisionSystem.moveWithCollisions(this, Math.sign(dx) * this.speed * dt * 0.85, 0, tilemap, []);
        }
      } else {
        this.x += vx;
        this.y += vy;
      }
    }

    // Colisión letal instantánea (9999 de daño)
    const demonBox = this.worldBoundingBox;
    const playerBox = player.worldBoundingBox;
    const touching = CollisionSystem.isBoxColliding(demonBox, playerBox) || this.distanceTo(player) <= 13;

    if (touching && player.hp > 0) {
      this._inflictFatalStrike(player, soundEngine);
      return { hitPlayer: true, fatalDemonHit: true, enemyName: this.name };
    }

    return { hitPlayer: false, enemyName: this.name };
  }

  _inflictFatalStrike(player, soundEngine) {
    this.hasKilledPlayer = true;
    player.killedByDemon = true;
    player.invulnTimer = 0;
    player.barrierActive = false;
    player.armorPoints = 0;

    if (typeof player.takeHit === 'function') {
      player.takeHit(soundEngine, this, this.fatalDamage);
    }
    player.hp = 0;

    if (soundEngine && typeof soundEngine.playSFX === 'function') {
      soundEngine.playSFX('boss_roar', { volume: 1.0, playbackRate: 0.72 });
    }
  }

  _updateAuraParticles(dt) {
    // Emitir chispas oscuras y carmesí continuamente
    if (this.auraParticles.length < 18) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 7;
      this.auraParticles.push({
        x: this.centerX + Math.cos(angle) * radius,
        y: this.centerY + Math.sin(angle) * radius * 0.65,
        vy: -14 - Math.random() * 14,
        vx: (Math.random() - 0.5) * 10,
        life: 0.45 + Math.random() * 0.3,
        maxLife: 0.75,
        color: Math.random() < 0.55 ? '#ef4444' : Math.random() < 0.8 ? '#09090b' : '#facc15',
        size: Math.random() < 0.4 ? 2 : 1.5
      });
    }

    for (let i = this.auraParticles.length - 1; i >= 0; i--) {
      const p = this.auraParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.auraParticles.splice(i, 1);
      }
    }
  }

  render(ctx, camera) {
    if (this.dead) return;

    const sx = Math.round(this.x - camera.renderX);
    const sy = Math.round(this.y - camera.renderY);
    const cx = sx + 12;
    const cy = sy + 12;
    const bob = Math.sin(this.auraTimer * 9) * 1.5;

    ctx.save();

    // Aura oscura + resplandor carmesí tipo Bloom en el suelo
    const pulse = 1 + Math.sin(this.auraTimer * 10) * 0.12;
    const grad = ctx.createRadialGradient(cx, cy + 4, 2, cx, cy + 4, 17 * pulse);
    grad.addColorStop(0, 'rgba(220, 38, 38, 0.75)');
    grad.addColorStop(0.55, 'rgba(127, 29, 29, 0.45)');
    grad.addColorStop(1, 'rgba(9, 9, 11, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 5, 17 * pulse, 11 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();

    // Partículas de aura oscura ascendentes
    for (const p of this.auraParticles) {
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
    ctx.globalAlpha = 1;

    // Capa / alas espectrales negras detrás del torso
    ctx.fillStyle = '#09090b';
    ctx.fillRect(sx + 2, Math.round(sy + 7 + bob), 20, 14);
    ctx.fillStyle = '#450a0a';
    ctx.fillRect(sx + 1, Math.round(sy + 9 + bob), 3, 10);
    ctx.fillRect(sx + 20, Math.round(sy + 9 + bob), 3, 10);

    // Cuerpo rojo infernal (ligeramente más grande que el jugador)
    ctx.fillStyle = this.hitFlashTimer > 0 ? '#ffffff' : '#b91c1c';
    ctx.fillRect(sx + 5, Math.round(sy + 6 + bob), 14, 14);
    ctx.fillStyle = this.hitFlashTimer > 0 ? '#fecaca' : '#ef4444';
    ctx.fillRect(sx + 6, Math.round(sy + 5 + bob), 12, 9);

    // Cuernos curvados
    ctx.fillStyle = '#09090b';
    ctx.fillRect(sx + 4, Math.round(sy + 1 + bob), 3, 5);
    ctx.fillRect(sx + 17, Math.round(sy + 1 + bob), 3, 5);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(sx + 3, Math.round(sy - 1 + bob), 2, 3);
    ctx.fillRect(sx + 19, Math.round(sy - 1 + bob), 2, 3);
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(sx + 5, Math.round(sy + 2 + bob), 2, 3);
    ctx.fillRect(sx + 17, Math.round(sy + 2 + bob), 2, 3);

    // Ojos amarillos brillantes con halo
    ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
    ctx.fillRect(sx + 7, Math.round(sy + 8 + bob), 4, 3);
    ctx.fillRect(sx + 13, Math.round(sy + 8 + bob), 4, 3);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(sx + 8, Math.round(sy + 8 + bob), 2, 2);
    ctx.fillRect(sx + 14, Math.round(sy + 8 + bob), 2, 2);

    // Sonrisa psicópata con dientes afilados
    ctx.fillStyle = '#09090b';
    ctx.fillRect(sx + 7, Math.round(sy + 12 + bob), 10, 3);
    ctx.fillStyle = '#fef9c3';
    for (let tx = 0; tx < 5; tx++) {
      ctx.fillRect(sx + 8 + tx * 2, Math.round(sy + 12 + bob + (tx % 2)), 1, 2);
    }

    ctx.restore();
    this._renderParticles(ctx, camera);
  }
}
