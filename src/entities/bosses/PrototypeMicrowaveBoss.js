import { Boss } from './Boss.js?v=8';
import { CollisionSystem } from '../../physics/CollisionSystem.js?v=8';

/**
 * Jefe Regional: "El Microondas Prototipo (V0.1 Alpha)" — El Electrodoméstico Asesino.
 * Umbral de la Fortaleza (ai_fortress_gate).
 *
 * Visual: caja de microondas oxidada, 4 patas de araña mecánicas y puerta roja.
 * Fase 1:
 *  - Ondas de calor expansivas (anillos) con windup telegrafiado.
 *  - El suelo se sobrecalienta: charcos de lava aleatorios con aviso previo.
 * Fase 2 (50% HP):
 *  - 2 fusibles en las esquinas; hay que golpear ambos para aturdir al jefe.
 *  - Aturdido: la puerta se abre y recibe daño crítico x2 (isStunned del Boss).
 *  - Si pasan 10 s sin fundir los fusibles: AoE masivo de sobrecalentamiento.
 */
export class PrototypeMicrowaveBoss extends Boss {
  constructor({ x, y, sceneId = 'ai_fortress_gate', hp = 42 }) {
    super({
      id: 'boss_prototype_microwave',
      name: 'El Microondas Prototipo (V0.1 Alpha)',
      title: 'Artefacto Cuántico Precursor de Mister AI Alex',
      x,
      y,
      width: 32,
      height: 30,
      hp,
      speed: 26,
      sceneId,
      trackName: 'track_prototype_microwave',
      rewardAbility: 'hasBarrier',
      rewardName: 'Barrera de Tipado Estricto',
      themeColor: '#f97316',
      requiresIntroCutscene: true
    });

    this.phase = 1;
    this.phase2 = false;
    this.cycleThresholds = [Math.round(this.maxHp * 0.5)];
    this.phase2Triggered = false;
    this.arenaTilemap = null;

    this.heatWaveTimer = 3.2;
    this.heatWindup = 0;
    this.heatWaves = [];

    this.lavaTimer = 3.0;
    this.lavaWarnings = [];

    this.fuses = [];
    this.fusePhaseActive = false;
    this.fuseTimer = 10.0;
    this.fuseAoeWindup = 0;
    this.stunnedTimer = 0;
    this.doorOpen = false;

    this.sparks = [];
    this.rustSeed = Math.random() * 100;
  }

  resetCombatState() {
    super.resetCombatState();
    this.phase = 1;
    this.phase2 = false;
    this.phase2Triggered = false;
    this.cycleThresholds = [Math.round(this.maxHp * 0.5)];
    this.heatWaveTimer = 3.2;
    this.heatWindup = 0;
    this.heatWaves = [];
    this.lavaTimer = 3.0;
    this.lavaWarnings = [];
    this.fuses = [];
    this.fusePhaseActive = false;
    this.fuseTimer = 10.0;
    this.fuseAoeWindup = 0;
    this.stunnedTimer = 0;
    this.doorOpen = false;
    this.sparks = [];
  }

  triggerBossDefeat(player, soundEngine = null) {
    super.triggerBossDefeat(player, soundEngine);
    this.fusePhaseActive = false;
    this.fuses = [];
    this.stunnedTimer = 0;
    this.doorOpen = false;
    this.heatWaves = [];
    this.lavaWarnings = [];
    this.sparks = [];
  }

  takeSwordHit(player, soundEngine = null, customDamage = null) {
    const hit = super.takeSwordHit(player, soundEngine, customDamage);
    if (!hit) return false;
    if (!this.phase2 && this.hp <= this.maxHp * 0.5 && this.hp > 0) {
      this._enterPhase2(soundEngine);
    }
    return true;
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

  _enterPhase2(soundEngine = null) {
    this.phase = 2;
    this.phase2 = true;
    this.phase2Triggered = true;
    this.fusePhaseActive = true;
    this.fuseTimer = 10.0;
    this.stunnedTimer = 0;
    this.doorOpen = false;
    const arena = this._arenaSize();
    this.fuses = [
      { id: 'left', x: 3 * 16, y: arena.h - 4 * 16, active: true, hit: false },
      { id: 'right', x: arena.w - 3 * 16, y: arena.h - 4 * 16, active: true, hit: false }
    ];
    this.statusText = '🔌 ¡FUSIBLES EXPUESTOS! GOLPEA LOS 2 EN 10 s';
    if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
      soundEngine.playEnemyHit();
    }
  }

