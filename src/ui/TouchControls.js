import { UI_FONT } from './UILayout.js?v=8';

/**
 * TouchControls · Capa de controles virtuales para móvil.
 *
 * Se dibuja en píxeles del canvas (0..1280 × 0..720) y se superpone al HUD, nunca
 * dentro del espacio lógico 320×180. No escucha eventos por su cuenta: InputHandler
 * le delega pointerdown/move/up (una única fuente de verdad, sin dobles disparos).
 *
 * Distribución:
 *  - Joystick abajo a la izquierda (radio visual 50 CSS px, zona táctil 120 CSS px).
 *  - Botón A (atacar/interactuar) abajo a la derecha, B (dash) arriba-izquierda,
 *    C (barrera/parry) arriba.
 *  - ☰ (pausa) arriba a la derecha, bajo el reloj del HUD.
 *  - 🎒 (inventario) arriba a la izquierda, bajo corazones/monedas.
 *
 * Los tamaños se expresan en CSS px y se convierten a píxeles del canvas con el
 * factor `w / clientWidth`, para que en un móvil el joystick siga midiendo 50 px
 * reales de pantalla aunque el canvas esté a 693 CSS px de ancho.
 */

const DEAD_ZONE = 0.15;

export class TouchControls {
  constructor(canvas, inputHandler, options = {}) {
    this.canvas = canvas || null;
    this.input = inputHandler || null;
    this.enabled = Boolean(inputHandler && inputHandler.isTouchDevice);

    this.isBlocked = typeof options.isBlocked === 'function' ? options.isBlocked : null;
    this.onMenu = typeof options.onMenu === 'function' ? options.onMenu : null;
    this.onBag = typeof options.onBag === 'function' ? options.onBag : null;
    this.isInteractionAvailable =
      typeof options.isInteractionAvailable === 'function' ? options.isInteractionAvailable : null;
    // Paneles de canvas (inventario/ficha/diario): no tienen input táctil propio,
    // así que el botón 🎒 debe seguir disponible para cerrarlos.
    this.isPanelOpen = typeof options.isPanelOpen === 'function' ? options.isPanelOpen : null;

    this.joystick = {
      active: false,
      pointerId: null,
      x: 0,
      y: 0,
      dx: 0,
      dy: 0
    };
    // pointerId -> { code, zone }
    this.buttonPointers = new Map();
  }

  /** Hay dispositivo táctil (independiente de si ahora mismo está bloqueado). */
  isTouchEnabled() {
    return this.enabled;
  }

  /** ¿Puede dibujar/capturar input ahora mismo? (sin contar paneles de canvas) */
  isUsable() {
    return this.enabled && !this._hardBlocked();
  }

  _hardBlocked() {
    try {
      if (this.input && typeof this.input.isDOMBlocked === 'function' && this.input.isDOMBlocked()) {
        return true;
      }
      if (this.isBlocked) return Boolean(this.isBlocked());
    } catch (_) {
      return false;
    }
    return false;
  }

  _panelOpen() {
    try {
      return Boolean(this.isPanelOpen && this.isPanelOpen());
    } catch (_) {
      return false;
    }
  }

  /** Geometría en píxeles del canvas. `k` = píxeles de canvas por píxel CSS. */
  _layout() {
    const w = this.canvas && this.canvas.width ? this.canvas.width : 1280;
    const h = this.canvas && this.canvas.height ? this.canvas.height : 720;
    const cssW = this.canvas && this.canvas.clientWidth ? this.canvas.clientWidth : w;
    // (FIX M1.2) Tope superior: en pantallas muy pequeñas unos controles gigantes
    // se comerían la barra de jefe y el HUD.
    const k = Math.max(0.5, Math.min(2, w / Math.max(1, cssW)));

    // Escala del HUD lógico (320×180) a píxeles del canvas
    const sx = w / 320;

    const margin = 18 * k;
    const joyR = 50 * k;
    const aR = 55 * k;
    const bR = 45 * k;
    const cR = 45 * k;
    const menuR = 22 * k;
    const bagR = 22 * k;

    const joy = {
      x: margin + joyR,
      y: h - margin - joyR,
      r: joyR,
      zone: 120 * k
    };
    const a = { x: w - margin - aR, y: h - margin - aR, r: aR };
    const b = { x: a.x - aR - bR - 12 * k, y: a.y - 14 * k, r: bR };
    const c = { x: a.x - 12 * k, y: a.y - aR - cR - 12 * k, r: cR };

    // El HUD ocupa la franja superior: el reloj termina en y≈20 lógicos y los
    // corazones+stamina en y≈27. Los botones de menú se colocan justo debajo.
    const menu = { x: w - margin - menuR, y: 20 * sx + 8 * k + menuR, r: menuR };
    const bag = { x: margin + bagR, y: 30 * sx + 8 * k + bagR, r: bagR };

    return { w, h, k, joy, a, b, c, menu, bag };
  }

