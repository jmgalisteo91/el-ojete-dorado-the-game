/**
 * UILayout.js · Gestor de Layout Seguro de la interfaz (320×180 lógicos)
 *
 * Centraliza TODAS las coordenadas y utilidades de dibujo compartidas por los modales
 * ([I] Inventario, [C] Ficha, [L] Diario, [M] Mapa, Ranking) y el HUD, de modo que ningún
 * panel pueda desbordar el área segura ni solaparse con otro:
 *
 *  - Área segura:      SAFE_WIDTH × SAFE_HEIGHT (308×168) centrada en pantalla → margen de 6 px.
 *  - Contenedor modal: MODAL_WIDTH × MODAL_HEIGHT (290×150) con fondo glassmorphism,
 *                      bisel de 1 px y cabecera limpia con el atajo «[Esc] Cerrar».
 *  - Texto:            wrapText estricto (nunca corta palabras salvo que una palabra sola
 *                      supere el ancho) y paginación en diapositivas.
 */

export const GAME_VERSION = 'v3.8.2';

export const LOGICAL_WIDTH = 320;
export const LOGICAL_HEIGHT = 180;
export const SAFE_WIDTH = 308;
export const SAFE_HEIGHT = 168;
export const MODAL_WIDTH = 290;
export const MODAL_HEIGHT = 150;
export const MODAL_HEADER_HEIGHT = 15;

export const UI_COLORS = {
  glass: 'rgba(15, 23, 42, 0.92)',
  glassSoft: 'rgba(22, 28, 40, 0.92)',
  veil: 'rgba(3, 5, 10, 0.55)',
  bevelLight: 'rgba(255, 255, 255, 0.16)',
  bevelDark: 'rgba(0, 0, 0, 0.55)',
  border: '#3b4a6b',
  borderInner: '#2b3652',
  borderOuter: 'rgba(229, 192, 123, 0.65)',
  panelBg: 'rgba(11, 16, 28, 0.92)',
  panelBgAlt: 'rgba(15, 22, 38, 0.92)',
  slotBg: '#0b1220',
  slotBorder: '#2b3652',
  slotSelectedBg: 'rgba(30, 41, 59, 0.95)',
  slotSelectedBorder: '#ffd885',
  accent: '#e5c07b',
  accentBright: '#ffd885',
  gold: '#fde047',
  goldDim: 'rgba(253, 224, 71, 0.45)',
  cyan: '#38bdf8',
  emerald: '#4ade80',
  crimson: '#f87171',
  purple: '#c084fc',
  title: '#ffd885',
  text: '#e2e8f0',
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textDim: '#94a3b8',
  textMuted: '#64748b',
  good: '#4ade80',
  warn: '#fbbf24',
  bad: '#f87171',
  info: '#38bdf8',
  slot: '#0b1220'
};

export const UI_FONT = 'monospace';

// (DIRECTRIZ UI) Curvas de easing compartidas: nunca movimientos lineales en UI.
export const UI_EASE = {
  outCubic: (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3),
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const x = Math.max(0, Math.min(1, t)) - 1;
    return 1 + c3 * x * x * x + c1 * x * x;
  }
};

/**
 * (FIX M1.5) El HUD móvil necesita tipografía más grande: 320×180 lógicos es muy
 * pequeño para leerlo en un teléfono.
 */
export const TOUCH_HUD_SCALE = 1.35;

/**
 * Fuente del HUD con escala táctil.
 * @param {number} base Tamaño lógico original en px.
 * @param {boolean} isTouch Si el dispositivo es táctil.
 * @param {boolean} [bold=false]
 * @returns {string} Cadena `ctx.font` lista para usar.
 */
export function hudFontSize(base, isTouch, bold = false) {
  const scale = isTouch ? TOUCH_HUD_SCALE : 1;
  const size = Math.round(base * scale * 10) / 10;
  return `${bold ? 'bold ' : ''}${size}px ${UI_FONT}`;
}

