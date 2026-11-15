/**
 * KernelBoss.js · Expansión "El Resurgir de Mister Alex IA" (v2.0).
 * Jefe del Acto 2: El Kernel (Núcleo de Seguridad del Sistema). HP: 150.
 *
 * - Fase 1 (100% - 66% HP) "Protocolo de Seguridad":
 *     Frase inicial "Identificación no reconocida. Iniciando purga.", oculta el HUD
 *     durante 10 segundos (hudHackActive) con error_buzz y lanza Pantallazos Azules (BSOD).
 * - Fase 2 (66% - 33% HP) "Procesos Hijos":
 *     El HUD vuelve parpadeando de forma inestable. Se divide en 4 clones; solo 1 es real
 *     (brillo verde distinto). Atacar un clon falso lo hace explotar causando daño en área.
 * - Fase 3 (33% - 0% HP) "Acceso Denegado":
 *     Se vuelve gigante (torre de terminales) y desata lluvia de láseres verticales
 *     y horizontales (firewalls).
 * - Al morir: dice "Esto... no... era... mi... trabajo..." y otorga la "Llave de Acceso al Núcleo".
 */
import { Boss } from '../../entities/bosses/Boss.js?v=8';
import { CollisionSystem } from '../../physics/CollisionSystem.js?v=8';

export const KERNEL_INTRO_QUOTE = 'Identificación no reconocida. Iniciando purga.';
export const KERNEL_DEATH_QUOTE = 'Esto... no... era... mi... trabajo...';

const PHASE_NAMES = {
  1: 'FASE 1 · PROTOCOLO DE SEGURIDAD',
  2: 'FASE 2 · PROCESOS HIJOS',
  3: 'FASE 3 · ACCESO DENEGADO'
};

export class KernelBoss extends Boss {
  constructor({ x = 5.5 * 16, y = 3.2 * 16, sceneId = 'kernel_arena', hp = 150 } = {}) {
    super({
      id: 'boss_kernel',
      name: 'El Kernel',
      title: 'Protocolo del Sistema · Acto 2',
      x,
      y,
      width: 26,
      height: 30,
      hp,
      speed: 44,
      sceneId,
      trackName: 'boss_final',
      rewardAbility: null,
      rewardName: 'Llave de Acceso al Núcleo',
      themeColor: '#22c55e',
      requiresIntroCutscene: false
    });

    this.maxHp = hp;
    this.hp = hp;
    this.combatTriggerDistance = 220;
    this.boundingBox = { offsetX: 3, offsetY: 6, width: 20, height: 22 };

    this.phase = 1;
    this.lastPhase = 1;
    this.animTimer = 0;

    // Fase 1: Hackeo de HUD + Pantallazos Azules
    this.hudHackTriggered = false;
    this.hudHackTimer = 0;
    this.hudHackActive = false;
    this.hudFlicker = false;
    this.bsodShotTimer = 1.25;
    this.bsodOverlayTimer = 0;

    // Fase 2: 4 Clones (Procesos Hijos)
    this.clones = [];
    this.cloneExplosions = [];
    this.cloneReshuffleTimer = 0;
    this.cloneHitLockTimer = 0;

    // Fase 3: Torre gigante + Firewalls verticales/horizontales
    this.firewalls = [];
    this.firewallTimer = 1.1;
    this.firewallToggle = 0;

    this.introQuote = '';
    this.introQuoteTimer = 0;
    this.deathQuote = '';
    this.phaseBanner = 0;
    this.shots = this.projectiles;
  }

