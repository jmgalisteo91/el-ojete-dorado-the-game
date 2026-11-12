/**
 * GameLoop con paso fijo (Fixed Timestep a 60 FPS).
 * Desacopla la simulación física/lógica del renderizado.
 *
 * Incluye un sistema de HITSTOP (freeze frames): al impactar, la simulación se congela
 * durante N frames fijos mientras el renderizado sigue vivo. Así el golpe "pesa" sin
 * romper el determinismo del paso fijo ni perder frames de animación.
 */
export class GameLoop {
  /** Última instancia creada: permite que las entidades pidan hitstop sin recibir el loop por parámetro. */
  static active = null;

  constructor(updateFn, renderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;

    this.fixedDelta = 1 / 60;
    this.maxFrameTime = 0.25;
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.rafId = null;

    // Frames de simulación pendientes de congelar (0 = sin hitstop)
    this.hitstopFramesLeft = 0;

    this._tick = this._tick.bind(this);
    GameLoop.active = this;
  }

  /**
   * Congela la simulación durante `frames` frames fijos (~0.0166 s cada uno).
   * 2-4 frames ≈ 0.033-0.066 s: suficiente para leerse como impacto, no como tirón.
   * Las peticiones concurrentes no se acumulan: gana la más larga pendiente.
   * @param {number} frames Número de frames a congelar (se acota a 0-12).
   */
  triggerHitstop(frames = 3) {
    const n = Math.max(0, Math.min(12, Math.round(frames)));
    if (n <= 0) return;
    this.hitstopFramesLeft = Math.max(this.hitstopFramesLeft, n);
  }

  /** Atajo estático para entidades que no tienen referencia al loop (Enemy, Player). */
  static triggerHitstop(frames = 3) {
    if (GameLoop.active) GameLoop.active.triggerHitstop(frames);
  }

  get isHitstopped() {
    return this.hitstopFramesLeft > 0;
  }

  /** Segundos de congelación restantes (útil para depuración/HUD). */
  get hitstopRemaining() {
    return this.hitstopFramesLeft * this.fixedDelta;
  }

  clearHitstop() {
    this.hitstopFramesLeft = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.clearHitstop();
    this.rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clearHitstop();
  }

  _tick(currentTime) {
    if (!this.running) return;

    let frameTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    if (frameTime > this.maxFrameTime) {
      frameTime = this.maxFrameTime;
    }

    this.accumulator += frameTime;

    while (this.accumulator >= this.fixedDelta) {
      this.accumulator -= this.fixedDelta;

      // Freeze frame: se descarta el paso de simulación, pero se sigue renderizando.
      if (this.hitstopFramesLeft > 0) {
        this.hitstopFramesLeft -= 1;
        continue;
      }

      // Si el update pidió hitstop, se aplica en el siguiente paso de este mismo tick.
      this.updateFn(this.fixedDelta);
    }

    const alpha = this.accumulator / this.fixedDelta;
    this.renderFn(alpha);

    this.rafId = requestAnimationFrame(this._tick);
  }
}
