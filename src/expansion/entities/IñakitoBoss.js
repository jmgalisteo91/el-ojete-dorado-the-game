/**
 * IñakitoBoss.js · Expansión "El Resurgir de Mister Alex IA" (v2.0).
 * Jefe del Acto 1: Iñakito 2.0 (El Becario Eterno). Vida total: 100 HP.
 *
 * - Fase 1 (100% - 66% HP) "El Teclista": quieto en el centro, dispara console.log en abanico de 3.
 * - Fase 2 (66% - 33% HP) "La Invocación": se mueve con moveWithCollisions e invoca 3 Bugs que explotan al morir.
 * - Fase 3 (33% - 0% HP) "El Bucle Infinito": while(true) invulnerable con cúpula azul, error_buzz en bucle,
 *   lluvia de tazas de café y embestidas que deben romperse con un Parry (aturdimiento de 3s).
 * - Muerte: "¿Esto significa que no me van a renovar?"
 */
import { Boss } from '../../entities/bosses/Boss.js?v=8';
import { CollisionSystem } from '../../physics/CollisionSystem.js?v=8';

const DEATH_QUOTE = '¿Esto significa que no me van a renovar?';
const PHASE1_HURT_QUOTE = '¡El jefe dijo que esto era un ascenso!';
const PHASE_NAMES = {
  1: 'FASE 1 · EL TECLISTA',
  2: 'FASE 2 · LA INVOCACIÓN',
  3: 'FASE 3 · BUCLE INFINITO'
};

export class IñakitoBoss extends Boss {
  constructor({ x = 6 * 16, y = 4 * 16, sceneId = 'inakito_office', hp = 100 } = {}) {
    super({
      id: 'boss_inakito',
      name: 'Iñakito 2.0',
      title: 'El Becario Eterno',
      x,
      y,
      width: 28,
      height: 34,
      hp,
      speed: 46,
      sceneId,
      trackName: 'boss_iñakito',
      rewardAbility: null,
      rewardName: 'Llave de Acceso al Vertedero',
      themeColor: '#38bdf8',
      requiresIntroCutscene: true
    });

    this.maxHp = hp;
    this.hp = hp;
    this.phase = 1;
    this.sceneId = sceneId;
    this.boundingBox = { offsetX: 5, offsetY: 20, width: 18, height: 12 };

    this.floatTimer = 0;
    this.shotTimer = 1.4;
    this.summoned = false;
    this.bugs = [];
    this.bugExplosions = [];
    this.coffeeRain = [];
    this.coffeeTimer = 1.1;

    this.inWhileLoop = false;
    this.loopTimer = 0;
    this.loopBrokenTimer = 0;
    this.errorBuzzTimer = 0;

    this.chargeState = 'cooldown';
    this.chargeTimer = 1.2;
    this.chargeVx = 0;
    this.chargeVy = 0;

    this.hurtQuote = '';
    this.hurtQuoteTimer = 0;
    this.deathQuote = '';
    this.talkSfx = 'coffee_sip';
    this.phaseBanner = 0;
    this.lastPhase = 1;
    this.shots = this.projectiles;
    this._lastSoundEngine = null;
  }

  resetCombatState() {
    super.resetCombatState();
    this.phase = 1;
    this.lastPhase = 1;
    this.summoned = false;
    this.bugs = [];
    this.bugExplosions = [];
    this.coffeeRain = [];
    this.inWhileLoop = false;
    this.loopBrokenTimer = 0;
    this.chargeState = 'cooldown';
    this.chargeTimer = 1.2;
    this.hurtQuote = '';
    this.hurtQuoteTimer = 0;
    this.shots = this.projectiles;
  }

  _setPhase(next, soundEngine = null) {
    if (next === this.phase) return;
    this.phase = next;
    this.phaseBanner = 2.4;
    if (next >= 2 && !this.summoned) {
      this.summoned = true;
      this._summonBugs();
    }
    if (next === 3) {
      this._enterWhileLoop(soundEngine);
    }
  }

