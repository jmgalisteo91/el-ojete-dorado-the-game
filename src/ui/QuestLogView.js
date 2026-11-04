/**
 * QuestLogView.js - Interfaz Modal Canvas 2D del Diario de Misiones ('El Ojete Dorado')
 * 
 * Se abre y cierra con la tecla [L] o desde el Menú de Pausa.
 * Presenta navegación por tareas principales y secundarias en el panel izquierdo
 * y detalle narrativo, objetivo actual y recompensas en el panel derecho.
 */

export class QuestLogView {
  constructor(questLog, viewportWidth = 320, viewportHeight = 180) {
    this.questLog = questLog;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    this.isOpen = false;
    this.selectedIndex = 0;
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
    return this.questLog ? this.questLog.getAllQuests() : [];
  }

  _clampSelection() {
    const list = this._getQuestList();
    if (list.length === 0) {
      this.selectedIndex = 0;
      return;
    }
    if (this.selectedIndex < 0) this.selectedIndex = 0;
    if (this.selectedIndex >= list.length) this.selectedIndex = list.length - 1;
  }

  moveSelection(dir) {
    const list = this._getQuestList();
    if (list.length === 0) return;

    if (dir === 'up') {
      this.selectedIndex = (this.selectedIndex - 1 + list.length) % list.length;
    } else if (dir === 'down') {
      this.selectedIndex = (this.selectedIndex + 1) % list.length;
    }
  }

