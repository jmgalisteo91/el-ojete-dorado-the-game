import { Entity } from './Entity.js?v=5';
import { CollisionSystem } from '../physics/CollisionSystem.js?v=5';

/**
 * Animal del pueblo (Oveja, Gallina, Perro) con deambulación orgánica (wander AI),
 * límites de territorio opcionales e interacción amistosa con el jugador.
 */
export class Animal extends Entity {
  constructor({
    name,
    species,
    x,
    y,
    animator,
    soundText = '¡Beee!',
    fedText = '¡Se come el trigo felizmente! ♥',
    speed = 24,
    homeRadius = 48,
    sceneId = 'overworld'
  }) {
    super({
      x,
      y,
      width: 16,
      height: 16,
      speed,
      boundingBox: { offsetX: 3, offsetY: 9, width: 10, height: 6 },
      animator,
      sceneId
    });

    this.name = name;
    this.species = species;
    this.soundText = soundText;
    this.fedText = fedText;
    this.homeX = x;
    this.homeY = y;
    this.homeRadius = homeRadius;
    this.interactionRange = 20;

    this.stateTimer = 1 + Math.random() * 2;
    this.moveDir = { x: 0, y: 0 };
    this.heartTimer = 0;
    this.ambientSoundCooldown = 4 + Math.random() * 6;
  }

  canInteract(player) {
    return this.distanceTo(player) <= this.interactionRange;
  }

  triggerHeart() {
    this.heartTimer = 2.2;
  }

  update(dt, tilemap, obstacles, paused = false, player = null, soundEngine = null) {
    if (this.heartTimer > 0) {
      this.heartTimer = Math.max(0, this.heartTimer - dt);
    }

    if (paused) {
      this.isMoving = false;
      super.update(dt);
      return;
    }

    // Sonido ambiental ocasional cuando el animal está cerca del jugador
    if (this.ambientSoundCooldown > 0) {
      this.ambientSoundCooldown -= dt;
    } else if (player && soundEngine && this.distanceTo(player) <= 68) {
      if (Math.random() < 0.35) {
        soundEngine.playAnimalSound(this.species);
      }
      this.ambientSoundCooldown = 7 + Math.random() * 8;
    } else {
      this.ambientSoundCooldown = 4 + Math.random() * 5;
    }

    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      // Alternar entre pastar/descansar y dar un pequeño paseo dentro de su zona
      if (this.isMoving || Math.random() < 0.45) {
        this.isMoving = false;
        this.moveDir = { x: 0, y: 0 };
        this.stateTimer = 1.4 + Math.random() * 2.2;
      } else {
        // Si se alejó mucho de su punto base, regresa hacia él
        const distHome = Math.hypot(this.x - this.homeX, this.y - this.homeY);
        let angle;
        if (distHome > this.homeRadius) {
          angle = Math.atan2(this.homeY - this.y, this.homeX - this.x);
        } else {
          const dirs = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
          angle = dirs[Math.floor(Math.random() * dirs.length)];
        }
        this.moveDir = { x: Math.cos(angle), y: Math.sin(angle) };
        this.isMoving = true;
        this.stateTimer = 0.8 + Math.random() * 1.4;
      }
    }

    if (this.isMoving) {
      if (Math.abs(this.moveDir.x) >= Math.abs(this.moveDir.y)) {
        this.direction = this.moveDir.x > 0 ? 'right' : 'left';
      } else {
        this.direction = this.moveDir.y > 0 ? 'down' : 'up';
      }

      const dx = this.moveDir.x * this.speed * dt;
      const dy = this.moveDir.y * this.speed * dt;
      const { blockedX, blockedY } = CollisionSystem.moveWithCollisions(
        this,
        dx,
        dy,
        tilemap,
        obstacles
      );

      if (blockedX && blockedY) {
        this.isMoving = false;
        this.stateTimer = 0.8;
      }
    }

    super.update(dt);
  }

  render(ctx, camera) {
    super.render(ctx, camera);

    // Si acaba de ser acariciado o alimentado, muestra un pequeño corazón flotante
    if (this.heartTimer > 0) {
      const sx = Math.round(this.centerX - camera.renderX);
      const sy = Math.round(this.y - camera.renderY - 7 - (2.2 - this.heartTimer) * 3);
      ctx.save();
      ctx.fillStyle = '#ff4d6d';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('♥', sx, sy);
      ctx.restore();
    }
  }
}

