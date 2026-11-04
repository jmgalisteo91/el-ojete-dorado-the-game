import { Boss } from './Boss.js?v=6';
import { CollisionSystem } from '../../physics/CollisionSystem.js?v=6';

/**
 * Boss 2: "El Guardián del Stack Overflow"
 * Ubicación: Fin del Templo de la Espada (Ruinas del Despertar).
 * Melodía: 'track_stack_overflow'.
 * Barra de vida: 120 HP.
 * 
 * Mecánicas:
 * 1. Llamada Recursiva: Cada 30 de daño invoca 2 sombras menores de recursividad (10 HP).
 * 2. Desbordamiento de Pila: Canaliza 2s una onda de choque radial expansiva (60px) que obliga
 *    a alejarse o cruzar con el Dash Asíncrono.
 * Recompensa: Habilidad 'Corte en Cascada (Caso Base)' (mantener Espacio/F 1s para tajo 360°).
 */
export class StackOverflowBoss extends Boss {
  constructor({ x, y, sceneId = 'sword_temple' }) {
    super({
      id: 'boss_stack_overflow',
      name: 'El Guardián del Stack Overflow',
      title: 'Centinela Fractal de la Recursión Infinita',
      x,
      y,
      width: 24,
      height: 28,
      hp: 120,
      speed: 32,
      sceneId,
      trackName: 'track_stack_overflow',
      rewardAbility: 'hasChargedAttack',
      rewardName: 'Corte en Cascada (Caso Base)',
      themeColor: '#a855f7',
      requiresIntroCutscene: true
    });

    this.channelTimer = 0;
    this.isChanneling = false;
    this.shockwaveCooldown = 9.0;
    this.shockwaves = [];
    this.clones = [];
    this.lastMilestoneHp = 120;
  }

  takeSwordHit(player, soundEngine = null, customDamage = null) {
    const prevHp = this.hp;
    const hit = super.takeSwordHit(player, soundEngine, customDamage);
    if (!hit) return false;

    // Chequeo de hito: cada 30 de daño dispara Llamada Recursiva
    if (Math.floor(this.hp / 30) < Math.floor(prevHp / 30) && this.hp > 0) {
      this.spawnRecursiveClones(soundEngine);
    }

    return true;
  }

  spawnRecursiveClones(soundEngine = null) {
    this.statusText = '⚡ ¡LLAMADA RECURSIVA: fn() x 2!';
    for (let i = 0; i < 2; i++) {
      const offsetX = (i === 0 ? -1 : 1) * 22;
      this.clones.push({
        x: this.centerX + offsetX,
        y: this.centerY + 10,
        hp: 10,
        maxHp: 10,
        speed: 40,
        attackCooldown: 0,
        hitFlash: 0
      });
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

    // Actualización de clones recursivos
    for (let i = this.clones.length - 1; i >= 0; i--) {
      const c = this.clones[i];
      if (c.hitFlash > 0) c.hitFlash -= dt;

      // Movimiento hacia el jugador
      if (player && this.activeCombat) {
        const dx = player.centerX - c.x;
        const dy = player.centerY - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 6) {
          c.x += (dx / dist) * c.speed * dt;
          c.y += (dy / dist) * c.speed * dt;
        }

        // Ataque al jugador
        c.attackCooldown -= dt;
        if (dist <= 12 && c.attackCooldown <= 0) {
          c.attackCooldown = 0.9;
          player.takeHit(soundEngine);
        }

        // Chequeo si la espada o corte en cascada del jugador golpea al clon
        const sword = player.getSwordHitbox();
        const spin = player.getSpinHitbox();
        if (spin && Math.hypot(c.x - spin.centerX, c.y - spin.centerY) <= spin.radius + 6) {
          c.hp -= spin.damage;
          c.hitFlash = 0.15;
        } else if (sword && CollisionSystem.checkAABB(sword, { x: c.x - 6, y: c.y - 6, width: 12, height: 12 })) {
          c.hp -= 1;
          c.hitFlash = 0.15;
        }

        if (c.hp <= 0) {
          this.clones.splice(i, 1);
        }
      }
    }

    // 2. Mecánica: Desbordamiento de Pila (Onda de choque radial de 2 segundos de canalización)
    if (!this.isChanneling) {
      this.shockwaveCooldown -= dt;
      if (this.shockwaveCooldown <= 0 && this.activeCombat) {
        this.isChanneling = true;
        this.channelTimer = 2.0;
        this.statusText = '⚡ CANALIZANDO STACK OVERFLOW...';
      }

      // Persecución estándar si no canaliza
      if (player && this.activeCombat) {
        const dx = player.centerX - this.centerX;
        const dy = player.centerY - this.centerY;
        const dist = Math.hypot(dx, dy);
        if (dist > 10) {
          CollisionSystem.moveWithCollisions(
            this,
            (dx / dist) * this.speed * dt,
            (dy / dist) * this.speed * dt,
            tilemap,
            []
          );
        }
      }
    } else {
      // Canalizando durante 2s
      this.channelTimer -= dt;
      if (this.channelTimer <= 0) {
        this.isChanneling = false;
        this.shockwaveCooldown = 9.0;
        this.statusText = '💥 ¡DESBORDAMIENTO RADIAL!';

        // Disparo de la onda de choque radial expansiva
        this.shockwaves.push({
          x: this.centerX,
          y: this.centerY,
          radius: 10,
          maxRadius: 58,
          speed: 68,
          hasHit: false
        });

        if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
          soundEngine.playEnemyHit();
        }
      }
    }