  /**
   * (FIX M1.7) Zona tocada: 'joystick' | 'btnA' | 'btnB' | 'btnC' | 'menu' | 'bag' | null.
   * Coordenadas en píxeles del canvas (0..1280, 0..720).
   */
  hitTest(x, y) {
    if (!this.isUsable()) return null;
    const L = this._layout();
    const hit = (circle, padding = 0) =>
      Math.hypot(x - circle.x, y - circle.y) <= circle.r + padding;

    // (FIX M1.4) Con el inventario abierto, solo responde el botón de cerrar (🎒/✕)
    if (this._panelOpen()) {
      return hit(L.bag, 8 * L.k) ? 'bag' : null;
    }

    if (hit(L.menu, 8 * L.k)) return 'menu';
    if (hit(L.bag, 8 * L.k)) return 'bag';
    if (hit(L.a)) return 'btnA';
    if (hit(L.b)) return 'btnB';
    if (hit(L.c)) return 'btnC';
    if (Math.hypot(x - L.joy.x, y - L.joy.y) <= L.joy.zone) return 'joystick';
    return null;
  }

  handlePointerDown(zone, x, y, pointerId = 0) {
    if (!this.isUsable() || !zone) return;
    if (this._panelOpen() && zone !== 'bag') return;

    if (zone === 'menu') {
      if (this.onMenu) this.onMenu();
      return;
    }
    if (zone === 'bag') {
      if (this.onBag) this.onBag();
      return;
    }

    if (zone === 'joystick') {
      if (this.joystick.active && this.joystick.pointerId !== pointerId) return;
      this.joystick.active = true;
      this.joystick.pointerId = pointerId;
      this._updateJoystick(x, y);
      return;
    }

    let code = null;
    if (zone === 'btnA') {
      const wantsInteraction =
        this.isInteractionAvailable && this.isInteractionAvailable();
      code = wantsInteraction ? 'interact' : 'attack';
    } else if (zone === 'btnB') {
      code = 'dash';
    } else if (zone === 'btnC') {
      code = 'barrier';
    }
    if (!code) return;

    // Un mismo puntero no puede mantener dos botones a la vez
    this._releaseButton(pointerId);
    this.buttonPointers.set(pointerId, { code, zone });
    if (this.input) this.input.pressTouchButton(code);
  }

  handlePointerMove(x, y, pointerId = 0) {
    if (!this.isUsable() || this._panelOpen()) return;
    if (this.joystick.active && this.joystick.pointerId === pointerId) {
      this._updateJoystick(x, y);
    }
  }

  handlePointerUp(pointerId = 0) {
    if (this.joystick.active && this.joystick.pointerId === pointerId) {
      this.joystick.active = false;
      this.joystick.pointerId = null;
      this.joystick.dx = 0;
      this.joystick.dy = 0;
      if (this.input) this.input.setTouchMovement(0, 0);
    }
    this._releaseButton(pointerId);
  }

  /** Suelta todos los controles (blur, modal, cambio de escena). */
  resetAll() {
    this.joystick.active = false;
    this.joystick.pointerId = null;
    this.joystick.dx = 0;
    this.joystick.dy = 0;
    this.joystick.x = 0;
    this.joystick.y = 0;
    if (this.input) {
      this.input.setTouchMovement(0, 0);
      for (const entry of this.buttonPointers.values()) {
        this.input.releaseTouchButton(entry.code);
      }
    }
    this.buttonPointers.clear();
  }

  _releaseButton(pointerId) {
    const entry = this.buttonPointers.get(pointerId);
    if (!entry) return;
    this.buttonPointers.delete(pointerId);
    if (this.input) this.input.releaseTouchButton(entry.code);
  }