export class UILayout {
  /** Rectángulo seguro centrado: ningún elemento de UI debe salir de aquí. */
  static safeRect() {
    return {
      x: Math.round((LOGICAL_WIDTH - SAFE_WIDTH) / 2),
      y: Math.round((LOGICAL_HEIGHT - SAFE_HEIGHT) / 2),
      w: SAFE_WIDTH,
      h: SAFE_HEIGHT
    };
  }

  /** Rectángulo exterior del contenedor unificado de modales (290×150, centrado). */
  static modalRect() {
    return {
      x: Math.round((LOGICAL_WIDTH - MODAL_WIDTH) / 2),
      y: Math.round((LOGICAL_HEIGHT - MODAL_HEIGHT) / 2),
      w: MODAL_WIDTH,
      h: MODAL_HEIGHT
    };
  }

  /** Área útil del modal bajo la cabecera, con padding interior de 6 px. */
  static contentRect() {
    const m = UILayout.modalRect();
    return {
      x: m.x + 6,
      y: m.y + MODAL_HEADER_HEIGHT + 3,
      w: m.w - 12,
      h: m.h - MODAL_HEADER_HEIGHT - 9
    };
  }

  /** Desplaza un rectángulo para que quede completamente dentro del área segura. */
  static clampToSafe(x, y, w, h) {
    const s = UILayout.safeRect();
    return {
      x: Math.max(s.x, Math.min(x, s.x + s.w - w)),
      y: Math.max(s.y, Math.min(y, s.y + s.h - h)),
      w,
      h
    };
  }

  /** Recorta un texto con puntos suspensivos para que quepa en maxWidth (usa ctx.font actual). */
  static fitText(ctx, text, maxWidth) {
    const str = String(text ?? '');
    if (ctx.measureText(str).width <= maxWidth) return str;
    let lo = 0;
    let hi = str.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ctx.measureText(`${str.slice(0, mid)}…`).width <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return lo > 0 ? `${str.slice(0, lo)}…` : '…';
  }

  /**
   * wrapText estricto: divide por palabras respetando saltos de línea explícitos;
   * si una palabra individual excede el ancho se parte por caracteres (nunca desborda).
   * @param {CanvasRenderingContext2D} ctx   (la fuente debe estar ya fijada)
   * @param {string} text
   * @param {number} maxWidth
   * @param {number} [maxLines=Infinity]  si se supera, la última línea se corta con «…»
   * @returns {string[]}
   */
  static wrapText(ctx, text, maxWidth, maxLines = Infinity) {
    const lines = [];
    const paragraphs = String(text ?? '').split('\n');

    for (const paragraph of paragraphs) {
      const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
      if (words.length === 0) {
        lines.push('');
        continue;
      }
      let current = '';
      for (const word of words) {
        let piece = word;
        while (ctx.measureText(piece).width > maxWidth && piece.length > 1) {
          // Palabra demasiado larga: partir por caracteres
          let cut = piece.length - 1;
          while (cut > 1 && ctx.measureText(piece.slice(0, cut)).width > maxWidth) cut--;
          if (current) {
            lines.push(current);
            current = '';
          }
          lines.push(piece.slice(0, cut));
          piece = piece.slice(cut);
        }
        const candidate = current ? `${current} ${piece}` : piece;
        if (ctx.measureText(candidate).width <= maxWidth) {
          current = candidate;
        } else {
          if (current) lines.push(current);
          current = piece;
        }
      }
      if (current) lines.push(current);
    }

    if (lines.length > maxLines) {
      const kept = lines.slice(0, maxLines);
      kept[maxLines - 1] = UILayout.fitText(ctx, `${kept[maxLines - 1]} …`, maxWidth);
      return kept;
    }
    return lines;
  }

