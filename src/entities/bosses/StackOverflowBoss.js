import { Boss } from './Boss.js?v=8';
import { CollisionSystem } from '../../physics/CollisionSystem.js?v=8';
import { findPath, hasLineOfSight } from '../../ai/Pathfinding.js?v=8';

/**
 * Jefe Regional: "El Guardián del Stack Overflow"
 * Ubicación: Fin del Templo de la Espada (Ruinas del Despertar).
 * Melodía: 'track_stack_overflow'.
 * Barra de vida: 32 HP (calibrada para un combate equilibrado: ~8 aperturas de combo y 2 oleadas recursivas).
 * 
 * Mecánicas:
 * 1. Llamada Recursiva: Al 66% y 33% de vida invoca 2 sombras de recursividad (3 HP cada una).
 * 2. Desbordamiento de Pila: Canaliza 1.8s una onda de choque radial expansiva (60px) que obliga
 *    a esquivar con el Dash Asíncrono o retroceder.
 * 3. Navegación Inteligente A*: Supera obstáculos y pilares sin quedarse atascado.
 * Recompensa: Habilidad 'Corte en Cascada (Caso Base)' (mantener Espacio/F 1s para tajo 360°).
 */
export class StackOverflowBoss extends Boss {
  constructor({ x, y, sceneId = 'sword_temple', hp = 32 }) {
    super({
      id: 'boss_stack_overflow',
      name: 'El Guardián del Stack Overflow',
      title: 'Centinela Fractal de la Recursión Infinita',
      x,
      y,
      width: 24,
      height: 28,
      hp,
      speed: 32,
      sceneId,
      trackName: 'track_stack_overflow',
      rewardAbility: 'hasChargedAttack',
      rewardName: 'Corte en Cascada (Caso Base)',
      themeColor: '#a855f7',
      requiresIntroCutscene: true
    });

    // Hitbox física optimizada para base de pies (14x12) para circular libremente por pasillos y esquinas
    this.boundingBox = { offsetX: 5, offsetY: 14, width: 14, height: 12 };

    this.channelTimer = 0;
    this.isChanneling = false;
    this.shockwaveCooldown = 9.0;
    this.shockwaves = [];
    this.clones = [];
    this.cloneThresholds = [Math.round(this.maxHp * 0.66), Math.round(this.maxHp * 0.33)];
    this.clonesTriggered = new Set();

    // Navegación inteligente y evasión de obstáculos A*
    this.path = [];
    this.pathGoal = null;
    this.repathTimer = 0;
    this.stuckTimer = 0;
    this.lastX = x;
    this.lastY = y;
  }

  resetCombatState() {
    super.resetCombatState();
    this.channelTimer = 0;
    this.isChanneling = false;
    this.shockwaveCooldown = 9.0;
    this.shockwaves = [];
    this.clones = [];
    this.cloneThresholds = [Math.round(this.maxHp * 0.66), Math.round(this.maxHp * 0.33)];
    this.clonesTriggered = new Set();
    this.path = [];
    this.pathGoal = null;
    this.repathTimer = 0;
    this.stuckTimer = 0;
  }

  triggerBossDefeat(player, soundEngine = null) {
    super.triggerBossDefeat(player, soundEngine);
    this.isChanneling = false;
    this.channelTimer = 0;
    this.shockwaves = [];
    this.clones = [];
    this.path = [];
  }

  takeSwordHit(player, soundEngine = null, customDamage = null, tilemap = null) {
    const prevHp = this.hp;
    const hit = super.takeSwordHit(player, soundEngine, customDamage);
    if (!hit) return false;

    // Dispara Llamada Recursiva al 66% y 33% de vida
    for (const thresh of this.cloneThresholds) {
      if (prevHp > thresh && this.hp <= thresh && !this.clonesTriggered.has(thresh) && this.hp > 0) {
        this.clonesTriggered.add(thresh);
        this.spawnRecursiveClones(soundEngine, tilemap);
        break;
      }
    }

    return true;
  }