  render(ctx) {
    if (!this.isOpen || !this.questLog) return;

    const W = this.viewportWidth;
    const H = this.viewportHeight;
    const winW = 296;
    const winH = 168;
    const winX = Math.round((W - winW) / 2);
    const winY = Math.round((H - winH) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Fondo oscurecido con velo
    ctx.fillStyle = 'rgba(5, 8, 15, 0.88)';
    ctx.fillRect(0, 0, W, H);

    // Marco exterior de la ventana
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(winX, winY, winW, winH);
    ctx.fillStyle = '#e5c07b';
    ctx.fillRect(winX + 1, winY + 1, winW - 2, winH - 2);
    ctx.fillStyle = '#101728';
    ctx.fillRect(winX + 2.5, winY + 2.5, winW - 5, winH - 5);

    // Cantoneras doradas pixel art
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(winX + 3, winY + 3, 5, 2);
    ctx.fillRect(winX + 3, winY + 3, 2, 5);
    ctx.fillRect(winX + winW - 8, winY + 3, 5, 2);
    ctx.fillRect(winX + winW - 5, winY + 3, 2, 5);
    ctx.fillRect(winX + 3, winY + winH - 5, 5, 2);
    ctx.fillRect(winX + 3, winY + winH - 8, 2, 5);
    ctx.fillRect(winX + winW - 8, winY + winH - 5, 5, 2);
    ctx.fillRect(winX + winW - 5, winY + winH - 8, 2, 5);

    // Cabecera de la ventana
    ctx.font = 'bold 7px monospace';
    ctx.fillStyle = '#ffd885';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('📜 DIARIO DEL DESARROLLADOR · OBJETIVOS ACTIVOS', winX + 8, winY + 6);

    ctx.font = '6px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText('[Esc] Cerrar', winX + winW - 8, winY + 7);

    // Separador horizontal bajo la cabecera
    ctx.fillStyle = '#23304a';
    ctx.fillRect(winX + 6, winY + 17, winW - 12, 1);

    // ── Panel Izquierdo: Lista de Misiones ──
    const leftX = winX + 8;
    const leftY = winY + 21;
    const leftW = 126;
    const leftH = winH - 35;

    const quests = this._getQuestList();
    this._clampSelection();

    let curY = leftY;
    let listIdx = 0;

    const renderQuestGroup = (headerText, headerColor, categoryKey) => {
      ctx.font = 'bold 5.5px monospace';
      ctx.fillStyle = headerColor;
      ctx.textAlign = 'left';
      ctx.fillText(headerText, leftX, curY);
      curY += 9;

      const groupQuests = quests.filter((q) => q.category === categoryKey);
      for (const q of groupQuests) {
        const fullIndex = quests.indexOf(q);
        const isSelected = fullIndex === this.selectedIndex;
        const isCompleted = q.status === 'COMPLETED';

        const rowH = 10;
        if (isSelected) {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(leftX - 2, curY - 1, leftW + 2, rowH);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.strokeRect(leftX - 1.5, curY - 0.5, leftW + 1, rowH - 1);
        }

        // Icono de estado
        const icon = isSelected ? '▶' : isCompleted ? '✓' : '•';
        const iconColor = isSelected ? '#38bdf8' : isCompleted ? '#4ade80' : '#ffd885';

        ctx.font = 'bold 6px monospace';
        ctx.fillStyle = iconColor;
        ctx.fillText(icon, leftX, curY + 1);

        // Título de la misión (truncado a 19 caracteres)
        const titleStr = q.title.length > 19 ? q.title.slice(0, 18) + '…' : q.title;
        ctx.font = isSelected ? 'bold 5.5px monospace' : '5.5px monospace';
        ctx.fillStyle = isSelected
          ? '#ffffff'
          : isCompleted
            ? '#64748b'
            : '#cbd5e1';
        ctx.fillText(titleStr, leftX + 9, curY + 1);

        curY += rowH;
        listIdx++;
      }
      curY += 4;
    };

    renderQuestGroup('── MISIONES PRINCIPALES ──', '#38bdf8', 'MAIN');
    renderQuestGroup('── ENCARGOS SECUNDARIOS ──', '#ffd885', 'SIDE');

    // ── Divisor Central Vertical ──
    const divX = winX + 138;
    ctx.fillStyle = '#23304a';
    ctx.fillRect(divX, winY + 21, 1, winH - 39);

    // ── Panel Derecho: Detalle del Objetivo Seleccionado ──
    const rightX = divX + 7;
    const rightY = winY + 22;
    const rightW = winW - 146;

    const selectedQuest = quests[this.selectedIndex] || quests[0];

    if (selectedQuest) {
      let ry = rightY;

      // Badge de Categoría y Estado
      const isMain = selectedQuest.category === 'MAIN';
      const catLabel = isMain ? '★ MISIÓN PRINCIPAL' : '◆ ENCARGO SECUNDARIO';
      const catColor = isMain ? '#38bdf8' : '#eab308';

      ctx.font = 'bold 5.5px monospace';
      ctx.fillStyle = catColor;
      ctx.fillText(catLabel, rightX, ry);

      const statusText = selectedQuest.status === 'COMPLETED' ? '[✓ COMPLETADA]' : '[▶ ACTIVA]';
      const statusColor = selectedQuest.status === 'COMPLETED' ? '#4ade80' : '#38bdf8';
      ctx.font = 'bold 5.5px monospace';
      ctx.fillStyle = statusColor;
      ctx.textAlign = 'right';
      ctx.fillText(statusText, winX + winW - 9, ry);
      ctx.textAlign = 'left';
      ry += 10;

      // Título Destacado
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(selectedQuest.title, rightX, ry);
      ry += 11;

      // Línea divisoria suave
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(rightX, ry - 2, rightW - 2, 1);
      ry += 4;

      // Descripción narrativa (con salto de línea automático)
      ctx.font = '5px monospace';
      ctx.fillStyle = '#cbd5e1';
      ry = this._renderWrappedText(ctx, selectedQuest.description, rightX, ry, rightW - 4, 7.5);
      ry += 7;

      // Sección "OBJETIVO ACTUAL:"
      ctx.font = 'bold 5.5px monospace';
      ctx.fillStyle = '#fde047';
      ctx.fillText('⚡ OBJETIVO ACTUAL:', rightX, ry);
      ry += 8;

      // Caja de paso actual
      const stepLines = this._wrapText(ctx, selectedQuest.currentStep, rightW - 10);
      const boxH = Math.max(16, stepLines.length * 7 + 6);

      ctx.fillStyle = '#080d1a';
      ctx.fillRect(rightX, ry - 1, rightW - 4, boxH);
      ctx.strokeStyle = selectedQuest.status === 'COMPLETED' ? '#22c55e' : '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(rightX + 0.5, ry - 0.5, rightW - 5, boxH - 1);

      ctx.font = 'bold 5px monospace';
      ctx.fillStyle = selectedQuest.status === 'COMPLETED' ? '#86efac' : '#fff5d6';
      stepLines.forEach((line, lIdx) => {
        ctx.fillText(line, rightX + 4, ry + 3 + lIdx * 7);
      });
      ry += boxH + 7;

      // Sección "RECOMPENSA:"
      ctx.font = 'bold 5.5px monospace';
      ctx.fillStyle = '#34d399';
      ctx.fillText('🎁 RECOMPENSA:', rightX, ry);
      ry += 7;

      ctx.font = '5px monospace';
      ctx.fillStyle = '#a7f3d0';
      this._renderWrappedText(ctx, selectedQuest.reward, rightX, ry, rightW - 4, 7);
    }

    ctx.restore();
  }

  _wrapText(ctx, text, maxWidth) {
    if (!text) return [];
    const words = text.split(' ');
    const lines = [];
    let curLine = '';

    for (const w of words) {
      const test = curLine ? curLine + ' ' + w : w;
      if (ctx.measureText(test).width <= maxWidth) {
        curLine = test;
      } else {
        if (curLine) lines.push(curLine);
        curLine = w;
      }
    }
    if (curLine) lines.push(curLine);
    return lines;
  }

  _renderWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const lines = this._wrapText(ctx, text, maxWidth);
    lines.forEach((line, idx) => {
      ctx.fillText(line, x, y + idx * lineHeight);
    });
    return y + lines.length * lineHeight;
  }
}

