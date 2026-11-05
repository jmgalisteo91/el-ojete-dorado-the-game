import { findPath, hasLineOfSight } from './Pathfinding.js?v=7';
import { CollisionSystem } from '../physics/CollisionSystem.js?v=7';

/**
 * EnemyBrain: máquina de estados de IA para enemigos normales (los jefes tienen su propia lógica).
 *
 * Estados:  PATROL → ALERT → CHASE → SEARCH → RETURN → PATROL
 * Arquetipos (comportamiento en CHASE):
 *   - grunt:    persigue y flanquea; solo 2 atacantes simultáneos, el resto rodea al jugador.
 *   - sentinel: como grunt, pero da la alarma a los aliados cercanos al detectar al jugador.
 *   - drone:    mantiene la distancia, se desplaza lateralmente y dispara proyectiles telegrafiados.
 *   - knight:   carga con telegrafiado; tras la carga queda expuesto (recibe doble daño).
 *   - glitch:   se teletransporta cerca del jugador tras un breve aviso visual.
 */

export const AI_STATE = {
  PATROL: 'PATROL',
  ALERT: 'ALERT',
  CHASE: 'CHASE',
  SEARCH: 'SEARCH',
  RETURN: 'RETURN'
};

export function inferArchetype(id = '') {
  if (id.startsWith('drone_west_2')) return 'sentinel';
  if (id.startsWith('drone')) return 'drone';
  if (id.startsWith('knight') || id === 'night_bug_east_2') return 'knight';
  if (id.startsWith('night_glitch')) return 'glitch';
  return 'grunt';
}

const ALERT_TIME = 0.4;
const LOSE_SIGHT_TIME = 0.6;
const SEARCH_WAIT = 1.4;
const ALARM_RADIUS = 120;
const MAX_SIMULTANEOUS_ATTACKERS = 2;

export class EnemyBrain {
  constructor(enemy, archetype = 'grunt') {
    this.enemy = enemy;
    this.archetype = archetype;
    this.state = AI_STATE.PATROL;
    this.stateTimer = 0;
    this.lastKnown = null;
    this.loseTimer = 0;
    this.path = [];
    this.pathGoal = null;
    this.repathTimer = 0;
    this.flankAngle = Math.random() * Math.PI * 2;
    this.strafeSign = Math.random() < 0.5 ? -1 : 1;

    // Estado de acciones especiales (arquetipos)
    this.action = 'none'; // none | telegraph | charge | recover | blink
    this.actionTimer = 0;
    this.actionCooldown = 0.8 + Math.random();
    this.lockedDir = { x: 0, y: 0 };
    this.searchLookTimer = 0;
  }

  get isTelegraphing() {
    return this.action === 'telegraph' || this.action === 'blink';
  }

  get isCharging() {
    return this.action === 'charge';
  }

  /** Verdadero si el enemigo está expuesto y recibe daño extra. */
  get isVulnerable() {
    return this.action === 'recover';
  }

  cancelAction() {
    this.action = 'none';
    this.actionTimer = 0;
    this.actionCooldown = Math.max(this.actionCooldown, 0.6);
  }

  setState(state) {
    this.state = state;
    this.stateTimer = 0;
    this.path = [];
    this.pathGoal = null;
    this.loseTimer = 0;
    this._searchedFor = 0;
  }

  /** Alerta externa (alarma de un centinela o ruido): salta directamente a ALERT/CHASE. */
  forceAlert(x, y) {
    if (this.state === AI_STATE.CHASE || this.state === AI_STATE.ALERT) return;
    this.lastKnown = { x, y };
    this.setState(AI_STATE.ALERT);
  }

