import { Entity } from './Entity.js?v=5';
import { CollisionSystem } from '../physics/CollisionSystem.js?v=5';
import { SpeechBubble, renderNPCBarkBubble, renderActivityIcon } from '../ui/SpeechBubble.js?v=7';

const DIRECTIONS = ['down', 'up', 'left', 'right'];

/**
 * Entidad NPC con rutinas naturales estilo RPG clásico (Zelda):
 * - Puntos de interés con dirección de mirada, iconos de oficio y pausas variables
 * - Mirada orgánica a su alrededor cuando descansa
 * - Reconocimiento visual cuando el jugador pasa cerca
 * - Evasión lateral suave de obstáculos para no atascarse nunca
 * - Pequeños bocadillos ambientales de vida cotidiana
 */
export class NPC extends Entity {
  constructor({
    name,
    jobTitle = '',
    homeSceneId = null,
    x,
    y,
    animator,
    dialogues = ['¡Hola, viajero!'],
    getDialogues = null,
    behavior = 'patrol',
    patrolPoints = [],
    ambientPhrases = [],
    interactionRange = 24,
    initialDirection = 'down',
    speed = 28,
    sceneId = 'overworld'
  }) {
    super({
      x,
      y,
      width: 16,
      height: 16,
      speed,
      boundingBox: { offsetX: 3, offsetY: 8, width: 10, height: 7 },
      animator,
      sceneId
    });

    this.name = name;
    this.jobTitle = jobTitle;
    this.homeSceneId = homeSceneId;
    this.overworldX = x;
    this.overworldY = y;
    this.overworldBehavior = behavior;
    this.dialogues = dialogues;
    this.getDialogues = getDialogues;
    this.behavior = behavior;
    this.patrolPoints =
      patrolPoints.length > 0 ? patrolPoints : [{ x, y, dir: initialDirection }];
    this.ambientPhrases = ambientPhrases;
    this.interactionRange = interactionRange;
    this.direction = initialDirection;

    this.currentWaypointIndex = 0;
    this.waitTimer = 1.2 + Math.random() * 2.0;
    this.lookTimer = 1.0 + Math.random() * 1.8;
    this.stuckTimer = 0;
    this.currentActivityIcon = '';

    // Bocadillos ambientales discretos
    this.ambientCooldown = 4 + Math.random() * 9;
    this.ambientBubbleText = '';
    this.ambientBubbleTimer = 0;
    this.promptBobTimer = Math.random() * 6;
  }

  canInteract(player) {
    return this.distanceTo(player) <= this.interactionRange;
  }

  resolveDialogues() {
    if (typeof this.getDialogues === 'function') {
      return this.getDialogues();
    }
    return this.dialogues;
  }

