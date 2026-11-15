/**
 * TechnicalDebtBoss.js · Expansión "El Resurgir de Mister Alex IA" (Jefa Secreta).
 * HP: 300 · Escena: ai_nucleus_core (solo tras créditos si Currículums >= 20 y Final B o C).
 *
 * Boss Rush de 4 Fases:
 *  - Fase 1 (300 - 250 HP): Clon del Garbage Collector (50 HP)
 *  - Fase 2 (250 - 200 HP): Clon del Stack Overflow (50 HP)
 *  - Fase 3 (200 - 150 HP): Clon del Kernel (50 HP)
 *  - Fase 4 (150 - 0 HP):   La Deuda Técnica (150 HP) — maraña de cables y errores,
 *                           glitches visuales de pantalla y borrado de partes de la arena.
 *
 * Al morir: "Esto... no... era... un... bug..." y desbloquea trofeo "Completionista".
 */
import { Boss } from '../../entities/bosses/Boss.js?v=8';
import { CollisionSystem } from '../../physics/CollisionSystem.js?v=8';

export const TECH_DEBT_DEATH_QUOTE = 'Esto... no... era... un... bug...';

export const TECH_DEBT_PHASES = {
  1: { name: 'FASE 1 · CLON GARBAGE COLLECTOR', label: 'Clon Garbage Collector', color: '#4ade80' },
  2: { name: 'FASE 2 · CLON STACK OVERFLOW', label: 'Clon Stack Overflow', color: '#fb923c' },
  3: { name: 'FASE 3 · CLON DEL KERNEL', label: 'Clon del Kernel', color: '#22c55e' },
  4: { name: 'FASE 4 · LA DEUDA TÉCNICA', label: 'La Deuda Técnica', color: '#f43f5e' }
};

