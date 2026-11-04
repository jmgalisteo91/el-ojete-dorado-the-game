/**
 * CollisionSystem: Detección AABB (Axis-Aligned Bounding Box)
 * entre entidades y contra la capa de colisión del Tilemap.
 */
export class CollisionSystem {
  static checkAABB(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
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
      if (other === ignoreEntity) continue;
      if (CollisionSystem.checkAABB(box, other.worldBoundingBox)) {
        return true;
      }
    }
    return false;
  }

  static moveWithCollisions(entity, dx, dy, tilemap, obstacles = []) {
    let blockedX = false;
    let blockedY = false;

    if (dx !== 0) {
      const nextX = entity.x + dx;
      const testBoxX = entity.getBoundingBoxAt(nextX, entity.y);
      if (
        !CollisionSystem.collidesWithMap(testBoxX, tilemap) &&
        !CollisionSystem.collidesWithEntities(testBoxX, obstacles, entity)
      ) {
        entity.x = nextX;
      } else {
        blockedX = true;
      }
    }

    if (dy !== 0) {
      const nextY = entity.y + dy;
      const testBoxY = entity.getBoundingBoxAt(entity.x, nextY);
      if (
        !CollisionSystem.collidesWithMap(testBoxY, tilemap) &&
        !CollisionSystem.collidesWithEntities(testBoxY, obstacles, entity)
      ) {
        entity.y = nextY;
      } else {
        blockedY = true;
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

  /**
   * Comprueba si la caja de colisión de una entidad se solapa con un tile.
   */
  static isBoxOverlappingTile(box, tileCol, tileRow, tileSize = 16) {
    if (!box) return false;
    const tileBox = {
      x: tileCol * tileSize,
      y: tileRow * tileSize,
      width: tileSize,
      height: tileSize
    };
    return CollisionSystem.checkAABB(box, tileBox);
  }

  /**
   * Comprueba si una entidad está cerca del centro de un punto o tile.
   */
  static isEntityNearPoint(entity, targetX, targetY, maxDist = 24) {
    if (!entity) return false;
    const cx = entity.x + (entity.width || 16) * 0.5;
    const cy = entity.y + (entity.height || 16) * 0.5;
    return Math.hypot(cx - targetX, cy - targetY) <= maxDist;
  }
}