  /**
   * @returns {{dirX:number, dirY:number, speedMul:number}} Intención de movimiento del frame.
   */
  update(dt, ctx) {
    const { enemy, archetype } = this;
    const { player, tilemap } = ctx;
    this.stateTimer += dt;
    if (this.repathTimer > 0) this.repathTimer -= dt;
    if (this.actionCooldown > 0) this.actionCooldown -= dt;

    const perception = this._perceive(ctx);
    const idle = { dirX: 0, dirY: 0, speedMul: 1 };

    // Acciones especiales en curso (bloquean la decisión de movimiento)
    const actionResult = this._updateAction(dt, ctx);
    if (actionResult) return actionResult;

    switch (this.state) {
      case AI_STATE.PATROL: {
        if (perception.sees) return this._onSpotted(ctx);
        const wp = enemy.patrolPoints[enemy.currentWaypointIndex];
        const dir = this._steerTo(wp.x + enemy.width / 2, wp.y + enemy.height / 2, dt, ctx, 3);
        if (!dir) {
          enemy.currentWaypointIndex = (enemy.currentWaypointIndex + 1) % enemy.patrolPoints.length;
          return idle;
        }
        return { dirX: dir.x, dirY: dir.y, speedMul: 1 };
      }

      case AI_STATE.ALERT: {
        enemy.faceTowards(player.centerX, player.centerY);
        if (this.stateTimer >= ALERT_TIME) {
          this.setState(AI_STATE.CHASE);
        }
        return idle;
      }

      case AI_STATE.CHASE: {
        if (perception.sees || perception.hears) {
          this.lastKnown = { x: player.centerX, y: player.centerY };
          this.loseTimer = 0;
        } else {
          this.loseTimer += dt;
          if (this.loseTimer >= LOSE_SIGHT_TIME) {
            this.setState(AI_STATE.SEARCH);
            return idle;
          }
        }
        if (perception.dist > enemy.aggroRange * 2.2) {
          this.setState(AI_STATE.SEARCH);
          return idle;
        }
        return this._chaseByArchetype(dt, ctx, perception);
      }

      case AI_STATE.SEARCH: {
        if (perception.sees) return this._onSpotted(ctx);
        const target = this.lastKnown || { x: enemy.spawnX + enemy.width / 2, y: enemy.spawnY + enemy.height / 2 };
        const dir = this._steerTo(target.x, target.y, dt, ctx, 6);
        if (dir) return { dirX: dir.x, dirY: dir.y, speedMul: 1 };
        // Ha llegado al último punto conocido: mira alrededor y se rinde
        this.searchLookTimer -= dt;
        if (this.searchLookTimer <= 0) {
          this.searchLookTimer = 0.45;
          const dirs = ['up', 'right', 'down', 'left'];
          enemy.direction = dirs[(dirs.indexOf(enemy.direction) + 1) % 4];
        }
        if (this.stateTimer > SEARCH_WAIT + 4 || this._searchedFor >= SEARCH_WAIT) {
          this._searchedFor = 0;
          this.setState(AI_STATE.RETURN);
        } else {
          this._searchedFor = (this._searchedFor || 0) + dt;
        }
        return idle;
      }

      case AI_STATE.RETURN: {
        if (perception.sees) return this._onSpotted(ctx);
        let nearest = 0;
        let bestDist = Infinity;
        enemy.patrolPoints.forEach((p, i) => {
          const d = Math.hypot(p.x - enemy.x, p.y - enemy.y);
          if (d < bestDist) {
            bestDist = d;
            nearest = i;
          }
        });
        enemy.currentWaypointIndex = nearest;
        const wp = enemy.patrolPoints[nearest];
        const dir = this._steerTo(wp.x + enemy.width / 2, wp.y + enemy.height / 2, dt, ctx, 3);
        if (!dir) {
          this.setState(AI_STATE.PATROL);
          return idle;
        }
        return { dirX: dir.x, dirY: dir.y, speedMul: 1 };
      }

      default:
        return idle;
    }
  }

  // ------------------------------------------------------------------ percepción

  _perceive(ctx) {
    const { enemy } = this;
    const { player, tilemap } = ctx;
    const dist = Math.hypot(player.centerX - enemy.centerX, player.centerY - enemy.centerY);
    const inSafeSanctuary =
      player.x >= 13 * 16 && player.x <= 21 * 16 && player.y >= 17 * 16 && enemy.sceneId === 'first_stage';
    if (inSafeSanctuary || player.hp <= 0) {
      return { dist, sees: false, hears: false };
    }
    const inRange = dist <= enemy.aggroRange;
    const sees =
      inRange &&
      hasLineOfSight(tilemap, enemy.centerX, enemy.centerY, player.centerX, player.centerY);
    const hears = dist <= enemy.aggroRange * 0.45;
    return { dist, sees, hears };
  }

  _onSpotted(ctx) {
    const { player } = ctx;
    this.lastKnown = { x: player.centerX, y: player.centerY };
    this.setState(AI_STATE.ALERT);
    if (this.archetype === 'sentinel' && Array.isArray(ctx.enemies)) {
      for (const other of ctx.enemies) {
        if (other === this.enemy || other.dead || other.isBoss || !other.brain) continue;
        if (other.sceneId !== this.enemy.sceneId) continue;
        if (Math.hypot(other.x - this.enemy.x, other.y - this.enemy.y) <= ALARM_RADIUS) {
          other.brain.forceAlert(player.centerX, player.centerY);
        }
      }
    }
    return { dirX: 0, dirY: 0, speedMul: 1 };
  }