  resetCombatState() {
    super.resetCombatState();
    this.width = 26;
    this.height = 30;
    this.boundingBox = { offsetX: 3, offsetY: 6, width: 20, height: 22 };
    this.phase = 1;
    this.lastPhase = 1;
    this.hudHackTriggered = false;
    this.hudHackTimer = 0;
    this.hudHackActive = false;
    this.hudFlicker = false;
    this.bsodShotTimer = 1.25;
    this.bsodOverlayTimer = 0;
    this.clones = [];
    this.cloneExplosions = [];
    this.cloneHitLockTimer = 0;
    this.firewalls = [];
    this.firewallTimer = 1.1;
    this.introQuote = '';
    this.introQuoteTimer = 0;
    this.deathQuote = '';
    this.phaseBanner = 0;
    this.shots = this.projectiles;
  }

  /**
   * Activa el protocolo de seguridad inicial: frase de purga y hackeo del HUD por 10 s.
   */
  startSecurityProtocol(soundEngine = null) {
    if (this.dead || this.hudHackTriggered) return;
    this.hudHackTriggered = true;
    this.activeCombat = true;
    this.hudHackTimer = 10.0;
    this.hudHackActive = true;
    this.hudFlicker = false;
    this.introQuote = KERNEL_INTRO_QUOTE;
    this.introQuoteTimer = 3.6;
    this.phaseBanner = 2.6;
    if (soundEngine && typeof soundEngine.playSFX === 'function') {
      soundEngine.playSFX('error_buzz');
    } else if (soundEngine && typeof soundEngine.playError === 'function') {
      soundEngine.playError();
    }
  }

  _setPhase(next, soundEngine = null) {
    if (next === this.phase) return;
    this.phase = next;
    this.phaseBanner = 2.6;

    if (next === 2) {
      this._enterPhase2(soundEngine);
    } else if (next === 3) {
      this._enterPhase3(soundEngine);
    }
  }

  _enterPhase2(soundEngine = null) {
    this.hudHackTimer = 0;
    this.hudHackActive = false;
    this.hudFlicker = true;
    this.width = 20;
    this.height = 24;
    this.boundingBox = { offsetX: 2, offsetY: 4, width: 16, height: 18 };
    this.spawnClones(Math.floor(Math.random() * 4));
    this.introQuote = 'fork(): 4 procesos hijos activos.';
    this.introQuoteTimer = 2.6;
    if (soundEngine && typeof soundEngine.playSFX === 'function') {
      soundEngine.playSFX('ui_glitch');
    }
  }

  /**
   * Divide al Kernel en 4 clones donde exactamente 1 es real (con aura verde).
   */
  spawnClones(realIndex = 0) {
    const slots = [
      { x: 2.5 * 16, y: 2.5 * 16 },
      { x: 8.5 * 16, y: 2.5 * 16 },
      { x: 2.5 * 16, y: 6.2 * 16 },
      { x: 8.5 * 16, y: 6.2 * 16 }
    ];
    const safeReal = ((realIndex % 4) + 4) % 4;
    this.clones = slots.map((pos, idx) => ({
      id: `kernel_clone_${idx}`,
      x: pos.x,
      y: pos.y,
      width: 18,
      height: 22,
      isReal: idx === safeReal,
      exploded: false,
      respawnTimer: 0,
      phaseOffset: idx * 1.4
    }));
    const realClone = this.clones[safeReal];
    if (realClone) {
      this.x = realClone.x;
      this.y = realClone.y;
    }
  }

  _enterPhase3(soundEngine = null) {
    this.clones = [];
    this.hudHackTimer = 0;
    this.hudHackActive = false;
    this.hudFlicker = false;
    // Torre gigante de terminales centrada arriba en la arena 12x10 (192x160)
    this.width = 36;
    this.height = 44;
    this.x = 6 * 16 - 18;
    this.y = 2.1 * 16;
    this.boundingBox = { offsetX: 4, offsetY: 8, width: 28, height: 32 };
    this.firewallTimer = 0.8;
    this.introQuote = 'ACCESO DENEGADO. ACTIVANDO FIREWALLS.';
    this.introQuoteTimer = 2.8;
    if (soundEngine && typeof soundEngine.playSFX === 'function') {
      soundEngine.playSFX('error_buzz');
    }
  }

