/**
 * Inventory.js - Sistema de Inventario y Mochila de Objetos Consumibles ('El Ojete Dorado')
 *
 * Rediseñado bajo UILayout (Safe Layout 290×150 px):
 * - Izquierda: Rejilla fija de 2 filas × 4 columnas con slots de 22×22 px y paginación estricta.
 * - Panel lateral derecho: Icono, nombre, tipo de objeto, cantidad y descripción con wrapText estricto.
 */

import { UILayout, UI_COLORS, UI_FONT } from './UILayout.js?v=8';

const KEY_OR_QUEST_ITEM_IDS = new Set([
  'dawn_armor',
  'dawn_sword',
  'bridge_pass',
  'golden_apple',
  'item_abyssal_pointer',
  'lantern',
  'silicon_flower',
  'drone_scrap',
  'river_trout'
]);

const CONSUMABLE_ITEM_IDS = new Set([
  'bread',
  'coffee',
  'armor_potion',
  'golden_apple',
  'river_trout'
]);

export class Inventory {
  constructor(itemsSheet, viewportWidth = 320, viewportHeight = 180) {
    this.itemsSheet = itemsSheet;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    this.isOpen = false;
    this.maxSlots = 16;
    this.visibleSlots = 8; // 2 filas x 4 columnas por página
    this.slotSize = 22;    // 22x22 px exactos por slot
    this.items = [];
    this.selectedIndex = 0;
    this.statusMessage = '';
  }

  open() {
    this.isOpen = true;
    this.statusMessage = '';
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.statusMessage = '';
  }

  close() {
    this.isOpen = false;
    this.statusMessage = '';
  }

  /**
   * Añade un objeto al inventario (acumulando cantidad si ya existe).
   * Los objetos clave de historia/misión nunca son bloqueados por límite de ranuras.
   */
  addItem(itemData) {
    if (!itemData || !itemData.id) return false;
    const existing = this.items.find((it) => it.id === itemData.id);
    if (existing) {
      existing.qty += itemData.qty || 1;
      return true;
    }
    const isEssential = KEY_OR_QUEST_ITEM_IDS.has(itemData.id);
    if (this.items.length >= this.maxSlots && !isEssential) {
      return false;
    }
    this.items.push({
      id: itemData.id,
      name: itemData.name,
      description: itemData.description,
      iconIndex: itemData.iconIndex,
      qty: itemData.qty || 1
    });
    return true;
  }

  hasItem(itemId) {
    return this.items.some((it) => it.id === itemId && it.qty > 0);
  }

  getItemCount(itemId) {
    const it = this.items.find((item) => item.id === itemId);
    return it ? (it.qty || 1) : 0;
  }

  consumeItem(itemId, amount = 1) {
    const idx = this.items.findIndex((it) => it.id === itemId);
    if (idx === -1) return false;
    this.items[idx].qty -= amount;
    if (this.items[idx].qty <= 0) {
      this.items.splice(idx, 1);
      if (this.selectedIndex >= this.items.length) {
        this.selectedIndex = Math.max(0, this.items.length - 1);
      }
    }
    return true;
  }

  /**
   * Devuelve el primer consumible activo para la ranura rápida (Quick-Slot [R]/[1])
   */
  getFirstConsumable() {
    return this.items.find((it) => CONSUMABLE_ITEM_IDS.has(it.id) && it.qty > 0) || null;
  }

  /**
   * Descarta 1 unidad del objeto seleccionado.
   */
  dropSelectedItem() {
    const item = this.getSelectedItem();
    if (!item) return null;

    const dropped = {
      id: item.id,
      name: item.name,
      description: item.description,
      iconIndex: item.iconIndex,
      qty: 1
    };

    item.qty -= 1;
    if (item.qty <= 0) {
      this.items.splice(this.selectedIndex, 1);
      if (this.selectedIndex >= this.items.length) {
        this.selectedIndex = Math.max(0, this.items.length - 1);
      }
    }

    this.statusMessage = `¡Descartaste 1x ${dropped.name}!`;
    return dropped;
  }