  // ------------------------------------------------------------------ persecución por arquetipo

  _chaseByArchetype(dt, ctx, perception) {
    const { enemy, archetype } = this;
    const { player, tilemap } = ctx;
    const target = { x: player.centerX, y: player.centerY };
    const toPlayer = { x: target.x - enemy.centerX, y: target.y - enemy.centerY };
    const dist = Math.max(0.001, perception.dist);
    const nx = toPlayer.x / dist;
    const ny = toPlayer.y / dist;
    enemy.faceTowards(target.x, target.y);

    if (archetype === 'drone') {
      return this._chaseDrone(dt, ctx, perception, nx, ny);
    }

    if (archetype === 'knight' && perception.sees && this.actionCooldown <= 0 && dist <= 64 && dist > 20) {
      this.action = 'telegraph';
      this.actionTimer = 0.5;
      this.lockedDir = { x: nx, y: ny };
      return { dirX: 0, dirY: 0, speedMul: 1 };
    }

    if (archetype === 'glitch' && this.actionCooldown <= 0 && dist > 38) {
      this.action = 'blink';
      this.actionTimer = 0.3;
      return { dirX: 0, dirY: 0, speedMul: 1 };
    }

    // Grunt / sentinel / knight / glitch: acercarse flanqueando con límite de atacantes
    const attackers = ctx.attackers;
    let slotHolder = true;
    if (attackers && dist < 44) {
      if (attackers.has(enemy) || attackers.size < MAX_SIMULTANEOUS_ATTACKERS) {
        attackers.add(enemy);
      } else {
        slotHolder = false;
      }
    }

    let goalX = target.x;
    let goalY = target.y;
    if (!slotHolder) {
      // Rodea al jugador a distancia segura esperando su turno
      this.flankAngle += dt * 0.9 * this.strafeSign;
      goalX += Math.cos(this.flankAngle) * 30;
      goalY += Math.sin(this.flankAngle) * 30;
    } else if (dist > 36) {
      goalX += Math.cos(this.flankAngle) * 14;
      goalY += Math.sin(this.flankAngle) * 14;
    }

    const dir = this._steerTo(goalX, goalY, dt, ctx, 2);
    if (!dir) return { dirX: 0, dirY: 0, speedMul: 1 };
    return { dirX: dir.x, dirY: dir.y, speedMul: 1.15 };
  }

  _chaseDrone(dt, ctx, perception, nx, ny) {
    const { enemy } = this;
    const { tilemap } = ctx;
    const dist = perception.dist;

    if (perception.sees && this.actionCooldown <= 0 && dist <= enemy.aggroRange) {
      this.action = 'telegraph';
      this.actionTimer = 0.35;
      return { dirX: 0, dirY: 0, speedMul: 1 };
    }

    if (dist < 44) {
      // Retrocede manteniendo la distancia (si no puede, recurre a desplazarse lateralmente)
      const probeX = enemy.centerX - nx * 8;
      const probeY = enemy.centerY - ny * 8;
      if (!tilemap.isSolidAtTile(Math.floor(probeX / tilemap.tileSize), Math.floor(probeY / tilemap.tileSize))) {
        return { dirX: -nx, dirY: -ny, speedMul: 1.05 };
      }
      return { dirX: -ny * this.strafeSign, dirY: nx * this.strafeSign, speedMul: 1 };
    }
    if (dist > 72 || !perception.sees) {
      const dir = this._steerTo(ctx.player.centerX, ctx.player.centerY, dt, ctx, 2);
      return dir ? { dirX: dir.x, dirY: dir.y, speedMul: 1.1 } : { dirX: 0, dirY: 0, speedMul: 1 };
    }
    // Distancia ideal: orbita lateralmente
    return { dirX: -ny * this.strafeSign, dirY: nx * this.strafeSign, speedMul: 0.75 };
  }

  // ------------------------------------------------------------------ acciones especiales

