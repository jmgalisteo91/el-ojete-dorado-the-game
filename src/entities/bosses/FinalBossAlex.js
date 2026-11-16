import { Boss } from './Boss.js?v=8';
import { CollisionSystem } from '../../physics/CollisionSystem.js?v=8';
import { getRandomBattleBark } from '../../assets/VillainDialogues.js?v=8';

/**
 * Boss Final: "Mister AI Alex" — El Update Final.
 * Ubicación: Ciudadela de AI Alex · El Gran Ojal ('ai_citadel').
 *
 * 150 HP en 3 fases de 50 HP:
 *  - FASE 1 (100%-66%): "La Reunión de Accionistas"
 *      · Invoca 3 esbirros que persiguen al jugador.
 *      · Abanico de 5 proyectiles rojos.
 *      · Slam en área con telegraph de 1 s (se esquiva con Dash).
 *  - FASE 2 (66%-33%): "El Mainframe"
 *      · Glitch visual de paleta.
 *      · Lluvia de Errores 404 con telegraph vertical.
 *      · Firewall de 2 paredes que se cierran; hay que parar el núcleo central.
 *      · Teletransporte cuántico y movimiento rápido.
 *  - FASE 3 (33%-0%): "El Update Final"
 *      · Torre gigante (hitbox visual/daño mayores).
 *      · Sobrescritura: oculta el HUD 5 s.
 *      · 4 láseres en cruz con hueco seguro central.
 *      · 3 mini-jefes anteriores (1 HP).
 *
 * La infraestructura de proyectiles, i-frames, parry y victoria sigue siendo la de Boss/Player.
 */
const PHASE_TWO = 0.66;
const PHASE_THREE = 0.33;

export class FinalBossAlex extends Boss {
  constructor({ x, y, sceneId = 'ai_citadel', hp = 150 }) {
    super({
      id: 'boss_final_ai_alex',
      name: 'Mister AI Alex',
      title: 'La Superinteligencia Cuántica Omnipotente',
      x,
      y,
      width: 32,
      height: 32,
      hp,
      speed: 36,
      sceneId,
      trackName: 'theme_main_villain',
      rewardAbility: 'hasGoldenAnus',
      rewardName: 'El Ojete Dorado',
      themeColor: '#ef4444'
    });

    this.phase = 1;
    this.isOverclocked = false;
    this.phaseTransitionTimer = 0;

    this.animTimer = 0;
    this.microwaveTimerSec = 3;
    this.hitCountInPhase = 0;
    this.roomFrozen = false;

    this.minions = [];
    this.telegraphs = [];
    this.firewall = null;
    this.crossLasers = null;

    this.glitchActive = false;
    this.glitchTimer = 0;
    this._hudHiddenUntil = 0;
    this._damageParticles = [];
    this._staticTimer = 0;

    this.arenaTilemap = null;
    this._resetPhaseTimers(1);
    this.statusText = `💬 ${getRandomBattleBark('PHASE_1_START')}`;
  }

  _resetPhaseTimers(phase = 1) {
    // Fase 1
    this.minionTimer = 3.5;
    this.fanTimer = 3.0;
    this.slamTimer = 7.0;
    // Fase 2
    this.rainTimer = 2.5;
    this.firewallTimer = 5.0;
    this.teleportTimer = 3.5;
    // Fase 3
    this.hudHideTimer = 5.0;
    this.laserTimer = 4.5;
    this.miniBossTimer = 8.0;
    this.phaseTransitionTimer = 0.7;
    if (phase === 1) {
      this.minionTimer = 3.5;
    }
  }

  resetCombatState() {
    super.resetCombatState();
    this.phase = 1;
    this.isOverclocked = false;
    this.width = 32;
    this.height = 32;
    this.boundingBox = { offsetX: 3, offsetY: 4, width: 26, height: 26 };
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.speed = 36;
    this.hitCountInPhase = 0;
    this.roomFrozen = false;
    this.phaseTransitionTimer = 0;
    this.glitchActive = false;
    this.glitchTimer = 0;
    this._hudHiddenUntil = 0;
    this._damageParticles = [];
    this._staticTimer = 0;
    this.minions = [];
    this.telegraphs = [];
    this.firewall = null;
    this.crossLasers = null;
    this._resetPhaseTimers(1);
    this.statusText = `💬 ${getRandomBattleBark('PHASE_1_START')}`;
  }

