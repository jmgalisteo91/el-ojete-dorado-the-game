/**
 * CharacterStats.js - Ficha Técnica y Progresión Permanente del Héroe ('El Ojete Dorado')
 *
 * Rediseñado bajo UILayout (Safe Layout 290×150 px):
 * - Barras de progreso compactas para Salud, Blindaje Binario, Robotización y Atributos.
 * - Selector superior con [Tab] / [1] / [2] / [3] para conmutar entre Perfil, Logros y Habilidades.
 */

import { SKILL_DEFS } from '../core/SkillCatalog.js?v=8';
import { MAX_PLAYER_LEVEL } from '../entities/Player.js?v=8';
import { EXPANSION_EQUIPMENT, EXPANSION_SKILLS } from '../expansion/ExpansionData.js?v=8';
import { UILayout, UI_COLORS, UI_FONT } from './UILayout.js?v=8';

export class CharacterStats {
  constructor(viewportWidth = 320, viewportHeight = 180, game = null) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.game = game;
    this.isOpen = false;
    this.activeTab = 'stats'; // 'stats' | 'achievements' | 'skills'
    this.skillCursor = 0;
    this.skillsPerPage = 4;
    this.skillMessage = '';

    // (FIX M3.4) Tabs y filas con zonas de toque más grandes
    this.isTouchDevice = false;
    this._skillRowRects = [];
    this._skillPageButtons = [];
    this._achPageButtons = [];
    this.achievementPage = 0;
    this._tabRects = [];
    this._popStart = null;
  }

  _isExpansionActive(player = null, explicitFlag = null) {
    if (typeof explicitFlag === 'boolean') return explicitFlag;
    if (this.isExpansionActive !== undefined) return Boolean(this.isExpansionActive);
    if (this.game) return Boolean(this.game.isExpansionActive || this.game.isExpansionMode);
    if (player?.isExpansionActive !== undefined) return Boolean(player.isExpansionActive);
    if (player?.game) return Boolean(player.game.isExpansionActive || player.game.isExpansionMode);
    const wg = typeof window !== 'undefined' ? window.game : globalThis?.game;
    return Boolean(wg && (wg.isExpansionActive || wg.isExpansionMode));
  }

  /**
   * Devuelve las habilidades visibles para el jugador:
   * - En juego base: solo las 4 habilidades originales (SKILL_DEFS).
   * - En expansión: base + expansión, ocultando Nivel II sin su habilidad base.
   */
  getVisibleSkills(player = null, explicitExpansionActive = null) {
    if (!this._isExpansionActive(player, explicitExpansionActive)) {
      return [...SKILL_DEFS];
    }
    const owned = player?.skills || {};
    const all = [...SKILL_DEFS, ...Object.values(EXPANSION_SKILLS)];
    return all.filter((def) => !def.requires || Boolean(owned[def.requires]));
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
    if (this._isExpansionActive(player)) {
      const lvl = player.level || 10;
      if (lvl >= MAX_PLAYER_LEVEL) return 'CTO Legendario de Valleverde 2.0';
      if (lvl >= 17) return 'Principal Software Architect';
      if (lvl >= 14) return 'Staff Engineer Rebelde';
      if (lvl >= 12) return 'Senior Tech Lead Veterano';
      return 'Senior Dev (Confiscado en RRHH)';
    }
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
    this._hoverPointer = { x: input.pointerX, y: input.pointerY };

    if (this.activeTab === 'skills') {
      const visibleSkills = this.getVisibleSkills(player);
      const count = Math.max(1, visibleSkills.length);
      if (this.skillCursor >= count) this.skillCursor = 0;

      if (input.consumeKey('KeyW') || input.consumeKey('ArrowUp')) {
        this.skillCursor = (this.skillCursor + count - 1) % count;
        return true;
      }
      if (input.consumeKey('KeyS') || input.consumeKey('ArrowDown')) {
        this.skillCursor = (this.skillCursor + 1) % count;
        return true;
      }
      if (input.consumeKey('Enter') || input.consumeKey('KeyE') || input.consumeKey('Space')) {
        const def = visibleSkills[this.skillCursor];
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

    if (this.activeTab === 'achievements') {
      if (input.consumeKey('KeyW') || input.consumeKey('ArrowUp')) {
        this.achievementPage = Math.max(0, (this.achievementPage || 0) - 1);
        return true;
      }
      if (input.consumeKey('KeyS') || input.consumeKey('ArrowDown')) {
        this.achievementPage = (this.achievementPage || 0) + 1;
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

      // (FIX M3.4) Botones de página y tarjetas de habilidad: 1º selecciona, 2º compra
      if (this.activeTab === 'skills') {
        const visibleSkills = this.getVisibleSkills(player);
        for (const btn of this._skillPageButtons) {
          if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
            const totalPages = Math.max(1, Math.ceil(visibleSkills.length / this.skillsPerPage));
            const curPage = Math.floor(Math.min(this.skillCursor, Math.max(0, visibleSkills.length - 1)) / this.skillsPerPage);
            const nextPage = btn.id === 'prev'
              ? (curPage + totalPages - 1) % totalPages
              : (curPage + 1) % totalPages;
            this.skillCursor = nextPage * this.skillsPerPage;
            return true;
          }
        }
        for (const row of this._skillRowRects) {
          if (px >= row.x && px <= row.x + row.w && py >= row.y && py <= row.y + row.h) {
            if (this.skillCursor === row.index) {
              const def = visibleSkills[row.index];
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
      } else if (this.activeTab === 'achievements') {
        for (const btn of this._achPageButtons) {
          if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
            const totalPages = Math.max(1, btn.totalPages || 1);
            this.achievementPage = btn.id === 'prev'
              ? (this.achievementPage + totalPages - 1) % totalPages
              : (this.achievementPage + 1) % totalPages;
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
      const hp = this._hoverPointer;
      const isHover = !isActive && hp && hp.x >= tx && hp.x <= tx + tabW && hp.y >= tabBarY && hp.y <= tabBarY + tabH;
      if (isHover) {
        ctx.fillStyle = 'rgba(253, 224, 71, 0.08)';
        ctx.fillRect(tx, tabBarY, tabW, tabH);
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx + 0.5, tabBarY + 0.5, tabW - 1, tabH - 1);
      }
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
      this._renderAchievementsTab(ctx, bodyRect, achievementManager, player);
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

    const expansionActive = this._isExpansionActive(player);

    // 1. Retrato pixel art del Dev + Identidad
    this._drawDevPortrait(ctx, leftRect.x + 5, leftRect.y + 15, player, t);

    ctx.font = `bold 5px ${UI_FONT}`;
    ctx.fillStyle = UI_COLORS.gold;
    ctx.fillText(expansionActive ? 'VETERANO VALLEVERDE' : 'DEV PROGRAMADOR', leftRect.x + 41, leftRect.y + 16);

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
        ? `★ Nivel: ${MAX_PLAYER_LEVEL}/${MAX_PLAYER_LEVEL} · MÁXIMO`
        : `★ Nivel: ${playerLvl}/${MAX_PLAYER_LEVEL} (${playerXp}/${nextXp} XP)`,
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
    const corpShield = expansionActive && player?.equippedShield ? EXPANSION_EQUIPMENT[player.equippedShield] : null;
    if (expansionActive) {
      UILayout.drawBar(ctx, {
        x: barX,
        y: by,
        w: barW,
        h: 5,
        value: corpShield ? 1 : (hasArmor ? armorPts : 0),
        max: corpShield ? 1 : maxArmorPts,
        color: UI_COLORS.cyan,
        gradient: ['#0ea5e9', '#67e8f9'],
        label: 'DEFENSA CORPORATIVA',
        valueText: corpShield ? corpShield.badgeLabel : (hasArmor ? `${armorPts}/${maxArmorPts} 🛡️` : 'SIN ESCUDO')
      });
    } else {
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
    }
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
    const xpProgress = player && player.isMaxLevel ? xpRange : Math.max(0, Math.min(xpRange, playerXp - baseXp));
    const xpPct = player && typeof player.getXpProgressPercent === 'function' ? player.getXpProgressPercent() : 0;
    if (player && player.isMaxLevel) {
      // Sin barra de XP al alcanzar el nivel máximo (Nv. 20): solo el rótulo dorado
      ctx.font = `bold 5.5px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.gold;
      ctx.textAlign = 'center';
      ctx.fillText(`★ NIVEL MÁXIMO · Nv. ${MAX_PLAYER_LEVEL} ★`, barX + barW / 2, by + 3);
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
        label: expansionActive ? 'EXP. VETERANO' : 'EXP. PROGRAMADOR',
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
      headerText: expansionActive ? 'DOMINIO DE VETERANO' : 'MÓDULOS DE COMBATE ACTIVOS'
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
      expansionActive ? 'Maestría de Veterano (Base)' : 'Devorador de Memoria',
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
      expansionActive ? 'Maestría de Veterano (Base)' : 'Coloso de la Pila Infinita',
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
      expansionActive ? 'Maestría de Veterano (Base)' : 'Ciber-Horno Termonuclear',
      UI_COLORS.gold
    );
  }

  /**
   * Árbol de habilidades adquiribles con puntos de combate (base + expansión paginado)
   */
  _renderSkillsTab(ctx, rect, player) {
    const visibleSkills = this.getVisibleSkills(player);
    const totalSkills = visibleSkills.length;
    if (this.skillCursor >= totalSkills) {
      this.skillCursor = Math.max(0, totalSkills - 1);
    }
    const perPage = this.skillsPerPage || 4;
    const totalPages = Math.max(1, Math.ceil(totalSkills / perPage));
    const currentPage = Math.floor(this.skillCursor / perPage);
    const pageStart = currentPage * perPage;
    const pageItems = visibleSkills.slice(pageStart, pageStart + perPage);
    const skillPoints = player ? (player.skillPoints || 0) : 0;

    UILayout.drawPanel(ctx, rect, {
      bg: UI_COLORS.panelBg,
      border: UI_COLORS.borderInner,
      headerText: `HABILIDADES (${currentPage + 1}/${totalPages}) · PTS: ${skillPoints}`
    });

    this._skillPageButtons = [];
    if (totalPages > 1) {
      const bw = 11;
      const bh = 9;
      const by = rect.y + 2;
      const prevBtn = { id: 'prev', x: rect.x + rect.w - 27, y: by, w: bw, h: bh };
      const nextBtn = { id: 'next', x: rect.x + rect.w - 14, y: by, w: bw, h: bh };
      for (const b of [prevBtn, nextBtn]) {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = UI_COLORS.goldDim;
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        ctx.font = `bold 5px ${UI_FONT}`;
        ctx.fillStyle = UI_COLORS.gold;
        ctx.textAlign = 'center';
        ctx.fillText(b.id === 'prev' ? '◀' : '▶', b.x + b.w / 2, b.y + 1.5);
        this._skillPageButtons.push(b);
      }
      ctx.textAlign = 'left';
    }

    const pad = 6;
    const gap = 3;
    const cardW = Math.floor((rect.w - pad * 2 - gap) / 2);
    const cardH = 29;
    const startX = rect.x + pad;
    const startY = rect.y + 14;
    this._skillRowRects = [];
    const icons = {
      vigor: '❤',
      filo: '⚔',
      reflejo: '✦',
      log: '📜',
      ejecutivo: '💼',
      resiliencia: '🧱',
      reciclaje: '♻',
      vigor_2: '❤',
      filo_2: '⚔',
      reflejo_2: '✦',
      log_2: '📜'
    };

    pageItems.forEach((def, localIdx) => {
      const i = pageStart + localIdx;
      const col = localIdx % 2;
      const row = Math.floor(localIdx / 2);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      const owned = Boolean(player && player.skills && player.skills[def.key]);
      const affordable = !owned && skillPoints >= def.cost;
      const selected = i === this.skillCursor;
      const hp = this._hoverPointer;
      const hovered = !selected && hp && hp.x >= x && hp.x <= x + cardW && hp.y >= y && hp.y <= y + cardH;
      this._skillRowRects.push({ x, y, w: cardW, h: cardH, index: i, key: def.key });

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
      ctx.strokeStyle = selected ? UI_COLORS.gold : (hovered ? 'rgba(253, 224, 71, 0.55)' : (owned ? 'rgba(74, 222, 128, 0.7)' : UI_COLORS.slotBorder));
      ctx.lineWidth = selected ? 1.4 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cardW - 1, cardH - 1);
      if (selected) {
        ctx.fillStyle = UI_COLORS.gold;
        ctx.fillRect(x + 2, y + 1, cardW - 4, 1);
      }

      // Icono circular.
      const ix = x + 10;
      const iy = y + 10.5;
      ctx.fillStyle = owned ? 'rgba(74, 222, 128, 0.18)' : 'rgba(100, 116, 139, 0.14)';
      ctx.beginPath();
      ctx.arc(ix, iy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = owned ? UI_COLORS.emerald : UI_COLORS.slotBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = '5.5px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = owned ? UI_COLORS.gold : UI_COLORS.textDim;
      ctx.fillText(def.icon || icons[def.key] || '◆', ix, iy + 0.5);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 4.4px monospace';
      ctx.fillStyle = owned ? UI_COLORS.textPrimary : (affordable ? UI_COLORS.gold : UI_COLORS.textMuted);
      ctx.fillText(UILayout.fitText(ctx, def.name, cardW - 22), x + 19, y + 3.5);

      // Botón / insignia de compra: gris si no hay puntos suficientes
      const btnW = 34;
      const btnH = 7.5;
      const btnX = x + cardW - btnW - 3;
      const btnY = y + 10.5;
      if (owned) {
        ctx.fillStyle = 'rgba(21, 128, 61, 0.55)';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.strokeStyle = UI_COLORS.emerald;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(btnX, btnY, btnW, btnH);
        ctx.font = 'bold 3.6px monospace';
        ctx.fillStyle = UI_COLORS.emerald;
        ctx.textAlign = 'center';
        ctx.fillText('✓ ACTIVA', btnX + btnW / 2, btnY + 1.8);
      } else {
        ctx.fillStyle = affordable ? 'rgba(202, 138, 4, 0.28)' : '#334155';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.strokeStyle = affordable ? UI_COLORS.gold : '#64748b';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(btnX, btnY, btnW, btnH);
        ctx.font = 'bold 3.6px monospace';
        ctx.fillStyle = affordable ? UI_COLORS.gold : '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText(affordable ? `COMPRAR` : `GRIS (${def.cost}pt)`, btnX + btnW / 2, btnY + 1.8);
      }
      ctx.textAlign = 'left';

      ctx.font = '3.8px monospace';
      ctx.fillStyle = owned ? UI_COLORS.emerald : (affordable ? UI_COLORS.textSecondary : '#64748b');
      ctx.fillText(`Coste: ${def.cost}pt`, x + 19, y + 11.5);

      ctx.fillStyle = UI_COLORS.textMuted;
      ctx.fillText(UILayout.fitText(ctx, def.desc, cardW - 8), x + 4, y + 20.5);
    });

    // Detalle completo de la habilidad seleccionada.
    const def = visibleSkills[this.skillCursor] || visibleSkills[0];
    if (def) {
      const owned = Boolean(player && player.skills && player.skills[def.key]);
      const affordable = !owned && skillPoints >= def.cost;
      const detailY = Math.min(startY + 2 * (cardH + gap) + 1, rect.y + rect.h - 33);
      const detailH = Math.max(24, rect.y + rect.h - detailY - 2);
      const g = ctx.createLinearGradient(rect.x + pad, detailY, rect.x + pad, detailY + detailH);
      g.addColorStop(0, 'rgba(20, 30, 48, 0.95)');
      g.addColorStop(1, 'rgba(9, 15, 26, 0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(rect.x + pad, detailY, rect.w - pad * 2, detailH);
      ctx.strokeStyle = owned ? 'rgba(74, 222, 128, 0.45)' : (affordable ? 'rgba(229, 192, 123, 0.55)' : '#475569');
      ctx.strokeRect(rect.x + pad + 0.5, detailY + 0.5, rect.w - pad * 2 - 1, detailH - 1);

      ctx.font = 'bold 4.3px monospace';
      ctx.fillStyle = owned ? UI_COLORS.emerald : (affordable ? UI_COLORS.gold : '#94a3b8');
      const statusLabel = owned
        ? 'DESBLOQUEADA'
        : (affordable ? `DISPONIBLE (${def.cost} pt)` : `SIN PUNTOS (${def.cost} pt)`);
      ctx.fillText(`${def.name} · ${statusLabel}`, rect.x + pad + 4, detailY + 3);
      ctx.font = '4px monospace';
      ctx.fillStyle = UI_COLORS.textSecondary;
      const lines = UILayout.wrapText(ctx, def.desc, rect.w - pad * 2 - 8);
      lines.slice(0, 2).forEach((line, idx) => {
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
  _renderAchievementsTab(ctx, rect, achievementManager, player = null) {
    const rawList = achievementManager ? achievementManager.getAll() : [];
    const expansionActive = this._isExpansionActive(player);
    const list = expansionActive
      ? [
          ...rawList.filter((a) => a.category === 'EXPANSION' || a.id === 'ach_completionist'),
          ...rawList.filter((a) => a.category !== 'EXPANSION' && a.id !== 'ach_completionist')
        ]
      : rawList;
    const unlockedCount = achievementManager ? achievementManager.getUnlockedCount() : 0;
    const totalCount = achievementManager ? achievementManager.getTotalCount() : Math.max(1, list.length);

    UILayout.drawPanel(ctx, rect, {
      bg: UI_COLORS.panelBg,
      border: UI_COLORS.borderInner
    });

    const cols = 4;
    const rows = 3;
    const pageSize = cols * rows;
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (this.achievementPage >= totalPages) this.achievementPage = 0;
    const pageItems = list.slice(this.achievementPage * pageSize, (this.achievementPage + 1) * pageSize);

    UILayout.drawBar(ctx, {
      x: rect.x + 6,
      y: rect.y + 4,
      w: totalPages > 1 ? rect.w - 42 : rect.w - 12,
      h: 4,
      value: unlockedCount,
      max: Math.max(1, totalCount),
      color: UI_COLORS.gold,
      gradient: ['#f59e0b', '#fde047'],
      label: totalPages > 1 ? `TROFEOS (Pág ${this.achievementPage + 1}/${totalPages})` : 'PROGRESO DE TROFEOS',
      valueText: `${unlockedCount}/${totalCount}`
    });

    this._achPageButtons = [];
    if (totalPages > 1) {
      const bw = 12;
      const bh = 9;
      const by = rect.y + 3;
      const prevBtn = { id: 'prev', x: rect.x + rect.w - 31, y: by, w: bw, h: bh, totalPages };
      const nextBtn = { id: 'next', x: rect.x + rect.w - 17, y: by, w: bw, h: bh, totalPages };
      for (const b of [prevBtn, nextBtn]) {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = UI_COLORS.goldDim;
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        ctx.font = 'bold 5px monospace';
        ctx.fillStyle = UI_COLORS.gold;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.id === 'prev' ? '<' : '>', b.x + b.w / 2, b.y + b.h / 2 + 0.5);
        this._achPageButtons.push(b);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    }

    const gapX = 4;
    const gapY = 3;
    const cellW = Math.floor((rect.w - 12 - gapX * (cols - 1)) / cols);
    const cellH = Math.floor((rect.h - 16 - gapY * (rows - 1)) / rows);
    const startX = rect.x + 6;
    const startY = rect.y + 15;

    pageItems.forEach((ach, index) => {
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
    } else if (this._isExpansionActive(player)) {
      // Traje corporativo gris azulado con cuello blanco y corbata azul
      ctx.fillStyle = '#334155';
      ctx.fillRect(px + 5, py + 20, 20, 9);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(px + 12, py + 20, 6, 3);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(px + 14, py + 22, 2, 7);
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
