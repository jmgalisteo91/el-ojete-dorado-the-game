/**
 * GameLoop con paso fijo (Fixed Timestep a 60 FPS).
 * Desacopla la simulación física/lógica del renderizado.
 */
export class GameLoop {
  constructor(updateFn, renderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;

    this.fixedDelta = 1 / 60;
    this.maxFrameTime = 0.25;
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.rafId = null;

    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
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
      this.updateFn(this.fixedDelta);
      this.accumulator -= this.fixedDelta;
    }

    const alpha = this.accumulator / this.fixedDelta;
    this.renderFn(alpha);

    this.rafId = requestAnimationFrame(this._tick);
  }
}

