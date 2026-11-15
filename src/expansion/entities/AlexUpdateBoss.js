/**
 * AlexUpdateBoss.js · Expansión "El Resurgir de Mister Alex IA" (Acto 3 · Jefe Final).
 * HP: 200 · Escena: ai_nucleus_core (El Núcleo de Mister Alex IA).
 *
 * 5 Fases corporativas:
 *  - Fase 1 (200 - 160 HP) "Marketing": Ejecutivo con cabeza CRT flotando; lanza "Anuncios" amarillos e invoca 2 "Becarios".
 *  - Fase 2 (160 - 120 HP) "Ventas": Pantalla CRT rota dejando ver carne; lanza "Contratos" rojos que rebotan y ataque láser AoE.
 *  - Fase 3 (120 - 80 HP)  "RRHH": Forma retorcida con 6 ojos; inflige estado "Burnout" (ralentiza 3s) y lanza "Despidos" teledirigidos.
 *  - Fase 4 (80 - 40 HP)   "Legal": Masa gigante de carne; coloca círculos de daño "Multas" y cierra los bordes de la pantalla con fuego.
 *  - Fase 5 (40 - 0 HP)    "Dirección": Masa gigante con una "caja fuerte" en el pecho como punto débil; ataque final "Cierre de Servidores" (láseres en cruz).
 *
 * Al morir: "No me has derrotado. Me has... reestructurado."
 */
import { Boss } from '../../entities/bosses/Boss.js?v=8';
import { CollisionSystem } from '../../physics/CollisionSystem.js?v=8';

export const ALEX_UPDATE_DEATH_QUOTE = 'No me has derrotado. Me has... reestructurado.';

export const ALEX_PHASE_INFO = {
  1: { name: 'FASE 1 · MARKETING', minHp: 160, quote: '¡Campaña agresiva! Mis anuncios y becarios cubrirán tu pantalla.' },
  2: { name: 'FASE 2 · VENTAS', minHp: 120, quote: 'Firma el contrato de permanencia... ¡o sufre el láser de renovación!' },
  3: { name: 'FASE 3 · RRHH', minHp: 80, quote: 'Evaluación de desempeño negativa: Burnout aplicado y despido en curso.' },
  4: { name: 'FASE 4 · LEGAL', minHp: 40, quote: 'Cláusula abusiva activada: multas en suelo y perímetro incendiario.' },
  5: { name: 'FASE 5 · DIRECCIÓN', minHp: 0, quote: '¡Cierre de Servidores! Solo la caja fuerte de mi pecho guarda el código.' }
};

