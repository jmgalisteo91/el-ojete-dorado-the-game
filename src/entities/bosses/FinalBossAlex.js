import { Boss } from './Boss.js?v=8';
import { getRandomBattleBark } from '../../assets/VillainDialogues.js?v=8';

/**
 * Boss Final: "Mister AI Alex"
 * Ubicación: Ciudadela de AI Alex · El Gran Ojal ('ai_citadel').
 * Melodía: 'theme_main_villain' (o 'villain').
 * Barra de vida: 55 HP (calibrada para un combate culminante épico: Fase 1 hasta 28 HP y Fase 2 Kernel Panic).
 * 
 * Mecánicas de Combate:
 * 1. Rayo Láser Binario: Dispara ráfagas dirigidas de bits [0] y [1] de alta velocidad.
 * 2. Ondas Térmicas Cuánticas: Pulso radial del Microondas Cuántico que expande un anillo térmico.
 * 3. Fase 2 - KERNEL PANIC OVERCLOCK (HP <= 50%):
 *    - Velocidad incrementada y teletransporte cuántico con glitches en el espacio.
 *    - Disparo espiral omnidireccional de 8 orbes cuánticos carmesí.
 *    - Summons de hologramas ilusorios que imitan su presencia.
 * 
 * Muerte:
 * Al llegar a 0 HP, congela la sala por completo (proyectiles y esbirros inmovilizados)
 * y emite partículas de fallo catastrófico para dar paso a la cinemática SCENE_ENDING_VICTORY.
 */
export class FinalBossAlex extends Boss {
  constructor({ x, y, sceneId = 'ai_citadel', hp = 55 }) {
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

    this.laserTimer = 2.2;
    this.heatWaveTimer = 4.5;
    this.spiralTimer = 3.0;
    this.teleportTimer = 5.0;
    this.hologramTimer = 8.0;

    this.hitCountInPhase = 0;
    this.isOverclocked = false;
    this.roomFrozen = false;

    // Efectos visuales de reloj cuántico del microondas
    this.microwaveTimerSec = 3;
    this.animTimer = 0;
    this.holograms = [];
    this.pendingBurstShots = [];
    this.statusText = `💬 ${getRandomBattleBark('PHASE_1_START')}`;
  }

  resetCombatState() {
    super.resetCombatState();
    this.laserTimer = 2.2;
    this.heatWaveTimer = 4.5;
    this.spiralTimer = 3.0;
    this.teleportTimer = 5.0;
    this.hologramTimer = 8.0;
    this.hitCountInPhase = 0;
    this.isOverclocked = false;
    this.roomFrozen = false;
    this.speed = 36;
    this.holograms = [];
    this.pendingBurstShots = [];
    this.statusText = `💬 ${getRandomBattleBark('PHASE_1_START')}`;
  }

  takeSwordHit(player, soundEngine = null, customDamage = null) {
    if (this.dead || this.roomFrozen) return false;

    const hit = super.takeSwordHit(player, soundEngine, customDamage);
    if (!hit) return false;

    this.hitCountInPhase++;

    // Mofa contextual al recibir daño
    if (Math.random() < 0.65) {
      this.statusText = `💬 ${getRandomBattleBark('TAKE_HIT')}`;
    }

    // En Fase 2, cada 3 golpes se teletransporta para descolocar al jugador
    if (this.isOverclocked && this.hitCountInPhase >= 3) {
      this.hitCountInPhase = 0;
      this._performQuantumTeleport();
    }

    // Activación de Fase 2: KERNEL PANIC (HP <= 50%)
    if (this.hp <= Math.round(this.maxHp * 0.50) && !this.isOverclocked && !this.dead) {
      this.isOverclocked = true;
      this.speed = 45;
      this.statusText = `🔥 ${getRandomBattleBark('PHASE_2_TRIGGER')}`;
      if (soundEngine && typeof soundEngine.playHitHurt === 'function') {
        soundEngine.playHitHurt();
      }
    }

    return true;
  }

  triggerBossDefeat(player, soundEngine = null) {
    super.triggerBossDefeat(player, soundEngine);
    this.roomFrozen = true;
    this.statusText = '💥 ¡KERNEL PANIC! PROCESO TERMINADO';
    this.projectiles = [];
    this.holograms = [];
    this.pendingBurstShots = [];
  }

  _performQuantumTeleport() {
    const arenaSpots = [
      { x: 5 * 16, y: 5 * 16 },
      { x: 18 * 16, y: 5 * 16 },
      { x: 6 * 16, y: 11 * 16 },
      { x: 17 * 16, y: 11 * 16 },
      { x: 11.5 * 16, y: 7 * 16 }
    ];
    const spot = arenaSpots[Math.floor(Math.random() * arenaSpots.length)];
    this.x = spot.x;
    this.y = spot.y;
    this.hitFlashTimer = 0.3;
  }

