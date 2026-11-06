import { Boss } from './Boss.js?v=8';
import { CollisionSystem } from '../../physics/CollisionSystem.js?v=8';

/**
 * Jefe Regional: "El Garbage Collector Furioso"
 * Ubicación: Alcantarillas de Valleverde (Fosa de Memoria).
 * Melodía: 'track_garbage_collector'.
 * Barra de vida: 24 HP (calibrada para un combate equilibrado: 6 combos neutros o 3 castigos al aturdirlo contra el muro).
 * 
 * Mecánicas:
 * 1. Memory Leak: Esparce charcos de ácido corrosivo de punteros rotos cada 3.8s.
 * 2. Fase de Compactación: Se detiene 1.5s telegrafiado y embiste a gran velocidad.
 *    Si choca con un muro, queda aturdido 2.5s como ventana de vulnerabilidad (daño x2).
 * Recompensa: Habilidad 'Dash Asíncrono' (Shift + Dirección).
 */
export class GarbageCollectorBoss extends Boss {
  constructor({ x, y, sceneId = 'sewers_dungeon', hp = 24 }) {
    super({
      id: 'boss_garbage_collector',
      name: 'El Garbage Collector Furioso',
      title: 'Recolector de Punteros Corruptos',
      x,
      y,
      width: 26,
      height: 26,
      hp,
      speed: 34,
      sceneId,
      trackName: 'track_garbage_collector',
      rewardAbility: 'hasDash',
      rewardName: 'Dash Asíncrono',
      themeColor: '#10b981',
      requiresIntroCutscene: true
    });

    this.state = 'chase'; // 'chase' | 'telegraph' | 'charge' | 'stunned'
    this.acidTimer = 3.8;
    this.chargeCooldown = 7.0;
    this.stateTimer = 0;
    this.chargeVx = 0;
    this.chargeVy = 0;
  }

  resetCombatState() {
    super.resetCombatState();
    this.state = 'chase';
    this.acidTimer = 3.8;
    this.chargeCooldown = 7.0;
    this.stateTimer = 0;
    this.chargeVx = 0;
    this.chargeVy = 0;
  }

  takeSwordHit(player, soundEngine = null, customDamage = null) {
    // Al estar aturdido contra el muro, Boss.takeSwordHit aplica automáticamente el multiplicador x2 de daño
    return super.takeSwordHit(player, soundEngine, customDamage);
  }