  takeSwordHit(player, soundEngine = null, customDamage = null) {
    if (this.dead || this.roomFrozen) return false;
    const hit = super.takeSwordHit(player, soundEngine, customDamage);
    if (!hit) return false;

    this.hitCountInPhase++;
    if (Math.random() < 0.5) {
      this.statusText = `💬 ${getRandomBattleBark('TAKE_HIT')}`;
    }

    this._updatePhase(soundEngine);

    // (FIX VISUAL) Estática breve + partículas de billetes/código binario.
    this._staticTimer = 0.1;
    this._spawnGoreParticles(this.phase === 3 ? 7 : 5);

    // En Fase 2, cada 3 golpes se teletransporta.
    if (this.phase === 2 && this.hitCountInPhase % 3 === 0) {
      this._performQuantumTeleport();
    }
    return true;
  }

  _updatePhase(soundEngine = null) {
    if (this.dead) return;
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    const nextPhase = ratio > PHASE_TWO ? 1 : (ratio > PHASE_THREE ? 2 : 3);
    if (nextPhase <= this.phase) return;

    this.phase = nextPhase;
    this.isOverclocked = nextPhase >= 2;
    this.hitCountInPhase = 0;
    this.projectiles = [];
    this.telegraphs = [];
    this.minions = [];
    this.firewall = null;
    this.crossLasers = null;
    this._resetPhaseTimers(nextPhase);

    if (nextPhase === 2) {
      this.speed = 55;
      this.glitchActive = true;
      this.statusText = `💠 ${getRandomBattleBark('PHASE_2_TRIGGER')}`;
    } else if (nextPhase === 3) {
      // Torre del Update Final: reposiciona al centro de la arena al crecer a 48x56 y evita atascos.
      this.speed = 0;
      this.width = 48;
      this.height = 56;
      this.boundingBox = { offsetX: 4, offsetY: 6, width: 40, height: 44 };
      this.x = this.spawnX - (this.width - 32) / 2;
      this.y = this.spawnY - (this.height - 32) / 2;
      this._ensureUnstuck(this.arenaTilemap);
      this.glitchActive = true;
      this._hudHiddenUntil = 0;
      this.statusText = '🗼 ¡KERNEL PANIC CUÁNTICO · MICROONDAS AL 300%!';
    }

    if (soundEngine && typeof soundEngine.playHitHurt === 'function') {
      soundEngine.playHitHurt();
    }
  }

  _ensureUnstuck(tilemap) {
    if (!tilemap || typeof tilemap.isSolidAtTile !== 'function') return;
    const box = this.worldBoundingBox;
    if (CollisionSystem.collidesWithMap(box, tilemap)) {
      const step = 4;
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
      for (let r = 1; r <= 8; r++) {
        for (const [dx, dy] of dirs) {
          const testBox = { x: box.x + dx * r * step, y: box.y + dy * r * step, width: box.width, height: box.height };
          if (!CollisionSystem.collidesWithMap(testBox, tilemap)) {
            this.x += dx * r * step;
            this.y += dy * r * step;
            return;
          }
        }
      }
    }
  }

  triggerBossDefeat(player, soundEngine = null) {
    super.triggerBossDefeat(player, soundEngine);
    this.roomFrozen = true;
    this.statusText = '💥 ¡KERNEL PANIC! PROCESO TERMINADO';
    this.projectiles = [];
    this.telegraphs = [];
    this.minions = [];
    this.firewall = null;
    this.crossLasers = null;
    this.glitchActive = false;
    this._hudHiddenUntil = 0;
    this._damageParticles = [];
    this._staticTimer = 0;
  }

  _arenaSize() {
    const tm = this.arenaTilemap;
    if (!tm) return { w: 384, h: 288 };
    const tile = tm.tileSize || 16;
    return {
      w: Number.isFinite(tm.width) ? tm.width : (tm.cols || 24) * tile,
      h: Number.isFinite(tm.height) ? tm.height : (tm.rows || 18) * tile
    };
  }

