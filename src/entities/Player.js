import { Entity } from './Entity.js?v=6';
import { CollisionSystem } from '../physics/CollisionSystem.js?v=6';

/**
 * Entidad controlada por el jugador.
 * En el Primer Escenario empieza indefenso (sin armadura ni espada: cualquier ataque reduce su vida a 0).
 * Al conseguir la Armadura del Alba resiste ataques, y con la Espada del Alba puede atacar con [F] / [Espacio].
 */
export class Player extends Entity {
  constructor({ x, y, animator, armoredAnimator = null }) {
    super({
      x,
      y,
      width: 16,
      height: 16,
      speed: 74,
      boundingBox: { offsetX: 3, offsetY: 8, width: 10, height: 7 },
      animator
    });

    this.unarmoredAnimator = animator;
    this.armoredAnimator = armoredAnimator || animator;

    this.maxHp = 3;
    this.hp = 3;
    this.hasBrokenHeartCurse = false;
    this.hasArmor = false;
    this.hasSword = false;
    this.hasLanternEquipped = false;
    this.coins = 25;
    this.robotizationLevel = 0;
    this.robotizationTimer = 0;

    // Habilidades especiales desbloqueadas al vencer a los mini-bosses
    this.hasDash = false;            // Boss 1: Dash Asíncrono
    this.hasChargedAttack = false;   // Boss 2: Corte en Cascada (Caso Base)
    this.hasBarrier = false;         // Boss 3: Barrera de Tipado Estricto

    // Estados y cooldowns de habilidades
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashVx = 0;
    this.dashVy = 0;
    this.dashGhosts = [];

    this.chargeTimer = 0;
    this.spinAttackTimer = 0;
    this.spinAttackRadius = 34;

    this.barrierActive = false;
    this.barrierTimer = 0;
    this.barrierCooldown = 0;

    this.invulnTimer = 0;
    this.knockbackTimer = 0;
    this.attackTimer = 0;
    this.attackDuration = 0.22;
    this.attackCooldown = 0;
  }

  get invulnerableTimer() {
    return this.invulnTimer;
  }

  set invulnerableTimer(val) {
    this.invulnTimer = val;
  }

  stopMovement() {
    this.isMoving = false;
    this.chargeTimer = 0;
    this.dashTimer = 0;
  }

  get effectiveMaxHp() {
    return this.hasBrokenHeartCurse ? Math.max(0.5, this.maxHp - 0.5) : this.maxHp;
  }

  equipArmor() {
    this.hasArmor = true;
    this.hp = this.effectiveMaxHp;
    if (this.armoredAnimator) {
      this.animator = this.armoredAnimator;
    }
  }

  unequipAllForNewGame() {
    this.hasArmor = false;
    this.hasSword = false;
    this.hasBrokenHeartCurse = false;
    this.hasDash = false;
    this.hasChargedAttack = false;
    this.hasBarrier = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.chargeTimer = 0;
    this.spinAttackTimer = 0;
    this.barrierActive = false;
    this.barrierTimer = 0;
    this.barrierCooldown = 0;
    this.hp = this.maxHp;
    this.coins = 25;
    this.robotizationLevel = 0;
    this.invulnTimer = 0;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.animator = this.unarmoredAnimator;
  }

  inflictBrokenHeartCurse() {
    this.hasBrokenHeartCurse = true;
    if (this.hp > this.effectiveMaxHp) {
      this.hp = this.effectiveMaxHp;
    }
  }

  purifyBrokenHeartCurse() {
    this.hasBrokenHeartCurse = false;
    this.hp = this.maxHp;
  }

  cureRobotization() {
    this.robotizationLevel = 0;
  }

  takeCoffee(healHp = 1, robotReduction = 40) {
    this.hp = Math.min(this.effectiveMaxHp, this.hp + healHp);
    this.robotizationLevel = Math.max(0, this.robotizationLevel - robotReduction);
  }

  get isAttacking() {
    return this.attackTimer > 0;
  }

  tryAttack(soundEngine = null) {
    if (!this.hasSword || this.attackCooldown > 0) return false;
    this.attackTimer = this.attackDuration;
    this.attackCooldown = 0.32;
    if (soundEngine && typeof soundEngine.playSwordSlash === 'function') {
      soundEngine.playSwordSlash();
    }
    return true;
  }