  update(dt, tilemap, player, paused = false, soundEngine = null) {
    if (this.dead) {
      return super.update(dt, tilemap, player, paused, soundEngine);
    }

    super.update(dt, tilemap, player, paused, soundEngine);

    // 1. Mecánica: Memory Leak (Charcos de ácido corrosivo)
    this.acidTimer -= dt;
    if (this.acidTimer <= 0 && this.activeCombat) {
      this.acidTimer = 3.2 + Math.random() * 1.5;
      this.hazardPuddles.push({
        x: this.centerX + (Math.random() - 0.5) * 16,
        y: this.centerY + (Math.random() - 0.5) * 16,
        radius: 11,
        life: 6.5,
        color: 'rgba(16, 185, 129, 0.45)',
        borderColor: '#10b981'
      });
    }

    // 2. Máquina de Estados de Ataque
    if (this.state === 'chase') {
      this.statusText = '';
      this.chargeCooldown -= dt;

      // Movimiento hacia el jugador
      if (player && this.activeCombat) {
        const dx = player.centerX - this.centerX;
        const dy = player.centerY - this.centerY;
        const dist = Math.hypot(dx, dy);
        if (dist > 8) {
          const nx = dx / dist;
          const ny = dy / dist;
          CollisionSystem.moveWithCollisions(
            this,
            nx * this.speed * dt,
            ny * this.speed * dt,
            tilemap,
            []
          );
        }

        // Contacto cuerpo a cuerpo
        if (dist <= 14 && this.attackCooldown <= 0) {
          this.attackCooldown = 0.85;
          player.takeHit(soundEngine);
        }
      }

      // Iniciar Fase de Compactación
      if (this.chargeCooldown <= 0 && this.activeCombat) {
        this.state = 'telegraph';
        this.stateTimer = 1.5;
        this.statusText = '⚠️ ¡COMPACTANDO MEMORIA!';
        if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
          soundEngine.playEnemyHit();
        }
      }
    } else if (this.state === 'telegraph') {
      // Telegrafiado de 1.5s: se frena y vibra con advertencia
      this.stateTimer -= dt;
      if (this.stateTimer <= 0 && player) {
        this.state = 'charge';
        this.stateTimer = 2.0; // tiempo máximo de embestida
        this.statusText = '⚡ ¡EMBESTIDA RECOLECTORA!';
        const dx = player.centerX - this.centerX;
        const dy = player.centerY - this.centerY;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const chargeSpeed = 195;
        this.chargeVx = (dx / dist) * chargeSpeed;
        this.chargeVy = (dy / dist) * chargeSpeed;
      }
    } else if (this.state === 'charge') {
      // Embestida a gran velocidad en línea recta
      this.stateTimer -= dt;
      const { blockedX, blockedY } = CollisionSystem.moveWithCollisions(
        this,
        this.chargeVx * dt,
        this.chargeVy * dt,
        tilemap,
        []
      );

      // Si golpea al jugador durante la embestida
      if (player && this.distanceTo(player) <= 15) {
        player.takeHit(soundEngine);
      }

      // Si choca contra un muro de la sala: ¡queda aturdido 2.5s!
      if (blockedX || blockedY || this.stateTimer <= 0) {
        this.state = 'stunned';
        this.stateTimer = 2.5;
        this.chargeCooldown = 8.0;
        this.statusText = '💫 ¡ATURDIDO! (¡VULNERABLE!)';
        if (soundEngine && typeof soundEngine.playMetalClink === 'function') {
          soundEngine.playMetalClink();
        }
      }
    } else if (this.state === 'stunned') {
      // Ventana de vulnerabilidad
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'chase';
        this.statusText = '';
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

    // Sombra del chasis
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy + 9, 12, 0, Math.PI * 2);
    ctx.fill();

    // Temblor si está en fase de telegrafiado
    let shakeX = 0;
    let shakeY = 0;
    if (this.state === 'telegraph') {
      shakeX = (Math.random() - 0.5) * 3;
      shakeY = (Math.random() - 0.5) * 3;
    }

    // Cuerpo mecánico de hierro oxidado y chimeneas de vapor
    ctx.translate(shakeX, shakeY);

    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = '#ffffff';
    } else if (this.state === 'stunned') {
      ctx.fillStyle = '#64748b'; // Apagado
    } else {
      ctx.fillStyle = '#1e293b'; // Chasis oscuro
    }

    // Cabina principal
    ctx.fillRect(cx - 10, cy - 10, 20, 20);
    ctx.strokeStyle = this.state === 'telegraph' ? '#f59e0b' : '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - 10, cy - 10, 20, 20);

    // Ojo sensor de memoria (verde si normal, rojo parpadeante si embiste)
    ctx.fillStyle =
      this.state === 'charge' || this.state === 'telegraph'
        ? Math.floor(now * 12) % 2 === 0 ? '#ef4444' : '#f59e0b'
        : '#10b981';
    ctx.fillRect(cx - 6, cy - 6, 12, 5);

    // Mandíbulas trituradoras hidráulicas inferiores
    ctx.fillStyle = '#475569';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(cx - 8 + i * 4.5, cy + 5, 3, 5);
    }

    // Estrellas de aturdimiento si está stunned
    if (this.state === 'stunned') {
      ctx.font = '7px monospace';
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'center';
      const starOffset = Math.sin(now * 8) * 3;
      ctx.fillText('💫 💫', cx, cy - 13 + starOffset);
    }

    ctx.restore();
  }
}

