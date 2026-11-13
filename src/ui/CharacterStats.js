/**
 * CharacterStats.js - Ficha Técnica y Progresión Permanente del Héroe ('El Ojete Dorado')
 *
 * Rediseñado bajo UILayout (Safe Layout 290×150 px):
 * - Barras de progreso compactas para Salud, Blindaje Binario, Robotización y Atributos.
 * - Selector superior con [Tab] / [1] / [2] / [3] para conmutar entre Perfil, Logros y Habilidades.
 */

import { SKILL_DEFS } from '../core/SkillCatalog.js?v=8';
import { UILayout, UI_COLORS, UI_FONT } from './UILayout.js?v=8';

export class CharacterStats {
  constructor(viewportWidth = 320, viewportHeight = 180) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.isOpen = false;
    this.activeTab = 'stats'; // 'stats' | 'achievements' | 'skills'
    this.skillCursor = 0;
    this.skillMessage = '';

    // (FIX M3.4) Tabs y filas con zonas de toque más grandes
    this.isTouchDevice = false;
    this._skillRowRects = [];
    this._tabRects = [];
    this._popStart = null;
  }

  setTouchMode(isTouch) {
    this.isTouchDevice = Boolean(isTouch);
  }

  open() {
    this.isOpen = true;
    this._popStart = null;
  }

  close() {
    this.isOpen = false;
  }

  toggle() {
    this.isOpen = !this.isOpen;
  }

  switchTab(tab) {
    if (tab === 'stats' || tab === 'achievements' || tab === 'skills') {
      this.activeTab = tab;
    }
  }

  cycleTab() {
    const order = ['stats', 'skills', 'achievements'];
    this.activeTab = order[(order.indexOf(this.activeTab) + 1) % order.length];
  }

  /**
   * Determina el título profesional del desarrollador según su progreso de combate y reliquias.
   */
  getDevTitle(player) {
    if (!player) return 'Junior Dev';
    if (player.hasRelic && player.hasSword) {
      return 'Lead Architect del Gran Ojal';
    }
    if (player.hasBarrier) {
      return 'Staff Fullstack Wizard';
    }
    if (player.hasChargedAttack) {
      return 'Senior Refactorer';
    }
    if (player.hasDash) {
      return 'Mid-Level Bug Hunter';
    }
    if (player.hasArmor) {
      return 'Junior Dev Binario';
    }
    return 'Junior Dev (Sin Punteros)';
  }

  /**
   * Procesa pulsaciones de teclado y clics de ratón dentro de la ventana.
   */
  handleInput(input, player = null) {
    if (!this.isOpen || !input) return false;

    if (this.activeTab === 'skills') {
      if (input.consumeKey('KeyW') || input.consumeKey('ArrowUp')) {
        this.skillCursor = (this.skillCursor + SKILL_DEFS.length - 1) % SKILL_DEFS.length;
        return true;
      }
      if (input.consumeKey('KeyS') || input.consumeKey('ArrowDown')) {
        this.skillCursor = (this.skillCursor + 1) % SKILL_DEFS.length;
        return true;
      }
      if (input.consumeKey('Enter') || input.consumeKey('KeyE') || input.consumeKey('Space')) {
        const def = SKILL_DEFS[this.skillCursor];
        if (player && def) {
          if (player.skills[def.key]) {
            this.skillMessage = 'Ya dominas esta habilidad.';
          } else if (player.purchaseSkill(def.key)) {
            this.skillMessage = `¡${def.name} desbloqueada!`;
          } else {
            this.skillMessage = `Necesitas ${def.cost} punto(s) de habilidad.`;
          }
        }
        return true;
      }
    }

    if (
      input.consumeKey('Tab') ||
      input.consumeKey('KeyA') ||
      input.consumeKey('KeyD') ||
      input.consumeKey('ArrowLeft') ||
      input.consumeKey('ArrowRight')
    ) {
      this.cycleTab();
      return true;
    }
    if (input.consumeKey('Digit1') || input.consumeKey('Numpad1')) {
      this.switchTab('stats');
      return true;
    }
    if (input.consumeKey('Digit2') || input.consumeKey('Numpad2')) {
      this.switchTab('skills');
      return true;
    }
    if (input.consumeKey('Digit3') || input.consumeKey('Numpad3')) {
      this.switchTab('achievements');
      return true;
    }

    if (input.pointerJustClicked) {
      const modal = UILayout.modalRect();
      const tabH = this.isTouchDevice ? 18 : 11;
      const tabY = modal.y + 15 + 3;
      const px = input.pointerX;
      const py = input.pointerY;

      // (FIX M3.4) Zona de toque de pestañas más alta en táctil
      if (py >= tabY && py <= tabY + tabH + 2) {
        if (px >= modal.x + 5 && px <= modal.x + 98) {
          this.switchTab('stats');
          return true;
        } else if (px >= modal.x + 100 && px <= modal.x + 196) {
          this.switchTab('skills');
          return true;
        } else if (px >= modal.x + 198 && px <= modal.x + modal.w - 5) {
          this.switchTab('achievements');
          return true;
        }
      }

      // (FIX M3.4) Tocar una fila de habilidad: 1º selecciona, 2º compra
      if (this.activeTab === 'skills') {
        for (const row of this._skillRowRects) {
          if (px >= row.x && px <= row.x + row.w && py >= row.y && py <= row.y + row.h) {
            if (this.skillCursor === row.index) {
              const def = SKILL_DEFS[row.index];
              if (def && player) {
                if (player.skills[def.key]) {
                  this.skillMessage = 'Ya dominas esta habilidad.';
                } else if (player.purchaseSkill(def.key)) {
                  this.skillMessage = `¡${def.name} desbloqueada!`;
                } else {
                  this.skillMessage = `Necesitas ${def.cost} punto(s) de habilidad.`;
                }
              }
            } else {
              this.skillCursor = row.index;
            }
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Renderiza el contenedor unificado de 290×150 px de la Ficha del Desarrollador.
   */
  render(ctx, player = null, achievementManager = null) {
    if (!this.isOpen) return;

    const now = performance.now();
    if (this._popStart == null) this._popStart = now;
    const pop = UILayout.popScale(this._popStart, now);

    const unlockedCount = achievementManager ? achievementManager.getUnlockedCount() : 0;
    const totalCount = achievementManager ? achievementManager.getTotalCount() : 11;
    const skillPts = player ? (player.skillPoints || 0) : 0;

    ctx.fillStyle = 'rgba(3, 5, 10, 0.6)';
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
    ctx.save();
    ctx.translate(160, 90);
    ctx.scale(pop, pop);
    ctx.translate(-160, -90);

    const frame = UILayout.drawModalFrame(ctx, {
      title: 'FICHA DEL HÉROE',
      icon: '⚙️',
      badge: '[Tab] Cambiar Vista',
      closeLabel: '[Esc] Cerrar',
      veil: false
    });

    const { content } = frame;
    const t = performance.now() * 0.001;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    // =========================================================================
    // BARRA DE PESTAÑAS COMPACTA ([Tab] Perfil / Logros / Habilidades)
    // =========================================================================
    const tabBarY = content.y;
    // (FIX M3.4) Pestañas más altas en táctil (más fáciles de tocar)
    const tabH = this.isTouchDevice ? 18 : 11;
    const tabGap = 3;
    this._tabRects = [];
    const tabW = Math.floor((content.w - tabGap * 2) / 3);

    const tabs = [
      { id: 'stats', label: '[1] ATRIBUTOS' },
      { id: 'skills', label: `[2] HABILIDADES (${skillPts}pt)` },
      { id: 'achievements', label: `[3] LOGROS (${unlockedCount}/${totalCount})` }
    ];

    tabs.forEach((tab, idx) => {
      const tx = content.x + idx * (tabW + tabGap);
      this._tabRects.push({ x: tx, y: tabBarY, w: tabW, h: tabH, id: tab.id });
      const isActive = this.activeTab === tab.id;
      if (isActive) {
        const g = ctx.createLinearGradient(tx, tabBarY, tx, tabBarY + tabH);
        g.addColorStop(0, 'rgba(253, 224, 71, 0.28)');
        g.addColorStop(1, 'rgba(253, 224, 71, 0.06)');
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = UI_COLORS.panelBg;
      }
      ctx.fillRect(tx, tabBarY, tabW, tabH);
      ctx.strokeStyle = isActive ? UI_COLORS.gold : UI_COLORS.borderInner;
      ctx.lineWidth = 1;
      ctx.strokeRect(tx + 0.5, tabBarY + 0.5, tabW - 1, tabH - 1);
      if (isActive) {
        ctx.fillStyle = UI_COLORS.gold;
        ctx.fillRect(tx + 2, tabBarY + tabH - 2, tabW - 4, 2);
      }

      ctx.font = `bold ${this.isTouchDevice ? '5.4' : '4.1'}px ${UI_FONT}`;
      ctx.fillStyle = isActive ? UI_COLORS.gold : UI_COLORS.textSecondary;
      const lw = ctx.measureText(tab.label).width;
      ctx.fillText(
        tab.label,
        tx + Math.max(2, Math.floor((tabW - lw) / 2)),
        tabBarY + (this.isTouchDevice ? 5.5 : 3.5)
      );
    });

    const bodyRect = {
      x: content.x,
      y: content.y + tabH + 3,
      w: content.w,
      h: content.h - tabH - 3
    };

    if (this.activeTab === 'stats') {
      this._renderStatsTab(ctx, bodyRect, player, t);
    } else if (this.activeTab === 'skills') {
      this._renderSkillsTab(ctx, bodyRect, player);
    } else {
      this._renderAchievementsTab(ctx, bodyRect, achievementManager);
    }

    ctx.restore();
    ctx.restore();
  }

  /**
   * Renderiza la vista de Perfil con barras de progreso compactas para Robotización y atributos.
   */
  _renderStatsTab(ctx, rect, player, t) {
    const leftW = 136;
    const leftRect = {
      x: rect.x,
      y: rect.y,
      w: leftW,
      h: rect.h
    };

    UILayout.drawPanel(ctx, leftRect, {
      bg: UI_COLORS.panelBg,
      border: UI_COLORS.borderInner,
      headerText: 'MÉTRICAS DE SISTEMA'
    });

    // 1. Retrato pixel art del Dev + Identidad
    this._drawDevPortrait(ctx, leftRect.x + 5, leftRect.y + 15, player, t);

    ctx.font = `bold 5px ${UI_FONT}`;
    ctx.fillStyle = UI_COLORS.gold;
    ctx.fillText('DEV PROGRAMADOR', leftRect.x + 41, leftRect.y + 16);

    ctx.font = `4.2px ${UI_FONT}`;
    ctx.fillStyle = UI_COLORS.cyan;
    ctx.fillText(UILayout.fitText(ctx, this.getDevTitle(player), leftW - 45), leftRect.x + 41, leftRect.y + 24);

    const coinsVal = player ? (player.coins ?? 0) : 0;
    const playerLvl = player ? (player.level || 1) : 1;
    const playerXp = player ? (player.xp || 0) : 0;
    const nextXp = player && typeof player.getNextLevelXp === 'function' ? player.getNextLevelXp() : 50;
    ctx.font = `bold 4.2px ${UI_FONT}`;
    ctx.fillStyle = UI_COLORS.emerald;
    ctx.fillText(`◈ Saldo: ${coinsVal} Bytes`, leftRect.x + 41, leftRect.y + 32);

    ctx.fillStyle = UI_COLORS.gold;
    ctx.fillText(
      player && player.isMaxLevel
        ? '★ Nivel: 10/10 · MÁXIMO'
        : `★ Nivel: ${playerLvl}/10 (${playerXp}/${nextXp} XP)`,
      leftRect.x + 41,
      leftRect.y + 40
    );

    // 2. Barras de progreso compactas (Salud, Blindaje, Robotización, Experiencia, Ataque)
    const barX = leftRect.x + 5;
    const barW = leftRect.w - 10;
    let by = leftRect.y + 50;
    const barSpacing = 14;

    const hpCur = player ? Math.max(0, player.hp) : 6;
    const hpMax = player ? (player.maxHp || 6) : 6;
    UILayout.drawBar(ctx, {
      x: barX,
      y: by,
      w: barW,
      h: 5,
      value: hpCur,
      max: hpMax,
      color: UI_COLORS.crimson,
      gradient: ['#ef4444', '#f97316'],
      label: 'SALUD VITAL',
      valueText: `${hpCur.toFixed(1).replace('.0', '')}/${hpMax} ♥`
    });
    by += barSpacing;

    // (BLOQUE 4.D) Stamina con gradiente verde.
    const staminaCur = player ? Math.max(0, player.stamina ?? 100) : 100;
    const staminaMax = player ? (player.maxStamina || 100) : 100;
    UILayout.drawBar(ctx, {
      x: barX,
      y: by,
      w: barW,
      h: 5,
      value: staminaCur,
      max: staminaMax,
      color: UI_COLORS.emerald,
      gradient: ['#22c55e', '#84cc16'],
      label: 'STAMINA DE COMBATE',
      valueText: `${Math.round(staminaCur)}/${staminaMax}`
    });
    by += barSpacing;

    const hasArmor = Boolean(player && player.hasArmor);
    const armorPts = player ? (player.armorPoints ?? 0) : 0;
    const maxArmorPts = player ? (player.maxArmorPoints || 3) : 3;
    UILayout.drawBar(ctx, {
      x: barX,
      y: by,
      w: barW,
      h: 5,
      value: hasArmor ? armorPts : 0,
      max: maxArmorPts,
      color: UI_COLORS.cyan,
      gradient: ['#0ea5e9', '#67e8f9'],
      label: 'BLINDAJE BINARIO',
      valueText: hasArmor ? `${armorPts}/${maxArmorPts} 🛡️` : 'SIN CORAZA'
    });
    by += barSpacing;

    const robotVal = player ? Math.round(player.robotizationLevel || 0) : 0;
    const robotColor = robotVal > 80
      ? UI_COLORS.crimson
      : (robotVal > 50 ? UI_COLORS.gold : UI_COLORS.emerald);
    UILayout.drawBar(ctx, {
      x: barX,
      y: by,
      w: barW,
      h: 5,
      value: robotVal,
      max: 100,
      color: robotColor,
      gradient: robotVal > 50 ? ['#f59e0b', '#ef4444'] : ['#10b981', '#a3e635'],
      label: 'ROBOTIZACIÓN IA',
      valueText: `${robotVal}% 🤖`
    });
    by += barSpacing;

    const baseXp = player && typeof player.getCurrentLevelBaseXp === 'function' ? player.getCurrentLevelBaseXp() : 0;
    const xpRange = Math.max(1, nextXp - baseXp);
    const xpProgress = playerLvl >= 10 ? xpRange : Math.max(0, Math.min(xpRange, playerXp - baseXp));
    const xpPct = player && typeof player.getXpProgressPercent === 'function' ? player.getXpProgressPercent() : 0;
    if (player && player.isMaxLevel) {
      // (FIX 2) Sin barra de XP en nivel 10: solo el rótulo dorado
      ctx.font = `bold 5.5px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.gold;
      ctx.textAlign = 'center';
      ctx.fillText('★ NIVEL MÁXIMO · Nv. 10 ★', barX + barW / 2, by + 3);
      ctx.textAlign = 'left';
    } else {
      UILayout.drawBar(ctx, {
        x: barX,
        y: by,
        w: barW,
        h: 5,
        value: xpProgress,
        max: xpRange,
        color: UI_COLORS.gold,
        gradient: ['#f59e0b', '#fde047'],
        insideText: `Nv. ${playerLvl}`,
        label: 'EXP. PROGRAMADOR',
        valueText: `${xpPct}%`
      });
    }
    by += barSpacing;

    // =========================================================================
    // PANEL DERECHO: Habilidades de Combate y Reliquias
    // =========================================================================
    const rightRect = {
      x: leftRect.x + leftRect.w + 4,
      y: rect.y,
      w: rect.w - leftRect.w - 4,
      h: rect.h
    };

    UILayout.drawPanel(ctx, rightRect, {
      bg: UI_COLORS.panelBgAlt,
      border: UI_COLORS.borderInner,
      headerText: 'MÓDULOS DE COMBATE ACTIVOS'
    });

    const cardX = rightRect.x + 4;
    const cardW = rightRect.w - 8;
    const cardH = 30;

    this._drawSkillCard(
      ctx,
      cardX,
      rightRect.y + 15,
      cardW,
      cardH,
      '💨 Dash Asíncrono',
      '[Shift]',
      Boolean(player && player.hasDash),
      'Impulso con 0.2s de invulnerabilidad.',
      'Devorador de Memoria',
      UI_COLORS.emerald
    );

    this._drawSkillCard(
      ctx,
      cardX,
      rightRect.y + 48,
      cardW,
      cardH,
      '🌀 Corte en Cascada',
      '[Espacio 1s]',
      Boolean(player && player.hasChargedAttack),
      'Tajo circular 360° de daño triple.',
      'Coloso de la Pila Infinita',
      UI_COLORS.cyan
    );

    this._drawSkillCard(
      ctx,
      cardX,
      rightRect.y + 81,
      cardW,
      cardH,
      '🛡️ Escudo TypeScript',
      '[Q]',
      Boolean(player && player.hasBarrier),
      'Campo que absorbe proyectiles 3s.',
      'Ciber-Horno Termonuclear',
      UI_COLORS.gold
    );
  }

  /**
   * Árbol de habilidades adquiribles con puntos de combate
   */
  _renderSkillsTab(ctx, rect, player) {
    UILayout.drawPanel(ctx, rect, {
      bg: UI_COLORS.panelBg,
      border: UI_COLORS.borderInner,
      headerText: `HABILIDADES · PUNTOS: ${player ? (player.skillPoints || 0) : 0}`
    });

    const pad = 6;
    const gap = 4;
    const cardW = Math.floor((rect.w - pad * 2 - gap) / 2);
    const cardH = 30;
    const startX = rect.x + pad;
    const startY = rect.y + 15;
    this._skillRowRects = [];
    const icons = { vigor: '❤', filo: '⚔', reflejo: '✦', log: '📜' };

    SKILL_DEFS.forEach((def, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      const owned = Boolean(player && player.skills && player.skills[def.key]);
      const selected = i === this.skillCursor;
      this._skillRowRects.push({ x, y, w: cardW, h: cardH, index: i });

      // Tarjeta: brillante si está desbloqueada, oscura si está bloqueada.
      const g = ctx.createLinearGradient(x, y, x + cardW, y + cardH);
      if (owned) {
        g.addColorStop(0, 'rgba(16, 45, 38, 0.95)');
        g.addColorStop(1, 'rgba(20, 83, 45, 0.55)');
      } else {
        g.addColorStop(0, 'rgba(11, 16, 28, 0.96)');
        g.addColorStop(1, 'rgba(6, 10, 18, 0.96)');
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = selected ? UI_COLORS.gold : (owned ? 'rgba(74, 222, 128, 0.7)' : UI_COLORS.slotBorder);
      ctx.lineWidth = selected ? 1.4 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cardW - 1, cardH - 1);
      if (selected) {
        ctx.fillStyle = UI_COLORS.gold;
        ctx.fillRect(x + 2, y + 1, cardW - 4, 1);
      }

      // Icono circular.
      const ix = x + 10;
      const iy = y + 11;
      ctx.fillStyle = owned ? 'rgba(74, 222, 128, 0.18)' : 'rgba(100, 116, 139, 0.14)';
      ctx.beginPath();
      ctx.arc(ix, iy, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = owned ? UI_COLORS.emerald : UI_COLORS.slotBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = '6px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = owned ? UI_COLORS.gold : UI_COLORS.textDim;
      ctx.fillText(icons[def.key] || '◆', ix, iy + 0.5);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 4.7px monospace';
      ctx.fillStyle = owned ? UI_COLORS.textPrimary : UI_COLORS.textMuted;
      ctx.fillText(def.name, x + 19, y + 4);

      ctx.font = '3.9px monospace';
      ctx.fillStyle = owned ? UI_COLORS.emerald : UI_COLORS.textDim;
      if (owned) {
        ctx.fillText('✓ ACTIVA', x + 19, y + 11);
      } else {
        ctx.fillText(`🔒 Coste: ${def.cost} Puntos`, x + 19, y + 11);
      }
      ctx.fillStyle = UI_COLORS.textMuted;
      ctx.fillText(UILayout.fitText(ctx, def.desc, cardW - 24), x + 4, y + 20);
    });

    // Detalle completo de la habilidad seleccionada.
    const def = SKILL_DEFS[this.skillCursor] || SKILL_DEFS[0];
    if (def) {
      const owned = Boolean(player && player.skills && player.skills[def.key]);
      const detailY = Math.min(startY + 2 * (cardH + gap) + 1, rect.y + rect.h - 32);
      const detailH = Math.max(24, rect.y + rect.h - detailY - 2);
      const g = ctx.createLinearGradient(rect.x + pad, detailY, rect.x + pad, detailY + detailH);
      g.addColorStop(0, 'rgba(20, 30, 48, 0.95)');
      g.addColorStop(1, 'rgba(9, 15, 26, 0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(rect.x + pad, detailY, rect.w - pad * 2, detailH);
      ctx.strokeStyle = owned ? 'rgba(74, 222, 128, 0.45)' : 'rgba(229, 192, 123, 0.4)';
      ctx.strokeRect(rect.x + pad + 0.5, detailY + 0.5, rect.w - pad * 2 - 1, detailH - 1);

      ctx.font = 'bold 4.3px monospace';
      ctx.fillStyle = owned ? UI_COLORS.emerald : UI_COLORS.gold;
      ctx.fillText(`${def.name} · ${owned ? 'DESBLOQUEADA' : `BLOQUEADA (${def.cost} pt)`}`, rect.x + pad + 4, detailY + 3);
      ctx.font = '4px monospace';
      ctx.fillStyle = UI_COLORS.textSecondary;
      const lines = UILayout.wrapText(ctx, def.desc, rect.w - pad * 2 - 8);
      lines.slice(0, 3).forEach((line, idx) => {
        ctx.fillText(line, rect.x + pad + 4, detailY + 10 + idx * 6);
      });
      if (this.skillMessage) {
        ctx.font = 'bold 4px monospace';
        ctx.fillStyle = UI_COLORS.gold;
        ctx.fillText(UILayout.fitText(ctx, this.skillMessage, rect.w - pad * 2 - 8), rect.x + pad + 4, detailY + detailH - 7);
      }
    }
  }

  /**
   * Pestaña de Trofeos y Logros
   */
  _renderAchievementsTab(ctx, rect, achievementManager) {
    const list = achievementManager ? achievementManager.getAll() : [];
    const unlockedCount = achievementManager ? achievementManager.getUnlockedCount() : 0;
    const totalCount = achievementManager ? achievementManager.getTotalCount() : Math.max(1, list.length);

    UILayout.drawPanel(ctx, rect, {
      bg: UI_COLORS.panelBg,
      border: UI_COLORS.borderInner
    });

    UILayout.drawBar(ctx, {
      x: rect.x + 6,
      y: rect.y + 4,
      w: rect.w - 12,
      h: 4,
      value: unlockedCount,
      max: Math.max(1, totalCount),
      color: UI_COLORS.gold,
      gradient: ['#f59e0b', '#fde047'],
      label: 'PROGRESO DE TROFEOS',
      valueText: `${unlockedCount}/${totalCount}`
    });

    // (BLOQUE 4.D) Cuadrícula de medallas 4×3.
    const cols = 4;
    const rows = 3;
    const gapX = 4;
    const gapY = 3;
    const cellW = Math.floor((rect.w - 12 - gapX * (cols - 1)) / cols);
    const cellH = Math.floor((rect.h - 16 - gapY * (rows - 1)) / rows);
    const startX = rect.x + 6;
    const startY = rect.y + 15;

    list.slice(0, cols * rows).forEach((ach, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (cellW + gapX);
      const y = startY + row * (cellH + gapY);
      const isUnlocked = Boolean(ach.unlocked);

      // Celda glass.
      const g = ctx.createLinearGradient(x, y, x, y + cellH);
      if (isUnlocked) {
        g.addColorStop(0, 'rgba(45, 36, 12, 0.95)');
        g.addColorStop(1, 'rgba(20, 30, 48, 0.95)');
      } else {
        g.addColorStop(0, 'rgba(8, 12, 20, 0.95)');
        g.addColorStop(1, 'rgba(5, 8, 14, 0.95)');
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeStyle = isUnlocked ? 'rgba(253, 224, 71, 0.6)' : 'rgba(51, 65, 85, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

      // Medalla circular con glow si está desbloqueada.
      const mx = x + cellW / 2;
      const my = y + cellH * 0.38;
      if (isUnlocked) {
        const glow = ctx.createRadialGradient(mx, my, 1, mx, my, 10);
        glow.addColorStop(0, 'rgba(253, 224, 71, 0.45)');
        glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(mx - 10, my - 10, 20, 20);
      }
      ctx.fillStyle = isUnlocked ? 'rgba(253, 224, 71, 0.2)' : 'rgba(15, 23, 42, 0.95)';
      ctx.beginPath();
      ctx.arc(mx, my, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isUnlocked ? UI_COLORS.gold : UI_COLORS.slotBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = '6.5px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isUnlocked ? UI_COLORS.gold : UI_COLORS.textMuted;
      ctx.fillText(isUnlocked ? '🏅' : '🔒', mx, my + 0.5);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 3.5px monospace';
      ctx.fillStyle = isUnlocked ? UI_COLORS.gold : UI_COLORS.textDim;
      const title = ach.title || 'Logro';
      ctx.fillText(UILayout.fitText(ctx, title, cellW - 4), mx, my + 9);
    });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }

  _drawSkillCard(ctx, x, y, w, h, name, keyPrompt, unlocked, description, source, themeColor) {
    ctx.fillStyle = unlocked ? 'rgba(20, 30, 48, 0.94)' : UI_COLORS.slotBg;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = unlocked ? themeColor : UI_COLORS.slotBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    ctx.font = `bold 4.5px ${UI_FONT}`;
    ctx.fillStyle = unlocked ? UI_COLORS.gold : UI_COLORS.textMuted;
    ctx.fillText(name, x + 4, y + 3);

    const badge = unlocked ? `${keyPrompt} ACTIVA` : 'BLOQUEADA';
    ctx.font = `bold 3.8px ${UI_FONT}`;
    ctx.fillStyle = unlocked ? themeColor : UI_COLORS.textMuted;
    const bw = ctx.measureText(badge).width;
    ctx.fillText(badge, x + w - bw - 4, y + 3.5);

    ctx.font = `4px ${UI_FONT}`;
    ctx.fillStyle = unlocked ? UI_COLORS.textPrimary : UI_COLORS.textMuted;
    ctx.fillText(UILayout.fitText(ctx, description, w - 8), x + 4, y + 11.5);

    ctx.font = `3.8px ${UI_FONT}`;
    ctx.fillStyle = UI_COLORS.textSecondary;
    ctx.fillText(UILayout.fitText(ctx, `Origen: ${source}`, w - 8), x + 4, y + 20);
  }

  _drawDevPortrait(ctx, px, py, player, t) {
    const size = 30;

    ctx.fillStyle = '#060a12';
    ctx.fillRect(px, py, size, size);
    ctx.strokeStyle = player?.hasArmor ? UI_COLORS.cyan : UI_COLORS.gold;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);

    ctx.fillStyle = '#101a2e';
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);

    const hasArmor = Boolean(player && player.hasArmor);
    if (hasArmor) {
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(px + 5, py + 20, 20, 9);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(px + 9, py + 22, 12, 3);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(px + 5, py + 20, 20, 9);
    }

    ctx.fillStyle = '#e2b391';
    ctx.fillRect(px + 12, py + 16, 6, 4);

    ctx.fillStyle = '#fcd5b5';
    ctx.fillRect(px + 8, py + 7, 14, 11);

    ctx.fillStyle = '#451a03';
    ctx.fillRect(px + 7, py + 4, 16, 5);

    const robotVal = player ? (player.robotizationLevel || 0) : 0;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px + 9, py + 10, 5, 4);
    ctx.fillRect(px + 16, py + 10, 5, 4);
    ctx.fillRect(px + 14, py + 11, 2, 1);

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(px + 10, py + 11, 3, 2);

    if (robotVal > 50) {
      const eyeGlow = 0.8 + Math.sin(t * 8) * 0.2;
      ctx.fillStyle = `rgba(239, 68, 68, ${eyeGlow})`;
      ctx.fillRect(px + 17, py + 11, 3, 2);
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(px + 17, py + 11, 3, 2);
    }
  }
}