  _shootBlueScreen(player, soundEngine = null) {
    const px = player ? (player.centerX ?? player.x) : this.centerX;
    const py = player ? (player.centerY ?? player.y) : this.centerY + 48;
    const baseAngle = Math.atan2(py - this.centerY, px - this.centerX);
    const angles = [baseAngle - 0.22, baseAngle, baseAngle + 0.22];
    for (const ang of angles) {
      this.projectiles.push({
        kind: 'bsod',
        x: this.centerX,
        y: this.centerY,
        vx: Math.cos(ang) * 96,
        vy: Math.sin(ang) * 96,
        width: 14,
        height: 10,
        radius: 6,
        color: '#1d4ed8',
        life: 2.8
      });
    }
    this.bsodOverlayTimer = 0.5;
    if (soundEngine && typeof soundEngine.playSFX === 'function') {
      soundEngine.playSFX('ui_glitch');
    }
  }

  _explodeFakeClone(clone, player, soundEngine = null) {
    clone.exploded = true;
    clone.respawnTimer = 1.6;
    const cx = clone.x + clone.width / 2;
    const cy = clone.y + clone.height / 2;
    this.cloneExplosions.push({ x: cx, y: cy, radius: 30, life: 0.42, maxLife: 0.42 });
    if (soundEngine && typeof soundEngine.playSFX === 'function') {
      soundEngine.playSFX('error_buzz');
    }
    if (player && Math.hypot((player.centerX ?? player.x) - cx, (player.centerY ?? player.y) - cy) <= 32) {
      if (typeof player.takeHit === 'function') {
        player.takeHit(soundEngine, this, 1);
      }
    }
  }

  _updatePhase2(dt, player, soundEngine) {
    if (this.cloneHitLockTimer > 0) {
      this.cloneHitLockTimer = Math.max(0, this.cloneHitLockTimer - dt);
    }

    // Mover suavemente los clones en pequeñas órbitas para mantener dinamismo sin atravesar muros
    for (const clone of this.clones) {
      if (clone.exploded) {
        clone.respawnTimer -= dt;
        if (clone.respawnTimer <= 0) {
          clone.exploded = false;
        }
        continue;
      }
      if (clone.isReal) {
        this.x = clone.x;
        this.y = clone.y;
      }
    }

    // Comprobar si el jugador golpea algún clon falso
    if (player && this.cloneHitLockTimer <= 0) {
      const swordBox = typeof player.getSwordHitbox === 'function' ? player.getSwordHitbox() : null;
      const spinBox = typeof player.getSpinHitbox === 'function' ? player.getSpinHitbox() : null;
      for (const clone of this.clones) {
        if (clone.isReal || clone.exploded) continue;
        const cloneBox = { x: clone.x, y: clone.y, width: clone.width, height: clone.height };
        const cx = clone.x + clone.width / 2;
        const cy = clone.y + clone.height / 2;
        let hitFake = false;

        if (swordBox && CollisionSystem.checkAABB(swordBox, cloneBox)) {
          hitFake = true;
        } else if (spinBox && Math.hypot(cx - spinBox.centerX, cy - spinBox.centerY) <= spinBox.radius + 9) {
          hitFake = true;
        } else if (Array.isArray(player.energySlashes)) {
          for (const slash of player.energySlashes) {
            if (slash.life > 0 && Math.hypot(cx - slash.x, cy - slash.y) <= 12) {
              slash.life = 0;
              hitFake = true;
              break;
            }
          }
        }

        if (hitFake) {
          this.cloneHitLockTimer = 0.35;
          this._explodeFakeClone(clone, player, soundEngine);
          break;
        }
      }
    }

    for (let i = this.cloneExplosions.length - 1; i >= 0; i--) {
      this.cloneExplosions[i].life -= dt;
      if (this.cloneExplosions[i].life <= 0) {
        this.cloneExplosions.splice(i, 1);
      }
    }
  }