  spawnRecursiveClones(soundEngine = null, tilemap = null) {
    this.statusText = '⚡ ¡LLAMADA RECURSIVA: fn() x 2!';
    for (let i = 0; i < 2; i++) {
      const offsetX = (i === 0 ? -1 : 1) * 20;
      let spawnX = this.centerX + offsetX;
      let spawnY = this.centerY + 8;
      if (tilemap && tilemap.isSolidAtTile(Math.floor(spawnX / 16), Math.floor(spawnY / 16))) {
        spawnX = this.centerX;
        spawnY = this.centerY;
      }
      this.clones.push({
        x: spawnX,
        y: spawnY,
        hp: 3,
        maxHp: 3,
        speed: 38,
        attackCooldown: 0,
        hitFlash: 0
      });
    }
    if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
      soundEngine.playEnemyHit();
    }
  }

  _ensureUnstuck(tilemap) {
    if (!tilemap) return;
    const box = this.worldBoundingBox;
    if (CollisionSystem.collidesWithMap(box, tilemap)) {
      const step = 4;
      const dirs = [
        [0, 1], [0, -1], [1, 0], [-1, 0],
        [1, 1], [-1, 1], [1, -1], [-1, -1]
      ];
      for (let r = 1; r <= 8; r++) {
        for (const [dx, dy] of dirs) {
          const testBox = {
            x: box.x + dx * r * step,
            y: box.y + dy * r * step,
            width: box.width,
            height: box.height
          };
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

  update(dt, tilemap, player, paused = false, soundEngine = null) {
    if (this.dead) {
      return super.update(dt, tilemap, player, paused, soundEngine);
    }

    this._ensureUnstuck(tilemap);
    super.update(dt, tilemap, player, paused, soundEngine);

    // Actualización de clones recursivos
    for (let i = this.clones.length - 1; i >= 0; i--) {
      const c = this.clones[i];
      if (c.hitFlash > 0) c.hitFlash -= dt;

      // Movimiento hacia el jugador con deslizamiento
      if (player && this.activeCombat) {
        const dx = player.centerX - c.x;
        const dy = player.centerY - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 6) {
          const vx = (dx / dist) * c.speed * dt;
          const vy = (dy / dist) * c.speed * dt;
          const cloneBox = { x: c.x - 4 + vx, y: c.y - 4 + vy, width: 8, height: 8 };
          if (tilemap && !CollisionSystem.collidesWithMap(cloneBox, tilemap)) {
            c.x += vx;
            c.y += vy;
          } else {
            const cloneBoxX = { x: c.x - 4 + vx, y: c.y - 4, width: 8, height: 8 };
            if (tilemap && !CollisionSystem.collidesWithMap(cloneBoxX, tilemap)) {
              c.x += vx;
            } else {
              const cloneBoxY = { x: c.x - 4, y: c.y - 4 + vy, width: 8, height: 8 };
              if (tilemap && !CollisionSystem.collidesWithMap(cloneBoxY, tilemap)) {
                c.y += vy;
              }
            }
          }
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
          const dmg = typeof player.getSwordDamage === 'function' ? player.getSwordDamage() : 1;
          c.hp -= dmg;
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

      // Persecución inteligente con A* Pathfinding y resolución de esquinas
      if (player && this.activeCombat) {
        const dist = Math.hypot(player.centerX - this.centerX, player.centerY - this.centerY);
        if (dist > 12) {
          this.repathTimer = Math.max(0, this.repathTimer - dt);

          const los = hasLineOfSight(tilemap, this.centerX, this.centerY, player.centerX, player.centerY);

          let steerX = 0;
          let steerY = 0;

          // Si hay línea de visión directa despejada y no estamos encallados, ir directo
          if (los && this.stuckTimer < 0.2) {
            const dx = player.centerX - this.centerX;
            const dy = player.centerY - this.centerY;
            steerX = dx / dist;
            steerY = dy / dist;
            this.path = [];
          } else {
            // Línea de visión bloqueada por obstáculo o atasco: calcular ruta A*
            const goalMoved =
              !this.pathGoal || Math.hypot(this.pathGoal.x - player.centerX, this.pathGoal.y - player.centerY) > 20;
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
              const dx = player.centerX - this.centerX;
              const dy = player.centerY - this.centerY;
              steerX = dx / dist;
              steerY = dy / dist;
            }
          }

          const moveRes = CollisionSystem.moveWithCollisions(
            this,
            steerX * this.speed * dt,
            steerY * this.speed * dt,
            tilemap,
            []
          );

          // Detección proactiva de atasco con deslizamiento angular
          const movedDist = Math.hypot(this.x - (this.lastX ?? this.x), this.y - (this.lastY ?? this.y));
          if (movedDist < 0.6 * dt * this.speed && (moveRes.blockedX || moveRes.blockedY)) {
            this.stuckTimer += dt;
            if (this.stuckTimer > 0.2) {
              this.repathTimer = 0;
              // Deslizamiento tangencial en el eje libre para rodear el obstáculo
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
        }

        // Contacto cuerpo a cuerpo
        if (dist <= 14 && this.attackCooldown <= 0) {
          this.attackCooldown = 0.85;
          player.takeHit(soundEngine);
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