  getTotalCount() {
    return this.items.reduce((sum, it) => sum + it.qty, 0);
  }

  /**
   * Clasifica el tipo semántico del objeto para el panel de detalles
   */
  getItemCategory(item) {
    if (!item || !item.id) return { label: 'VACÍO', color: UI_COLORS.textMuted };
    if (item.id === 'dawn_armor' || item.id === 'dawn_sword' || item.id === 'item_abyssal_pointer') {
      return { label: 'RELIQUIA SAGRADA', color: UI_COLORS.gold };
    }
    if (CONSUMABLE_ITEM_IDS.has(item.id)) {
      return { label: 'CONSUMIBLE [R]', color: UI_COLORS.emerald };
    }
    if (KEY_OR_QUEST_ITEM_IDS.has(item.id)) {
      return { label: 'OBJETO CLAVE', color: UI_COLORS.cyan };
    }
    return { label: 'MATERIAL / BOTÍN', color: UI_COLORS.purple };
  }

  /**
   * Navegación por la cuadrícula de 4 columnas × 2 filas por página
   */
  moveSelection(dir) {
    const cols = 4;
    const totalPages = Math.max(1, Math.ceil(Math.max(this.items.length, this.selectedIndex + 1) / this.visibleSlots));
    const totalSlots = totalPages * this.visibleSlots;
    const rows = Math.max(2, Math.ceil(totalSlots / cols));
    const col = this.selectedIndex % cols;
    const row = Math.floor(this.selectedIndex / cols);

    if (dir === 'left') {
      const nextCol = (col - 1 + cols) % cols;
      this.selectedIndex = row * cols + nextCol;
    } else if (dir === 'right') {
      const nextCol = (col + 1) % cols;
      this.selectedIndex = row * cols + nextCol;
    } else if (dir === 'up') {
      const nextRow = (row - 1 + rows) % rows;
      this.selectedIndex = nextRow * cols + col;
    } else if (dir === 'down') {
      const nextRow = (row + 1) % rows;
      this.selectedIndex = nextRow * cols + col;
    }
    this.statusMessage = '';
  }

  getSelectedItem() {
    return this.items[this.selectedIndex] || null;
  }

  /**
   * Renderiza el modal unificado de 290×150 px de la Mochila.
   * Izquierda: Rejilla 2 filas × 4 columnas (slots de 22×22 px).
   * Derecha: Panel de detalle con icono, nombre, tipo y descripción con wrapText estricto.
   */
  render(ctx, player = null) {
    if (!this.isOpen) return;

    const totalItems = this.items.length;
    const currentPage = Math.floor(this.selectedIndex / this.visibleSlots);
    const totalPages = Math.max(1, Math.ceil(Math.max(totalItems, this.selectedIndex + 1) / this.visibleSlots));

    const frame = UILayout.drawModalFrame(ctx, {
      title: 'MOCHILA E INVENTARIO',
      icon: '🎒',
      badge: `${totalItems}/${this.maxSlots} SLOTS`,
      closeLabel: '[Esc] Cerrar'
    });

    const { content } = frame;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    // =========================================================================
    // COLUMNA IZQUIERDA: Rejilla fija 2 filas × 4 columnas (slots de 22×22 px)
    // =========================================================================
    const leftW = 112;
    const leftRect = {
      x: content.x,
      y: content.y,
      w: leftW,
      h: content.h
    };

    UILayout.drawPanel(ctx, leftRect, {
      bg: UI_COLORS.panelBg,
      border: UI_COLORS.borderInner,
      headerText: `RANURAS (PÁG ${currentPage + 1}/${totalPages})`
    });

    const cols = 4;
    const rows = 2;
    const slotSize = 22; // 22×22 px estrictos según especificación
    const gapX = 4;
    const gapY = 5;
    const gridW = cols * slotSize + (cols - 1) * gapX; // 100 px
    const gridStartX = leftRect.x + Math.floor((leftRect.w - gridW) / 2);
    const gridStartY = leftRect.y + 16;

    const firstSlotIndex = currentPage * this.visibleSlots;
    const quickItem = this.getFirstConsumable();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = r * cols + c;
        const slotIndex = firstSlotIndex + v;
        const sx = gridStartX + c * (slotSize + gapX);
        const sy = gridStartY + r * (slotSize + gapY);
        const isSelected = slotIndex === this.selectedIndex;
        const item = this.items[slotIndex];

        // Fondo y bisel de ranura 22×22 px
        ctx.fillStyle = isSelected ? UI_COLORS.slotSelectedBg : UI_COLORS.slotBg;
        ctx.fillRect(sx, sy, slotSize, slotSize);

        ctx.strokeStyle = isSelected ? UI_COLORS.slotSelectedBorder : UI_COLORS.slotBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, slotSize - 1, slotSize - 1);

