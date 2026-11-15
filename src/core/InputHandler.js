/**
 * InputHandler para captura de teclado y puntero:
 * - Movimiento: WASD y Flechas direccionales
 * - Interacción / Confirmar: 'E', 'Espacio' o 'Enter'
 * - Inventario: 'I' o 'Tab'
 * - Pausa / Atrás: 'Escape'
 */
export class InputHandler {
  constructor(onFirstInteraction = null, canvas = null) {
    this.keysDown = new Set();
    this.keysJustPressed = new Set();
    this.onFirstInteraction = onFirstInteraction;
    this.canvas = canvas;
    this._interactedOnce = false;

    this.pointerX = -1;
    this.pointerY = -1;
    // (FIX M1.1) Coordenadas en píxeles del backing store (1280x720) para los controles táctiles
    this.pointerCanvasX = -1;
    this.pointerCanvasY = -1;
    this.pointerJustClicked = false;
    this.pointerAttackJustPressed = false;
    this.isPointerDown = false;
    this.lastAttackSource = null;

    // (FIX M1.1) Capa táctil: convive con teclado y ratón, nunca los sustituye
    this.isTouchDevice = false;
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        this.isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
      }
    } catch (_) {
      this.isTouchDevice = false;
    }
    this.touchState = {
      moveX: 0,
      moveY: 0,
      buttons: new Set(), // acciones mantenidas (attack, interact, dash, barrier)
      pressed: new Set()  // flanco de pulsación, se consume una vez por frame
    };
    this.touchControls = null;
    // (FIX M3.3) Punteros activos (para pinch-zoom del mapa): id -> {x, y} lógico
    this.activePointers = new Map();

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onKeyDown, { passive: false });
      window.addEventListener('keyup', this._onKeyUp);
      window.addEventListener('blur', this._onBlur);
      window.addEventListener('pointermove', this._onPointerMove);
      window.addEventListener('pointerdown', this._onPointerDown);
      window.addEventListener('pointerup', this._onPointerUp);
      window.addEventListener('pointercancel', this._onPointerUp);
    }
    // (FIX M2.2) Al ocultar la pestaña/app se limpia todo: evita teclas y controles pegados
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', this._onVisibilityChange);
    }
  }

  _onVisibilityChange() {
    if (typeof document === 'undefined' || !document.hidden) return;
    this.keysDown.clear();
    this.keysJustPressed.clear();
    this.pointerJustClicked = false;
    this.pointerAttackJustPressed = false;
    this.isPointerDown = false;
    this.activePointers.clear();
    this.resetTouchState();
    if (this.touchControls) this.touchControls.resetAll();
  }

  _notifyFirstInteraction() {
    if (!this._interactedOnce) {
      this._interactedOnce = true;
      // (FIX M0.5) Primer gesto: intenta pantalla completa + landscape en táctiles
      this._requestMobileFullscreen();
      if (typeof this.onFirstInteraction === 'function') {
        this.onFirstInteraction();
      }
    }
  }

  /**
   * (FIX M0.5) En dispositivos táctiles, pide fullscreen y bloqueo de orientación
   * en el primer gesto del usuario (requisito de los navegadores).
   * Todo va envuelto en try/catch: iOS rechaza fullscreen en muchos modelos y no
   * todos los navegadores soportan `screen.orientation.lock`, y el juego debe seguir.
   */
  _requestMobileFullscreen() {
    try {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      if (typeof window.matchMedia !== 'function') return;
      if (!window.matchMedia('(pointer: coarse)').matches) return;

      const root = document.documentElement;
      if (!root) return;

      const lockLandscape = () => {
        try {
          const orientation = window.screen && window.screen.orientation;
          if (orientation && typeof orientation.lock === 'function') {
            const result = orientation.lock('landscape');
            if (result && typeof result.catch === 'function') result.catch(() => {});
          }
        } catch (_) {
          /* Orientación no disponible: se ignora */
        }
      };

      const alreadyFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
      const request =
        root.requestFullscreen || root.webkitRequestFullscreen || root.webkitRequestFullScreen;

      if (!alreadyFullscreen && typeof request === 'function') {
        try {
          const result = request.call(root);
          if (result && typeof result.then === 'function') {
            result.then(lockLandscape).catch(() => {});
          } else {
            lockLandscape();
          }
        } catch (_) {
          /* iOS/ Safari: rechazo silencioso */
        }
      } else {
        lockLandscape();
      }
    } catch (_) {
      /* Nunca romper la entrada del juego por culpa del fullscreen */
    }
  }

  _updateCanvasCoords(event) {
    if (!event) return;
    const el = this.canvas || (typeof document !== 'undefined' ? document.getElementById('game-canvas') : null);
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.pointerX = ((event.clientX - rect.left) / rect.width) * 320;
    this.pointerY = ((event.clientY - rect.top) / rect.height) * 180;
    // (FIX M1.1) Misma posición en píxeles del canvas (0..1280 / 0..720)
    this.pointerCanvasX = ((event.clientX - rect.left) / rect.width) * (el.width || 1280);
    this.pointerCanvasY = ((event.clientY - rect.top) / rect.height) * (el.height || 720);
  }

  /** (FIX M1.7/M1.8) Expone el bloqueo por modal DOM para que TouchControls no capture input. */
  isDOMBlocked() {
    return this._isDOMModalBlocking();
  }

  /** (FIX M1.7) Engancha la capa visual/táctil; main la crea tras el InputHandler. */
  attachTouchControls(touchControls) {
    this.touchControls = touchControls || null;
    if (this.touchControls) this.touchControls.enabled = this.isTouchDevice;
  }

  // ------------------------------------------------------------------ API táctil

  /** Vector del joystick normalizado (-1..1). */
  setTouchMovement(x, y) {
    const nx = Number(x) || 0;
    const ny = Number(y) || 0;
    const len = Math.hypot(nx, ny);
    if (len > 1) {
      this.touchState.moveX = nx / len;
      this.touchState.moveY = ny / len;
    } else {
      this.touchState.moveX = nx;
      this.touchState.moveY = ny;
    }
  }

  /** Mantiene pulsada una acción táctil y registra su flanco. */
  pressTouchButton(code) {
    if (!code) return;
    this.touchState.buttons.add(code);
    this.touchState.pressed.add(code);
  }

  releaseTouchButton(code) {
    if (!code) return;
    this.touchState.buttons.delete(code);
  }

  /** Limpia todo el estado táctil (blur, modal, cambio de escena). */
  resetTouchState() {
    this.touchState.moveX = 0;
    this.touchState.moveY = 0;
    this.touchState.buttons.clear();
    this.touchState.pressed.clear();
  }

  _isDOMModalBlocking() {
    if (typeof document === 'undefined') return false;
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
      return true;
    }
    const chatModal = document.getElementById('ai-chat-modal');
    if (chatModal && !chatModal.classList.contains('hidden')) {
      return true;
    }
    const scoreModal = document.getElementById('score-submission-modal');
    if (scoreModal && !scoreModal.classList.contains('hidden')) {
      return true;
    }
    const exitModal = document.getElementById('exit-confirm-modal');
    if (exitModal && !exitModal.classList.contains('hidden')) {
      return true;
    }
    const cloudSaveModal = document.getElementById('cloud-save-modal');
    if (cloudSaveModal && !cloudSaveModal.classList.contains('hidden')) {
      return true;
    }
    const cloudLoadModal = document.getElementById('cloud-load-modal');
    if (cloudLoadModal && !cloudLoadModal.classList.contains('hidden')) {
      return true;
    }
    return false;
  }

  _onPointerMove(event) {
    this._updateCanvasCoords(event);
    // (FIX M3.3) Actualizar la posición del puntero activo
    if (event && event.pointerId !== undefined && this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, { x: this.pointerX, y: this.pointerY });
    }
    if (this.isTouchDevice && this.touchControls) {
      this.touchControls.handlePointerMove(
        this.pointerCanvasX,
        this.pointerCanvasY,
        event && event.pointerId !== undefined ? event.pointerId : 0
      );
    }
  }

  _onPointerDown(event) {
    this._notifyFirstInteraction();
    if (this._isDOMModalBlocking()) return;
    this._updateCanvasCoords(event);
    // (FIX M3.3) Registrar el puntero para gestos multipunto
    if (event && event.pointerId !== undefined) {
      this.activePointers.set(event.pointerId, { x: this.pointerX, y: this.pointerY });
    }

    // (FIX M1.7) En táctil, los controles tienen prioridad: si el toque cae en una
    // zona (joystick/botones), NO se dispara el ataque por puntero.
    if (this.isTouchDevice && this.touchControls) {
      const pointerId = event && event.pointerId !== undefined ? event.pointerId : 0;
      const zone = this.touchControls.hitTest(this.pointerCanvasX, this.pointerCanvasY);
      if (zone) {
        this.touchControls.handlePointerDown(
          zone,
          this.pointerCanvasX,
          this.pointerCanvasY,
          pointerId
        );
        return;
      }
    }

    if (!event || event.button === 0 || event.button === undefined) {
      this.pointerJustClicked = true;
      this.pointerAttackJustPressed = true;
      this.isPointerDown = true;
    }
  }

  _onPointerUp(event) {
    // (FIX M3.3) Liberar el puntero
    if (event && event.pointerId !== undefined) {
      this.activePointers.delete(event.pointerId);
    }
    if (this.isTouchDevice && this.touchControls) {
      this.touchControls.handlePointerUp(
        event && event.pointerId !== undefined ? event.pointerId : 0
      );
    }
    if (!event || event.button === 0 || event.button === undefined) {
      this.isPointerDown = false;
    }
  }

  _onKeyDown(event) {
    this._notifyFirstInteraction();

    // Si el jugador está interactuando con el modal de chat de IA, no interceptar teclas de juego
    if (this._isDOMModalBlocking()) {
      return;
    }

    const code = event?.code || '';
    const key = event?.key || '';

    // Lista de códigos de teclas de juego
    const gameCodes = [
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'KeyE', 'Space', 'Enter', 'KeyF', 'KeyJ', 'KeyK', 'KeyI', 'KeyC', 'KeyX', 'Tab', 'Escape', 'KeyM',
      'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyL', 'Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3', 'F3'
    ];

    // Prevenir el scroll por defecto de la página web (Espacio, Flechas, Tab) en el navegador / Vercel
    const isScrollKey =
      code === 'Space' ||
      key === ' ' ||
      key === 'Spacebar' ||
      (typeof code === 'string' && code.startsWith('Arrow')) ||
      (typeof key === 'string' && key.startsWith('Arrow')) ||
      code === 'Tab' ||
      key === 'Tab' ||
      code === 'PageUp' ||
      code === 'PageDown';

    if (gameCodes.includes(code) || isScrollKey) {
      event.preventDefault();
    }

    if (!this.keysDown.has(code)) {
      this.keysJustPressed.add(code);
    }
    this.keysDown.add(code);
  }

  _onKeyUp(event) {
    this.keysDown.delete(event.code);
  }

  clear() {
    this.keysDown.clear();
    this.keysJustPressed.clear();
    this.pointerJustClicked = false;
    this.pointerAttackJustPressed = false;
    this.isPointerDown = false;
    this.activePointers.clear();
    // (FIX M1.1/M1.8) Al limpiar/perder el foco no debe quedar un joystick moviendo al jugador
    this.resetTouchState();
    if (this.touchControls) this.touchControls.resetAll();
  }

  _onBlur() {
    this.clear();
  }

  getMovementVector() {
    // (FIX M1.1) Si hay joystick activo manda el vector táctil; si está a cero, teclado.
    if (this.isTouchDevice) {
      const tx = this.touchState.moveX;
      const ty = this.touchState.moveY;
      if (tx !== 0 || ty !== 0) {
        const len = Math.hypot(tx, ty);
        return len > 1 ? { x: tx / len, y: ty / len } : { x: tx, y: ty };
      }
    }

    let dx = 0;
    let dy = 0;

    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) dx -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) dx += 1;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) dy -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) dy += 1;

    if (dx !== 0 && dy !== 0) {
      const invLen = 1 / Math.hypot(dx, dy);
      dx *= invLen;
      dy *= invLen;
    }

    return { x: dx, y: dy };
  }

  consumeInteraction({ includeSpace = true } = {}) {
    // (FIX M1.1) El botón A se mapea a 'interact' cuando hay algo con lo que interactuar
    const touchInteracted = this.touchState.pressed.has('interact');
    this.touchState.pressed.delete('interact');

    const interacted =
      touchInteracted ||
      this.keysJustPressed.has('KeyE') ||
      (includeSpace && this.keysJustPressed.has('Space')) ||
      this.keysJustPressed.has('Enter');
    this.keysJustPressed.delete('KeyE');
    if (includeSpace) this.keysJustPressed.delete('Space');
    this.keysJustPressed.delete('Enter');
    return interacted;
  }

  isKeyJustPressed(code) {
    return this.keysJustPressed.has(code);
  }

  isKeyDown(code) {
    return this.keysDown.has(code);
  }

  consumeAttack() {
    // (FIX M1.1) Flanco del botón A táctil (solo cuando no había interacción cerca)
    const touchAttacked = this.touchState.pressed.has('attack');
    this.touchState.pressed.delete('attack');

    const keyAttacked =
      this.keysJustPressed.has('KeyF') ||
      this.keysJustPressed.has('KeyJ') ||
      this.keysJustPressed.has('KeyK') ||
      this.keysJustPressed.has('Space');
    this.keysJustPressed.delete('KeyF');
    this.keysJustPressed.delete('KeyJ');
    this.keysJustPressed.delete('KeyK');
    this.keysJustPressed.delete('Space');

    const pointerAttacked = this.pointerAttackJustPressed;
    this.pointerAttackJustPressed = false;

    if (touchAttacked) {
      this.lastAttackSource = 'touch';
      return true;
    }
    if (pointerAttacked) {
      this.lastAttackSource = 'pointer';
      return true;
    }
    if (keyAttacked) {
      this.lastAttackSource = 'keyboard';
      return true;
    }
    return false;
  }

  isAttackHeld() {
    if (this.touchState.buttons.has('attack')) return true;
    return (
      this.keysDown.has('Space') ||
      this.keysDown.has('KeyF') ||
      this.keysDown.has('KeyJ') ||
      this.keysDown.has('KeyK') ||
      this.isPointerDown
    );
  }

  consumeDash() {
    const touchDashed = this.touchState.pressed.has('dash');
    this.touchState.pressed.delete('dash');
    const dashed =
      touchDashed ||
      this.keysJustPressed.has('ShiftLeft') ||
      this.keysJustPressed.has('ShiftRight');
    this.keysJustPressed.delete('ShiftLeft');
    this.keysJustPressed.delete('ShiftRight');
    return dashed;
  }

  consumeBarrier() {
    const touchBarrier = this.touchState.pressed.has('barrier');
    this.touchState.pressed.delete('barrier');
    const val = touchBarrier || this.keysJustPressed.has('KeyQ');
    this.keysJustPressed.delete('KeyQ');
    return val;
  }

  consumePointerClick() {
    if (this.pointerJustClicked) {
      this.pointerJustClicked = false;
      this.pointerAttackJustPressed = false;
      return { x: this.pointerX, y: this.pointerY };
    }
    return null;
  }

  consumeInventoryToggle() {
    const toggled =
      this.keysJustPressed.has('KeyI') || this.keysJustPressed.has('Tab');
    this.keysJustPressed.delete('KeyI');
    this.keysJustPressed.delete('Tab');
    return toggled;
  }

  consumeCharacterToggle() {
    const toggled = this.keysJustPressed.has('KeyC');
    this.keysJustPressed.delete('KeyC');
    return toggled;
  }

  consumeQuestLogToggle() {
    const toggled = this.keysJustPressed.has('KeyL');
    this.keysJustPressed.delete('KeyL');
    return toggled;
  }

  consumeDropItem() {
    return this.consumeKey('KeyX');
  }

  consumeMenuDirection() {
    if (this.consumeKey('KeyW') || this.consumeKey('ArrowUp')) return 'up';
    if (this.consumeKey('KeyS') || this.consumeKey('ArrowDown')) return 'down';
    if (this.consumeKey('KeyA') || this.consumeKey('ArrowLeft')) return 'left';
    if (this.consumeKey('KeyD') || this.consumeKey('ArrowRight')) return 'right';
    return null;
  }

  consumeKey(code) {
    if (this.keysJustPressed.has(code)) {
      this.keysJustPressed.delete(code);
      return true;
    }
    return false;
  }

  endFrame() {
    this.keysJustPressed.clear();
    this.pointerJustClicked = false;
    this.pointerAttackJustPressed = false;
    // (FIX M1.1) Los flancos táctiles no consumidos caducan como los del teclado
    this.touchState.pressed.clear();
  }
}