  _enterWhileLoop(soundEngine = null) {
    this.inWhileLoop = true;
    this.invulnerable = true;
    this.loopTimer = 0;
    this.loopBrokenTimer = 0;
    this.errorBuzzTimer = 0;
    this.chargeState = 'cooldown';
    this.chargeTimer = 0.9;
    this.coffeeTimer = 0.7;
    this.projectiles = [];
    this.shots = this.projectiles;
    if (soundEngine && typeof soundEngine.playSFX === 'function') {
      soundEngine.playSFX('error_buzz');
    }
  }

  /** Rompe la cúpula de bucle infinito y aturde a Iñakito durante 3 segundos. */
  breakWhileLoop(soundEngine = null, stunSeconds = 3.0) {
    if (!this.inWhileLoop && this.stunTimer >= stunSeconds) return false;
    this.inWhileLoop = false;
    this.invulnerable = false;
    this.hitFlashTimer = 0;
    this.stunTimer = stunSeconds;
    this.loopBrokenTimer = stunSeconds;
    this.chargeState = 'cooldown';
    this.chargeTimer = 1.4;
    this.hurtQuote = '¡SEGFAULT! ¡Mi bucle infinito!';
    this.hurtQuoteTimer = 2.2;
    if (soundEngine && typeof soundEngine.playParry === 'function') {
      soundEngine.playParry();
    }
    return true;
  }

  /** Hook invocado por Player.takeHit cuando el jugador ejecuta un Parry perfecto. */
  stun(duration = 1.4) {
    const applied = this.inWhileLoop ? Math.max(duration, 3.0) : duration;
    if (this.inWhileLoop) {
      this.breakWhileLoop(this._lastSoundEngine, applied);
    } else {
      super.stun(applied);
    }
  }