  tryDash(input = null, soundEngine = null) {
    if (!this.hasDash || this.dashCooldown > 0) return false;

    let move = input ? input.getMovementVector() : { x: 0, y: 0 };
    if (move.x === 0 && move.y === 0) {
      if (this.direction === 'up') move = { x: 0, y: -1 };
      else if (this.direction === 'down') move = { x: 0, y: 1 };
      else if (this.direction === 'left') move = { x: -1, y: 0 };
      else move = { x: 1, y: 0 };
    }

    this.dashTimer = 0.18;
    this.dashCooldown = 0.85;
    this.invulnTimer = 0.22; // 0.2s invulnerabilidad
    const dashSpeed = 210;
    this.dashVx = move.x * dashSpeed;
    this.dashVy = move.y * dashSpeed;

    if (soundEngine && typeof soundEngine.playDashSound === 'function') {
      soundEngine.playDashSound();
    }
    return true;
  }

  tryChargedAttack(soundEngine = null) {
    if (!this.hasSword || !this.hasChargedAttack || this.attackCooldown > 0) return false;
    this.spinAttackTimer = 0.35;
    this.attackCooldown = 0.45;
    if (soundEngine && typeof soundEngine.playChargedAttack === 'function') {
      soundEngine.playChargedAttack();
    }
    return true;
  }

  tryBarrier(soundEngine = null) {
    if (!this.hasBarrier || this.barrierCooldown > 0) return false;
    this.barrierActive = true;
    this.barrierTimer = 3.0;
    this.barrierCooldown = 8.0;
    if (soundEngine && typeof soundEngine.playBarrier === 'function') {
      soundEngine.playBarrier();
    }
    return true;
  }

  getSpinHitbox() {
    if (this.spinAttackTimer <= 0) return null;
    return {
      centerX: this.centerX,
      centerY: this.centerY,
      radius: this.spinAttackRadius,
      damage: 3,
      isCharged: true
    };
  }

  getSwordHitbox() {
    if (!this.isAttacking) return null;
    const reach = 15;
    const size = 18;
    let hx = this.centerX - size / 2;
    let hy = this.centerY - size / 2;

    if (this.direction === 'up') {
      hy -= reach;
    } else if (this.direction === 'down') {
      hy += reach;
    } else if (this.direction === 'left') {
      hx -= reach;
    } else if (this.direction === 'right') {
      hx += reach;
    }

    return { x: hx, y: hy, width: size, height: size };
  }

  /**
   * Recibe un impacto enemigo.
   * Si el jugador está INDEFENSO (sin armadura), cualquier ataque reduce su vida a 0 inmediatamente.
   */
  takeHit(soundEngine = null) {
    if (this.invulnTimer > 0 || this.hp <= 0) return false;

    // Si la Barrera de Tipado Estricto está activa, absorbe completamente el daño
    if (this.barrierActive) {
      if (soundEngine && typeof soundEngine.playBarrier === 'function') {
        soundEngine.playBarrier();
      }
      return false;
    }

    if (soundEngine && typeof soundEngine.playPlayerHurt === 'function') {
      soundEngine.playPlayerHurt();
    }

    if (!this.hasArmor) {
      // Indefenso: cualquier golpe le quita toda la vida llegando a 0
      this.hp = 0;
      this.invulnTimer = 1.0;
    } else {
      this.hp = Math.max(0, this.hp - 1);
      this.invulnTimer = 1.1;
    }
    return true;
  }

