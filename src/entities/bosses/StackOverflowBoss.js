import { Boss } from './Boss.js?v=8';
import { CollisionSystem } from '../../physics/CollisionSystem.js?v=8';
import { findPath, hasLineOfSight } from '../../ai/Pathfinding.js?v=8';

/**
 * Jefe Regional: "El Guardián del Stack Overflow" — El Error de Memoria.
 * Arena de las Minas (mines_boss_arena).
 *
 * Visual: 3 monitores CRT apilados (el superior con un ojo rojo) y cables
 * largos que cuelgan y se retuercen.
 *
 * Fase 1:
 *  - 2 clones espejismo de 1 HP, semitransparentes, en patrón cruzado.
 *  - Excepciones en zigzag lanzadas por el original.
 * Fase 2 (50% HP):
 *  - Los monitores se rompen y sueltan chispas.
 *  - 4 clones: 2 espejismos y 2 reales.
 *  - Onda de choque radial que se esquiva con Dash.
 *  - Cooldown de 0.2 s por clon: un mismo golpe no daña en cada frame.
 */
export class StackOverflowBoss extends Boss {
  constructor({ x, y, sceneId = 'sword_temple', hp = 32 }) {
    super({
      id: 'boss_stack_overflow',
      name: 'El Guardián del Stack Overflow',
      title: 'Centinela Fractal de la Recursión Infinita',
      x,
      y,
      width: 26,
      height: 38,
      hp,
      speed: 32,
      sceneId,
      trackName: 'track_stack_overflow',
      rewardAbility: 'hasChargedAttack',
      rewardName: 'Corte en Cascada (Caso Base)',
      themeColor: '#a855f7',
      requiresIntroCutscene: true
    });

    // Hitbox de pies 14x12 para navegar pasillos; el cuerpo visual/hurtbox es mayor.
    this.boundingBox = { offsetX: 5, offsetY: 26, width: 14, height: 12 };

    this.phase = 1;
    this.phase2 = false;
    this.monitorsBroken = false;
    this.cloneThresholds = [Math.round(this.maxHp * 0.5)];
    this.phase2Triggered = false;
    this.phase1ClonesSpawned = false;

    this.clones = [];
    this.cloneOrbitTime = 0;
    this.cloneSpawnFlash = 0;
    this.sparks = [];

    this.zigzagTimer = 2.8;
    this.zigzagWindup = 0;
    this.zigzagShots = [];

    this.channelTimer = 0;
    this.isChanneling = false;
    this.shockwaveCooldown = 9.0;
    this.shockwaves = [];

    this.path = [];
    this.pathGoal = null;
    this.repathTimer = 0;
    this.stuckTimer = 0;
    this.lastX = x;
    this.lastY = y;
  }

  resetCombatState() {
    super.resetCombatState();
    this.phase = 1;
    this.phase2 = false;
    this.monitorsBroken = false;
    this.phase2Triggered = false;
    this.phase1ClonesSpawned = false;
    this.cloneThresholds = [Math.round(this.maxHp * 0.5)];
    this.clones = [];
    this.cloneOrbitTime = 0;
    this.cloneSpawnFlash = 0;
    this.sparks = [];
    this.zigzagTimer = 2.8;
    this.zigzagWindup = 0;
    this.zigzagShots = [];
    this.channelTimer = 0;
    this.isChanneling = false;
    this.shockwaveCooldown = 9.0;
    this.shockwaves = [];
    this.path = [];
    this.pathGoal = null;
    this.repathTimer = 0;
    this.stuckTimer = 0;
  }

  triggerBossDefeat(player, soundEngine = null) {
    super.triggerBossDefeat(player, soundEngine);
    this.clones = [];
    this.zigzagShots = [];
    this.shockwaves = [];
    this.isChanneling = false;
    this.channelTimer = 0;
    this.sparks = [];
    this.path = [];
  }

  takeSwordHit(player, soundEngine = null, customDamage = null, tilemap = null) {
    const hit = super.takeSwordHit(player, soundEngine, customDamage);
    if (!hit) return false;
    if (!this.phase2 && this.hp <= this.maxHp * 0.5 && this.hp > 0) {
      this._enterPhase2(soundEngine, tilemap);
    }
    return true;
  }

