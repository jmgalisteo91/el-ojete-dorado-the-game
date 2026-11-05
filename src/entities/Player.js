import { Entity } from './Entity.js?v=7';
import { CollisionSystem } from '../physics/CollisionSystem.js?v=7';
import { SKILL_DEFS } from '../core/SkillCatalog.js?v=7';

const STAMINA_COSTS = { attack: 8, dash: 25, charged: 30, log: 15 };

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
    this.armorPoints = 0; // Hasta 3 impactos absorbidos por la Armadura Binaria
    this.hasSword = false;
    this.hasLanternEquipped = false;
    this.coins = 25;
    this.robotizationLevel = 0;
    this.robotizationTimer = 0;

    // Sistema de Forja y Progresión de Equipo (v3.6+)
    // Espada: 1=Base madera/hierro, 2=Silicio (+50% daño y quiebra barreras de cristal), 3=Overclockeada (+100% daño y tajos de energía a salud máx)
    this.swordLevel = 1;
    // Armadura: 1=Binaria base (3 corazones blindados), 2=Blindaje Térmico (inmunidad al calor ambiental de la Forja)
    this.armorLevel = 1;
    // Núcleos de Mazmorra para la Puerta Cuántica de AI Alex
    this.dungeonCores = { gc: false, stack: false, microwave: false };
    this.gatesUnlocked = 0;
    this.energySlashes = [];

    // Habilidades especiales desbloqueadas al vencer a los jefes regionales
    this.hasDash = false;            // Garbage Collector: Dash Asíncrono
    this.hasChargedAttack = false;   // Guardián del Stack Overflow: Corte en Cascada (Caso Base)
    this.hasBarrier = false;         // Microondas Prototipo: Barrera de Tipado Estricto

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

    // Stamina: el dash, los ataques y los logs consumen energía
    this.maxStamina = 100;
    this.stamina = 100;
    this.staminaRegenDelay = 0;

    // Combo de espada (3 golpes), ataque tras dash y parry
    this.comboStep = 0;
    this.comboTimer = 0;
    this.attackDamage = 1;
    this.attackIsFinisher = false;
    this.dashStrikeTimer = 0;
    this.attackIsDashStrike = false;
    this.parryTimer = 0;
    this.parryFlashTimer = 0;
    this.lastParryCount = 0;

    // Progresión
    this.skillPoints = 0;
    this.killCount = 0;
    this.skills = { vigor: false, filo: false, reflejo: false, log: false };
    this.thrownLogs = [];
    this.logCooldown = 0;
  }

  get effectiveMaxStamina() {
    return this.skills.vigor ? 140 : 100;
  }

  spendStamina(amount) {
    if (this.stamina < amount) return false;
    this.stamina -= amount;
    this.staminaRegenDelay = 0.6;
    return true;
  }

  getSwordDamage() {
    let dmg = this.attackDamage;

    // Progresión por Forja: Nivel 2 (+50%), Nivel 3 (+100%)
    if (this.swordLevel === 2) {
      dmg *= 1.5;
    } else if (this.swordLevel >= 3) {
      dmg *= 2.0;
    }

    // Si la robotización supera el 50%, la rigidez biomecánica penaliza un 30% el daño
    if (this.robotizationLevel > 50) {
      dmg *= 0.7;
    }
    return Math.round(dmg * 10) / 10;
  }

  /** Concede puntos de habilidad por derrotar enemigos. Devuelve los puntos ganados. */
  awardKill(isBoss = false) {
    this.killCount += 1;
    let gained = 0;
    if (isBoss) {
      gained = 2;
    } else if (this.killCount % 4 === 0) {
      gained = 1;
    }
    this.skillPoints += gained;
    return gained;
  }

  purchaseSkill(key) {
    const def = SKILL_DEFS.find((d) => d.key === key);
    if (!def || this.skills[key] || this.skillPoints < def.cost) return false;
    this.skillPoints -= def.cost;
    this.skills[key] = true;
    if (key === 'vigor') this.stamina = this.effectiveMaxStamina;
    return true;
  }

  throwLog(soundEngine = null) {
    if (!this.skills.log || this.logCooldown > 0 || !this.spendStamina(STAMINA_COSTS.log)) return false;
    const vec = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.direction] || [0, 1];
    this.thrownLogs.push({
      x: this.centerX,
      y: this.centerY,
      vx: vec[0] * 150,
      vy: vec[1] * 150,
      life: 1.1
    });
    this.logCooldown = 0.6;
    if (soundEngine && typeof soundEngine.playDashSound === 'function') {
      soundEngine.playDashSound();
    }
    return true;
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
    let max = this.maxHp;
    if (this.hasBrokenHeartCurse) {
      max = Math.max(0.5, max - 0.5);
    }
    // Superar el 80% de robotización bloquea el corazón derecho en error/estática
    if (this.robotizationLevel > 80) {
      max = Math.min(max, 2.0);
    }
    return max;
  }

  equipArmor() {
    this.hasArmor = true;
    this.armorPoints = this.robotizationLevel > 80 ? 2 : 3;
    this.hp = this.effectiveMaxHp;
    if (this.armoredAnimator) {
      this.animator = this.armoredAnimator;
    }
  }

  equipSword() {
    this.hasSword = true;
    if (!this.swordLevel || this.swordLevel < 1) {
      this.swordLevel = 1;
    }
  }

  applyArmorPotion() {
    if (!this.hasArmor) return false;
    this.armorPoints = this.robotizationLevel > 80 ? 2 : 3;
    return true;
  }

  unequipAllForNewGame() {
    this.hasArmor = false;
    this.armorPoints = 0;
    this.hasSword = false;
    this.swordLevel = 1;
    this.armorLevel = 1;
    this.dungeonCores = { gc: false, stack: false, microwave: false };
    this.gatesUnlocked = 0;
    this.energySlashes = [];
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
    this.stamina = this.maxStamina;
    this.comboStep = 0;
    this.comboTimer = 0;
    this.dashStrikeTimer = 0;
    this.parryTimer = 0;
    this.skillPoints = 0;
    this.killCount = 0;
    this.skills = { vigor: false, filo: false, reflejo: false, log: false };
    this.thrownLogs = [];
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
    if (!this.spendStamina(STAMINA_COSTS.attack)) return false;

    if (this.dashStrikeTimer > 0) {
      // Tajo tras dash: golpe de embestida de daño 2
      this.attackIsDashStrike = true;
      this.attackIsFinisher = false;
      this.attackDamage = 2;
      this.comboStep = 0;
      this.comboTimer = 0;
      this.dashStrikeTimer = 0;
      this.attackDuration = 0.26;
      this.attackCooldown = 0.4;
    } else {
      this.attackIsDashStrike = false;
      const step = this.comboTimer > 0 && this.comboStep < 3 ? this.comboStep + 1 : 1;
      this.comboStep = step;
      this.attackIsFinisher = step === 3;
      this.attackDamage = step === 3 ? (this.skills.filo ? 3 : 2) : 1;
      this.attackDuration = step === 3 ? 0.3 : 0.22;
      this.attackCooldown = step === 3 ? 0.5 : 0.26;
      this.comboTimer = step === 3 ? 0 : 0.75;
      if (step === 3) this.comboStep = 0;
    }
    this.attackTimer = this.attackDuration;

    // Espada Overclockeada (Nivel 3): Si la salud está al máximo, emite un tajo de energía a distancia
    if (this.swordLevel >= 3 && this.hp >= this.effectiveMaxHp) {
      const vec = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.direction] || [1, 0];
      this.energySlashes.push({
        x: this.centerX,
        y: this.centerY,
        vx: vec[0] * 230,
        vy: vec[1] * 230,
        direction: this.direction,
        damage: this.getSwordDamage(),
        life: 0.55,
        active: true
      });
    }

    if (soundEngine && typeof soundEngine.playSwordSlash === 'function') {
      soundEngine.playSwordSlash();
    }
    return true;
  }

  tryDash(input = null, soundEngine = null) {
    if (!this.hasDash || this.dashCooldown > 0) return false;
    if (!this.spendStamina(STAMINA_COSTS.dash)) return false;
    this.dashStrikeTimer = 0.55;

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
    if (!this.spendStamina(STAMINA_COSTS.charged)) return false;
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
    this.parryTimer = this.skills.reflejo ? 0.45 : 0.25;
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
    const bigSwing = this.attackIsFinisher || this.attackIsDashStrike;
    const reach = bigSwing ? 18 : 15;
    const size = bigSwing ? 24 : 18;
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
   * Recibe un impacto de combate.
   * Si el jugador está INDEFENSO (sin armadura), cualquier ataque reduce su vida a 0 inmediatamente.
   * Si porta la Armadura Binaria, los Corazones Blindados absorben hasta 3 impactos completos antes de pasar a corazones rojos.
   */
  takeHit(soundEngine = null, attacker = null) {
    if (this.invulnTimer > 0 || this.hp <= 0) return false;

    // Si la Barrera de Tipado Estricto está activa, absorbe completamente el daño
    if (this.barrierActive) {
      if (soundEngine && typeof soundEngine.playBarrier === 'function') {
        soundEngine.playBarrier();
      }
      // Parry perfecto: la barrera se activó justo antes del impacto
      if (this.parryTimer > 0) {
        this.parryTimer = 0;
        this.parryFlashTimer = 0.6;
        this.lastParryCount += 1;
        this.barrierCooldown = Math.min(this.barrierCooldown, 2.5);
        this.stamina = Math.min(this.effectiveMaxStamina, this.stamina + 40);
        if (attacker && typeof attacker.stun === 'function') {
          attacker.stun(1.4);
        }
        if (soundEngine && typeof soundEngine.playChargedAttack === 'function') {
          soundEngine.playChargedAttack();
        }
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
    } else if (this.armorPoints > 0) {
      // Coraza metálica absorbe el golpe completo
      this.armorPoints = Math.max(0, this.armorPoints - 1);
      this.invulnTimer = 0.9;
    } else {
      this.hp = Math.max(0, this.hp - 1);
      this.invulnTimer = 1.1;
    }
    return true;
  }

  /**
   * Recibe daño ambiental (ej. descarga estática del puzle booleano o desbordamiento de pila).
   * Respeta la coraza blindada si está activa y reduce vidas de medio en medio o enteras según el monto.
   */
  takeDamage(amount = 1, soundEngine = null) {
    if (this.invulnTimer > 0 || this.hp <= 0) return false;

    if (soundEngine && typeof soundEngine.playPlayerHurt === 'function') {
      soundEngine.playPlayerHurt();
    }

    if (!this.hasArmor) {
      this.hp = 0;
      this.invulnTimer = 1.0;
    } else if (this.armorPoints > 0) {
      this.armorPoints = Math.max(0, this.armorPoints - 1);
      this.invulnTimer = 0.85;
    } else {
      this.hp = Math.max(0, this.hp - amount * 0.5); // amount 1 = 0.5 corazones
      this.invulnTimer = 1.0;
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

    // Stamina, combo y temporizadores de habilidades
    this.maxStamina = this.effectiveMaxStamina;
    if (this.staminaRegenDelay > 0) {
      this.staminaRegenDelay = Math.max(0, this.staminaRegenDelay - dt);
    } else if (this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 35 * dt);
    }
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer === 0) this.comboStep = 0;
    }
    if (this.dashStrikeTimer > 0) this.dashStrikeTimer = Math.max(0, this.dashStrikeTimer - dt);
    if (this.parryTimer > 0) this.parryTimer = Math.max(0, this.parryTimer - dt);
    if (this.parryFlashTimer > 0) this.parryFlashTimer = Math.max(0, this.parryFlashTimer - dt);
    if (this.logCooldown > 0) this.logCooldown = Math.max(0, this.logCooldown - dt);
    this._updateThrownLogs(dt, tilemap);
    this._updateEnergySlashes(dt, tilemap);

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

    // console.log() arrojadizo (tecla R, requiere la habilidad)
    if (input && typeof input.consumeKey === 'function' && input.consumeKey('KeyR')) {
      this.throwLog(soundEngine);
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

  _updateThrownLogs(dt, tilemap) {
    for (let i = this.thrownLogs.length - 1; i >= 0; i--) {
      const l = this.thrownLogs[i];
      l.x += l.vx * dt;
      l.y += l.vy * dt;
      l.life -= dt;
      const box = { x: l.x - 2, y: l.y - 2, width: 4, height: 4 };
      if (l.life <= 0 || (tilemap && CollisionSystem.collidesWithMap(box, tilemap))) {
        this.thrownLogs.splice(i, 1);
      }
    }
  }

  _updateEnergySlashes(dt, tilemap) {
    for (let i = this.energySlashes.length - 1; i >= 0; i--) {
      const s = this.energySlashes[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      const box = { x: s.x - 3, y: s.y - 3, width: 6, height: 6 };
      if (s.life <= 0 || (tilemap && CollisionSystem.collidesWithMap(box, tilemap))) {
        this.energySlashes.splice(i, 1);
      }
    }
  }

  /**
   * Comprueba si el hitbox actual del jugador colisiona con el tilemap sólido y,
   * en caso afirmativo, lo reposiciona suavemente en la coordenada libre más cercana.
   */
  _ensureUnstuck(tilemap) {
    if (!tilemap) return;
    if (typeof tilemap.isSolidAtTile !== 'function') return;
    if (!CollisionSystem.collidesWithMap(this.getBoundingBoxAt(this.x, this.y), tilemap)) {
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
        const candBox = this.getBoundingBoxAt(candX, candY);
        if (!CollisionSystem.collidesWithMap(candBox, tilemap)) {
          this.x = candX;
          this.y = candY;
          return;
        }
      }
    }
  }

  render(ctx, camera) {
    // 0. console.log() arrojadizos
    if (this.thrownLogs.length > 0) {
      ctx.save();
      ctx.font = 'bold 5px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const l of this.thrownLogs) {
        const lx = Math.round(l.x - camera.renderX);
        const ly = Math.round(l.y - camera.renderY);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(lx - 7, ly - 3, 14, 7);
        ctx.strokeStyle = '#22c55e';
        ctx.strokeRect(lx - 6.5, ly - 2.5, 13, 6);
        ctx.fillStyle = '#4ade80';
        ctx.fillText('log', lx, ly + 0.5);
      }
      ctx.restore();
    }

    // Tajos de energía proyectados por la Espada Overclockeada (Nivel 3)
    if (this.energySlashes && this.energySlashes.length > 0) {
      ctx.save();
      for (const s of this.energySlashes) {
        const sx = Math.round(s.x - camera.renderX);
        const sy = Math.round(s.y - camera.renderY);
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (s.direction === 'up' || s.direction === 'down') {
          ctx.ellipse(sx, sy, 7, 3, 0, 0, Math.PI * 2);
        } else {
          ctx.ellipse(sx, sy, 3, 7, 0, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();

        // Destello de corona de energía
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      }
      ctx.restore();
    }

    // Aura de Blindaje Térmico (Armadura Nivel 2)
    if (this.hasArmor && this.armorLevel >= 2) {
      ctx.save();
      const px = Math.round(this.x - camera.renderX);
      const py = Math.round(this.y - camera.renderY);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 1.5, py + 1.5, 13, 14);
      ctx.restore();
    }

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
      // Arco de energía según nivel de espada y robotización
      const isMechanized = this.robotizationLevel > 50;
      let arcColor = 'rgba(251, 191, 36, 0.85)';
      let bladeColor = '#38bdf8';
      let edgeColor = '#ffffff';

      if (isMechanized) {
        arcColor = 'rgba(148, 163, 184, 0.85)';
        bladeColor = '#64748b';
        edgeColor = '#cbd5e1';
      } else if (this.swordLevel === 2) {
        // Espada de Silicio: filo de prisma cristalino cian/violeta
        arcColor = 'rgba(129, 140, 248, 0.9)';
        bladeColor = '#6366f1';
        edgeColor = '#c7d2fe';
      } else if (this.swordLevel >= 3) {
        // Espada Overclockeada: corona de plasma oro incandescente y cian
        arcColor = 'rgba(253, 224, 71, 0.95)';
        bladeColor = '#06b6d4';
        edgeColor = '#fef08a';
      }

      ctx.strokeStyle = arcColor;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, sweepStart, sweepEnd);
      ctx.stroke();

      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 15.5, sweepStart + 0.15, sweepEnd);
      ctx.stroke();

      // Hoja de la espada en el extremo del giro
      const tipX = cx + Math.cos(sweepEnd) * 16;
      const tipY = cy + Math.sin(sweepEnd) * 16;
      const hiltX = cx + Math.cos(sweepEnd) * 6;
      const hiltY = cy + Math.sin(sweepEnd) * 6;

      ctx.strokeStyle = bladeColor;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(hiltX, hiltY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(hiltX, hiltY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.restore();
    }
  }
}