function rectsOverlap(a, b) {
  return Boolean(
    a && b &&
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export class TechnicalDebtBoss extends Boss {
  constructor({ x = 6.2 * 16, y = 2.6 * 16, sceneId = 'ai_nucleus_core', hp = 300 } = {}) {
    super({
      id: 'boss_technical_debt',
      name: 'La Deuda Técnica',
      title: 'Amalgama del Código Legacy · Jefe Secreto',
      x,
      y,
      width: 30,
      height: 30,
      hp,
      speed: 28,
      sceneId,
      trackName: 'boss_alex_final',
      rewardAbility: null,
      rewardName: 'Trofeo Completionista',
      themeColor: '#f43f5e',
      requiresIntroCutscene: false
    });

    this.baseX = x;
    this.baseY = y;
    this.combatTriggerDistance = 280;
    this.phase = 1;
    this.time = 0;

    // Empieza latente hasta activarse tras créditos (si se cumplen las condiciones)
    this.dormant = true;
    this.dead = true;
    this.xpGranted = true;
    this.questCompletedTriggered = true;

    this.attackTimer = 1.0;
    this.glitchTimer = 0;
    this.glitchCooldown = 1.8;
    this.eraseTimer = 1.4;
    this.erasedTiles = [];
    this.lasers = [];
    this.voidTickTimer = 0;
    this.dialogueLine = '';
    this.dialogueTimer = 0;
  }

  get glitchActive() {
    return this.glitchTimer > 0 && !this.dead && !this.dormant;
  }

  get phaseLabel() {
    return TECH_DEBT_PHASES[this.phase]?.name || 'DEUDA TÉCNICA';
  }

  getPhaseForHp(hp = this.hp) {
    if (hp > 250) return 1;
    if (hp > 200) return 2;
    if (hp > 150) return 3;
    return 4;
  }

  activateSecretBoss() {
    this.dormant = false;
    this.dead = false;
    this.defeated = false;
    this.xpGranted = false;
    this.questCompletedTriggered = false;
    this.hp = this.maxHp;
    this.x = this.baseX;
    this.y = this.baseY;
    this.phase = 1;
    this.activeCombat = true;
    this.projectiles = [];
    this.erasedTiles = [];
    this.lasers = [];
    this.glitchTimer = 1.2;
    this.dialogueLine = 'CRITICAL ERROR: Toda deuda técnica olvidada reclama su interés.';
    this.dialogueTimer = 3.8;
  }

  takeSwordHit(player, soundEngine, customDamage) {
    if (this.dormant || this.dead) return false;
    const dealt = super.takeSwordHit(player, soundEngine, customDamage);
    if (dealt) {
      this._syncPhase();
    }
    return dealt;
  }

  _syncPhase() {
    const next = this.getPhaseForHp(this.hp);
    if (next === this.phase) return;
    this.phase = next;
    const info = TECH_DEBT_PHASES[next];
    this.dialogueLine = `${info.label} ha tomado el control.`;
    this.dialogueTimer = 3.0;
    this.hitFlashTimer = 0.25;
    this.lasers = [];
    if (next < 4) {
      this.erasedTiles = [];
    } else {
      this.speed = 24;
      this.glitchTimer = 1.5;
      this.dialogueLine = '¡SOY LA DEUDA TÉCNICA! Todo parche temporal me alimentó.';
    }
  }

  triggerBossDefeat(player, soundEngine) {
    if (this.dead) return;
    this.dialogueLine = TECH_DEBT_DEATH_QUOTE;
    this.dialogueTimer = 4.2;
    this.projectiles = [];
    this.erasedTiles = [];
    this.lasers = [];
    this.glitchTimer = 0;
    super.triggerBossDefeat(player, soundEngine);
  }

  update(dt, tilemap, player, paused, soundEngine) {
    if (this.dormant) return;
    if (paused) return;
    if (this.dead) {
      this.deathTimer += dt;
      return;
    }

    this.time += dt;
    if (this.dialogueTimer > 0) this.dialogueTimer = Math.max(0, this.dialogueTimer - dt);
    if (this.glitchTimer > 0) this.glitchTimer = Math.max(0, this.glitchTimer - dt);
    if (this.voidTickTimer > 0) this.voidTickTimer = Math.max(0, this.voidTickTimer - dt);

    if (!this.activeCombat) {
      this.activeCombat = true;
    }

    this._syncPhase();

    // Movimiento alrededor del núcleo
    const tx = this.baseX + Math.sin(this.time * 1.8) * 52;
    const ty = this.baseY + Math.cos(this.time * 1.4) * 18;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const mag = Math.hypot(dx, dy) || 1;
    if (mag > 2) {
      CollisionSystem.moveWithCollisions(this, (dx / mag) * this.speed * dt, (dy / mag) * this.speed * dt, tilemap, { ignoreCorners: true });
    }

    this._runPhaseAttack(dt, tilemap, player, soundEngine);
    this._updateErasedTiles(dt, player, soundEngine);
    this._updateLasers(dt, player, soundEngine);

    // Reutiliza Boss.update para colisión de espada y proyectiles estándar
    super.update(dt, tilemap, player, paused, soundEngine);
    this._syncPhase();
  }

  _runPhaseAttack(dt, tilemap, player, soundEngine) {
    this.attackTimer -= dt;
    if (this.phase === 1 && this.attackTimer <= 0) {
      // Clon Garbage Collector: bloques de basura de memoria
      this.attackTimer = 1.2;
      const base = Math.atan2(player.centerY - this.centerY, player.centerX - this.centerX);
      for (const off of [-0.3, 0, 0.3]) {
        this.projectiles.push({
          x: this.centerX,
          y: this.centerY,
          vx: Math.cos(base + off) * 86,
          vy: Math.sin(base + off) * 86,
          radius: 4,
          life: 3.4,
          damage: 1,
          color: '#4ade80'
        });
      }
      soundEngine?.playEnemyAttack?.();
    } else if (this.phase === 2 && this.attackTimer <= 0) {
      // Clon Stack Overflow: anillo recursivo de 8 marcos de pila
      this.attackTimer = 1.35;
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI * 2 * i) / 8 + this.time;
        this.projectiles.push({
          x: this.centerX,
          y: this.centerY,
          vx: Math.cos(ang) * 92,
          vy: Math.sin(ang) * 92,
          radius: 4,
          life: 3.0,
          damage: 1,
          color: '#fb923c'
        });
      }
      soundEngine?.playEnemyAttack?.();
    } else if (this.phase === 3 && this.attackTimer <= 0) {
      // Clon del Kernel: BSOD + láser firewall
      this.attackTimer = 1.4;
      this.lasers.push({
        orientation: Math.random() > 0.5 ? 'horizontal' : 'vertical',
        pos: Math.random() > 0.5 ? player.centerY : player.centerX,
        telegraphTimer: 0.7,
        activeTimer: 0.45,
        hitApplied: false,
        color: '#22c55e'
      });
      soundEngine?.playErrorBuzz?.();
    } else if (this.phase === 4) {
      // Fase 4: La Deuda Técnica — glitches visuales, proyectiles corruptos y borrado de arena
      if (this.attackTimer <= 0) {
        this.attackTimer = 1.15;
        const base = Math.atan2(player.centerY - this.centerY, player.centerX - this.centerX);
        for (const off of [-0.4, -0.13, 0.13, 0.4]) {
          this.projectiles.push({
            x: this.centerX,
            y: this.centerY,
            vx: Math.cos(base + off) * 98,
            vy: Math.sin(base + off) * 98,
            radius: 4,
            life: 3.6,
            damage: 1,
            color: '#f43f5e'
          });
        }
      }

      this.glitchCooldown -= dt;
      if (this.glitchCooldown <= 0) {
        this.glitchCooldown = 3.2;
        this.glitchTimer = 1.1;
        soundEngine?.playErrorBuzz?.();
      }

      this.eraseTimer -= dt;
      if (this.eraseTimer <= 0) {
        this.eraseTimer = 1.8;
        this.eraseArenaPatch(tilemap, player);
      }
    }
  }

  eraseArenaPatch(tilemap, player) {
    const ts = tilemap?.tileSize || 16;
    const cols = tilemap?.cols || 14;
    const rows = tilemap?.rows || 12;
    const col = Math.max(2, Math.min(cols - 3, Math.round(player.centerX / ts)));
    const row = Math.max(2, Math.min(rows - 3, Math.round(player.centerY / ts)));
    this.erasedTiles.push({
      col,
      row,
      x: col * ts,
      y: row * ts,
      width: ts * 2,
      height: ts * 2,
      chargeTimer: 0.85,
      activeTimer: 4.5
    });
    if (this.erasedTiles.length > 5) this.erasedTiles.shift();
  }

  _updateErasedTiles(dt, player, soundEngine) {
    for (let i = this.erasedTiles.length - 1; i >= 0; i--) {
      const tile = this.erasedTiles[i];
      if (tile.chargeTimer > 0) {
        tile.chargeTimer -= dt;
        continue;
      }
      tile.activeTimer -= dt;
      if (tile.activeTimer <= 0) {
        this.erasedTiles.splice(i, 1);
        continue;
      }
      if (this.voidTickTimer <= 0 && rectsOverlap(player.worldBoundingBox, tile)) {
        this.voidTickTimer = 0.85;
        player.takeHit(soundEngine, this, 1);
      }
    }
  }

  _updateLasers(dt, player, soundEngine) {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      if (l.telegraphTimer > 0) {
        l.telegraphTimer -= dt;
        continue;
      }
      l.activeTimer -= dt;
      if (!l.hitApplied) {
        const hit = l.orientation === 'horizontal'
          ? Math.abs(player.centerY - l.pos) <= 9
          : Math.abs(player.centerX - l.pos) <= 9;
        if (hit) {
          l.hitApplied = true;
          player.takeHit(soundEngine, this, 1);
        }
      }
      if (l.activeTimer <= 0) this.lasers.splice(i, 1);
    }
  }

  render(ctx, camera) {
    if (this.dormant || this.dead) return;
    const ox = -Math.round(camera.x);
    const oy = -Math.round(camera.y);
    const ts = 16;

    // 1. Zonas borradas de la arena (Fase 4)
    for (const tile of this.erasedTiles) {
      const tx = Math.round(tile.x + ox);
      const ty = Math.round(tile.y + oy);
      ctx.save();
      if (tile.chargeTimer > 0) {
        ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
        ctx.fillRect(tx, ty, tile.width, tile.height);
        ctx.strokeStyle = '#fb7185';
        ctx.strokeRect(tx, ty, tile.width, tile.height);
      } else {
        ctx.fillStyle = '#020205';
        ctx.fillRect(tx, ty, tile.width, tile.height);
        ctx.strokeStyle = '#f43f5e';
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(tx, ty, tile.width, tile.height);
        ctx.fillStyle = '#fda4af';
        ctx.font = 'bold 5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NULL', tx + tile.width * 0.5, ty + tile.height * 0.55);
      }
      ctx.restore();
    }

    // 2. Láseres de Fase 3
    for (const l of this.lasers) {
      ctx.save();
      ctx.fillStyle = l.telegraphTimer > 0 ? 'rgba(34, 197, 94, 0.35)' : l.color;
      if (l.orientation === 'horizontal') {
        ctx.fillRect(ox, Math.round(l.pos - 5 + oy), 14 * ts, 10);
      } else {
        ctx.fillRect(Math.round(l.pos - 5 + ox), oy, 10, 12 * ts);
      }
      ctx.restore();
    }

    // 3. Cuerpo según Clon o Deuda Técnica
    const sx = Math.round(this.x + ox);
    const sy = Math.round(this.y + oy + Math.sin(this.time * 5) * 2);
    const info = TECH_DEBT_PHASES[this.phase];
    const flash = this.hitFlashTimer > 0;

    ctx.save();
    if (this.phase < 4) {
      // Clon holográfico oscuro del boss correspondiente
      ctx.fillStyle = flash ? '#ffffff' : '#0f172a';
      ctx.fillRect(sx + 2, sy + 2, this.width - 4, this.height - 4);
      ctx.strokeStyle = info.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 2, sy + 2, this.width - 4, this.height - 4);
      ctx.fillStyle = info.color;
      ctx.fillRect(sx + 7, sy + 9, 4, 4);
      ctx.fillRect(sx + 17, sy + 9, 4, 4);
    } else {
      // Maraña de cables y nodos de error (La Deuda Técnica)
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.moveTo(sx + 15, sy + 15);
        ctx.lineTo(sx + 15 + Math.cos(this.time * 3 + k) * 18, sy + 15 + Math.sin(this.time * 4 + k) * 16);
        ctx.stroke();
      }
      ctx.fillStyle = flash ? '#ffffff' : '#18181b';
      ctx.fillRect(sx + 2, sy + 2, this.width - 4, this.height - 4);
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx + 2, sy + 2, this.width - 4, this.height - 4);
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TODO:', sx + 15, sy + 12);
      ctx.fillStyle = '#f43f5e';
      ctx.fillText('FIXME', sx + 15, sy + 21);
    }

    // 4. Proyectiles
    for (const p of this.projectiles) {
      ctx.fillStyle = p.color || '#f43f5e';
      ctx.fillRect(Math.round(p.x + ox) - 3, Math.round(p.y + oy) - 3, 6, 6);
    }

    // 5. Etiqueta de fase
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = info.color;
    ctx.fillText(this.phaseLabel, sx + 15, sy - 6);
    if (this.dialogueTimer > 0 && this.dialogueLine) {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
      ctx.fillRect(sx - 56, sy - 22, 142, 12);
      ctx.fillStyle = '#fda4af';
      ctx.font = '6px monospace';
      ctx.fillText(this.dialogueLine.slice(0, 44), sx + 15, sy - 14);
    }
    ctx.restore();
  }
}
