/**
 * LeaderboardView.js · Modal Unificado del Salón de la Fama (Top 10 Global & Local)
 *
 * Contenedor unificado de 290×150 px mediante UILayout.
 * Muestra el Top 10 (#1 - #10): Posición, Tag del jugador, Tiempo de Run (mm:ss),
 * Bytes recolectados y Puntuación final con insignia de Rango (S, A, B, C).
 * Gestiona visualmente los estados de carga, renderizado de tabla y fallback offline.
 */

import { UILayout, UI_COLORS, UI_FONT } from './UILayout.js?v=8';
import { CloudStorage } from '../services/CloudStorage.js?v=8';
import { formatPlayTime } from '../core/ScoreSystem.js?v=8';

export class LeaderboardView {
  constructor(width = 320, height = 180) {
    this.width = width;
    this.height = height;
    this.isOpen = false;
    this.loading = false;
    this.source = 'cloud'; // 'cloud' | 'local' | 'offline_local' | 'local_fallback'
    this.errorMsg = null;
    this.entries = [];
    this.scrollOffset = 0;
    this.visibleRows = 6;
    this.highlightUsername = null;
    this.animTimer = 0;
  }

  /**
   * Abre el modal y lanza la consulta asíncrona no bloqueante del Top 10
   */
  open(options = {}) {
    this.isOpen = true;
    this.scrollOffset = 0;
    this.highlightUsername = options.highlightUsername
      ? String(options.highlightUsername).trim().toUpperCase()
      : null;

    if (Array.isArray(options.entries) && options.entries.length > 0) {
      this.entries = this._normalizeEntries(options.entries);
      this.source = options.source || 'cloud';
      this.loading = false;
      this.errorMsg = options.errorMsg || null;
      return;
    }

    this.refresh();
  }

  close() {
    this.isOpen = false;
  }

