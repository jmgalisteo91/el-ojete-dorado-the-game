/**
 * ShopUI.js - Modal Canvas 2D de compra/venta por cantidad ('El Ojete Dorado').
 *
 * - Lista de artículos con precio unitario y stock.
 * - Selector de cantidad [ < ] N [ > ] con límites de monedas/stock.
 * - Flechas/A-D cambian la cantidad (mantener acelera), arriba/abajo cambia artículo.
 * - 1 = 1 unidad, 5 = 5 unidades, 0 = máximo permitido.
 * - Enter/Espacio/E confirma; Escape cancela.
 */

import { UILayout, UI_COLORS, UI_FONT } from './UILayout.js?v=8';

const VISIBLE_ROWS = 5;
const ROW_H = 9;
const HOLD_DELAY = 0.35;
const HOLD_REPEAT = 0.06;

export class ShopUI {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.title = 'Tienda';
    this.mode = 'buy';
    this.entries = [];
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.qty = 1;
    this.message = '';
    this.messageTimer = 0;
    this._holdDir = 0;
    this._holdTime = 0;
    this._repeatTimer = 0;
  }

  open({ title = 'Tienda', mode = 'buy', entries = [] } = {}) {
    this.isOpen = true;
    this.title = title;
    this.mode = mode === 'sell' ? 'sell' : 'buy';
    this.entries = Array.isArray(entries) ? entries.map((entry) => ({ ...entry })) : [];
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.qty = 1;
    this.message = '';
    this.messageTimer = 0;
    this._holdDir = 0;
    this._holdTime = 0;
    this._repeatTimer = 0;
    this._clampQty();
    if (this.game.dialogueBox && typeof this.game.dialogueBox.close === 'function') {
      this.game.dialogueBox.close();
    }
  }

  close() {
    this.isOpen = false;
    this.message = '';
    this._holdDir = 0;
  }

  _entry() {
    return this.entries[this.selectedIndex] || null;
  }

  /** Máximo permitido: lo que puedas pagar (compra) o lo que tengas (venta). */
  _maxQty() {
    const entry = this._entry();
    if (!entry) return 0;
    if (this.mode === 'buy') {
      const coins = this.game.player?.coins || 0;
      const price = Math.max(1, Number(entry.price) || 0);
      return Math.max(0, Math.floor(coins / price));
    }
    return Math.max(0, this.game.inventory?.getItemCount(entry.id) || 0);
  }

  _clampQty() {
    const max = this._maxQty();
    if (max <= 0) {
      this.qty = 0;
      return;
    }
    this.qty = Math.max(1, Math.min(Math.max(1, this.qty), max));
  }

  _setQty(value) {
    const max = this._maxQty();
    if (max <= 0) {
      this.qty = 0;
      return;
    }
    this.qty = Math.max(1, Math.min(max, Math.floor(Number(value) || 1)));
  }

  _changeQty(delta) {
    const max = this._maxQty();
    if (max <= 0) {
      this.qty = 0;
      return;
    }
    this.qty = Math.max(1, Math.min(max, this.qty + delta));
  }

  _moveSelection(delta) {
    if (this.entries.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.entries.length) % this.entries.length;
    this._holdDir = 0;
    this._holdTime = 0;
    this._repeatTimer = 0;
    this._clampQty();
    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollOffset + VISIBLE_ROWS) {
      this.scrollOffset = this.selectedIndex - VISIBLE_ROWS + 1;
    }
  }

  _handleHorizontal(dt) {
    const input = this.game.input;
    if (!input) return;
    const left = input.isKeyDown('ArrowLeft') || input.isKeyDown('KeyA');
    const right = input.isKeyDown('ArrowRight') || input.isKeyDown('KeyD');
    const dir = left === right ? 0 : (right ? 1 : -1);
    if (dir !== this._holdDir) {
      this._holdDir = dir;
      this._holdTime = 0;
      this._repeatTimer = 0;
      if (dir !== 0) this._changeQty(dir);
      return;
    }
    if (dir === 0) return;
    this._holdTime += dt;
    if (this._holdTime < HOLD_DELAY) return;
    this._repeatTimer += dt;
    if (this._repeatTimer >= HOLD_REPEAT) {
      this._repeatTimer = 0;
      this._changeQty(dir);
    }
  }

  update(dt) {
    if (!this.isOpen) return;
    const input = this.game.input;
    if (!input) return;

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = '';
    }

    if (input.consumeKey('Escape')) {
      this.close();
      return;
    }
    if (input.consumeKey('ArrowUp') || input.consumeKey('KeyW')) this._moveSelection(-1);
    if (input.consumeKey('ArrowDown') || input.consumeKey('KeyS')) this._moveSelection(1);
    this._handleHorizontal(dt);

    if (input.consumeKey('Digit1') || input.consumeKey('Numpad1')) this._setQty(1);
    if (input.consumeKey('Digit5') || input.consumeKey('Numpad5')) this._setQty(5);
    if (input.consumeKey('Digit0') || input.consumeKey('Numpad0')) this._setQty(this._maxQty());

    if (input.consumeInteraction({ includeSpace: true })) this._confirm();
  }

  _confirm() {
    if (this.entries.length === 0) {
      this._status('No hay artículos disponibles.');
      return;
    }
    if (this.mode === 'buy') this._buy();
    else this._sell();
  }

  _buy() {
    const entry = this._entry();
    if (!entry) return;
    this._clampQty();
    const max = this._maxQty();
    if (max <= 0) {
      this._status('No tienes suficientes Bytes para esta compra.');
      return;
    }
    const total = entry.price * this.qty;
    if (this.qty <= 0 || total > (this.game.player?.coins || 0)) {
      this._status('No tienes suficientes Bytes para esta compra.');
      return;
    }
    // Primero intenta añadir: si la mochila está llena, no se cobran monedas.
    const added = this.game.inventory.addItem({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      iconIndex: entry.iconIndex,
      qty: this.qty
    });
    if (!added) {
      this._status('La mochila está llena.');
      return;
    }
    this.game.player.coins -= total;
    this.game.music?.playFanfare?.();
    this.game._saveGameToStorage?.();
    this._status(`Compra: ${this.qty}x ${entry.name} (-${total} 🪙)`);
    this._clampQty();
  }

  _sell() {
    const entry = this._entry();
    if (!entry) return;
    const count = this.game.inventory.getItemCount(entry.id);
    if (count <= 0) {
      this._status('No tienes unidades de ese artículo.');
      return;
    }
    const qty = Math.max(0, Math.min(this.qty, count));
    if (qty <= 0) {
      this._status('Selecciona al menos 1 unidad.');
      return;
    }
    const total = entry.price * qty;
    this.game.inventory.consumeItem(entry.id, qty);
    this.game.player.coins += total;
    this.game.music?.playFanfare?.();
    this.game._saveGameToStorage?.();
    this._status(`Venta: ${qty}x ${entry.name} (+${total} 🪙)`);
    this._clampQty();
  }

  _status(message) {
    this.message = message;
    this.messageTimer = 2.2;
  }

  render(ctx) {
    if (!this.isOpen) return;
    const frame = UILayout.drawModalFrame(ctx, {
      title: this.title,
      icon: '🛒',
      badge: this.mode === 'buy' ? 'COMPRA' : 'VENTA',
      closeLabel: '[Esc] Cerrar'
    });
    const { content } = frame;
    const entry = this._entry();
    const coins = this.game.player?.coins || 0;
    const count = entry ? this.game.inventory.getItemCount(entry.id) : 0;
    const max = this._maxQty();
    const unit = entry ? entry.price : 0;
    const total = unit * this.qty;

    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = `5px ${UI_FONT}`;
    ctx.fillStyle = UI_COLORS.textDim;
    ctx.fillText(
      this.mode === 'buy'
        ? `Monedas: ${coins} 🪙`
        : `Tienes: ${count} · Monedas: ${coins} 🪙`,
      content.x + 2,
      content.y
    );
    ctx.textAlign = 'right';
    ctx.fillText(`Máx: ${max}`, content.x + content.w - 2, content.y);
    ctx.textAlign = 'left';

    const listY = content.y + 8;
    const listH = VISIBLE_ROWS * ROW_H;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(content.x, listY - 1, content.w, listH + 2);

    for (let i = 0; i < VISIBLE_ROWS; i++) {
      const idx = this.scrollOffset + i;
      const item = this.entries[idx];
      if (!item) continue;
      const y = listY + i * ROW_H;
      const selected = idx === this.selectedIndex;
      if (selected) {
        ctx.fillStyle = 'rgba(229, 192, 123, 0.16)';
        ctx.fillRect(content.x, y - 1, content.w, ROW_H);
        ctx.fillStyle = UI_COLORS.accentBright;
      } else {
        ctx.fillStyle = UI_COLORS.textSecondary;
      }
      ctx.font = `${selected ? 'bold ' : ''}5px ${UI_FONT}`;
      const prefix = selected ? '► ' : '  ';
      ctx.fillText(`${prefix}${item.icon || ''} ${item.name}`.slice(0, 32), content.x + 2, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = selected ? UI_COLORS.gold : UI_COLORS.textDim;
      if (this.mode === 'sell') {
        const owned = this.game.inventory.getItemCount(item.id);
        ctx.fillText(`${owned}x · ${item.price}🪙`, content.x + content.w - 2, y);
      } else {
        ctx.fillText(`${item.price} 🪙`, content.x + content.w - 2, y);
      }
      ctx.textAlign = 'left';
    }

    if (this.entries.length > VISIBLE_ROWS) {
      ctx.font = `4px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.textMuted;
      ctx.textAlign = 'right';
      if (this.scrollOffset > 0) ctx.fillText('▲', content.x + content.w - 2, listY - 6);
      if (this.scrollOffset + VISIBLE_ROWS < this.entries.length) {
        ctx.fillText('▼', content.x + content.w - 2, listY + listH + 2);
      }
      ctx.textAlign = 'left';
    }

    const qtyY = listY + listH + 8;
    ctx.textAlign = 'center';
    ctx.font = `bold 5.5px ${UI_FONT}`;
    ctx.fillStyle = this.qty > 0 ? UI_COLORS.gold : UI_COLORS.crimson;
    ctx.fillText(`[ < ]   Cantidad: ${this.qty}   [ > ]`, content.x + content.w / 2, qtyY);

    ctx.textAlign = 'left';
    ctx.font = `5px ${UI_FONT}`;
    ctx.fillStyle = UI_COLORS.textSecondary;
    ctx.fillText(`Unitario: ${unit} 🪙`, content.x + 2, qtyY + 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = UI_COLORS.gold;
    ctx.fillText(`Total: ${total} 🪙`, content.x + content.w - 2, qtyY + 10);
    ctx.textAlign = 'left';
    ctx.fillStyle = UI_COLORS.textDim;
    ctx.fillText(
      this.mode === 'buy' ? `Puedes permitirte: ${max}` : `Unidades en mochila: ${count}`,
      content.x + 2,
      qtyY + 18
    );

    ctx.font = `4.5px ${UI_FONT}`;
    ctx.fillStyle = this.message ? UI_COLORS.emerald : UI_COLORS.textMuted;
    const controls = this.message
      || '[←/→ o A/D] Cantidad · [1/5/0] 1/5/MÁX · [E/Enter] Confirmar · [Esc] Cancelar';
    ctx.textAlign = 'center';
    ctx.fillText(controls, content.x + content.w / 2, qtyY + 28);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}
