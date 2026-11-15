import { Entity } from './Entity.js?v=8';
import { CollisionSystem } from '../physics/CollisionSystem.js?v=8';
import { SKILL_DEFS } from '../core/SkillCatalog.js?v=8';
import { GameLoop } from '../core/GameLoop.js?v=8';
import { EXPANSION_EQUIPMENT, EXPANSION_SKILLS, getExpansionEquipment } from '../expansion/ExpansionData.js?v=8';

const STAMINA_COSTS = { attack: 4, dash: 18, charged: 30, log: 15 };

/**
 * Umbrales acumulados de Experiencia (XP) para subir de Nivel (1 al 10).
 * Nivel 1: Inicio (0 XP)
 * Nivel 2: 50 XP (Habilita el Puente Oriental / Valle de la Consagración)
 * Nivel 3: 120 XP (Habilita las Marismas del Hardware Legacy · Cloacas del Dash Asíncrono)
 * Nivel 4: 220 XP (Habilita las Cumbres de la Recursión · Picos de Silicio)
 * Nivel 5: 350 XP
 * Nivel 6: 520 XP (Recomendado para La Forja del Prototipo · Microondas)
 * Nivel 7: 720 XP
 * Nivel 8: 980 XP (Habilita el Páramo Corrupto de Mister AI Alex)
 * Nivel 9: 1300 XP
 * Nivel 10: 1700 XP (Nivel Máximo · Habilita el asalto al Mainframe de la Ciudadela Cuántica)
 */
export const MAX_PLAYER_LEVEL = 15;

export const LEVEL_XP_THRESHOLDS = [
  0, 50, 120, 220, 350, 520, 720, 980, 1300, 1700, // Base (1-10)
  2200, 2800, 3500, 4300, 5200                     // Expansión (11-15)
];