    // Expansión de ondas de choque
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed * dt;

      if (player && !sw.hasHit) {
        const dist = Math.hypot(player.centerX - sw.x, player.centerY - sw.y);
        // Si el jugador está en el anillo de choque (y no está con invulnerabilidad de dash ni barrera)
        if (Math.abs(dist - sw.radius) <= 8 && player.invulnTimer <= 0) {
          sw.hasHit = true;
          player.takeHit(soundEngine);
        }
      }

      if (sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
        if (this.statusText.includes('DESBORDAMIENTO')) {
          this.statusText = '';
        }
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

    // Ondas de choque en expansión
    for (const sw of this.shockwaves) {
      const wx = sw.x - camera.renderX;
      const wy = sw.y - camera.renderY;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.arc(wx, wy, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(wx, wy, sw.radius - 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Anillo de canalización si está preparando el Desbordamiento
    if (this.isChanneling) {
      const chargePct = 1 - this.channelTimer / 2.0;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(cx, cy, 14 + chargePct * 30, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '5.5px monospace';
      ctx.fillStyle = '#f87171';
      ctx.textAlign = 'center';
      ctx.fillText('STACK DUMP', cx, cy - 18);
    }

    // Renderizado de Clones menores de recursión
    for (const c of this.clones) {
      const clx = c.x - camera.renderX;
      const cly = c.y - camera.renderY;
      ctx.fillStyle = c.hitFlash > 0 ? '#ffffff' : 'rgba(168, 85, 247, 0.75)';
      ctx.beginPath();
      ctx.arc(clx, cly, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c084fc';
      ctx.stroke();

      ctx.font = '5px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('clone()', clx, cly - 7);
    }

    // Cuerpo principal del Guardián (Túnica espectral de código carmesí/violeta)
    ctx.fillStyle = this.hitFlashTimer > 0 ? '#ffffff' : '#4c1d95';
    ctx.fillRect(cx - 9, cy - 12, 18, 24);
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(cx - 9, cy - 12, 18, 24);

    // Ojos de fósforo rojo
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(cx - 5, cy - 6, 3, 3);
    ctx.fillRect(cx + 2, cy - 6, 3, 3);

    // Runas flotantes de recursión
    ctx.font = '6px monospace';
    ctx.fillStyle = '#a855f7';
    ctx.textAlign = 'center';
    ctx.fillText('fn()', cx, cy + 6);

    ctx.restore();
  }
}

