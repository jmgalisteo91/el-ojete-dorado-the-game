/**
 * QuestLogView.js - Interfaz Modal Canvas 2D del Diario de Misiones ('El Ojete Dorado')
 *
 * Rediseñado bajo UILayout (Safe Layout 290×150 px):
 * - Columna izquierda: Lista de misiones con máximo 4 simultáneas visibles y scroll discreto.
 * - Columna derecha: Detalles narrativos, objetivo actual y recompensas en Bytes con wrapText estricto.
 */

import { UILayout, UI_COLORS, UI_FONT } from './UILayout.js?v=8';

export class QuestLogView {
  constructor(questLog, viewportWidth = 320, viewportHeight = 180) {
    this.questLog = questLog;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    this.isOpen = false;
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.maxVisibleQuests = 4; // Máximo 4 simultáneas visibles según especificación

    // (FIX M3.4) Toque y arrastre en móvil
    this.isTouchDevice = false;
    this.rowH = 24;
    this._rowRects = [];
    this._listRect = null;
    this._touchWasDown = false;
    this._dragStartY = 0;
    this._dragStartScroll = 0;
    this._dragging = false;

    // (BLOQUE 4.C) Pestañas y animaciones.
    this.activeTab = 'main';
    this._tabRects = [];
    this._tabSlideStart = 0;
    this._popStart = null;
  }

  setTouchMode(isTouch) {
    this.isTouchDevice = Boolean(isTouch);
    this.rowH = this.isTouchDevice ? 26 : 24;
  }

  _maxScroll() {
    const list = this._getQuestList();
    return Math.max(0, list.length - this.maxVisibleQuests);
  }

  /** (FIX M3.4) Toque para seleccionar y arrastre vertical para hacer scroll. */
  handleTouchInput(input) {
    if (!this.isOpen || !this.isTouchDevice || !input) return false;
    const px = input.pointerX;
    const py = input.pointerY;
    const down = Boolean(input.isPointerDown);
    const list = this._listRect;

    if (input.pointerJustClicked && this.handleClick(px, py)) {
      return true;
    }

    if (down && !this._touchWasDown) {
      this._touchWasDown = true;
      if (list && px >= list.x && px <= list.x + list.w && py >= list.y && py <= list.y + list.h) {
        this._dragStartY = py;
        this._dragStartScroll = this.scrollOffset;
        this._dragging = true;
      }
    } else if (down && this._dragging) {
      const dy = py - this._dragStartY;
      if (Math.abs(dy) > 4) {
        const delta = Math.round(dy / this.rowH);
        this.scrollOffset = Math.max(0, Math.min(this._maxScroll(), this._dragStartScroll - delta));
      }
    } else if (!down && this._touchWasDown) {
      this._touchWasDown = false;
      if (this._dragging) {
        const moved = Math.abs(py - this._dragStartY) > 6;
        if (!moved) {
          for (const row of this._rowRects) {
            if (px >= row.x && px <= row.x + row.w && py >= row.y && py <= row.y + row.h) {
              this.selectedIndex = row.index;
              break;
            }
          }
        }
      }
      this._dragging = false;
    }
    return true;
  }

  open() {
    this.isOpen = true;
    this._popStart = null;
    this._tabSlideStart = performance.now();
    this._clampSelection();
  }

  switchTab(tab) {
    if (tab !== 'main' && tab !== 'side') return;
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this._tabSlideStart = performance.now();
  }

  /** Clic de ratón/táctil en las pestañas. */
  handleClick(px, py) {
    if (!this.isOpen) return false;
    for (const tab of this._tabRects) {
      if (px >= tab.x && px <= tab.x + tab.w && py >= tab.y && py <= tab.y + tab.h) {
        this.switchTab(tab.id);
        return true;
      }
    }
    return false;
  }