export const XP_REWARDS = { enemy: 25, boss: 300 };

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
      speed: 86,
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

    // (FIX 1.4) Marca de jugador: CollisionSystem nunca lo empuja al separar entidades
    this.isPlayer = true;
    // (FIX 1.2) Contador monótono de impactos recibidos: main.js detecta el delta por frame
    this.damageTakenCount = 0;

    // Sistema de Forja y Progresión de Equipo (v3.6+)
    // Espada: 1=Base madera/hierro, 2=Silicio (+50% daño y quiebra barreras de cristal), 3=Overclockeada (+100% daño y tajos de energía a salud máx)
    this.swordLevel = 1;
    // Equipamiento corporativo (Expansión v2.0): modificadores sobre ataque, parry y mitigación
    this.equippedWeapon = 'default';
    this.equippedShield = null;
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
    this.dashSafeX = 0;
    this.dashSafeY = 0;
    this.dashOverrun = 0;

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
    this.levelStaminaBonus = 0;

    // Mejoras permanentes de la Tienda de Rosa (Expansión v2.0)
    this.rosaDamageBonus = 0;
    this.rosaStaminaBonus = 0;
    this.extraDashCharges = 0;
    this.dashChargesRemaining = 1;
    this.dashRechargeTimer = 0;
    this.burnoutTimer = 0;
    this.hotbar = [null, null, null, null, null];
    this.hotbarFlashTimers = [0, 0, 0, 0, 0];

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

    // Progresión y Niveles de Programador (Nivel 1 a 15)
    this.level = 1;
    this.xp = 0;
    this.skillPoints = 0;
    this.killCount = 0;
    this.skills = {
      vigor: false,
      filo: false,
      reflejo: false,
      log: false,
      ejecutivo: false,
      resiliencia: false,
      reciclaje: false,
      vigor_2: false,
      filo_2: false,
      reflejo_2: false,
      log_2: false
    };
    this.thrownLogs = [];
    this.logExplosions = [];
    this.activeFinisherAoe = null;
    this.logCooldown = 0;
    this.currentSceneId = 'overworld';
    this.lastKillCurriculumDrop = false;
  }

  /** Nivel 15 es el máximo: no hay más XP que ganar. */
  get isMaxLevel() {
    return this.level >= MAX_PLAYER_LEVEL;
  }

  /** Devuelve el umbral de XP necesario para ascender al siguiente nivel. */
  getNextLevelXp() {
    if (this.level >= MAX_PLAYER_LEVEL) return LEVEL_XP_THRESHOLDS[MAX_PLAYER_LEVEL - 1];
    return LEVEL_XP_THRESHOLDS[this.level];
  }

  /** Devuelve el umbral base de XP del nivel actual. */
  getCurrentLevelBaseXp() {
    return LEVEL_XP_THRESHOLDS[this.level - 1] || 0;
  }

  /** Devuelve el porcentaje de avance (0 a 100) en el nivel actual. */
  getXpProgressPercent() {
    if (this.level >= MAX_PLAYER_LEVEL) return 100;
    const base = this.getCurrentLevelBaseXp();
    const target = this.getNextLevelXp();
    const range = Math.max(1, target - base);
    const progress = Math.max(0, Math.min(range, this.xp - base));
    return Math.round((progress / range) * 100);
  }

  /** Concede experiencia y gestiona la subida de nivel y recompensas del programador (hasta Nv. 15). */
  gainXp(amount) {
    const maxXp = LEVEL_XP_THRESHOLDS[MAX_PLAYER_LEVEL - 1] || 5200;
    if (this.level >= MAX_PLAYER_LEVEL) {
      this.level = MAX_PLAYER_LEVEL;
      this.xp = Math.max(this.xp, maxXp);
      return { leveledUp: false, oldLevel: MAX_PLAYER_LEVEL, newLevel: MAX_PLAYER_LEVEL, rewards: [] };
    }
    const oldLevel = this.level;
    this.xp = Math.max(0, (this.xp || 0) + Math.max(0, amount));
    let leveledUp = false;
    const rewards = [];

    while (this.level < MAX_PLAYER_LEVEL && this.xp >= LEVEL_XP_THRESHOLDS[this.level]) {
      this.level += 1;
      leveledUp = true;

      if (this.level === 11) {
        this.skillPoints += 1;
        rewards.push('¡+1 Punto de Habilidad!');
      } else if (this.level === 12) {
        this.maxHp += 1;
        rewards.push('¡Corazón Máximo aumentado!');
      } else if (this.level === 14) {
        this.levelStaminaBonus = (this.levelStaminaBonus || 0) + 20;
        this.maxStamina = this.effectiveMaxStamina;
        rewards.push('¡Stamina Máxima aumentada!');
      } else if (this.level === 15) {
        this.maxHp += 1;
        rewards.push('¡Has alcanzado el rango de Leyenda de Valleverde!');
      }

      // Un jugador ya abatido en este mismo tick no debe resucitar por la subida de nivel
      if (this.hp > 0) {
        this.hp = this.level === 12 || this.level === 15 ? this.maxHp : this.effectiveMaxHp;
        this.stamina = this.level === 14 ? this.maxStamina : this.effectiveMaxStamina;
      }
    }
    return { leveledUp, oldLevel, newLevel: this.level, rewards };
  }

  get maxDashCharges() {
    return 1 + (this.extraDashCharges || 0);
  }

  get effectiveMaxStamina() {
    const base = this.skills.vigor_2 ? 180 : (this.skills.vigor ? 140 : 100);
    return base + (this.rosaStaminaBonus || 0) + (this.levelStaminaBonus || 0);
  }

  spendStamina(amount) {
    if (this.stamina < amount) return false;
    this.stamina -= amount;
    this.staminaRegenDelay = 0.3;
    return true;
  }

  getSwordDamage(target = null) {
    const corpWeapon =
      this.equippedWeapon && this.equippedWeapon !== 'default'
        ? EXPANSION_EQUIPMENT[this.equippedWeapon]
        : null;
    let dmg = corpWeapon && corpWeapon.slot === 'weapon'
      ? corpWeapon.baseDamage
      : (!this.hasSword ? 1 : this.attackDamage);

    // Progresión por Forja: Nivel 2 (+50%), Nivel 3 (+100%) sobre arma estándar
    if (!corpWeapon && this.hasSword) {
      if (this.swordLevel === 2) {
        dmg *= 1.5;
      } else if (this.swordLevel >= 3) {
        dmg *= 2.0;
      }
    }

    if (this.rosaDamageBonus > 0) {
      dmg *= 1 + this.rosaDamageBonus;
    }

    // Ejecutivo: +15% de daño contra jefes
    if (this.skills?.ejecutivo && target && target.isBoss) {
      dmg *= 1.15;
    }

    // Si la robotización supera el 50%, la rigidez biomecánica penaliza un 30% el daño
    if (this.robotizationLevel > 50) {
      dmg *= 0.7;
    }
    return Math.round(dmg * 100) / 100;
  }

  getEquippedWeaponInfo() {
    if (!this.equippedWeapon || this.equippedWeapon === 'default') return null;
    return getExpansionEquipment(this.equippedWeapon);
  }

  getEquippedShieldInfo() {
    if (!this.equippedShield) return null;
    return getExpansionEquipment(this.equippedShield);
  }

  /**
   * Equipa un arma o escudo corporativo de `EXPANSION_EQUIPMENT` (por id o itemId).
   */
  equipExpansionItem(idOrItemId) {
    const eq = getExpansionEquipment(idOrItemId);
    if (!eq) return null;
    if (eq.slot === 'weapon') {
      this.equippedWeapon = eq.id;
      this.attackDamage = eq.baseDamage;
      this.hasSword = true;
      return eq;
    }
    if (eq.slot === 'shield') {
      this.equippedShield = eq.id;
      this.hasBarrier = true;
      return eq;
    }
    return null;
  }

  /** Concede puntos de habilidad y XP por derrotar enemigos. Devuelve los puntos ganados. */
  awardKill(isBoss = false, xpOverride = null, rng = Math.random) {
    this.killCount += 1;
    let gained = 0;
    if (isBoss) {
      gained = 2;
    } else if (this.killCount % 4 === 0) {
      gained = 1;
    }
    this.skillPoints += gained;
    // Reciclaje: 10% de probabilidad de generar un Currículum extra al derrotar enemigos
    this.lastKillCurriculumDrop = Boolean(this.skills?.reciclaje && rng() < 0.10);
    const xpAmount = Number.isFinite(xpOverride) ? xpOverride : (isBoss ? XP_REWARDS.boss : XP_REWARDS.enemy);
    const xpRes = this.gainXp(xpAmount);
    this.lastLevelRewards = xpRes.rewards || [];
    return gained;
  }

  purchaseSkill(key) {
    const def = SKILL_DEFS.find((d) => d.key === key) || EXPANSION_SKILLS[key];
    if (!def || this.skills[key] || this.skillPoints < def.cost) return false;
    if (def.requires && !this.skills[def.requires]) return false;
    this.skillPoints -= def.cost;
    this.skills[key] = true;
    if (key === 'vigor' || key === 'vigor_2') {
      this.maxStamina = this.effectiveMaxStamina;
      this.stamina = this.effectiveMaxStamina;
    }
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

  reset() {
    this.unequipAllForNewGame();
  }

  unequipAllForNewGame() {
    this.hasArmor = false;
    this.armorPoints = 0;
    this.hasSword = false;
    this.swordLevel = 1;
    this.equippedWeapon = 'default';
    this.equippedShield = null;
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
    this.maxHp = 3;
    this.hp = this.maxHp;
    this.coins = 25;
    this.robotizationLevel = 0;
    this.damageTakenCount = 0;
    this.invulnTimer = 0;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.levelStaminaBonus = 0;
    this.maxStamina = this.effectiveMaxStamina;
    this.stamina = this.maxStamina;
    this.comboStep = 0;
    this.comboTimer = 0;
    this.dashStrikeTimer = 0;
    this.parryTimer = 0;
    this.skillPoints = 0;
    this.killCount = 0;
    this.level = 1;
    this.xp = 0;
    this.skills = {
      vigor: false,
      filo: false,
      reflejo: false,
      log: false,
      ejecutivo: false,
      resiliencia: false,
      reciclaje: false,
      vigor_2: false,
      filo_2: false,
      reflejo_2: false,
      log_2: false
    };
    this.thrownLogs = [];
    this.logExplosions = [];
    this.activeFinisherAoe = null;
    this.lastKillCurriculumDrop = false;
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
    this.hp = this.effectiveMaxHp;
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
    if (this.attackCooldown > 0) return false;
    if (!this.spendStamina(STAMINA_COSTS.attack)) return false;

    const corpWeapon =
      this.equippedWeapon && this.equippedWeapon !== 'default'
        ? EXPANSION_EQUIPMENT[this.equippedWeapon]
        : null;

    if (!this.hasSword && !corpWeapon) {
      // Golpe o puñetazo desarmado básico para entrenamiento inicial
      this.attackIsDashStrike = false;
      this.attackIsFinisher = false;
      this.attackDamage = 1;
      this.comboStep = 1;
      this.comboTimer = 0;
      this.attackDuration = 0.18;
      this.attackCooldown = 0.28;
      this.attackTimer = this.attackDuration;
      // (FIX ESTRICTO) Sin espada no puede existir ni un tajo de energía residual.
      this.energySlashes.length = 0;
      if (soundEngine && typeof soundEngine.playPunch === 'function') {
        soundEngine.playPunch();
      } else if (soundEngine && typeof soundEngine.playAttackSound === 'function') {
        soundEngine.playAttackSound();
      } else if (soundEngine && typeof soundEngine.playSwordSlash === 'function') {
        soundEngine.playSwordSlash();
      }
      return true;
    }

    if (corpWeapon && corpWeapon.slot === 'weapon') {
      // Modificadores de arma corporativa (Expansión v2.0)
      this.hasSword = true;
      this.attackIsDashStrike = this.dashStrikeTimer > 0;
      if (this.dashStrikeTimer > 0) this.dashStrikeTimer = 0;
      const step = this.comboTimer > 0 && this.comboStep < 3 ? this.comboStep + 1 : 1;
      this.comboStep = step;
      this.attackIsFinisher = step === 3;
      this.attackDamage = corpWeapon.baseDamage;
      this.attackDuration = corpWeapon.attackDuration || 0.22;
      this.attackCooldown = corpWeapon.cooldown;
      this.comboTimer = step === 3 ? 0 : 1.0;
      if (step === 3) this.comboStep = 0;

      // Grapadora Industrial: cada 3er golpe dispara una grapa como proyectil en energySlashes
      if (corpWeapon.effect === 'staple_every_3' && step === 3) {
        const vec = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.direction] || [1, 0];
        this.energySlashes.push({
          kind: 'staple',
          x: this.centerX,
          y: this.centerY,
          vx: vec[0] * 240,
          vy: vec[1] * 240,
          direction: this.direction,
          damage: this.getSwordDamage(),
          life: 0.65,
          active: true
        });
      }
    } else if (this.dashStrikeTimer > 0) {
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

    // Filo II: El ataque final del combo (finisher) genera pulso AoE de radio 24px (daño 1)
    if (this.attackIsFinisher && this.skills?.filo_2) {
      this.activeFinisherAoe = {
        x: this.centerX,
        y: this.centerY,
        radius: 24,
        damage: 1,
        timer: 0.22,
        maxTimer: 0.22,
        hitSet: new Set()
      };
    }

    // Espada Overclockeada (Nivel 3): Si la salud está al máximo, emite un tajo de energía a distancia.
    // (FIX ESTRICTO) Doble guarda: sin espada este bloque NUNCA puede ejecutarse.
    if (!corpWeapon && this.hasSword && this.swordLevel >= 3 && this.hp >= this.effectiveMaxHp) {
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
    if (!this.hasDash || this.dashTimer > 0) return false;
    const totalCharges = this.maxDashCharges;
    if (totalCharges <= 1) {
      if (this.dashCooldown > 0) return false;
    } else {
      if (this.dashChargesRemaining <= 0) return false;
    }
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
    if (totalCharges <= 1) {
      this.dashCooldown = 0.85;
    } else {
      this.dashChargesRemaining = Math.max(0, this.dashChargesRemaining - 1);
      this.dashRechargeTimer = 0.85;
      this.dashCooldown = this.dashChargesRemaining <= 0 ? 0.85 : 0;
    }
    this.dashSafeX = this.x;
    this.dashSafeY = this.y;
    this.dashOverrun = 0;
    // No acortar una invulnerabilidad más larga ya activa (p. ej. tras recibir daño)
    this.invulnTimer = Math.max(this.invulnTimer, 0.22);
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
    // (FIX 3.7) Ventana de parry legible contra un windup de 0.30s (+0.2s con Escudo del Becario)
    const baseParryWindow = this.skills.reflejo ? 0.35 : 0.20;
    const shieldBonus = this.equippedShield === 'escudo_becario' ? 0.20 : 0;
    this.parryTimer = baseParryWindow + shieldBonus;
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
    // (FIX 6) El puñetazo usa la misma caja que el primer golpe de espada.
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

  _isDungeonOrNucleusScene(sid = '') {
    if (!sid || typeof sid !== 'string') return false;
    return (
      sid.startsWith('sewers') ||
      sid.startsWith('mines') ||
      sid.startsWith('forge') ||
      sid.startsWith('vertedero_') ||
      sid === 'sword_temple' ||
      sid === 'armor_temple' ||
      sid === 'ai_citadel' ||
      sid === 'ai_fortress_gate' ||
      sid === 'kernel_arena' ||
      sid === 'ai_nucleus_core' ||
      sid.includes('dungeon') ||
      sid.includes('nucleus')
    );
  }

  _computeIncomingBaseDamage(attacker = null, customDamage = null) {
    if (customDamage !== null && customDamage !== undefined) {
      return customDamage;
    }
    const sid = attacker?.sceneId || this.currentSceneId || '';
    let dmg;
    if (sid === 'overworld' || sid === 'first_stage') dmg = 1.0;
    else if (sid === 'north_peaks' || sid === 'south_swamp' || sid === 'west_wastes') dmg = 1.5;
    else if (sid === 'ai_citadel') dmg = (this.armorLevel >= 2) ? 2.0 : 2.5;
    else if (
      sid.startsWith('sewers') ||
      sid.startsWith('mines') ||
      sid.startsWith('forge') ||
      sid === 'sword_temple' ||
      sid === 'ai_fortress_gate'
    ) {
      dmg = (this.armorLevel >= 2) ? 1.5 : 2.0;
    } else {
      dmg = 1.0;
    }
    if (attacker?.isBoss) dmg = Math.max(dmg, 1.0);
    return dmg;
  }

  /**
   * Recibe un impacto de combate.
   * (FIX 3.6) El daño escala por zona en múltiplos de 0.5 corazones.
   * (FIX 3.7) i-frames reducidos y parry más generoso.
   * `attacker` se mantiene como 2º argumento: los tests y las llamadas existentes dependen de ello.
   */
  takeHit(soundEngine = null, attacker = null, customDamage = null) {
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
        // Reflejo II: el parry devuelve un 50% del daño absorbido al enemigo (antes de aturdirlo)
        if (this.skills?.reflejo_2 && attacker && typeof attacker.takeSwordHit === 'function') {
          const absorbed = this._computeIncomingBaseDamage(attacker, customDamage);
          const reflectedDamage = Math.round(absorbed * 0.5 * 100) / 100;
          if (reflectedDamage > 0) {
            attacker.takeSwordHit(this, soundEngine, reflectedDamage);
          }
        }
        if (attacker && typeof attacker.stun === 'function') {
          attacker.stun(1.4);
        }
        // Carpeta de Plástico: al hacer parry ralentiza al enemigo durante 2s
        if (this.equippedShield === 'carpeta' && attacker && typeof attacker.applySlow === 'function') {
          attacker.applySlow(2.0, 0.45);
        }
        if (soundEngine && typeof soundEngine.playChargedAttack === 'function') {
          soundEngine.playChargedAttack();
        }
        // (FIX 1.1) El parry es el impacto más contundente: 4 frames de freeze
        GameLoop.triggerHitstop(4);
      }
      return false;
    }

    if (soundEngine && typeof soundEngine.playPlayerHurt === 'function') {
      soundEngine.playPlayerHurt();
    }

    // (FIX 3.6 / C.2) Daño por zona, en múltiplos de 0.5 corazones
    let dmg = this._computeIncomingBaseDamage(attacker, customDamage);

    // Resiliencia: reduce el daño recibido en mazmorras y en el Núcleo en un 15%
    const sceneForHit = attacker?.sceneId || this.currentSceneId || '';
    if (this.skills?.resiliencia && this._isDungeonOrNucleusScene(sceneForHit)) {
      dmg = Math.round(dmg * 0.85 * 100) / 100;
    }

    // (FIX C.1) La coraza absorbe hasta 1.0 de daño por punto; Carpeta de Plástico mitiga 0.5 corazones pasivamente.
    if (this.equippedShield === 'carpeta') {
      dmg = Math.max(0, dmg - 0.5);
    }
    // armorPoints sigue siendo entero: se decrementa 1 por golpe absorbido.
    if (this.hasArmor && this.armorPoints > 0) {
      const absorbed = Math.min(1.0, dmg);
      dmg = Math.max(0, dmg - absorbed);
      this.armorPoints = Math.max(0, this.armorPoints - 1);
      this.invulnTimer = 0.60;
    } else if (this.hasArmor) {
      this.invulnTimer = 0.75;
    } else {
      this.invulnTimer = 0.70;
    }

    this.hp = Math.max(0, this.hp - dmg);
    // (FIX 1.1) Freeze frames al recibir daño; (FIX 1.2) main.js lee este contador para el shake
    this.damageTakenCount += 1;
    GameLoop.triggerHitstop(4);
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

    if (this.armorPoints > 0) {
      this.armorPoints = Math.max(0, this.armorPoints - 1);
      this.invulnTimer = 0.85;
    } else {
      this.hp = Math.max(0, this.hp - 0.5 * amount); // amount 1 = 0.5 corazones
      this.invulnTimer = 1.0;
    }
    return true;
  }

  update(dt, input, tilemap, obstacles, movementLocked = false, soundEngine = null) {
    // (REFACTOR 2) El knockback de puertas se consume y bloquea el input de movimiento.
    if (this.knockbackTimer > 0) {
      this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
    }
    const movementHardLocked = movementLocked || this.knockbackTimer > 0;
    if (this.invulnTimer > 0) {
      this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    }
    if (this.burnoutTimer > 0) {
      this.burnoutTimer = Math.max(0, this.burnoutTimer - dt);
    }
    if (Array.isArray(this.hotbarFlashTimers)) {
      for (let i = 0; i < this.hotbarFlashTimers.length; i++) {
        if (this.hotbarFlashTimers[i] > 0) {
          this.hotbarFlashTimers[i] = Math.max(0, this.hotbarFlashTimers[i] - dt);
        }
      }
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
    if (this.maxDashCharges > 1 && this.dashChargesRemaining < this.maxDashCharges) {
      if (this.dashRechargeTimer > 0) {
        this.dashRechargeTimer = Math.max(0, this.dashRechargeTimer - dt);
      }
      if (this.dashRechargeTimer === 0) {
        this.dashChargesRemaining = this.maxDashCharges;
      }
    } else if (this.maxDashCharges <= 1) {
      this.dashChargesRemaining = this.dashCooldown > 0 ? 0 : 1;
    }
    if (this.barrierCooldown > 0) {
      this.barrierCooldown = Math.max(0, this.barrierCooldown - dt);
    }
    if (this.spinAttackTimer > 0) {
      this.spinAttackTimer = Math.max(0, this.spinAttackTimer - dt);
    }
    if (this.hp > this.effectiveMaxHp) {
      this.hp = this.effectiveMaxHp;
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
    this._updateLogExplosions(dt);
    this._updateEnergySlashes(dt, tilemap);
    if (this.activeFinisherAoe) {
      this.activeFinisherAoe.timer -= dt;
      if (this.activeFinisherAoe.timer <= 0) {
        this.activeFinisherAoe = null;
      }
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
      const robotRate = this.barrierActive ? 0.02 : 0.12;
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

    // Permitir cancelar el knockback/hitstun con Dash (si no hay menú/diálogo bloqueando el movimiento).
    if (!movementLocked && input && typeof input.consumeDash === 'function' && input.consumeDash()) {
      if (this.tryDash(input, soundEngine)) {
        this.knockbackTimer = 0;
      }
    }

    if (movementLocked || (this.knockbackTimer > 0 && this.dashTimer <= 0)) {
      this.isMoving = false;
      this.chargeTimer = 0;
      this.dashTimer = 0;
      super.update(dt);
      return;
    }

    // Autodesbloqueo preventivo: si el jugador quedó solapado con una baldosa sólida o un NPC,
    // desplazarlo inmediatamente a la celda libre más cercana para que nunca quede pillado.
    // Durante el Dash se omite: el impulso puede estar sobrevolando un abismo legítimamente.
    if (this.dashTimer <= 0) {
      this._ensureUnstuck(tilemap, obstacles);
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
      const canCrossChasm = Boolean(tilemap && 'allowChasmCrossing' in tilemap);
      if (canCrossChasm) tilemap.allowChasmCrossing = true;
      // (FIX NPC.4) El Dash es una maniobra de combate: no la frenan aldeanos ni animales
      const dashObstacles = Array.isArray(obstacles)
        ? obstacles.filter((o) => o && !o.isNpc && !o.isAnimal)
        : obstacles;
      const { blockedX, blockedY } = CollisionSystem.moveWithCollisions(
        this,
        this.dashVx * dt,
        this.dashVy * dt,
        tilemap,
        dashObstacles
      );
      if (canCrossChasm) {
        tilemap.allowChasmCrossing = false;
        this._resolveChasmLanding(dt, tilemap, blockedX || blockedY);
      }
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
      if (this.burnoutTimer > 0) {
        effectiveSpeed *= 0.52;
      }

      const dx = move.x * effectiveSpeed * dt;
      const dy = move.y * effectiveSpeed * dt;
      CollisionSystem.moveWithCollisions(this, dx, dy, tilemap, obstacles);
    }

    super.update(dt);
  }

  /**
   * Al terminar el Dash sobre un abismo, prolonga el impulso hasta aterrizar en suelo firme;
   * si choca o el impulso se agota, regresa al punto de despegue.
   */
  _resolveChasmLanding(dt, tilemap, blocked) {
    if (this.dashTimer > 0) return;
    if (!CollisionSystem.collidesWithMap(this.getBoundingBoxAt(this.x, this.y), tilemap)) {
      this.dashOverrun = 0;
      return;
    }
    this.dashOverrun += dt;
    if (blocked || this.dashOverrun > 0.3) {
      this.x = this.dashSafeX;
      this.y = this.dashSafeY;
      this.dashOverrun = 0;
    } else {
      this.dashTimer = dt;
    }
  }

  triggerLogExplosion(x, y, radius = 20, damage = 1, sourceEnemy = null) {
    if (!this.skills?.log_2) return null;
    const hitSet = new Set();
    if (sourceEnemy) hitSet.add(sourceEnemy);
    const exp = {
      kind: 'log_explosion',
      x,
      y,
      radius,
      damage,
      life: 0.28,
      maxLife: 0.28,
      hitSet
    };
    this.logExplosions.push(exp);
    return exp;
  }

  _updateLogExplosions(dt) {
    if (!Array.isArray(this.logExplosions)) return;
    for (let i = this.logExplosions.length - 1; i >= 0; i--) {
      this.logExplosions[i].life -= dt;
      if (this.logExplosions[i].life <= 0) {
        this.logExplosions.splice(i, 1);
      }
    }
  }

  applyFilo2AoE(enemies, soundEngine = null) {
    if (!this.activeFinisherAoe || !Array.isArray(enemies)) return 0;
    const pulse = this.activeFinisherAoe;
    let hits = 0;
    for (const enemy of enemies) {
      if (!enemy || enemy.dead || pulse.hitSet.has(enemy)) continue;
      const dist = Math.hypot((enemy.centerX ?? enemy.x) - pulse.x, (enemy.centerY ?? enemy.y) - pulse.y);
      if (dist <= pulse.radius) {
        pulse.hitSet.add(enemy);
        if (typeof enemy.takeSwordHit === 'function' && enemy.takeSwordHit(this, soundEngine, pulse.damage)) {
          hits += 1;
        }
      }
    }
    return hits;
  }

  applyLogExplosionDamage(enemies, soundEngine = null) {
    if (!Array.isArray(this.logExplosions) || this.logExplosions.length === 0 || !Array.isArray(enemies)) return 0;
    let hits = 0;
    for (const exp of this.logExplosions) {
      if (exp.life <= 0) continue;
      for (const enemy of enemies) {
        if (!enemy || enemy.dead || exp.hitSet.has(enemy)) continue;
        const dist = Math.hypot((enemy.centerX ?? enemy.x) - exp.x, (enemy.centerY ?? enemy.y) - exp.y);
        if (dist <= exp.radius) {
          exp.hitSet.add(enemy);
          if (typeof enemy.takeSwordHit === 'function' && enemy.takeSwordHit(this, soundEngine, exp.damage)) {
            hits += 1;
          }
        }
      }
    }
    return hits;
  }

  _updateThrownLogs(dt, tilemap) {
    for (let i = this.thrownLogs.length - 1; i >= 0; i--) {
      const l = this.thrownLogs[i];
      l.x += l.vx * dt;
      l.y += l.vy * dt;
      l.life -= dt;
      const box = { x: l.x - 2, y: l.y - 2, width: 4, height: 4 };
      const hitWall = Boolean(tilemap && CollisionSystem.collidesWithMap(box, tilemap));
      if (l.life <= 0 || hitWall) {
        if (hitWall && this.skills?.log_2) {
          this.triggerLogExplosion(l.x, l.y, 20, 1);
        }
        this.thrownLogs.splice(i, 1);
      }
    }
  }

  _updateEnergySlashes(dt, tilemap) {
    // (FIX ESTRICTO) Sin espada no se actualizan proyectiles de energía.
    if (!this.hasSword) {
      this.energySlashes.length = 0;
      return;
    }
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
  _ensureUnstuck(tilemap, obstacles = []) {
    // 1. Separación de obstáculos de mapa
    if (tilemap && typeof tilemap.isSolidAtTile === 'function') {
      if (CollisionSystem.collidesWithMap(this.getBoundingBoxAt(this.x, this.y), tilemap)) {
        const dirs = [
          [0, 1], [0, -1], [1, 0], [-1, 0],
          [1, 1], [-1, 1], [1, -1], [-1, -1]
        ];
        for (let dist = 2; dist <= 48; dist += 2) {
          let resolved = false;
          for (const [dx, dy] of dirs) {
            const candX = this.x + dx * dist;
            const candY = this.y + dy * dist;
            const candBox = this.getBoundingBoxAt(candX, candY);
            if (!CollisionSystem.collidesWithMap(candBox, tilemap)) {
              this.x = candX;
              this.y = candY;
              resolved = true;
              break;
            }
          }
          if (resolved) break;
        }
      }
    }

    // 2. Separación de entidades dinámicas (NPCs, animales)
    if (Array.isArray(obstacles) && obstacles.length > 0) {
      CollisionSystem.resolveEntitySeparation(this, obstacles, tilemap);
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

    // 0b. Explosiones AoE de Log II y onda expansiva de Filo II
    if (Array.isArray(this.logExplosions) && this.logExplosions.length > 0) {
      ctx.save();
      for (const exp of this.logExplosions) {
        const pct = Math.max(0, Math.min(1, exp.life / exp.maxLife));
        const ex = Math.round(exp.x - camera.renderX);
        const ey = Math.round(exp.y - camera.renderY);
        const curR = Math.max(4, exp.radius * (1 - pct * 0.45));
        ctx.globalAlpha = pct * 0.65;
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(ex, ey, curR * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ex, ey, curR, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (this.activeFinisherAoe && this.activeFinisherAoe.timer > 0) {
      ctx.save();
      const pulse = this.activeFinisherAoe;
      const pct = Math.max(0, Math.min(1, pulse.timer / pulse.maxTimer));
      const fx = Math.round(pulse.x - camera.renderX);
      const fy = Math.round(pulse.y - camera.renderY);
      ctx.globalAlpha = pct * 0.7;
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(fx, fy, pulse.radius * (1 - pct * 0.3), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Tajos de energía y grapas proyectadas (Espada Overclockeada / Grapadora Industrial)
    // (FIX ESTRICTO) Solo se dibujan si el jugador tiene arma/espada.
    if (this.hasSword && this.energySlashes && this.energySlashes.length > 0) {
      ctx.save();
      for (const s of this.energySlashes) {
        const sx = Math.round(s.x - camera.renderX);
        const sy = Math.round(s.y - camera.renderY);
        if (s.kind === 'staple') {
          // Grapa metálica en forma de U orientada según la dirección de disparo
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(sx - 4, sy - 4, 8, 8);
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          if (s.direction === 'right') {
            ctx.moveTo(sx - 3, sy - 3); ctx.lineTo(sx + 2, sy - 3); ctx.lineTo(sx + 2, sy + 3); ctx.lineTo(sx - 3, sy + 3);
          } else if (s.direction === 'left') {
            ctx.moveTo(sx + 3, sy - 3); ctx.lineTo(sx - 2, sy - 3); ctx.lineTo(sx - 2, sy + 3); ctx.lineTo(sx + 3, sy + 3);
          } else if (s.direction === 'down') {
            ctx.moveTo(sx - 3, sy - 3); ctx.lineTo(sx - 3, sy + 2); ctx.lineTo(sx + 3, sy + 2); ctx.lineTo(sx + 3, sy - 3);
          } else {
            ctx.moveTo(sx - 3, sy + 3); ctx.lineTo(sx - 3, sy - 2); ctx.lineTo(sx + 3, sy - 2); ctx.lineTo(sx + 3, sy + 3);
          }
          ctx.stroke();
          continue;
        }
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

    // Aura de Blindaje Térmico (Armadura Nivel 2) y brillo de arma corporativa equipada
    if (this.hasArmor && this.armorLevel >= 2) {
      ctx.save();
      const px = Math.round(this.x - camera.renderX);
      const py = Math.round(this.y - camera.renderY);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 1.5, py + 1.5, 13, 14);
      ctx.restore();
    }
    const activeCorpWeapon =
      this.equippedWeapon && this.equippedWeapon !== 'default'
        ? EXPANSION_EQUIPMENT[this.equippedWeapon]
        : null;
    if (activeCorpWeapon) {
      ctx.save();
      const px = Math.round(this.x - camera.renderX);
      const py = Math.round(this.y - camera.renderY);
      ctx.strokeStyle = activeCorpWeapon.bladeColor || '#2563eb';
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(px + 8, py + 14, 7, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
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
    // (FIX ESTRICTO) Sin espada no se muestra aura dorada/cian.
    if (this.hasSword && this.chargeTimer > 0) {
      ctx.save();
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

    // 6. Renderizar ataque: golpe desarmado o tajo luminoso de la Espada de la Recursividad
    if (this.attackTimer > 0) {
      if (!this.hasSword) {
        // (FIX 6) Puñetazo: puño, líneas de movimiento y estrella de impacto. Sin orbe.
        const progress = 1 - this.attackTimer / this.attackDuration;
        let baseAngle = 0;
        if (this.direction === 'right') baseAngle = 0;
        else if (this.direction === 'down') baseAngle = Math.PI / 2;
        else if (this.direction === 'left') baseAngle = Math.PI;
        else baseAngle = -Math.PI / 2;
        const reach = 8 + progress * 8;
        const fx = cx + Math.cos(baseAngle) * reach;
        const fy = cy + Math.sin(baseAngle) * reach;
        ctx.save();
        // (FIX ESTRICTO) Solo 3 líneas blancas/grises de velocidad + polvo. Cero energía.
        ctx.strokeStyle = 'rgba(241, 245, 249, 0.75)';
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
          const off = i * 3;
          const sx = cx - Math.cos(baseAngle) * 3 - Math.sin(baseAngle) * off;
          const sy = cy - Math.sin(baseAngle) * 3 + Math.cos(baseAngle) * off;
          const ex = fx - Math.cos(baseAngle) * 4 - Math.sin(baseAngle) * off;
          const ey = fy - Math.sin(baseAngle) * 4 + Math.cos(baseAngle) * off;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
        // Polvo del impacto (gris, sin aura ni estrella).
        ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
        const dustX = cx + Math.cos(baseAngle) * (reach + 2);
        const dustY = cy + Math.sin(baseAngle) * (reach + 2);
        ctx.fillRect(Math.round(dustX) - 2, Math.round(dustY) - 2, 2, 2);
        ctx.fillRect(Math.round(dustX) + 2, Math.round(dustY) - 1, 1, 1);
        ctx.fillRect(Math.round(dustX), Math.round(dustY) + 2, 1, 1);
        // Puño/guantelete.
        ctx.fillStyle = '#e8c39e';
        ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 3, 3);
        ctx.fillStyle = '#b8860b';
        ctx.fillRect(Math.round(fx) - 2, Math.round(fy) - 2, 4, 1);
        ctx.restore();
      } else {
        const progress = 1 - this.attackTimer / this.attackDuration;

        let baseAngle = 0;
        if (this.direction === 'right') baseAngle = 0;
        else if (this.direction === 'down') baseAngle = Math.PI / 2;
        else if (this.direction === 'left') baseAngle = Math.PI;
        else if (this.direction === 'up') baseAngle = -Math.PI / 2;

        const sweepStart = baseAngle - 0.95;
        const sweepEnd = sweepStart + progress * 1.9;

        ctx.save();
        // Arco de energía según arma corporativa equipada, nivel de espada o robotización
        const corpWeapon =
          this.equippedWeapon && this.equippedWeapon !== 'default'
            ? EXPANSION_EQUIPMENT[this.equippedWeapon]
            : null;
        const isMechanized = this.robotizationLevel > 50;
        let arcColor = 'rgba(251, 191, 36, 0.85)';
        let bladeColor = '#38bdf8';
        let edgeColor = '#ffffff';

      if (corpWeapon && corpWeapon.slot === 'weapon') {
        arcColor = corpWeapon.arcColor || arcColor;
        bladeColor = corpWeapon.bladeColor || bladeColor;
        edgeColor = corpWeapon.edgeColor || edgeColor;
      } else if (isMechanized) {
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
}