  _spawnFirewall(player) {
    this.firewallToggle = (this.firewallToggle + 1) % 3;
    const arenaW = 12 * 16;
    const arenaH = 10 * 16;
    const px = player ? Math.max(24, Math.min(arenaW - 24, player.centerX ?? player.x)) : arenaW / 2;
    const py = player ? Math.max(28, Math.min(arenaH - 24, player.centerY ?? player.y)) : arenaH / 2;

    if (this.firewallToggle === 0) {
      this.firewalls.push({ axis: 'h', pos: py, thickness: 10, warnTimer: 0.7, activeTimer: 0.65 });
    } else if (this.firewallToggle === 1) {
      this.firewalls.push({ axis: 'v', pos: px, thickness: 10, warnTimer: 0.7, activeTimer: 0.65 });
    } else {
      // Cruz de firewalls (vertical + horizontal)
      this.firewalls.push(
        { axis: 'h', pos: py, thickness: 9, warnTimer: 0.78, activeTimer: 0.6 },
        { axis: 'v', pos: px, thickness: 9, warnTimer: 0.78, activeTimer: 0.6 }
      );
    }
  }

  _updatePhase3(dt, player, soundEngine) {
    this.firewallTimer -= dt;
    if (this.firewallTimer <= 0) {
      this._spawnFirewall(player);
      this.firewallTimer = 1.45;
    }

    for (let i = this.firewalls.length - 1; i >= 0; i--) {
      const fw = this.firewalls[i];
      if (fw.warnTimer > 0) {
        fw.warnTimer = Math.max(0, fw.warnTimer - dt);
        continue;
      }
      fw.activeTimer -= dt;
      if (player && !player.barrierActive && fw.activeTimer > 0) {
        const px = player.centerX ?? player.x;
        const py = player.centerY ?? player.y;
        const hit = fw.axis === 'h'
          ? Math.abs(py - fw.pos) <= fw.thickness * 0.5 + 4
          : Math.abs(px - fw.pos) <= fw.thickness * 0.5 + 4;
        if (hit && typeof player.takeHit === 'function') {
          player.takeHit(soundEngine, this, 1);
        }
      }
      if (fw.activeTimer <= 0) {
        this.firewalls.splice(i, 1);
      }
    }
  }

  update(dt, tilemap, player = null, paused = false, soundEngine = null, ai = null) {
    if (paused) return { hitPlayer: false };

    this.animTimer += dt;
    if (this.phaseBanner > 0) this.phaseBanner = Math.max(0, this.phaseBanner - dt);
    if (this.introQuoteTimer > 0) this.introQuoteTimer = Math.max(0, this.introQuoteTimer - dt);
    if (this.bsodOverlayTimer > 0) this.bsodOverlayTimer = Math.max(0, this.bsodOverlayTimer - dt);

    const wasActive = this.activeCombat;
    const dist = player ? this.distanceTo(player) : Infinity;
    if (!this.dead && !wasActive && player && dist <= this.combatTriggerDistance) {
      this.startSecurityProtocol(soundEngine);
    }

    if (!this.dead && this.activeCombat) {
      const pct = this.hp / Math.max(1, this.maxHp);
      const next = pct > 0.66 ? 1 : (pct > 0.33 ? 2 : 3);
      if (next !== this.lastPhase) {
        this.lastPhase = next;
        this._setPhase(next, soundEngine);
      }

      if (this.phase === 1) {
        if (this.hudHackTimer > 0) {
          this.hudHackTimer = Math.max(0, this.hudHackTimer - dt);
        }
        this.hudHackActive = this.hudHackTimer > 0;
        this.hudFlicker = false;

        this.bsodShotTimer -= dt;
        if (this.bsodShotTimer <= 0) {
          this._shootBlueScreen(player, soundEngine);
          this.bsodShotTimer = 1.55;
        }
      } else if (this.phase === 2) {
        this.hudHackActive = false;
        this.hudFlicker = true;
        this._updatePhase2(dt, player, soundEngine);
      } else if (this.phase === 3) {
        this.hudHackActive = false;
        this.hudFlicker = false;
        this._updatePhase3(dt, player, soundEngine);
      }
    } else if (this.dead) {
      this.hudHackActive = false;
      this.hudFlicker = false;
    }

    const result = super.update(dt, tilemap, player, paused, soundEngine, ai);
    this.shots = this.projectiles;
    return result;
  }

