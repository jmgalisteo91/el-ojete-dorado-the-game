/**
 * RosaShop.js · Expansión "El Resurgir de Mister Alex IA" (v2.0).
 * Tienda de mejoras permanentes de Rosa en `rosa_bar` pagadas con Currículums (📄).
 */
import { UILayout, UI_COLORS, UI_FONT } from '../../ui/UILayout.js?v=8';

export const ROSA_UPGRADES = [
  {
    id: 'plus_salud',
    name: 'Plus de Salud',
    description: '+1 Corazón máximo permanente.',
    cost: 3,
    icon: '♥',
    apply(player) {
      player.maxHp = (player.maxHp || 3) + 1;
      if (typeof player.effectiveMaxHp === 'number') {
        player.hp = player.effectiveMaxHp;
      } else {
        player.hp = player.maxHp;
      }
    }
  },
  {
    id: 'aumento_sueldo',
    name: 'Aumento de Sueldo',
    description: '+10% Daño de espada permanente.',
    cost: 2,
    icon: '⚔',
    apply(player) {
      player.rosaDamageBonus = Math.round(((player.rosaDamageBonus || 0) + 0.1) * 100) / 100;
    }
  },
  {
    id: 'optimizacion',
    name: 'Optimización',
    description: '+20 de Stamina máxima permanente.',
    cost: 2,
    icon: '⚡',
    apply(player) {
      player.rosaStaminaBonus = (player.rosaStaminaBonus || 0) + 20;
      const eff = typeof player.effectiveMaxStamina === 'number'
        ? player.effectiveMaxStamina
        : (player.maxStamina || 100) + 20;
      player.maxStamina = eff;
      player.stamina = eff;
    }
  },
  {
    id: 'teletrabajo',
    name: 'Teletrabajo',
    description: '+1 Dash extra encadenable.',
    cost: 5,
    icon: '💨',
    apply(player) {
      player.hasDash = true;
      player.extraDashCharges = (player.extraDashCharges || 0) + 1;
      player.dashChargesRemaining = 1 + player.extraDashCharges;
    }
  }
];

