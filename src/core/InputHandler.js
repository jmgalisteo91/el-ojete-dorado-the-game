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
    this.pointerJustClicked = false;
    this.pointerAttackJustPressed = false;
    this.isPointerDown = false;
    this.lastAttackSource = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onKeyDown, { passive: false });
      window.addEventListener('keyup', this._onKeyUp);
      window.addEventListener('blur', this._onBlur);
      window.addEventListener('pointermove', this._onPointerMove);
      window.addEventListener('pointerdown', this._onPointerDown);
      window.addEventListener('pointerup', this._onPointerUp);
      window.addEventListener('pointercancel', this._onPointerUp);
    }
  }

  _notifyFirstInteraction() {
    if (!this._interactedOnce) {
      this._interactedOnce = true;
      if (typeof this.onFirstInteraction === 'function') {
        this.onFirstInteraction();
      }
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
  }

  _onPointerDown(event) {
    this._notifyFirstInteraction();
    if (this._isDOMModalBlocking()) return;
    this._updateCanvasCoords(event);
    if (!event || event.button === 0 || event.button === undefined) {
      this.pointerJustClicked = true;
      this.pointerAttackJustPressed = true;
      this.isPointerDown = true;
    }
  }

  _onPointerUp(event) {
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

  _onBlur() {
    this.keysDown.clear();
    this.keysJustPressed.clear();
    this.pointerJustClicked = false;
    this.pointerAttackJustPressed = false;
    this.isPointerDown = false;
  }

  getMovementVector() {
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

  consumeInteraction() {
    const interacted =
      this.keysJustPressed.has('KeyE') ||
      this.keysJustPressed.has('Space') ||
      this.keysJustPressed.has('Enter');
    this.keysJustPressed.delete('KeyE');
    this.keysJustPressed.delete('Space');
    this.keysJustPressed.delete('Enter');
    return interacted;
  }

  consumeAttack() {
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
    return (
      this.keysDown.has('Space') ||
      this.keysDown.has('KeyF') ||
      this.keysDown.has('KeyJ') ||
      this.keysDown.has('KeyK') ||
      this.isPointerDown
    );
  }

  consumeDash() {
    const dashed =
      this.keysJustPressed.has('ShiftLeft') ||
      this.keysJustPressed.has('ShiftRight');
    this.keysJustPressed.delete('ShiftLeft');
    this.keysJustPressed.delete('ShiftRight');
    return dashed;
  }

  consumeBarrier() {
    const val = this.keysJustPressed.has('KeyQ');
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
  }
}

