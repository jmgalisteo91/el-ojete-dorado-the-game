/**
 * IñakitoBoss.js · Expansión "El Resurgir de Mister Alex IA" (v2.0).
 * Jefe del Acto 1: becario eterno, café en mano y corbata roja.
 *
 * Fase 1 (100-66%): proyectiles de "console.log".
 * Fase 2 (66-33%): invoca 3 Bugs cucaracha.
 * Fase 3 (33-0%): bucle while(true) invulnerable; un Parry perfecto lo rompe.
 * Muerte: "¡Pero si el jefe me dijo que esto era un ascenso!"
 */
import { Boss } from '../../entities/bosses/Boss.js?v=8';

const DEATH_QUOTE = '¡Pero si el jefe me dijo que esto era un ascenso!';

export class IñakitoBoss extends Boss {
  constructor({ x = 160, y = 88, sceneId = 'valleverde_corrupto', hp = 80 } = {}) {
    super({
      id: 'boss_inakito',
      name: 'Iñakito 2.0',
      title: 'Becario Eterno del Update Universal',
      x,
      y,
      width: 28,
      height: 34,
      hp,
      speed: 30,
      sceneId,
      trackName: 'track_inakito',
      rewardAbility: null,
      rewardName: 'Plaza del Becario',
      themeColor: '#ef4444',
      requiresIntroCutscene: true
    });

    this.maxHp = 80;
    this.hp = 80;
    this.phase = 1;
    this.sceneId = sceneId;
    this.boundingBox = { offsetX: 5, offsetY: 22, width: 18, height: 12 };

    this.floatTimer = 0;
    this.shotTimer = 1.6;
    this.summoned = false;
    this.bugs = [];
    this.inWhileLoop = false;
    this.loopTimer = 0;
    this.loopBrokenTimer = 0;
    this.deathQuote = '';
    this.phaseBanner = 0;
    this.lastPhase = 1;
  }

  _setPhase(next) {
    if (next === this.phase) return;
    this.phase = next;
    this.phaseBanner = 2.2;
    if (next >= 2 && !this.summoned) {
      this.summoned = true;
      this._summonBugs();
    }
    if (next === 3 && !this.inWhileLoop) {
      this.inWhileLoop = true;
      this.loopTimer = 0;
      this.invulnerable = true;
      this.shots = [];
    }
  }