  _updateAction(dt, ctx) {
    if (this.action === 'none') return null;
    const { enemy } = this;
    const { player, tilemap } = ctx;
    this.actionTimer -= dt;

    if (this.action === 'telegraph') {
      enemy.faceTowards(player.centerX, player.centerY);
      if (this.actionTimer <= 0) {
        if (this.archetype === 'knight') {
          this.action = 'charge';
          this.actionTimer = 0.38;
        } else {
          // dron: dispara
          this.action = 'none';
          this.actionCooldown = 1.9;
          const dx = player.centerX - enemy.centerX;
          const dy = player.centerY - enemy.centerY;
          const d = Math.max(0.001, Math.hypot(dx, dy));
          enemy.fireShot(dx / d, dy / d, ctx.soundEngine);
        }
      }
      return { dirX: 0, dirY: 0, speedMul: 1 };
    }

    if (this.action === 'charge') {
      if (this.actionTimer <= 0) {
        this.action = 'recover';
        this.actionTimer = 0.7;
        return { dirX: 0, dirY: 0, speedMul: 1 };
      }
      return { dirX: this.lockedDir.x, dirY: this.lockedDir.y, speedMul: 4.6 };
    }

    if (this.action === 'recover') {
      if (this.actionTimer <= 0) {
        this.action = 'none';
        this.actionCooldown = 1.2;
      }
      return { dirX: 0, dirY: 0, speedMul: 1 };
    }

    if (this.action === 'blink') {
      if (this.actionTimer <= 0) {
        this.action = 'none';
        this.actionCooldown = 2.8;
        this._blinkNear(player, tilemap);
      }
      return { dirX: 0, dirY: 0, speedMul: 1 };
    }

    this.action = 'none';
    return null;
  }

  _blinkNear(player, tilemap) {
    const { enemy } = this;
    const start = Math.random() * Math.PI * 2;
    for (let i = 0; i < 8; i++) {
      const a = start + (i * Math.PI) / 4;
      const nx = player.x + Math.cos(a) * 26;
      const ny = player.y + Math.sin(a) * 26;
      const box = enemy.getBoundingBoxAt(nx, ny);
      if (!CollisionSystem.collidesWithMap(box, tilemap)) {
        enemy.x = nx;
        enemy.y = ny;
        return true;
      }
    }
    return false;
  }

  // ------------------------------------------------------------------ navegación

  /**
   * Devuelve el vector unitario hacia el destino (directo si hay visión; si no, siguiendo A*),
   * o null si ya está dentro del radio de llegada.
   */
  _steerTo(tx, ty, dt, ctx, arriveRadius = 3) {
    const { enemy } = this;
    const { tilemap } = ctx;
    const ex = enemy.centerX;
    const ey = enemy.centerY;
    // Convertimos el destino (x, y de esquina en patrullas) al centro de la entidad
    const gx = tx;
    const gy = ty;
    const dx = gx - ex;
    const dy = gy - ey;
    const dist = Math.hypot(dx, dy);
    if (dist <= arriveRadius) return null;

    if (hasLineOfSight(tilemap, ex, ey, gx, gy) && !this._pathBlocked(ex, ey, gx, gy, tilemap)) {
      this.path = [];
      return { x: dx / dist, y: dy / dist };
    }

    const goalMoved =
      !this.pathGoal || Math.hypot(this.pathGoal.x - gx, this.pathGoal.y - gy) > tilemap.tileSize * 1.2;
    if (this.path.length === 0 || goalMoved || this.repathTimer <= 0) {
      this.path = findPath(tilemap, ex, ey, gx, gy);
      this.pathGoal = { x: gx, y: gy };
      this.repathTimer = 0.5;
    }
    while (this.path.length > 0 && Math.hypot(this.path[0].x - ex, this.path[0].y - ey) < 3) {
      this.path.shift();
    }
    if (this.path.length === 0) {
      return { x: dx / dist, y: dy / dist };
    }
    const wp = this.path[0];
    const wdx = wp.x - ex;
    const wdy = wp.y - ey;
    const wd = Math.max(0.001, Math.hypot(wdx, wdy));
    return { x: wdx / wd, y: wdy / wd };
  }

  /** Comprueba que el hitbox completo (no solo el centro) pueda recorrer el trayecto recto. */
  _pathBlocked(ex, ey, gx, gy, tilemap) {
    const { enemy } = this;
    const dist = Math.hypot(gx - ex, gy - ey);
    const steps = Math.min(6, Math.ceil(dist / 8));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = enemy.x + (gx - ex) * t;
      const py = enemy.y + (gy - ey) * t;
      if (CollisionSystem.collidesWithMap(enemy.getBoundingBoxAt(px, py), tilemap)) {
        return true;
      }
    }
    return false;
  }
}
