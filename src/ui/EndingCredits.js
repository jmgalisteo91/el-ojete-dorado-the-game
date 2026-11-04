/**
 * Submódulo de Créditos Finales y Expediente de Compilación (EndingCredits.js)
 * 
 * - Renderizado de fondo estelar con estrellas pixeladas que titilan.
 * - Scroll vertical cinematográfico con las estadísticas finales del jugador:
 *   * Tiempo de compilación (duración total de la partida).
 *   * Veces sentenciado al calabozo municipal por desacato.
 *   * Habilidades de combate desbloqueadas (Dash, Corte en Cascada, Escudo TS).
 *   * Título final obtenido (ej. "Senior Lead Architect del Gran Ojal").
 * - Ilustración / Consagración de 'El Ojete Dorado' en pixel art con halo áureo pulsante.
 * - Guardado automático del Trofeo de Victoria en localStorage ('el_ojete_dorado_victory_trophy').
 * - Control de velocidad y botón de retorno al Menú Principal con [Espacio / Enter].
 */
export class EndingCredits {
  constructor(viewportWidth = 320, viewportHeight = 180, record = {}, onFinish = null) {
    this.w = viewportWidth;
    this.h = viewportHeight;
    this.record = record;
    this.onFinish = onFinish;

    this.scrollY = this.h + 10;
    this.baseScrollSpeed = 22; // px / seg
    this.isFastForward = false;
    this.timeAccumulator = 0;
    this.canExit = false;

    // Generar campo de estrellas pixeladas retro
    this.stars = Array.from({ length: 75 }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      speed: 0.5 + Math.random() * 2.5,
      brightness: 0.3 + Math.random() * 0.7,
      color: Math.random() > 0.85 ? '#ffd700' : Math.random() > 0.7 ? '#38bdf8' : '#ffffff',
      size: Math.random() > 0.8 ? 1.5 : 1
    }));

    // Estructurar líneas de texto para el scroll vertical
    this.lines = this._buildCreditLines();
    this.totalHeight = this.lines.length * 12 + 180;

    // Guardar trofeo de victoria en localStorage
    this._saveVictoryTrophy();
  }

  _buildCreditLines() {
    const r = this.record;
    const playTimeStr = r.playTimeFormatted || '12 min 30 s';
    const jailCount = typeof r.jailVisits === 'number' ? r.jailVisits : 0;
    const finalTitle = r.title || 'Senior Lead Architect del Gran Ojal';
    const coins = typeof r.coins === 'number' ? r.coins : 0;
    const robot = typeof r.robotization === 'number' ? r.robotization : 0;

    const hasDash = Array.isArray(r.abilities) && r.abilities.some(a => a && a.toLowerCase().includes('dash'));
    const hasSpin = Array.isArray(r.abilities) && r.abilities.some(a => a && a.toLowerCase().includes('cascada'));
    const hasShield = Array.isArray(r.abilities) && r.abilities.some(a => a && a.toLowerCase().includes('typescript') || a.toLowerCase().includes('barrera'));

    return [
      { type: 'spacer', height: 20 },
      { type: 'title', text: 'EL OJETE DORADO: THE GAME' },
      { type: 'subtitle', text: '— VERSIÓN MAESTRA v3.5 —' },
      { type: 'spacer', height: 16 },

      { type: 'emblem', text: 'GOLDEN_ANUS_EMBLEM' },
      { type: 'spacer', height: 12 },
      { type: 'gold', text: '★ EL OJETE DORADO HA SIDO CONSAGRADO ★' },
      { type: 'desc', text: 'Las fugas de memoria han sido purgadas del multiverso.' },
      { type: 'spacer', height: 22 },

      { type: 'header', text: '═══ [ EXPEDIENTE DEL PROGRAMADOR ] ═══' },
      { type: 'stat', label: 'Tiempo de Compilación:', value: playTimeStr, color: '#38bdf8' },
      { type: 'stat', label: 'Condenas en Calabozo:', value: `${jailCount} ${jailCount === 1 ? 'vez' : 'veces'}`, color: jailCount === 0 ? '#4ade80' : '#f87171' },
      { type: 'stat', label: 'Saldo de Bytes / Monedas:', value: `${coins} bytes`, color: '#fde047' },
      { type: 'stat', label: 'Robotización Residual:', value: `${robot}%`, color: robot === 0 ? '#4ade80' : '#fb923c' },
      { type: 'spacer', height: 10 },

      { type: 'header', text: '─── [ HABILIDADES DE DESARROLLADOR ] ───' },
      { type: 'ability', label: '💨 Dash Asíncrono:', value: hasDash ? '✓ DESBLOQUEADA' : '✗ NO OBTENIDA', ok: hasDash },
      { type: 'ability', label: '🌀 Corte en Cascada:', value: hasSpin ? '✓ DESBLOQUEADA' : '✗ NO OBTENIDA', ok: hasSpin },
      { type: 'ability', label: '🛡️ Barrera TypeScript:', value: hasShield ? '✓ DESBLOQUEADA' : '✗ NO OBTENIDA', ok: hasShield },
      { type: 'spacer', height: 14 },

      { type: 'header', text: '─── [ RANGO Y TÍTULO FINAL ] ───' },
      { type: 'rank', text: `★ ${finalTitle} ★` },
      { type: 'spacer', height: 26 },

      { type: 'header', text: '═══ [ CRÉDITOS DE DESARROLLO ] ═══' },
      { type: 'role', text: 'DIRECCIÓN DE JUEGO & DISEÑO' },
      { type: 'name', text: 'José Peralta' },
      { type: 'spacer', height: 8 },

      { type: 'role', text: 'MOTOR Y FÍSICAS' },
      { type: 'name', text: 'HTML5 Canvas 2D Retro Engine (320 × 180)' },
      { type: 'spacer', height: 8 },

      { type: 'role', text: 'SINTETIZADOR & BANDA SONORA' },
      { type: 'name', text: 'Web Audio API Native Chiptune' },
      { type: 'spacer', height: 8 },

      { type: 'role', text: 'CINEMÁTICAS & NOVELA VISUAL' },
      { type: 'name', text: 'Anime Cutscenes & WebP Base64 Pipeline' },
      { type: 'spacer', height: 8 },

      { type: 'role', text: 'IA DEL ORÁCULO DE VALLEVERDE' },
      { type: 'name', text: 'Orion AI (Google Gemini API)' },
      { type: 'spacer', height: 8 },

      { type: 'role', text: 'ANTAGONISTA & JEFE FINAL' },
      { type: 'name', text: 'Mister AI Alex & El Microondas Cuántico' },
      { type: 'spacer', height: 16 },

      { type: 'header', text: '═══ [ DEDICATORIA & AGRADECIMIENTOS ] ═══' },
      { type: 'role', text: 'DESARROLLADOR MAESTRO' },
      { type: 'name', text: 'Jose Manuel Peralta Galisteo' },
      { type: 'desc', text: '«Una idea feliz para gente feliz. Y todo gracias al gran mister' },
      { type: 'desc', text: 'alejandro y manoplo por ser su amigo, al pobre ruso por aguantar' },
      { type: 'desc', text: 'y cepeda sigue siendo cepeda pero sin vacaciones.... XDDD»' },
      { type: 'spacer', height: 16 },

      { type: 'header', text: '─── [ AGRADECIMIENTOS ESPECIALES ] ───' },
      { type: 'desc', text: 'A todos los programadores que alguna vez compilaron' },
      { type: 'desc', text: 'directamente a producción un viernes a las 18:00.' },
      { type: 'spacer', height: 12 },

      { type: 'gold', text: '¡¡¡POR EL OJETEEEEEEEEE!!!' },
      { type: 'spacer', height: 20 },

      { type: 'prompt', text: '— PULSA [ESPACIO / ENTER] PARA VOLVER AL MENÚ —' },
      { type: 'spacer', height: 30 }
    ];
  }

  _saveVictoryTrophy() {
    try {
      const trophyPayload = {
        unlockedAt: Date.now(),
        dateFormatted: new Date().toLocaleDateString('es-ES'),
        title: this.record.title || 'Senior Lead Architect del Gran Ojal',
        playTime: this.record.playTimeFormatted || '00:00',
        jailVisits: this.record.jailVisits || 0,
        coins: this.record.coins || 0
      };
      localStorage.setItem('el_ojete_dorado_victory_trophy', JSON.stringify(trophyPayload));
    } catch {}
  }

  update(dt, input) {
    this.timeAccumulator += dt;
    if (this.timeAccumulator > 1.2) {
      this.canExit = true;
    }

    // Scroll acelerado al mantener pulsado Espacio, Enter o Flecha Abajo
    const isDownHeld = input && (
      (typeof input.isKeyDown === 'function' && (input.isKeyDown('ArrowDown') || input.isKeyDown('KeyS') || input.isKeyDown('Space')))
    );
    const speedMult = isDownHeld ? 3.5 : 1.0;

    this.scrollY -= this.baseScrollSpeed * speedMult * dt;

    // Comprobar pulsación de tecla para salir y regresar al menú
    if (input && this.canExit) {
      if (
        (input.consumeKey && (input.consumeKey('Space') || input.consumeKey('Enter') || input.consumeKey('Escape'))) ||
        (input.consumeInteraction && input.consumeInteraction())
      ) {
        this._finish();
      }
    }

    // Si el scroll supera el final, permitir salir inmediatamente
    if (this.scrollY < -this.totalHeight + this.h) {
      this.canExit = true;
    }
  }

  _finish() {
    if (typeof this.onFinish === 'function') {
      this.onFinish();
    }
  }

  render(ctx) {
    const t = this.timeAccumulator;
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 1. Fondo negro espacial profundo
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, this.w, this.h);

    // 2. Campo de estrellas pixeladas titilantes
    for (const star of this.stars) {
      const alpha = 0.25 + 0.75 * Math.abs(Math.sin(t * star.speed + star.x));
      ctx.fillStyle = star.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
    }
    ctx.globalAlpha = 1.0;

    // 3. Renderizado del scroll vertical de créditos
    let currentY = Math.round(this.scrollY);

    for (const line of this.lines) {
      if (line.type === 'spacer') {
        currentY += line.height;
        continue;
      }

      // Solo dibujar líneas que caen dentro del viewport visible (culling)
      if (currentY >= -20 && currentY <= this.h + 20) {
        this._renderLine(ctx, line, currentY, t);
      }

      currentY += (line.type === 'emblem' ? 36 : 13);
    }

    // 4. Barra fija inferior con atajo para salir
    const pulsePrompt = Math.sin(t * 5) * 0.3 + 0.7;
    ctx.fillStyle = 'rgba(3, 7, 18, 0.88)';
    ctx.fillRect(0, this.h - 14, this.w, 14);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, this.h - 13.5, this.w, 13);

    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(253, 224, 71, ${pulsePrompt})`;
    ctx.fillText('[ESPACIO / ENTER] Volver al Menú Principal   ·   [▼] Acelerar', this.w / 2, this.h - 7);

    ctx.restore();
  }

  _renderLine(ctx, line, y, t) {
    const cx = Math.round(this.w / 2);

    switch (line.type) {
      case 'title':
        ctx.font = 'bold 9.5px monospace';
        ctx.fillStyle = '#fde047';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line.text, cx, y);
        break;

      case 'subtitle':
        ctx.font = 'bold 6.5px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line.text, cx, y);
        break;

      case 'emblem':
        this._drawGoldenAnusEmblem(ctx, cx, y, t);
        break;

      case 'header':
        ctx.font = 'bold 7px monospace';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line.text, cx, y);
        break;

      case 'stat':
        ctx.font = '6px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';
        ctx.fillText(line.label, cx - 4, y);
        ctx.fillStyle = line.color || '#38bdf8';
        ctx.textAlign = 'left';
        ctx.fillText(line.value, cx + 4, y);
        break;

      case 'ability':
        ctx.font = '6px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';
        ctx.fillText(line.label, cx - 4, y);
        ctx.fillStyle = line.ok ? '#4ade80' : '#f87171';
        ctx.textAlign = 'left';
        ctx.fillText(line.value, cx + 4, y);
        break;

      case 'rank':
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line.text, cx, y);
        break;

      case 'role':
        ctx.font = 'bold 6px monospace';
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line.text, cx, y);
        break;

      case 'name':
        ctx.font = '6.5px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line.text, cx, y);
        break;

      case 'gold':
        ctx.font = 'bold 7px monospace';
        ctx.fillStyle = '#fde047';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line.text, cx, y);
        break;

      case 'desc':
        ctx.font = '6px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line.text, cx, y);
        break;

      case 'prompt':
        ctx.font = 'bold 6.5px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line.text, cx, y);
        break;
    }
  }

  _drawGoldenAnusEmblem(ctx, cx, cy, t) {
    const pulse = Math.sin(t * 4) * 2;
    const outerRadius = 14 + pulse;
    const innerRadius = 7;

    // Resplandor áureo celestial
    const grad = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius + 8);
    grad.addColorStop(0, 'rgba(253, 224, 71, 0.45)');
    grad.addColorStop(0.6, 'rgba(234, 179, 8, 0.2)');
    grad.addColorStop(1, 'rgba(234, 179, 8, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius + 8, 0, Math.PI * 2);
    ctx.fill();

    // Anillo exterior dorado sagrado
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Núcleo central del Ojete Dorado (círculo interior resplandeciente)
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Rayos de consagración cósmica en 4 ángulos
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + t * 0.8;
      const x1 = cx + Math.cos(ang) * (outerRadius + 2);
      const y1 = cy + Math.sin(ang) * (outerRadius + 2);
      const x2 = cx + Math.cos(ang) * (outerRadius + 6);
      const y2 = cy + Math.sin(ang) * (outerRadius + 6);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
}

