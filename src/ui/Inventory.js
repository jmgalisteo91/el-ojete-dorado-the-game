/**
 * Inventory.js - Sistema de Inventario y Mochila de Objetos Consumibles ('El Ojete Dorado')
 *
 * Rediseñado bajo UILayout (Safe Layout 290×150 px):
 * - Izquierda: Rejilla fija de 2 filas × 4 columnas con slots de 22×22 px y paginación estricta.
 * - Panel lateral derecho: Icono, nombre, tipo de objeto, cantidad y descripción con wrapText estricto.
 */

import { UILayout, UI_COLORS, UI_FONT } from './UILayout.js?v=8';
import { EXPANSION_EQUIPMENT, getExpansionEquipment } from '../expansion/ExpansionData.js?v=8';

const KEY_OR_QUEST_ITEM_IDS = new Set([
  'dawn_armor',
  'dawn_sword',
  'bridge_pass',
  'golden_apple',
  'item_abyssal_pointer',
  'lantern',
  'silicon_flower',
  'drone_scrap',
  'river_trout',
  'silicon_ore',
  'microwave_magnetron',
  'dungeon_core_gc',
  'dungeon_core_stack',
  'dungeon_core_microwave'
]);

const ITEM_ID_ALIASES = {
  magnetron: 'microwave_magnetron',
  nucleo_gc: 'dungeon_core_gc',
  nucleo_stack: 'dungeon_core_stack',
  nucleo_microwave: 'dungeon_core_microwave'
};

// Tipos cuyas instancias en el mundo llevan sufijos únicos (p. ej. silicon_ore_<timestamp>_<i>)
const STACKABLE_ITEM_TYPES = [
  'silicon_flower',
  'drone_scrap',
  'silicon_ore',
  'microwave_magnetron',
  'dungeon_core_gc',
  'dungeon_core_stack',
  'dungeon_core_microwave'
];

/** Convierte un ID de instancia (WorldItem, objeto soltado o alias antiguo) en su tipo canónico de inventario. */
export function normalizeItemId(id) {
  if (typeof id !== 'string') return id;
  const base = id.replace(/_dropped_\d+$/, '');
  const aliased = ITEM_ID_ALIASES[base] || base;
  return STACKABLE_ITEM_TYPES.find((type) => aliased === type || aliased.startsWith(`${type}_`)) || aliased;
}

const CONSUMABLE_ITEM_IDS = new Set([
  'bread',
  'coffee',
  'armor_potion',
  'golden_apple',
  'river_trout'
]);

export class Inventory {
  constructor(itemsSheet, viewportWidth = 320, viewportHeight = 180, game = null) {
    this.itemsSheet = itemsSheet;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.game = game;

    this.isOpen = false;
    this.maxSlots = 16;
    this.visibleSlots = 8; // 2 filas x 4 columnas por página
    this.slotSize = 22;    // 22x22 px exactos por slot
    this.items = [];
    this.selectedIndex = 0;
    this.statusMessage = '';

    // (FIX M3.2) Rejilla táctil 3x3, acciones grandes y drag & drop
    this.isTouchDevice = false;
    this.gridCols = 4;
    this.gridRows = 2;
    this._lastSlots = [];
    this._lastSelected = -1;
    this._detailBobStart = 0;
    this._lastPointer = { x: -1, y: -1, down: false };
    this._touchActions = [];
    this._pageButtons = [];
    this._pointerWasDown = false;
    this._drag = null;
  }

  /** (FIX M3.2) Configura la rejilla y el modo de interacción táctil. */
  setTouchMode(isTouch) {
    this.isTouchDevice = Boolean(isTouch);
    this.visibleSlots = this.isTouchDevice ? 9 : 8;
    this.slotSize = this.isTouchDevice ? 26 : 22;
    this.gridCols = this.isTouchDevice ? 3 : 4;
    this.gridRows = this.isTouchDevice ? 3 : 2;
    this._resetTouch();
    this._clampSelectedIndex();
  }

  _resetTouch() {
    this._pointerWasDown = false;
    this._drag = null;
    this._touchActions = [];
    this._pageButtons = [];
  }

  _changePage(direction) {
    const totalPages = Math.max(1, Math.ceil(Math.max(this.items.length, 1) / this.visibleSlots));
    const currentPage = Math.floor(this.selectedIndex / this.visibleSlots);
    const nextPage = Math.max(0, Math.min(totalPages - 1, currentPage + (direction === 'prev' ? -1 : 1)));
    this.selectedIndex = nextPage * this.visibleSlots;
    this._clampSelectedIndex();
    this.statusMessage = '';
  }