  takeSwordHit(player, soundEngine = null, customDamage = null) {
    if (this.dead) return false;
    if (this.phase === 2) {
      // Asegurar que la posición del Kernel coincide con el clon real al evaluar impacto
      const realClone = this.clones.find((c) => c.isReal);
      if (realClone) {
        this.x = realClone.x;
        this.y = realClone.y;
      }
    }
    return super.takeSwordHit(player, soundEngine, customDamage);
  }

  triggerBossDefeat(player, soundEngine = null) {
    this.deathQuote = KERNEL_DEATH_QUOTE;
    this.hudHackTimer = 0;
    this.hudHackActive = false;
    this.hudFlicker = false;
    this.bsodOverlayTimer = 0;
    this.clones = [];
    this.firewalls = [];
    return super.triggerBossDefeat(player, soundEngine);
  }

  _drawKernelNode(ctx, rx, ry, w, h, { isReal = true, isGiant = false, flash = false, t = 0 } = {}) {
    ctx.save();
    // Aura luminosa: verde neón en el clon real o fase normal, rojo/naranja en clones falsos o torre gigante
    const auraColor = isGiant
      ? 'rgba(239, 68, 68, 0.34)'
      : isReal
        ? 'rgba(34, 197, 94, 0.36)'
        : 'rgba(248, 113, 113, 0.25)';
    ctx.fillStyle = auraColor;
    ctx.beginPath();
    ctx.ellipse(rx + w / 2, ry + h / 2, w * 0.72, h * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    // Chasis del servidor/terminal
    ctx.fillStyle = flash ? '#ffffff' : '#0f172a';
    ctx.fillRect(rx, ry, w, h);
    ctx.strokeStyle = isGiant ? '#ef4444' : (isReal ? '#22c55e' : '#f43f5e');
    ctx.lineWidth = isReal ? 1.5 : 1;
    ctx.strokeRect(rx + 0.5, ry + 0.5, w - 1, h - 1);

    // Pantalla central
    const scrX = rx + 3;
    const scrY = ry + 3;
    const scrW = w - 6;
    const scrH = Math.max(8, Math.floor(h * 0.45));
    ctx.fillStyle = isGiant ? '#450a0a' : (isReal ? '#052e16' : '#3b0764');
    ctx.fillRect(scrX, scrY, scrW, scrH);

    // Brillo verde distintivo en el clon real
    if (isReal && !isGiant) {
      const pulse = 0.65 + 0.35 * Math.sin(t * 9);
      ctx.strokeStyle = `rgba(74, 222, 128, ${pulse})`;
      ctx.strokeRect(rx - 2, ry - 2, w + 4, h + 4);
    }

    ctx.fillStyle = isGiant ? '#fca5a5' : (isReal ? '#4ade80' : '#fda4af');
    ctx.font = `bold ${isGiant ? 5 : 4}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isGiant ? 'DENEGADO' : (isReal ? 'ROOT' : 'PID?'), rx + w / 2, scrY + scrH / 2);

    // LEDs inferiores de rack
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = (Math.floor(t * 6) + i) % 2 === 0
        ? (isReal ? '#22c55e' : '#ef4444')
        : '#1e293b';
      ctx.fillRect(rx + 4 + i * 5, ry + h - 5, 3, 2);
    }
    ctx.restore();
  }

  render(ctx, camera) {
    if (this.dead) {
      super.render(ctx, camera);
      return;
    }

    const camX = Math.round(camera ? camera.renderX : 0);
    const camY = Math.round(camera ? camera.renderY : 0);
    const t = this.animTimer;

    // Firewalls de Fase 3 (láseres horizontales y verticales)
    for (const fw of this.firewalls) {
      ctx.save();
      if (fw.warnTimer > 0) {
        const blink = Math.floor(t * 16) % 2 === 0;
        ctx.strokeStyle = blink ? '#facc15' : '#ef4444';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        if (fw.axis === 'h') {
          const y = Math.round(fw.pos - camY);
          ctx.moveTo(0, y);
          ctx.lineTo(12 * 16, y);
        } else {
          const x = Math.round(fw.pos - camX);
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 10 * 16);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        if (fw.axis === 'h') {
          ctx.fillRect(0, Math.round(fw.pos - fw.thickness / 2 - camY), 12 * 16, fw.thickness);
          ctx.fillStyle = '#fef2f2';
          ctx.fillRect(0, Math.round(fw.pos - 1 - camY), 12 * 16, 2);
        } else {
          ctx.fillRect(Math.round(fw.pos - fw.thickness / 2 - camX), 0, fw.thickness, 10 * 16);
          ctx.fillStyle = '#fef2f2';
          ctx.fillRect(Math.round(fw.pos - 1 - camX), 0, 2, 10 * 16);
        }
      }
      ctx.restore();
    }

    if (this.phase === 2 && this.clones.length > 0) {
      for (const clone of this.clones) {
        if (clone.exploded) continue;
        const bob = Math.sin(t * 4 + clone.phaseOffset) * 1.5;
        this._drawKernelNode(
          ctx,
          Math.round(clone.x - camX),
          Math.round(clone.y + bob - camY),
          clone.width,
          clone.height,
          { isReal: clone.isReal, isGiant: false, flash: clone.isReal && this.hitFlashTimer > 0, t }
        );
      }
    } else {
      const bob = this.phase === 3 ? 0 : Math.sin(t * 3) * 1.5;
      this._drawKernelNode(
        ctx,
        Math.round(this.x - camX),
        Math.round(this.y + bob - camY),
        this.width,
        this.height,
        { isReal: true, isGiant: this.phase === 3, flash: this.hitFlashTimer > 0, t }
      );
    }

    // Explosiones de clones falsos
    for (const exp of this.cloneExplosions) {
      ctx.save();
      const alpha = Math.max(0, exp.life / exp.maxLife);
      ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.55})`;
      ctx.beginPath();
      ctx.arc(Math.round(exp.x - camX), Math.round(exp.y - camY), exp.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Proyectiles Pantallazo Azul (BSOD)
    for (const shot of this.projectiles || []) {
      const sx = Math.round(shot.x - camX);
      const sy = Math.round(shot.y - camY);
      const w = shot.width || 14;
      const h = shot.height || 10;
      ctx.save();
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - w / 2 + 0.5, sy - h / 2 + 0.5, w - 1, h - 1);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 5px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(':(', sx, sy);
      ctx.restore();
    }

    // Bocadillo / frase activa del Kernel
    if (this.introQuoteTimer > 0 && this.introQuote) {
      ctx.save();
      const bx = Math.round(this.centerX - camX);
      const by = Math.max(12, Math.round(this.y - camY - 10));
      ctx.font = 'bold 4.5px monospace';
      const tw = Math.min(180, ctx.measureText(this.introQuote).width + 8);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.fillRect(bx - tw / 2, by - 5, tw, 10);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - tw / 2 + 0.5, by - 4.5, tw - 1, 9);
      ctx.fillStyle = '#86efac';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.introQuote, bx, by);
      ctx.restore();
    }
  }

  getPhaseLabel() {
    return PHASE_NAMES[this.phase] || PHASE_NAMES[1];
  }
}
