/**
 * AudioManager.js · Motor de Audio Polifónico Avanzado (Web Audio API nativa)
 *
 * Arquitectura de 3 Buses de Ganancia:
 *   [musicGainNode] ──┐
 *                     ├──> [masterGainNode] ──> [ctx.destination]
 *   [sfxGainNode]   ──┘
 *
 * Secuenciador Chiptune Polifónico nativo de 4 canales:
 *   - Canal 1: Melodía Principal (Onda cuadrada 'square' con envolvente ADSR)
 *   - Canal 2: Armonía / Contrapunto (Onda triangular 'triangle' o pulso suave)
 *   - Canal 3: Línea de Bajo (Onda triangular profunda con filtro paso bajo)
 *   - Canal 4: Percusión Rítmica (Bombo con caída de tono y caja/charles con buffer de ruido blanco)
 *
 * Pistas ricas diferenciadas:
 *   - 'Valleverde': Melodía campestre, orgánica y luminosa en C Mayor / A menor.
 *   - 'Mazmorras / Cuevas': Tono misterioso, acordes menores (Dm / Gm) y eco sutil.
 *   - 'Combates / Mini-Bosses': Bajo rápido a 140 BPM, arpegios tensos y percusión constante.
 *   - 'Pantalla de Título': Solemne y nostálgica con arpegios ascendentes.
 *   - 'Cárcel / Infractores': Variación cómica con síncopas en Do menor.
 *   - 'Créditos / Victoria': Triunfal y majestuosa.
 *
 * Persistencia de volumen y silenciamiento en `ojete_audio_settings` (localStorage).
 * Calibrador de efectos mediante `playTestBeep()`.
 */