  _clampSelectedIndex() {
    if (this.selectedIndex >= this.items.length) {
      this.selectedIndex = Math.max(0, this.items.length - 1);
    }
    if (this.selectedIndex < 0) this.selectedIndex = 0;
  }

  _slotAt(px, py) {
    for (const slot of this._lastSlots) {
      if (px >= slot.x && px <= slot.x + slot.w && py >= slot.y && py <= slot.y + slot.h) {
        return slot;
      }
    }
    return null;
  }

  /** (FIX M3.2) Intercambia dos ranuras ocupadas. */
  _swapSlots(a, b) {
    if (a === b) return false;
    if (a < 0 || b < 0 || a >= this.items.length || b >= this.items.length) return false;
    const tmp = this.items[a];
    this.items[a] = this.items[b];
    this.items[b] = tmp;
    this.statusMessage = 'Ranuras reordenadas.';
    return true;
  }

  /**
   * (FIX M3.2) Input táctil del inventario. Devuelve 'use' | 'drop' | null.
   * Se llama cada frame mientras el panel está abierto. Gestiona:
   *  - toque en ranura → seleccionar
   *  - arrastrar de ranura a ranura → intercambiar
   *  - botones contextuales grandes → usar / tirar
   */
  handleTouchInput(input) {
    if (!this.isOpen || !input) return null;
    const px = input.pointerX;
    const py = input.pointerY;
    const down = Boolean(input.isPointerDown);
    this._lastPointer = { x: px, y: py, down };

    if (input.pointerJustClicked) {
      for (const action of this._touchActions) {
        if (px >= action.x && px <= action.x + action.w && py >= action.y && py <= action.y + action.h) {
          return action.id;
        }
      }
      for (const button of this._pageButtons) {
        if (px >= button.x && px <= button.x + button.w && py >= button.y && py <= button.y + button.h) {
          this._changePage(button.id);
          return null;
        }
      }
    }

    const slot = this._slotAt(px, py);

    if (down && !this._pointerWasDown) {
      this._pointerWasDown = true;
      if (slot) {
        this.selectedIndex = slot.index;
        this.statusMessage = '';
        if (this.items[slot.index]) {
          this._drag = { from: slot.index, startX: px, startY: py };
        }
      }
    } else if (!down && this._pointerWasDown) {
      this._pointerWasDown = false;
      if (this._drag) {
        const moved = Math.hypot(px - this._drag.startX, py - this._drag.startY) > 6;
        const target = this._slotAt(px, py);
        if (moved && target && target.index !== this._drag.from) {
          this._swapSlots(this._drag.from, target.index);
        }
        this._drag = null;
      }
    }

    return null;
  }

  open() {
    this.isOpen = true;
    this._popStart = null;
    this.statusMessage = '';
    this._resetTouch();
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.statusMessage = '';
  }

  close() {
    this.isOpen = false;
    this._popStart = null;
    this.statusMessage = '';
    this._resetTouch();
  }

  _isExpansionActive(player = null) {
    if (this.isExpansionActive !== undefined) return Boolean(this.isExpansionActive);
    if (this.game) return Boolean(this.game.isExpansionActive || this.game.isExpansionMode);
    if (player?.isExpansionActive !== undefined) return Boolean(player.isExpansionActive);
    if (player?.game) return Boolean(player.game.isExpansionActive || player.game.isExpansionMode);
    const wg = typeof window !== 'undefined' ? window.game : globalThis?.game;
    return Boolean(wg && (wg.isExpansionActive || wg.isExpansionMode));
  }

  _isExpansionEquipmentItem(itemOrId) {
    if (!itemOrId) return false;
    const rawId = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
    return Boolean(rawId && getExpansionEquipment(rawId));
  }

  getVisibleItems(player = null) {
    if (this._isExpansionActive(player)) return this.items;
    return this.items.filter((it) => !this._isExpansionEquipmentItem(it));
  }

