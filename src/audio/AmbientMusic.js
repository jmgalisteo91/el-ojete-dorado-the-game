/**
 * Sintetizador Melódico Ambiental (Web Audio API nativa, sin archivos externos).
 * Compone y reproduce en bucle una melodía pastoral estilo RPG 16-bits
 * (acordes arpegiados de laúd/arpa + flauta dulce melódica + bajo suave).
 * Incluye una variación cómica menor cuando el jugador está en la cárcel.
 */
export class AmbientMusic {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.isMuted = false;
    this.volume = 0.85;
    this.mode = 'title'; // 'title' | 'village' | 'jail'

    this.stepIndex = 0;
    this.timerId = null;
    this.stepDurationMs = 272; // ~110 BPM (Menú de Inicio chiptune)
    this.savedAmbientMode = null;
    this.currentBossTrack = null;

    // Frecuencias en Hz de notas musicales
    this.NOTES = {
      D2: 73.42, Eb2: 77.78, E2: 82.41, F2: 87.31, 'F#2': 92.50, G2: 98.00, Ab2: 103.83, A2: 110.00, Bb2: 116.54, B2: 123.47,
      C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, 'F#3': 185.00, G3: 196.00, Ab3: 207.65, A3: 220.00, Bb3: 233.08, B3: 246.94,
      C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, 'F#4': 369.99, G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
      C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, 'F#5': 739.99, G5: 783.99, Ab5: 830.61, A5: 880.00, Bb5: 932.33, B5: 987.77,
      C6: 1046.50, D6: 1174.66, Eb6: 1244.51, E6: 1318.51, G6: 1567.98,
      REST: 0
    };

    const N = this.NOTES;

    // Tema épico, nostálgico y misterioso del Menú de Inicio (theme_title_screen)
    // Tempo: 110 BPM (~272ms). Arpegio ascendente introductorio + melodía solemne de RPG clásico.
    this.titlePattern = [
      // 1. Arpegio ascendente introductorio (Re menor místico)
      { melody: N.REST, arp: N.D3, bass: N.D2, dur: 1, wave: 'triangle', arpWave: 'sine' },
      { melody: N.REST, arp: N.A3, bass: N.D2, dur: 1, wave: 'triangle', arpWave: 'sine' },
      { melody: N.REST, arp: N.D4, bass: N.D2, dur: 1, wave: 'triangle', arpWave: 'sine' },
      { melody: N.D5,   arp: N.F4, bass: N.D2, dur: 2, wave: 'square',   arpWave: 'sine' },
      { melody: N.A5,   arp: N.A4, bass: N.REST, dur: 2, wave: 'square',   arpWave: 'sine' },
      { melody: N.G5,   arp: N.E4, bass: N.REST, dur: 1, wave: 'square',   arpWave: 'sine' },
      { melody: N.F5,   arp: N.D4, bass: N.D3, dur: 2, wave: 'square',   arpWave: 'sine' },
      { melody: N.E5,   arp: N.A3, bass: N.REST, dur: 1, wave: 'square',   arpWave: 'sine' },

      // 2. Frase solemne épica (Sib Mayor -> Do Mayor -> Re menor)
      { melody: N.D5,   arp: N.F3, bass: N.Bb2, dur: 2, wave: 'square',   arpWave: 'triangle' },
      { melody: N.F5,   arp: N.Bb3,bass: N.REST, dur: 1, wave: 'square',   arpWave: 'triangle' },
      { melody: N.G5,   arp: N.D4, bass: N.REST, dur: 2, wave: 'square',   arpWave: 'triangle' },
      { melody: N.E5,   arp: N.G3, bass: N.C3, dur: 2, wave: 'square',   arpWave: 'triangle' },
      { melody: N.F5,   arp: N.C4, bass: N.REST, dur: 1, wave: 'square',   arpWave: 'triangle' },
      { melody: N.D5,   arp: N.A3, bass: N.D3, dur: 3, wave: 'square',   arpWave: 'sine' },
      { melody: N.C5,   arp: N.F4, bass: N.REST, dur: 1, wave: 'square',   arpWave: 'sine' },
      { melody: N.D5,   arp: N.D4, bass: N.D2, dur: 3, wave: 'square',   arpWave: 'sine' }
    ];

    // Partitura pastoral en bucle de 32 pasos (Do Mayor / La menor melódica estilo aldea RPG)
    this.villagePattern = [
      // Compás 1: Acorde Cmaj7
      { melody: N.E5,  arp: N.C4, bass: N.C3, dur: 2 },
      { melody: N.REST, arp: N.E4, bass: N.REST, dur: 1 },
      { melody: N.G5,  arp: N.G4, bass: N.REST, dur: 2 },
      { melody: N.E5,  arp: N.B4, bass: N.REST, dur: 1 },
      { melody: N.D5,  arp: N.G4, bass: N.G3, dur: 2 },
      { melody: N.C5,  arp: N.E4, bass: N.REST, dur: 2 },
      { melody: N.REST, arp: N.C4, bass: N.REST, dur: 1 },
      { melody: N.D5,  arp: N.E4, bass: N.REST, dur: 1 },

      // Compás 2: Acorde Am7
      { melody: N.E5,  arp: N.A3, bass: N.A3, dur: 3 },
      { melody: N.REST, arp: N.C4, bass: N.REST, dur: 1 },
      { melody: N.REST, arp: N.E4, bass: N.REST, dur: 1 },
      { melody: N.C5,  arp: N.G4, bass: N.REST, dur: 1 },
      { melody: N.A4,  arp: N.E4, bass: N.E3, dur: 2 },
      { melody: N.G4,  arp: N.C4, bass: N.REST, dur: 2 },
      { melody: N.REST, arp: N.A3, bass: N.REST, dur: 1 },
      { melody: N.A4,  arp: N.C4, bass: N.REST, dur: 1 },

      // Compás 3: Acorde Fmaj7 -> Dm7
      { melody: N.C5,  arp: N.F3, bass: N.F3, dur: 2 },
      { melody: N.REST, arp: N.A3, bass: N.REST, dur: 1 },
      { melody: N.D5,  arp: N.C4, bass: N.REST, dur: 2 },
      { melody: N.C5,  arp: N.E4, bass: N.REST, dur: 1 },
      { melody: N.A4,  arp: N.D4, bass: N.D3, dur: 2 },
      { melody: N.F5,  arp: N.F4, bass: N.REST, dur: 2 },
      { melody: N.E5,  arp: N.A4, bass: N.REST, dur: 1 },
      { melody: N.D5,  arp: N.F4, bass: N.REST, dur: 1 },

      // Compás 4: Acorde G7 -> resolución dulce
      { melody: N.D5,  arp: N.G3, bass: N.G3, dur: 2 },
      { melody: N.B4,  arp: N.B3, bass: N.REST, dur: 2 },
      { melody: N.G4,  arp: N.D4, bass: N.REST, dur: 2 },
      { melody: N.A4,  arp: N.F4, bass: N.G3, dur: 1 },
      { melody: N.B4,  arp: N.D4, bass: N.REST, dur: 1 },
      { melody: N.C5,  arp: N.E4, bass: N.C3, dur: 3 },
      { melody: N.REST, arp: N.G4, bass: N.REST, dur: 1 },
      { melody: N.REST, arp: N.C4, bass: N.REST, dur: 1 }
    ];

