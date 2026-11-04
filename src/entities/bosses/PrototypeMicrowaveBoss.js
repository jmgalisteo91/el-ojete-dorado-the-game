import { Boss } from './Boss.js?v=6';

/**
 * Boss 3: "El Microondas Prototipo (V0.1 Alpha)"
 * Ubicación: Umbral de la Fortaleza de AI Alex.
 * Melodía: 'track_prototype_microwave'.
 * Barra de vida: 160 HP.
 * 
 * Mecánicas:
 * 1. Radiación Térmica: Dispara en abanico proyectiles de calor con pitidos agudos de microondas.
 * 2. Ciclo de Calentamiento: Se vuelve invulnerable durante 6s activando una espiral térmica.
 *    El jugador debe golpear 2 fusibles en las esquinas de la sala para cortarle la corriente.
 * Recompensa: Habilidad 'Barrera de Tipado Estricto' (tecla Q).
 */
export class PrototypeMicrowaveBoss extends Boss {
  constructor({ x, y, sceneId = 'ai_fortress_gate' }) {
    super({
      id: 'boss_prototype_microwave',
      name: 'El Microondas Prototipo (V0.1 Alpha)',
      title: 'Artefacto Cuántico Precursor de Mister AI Alex',
      x,
      y,
      width: 28,
      height: 26,
      hp: 160,
      speed: 26,
      sceneId,
      trackName: 'track_prototype_microwave',
      rewardAbility: 'hasBarrier',
      rewardName: 'Barrera de Tipado Estricto',
      themeColor: '#f97316',
      requiresIntroCutscene: true
    });

    this.shootTimer = 2.4;
    this.heatCycleActive = false;
    this.heatCycleTimer = 0;
    this.heatSpiralAngle = 0;

    // Fusibles de emergencia para cancelar el ciclo de calentamiento
    this.fuses = [
      { id: 'left',  x: x - 54, y: y - 20, active: false, hit: false },
      { id: 'right', x: x + 54, y: y - 20, active: false, hit: false }
    ];

    this.cycleThresholds = [80, 40]; // Se activa al 50% y 25% de HP
    this.stunnedTimer = 0;
  }

  takeSwordHit(player, soundEngine = null, customDamage = null) {
    if (this.invulnerable) {
      if (soundEngine && typeof soundEngine.playMetalClink === 'function') {
        soundEngine.playMetalClink();
      }
      return false;
    }

    const prevHp = this.hp;
    const hit = super.takeSwordHit(player, soundEngine, customDamage);
    if (!hit) return false;

    // Chequeo de activación de Ciclo de Calentamiento
    for (const thresh of this.cycleThresholds) {
      if (prevHp > thresh && this.hp <= thresh && !this.heatCycleActive && this.hp > 0) {
        this.triggerHeatCycle(soundEngine);
        break;
      }
    }

    return true;
  }