  _spawnHeatWave() {
    this.heatWaves.push({
      x: this.centerX,
      y: this.centerY,
      radius: 8,
      maxRadius: 92,
      speed: 62,
      hasHit: false,
      color: '#f97316'
    });
    this.statusText = '🔥 ¡ONDA DE CALOR EXPANSIVA!';
  }

  _spawnLavaWarning() {
    const arena = this._arenaSize();
    for (let i = 0; i < 2; i++) {
      this.lavaWarnings.push({
        x: 32 + Math.random() * Math.max(32, arena.w - 64),
        y: 32 + Math.random() * Math.max(32, arena.h - 64),
        radius: 14,
        timer: 0.8,
        duration: 0.8
      });
    }
    this.statusText = '🌋 ¡SUELO SOBRECALENTADO!';
  }

  _updateFuses(player, soundEngine) {
    if (!this.fusePhaseActive || this.stunnedTimer > 0 || !player) return;
    const sword = typeof player.getSwordHitbox === 'function' ? player.getSwordHitbox() : null;
    const spin = typeof player.getSpinHitbox === 'function' ? player.getSpinHitbox() : null;
    for (const f of this.fuses) {
      if (!f.active || f.hit) continue;
      const swordCenterX = sword ? sword.x + (sword.width || 0) / 2 : 0;
      const swordCenterY = sword ? sword.y + (sword.height || 0) / 2 : 0;
      const hitBySword = sword && Math.hypot(f.x - swordCenterX, f.y - swordCenterY) <= 16;
      const hitBySpin = spin && Math.hypot(f.x - spin.centerX, f.y - spin.centerY) <= spin.radius + 10;
      if (hitBySword || hitBySpin) {
        f.hit = true;
        if (soundEngine && typeof soundEngine.playMetalClink === 'function') {
          soundEngine.playMetalClink();
        }
      }
    }
    if (this.fuses.length > 0 && this.fuses.every((f) => f.hit)) {
      // (BLOQUE 2.4) La puerta queda abierta y el jefe recibe crítico x2 durante 2.5 s.
      this.stunnedTimer = 2.5;
      this.doorOpen = true;
      this.fusePhaseActive = false;
      for (const f of this.fuses) f.active = false;
      this.statusText = '💥 ¡FUSIBLES FUNDIDOS! DAÑO CRÍTICO x2';
      for (let i = 0; i < 12; i++) {
        this.sparks.push({
          x: this.centerX + (Math.random() - 0.5) * 24,
          y: this.centerY,
          vx: (Math.random() - 0.5) * 80,
          vy: -20 - Math.random() * 50,
          life: 0.5 + Math.random() * 0.4
        });
      }
      if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
        soundEngine.playEnemyHit();
      }
    }
  }

  update(dt, tilemap, player, paused = false, soundEngine = null) {
    if (tilemap) this.arenaTilemap = tilemap;
    if (this.dead) return super.update(dt, tilemap, player, paused, soundEngine);

    super.update(dt, tilemap, player, paused, soundEngine);
    if (paused || this.dead) return { hitPlayer: false };

    // Aturdimiento por fusibles: puerta abierta y daño x2 vía Boss.isStunned.
    if (this.stunnedTimer > 0) {
      this.stunnedTimer -= dt;
      this.doorOpen = true;
      this.statusText = '💫 ¡CORTOCIRCUITO! (CRÍTICO x2)';
      this._updateSparks(dt);
      if (this.stunnedTimer <= 0) {
        this.doorOpen = false;
        this.fusePhaseActive = true;
        this.fuseTimer = 10.0;
        for (const f of this.fuses) {
          f.active = true;
          f.hit = false;
        }
        this.statusText = '🔌 FUSIBLES REINICIADOS';
      }
      return { hitPlayer: false };
    }

    // Movimiento lento sobre sus 4 patas mecánicas: persigue/patrulla a media distancia.
    if (this.activeCombat && player && tilemap && typeof tilemap.isSolidAtTile === 'function') {
      const dx = player.centerX - this.centerX;
      const dy = player.centerY - this.centerY;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        let moveX = 0;
        let moveY = 0;
        if (dist > 54) {
          moveX = dx / dist;
          moveY = dy / dist;
        } else if (dist < 32) {
          moveX = -dx / dist;
          moveY = -dy / dist;
        } else {
          const strafeDir = Math.sin((this.walkCycle || 0) * 0.4) >= 0 ? 1 : -1;
          moveX = (-dy / dist) * strafeDir;
          moveY = (dx / dist) * strafeDir;
        }
        this.walkCycle = (this.walkCycle || 0) + dt;
        CollisionSystem.moveWithCollisions(
          this,
          moveX * this.speed * dt,
          moveY * this.speed * dt,
          tilemap,
          []
        );
      }
    }

    // Fase 2: fusibles y cuenta atrás de sobrecalentamiento.
    if (this.phase2 && this.fusePhaseActive) {
      this.fuseTimer -= dt;
      if (this.fuseTimer <= 0) {
        this._massiveOverheat(player, soundEngine);
        this.fuseTimer = 10.0;
        for (const f of this.fuses) {
          f.active = true;
          f.hit = false;
        }
        this.fusePhaseActive = true;
      } else {
        this._updateFuses(player, soundEngine);
      }
    }

    // Ondas de calor con windup.
    if (this.heatWindup > 0) {
      this.heatWindup -= dt;
      if (this.heatWindup <= 0 && this.activeCombat) this._spawnHeatWave();
    } else if (this.activeCombat) {
      this.heatWaveTimer -= dt;
      if (this.heatWaveTimer <= 0) {
        this.heatWindup = 0.8;
        this.heatWaveTimer = 4.2;
        this.statusText = '🔥 CALENTANDO ONDA DE CALOR...';
      }
    }

    // Charcos de lava con aviso.
    if (this.activeCombat) {
      this.lavaTimer -= dt;
      if (this.lavaTimer <= 0) {
        this.lavaTimer = 3.4;
        this._spawnLavaWarning();
      }
    }

    // Actualizar warnings de lava.
    for (let i = this.lavaWarnings.length - 1; i >= 0; i--) {
      const w = this.lavaWarnings[i];
      w.timer -= dt;
      if (w.timer <= 0) {
        this.hazardPuddles.push({
          x: w.x,
          y: w.y,
          radius: w.radius,
          life: 6.0,
          color: 'rgba(249, 115, 22, 0.42)',
          borderColor: '#f97316'
        });
        this.lavaWarnings.splice(i, 1);
      }
    }

    // Expansión y daño de las ondas de calor.
    for (let i = this.heatWaves.length - 1; i >= 0; i--) {
      const wave = this.heatWaves[i];
      wave.radius += wave.speed * dt;
      if (player && !wave.hasHit) {
        const dist = Math.hypot(player.centerX - wave.x, player.centerY - wave.y);
        if (Math.abs(dist - wave.radius) <= 9 && player.invulnTimer <= 0 && player.dashTimer <= 0) {
          wave.hasHit = true;
          player.takeHit(soundEngine, this);
        }
      }
      if (wave.radius >= wave.maxRadius) this.heatWaves.splice(i, 1);
    }

    this._updateSparks(dt);
    return { hitPlayer: false };
  }

  _massiveOverheat(player, soundEngine) {
    this.statusText = '☢️ ¡SOBRECALENTAMIENTO MASIVO!';
    if (player) {
      player.takeHit(soundEngine, this, 2.0);
    }
    for (let i = 0; i < 18; i++) {
      this.sparks.push({
        x: this.centerX + (Math.random() - 0.5) * 28,
        y: this.centerY,
        vx: (Math.random() - 0.5) * 120,
        vy: -40 - Math.random() * 80,
        life: 0.7 + Math.random() * 0.5
      });
    }
  }

  _updateSparks(dt) {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 130 * dt;
      s.life -= dt;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }
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

    // Ondas de calor.
    for (const wave of this.heatWaves) {
      const wx = wave.x - camera.renderX;
      const wy = wave.y - camera.renderY;
      ctx.strokeStyle = wave.color;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(wx, wy, wave.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(wx, wy, wave.radius - 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Avisos de lava.
    for (const w of this.lavaWarnings) {
      const wx = w.x - camera.renderX;
      const wy = w.y - camera.renderY;
      const p = 1 - Math.max(0, w.timer / w.duration);
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(wx, wy, w.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(249, 115, 22, ${0.12 + p * 0.25})`;
      ctx.beginPath();
      ctx.arc(wx, wy, w.radius * p, 0, Math.PI * 2);
      ctx.fill();
    }

    // Windup de onda de calor.
    if (this.heatWindup > 0) {
      ctx.strokeStyle = Math.floor(now * 14) % 2 === 0 ? '#f97316' : '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 20 + Math.sin(now * 12) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Aura de sobrecalentamiento en los últimos 2 s de los fusibles.
    if (this.phase2 && this.fusePhaseActive && this.fuseTimer <= 2.0) {
      ctx.strokeStyle = Math.floor(now * 16) % 2 === 0 ? '#ef4444' : '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 22 + Math.sin(now * 16) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Patas de araña mecánicas.
    ctx.strokeStyle = '#334155';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const side = i < 2 ? -1 : 1;
      const legY = cy - 8 + (i % 2) * 16;
      const kneeX = cx + side * 22;
      const kneeY = legY - 8 + Math.sin(now * 3 + i) * 2;
      const footX = cx + side * 32;
      const footY = legY + 10;
      ctx.beginPath();
      ctx.moveTo(cx + side * 12, legY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.stroke();
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(kneeX, kneeY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Carcasa oxidada.
    ctx.fillStyle = this.hitFlashTimer > 0 ? '#f8fafc' : '#1e293b';
    ctx.fillRect(cx - 14, cy - 12, 28, 24);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(cx - 14, cy - 12, 28, 24);
    // Óxido
    ctx.fillStyle = '#92400e';
    ctx.fillRect(cx - 12, cy - 10, 4, 2);
    ctx.fillRect(cx + 8, cy + 6, 3, 2);
    ctx.fillRect(cx - 5, cy + 9, 2, 1);
    ctx.fillRect(cx + 3, cy - 9, 2, 1);

    // Puerta/ventana: roja brillante, abierta en aturdimiento.
    ctx.fillStyle = this.doorOpen ? '#fef08a' : '#7f1d1d';
    ctx.fillRect(cx - 10, cy - 8, 16, 16);
    if (this.doorOpen) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx - 9, cy - 7, 14, 5);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OPEN', cx - 2, cy + 3);
    } else {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 9.5, cy - 7.5, 15, 15);
    }

    // LED y plato.
    ctx.fillStyle = '#1c050b';
    ctx.fillRect(cx + 7, cy - 8, 5, 4);
    ctx.fillStyle = this.fusePhaseActive && this.fuseTimer <= 2 ? '#ef4444' : '#f97316';
    ctx.font = '4px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.fusePhaseActive ? String(Math.max(0, Math.ceil(this.fuseTimer))) : '99', cx + 9.5, cy - 5);

    // Fusibles de esquina.
    for (const f of this.fuses) {
      if (!f.active) continue;
      const fx = f.x - camera.renderX;
      const fy = f.y - camera.renderY;
      ctx.fillStyle = f.hit ? '#334155' : '#f59e0b';
      ctx.fillRect(fx - 6, fy - 6, 12, 12);
      ctx.strokeStyle = f.hit ? '#64748b' : '#fde047';
      ctx.lineWidth = 1;
      ctx.strokeRect(fx - 6, fy - 6, 12, 12);
      ctx.font = '5px monospace';
      ctx.fillStyle = f.hit ? '#94a3b8' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(f.hit ? 'OFF' : 'FUSE', fx, fy + 2);
    }

    // Chispas.
    for (const s of this.sparks) {
      ctx.fillStyle = s.life > 0.3 ? '#fde047' : '#f97316';
      ctx.fillRect(s.x - camera.renderX, s.y - camera.renderY, 1.5, 1.5);
    }

    if (this.stunnedTimer > 0) {
      ctx.font = '7px monospace';
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'center';
      ctx.fillText('💫 ⚡ 💫', cx, cy - 18 + Math.sin(now * 8) * 3);
    }

    ctx.restore();
  }
}