    // Variación cómica en Do menor cuando el jugador está arrestado en la cárcel
    this.jailPattern = [
      { melody: N.C4,  arp: N.C3, bass: N.C3, dur: 2 },
      { melody: N.Eb4, arp: N.G3, bass: N.REST, dur: 2 },
      { melody: N.G4,  arp: N.C4, bass: N.G3, dur: 2 },
      { melody: N.Ab4, arp: N.Eb4, bass: N.REST, dur: 1 },
      { melody: N.G4,  arp: N.C4, bass: N.C3, dur: 3 },
      { melody: N.REST, arp: N.G3, bass: N.REST, dur: 1 },
      { melody: N.F4,  arp: N.Ab4, bass: N.F3, dur: 2 },
      { melody: N.Eb4, arp: N.F4, bass: N.REST, dur: 2 },
      { melody: N.D4,  arp: N.G3, bass: N.G3, dur: 2 },
      { melody: N.C4,  arp: N.Eb4, bass: N.C3, dur: 3 },
      { melody: N.REST, arp: N.G3, bass: N.REST, dur: 1 }
    ];

    // Partitura emotiva y solemne (escena del Sabio Aurelio sobre Mister AI Alex y El Ojete Dorado)
    this.emotionalPattern = [
      { melody: N.E5,  arp: N.A3, bass: N.A2, dur: 3 },
      { melody: N.REST, arp: N.C4, bass: N.REST, dur: 1 },
      { melody: N.C5,  arp: N.E4, bass: N.REST, dur: 2 },
      { melody: N.B4,  arp: N.A4, bass: N.REST, dur: 2 },
      { melody: N.A4,  arp: N.F3, bass: N.F3, dur: 3 },
      { melody: N.REST, arp: N.A3, bass: N.REST, dur: 1 },
      { melody: N.C5,  arp: N.C4, bass: N.REST, dur: 2 },
      { melody: N.D5,  arp: N.F4, bass: N.D3, dur: 2 },
      { melody: N.E5,  arp: N.G3, bass: N.G3, dur: 3 },
      { melody: N.REST, arp: N.B3, bass: N.REST, dur: 1 },
      { melody: N.D5,  arp: N.D4, bass: N.REST, dur: 2 },
      { melody: N.B4,  arp: N.G4, bass: N.E3, dur: 2 },
      { melody: N.A4,  arp: N.A3, bass: N.A2, dur: 4 }
    ];

    // Partitura lúgubre y tensa para Ruinas y Mazmorras hostiles (dungeon_hostile / stage1)
    // Tempo: 120 BPM (~250ms). Tono cavernoso en La menor con notas staccato y bajo sombrío.
    this.stage1Pattern = [
      { melody: N.A4,  arp: N.A3, bass: N.A2, dur: 2, wave: 'triangle', arpWave: 'square', snare: true },
      { melody: N.REST,arp: N.E4, bass: N.REST,dur: 1, wave: 'triangle', arpWave: 'square' },
      { melody: N.C5,  arp: N.A3, bass: N.REST,dur: 1, wave: 'triangle', arpWave: 'square' },
      { melody: N.E5,  arp: N.C4, bass: N.A2, dur: 2, wave: 'triangle', arpWave: 'square', kick: true },
      { melody: N.D5,  arp: N.F4, bass: N.D3, dur: 2, wave: 'triangle', arpWave: 'square', snare: true },
      { melody: N.C5,  arp: N.D4, bass: N.REST,dur: 1, wave: 'triangle', arpWave: 'square' },
      { melody: N.B4,  arp: N.E4, bass: N.E3, dur: 2, wave: 'triangle', arpWave: 'square' },
      { melody: N.REST,arp: N.B3, bass: N.REST,dur: 1, wave: 'triangle', arpWave: 'square' },

      { melody: N.C5,  arp: N.A3, bass: N.A2, dur: 2, wave: 'triangle', arpWave: 'square', kick: true },
      { melody: N.D5,  arp: N.F4, bass: N.REST,dur: 1, wave: 'triangle', arpWave: 'square' },
      { melody: N.E5,  arp: N.G4, bass: N.C3, dur: 2, wave: 'triangle', arpWave: 'square', snare: true },
      { melody: N.F5,  arp: N.A4, bass: N.D3, dur: 2, wave: 'triangle', arpWave: 'square' },
      { melody: N.E5,  arp: N.G4, bass: N.E3, dur: 2, wave: 'triangle', arpWave: 'square', kick: true },
      { melody: N.D5,  arp: N.F4, bass: N.REST,dur: 1, wave: 'triangle', arpWave: 'square' },
      { melody: N.B4,  arp: N.E4, bass: N.E2, dur: 2, wave: 'triangle', arpWave: 'square', snare: true },
      { melody: N.A4,  arp: N.C4, bass: N.A2, dur: 3, wave: 'triangle', arpWave: 'square' }
    ];

