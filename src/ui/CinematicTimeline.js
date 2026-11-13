/**
 * CinematicTimeline.js · Línea de tiempo absoluta para cinemáticas.
 *
 * Cada evento tiene un `time` absoluto (en segundos) y una `action`.
 * El reloj avanza con dt; los eventos se disparan exactamente al llegar a su
 * tiempo, sin depender de esperas encadenadas. La duración total es fija y
 * garantiza que la escena no termine antes de tiempo.
 */
export class CinematicTimeline {
  constructor({ id = 'timeline', duration = 0, events = [] } = {}) {
    this.id = id;
    this.duration = Math.max(0.001, Number(duration) || 0);
    this.events = [...events].sort((a, b) => a.time - b.time);
    this.time = 0;
    this.cursor = 0;
    this.finished = false;
    this.fired = [];
  }

  /** Avanza el reloj y dispara todos los eventos cuyo time ya se alcanzó. */
  update(dt, onEvent) {
    if (this.finished) return true;
    const step = Math.max(0, Number(dt) || 0);
    this.time = Math.min(this.duration, this.time + step);

    while (this.cursor < this.events.length) {
      const event = this.events[this.cursor];
      if (event.time > this.time + 1e-6) break;
      this.cursor += 1;
      this.fired.push(event);
      if (typeof onEvent === 'function') onEvent(event, this.time);
    }

    if (this.time >= this.duration - 1e-6) {
      this.finished = true;
      return true;
    }
    return false;
  }

  get progress() {
    return Math.min(1, this.time / this.duration);
  }

  get remaining() {
    return Math.max(0, this.duration - this.time);
  }
}
