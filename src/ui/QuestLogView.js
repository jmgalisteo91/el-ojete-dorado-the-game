/**
 * QuestLogView.js - Interfaz Modal Canvas 2D del Diario de Misiones ('El Ojete Dorado')
 *
 * Rediseñado bajo UILayout (Safe Layout 290×150 px):
 * - Columna izquierda: Lista de misiones con máximo 4 simultáneas visibles y scroll discreto.
 * - Columna derecha: Detalles narrativos, objetivo actual y recompensas en Bytes con wrapText estricto.
 */

import { UILayout, UI_COLORS, UI_FONT } from './UILayout.js?v=7';

export class QuestLogView {
  constructor(questLog, viewportWidth = 320, viewportHeight = 180) {
    this.questLog = questLog;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    this.isOpen = false;
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.maxVisibleQuests = 4; // Máximo 4 simultáneas visibles según especificación
  }

  open() {
    this.isOpen = true;
    this._clampSelection();
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
    return [...main, ...side];
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

    const quests = this._getQuestList();
    this._clampSelection();

    const completedCount = quests.filter((q) => q.status === 'COMPLETED').length;

    const frame = UILayout.drawModalFrame(ctx, {
      title: 'DIARIO DE MISIONES',
      icon: '📜',
      badge: `${completedCount}/${quests.length} COMPLETADAS`,
      closeLabel: '[Esc] Cerrar'
    });

    const { content } = frame;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    // =========================================================================
    // COLUMNA IZQUIERDA: Lista de Misiones (máximo 4 simultáneas visibles + scroll)
    // =========================================================================
    const leftW = 114;
    const leftRect = {
      x: content.x,
      y: content.y,
      w: leftW,
      h: content.h
    };

    UILayout.drawPanel(ctx, leftRect, {
      bg: UI_COLORS.panelBg,
      border: UI_COLORS.borderInner,
      headerText: `ENCARGOS (${this.selectedIndex + 1}/${Math.max(1, quests.length)})`
    });

    const listStartX = leftRect.x + 4;
    const listStartY = leftRect.y + 16;
    const rowH = 24;
    const rowW = leftRect.w - 12;

    const visibleQuests = quests.slice(this.scrollOffset, this.scrollOffset + this.maxVisibleQuests);

    visibleQuests.forEach((q, idx) => {
      const fullIndex = this.scrollOffset + idx;
      const isSelected = fullIndex === this.selectedIndex;
      const isCompleted = q.status === 'COMPLETED';
      const isMain = q.category === 'MAIN';
      const ry = listStartY + idx * (rowH + 2);

      // Caja de la fila
      ctx.fillStyle = isSelected ? UI_COLORS.slotSelectedBg : UI_COLORS.slotBg;
      ctx.fillRect(listStartX, ry, rowW, rowH);

      ctx.strokeStyle = isSelected
        ? UI_COLORS.slotSelectedBorder
        : (isCompleted ? 'rgba(74, 222, 128, 0.35)' : UI_COLORS.slotBorder);
      ctx.lineWidth = 1;
      ctx.strokeRect(listStartX + 0.5, ry + 0.5, rowW - 1, rowH - 1);

      // Etiqueta superior de categoría y estado
      ctx.font = `bold 3.8px ${UI_FONT}`;
      ctx.fillStyle = isMain ? UI_COLORS.cyan : UI_COLORS.gold;
      ctx.fillText(isMain ? '★ PRINCIPAL' : '◆ SECUNDARIA', listStartX + 3, ry + 2.5);

      ctx.fillStyle = isCompleted ? UI_COLORS.emerald : UI_COLORS.textSecondary;
      const stateIcon = isCompleted ? '✓ HECHA' : '▶ ACTIVA';
      const sw = ctx.measureText(stateIcon).width;
      ctx.fillText(stateIcon, listStartX + rowW - sw - 3, ry + 2.5);

      // Título de la misión ajustado al ancho
      ctx.font = `bold 4.4px ${UI_FONT}`;
      ctx.fillStyle = isSelected
        ? UI_COLORS.textPrimary
        : (isCompleted ? UI_COLORS.textMuted : UI_COLORS.textSecondary);
      ctx.fillText(
        UILayout.fitText(ctx, q.title, rowW - 6),
        listStartX + 3,
        ry + 11.5
      );
    });

    // Scrollbar vertical discreto para la lista de 4 visibles
    UILayout.drawScrollbar(
      ctx,
      leftRect.x + leftRect.w - 5,
      listStartY,
      this.maxVisibleQuests * (rowH + 2) - 2,
      quests.length,
      this.maxVisibleQuests,
      this.scrollOffset
    );

    // =========================================================================
    // COLUMNA DERECHA: Detalles, Objetivos y Recompensas en Bytes
    // =========================================================================
    const rightRect = {
      x: leftRect.x + leftRect.w + 4,
      y: content.y,
      w: content.w - leftRect.w - 4,
      h: content.h
    };

    const selectedQuest = quests[this.selectedIndex] || quests[0];

    UILayout.drawPanel(ctx, rightRect, {
      bg: UI_COLORS.panelBgAlt,
      border: UI_COLORS.borderInner,
      headerText: selectedQuest
        ? (selectedQuest.category === 'MAIN' ? '★ HISTORIA PRINCIPAL' : '◆ ENCARGO DE ALDEA')
        : 'DETALLE DE MISIÓN'
    });

    if (selectedQuest) {
      const padX = rightRect.x + 6;
      const innerW = rightRect.w - 12;
      let ry = rightRect.y + 15;

      // Título y badge de estado
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

      // Descripción narrativa con wrapText estricto (máximo 3 líneas)
      ctx.font = `4.2px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.textSecondary;
      const descLines = UILayout.wrapText(ctx, selectedQuest.description || '', innerW);
      descLines.slice(0, 3).forEach((line, idx) => {
        ctx.fillText(line, padX, ry + idx * 6.5);
      });
      ry += Math.min(3, descLines.length) * 6.5 + 4;

      // Caja de Objetivo Actual
      ctx.font = `bold 4.2px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.gold;
      ctx.fillText('⚡ OBJETIVO ACTUAL:', padX, ry);
      ry += 6;

      ctx.font = `4.2px ${UI_FONT}`;
      const stepLines = UILayout.wrapText(ctx, selectedQuest.currentStep || '', innerW - 8);
      const stepSlice = stepLines.slice(0, 3);
      const stepBoxH = Math.max(15, stepSlice.length * 6.5 + 5);

      ctx.fillStyle = 'rgba(10, 15, 28, 0.92)';
      ctx.fillRect(padX, ry, innerW, stepBoxH);
      ctx.strokeStyle = isDone ? UI_COLORS.emerald : UI_COLORS.goldDim;
      ctx.lineWidth = 1;
      ctx.strokeRect(padX + 0.5, ry + 0.5, innerW - 1, stepBoxH - 1);

      ctx.fillStyle = isDone ? UI_COLORS.emerald : UI_COLORS.textPrimary;
      stepSlice.forEach((line, idx) => {
        ctx.fillText(line, padX + 4, ry + 3 + idx * 6.5);
      });
      ry += stepBoxH + 5;

      // Caja de Recompensa en Bytes / Objetos
      const rewardY = Math.min(ry, rightRect.y + rightRect.h - 22);
      ctx.fillStyle = 'rgba(16, 26, 42, 0.9)';
      ctx.fillRect(padX, rewardY, innerW, 18);
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.45)';
      ctx.strokeRect(padX + 0.5, rewardY + 0.5, innerW - 1, 17);

      ctx.font = `bold 4px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.emerald;
      ctx.fillText('🎁 RECOMPENSA (BYTES & BOTÍN):', padX + 4, rewardY + 2.5);

      ctx.font = `4.1px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.gold;
      ctx.fillText(
        UILayout.fitText(ctx, selectedQuest.reward || 'Recompensa en Bytes', innerW - 8),
        padX + 4,
        rewardY + 10
      );
    }

    ctx.restore();
  }

  _wrapText(ctx, text, maxWidth) {
    return UILayout.wrapText(ctx, text, maxWidth);
  }
}
