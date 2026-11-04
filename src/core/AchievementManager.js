/**
 * AchievementManager.js - Gestor del Sistema de Trofeos y Logros ('El Ojete Dorado')
 * 
 * Gestiona el catálogo de logros, persistencia en localStorage, disparo de notificaciones
 * tipo Toast pixel art animado (slide-in superior con fanfarria chiptune) y consulta de estado.
 */

export const ACHIEVEMENTS = [
  {
    id: 'ach_first_quest',
    title: 'Primer Commit',
    description: 'Completa con éxito tu primera misión en el Diario del Desarrollador.',
    icon: '📜',
    category: 'QUEST'
  },
  {
    id: 'ach_bridge_pass',
    title: 'Permisos de Root',
    description: 'Obtén el Pase Real del Sabio Aurelio y desbloquea el Puente del Río Alba.',
    icon: '🌉',
    category: 'STORY'
  },
  {
    id: 'ach_side_fishing',
    title: 'Pesca en Aguas Profundas',
    description: 'Pesca 3 Truchas del Río Alba con cebo de pan campesino y entrégalas a Finn.',
    icon: '🐟',
    category: 'SIDE'
  },
  {
    id: 'ach_side_fractal',
    title: 'El Templado Fractal',
    description: 'Recupera chatarra de drones en Tierras Hostiles y templa tu espada con Brom.',
    icon: '⚒️',
    category: 'SIDE'
  },
  {
    id: 'ach_side_silicon',
    title: 'Botánica a Medianoche',
    description: 'Recolecta 3 raras Flores de Silicio que solo florecen a las 22:00 PM para Lyra.',
    icon: '✿',
    category: 'SIDE'
  },
  {
    id: 'ach_all_side_quests',
    title: 'Héroe Comunitario',
    description: 'Cumple los 3 encargos secundarios de los tenderos de la plaza de Valleverde.',
    icon: '🌟',
    category: 'SIDE'
  },
  {
    id: 'ach_boss_gc',
    title: 'Limpieza de Memoria',
    description: 'Purga al Garbage Collector Furioso en las cloacas y desbloquea el Dash Asíncrono.',
    icon: '🗑️',
    category: 'BOSS'
  },
  {
    id: 'ach_boss_stack',
    title: 'Fin de la Recursión',
    description: 'Abate al Guardián del Stack Overflow y desbloquea el Corte en Cascada.',
    icon: '🌀',
    category: 'BOSS'
  },
  {
    id: 'ach_boss_microwave',
    title: 'Desconexión Cuántica',
    description: 'Destruye el Prototipo del Microondas en el Umbral de la Fortaleza.',
    icon: '🛡️',
    category: 'BOSS'
  },
  {
    id: 'ach_condemned',
    title: 'El Puntero Prohibido',
    description: 'Invoca la brecha con el Puntero Abisal y visita los Reinos Condenados del Dios Supremo.',
    icon: '🌌',
    category: 'SECRET'
  },
  {
    id: 'ach_golden_anus',
    title: 'La Compilación Final',
    description: 'Derrota a Mister AI Alex en la Ciudadela y consagra El Ojete Dorado.',
    icon: '👑',
    category: 'LEGEND'
  }
];

const STORAGE_KEY = 'el_ojete_dorado_achievements_v1';

export class AchievementManager {
  constructor(viewportWidth = 320, viewportHeight = 180, audioContext = null, musicEngine = null) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.audioCtx = audioContext;
    this.musicEngine = musicEngine;

    // Mapa de logros desbloqueados: { [id]: timestamp }
    this.unlocked = {};

    // Cola y estado del Toast animado
    this.toastQueue = [];
    this.currentToast = null;
    this.toastTimer = 0;
    this.toastDuration = 3.6; // Segundos totales en pantalla
    this.toastSlideDuration = 0.35; // Segundos de entrada y salida