  _updateJoystick(x, y) {
    const L = this._layout();
    const dx = x - L.joy.x;
    const dy = y - L.joy.y;
    const dist = Math.hypot(dx, dy);
    const maxOffset = L.joy.r;

    const clamped = Math.min(dist, maxOffset);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;

    this.joystick.x = L.joy.x + nx * clamped;
    this.joystick.y = L.joy.y + ny * clamped;

    // Zona muerta del 15 % sobre el recorrido útil del pulgar
    const norm = maxOffset > 0 ? clamped / maxOffset : 0;
    let vx = 0;
    let vy = 0;
    if (norm > DEAD_ZONE) {
      const scaled = (norm - DEAD_ZONE) / (1 - DEAD_ZONE);
      vx = nx * scaled;
      vy = ny * scaled;
    }

    this.joystick.dx = vx;
    this.joystick.dy = vy;
    if (this.input) this.input.setTouchMovement(vx, vy);
  }

  _isPressed(zone) {
    for (const entry of this.buttonPointers.values()) {
      if (entry.zone === zone) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ render

  /**
   * (FIX M1.6) Dibuja en coordenadas de pantalla del canvas (1280×720).
   * El render de main está en 320×180; aquí se restablece la matriz a identidad.
   */
  render(ctx) {
    if (!ctx || !this.enabled) return;
    if (this._hardBlocked()) {
      // (FIX M1.8) Con un modal DOM abierto no se dibuja ni se captura nada
      this.resetAll();
      return;
    }

    const L = this._layout();
    const panelOpen = this._panelOpen();

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (panelOpen) {
      // Inventario/ficha/diario abiertos: se apaga el resto y queda solo el cierre.
      this.resetAll();
      this._drawButton(ctx, L.bag, '✕', '#f87171', false, L.k);
    } else {
      this._drawJoystick(ctx, L);
      this._drawButton(ctx, L.a, '⚔️', '#fde047', this._isPressed('btnA'), L.k);
      this._drawButton(ctx, L.b, '⚡', '#38bdf8', this._isPressed('btnB'), L.k);
      this._drawButton(ctx, L.c, '🛡️', '#c084fc', this._isPressed('btnC'), L.k);
      this._drawButton(ctx, L.menu, '☰', '#e2e8f0', false, L.k);
      this._drawButton(ctx, L.bag, '🎒', '#e2e8f0', false, L.k);
    }

    ctx.restore();
  }

  _drawJoystick(ctx, L) {
    const active = this.joystick.active;
    const { x, y, r, zone } = L.joy;

    ctx.save();
    ctx.globalAlpha = active ? 0.95 : 0.5;

    // Zona táctil (solo visible al tocarla, para no ensuciar la escena)
    if (active) {
      ctx.beginPath();
      ctx.arc(x, y, zone, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = Math.max(1, 1.5 * L.k);
      ctx.stroke();
    }

    // Base
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 14, 24, 0.42)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.stroke();

    // Flechas direccionales
    ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
    ctx.font = `bold ${Math.round(r * 0.42)}px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▲', x, y - r * 0.62);
    ctx.fillText('▼', x, y + r * 0.62);
    ctx.fillText('◀', x - r * 0.62, y);
    ctx.fillText('▶', x + r * 0.62, y);

    // Pulgar
    const tx = active ? this.joystick.x : x;
    const ty = active ? this.joystick.y : y;
    ctx.beginPath();
    ctx.arc(tx, ty, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = active ? 'rgba(56, 189, 248, 0.8)' : 'rgba(148, 163, 184, 0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.stroke();

    ctx.restore();
  }

  _drawButton(ctx, circle, icon, color, pressed, k) {
    const { x, y, r } = circle;

    ctx.save();
    ctx.globalAlpha = pressed ? 0.98 : 0.6;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = pressed ? 'rgba(30, 41, 59, 0.94)' : 'rgba(10, 14, 24, 0.45)';
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, r * 0.07);
    ctx.stroke();

    if (pressed) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = Math.max(1, 1.5 * k);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.82, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f8fafc';
    ctx.font = `${Math.round(r * 0.92)}px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y + r * 0.03);

    ctx.restore();
  }
}
