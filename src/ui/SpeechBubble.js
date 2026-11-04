/**
 * SpeechBubble.js - Motor de Bocadillos de Diálogo y Badges Flotantes Estilo Indie Moderno
 * 
 * Sustituye los antiguos rectángulos monolíticos por bocadillos ("speech balloons")
 * auténticos, con esquinas redondeadas, rabillo apuntando al personaje/objeto,
 * sombreado sutil, badges de tecla tridimensionales y tipografía moderna y nítida.
 */

export const GAME_FONT_UI = '"Outfit", "Plus Jakarta Sans", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
export const GAME_FONT_MONO = '"SF Mono", "Consolas", "Monaco", "Courier New", monospace';

/**
 * Traza un rectángulo con esquinas redondeadas en el contexto Canvas 2D.
 */
export function drawRoundedRect(ctx, x, y, width, height, radius = 3) {
  const r = Math.min(radius, width / 2, height / 2);
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Traza la silueta continua de un bocadillo de cómic/RPG con su rabillo inferior.
 * Al ser un trazado contiguo, el sombreado y el borde exterior se aplican uniformemente.
 */
export function drawSpeechBalloonPath(ctx, x, y, width, height, radius, tailX, tailY, tailWidth = 6) {
  const r = Math.min(radius, width / 2, height / 2);
  const clampedTailX = Math.max(x + r + tailWidth / 2, Math.min(x + width - r - tailWidth / 2, tailX));
  const tailLeft = clampedTailX - tailWidth / 2;
  const tailRight = clampedTailX + tailWidth / 2;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(tailRight, y + height);
  ctx.lineTo(clampedTailX, tailY);
  ctx.lineTo(tailLeft, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export class SpeechBubble {
  /**
   * Renderiza el bocadillo de interacción contextual sobre el NPC, puerta, cofre o elemento del mundo.
   */
  static renderActionPromptBubble(ctx, action, camera, timer = 0, fallbackEntity = null) {
    if (!action) return;

    const bob = Math.round(Math.sin(timer * 4.0) * 1.5);
    let anchorX = null;
    let anchorY = null;

    const t = action.target;
    if (t) {
      if (typeof t.centerX === 'number' && typeof t.y === 'number') {
        anchorX = t.centerX;
        anchorY = t.y;
      } else if (typeof t.worldX === 'number' && typeof t.worldY === 'number') {
        anchorX = t.worldX + (t.width ? t.width / 2 : 0);
        anchorY = action.kind === 'bed' ? t.worldY - 14 : t.worldY;
      } else if (typeof t.c === 'number' && typeof t.r === 'number') {
        anchorX = t.c * 16 + 8;
        anchorY = t.r * 16;
      } else if (typeof t.col === 'number' && typeof t.row === 'number') {
        anchorX = t.col * 16 + 8;
        anchorY = t.row * 16;
      } else if (typeof t.x === 'number' && typeof t.y === 'number') {
        anchorX = t.x + (t.width ? t.width / 2 : 0);
        anchorY = t.y;
      }
    }

    // Si la acción define coordenadas directas o requiere fallback defensivo
    if (anchorX === null || anchorY === null) {
      if (typeof action.x === 'number' && typeof action.y === 'number') {
        anchorX = action.x;
        anchorY = action.y;
      } else if (fallbackEntity && typeof fallbackEntity.centerX === 'number') {
        anchorX = fallbackEntity.centerX;
        anchorY = (fallbackEntity.y ?? fallbackEntity.centerY) - 12;
      } else if (camera) {
        anchorX = (camera.renderX || 0) + (camera.viewportWidth || 320) / 2;
        anchorY = (camera.renderY || 0) + 40;
      } else {
        anchorX = 160;
        anchorY = 40;
      }
    }

    const camX = camera?.renderX || 0;
    const camY = camera?.renderY || 0;
    const screenX = Math.round(anchorX - camX);
    const screenY = Math.round(anchorY - camY);

    // Parseo semántico del tipo de acción para formato compacto moderno
    let key = 'E';
    let icon = '💬';
    let title = 'Hablar';
    let subtitle = '';
    let themeBorder = '#38bdf8';
    let themeBg = 'rgba(15, 23, 42, 0.94)';

    switch (action.kind) {
      case 'npc': {
        icon = '💬';
        title = 'Hablar';
        const raw = action.target?.name || '';
        const clean = raw
          .split('(')[0]
          .replace(/Anciano|Herrero|Herbolaria|Guardia|Sabio|Capitán/g, '')
          .trim();
        if (clean && clean !== 'Tú') subtitle = clean;
        themeBorder = '#38bdf8';
        break;
      }
      case 'door': {
        icon = '🚪';
        title = 'Entrar';
        const raw = action.target?.label || '';
        subtitle = raw.replace(/^\[E\]\s*/, '').replace(/^Entrar a\s+/i, '').split('(')[0].trim();
        themeBorder = '#f59e0b';
        break;
      }
      case 'item': {
        const isChest = Boolean(action.target?.isChest);
        icon = isChest ? '📦' : '✨';
        title = isChest ? 'Abrir' : 'Recoger';
        subtitle = (action.target?.name || '').replace(/Restos de /g, '');
        themeBorder = isChest ? '#fbbf24' : '#34d399';
        break;
      }
      case 'signpost': {
        icon = '🪧';
        title = 'Leer';
        subtitle = action.target?.shortName || 'Letrero';
        themeBorder = '#cbd5e1';
        break;
      }
      case 'bed': {
        icon = '🛏️';
        title = 'Dormir';
        subtitle = 'Descansar';
        themeBorder = '#818cf8';
        break;
      }
      case 'animal': {
        icon = '🐾';
        title = action.target?.species === 'dog' ? 'Acariciar' : 'Alimentar';
        subtitle = action.target?.name || '';
        themeBorder = '#f472b6';
        break;
      }
      case 'river_fishing': {
        icon = '🎣';
        title = 'Pescar';
        subtitle = 'Río Alba';
        themeBorder = '#38bdf8';
        break;
      }
      case 'river_fishing_nobread': {
        key = null;
        icon = '🎣';
        title = 'Río Alba';
        subtitle = 'Falta cebo';
        themeBorder = '#f87171';
        break;
      }
      case 'abyssal_portal': {
        icon = '🌀';
        title = 'Portal';
        subtitle = 'Reinos Condenados';
        themeBorder = '#c084fc';
        break;
      }
      case 'abyssal_portal_exit': {
        icon = '🌀';
        title = 'Regresar';
        subtitle = 'Valleverde';
        themeBorder = '#c084fc';
        break;
      }
      case 'armor_compiler_panel': {
        icon = '⚙️';
        title = 'Panel';
        subtitle = 'Booleano';
        themeBorder = '#38bdf8';
        break;
      }
      case 'compiler_sign': {
        icon = '🪧';
        title = 'Letrero';
        subtitle = action.target?.title || 'Compilador';
        themeBorder = '#cbd5e1';
        break;
      }
      case 'sword_monolith': {
        icon = '⚡';
        title = 'Monolito';
        subtitle = `${action.target?.symbol || ''} ${action.target?.name || ''}`.trim();
        themeBorder = '#a855f7';
        break;
      }
      default: {
        icon = '💬';
        title = (action.label || '').replace(/^\[E\]\s*/, '');
        break;
      }
    }

    ctx.save();
    ctx.font = `600 6.5px ${GAME_FONT_UI}`;

    const titleW = Math.ceil(ctx.measureText(title).width);
    let subW = 0;
    if (subtitle) {
      ctx.font = `500 5.5px ${GAME_FONT_UI}`;
      subW = Math.ceil(ctx.measureText(`· ${subtitle}`).width) + 3;
    }

    const keyCapW = key ? 11 : 0;
    const keyCapH = 10;
    const gap = 3;
    const paddingX = 5;
    const bubbleH = 14;
    const bubbleW = paddingX * 2 + keyCapW + (key ? gap : 0) + titleW + subW;

    const bx = Math.max(
      4,
      Math.min(camera.viewportWidth - bubbleW - 4, Math.round(screenX - bubbleW / 2))
    );
    const by = Math.max(12, screenY - bubbleH - 7 + bob);
    const tailTipY = Math.min(screenY - 1, by + bubbleH + 4);

    // Sombra proyectada del bocadillo
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    drawSpeechBalloonPath(ctx, bx + 1, by + 1.5, bubbleW, bubbleH, 4, screenX + 1, tailTipY + 1.5, 6);
    ctx.fill();
    ctx.restore();

    // Cuerpo y rabillo del bocadillo contiguo
    drawSpeechBalloonPath(ctx, bx, by, bubbleW, bubbleH, 4, screenX, tailTipY, 6);
    ctx.fillStyle = themeBg;
    ctx.fill();
    ctx.strokeStyle = themeBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    let curX = bx + paddingX;

    // Tecla 'E' tridimensional con relieve táctil
    if (key) {
      const kx = curX;
      const ky = by + Math.round((bubbleH - keyCapH) / 2);

      // Sombra inferior de la tecla
      ctx.fillStyle = '#090d16';
      drawRoundedRect(ctx, kx, ky + 1, keyCapW, keyCapH, 2);
      ctx.fill();

      // Cuerpo de la tecla
      ctx.fillStyle = '#1e293b';
      drawRoundedRect(ctx, kx, ky, keyCapW, keyCapH - 1, 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Letra de la tecla
      ctx.font = `bold 6px ${GAME_FONT_UI}`;
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(key, kx + keyCapW / 2, ky + (keyCapH - 1) / 2);

      curX += keyCapW + gap;
    }

    // Título de la acción
    ctx.font = `600 6.5px ${GAME_FONT_UI}`;
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, curX, by + bubbleH / 2);
    curX += titleW;

    // Subtítulo elegante y discreto
    if (subtitle) {
      curX += 2;
      ctx.font = `500 5.5px ${GAME_FONT_UI}`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`· ${subtitle}`, curX, by + bubbleH / 2);
    }

    ctx.restore();
  }

  /**
   * Renderiza el auténtico bocadillo de cómic ("Speech Balloon") para los diálogos
   * ambientales que emiten los NPCs mientras deambulan por la villa.
   */
  static renderNPCBarkBubble(ctx, sx, sy, text, timer, maxTimer = 3.0) {
    if (!text || timer <= 0) return;

    ctx.save();
    ctx.font = `600 6.5px ${GAME_FONT_UI}`;

    // Animación suave de entrada (pop-in elástico) y salida (fade)
    const elapsed = maxTimer - timer;
    let scale = 1;
    if (elapsed < 0.16) {
      scale = Math.sin((elapsed / 0.16) * (Math.PI / 2));
    } else if (timer < 0.22) {
      scale = Math.max(0, timer / 0.22);
    }

    if (scale <= 0.05) {
      ctx.restore();
      return;
    }

    // Ajuste de texto en líneas de máximo ~96px para no deformar la pantalla
    const maxLineW = 96;
    const words = text.split(' ');
    const lines = [];
    let curLine = '';

    for (const w of words) {
      const testLine = curLine ? `${curLine} ${w}` : w;
      if (ctx.measureText(testLine).width > maxLineW && curLine) {
        lines.push(curLine);
        curLine = w;
      } else {
        curLine = testLine;
      }
    }
    if (curLine) lines.push(curLine);

    let maxMeasuredW = 0;
    for (const l of lines) {
      maxMeasuredW = Math.max(maxMeasuredW, ctx.measureText(l).width);
    }

    const paddingX = 6;
    const paddingY = 4;
    const lineHeight = 8;
    const bubbleW = Math.ceil(maxMeasuredW) + paddingX * 2;
    const bubbleH = lines.length * lineHeight + paddingY * 2 - 2;

    const bx = Math.max(4, Math.min(320 - bubbleW - 4, Math.round(sx - bubbleW / 2)));
    const by = Math.max(12, sy - bubbleH - 7);
    const tailTipY = Math.min(sy - 1, by + bubbleH + 4);

    // Transformación de escala centrada en el rabillo
    ctx.translate(screenSafeAnchorX(sx), tailTipY);
    ctx.scale(scale, scale);
    ctx.translate(-screenSafeAnchorX(sx), -tailTipY);

    // Sombra del bocadillo
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    drawSpeechBalloonPath(ctx, bx + 1, by + 1.5, bubbleW, bubbleH, 4, sx + 1, tailTipY + 1.5, 6);
    ctx.fill();
    ctx.restore();

    // Fondo blanco nítido estilo cómic moderno
    drawSpeechBalloonPath(ctx, bx, by, bubbleW, bubbleH, 4, sx, tailTipY, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Texto interior oscuro con contraste absoluto
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    lines.forEach((l, idx) => {
      ctx.fillText(l, bx + bubbleW / 2, by + paddingY + idx * lineHeight);
    });

    ctx.restore();
  }

  /**
   * Mini-bocadillo de pensamiento o actividad para NPCs que trabajan en su oficio.
   */
  static renderActivityIcon(ctx, sx, sy, icon, bob = 0) {
    if (!icon) return;
    const bubbleW = 12;
    const bubbleH = 11;
    const bx = Math.round(sx - bubbleW / 2);
    const by = Math.round(sy - bubbleH - 3 + bob);

    ctx.save();
    // Sombra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    drawRoundedRect(ctx, bx + 1, by + 1, bubbleW, bubbleH, 3);
    ctx.fill();

    // Burbuja
    ctx.fillStyle = '#0f172a';
    drawRoundedRect(ctx, bx, by, bubbleW, bubbleH, 3);
    ctx.fill();
    ctx.strokeStyle = '#ffd885';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Puntero
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(sx - 2, by + bubbleH);
    ctx.lineTo(sx + 2, by + bubbleH);
    ctx.lineTo(sx, by + bubbleH + 2);
    ctx.closePath();
    ctx.fill();

    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd885';
    ctx.fillText(icon, bx + bubbleW / 2, by + bubbleH / 2 + 0.5);
    ctx.restore();
  }

  /**
   * Renderiza un indicador o chapa flotante en el supramundo (Bosses y Templos).
   */
  static renderFloatingBadge(ctx, sx, sy, label, subLabel, borderColor, textColor, pulseArrow = true) {
    ctx.save();
    ctx.font = `bold 5.5px ${GAME_FONT_UI}`;
    const w1 = Math.ceil(ctx.measureText(label).width);
    let w2 = 0;
    if (subLabel) {
      ctx.font = `5px ${GAME_FONT_UI}`;
      w2 = Math.ceil(ctx.measureText(subLabel).width);
    }
    const boxW = Math.max(w1, w2) + 10;
    const boxH = subLabel ? 16 : 10;
    const bx = Math.round(sx - boxW / 2);
    const by = Math.round(sy - boxH);

    // Sombra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    drawRoundedRect(ctx, bx + 1, by + 1.5, boxW, boxH, 3);
    ctx.fill();

    // Cuerpo
    ctx.fillStyle = 'rgba(8, 12, 22, 0.92)';
    drawRoundedRect(ctx, bx, by, boxW, boxH, 3);
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Texto
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 5.5px ${GAME_FONT_UI}`;
    ctx.fillStyle = textColor;
    ctx.fillText(label, sx, by + (subLabel ? 4.5 : 5));

    if (subLabel) {
      ctx.font = `5px ${GAME_FONT_UI}`;
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(subLabel, sx, by + 11.5);
    }

    if (pulseArrow) {
      ctx.fillStyle = borderColor;
      ctx.beginPath();
      ctx.moveTo(sx - 3, by + boxH + 0.5);
      ctx.lineTo(sx + 3, by + boxH + 0.5);
      ctx.lineTo(sx, by + boxH + 3.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Banner flotante para eventos de combate (ej: Parry Perfecto).
   */
  static renderCombatBanner(ctx, text, x, y, color = '#fde047') {
    ctx.save();
    ctx.font = `bold 7px ${GAME_FONT_UI}`;
    const tw = Math.ceil(ctx.measureText(text).width) + 14;
    const th = 13;
    const bx = Math.round(x - tw / 2);
    const by = Math.round(y - th / 2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    drawRoundedRect(ctx, bx + 1, by + 1.5, tw, th, 4);
    ctx.fill();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    drawRoundedRect(ctx, bx, by, tw, th, 4);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}

function screenSafeAnchorX(sx) {
  return Math.max(10, Math.min(310, sx));
}

export function renderActionPromptBubble(ctx, action, camera, timer = 0, fallbackEntity = null) {
  return SpeechBubble.renderActionPromptBubble(ctx, action, camera, timer, fallbackEntity);
}

export function renderNPCBarkBubble(ctx, sx, sy, text, timer, maxTimer = 3.0) {
  return SpeechBubble.renderNPCBarkBubble(ctx, sx, sy, text, timer, maxTimer);
}

export function renderFloatingBadge(ctx, sx, sy, label, subLabel, borderColor, textColor, pulseArrow = true) {
  return SpeechBubble.renderFloatingBadge(ctx, sx, sy, label, subLabel, borderColor, textColor, pulseArrow);
}

export function renderActivityIcon(ctx, sx, sy, icon, bob = 0) {
  return SpeechBubble.renderActivityIcon(ctx, sx, sy, icon, bob);
}

export function renderCombatBanner(ctx, text, x, y, color = '#fde047') {
  return SpeechBubble.renderCombatBanner(ctx, text, x, y, color);
}