    this.loadFromStorage();
  }

  setAudioContext(ctx) {
    this.audioCtx = ctx;
  }

  setMusicEngine(musicEngine) {
    this.musicEngine = musicEngine;
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.unlocked = parsed;
        }
      }
    } catch (e) {
      console.warn('No se pudieron cargar los logros desde localStorage:', e);
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.unlocked));
    } catch (e) {
      console.warn('No se pudieron guardar los logros en localStorage:', e);
    }
  }

  serialize() {
    return { ...this.unlocked };
  }

  deserialize(data) {
    if (data && typeof data === 'object') {
      this.unlocked = { ...this.unlocked, ...data };
      this.saveToStorage();
    }
  }

  isUnlocked(id) {
    return Boolean(this.unlocked[id]);
  }

  getUnlockedCount() {
    return Object.keys(this.unlocked).length;
  }

  getTotalCount() {
    return ACHIEVEMENTS.length;
  }

  getAll() {
    return ACHIEVEMENTS.map((ach) => ({
      ...ach,
      unlocked: Boolean(this.unlocked[ach.id]),
      unlockedAt: this.unlocked[ach.id] || null
    }));
  }

  /**
   * Desbloquea un logro si no ha sido obtenido aún.
   * Lanza la animación Toast y reproduce la fanfarria chiptune salvo que silent = true.
   */
  unlock(id, silent = false) {
    if (this.isUnlocked(id)) return false;

    const ach = ACHIEVEMENTS.find((a) => a.id === id);
    if (!ach) return false;

    this.unlocked[id] = Date.now();
    this.saveToStorage();

    if (!silent) {
      // Añadir a la cola de avisos flotantes
      this.toastQueue.push(ach);

      // Reproducir fanfarria chiptune
      this.playFanfare();
    }

    return true;
  }

  /**
   * Reproduce una fanfarria chiptune retro sintetizada por Web Audio API.
   * Arpegio triunfal en Do mayor con timbre 8-bit vibrante.
   */
  playFanfare() {
    try {
      if (this.musicEngine && this.musicEngine.isMuted) return;
      if (!this.audioCtx && this.musicEngine && this.musicEngine.ctx) {
        this.audioCtx = this.musicEngine.ctx;
      }
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx && AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const volScale = this.musicEngine && typeof this.musicEngine.masterVolume === 'number'
        ? this.musicEngine.masterVolume
        : 0.75;
      // Arpegio victorioso ascendente: G4, C5, E5, G5, C6 (sostenido)
      const notes = [
        { freq: 392.00, time: 0.00, dur: 0.09, type: 'square' },
        { freq: 523.25, time: 0.09, dur: 0.09, type: 'square' },
        { freq: 659.25, time: 0.18, dur: 0.09, type: 'triangle' },
        { freq: 783.99, time: 0.27, dur: 0.12, type: 'square' },
        { freq: 1046.50, time: 0.39, dur: 0.55, type: 'square' },
        { freq: 1318.51, time: 0.45, dur: 0.49, type: 'triangle' } // Armónico superior
      ];

      notes.forEach((n) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = n.type;
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        gain.gain.setValueAtTime(0.0001, now + n.time);
        gain.gain.linearRampToValueAtTime(Math.max(0.0002, 0.09 * volScale), now + n.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.time + n.dur);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.onended = () => {
          try { osc.disconnect(); } catch {}
          try { gain.disconnect(); } catch {}
        };

        osc.start(now + n.time);
        osc.stop(now + n.time + n.dur + 0.05);
      });
    } catch (e) {
      // Ignorar restricciones de audio antes de la primera interacción
    }
  }

  update(dt) {
    if (!this.currentToast) {
      if (this.toastQueue.length > 0) {
        this.currentToast = this.toastQueue.shift();
        this.toastTimer = 0;
      }
    } else {
      this.toastTimer += dt;
      if (this.toastTimer >= this.toastDuration) {
        this.currentToast = null;
        this.toastTimer = 0;
      }
    }
  }

  /**
   * Renderiza el Toast animado de logro en la parte superior central de la pantalla.
   * Utiliza slide-in vertical con rebote suave e iluminación pixel art dorada.
   */
  renderToast(ctx) {
    if (!this.currentToast) return;

    const toastW = 196;
    const toastH = 26;
    const targetY = 8;
    const offscreenY = -toastH - 4;

    // Calcular posición Y con interpolación suave
    let currentY = targetY;
    if (this.toastTimer < this.toastSlideDuration) {
      // Slide-in hacia abajo
      const progress = this.toastTimer / this.toastSlideDuration;
      // Curva easeOutBack
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const ease = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
      currentY = offscreenY + (targetY - offscreenY) * ease;
    } else if (this.toastTimer > this.toastDuration - this.toastSlideDuration) {
      // Slide-out hacia arriba
      const progress = (this.toastTimer - (this.toastDuration - this.toastSlideDuration)) / this.toastSlideDuration;
      const ease = progress * progress;
      currentY = targetY + (offscreenY - targetY) * ease;
    }

    const currentX = Math.round((this.viewportWidth - toastW) / 2);
    const drawY = Math.round(currentY);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Sombra del toast
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(currentX + 2, drawY + 2, toastW, toastH);

    // Fondo del Toast
    ctx.fillStyle = '#0b101d';
    ctx.fillRect(currentX, drawY, toastW, toastH);

    // Marco con doble línea dorada / cian
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(currentX + 1, drawY + 1, toastW - 2, toastH - 2);
    ctx.fillStyle = '#111827';
    ctx.fillRect(currentX + 2, drawY + 2, toastW - 4, toastH - 4);

    // Cantoneras brillantes pixeladas
    ctx.fillStyle = '#fde047';
    ctx.fillRect(currentX + 2, drawY + 2, 3, 2);
    ctx.fillRect(currentX + 2, drawY + 2, 2, 3);
    ctx.fillRect(currentX + toastW - 5, drawY + 2, 3, 2);
    ctx.fillRect(currentX + toastW - 4, drawY + 2, 2, 3);
    ctx.fillRect(currentX + 2, drawY + toastH - 4, 3, 2);
    ctx.fillRect(currentX + 2, drawY + toastH - 5, 2, 3);
    ctx.fillRect(currentX + toastW - 5, drawY + toastH - 4, 3, 2);
    ctx.fillRect(currentX + toastW - 4, drawY + toastH - 5, 2, 3);

    // Icono decorativo del trofeo / medalla
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆', currentX + 14, drawY + 13);

    // Cabecera "¡LOGRO DESBLOQUEADO!"
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 5px monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('¡LOGRO DESBLOQUEADO!', currentX + 26, drawY + 4.5);

    // Título del logro
    ctx.font = 'bold 6px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(this.currentToast.title, currentX + 26, drawY + 11.5);

    // Descripción corta
    ctx.font = '4.5px monospace';
    ctx.fillStyle = '#cbd5e1';
    let desc = this.currentToast.description;
    if (desc.length > 38) {
      desc = desc.substring(0, 37) + '…';
    }
    ctx.fillText(desc, currentX + 26, drawY + 18.5);

    ctx.restore();
  }
}