  faceEntity(other) {
    const dx = other.centerX - this.centerX;
    const dy = other.centerY - this.centerY;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? 'right' : 'left';
    } else {
      this.direction = dy > 0 ? 'down' : 'up';
    }
    this.isMoving = false;
  }

  triggerAmbientBark(customText = null) {
    const text =
      customText ||
      (this.ambientPhrases.length > 0
        ? this.ambientPhrases[Math.floor(Math.random() * this.ambientPhrases.length)]
        : '');
    if (text) {
      this.ambientBubbleText = text;
      this.ambientBubbleTimer = 3.0;
    }
  }

  update(dt, tilemap, obstacles, isTalking = false, player = null) {
    this.promptBobTimer += dt * 4.5;

    if (this.ambientBubbleTimer > 0) {
      this.ambientBubbleTimer = Math.max(0, this.ambientBubbleTimer - dt);
    }

    if (isTalking) {
      this.isMoving = false;
      this.ambientBubbleTimer = 0;
      super.update(dt);
      return;
    }

    // Gestión de frases ambientales ocasionales cuando el jugador está por la zona
    if (this.ambientPhrases.length > 0 && player && this.sceneId === 'overworld') {
      if (this.ambientCooldown > 0) {
        this.ambientCooldown -= dt;
      } else {
        const distPlayer = this.distanceTo(player);
        if (distPlayer <= 110 && Math.random() < 0.45) {
          this.triggerAmbientBark();
        }
        this.ambientCooldown = 9 + Math.random() * 11;
      }
    }

    // Modo estático con vida (ej. dentro de su casa o en el calabozo): mira al jugador si se acerca o gira la vista ocasionalmente
    if (this.behavior === 'static') {
      this.isMoving = false;
      if (player && this.distanceTo(player) <= 36) {
        this.faceEntity(player);
      } else {
        this.lookTimer -= dt;
        if (this.lookTimer <= 0) {
          this.lookTimer = 2.5 + Math.random() * 3.0;
          if (Math.random() < 0.35) {
            this.direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
          }
        }
      }
      super.update(dt);
      return;
    }

    // Si está realizando una pausa en un punto de interés de su rutina
    if (this.waitTimer > 0) {
      this.waitTimer -= dt;
      this.isMoving = false;

      // Si el jugador pasa justo al lado mientras el NPC descansa, lo mira con naturalidad
      if (player && this.distanceTo(player) <= 28) {
        this.faceEntity(player);
      } else {
        this.lookTimer -= dt;
        if (this.lookTimer <= 0) {
          this.lookTimer = 1.5 + Math.random() * 2.2;
          const wp = this.patrolPoints[this.currentWaypointIndex];
          if (wp && wp.dir && Math.random() < 0.65) {
            this.direction = wp.dir;
          } else {
            this.direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
          }
        }
      }

      if (this.waitTimer <= 0) {
        this.currentActivityIcon = '';
        // Elegir siguiente punto de forma natural (generalmente el siguiente de la ruta, o uno aleatorio cercano)
        if (this.patrolPoints.length > 2 && Math.random() < 0.25) {
          let nextIdx = Math.floor(Math.random() * this.patrolPoints.length);
          if (nextIdx === this.currentWaypointIndex) {
            nextIdx = (this.currentWaypointIndex + 1) % this.patrolPoints.length;
          }
          this.currentWaypointIndex = nextIdx;
        } else {
          this.currentWaypointIndex =
            (this.currentWaypointIndex + 1) % this.patrolPoints.length;
        }
      }

      super.update(dt);
      return;
    }

    const target = this.patrolPoints[this.currentWaypointIndex];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= 2.0) {
      this.x = target.x;
      this.y = target.y;
      this.isMoving = false;
      this.stuckTimer = 0;

      if (target.dir) {
        this.direction = target.dir;
      }
      this.currentActivityIcon = target.activityIcon || '';

      const wMin = target.waitMin ?? 2.0;
      const wMax = target.waitMax ?? 4.4;
      this.waitTimer = wMin + Math.random() * (wMax - wMin);
      this.lookTimer = 1.4 + Math.random() * 1.8;
    } else {
      const nx = dx / dist;
      const ny = dy / dist;

      // Si el jugador se interpone a muy corta distancia en su camino, el NPC hace una breve pausa cortés
      if (player && this.distanceTo(player) <= 18) {
        this.isMoving = false;
        this.faceEntity(player);
        this.waitTimer = 1.1 + Math.random() * 0.9;
        super.update(dt);
        return;
      }

      const stepX = nx * this.speed * dt;
      const stepY = ny * this.speed * dt;
      let { blockedX, blockedY } = CollisionSystem.moveWithCollisions(
        this,
        stepX,
        stepY,
        tilemap,
        obstacles
      );

      // Si un eje está bloqueado, intentar rodear suavemente en el eje perpendicular
      if (blockedX && Math.abs(stepY) < 0.2) {
        const slideY = (dy >= 0 ? 1 : -1) * this.speed * 0.75 * dt;
        CollisionSystem.moveWithCollisions(this, 0, slideY, tilemap, obstacles);
      } else if (blockedY && Math.abs(stepX) < 0.2) {
        const slideX = (dx >= 0 ? 1 : -1) * this.speed * 0.75 * dt;
        CollisionSystem.moveWithCollisions(this, slideX, 0, tilemap, obstacles);
      }

      if (Math.abs(nx) >= Math.abs(ny)) {
        this.direction = nx > 0 ? 'right' : 'left';
      } else {
        this.direction = ny > 0 ? 'down' : 'up';
      }

      if (blockedX && blockedY) {
        this.stuckTimer += dt;
        this.isMoving = false;
        // Si lleva más de 0.55s bloqueado por un obstáculo, descansa y pasa al siguiente destino sin atascarse
        if (this.stuckTimer > 0.55) {
          this.stuckTimer = 0;
          this.waitTimer = 1.2 + Math.random() * 1.4;
        }
      } else {
        this.stuckTimer = Math.max(0, this.stuckTimer - dt * 0.5);
        this.isMoving = true;
      }
    }

    super.update(dt);
  }

  render(ctx, camera) {
    super.render(ctx, camera);

    const sx = Math.round(this.centerX - camera.renderX);
    const sy = Math.round(this.y - camera.renderY);

    // Bocadillo ambiental de vida cotidiana (bocadillo estilo cómic / juego indie moderno)
    if (this.ambientBubbleTimer > 0 && this.ambientBubbleText) {
      renderNPCBarkBubble(ctx, sx, sy, this.ambientBubbleText, this.ambientBubbleTimer, 3.0);
    } else if (this.currentActivityIcon && !this.isMoving) {
      // Pequeño bocadillo de actividad cuando está trabajando en su oficio
      const bob = Math.round(Math.sin(this.promptBobTimer) * 1.2);
      renderActivityIcon(ctx, sx, sy, this.currentActivityIcon, bob);
    }
  }
}