  _enterPhase2(soundEngine = null, tilemap = null) {
    this.phase = 2;
    this.phase2 = true;
    this.monitorsBroken = true;
    this.phase2Triggered = true;
    this.statusText = '💥 ¡MONITORES ROTOS! 4 CLONES RECURSIVOS';
    this.shockwaveCooldown = 1.8;
    this.clones = [];
    this.spawnPhase2Clones(soundEngine, tilemap);
    for (let i = 0; i < 14; i++) {
      this.sparks.push({
        x: this.centerX,
        y: this.centerY - 10,
        vx: (Math.random() - 0.5) * 80,
        vy: -30 - Math.random() * 50,
        life: 0.6 + Math.random() * 0.5
      });
    }
    if (soundEngine && typeof soundEngine.playHitHurt === 'function') {
      soundEngine.playHitHurt();
    }
  }

  _makeClone(x, y, { isMirage = true, hp = 1, phase = 0 } = {}) {
    return {
      x,
      y,
      hp,
      maxHp: hp,
      speed: isMirage ? 46 : 34,
      isMirage,
      opacity: isMirage ? 0.35 : 0.9,
      phase,
      attackCooldown: 0,
      hitFlash: 0,
      hitCooldown: 0
    };
  }

  /** Fase 1: 2 espejismos de 1 HP en patrón cruzado. */
  spawnRecursiveClones(soundEngine = null, tilemap = null) {
    this.clones = [];
    this.cloneSpawnFlash = 0.45;
    this.clones.push(this._makeClone(this.centerX - 26, this.centerY + 8, { isMirage: true, hp: 1, phase: 0 }));
    this.clones.push(this._makeClone(this.centerX + 26, this.centerY + 8, { isMirage: true, hp: 1, phase: Math.PI }));
    this.statusText = '⚡ ¡LLAMADA RECURSIVA: 2 ESPEJISMOS!';
    if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
      soundEngine.playEnemyHit();
    }
  }

  /** Fase 2: 2 espejismos (1 HP) + 2 clones reales (2 HP). */
  spawnPhase2Clones(soundEngine = null, tilemap = null) {
    this.clones = [];
    this.cloneSpawnFlash = 0.45;
    const spots = [
      { dx: -34, dy: 10, mirage: true, hp: 1, phase: 0 },
      { dx: 34, dy: 10, mirage: true, hp: 1, phase: Math.PI },
      { dx: -18, dy: -6, mirage: false, hp: 2, phase: Math.PI / 2 },
      { dx: 18, dy: -6, mirage: false, hp: 2, phase: -Math.PI / 2 }
    ];
    for (const s of spots) {
      this.clones.push(this._makeClone(this.centerX + s.dx, this.centerY + s.dy, {
        isMirage: s.mirage,
        hp: s.hp,
        phase: s.phase
      }));
    }
    this.statusText = '👁️ ¡4 CLONES: 2 ESPEJISMOS Y 2 REALES!';
    if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
      soundEngine.playEnemyHit();
    }
  }

  _ensureUnstuck(tilemap) {
    if (!tilemap) return;
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
            this.path = [];
            this.repathTimer = 0;
            return;
          }
        }
      }
    }
  }

  _updateClones(dt, tilemap, player, soundEngine) {
    this.cloneOrbitTime += dt;
    const sword = player && typeof player.getSwordHitbox === 'function' ? player.getSwordHitbox() : null;
    const spin = player && typeof player.getSpinHitbox === 'function' ? player.getSpinHitbox() : null;
    const swordDamage = player && typeof player.getSwordDamage === 'function' ? player.getSwordDamage() : 1;

    for (let i = this.clones.length - 1; i >= 0; i--) {
      const c = this.clones[i];
      c.hitFlash = Math.max(0, c.hitFlash - dt);
      c.hitCooldown = Math.max(0, c.hitCooldown - dt);
      c.attackCooldown = Math.max(0, c.attackCooldown - dt);

      if (c.isMirage) {
        // Patrón cruzado alrededor del original.
        c.x = this.centerX + Math.cos(this.cloneOrbitTime * 2.1 + c.phase) * 44;
        c.y = this.centerY + Math.sin(this.cloneOrbitTime * 2.1 + c.phase) * 26;
      } else if (player) {
        const dx = player.centerX - c.x;
        const dy = player.centerY - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 6) {
          const vx = (dx / dist) * c.speed * dt;
          const vy = (dy / dist) * c.speed * dt;
          const boxX = { x: c.x - 5 + vx, y: c.y - 6, width: 10, height: 12 };
          const boxY = { x: c.x - 5, y: c.y - 6 + vy, width: 10, height: 12 };
          if (!tilemap || !CollisionSystem.collidesWithMap(boxX, tilemap)) c.x += vx;
          if (!tilemap || !CollisionSystem.collidesWithMap(boxY, tilemap)) c.y += vy;
        }
      }

      if (player) {
        const dist = Math.hypot(player.centerX - c.x, player.centerY - c.y);
        if (dist <= 12 && c.attackCooldown <= 0) {
          c.attackCooldown = 0.9;
          player.takeHit(soundEngine, this);
        }
      }

      // (FIX MULTI-HIT) Cooldown de 0.2 s por clon: un mismo frame/golpe no
      // puede restarle vida repetidamente.
      if (c.hitCooldown <= 0) {
        const hitBySpin = spin && Math.hypot(c.x - spin.centerX, c.y - spin.centerY) <= spin.radius + 6;
        const hitBySword = sword && CollisionSystem.checkAABB(sword, { x: c.x - 6, y: c.y - 6, width: 12, height: 12 });
        if (hitBySpin || hitBySword) {
          const dmg = hitBySpin ? (spin.damage || 1) : swordDamage;
          c.hp -= dmg;
          c.hitFlash = 0.15;
          c.hitCooldown = 0.2;
        }
      }

      if (c.hp <= 0) {
        this.clones.splice(i, 1);
      }
    }
  }

  _startZigzag(player) {
    this.zigzagWindup = 0.35;
    this.statusText = '⚡ CARGANDO EXCEPCIONES EN ZIGZAG...';
  }

  _spawnZigzag(player) {
    if (!player) return;
    const baseAngle = Math.atan2(player.centerY - this.centerY, player.centerX - this.centerX);
    for (let i = 0; i < 2; i++) {
      const angle = baseAngle + (i === 0 ? -0.2 : 0.2);
      this.zigzagShots.push({
        x: this.centerX,
        y: this.centerY,
        angle,
        speed: 82,
        life: 3.6,
        t: 0,
        side: i === 0 ? -1 : 1,
        color: '#c084fc'
      });
    }
    this.statusText = '🌀 ¡EXCEPCIONES EN ZIGZAG!';
  }

  _updateZigzagShots(dt, player, soundEngine) {
    for (let i = this.zigzagShots.length - 1; i >= 0; i--) {
      const s = this.zigzagShots[i];
      s.t += dt;
      s.life -= dt;
      const zig = Math.sin(s.t * 9) * 1.8 * s.side;
      const dx = Math.cos(s.angle) * s.speed * dt;
      const dy = Math.sin(s.angle) * s.speed * dt;
      s.x += dx + Math.cos(s.angle + Math.PI / 2) * zig;
      s.y += dy + Math.sin(s.angle + Math.PI / 2) * zig;
      if (player && Math.hypot(player.centerX - s.x, player.centerY - s.y) <= 8) {
        player.takeHit(soundEngine, this);
        this.zigzagShots.splice(i, 1);
        continue;
      }
      if (s.life <= 0) this.zigzagShots.splice(i, 1);
    }
  }

  _updateSparks(dt) {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 120 * dt;
      s.life -= dt;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }
  }

  _moveHighLevel(dt, tilemap, player) {
    if (!player || !this.activeCombat) return;
    const dist = Math.hypot(player.centerX - this.centerX, player.centerY - this.centerY);
    if (dist <= 12) return;

    this.repathTimer = Math.max(0, this.repathTimer - dt);
    const los = hasLineOfSight(tilemap, this.centerX, this.centerY, player.centerX, player.centerY);
    let steerX = 0;
    let steerY = 0;

    if (los && this.stuckTimer < 0.2) {
      steerX = (player.centerX - this.centerX) / dist;
      steerY = (player.centerY - this.centerY) / dist;
      this.path = [];
    } else {
      const goalMoved = !this.pathGoal || Math.hypot(this.pathGoal.x - player.centerX, this.pathGoal.y - player.centerY) > 20;
      if (this.path.length === 0 || goalMoved || this.repathTimer <= 0) {
        this.path = findPath(tilemap, this.centerX, this.centerY, player.centerX, player.centerY);
        this.pathGoal = { x: player.centerX, y: player.centerY };
        this.repathTimer = 0.35;
      }
      while (this.path.length > 0 && Math.hypot(this.path[0].x - this.centerX, this.path[0].y - this.centerY) < 10) {
        this.path.shift();
      }
      if (this.path.length > 0) {
        const wp = this.path[0];
        const wdx = wp.x - this.centerX;
        const wdy = wp.y - this.centerY;
        const wdist = Math.hypot(wdx, wdy) || 1;
        steerX = wdx / wdist;
        steerY = wdy / wdist;
      } else {
        steerX = (player.centerX - this.centerX) / dist;
        steerY = (player.centerY - this.centerY) / dist;
      }
    }

    const moveRes = CollisionSystem.moveWithCollisions(
      this,
      steerX * this.speed * dt,
      steerY * this.speed * dt,
      tilemap,
      []
    );
    const movedDist = Math.hypot(this.x - (this.lastX ?? this.x), this.y - (this.lastY ?? this.y));
    if (movedDist < 0.6 * dt * this.speed && (moveRes.blockedX || moveRes.blockedY)) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 0.2) {
        this.repathTimer = 0;
        if (moveRes.blockedX) {
          const altY = player.centerY > this.centerY ? 1 : -1;
          CollisionSystem.moveWithCollisions(this, 0, altY * this.speed * dt, tilemap, []);
        }
        if (moveRes.blockedY) {
          const altX = player.centerX > this.centerX ? 1 : -1;
          CollisionSystem.moveWithCollisions(this, altX * this.speed * dt, 0, tilemap, []);
        }
      }
    } else {
      this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2);
    }
    this.lastX = this.x;
    this.lastY = this.y;

    if (dist <= 14 && this.attackCooldown <= 0) {
      this.attackCooldown = 0.85;
      player.takeHit(this.soundEngine || null, this);
    }
  }

  update(dt, tilemap, player, paused = false, soundEngine = null) {
    if (soundEngine) this.soundEngine = soundEngine;
    if (this.dead) return super.update(dt, tilemap, player, paused, soundEngine);

    this._ensureUnstuck(tilemap);
    super.update(dt, tilemap, player, paused, soundEngine);
    if (paused || this.dead) return { hitPlayer: false };

    if (this.activeCombat && this.phase === 1 && !this.phase1ClonesSpawned) {
      this.phase1ClonesSpawned = true;
      this.spawnRecursiveClones(soundEngine, tilemap);
    }

    this.cloneSpawnFlash = Math.max(0, this.cloneSpawnFlash - dt);
    this._updateClones(dt, tilemap, player, soundEngine);
    this._updateZigzagShots(dt, player, soundEngine);
    this._updateSparks(dt);

    // Excepciones en zigzag con windup.
    if (this.zigzagWindup > 0) {
      this.zigzagWindup -= dt;
      if (this.zigzagWindup <= 0 && this.activeCombat) {
        this._spawnZigzag(player);
        this.zigzagTimer = this.phase2 ? 2.2 : 3.0;
      }
    } else if (this.activeCombat) {
      this.zigzagTimer -= dt;
      if (this.zigzagTimer <= 0) this._startZigzag(player);
    }

    if (!this.isChanneling) {
      this._moveHighLevel(dt, tilemap, player);

      if (this.phase2) {
        this.shockwaveCooldown -= dt;
        if (this.shockwaveCooldown <= 0 && this.activeCombat) {
          this.isChanneling = true;
          this.channelTimer = 1.8;
          this.statusText = '🌀 CANALIZANDO STACK OVERFLOW...';
        }
      }
    } else {
      this.channelTimer -= dt;
      if (this.channelTimer <= 0) {
        this.isChanneling = false;
        this.shockwaveCooldown = 8.0;
        this.statusText = '💥 ¡DESBORDAMIENTO RADIAL!';
        this.shockwaves.push({ x: this.centerX, y: this.centerY, radius: 10, maxRadius: 66, speed: 74, hasHit: false });
        if (soundEngine && typeof soundEngine.playEnemyHit === 'function') soundEngine.playEnemyHit();
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed * dt;
      if (player && !sw.hasHit) {
        const dist = Math.hypot(player.centerX - sw.x, player.centerY - sw.y);
        if (Math.abs(dist - sw.radius) <= 8 && player.invulnTimer <= 0) {
          sw.hasHit = true;
          player.takeHit(soundEngine, this);
        }
      }
      if (sw.radius >= sw.maxRadius) this.shockwaves.splice(i, 1);
    }

    return { hitPlayer: false };
  }

  _drawCrtStack(ctx, cx, cy, scale, opacity, broken) {
    ctx.save();
    ctx.globalAlpha = opacity;
    const w = 22 * scale;
    const h = 11 * scale;
    for (let i = 0; i < 3; i++) {
      const y = cy - h * 1.5 + i * (h + 1);
      ctx.fillStyle = '#374151';
      ctx.fillRect(cx - w / 2, y, w, h);
      ctx.fillStyle = '#111827';
      ctx.fillRect(cx - w / 2 + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = i === 0 ? '#052e16' : '#0f172a';
      ctx.fillRect(cx - w / 2 + 2, y + 2, w - 4, h - 4);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
      for (let row = y + 2; row < y + h - 2; row += 2) ctx.fillRect(cx - w / 2 + 2, row, w - 4, 1);
      if (broken) {
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(cx - w / 4, y + 1);
        ctx.lineTo(cx, y + h / 2);
        ctx.lineTo(cx + w / 4, y + 1);
        ctx.stroke();
      }
    }
    // Ojo rojo del monitor superior.
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, cy - h * 1.5 + h / 2, 2.4 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(cx + 0.8 * scale, cy - h * 1.5 + h / 2, 1.1 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  render(ctx, camera) {
    super.render(ctx, camera);
    if (this.dead) return;

    const sx = this.x - camera.renderX;
    const sy = this.y - camera.renderY;
    const cx = sx + this.width / 2;
    const cy = sy + this.height / 2;
    const now = performance.now() / 1000;

    ctx.save();

    // Ondas de choque.
    for (const sw of this.shockwaves) {
      const wx = sw.x - camera.renderX;
      const wy = sw.y - camera.renderY;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(wx, wy, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(wx, wy, sw.radius - 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Canalización de la onda de choque.
    if (this.isChanneling) {
      const pct = 1 - this.channelTimer / 1.8;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 16 + pct * 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '5.5px monospace';
      ctx.fillStyle = '#f87171';
      ctx.textAlign = 'center';
      ctx.fillText('STACK OVERFLOW', cx, cy - 24);
    }

    // Windup de excepciones en zigzag: aura de aviso.
    if (this.zigzagWindup > 0) {
      ctx.strokeStyle = Math.floor(now * 14) % 2 === 0 ? '#c084fc' : '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 24 + Math.sin(now * 10) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cables que cuelgan y se retuercen.
    ctx.strokeStyle = '#020617';
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.lineWidth = i === 0 ? 2.2 : 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + i * 7, sy + 14);
      ctx.bezierCurveTo(
        cx + i * 16 + Math.sin(now * 3 + i) * 4, sy + 24,
        cx + i * 22 + Math.cos(now * 2 + i) * 5, sy + 34,
        cx + i * 17, sy + 44 + Math.sin(now * 4 + i) * 3
      );
      ctx.stroke();
    }

    // 3 monitores CRT apilados.
    this._drawCrtStack(ctx, cx, cy, 1, 1, this.monitorsBroken);

    if (this.cloneSpawnFlash > 0) {
      ctx.strokeStyle = Math.floor(now * 18) % 2 === 0 ? '#c084fc' : '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 28 + Math.sin(now * 14) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Chispas de Fase 2.
    for (const s of this.sparks) {
      ctx.fillStyle = s.life > 0.3 ? '#fde047' : '#f97316';
      ctx.fillRect(s.x - camera.renderX, s.y - camera.renderY, 1.5, 1.5);
    }

    // Clones espejismo/reales.
    for (const c of this.clones) {
      const clx = c.x - camera.renderX;
      const cly = c.y - camera.renderY;
      this._drawCrtStack(ctx, clx, cly, 0.55, c.opacity, false);
      ctx.globalAlpha = 1;
      ctx.font = '4px monospace';
      ctx.fillStyle = c.isMirage ? '#c084fc' : '#ef4444';
      ctx.textAlign = 'center';
      ctx.fillText(c.isMirage ? 'mirage' : 'clone', clx, cly - 12);
    }

    // Excepciones en zigzag.
    for (const s of this.zigzagShots) {
      const px = s.x - camera.renderX;
      const py = s.y - camera.renderY;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 4px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('!', px, py + 1);
    }

    ctx.restore();
  }
}