  /**
   * Añade un objeto al inventario (acumulando cantidad si ya existe).
   * Los objetos clave de historia/misión nunca son bloqueados por límite de ranuras.
   */
  addItem(itemData, { ignoreSlotLimit = false } = {}) {
    if (!itemData || !itemData.id) return false;
    const id = normalizeItemId(itemData.id);
    if (!this._isExpansionActive() && this._isExpansionEquipmentItem(id)) {
      return false;
    }
    const existing = this.items.find((it) => it.id === id);
    if (existing) {
      existing.qty += itemData.qty || 1;
      return true;
    }
    const isEssential = KEY_OR_QUEST_ITEM_IDS.has(id);
    if (this.items.length >= this.maxSlots && !isEssential && !ignoreSlotLimit) {
      return false;
    }
    this.items.push({
      id,
      name: itemData.name,
      description: itemData.description,
      iconIndex: itemData.iconIndex,
      qty: itemData.qty || 1
    });
    return true;
  }

  /** Restaura el inventario guardado normalizando IDs antiguos y fusionando duplicados. */
  setItems(savedItems) {
    this.items = [];
    this.selectedIndex = 0;
    if (!Array.isArray(savedItems)) return;
    for (const it of savedItems) {
      if (!it || typeof it.id !== 'string' || it.id.startsWith('chest_')) continue;
      const qty = it.qty === undefined ? 1 : Math.floor(Number(it.qty));
      if (!Number.isFinite(qty) || qty <= 0) continue;
      this.addItem({ ...it, qty }, { ignoreSlotLimit: true });
    }
  }

  hasItem(itemId) {
    const id = normalizeItemId(itemId);
    return this.items.some((it) => it.id === id && it.qty > 0);
  }

  getItemCount(itemId) {
    const id = normalizeItemId(itemId);
    const it = this.items.find((item) => item.id === id);
    return it ? (it.qty || 1) : 0;
  }

