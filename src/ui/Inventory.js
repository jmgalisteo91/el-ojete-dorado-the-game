/**
 * Inventory.js - Sistema de Inventario y Mochila de Objetos Consumibles ('El Ojete Dorado')
 * 
 * Propósito exclusivo: Almacenar, inspeccionar, usar y descartar objetos y consumibles
 * (Pan, Café Compilado, Pociones, Truchas, Llaves, etc.).
 * No incluye habilidades permanentes ni métricas de robotización.
 */

export class Inventory {
  constructor(itemsSheet, viewportWidth = 320, viewportHeight = 180) {
    this.itemsSheet = itemsSheet;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    this.isOpen = false;
    this.maxSlots = 8;
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
   */
  addItem(itemData) {
    const existing = this.items.find((it) => it.id === itemData.id);
    if (existing) {
      existing.qty += itemData.qty || 1;
      return true;
    }
    if (this.items.length >= this.maxSlots) {
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
   * Descarta 1 unidad del objeto seleccionado.
   * Retorna una copia del objeto descartado para poder reaparecerlo en el suelo si se desea.
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
   * Navegación por la cuadrícula 4x2 del inventario.
   */
  moveSelection(dir) {
    const cols = 4;
    const rows = 2;
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
   * Renderiza la ventana modal de la Mochila de Consumibles y Objetos.
   * @param {CanvasRenderingContext2D} ctx Contexto de dibujo
   * @param {Player} player Instancia del jugador
   */
  render(ctx, player = null) {
    if (!this.isOpen) return;

    const winW = 246;
    const winH = 154;
    const winX = Math.round((this.viewportWidth - winW) / 2);
    const winY = Math.round((this.viewportHeight - winH) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Fondo oscurecido
    ctx.fillStyle = 'rgba(6, 8, 14, 0.76)';
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

    // Marco exterior retro
    ctx.fillStyle = '#0f1423';
    ctx.fillRect(winX, winY, winW, winH);
    ctx.fillStyle = '#e5c07b';
    ctx.fillRect(winX + 1, winY + 1, winW - 2, winH - 2);
    ctx.fillStyle = '#161e31';
    ctx.fillRect(winX + 2.5, winY + 2.5, winW - 5, winH - 5);

    // Cabecera
    ctx.font = 'bold 7.5px monospace';
    ctx.fillStyle = '#ffd885';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('🎒 MOCHILA DE CONSUMIBLES & OBJETOS', winX + 8, winY + 6);

    ctx.font = '6px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText('[I / Esc] Cerrar  ·  [C] Ficha', winX + winW - 8, winY + 7);

    // =========================================================================
    // Cuadrícula de 8 ranuras (4 columnas x 2 filas)
    // =========================================================================
    const cols = 4;
    const slotW = 53;
    const slotH = 28;
    const gapX = 6;
    const gapY = 5;
    const startX = winX + 8;
    const startY = winY + 20;

    for (let i = 0; i < this.maxSlots; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const sx = startX + col * (slotW + gapX);
      const sy = startY + row * (slotH + gapY);
      const isSelected = i === this.selectedIndex;
      const item = this.items[i];

      // Fondo de la ranura
      ctx.fillStyle = isSelected ? '#ffd885' : '#334155';
      ctx.fillRect(sx, sy, slotW, slotH);
      ctx.fillStyle = isSelected ? '#1e293b' : '#0f172a';
      ctx.fillRect(sx + 1, sy + 1, slotW - 2, slotH - 2);

      if (item) {
        const srcScale = this.itemsSheet.height >= 64 ? 4 : 1;
        ctx.drawImage(
          this.itemsSheet,
          item.iconIndex * 16 * srcScale,
          0,
          16 * srcScale,
          16 * srcScale,
          sx + 3,
          sy + 6,
          16,
          16
        );

        ctx.font = '6px monospace';
        ctx.fillStyle = '#f1f5f9';
        ctx.textAlign = 'left';
        const shortName = item.name.length > 6 ? `${item.name.slice(0, 5)}..` : item.name;
        ctx.fillText(shortName, sx + 21, sy + 6);

        ctx.fillStyle = '#ffd885';
        ctx.fillText(`x${item.qty}`, sx + 21, sy + 15);
      } else {
        ctx.font = '5.5px monospace';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.fillText(`[Slot ${i + 1}]`, sx + slotW / 2, sy + 11);
      }
    }

    // =========================================================================
    // Panel de detalles del objeto seleccionado
    // =========================================================================
    const detailX = winX + 8;
    const detailY = winY + 86;
    const detailW = winW - 16;
    const detailH = 50;

    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(detailX, detailY, detailW, detailH);
    ctx.strokeStyle = '#2b3652';
    ctx.lineWidth = 1;
    ctx.strokeRect(detailX + 0.5, detailY + 0.5, detailW - 1, detailH - 1);

    const selected = this.getSelectedItem();
    ctx.textAlign = 'left';

    if (this.statusMessage) {
      ctx.font = 'bold 6.5px monospace';
      ctx.fillStyle = '#86efac';
      ctx.fillText(this.statusMessage, detailX + 6, detailY + 6);
    } else if (selected) {
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = '#ffd885';
      ctx.fillText(`${selected.name}  (x${selected.qty})`, detailX + 6, detailY + 5.5);

      ctx.font = '6px monospace';
      ctx.fillStyle = '#cbd5e1';
      const lines = this._wrapText(ctx, selected.description, detailW - 12);
      lines.slice(0, 2).forEach((l, idx) => {
        ctx.fillText(l, detailX + 6, detailY + 15 + idx * 8);
      });

      // Botones de acción disponibles
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 6px monospace';
      ctx.fillText('▶ [E] Usar Objeto', detailX + 6, detailY + 36);

      ctx.fillStyle = '#f87171';
      ctx.fillText('✕ [X] Tirar al Suelo', detailX + 110, detailY + 36);
    } else {
      ctx.font = '6px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Ranura vacía.', detailX + 6, detailY + 8);
      ctx.fillText('Explora Valleverde y los cofres para conseguir comida y pociones.', detailX + 6, detailY + 18);
    }

    // =========================================================================
    // Barra de estado y atajos inferiores
    // =========================================================================
    ctx.font = '5.5px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(
      '[E] Usar  ·  [X] Tirar  ·  [WASD/Flechas] Navegar  ·  [C] Ficha Héroe',
      winX + winW / 2,
      winY + winH - 6
    );

    ctx.restore();
  }

  _wrapText(ctx, text, maxWidth) {
    if (!text) return [];
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }
}