  update(dt, input, tilemap, obstacles, movementLocked = false, soundEngine = null) {
    if (this.invulnTimer > 0) {
      this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    }
    if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - dt);
    }
    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    }
    if (this.dashCooldown > 0) {
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    }
    if (this.barrierCooldown > 0) {
      this.barrierCooldown = Math.max(0, this.barrierCooldown - dt);
    }
    if (this.spinAttackTimer > 0) {
      this.spinAttackTimer = Math.max(0, this.spinAttackTimer - dt);
    }

    // Actualización de la Barrera de Tipado Estricto
    if (this.barrierTimer > 0) {
      this.barrierTimer = Math.max(0, this.barrierTimer - dt);
      this.barrierActive = this.barrierTimer > 0;
    } else {
      this.barrierActive = false;
    }

    // Efecto de la Armadura del Código Binario: con el tiempo te robotiza
    // Si la barrera está activa, el blindaje frena el incremento de robotización
    if (this.hasArmor) {
      const robotRate = this.barrierActive ? 0.05 : 0.7;
      this.robotizationLevel = Math.min(100, this.robotizationLevel + dt * robotRate);
    } else if (this.robotizationLevel > 0) {
      this.robotizationLevel = Math.max(0, this.robotizationLevel - dt * 1.5);
    }

    this.animator = this.hasArmor ? this.armoredAnimator : this.unarmoredAnimator;

    // Actualización de fantasmas del Dash
    for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
      const g = this.dashGhosts[i];
      g.life -= dt;
      if (g.life <= 0) {
        this.dashGhosts.splice(i, 1);
      }
    }

    if (movementLocked) {
      this.isMoving = false;
      this.chargeTimer = 0;
      this.dashTimer = 0;
      super.update(dt);
      return;
    }

    // Autodesbloqueo preventivo: si el jugador quedó solapado con una baldosa sólida,
    // desplazarlo inmediatamente a la celda libre más cercana para que nunca quede pillado.
    this._ensureUnstuck(tilemap);

    // Ejecución de Dash Asíncrono
    if (input && typeof input.consumeDash === 'function' && input.consumeDash()) {
      this.tryDash(input, soundEngine);
    }

    // Ejecución de Barrera de Tipado Estricto (tecla Q)
    if (input && typeof input.consumeBarrier === 'function' && input.consumeBarrier()) {
      this.tryBarrier(soundEngine);
    }

    // Carga del Corte en Cascada (mantener botón de ataque 1s)
    if (this.hasChargedAttack && this.hasSword && input && typeof input.isAttackHeld === 'function') {
      if (input.isAttackHeld()) {
        this.chargeTimer += dt;
      } else if (this.chargeTimer >= 1.0) {
        this.tryChargedAttack(soundEngine);
        this.chargeTimer = 0;
      } else {
        this.chargeTimer = 0;
      }
    } else {
      this.chargeTimer = 0;
    }

    // Si está en pleno Dash Asíncrono, se desplaza a máxima velocidad y genera estela
    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      this.dashGhosts.push({
        x: this.x,
        y: this.y,
        direction: this.direction,
        life: 0.16,
        maxLife: 0.16
      });
      CollisionSystem.moveWithCollisions(
        this,
        this.dashVx * dt,
        this.dashVy * dt,
        tilemap,
        obstacles
      );
      super.update(dt);
      return;
    }

    const move = input.getMovementVector();
    this.isMoving = move.x !== 0 || move.y !== 0;

    if (this.isMoving) {
      if (Math.abs(move.x) >= Math.abs(move.y)) {
        this.direction = move.x > 0 ? 'right' : 'left';
      } else {
        this.direction = move.y > 0 ? 'down' : 'up';
      }

      // Si está altamente robotizado (>85%), los circuitos se ponen rígidos
      let effectiveSpeed = this.speed;
      if (this.robotizationLevel > 85) {
        effectiveSpeed *= 0.88;
      }

      const dx = move.x * effectiveSpeed * dt;
      const dy = move.y * effectiveSpeed * dt;
      CollisionSystem.moveWithCollisions(this, dx, dy, tilemap, obstacles);
    }

    super.update(dt);
  }

  /**
   * Comprueba si el hitbox actual del jugador colisiona con el tilemap sólido y,
   * en caso afirmativo, lo reposiciona suavemente en la coordenada libre más cercana.
   */
  _ensureUnstuck(tilemap) {
    if (!tilemap) return;
    const currentBox = this.getHitbox(this.x, this.y);
    if (!CollisionSystem.isAreaBlocked(currentBox, tilemap, [], this)) {
      return;
    }

    const dirs = [
      [0, 1], [0, -1], [1, 0], [-1, 0],
      [1, 1], [-1, 1], [1, -1], [-1, -1]
    ];
    for (let dist = 2; dist <= 48; dist += 2) {
      for (const [dx, dy] of dirs) {
        const candX = this.x + dx * dist;
        const candY = this.y + dy * dist;
        const candBox = this.getHitbox(candX, candY);
        if (!CollisionSystem.isAreaBlocked(candBox, tilemap, [], this)) {
          this.x = candX;
          this.y = candY;
          return;
        }
      }
    }
  }

  render(ctx, camera) {
    // 1. Estela visual traslúcida del Dash Asíncrono
    if (this.dashGhosts && this.dashGhosts.length > 0) {
      ctx.save();
      for (const g of this.dashGhosts) {
        const gx = g.x - camera.renderX;
        const gy = g.y - camera.renderY;
        const alpha = Math.max(0, (g.life / g.maxLife) * 0.45);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(gx + 2, gy + 3, this.width - 4, this.height - 4);
      }
      ctx.restore();
    }

    // Parpadeo cuando acaba de recibir daño
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 16) % 2 === 1) {
      return;
    }

    const cx = this.centerX - camera.renderX;
    const cy = this.centerY - camera.renderY;

    // 2. Aura de concentración de energía al cargar el Corte en Cascada
    if (this.chargeTimer > 0) {
      ctx.save();
      const chargePct = Math.min(1.0, this.chargeTimer / 1.0);
      const isReady = this.chargeTimer >= 1.0;
      const now = performance.now() / 1000;

      ctx.strokeStyle = isReady ? '#fde047' : '#38bdf8';
      ctx.lineWidth = isReady ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 11 + Math.sin(now * 12) * 2, 0, Math.PI * 2);
      ctx.stroke();

      if (isReady) {
        ctx.fillStyle = 'rgba(253, 224, 71, 0.25)';
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    super.render(ctx, camera);

    // 3. Efecto visual de la Armadura del Código Binario: bits flotantes (0 y 1)
    if (this.hasArmor && this.robotizationLevel > 15) {
      const now = performance.now() / 1000;
      ctx.save();
      ctx.font = '6px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 0 o 1 flotando sobre la cabeza del héroe
      const bit1 = Math.floor((now * 3) % 2);
      const bit2 = Math.floor((now * 3 + 1) % 2);
      const floatY1 = -10 + Math.sin(now * 4) * 2;
      const floatY2 = -14 + Math.cos(now * 3.5) * 2;

      ctx.fillStyle = this.robotizationLevel > 75 ? '#ef4444' : '#10b981';
      ctx.fillText(String(bit1), cx - 4, cy + floatY1);
      ctx.fillStyle = this.robotizationLevel > 75 ? '#f97316' : '#06b6d4';
      ctx.fillText(String(bit2), cx + 5, cy + floatY2);
      ctx.restore();
    }

    // 4. Renderizado del Corte en Cascada (Giro pesado de 360°)
    if (this.spinAttackTimer > 0) {
      ctx.save();
      const spinProgress = 1 - this.spinAttackTimer / 0.35;
      const spinRadius = 16 + spinProgress * (this.spinAttackRadius - 16);
      const now = performance.now() / 1000;

      ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(cx, cy, spinRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy, spinRadius - 3, 0, Math.PI * 2);
      ctx.stroke();

      // Destellos giratorios
      for (let i = 0; i < 4; i++) {
        const ang = now * 14 + (i * Math.PI) / 2;
        const sx = cx + Math.cos(ang) * spinRadius;
        const sy = cy + Math.sin(ang) * spinRadius;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 5. Barrera de Tipado Estricto (Campo de fuerza hexagonal cian)
    if (this.barrierActive) {
      ctx.save();
      const now = performance.now() / 1000;
      const barrierRadius = 15 + Math.sin(now * 6) * 1.5;

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.0;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = now * 2 + (i * Math.PI) / 3;
        const px = cx + Math.cos(angle) * barrierRadius;
        const py = cy + Math.sin(angle) * barrierRadius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.font = '5px monospace';
      ctx.fillStyle = '#e0f2fe';
      ctx.textAlign = 'center';
      ctx.fillText('typeof strict', cx, cy - barrierRadius - 3);
      ctx.restore();
    }

    // 6. Renderizar el tajo luminoso estándar de la Espada de la Recursividad
    if (this.attackTimer > 0) {
      const progress = 1 - this.attackTimer / this.attackDuration;

      let baseAngle = 0;
      if (this.direction === 'right') baseAngle = 0;
      else if (this.direction === 'down') baseAngle = Math.PI / 2;
      else if (this.direction === 'left') baseAngle = Math.PI;
      else if (this.direction === 'up') baseAngle = -Math.PI / 2;

      const sweepStart = baseAngle - 0.95;
      const sweepEnd = sweepStart + progress * 1.9;

      ctx.save();
      // Arco de energía dorada y cian estilo Zelda
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, sweepStart, sweepEnd);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 15.5, sweepStart + 0.15, sweepEnd);
      ctx.stroke();

      // Hoja de la espada en el extremo del giro
      const tipX = cx + Math.cos(sweepEnd) * 16;
      const tipY = cy + Math.sin(sweepEnd) * 16;
      const hiltX = cx + Math.cos(sweepEnd) * 6;
      const hiltY = cy + Math.sin(sweepEnd) * 6;

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(hiltX, hiltY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(hiltX, hiltY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.restore();
    }
  }
}