  consumeItem(itemId, amount = 1) {
    const id = normalizeItemId(itemId);
    const idx = this.items.findIndex((it) => it.id === id);
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
   * Devuelve el primer consumible disponible en la mochila.
   */
  getFirstConsumable() {
    return this.items.find((it) => CONSUMABLE_ITEM_IDS.has(it.id) && it.qty > 0) || null;
  }

  isConsumable(item) {
    return Boolean(item && CONSUMABLE_ITEM_IDS.has(item.id));
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
   * Indica si el ítem corresponde al arma o escudo corporativo equipado actualmente.
   */
  isEquipped(item, player) {
    if (!item || !player || !this._isExpansionActive(player)) return false;
    const eq = getExpansionEquipment(item.id);
    if (!eq) return false;
    return (
      (eq.slot === 'weapon' && player.equippedWeapon === eq.id) ||
      (eq.slot === 'shield' && player.equippedShield === eq.id)
    );
  }

  /**
   * Equipa un objeto corporativo si pertenece a `EXPANSION_EQUIPMENT`. Devuelve el objeto equipado o null.
   */
  equipSelectedExpansionItem(player) {
    if (!this._isExpansionActive(player)) return null;
    const item = this.getSelectedItem(player);
    if (!item || !player) return null;
    const eq = typeof player.equipExpansionItem === 'function' ? player.equipExpansionItem(item.id) : null;
    if (!eq) return null;
    this.statusMessage =
      eq.slot === 'weapon'
        ? `¡${eq.name} equipado! (${eq.badgeLabel})`
        : `¡${eq.name} equipado en ranura de escudo!`;
    return eq;
  }

  /**
   * Clasifica el tipo semántico del objeto para el panel de detalles
   */
  getItemCategory(item) {
    if (!item || !item.id) return { label: 'VACÍO', color: UI_COLORS.textMuted };
    const corpEq = getExpansionEquipment(item.id);
    if (corpEq) {
      return {
        label: corpEq.slot === 'shield' ? 'ESCUDO CORP.' : 'ARMA CORP.',
        color: corpEq.bladeColor || corpEq.badgeColor || UI_COLORS.gold
      };
    }
    if (item.id === 'dawn_armor' || item.id === 'dawn_sword' || item.id === 'item_abyssal_pointer') {
      return { label: 'RELIQUIA SAGRADA', color: UI_COLORS.gold };
    }
    if (CONSUMABLE_ITEM_IDS.has(item.id)) {
      return { label: 'CONSUMIBLE [1-5]', color: UI_COLORS.emerald };
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
    const cols = this.gridCols;
    const totalPages = Math.max(1, Math.ceil(Math.max(this.items.length, this.selectedIndex + 1) / this.visibleSlots));
    const totalSlots = totalPages * this.visibleSlots;
    const rows = Math.max(this.gridRows, Math.ceil(totalSlots / cols));
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

  getSelectedItem(player = null) {
    const visible = this.getVisibleItems(player);
    return visible[this.selectedIndex] || null;
  }

  /**
   * Renderiza el modal unificado de 290×150 px de la Mochila.
   * Izquierda: Rejilla 2 filas × 4 columnas (slots de 22×22 px).
   * Derecha: Panel de detalle con icono, nombre, tipo y descripción con wrapText estricto.
   */
  render(ctx, player = null) {
    if (!this.isOpen) return;

    const expansionActive = this._isExpansionActive(player);
    const visibleItems = this.getVisibleItems(player);
    if (this.selectedIndex >= visibleItems.length) {
      this.selectedIndex = Math.max(0, visibleItems.length - 1);
    }

    // (BLOQUE 2.3) Pop de apertura del inventario.
    const now = performance.now();
    if (this._popStart == null) this._popStart = now;
    const popScale = UILayout.popScale(this._popStart, now, 0.9);
    ctx.save();
    ctx.translate(160, 90);
    ctx.scale(popScale, popScale);
    ctx.translate(-160, -90);

    if (this._lastSelected !== this.selectedIndex) {
      this._lastSelected = this.selectedIndex;
      this._detailBobStart = now;
    }
    const bobT = Math.min(1, (now - (this._detailBobStart || now)) / 260);
    const detailBob = Math.sin(bobT * Math.PI) * 2;

    const totalItems = visibleItems.length;
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

    // (FIX M3.2) Flechas de página táctiles (hasta 16 objetos en 3x3)
    this._pageButtons = [];
    if (this.isTouchDevice && totalPages > 1) {
      const bw = 11;
      const bh = 11;
      const by = leftRect.y + 2;
      const prev = { id: 'prev', x: leftRect.x + leftRect.w - 26, y: by, w: bw, h: bh };
      const next = { id: 'next', x: leftRect.x + leftRect.w - 13, y: by, w: bw, h: bh };
      for (const b of [prev, next]) {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = UI_COLORS.borderInner;
        ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        ctx.font = `bold 7px ${UI_FONT}`;
        ctx.fillStyle = UI_COLORS.gold;
        ctx.textAlign = 'center';
        ctx.fillText(b.id === 'prev' ? '‹' : '›', b.x + b.w / 2, b.y + 1.5);
      }
      ctx.textAlign = 'left';
      this._pageButtons = [prev, next];
    }

    // (FIX M3.2) 4x2 en desktop; 3x3 con celdas mayores en táctil
    const cols = this.gridCols;
    const rows = this.gridRows;
    const slotSize = this.slotSize;
    const gapX = 4;
    const gapY = this.isTouchDevice ? 3 : 5;
    this._lastSlots = [];
    const gridW = cols * slotSize + (cols - 1) * gapX; // 100 px
    const gridStartX = leftRect.x + Math.floor((leftRect.w - gridW) / 2);
    const gridStartY = leftRect.y + 16;

    const firstSlotIndex = currentPage * this.visibleSlots;
    const hotbarList = Array.isArray(player?.hotbar) ? player.hotbar : [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = r * cols + c;
        const slotIndex = firstSlotIndex + v;
        const sx = gridStartX + c * (slotSize + gapX);
        const sy = gridStartY + r * (slotSize + gapY);
        const isSelected = slotIndex === this.selectedIndex;
        const item = visibleItems[slotIndex];
        this._lastSlots.push({ x: sx, y: sy, w: slotSize, h: slotSize, index: slotIndex });

        // Fondo y bisel de ranura; la seleccionada recibe un gradiente dorado.
        if (isSelected) {
          const grad = ctx.createLinearGradient(sx, sy, sx + slotSize, sy + slotSize);
          grad.addColorStop(0, 'rgba(253, 224, 71, 0.30)');
          grad.addColorStop(1, 'rgba(253, 224, 71, 0.04)');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = UI_COLORS.slotBg;
        }
        ctx.fillRect(sx, sy, slotSize, slotSize);

        ctx.strokeStyle = isSelected ? UI_COLORS.slotSelectedBorder : UI_COLORS.slotBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, slotSize - 1, slotSize - 1);

        if (item) {
          // Dibujar sprite 16x16 centrado dentro de la ranura
          const iconPad = Math.floor((slotSize - 16) / 2);
          UILayout.drawItemIcon(ctx, this.itemsSheet, item.iconIndex, sx + iconPad, sy + iconPad, 16);

          // Etiqueta de cantidad en esquina inferior derecha
          const qtyStr = `x${item.qty}`;
          ctx.font = `bold 4px ${UI_FONT}`;
          const qw = ctx.measureText(qtyStr).width;
          ctx.fillStyle = 'rgba(10, 14, 23, 0.86)';
          ctx.fillRect(sx + slotSize - qw - 3, sy + slotSize - 7, qw + 2, 6);
          ctx.fillStyle = UI_COLORS.gold;
          ctx.fillText(qtyStr, sx + slotSize - qw - 2, sy + slotSize - 6);

          // Indicador discreto del número de Hotbar [1-5] asignado o badge [EQ] si está equipado
          const assignedSlot = hotbarList.indexOf(item.id);
          if (assignedSlot !== -1) {
            ctx.fillStyle = UI_COLORS.gold;
            ctx.fillRect(sx + 1, sy + 1, 6, 6);
            ctx.font = `bold 3.8px ${UI_FONT}`;
            ctx.fillStyle = '#06101e';
            ctx.fillText(String(assignedSlot + 1), sx + 2.5, sy + 2);
          } else if (this.isEquipped(item, player)) {
            ctx.fillStyle = '#22d3ee';
            ctx.fillRect(sx + 1, sy + 1, 8, 5);
            ctx.font = `bold 3.2px ${UI_FONT}`;
            ctx.fillStyle = '#06101e';
            ctx.fillText('EQ', sx + 2, sy + 1.5);
          }
        } else {
          // Ranura vacía
          ctx.font = `4px ${UI_FONT}`;
          ctx.fillStyle = 'rgba(100, 116, 139, 0.45)';
          const numStr = String(slotIndex + 1);
          const nw = ctx.measureText(numStr).width;
          ctx.fillText(numStr, sx + Math.floor((slotSize - nw) / 2), sy + Math.floor(slotSize / 2) - 2);
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

    const eqWep = expansionActive && player && player.equippedWeapon && player.equippedWeapon !== 'default'
      ? EXPANSION_EQUIPMENT[player.equippedWeapon]
      : null;
    const eqShd = expansionActive && player && player.equippedShield ? EXPANSION_EQUIPMENT[player.equippedShield] : null;
    ctx.font = `4px ${UI_FONT}`;
    ctx.fillStyle = eqWep ? '#38bdf8' : UI_COLORS.textSecondary;
    const assignedCount = hotbarList.filter(Boolean).length;
    const equipSummary = eqWep || eqShd
      ? `Eq: ${eqWep ? eqWep.badgeLabel : 'Espada'}${eqShd ? ` · ${eqShd.badgeLabel}` : ''}`
      : `Hotbar [1-5]: ${assignedCount}/5 asignados`;
    ctx.fillText(UILayout.fitText(ctx, equipSummary, leftRect.w - 12), leftRect.x + 6, summaryY + 14);

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

    const selected = visibleItems[this.selectedIndex] || null;
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

      UILayout.drawItemIcon(ctx, this.itemsSheet, selected.iconIndex, iconBoxX + 4, iconBoxY + 4 + detailBob, 16);

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

      // (BLOQUE 4.B) Botones de acción clicables para ratón y táctil + Asignación Hotbar (1-5).
      this._touchActions = [];
      const pointer = this._lastPointer || { x: -1, y: -1, down: false };
      const gap = 4;
      const btnW = (innerW - gap) / 2;
      const btnH = 17;
      const actY = rightRect.y + rightRect.h - btnH - 4;
      const useRect = { id: 'use', x: padX, y: actY, w: btnW, h: btnH };
      const dropRect = { id: 'drop', x: padX + btnW + gap, y: actY, w: btnW, h: btnH };

      if (this.isConsumable(selected)) {
        const hbY = actY - 19;
        const assignBtnW = Math.floor(innerW * 0.56);
        const assignRect = { id: 'assign_hotbar', x: padX, y: hbY, w: assignBtnW, h: 15 };
        const hoverAssign = pointer.x >= assignRect.x && pointer.x <= assignRect.x + assignRect.w &&
          pointer.y >= assignRect.y && pointer.y <= assignRect.y + assignRect.h;

        ctx.fillStyle = hoverAssign ? 'rgba(202, 138, 4, 0.35)' : 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(assignRect.x, assignRect.y, assignRect.w, assignRect.h);
        ctx.strokeStyle = hoverAssign ? '#fef08a' : UI_COLORS.goldDim;
        ctx.lineWidth = 1;
        ctx.strokeRect(assignRect.x + 0.5, assignRect.y + 0.5, assignRect.w - 1, assignRect.h - 1);
        ctx.font = `bold 3.6px ${UI_FONT}`;
        ctx.fillStyle = UI_COLORS.gold;
        ctx.textAlign = 'center';
        ctx.fillText('Asignar a Hotbar (1-5)', assignRect.x + assignRect.w / 2, assignRect.y + 5.5);
        this._touchActions.push(assignRect);

        const slotsX0 = assignRect.x + assignRect.w + 3;
        const slotBtnW = Math.max(9, Math.floor((innerW - assignBtnW - 11) / 5));
        for (let idx = 0; idx < 5; idx++) {
          const sx = slotsX0 + idx * (slotBtnW + 2);
          const sRect = { id: `hotbar_slot_${idx}`, x: sx, y: hbY, w: slotBtnW, h: 15 };
          const isAssignedHere = hotbarList[idx] === selected.id;
          const hoverS = pointer.x >= sRect.x && pointer.x <= sRect.x + sRect.w &&
            pointer.y >= sRect.y && pointer.y <= sRect.y + sRect.h;
          ctx.fillStyle = isAssignedHere ? 'rgba(234, 179, 8, 0.35)' : (hoverS ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.9)');
          ctx.fillRect(sRect.x, sRect.y, sRect.w, sRect.h);
          ctx.strokeStyle = isAssignedHere ? '#fde047' : UI_COLORS.borderInner;
          ctx.strokeRect(sRect.x + 0.5, sRect.y + 0.5, sRect.w - 1, sRect.h - 1);
          ctx.font = `bold 4.2px ${UI_FONT}`;
          ctx.fillStyle = isAssignedHere ? '#fef08a' : '#e2e8f0';
          ctx.fillText(String(idx + 1), sRect.x + sRect.w / 2, sRect.y + 5);
          this._touchActions.push(sRect);
        }
        ctx.textAlign = 'left';
      }

      const hoverUse = pointer.x >= useRect.x && pointer.x <= useRect.x + useRect.w &&
        pointer.y >= useRect.y && pointer.y <= useRect.y + useRect.h;
      const hoverDrop = pointer.x >= dropRect.x && pointer.x <= dropRect.x + dropRect.w &&
        pointer.y >= dropRect.y && pointer.y <= dropRect.y + dropRect.h;
      const useSink = hoverUse && pointer.down ? 1 : 0;
      const dropSink = hoverDrop && pointer.down ? 1 : 0;

      // (DIRECTRIZ UI) Drop shadow + hover brillante + hundido de 1 px.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(useRect.x + 2, useRect.y + 3, useRect.w, useRect.h);
      ctx.fillRect(dropRect.x + 2, dropRect.y + 3, dropRect.w, dropRect.h);

      ctx.fillStyle = hoverUse ? 'rgba(34, 104, 76, 0.98)' : 'rgba(20, 60, 45, 0.95)';
      ctx.fillRect(useRect.x, useRect.y + useSink, useRect.w, useRect.h);
      ctx.strokeStyle = hoverUse ? '#86efac' : UI_COLORS.emerald;
      ctx.lineWidth = hoverUse ? 2 : 1;
      ctx.strokeRect(useRect.x + 0.5, useRect.y + useSink + 0.5, useRect.w - 1, useRect.h - 1);
      ctx.font = `bold 6px ${UI_FONT}`;
      ctx.fillStyle = hoverUse ? '#dcfce7' : UI_COLORS.emerald;
      ctx.textAlign = 'center';
      ctx.fillText('USAR / EQUIPAR', useRect.x + useRect.w / 2, useRect.y + 5 + useSink);

      ctx.fillStyle = hoverDrop ? 'rgba(118, 32, 42, 0.98)' : 'rgba(70, 20, 26, 0.95)';
      ctx.fillRect(dropRect.x, dropRect.y + dropSink, dropRect.w, dropRect.h);
      ctx.strokeStyle = hoverDrop ? '#fca5a5' : UI_COLORS.crimson;
      ctx.lineWidth = hoverDrop ? 2 : 1;
      ctx.strokeRect(dropRect.x + 0.5, dropRect.y + dropSink + 0.5, dropRect.w - 1, dropRect.h - 1);
      ctx.fillStyle = hoverDrop ? '#fee2e2' : UI_COLORS.crimson;
      ctx.fillText('TIRAR', dropRect.x + dropRect.w / 2, dropRect.y + 5 + dropSink);

      ctx.textAlign = 'left';
      this._touchActions.push(useRect, dropRect);
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
    ctx.restore();
  }

  _wrapText(ctx, text, maxWidth) {
    return UILayout.wrapText(ctx, text, maxWidth);
  }
}