  _summonBugs() {
    this.bugs = [];
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      this.bugs.push({
        x: this.centerX + Math.cos(angle) * 26,
        y: this.centerY + Math.sin(angle) * 20,
        width: 10,
        height: 10,
        boundingBox: { offsetX: 1, offsetY: 1, width: 8, height: 8 },
        hp: 2,
        maxHp: 2,
        dead: false,
        bob: Math.random() * Math.PI * 2,
        hitCooldown: 0,
        hurtTimer: 0
      });
    }
  }

  _explodeBug(bug, player, soundEngine = null) {
    if (!bug || bug.dead) return;
    bug.dead = true;
    this.bugExplosions.push({
      x: bug.x,
      y: bug.y,
      life: 0.45,
      maxLife: 0.45,
      radius: 16
    });
    if (soundEngine && typeof soundEngine.playSFX === 'function') {
      soundEngine.playSFX('error_buzz');
    }
    if (player && !player.barrierActive) {
      const d = Math.hypot((player.centerX ?? player.x) - bug.x, (player.centerY ?? player.y) - bug.y);
      if (d <= 20 && typeof player.takeHit === 'function') {
        player.takeHit(soundEngine, this, 1);
      }
    }
  }

  _shootConsoleLogFan(player, soundEngine = null) {
    if (!player || this.inWhileLoop) return;
    const dx = (player.centerX ?? player.x) - this.centerX;
    const dy = (player.centerY ?? player.y) - this.centerY;
    const baseAngle = Math.atan2(dy, dx);
    const speed = 82;
    const spread = [-0.28, 0, 0.28];
    this.projectiles = this.projectiles || [];
    for (const offset of spread) {
      const angle = baseAngle + offset;
      this.projectiles.push({
        x: this.centerX,
        y: this.centerY - 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage: 1,
        life: 2.6,
        radius: 6,
        type: 'console_log',
        text: 'console.log',
        color: '#38bdf8'
      });
    }
    this.shots = this.projectiles;
    if (soundEngine && typeof soundEngine.playSFX === 'function') {
      soundEngine.playSFX('console_log');
    }
  }

  _spawnCoffeeRain(player) {
    const tx = player ? (player.centerX ?? player.x) + (Math.random() - 0.5) * 34 : 96;
    const ty = player ? (player.centerY ?? player.y) + (Math.random() - 0.5) * 28 : 80;
    const clampedX = Math.max(24, Math.min(168, tx));
    const clampedY = Math.max(24, Math.min(136, ty));
    this.coffeeRain.push({
      targetX: clampedX,
      targetY: clampedY,
      yOffset: -70,
      fallSpeed: 105,
      landed: false
    });
  }

  _updateBugs(dt, tilemap, player, soundEngine) {
    const swordBox = player && typeof player.getSwordHitbox === 'function' ? player.getSwordHitbox() : null;
    const spinBox = player && typeof player.getSpinHitbox === 'function' ? player.getSpinHitbox() : null;

    for (const bug of this.bugs) {
      if (bug.dead) continue;
      bug.bob += dt * 7;
      bug.hitCooldown = Math.max(0, bug.hitCooldown - dt);
      bug.hurtTimer = Math.max(0, bug.hurtTimer - dt);

      // Comprobar golpes de espada/spin/tajo del jugador sobre el Bug
      if (bug.hurtTimer <= 0 && player) {
        let hitDmg = 0;
        const bugBox = { x: bug.x - 5, y: bug.y - 5, width: 10, height: 10 };
        if (swordBox && CollisionSystem.checkAABB(swordBox, bugBox)) {
          hitDmg = typeof player.getSwordDamage === 'function' ? player.getSwordDamage() : 1;
        } else if (spinBox && Math.hypot(bug.x - spinBox.centerX, bug.y - spinBox.centerY) <= spinBox.radius + 6) {
          hitDmg = spinBox.damage || 2;
        } else if (Array.isArray(player.energySlashes)) {
          for (const s of player.energySlashes) {
            if (s.life > 0 && Math.hypot(bug.x - s.x, bug.y - s.y) <= 10) {
              s.life = 0;
              hitDmg = s.damage || 2;
              break;
            }
          }
        }
        if (hitDmg > 0) {
          bug.hp -= hitDmg;
          bug.hurtTimer = 0.25;
          if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
            soundEngine.playEnemyHit();
          }
          if (bug.hp <= 0) {
            this._explodeBug(bug, player, soundEngine);
            continue;
          }
        }
      }

      if (player) {
        const bx = (player.centerX ?? player.x) - bug.x;
        const by = (player.centerY ?? player.y) - bug.y;
        const d = Math.hypot(bx, by) || 1;
        if (d > 9) {
          const step = 46 * dt;
          const nx = bug.x + (bx / d) * step;
          const ny = bug.y + (by / d) * step;
          if (tilemap && typeof tilemap.isSolidAtTile === 'function') {
            const ts = tilemap.tileSize || 16;
            if (!tilemap.isSolidAtTile(Math.floor(nx / ts), Math.floor(bug.y / ts))) bug.x = nx;
            if (!tilemap.isSolidAtTile(Math.floor(bug.x / ts), Math.floor(ny / ts))) bug.y = ny;
          } else {
            bug.x = nx;
            bug.y = ny;
          }
        } else if (bug.hitCooldown <= 0) {
          bug.hitCooldown = 1.0;
          if (typeof player.takeHit === 'function') {
            player.takeHit(soundEngine, this, 1);
          } else if (typeof player.takeDamage === 'function') {
            player.takeDamage(1, soundEngine);
          }
        }
      }
    }

    for (let i = this.bugExplosions.length - 1; i >= 0; i--) {
      this.bugExplosions[i].life -= dt;
      if (this.bugExplosions[i].life <= 0) this.bugExplosions.splice(i, 1);
    }
  }

  _updatePhase3(dt, tilemap, player, soundEngine) {
    if (this.inWhileLoop) {
      this.loopTimer += dt;
      this.errorBuzzTimer -= dt;
      if (this.errorBuzzTimer <= 0) {
        this.errorBuzzTimer = 1.15;
        if (soundEngine && typeof soundEngine.playSFX === 'function') {
          soundEngine.playSFX('error_buzz');
        }
      }

      // Lluvia de tazas de café desde el techo
      this.coffeeTimer -= dt;
      if (this.coffeeTimer <= 0) {
        this._spawnCoffeeRain(player);
        this.coffeeTimer = 0.9;
      }

      // Embestidas telegrafiadas para que el jugador pueda hacer Parry
      this.chargeTimer -= dt;
      if (this.chargeState === 'cooldown' && this.chargeTimer <= 0 && player) {
        this.chargeState = 'windup';
        this.chargeTimer = 0.55;
      } else if (this.chargeState === 'windup' && this.chargeTimer <= 0 && player) {
        const dx = (player.centerX ?? player.x) - this.centerX;
        const dy = (player.centerY ?? player.y) - this.centerY;
        const d = Math.hypot(dx, dy) || 1;
        this.chargeVx = (dx / d) * 125;
        this.chargeVy = (dy / d) * 125;
        this.chargeState = 'charging';
        this.chargeTimer = 0.65;
      } else if (this.chargeState === 'charging') {
        if (tilemap && typeof tilemap.isSolidAtTile === 'function') {
          CollisionSystem.moveWithCollisions(this, this.chargeVx * dt, this.chargeVy * dt, tilemap);
        } else {
          this.x += this.chargeVx * dt;
          this.y += this.chargeVy * dt;
        }
        if (player && Math.hypot((player.centerX ?? player.x) - this.centerX, (player.centerY ?? player.y) - this.centerY) <= 18) {
          if (typeof player.takeHit === 'function') {
            player.takeHit(soundEngine, this, 1);
          }
          this.chargeState = 'cooldown';
          this.chargeTimer = 1.1;
        } else if (this.chargeTimer <= 0) {
          this.chargeState = 'cooldown';
          this.chargeTimer = 1.0;
        }
      }
    } else if (this.loopBrokenTimer > 0) {
      this.loopBrokenTimer = Math.max(0, this.loopBrokenTimer - dt);
      if (this.loopBrokenTimer <= 0 && !this.dead && this.phase === 3) {
        // Si no ha muerto en los 3s de aturdimiento, reactiva el bucle infinito
        this._enterWhileLoop(soundEngine);
      }
    }

    // Actualizar tazas de café cayendo
    for (let i = this.coffeeRain.length - 1; i >= 0; i--) {
      const c = this.coffeeRain[i];
      c.yOffset += c.fallSpeed * dt;
      if (c.yOffset >= 0) {
        if (player && !player.barrierActive) {
          const d = Math.hypot((player.centerX ?? player.x) - c.targetX, (player.centerY ?? player.y) - c.targetY);
          if (d <= 12 && typeof player.takeHit === 'function') {
            player.takeHit(soundEngine, this, 1);
          }
        }
        this.coffeeRain.splice(i, 1);
      }
    }
  }

  update(dt, tilemap, player = null, paused = false, soundEngine = null, ai = null) {
    this._lastSoundEngine = soundEngine;
    if (paused) return { hitPlayer: false };

    this.floatTimer += dt;
    if (this.phaseBanner > 0) this.phaseBanner = Math.max(0, this.phaseBanner - dt);
    if (this.hurtQuoteTimer > 0) this.hurtQuoteTimer = Math.max(0, this.hurtQuoteTimer - dt);

    if (!this.dead) {
      const pct = this.hp / Math.max(1, this.maxHp);
      const next = pct > 0.66 ? 1 : (pct > 0.33 ? 2 : 3);
      if (next !== this.lastPhase) {
        this.lastPhase = next;
        this._setPhase(next, soundEngine);
      }

      if (this.activeCombat && !this.isStunned) {
        if (this.phase === 1) {
          // Fase 1: quieto en el centro disparando abanico de 3 console.log
          this.shotTimer -= dt;
          if (this.shotTimer <= 0) {
            this._shootConsoleLogFan(player, soundEngine);
            this.shotTimer = 1.65;
          }
        } else if (this.phase === 2 && player) {
          // Fase 2: movimiento continuo evitando obstáculos con CollisionSystem
          const dx = (player.centerX ?? player.x) - this.centerX;
          const dy = (player.centerY ?? player.y) - this.centerY;
          const d = Math.hypot(dx, dy) || 1;
          const desiredDist = 42;
          const moveSpeed = d > desiredDist ? 46 : 24;
          const perpX = -dy / d;
          const perpY = dx / d;
          const vx = (d > desiredDist ? (dx / d) : perpX) * moveSpeed;
          const vy = (d > desiredDist ? (dy / d) : perpY) * moveSpeed;
          if (tilemap && typeof tilemap.isSolidAtTile === 'function') {
            CollisionSystem.moveWithCollisions(this, vx * dt, vy * dt, tilemap);
          } else {
            this.x += vx * dt;
            this.y += vy * dt;
          }
          this.shotTimer -= dt;
          if (this.shotTimer <= 0) {
            this._shootConsoleLogFan(player, soundEngine);
            this.shotTimer = 2.0;
          }
        }
      }

      if (this.phase === 3) {
        this._updatePhase3(dt, tilemap, player, soundEngine);
      }

      this._updateBugs(dt, tilemap, player, soundEngine);
    }

    const result = super.update(dt, tilemap, player, paused, soundEngine, ai);
    this.shots = this.projectiles;
    return result;
  }

  takeSwordHit(player, soundEngine = null, customDamage = null) {
    if (this.dead) return false;

    // (FASE 3) while(true): las estocadas normales rebotan; requiere Parry para romper el bucle
    if (this.inWhileLoop) {
      const perfectParry = Boolean(player && Number(player.parryTimer) > 0);
      if (!perfectParry) {
        if (soundEngine && typeof soundEngine.playMetalClink === 'function') {
          soundEngine.playMetalClink();
        }
        return false;
      }
      this.breakWhileLoop(soundEngine, 3.0);
    }

    const hit = super.takeSwordHit(player, soundEngine, customDamage);
    if (hit && !this.dead && this.phase === 1) {
      this.hurtQuote = PHASE1_HURT_QUOTE;
      this.hurtQuoteTimer = 2.0;
    }
    return hit;
  }

  triggerBossDefeat(player, soundEngine = null) {
    this.deathQuote = DEATH_QUOTE;
    this.bugs = [];
    this.coffeeRain = [];
    this.inWhileLoop = false;
    return super.triggerBossDefeat(player, soundEngine);
  }

  render(ctx, camera) {
    // Partículas de muerte si ya fue derrotado
    if (this.dead) {
      super.render(ctx, camera);
      return;
    }

    const sx = Math.round(this.centerX - camera.renderX);
    const floatY = Math.round(this.y + Math.sin(this.floatTimer * 2.4) * 2.5);
    const sy = Math.round(floatY - camera.renderY);
    const t = this.floatTimer;

    // Sombras y tazas de café cayendo (Fase 3)
    for (const c of this.coffeeRain) {
      const cx = Math.round(c.targetX - camera.renderX);
      const cy = Math.round(c.targetY - camera.renderY);
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      const mugY = cy + Math.round(c.yOffset);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(cx - 3, mugY - 5, 6, 5);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(cx - 2, mugY - 5, 4, 2);
      ctx.restore();
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Sombra bajo Iñakito
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 33, 11, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Aura corporativa / estado aturdido
    const auraColor = this.isStunned
      ? 'rgba(250, 204, 21, 0.28)'
      : this.inWhileLoop
        ? 'rgba(56, 189, 248, 0.28)'
        : 'rgba(239, 68, 68, 0.22)';
    const aura = ctx.createRadialGradient(sx, sy + 10, 4, sx, sy + 10, 30);
    aura.addColorStop(0, auraColor);
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(sx - 32, sy - 14, 64, 60);

    // Cuerpo: camisa arrugada y corbata roja
    ctx.fillStyle = this.hitFlashTimer > 0 ? '#fecaca' : '#e2e8f0';
    ctx.fillRect(sx - 9, sy + 14, 18, 18);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(sx - 9, sy + 14, 18, 2);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(sx - 2, sy + 15);
    ctx.lineTo(sx + 2, sy + 15);
    ctx.lineTo(sx + 3, sy + 26);
    ctx.lineTo(sx, sy + 29);
    ctx.lineTo(sx - 3, sy + 26);
    ctx.closePath();
    ctx.fill();

    // Cabeza con ojeras de becario
    ctx.fillStyle = '#f1c9a5';
    ctx.fillRect(sx - 8, sy + 1, 16, 13);
    ctx.fillStyle = '#4a2c1a';
    ctx.fillRect(sx - 8, sy, 16, 3);
    ctx.fillRect(sx - 9, sy + 2, 2, 6);
    ctx.fillRect(sx + 7, sy + 2, 2, 6);
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(sx - 6, sy + 7, 4, 2);
    ctx.fillRect(sx + 2, sy + 7, 4, 2);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(sx - 5, sy + 9, 2, 1);
    ctx.fillRect(sx + 3, sy + 9, 2, 1);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(sx - 2, sy + 11, 4, 1);

    // Taza de café humeante
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(sx + 9, sy + 20, 7, 7);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(sx + 10, sy + 20, 5, 2);

    // Proyectiles console.log
    for (const shot of this.projectiles || []) {
      const shx = Math.round(shot.x - camera.renderX);
      const shy = Math.round(shot.y - camera.renderY);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(shx - 12, shy - 4, 24, 8);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(shx - 11.5, shy - 3.5, 23, 7);
      ctx.fillStyle = '#7dd3fc';
      ctx.font = '3.6px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('console.log', shx, shy);
    }

    // Bugs cucaracha
    for (const bug of this.bugs) {
      if (bug.dead) continue;
      const bx = Math.round(bug.x - camera.renderX);
      const by = Math.round(bug.y - camera.renderY + Math.sin(bug.bob) * 1.5);
      ctx.fillStyle = bug.hurtTimer > 0 ? '#fecaca' : '#1c1917';
      ctx.fillRect(bx - 3, by - 2, 6, 4);
      ctx.fillRect(bx - 5, by - 1, 2, 2);
      ctx.fillRect(bx + 3, by - 1, 2, 2);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(bx - 1, by - 1, 1, 1);
      ctx.fillRect(bx + 1, by - 1, 1, 1);
    }

    // Explosiones al morir un Bug
    for (const exp of this.bugExplosions) {
      const ex = Math.round(exp.x - camera.renderX);
      const ey = Math.round(exp.y - camera.renderY);
      const alpha = Math.max(0, exp.life / exp.maxLife);
      ctx.fillStyle = `rgba(249, 115, 22, ${alpha * 0.65})`;
      ctx.beginPath();
      ctx.arc(ex, ey, exp.radius * (1 - alpha * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }

    // Cúpula de energía azul en Fase 3 (while(true) invulnerable)
    if (this.inWhileLoop) {
      const pulse = 0.55 + Math.sin(t * 7) * 0.25;
      ctx.fillStyle = `rgba(56, 189, 248, ${0.18 * pulse})`;
      ctx.beginPath();
      ctx.arc(sx, sy + 16, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.chargeState === 'windup'
        ? '#facc15'
        : `rgba(34, 211, 238, ${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(sx, sy + 16, 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#bae6fd';
      ctx.font = 'bold 4px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('while (true) { ... }', sx, sy - 12);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '3.5px monospace';
      ctx.fillText(
        this.chargeState === 'windup' ? '¡EMBESTIDA! USA PARRY [C]' : 'PARRY PARA ROMPER',
        sx,
        sy + 39
      );
    } else if (this.isStunned) {
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 4px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('¡ATURDIDO! ¡ATACA!', sx, sy - 10);
    }

    // Frase al recibir daño o aviso de cambio de fase
    if (this.hurtQuoteTimer > 0 && this.hurtQuote) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(sx - 56, sy - 20, 112, 9);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(sx - 55.5, sy - 19.5, 111, 8);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '3.6px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.hurtQuote, sx, sy - 15.5);
    } else if (this.phaseBanner > 0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(sx - 36, sy - 22, 72, 8);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(sx - 35.5, sy - 21.5, 71, 7);
      ctx.fillStyle = '#bae6fd';
      ctx.font = 'bold 4px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(PHASE_NAMES[this.phase] || 'IÑAKITO 2.0', sx, sy - 18);
    }

    ctx.restore();
  }
}
