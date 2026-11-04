/**
 * CharacterStats.js - Ficha Técnica y Progresión Permanente del Héroe ('El Ojete Dorado')
 * 
 * Propósito: Mostrar el perfil del personaje, métricas vitales (salud, robotización,
 * armadura, saldo de bytes), árbol de habilidades de combate y pestaña de consulta
 * del Sistema de Trofeos y Logros desbloqueados/bloqueados.
 * Se abre y cierra con la tecla 'C'.
 */

export class CharacterStats {
  constructor(viewportWidth = 320, viewportHeight = 180) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.isOpen = false;
    this.activeTab = 'stats'; // 'stats' | 'achievements'
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
    if (tab === 'stats' || tab === 'achievements') {
      this.activeTab = tab;
    }
  }

  cycleTab() {
    this.activeTab = this.activeTab === 'stats' ? 'achievements' : 'stats';
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
  handleInput(input) {
    if (!this.isOpen || !input) return false;

    // Cambiar de pestaña mediante Tab, 1, 2, A, D, Flechas
    if (input.consumeKey('Tab')) {
      this.cycleTab();
      return true;
    }
    if (input.consumeKey('Digit1')) {
      this.switchTab('stats');
      return true;
    }
    if (input.consumeKey('Digit2')) {
      this.switchTab('achievements');
      return true;
    }

    // Interacción por clic de ratón en las pestañas superiores
    if (input.pointerJustClicked) {
      const winW = 276;
      const winX = Math.round((this.viewportWidth - winW) / 2);
      const tabY = Math.round((this.viewportHeight - 162) / 2) + 4;
      const px = input.pointerX;
      const py = input.pointerY;

      if (py >= tabY && py <= tabY + 12) {
        if (px >= winX + 8 && px <= winX + 90) {
          this.switchTab('stats');
          return true;
        } else if (px >= winX + 96 && px <= winX + 190) {
          this.switchTab('achievements');
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Renderiza la ventana de la Ficha de Desarrollo o la pestaña de Logros.
   * @param {CanvasRenderingContext2D} ctx Contexto de dibujo
   * @param {Player} player Instancia del jugador
   * @param {AchievementManager} achievementManager Gestor de logros
   */
  render(ctx, player = null, achievementManager = null) {
    if (!this.isOpen) return;

    const winW = 276;
    const winH = 162;
    const winX = Math.round((this.viewportWidth - winW) / 2);
    const winY = Math.round((this.viewportHeight - winH) / 2);
    const t = performance.now() * 0.001;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Fondo oscurecido
    ctx.fillStyle = 'rgba(6, 8, 14, 0.82)';
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

    // Marco exterior con doble borde dorado
    ctx.fillStyle = '#0e1322';
    ctx.fillRect(winX, winY, winW, winH);
    ctx.fillStyle = '#e5c07b';
    ctx.fillRect(winX + 1, winY + 1, winW - 2, winH - 2);
    ctx.fillStyle = '#141c2e';
    ctx.fillRect(winX + 2.5, winY + 2.5, winW - 5, winH - 5);

    // Cantoneras decorativas
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(winX + 3, winY + 3, 5, 2);
    ctx.fillRect(winX + 3, winY + 3, 2, 5);
    ctx.fillRect(winX + winW - 8, winY + 3, 5, 2);
    ctx.fillRect(winX + winW - 5, winY + 3, 2, 5);
    ctx.fillRect(winX + 3, winY + winH - 5, 5, 2);
    ctx.fillRect(winX + 3, winY + winH - 8, 2, 5);
    ctx.fillRect(winX + winW - 8, winY + winH - 5, 5, 2);
    ctx.fillRect(winX + winW - 5, winY + winH - 8, 2, 5);

    // =========================================================================
    // BARRA DE PESTAÑAS SUPERIOR ([1] FICHA / [2] LOGROS)
    // =========================================================================
    const tabY = winY + 5;
    const tab1W = 86;
    const tab2W = 96;

    // Pestaña 1: Ficha y Habilidades
    const isTab1 = this.activeTab === 'stats';
    ctx.fillStyle = isTab1 ? '#1e293b' : '#0b101c';
    ctx.fillRect(winX + 8, tabY, tab1W, 11);
    ctx.strokeStyle = isTab1 ? '#f59e0b' : '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(winX + 8.5, tabY + 0.5, tab1W - 1, 10);

    ctx.font = 'bold 5.5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isTab1 ? '#ffd885' : '#64748b';
    ctx.fillText('[1] ⚙️ PERFIL & COMBATE', winX + 8 + tab1W / 2, tabY + 5.5);

    // Pestaña 2: Trofeos y Logros
    const isTab2 = this.activeTab === 'achievements';
    const unlockedCount = achievementManager ? achievementManager.getUnlockedCount() : 0;
    const totalCount = achievementManager ? achievementManager.getTotalCount() : 11;

    ctx.fillStyle = isTab2 ? '#1e293b' : '#0b101c';
    ctx.fillRect(winX + 98, tabY, tab2W, 11);
    ctx.strokeStyle = isTab2 ? '#f59e0b' : '#334155';
    ctx.strokeRect(winX + 98.5, tabY + 0.5, tab2W - 1, 10);

    ctx.fillStyle = isTab2 ? '#ffd885' : '#64748b';
    ctx.fillText(`[2] 🏆 TROFEOS (${unlockedCount}/${totalCount})`, winX + 98 + tab2W / 2, tabY + 5.5);

    // Atajo superior derecho
    ctx.font = '5px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('[Tab] Alternar  ·  [C/Esc] Salir', winX + winW - 8, winY + 7);

    // =========================================================================
    // CONTENIDO SEGÚN LA PESTAÑA ACTIVA
    // =========================================================================
    if (this.activeTab === 'stats') {
      this._renderStatsTab(ctx, winX, winY, winW, winH, player, t);
    } else {
      this._renderAchievementsTab(ctx, winX, winY, winW, winH, achievementManager);
    }

    // =========================================================================
    // BARRA INFERIOR DE ATAJOS
    // =========================================================================
    ctx.font = '5.5px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
      this.activeTab === 'stats'
        ? '[Tab / 2] Ver Trofeos  ·  [I] Mochila  ·  [L] Diario  ·  [C / Esc] Cerrar'
        : '[Tab / 1] Ver Perfil  ·  [I] Mochila  ·  [L] Diario  ·  [C / Esc] Cerrar',
      winX + winW / 2,
      winY + winH - 7
    );

    ctx.restore();
  }

  /**
   * Renderiza la vista de Perfil y Habilidades de combate.
   */
  _renderStatsTab(ctx, winX, winY, winW, winH, player, t) {
    // -------------------------------------------------------------------------
    // PANEL IZQUIERDO: RETRATO Y MÉTRICAS VITALES (Ancho: 124px)
    // -------------------------------------------------------------------------
    const leftX = winX + 8;
    const leftY = winY + 19;
    const leftW = 124;
    const leftH = 124;

    ctx.fillStyle = '#0b101c';
    ctx.fillRect(leftX, leftY, leftW, leftH);
    ctx.strokeStyle = '#2b3652';
    ctx.lineWidth = 1;
    ctx.strokeRect(leftX + 0.5, leftY + 0.5, leftW - 1, leftH - 1);

    // 1. Retrato pixel art del Dev
    this._drawDevPortrait(ctx, leftX + 5, leftY + 5, player, t);

    // Nombre y Título
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 6.5px monospace';
    ctx.fillStyle = '#ffd885';
    ctx.fillText('DEV PROGRAMADOR', leftX + 42, leftY + 7);

    const devTitle = this.getDevTitle(player);
    ctx.font = '5.5px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(devTitle, leftX + 42, leftY + 17);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '5px monospace';
    ctx.fillText('Valleverde · Nivel 1', leftX + 42, leftY + 26);

    // Línea divisoria
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(leftX + 4, leftY + 38);
    ctx.lineTo(leftX + leftW - 4, leftY + 38);
    ctx.stroke();

    // 2. Métricas Vitales
    const metricY = leftY + 41;
    const coinsVal = player ? player.coins : 0;
    const hasArmor = player ? player.hasArmor : false;
    const hasSword = player ? player.hasSword : false;
    const robotVal = player ? Math.round(player.robotizationLevel) : 0;
    const hasCurse = player ? player.hasBrokenHeartCurse : false;

    // Salud
    ctx.font = '5.5px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Salud:', leftX + 5, metricY);
    ctx.fillStyle = '#f43f5e';
    const hpCur = player ? Math.ceil(player.hp) : 6;
    const hpMax = player ? player.maxHp : 6;
    ctx.fillText(`❤️ ${hpCur}/${hpMax} HP`, leftX + 42, metricY);

    // Saldo Bytes
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Saldo:', leftX + 5, metricY + 13);
    ctx.fillStyle = '#fde047';
    ctx.fillText(`🪙 ${coinsVal} Bytes`, leftX + 42, metricY + 13);

    // Armadura
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Defensa:', leftX + 5, metricY + 26);
    ctx.fillStyle = hasArmor ? '#4ade80' : '#f87171';
    ctx.fillText(hasArmor ? '🛡️ Armadura Binaria' : '⚠️ Indefenso (0 def)', leftX + 42, metricY + 26);

    // Arma
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Arma:', leftX + 5, metricY + 39);
    ctx.fillStyle = hasSword ? '#38bdf8' : '#64748b';
    ctx.fillText(hasSword ? '⚔️ Espada Recursiva' : 'Desarmado', leftX + 42, metricY + 39);

    // Robotización con barra gráfica
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Robotiz.:', leftX + 5, metricY + 52);

    const barX = leftX + 42;
    const barY = metricY + 51;
    const barW = 50;
    const barH = 5;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

    const fillW = Math.round(barW * (Math.min(100, Math.max(0, robotVal)) / 100));
    if (fillW > 0) {
      ctx.fillStyle = robotVal > 75 ? '#ef4444' : robotVal > 40 ? '#f59e0b' : '#10b981';
      ctx.fillRect(barX + 1, barY + 1, fillW - 2, barH - 2);
    }
    ctx.fillStyle = robotVal > 75 ? '#fca5a5' : '#cbd5e1';
    ctx.fillText(`${robotVal}%`, barX + barW + 3, metricY + 52);

    // Maldición / Espíritu
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Espíritu:', leftX + 5, metricY + 66);
    if (hasCurse) {
      ctx.fillStyle = '#f43f5e';
      ctx.fillText('💔 Corazón Maldito (-0.5♥)', leftX + 42, metricY + 66);
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('✨ Íntegro (100%)', leftX + 42, metricY + 66);
    }

    // -------------------------------------------------------------------------
    // PANEL DERECHO: ÁRBOL / REGISTRO DE HABILIDADES DE COMBATE (Ancho: 130px)
    // -------------------------------------------------------------------------
    const rightX = winX + 138;
    const rightY = winY + 19;
    const rightW = 130;
    const rightH = 124;

    ctx.fillStyle = '#0b101c';
    ctx.fillRect(rightX, rightY, rightW, rightH);
    ctx.strokeStyle = '#2b3652';
    ctx.lineWidth = 1;
    ctx.strokeRect(rightX + 0.5, rightY + 0.5, rightW - 1, rightH - 1);

    // Cabecera derecha
    ctx.font = 'bold 6.5px monospace';
    ctx.fillStyle = '#ffd885';
    ctx.fillText('⚔️ HABILIDADES DE COMBATE', rightX + 6, rightY + 6);

    // 1. Dash Asíncrono
    const hasDash = player && player.hasDash;
    this._drawSkillCard(
      ctx,
      rightX + 4,
      rightY + 16,
      rightW - 8,
      32,
      '💨 Dash Asíncrono',
      '[Shift] + Dir',
      hasDash,
      '0.2s invulnerabilidad para esquivar.',
      'Boss 1: Garbage Collector',
      '#10b981'
    );

    // 2. Corte en Cascada (Caso Base)
    const hasCharged = player && player.hasChargedAttack;
    this._drawSkillCard(
      ctx,
      rightX + 4,
      rightY + 52,
      rightW - 8,
      32,
      '🌀 Corte en Cascada',
      '[Espacio 1s]',
      hasCharged,
      'Tajo radial 360° con daño triple.',
      'Boss 2: Stack Overflow',
      '#38bdf8'
    );

    // 3. Escudo TypeScript (Barrera de Tipado Estricto)
    const hasBarrier = player && player.hasBarrier;
    this._drawSkillCard(
      ctx,
      rightX + 4,
      rightY + 88,
      rightW - 8,
      32,
      '🛡️ Escudo TypeScript',
      '[Q]',
      hasBarrier,
      'Campo 3s que absorbe proyectiles.',
      'Boss 3: Microondas V0.1',
      '#f59e0b'
    );
  }

  /**
   * Renderiza la pestaña de Trofeos y Logros del sistema.
   */
  _renderAchievementsTab(ctx, winX, winY, winW, winH, achievementManager) {
    const list = achievementManager ? achievementManager.getAll() : [];
    const unlockedCount = achievementManager ? achievementManager.getUnlockedCount() : 0;
    const totalCount = achievementManager ? achievementManager.getTotalCount() : list.length;
    const pct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

    // Barra de progreso superior
    const barX = winX + 10;
    const barY = winY + 20;
    const barW = winW - 20;
    const barH = 5;

    ctx.fillStyle = '#0b101c';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

    const fillW = Math.round(barW * (pct / 100));
    if (fillW > 0) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(barX + 1, barY + 1, fillW - 2, barH - 2);
    }

    ctx.font = '5px monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${unlockedCount}/${totalCount} Desbloqueados (${pct}%)`, barX + barW, barY - 2);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('PROGRESIÓN DE TROFEOS:', barX, barY - 2);

    // Distribución en 2 columnas: Columna Izquierda (6) y Columna Derecha (5)
    const colW = 126;
    const colH = 18;
    const startY = winY + 28;

    list.forEach((ach, index) => {
      const isRightCol = index >= 6;
      const rowIndex = isRightCol ? index - 6 : index;
      const x = isRightCol ? winX + 138 : winX + 8;
      const y = startY + rowIndex * (colH + 2);

      const isUnlocked = ach.unlocked;

      // Fondo de la tarjeta
      ctx.fillStyle = isUnlocked ? '#111a2e' : '#0b101c';
      ctx.fillRect(x, y, colW, colH);

      // Borde
      ctx.strokeStyle = isUnlocked ? '#10b981' : '#1e293b';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x + 0.5, y + 0.5, colW - 1, colH - 1);

      // Icono de estado
      ctx.font = 'bold 5.5px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      if (isUnlocked) {
        ctx.fillStyle = '#10b981';
        ctx.fillText('[✓]', x + 3, y + 3);
        ctx.fillStyle = '#ffd885';
        ctx.fillText(`${ach.icon} ${ach.title}`, x + 15, y + 3);
      } else {
        ctx.fillStyle = '#64748b';
        ctx.fillText('[🔒]', x + 3, y + 3);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${ach.title}`, x + 15, y + 3);
      }

      // Descripción del logro
      ctx.font = '4.2px monospace';
      ctx.fillStyle = isUnlocked ? '#cbd5e1' : '#475569';
      let desc = ach.description;
      if (desc.length > 29) {
        desc = desc.substring(0, 28) + '…';
      }
      ctx.fillText(desc, x + 3, y + 10.5);
    });
  }

  /**
   * Tarjeta visual de habilidad de combate con tecla y estado (Activa / Bloqueada).
   */
  _drawSkillCard(ctx, x, y, w, h, name, keyPrompt, unlocked, description, source, themeColor) {
    ctx.fillStyle = unlocked ? '#111a2e' : '#0d131f';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = unlocked ? themeColor : '#253047';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // Nombre y tecla
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 5.5px monospace';
    ctx.fillStyle = unlocked ? '#ffd885' : '#64748b';
    ctx.fillText(name, x + 4, y + 4.5);

    // Tecla rápida
    ctx.font = 'bold 5px monospace';
    ctx.fillStyle = unlocked ? themeColor : '#475569';
    ctx.fillText(keyPrompt, x + 4, y + 13);

    // Badge de estado
    ctx.textAlign = 'right';
    if (unlocked) {
      ctx.fillStyle = themeColor;
      ctx.fillText('[✓ ACTIVA]', x + w - 4, y + 4.5);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.fillText('[🔒 BLOQUEADA]', x + w - 4, y + 4.5);
    }

    // Descripción y origen
    ctx.textAlign = 'left';
    ctx.font = '4.5px monospace';
    ctx.fillStyle = unlocked ? '#cbd5e1' : '#475569';
    ctx.fillText(description, x + 4, y + 21);

    ctx.fillStyle = unlocked ? '#94a3b8' : '#334155';
    ctx.fillText(`Origen: ${source}`, x + 4, y + 27);
  }

  /**
   * Dibuja el retrato estilizado en pixel art del desarrollador.
   */
  _drawDevPortrait(ctx, px, py, player, t) {
    const size = 32;

    // Marco exterior de avatar
    ctx.fillStyle = '#060a12';
    ctx.fillRect(px, py, size, size);
    ctx.strokeStyle = player?.hasArmor ? '#38bdf8' : '#e5c07b';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);

    // Fondo del retrato (degradado sutil de terminal / código)
    ctx.fillStyle = '#101a2e';
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);

    // Cuerpo / Torso (sudadera de dev o armadura binaria)
    const hasArmor = player && player.hasArmor;
    if (hasArmor) {
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(px + 6, py + 22, 20, 9);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(px + 10, py + 24, 12, 3);
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(px + 14, py + 22, 4, 2);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(px + 6, py + 22, 20, 9);
      ctx.fillStyle = '#475569';
      ctx.fillRect(px + 11, py + 24, 10, 4);
    }

    // Cuello
    ctx.fillStyle = '#e2b391';
    ctx.fillRect(px + 13, py + 18, 6, 4);

    // Cabeza y rostro
    ctx.fillStyle = '#fcd5b5';
    ctx.fillRect(px + 9, py + 8, 14, 12);
    ctx.fillStyle = '#e2b391';
    ctx.fillRect(px + 8, py + 12, 1, 4); // Oreja izq
    ctx.fillRect(px + 23, py + 12, 1, 4); // Oreja der

    // Cabello castaño / dev
    ctx.fillStyle = '#451a03';
    ctx.fillRect(px + 8, py + 5, 16, 5);
    ctx.fillRect(px + 7, py + 8, 2, 5);
    ctx.fillRect(px + 23, py + 8, 2, 4);
    ctx.fillRect(px + 10, py + 4, 12, 2);

    // Gafas de desarrollador con reflejo de pantalla
    const robotVal = player ? player.robotizationLevel : 0;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px + 10, py + 11, 5, 4);
    ctx.fillRect(px + 17, py + 11, 5, 4);
    ctx.fillRect(px + 15, py + 12, 2, 1); // Puente de gafas

    // Cristal izquierdo
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(px + 11, py + 12, 3, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 11, py + 12, 1, 1);

    // Cristal derecho: Si está muy robotizado (>50%), brilla en rojo cibernético
    if (robotVal > 50) {
      const eyeGlow = 0.8 + Math.sin(t * 8) * 0.2;
      ctx.fillStyle = `rgba(239, 68, 68, ${eyeGlow})`;
      ctx.fillRect(px + 18, py + 12, 3, 2);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(px + 19, py + 12, 1, 1);
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(px + 18, py + 12, 3, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + 18, py + 12, 1, 1);
    }

    // Boca
    ctx.fillStyle = '#b45309';
    ctx.fillRect(px + 14, py + 17, 4, 1);
  }
}
