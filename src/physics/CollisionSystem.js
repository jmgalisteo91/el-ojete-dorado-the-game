/**
 * CollisionSystem: Detección AABB (Axis-Aligned Bounding Box)
 * entre entidades y contra la capa de colisión del Tilemap.
 */
export class CollisionSystem {
  static checkAABB(a, b) {
    if (!a || !b) return false;
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  static isBoxColliding(a, b) {
    return CollisionSystem.checkAABB(a, b);
  }

  static collidesWithMap(box, tilemap) {
    const tileSize = tilemap.tileSize;
    const epsilon = 0.001;
    const leftCol = Math.floor(box.x / tileSize);
    const rightCol = Math.floor((box.x + box.width - epsilon) / tileSize);
    const topRow = Math.floor(box.y / tileSize);
    const bottomRow = Math.floor((box.y + box.height - epsilon) / tileSize);

    for (let r = topRow; r <= bottomRow; r++) {
      for (let c = leftCol; c <= rightCol; c++) {
        if (tilemap.isSolidAtTile(c, r)) {
          return true;
        }
      }
    }
    return false;
  }

  static collidesWithEntities(box, entities, ignoreEntity = null) {
    for (const other of entities) {
      if (!other || other === ignoreEntity || other.isSleeping) continue;
      if (other.worldBoundingBox && CollisionSystem.checkAABB(box, other.worldBoundingBox)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calcula el área de solapamiento entre dos cajas AABB.
   */
  static getOverlapDepth(a, b) {
    if (!a || !b) return 0;
    const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    if (ox <= 0 || oy <= 0) return 0;
    return ox * oy;
  }

  /**
   * Resuelve inmediatamente cualquier penetración entre la entidad y los obstáculos.
   * Si la entidad está respaldada por una pared, intenta desplazar al obstáculo dinámico
   * o buscar el eje libre secundario, evitando bloqueos permanentes o atascos.
   */
  static resolveEntitySeparation(entity, obstacles, tilemap = null) {
    if (!entity || !obstacles || obstacles.length === 0) return;
    const curBox = entity.getBoundingBoxAt(entity.x, entity.y);

    for (const other of obstacles) {
      if (!other || other === entity || other.isSleeping) continue;
      const otherBox = other.worldBoundingBox;
      if (!otherBox) continue;

      if (CollisionSystem.checkAABB(curBox, otherBox)) {
        const ox = Math.min(curBox.x + curBox.width, otherBox.x + otherBox.width) - Math.max(curBox.x, otherBox.x);
        const oy = Math.min(curBox.y + curBox.height, otherBox.y + otherBox.height) - Math.max(curBox.y, otherBox.y);

        if (ox > 0 && oy > 0) {
          const tryAxisX = () => {
            const pushDirX = entity.centerX < other.centerX ? -1 : 1;
            const targetX = entity.x + pushDirX * (ox + 0.5);
            const testBox = entity.getBoundingBoxAt(targetX, entity.y);
            if (!tilemap || !CollisionSystem.collidesWithMap(testBox, tilemap)) {
              entity.x = targetX;
              return true;
            }
            if (typeof other.x === 'number' && !other.isBoss) {
              const otherTargetX = other.x - pushDirX * (ox + 0.5);
              const otherTestBox = other.getBoundingBoxAt ? other.getBoundingBoxAt(otherTargetX, other.y) : null;
              if (otherTestBox && (!tilemap || !CollisionSystem.collidesWithMap(otherTestBox, tilemap))) {
                other.x = otherTargetX;
                return true;
              }
            }
            return false;
          };

          const tryAxisY = () => {
            const pushDirY = entity.centerY < other.centerY ? -1 : 1;
            const targetY = entity.y + pushDirY * (oy + 0.5);
            const testBox = entity.getBoundingBoxAt(entity.x, targetY);
            if (!tilemap || !CollisionSystem.collidesWithMap(testBox, tilemap)) {
              entity.y = targetY;
              return true;
            }
            if (typeof other.y === 'number' && !other.isBoss) {
              const otherTargetY = other.y - pushDirY * (oy + 0.5);
              const otherTestBox = other.getBoundingBoxAt ? other.getBoundingBoxAt(other.x, otherTargetY) : null;
              if (otherTestBox && (!tilemap || !CollisionSystem.collidesWithMap(otherTestBox, tilemap))) {
                other.y = otherTargetY;
                return true;
              }
            }
            return false;
          };

          if (ox < oy) {
            if (!tryAxisX()) tryAxisY();
          } else {
            if (!tryAxisY()) tryAxisX();
          }
        }
      }
    }
  }

  static moveWithCollisions(entity, dx, dy, tilemap, obstacles = []) {
    let blockedX = false;
    let blockedY = false;

    // 1. Separación preventiva previa para no quedar nunca atascado dentro de otro personaje
    if (obstacles && obstacles.length > 0) {
      CollisionSystem.resolveEntitySeparation(entity, obstacles, tilemap);
    }

    const currentBox = entity.getBoundingBoxAt(entity.x, entity.y);

    if (dx !== 0) {
      const nextX = entity.x + dx;
      const testBoxX = entity.getBoundingBoxAt(nextX, entity.y);
      let blockedByMap = tilemap ? CollisionSystem.collidesWithMap(testBoxX, tilemap) : false;
      let blockedByEntity = false;

      if (!blockedByMap && obstacles && obstacles.length > 0) {
        for (const other of obstacles) {
          if (!other || other === entity || other.isSleeping) continue;
          const otherBox = other.worldBoundingBox;
          if (!otherBox) continue;

          if (CollisionSystem.checkAABB(testBoxX, otherBox)) {
            // Si ya estaba en contacto, permitir movimiento si reduce el solapamiento (escapando)
            const curOverlap = CollisionSystem.getOverlapDepth(currentBox, otherBox);
            const nextOverlap = CollisionSystem.getOverlapDepth(testBoxX, otherBox);
            if (curOverlap > 0 && nextOverlap < curOverlap) {
              continue;
            }

            // Nudge / empuje suave de NPCs pacíficos para no quedar nunca atascado en puertas o pasillos
            if (other && !other.isBoss && typeof other.x === 'number') {
              const nudgeStep = dx * 0.45;
              const testOtherX = other.x + nudgeStep;
              const otherBoxCandidate = other.getBoundingBoxAt ? other.getBoundingBoxAt(testOtherX, other.y) : null;
              if (otherBoxCandidate && (!tilemap || !CollisionSystem.collidesWithMap(otherBoxCandidate, tilemap))) {
                other.x = testOtherX;
                const updatedOtherBox = other.worldBoundingBox;
                if (!CollisionSystem.checkAABB(testBoxX, updatedOtherBox)) {
                  continue;
                }
              }
            }

            blockedByEntity = true;
            break;
          }
        }
      }

      if (!blockedByMap && !blockedByEntity) {
        entity.x = nextX;
      } else {
        blockedX = true;
      }
    }

    if (dy !== 0) {
      const nextY = entity.y + dy;
      const testBoxY = entity.getBoundingBoxAt(entity.x, nextY);
      let blockedByMap = tilemap ? CollisionSystem.collidesWithMap(testBoxY, tilemap) : false;
      let blockedByEntity = false;

      if (!blockedByMap && obstacles && obstacles.length > 0) {
        for (const other of obstacles) {
          if (!other || other === entity || other.isSleeping) continue;
          const otherBox = other.worldBoundingBox;
          if (!otherBox) continue;

          if (CollisionSystem.checkAABB(testBoxY, otherBox)) {
            const curOverlap = CollisionSystem.getOverlapDepth(currentBox, otherBox);
            const nextOverlap = CollisionSystem.getOverlapDepth(testBoxY, otherBox);
            if (curOverlap > 0 && nextOverlap < curOverlap) {
              continue;
            }

            // Nudge / empuje suave de NPCs pacíficos para no quedar nunca atascado en puertas o pasillos
            if (other && !other.isBoss && typeof other.y === 'number') {
              const nudgeStep = dy * 0.45;
              const testOtherY = other.y + nudgeStep;
              const otherBoxCandidate = other.getBoundingBoxAt ? other.getBoundingBoxAt(other.x, testOtherY) : null;
              if (otherBoxCandidate && (!tilemap || !CollisionSystem.collidesWithMap(otherBoxCandidate, tilemap))) {
                other.y = testOtherY;
                const updatedOtherBox = other.worldBoundingBox;
                if (!CollisionSystem.checkAABB(testBoxY, updatedOtherBox)) {
                  continue;
                }
              }
            }

            blockedByEntity = true;
            break;
          }
        }
      }

      if (!blockedByMap && !blockedByEntity) {
        entity.y = nextY;
      } else {
        blockedY = true;
      }
    }

    // 2. Deslizamiento suave en esquinas (Corner Sliding estilo Zelda)
    if (blockedX && dy === 0 && dx !== 0 && (!tilemap || !CollisionSystem.collidesWithMap(currentBox, tilemap))) {
      for (const other of obstacles) {
        if (!other || other === entity || other.isSleeping) continue;
        const otherBox = other.worldBoundingBox;
        if (!otherBox) continue;
        if (CollisionSystem.checkAABB(entity.getBoundingBoxAt(entity.x + dx, entity.y), otherBox)) {
          const nudgeY = entity.centerY < other.centerY ? -1 : 1;
          const slideBoxY = entity.getBoundingBoxAt(entity.x, entity.y + nudgeY);
          if (
            (!tilemap || !CollisionSystem.collidesWithMap(slideBoxY, tilemap)) &&
            !CollisionSystem.collidesWithEntities(slideBoxY, obstacles, entity)
          ) {
            entity.y += nudgeY;
          }
          break;
        }
      }
    } else if (blockedY && dx === 0 && dy !== 0 && (!tilemap || !CollisionSystem.collidesWithMap(currentBox, tilemap))) {
      for (const other of obstacles) {
        if (!other || other === entity || other.isSleeping) continue;
        const otherBox = other.worldBoundingBox;
        if (!otherBox) continue;
        if (CollisionSystem.checkAABB(entity.getBoundingBoxAt(entity.x, entity.y + dy), otherBox)) {
          const nudgeX = entity.centerX < other.centerX ? -1 : 1;
          const slideBoxX = entity.getBoundingBoxAt(entity.x + nudgeX, entity.y);
          if (
            (!tilemap || !CollisionSystem.collidesWithMap(slideBoxX, tilemap)) &&
            !CollisionSystem.collidesWithEntities(slideBoxX, obstacles, entity)
          ) {
            entity.x += nudgeX;
          }
          break;
        }
      }
    }

    return { blockedX, blockedY };
  }

  /**
   * Comprueba si los pies/base de una entidad están pisando un tile específico.
   * Utilizado para interruptores de presión y baldosas trampa.
   */
  static isEntityOnTile(entity, tileCol, tileRow, tileSize = 16) {
    if (!entity) return false;
    const feetX = entity.x + (entity.width || tileSize) * 0.5;
    const feetY = entity.y + (entity.height || tileSize) * 0.85;
    return (
      Math.floor(feetX / tileSize) === tileCol &&
      Math.floor(feetY / tileSize) === tileRow
    );
  }

}