        if (item) {
          // Dibujar sprite 16x16 centrado dentro del slot de 22x22
          UILayout.drawItemIcon(ctx, this.itemsSheet, item.iconIndex, sx + 3, sy + 2, 16);

          // Etiqueta de cantidad en esquina inferior derecha
          const qtyStr = `x${item.qty}`;
          ctx.font = `bold 4px ${UI_FONT}`;
          const qw = ctx.measureText(qtyStr).width;
          ctx.fillStyle = 'rgba(10, 14, 23, 0.86)';
          ctx.fillRect(sx + slotSize - qw - 3, sy + slotSize - 7, qw + 2, 6);
          ctx.fillStyle = UI_COLORS.gold;
          ctx.fillText(qtyStr, sx + slotSize - qw - 2, sy + slotSize - 6);

          // Indicador discreto si es el Quick-Slot [R] activo
          if (quickItem && quickItem.id === item.id) {
            ctx.fillStyle = UI_COLORS.emerald;
            ctx.fillRect(sx + 1, sy + 1, 5, 5);
            ctx.font = `bold 3.5px ${UI_FONT}`;
            ctx.fillStyle = '#06101e';
            ctx.fillText('R', sx + 2, sy + 1.5);
          }
        } else {
          // Ranura vacía
          ctx.font = `4px ${UI_FONT}`;
          ctx.fillStyle = 'rgba(100, 116, 139, 0.45)';
          const numStr = String(slotIndex + 1);
          const nw = ctx.measureText(numStr).width;
          ctx.fillText(numStr, sx + Math.floor((slotSize - nw) / 2), sy + 9);
        }
      }
    }

    // Resumen compacto inferior izquierdo (Bytes + Ranura Rápida [R])
    const summaryY = gridStartY + rows * (slotSize + gapY) + 4;
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
    ctx.beginPath();
    ctx.moveTo(leftRect.x + 5, summaryY);
    ctx.lineTo(leftRect.x + leftRect.w - 5, summaryY);
    ctx.stroke();

    const coins = player ? (player.coins ?? 0) : 0;
    ctx.font = `bold 4.5px ${UI_FONT}`;
    ctx.fillStyle = UI_COLORS.gold;
    ctx.fillText(`◈ BYTES: ${coins}`, leftRect.x + 6, summaryY + 5);

    ctx.font = `4px ${UI_FONT}`;
    ctx.fillStyle = UI_COLORS.textSecondary;
    const quickText = quickItem
      ? `[R] Rápido: ${quickItem.name} (x${quickItem.qty})`
      : '[R] Rápido: Sin consumible';
    ctx.fillText(UILayout.fitText(ctx, quickText, leftRect.w - 12), leftRect.x + 6, summaryY + 14);

    if (totalPages > 1) {
      UILayout.drawPager(ctx, leftRect.x + leftRect.w - 28, summaryY + 4, currentPage + 1, totalPages);
    }

    // =========================================================================
    // PANEL LATERAL DERECHO: Icono, Nombre, Tipo y Descripción con wrapText
    // =========================================================================
    const rightRect = {
      x: leftRect.x + leftRect.w + 4,
      y: content.y,
      w: content.w - leftRect.w - 4,
      h: content.h
    };

    UILayout.drawPanel(ctx, rightRect, {
      bg: UI_COLORS.panelBgAlt,
      border: UI_COLORS.borderInner,
      headerText: 'INSPECCIÓN DEL OBJETO'
    });

    const selected = this.getSelectedItem();
    const padX = rightRect.x + 6;
    const innerW = rightRect.w - 12;

    if (this.statusMessage) {
      ctx.font = `bold 5px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.emerald;
      const msgLines = UILayout.wrapText(ctx, this.statusMessage, innerW);
      msgLines.slice(0, 3).forEach((line, idx) => {
        ctx.fillText(line, padX, rightRect.y + 18 + idx * 8);
      });
    } else if (selected) {
      // Caja de icono 24×24
      const iconBoxX = padX;
      const iconBoxY = rightRect.y + 16;
      ctx.fillStyle = UI_COLORS.slotBg;
      ctx.fillRect(iconBoxX, iconBoxY, 24, 24);
      ctx.strokeStyle = UI_COLORS.goldDim;
      ctx.strokeRect(iconBoxX + 0.5, iconBoxY + 0.5, 23, 23);

      UILayout.drawItemIcon(ctx, this.itemsSheet, selected.iconIndex, iconBoxX + 4, iconBoxY + 4, 16);

      // Nombre del objeto
      const titleX = iconBoxX + 29;
      const titleMaxW = rightRect.w - 39;
      ctx.font = `bold 5px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.gold;
      ctx.fillText(UILayout.fitText(ctx, selected.name, titleMaxW), titleX, iconBoxY + 1);

      // Tipo y cantidad
      const category = this.getItemCategory(selected);
      ctx.font = `bold 4px ${UI_FONT}`;
      ctx.fillStyle = category.color;
      ctx.fillText(category.label, titleX, iconBoxY + 9);

      ctx.font = `4px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.textSecondary;
      ctx.fillText(`Cantidad: x${selected.qty}`, titleX, iconBoxY + 16);

      // Separador
      const sepY = iconBoxY + 28;
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
      ctx.beginPath();
      ctx.moveTo(padX, sepY);
      ctx.lineTo(padX + innerW, sepY);
      ctx.stroke();

      // Descripción con wrapText estricto (máximo 5 líneas dentro de la caja)
      ctx.font = `4.3px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.textPrimary;
      const descLines = UILayout.wrapText(ctx, selected.description || 'Sin descripción.', innerW);
      descLines.slice(0, 5).forEach((line, idx) => {
        ctx.fillText(line, padX, sepY + 5 + idx * 7);
      });

      // Acciones contextuales en la base del panel derecho
      const actY = rightRect.y + rightRect.h - 15;
      ctx.fillStyle = 'rgba(20, 29, 47, 0.92)';
      ctx.fillRect(padX, actY, innerW, 11);
      ctx.strokeStyle = UI_COLORS.borderInner;
      ctx.strokeRect(padX + 0.5, actY + 0.5, innerW - 1, 10);

      ctx.font = `bold 4px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.cyan;
      ctx.fillText('[E] Usar / Equipar', padX + 4, actY + 3.5);

      ctx.fillStyle = UI_COLORS.crimson;
      ctx.fillText('[X] Descartar', padX + innerW - 48, actY + 3.5);
    } else {
      ctx.font = `bold 4.5px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.textMuted;
      ctx.fillText('RANURA VACÍA', padX, rightRect.y + 20);

      ctx.font = `4.2px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.textSecondary;
      const emptyLines = UILayout.wrapText(
        ctx,
        'Selecciona una ranura con objetos para inspeccionar sus propiedades, consumir provisiones o equipar reliquias.',
        innerW
      );
      emptyLines.slice(0, 5).forEach((line, idx) => {
        ctx.fillText(line, padX, rightRect.y + 32 + idx * 7.5);
      });
    }

    ctx.restore();
  }

  _wrapText(ctx, text, maxWidth) {
    return UILayout.wrapText(ctx, text, maxWidth);
  }
}