  triggerHeatCycle(soundEngine = null) {
    this.heatCycleActive = true;
    this.invulnerable = true;
    this.heatCycleTimer = 6.0;
    this.statusText = '🔥 ¡CICLO DE CALENTAMIENTO ACTIVO! (¡CORTA LOS FUSIBLES!)';

    for (const f of this.fuses) {
      f.active = true;
      f.hit = false;
    }

    if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
      soundEngine.playEnemyHit();
    }
  }

  update(dt, tilemap, player, paused = false, soundEngine = null) {
    if (this.dead) {
      return super.update(dt, tilemap, player, paused, soundEngine);
    }

    super.update(dt, tilemap, player, paused, soundEngine);

    // Estado aturdido tras romper los fusibles
    if (this.stunnedTimer > 0) {
      this.stunnedTimer -= dt;
      this.statusText = '💫 ¡CORTOCIRCUITO! (ATURDIDO)';
      return { hitPlayer: false };
    }

    // 1. Mecánica: Radiación Térmica en Abanico
    if (!this.heatCycleActive) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0 && this.activeCombat && player) {
        this.shootTimer = 2.4;
        this.statusText = '🚨 RADIACIÓN TÉRMICA: ERROR 500';

        // Disparo en abanico de 3 proyectiles de microondas
        const baseAngle = Math.atan2(player.centerY - this.centerY, player.centerX - this.centerX);
        const spreads = [-0.3, 0, 0.3];
        const projSpeed = 75;

        for (const sp of spreads) {
          const ang = baseAngle + sp;
          this.projectiles.push({
            x: this.centerX,
            y: this.centerY,
            vx: Math.cos(ang) * projSpeed,
            vy: Math.sin(ang) * projSpeed,
            radius: 4.5,
            life: 3.5,
            color: '#f97316'
          });
        }

        if (soundEngine && typeof soundEngine.playPlayerHurt === 'function') {
          soundEngine.playPlayerHurt();
        }
      }
    } else {
      // 2. Mecánica: Ciclo de Calentamiento (Invulnerable con espiral de radiación)
      this.heatCycleTimer -= dt;
      this.heatSpiralAngle += dt * 3.5;

      // Dispara chispas en espiral cada 0.35s
      if (Math.floor(this.heatCycleTimer * 4) !== Math.floor((this.heatCycleTimer + dt) * 4)) {
        for (let i = 0; i < 2; i++) {
          const a = this.heatSpiralAngle + i * Math.PI;
          this.projectiles.push({
            x: this.centerX,
            y: this.centerY,
            vx: Math.cos(a) * 65,
            vy: Math.sin(a) * 65,
            radius: 3.5,
            life: 2.2,
            color: '#ef4444'
          });
        }
      }

      // Chequeo si el jugador golpea los 2 fusibles de emergencia con la espada
      if (player) {
        const sword = player.getSwordHitbox();
        const spin = player.getSpinHitbox();

        for (const f of this.fuses) {
          if (f.active && !f.hit) {
            const hitBySword = sword && Math.hypot(f.x - sword.x, f.y - sword.y) <= 16;
            const hitBySpin = spin && Math.hypot(f.x - spin.centerX, f.y - spin.centerY) <= spin.radius + 10;
            if (hitBySword || hitBySpin) {
              f.hit = true;
              if (soundEngine && typeof soundEngine.playMetalClink === 'function') {
                soundEngine.playMetalClink();
              }
            }
          }
        }

        // Si ambos fusibles han sido golpeados: ¡se cancela el ciclo!
        const allFusesHit = this.fuses.every((f) => f.hit);
        if (allFusesHit) {
          this.heatCycleActive = false;
          this.invulnerable = false;
          this.stunnedTimer = 2.5;
          this.statusText = '💥 ¡FUSIBLES FUNDIDOS! ¡CORTOCIRCUITO!';
          for (const f of this.fuses) f.active = false;
          if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
            soundEngine.playEnemyHit();
          }
        }
      }

      // Si se acaba el tiempo de 6s del ciclo
      if (this.heatCycleTimer <= 0) {
        this.heatCycleActive = false;
        this.invulnerable = false;
        this.statusText = '';
        for (const f of this.fuses) f.active = false;
      }
    }

    return { hitPlayer: false };
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

    // Renderizado de los Fusibles de Emergencia en la sala
    for (const f of this.fuses) {
      if (f.active) {
        const fx = f.x - camera.renderX;
        const fy = f.y - camera.renderY;
        ctx.fillStyle = f.hit ? '#334155' : '#f59e0b';
        ctx.fillRect(fx - 6, fy - 6, 12, 12);
        ctx.strokeStyle = f.hit ? '#64748b' : '#fde047';
        ctx.strokeRect(fx - 6, fy - 6, 12, 12);

        ctx.font = '5.5px monospace';
        ctx.fillStyle = f.hit ? '#94a3b8' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(f.hit ? 'OFF' : 'FUSE', fx, fy + 2);
      }
    }

    // Aura de calor o invulnerabilidad
    if (this.heatCycleActive) {
      ctx.strokeStyle = Math.floor(now * 10) % 2 === 0 ? '#ef4444' : '#f97316';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 18 + Math.sin(now * 8) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Carcasa del Microondas
    ctx.fillStyle = this.hitFlashTimer > 0 ? '#ffffff' : this.invulnerable ? '#f97316' : '#1e293b';
    ctx.fillRect(cx - 12, cy - 10, 24, 20);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(cx - 12, cy - 10, 24, 20);

    // Ventana del microondas (rejilla térmica)
    ctx.fillStyle = this.heatCycleActive ? '#7f1d1d' : '#0f172a';
    ctx.fillRect(cx - 10, cy - 8, 14, 16);

    // Pantalla LED con temporizador cuántico rojo
    ctx.fillStyle = '#1c050b';
    ctx.fillRect(cx + 5, cy - 8, 6, 5);
    ctx.font = '4.5px monospace';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'center';
    ctx.fillText('99', cx + 8, cy - 4.5);

    // Plato giratorio emisor
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(cx - 3, cy, 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