  /** (BLOQUE 4.A) Escala de pop 0.9 → 1.0 en 200 ms con ease-out. */
  static popScale(openAtMs, nowMs = performance.now(), from = 0.9) {
    const t = Math.min(1, Math.max(0, (nowMs - openAtMs) / 200));
    return from + (1 - from) * (1 - Math.pow(1 - t, 3));
  }

  /** (DIRECTRIZ UI) Drop shadow paralela en dos capas, sin blur. */
  static drawShadow(ctx, x, y, w, h, alpha = 0.32) {
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.5, alpha * 0.6)})`;
    ctx.fillRect(x + 3, y + 4, w, h);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(x + 1, y + 2, w, h);
  }

  /** (DIRECTRIZ UI) Texto pixel con sombra fuerte y contorno opcional. */
  static drawText(ctx, text, x, y, opts = {}) {
    const {
      font = `bold 6px ${UI_FONT}`,
      color = UI_COLORS.textPrimary,
      align = 'left',
      baseline = 'middle',
      shadow = true,
      outline = false,
      maxWidth = undefined
    } = opts;
    ctx.save();
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (outline) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.lineWidth = 2;
      if (maxWidth !== undefined) ctx.strokeText(text, x, y, maxWidth);
      else ctx.strokeText(text, x, y);
    }
    if (shadow) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      if (maxWidth !== undefined) ctx.fillText(text, x + 1, y + 1, maxWidth);
      else ctx.fillText(text, x + 1, y + 1);
    }
    ctx.fillStyle = color;
    if (maxWidth !== undefined) ctx.fillText(text, x, y, maxWidth);
    else ctx.fillText(text, x, y);
    ctx.restore();
  }

  /**
   * (DIRECTRIZ UI) Iconos procedurales de 12×12, dibujados con píxeles.
   * Evita depender de emojis y mantiene el look pixel art.
   */
  static drawIcon(ctx, key, cx, cy, size = 10, color = UI_COLORS.gold) {
    const s = size / 12;
    const u = (v) => Math.round(v * s);
    const px = (dx, dy, w, h, c = color) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(cx + dx * s), Math.round(cy + dy * s), Math.max(1, u(w)), Math.max(1, u(h)));
    };
    ctx.save();
    switch (key) {
      case 'sword':
        px(-1, -5, 2, 7);
        px(-3, 2, 6, 1);
        px(-1, 3, 2, 2);
        break;
      case 'shield':
        px(-4, -4, 8, 1);
        px(-4, -3, 8, 4);
        px(-3, 1, 6, 1);
        px(-2, 2, 4, 1);
        px(-1, 3, 2, 1);
        break;
      case 'coin':
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2, 4.5 * s), 0, Math.PI * 2);
        ctx.fill();
        px(-1, -2, 2, 4, '#151006');
        px(-2, -1, 4, 1, '#151006');
        break;
      case 'heart':
        px(-3, -3, 2, 2);
        px(1, -3, 2, 2);
        px(-4, -2, 8, 3);
        px(-3, 1, 6, 2);
        px(-2, 3, 4, 1);
        break;
      case 'star':
        px(-1, -5, 2, 10);
        px(-5, -1, 10, 2);
        px(-3, -3, 2, 2);
        px(1, -3, 2, 2);
        px(-3, 2, 2, 2);
        px(1, 2, 2, 2);
        break;
      case 'gear':
        px(-4, -2, 8, 4);
        px(-2, -4, 4, 8);
        px(-3, -3, 6, 6, 'rgba(0,0,0,0)');
        px(-1, -1, 2, 2, '#151006');
        break;
      case 'bag':
        px(-3, -3, 6, 1);
        px(-2, -4, 4, 1);
        px(-2, 2, 5, 3);
        px(-1, -2, 3, 2);
        break;
      case 'scroll':
        px(-4, -4, 8, 8);
        px(-3, -3, 6, 1, '#151006');
        px(-3, -1, 6, 1, '#151006');
        px(-3, 1, 4, 1, '#151006');
        break;
      case 'map':
        px(-4, -3, 3, 7);
        px(-1, -4, 3, 8);
        px(2, -3, 3, 7);
        break;
      case 'trophy':
        px(-3, -4, 6, 4);
        px(-2, 0, 4, 1);
        px(-1, 1, 2, 3);
        px(-3, 4, 6, 1);
        break;
      case 'lock':
        px(-2, -4, 4, 1);
        px(-3, -3, 6, 1);
        px(-3, -1, 6, 4);
        px(-1, 0, 2, 2, '#151006');
        break;
      case 'play':
        px(-2, -4, 2, 8);
        px(0, -3, 2, 6);
        px(2, -2, 2, 4);
        px(4, -1, 1, 2);
        break;
      case 'close':
        px(-3, -3, 2, 2);
        px(1, -3, 2, 2);
        px(-1, -1, 2, 2);
        px(-3, 1, 2, 2);
        px(1, 1, 2, 2);
        break;
      case 'back':
        px(-4, -1, 2, 2);
        px(-2, -3, 2, 2);
        px(-2, 1, 2, 2);
        px(0, -1, 4, 2);
        break;
      case 'sound':
        px(-4, -1, 2, 3);
        px(-2, -3, 2, 7);
        px(1, -3, 1, 2);
        px(2, -1, 1, 4);
        px(3, -3, 1, 6);
        break;
      case 'music':
        px(-1, -4, 6, 1);
        px(-1, -4, 1, 4);
        px(4, -4, 1, 5);
        px(-2, 1, 2, 2);
        px(3, 1, 2, 2);
        break;
      case 'gamepad':
        px(-4, -2, 8, 5);
        px(-3, 0, 1, 1, '#151006');
        px(-5, 0, 1, 1, '#151006');
        px(2, -1, 1, 1, '#151006');
        break;
      case 'save':
        px(-3, -4, 6, 8);
        px(-2, -3, 4, 2, '#151006');
        px(-2, 1, 4, 2, '#151006');
        break;
      case 'folder':
        px(-4, -3, 3, 1);
        px(-4, -2, 8, 5);
        px(-3, -1, 6, 1, '#151006');
        break;
      case 'scroll-open':
      case 'quest':
        px(-4, -3, 8, 7);
        px(-3, -2, 6, 1, '#151006');
        px(-3, 0, 6, 1, '#151006');
        px(-3, 2, 4, 1, '#151006');
        break;
      case 'valley':
      case 'house':
        px(-4, 0, 8, 5);
        px(-5, 0, 10, 1);
        px(-3, -4, 6, 4);
        px(-1, 2, 2, 3, '#151006');
        px(3, 1, 1, 1, '#fff3b0');
        break;
      case 'tree':
        px(-1, 1, 2, 4);
        px(-4, -2, 8, 3);
        px(-3, -4, 6, 2);
        px(-2, -5, 4, 1, '#86efac');
        break;
      case 'mountain':
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy + 4);
        ctx.lineTo(cx - 1, cy - 4);
        ctx.lineTo(cx + 3, cy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx, cy + 4);
        ctx.lineTo(cx + 3, cy - 1);
        ctx.lineTo(cx + 6, cy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(cx - 1, cy - 4);
        ctx.lineTo(cx - 2.4, cy - 1);
        ctx.lineTo(cx + 0.4, cy - 1);
        ctx.closePath();
        ctx.fill();
        break;
      case 'pick':
        px(-4, 3, 1, 1);
        px(-3, 2, 1, 1);
        px(-2, 1, 1, 1);
        px(-1, 0, 1, 1);
        px(0, -1, 1, 1);
        px(1, -2, 1, 1);
        px(-1, -3, 5, 1);
        px(3, -2, 2, 1);
        px(-3, 0, 1, 2);
        break;
      case 'pipe':
        px(-4, -3, 3, 8);
        px(-4, -4, 8, 2);
        px(1, -2, 2, 2);
        px(-2, 0, 1, 1, '#151006');
        break;
      case 'skull':
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy - 1, Math.max(2, 4 * s), 0, Math.PI * 2);
        ctx.fill();
        px(-2, -2, 1, 2, '#151006');
        px(1, -2, 1, 2, '#151006');
        px(-1, 1, 2, 3);
        px(-2, 4, 4, 1);
        break;
      case 'castle':
        px(-5, 0, 10, 5);
        px(-5, -3, 2, 3);
        px(-1, -3, 2, 3);
        px(3, -3, 2, 3);
        px(-1, 2, 2, 3, '#151006');
        break;
      case 'eye':
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(3, 5 * s), Math.max(2, 3 * s), 0, 0, Math.PI * 2);
        ctx.fill();
        px(-1, -1, 2, 2, '#151006');
        break;
      case 'temple':
        px(-5, 4, 10, 1);
        px(-4, 0, 2, 4);
        px(-1, 0, 2, 4);
        px(2, 0, 2, 4);
        px(-5, -2, 10, 2);
        px(-3, -4, 6, 2);
        break;
      case 'compass':
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(3, 4.5 * s), 0, Math.PI * 2);
        ctx.stroke();
        px(-1, -3, 2, 3);
        px(-1, 0, 2, 3, '#151006');
        break;
      case 'spark':
      case 'star4':
        px(-1, -4, 2, 3);
        px(-1, 2, 2, 3);
        px(-4, -1, 3, 2);
        px(2, -1, 3, 2);
        px(-1, -1, 2, 2, '#fff3b0');
        break;
      default:
        px(-2, -2, 4, 4);
        break;
    }
    ctx.restore();
  }

  /** Divide una lista de líneas en páginas de `linesPerPage` líneas. */
  static paginate(lines, linesPerPage) {
    const pages = [];
    const size = Math.max(1, linesPerPage | 0);
    for (let i = 0; i < lines.length; i += size) {
      pages.push(lines.slice(i, i + size));
    }
    return pages.length > 0 ? pages : [[]];
  }

  /**
   * Dibuja el velo oscuro + contenedor unificado de modal (290×150) con cabecera.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{title?:string, subtitle?:string, icon?:string, badge?:string, closeLabel?:string|null, tabs?:Array<{label:string,active:boolean}>, veil?:boolean, backdropAlpha?:number}} [opts]
   * @returns {{modal:{x:number,y:number,w:number,h:number}, content:{x:number,y:number,w:number,h:number}, x:number, y:number, w:number, h:number}}
   */
  static drawModalFrame(ctx, opts = {}) {
    const {
      title = '',
      subtitle = '',
      icon = '',
      badge = '',
      closeLabel = '[Esc] Cerrar',
      tabs = null,
      veil = true,
      backdropAlpha = 0.55
    } = opts;
    const m = UILayout.modalRect();

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (veil) {
      ctx.fillStyle = `rgba(3, 5, 10, ${backdropAlpha})`;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }

    // (BLOQUE 4.A) Sombra de elevación en dos capas (sin blur costoso).
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(m.x + 4, m.y + 6, m.w, m.h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(m.x + 2, m.y + 3, m.w, m.h);

    // Cristal oscuro translúcido
    ctx.fillStyle = UI_COLORS.glass;
    ctx.fillRect(m.x, m.y, m.w, m.h);

    // Brillo superior sutil (glassmorphism)
    if (typeof ctx.createLinearGradient === 'function') {
      const sheen = ctx.createLinearGradient(0, m.y, 0, m.y + m.h * 0.45);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.07)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(m.x, m.y, m.w, m.h * 0.45);
    }

    // (BLOQUE 4.A) Borde dorado de 2 px + brillo interior sutil.
    ctx.strokeStyle = UI_COLORS.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(m.x + 1, m.y + 1, m.w - 2, m.h - 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(m.x + 3.5, m.y + 3.5, m.w - 7, m.h - 7);
    ctx.fillStyle = UI_COLORS.bevelLight;
    ctx.fillRect(m.x + 1, m.y + 1, m.w - 2, 1);
    ctx.fillRect(m.x + 1, m.y + 1, 1, m.h - 2);
    ctx.fillStyle = UI_COLORS.bevelDark;
    ctx.fillRect(m.x + 1, m.y + m.h - 2, m.w - 2, 1);
    ctx.fillRect(m.x + m.w - 2, m.y + 1, 1, m.h - 2);

    // Cabecera limpia
    ctx.textBaseline = 'middle';
    const headY = m.y + MODAL_HEADER_HEIGHT / 2 + 1;
    let cursorX = m.x + 7;

    const fullTitle = icon ? `${icon} ${title}` : title;
    if (fullTitle) {
      ctx.font = `bold 7px ${UI_FONT}`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.textAlign = 'left';
      ctx.fillText(fullTitle, cursorX + 1, headY + 1);
      ctx.fillStyle = UI_COLORS.title;
      ctx.fillText(fullTitle, cursorX, headY);
      cursorX += Math.ceil(ctx.measureText(fullTitle).width) + 6;
    }

    if (badge) {
      ctx.font = `bold 4px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.accentBright;
      ctx.textAlign = 'left';
      ctx.fillText(`[${badge}]`, cursorX, headY);
      cursorX += Math.ceil(ctx.measureText(`[${badge}]`).width) + 6;
    }

    if (tabs && tabs.length > 0) {
      ctx.font = `bold 5.5px ${UI_FONT}`;
      for (const tab of tabs) {
        const label = tab.label;
        const tw = Math.ceil(ctx.measureText(label).width) + 8;
        ctx.fillStyle = tab.active ? 'rgba(229, 192, 123, 0.18)' : 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(cursorX, m.y + 3, tw, MODAL_HEADER_HEIGHT - 5);
        ctx.fillStyle = tab.active ? UI_COLORS.accentBright : UI_COLORS.textMuted;
        ctx.textAlign = 'center';
        ctx.fillText(label, cursorX + tw / 2, headY);
        if (tab.active) {
          ctx.fillStyle = UI_COLORS.accent;
          ctx.fillRect(cursorX, m.y + MODAL_HEADER_HEIGHT - 3, tw, 1);
        }
        cursorX += tw + 2;
      }
    } else if (subtitle) {
      ctx.font = `5.5px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.textAlign = 'left';
      ctx.fillText(subtitle, cursorX, headY);
    }

    if (closeLabel) {
      ctx.font = `5.5px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.textDim;
      ctx.textAlign = 'right';
      ctx.fillText(closeLabel, m.x + m.w - 7, headY);
    }

    // Separador de cabecera
    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.fillRect(m.x + 4, m.y + MODAL_HEADER_HEIGHT, m.w - 8, 1);

    ctx.restore();

    const content = UILayout.contentRect();
    return {
      modal: m,
      content,
      x: content.x,
      y: content.y,
      w: content.w,
      h: content.h
    };
  }

  /** Panel interior con fondo y borde fino. Soporta tanto (ctx, rect, opts) como (ctx, x, y, w, h, opts). */
  static drawPanel(ctx, xOrRect, yOrOpts, w, h, opts = {}) {
    let px, py, pw, ph, popts;
    if (typeof xOrRect === 'object' && xOrRect !== null) {
      px = xOrRect.x;
      py = xOrRect.y;
      pw = xOrRect.w ?? xOrRect.width;
      ph = xOrRect.h ?? xOrRect.height;
      popts = yOrOpts || {};
    } else {
      px = xOrRect;
      py = yOrOpts;
      pw = w;
      ph = h;
      popts = opts || {};
    }
    const bg = popts.bg || popts.fill || UI_COLORS.slotBg || UI_COLORS.slot;
    const border = popts.border || UI_COLORS.slotBorder;
    ctx.save();
    // (DIRECTRIZ UI) Sombra paralela para que cada tarjeta flote.
    if (!popts.noShadow) UILayout.drawShadow(ctx, px, py, pw, ph, 0.26);
    ctx.fillStyle = bg;
    ctx.fillRect(px, py, pw, ph);
    // (BLOQUE 4) Brillo superior de tarjeta.
    if (typeof ctx.createLinearGradient === 'function') {
      const sheen = ctx.createLinearGradient(0, py, 0, py + Math.min(18, ph));
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.055)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(px + 1, py + 1, pw - 2, Math.min(18, ph - 2));
    }
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    }
    if (popts.headerText) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(px + 1, py + 1, pw - 2, 11);
      ctx.font = `bold 4.2px ${UI_FONT}`;
      ctx.fillStyle = UI_COLORS.accent;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(popts.headerText, px + 4, py + 6.5);
    }
    ctx.restore();
  }

  /** Barra de progreso compacta. Soporta tanto (ctx, rectOrOpts) como (ctx, x, y, w, h, pct, color, opts). */
  static drawBar(ctx, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
    let bx, by, bw, bh, pct, color, label, valueText, back, border;
    if (typeof arg1 === 'object' && arg1 !== null) {
      bx = arg1.x;
      by = arg1.y;
      bw = arg1.w ?? arg1.width;
      bh = arg1.h ?? arg1.height;
      const val = arg1.value ?? arg1.val ?? 0;
      const max = arg1.max ?? 1;
      pct = max > 0 ? val / max : 0;
      color = arg1.color || UI_COLORS.good;
      label = arg1.label || null;
      valueText = arg1.valueText || null;
      back = arg1.back || '#111827';
      border = arg1.border || '#334155';
      var gradient = arg1.gradient || null;
      var insideText = arg1.insideText || null;
    } else {
      bx = arg1;
      by = arg2;
      bw = arg3;
      bh = arg4;
      pct = arg5;
      color = arg6;
      const o = arg7 || {};
      back = o.back || '#111827';
      border = o.border || '#334155';
      label = o.label || null;
      valueText = o.valueText || null;
      var gradient = o.gradient || null;
      var insideText = o.insideText || null;
    }

    const p = Math.max(0, Math.min(1, Number.isFinite(pct) ? pct : 0));
    ctx.save();

    if (label || valueText) {
      ctx.font = `bold 4px ${UI_FONT}`;
      ctx.textBaseline = 'bottom';
      if (label) {
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'left';
        ctx.fillText(label, bx, by - 1.5);
      }
      if (valueText) {
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.fillText(valueText, bx + bw, by - 1.5);
      }
    }

    ctx.fillStyle = back;
    ctx.fillRect(bx, by, bw, bh);
    const fillW = Math.round((bw - 2) * p);
    if (fillW > 0) {
      // (BLOQUE 4.D) Relleno con gradiente opcional (salud, stamina, XP…).
      if (Array.isArray(gradient) && gradient.length >= 2 && typeof ctx.createLinearGradient === 'function') {
        const g = ctx.createLinearGradient(bx + 1, by, bx + 1 + fillW, by);
        g.addColorStop(0, gradient[0]);
        g.addColorStop(1, gradient[1]);
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = color;
      }
      ctx.fillRect(bx + 1, by + 1, fillW, bh - 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(bx + 1, by + 1, fillW, 1);
    }
    if (insideText) {
      ctx.font = `bold 3.7px ${UI_FONT}`;
      const tw = ctx.measureText(insideText).width;
      // Pastilla clara para que el nivel se lea incluso con la barra vacía.
      ctx.fillStyle = 'rgba(255, 243, 176, 0.9)';
      ctx.fillRect(bx + bw / 2 - tw / 2 - 1, by + 1, tw + 2, bh - 2);
      ctx.fillStyle = '#151006';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(insideText, bx + bw / 2, by + bh / 2 + 0.4);
    }
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.restore();
  }

  /** Dibuja un icono del atlas de objetos (una sola fila; el factor de escala se deduce del alto). */
  static drawItemIcon(ctx, sheet, iconIndex, x, y, size = 16) {
    if (!sheet || typeof iconIndex !== 'number') return;
    const frame = (sheet.height || 16) >= 16 ? sheet.height : 16;
    ctx.drawImage(sheet, iconIndex * frame, 0, frame, frame, x, y, size, size);
  }

  /** Indicador discreto de scroll/paginación («‹ 1/2 ›»). */
  static drawPager(ctx, rightX, y, page, pages) {
    if (pages <= 1) return;
    ctx.save();
    ctx.font = `5.5px ${UI_FONT}`;
    ctx.fillStyle = UI_COLORS.textDim;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`‹ ${page + 1}/${pages} ›`, rightX, y);
    ctx.restore();
  }

  /** Barra de scroll vertical discreta (2 px) para listas. */
  static drawScrollbar(ctx, x, y, h, firstVisible, visibleCount, total) {
    if (total <= visibleCount) return;
    const trackH = h;
    const thumbH = Math.max(6, Math.round((visibleCount / total) * trackH));
    const maxFirst = total - visibleCount;
    const thumbY = y + Math.round((firstVisible / maxFirst) * (trackH - thumbH));
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x, y, 2, trackH);
    ctx.fillStyle = UI_COLORS.accent;
    ctx.fillRect(x, thumbY, 2, thumbH);
    ctx.restore();
  }

  /**
   * Indica si el contador de Currículums debe mostrarse en el HUD actual.
   * Solo visible dentro del Vertedero Digital o en la tienda de Rosa.
   */
  static shouldShowCurriculumHud(sceneId, isRosaShopOpen = false) {
    if (isRosaShopOpen) return true;
    if (typeof sceneId !== 'string' || !sceneId) return false;
    return (
      sceneId.startsWith('vertedero_') ||
      sceneId === 'tienda_rosa' ||
      sceneId === 'rosa_shop' ||
      sceneId === 'rosa_bar'
    );
  }

  /**
   * Dibuja el HUD de Currículums (`📄 <cantidad>`) en la esquina superior derecha.
   * Parpadea en verde cuando `flashTimer > 0`.
   */
  static drawCurriculumHud(
    ctx,
    {
      curriculum = 0,
      sceneId = '',
      isRosaShopOpen = false,
      flashTimer = 0,
      isTouch = false
    } = {}
  ) {
    if (!UILayout.shouldShowCurriculumHud(sceneId, isRosaShopOpen)) {
      return false;
    }

    const amount = Math.max(0, Math.floor(Number(curriculum) || 0));
    const blinkGreen = flashTimer > 0 && Math.floor(flashTimer * 14) % 2 === 0;
    const boxW = isTouch ? 56 : 48;
    const boxH = 12;
    const boxX = LOGICAL_WIDTH - boxW - 6;
    const boxY = 25;

    ctx.save();
    UILayout.drawShadow(ctx, boxX, boxY, boxW, boxH, 0.32);
    ctx.fillStyle = blinkGreen ? 'rgba(20, 83, 45, 0.92)' : 'rgba(24, 12, 38, 0.88)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = blinkGreen ? '#4ade80' : 'rgba(192, 132, 252, 0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);

    ctx.font = `${isTouch ? 7.5 : 6.5}px ${UI_FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = blinkGreen ? '#86efac' : '#e9d5ff';
    ctx.fillText(`📄 ${amount}`, boxX + boxW / 2, boxY + 6.5);
    ctx.restore();
    return true;
  }
}