  update(dt, tilemap, player, paused = false, soundEngine = null) {
    if (this.dead) {
      return super.update(dt, tilemap, player, paused, soundEngine);
    }

    if (this.roomFrozen || paused) return { hitPlayer: false };

    this.animTimer += dt;
    if (this.animTimer >= 1.0) {
      this.animTimer = 0;
      this.microwaveTimerSec = this.microwaveTimerSec <= 0 ? 3 : this.microwaveTimerSec - 1;
    }

    const baseResult = super.update(dt, tilemap, player, paused, soundEngine);
    if (!this.activeCombat || !player || this.dead) return baseResult;

    // Procesar ráfagas programadas en el bucle determinista (sin setTimeout huérfanos)
    for (let i = this.pendingBurstShots.length - 1; i >= 0; i--) {
      const shot = this.pendingBurstShots[i];
      shot.delay -= dt;
      if (shot.delay <= 0) {
        this.projectiles.push({
          x: this.centerX,
          y: this.centerY,
          vx: Math.cos(shot.angle) * shot.speed,
          vy: Math.sin(shot.angle) * shot.speed,
          radius: 4,
          life: 3.5,
          color: shot.index % 2 === 0 ? '#ef4444' : '#38bdf8',
          isBit: true,
          label: shot.index % 2 === 0 ? '1' : '0'
        });
        if (soundEngine && typeof soundEngine.playHitHurt === 'function') {
          soundEngine.playHitHurt();
        }
        this.pendingBurstShots.splice(i, 1);
      }
    }

    // 1. Ataque: Rayo Láser Binario (Ráfaga de 0s y 1s dirigidos)
    this.laserTimer -= dt;
    if (this.laserTimer <= 0) {
      this.laserTimer = this.isOverclocked ? 1.6 : 2.5;
      const angle = Math.atan2(player.centerY - this.centerY, player.centerX - this.centerX);
      const projSpeed = this.isOverclocked ? 90 : 75;
      const burstCount = this.isOverclocked ? 4 : 2;

      for (let i = 0; i < burstCount; i++) {
        this.pendingBurstShots.push({
          delay: i * 0.09,
          angle,
          speed: projSpeed,
          index: i
        });
      }
    }

    // 2. Ataque: Ondas de Choque Térmicas del Microondas Cuántico
    this.heatWaveTimer -= dt;
    if (this.heatWaveTimer <= 0) {
      this.heatWaveTimer = this.isOverclocked ? 3.8 : 5.0;
      const bark = player && player.hp <= 2 
        ? getRandomBattleBark('PLAYER_LOW_HP')
        : (this.isOverclocked ? getRandomBattleBark('PHASE_2_ATTACKS') : getRandomBattleBark('PHASE_1_ATTACK'));
      this.statusText = `⚡ ${bark}`;

      // Anillo expansivo de 6 proyectiles en círculo
      const count = 6;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        this.projectiles.push({
          x: this.centerX,
          y: this.centerY,
          vx: Math.cos(ang) * 60,
          vy: Math.sin(ang) * 60,
          radius: 5,
          life: 2.8,
          color: '#f97316'
        });
      }
    }

    // 3. Mecánicas exclusivas de Fase 2 (KERNEL PANIC OVERCLOCK)
    if (this.isOverclocked) {
      // Ráfaga Espiral de 8 orbes cuánticos
      this.spiralTimer -= dt;
      if (this.spiralTimer <= 0) {
        this.spiralTimer = 3.2;
        const count = 8;
        for (let i = 0; i < count; i++) {
          const ang = (i / count) * Math.PI * 2 + this.animTimer * 2;
          this.projectiles.push({
            x: this.centerX,
            y: this.centerY,
            vx: Math.cos(ang) * 70,
            vy: Math.sin(ang) * 70,
            radius: 4.5,
            life: 3.0,
            color: '#a855f7'
          });
        }
      }

      // Teletransporte periódico
      this.teleportTimer -= dt;
      if (this.teleportTimer <= 0) {
        this.teleportTimer = 4.8;
        this._performQuantumTeleport();
      }
    }

    return baseResult;
  }

  render(ctx, camera) {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const sx = Math.round(this.x - camX);
    const sy = Math.round(this.y - camY);
    const t = performance.now() * 0.003;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 1. Proyectiles activos de Mister AI Alex
    for (const p of this.projectiles) {
      const px = Math.round(p.x - camX);
      const py = Math.round(p.y - camY);

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, p.radius, 0, Math.PI * 2);
      ctx.fill();

      if (p.isBit) {
        ctx.font = 'bold 6px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.label, px, py);
      }
    }

    // 2. Halo de distorsión cuántica bajo el jefe
    const haloRad = 16 + Math.sin(t * 6) * 3;
    ctx.strokeStyle = this.isOverclocked ? 'rgba(239, 68, 68, 0.6)' : 'rgba(168, 85, 247, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx + 16, sy + 24, haloRad, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Render de Mister AI Alex (Sprite Mecha / Pixel Art Cibernético)
    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, sy, this.width, this.height);
    } else {
      // Capa / hombreras mecha
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(sx + 2, sy + 6, 28, 24);

      // Pechera metálica con Microondas Cuántico integrado
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(sx + 6, sy + 10, 20, 18);
      ctx.strokeStyle = this.isOverclocked ? '#ef4444' : '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 6.5, sy + 10.5, 19, 17);

      // Display digital del microondas
      ctx.fillStyle = '#052e16';
      ctx.fillRect(sx + 9, sy + 13, 14, 7);
      ctx.font = 'bold 5px monospace';
      ctx.fillStyle = this.isOverclocked ? '#ef4444' : '#22c55e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`00:0${this.microwaveTimerSec}`, sx + 16, sy + 16.5);

      // Cabeza / Visor Cibernético
      ctx.fillStyle = '#090d16';
      ctx.fillRect(sx + 8, sy + 1, 16, 9);
      ctx.fillStyle = this.isOverclocked ? '#f43f5e' : '#ef4444';
      ctx.fillRect(sx + 10, sy + 4, 12, 3); // Ojo láser carmesí

      // Corona de antenas cuánticas
      ctx.fillStyle = '#fde047';
      ctx.fillRect(sx + 9, sy - 1, 2, 2);
      ctx.fillRect(sx + 15, sy - 2, 2, 3);
      ctx.fillRect(sx + 21, sy - 1, 2, 2);
    }

    // Partículas de muerte
    super.render(ctx, camera);

    ctx.restore();
  }
}