  toggle(options = {}) {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(options);
    }
    return this.isOpen;
  }

  /**
   * Consulta el Top 10 desde CloudStorage (Vercel KV con fallback local automático)
   */
  async refresh() {
    this.loading = true;
    this.errorMsg = null;
    try {
      const res = await CloudStorage.fetchTopLeaderboard(10);
      this.entries = this._normalizeEntries(res.leaderboard || []);
      this.source = res.source || 'local';
      this.loading = false;
      if (!res.ok) {
        this.errorMsg = 'Sin conexión a Vercel KV · Mostrando caché local';
      }
    } catch (err) {
      this.loading = false;
      this.source = 'offline_local';
      this.errorMsg = err?.message || 'Modo sin conexión · Tabla local';
    }
  }

  _normalizeEntries(raw = []) {
    return raw.slice(0, 10).map((item, idx) => {
      const secs = Math.max(0, Math.floor(Number(item?.playTimeSeconds) || 0));
      return {
        position: idx + 1,
        username: String(item?.username || 'HERO').slice(0, 12).toUpperCase(),
        playTimeSeconds: secs,
        playTimeFormatted: item?.playTimeFormatted || formatPlayTime(secs),
        deaths: Math.max(0, Math.floor(Number(item?.deaths) || 0)),
        bytes: Math.max(0, Math.floor(Number(item?.bytes ?? item?.coins) || 0)),
        score: Math.max(0, Math.floor(Number(item?.score) || 0)),
        rank: String(item?.rank || 'C').toUpperCase()
      };
    });
  }

  /**
   * Procesa navegación por teclado dentro del modal (Arriba/Abajo, R para refrescar, Esc para cerrar)
   */
  handleInput(input) {
    if (!this.isOpen || !input) return false;

    const maxScroll = Math.max(0, this.entries.length - this.visibleRows);
    if (input.isJustPressed('ArrowUp') || input.isJustPressed('KeyW')) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1);
      return true;
    }
    if (input.isJustPressed('ArrowDown') || input.isJustPressed('KeyS')) {
      this.scrollOffset = Math.min(maxScroll, this.scrollOffset + 1);
      return true;
    }
    if (input.isJustPressed('Escape')) {
      this.close();
      return true;
    }
    return false;
  }

  scrollUp() {
    this.scrollOffset = Math.max(0, this.scrollOffset - 1);
  }

  scrollDown() {
    const maxScroll = Math.max(0, this.entries.length - this.visibleRows);
    this.scrollOffset = Math.min(maxScroll, this.scrollOffset + 1);
  }

  update(dt = 0.016) {
    if (!this.isOpen) return;
    this.animTimer += dt;
  }

  /**
   * Renderiza el contenedor unificado de 290×150 px del Salón de la Fama
   */
  render(ctx, options = {}) {
    if (!this.isOpen && !options.forceRender) return;

    this.animTimer += 0.016;

    const sourceBadge = this.loading
      ? '☁️ SINCRONIZANDO...'
      : (this.source === 'cloud' ? '☁️ VERCEL KV ONLINE' : '💾 FALLBACK LOCAL');

    const frame = UILayout.drawModalFrame(ctx, {
      title: 'SALÓN DE LA FAMA · TOP 10',
      icon: '🏆',
      badge: sourceBadge,
      closeLabel: options.closeLabel || '[Esc] Cerrar',
      backdropAlpha: options.backdropAlpha ?? 0.6
    });

    const { content } = frame;

    ctx.save();
    ctx.textBaseline = 'top';

    // Sub-barra de estado / conexión (12 px de alto)
    const statusRect = {
      x: content.x,
      y: content.y,
      w: content.w,
      h: 13
    };
    UILayout.drawPanel(ctx, statusRect, {
      bg: 'rgba(20, 27, 38, 0.92)',
      border: UI_COLORS.borderInner
    });

    ctx.font = `4px ${UI_FONT}`;
    if (this.loading) {
      ctx.fillStyle = UI_COLORS.cyan;
      const dots = '.'.repeat(1 + (Math.floor(this.animTimer * 4) % 3));
      ctx.fillText(`Consultando récords globales en Vercel KV${dots}`, statusRect.x + 5, statusRect.y + 4);
    } else if (this.errorMsg || this.source !== 'cloud') {
      ctx.fillStyle = UI_COLORS.gold;
      const msg = this.errorMsg || 'Modo local activo: puntuaciones guardadas en caché local';
      ctx.fillText(UILayout.fitText(ctx, `⚠ ${msg}`, statusRect.w - 10), statusRect.x + 5, statusRect.y + 4);
    } else {
      ctx.fillStyle = UI_COLORS.emerald;
      ctx.fillText('✓ Conectado a Vercel KV Redis · Top 10 Speedrun & Compilación', statusRect.x + 5, statusRect.y + 4);
    }

    // Tabla principal
    const tableRect = {
      x: content.x,
      y: statusRect.y + statusRect.h + 3,
      w: content.w,
      h: content.h - statusRect.h - 3
    };

    UILayout.drawPanel(ctx, tableRect, {
      bg: UI_COLORS.panelBg,
      border: UI_COLORS.borderInner
    });

    // Cabecera de columnas
    const headerY = tableRect.y + 3;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.fillRect(tableRect.x + 1, tableRect.y + 1, tableRect.w - 2, 12);

    const colPos = tableRect.x + 5;
    const colTag = tableRect.x + 28;
    const colTime = tableRect.x + 114;
    const colBytes = tableRect.x + 158;
    const colRank = tableRect.x + 198;
    const colScore = tableRect.x + 228;

    ctx.font = `bold 4px ${UI_FONT}`;
    ctx.fillStyle = UI_COLORS.gold;
    ctx.fillText('POS', colPos, headerY + 2);
    ctx.fillText('JUGADOR (TAG)', colTag, headerY + 2);
    ctx.fillText('TIEMPO', colTime, headerY + 2);
    ctx.fillText('BYTES', colBytes, headerY + 2);
    ctx.fillText('RANGO', colRank, headerY + 2);
    ctx.fillText('SCORE', colScore, headerY + 2);

    // Estado 1: Cargando datos
    if (this.loading && this.entries.length === 0) {
      const centerY = tableRect.y + Math.floor(tableRect.h / 2) - 4;
      ctx.font = `bold 5px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.cyan;
      ctx.textAlign = 'center';
      ctx.fillText('CARGANDO TOP 10 GLOBAL...', tableRect.x + Math.floor(tableRect.w / 2), centerY);
      ctx.textAlign = 'left';
      ctx.restore();
      return;
    }

    // Estado 2: Sin datos
    if (this.entries.length === 0) {
      const centerY = tableRect.y + Math.floor(tableRect.h / 2) - 4;
      ctx.font = `4.5px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText('No hay registros disponibles todavía.', tableRect.x + Math.floor(tableRect.w / 2), centerY);
      ctx.textAlign = 'left';
      ctx.restore();
      return;
    }

    // Estado 3: Renderizado de filas del Top 10
    const rowsStartY = tableRect.y + 15;
    const rowH = 14;
    const slice = this.entries.slice(this.scrollOffset, this.scrollOffset + this.visibleRows);

    slice.forEach((entry, idx) => {
      const rankNum = this.scrollOffset + idx + 1;
      const ry = rowsStartY + idx * rowH;

      const isHighlighted = this.highlightUsername && entry.username === this.highlightUsername;

      // Fondo de fila alterno o resaltado
      if (isHighlighted) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.fillRect(tableRect.x + 2, ry, tableRect.w - 8, rowH - 1);
      } else if (rankNum === 1) {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.12)';
        ctx.fillRect(tableRect.x + 2, ry, tableRect.w - 8, rowH - 1);
      } else if (idx % 2 === 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(tableRect.x + 2, ry, tableRect.w - 8, rowH - 1);
      }

      // Color de posición (#1 Oro, #2 Plata, #3 Bronce)
      let posColor = UI_COLORS.textSecondary;
      if (rankNum === 1) posColor = '#fde047';
      else if (rankNum === 2) posColor = '#e2e8f0';
      else if (rankNum === 3) posColor = '#fb923c';

      ctx.font = `bold 4.5px ${UI_FONT}`;
      ctx.fillStyle = posColor;
      ctx.fillText(`#${rankNum}`, colPos, ry + 4);

      // Tag del jugador
      ctx.fillStyle = isHighlighted ? UI_COLORS.cyan : (rankNum <= 3 ? UI_COLORS.textPrimary : UI_COLORS.textSecondary);
      ctx.fillText(UILayout.fitText(ctx, entry.username, 80), colTag, ry + 4);

      // Tiempo de Run (mm:ss)
      ctx.font = `4.5px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.cyan;
      const timeStr = entry.playTimeFormatted || formatPlayTime(entry.playTimeSeconds);
      ctx.fillText(timeStr, colTime, ry + 4);

      // Bytes recolectados
      ctx.fillStyle = UI_COLORS.gold;
      const bytesVal = entry.bytes ?? 0;
      ctx.fillText(`${bytesVal}B`, colBytes, ry + 4);

      // Insignia de Rango (S, A, B, C)
      const rankColor = this._getRankColor(entry.rank);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(colRank, ry + 2, 16, 9);
      ctx.strokeStyle = rankColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(colRank + 0.5, ry + 2.5, 15, 8);
      ctx.font = `bold 4.5px ${UI_FONT}`;
      ctx.fillStyle = rankColor;
      ctx.fillText(entry.rank, colRank + 5, ry + 4);

      // Score numérico
      ctx.font = `bold 4.5px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.emerald;
      ctx.fillText(String(entry.score), colScore, ry + 4);
    });

    // Barra de scroll vertical discreta a la derecha si hay más de 6 filas
    UILayout.drawScrollbar(
      ctx,
      tableRect.x + tableRect.w - 5,
      rowsStartY,
      this.visibleRows * rowH - 2,
      this.entries.length,
      this.visibleRows,
      this.scrollOffset
    );

    ctx.restore();
  }

  _getRankColor(rank) {
    switch (String(rank).toUpperCase()) {
      case 'S': return '#fde047';
      case 'A': return '#38bdf8';
      case 'B': return '#4ade80';
      default:  return '#f87171';
    }
  }
}