export class RosaShop {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.upgrades = ROSA_UPGRADES;
    this.selectedIndex = 0;
    this.message = '';
    this.messageTimer = 0;
    this._rowBounds = [];
  }

  open() {
    this.isOpen = true;
    this.selectedIndex = 0;
    this.message = '';
    this.messageTimer = 0;
    if (this.game?.dialogueBox && typeof this.game.dialogueBox.close === 'function') {
      this.game.dialogueBox.close();
    }
  }

  close() {
    this.isOpen = false;
    this.message = '';
  }

  moveSelection(delta) {
    const len = this.upgrades.length;
    if (len === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + len) % len;
  }

  /**
   * Compra una mejora permanente por id o índice usando `game.curriculum`.
   */
  buyUpgrade(idOrIndex = this.selectedIndex) {
    const item = typeof idOrIndex === 'number'
      ? this.upgrades[idOrIndex]
      : this.upgrades.find((u) => u.id === idOrIndex || u.name === idOrIndex);

    if (!item || !this.game || !this.game.player) {
      return { ok: false, reason: 'invalid_upgrade' };
    }

    const available = Math.max(0, Math.floor(Number(this.game.curriculum) || 0));
    if (available < item.cost) {
      this.message = `Te faltan Currículums (necesitas ${item.cost} 📄).`;
      this.messageTimer = 2.2;
      if (this.game.music && typeof this.game.music.playError === 'function') {
        this.game.music.playError();
      }
      return { ok: false, reason: 'insufficient_curriculum' };
    }

    this.game.curriculum = available - item.cost;
    this.game.curriculumFlashTimer = 0.7;
    item.apply(this.game.player);

    if (typeof this.game._saveExpansionProgress === 'function') {
      this.game._saveExpansionProgress();
    }
    if (typeof this.game._saveGameToStorage === 'function') {
      this.game._saveGameToStorage();
    }
    if (this.game.music && typeof this.game.music.playFanfare === 'function') {
      this.game.music.playFanfare();
    }

    this.message = `✅ ${item.name} activado (-${item.cost} 📄)`;
    this.messageTimer = 2.4;
    return { ok: true, item, remainingCurriculum: this.game.curriculum };
  }

  update(dt) {
    if (!this.isOpen) return;
    if (this.messageTimer > 0) {
      this.messageTimer = Math.max(0, this.messageTimer - dt);
      if (this.messageTimer <= 0) this.message = '';
    }

    const input = this.game?.input;
    if (!input) return;

    if (input.consumeKey('Escape')) {
      this.close();
      return;
    }
    if (input.consumeKey('ArrowUp') || input.consumeKey('KeyW')) {
      this.moveSelection(-1);
    }
    if (input.consumeKey('ArrowDown') || input.consumeKey('KeyS')) {
      this.moveSelection(1);
    }

    const ptrClick = typeof input.consumePointerClick === 'function' ? input.consumePointerClick() : null;
    if (ptrClick && Array.isArray(this._rowBounds)) {
      const hitIdx = this._rowBounds.findIndex(
        (b) => ptrClick.x >= b.x && ptrClick.x <= b.x + b.w && ptrClick.y >= b.y && ptrClick.y <= b.y + b.h
      );
      if (hitIdx >= 0) {
        this.selectedIndex = hitIdx;
        this.buyUpgrade(hitIdx);
        return;
      }
    }

    if (input.consumeInteraction({ includeSpace: true })) {
      this.buyUpgrade(this.selectedIndex);
    }
  }

  render(ctx) {
    if (!this.isOpen) return;

    const frame = UILayout.drawModalFrame(ctx, {
      title: 'Bar Corporativo de Rosa · Mejoras',
      icon: '🛢',
      badge: `📄 ${Math.max(0, Math.floor(this.game?.curriculum || 0))}`,
      closeLabel: '[Esc] Salir'
    });
    const { content } = frame;
    const curriculum = Math.max(0, Math.floor(this.game?.curriculum || 0));
    const pointerX = this.game?.input?.pointerX ?? -1;
    const pointerY = this.game?.input?.pointerY ?? -1;

    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = `5px ${UI_FONT}`;
    ctx.fillStyle = '#e9d5ff';
    ctx.fillText(`Currículums disponibles: 📄 ${curriculum}`, content.x + 2, content.y);

    this._rowBounds = [];
    const listY = content.y + 12;
    const rowH = 18;

    this.upgrades.forEach((up, idx) => {
      const ry = listY + idx * rowH;
      const rx = content.x;
      const rw = content.w;
      this._rowBounds.push({ x: rx, y: ry, w: rw, h: rowH - 2 });

      const selected = idx === this.selectedIndex;
      const hover = pointerX >= rx && pointerX <= rx + rw && pointerY >= ry && pointerY <= ry + rowH - 2;
      const affordable = curriculum >= up.cost;

      ctx.fillStyle = selected
        ? 'rgba(168, 85, 247, 0.25)'
        : (hover ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.55)');
      ctx.fillRect(rx, ry, rw, rowH - 2);
      ctx.strokeStyle = selected ? '#c084fc' : 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rowH - 3);

      ctx.font = `bold 5.5px ${UI_FONT}`;
      ctx.fillStyle = selected ? '#fde047' : UI_COLORS.textPrimary;
      ctx.fillText(`${selected ? '► ' : '  '}${up.icon} ${up.name}`, rx + 3, ry + 2);

      ctx.textAlign = 'right';
      ctx.fillStyle = affordable ? '#4ade80' : '#f87171';
      ctx.fillText(`${up.cost} 📄`, rx + rw - 4, ry + 2);

      ctx.textAlign = 'left';
      ctx.font = `4.5px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.fillText(up.description, rx + 10, ry + 9);
    });

    const footerY = listY + this.upgrades.length * rowH + 6;
    ctx.textAlign = 'center';
    ctx.font = `4.8px ${UI_FONT}`;
    ctx.fillStyle = this.message
      ? (this.message.startsWith('✅') ? '#4ade80' : '#fca5a5')
      : UI_COLORS.textMuted;
    ctx.fillText(
      this.message || '[↑/↓] Elegir mejora · [E / Enter / Clic] Comprar · [Esc] Cerrar',
      content.x + content.w / 2,
      footerY
    );
    ctx.restore();
  }
}