function rectsOverlap(a, b) {
  return Boolean(
    a && b &&
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export class AlexUpdateBoss extends Boss {
  constructor({ x = 6.2 * 16, y = 2.6 * 16, sceneId = 'ai_nucleus_core', hp = 200 } = {}) {
    super({
      id: 'boss_alex_update',
      name: 'Mister Alex IA · El Update',
      title: 'Director Supremo del Algoritmo',
      x,
      y,
      width: 28,
      height: 30,
      hp,
      speed: 24,
      sceneId,
      trackName: 'boss_alex_final',
      rewardAbility: null,
      rewardName: 'El Ojete Restaurado',
      themeColor: '#22d3ee',
      requiresIntroCutscene: false
    });

    this.combatTriggerDistance = 260;
    this.baseX = x;
    this.baseY = y;
    this.phase = 1;
    this.floatTime = 0;

    // Cooldowns y estructuras de ataques por fase
    this.adTimer = 1.1;
    this.internSummonTimer = 0.6;
    this.interns = []; // Máximo 2 becarios activos en Fase 1

    this.contractTimer = 1.2;
    this.laserAoeTimer = 2.6;
    this.lasers = [];

    this.burnoutCooldown = 2.4;
    this.layoffTimer = 1.4;

    this.fineTimer = 1.5;
    this.fines = []; // Círculos "Multas" en el suelo
    this.fireBorderActive = false;
    this.fireTickTimer = 0;

    this.serverShutdownTimer = 2.2;
    this.armorHitCooldown = 0;
    this._currentAttackRect = null;

    this.dialogueLine = 'Bienvenido al Núcleo. Es hora de aplicar la actualización obligatoria.';
    this.dialogueTimer = 3.6;
  }

  getPhaseForHp(hp = this.hp) {
    if (hp > 160) return 1;
    if (hp > 120) return 2;
    if (hp > 80) return 3;
    if (hp > 40) return 4;
    return 5;
  }

  get phaseLabel() {
    return ALEX_PHASE_INFO[this.phase]?.name || 'FASE FINAL';
  }

  /** Punto débil de Fase 5: caja fuerte incrustada en el pecho del jefe. */
  getChestWeakspotBox() {
    return {
      x: this.x + 7,
      y: this.y + 12,
      width: 14,
      height: 12
    };
  }

  isAttackHittingChestWeakspot(player, explicitRect = null) {
    const chest = this.getChestWeakspotBox();
    const candidates = [];
    if (explicitRect) candidates.push(explicitRect);
    if (player?.getSwordHitbox) {
      const s = player.getSwordHitbox();
      if (s) candidates.push(s);
    }
    if (player?.getSpinHitbox) {
      const sp = player.getSpinHitbox();
      if (sp) candidates.push(sp);
    }
    if (Array.isArray(player?.energySlashes)) {
      for (const slash of player.energySlashes) {
        candidates.push({
          x: slash.x - (slash.radius || 7),
          y: slash.y - (slash.radius || 7),
          width: (slash.radius || 7) * 2,
          height: (slash.radius || 7) * 2
        });
      }
    }

    if (candidates.length > 0) {
      return candidates.some(box => rectsOverlap(box, chest));
    }

    // Fallback para golpes directos sin hitbox activa: comprobar proximidad al pecho frontal
    if (!player) return false;
    const chestCx = chest.x + chest.width * 0.5;
    const chestCy = chest.y + chest.height * 0.5;
    return Math.abs(player.centerX - chestCx) <= 20 && player.centerY >= chest.y - 6 && player.centerY <= chestCy + 26;
  }

  takeSwordHit(player, soundEngine, customDamage, explicitAttackRect = null) {
    const ignoresArmor = Boolean(player && player.equippedWeapon === 'destornillador');
    if (this.dead || (this.invulnerable && !ignoresArmor) || this.hitFlashTimer > 0) return false;

    if (
      !ignoresArmor &&
      this.phase === 5 &&
      !this.isAttackHittingChestWeakspot(player, explicitAttackRect || this._currentAttackRect)
    ) {
      if (this.armorHitCooldown <= 0) {
        soundEngine?.playMetalClink?.();
        this.dialogueLine = '¡Blindaje corporativo! Golpea la caja fuerte del pecho.';
        this.dialogueTimer = 1.6;
        this.armorHitCooldown = 0.35;
      }
      return false;
    }

    const dealt = super.takeSwordHit(player, soundEngine, customDamage);
    if (dealt) {
      this._syncPhase();
    }
    return dealt;
  }

  _syncPhase() {
    const targetPhase = this.getPhaseForHp(this.hp);
    if (targetPhase === this.phase) return;

    this.phase = targetPhase;
    const info = ALEX_PHASE_INFO[this.phase];
    this.dialogueLine = info.quote;
    this.dialogueTimer = 3.2;
    this.hitFlashTimer = 0.25;

    if (this.phase >= 2) {
      // Limpiar becarios residuales al evolucionar más allá de Marketing
      this.interns = [];
    }
    if (this.phase === 3) {
      this.speed = 32;
    } else if (this.phase === 4) {
      this.fireBorderActive = true;
      this.speed = 20;
    } else if (this.phase === 5) {
      this.fireBorderActive = true;
      this.fines = [];
      this.speed = 18;
    }
  }

  triggerBossDefeat(player, soundEngine) {
    if (this.dead) return;
    this.dialogueLine = ALEX_UPDATE_DEATH_QUOTE;
    this.dialogueTimer = 4.0;
    this.interns = [];
    this.projectiles = [];
    this.lasers = [];
    this.fines = [];
    this.fireBorderActive = false;
    super.triggerBossDefeat(player, soundEngine);
  }

  update(dt, tilemap, player, paused, soundEngine) {
    if (paused) return;
    if (this.dead) {
      this.deathTimer += dt;
      return;
    }

    if (this.dialogueTimer > 0) this.dialogueTimer = Math.max(0, this.dialogueTimer - dt);
    if (this.armorHitCooldown > 0) this.armorHitCooldown = Math.max(0, this.armorHitCooldown - dt);

    const dist = Math.hypot(player.centerX - this.centerX, player.centerY - this.centerY);
    if (!this.activeCombat) {
      if (dist <= this.combatTriggerDistance) {
        this.activeCombat = true;
        this.dialogueLine = ALEX_PHASE_INFO[1].quote;
        this.dialogueTimer = 3.0;
      } else {
        return;
      }
    }

    this._syncPhase();
    this.floatTime += dt;

    // Movimiento flotante sobre la arena de datos
    const arenaMinX = 1.8 * 16;
    const arenaMaxX = 10.6 * 16;
    const arenaMinY = 1.6 * 16;
    const arenaMaxY = 6.0 * 16;

    const targetX = this.phase <= 2
      ? this.baseX + Math.sin(this.floatTime * 1.6) * 44
      : player.x + Math.sin(this.floatTime * 2.1) * 26;
    const targetY = this.phase <= 3
      ? this.baseY + Math.cos(this.floatTime * 1.9) * 14
      : 2.8 * 16 + Math.sin(this.floatTime * 1.2) * 10;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const mag = Math.hypot(dx, dy) || 1;
    if (mag > 2) {
      const vx = (dx / mag) * this.speed;
      const vy = (dy / mag) * this.speed;
      CollisionSystem.moveWithCollisions(this, vx * dt, vy * dt, tilemap, { ignoreCorners: true });
      this.x = Math.max(arenaMinX, Math.min(arenaMaxX, this.x));
      this.y = Math.max(arenaMinY, Math.min(arenaMaxY, this.y));
    }

    // Ejecución de ataques específicos de la fase activa
    if (this.phase === 1) {
      this._updateMarketingPhase(dt, player, soundEngine);
    } else if (this.phase === 2) {
      this._updateSalesPhase(dt, player, soundEngine);
    } else if (this.phase === 3) {
      this._updateRrhhPhase(dt, player, soundEngine);
    } else if (this.phase === 4) {
      this._updateLegalPhase(dt, player, soundEngine);
    } else if (this.phase === 5) {
      this._updateBoardPhase(dt, player, soundEngine);
    }

    this._updateInterns(dt, tilemap, player, soundEngine);
    this._updateAlexProjectiles(dt, tilemap, player, soundEngine);
    this._updateLasers(dt, player, soundEngine);
    this._updateFines(dt, player, soundEngine);
    this._updateFireBorder(dt, tilemap, player, soundEngine);

    // Hitboxes del jugador vs Alex (guardando el rect para validación de caja fuerte en Fase 5)
    if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    if (this.invulnerableTimer > 0) this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);

    const hurtbox = this.hurtbox || this.worldBoundingBox;
    const spinBox = player.getSpinHitbox?.();
    if (spinBox && rectsOverlap(spinBox, hurtbox)) {
      this._currentAttackRect = spinBox;
      this.takeSwordHit(player, soundEngine, player.getSwordDamage(this) + 1, spinBox);
      this._currentAttackRect = null;
    }

    if (Array.isArray(player.energySlashes)) {
      for (const slash of player.energySlashes) {
        const sRect = {
          x: slash.x - (slash.radius || 7),
          y: slash.y - (slash.radius || 7),
          width: (slash.radius || 7) * 2,
          height: (slash.radius || 7) * 2
        };
        if (rectsOverlap(sRect, hurtbox)) {
          this._currentAttackRect = sRect;
          this.takeSwordHit(player, soundEngine, 2, sRect);
          this._currentAttackRect = null;
          slash.life = 0;
        }
      }
    }

    const swordBox = player.getSwordHitbox?.();
    if (swordBox && rectsOverlap(swordBox, hurtbox)) {
      this._currentAttackRect = swordBox;
      this.takeSwordHit(player, soundEngine, undefined, swordBox);
      this._currentAttackRect = null;
    }

    if (!this.dead && this.contactDamage > 0 && rectsOverlap(player.worldBoundingBox, this.worldBoundingBox)) {
      player.takeHit(soundEngine, this, this.contactDamage);
    }
  }

  _updateMarketingPhase(dt, player, soundEngine) {
    this.adTimer -= dt;
    if (this.adTimer <= 0) {
      this.adTimer = 1.35;
      const baseAngle = Math.atan2(player.centerY - this.centerY, player.centerX - this.centerX);
      for (const offset of [-0.22, 0.22]) {
        const ang = baseAngle + offset;
        this.projectiles.push({
          kind: 'ad',
          x: this.centerX,
          y: this.centerY,
          vx: Math.cos(ang) * 92,
          vy: Math.sin(ang) * 92,
          radius: 5,
          life: 4.0,
          damage: 1,
          bouncesLeft: 0,
          homing: false,
          color: '#facc15'
        });
      }
      soundEngine?.playEnemyAttack?.();
    }

    this.internSummonTimer -= dt;
    if (this.internSummonTimer <= 0 && this.interns.length < 2) {
      this.internSummonTimer = 5.0;
      this.summonInterns(2 - this.interns.length);
    }
  }

  summonInterns(count = 2) {
    for (let i = 0; i < count && this.interns.length < 2; i++) {
      const side = (this.interns.length % 2 === 0) ? -28 : 28;
      this.interns.push({
        id: `becario_${Date.now()}_${this.interns.length}`,
        name: 'Becario',
        x: Math.max(2 * 16, Math.min(11 * 16, this.centerX + side - 6)),
        y: Math.min(9.5 * 16, this.centerY + 26),
        width: 12,
        height: 14,
        hp: 2,
        maxHp: 2,
        speed: 36,
        hitFlashTimer: 0,
        attackCooldown: 0.6,
        getBoundingBoxAt(nx = this.x, ny = this.y) {
          return { x: nx + 1, y: ny + 4, width: this.width - 2, height: this.height - 4 };
        }
      });
    }
  }

  _updateInterns(dt, tilemap, player, soundEngine) {
    const swordBox = player.getSwordHitbox?.();
    const spinBox = player.getSpinHitbox?.();

    for (let i = this.interns.length - 1; i >= 0; i--) {
      const b = this.interns[i];
      if (b.hitFlashTimer > 0) b.hitFlashTimer = Math.max(0, b.hitFlashTimer - dt);
      if (b.attackCooldown > 0) b.attackCooldown = Math.max(0, b.attackCooldown - dt);

      const bx = b.x + b.width * 0.5;
      const by = b.y + b.height * 0.5;
      const dx = player.centerX - bx;
      const dy = player.centerY - by;
      const dist = Math.hypot(dx, dy) || 1;
      CollisionSystem.moveWithCollisions(b, (dx / dist) * b.speed * dt, (dy / dist) * b.speed * dt, tilemap, { ignoreCorners: true });

      const bRect = { x: b.x, y: b.y, width: b.width, height: b.height };
      const struck =
        (swordBox && rectsOverlap(swordBox, bRect)) ||
        (spinBox && rectsOverlap(spinBox, bRect)) ||
        (Array.isArray(player.energySlashes) && player.energySlashes.some(s => {
          const r = { x: s.x - 7, y: s.y - 7, width: 14, height: 14 };
          return rectsOverlap(r, bRect);
        }));

      if (struck && b.hitFlashTimer <= 0) {
        b.hp -= Math.max(1, player.getSwordDamage?.() || 1);
        b.hitFlashTimer = 0.25;
        soundEngine?.playHit?.();
        if (b.hp <= 0) {
          this.interns.splice(i, 1);
          continue;
        }
      }

      if (b.attackCooldown <= 0 && rectsOverlap(player.worldBoundingBox, bRect)) {
        b.attackCooldown = 1.0;
        player.takeHit(soundEngine, this, 1);
      }
    }
  }

  _updateSalesPhase(dt, player, soundEngine) {
    this.contractTimer -= dt;
    if (this.contractTimer <= 0) {
      this.contractTimer = 1.45;
      const baseAngle = Math.atan2(player.centerY - this.centerY, player.centerX - this.centerX);
      for (const offset of [-0.35, 0, 0.35]) {
        const ang = baseAngle + offset;
        this.projectiles.push({
          kind: 'contract',
          x: this.centerX,
          y: this.centerY,
          vx: Math.cos(ang) * 105,
          vy: Math.sin(ang) * 105,
          radius: 5,
          life: 5.2,
          damage: 1,
          bouncesLeft: 3,
          homing: false,
          color: '#ef4444'
        });
      }
      soundEngine?.playEnemyAttack?.();
    }

    this.laserAoeTimer -= dt;
    if (this.laserAoeTimer <= 0) {
      this.laserAoeTimer = 2.8;
      this.lasers.push({
        orientation: 'horizontal',
        pos: Math.max(2 * 16, Math.min(10 * 16, player.centerY)),
        thickness: 14,
        telegraphTimer: 0.75,
        activeTimer: 0.55,
        color: '#f97316',
        hitApplied: false
      });
    }
  }

  _updateRrhhPhase(dt, player, soundEngine) {
    this.burnoutCooldown -= dt;
    if (this.burnoutCooldown <= 0) {
      this.burnoutCooldown = 4.8;
      player.burnoutTimer = 3.0;
      this.dialogueLine = 'Burnout aplicado: tu productividad y velocidad caen 3 segundos.';
      this.dialogueTimer = 2.4;
      soundEngine?.playErrorBuzz?.();
    }

    this.layoffTimer -= dt;
    if (this.layoffTimer <= 0) {
      this.layoffTimer = 1.5;
      const baseAngle = Math.atan2(player.centerY - this.centerY, player.centerX - this.centerX);
      this.projectiles.push({
        kind: 'layoff',
        x: this.centerX,
        y: this.centerY,
        vx: Math.cos(baseAngle) * 78,
        vy: Math.sin(baseAngle) * 78,
        radius: 5,
        life: 4.5,
        damage: 1,
        bouncesLeft: 0,
        homing: true,
        turnRate: 2.5,
        color: '#c084fc'
      });
    }
  }

  _updateLegalPhase(dt, player, soundEngine) {
    this.fineTimer -= dt;
    if (this.fineTimer <= 0) {
      this.fineTimer = 1.6;
      this.fines.push({
        x: Math.max(2 * 16, Math.min(12 * 16, player.centerX)),
        y: Math.max(2 * 16, Math.min(10 * 16, player.centerY)),
        radius: 20,
        chargeTimer: 1.05,
        detonatedTimer: 0.35,
        detonated: false,
        hitPlayer: false
      });
      if (this.fines.length > 4) this.fines.shift();
    }

    this.contractTimer -= dt;
    if (this.contractTimer <= 0) {
      this.contractTimer = 1.8;
      const ang = Math.atan2(player.centerY - this.centerY, player.centerX - this.centerX);
      this.projectiles.push({
        kind: 'contract',
        x: this.centerX,
        y: this.centerY,
        vx: Math.cos(ang) * 96,
        vy: Math.sin(ang) * 96,
        radius: 5,
        life: 3.5,
        damage: 1,
        bouncesLeft: 1,
        homing: false,
        color: '#ef4444'
      });
    }
  }

  _updateBoardPhase(dt, player, soundEngine) {
    this.serverShutdownTimer -= dt;
    if (this.serverShutdownTimer <= 0) {
      this.serverShutdownTimer = 2.6;
      const cx = Math.max(2.5 * 16, Math.min(11.5 * 16, player.centerX));
      const cy = Math.max(2.0 * 16, Math.min(9.5 * 16, player.centerY));
      this.lasers.push(
        { orientation: 'vertical', pos: cx, thickness: 12, telegraphTimer: 0.85, activeTimer: 0.55, color: '#22d3ee', hitApplied: false },
        { orientation: 'horizontal', pos: cy, thickness: 12, telegraphTimer: 0.85, activeTimer: 0.55, color: '#22d3ee', hitApplied: false }
      );
      soundEngine?.playErrorBuzz?.();
    }
  }

  _updateAlexProjectiles(dt, tilemap, player, soundEngine) {
    const minX = 1.2 * (tilemap?.tileSize || 16);
    const maxX = ((tilemap?.cols || 14) - 1.2) * (tilemap?.tileSize || 16);
    const minY = 1.2 * (tilemap?.tileSize || 16);
    const maxY = ((tilemap?.rows || 12) - 1.2) * (tilemap?.tileSize || 16);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.homing) {
        const desiredAngle = Math.atan2(player.centerY - p.y, player.centerX - p.x);
        const speed = Math.hypot(p.vx, p.vy) || 78;
        const currAngle = Math.atan2(p.vy, p.vx);
        let diff = desiredAngle - currAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurn = (p.turnRate || 2.2) * dt;
        const nextAngle = currAngle + Math.max(-maxTurn, Math.min(maxTurn, diff));
        p.vx = Math.cos(nextAngle) * speed;
        p.vy = Math.sin(nextAngle) * speed;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.bouncesLeft > 0) {
        let bounced = false;
        if (p.x <= minX || p.x >= maxX) {
          p.vx *= -1;
          p.x = Math.max(minX, Math.min(maxX, p.x));
          bounced = true;
        }
        if (p.y <= minY || p.y >= maxY) {
          p.vy *= -1;
          p.y = Math.max(minY, Math.min(maxY, p.y));
          bounced = true;
        }
        if (bounced) {
          p.bouncesLeft -= 1;
          p.bounced = true;
        }
      }

      if (Math.hypot(player.centerX - p.x, player.centerY - p.y) <= (p.radius + 5)) {
        player.takeHit(soundEngine, this, p.damage || 1);
        this.projectiles.splice(i, 1);
      }
    }
  }

  _updateLasers(dt, player, soundEngine) {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      if (l.telegraphTimer > 0) {
        l.telegraphTimer -= dt;
        continue;
      }
      l.activeTimer -= dt;
      if (!l.hitApplied) {
        const half = l.thickness * 0.5 + 3;
        const hit = l.orientation === 'horizontal'
          ? Math.abs(player.centerY - l.pos) <= half
          : Math.abs(player.centerX - l.pos) <= half;
        if (hit) {
          l.hitApplied = true;
          player.takeHit(soundEngine, this, 1);
        }
      }
      if (l.activeTimer <= 0) this.lasers.splice(i, 1);
    }
  }

  _updateFines(dt, player, soundEngine) {
    for (let i = this.fines.length - 1; i >= 0; i--) {
      const f = this.fines[i];
      if (!f.detonated) {
        f.chargeTimer -= dt;
        if (f.chargeTimer <= 0) {
          f.detonated = true;
          if (!f.hitPlayer && Math.hypot(player.centerX - f.x, player.centerY - f.y) <= f.radius + 4) {
            f.hitPlayer = true;
            player.takeHit(soundEngine, this, 1);
          }
        }
      } else {
        f.detonatedTimer -= dt;
        if (f.detonatedTimer <= 0) this.fines.splice(i, 1);
      }
    }
  }

  _updateFireBorder(dt, tilemap, player, soundEngine) {
    if (!this.fireBorderActive) return;
    if (this.fireTickTimer > 0) this.fireTickTimer = Math.max(0, this.fireTickTimer - dt);

    const ts = tilemap?.tileSize || 16;
    const w = (tilemap?.cols || 14) * ts;
    const h = (tilemap?.rows || 12) * ts;
    const margin = 20;
    const onBorder =
      player.centerX <= margin ||
      player.centerX >= w - margin ||
      player.centerY <= margin ||
      player.centerY >= h - margin;

    if (onBorder && this.fireTickTimer <= 0) {
      this.fireTickTimer = 0.85;
      player.takeHit(soundEngine, this, 1);
    }
  }

  render(ctx, camera) {
    if (this.dead) return;
    const ox = -Math.round(camera.x);
    const oy = -Math.round(camera.y);
    const ts = 16;

    // 1. Borde de fuego en Fase 4 y Fase 5
    if (this.fireBorderActive) {
      const w = 14 * ts;
      const h = 12 * ts;
      const pulse = 0.45 + 0.35 * Math.sin(this.floatTime * 10);
      ctx.save();
      ctx.strokeStyle = `rgba(249, 115, 22, ${pulse})`;
      ctx.lineWidth = 10;
      ctx.strokeRect(ox + 5, oy + 5, w - 10, h - 10);
      ctx.restore();
    }

    // 2. Círculos "Multas" (Fase 4)
    for (const f of this.fines) {
      const fx = Math.round(f.x + ox);
      const fy = Math.round(f.y + oy);
      ctx.save();
      ctx.beginPath();
      ctx.arc(fx, fy, f.radius, 0, Math.PI * 2);
      ctx.fillStyle = f.detonated ? 'rgba(239, 68, 68, 0.55)' : 'rgba(245, 158, 11, 0.25)';
      ctx.fill();
      ctx.strokeStyle = f.detonated ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MULTA', fx, fy + 2);
      ctx.restore();
    }

    // 3. Láseres AoE (Fase 2) y Cierre de Servidores en cruz (Fase 5)
    for (const l of this.lasers) {
      const isTelegraph = l.telegraphTimer > 0;
      ctx.save();
      ctx.fillStyle = isTelegraph ? 'rgba(248, 113, 113, 0.35)' : l.color;
      if (l.orientation === 'horizontal') {
        const y = Math.round(l.pos - l.thickness * 0.5 + oy);
        ctx.fillRect(ox, y, 14 * ts, l.thickness);
      } else {
        const x = Math.round(l.pos - l.thickness * 0.5 + ox);
        ctx.fillRect(x, oy, l.thickness, 12 * ts);
      }
      ctx.restore();
    }

    // 4. Becarios (Fase 1)
    for (const b of this.interns) {
      const bx = Math.round(b.x + ox);
      const by = Math.round(b.y + oy);
      ctx.fillStyle = b.hitFlashTimer > 0 ? '#ffffff' : '#38bdf8';
      ctx.fillRect(bx, by + 4, b.width, b.height - 4);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(bx + 2, by, b.width - 4, 5);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(bx + 5, by + 5, 2, 6); // corbata
    }

    // 5. Cuerpo de Alex según Fase 1..5
    const sx = Math.round(this.x + ox);
    const sy = Math.round(this.y + oy + Math.sin(this.floatTime * 4) * 2);
    const flash = this.hitFlashTimer > 0;

    ctx.save();
    if (this.phase <= 2) {
      // Ejecutivo con cabeza CRT
      ctx.fillStyle = flash ? '#ffffff' : '#1e293b';
      ctx.fillRect(sx + 6, sy + 14, 16, 15);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(sx + 13, sy + 15, 2, 10);
      ctx.fillStyle = flash ? '#ffffff' : '#334155';
      ctx.fillRect(sx + 3, sy, 22, 15);
      ctx.fillStyle = this.phase === 1 ? '#06b6d4' : '#7f1d1d';
      ctx.fillRect(sx + 5, sy + 2, 18, 10);
      if (this.phase === 2) {
        // Grieta con carne biológica visible
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx + 7, sy + 3);
        ctx.lineTo(sx + 13, sy + 9);
        ctx.lineTo(sx + 19, sy + 5);
        ctx.stroke();
      }
    } else if (this.phase === 3) {
      // Forma retorcida con 6 ojos
      ctx.fillStyle = flash ? '#ffffff' : '#581c87';
      ctx.fillRect(sx + 1, sy + 2, 26, 26);
      ctx.fillStyle = '#c084fc';
      const eyes = [[6, 7], [13, 6], [20, 7], [7, 15], [13, 14], [19, 15]];
      for (const [ex, ey] of eyes) {
        ctx.fillRect(sx + ex, sy + ey, 3, 3);
      }
    } else {
      // Masa gigante de carne (Fase 4 Legal y Fase 5 Dirección)
      ctx.fillStyle = flash ? '#ffffff' : '#7f1d1d';
      ctx.fillRect(sx - 2, sy, this.width + 4, this.height + 2);
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(sx + 2, sy + 3, this.width - 4, this.height - 6);

      if (this.phase === 5) {
        // Caja fuerte en el pecho (punto débil)
        const chest = this.getChestWeakspotBox();
        const cx = Math.round(chest.x + ox);
        const cy = Math.round(chest.y + oy);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(cx, cy, chest.width, chest.height);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx, cy, chest.width, chest.height);
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(cx + chest.width * 0.5, cy + chest.height * 0.5, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Proyectiles corporativos
    for (const p of this.projectiles) {
      const px = Math.round(p.x + ox);
      const py = Math.round(p.y + oy);
      ctx.fillStyle = p.color || '#facc15';
      ctx.fillRect(px - 4, py - 4, 8, 8);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 4, py - 4, 8, 8);
    }

    // 7. Etiqueta de fase y frase activa
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#22d3ee';
    ctx.fillText(this.phaseLabel, sx + 14, sy - 6);
    if (this.dialogueTimer > 0 && this.dialogueLine) {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
      ctx.fillRect(sx - 56, sy - 22, 140, 12);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '6px monospace';
      ctx.fillText(this.dialogueLine.slice(0, 44), sx + 14, sy - 14);
    }
    ctx.restore();
  }
}