  _performQuantumTeleport() {
    const arenaSpots = [
      { x: 7 * 16, y: 4 * 16 },
      { x: 15 * 16, y: 4 * 16 },
      { x: 7 * 16, y: 10 * 16 },
      { x: 15 * 16, y: 10 * 16 },
      { x: 11.5 * 16, y: 7 * 16 }
    ];
    const tilemap = this.arenaTilemap;
    const freeSpots = tilemap
      ? arenaSpots.filter((s) => !CollisionSystem.collidesWithMap(this.getBoundingBoxAt(s.x, s.y), tilemap))
      : arenaSpots;
    if (freeSpots.length === 0) return;
    const spot = freeSpots[Math.floor(Math.random() * freeSpots.length)];
    this.x = spot.x;
    this.y = spot.y;
    this.hitFlashTimer = 0.25;
    this.statusText = '⚡ ¡TELETRANSPORTE CUÁNTICO!';
  }

  _spawnProjectile({ x, y, vx = 0, vy = 0, radius = 4, life = 3, color = '#ef4444', ...extra }) {
    this.projectiles.push({ x, y, vx, vy, radius, life, color, ...extra });
  }

  _fanBurst(player) {
    const baseAngle = Math.atan2(player.centerY - this.centerY, player.centerX - this.centerX);
    for (let i = 0; i < 5; i++) {
      const angle = baseAngle + (i - 2) * 0.20;
      this._spawnProjectile({
        x: this.centerX,
        y: this.centerY,
        vx: Math.cos(angle) * 95,
        vy: Math.sin(angle) * 95,
        radius: 4,
        life: 3.4,
        color: '#ef4444',
        isBit: true,
        label: '404'
      });
    }
    this.statusText = '🔴 ¡RÁFAGA DE ERRORES!';
  }

  _startSlam(player) {
    this.telegraphs.push({
      type: 'slam',
      x: player.centerX,
      y: player.centerY,
      radius: 40,
      timer: 1.0,
      duration: 1.0
    });
    this.statusText = '⚠️ ¡SLAM EN ÁREA! USA DASH';
  }

  _startRain() {
    const arena = this._arenaSize();
    for (let i = 0; i < 5; i++) {
      this.telegraphs.push({
        type: 'rain',
        x: 16 + Math.random() * Math.max(16, arena.w - 32),
        timer: 0.85,
        duration: 0.85
      });
    }
    this.statusText = '🌧️ ¡LLUVIA DE ERRORES 404!';
  }