  close() {
    this.isOpen = false;
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this._clampSelection();
    }
  }

  _getQuestList() {
    if (!this.questLog) return [];
    const all = this.questLog.getAllQuests();
    // Ordenar primero misiones principales (MAIN) y luego encargos secundarios (SIDE)
    const main = all.filter((q) => q.category === 'MAIN');
    const side = all.filter((q) => q.category !== 'MAIN');
    return this.activeTab === 'side' ? side : main;
  }

  _clampSelection() {
    const list = this._getQuestList();
    if (list.length === 0) {
      this.selectedIndex = 0;
      this.scrollOffset = 0;
      return;
    }
    if (this.selectedIndex < 0) this.selectedIndex = 0;
    if (this.selectedIndex >= list.length) this.selectedIndex = list.length - 1;

    // Mantener selectedIndex dentro de la ventana de 4 elementos visibles
    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollOffset + this.maxVisibleQuests) {
      this.scrollOffset = this.selectedIndex - this.maxVisibleQuests + 1;
    }
  }

  moveSelection(dir) {
    const list = this._getQuestList();
    if (list.length === 0) return;

    if (dir === 'up') {
      this.selectedIndex = (this.selectedIndex - 1 + list.length) % list.length;
    } else if (dir === 'down') {
      this.selectedIndex = (this.selectedIndex + 1) % list.length;
    }
    this._clampSelection();
  }

  render(ctx) {
    if (!this.isOpen || !this.questLog) return;

    const now = performance.now();
    if (this._popStart == null) this._popStart = now;
    const quests = this._getQuestList();
    this._clampSelection();
    const completedCount = quests.filter((q) => q.status === 'COMPLETED').length;

    // Velo + pop 0.9 → 1.0 de la ventana glass.
    ctx.fillStyle = 'rgba(3, 5, 10, 0.6)';
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
    const scale = UILayout.popScale(this._popStart, now);
    ctx.save();
    ctx.translate(160, 90);
    ctx.scale(scale, scale);
    ctx.translate(-160, -90);

    const frame = UILayout.drawModalFrame(ctx, {
      title: 'DIARIO DE MISIONES',
      icon: '📜',
      badge: `${completedCount}/${quests.length} COMPLETADAS`,
      closeLabel: '[Esc] Cerrar',
      veil: false
    });

    const { content } = frame;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    // (BLOQUE 4.C) Pestañas Principal / Secundarias.
    const tabH = this.isTouchDevice ? 18 : 11;
    const tabGap = 3;
    const tabW = Math.floor((content.w - tabGap) / 2);
    this._tabRects = [];
    const tabs = [
      { id: 'main', label: 'PRINCIPAL' },
      { id: 'side', label: 'SECUNDARIAS' }
    ];
    tabs.forEach((tab, i) => {
      const tx = content.x + i * (tabW + tabGap);
      this._tabRects.push({ x: tx, y: content.y, w: tabW, h: tabH, id: tab.id });
      const active = this.activeTab === tab.id;
      if (active) {
        const g = ctx.createLinearGradient(tx, content.y, tx, content.y + tabH);
        g.addColorStop(0, 'rgba(253, 224, 71, 0.28)');
        g.addColorStop(1, 'rgba(253, 224, 71, 0.06)');
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = UI_COLORS.panelBg;
      }
      ctx.fillRect(tx, content.y, tabW, tabH);
      ctx.strokeStyle = active ? UI_COLORS.gold : UI_COLORS.borderInner;
      ctx.lineWidth = 1;
      ctx.strokeRect(tx + 0.5, content.y + 0.5, tabW - 1, tabH - 1);
      if (active) {
        ctx.fillStyle = UI_COLORS.gold;
        ctx.fillRect(tx + 2, content.y + tabH - 2, tabW - 4, 2);
      }
      ctx.font = `bold ${this.isTouchDevice ? '5.4' : '4.4'}px ${UI_FONT}`;
      ctx.fillStyle = active ? UI_COLORS.gold : UI_COLORS.textSecondary;
      const lw = ctx.measureText(tab.label).width;
      ctx.fillText(tab.label, tx + Math.floor((tabW - lw) / 2), content.y + (this.isTouchDevice ? 5.5 : 3.5));
    });

    // Transición de diapositiva al cambiar de pestaña.
    const slideT = Math.min(1, (now - this._tabSlideStart) / 180);
    const slideOff = (1 - slideT) * 8 * (this.activeTab === 'side' ? 1 : -1);
    ctx.translate(slideOff, 0);
    ctx.globalAlpha = 0.55 + 0.45 * slideT;

    const bodyY = content.y + tabH + 2;
    const bodyH = content.h - tabH - 2;

    // Columna izquierda: tarjetas de misión.
    const leftW = 114;
    const leftRect = { x: content.x, y: bodyY, w: leftW, h: bodyH };
    UILayout.drawPanel(ctx, leftRect, {
      bg: UI_COLORS.panelBg,
      border: UI_COLORS.borderInner,
      headerText: `${this.activeTab === 'main' ? 'HISTORIA' : 'ENCARGOS'} (${this.selectedIndex + 1}/${Math.max(1, quests.length)})`
    });

    const listStartX = leftRect.x + 4;
    const listStartY = leftRect.y + 15;
    const rowH = this.rowH;
    const rowW = leftRect.w - 12;
    this._listRect = { x: listStartX, y: listStartY, w: rowW, h: this.maxVisibleQuests * (rowH + 2) };
    this._rowRects = [];
    const visibleQuests = quests.slice(this.scrollOffset, this.scrollOffset + this.maxVisibleQuests);

    visibleQuests.forEach((q, idx) => {
      const fullIndex = this.scrollOffset + idx;
      const isSelected = fullIndex === this.selectedIndex;
      const isCompleted = q.status === 'COMPLETED';
      const ry = listStartY + idx * (rowH + 2);
      this._rowRects.push({ x: listStartX, y: ry, w: rowW, h: rowH, index: fullIndex });

      // Tarjeta con gradiente sutil.
      const g = ctx.createLinearGradient(listStartX, ry, listStartX + rowW, ry);
      if (isSelected) {
        g.addColorStop(0, 'rgba(253, 224, 71, 0.20)');
        g.addColorStop(1, 'rgba(253, 224, 71, 0.04)');
      } else {
        g.addColorStop(0, 'rgba(30, 41, 59, 0.75)');
        g.addColorStop(1, 'rgba(15, 23, 42, 0.75)');
      }
      ctx.fillStyle = g;
      ctx.fillRect(listStartX, ry, rowW, rowH);
      ctx.strokeStyle = isSelected ? UI_COLORS.gold : (isCompleted ? 'rgba(74, 222, 128, 0.4)' : UI_COLORS.slotBorder);
      ctx.lineWidth = 1;
      ctx.strokeRect(listStartX + 0.5, ry + 0.5, rowW - 1, rowH - 1);

      // Icono de estado: check verde / círculo amarillo.
      const iconX = listStartX + 6;
      const iconY = ry + rowH / 2;
      if (isCompleted) {
        ctx.strokeStyle = UI_COLORS.emerald;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(iconX - 2.5, iconY);
        ctx.lineTo(iconX - 0.5, iconY + 2);
        ctx.lineTo(iconX + 3, iconY - 2.5);
        ctx.stroke();
      } else {
        ctx.fillStyle = UI_COLORS.warn;
        ctx.beginPath();
        ctx.arc(iconX, iconY, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      ctx.font = `bold ${this.isTouchDevice ? '5.6' : '4.4'}px ${UI_FONT}`;
      ctx.fillStyle = isSelected ? UI_COLORS.textPrimary : (isCompleted ? UI_COLORS.textMuted : UI_COLORS.textSecondary);
      ctx.fillText(UILayout.fitText(ctx, q.title, rowW - 22), listStartX + 12, ry + 4);
      ctx.font = `3.9px ${UI_FONT}`;
      ctx.fillStyle = isSelected ? UI_COLORS.gold : UI_COLORS.textDim;
      ctx.fillText(q.category === 'MAIN' ? '★ Principal' : '◆ Secundaria', listStartX + 12, ry + 13);
    });

    UILayout.drawScrollbar(
      ctx,
      leftRect.x + leftRect.w - 5,
      listStartY,
      this.maxVisibleQuests * (rowH + 2) - 2,
      quests.length,
      this.maxVisibleQuests,
      this.scrollOffset
    );

    // Columna derecha: detalle con pasos y recompensa.
    const rightRect = {
      x: leftRect.x + leftRect.w + 4,
      y: bodyY,
      w: content.w - leftRect.w - 4,
      h: bodyH
    };
    const selectedQuest = quests[this.selectedIndex] || quests[0];

    UILayout.drawPanel(ctx, rightRect, {
      bg: UI_COLORS.panelBgAlt,
      border: UI_COLORS.borderInner,
      headerText: selectedQuest
        ? (selectedQuest.category === 'MAIN' ? '★ HISTORIA PRINCIPAL' : '◆ ENCARGO SECUNDARIO')
        : 'DETALLE DE MISIÓN'
    });

    if (selectedQuest) {
      const padX = rightRect.x + 6;
      const innerW = rightRect.w - 12;
      let ry = rightRect.y + 15;

      ctx.font = `bold 5px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.gold;
      ctx.fillText(UILayout.fitText(ctx, selectedQuest.title, innerW - 38), padX, ry);

      const isDone = selectedQuest.status === 'COMPLETED';
      ctx.font = `bold 4px ${UI_FONT}`;
      ctx.fillStyle = isDone ? UI_COLORS.emerald : UI_COLORS.cyan;
      const badgeStr = isDone ? '[COMPLETADA]' : '[EN CURSO]';
      const bw = ctx.measureText(badgeStr).width;
      ctx.fillText(badgeStr, padX + innerW - bw, ry + 0.5);
      ry += 9;

      ctx.font = `4.2px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.textSecondary;
      const descLines = UILayout.wrapText(ctx, selectedQuest.description || '', innerW);
      descLines.slice(0, 2).forEach((line, idx) => {
        ctx.fillText(line, padX, ry + idx * 6.5);
      });
      ry += Math.min(2, descLines.length) * 6.5 + 3;

      // Pasos con viñetas; los completados se tachan.
      ctx.font = `bold 4.2px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.gold;
      ctx.fillText('PASOS A SEGUIR:', padX, ry);
      ry += 6;
      const steps = Array.isArray(selectedQuest.steps) && selectedQuest.steps.length > 0
        ? selectedQuest.steps
        : [selectedQuest.currentStep || 'Continúa la aventura.'];
      const completedSteps = Number(selectedQuest.completedSteps || 0);
      ctx.font = `4.1px ${UI_FONT}`;
      steps.slice(0, 3).forEach((step, idx) => {
        const done = isDone || idx < completedSteps;
        const lines = UILayout.wrapText(ctx, step, innerW - 10);
        const stepLines = lines.slice(0, 2);
        stepLines.forEach((line, li) => {
          const shown = UILayout.fitText(ctx, line, innerW - 10);
          ctx.fillStyle = done ? UI_COLORS.emerald : UI_COLORS.textPrimary;
          if (li === 0) ctx.fillText('•', padX, ry);
          ctx.fillText(shown, padX + 6, ry);
          if (done) {
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(padX + 6, ry + 2.2);
            ctx.lineTo(padX + 6 + Math.min(innerW - 10, ctx.measureText(shown).width), ry + 2.2);
            ctx.stroke();
          }
          ry += 6.5;
        });
      });
      ry += 2;

      // Recompensa.
      const rewardY = Math.min(ry, rightRect.y + rightRect.h - 22);
      const g = ctx.createLinearGradient(padX, rewardY, padX, rewardY + 18);
      g.addColorStop(0, 'rgba(16, 26, 42, 0.95)');
      g.addColorStop(1, 'rgba(9, 16, 28, 0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(padX, rewardY, innerW, 18);
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.45)';
      ctx.strokeRect(padX + 0.5, rewardY + 0.5, innerW - 1, 17);

      ctx.font = `bold 4px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.emerald;
      ctx.fillText('🎁 RECOMPENSA:', padX + 4, rewardY + 2.5);
      ctx.font = `4.1px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.gold;
      ctx.fillText(
        UILayout.fitText(ctx, selectedQuest.reward || 'Recompensa en Bytes', innerW - 8),
        padX + 4,
        rewardY + 10
      );
    }

    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.restore();
  }

  _wrapText(ctx, text, maxWidth) {
    return UILayout.wrapText(ctx, text, maxWidth);
  }
}