  _summonBugs() {
    this.bugs = [];
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      this.bugs.push({
        x: this.centerX + Math.cos(angle) * 34,
        y: this.centerY + Math.sin(angle) * 22,
        hp: 2,
        maxHp: 2,
        dead: false,
        bob: Math.random() * Math.PI * 2,
        wobble: Math.random() * 6,
        hitCooldown: 0
      });
    }
  }

  _shootConsoleLog(player) {
    if (!player || this.inWhileLoop) return;
    const dx = (player.centerX ?? player.x) - this.centerX;
    const dy = (player.centerY ?? player.y) - this.centerY;
    const len = Math.hypot(dx, dy) || 1;
    this.shots = this.shots || [];
    this.shots.push({
      x: this.centerX,
      y: this.centerY - 8,
      vx: (dx / len) * 86,
      vy: (dy / len) * 86,
      damage: 1,
      life: 2.6,
      radius: 6,
      type: 'console_log',
      text: 'console.log'
    });
  }

  update(dt, tilemap, player = null, paused = false, soundEngine = null, ai = null) {
    this.floatTimer += dt;
    if (this.phaseBanner > 0) this.phaseBanner = Math.max(0, this.phaseBanner - dt);

    if (!this.dead) {
      const pct = this.hp / this.maxHp;
      const next = pct > 0.66 ? 1 : (pct > 0.33 ? 2 : 3);
      if (next !== this.lastPhase) {
        this.lastPhase = next;
        this._setPhase(next);
      }

      if (this.phase === 1) {
        this.shotTimer -= dt;
        if (this.shotTimer <= 0) {
          this._shootConsoleLog(player);
          this.shotTimer = 1.45;
        }
      }

      if (this.phase === 3 && this.inWhileLoop) {
        this.loopTimer += dt;
      }

      // Bugs de la fase 2: avanzan hacia el jugador y muerden al contacto.
      for (const bug of this.bugs) {
        if (bug.dead) continue;
        bug.bob += dt * 4;
        bug.hitCooldown = Math.max(0, bug.hitCooldown - dt);
        if (player) {
          const bx = player.centerX - bug.x;
          const by = player.centerY - bug.y;
          const d = Math.hypot(bx, by) || 1;
          if (d > 10) {
            bug.x += (bx / d) * 18 * dt;
            bug.y += (by / d) * 18 * dt;
          } else if (bug.hitCooldown <= 0 && typeof player.takeDamage === 'function') {
            bug.hitCooldown = 1.2;
            player.takeDamage(1, soundEngine);
          }
        }
      }
    }

    const result = super.update(dt, tilemap, player, paused, soundEngine, ai);
    if (this.loopBrokenTimer > 0) this.loopBrokenTimer = Math.max(0, this.loopBrokenTimer - dt);
    return result;
  }

  takeSwordHit(player, soundEngine = null, customDamage = null) {
    if (this.dead) return false;

    // (FASE 3) while(true): solo un Parry perfecto rompe el bucle.
    if (this.inWhileLoop) {
      const perfectParry = Boolean(player && Number(player.parryTimer) > 0);
      if (!perfectParry) {
        if (soundEngine && typeof soundEngine.playMetalClink === 'function') {
          soundEngine.playMetalClink();
        }
        return false;
      }
      this.inWhileLoop = false;
      this.invulnerable = false;
      this.hitFlashTimer = 0;
      this.loopBrokenTimer = 0.9;
    }

    return super.takeSwordHit(player, soundEngine, customDamage);
  }

  triggerBossDefeat(player, soundEngine = null) {
    this.deathQuote = DEATH_QUOTE;
    return super.triggerBossDefeat(player, soundEngine);
  }

  render(ctx, camera) {
    const sx = Math.round(this.centerX - camera.renderX);
    const floatY = Math.round(this.y + Math.sin(this.floatTimer * 2.4) * 3);
    const sy = Math.round(floatY - camera.renderY);
    const t = this.floatTimer;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Sombra flotante.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 34, 11, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Aura de becario eterno.
    const aura = ctx.createRadialGradient(sx, sy + 10, 4, sx, sy + 10, 30);
    aura.addColorStop(0, 'rgba(239, 68, 68, 0.22)');
    aura.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(sx - 32, sy - 14, 64, 60);

    // Cuerpo: camisa arrugada y corbata roja.
    ctx.fillStyle = '#e2e8f0';
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

    // Cabeza con ojeras gigantes.
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

    // Taza de café humeante.
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(sx + 9, sy + 20, 7, 7);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(sx + 10, sy + 20, 5, 2);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx + 16, sy + 23.5, 2, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.beginPath();
    ctx.moveTo(sx + 12, sy + 18);
    ctx.quadraticCurveTo(sx + 14, sy + 15, sx + 12, sy + 12);
    ctx.stroke();

    // Proyectiles console.log.
    for (const shot of this.shots || []) {
      const shx = Math.round(shot.x - camera.renderX);
      const shy = Math.round(shot.y - camera.renderY);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(shx - 10, shy - 4, 20, 8);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(shx - 9.5, shy - 3.5, 19, 7);
      ctx.fillStyle = '#7dd3fc';
      ctx.font = '3.6px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('console.log', shx, shy);
    }

    // Bugs cucaracha.
    for (const bug of this.bugs) {
      if (bug.dead) continue;
      const bx = Math.round(bug.x - camera.renderX);
      const by = Math.round(bug.y - camera.renderY + Math.sin(bug.bob) * 2);
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(bx - 3, by - 2, 6, 4);
      ctx.fillRect(bx - 5, by - 1, 2, 2);
      ctx.fillRect(bx + 3, by - 1, 2, 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(bx - 1, by - 1, 1, 1);
      ctx.fillRect(bx + 1, by - 1, 1, 1);
    }

    // Estado del bucle while(true).
    if (this.inWhileLoop) {
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.5 + Math.sin(t * 6) * 0.3})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx - 16, sy - 6, 32, 42);
      ctx.fillStyle = '#fecaca';
      ctx.font = 'bold 4px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('while (true) { ... }', sx, sy - 12);
      ctx.fillStyle = '#f87171';
      ctx.font = '3.5px monospace';
      ctx.fillText('PARRY PERFECTO PARA ROMPER', sx, sy + 38);
    }

    if (this.phaseBanner > 0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(sx - 30, sy - 22, 60, 8);
      ctx.strokeStyle = '#ef4444';
      ctx.strokeRect(sx - 29.5, sy - 21.5, 59, 7);
      ctx.fillStyle = '#fecaca';
      ctx.font = 'bold 4.5px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`FASE ${this.phase} / 3`, sx, sy - 18);
    }

    ctx.restore();
  }
}

export { DEATH_QUOTE };