  _startFirewall() {
    const arena = this._arenaSize();
    const cx = arena.w / 2;
    const cy = arena.h / 2;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        this._spawnProjectile({
          x: cx + side * 105,
          y: cy - 45 + i * 18,
          vx: -side * 16,
          vy: 0,
          radius: 5,
          life: 7.5,
          color: side < 0 ? '#38bdf8' : '#f97316',
          isFirewallWall: true
        });
      }
    }
    this.firewall = {
      core: { x: cx, y: cy, radius: 13, hitCooldown: 0 },
      timer: 6.2,
      duration: 6.2
    };
    this.statusText = '🧱 ¡FIREWALL! PARRY AL NÚCLEO CENTRAL';
  }

  _breakFirewall(reason = 'parry', player = null, soundEngine = null) {
    if (!this.firewall) return;
    this.projectiles = this.projectiles.filter((p) => !p.isFirewallWall);
    this.firewall = null;
    if (reason === 'parry') {
      this.statusText = '✨ ¡FIREWALL ROTO CON PARRY PERFECTO!';
      if (soundEngine && typeof soundEngine.playBarrier === 'function') {
        soundEngine.playBarrier();
      }
    } else {
      this.statusText = '💥 ¡FIREWALL COLAPSADO!';
      if (player) player.takeHit(soundEngine, this);
    }
  }

  _startCrossLasers() {
    const arena = this._arenaSize();
    this.crossLasers = {
      phase: 'telegraph',
      timer: 0.9,
      center: { x: arena.w / 2, y: arena.h / 2 },
      gap: 30,
      hitCooldown: 0
    };
    this.statusText = '🎯 ¡LÁSERES CRUZADOS! BUSCA EL CENTRO';
  }

  _spawnMinions(count, kind = 'basic') {
    const arena = this._arenaSize();
    const types = ['gc', 'stack', 'microwave'];
    for (let i = 0; i < count; i++) {
      if (this.minions.length >= 8) break;
      let x = 4 * 16;
      let y = 4 * 16;
      for (let tries = 0; tries < 24; tries++) {
        x = 24 + Math.random() * Math.max(24, arena.w - 48);
        y = 24 + Math.random() * Math.max(24, arena.h - 48);
        if (!this.arenaTilemap) break;
        const box = { x, y, width: kind === 'mini' ? 16 : 10, height: kind === 'mini' ? 16 : 10 };
        if (!CollisionSystem.collidesWithMap(box, this.arenaTilemap)) break;
      }
      const mini = kind === 'mini';
      this.minions.push({
        kind: mini ? types[i % types.length] : 'basic',
        x,
        y,
        width: mini ? 16 : 10,
        height: mini ? 16 : 10,
        hp: mini ? 1 : 2,
        maxHp: mini ? 1 : 2,
        radius: mini ? 8 : 5,
        speed: mini ? 40 : 30,
        contactCooldown: 0,
        hitFlash: 0
      });
    }
    this.statusText = kind === 'mini'
      ? '👾 ¡MINI-JEFES DEL PASADO!'
      : '👾 ¡SUBPROCESOS CUÁNTICOS INVOCADOS!';
  }

  _updateMovement(dt, player, tilemap) {
    if (!tilemap || this.phase === 3) return;
    if (this.phase === 1) {
      if (typeof tilemap.isSolidAtTile !== 'function') return;
      this.floatTime = (this.floatTime || 0) + dt;
      const arena = this._arenaSize();
      const targetX = Math.max(
        32,
        Math.min(arena.w - this.width - 32, this.spawnX + Math.sin(this.floatTime * 0.9) * 72)
      );
      const targetY = Math.max(
        28,
        Math.min(arena.h * 0.65, this.spawnY + Math.cos(this.floatTime * 0.65) * 32)
      );
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        const step = Math.min(dist, this.speed * dt);
        CollisionSystem.moveWithCollisions(this, (dx / dist) * step, (dy / dist) * step, tilemap, []);
      }
      return;
    }
    const dx = player.centerX - this.centerX;
    const dy = player.centerY - this.centerY;
    const dist = Math.hypot(dx, dy);
    if (dist <= 1) return;
    const arena = this._arenaSize();
    const step = this.speed * dt;
    const nx = Math.max(4, Math.min(arena.w - this.width - 4, this.x + (dx / dist) * step));
    const ny = Math.max(4, Math.min(arena.h - this.height - 4, this.y + (dy / dist) * step));
    if (!CollisionSystem.collidesWithMap(this.getBoundingBoxAt(nx, this.y), tilemap)) this.x = nx;
    if (!CollisionSystem.collidesWithMap(this.getBoundingBoxAt(this.x, ny), tilemap)) this.y = ny;
  }

  _updateMinions(dt, player, soundEngine) {
    const sword = player && typeof player.getSwordHitbox === 'function' ? player.getSwordHitbox() : null;
    const swordDamage = player && typeof player.getSwordDamage === 'function' ? player.getSwordDamage() : 1;
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const m = this.minions[i];
      m.contactCooldown = Math.max(0, (m.contactCooldown || 0) - dt);
      m.hitFlash = Math.max(0, (m.hitFlash || 0) - dt);

      if (sword && CollisionSystem.checkAABB(sword, { x: m.x, y: m.y, width: m.width, height: m.height })) {
        m.hp -= swordDamage;
        m.hitFlash = 0.18;
        if (m.hp <= 0) {
          this.minions.splice(i, 1);
          continue;
        }
      }

      const dx = player.centerX - (m.x + m.width / 2);
      const dy = player.centerY - (m.y + m.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        const step = m.speed * dt;
        const nx = m.x + (dx / dist) * step;
        const ny = m.y + (dy / dist) * step;
        if (!this.arenaTilemap || !CollisionSystem.collidesWithMap({ x: nx, y: m.y, width: m.width, height: m.height }, this.arenaTilemap)) {
          m.x = nx;
        }
        if (!this.arenaTilemap || !CollisionSystem.collidesWithMap({ x: m.x, y: ny, width: m.width, height: m.height }, this.arenaTilemap)) {
          m.y = ny;
        }
      }

      if (dist <= m.radius + 9 && m.contactCooldown <= 0) {
        m.contactCooldown = 0.8;
        player.takeHit(soundEngine, this);
      }
    }
  }

  _updateTelegraphs(dt, player, soundEngine) {
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.timer -= dt;
      if (t.timer > 0) continue;

      if (t.type === 'slam') {
        const inRadius = Math.hypot(player.centerX - t.x, player.centerY - t.y) <= t.radius;
        if (inRadius && player.dashTimer <= 0) {
          player.takeHit(soundEngine, this);
        }
      } else if (t.type === 'rain') {
        this._spawnProjectile({
          x: t.x,
          y: -8,
          vx: 0,
          vy: 155,
          radius: 5,
          life: 2.2,
          color: '#ef4444',
          isRain: true,
          label: '404'
        });
      }
      this.telegraphs.splice(i, 1);
    }
  }

  _updateFirewall(dt, player, soundEngine) {
    if (!this.firewall) return;
    const core = this.firewall.core;
    const dist = Math.hypot(player.centerX - core.x, player.centerY - core.y);
    core.hitCooldown = Math.max(0, core.hitCooldown - dt);

    if (dist <= core.radius + 14 && (player.barrierActive || player.parryTimer > 0)) {
      this._breakFirewall('parry', player, soundEngine);
      return;
    }
    if (dist <= core.radius + 6 && core.hitCooldown <= 0) {
      core.hitCooldown = 0.8;
      player.takeHit(soundEngine, this);
    }

    this.firewall.timer -= dt;
    if (this.firewall.timer <= 0) {
      this._breakFirewall('collapse', player, soundEngine);
    }
  }

  _updateCrossLasers(dt, player, soundEngine) {
    if (!this.crossLasers) return;
    const l = this.crossLasers;
    l.timer -= dt;
    l.hitCooldown = Math.max(0, l.hitCooldown - dt);

    if (l.phase === 'telegraph') {
      if (l.timer <= 0) {
        l.phase = 'active';
        l.timer = 1.5;
      }
      return;
    }

    const safe =
      Math.abs(player.centerX - l.center.x) <= l.gap &&
      Math.abs(player.centerY - l.center.y) <= l.gap;
    if (!safe && l.hitCooldown <= 0) {
      l.hitCooldown = 0.8;
      player.takeHit(soundEngine, this);
    }
    if (l.timer <= 0) {
      this.crossLasers = null;
      this.statusText = '💢 ¡LÁSERES DESACTIVADOS!';
    }
  }

  _updateAttacks(dt, player, soundEngine) {
    if (this.phase === 1) {
      this.minionTimer -= dt;
      if (this.minionTimer <= 0) {
        this._spawnMinions(3);
        this.minionTimer = 9.0;
      }
      this.fanTimer -= dt;
      if (this.fanTimer <= 0) {
        this._fanBurst(player);
        this.fanTimer = 4.2;
      }
      this.slamTimer -= dt;
      if (this.slamTimer <= 0) {
        this._startSlam(player);
        this.slamTimer = 8.0;
      }
      return;
    }

    if (this.phase === 2) {
      this.rainTimer -= dt;
      if (this.rainTimer <= 0) {
        this._startRain();
        this.rainTimer = 5.0;
      }
      this.firewallTimer -= dt;
      if (this.firewallTimer <= 0 && !this.firewall) {
        this._startFirewall();
        this.firewallTimer = 10.0;
      }
      this.teleportTimer -= dt;
      if (this.teleportTimer <= 0) {
        this._performQuantumTeleport();
        this.teleportTimer = 4.5;
      }
      return;
    }

    this.hudHideTimer -= dt;
    if (this.hudHideTimer <= 0) {
      this._hudHiddenUntil = performance.now() + 5000;
      this.hudHideTimer = 14.0;
      this.statusText = '📺 ¡SOBRESCRITURA! HUD FUERA 5 s';
    }
    this.laserTimer -= dt;
    if (this.laserTimer <= 0 && !this.crossLasers) {
      this._startCrossLasers();
      this.laserTimer = 11.0;
    }
    this.miniBossTimer -= dt;
    if (this.miniBossTimer <= 0) {
      this._spawnMinions(3, 'mini');
      this.miniBossTimer = 15.0;
    }
  }

  update(dt, tilemap, player, paused = false, soundEngine = null) {
    if (tilemap) this.arenaTilemap = tilemap;
    if (this.dead) return super.update(dt, tilemap, player, paused, soundEngine);
    if (this.roomFrozen || paused) return { hitPlayer: false };

    this.animTimer += dt;
    if (this.animTimer >= 1.0) {
      this.animTimer = 0;
      this.microwaveTimerSec = this.microwaveTimerSec <= 0 ? 3 : this.microwaveTimerSec - 1;
    }

    if (this._staticTimer > 0) this._staticTimer = Math.max(0, this._staticTimer - dt);
    this._updateDamageParticles(dt);

    const baseResult = super.update(dt, tilemap, player, paused, soundEngine);
    if (!this.activeCombat || !player || this.dead) return baseResult;

    this._updateMovement(dt, player, tilemap);
    this._updateMinions(dt, player, soundEngine);
    this._updateTelegraphs(dt, player, soundEngine);
    this._updateFirewall(dt, player, soundEngine);
    this._updateCrossLasers(dt, player, soundEngine);
    this._updateAttacks(dt, player, soundEngine);

    return baseResult;
  }

  _renderWorldRect(ctx, camera, x, y, w, h, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x - camera.renderX), Math.round(y - camera.renderY), w, h);
    ctx.restore();
  }

  _renderTelegraphs(ctx, camera) {
    for (const t of this.telegraphs) {
      if (t.type === 'slam') {
        const p = 1 - Math.max(0, Math.min(1, t.timer / t.duration));
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(t.x - camera.renderX, t.y - camera.renderY, t.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(239, 68, 68, ${0.10 + p * 0.22})`;
        ctx.beginPath();
        ctx.arc(t.x - camera.renderX, t.y - camera.renderY, t.radius * p, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (t.type === 'rain') {
        const arena = this._arenaSize();
        const px = Math.round(t.x - camera.renderX);
        const top = Math.round(-camera.renderY);
        const bottom = Math.round(arena.h - camera.renderY);
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, top);
        ctx.lineTo(px, bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('404', px, Math.max(6, top + 8));
        ctx.restore();
      }
    }
  }

  _renderMinions(ctx, camera) {
    for (const m of this.minions) {
      const px = Math.round(m.x - camera.renderX);
      const py = Math.round(m.y - camera.renderY);
      ctx.save();
      if (m.kind === 'basic') {
        ctx.fillStyle = m.hitFlash > 0 ? '#ffffff' : '#7c3aed';
        ctx.fillRect(px, py, m.width, m.height);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(px + 2, py + 2, 2, 2);
        ctx.fillRect(px + m.width - 4, py + 2, 2, 2);
      } else {
        const colors = { gc: '#10b981', stack: '#a855f7', microwave: '#f97316' };
        ctx.fillStyle = m.hitFlash > 0 ? '#ffffff' : (colors[m.kind] || '#ef4444');
        ctx.fillRect(px, py, m.width, m.height);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(px + 2, py + 4, m.width - 4, 3);
        ctx.font = 'bold 4px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(m.kind === 'gc' ? 'G' : m.kind === 'stack' ? 'S' : 'M', px + m.width / 2, py + m.height / 2);
      }
      ctx.restore();
    }
  }

  _renderFirewall(ctx, camera) {
    if (!this.firewall) return;
    const c = this.firewall.core;
    const px = c.x - camera.renderX;
    const py = c.y - camera.renderY;
    const pulse = 0.5 + 0.3 * Math.sin(performance.now() * 0.01);
    ctx.save();
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, c.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(168, 85, 247, ${pulse})`;
    ctx.beginPath();
    ctx.arc(px, py, c.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PARRY', px, py);
    ctx.restore();
  }

  _renderCrossLasers(ctx, camera) {
    if (!this.crossLasers) return;
    const l = this.crossLasers;
    const arena = this._arenaSize();
    const cx = l.center.x;
    const cy = l.center.y;
    const gap = l.gap;
    const active = l.phase === 'active';
    const alpha = active ? 0.55 : 0.18;
    ctx.save();
    ctx.fillStyle = active ? 'rgba(239, 68, 68, 0.55)' : 'rgba(239, 68, 68, 0.16)';
    // Brazos horizontales: izquierda/derecha hasta el hueco.
    ctx.fillRect(Math.round(0 - camera.renderX), Math.round(cy - 3 - camera.renderY), Math.round(cx - gap), 6);
    ctx.fillRect(Math.round(cx + gap - camera.renderX), Math.round(cy - 3 - camera.renderY), Math.round(arena.w - cx - gap), 6);
    // Brazos verticales: arriba/abajo hasta el hueco.
    ctx.fillRect(Math.round(cx - 3 - camera.renderX), Math.round(0 - camera.renderY), 6, Math.round(cy - gap));
    ctx.fillRect(Math.round(cx - 3 - camera.renderX), Math.round(cy + gap - camera.renderY), 6, Math.round(arena.h - cy - gap));
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(cx - gap - camera.renderX),
      Math.round(cy - gap - camera.renderY),
      gap * 2,
      gap * 2
    );
    ctx.restore();
  }

  _drawStatic(ctx, x, y, w, h) {
    ctx.save();
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#f8fafc' : '#ef4444';
      ctx.globalAlpha = 0.6 + Math.random() * 0.4;
      ctx.fillRect(x + Math.random() * w * 0.6, y + Math.random() * h, 2 + Math.random() * w * 0.4, 1);
    }
    ctx.restore();
  }

  _renderPhase1(ctx, sx, sy, clock) {
    const hover = Math.sin(clock * 2.5) * 1.5;
    const x = sx;
    const y = sy + hover;

    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, this.width, this.height);
      return;
    }

    // Capa y hombreras mecha cibernéticas del juego base
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(x + 2, y + 6, 28, 24);

    // Pechera metálica con Microondas Cuántico integrado
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 6, y + 10, 20, 18);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 6.5, y + 10.5, 19, 17);

    // Display digital del Microondas Cuántico
    ctx.fillStyle = '#052e16';
    ctx.fillRect(x + 9, y + 13, 14, 7);
    ctx.font = 'bold 5px monospace';
    ctx.fillStyle = '#22c55e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`00:0${this.microwaveTimerSec}`, x + 16, y + 16.5);

    // Cabeza / Visor láser
    ctx.fillStyle = '#090d16';
    ctx.fillRect(x + 8, y + 1, 16, 9);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x + 10, y + 4, 12, 3);

    // Corona de antenas cuánticas
    ctx.fillStyle = '#fde047';
    ctx.fillRect(x + 9, y - 1, 2, 2);
    ctx.fillRect(x + 15, y - 2, 2, 3);
    ctx.fillRect(x + 21, y - 1, 2, 2);
    if (this._staticTimer > 0) this._drawStatic(ctx, x + 7, y + 2, 18, 12);
  }

  _renderPhase2(ctx, sx, sy, clock) {
    const jitter = Math.sin(clock * 12) * 1.5;
    const x = sx;
    const y = sy;

    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, this.width, this.height);
      return;
    }

    // Hombreras Overclocked con arcos de energía
    ctx.fillStyle = '#31102f';
    ctx.fillRect(x + 1, y + 6, 30, 24);
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 6.5, 29, 23);

    // Núcleo del Microondas en sobrecarga
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 5, y + 10, 22, 18);
    ctx.strokeStyle = '#ef4444';
    ctx.strokeRect(x + 5.5, y + 10.5, 21, 17);

    ctx.fillStyle = '#450a0a';
    ctx.fillRect(x + 8, y + 13, 16, 7);
    ctx.font = 'bold 5px monospace';
    ctx.fillStyle = '#fca5a5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`00:0${this.microwaveTimerSec}`, x + 16, y + 16.5);

    // Visor Kernel Panic y chispas cuánticas
    ctx.fillStyle = '#090d16';
    ctx.fillRect(x + 7, y + 1, 18, 9);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(x + 9 + jitter * 0.3, y + 4, 14, 3);
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(x + 6, y + 3, 2, 4);
    ctx.fillRect(x + 24, y + 3, 2, 4);

    // Antenas energizadas
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x + 8, y - 2, 2, 3);
    ctx.fillRect(x + 15, y - 3, 2, 4);
    ctx.fillRect(x + 22, y - 2, 2, 3);
    if (this._staticTimer > 0) this._drawStatic(ctx, x + 7, y + 2, 18, 12);
  }

  _renderPhase3(ctx, sx, sy, clock) {
    const cx = sx + this.width / 2;
    const cy = sy + this.height / 2;
    const pulse = 1 + Math.sin(clock * 6) * 0.03;

    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, sy, this.width, this.height);
      return;
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.translate(-cx, -cy);

    // Torre del Mainframe Cuántico / Microondas Definitivo (48x56)
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(sx + 4, sy + 8, this.width - 8, this.height - 10);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx + 4.5, sy + 8.5, this.width - 9, this.height - 11);

    // Pilones laterales cuánticos
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(sx, sy + 16, 8, 32);
    ctx.fillRect(sx + this.width - 8, sy + 16, 8, 32);
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(sx + 2, sy + 18, 3, 26);
    ctx.fillRect(sx + this.width - 5, sy + 18, 3, 26);

    // Cámara central del Microondas Cuántico (El Gran Ojal)
    ctx.fillStyle = '#090d16';
    ctx.fillRect(sx + 10, sy + 16, this.width - 20, 26);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx + 10.5, sy + 16.5, this.width - 21, 25);

    // Núcleo óptico carmesí y temporizador 00:00
    ctx.fillStyle = '#450a0a';
    ctx.fillRect(sx + 13, sy + 20, this.width - 26, 10);
    ctx.font = 'bold 6px monospace';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('00:00', cx, sy + 25);

    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(cx, sy + 36, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(cx, sy + 36, 2, 0, Math.PI * 2);
    ctx.fill();

    // Antenas superiores del Mainframe
    ctx.fillStyle = '#fde047';
    ctx.fillRect(sx + 12, sy, 3, 8);
    ctx.fillRect(cx - 1.5, sy - 2, 3, 10);
    ctx.fillRect(sx + this.width - 15, sy, 3, 8);
    ctx.restore();
  }

  _renderBossBody(ctx, sx, sy) {
    const clock = performance.now() * 0.001;
    if (this.phase === 1) this._renderPhase1(ctx, sx, sy, clock);
    else if (this.phase === 2) this._renderPhase2(ctx, sx, sy, clock);
    else this._renderPhase3(ctx, sx, sy, clock);
  }

  _spawnGoreParticles(count = 5) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 18 + Math.random() * 38;
      this._damageParticles.push({
        x: this.centerX + (Math.random() - 0.5) * 10,
        y: this.centerY + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 28,
        life: 0.55 + Math.random() * 0.45,
        maxLife: 1.0,
        type: i % 2 === 0 ? 'spark' : 'binary',
        text: i % 2 === 0 ? '*' : (Math.random() < 0.5 ? '0' : '1')
      });
    }
  }

  _updateDamageParticles(dt) {
    for (let i = this._damageParticles.length - 1; i >= 0; i--) {
      const p = this._damageParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 95 * dt;
      p.life -= dt;
      if (p.life <= 0) this._damageParticles.splice(i, 1);
    }
  }

  _renderDamageParticles(ctx, camera) {
    for (const p of this._damageParticles) {
      const px = Math.round(p.x - camera.renderX);
      const py = Math.round(p.y - camera.renderY);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 0.35));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.type === 'spark' ? '#f43f5e' : '#22d3ee';
      ctx.font = 'bold 4px monospace';
      ctx.fillText(p.text, px, py);
      ctx.restore();
    }
  }

  _renderRandomGlitch(ctx) {
    if (this.phase < 2 || Math.random() > 0.07) return;
    const colors = ['#ef4444', '#22d3ee', '#fde047', '#a855f7', '#f8fafc'];
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillRect(
      Math.random() * 300,
      Math.random() * 160,
      8 + Math.random() * 45,
      1 + Math.random() * 4
    );
    ctx.restore();
  }

  render(ctx, camera) {
    if (this.dead) {
      super.render(ctx, camera);
      return;
    }

    // Proyectiles y charcos de la infraestructura Boss (abanico, lluvia, paredes).
    super.render(ctx, camera);

    this._renderTelegraphs(ctx, camera);
    this._renderCrossLasers(ctx, camera);
    this._renderMinions(ctx, camera);
    this._renderFirewall(ctx, camera);

    const sx = Math.round(this.x - camera.renderX);
    const sy = Math.round(this.y - camera.renderY);
    const t = performance.now() * 0.003;

    // Halo de distorsión bajo el jefe.
    const haloRad = (this.phase === 3 ? 26 : 16) + Math.sin(t * 6) * 3;
    ctx.save();
    ctx.strokeStyle = this.glitchActive
      ? (Math.floor(performance.now() / 120) % 2 === 0 ? 'rgba(239, 68, 68, 0.65)' : 'rgba(56, 189, 248, 0.65)')
      : 'rgba(168, 85, 247, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx + this.width / 2, sy + this.height / 2, haloRad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Glitch de offset en Fase 2/3.
    if (this.glitchActive) {
      const jitter = Math.floor(performance.now() / 90) % 3 - 1;
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(sx + jitter, sy, this.width, this.height);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(sx - jitter, sy, this.width, this.height);
      ctx.restore();
    }

    this._renderBossBody(ctx, sx, sy);
    this._renderDamageParticles(ctx, camera);
    this._renderRandomGlitch(ctx);
  }
}