const AUDIO_STORAGE_KEY = 'ojete_audio_settings';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGainNode = null;
    this.musicGainNode = null;
    this.sfxGainNode = null;

    this.isPlaying = false;
    this.mode = 'title'; // 'title' | 'village' | 'dungeon' | 'combat' | 'jail' | 'victory' ...
    this.savedAmbientMode = null;
    this.currentBossTrack = null;

    this.stepIndex = 0;
    this.timerId = null;
    this.stepDurationMs = 272; // ~110 BPM base

    this._noiseBuffer = null;
    this._unlocked = false;

    // Carga de configuración inicial guardada
    this.settings = this._loadSettings();

    // Tabla de frecuencias en Hz (escala temperada estándar)
    this.NOTES = {
      C2: 65.41, D2: 73.42, Eb2: 77.78, E2: 82.41, F2: 87.31, 'F#2': 92.50, Fs2: 92.50, G2: 98.00, Ab2: 103.83, A2: 110.00, Bb2: 116.54, B2: 123.47,
      C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, 'F#3': 185.00, Fs3: 185.00, G3: 196.00, Ab3: 207.65, A3: 220.00, Bb3: 233.08, B3: 246.94,
      C4: 261.63, 'C#4': 277.18, Cs4: 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, 'F#4': 369.99, Fs4: 369.99, G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
      C5: 523.25, 'C#5': 554.37, Cs5: 554.37, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, 'F#5': 739.99, Fs5: 739.99, G5: 783.99, Ab5: 830.61, A5: 880.00, Bb5: 932.33, B5: 987.77,
      C6: 1046.50, 'C#6': 1108.73, Cs6: 1108.73, D6: 1174.66, Eb6: 1244.51, E6: 1318.51, F6: 1396.91, G6: 1567.98, A6: 1760.00,
      REST: 0
    };

    const N = this.NOTES;

    // ── 1. Tema de la Pantalla de Inicio (titlePattern) ──────────────────────
    this.titlePattern = [
      { melody: N.REST, harmony: N.D3, bass: N.D2, drum: null },
      { melody: N.REST, harmony: N.A3, bass: N.D2, drum: 'hihat' },
      { melody: N.REST, harmony: N.D4, bass: N.D2, drum: null },
      { melody: N.D5,   harmony: N.F4, bass: N.D2, drum: 'kick' },
      { melody: N.A5,   harmony: N.A4, bass: N.REST, drum: 'hihat' },
      { melody: N.G5,   harmony: N.E4, bass: N.REST, drum: null },
      { melody: N.F5,   harmony: N.D4, bass: N.D3, drum: 'snare' },
      { melody: N.E5,   harmony: N.A3, bass: N.REST, drum: 'hihat' },
      { melody: N.D5,   harmony: N.F3, bass: N.Bb2, drum: 'kick' },
      { melody: N.F5,   harmony: N.Bb3,bass: N.REST, drum: null },
      { melody: N.G5,   harmony: N.D4, bass: N.REST, drum: 'hihat' },
      { melody: N.E5,   harmony: N.G3, bass: N.C3, drum: 'snare' },
      { melody: N.F5,   harmony: N.C4, bass: N.REST, drum: null },
      { melody: N.D5,   harmony: N.A3, bass: N.D3, drum: 'kick' },
      { melody: N.C5,   harmony: N.F4, bass: N.REST, drum: 'hihat' },
      { melody: N.D5,   harmony: N.D4, bass: N.D2, drum: 'snare' }
    ];

    // ── 2. Valleverde: Melodía campestre, orgánica y luminosa (villagePattern) ─
    this.villagePattern = [
      // Frase 1: Cmaj7 -> Am7
      { melody: N.E5,   harmony: N.C4, bass: N.C3, drum: 'kick' },
      { melody: N.G5,   harmony: N.E4, bass: N.REST, drum: 'hihat' },
      { melody: N.B5,   harmony: N.G4, bass: N.G2, drum: null },
      { melody: N.A5,   harmony: N.B4, bass: N.REST, drum: 'hihat' },
      { melody: N.G5,   harmony: N.G4, bass: N.E3, drum: 'snare' },
      { melody: N.E5,   harmony: N.E4, bass: N.REST, drum: 'hihat' },
      { melody: N.D5,   harmony: N.C4, bass: N.C3, drum: null },
      { melody: N.C5,   harmony: N.D4, bass: N.REST, drum: 'hihat' },

      { melody: N.E5,   harmony: N.A3, bass: N.A2, drum: 'kick' },
      { melody: N.A5,   harmony: N.C4, bass: N.REST, drum: 'hihat' },
      { melody: N.C6,   harmony: N.E4, bass: N.E3, drum: null },
      { melody: N.B5,   harmony: N.A4, bass: N.REST, drum: 'hihat' },
      { melody: N.A5,   harmony: N.E4, bass: N.C3, drum: 'snare' },
      { melody: N.G5,   harmony: N.C4, bass: N.REST, drum: 'hihat' },
      { melody: N.E5,   harmony: N.A3, bass: N.A2, drum: null },
      { melody: N.G5,   harmony: N.C4, bass: N.REST, drum: 'hihat' },

      // Frase 2: Fmaj7 -> G7 -> Resolución
      { melody: N.F5,   harmony: N.F3, bass: N.F2, drum: 'kick' },
      { melody: N.A5,   harmony: N.A3, bass: N.REST, drum: 'hihat' },
      { melody: N.C6,   harmony: N.C4, bass: N.A2, drum: null },
      { melody: N.A5,   harmony: N.E4, bass: N.REST, drum: 'hihat' },
      { melody: N.D5,   harmony: N.D4, bass: N.D3, drum: 'snare' },
      { melody: N.F5,   harmony: N.F4, bass: N.REST, drum: 'hihat' },
      { melody: N.A5,   harmony: N.A4, bass: N.F2, drum: null },
      { melody: N.D6,   harmony: N.F4, bass: N.REST, drum: 'hihat' },

      { melody: N.B5,   harmony: N.G3, bass: N.G2, drum: 'kick' },
      { melody: N.G5,   harmony: N.B3, bass: N.REST, drum: 'hihat' },
      { melody: N.D5,   harmony: N.D4, bass: N.B2, drum: null },
      { melody: N.F5,   harmony: N.F4, bass: N.REST, drum: 'hihat' },
      { melody: N.E5,   harmony: N.G4, bass: N.C3, drum: 'snare' },
      { melody: N.D5,   harmony: N.E4, bass: N.REST, drum: 'hihat' },
      { melody: N.C5,   harmony: N.C4, bass: N.C3, drum: 'kick' },
      { melody: N.REST, harmony: N.E4, bass: N.REST, drum: 'hihat' }
    ];

    // ── 3. Mazmorras / Cuevas: Tono misterioso y acordes menores (dungeonPattern) ─
    this.dungeonPattern = [
      { melody: N.D4,   harmony: N.F3, bass: N.D2, drum: 'kick' },
      { melody: N.REST, harmony: N.A3, bass: N.REST, drum: null },
      { melody: N.F4,   harmony: N.D4, bass: N.D2, drum: 'hihat' },
      { melody: N.A4,   harmony: N.F4, bass: N.REST, drum: null },
      { melody: N.Ab4,  harmony: N.D4, bass: N.D2, drum: 'snare' },
      { melody: N.G4,   harmony: N.Bb3,bass: N.REST, drum: 'hihat' },
      { melody: N.F4,   harmony: N.A3, bass: N.D2, drum: null },
      { melody: N.D4,   harmony: N.F3, bass: N.REST, drum: null },

      { melody: N.Bb4,  harmony: N.D3, bass: N.Bb2, drum: 'kick' },
      { melody: N.A4,   harmony: N.F3, bass: N.REST, drum: null },
      { melody: N.G4,   harmony: N.Bb3,bass: N.Bb2, drum: 'hihat' },
      { melody: N.F4,   harmony: N.D4, bass: N.REST, drum: null },
      { melody: N.E4,   harmony: N.Cs4 || N.A3, bass: N.A2, drum: 'snare' },
      { melody: N.F4,   harmony: N.E4, bass: N.REST, drum: 'hihat' },
      { melody: N.D4,   harmony: N.D4, bass: N.D2, drum: null },
      { melody: N.REST, harmony: N.A3, bass: N.REST, drum: null }
    ];

    // ── 4. Combates / Mini-Bosses: Arpegios tensos, bajo rápido y batería ─────
    this.combatPattern = [
      { melody: N.D5,   harmony: N.A4, bass: N.D2, drum: 'kick' },
      { melody: N.F5,   harmony: N.D4, bass: N.D3, drum: 'hihat' },
      { melody: N.A5,   harmony: N.F4, bass: N.D2, drum: 'snare' },
      { melody: N.D6,   harmony: N.A4, bass: N.D3, drum: 'hihat' },
      { melody: N.C6,   harmony: N.E4, bass: N.C2, drum: 'kick' },
      { melody: N.A5,   harmony: N.G4, bass: N.C3, drum: 'hihat' },
      { melody: N.E5,   harmony: N.C4, bass: N.C2, drum: 'snare' },
      { melody: N.G5,   harmony: N.E4, bass: N.C3, drum: 'hihat' },

      { melody: N.Bb5,  harmony: N.F4, bass: N.Bb2, drum: 'kick' },
      { melody: N.D6,   harmony: N.D4, bass: N.Bb3, drum: 'hihat' },
      { melody: N.F6,   harmony: N.Bb4,bass: N.Bb2, drum: 'snare' },
      { melody: N.D6,   harmony: N.F4, bass: N.Bb3, drum: 'hihat' },
      { melody: N.Cs6 || N.A5, harmony: N.E4, bass: N.A2, drum: 'kick' },
      { melody: N.E6,   harmony: N.G4, bass: N.A3, drum: 'hihat' },
      { melody: N.A5,   harmony: N.Cs4 || N.A4, bass: N.A2, drum: 'snare' },
      { melody: N.G5,   harmony: N.E4, bass: N.A3, drum: 'hihat' }
    ];

    // ── 5. Cárcel / Celda de Infractores (jailPattern) ────────────────────────
    this.jailPattern = [
      { melody: N.C4,   harmony: N.Eb3, bass: N.C2, drum: 'kick' },
      { melody: N.Eb4,  harmony: N.G3,  bass: N.REST, drum: null },
      { melody: N.Fs4,  harmony: N.C4,  bass: N.C3, drum: 'hihat' },
      { melody: N.G4,   harmony: N.Eb4, bass: N.REST, drum: null },
      { melody: N.Ab4,  harmony: N.C4,  bass: N.F2, drum: 'snare' },
      { melody: N.G4,   harmony: N.Eb4, bass: N.REST, drum: null },
      { melody: N.Eb4,  harmony: N.C4,  bass: N.G2, drum: 'hihat' },
      { melody: N.D4,   harmony: N.B3,  bass: N.C2, drum: 'kick' }
    ];

    // ── 6. Victoria y Créditos (victoryPattern) ──────────────────────────────
    this.victoryPattern = [
      { melody: N.C5,   harmony: N.G4, bass: N.C3, drum: 'kick' },
      { melody: N.E5,   harmony: N.C4, bass: N.REST, drum: 'hihat' },
      { melody: N.G5,   harmony: N.E4, bass: N.G2, drum: null },
      { melody: N.C6,   harmony: N.G4, bass: N.C3, drum: 'snare' },
      { melody: N.B5,   harmony: N.G4, bass: N.G2, drum: 'hihat' },
      { melody: N.A5,   harmony: N.F4, bass: N.F2, drum: 'kick' },
      { melody: N.G5,   harmony: N.E4, bass: N.C3, drum: 'snare' },
      { melody: N.C6,   harmony: N.G4, bass: N.C3, drum: 'kick' }
    ];

    // Patrones para bosses específicos
    this.garbageCollectorPattern = this.combatPattern;
    this.stackOverflowPattern = this.combatPattern;
    this.prototypeMicrowavePattern = this.combatPattern;
    this.villainPattern = this.combatPattern;

    this._setupAutoUnlock();
  }

  // ===========================================================================
  // Persistencia y Ajustes de Volumen
  // ===========================================================================

  _loadSettings() {
    const defaults = {
      master: 1.0,
      music: 0.8,
      sfx: 1.0,
      masterMuted: false,
      musicMuted: false,
      sfxMuted: false
    };

    if (typeof localStorage === 'undefined') return defaults;
    try {
      const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return {
        master: typeof parsed.master === 'number' ? Math.max(0, Math.min(1, parsed.master)) : 1.0,
        music: typeof parsed.music === 'number' ? Math.max(0, Math.min(1, parsed.music)) : 0.8,
        sfx: typeof parsed.sfx === 'number' ? Math.max(0, Math.min(1, parsed.sfx)) : 1.0,
        masterMuted: Boolean(parsed.masterMuted),
        musicMuted: Boolean(parsed.musicMuted),
        sfxMuted: Boolean(parsed.sfxMuted)
      };
    } catch {
      return defaults;
    }
  }

  _saveSettings() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignorar fallos de cuota o navegación privada
    }
  }

  // Getters / Setters de volumen
  getMasterVolume() {
    return this.settings.master;
  }

  setMasterVolume(val) {
    this.settings.master = Math.max(0, Math.min(1, Math.round(val * 100) / 100));
    this.settings.masterMuted = false;
    this._saveSettings();
    this._applyGainNodes();
  }

  getMusicVolume() {
    return this.settings.music;
  }

  setMusicVolume(val) {
    this.settings.music = Math.max(0, Math.min(1, Math.round(val * 100) / 100));
    this.settings.musicMuted = false;
    this._saveSettings();
    this._applyGainNodes();
  }

  getSfxVolume() {
    return this.settings.sfx;
  }

  setSfxVolume(val) {
    this.settings.sfx = Math.max(0, Math.min(1, Math.round(val * 100) / 100));
    this.settings.sfxMuted = false;
    this._saveSettings();
    this._applyGainNodes();
  }

  isMasterMuted() {
    return this.settings.masterMuted || this.settings.master <= 0;
  }

  toggleMasterMute() {
    this.settings.masterMuted = !this.settings.masterMuted;
    this._saveSettings();
    this._applyGainNodes();
  }

  isMusicMuted() {
    return this.settings.musicMuted || this.isMasterMuted() || this.settings.music <= 0;
  }

  toggleMusicMute() {
    this.settings.musicMuted = !this.settings.musicMuted;
    this._saveSettings();
    this._applyGainNodes();
  }

  isSfxMuted() {
    return this.settings.sfxMuted || this.isMasterMuted() || this.settings.sfx <= 0;
  }

  toggleSfxMute() {
    this.settings.sfxMuted = !this.settings.sfxMuted;
    this._saveSettings();
    this._applyGainNodes();
  }

  // ===========================================================================
  // Inicialización y Grafo de Audio (3 Buses)
  // ===========================================================================

  _ensureAudioGraph() {
    if (this.ctx && this.masterGainNode) return;
    const AudioContextClass = typeof window !== 'undefined'
      ? (window.AudioContext || window.webkitAudioContext)
      : null;

    if (!AudioContextClass) return;

    try {
      this.ctx = new AudioContextClass();

      // Bus 1: Master
      this.masterGainNode = this.ctx.createGain();
      this.masterGainNode.connect(this.ctx.destination);

      // Bus 2: Music
      this.musicGainNode = this.ctx.createGain();
      this.musicGainNode.connect(this.masterGainNode);

      // Bus 3: SFX
      this.sfxGainNode = this.ctx.createGain();
      this.sfxGainNode.connect(this.masterGainNode);

      this._applyGainNodes();
    } catch {
      // AudioContext no disponible en el entorno
    }
  }

  _applyGainNodes() {
    if (!this.ctx || !this.masterGainNode || !this.musicGainNode || !this.sfxGainNode) return;
    const now = this.ctx.currentTime;

    const targetMaster = this.isMasterMuted() ? 0 : this.settings.master;
    const targetMusic = this.isMusicMuted() ? 0 : this.settings.music;
    const targetSfx = this.isSfxMuted() ? 0 : this.settings.sfx;

    this.masterGainNode.gain.cancelScheduledValues(now);
    this.masterGainNode.gain.setValueAtTime(this.masterGainNode.gain.value, now);
    this.masterGainNode.gain.linearRampToValueAtTime(targetMaster, now + 0.04);

    this.musicGainNode.gain.cancelScheduledValues(now);
    this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, now);
    this.musicGainNode.gain.linearRampToValueAtTime(targetMusic, now + 0.04);

    this.sfxGainNode.gain.cancelScheduledValues(now);
    this.sfxGainNode.gain.setValueAtTime(this.sfxGainNode.gain.value, now);
    this.sfxGainNode.gain.linearRampToValueAtTime(targetSfx, now + 0.04);
  }

  _setupAutoUnlock() {
    if (typeof window === 'undefined') return;
    const unlockEvents = ['pointerdown', 'keydown', 'touchstart', 'click'];
    const unlockHandler = () => {
      this.unlockAndStart();
      for (const ev of unlockEvents) {
        window.removeEventListener(ev, unlockHandler, { capture: true });
      }
    };
    for (const ev of unlockEvents) {
      window.addEventListener(ev, unlockHandler, { capture: true, once: true });
    }
  }

  unlockAndStart() {
    this._ensureAudioGraph();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this._unlocked = true;
    if (!this.isPlaying && this.mode !== 'none' && this.mode !== 'silent') {
      this.isPlaying = true;
      this._scheduleLoop();
    }
  }

  _getWhiteNoiseBuffer() {
    if (this._noiseBuffer) return this._noiseBuffer;
    if (!this.ctx) return null;
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 1.0);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      this._noiseBuffer = buffer;
      return buffer;
    } catch {
      return null;
    }
  }

  _autoDisconnect(source, gainNode) {
    if (!source) return;
    source.onended = () => {
      try {
        source.disconnect();
        if (gainNode) gainNode.disconnect();
      } catch {
        // Ignorar
      }
    };
  }

  // ===========================================================================
  // Pitido de Calibración de Sonido
  // ===========================================================================

  playTestBeep() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

    const peak = 0.12;
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    this._autoDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  // ===========================================================================
  // Gestión de Modos y Pistas con Crossfade Fluido de 1.5s
  // ===========================================================================

  setMode(mode, fadeMs = 1500) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.stepIndex = 0;

    // Tempo según la atmósfera
    if (
      mode === 'combat' ||
      mode === 'dungeon_hostile' ||
      mode === 'track_garbage_collector' ||
      mode === 'track_stack_overflow' ||
      mode === 'track_prototype_microwave' ||
      mode === 'villain' ||
      mode === 'theme_main_villain'
    ) {
      this.stepDurationMs = 214; // ~140 BPM
    } else if (
      mode === 'dungeon' ||
      mode === 'sewers' ||
      mode === 'mines' ||
      mode === 'forge' ||
      mode === 'stage1'
    ) {
      this.stepDurationMs = 300; // ~100 BPM
    } else {
      this.stepDurationMs = 272; // ~110 BPM
    }

    // Crossfade fluido modulando la ganancia de música
    if (this.ctx && this.musicGainNode && fadeMs > 0 && !this.isMusicMuted()) {
      const now = this.ctx.currentTime;
      const targetGain = this.settings.music;
      const fadeSec = fadeMs / 1000;

      this.musicGainNode.gain.cancelScheduledValues(now);
      this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, now);
      this.musicGainNode.gain.linearRampToValueAtTime(targetGain * 0.25, now + fadeSec * 0.4);
      this.musicGainNode.gain.linearRampToValueAtTime(targetGain, now + fadeSec);
    }

    if (!this.isPlaying && this.mode !== 'none' && this.mode !== 'silent') {
      this.isPlaying = true;
      this._scheduleLoop();
    }
  }

  stopTitleMusic(fadeMs = 380) {
    if (this.mode === 'title') {
      this.setMode('village', fadeMs);
    }
  }

  playBossMusic(trackName) {
    this.savedAmbientMode = this.mode || 'village';
    this.currentBossTrack = trackName;
    this.setMode(trackName || 'combat', 800);
  }

  stopBossMusic(playFanfare = true) {
    const returnMode = this.savedAmbientMode || 'village';
    this.currentBossTrack = null;
    this.setMode(returnMode, 1200);
    if (playFanfare) {
      this.playFanfare();
    }
  }

  playVictoryTheme(fadeMs = 500) {
    this.setMode('victory', fadeMs);
  }

  // ===========================================================================
  // Secuenciador Chiptune Polifónico Nativo (4 Canales)
  // ===========================================================================

  _getPatternForCurrentMode() {
    switch (this.mode) {
      case 'title':
      case 'theme_title_screen':
        return this.titlePattern;
      case 'dungeon':
      case 'sewers':
      case 'mines':
      case 'forge':
      case 'stage1':
        return this.dungeonPattern;
      case 'combat':
      case 'track_garbage_collector':
      case 'track_stack_overflow':
      case 'track_prototype_microwave':
      case 'villain':
      case 'theme_main_villain':
        return this.combatPattern;
      case 'jail':
        return this.jailPattern;
      case 'victory':
      case 'theme_victory_credits':
        return this.victoryPattern;
      case 'village':
      default:
        return this.villagePattern;
    }
  }

  _scheduleLoop() {
    if (this.timerId) clearInterval(this.timerId);

    this.timerId = setInterval(() => {
      if (!this.ctx || this.isMusicMuted()) return;
      if (this.mode === 'game_over' || this.mode === 'silent' || this.mode === 'none') {
        return;
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
        return;
      }

      const pattern = this._getPatternForCurrentMode();
      if (!pattern || pattern.length === 0) return;

      const step = pattern[this.stepIndex % pattern.length];
      this.stepIndex = (this.stepIndex + 1) % pattern.length;

      const now = this.ctx.currentTime;
      const stepSec = this.stepDurationMs / 1000;

      // Canal 1: Melodía Principal (Square + ADSR)
      if (step.melody && step.melody > 0) {
        this._playMelodyNote(step.melody, now, stepSec * 1.6);
      }

      // Canal 2: Armonía / Contrapunto (Triangle)
      if (step.harmony && step.harmony > 0) {
        this._playHarmonyNote(step.harmony, now, stepSec * 1.8);
      }

      // Canal 3: Línea de Bajo (Triangle profundo / Lowpass)
      if (step.bass && step.bass > 0) {
        this._playBassNote(step.bass, now, stepSec * 1.9);
      }

      // Canal 4: Percusión Rítmica (Kick / Snare / Hihat)
      if (step.drum) {
        this._playDrum(step.drum, now);
      }
    }, this.stepDurationMs);
  }

  _playMelodyNote(freq, now, duration) {
    if (!this.ctx || !this.musicGainNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);

    // ADSR: Attack 0.015s, Decay 0.04s, Sustain 0.65, Release 0.06s
    const peak = 0.07;
    const sustain = peak * 0.65;
    const attackEnd = now + 0.015;
    const decayEnd = attackEnd + 0.04;
    const releaseStart = Math.max(decayEnd, now + duration - 0.06);
    const stopTime = releaseStart + 0.06;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, attackEnd);
    gain.gain.linearRampToValueAtTime(sustain, decayEnd);
    gain.gain.setValueAtTime(sustain, releaseStart);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    osc.connect(gain);
    gain.connect(this.musicGainNode);
    this._autoDisconnect(osc, gain);
    osc.start(now);
    osc.stop(stopTime + 0.01);
  }

  _playHarmonyNote(freq, now, duration) {
    if (!this.ctx || !this.musicGainNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    const peak = 0.055;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.025);
    gain.gain.setValueAtTime(peak, Math.max(now + 0.025, now + duration - 0.04));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.musicGainNode);
    this._autoDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  _playBassNote(freq, now, duration) {
    if (!this.ctx || !this.musicGainNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);

    const peak = 0.10;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.02);
    gain.gain.setValueAtTime(peak, Math.max(now + 0.02, now + duration - 0.04));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGainNode);
    this._autoDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  _playDrum(type, now) {
    if (!this.ctx || !this.musicGainNode) return;

    if (type === 'kick') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.08);

      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

      osc.connect(gain);
      gain.connect(this.musicGainNode);
      this._autoDisconnect(osc, gain);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'snare') {
      const noise = this._getWhiteNoiseBuffer();
      if (!noise) return;
      const src = this.ctx.createBufferSource();
      src.buffer = noise;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(1.5, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGainNode);
      this._autoDisconnect(src, gain);
      src.start(now);
      src.stop(now + 0.08);
    } else if (type === 'hihat') {
      const noise = this._getWhiteNoiseBuffer();
      if (!noise) return;
      const src = this.ctx.createBufferSource();
      src.buffer = noise;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(5500, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGainNode);
      this._autoDisconnect(src, gain);
      src.start(now);
      src.stop(now + 0.045);
    }
  }

  // ===========================================================================
  // Efectos de Sonido (SFX) conectados directamente a sfxGainNode
  // ===========================================================================

  _playSfxTone({ freq, type = 'square', startTime, duration, peakGain = 0.08, attack = 0.005 }) {
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    gain.gain.setValueAtTime(peakGain, startTime + Math.max(attack, duration - 0.02));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    this._autoDisconnect(osc, gain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  playMenuMove() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({
      freq: 440,
      type: 'triangle',
      startTime: now,
      duration: 0.045,
      peakGain: 0.08
    });
  }

  playMenuSelect() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({
      freq: 587.33,
      type: 'square',
      startTime: now,
      duration: 0.07,
      peakGain: 0.09
    });
    this._playSfxTone({
      freq: 880,
      type: 'square',
      startTime: now + 0.06,
      duration: 0.11,
      peakGain: 0.09
    });
  }

  playFanfare() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    const arpeggio = [
      { f: 523.25, d: 0.08, offset: 0.00 },
      { f: 659.25, d: 0.08, offset: 0.08 },
      { f: 783.99, d: 0.08, offset: 0.16 },
      { f: 1046.50, d: 0.28, offset: 0.24 }
    ];
    for (const note of arpeggio) {
      this._playSfxTone({
        freq: note.f,
        type: 'triangle',
        startTime: now + note.offset,
        duration: note.d,
        peakGain: 0.10
      });
    }
  }

  playSwordSlash() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    this._autoDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playChargedAttack() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(940, now + 0.18);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    this._autoDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  playDashSound() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const noise = this._getWhiteNoiseBuffer();
    if (!noise) return;

    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = noise;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);
    this._autoDisconnect(src, gain);
    src.start(now);
    src.stop(now + 0.14);
  }

  playHitHurt() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({
      freq: 160,
      type: 'sawtooth',
      startTime: now,
      duration: 0.12,
      peakGain: 0.10
    });
  }

  playEnemyHit() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({
      freq: 240,
      type: 'square',
      startTime: now,
      duration: 0.08,
      peakGain: 0.08
    });
  }

  playPlayerHurt() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({
      freq: 195,
      type: 'sawtooth',
      startTime: now,
      duration: 0.13,
      peakGain: 0.11
    });
    this._playSfxTone({
      freq: 130,
      type: 'sawtooth',
      startTime: now + 0.08,
      duration: 0.18,
      peakGain: 0.11
    });
  }

  playMetalClink() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1480, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.09);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    this._autoDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.105);
  }

  playBarrier() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.18);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    this._autoDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  playAbyssalPortalSound() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.25);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    this._autoDisconnect(osc, gain);
    osc.start(now);
    osc.stop(now + 0.31);
  }

  playDoorOpenSound() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({
      freq: 260,
      type: 'triangle',
      startTime: now,
      duration: 0.12,
      peakGain: 0.08
    });
    this._playSfxTone({
      freq: 392,
      type: 'triangle',
      startTime: now + 0.09,
      duration: 0.16,
      peakGain: 0.08
    });
  }

  playDoorLockedSound() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({
      freq: 180,
      type: 'sawtooth',
      startTime: now,
      duration: 0.10,
      peakGain: 0.09
    });
    this._playSfxTone({
      freq: 140,
      type: 'sawtooth',
      startTime: now + 0.11,
      duration: 0.14,
      peakGain: 0.09
    });
  }

  playChestOpenSound() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    this.playFanfare();
  }

  playItemPickupSound() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({
      freq: 659.25,
      type: 'sine',
      startTime: now,
      duration: 0.06,
      peakGain: 0.09
    });
    this._playSfxTone({
      freq: 987.77,
      type: 'sine',
      startTime: now + 0.05,
      duration: 0.11,
      peakGain: 0.09
    });
  }

  playHealSound() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    const arpeggio = [440, 554.37, 659.25, 880];
    for (let i = 0; i < arpeggio.length; i++) {
      this._playSfxTone({
        freq: arpeggio[i],
        type: 'sine',
        startTime: now + i * 0.04,
        duration: 0.08,
        peakGain: 0.08
      });
    }
  }

  playVoiceBlip(speakerName = '', char = 'a') {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const code = (char.codePointAt(0) || 65) % 12;
    const baseFreq = speakerName.toLowerCase().includes('alex') ? 140 : 380;
    const freq = baseFreq + code * 16;
    const now = this.ctx.currentTime;
    this._playSfxTone({
      freq,
      type: 'triangle',
      startTime: now,
      duration: 0.035,
      peakGain: 0.045
    });
  }

  playCaughtSkipSound() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({
      freq: 320,
      type: 'sawtooth',
      startTime: now,
      duration: 0.18,
      peakGain: 0.08
    });
  }

  playAnimalSound(species) {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    const freq = species === 'chicken' ? 580 : (species === 'cat' ? 720 : 440);
    this._playSfxTone({
      freq,
      type: 'triangle',
      startTime: now,
      duration: 0.09,
      peakGain: 0.07
    });
  }

  playGameOver() {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    const notes = [
      { f: 293.66, d: 0.20, offset: 0.00 },
      { f: 277.18, d: 0.20, offset: 0.20 },
      { f: 261.63, d: 0.20, offset: 0.40 },
      { f: 246.94, d: 0.45, offset: 0.60 }
    ];
    for (const n of notes) {
      this._playSfxTone({
        freq: n.f,
        type: 'sawtooth',
        startTime: now + n.offset,
        duration: n.d,
        peakGain: 0.10
      });
    }
  }

  playBossVictoryFanfare() {
    this.playFanfare();
  }

  // Compatibilidad hacia atrás para llamadas con parámetro único de volumen general
  setVolume(vol) {
    this.setMasterVolume(vol);
  }
}
