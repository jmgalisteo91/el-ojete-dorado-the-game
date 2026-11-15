import { Boss } from './Boss.js?v=8';
import { CollisionSystem } from '../../physics/CollisionSystem.js?v=8';

/**
 * Jefe Regional: "El Garbage Collector Furioso" — El Monstruo de la Basura.
 * Fosa de la Memoria (sewers_dungeon).
 *
 * Fase 1:
 *  - Embestida horizontal telegrafiada 1 s.
 *  - 3 Objetos Perdidos que rebotan 2 veces en las paredes.
 *  - Ojo central que sigue al jugador; gotea aceite al moverse.
 * Fase 2 (50% HP):
 *  - Se come su basura: +50% de tamaño, mitad de velocidad.
 *  - La embestida deja un rastro de ácido.
 *  - Invoca 2 ratas de basura.
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

    this.phase = 1;
    this.phase2 = false;
    this.baseSpeed = 34;

    this.state = 'chase';
    this.acidTimer = 3.8;
    this.chargeCooldown = 7.0;
    this.stateTimer = 0;
    this.chargeVx = 0;
    this.chargeVy = 0;
    this.telegraphDir = 1;

    this.throwTimer = 3.6;
    this.throwWindup = 0;
    this.acidTrailTimer = 0;

    this.rats = [];
    this.oilParticles = [];
    this.oilTimer = 0;
    this.eyeDX = 0;
    this.eyeDY = 0;
  }

  resetCombatState() {
    super.resetCombatState();
    this.phase = 1;
    this.phase2 = false;
    this.width = 26;
    this.height = 26;
    this.boundingBox = { offsetX: 3, offsetY: 4, width: 20, height: 20 };
    this.speed = this.baseSpeed;
    this.state = 'chase';
    this.acidTimer = 3.8;
    this.chargeCooldown = 7.0;
    this.stateTimer = 0;
    this.chargeVx = 0;
    this.chargeVy = 0;
    this.throwTimer = 3.6;
    this.throwWindup = 0;
    this.acidTrailTimer = 0;
    this.rats = [];
    this.oilParticles = [];
    this.oilTimer = 0;
  }

  triggerBossDefeat(player, soundEngine = null) {
    super.triggerBossDefeat(player, soundEngine);
    this.rats = [];
    this.oilParticles = [];
    this.state = 'chase';
  }

  takeSwordHit(player, soundEngine = null, customDamage = null) {
    const hit = super.takeSwordHit(player, soundEngine, customDamage);
    if (!hit) return false;
    if (!this.phase2 && this.hp <= this.maxHp * 0.5 && !this.dead) {
      this._enterPhase2(soundEngine);
    }
    return true;
  }

  _enterPhase2(soundEngine = null) {
    this.phase = 2;
    this.phase2 = true;
    const cx = this.centerX;
    const cy = this.centerY;
    this.width = Math.round(this.width * 1.5);
    this.height = Math.round(this.height * 1.5);
    this.boundingBox = {
      offsetX: Math.round(this.width * 0.15),
      offsetY: Math.round(this.height * 0.15),
      width: Math.round(this.width * 0.7),
      height: Math.round(this.height * 0.7)
    };
    this.x = cx - this.width / 2;
    this.y = cy - this.height / 2;
    this._ensureUnstuck(this.arenaTilemap);
    this.speed = this.baseSpeed * 0.5;
    this.statusText = '🗑️ ¡SE COME SU PROPIA BASURA!';
    this.chargeCooldown = 4.0;
    this._spawnRats(2);
    if (soundEngine && typeof soundEngine.playHitHurt === 'function') {
      soundEngine.playHitHurt();
    }
  }

  _ensureUnstuck(tilemap) {
    if (!tilemap || typeof tilemap.isSolidAtTile !== 'function') return;
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
            return;
          }
        }
      }
    }
  }

  _spawnRats(count = 2) {
    for (let i = 0; i < count; i++) {
      this.rats.push({
        x: this.centerX + (i === 0 ? -34 : 34),
        y: this.centerY + 14,
        hp: 1,
        speed: 44,
        attackCooldown: 0,
        hitFlash: 0,
        facing: i === 0 ? 1 : -1
      });
    }
    this.statusText = '🐀 ¡RATAS DE BASURA!';
  }

  _throwGarbage(player) {
    const baseAngle = player
      ? Math.atan2(player.centerY - this.centerY, player.centerX - this.centerX)
      : -Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const angle = baseAngle + (i - 1) * 0.42;
      this.projectiles.push({
        x: this.centerX,
        y: this.centerY,
        vx: Math.cos(angle) * 72,
        vy: Math.sin(angle) * 72,
        radius: 5,
        life: 6.0,
        color: '#a16207',
        isGarbage: true,
        bounces: 2,
        label: '🗑'
      });
    }
    this.statusText = '🗑️ ¡OBJETOS PERDIDOS!';
  }

  _updateGarbageBounces(dt, tilemap) {
    if (!tilemap) return;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.isGarbage) continue;
      const tx = Math.floor(p.x / 16);
      const ty = Math.floor(p.y / 16);
      if (!tilemap.isSolidAtTile(tx, ty)) continue;
      p.vx = -p.vx;
      p.vy = -p.vy;
      p.x += p.vx * dt * 2;
      p.y += p.vy * dt * 2;
      p.bounces -= 1;
      if (p.bounces < 0) this.projectiles.splice(i, 1);
    }
  }

  _updateRats(dt, player, tilemap, soundEngine) {
    const sword = player && typeof player.getSwordHitbox === 'function' ? player.getSwordHitbox() : null;
    const spin = player && typeof player.getSpinHitbox === 'function' ? player.getSpinHitbox() : null;
    for (let i = this.rats.length - 1; i >= 0; i--) {
      const rat = this.rats[i];
      rat.attackCooldown = Math.max(0, rat.attackCooldown - dt);
      rat.hitFlash = Math.max(0, rat.hitFlash - dt);

      const box = { x: rat.x - 4, y: rat.y - 3, width: 8, height: 6 };
      const hitBySword = sword && CollisionSystem.checkAABB(sword, box);
      const hitBySpin = spin && Math.hypot(rat.x - spin.centerX, rat.y - spin.centerY) <= spin.radius + 5;
      if (hitBySword || hitBySpin) {
        rat.hp = 0;
        this.rats.splice(i, 1);
        continue;
      }

      if (!player) continue;
      const dx = player.centerX - rat.x;
      const dy = player.centerY - rat.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        rat.facing = dx >= 0 ? 1 : -1;
        const step = rat.speed * dt;
        rat.x += (dx / dist) * step;
        rat.y += (dy / dist) * step;
      }
      if (dist <= 9 && rat.attackCooldown <= 0) {
        rat.attackCooldown = 0.9;
        player.takeHit(soundEngine, this);
      }
    }
  }

  update(dt, tilemap, player, paused = false, soundEngine = null) {
    if (this.dead) return super.update(dt, tilemap, player, paused, soundEngine);

    super.update(dt, tilemap, player, paused, soundEngine);
    if (paused || this.dead) return { hitPlayer: false };

    if (player) {
      const ang = Math.atan2(player.centerY - this.centerY, player.centerX - this.centerX);
      this.eyeDX = Math.cos(ang) * 2.2;
      this.eyeDY = Math.sin(ang) * 2.2;
    }

    // Memory Leak: ácido residual.
    this.acidTimer -= dt;
    if (this.acidTimer <= 0 && this.activeCombat) {
      this.acidTimer = this.phase2 ? 2.4 + Math.random() : 3.2 + Math.random() * 1.5;
      this.hazardPuddles.push({
        x: this.centerX + (Math.random() - 0.5) * 16,
        y: this.centerY + (Math.random() - 0.5) * 16,
        radius: 11,
        life: 6.5,
        color: 'rgba(16, 185, 129, 0.45)',
        borderColor: '#10b981'
      });
    }

    // Objetos Perdidos con windup telegrafiado.
    if (this.throwWindup > 0) {
      this.throwWindup -= dt;
      if (this.throwWindup <= 0 && this.activeCombat) {
        this._throwGarbage(player);
        this.throwTimer = this.phase2 ? 5.2 : 4.2;
      }
    } else if (this.activeCombat) {
      this.throwTimer -= dt;
      if (this.throwTimer <= 0) {
        this.throwWindup = 0.35;
        this.statusText = '🗑️ PREPARANDO OBJETOS PERDIDOS...';
      }
    }

    this._updateGarbageBounces(dt, tilemap);

    if (this.state === 'chase') {
      this.chargeCooldown -= dt;
      if (player && this.activeCombat) {
        const dx = player.centerX - this.centerX;
        const dy = player.centerY - this.centerY;
        const dist = Math.hypot(dx, dy);
        if (dist > 8) {
          CollisionSystem.moveWithCollisions(
            this,
            (dx / dist) * this.speed * dt,
            (dy / dist) * this.speed * dt,
            tilemap,
            []
          );
          // Goteo de aceite al moverse.
          this.oilTimer -= dt;
          if (this.oilTimer <= 0) {
            this.oilTimer = 0.15;
            this.oilParticles.push({
              x: this.centerX + (Math.random() - 0.5) * this.width,
              y: this.centerY + this.height * 0.35,
              vx: (Math.random() - 0.5) * 10,
              vy: 8 + Math.random() * 8,
              life: 1.3,
              radius: 1.5 + Math.random() * 1.5
            });
          }
        }
        if (dist <= 14 && this.attackCooldown <= 0) {
          this.attackCooldown = 0.85;
          player.takeHit(soundEngine, this);
        }
      }
      if (this.chargeCooldown <= 0 && this.activeCombat && player) {
        this.state = 'telegraph';
        this.stateTimer = 1.0;
        this.telegraphDir = player.centerX >= this.centerX ? 1 : -1;
        this.statusText = '⚠️ ¡COMPACTANDO MEMORIA!';
      }
    } else if (this.state === 'telegraph') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'charge';
        this.stateTimer = 2.0;
        this.chargeElapsed = 0;
        this.acidTrailTimer = 0;
        this.statusText = '⚡ ¡EMBESTIDA HORIZONTAL!';
        this.chargeVx = this.telegraphDir * 210;
        this.chargeVy = 0;
        if (soundEngine && typeof soundEngine.playEnemyHit === 'function') {
          soundEngine.playEnemyHit();
        }
      }
    } else if (this.state === 'charge') {
      this.stateTimer -= dt;
      this.chargeElapsed = (this.chargeElapsed || 0) + dt;
      if (tilemap) this.arenaTilemap = tilemap;
      const { blockedX, blockedY } = CollisionSystem.moveWithCollisions(
        this,
        this.chargeVx * dt,
        0,
        tilemap,
        []
      );
      if (player && this.distanceTo(player) <= 15) {
        player.takeHit(soundEngine, this);
      }
      if (this.phase2) {
        this.acidTrailTimer -= dt;
        if (this.acidTrailTimer <= 0) {
          this.acidTrailTimer = 0.16;
          this.hazardPuddles.push({
            x: this.centerX,
            y: this.centerY + 8,
            radius: 10,
            life: 5.5,
            color: 'rgba(132, 204, 22, 0.4)',
            borderColor: '#84cc16'
          });
        }
      }
      if (((blockedX || blockedY) && this.chargeElapsed >= 0.12) || this.stateTimer <= 0) {
        this.state = 'stunned';
        this.stateTimer = 1.4;
        this.chargeCooldown = 8.0;
        this.statusText = '💫 ¡ATURDIDO! (¡VULNERABLE!)';
        if (soundEngine && typeof soundEngine.playMetalClink === 'function') {
          soundEngine.playMetalClink();
        }
      }
    } else if (this.state === 'stunned') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'chase';
        this.statusText = '';
      }
    }

    this._updateRats(dt, player, tilemap, soundEngine);

    for (let i = this.oilParticles.length - 1; i >= 0; i--) {
      const o = this.oilParticles[i];
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.life -= dt;
      if (o.life <= 0) this.oilParticles.splice(i, 1);
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
    const scale = this.phase2 ? 1.5 : 1.0;

    ctx.save();

    // Aceite derramado.
    for (const o of this.oilParticles) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.7, o.life / 1.3)})`;
      ctx.beginPath();
      ctx.arc(o.x - camera.renderX, o.y - camera.renderY, o.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Telegrafiado de embestida: línea horizontal de aviso.
    if (this.state === 'telegraph') {
      const dir = this.telegraphDir;
      const lineY = cy;
      ctx.strokeStyle = Math.floor(now * 14) % 2 === 0 ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, lineY);
      ctx.lineTo(cx + dir * 150, lineY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    // Telegraph de Objetos Perdidos.
    if (this.throwWindup > 0) {
      ctx.strokeStyle = Math.floor(now * 14) % 2 === 0 ? '#f59e0b' : '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 24 + Math.sin(now * 12) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Masa amorfa de basura.
    const blobs = [
      [0, 0, 13, '#374151'],
      [-8, -5, 9, '#4b5563'],
      [8, -4, 9, '#57534e'],
      [-6, 7, 8, '#292524'],
      [7, 7, 9, '#44403c'],
      [0, -9, 8, '#3f3f46'],
      [-12, 3, 6, '#52525b'],
      [12, 4, 6, '#3f3f46']
    ];
    for (const [dx, dy, r, color] of blobs) {
      ctx.fillStyle = this.hitFlashTimer > 0 ? '#f8fafc' : color;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Basura incrustada.
    ctx.fillStyle = '#78716c';
    ctx.fillRect(cx - 10, cy + 2, 4, 3);
    ctx.fillRect(cx + 5, cy - 7, 5, 3);
    ctx.fillStyle = '#a8a29e';
    ctx.fillRect(cx - 2, cy + 8, 6, 2);

    // Módulos de RAM quemada.
    for (const [rx, ry] of [[cx - 16, cy + 1], [cx + 6, cy - 9]]) {
      ctx.fillStyle = '#052e16';
      ctx.fillRect(rx, ry, 10, 3);
      ctx.fillStyle = '#a3a3a3';
      for (let pin = 0; pin < 5; pin++) ctx.fillRect(rx + pin * 2, ry + 3, 1, 1);
      ctx.fillStyle = '#111827';
      ctx.fillRect(rx + 2, ry + (ry < cy ? 0 : 2), 2, 1);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(rx + 7, ry, 1, 1);
    }

    // Ojo central rojo que sigue al jugador.
    ctx.fillStyle = '#450a0a';
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = Math.floor(now * 6) % 2 === 0 ? '#ef4444' : '#dc2626';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(cx + this.eyeDX, cy + this.eyeDY, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef2f2';
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 2, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Boca irregular con dientes.
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 6);
    ctx.lineTo(cx - 4, cy + 10);
    ctx.lineTo(cx, cy + 6);
    ctx.lineTo(cx + 4, cy + 10);
    ctx.lineTo(cx + 8, cy + 6);
    ctx.stroke();

    if (this.state === 'stunned') {
      ctx.font = '7px monospace';
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'center';
      const starOffset = Math.sin(now * 8) * 3;
      ctx.fillText('💫 💫', cx, cy - 16 + starOffset);
    }

    ctx.restore();

    // Ratas de basura.
    for (const rat of this.rats) {
      const rx = rat.x - camera.renderX;
      const ry = rat.y - camera.renderY;
      ctx.save();
      if (rat.hitFlash > 0) {
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = '#57534e';
      }
      ctx.beginPath();
      ctx.ellipse(rx, ry, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f3f46';
      ctx.beginPath();
      ctx.arc(rx + rat.facing * 5, ry - 1, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(rx + rat.facing * 5 - 1, ry - 2, 1.5, 1.5);
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx - rat.facing * 6, ry);
      ctx.lineTo(rx - rat.facing * 10, ry - 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
