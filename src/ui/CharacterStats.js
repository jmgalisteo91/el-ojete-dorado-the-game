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
  }

  open() {
    this.isOpen = true;
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
    const order = ['stats', 'achievements', 'skills'];
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
      this.switchTab('achievements');
      return true;
    }
    if (input.consumeKey('Digit3') || input.consumeKey('Numpad3')) {
      this.switchTab('skills');
      return true;
    }

    if (input.pointerJustClicked) {
      const modal = UILayout.modalRect();
      const tabY = modal.y + 18;
      const px = input.pointerX;
      const py = input.pointerY;

      if (py >= tabY && py <= tabY + 12) {
        if (px >= modal.x + 5 && px <= modal.x + 98) {
          this.switchTab('stats');
          return true;
        } else if (px >= modal.x + 100 && px <= modal.x + 196) {
          this.switchTab('achievements');
          return true;
        } else if (px >= modal.x + 198 && px <= modal.x + modal.w - 5) {
          this.switchTab('skills');
          return true;
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

    const unlockedCount = achievementManager ? achievementManager.getUnlockedCount() : 0;
    const totalCount = achievementManager ? achievementManager.getTotalCount() : 11;
    const skillPts = player ? (player.skillPoints || 0) : 0;

    const frame = UILayout.drawModalFrame(ctx, {
      title: 'FICHA DEL DESARROLLADOR',
      icon: '⚙️',
      badge: '[Tab] Cambiar Vista',
      closeLabel: '[Esc] Cerrar'
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
    const tabH = 11;
    const tabGap = 3;
    const tabW = Math.floor((content.w - tabGap * 2) / 3);

    const tabs = [
      { id: 'stats', label: '[1] PERFIL & ATRIBUTOS' },
      { id: 'achievements', label: `[2] LOGROS (${unlockedCount}/${totalCount})` },
      { id: 'skills', label: `[3] HABILIDADES (${skillPts}pt)` }
    ];

    tabs.forEach((tab, idx) => {
      const tx = content.x + idx * (tabW + tabGap);
      const isActive = this.activeTab === tab.id;
      ctx.fillStyle = isActive ? UI_COLORS.slotSelectedBg : UI_COLORS.panelBg;
      ctx.fillRect(tx, tabBarY, tabW, tabH);
      ctx.strokeStyle = isActive ? UI_COLORS.gold : UI_COLORS.borderInner;
      ctx.lineWidth = 1;
      ctx.strokeRect(tx + 0.5, tabBarY + 0.5, tabW - 1, tabH - 1);

      ctx.font = `bold 4.1px ${UI_FONT}`;
      ctx.fillStyle = isActive ? UI_COLORS.gold : UI_COLORS.textSecondary;
      const lw = ctx.measureText(tab.label).width;
      ctx.fillText(tab.label, tx + Math.max(2, Math.floor((tabW - lw) / 2)), tabBarY + 3.5);
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
    ctx.fillText(`★ Nivel: ${playerLvl}/10 (${playerXp}/${nextXp} XP)`, leftRect.x + 41, leftRect.y + 40);

    // 2. Barras de progreso compactas (Salud, Blindaje, Robotización, Experiencia, Ataque)
    const barX = leftRect.x + 5;
    const barW = leftRect.w - 10;
    let by = leftRect.y + 47;
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
      label: 'SALUD VITAL',
      valueText: `${hpCur.toFixed(1).replace('.0', '')}/${hpMax} ♥`
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
      label: 'ROBOTIZACIÓN IA',
      valueText: `${robotVal}% 🤖`
    });
    by += barSpacing;

    const baseXp = player && typeof player.getCurrentLevelBaseXp === 'function' ? player.getCurrentLevelBaseXp() : 0;
    const xpRange = Math.max(1, nextXp - baseXp);
    const xpProgress = playerLvl >= 10 ? xpRange : Math.max(0, Math.min(xpRange, playerXp - baseXp));
    const xpPct = player && typeof player.getXpProgressPercent === 'function' ? player.getXpProgressPercent() : 0;
    UILayout.drawBar(ctx, {
      x: barX,
      y: by,
      w: barW,
      h: 5,
      value: xpProgress,
      max: xpRange,
      color: UI_COLORS.gold,
      label: 'EXP. PROGRAMADOR',
      valueText: playerLvl >= 10 ? 'NV 10 (MÁX) ★' : `NV ${playerLvl} (${xpPct}%)`
    });
    by += barSpacing;

    const hasSword = Boolean(player && player.hasSword);
    const atkPower = hasSword ? (robotVal > 50 ? 70 : 100) : 25;
    UILayout.drawBar(ctx, {
      x: barX,
      y: by,
      w: barW,
      h: 5,
      value: atkPower,
      max: 100,
      color: hasSword ? UI_COLORS.gold : UI_COLORS.textMuted,
      label: 'POTENCIA RECURSIVA',
      valueText: hasSword ? (robotVal > 50 ? '-30% PENAL.' : '100% ⚔️') : 'DESARMADO'
    });

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
      headerText: `ÁRBOL DE ESPECIALIZACIÓN · PUNTOS DISPONIBLES: ${player ? player.skillPoints : 0}`
    });

    const x = rect.x + 6;
    const w = rect.w - 12;
    let y = rect.y + 16;

    SKILL_DEFS.forEach((def, i) => {
      const owned = Boolean(player && player.skills[def.key]);
      const selected = i === this.skillCursor;
      const rowH = 22;

      ctx.fillStyle = selected ? UI_COLORS.slotSelectedBg : UI_COLORS.slotBg;
      ctx.fillRect(x, y, w, rowH - 2);
      ctx.strokeStyle = owned ? UI_COLORS.emerald : (selected ? UI_COLORS.gold : UI_COLORS.slotBorder);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, rowH - 3);

      ctx.font = `bold 4.8px ${UI_FONT}`;
      ctx.fillStyle = owned ? UI_COLORS.emerald : UI_COLORS.textPrimary;
      ctx.fillText(`${selected ? '▶ ' : ''}${def.name}`, x + 4, y + 3);

      ctx.font = `4.1px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.textSecondary;
      ctx.fillText(UILayout.fitText(ctx, def.desc, w - 55), x + 8, y + 11);

      const statusStr = owned ? '✓ ACTIVA' : `[Enter] ${def.cost}pt`;
      ctx.font = `bold 4.2px ${UI_FONT}`;
      ctx.fillStyle = owned ? UI_COLORS.emerald : (player && player.skillPoints >= def.cost ? UI_COLORS.gold : UI_COLORS.textMuted);
      const sw = ctx.measureText(statusStr).width;
      ctx.fillText(statusStr, x + w - sw - 4, y + 3.5);

      y += rowH;
    });

    if (this.skillMessage) {
      ctx.font = `bold 4.4px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.gold;
      ctx.fillText(this.skillMessage, x, rect.y + rect.h - 10);
    }
  }

  /**
   * Pestaña de Trofeos y Logros
   */
  _renderAchievementsTab(ctx, rect, achievementManager) {
    const list = achievementManager ? achievementManager.getAll() : [];
    const unlockedCount = achievementManager ? achievementManager.getUnlockedCount() : 0;
    const totalCount = achievementManager ? achievementManager.getTotalCount() : list.length;

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
      label: 'PROGRESO DE TROFEOS',
      valueText: `${unlockedCount}/${totalCount}`
    });

    const colW = Math.floor((rect.w - 16) / 2);
    const rowH = 15;
    const startY = rect.y + 18;

    list.slice(0, 12).forEach((ach, index) => {
      const isRightCol = index >= 6;
      const rowIndex = isRightCol ? index - 6 : index;
      const x = isRightCol ? rect.x + colW + 10 : rect.x + 6;
      const y = startY + rowIndex * (rowH + 1);
      const isUnlocked = Boolean(ach.unlocked);

      ctx.fillStyle = isUnlocked ? UI_COLORS.slotSelectedBg : UI_COLORS.slotBg;
      ctx.fillRect(x, y, colW, rowH);
      ctx.strokeStyle = isUnlocked ? UI_COLORS.emerald : UI_COLORS.slotBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, colW - 1, rowH - 1);

      ctx.font = `bold 4.2px ${UI_FONT}`;
      ctx.fillStyle = isUnlocked ? UI_COLORS.gold : UI_COLORS.textMuted;
      const prefix = isUnlocked ? '✓ ' : '🔒 ';
      ctx.fillText(UILayout.fitText(ctx, `${prefix}${ach.title}`, colW - 6), x + 3, y + 2);

      ctx.font = `3.8px ${UI_FONT}`;
      ctx.fillStyle = isUnlocked ? UI_COLORS.textSecondary : UI_COLORS.textMuted;
      ctx.fillText(UILayout.fitText(ctx, ach.description || '', colW - 6), x + 3, y + 8.5);
    });
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
