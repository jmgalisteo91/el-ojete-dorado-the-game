import { Entity } from './Entity.js?v=6';
import { TILES, ATLAS_SCALE } from '../graphics/SpriteSheetGenerator.js?v=6';

/**
 * Objeto recolectable en el mundo o dentro de un cofre que pasa al Inventario.
 */
export class WorldItem extends Entity {
  constructor({
    id,
    name,
    description,
    iconIndex,
    x,
    y,
    sceneId = 'overworld',
    itemsSheet,
    tilesetSheet = null,
    isChest = false,
    nightOnly = false
  }) {
    super({
      x,
      y,
      width: 16,
      height: 16,
      speed: 0,
      boundingBox: { offsetX: 3, offsetY: 3, width: 10, height: 10 },
      sceneId
    });

    this.id = id;
    this.name = name;
    this.description = description;
    this.iconIndex = iconIndex;
    this.itemsSheet = itemsSheet;
    this.tilesetSheet = tilesetSheet;
    this.isChest = isChest;
    this.nightOnly = nightOnly;
    this.collected = false;
    this.floatTimer = Math.random() * Math.PI * 2;
    this.interactionRange = 20;
  }

  canInteract(player, isNight = false) {
    if (this.collected) return false;
    if (this.nightOnly && !isNight) return false;
    return this.distanceTo(player) <= this.interactionRange;
  }

  update(dt) {
    this.floatTimer += dt * 3.2;
  }

  render(ctx, camera, isNight = false) {
    if (this.nightOnly && !isNight) return;
    if (this.collected && !this.isChest) return;

    const screenX = Math.round(this.x - camera.renderX);
    const screenY = Math.round(this.y - camera.renderY);

    // Si es un Cofre (cerrado o ya abierto), dibujarlo con el sprite de cofre del tileset
    if (this.isChest && this.tilesetSheet) {
      ctx.save();
      if (!this.collected) {
        const pulse = 0.5 + 0.35 * Math.sin(this.floatTimer * 2.2);
        if (this.id === 'item_abyssal_pointer') {
          // Resplandor arcano violeta bajo el Cofre Abisal
          ctx.fillStyle = `rgba(168, 85, 247, ${pulse * 0.55})`;
          ctx.fillRect(screenX + 1, screenY + 11, 14, 4);
          const pY1 = (this.floatTimer * 12) % 16;
          ctx.fillStyle = 'rgba(233, 213, 255, 0.85)';
          ctx.fillRect(screenX + 3 + Math.sin(this.floatTimer) * 2, screenY + 13 - pY1, 1.5, 1.5);
          ctx.fillStyle = 'rgba(192, 132, 252, 0.9)';
          ctx.fillRect(screenX + 12 - Math.cos(this.floatTimer) * 2, screenY + 11 - (pY1 * 0.7), 1.5, 1.5);
        } else {
          // Brillo dorado sutil bajo el cofre cerrado
          ctx.fillStyle = `rgba(251, 191, 36, ${pulse * 0.4})`;
          ctx.fillRect(screenX + 2, screenY + 12, 12, 3);
        }
      }

      const tileId = this.collected ? TILES.CHEST_OPEN : TILES.CHEST_CLOSED;
      const tilesetCols = 8;
      const sx = (tileId % tilesetCols) * 16 * ATLAS_SCALE;
      const sy = Math.floor(tileId / tilesetCols) * 16 * ATLAS_SCALE;
      ctx.drawImage(
        this.tilesetSheet,
        sx,
        sy,
        16 * ATLAS_SCALE,
        16 * ATLAS_SCALE,
        screenX,
        screenY,
        16,
        16
      );
      ctx.restore();
      return;
    }

    const bob = Math.round(Math.sin(this.floatTimer) * 1.5);

    ctx.save();
    if (this.id === 'item_abyssal_pointer') {
      const pulse = 0.5 + 0.3 * Math.sin(this.floatTimer * 2);
      // Halo místico violeta en el suelo
      ctx.fillStyle = `rgba(168, 85, 247, ${pulse * 0.45})`;
      ctx.fillRect(screenX + 2, screenY + 11, 12, 4);

      // Partículas rúnicas ascendentes
      const pY1 = ((this.floatTimer * 14) % 18);
      const pY2 = (((this.floatTimer + 1.5) * 12) % 18);
      ctx.fillStyle = 'rgba(233, 213, 255, 0.75)';
      ctx.fillRect(screenX + 3 + Math.sin(this.floatTimer) * 2, screenY + 14 - pY1, 1, 1);
      ctx.fillStyle = 'rgba(192, 132, 252, 0.85)';
      ctx.fillRect(screenX + 11 - Math.cos(this.floatTimer) * 2, screenY + 14 - pY2, 1, 1);
    } else if (this.nightOnly || this.id.startsWith('silicon_flower')) {
      const pulse = 0.5 + 0.35 * Math.sin(this.floatTimer * 3.5);
      // Halo cian bioluminiscente de noche
      ctx.fillStyle = `rgba(56, 189, 248, ${pulse * 0.45})`;
      ctx.fillRect(screenX + 2, screenY + 11, 12, 4);
      // Chispas flotantes de silicio
      ctx.fillStyle = 'rgba(186, 230, 253, 0.85)';
      ctx.fillRect(screenX + 5 + Math.sin(this.floatTimer * 2) * 3, screenY + 8 - ((this.floatTimer * 8) % 10), 1, 1);
    } else {
      // Sombra brillante estándar en el suelo
      ctx.fillStyle = 'rgba(255, 225, 130, 0.35)';
      ctx.fillRect(screenX + 4, screenY + 12, 8, 3);
    }

    // Icono del objeto desde el spritesheet de items
    ctx.drawImage(
      this.itemsSheet,
      this.iconIndex * 16 * ATLAS_SCALE,
      0,
      16 * ATLAS_SCALE,
      16 * ATLAS_SCALE,
      screenX,
      screenY + bob,
      16,
      16
    );
    ctx.restore();
  }
}

