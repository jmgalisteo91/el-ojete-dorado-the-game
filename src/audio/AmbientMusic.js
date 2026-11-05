import { AudioManager } from './AudioManager.js';

/**
 * AmbientMusic.js · Módulo de Audio y Música Ambiental
 * Hereda del motor polifónico avanzado AudioManager con arquitectura de 3 buses,
 * secuenciador chiptune nativo de 4 canales y calibración de volumen.
 */
export class AmbientMusic extends AudioManager {
  constructor() {
    super();
  }
}