    // Tema de Mister AI Alex (theme_main_villain / villain)
    // Tono opresivo, cibernético y amenazante a 145 BPM (~207ms).
    // Bajo pesado en 'sawtooth' distorsionado, pulsos de sobrecalentamiento y pausas con glitches.
    this.villainPattern = [
      { bass: N.C2,   arp: N['F#3'], melody: N.C5,   dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', kick: true },
      { bass: N.C2,   arp: N.C3,     melody: N.REST, dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', pulse: true },
      { bass: N.Eb2,  arp: N['F#3'], melody: N['F#5'],dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', snare: true },
      { bass: N.C2,   arp: N.Eb3,    melody: N.G5,   dur: 1, wave: 'sawtooth', arpWave: 'sawtooth' },
      { bass: N['F#2'],arp: N.C4,    melody: N.Eb5,  dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', kick: true },
      { bass: N.G2,   arp: N.REST,   melody: N.REST, dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', glitch: true },
      { bass: N.C2,   arp: N['F#3'], melody: N.C5,   dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', kick: true },
      { bass: N.D2,   arp: N.Eb3,    melody: N.REST, dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', snare: true },

      { bass: N.C2,   arp: N['F#3'], melody: N.G5,   dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', kick: true },
      { bass: N.C2,   arp: N.C3,     melody: N['F#5'],dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', pulse: true },
      { bass: N.Eb2,  arp: N.Eb3,    melody: N.REST, dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', snare: true },
      { bass: N['F#2'],arp: N['F#3'],melody: N.C6,   dur: 1, wave: 'sawtooth', arpWave: 'sawtooth' },
      { bass: N.G2,   arp: N.REST,   melody: N.REST, dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', glitch: true },
      { bass: N.Eb2,  arp: N.C4,     melody: N.Eb5,  dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', kick: true },
      { bass: N.D2,   arp: N['F#3'], melody: N.D5,   dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', snare: true },
      { bass: N.C2,   arp: N.C3,     melody: N.REST, dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', glitch: true }
    ];

    // =========================================================================
    // TEMAS DE MINI-JEFES PROCEDURALES (Web Audio API Chiptune)
    // =========================================================================

    // 1. Tema para "Garbage Collector" ('track_garbage_collector')
    // Tono industrial, sucio y pesado. Línea de bajo en 'sawtooth' (135 BPM, ~222ms)
    // y arpegios disonantes de tensión de memoria (trítono D-Ab).
    this.garbageCollectorPattern = [
      { bass: N.D2,  arp: N.Ab3, melody: N.D4,  dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', kick: true },
      { bass: N.D2,  arp: N.D3,  melody: N.REST, dur: 1, wave: 'sawtooth', arpWave: 'sawtooth' },
      { bass: N.F2,  arp: N.F3,  melody: N.F4,  dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', snare: true },
      { bass: N.D2,  arp: N.Ab3, melody: N.Ab4, dur: 1, wave: 'sawtooth', arpWave: 'sawtooth' },
      { bass: N.Ab2, arp: N.D4,  melody: N.G4,  dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', kick: true },
      { bass: N.G2,  arp: N.F3,  melody: N.F4,  dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', snare: true },
      { bass: N.D2,  arp: N.D3,  melody: N.D4,  dur: 1, wave: 'sawtooth', arpWave: 'sawtooth' },
      { bass: N.Eb2, arp: N.Ab3, melody: N.Eb4, dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', snare: true },

      { bass: N.D2,  arp: N.Ab3, melody: N.D5,  dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', kick: true },
      { bass: N.D2,  arp: N.D3,  melody: N.Ab4, dur: 1, wave: 'sawtooth', arpWave: 'sawtooth' },
      { bass: N.F2,  arp: N.F3,  melody: N.F4,  dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', snare: true },
      { bass: N.Ab2, arp: N.Ab3, melody: N.D4,  dur: 1, wave: 'sawtooth', arpWave: 'sawtooth' },
      { bass: N.G2,  arp: N.D4,  melody: N.F4,  dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', kick: true },
      { bass: N.F2,  arp: N.G3,  melody: N.Ab4, dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', snare: true },
      { bass: N.Eb2, arp: N.Eb3, melody: N.G4,  dur: 1, wave: 'sawtooth', arpWave: 'sawtooth' },
      { bass: N.C3,  arp: N.Ab3, melody: N.D4,  dur: 1, wave: 'sawtooth', arpWave: 'sawtooth', snare: true }
    ];

    // 2. Tema para "Guardián del Stack Overflow" ('track_stack_overflow')
    // Melodía recursiva y acelerada. Onda cuadrada 'square' a 150 BPM (~200ms)
    // con escalas ascendentes continuas en bucle fractal y sensación de desbordamiento.
    this.stackOverflowPattern = [
      { bass: N.C3,  arp: N.C4,  melody: N.C5,  dur: 1, wave: 'square', arpWave: 'square', kick: true },
      { bass: N.C3,  arp: N.Eb4, melody: N.Eb5, dur: 1, wave: 'square', arpWave: 'square' },
      { bass: N.Eb3, arp: N.G4,  melody: N.G5,  dur: 1, wave: 'square', arpWave: 'square', snare: true },
      { bass: N.C3,  arp: N.Bb4, melody: N.Bb5, dur: 1, wave: 'square', arpWave: 'square' },
      { bass: N.F3,  arp: N.C5,  melody: N.C6,  dur: 1, wave: 'square', arpWave: 'square', kick: true },
      { bass: N.Eb3, arp: N.D5,  melody: N.D6,  dur: 1, wave: 'square', arpWave: 'square', snare: true },
      { bass: N.D3,  arp: N.Eb5, melody: N.Eb6, dur: 1, wave: 'square', arpWave: 'square' },
      { bass: N.G3,  arp: N.G5,  melody: N.G6,  dur: 1, wave: 'square', arpWave: 'square', snare: true },

      { bass: N.C3,  arp: N.Bb5, melody: N.Eb5, dur: 1, wave: 'square', arpWave: 'square', kick: true },
      { bass: N.G2,  arp: N.G5,  melody: N.D5,  dur: 1, wave: 'square', arpWave: 'square' },
      { bass: N.Ab2, arp: N.F5,  melody: N.C5,  dur: 1, wave: 'square', arpWave: 'square', snare: true },
      { bass: N.Bb2, arp: N.Eb5, melody: N.Bb4, dur: 1, wave: 'square', arpWave: 'square' },
      { bass: N.C3,  arp: N.D5,  melody: N.Ab4, dur: 1, wave: 'square', arpWave: 'square', kick: true },
      { bass: N.D3,  arp: N.C5,  melody: N.G4,  dur: 1, wave: 'square', arpWave: 'square', snare: true },
      { bass: N.Eb3, arp: N.Bb4, melody: N.F4,  dur: 1, wave: 'square', arpWave: 'square' },
      { bass: N.G3,  arp: N.G4,  melody: N.C5,  dur: 1, wave: 'square', arpWave: 'square', snare: true }
    ];

    // 3. Tema para "Microondas Prototipo V0.1" ('track_prototype_microwave')
    // Ritmo entrecortado y caótico. Mezcla de pulsos agudos electrónicos (pitidos de electrodoméstico estropeado)
    // a 140 BPM (~214ms) sobre percusión sintética constante.
    this.prototypeMicrowavePattern = [
      { bass: N.E2,  arp: N.E3,  melody: 1760,  dur: 1, wave: 'sawtooth', arpWave: 'square', kick: true,  beep: true },
      { bass: N.E2,  arp: N.REST,melody: 2093,  dur: 1, wave: 'sawtooth', arpWave: 'square', beep: true },
      { bass: N.G2,  arp: N.E4,  melody: N.REST,dur: 1, wave: 'sawtooth', arpWave: 'square', snare: true },
      { bass: N.E2,  arp: N.G3,  melody: 2349,  dur: 1, wave: 'sawtooth', arpWave: 'square', beep: true },
      { bass: N.Bb2, arp: N.Bb3, melody: 1760,  dur: 1, wave: 'sawtooth', arpWave: 'square', kick: true,  beep: true },
      { bass: N.A2,  arp: N.REST,melody: N.REST,dur: 1, wave: 'sawtooth', arpWave: 'square', snare: true },
      { bass: N.G2,  arp: N.D4,  melody: 2637,  dur: 1, wave: 'sawtooth', arpWave: 'square', beep: true },
      { bass: N.F2,  arp: N.REST,melody: 1975,  dur: 1, wave: 'sawtooth', arpWave: 'square', snare: true, beep: true },

      { bass: N.E2,  arp: N.E3,  melody: 1760,  dur: 1, wave: 'sawtooth', arpWave: 'square', kick: true,  beep: true },
      { bass: N.E2,  arp: N.Bb3, melody: 1975,  dur: 1, wave: 'sawtooth', arpWave: 'square', beep: true },
      { bass: N.G2,  arp: N.E4,  melody: N.REST,dur: 1, wave: 'sawtooth', arpWave: 'square', snare: true },
      { bass: N.Bb2, arp: N.REST,melody: 2349,  dur: 1, wave: 'sawtooth', arpWave: 'square', beep: true },
      { bass: N.B2,  arp: N.F4,  melody: 2793,  dur: 1, wave: 'sawtooth', arpWave: 'square', kick: true,  beep: true },
      { bass: N.Bb2, arp: N.REST,melody: 2093,  dur: 1, wave: 'sawtooth', arpWave: 'square', snare: true, beep: true },
      { bass: N.G2,  arp: N.E3,  melody: 1567,  dur: 1, wave: 'sawtooth', arpWave: 'square', beep: true },
      { bass: N.F2,  arp: N.D3,  melody: N.REST,dur: 1, wave: 'sawtooth', arpWave: 'square', snare: true }
    ];

    // 4. Tema Triunfal de Victoria y Créditos Finales ('victory' / 'theme_victory_credits')
    // Tono: Heroico, festivo y celebratorio. Progresión C -> G -> Am -> F con fanfarrias brillantes
    // en onda 'square' y 'triangle', bajo rítmico y percusión festiva a 125 BPM (~240ms).
    this.victoryCreditsPattern = [
      // Frase 1: C Mayor (Do - Mi - Sol - Do)
      { bass: N.C3,  arp: N.C4,  melody: N.C5,  dur: 1, wave: 'square', arpWave: 'triangle', kick: true },
      { bass: N.C3,  arp: N.E4,  melody: N.E5,  dur: 1, wave: 'square', arpWave: 'triangle' },
      { bass: N.G2,  arp: N.G4,  melody: N.G5,  dur: 1, wave: 'square', arpWave: 'triangle', snare: true },
      { bass: N.C3,  arp: N.C5,  melody: N.C6,  dur: 1, wave: 'square', arpWave: 'triangle' },

      // Frase 2: G Mayor (Sol - Si - Re - Sol)
      { bass: N.G2,  arp: N.G3,  melody: N.D5,  dur: 1, wave: 'square', arpWave: 'triangle', kick: true },
      { bass: N.G2,  arp: N.B3,  melody: N.G5,  dur: 1, wave: 'square', arpWave: 'triangle' },
      { bass: N.D3,  arp: N.D4,  melody: N.B5,  dur: 1, wave: 'square', arpWave: 'triangle', snare: true },
      { bass: N.G2,  arp: N.G4,  melody: N.D6,  dur: 1, wave: 'square', arpWave: 'triangle' },

      // Frase 3: La menor (La - Do - Mi - La)
      { bass: N.A2,  arp: N.A3,  melody: N.C5,  dur: 1, wave: 'square', arpWave: 'triangle', kick: true },
      { bass: N.A2,  arp: N.C4,  melody: N.E5,  dur: 1, wave: 'square', arpWave: 'triangle' },
      { bass: N.E3,  arp: N.E4,  melody: N.A5,  dur: 1, wave: 'square', arpWave: 'triangle', snare: true },
      { bass: N.A2,  arp: N.A4,  melody: N.C6,  dur: 1, wave: 'square', arpWave: 'triangle' },

      // Frase 4: Fa Mayor (Fa - La - Do - Fa) -> Resolución
      { bass: N.F2,  arp: N.F3,  melody: N.F5,  dur: 1, wave: 'square', arpWave: 'triangle', kick: true },
      { bass: N.F2,  arp: N.A3,  melody: N.A5,  dur: 1, wave: 'square', arpWave: 'triangle' },
      { bass: N.C3,  arp: N.C4,  melody: N.C6,  dur: 1, wave: 'square', arpWave: 'triangle', snare: true },
      { bass: N.F2,  arp: N.F4,  melody: N.G6,  dur: 1, wave: 'square', arpWave: 'triangle' }
    ];
  }

  /**
   * Inicializa y desbloquea el AudioContext en la primera interacción del usuario.
   */
  unlockAndStart() {
    if (this.isPlaying) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    this.musicGain.connect(this.ctx.destination);

    this.isPlaying = true;
    this.stepIndex = 0;

    this._scheduleLoop();
  }

  /**
   * Desconecta automáticamente los nodos Web Audio tras finalizar un oscilador
   * para evitar acumulación de referencias en el grafo de audio (Memory Leaks).
   */
  _autoDisconnect(osc, ...nodes) {
    if (!osc) return;
    osc.onended = () => {
      try {
        osc.disconnect();
      } catch {}
      for (const n of nodes) {
        if (n) {
          try {
            n.disconnect();
          } catch {}
        }
      }
    };
  }

  /**
   * Cambia de modo musical con transición suave de fade-out y fade-in (300-500ms).
   */
  setMode(mode, fadeMs = 350) {
    const normalizedMode =
      mode === 'theme_title_screen' ? 'title' :
      mode === 'theme_main_villain' ? 'villain' :
      mode === 'overworld' ? 'village' :
      mode === 'dungeon_hostile' ? 'stage1' :
      mode;

    if (this._fadeTimeout) {
      clearTimeout(this._fadeTimeout);
      this._fadeTimeout = null;
    }

    const isImmediateSilence =
      normalizedMode === 'game_over' ||
      normalizedMode === 'silent' ||
      normalizedMode === 'none';

    if (this.mode === normalizedMode) {
      if (this.ctx && this.musicGain && !isImmediateSilence) {
        const now = this.ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, now);
      }
      return;
    }

    if (isImmediateSilence) {
      this._applyMode(normalizedMode);
      return;
    }

    if (
      this.ctx &&
      this.musicGain &&
      this.isPlaying &&
      fadeMs > 50 &&
      this.mode !== 'silent' &&
      this.mode !== 'none' &&
      this.mode !== 'game_over'
    ) {
      const now = this.ctx.currentTime;
      const fadeSec = fadeMs / 1000;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);

      this._fadeTimeout = setTimeout(() => {
        this._fadeTimeout = null;
        this._applyMode(normalizedMode);
        if (this.ctx && this.musicGain && !this.isMuted && normalizedMode !== 'silent' && normalizedMode !== 'game_over') {
          const inNow = this.ctx.currentTime;
          this.musicGain.gain.cancelScheduledValues(inNow);
          this.musicGain.gain.setValueAtTime(0.0001, inNow);
          this.musicGain.gain.linearRampToValueAtTime(this.volume, inNow + fadeSec);
        }
      }, fadeMs);
    } else {
      this._applyMode(normalizedMode);
      if (this.ctx && this.musicGain) {
        const now = this.ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, now);
      }
    }
  }

  _applyMode(mode) {
    this.mode = mode;
    this.stepIndex = 0;
    if (mode === 'title' || mode === 'theme_title_screen') {
      this.stepDurationMs = 272; // ~110 BPM (Menú de Inicio chiptune solemne)
    } else if (mode === 'villain' || mode === 'theme_main_villain') {
      this.stepDurationMs = 207; // ~145 BPM (Mister AI Alex cibernético)
    } else if (mode === 'track_garbage_collector') {
      this.stepDurationMs = 222; // ~135 BPM
    } else if (mode === 'track_stack_overflow') {
      this.stepDurationMs = 200; // ~150 BPM
    } else if (mode === 'track_prototype_microwave') {
      this.stepDurationMs = 214; // ~140 BPM
    } else if (mode === 'stage1' || mode === 'dungeon_hostile') {
      this.stepDurationMs = 250; // ~120 BPM (Ruinas / Mazmorras hostiles)
    } else if (mode === 'victory' || mode === 'theme_victory_credits') {
      this.stepDurationMs = 240; // ~125 BPM (Tema Triunfal de Victoria y Créditos)
    } else {
      this.stepDurationMs = 260; // ~115 BPM (Valleverde / Pastoral)
    }
    if (this.isPlaying) {
      this._scheduleLoop();
    }
  }

  /**
   * Detiene limpiamente la música del menú de título al iniciar partida.
   */
  stopTitleMusic(fadeMs = 380) {
    if (this.mode === 'title' || this.mode === 'theme_title_screen') {
      this.setMode('silent', fadeMs);
    }
  }

  playBossMusic(trackName) {
    if (this.currentBossTrack === trackName && this.isPlaying) return;
    if (!this.currentBossTrack && this.mode !== trackName) {
      this.savedAmbientMode = this.mode;
    }
    this.currentBossTrack = trackName;
    this.setMode(trackName);
  }

  stopBossMusic(playFanfare = true) {
    if (!this.currentBossTrack) return;
    this.currentBossTrack = null;
    if (playFanfare) {
      this.playBossVictoryFanfare();
    }
    const restoreMode = this.savedAmbientMode || 'village';
    this.savedAmbientMode = null;
    this.setMode(restoreMode);
  }

  /**
   * Reproduce el tema triunfal de victoria y créditos finales.
   */
  playVictoryTheme(fadeMs = 350) {
    this.currentBossTrack = null;
    this.savedAmbientMode = null;
    this.setMode('victory', fadeMs);
  }

  playBossVictoryFanfare() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    // Fanfarria retro de victoria: 3 notas en tono mayor (C5, E5, G5) y acorde sostenido final C6
    const fanfareNotes = [523.25, 659.25, 783.99, 1046.50];
    fanfareNotes.forEach((f, idx) => {
      this._playTone({
        freq: f,
        type: 'triangle',
        startTime: now + idx * 0.12,
        duration: idx === fanfareNotes.length - 1 ? 0.65 : 0.11,
        peakGain: 0.08 * this.volume,
        attack: 0.008,
        vibrato: idx === fanfareNotes.length - 1
      });
    });
  }

  playDashSound() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(460, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.14);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.075 * this.volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    this._autoDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playChargedAttack() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.28);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09 * this.volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    this._autoDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  playAbyssalPortalSound() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    // Acorde místico y etéreo ascendente con oscilador de senos/triángulos
    const freqs = [146.83, 220.00, 329.63, 440.00, 659.25, 880.00];
    freqs.forEach((freq, idx) => {
      this._playTone({
        freq,
        type: 'sine',
        startTime: now + idx * 0.08,
        duration: 0.85,
        peakGain: 0.055 * this.volume,
        attack: 0.05,
        vibrato: true
      });
      this._playTone({
        freq: freq * 0.5,
        type: 'triangle',
        startTime: now + idx * 0.08,
        duration: 0.95,
        peakGain: 0.04 * this.volume,
        attack: 0.08,
        vibrato: false
      });
    });
  }

  playBarrier() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    this._playTone({
      freq: 587.33,
      type: 'sine',
      startTime: now,
      duration: 0.18,
      peakGain: 0.07 * this.volume,
      attack: 0.01,
      vibrato: true
    });
    this._playTone({
      freq: 1174.66,
      type: 'triangle',
      startTime: now + 0.04,
      duration: 0.28,
      peakGain: 0.05 * this.volume,
      attack: 0.02,
      vibrato: true
    });
  }

  playMetalClink() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    this._playTone({
      freq: 1200,
      type: 'square',
      startTime: now,
      duration: 0.06,
      peakGain: 0.05 * this.volume,
      attack: 0.002,
      vibrato: false
    });
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.isMuted = this.volume === 0;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  toggleMute() {
    if (!this.isPlaying) {
      this.unlockAndStart();
      this.isMuted = false;
      return this.isMuted;
    }
    this.isMuted = !this.isMuted;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  playMenuMove() {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
      return;
    }
    const now = this.ctx.currentTime;
    this._playTone({
      freq: 523.25,
      type: 'triangle',
      startTime: now,
      duration: 0.045,
      peakGain: 0.045 * this.volume,
      attack: 0.005,
      vibrato: false
    });
  }

  playMenuSelect() {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
      return;
    }
    const now = this.ctx.currentTime;
    this._playTone({
      freq: 587.33,
      type: 'triangle',
      startTime: now,
      duration: 0.06,
      peakGain: 0.055 * this.volume,
      attack: 0.005,
      vibrato: false
    });
    this._playTone({
      freq: 880.0,
      type: 'triangle',
      startTime: now + 0.055,
      duration: 0.12,
      peakGain: 0.055 * this.volume,
      attack: 0.005,
      vibrato: false
    });
  }

  playFanfare() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 587.33, 659.25, 783.99];
    notes.forEach((f, idx) => {
      this._playTone({
        freq: f,
        type: 'triangle',
        startTime: now + idx * 0.11,
        duration: idx === notes.length - 1 ? 0.38 : 0.1,
        peakGain: 0.065 * this.volume,
        attack: 0.01,
        vibrato: idx === notes.length - 1
      });
    });
  }

  playSwordSlash() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.09);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.06 * this.volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    this._autoDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playHitHurt() {
    this.playEnemyHit();
  }

  /**
   * Sonido de apertura/cierre de puerta (crujido de madera/piedra + pestillo metálico).
   */
  playDoorOpenSound() {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    const now = this.ctx.currentTime;
    // Clic del pestillo inicial
    this._playTone({
      freq: 520,
      type: 'square',
      startTime: now,
      duration: 0.04,
      peakGain: 0.045 * this.volume,
      attack: 0.003,
      vibrato: false
    });
    // Crujido grave de bisagra/madera abriéndose
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, now + 0.03);
    osc.frequency.linearRampToValueAtTime(210, now + 0.14);
    osc.frequency.linearRampToValueAtTime(165, now + 0.24);
    gain.gain.setValueAtTime(0.001, now + 0.03);
    gain.gain.linearRampToValueAtTime(0.055 * this.volume, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    this._autoDisconnect(osc, gain);
    osc.start(now + 0.03);
    osc.stop(now + 0.26);
  }

  /**
   * Sonido de puerta cerrada con llave o barrera sellada (golpe seco doble).
   */
  playDoorLockedSound() {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    const now = this.ctx.currentTime;
    this._playTone({
      freq: 135,
      type: 'square',
      startTime: now,
      duration: 0.07,
      peakGain: 0.065 * this.volume,
      attack: 0.003,
      vibrato: false
    });
    this._playTone({
      freq: 110,
      type: 'square',
      startTime: now + 0.08,
      duration: 0.11,
      peakGain: 0.065 * this.volume,
      attack: 0.003,
      vibrato: false
    });
  }

  /**
   * Sonido clásico RPG al abrir un cofre del tesoro (pestillo + arpegio brillante).
   */
  playChestOpenSound() {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    const now = this.ctx.currentTime;
    // 1. Pestillo y tapa de madera del cofre
    this._playTone({
      freq: 180,
      type: 'sawtooth',
      startTime: now,
      duration: 0.08,
      peakGain: 0.055 * this.volume,
      attack: 0.004,
      vibrato: false
    });
    // 2. Arpegio cristalino ascendente de tesoro descubierto
    const chestNotes = [
      { f: 523.25, t: 0.07, d: 0.09 }, // C5
      { f: 659.25, t: 0.14, d: 0.09 }, // E5
      { f: 783.99, t: 0.21, d: 0.11 }, // G5
      { f: 1046.50, t: 0.29, d: 0.28 } // C6
    ];
    for (const n of chestNotes) {
      this._playTone({
        freq: n.f,
        type: 'triangle',
        startTime: now + n.t,
        duration: n.d,
        peakGain: 0.075 * this.volume,
        attack: 0.005,
        vibrato: false
      });
    }
  }

  /**
   * Sonido breve al recoger un objeto suelto del suelo.
   */
  playItemPickupSound() {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    const now = this.ctx.currentTime;
    this._playTone({
      freq: 587.33,
      type: 'triangle',
      startTime: now,
      duration: 0.07,
      peakGain: 0.06 * this.volume,
      attack: 0.004,
      vibrato: false
    });
    this._playTone({
      freq: 880,
      type: 'triangle',
      startTime: now + 0.06,
      duration: 0.14,
      peakGain: 0.065 * this.volume,
      attack: 0.004,
      vibrato: false
    });
  }

  playEnemyHit() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    this._playTone({
      freq: 280,
      type: 'square',
      startTime: now,
      duration: 0.07,
      peakGain: 0.06 * this.volume,
      attack: 0.004,
      vibrato: false
    });
    this._playTone({
      freq: 460,
      type: 'triangle',
      startTime: now + 0.04,
      duration: 0.09,
      peakGain: 0.05 * this.volume,
      attack: 0.004,
      vibrato: false
    });
  }

  playPlayerHurt() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    this._playTone({
      freq: 195,
      type: 'sawtooth',
      startTime: now,
      duration: 0.14,
      peakGain: 0.075 * this.volume,
      attack: 0.005,
      vibrato: false
    });
    this._playTone({
      freq: 130,
      type: 'sawtooth',
      startTime: now + 0.1,
      duration: 0.22,
      peakGain: 0.075 * this.volume,
      attack: 0.005,
      vibrato: false
    });
  }

  _scheduleLoop() {
    if (this.timerId) clearInterval(this.timerId);

    this.timerId = setInterval(() => {
      if (!this.ctx || this.isMuted || this.volume <= 0) return;
      if (
        this.mode === 'game_over' ||
        this.mode === 'silent' ||
        this.mode === 'none'
      ) {
        return; // Detiene completamente la música ambiental en bucle durante Game Over o silencio
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
        return;
      }

      let pattern;
      if (this.mode === 'track_garbage_collector') {
        pattern = this.garbageCollectorPattern;
      } else if (this.mode === 'track_stack_overflow') {
        pattern = this.stackOverflowPattern;
      } else if (this.mode === 'track_prototype_microwave') {
        pattern = this.prototypeMicrowavePattern;
      } else if (this.mode === 'villain' || this.mode === 'theme_main_villain') {
        pattern = this.villainPattern;
      } else if (this.mode === 'jail') {
        pattern = this.jailPattern;
      } else if (this.mode === 'emotional') {
        pattern = this.emotionalPattern;
      } else if (this.mode === 'stage1' || this.mode === 'dungeon_hostile') {
        pattern = this.stage1Pattern;
      } else if (this.mode === 'victory' || this.mode === 'theme_victory_credits') {
        pattern = this.victoryCreditsPattern;
      } else if (this.mode === 'title' || this.mode === 'theme_title_screen') {
        pattern = this.titlePattern;
      } else {
        pattern = this.villagePattern;
      }

      const step = pattern[this.stepIndex % pattern.length];
      this.stepIndex = (this.stepIndex + 1) % pattern.length;

      const now = this.ctx.currentTime;
      const stepSec = this.stepDurationMs / 1000;
      const v = this.volume;
      const outNode = this.musicGain || this.ctx.destination;

      // Percusión sintetizada procedural en temas de combate y villano
      if (step.kick) {
        const kOsc = this.ctx.createOscillator();
        const kGain = this.ctx.createGain();
        kOsc.type = 'triangle';
        kOsc.frequency.setValueAtTime(140, now);
        kOsc.frequency.exponentialRampToValueAtTime(32, now + 0.08);
        kGain.gain.setValueAtTime(0.09 * v, now);
        kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        kOsc.connect(kGain);
        kGain.connect(outNode);
        this._autoDisconnect(kOsc, kGain);
        kOsc.start(now);
        kOsc.stop(now + 0.095);
      }

      if (step.snare) {
        const sOsc = this.ctx.createOscillator();
        const sGain = this.ctx.createGain();
        sOsc.type = 'sawtooth';
        sOsc.frequency.setValueAtTime(260, now);
        sOsc.frequency.exponentialRampToValueAtTime(80, now + 0.06);
        sGain.gain.setValueAtTime(0.06 * v, now);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        sOsc.connect(sGain);
        sGain.connect(outNode);
        this._autoDisconnect(sOsc, sGain);
        sOsc.start(now);
        sOsc.stop(now + 0.075);
      }

      // Glitch / Pausa abrupta con ruido de sobrecalentamiento de AI Alex
      if (step.glitch) {
        const gOsc = this.ctx.createOscillator();
        const gGain = this.ctx.createGain();
        gOsc.type = 'sawtooth';
        gOsc.frequency.setValueAtTime(380, now);
        gOsc.frequency.linearRampToValueAtTime(1400, now + 0.05);
        gGain.gain.setValueAtTime(0.045 * v, now);
        gGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        gOsc.connect(gGain);
        gGain.connect(outNode);
        this._autoDisconnect(gOsc, gGain);
        gOsc.start(now);
        gOsc.stop(now + 0.065);
      }

      // Pulsos rápidos de sintetizador simulando sobrecalentamiento
      if (step.pulse) {
        const pOsc = this.ctx.createOscillator();
        const pGain = this.ctx.createGain();
        pOsc.type = 'square';
        pOsc.frequency.setValueAtTime(1860, now);
        pGain.gain.setValueAtTime(0.04 * v, now);
        pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        pOsc.connect(pGain);
        pGain.connect(outNode);
        this._autoDisconnect(pOsc, pGain);
        pOsc.start(now);
        pOsc.stop(now + 0.055);
      }

      // 1. Voz Melódica Principal
      if (step.melody > 0) {
        const isBeep = !!step.beep;
        this._playTone({
          freq: step.melody,
          type: step.wave || 'triangle',
          startTime: now,
          duration: isBeep ? 0.065 : stepSec * (step.dur || 1) * 0.92,
          peakGain: (isBeep ? 0.065 : 0.055) * v,
          attack: isBeep ? 0.002 : 0.02,
          vibrato: !isBeep && (step.dur || 1) > 1.5
        });
      }

      // 2. Arpegio / Acompañamiento
      if (step.arp > 0) {
        this._playTone({
          freq: step.arp,
          type: step.arpWave || 'sine',
          startTime: now,
          duration: stepSec * 1.4,
          peakGain: 0.038 * v,
          attack: 0.015,
          vibrato: false
        });
      }

      // 3. Bajo acústico / industrial
      if (step.bass > 0) {
        this._playTone({
          freq: step.bass,
          type: step.wave || 'triangle',
          startTime: now,
          duration: stepSec * (step.wave === 'sawtooth' ? 1.6 : 2.2),
          peakGain: (step.wave === 'sawtooth' ? 0.055 : 0.045) * v,
          attack: step.wave === 'sawtooth' ? 0.008 : 0.02,
          vibrato: false
        });
      }
    }, this.stepDurationMs);
  }

  _playTone({ freq, type, startTime, duration, peakGain, attack, vibrato }) {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    let lfo = null;
    let lfoGain = null;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    // Suave vibrato para las notas largas de la melodía
    if (vibrato && duration > 0.35) {
      lfo = this.ctx.createOscillator();
      lfoGain = this.ctx.createGain();
      lfo.frequency.value = 5.0;
      lfoGain.gain.value = 2.2;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(startTime);
      lfo.stop(startTime + duration);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.musicGain || this.ctx.destination);
    this._autoDisconnect(osc, gain, lfo, lfoGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  /**
   * Reproduce el clásico zumbido/parloteo rápido estilo Animal Crossing (Animalese) / RPG Pixel Art
   * por cada sílaba/letra mientras avanza el texto del cuadro de diálogo.
   * @param {string} speakerName Nombre del NPC para personalizar su timbre y tono de voz
   * @param {string} char Letra actual que se está imprimiendo
   */
  playVoiceBlip(speakerName = '', char = 'a') {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
      return;
    }

    // Ignorar espacios y signos de puntuación para que el ritmo suene como sílabas habladas
    if (!/[a-záéíóúñ0-9]/i.test(char)) return;

    const now = this.ctx.currentTime;

    // Perfil vocal según qué personaje habla
    const nameLower = speakerName.toLowerCase();
    let baseFreq = 310;
    let waveType = 'triangle';

    if (nameLower.includes('aurelio')) {
      baseFreq = 215; // Anciano: voz cálida y grave
      waveType = 'triangle';
    } else if (nameLower.includes('orion')) {
      baseFreq = 440; // Oráculo IA: voz aguda sintética estilo 8-bits
      waveType = 'square';
    } else if (nameLower.includes('brom')) {
      baseFreq = 165; // Herrero: voz muy grave y gruesa
      waveType = 'sawtooth';
    } else if (nameLower.includes('lyra')) {
      baseFreq = 395; // Herbolaria: voz cantarina aguda estilo Animalese
      waveType = 'triangle';
    } else if (nameLower.includes('kael') || nameLower.includes('carcelero') || nameLower.includes('arresto')) {
      baseFreq = 240; // Guardia: voz marcial firme
      waveType = 'square';
    }

    // Variar la frecuencia según la letra para simular entonación de vocales/consonantes
    const code = char.toLowerCase().charCodeAt(0);
    const pitchOffset = ((code * 17) % 90) - 35;
    const startFreq = Math.max(110, baseFreq + pitchOffset);
    const endFreq = startFreq * (code % 2 === 0 ? 1.14 : 0.92);

    const duration = 0.042;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = waveType;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.linearRampToValueAtTime(endFreq, now + duration);

    const maxGain = waveType === 'square' || waveType === 'sawtooth' ? 0.028 : 0.055;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(maxGain, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    this._autoDisconnect(osc, gain);

    osc.start(now);
    osc.stop(now + duration + 0.005);
  }

  /**
   * Sonido cómico de "¡Ajá, te he pillado!" cuando el jugador intenta pulsar 'E' rápido en una charla coñazo.
   */
  playCaughtSkipSound() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    this._playTone({
      freq: 520,
      type: 'square',
      startTime: now,
      duration: 0.08,
      peakGain: 0.05,
      attack: 0.005,
      vibrato: false
    });
    this._playTone({
      freq: 740,
      type: 'square',
      startTime: now + 0.09,
      duration: 0.14,
      peakGain: 0.05,
      attack: 0.005,
      vibrato: false
    });
  }

  /**
   * Reproduce el sonido característico de cada especie animal:
   * - 'sheep': Balido vibrante ("¡Beeee!")
   * - 'chicken': Cacareo rápido ("¡Cloc, cloc!")
   * - 'dog': Doble ladrido alegre ("¡Guau, guau!")
   * @param {'sheep' | 'chicken' | 'dog'} species
   */
  playAnimalSound(species) {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
      return;
    }

    const now = this.ctx.currentTime;

    if (species === 'sheep') {
      // Balido con temblor LFO rápido (~22 Hz)
      const duration = 0.42;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.linearRampToValueAtTime(385, now + 0.1);
      osc.frequency.linearRampToValueAtTime(295, now + duration);

      lfo.frequency.value = 24;
      lfoGain.gain.value = 22;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.045, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      this._autoDisconnect(osc, gain, lfo, lfoGain);

      lfo.start(now);
      osc.start(now);
      lfo.stop(now + duration);
      osc.stop(now + duration + 0.01);
    } else if (species === 'chicken') {
      // Cacareo triple agudo ("Cloc-cloc-cloc!")
      const notes = [
        { t: 0.0, f1: 540, f2: 780, d: 0.055 },
        { t: 0.08, f1: 590, f2: 880, d: 0.055 },
        { t: 0.17, f1: 640, f2: 1020, d: 0.09 }
      ];
      for (const n of notes) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.f1, now + n.t);
        osc.frequency.exponentialRampToValueAtTime(n.f2, now + n.t + n.d * 0.6);
        osc.frequency.exponentialRampToValueAtTime(n.f1 * 0.85, now + n.t + n.d);

        gain.gain.setValueAtTime(0.001, now + n.t);
        gain.gain.linearRampToValueAtTime(0.07, now + n.t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        this._autoDisconnect(osc, gain);
        osc.start(now + n.t);
        osc.stop(now + n.t + n.d + 0.01);
      }
    } else if (species === 'dog') {
      // Doble ladrido alegre ("¡Guau, guau!")
      const barks = [0.0, 0.15];
      for (const offset of barks) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(210, now + offset);
        osc.frequency.exponentialRampToValueAtTime(410, now + offset + 0.035);
        osc.frequency.exponentialRampToValueAtTime(155, now + offset + 0.11);

        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(0.06, now + offset + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.11);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        this._autoDisconnect(osc, gain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.12);
      }
    }
  }

  /**
   * Sonido solemne y trágico cuando el héroe cae derrotado (Fin de la Aventura).
   * Detiene el bucle de fondo y reproduce la fanfarria fúnebre.
   */
  playGameOver() {
    this.currentBossTrack = null;
    this.savedAmbientMode = null;
    this.setMode('game_over');
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    const now = this.ctx.currentTime;
    const notes = [
      { f: 220, t: 0.0, d: 0.4 },  // A3
      { f: 196, t: 0.35, d: 0.4 }, // G3
      { f: 174, t: 0.7, d: 0.45 }, // F3
      { f: 146, t: 1.1, d: 0.9 },  // D3
      { f: 110, t: 1.5, d: 1.6 }   // A2 profundo
    ];
    for (const n of notes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(0.001, now + n.t);
      gain.gain.linearRampToValueAtTime(0.08, now + n.t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + n.t + n.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      this._autoDisconnect(osc, gain);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.02);
    }
  }
}

