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
    this.isSleeping = false;
    this.jobAnimTimer = Math.random() * 5.0;

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
    this.jobAnimTimer += dt;

    if (this.ambientBubbleTimer > 0) {
      this.ambientBubbleTimer = Math.max(0, this.ambientBubbleTimer - dt);
    }

    if (this.isSleeping) {
      this.isMoving = false;
      super.update(dt);
      return;
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
        // Rutas de waypoints fijas y deterministas para impedir bloqueos o extravíos
        this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.patrolPoints.length;
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

      // Comprobación AABB previa al paso para evitar colisionar con cajas, setos o muros
      const nextBox = {
        x: this.x + stepX + this.boundingBox.offsetX,
        y: this.y + stepY + this.boundingBox.offsetY,
        width: this.boundingBox.width,
        height: this.boundingBox.height
      };

      let willCollide = tilemap && CollisionSystem.collidesWithMap(nextBox, tilemap);
      if (!willCollide && Array.isArray(obstacles)) {
        for (const obs of obstacles) {
          if (obs !== this && obs.worldBoundingBox && CollisionSystem.checkAABB(nextBox, obs.worldBoundingBox)) {
            willCollide = true;
            break;
          }
        }
      }

      let blockedX = false;
      let blockedY = false;

      if (!willCollide) {
        const moveRes = CollisionSystem.moveWithCollisions(
          this,
          stepX,
          stepY,
          tilemap,
          obstacles
        );
        blockedX = moveRes.blockedX;
        blockedY = moveRes.blockedY;
      } else {
        // Intento de deslizamiento en un solo eje
        const slideY = CollisionSystem.moveWithCollisions(this, 0, stepY, tilemap, obstacles);
        const slideX = CollisionSystem.moveWithCollisions(this, stepX, 0, tilemap, obstacles);
        blockedX = slideX.blockedX;
        blockedY = slideY.blockedY;
      }

      if (Math.abs(nx) >= Math.abs(ny)) {
        this.direction = nx > 0 ? 'right' : 'left';
      } else {
        this.direction = ny > 0 ? 'down' : 'up';
      }

      if (blockedX && blockedY) {
        this.stuckTimer += dt;
        this.isMoving = false;
        // Si lleva más de 0.45s bloqueado, avanza suavemente al siguiente waypoint sin quedarse congelado
        if (this.stuckTimer > 0.45) {
          this.stuckTimer = 0;
          this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.patrolPoints.length;
          this.waitTimer = 0.8;
        }
      } else {
        this.stuckTimer = Math.max(0, this.stuckTimer - dt * 0.5);
        this.isMoving = true;
      }
    }

    super.update(dt);
  }

  render(ctx, camera) {
    const sx = Math.round(this.centerX - camera.renderX);
    const sy = Math.round(this.y - camera.renderY);

    if (this.isSleeping) {
      // Estado durmiendo en cama: silueta en reposo y zZz animados
      ctx.save();
      const zPhase = (this.jobAnimTimer * 2) % 3;
      const zY = sy - 8 - zPhase * 4;
      const zX = sx + 4 + Math.sin(this.jobAnimTimer * 3) * 2;
      ctx.font = 'bold 5.5px monospace';
      ctx.fillStyle = '#93c5fd';
      ctx.textAlign = 'center';
      ctx.fillText(zPhase > 1.5 ? 'Z' : 'z', zX, zY);

      // Manta/cuerpo en cama
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(sx - 7, sy + 3, 14, 8);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(sx - 6, sy + 4, 12, 6);
      ctx.restore();
      return;
    }

    super.render(ctx, camera);

    // Animaciones de oficio exclusivas
    const isDayScene = this.sceneId === 'overworld';
    if (isDayScene && !this.isMoving) {
      const isBrom = this.name.includes('Brom');
      const isLyra = this.name.includes('Lyra');
      const isGuard = this.name.includes('Bruno') || this.name.includes('Kael');

      if (isBrom) {
        // Herrero Brom: Martilleo rítmico sobre el yunque con chispas de forja
        ctx.save();
        const cycle = (this.jobAnimTimer * 1.5) % 1.5;
        if (cycle < 0.3) {
          // Golpe de martillo
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(sx + 5, sy + 4, 4, 2);
          ctx.fillStyle = '#475569';
          ctx.fillRect(sx + 7, sy + 6, 2, 4);
          // Chispas de forja
          ctx.fillStyle = cycle < 0.15 ? '#fef08a' : '#f97316';
          ctx.fillRect(sx + 8 + Math.cos(cycle * 30) * 4, sy + 3 - cycle * 12, 1.5, 1.5);
          ctx.fillRect(sx + 6 - Math.sin(cycle * 30) * 3, sy + 4 - cycle * 10, 1.5, 1.5);
        } else {
          // Brazo levantado en preparación
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(sx + 5, sy - 1, 3, 3);
        }
        ctx.restore();
      } else if (isLyra) {
        // Herbolaria Lyra: Riego periódico en su huerto botánico
        ctx.save();
        const cycle = (this.jobAnimTimer * 1.2) % 2.0;
        if (cycle < 0.8) {
          // Regadera y gotas de agua
          ctx.fillStyle = '#64748b';
          ctx.fillRect(sx + 6, sy + 2, 4, 3);
          ctx.fillStyle = '#38bdf8';
          const dropY = sy + 6 + (cycle * 14) % 6;
          ctx.fillRect(sx + 9, dropY, 1, 1.5);
          ctx.fillRect(sx + 11, dropY + 1, 1, 1.5);
        }
        ctx.restore();
      } else if (isGuard) {
        // Capitán Bruno / Guardia Kael: Postura marcial con escudo en alto custodiando el Puente
        ctx.save();
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(sx - 7, sy + 2, 4, 8);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - 6.5, sy + 2.5, 3, 7);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(sx - 6, sy + 5, 2, 2); // Emblema del escudo
        ctx.restore();
      }
    }

    // Bocadillo ambiental de vida cotidiana
    if (this.ambientBubbleTimer > 0 && this.ambientBubbleText) {
      renderNPCBarkBubble(ctx, sx, sy, this.ambientBubbleText, this.ambientBubbleTimer, 3.0);
    } else if (this.currentActivityIcon && !this.isMoving) {
      // Pequeño bocadillo de actividad cuando está descansando en su puesto
      const bob = Math.round(Math.sin(this.promptBobTimer) * 1.2);
      renderActivityIcon(ctx, sx, sy, this.currentActivityIcon, bob);
    }
  }
}

