/**
 * Cuadro de diálogo flotante estilo RPG con soporte de:
 * - Efecto máquina de escribir (typewriter)
 * - Elección de respuestas del jugador (choices seleccionables con W/S o Flechas y E)
 * - Detector de "Charla Coñazo" (isRantMode): si el jugador pulsa 'E' rápido para intentar
 *   saltarse el monólogo de la vida del NPC, el NPC se da cuenta ("¿Te aburro? ¡Pues aún no
 *   he acabado!") y añade más páginas de chapa sobre su vida.
 */
export class DialogueBox {
  constructor(viewportWidth = 320, viewportHeight = 180, soundEngine = null) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.soundEngine = soundEngine;

    this.active = false;
    this.speakerName = '';
    this.currentNPC = null;
    this.lines = [];
    this.currentLineIndex = 0;

    this.choices = [];
    this.selectedChoiceIndex = 0;

    this.visibleChars = 0;
    this.lastBlipCharIndex = -1;
    this.lastMenuBounds = null;
    this.baseCharSpeed = 40;
    this.charSpeed = 40;
    this.blinkTimer = 0;

    // (FIX M3.1) En táctil el texto y las opciones se agrandan 1.5x
    this.isTouchDevice = false;

    // Estado de "Charla de la vida en plan coñazo"
    this.isRantMode = false;
    this.rantPenaltyPool = [];
    this.caughtSkippingCount = 0;
    this.caughtBannerTimer = 0;
    this.timeSinceLineCompleted = 0;
    this.lastMenuBounds = null;
  }

  setBaseCharSpeed(speed) {
    this.baseCharSpeed = speed;
    if (!this.isRantMode) {
      this.charSpeed = speed;
    }
  }

  _paginateLines(rawLines, maxCharsPerLine = null, maxLinesPerPage = 2) {
    if (!rawLines) return ['...'];
    const input = Array.isArray(rawLines) ? rawLines : [rawLines];
    const pages = [];
    // (FIX M3.1) Con fuente 12px caben menos caracteres por línea
    const charsPerLine = maxCharsPerLine || (this.isTouchDevice ? 28 : 46);

    for (const rawText of input) {
      if (!rawText || typeof rawText !== 'string') continue;
      const wrapped = this._wrapTextSimple(rawText, charsPerLine);
      if (wrapped.length <= maxLinesPerPage) {
        pages.push(wrapped.join('\n'));
      } else {
        // Paginación automática en diapositivas ([1/2], [2/2])
        for (let i = 0; i < wrapped.length; i += maxLinesPerPage) {
          pages.push(wrapped.slice(i, i + maxLinesPerPage).join('\n'));
        }
      }
    }

    return pages.length > 0 ? pages : ['...'];
  }

  _wrapTextSimple(text, maxChars) {
    if (!text) return [];
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const w of words) {
      if (w.includes('\n')) {
        const parts = w.split('\n');
        for (let p = 0; p < parts.length; p++) {
          const test = currentLine ? `${currentLine} ${parts[p]}` : parts[p];
          if (test.length <= maxChars) {
            currentLine = test;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = parts[p];
          }
          if (p < parts.length - 1) {
            if (currentLine) lines.push(currentLine);
            currentLine = '';
          }
        }
      } else {
        const test = currentLine ? `${currentLine} ${w}` : w;
        if (test.length <= maxChars) {
          currentLine = test;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = w;
        }
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  start(npc, customLines = null, customChoices = null) {
    this.active = true;
    this.currentNPC = npc;
    this.speakerName = npc ? npc.name : '';
    this.isRantMode = false;
    this.charSpeed = this.baseCharSpeed;
    this.rantPenaltyPool = [];
    this.caughtSkippingCount = 0;
    this.caughtBannerTimer = 0;
    this.timeSinceLineCompleted = 0;

    let rawLines = ['...'];
    if (customLines) {
      rawLines = Array.isArray(customLines) ? [...customLines] : [customLines];
      this.choices = customChoices || [];
    } else if (npc) {
      const dialogData = npc.resolveDialogues ? npc.resolveDialogues() : npc.dialogues;
      if (dialogData && typeof dialogData === 'object' && !Array.isArray(dialogData)) {
        rawLines = [...(dialogData.lines || ['...'])];
        this.choices = dialogData.choices || [];
      } else {
        rawLines =
          Array.isArray(dialogData) && dialogData.length > 0 ? [...dialogData] : ['...'];
        this.choices = npc.choices || [];
      }
    }

    this.lines = this._paginateLines(rawLines);
    this.currentLineIndex = 0;
    this.selectedChoiceIndex = 0;
    this.visibleChars = 0;
    this.lastBlipCharIndex = -1;
    this.lastMenuBounds = null;
    this.blinkTimer = 0;
  }

  showMessage(title, lines, choices = [], onClose = null) {
    if (typeof choices === 'function') {
      onClose = choices;
      choices = [];
    }
    this.onClose = typeof onClose === 'function' ? onClose : null;
    this.active = true;
    this.currentNPC = null;
    this.speakerName = title || '';
    const rawLines = Array.isArray(lines) ? [...lines] : [lines];
    this.lines = this._paginateLines(rawLines);
    this.choices = choices || [];
    this.isRantMode = false;
    this.rantPenaltyPool = [];
    this.caughtSkippingCount = 0;
    this.caughtBannerTimer = 0;
    this.timeSinceLineCompleted = 0;
    this.currentLineIndex = 0;
    this.selectedChoiceIndex = 0;
    this.visibleChars = 0;
    this.lastBlipCharIndex = -1;
    this.lastMenuBounds = null;
    this.blinkTimer = 0;
  }

  /**
   * Inicia una "Charla de la vida en plan coñazo" donde pulsar 'E' rápido hace que el NPC
   * te pille intentando saltarte el texto y siga hablando aún más de su vida.
   */
  startLifeRant(speakerName, initialLines, extraPenaltyPool = [], choicesAfter = []) {
    this.showMessage(speakerName, initialLines, choicesAfter);
    this.isRantMode = true;
    this.charSpeed = 30; // Un poco más pausado para tentar al jugador a pulsar rápido
    this.rantPenaltyPool = [...extraPenaltyPool];
  }

  isShowingChoices() {
    if (!this.active || !this.choices || this.choices.length === 0) return false;
    const isLastLine = this.currentLineIndex === this.lines.length - 1;
    const currentText = this.lines[this.currentLineIndex] || '';
    return isLastLine && Math.floor(this.visibleChars) >= currentText.length;
  }

  moveChoice(dir) {
    if (!this.isShowingChoices()) return;
    const count = this.choices.length;
    if (dir === 'up' || dir === 'left') {
      this.selectedChoiceIndex = (this.selectedChoiceIndex + count - 1) % count;
    } else if (dir === 'down' || dir === 'right') {
      this.selectedChoiceIndex = (this.selectedChoiceIndex + 1) % count;
    }
  }

  handlePointerClick(px, py) {
    if (!this.active) return false;

    // Si se muestran opciones, comprobar clic directo sobre alguna de ellas
    if (this.isShowingChoices() && this.lastMenuBounds) {
      const { menuX, menuY, menuW, menuH, itemHeight, paddingV } = this.lastMenuBounds;
      if (px >= menuX && px <= menuX + menuW && py >= menuY && py <= menuY + menuH) {
        const choiceIdx = Math.floor((py - (menuY + paddingV)) / itemHeight);
        if (choiceIdx >= 0 && choiceIdx < this.choices.length) {
          this.selectedChoiceIndex = choiceIdx;
          this.advance();
          return true;
        }
      }
    }

    // Clic en la caja o en pantalla avanza el diálogo
    this.advance();
    return true;
  }

  advance() {
    if (!this.active) return;

    const currentText = this.lines[this.currentLineIndex] || '';
    const isStillTyping = this.visibleChars < currentText.length;

    // ¡DETECTOR DE PULSAR RÁPIDO EN MODO CHARLA COÑAZO!
    if (
      this.isRantMode &&
      (isStillTyping || (this.timeSinceLineCompleted < 0.35 && this.currentLineIndex < this.lines.length - 1))
    ) {
      this._triggerCaughtSkippingRant();
      return;
    }

    if (isStillTyping) {
      this.visibleChars = currentText.length;
      return;
    }

    if (this.currentLineIndex + 1 < this.lines.length) {
      this.currentLineIndex += 1;
      this.visibleChars = 0;
      this.lastBlipCharIndex = -1;
      this.timeSinceLineCompleted = 0;
      return;
    }

    if (this.choices && this.choices.length > 0) {
      const chosen = this.choices[this.selectedChoiceIndex];
      this.charSpeed = 40;
      if (chosen && typeof chosen.onSelect === 'function') {
        chosen.onSelect();
      } else {
        this.close();
      }
      return;
    }

    this.close();
  }

  /**
   * El NPC pilla al jugador dándole rápido al botón 'E' para saltarse su charla.
   */
  _triggerCaughtSkippingRant() {
    this.caughtSkippingCount += 1;
    this.caughtBannerTimer = 2.6;
    if (this.soundEngine) {
      this.soundEngine.playCaughtSkipSound();
    }

    const callouts = [
      '¡¿Eh?! ¡Te he visto aporrear la tecla [E]! ¿Te aburro? ¡Pues aún no he acabado, ahora sigo hablando de mi vida!',
      '¡Oye, no le des tan rápido al botón! ¿Tienes prisa? ¡Pues te aguantas dos anécdotas más de mi juventud!',
      '¡Ajá! ¿Intentando saltarte el diálogo otra vez? ¡Qué poca educación RPG! Escucha, escucha que aún queda lo mejor...'
    ];

    const callout = callouts[(this.caughtSkippingCount - 1) % callouts.length];

    // Extraer una nueva anécdota coñazo del pool (o generar una extra)
    const extraAnecdote =
      this.rantPenaltyPool.length > 0
        ? this.rantPenaltyPool.shift()
        : 'Y otra cosa te digo: en el verano del 97 estuve tres horas hablando solo frente al pozo y nadie se quejó tanto como tú.';

    // Insertar el reproche en la página actual y añadir la anécdota extra justo detrás
    this.lines.splice(
      this.currentLineIndex,
      0,
      callout,
      extraAnecdote
    );

    this.visibleChars = 0;
    this.lastBlipCharIndex = -1;
    this.lastMenuBounds = null;
    this.timeSinceLineCompleted = 0;
  }

  close() {
    this.active = false;
    this.currentNPC = null;
    this.speakerName = '';
    this.lines = [];
    this.choices = [];
    this.isRantMode = false;
    this.charSpeed = 40;
    this.currentLineIndex = 0;
    this.selectedChoiceIndex = 0;
    this.visibleChars = 0;
    this.lastBlipCharIndex = -1;
    this.lastMenuBounds = null;

    const cb = this.onClose;
    this.onClose = null;
    if (typeof cb === 'function') {
      cb();
    }
  }

  update(dt) {
    if (!this.active) return;

    if (this.caughtBannerTimer > 0) {
      this.caughtBannerTimer = Math.max(0, this.caughtBannerTimer - dt);
    }

    const currentText = this.lines[this.currentLineIndex] || '';
    if (this.visibleChars < currentText.length) {
      this.visibleChars = Math.min(
        currentText.length,
        this.visibleChars + this.charSpeed * dt
      );
      const currentIdx = Math.floor(this.visibleChars) - 1;
      // Emitir zumbido de voz estilo Animal Crossing cada 2 caracteres impresos
      if (
        this.soundEngine &&
        currentIdx >= 0 &&
        currentIdx !== this.lastBlipCharIndex &&
        currentIdx % 2 === 0
      ) {
        this.lastBlipCharIndex = currentIdx;
        this.soundEngine.playVoiceBlip(this.speakerName, currentText[currentIdx]);
      }
      this.timeSinceLineCompleted = 0;
    } else {
      this.timeSinceLineCompleted += dt;
    }

    this.blinkTimer += dt * 5;
  }

  render(ctx) {
    if (!this.active) return;

    // (FIX M3.1) Caja más alta y tipografía 1.5x en táctil
    const isTouch = Boolean(this.isTouchDevice);
    const boxX = 12;
    const boxH = isTouch ? 54 : 48;
    const boxY = this.viewportHeight - boxH - 8;
    const boxW = this.viewportWidth - 24;
    const textFont = isTouch ? 'bold 12px monospace' : '8px monospace';
    const lineHeight = isTouch ? 16 : 11;
    const maxVisibleLines = isTouch ? 2 : 3;

    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(boxX + 2, boxY + 2, boxW, boxH);

    ctx.fillStyle = '#121624';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = this.caughtBannerTimer > 0 ? '#ff6b6b' : '#e5c07b';
    ctx.fillRect(boxX + 1, boxY + 1, boxW - 2, boxH - 2);

    ctx.fillStyle = '#1b2236';
    ctx.fillRect(boxX + 3, boxY + 3, boxW - 6, boxH - 6);

    if (this.speakerName) {
      ctx.font = isTouch ? 'bold 12px monospace' : 'bold 8px monospace';
      const nameW = Math.ceil(ctx.measureText(this.speakerName).width) + (isTouch ? 16 : 12);
      const nameH = isTouch ? 18 : 12;
      const nameX = boxX + 6;
      const nameY = boxY - nameH + 4;

      ctx.fillStyle = '#121624';
      ctx.fillRect(nameX, nameY, nameW, nameH);
      ctx.fillStyle = '#e5c07b';
      ctx.fillRect(nameX + 1, nameY + 1, nameW - 2, nameH - 2);
      ctx.fillStyle = '#252f4a';
      ctx.fillRect(nameX + 2, nameY + 2, nameW - 4, nameH - 4);

      ctx.fillStyle = '#ffd885';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(this.speakerName, nameX + 6, nameY + (isTouch ? 3 : 2));
    }

    // Si está en modo charla coñazo, mostrar aviso tentador o alerta de "¡PILLADO!"
    if (this.isRantMode && !this.isShowingChoices()) {
      ctx.font = isTouch ? 'bold 9px monospace' : 'bold 6px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      if (this.caughtBannerTimer > 0) {
        ctx.fillStyle = '#ff6b6b';
        ctx.fillText('¡PILLADO SALTANDO! +2 PÁGS DE CHAPA', boxX + boxW - 6, boxY - (isTouch ? 10 : 7));
      } else {
        ctx.fillStyle = '#7ae582';
        ctx.fillText(isTouch ? '[Toca rápido para saltar chapa]' : '[Pulsa E rápido para saltar chapa]', boxX + boxW - 6, boxY - (isTouch ? 10 : 7));
      }
    }

    const fullText = this.lines[this.currentLineIndex] || '';
    const shownText = fullText.slice(0, Math.floor(this.visibleChars));

    ctx.font = textFont;
    ctx.fillStyle = '#f0f4f8';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    const wrappedLines = this._wrapText(ctx, shownText, boxW - 20);
    const startTextY = boxY + (isTouch ? 8 : 9);

    wrappedLines.slice(0, maxVisibleLines).forEach((line, idx) => {
      ctx.fillText(line, boxX + 9, startTextY + idx * lineHeight);
    });

    const pageInfo = `${this.currentLineIndex + 1}/${this.lines.length}`;
    ctx.fillStyle = '#9aa5b8';
    ctx.font = isTouch ? '9.5px monospace' : '7px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(pageInfo, boxX + boxW - (isTouch ? 28 : 20), boxY + boxH - (isTouch ? 13 : 11));

    if (Math.floor(this.visibleChars) >= fullText.length) {
      const bounce = Math.sin(this.blinkTimer) > 0 ? 0 : 1;
      ctx.fillStyle = '#ffd885';
      // (FIX M3.1) Indicador de avance más grande en táctil
      ctx.font = isTouch ? 'bold 14px monospace' : '7px monospace';
      ctx.fillText('▶', boxX + boxW - (isTouch ? 13 : 8), boxY + boxH - (isTouch ? 17 : 11) + bounce);
    }

    if (this.isShowingChoices()) {
      this._renderChoicesMenu(ctx, boxX, boxY, boxW);
    }

    ctx.restore();
  }

  _renderChoicesMenu(ctx, boxX, boxY, boxW) {
    // (FIX M3.1) Opciones 1.5x y filas altas, fáciles de tocar
    const isTouch = Boolean(this.isTouchDevice);
    ctx.font = isTouch ? 'bold 10.5px monospace' : '7px monospace';
    const itemHeight = isTouch ? 19 : 12;
    const paddingV = isTouch ? 7 : 5;
    const menuH = this.choices.length * itemHeight + paddingV * 2;

    let maxLabelW = 110;
    for (const c of this.choices) {
      const w = Math.ceil(ctx.measureText(`▶ ${c.label}`).width) + (isTouch ? 24 : 16);
      if (w > maxLabelW) maxLabelW = w;
    }
    const menuW = Math.min(boxW, isTouch ? Math.max(200, maxLabelW) : maxLabelW);
    const menuX = boxX + boxW - menuW;
    const menuY = Math.max(isTouch ? 6 : 16, boxY - menuH - (isTouch ? 8 : 4));
    this.lastMenuBounds = { menuX, menuY, menuW, menuH, itemHeight, paddingV };

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(menuX + 2, menuY + 2, menuW, menuH);

    ctx.fillStyle = '#121624';
    ctx.fillRect(menuX, menuY, menuW, menuH);
    ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(menuX + 1, menuY + 1, menuW - 2, menuH - 2);
    ctx.fillStyle = '#192036';
    ctx.fillRect(menuX + 2, menuY + 2, menuW - 4, menuH - 4);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    this.choices.forEach((choice, idx) => {
      const cy = menuY + paddingV + idx * itemHeight;
      const isSelected = idx === this.selectedChoiceIndex;

      if (isSelected) {
        ctx.fillStyle = '#2d3b63';
        ctx.fillRect(menuX + 4, cy - 1, menuW - 8, itemHeight - 1);
        ctx.fillStyle = '#ffd885';
        ctx.fillText(`▶ ${choice.label}`, menuX + 7, cy + 1);
      } else {
        ctx.fillStyle = '#cfd8e3';
        ctx.fillText(`  ${choice.label}`, menuX + 7, cy + 1);
      }
    });
  }

  _wrapText(ctx, text, maxWidth) {
    if (!text) return [];
    const lines = [];
    const rawParagraphs = text.split('\n');

    for (const para of rawParagraphs) {
      const words = para.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = ctx ? ctx.measureText(testLine).width : testLine.length * 5;
        if (width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }
    return lines;
  }
}
