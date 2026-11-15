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

/** (BLOQUE 1) BGM pregrabada. Los SFX siguen siendo Web Audio API. */
import { EXPANSION_BGM } from '../expansion/ExpansionData.js?v=8';

export const BGM_MAX_VOLUME = 0.35;
const BGM_DUCK_VOLUME = 0.1;
const BGM_DUCK_RESTORE_MS = 400;

const BASE_BGM_TRACKS = {
  title: 'assets/music/01_main_theme.mp3',
  village: 'assets/music/02_valleverde_hub.mp3',
  stage1: 'assets/music/03_dungeons_ambient.mp3',
  forge: 'assets/music/04_the_forge.mp3',
  combat: 'assets/music/05_normal_battle.mp3',
  boss: 'assets/music/06_miniboss_battle.mp3',
  boss_final: 'assets/music/07_final_boss_alex.mp3',
  jail: 'assets/music/08_jail_cell.mp3',
  game_over: 'assets/music/09_game_over.mp3',
  victory: 'assets/music/10_credits_victory.mp3'
};

export const BGM_TRACKS = { ...BASE_BGM_TRACKS };

// (REFACTOR 4) La BGM de la expansión vive en ExpansionData y solo se registra
// y precarga cuando ExpansionManager.init() llama a loadExpansionMusic().
export function registerExpansionMusic() {
  Object.assign(BGM_TRACKS, EXPANSION_BGM);
}

const BGM_MODE_ALIASES = {
  theme_title_screen: 'title',
  overworld: 'village',
  valley: 'village',
  dungeon: 'stage1',
  sewers: 'stage1',
  mines: 'stage1',
  dungeon_hostile: 'combat',
  track_garbage_collector: 'boss',
  track_stack_overflow: 'boss',
  track_prototype_microwave: 'boss',
  villain: 'boss_final',
  theme_main_villain: 'boss_final',
  final_boss: 'boss_final',
  theme_victory_credits: 'victory',
  credits: 'victory',
  // (EXPANSIÓN v2.0) Alias de pistas y nombres de jefe
  track_inakito: 'boss_iñakito',
  boss_inakito: 'boss_iñakito',
  track_alex_final: 'boss_alex_final',
  valleverde_corporativo: 'valleverde_corp'
};

// (BLOQUE 1) SFX pregrabados: se decodifican a buffers y se reproducen con polifonía.
const SFX_NAMES = [
  'sword_slash', 'hit_flesh', 'hit_metal', 'player_hurt', 'parry', 'enemy_death',
  'boss_roar', 'charge_attack', 'dash', 'throw_log', 'footstep_grass',
  'footstep_stone', 'pickup_item', 'coin', 'level_up', 'pet_animal',
  'fish_splash', 'door_open', 'ui_hover', 'ui_click', 'ui_error', 'text_type',
  // (EXPANSIÓN v2.0)
  'ui_glitch', 'console_log', 'hologram_on', 'error_buzz',
  'keyboard_type', 'electric_shock', 'coffee_sip', 'door_airlock'
];

// El asset real venía como "fisg_splash.mp3"; se prueban ambos nombres.
const SFX_FILE_ALIASES = { fish_splash: ['fish_splash', 'fisg_splash'] };
const SFX_EXTENSIONS = ['mp3', 'wav', 'ogg'];

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.audioContext = null;
    this.sfxBuffers = {};
    this._sfxPreloadPromise = null;
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

    // (BLOQUE 1/3/4) BGM pregrabada y crossfade independiente del sintetizador.
    this._bgmAudio = new Map();
    this.expansionAudioLoaded = false;
    // (FIX 2) Diccionario reutilizable de pistas; nunca se recrea por cambio de zona.
    this.musicTracks = this._bgmAudio;
    this.currentMusic = null;
    this.isUnlocked = false;
    this.fadeInterval = null;
    this._bgmCurrentKey = null;
    this._bgmCurrentAudio = null;
    this._bgmPendingKey = null;
    this._bgmFade = null;
    this._bgmFadeTimer = null;
    this._bgmWasPlaying = false;
    this._bgmDuckUntil = 0;
    this._bgmDuckLevel = 0;
    this._bgmDuckTimer = null;
    this._bgmDuckRestoreStart = 0;
    this._bgmDuckRestoreFrom = 0;
    this._bgmDuckRestoreMs = BGM_DUCK_RESTORE_MS;

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

    // (FIX M2.4) Suspender el AudioContext en segundo plano
    this._isHidden = false;
    this._setupVisibilityHandling();
    this.preloadMusic();
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
      this.audioContext = this.ctx;

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
    this._updateBgmVolumes();
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

  /**
   * (FIX M2.4) Al ocultar la pestaña se suspende el AudioContext (ahorra batería y
   * evita música en background). Al volver se intenta reanudar; si el navegador exige
   * gesto, el siguiente toque llama a `unlockAndStart()` y lo reanuda.
   */
  _setupVisibilityHandling() {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    document.addEventListener('visibilitychange', () => {
      this._isHidden = Boolean(document.hidden);
      if (this._isHidden) {
        // (BLOQUE 6) Pausar la BGM al cambiar de pestaña para ahorrar batería.
        this._bgmWasPlaying = Boolean(this._bgmCurrentAudio && !this._bgmCurrentAudio.paused);
        if (this._bgmWasPlaying) this._bgmCurrentAudio.pause();
        if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
      } else {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        if (this._bgmWasPlaying && this._bgmCurrentAudio) {
          this._bgmCurrentAudio.volume = this._bgmEffectiveVolume();
          const p = this._bgmCurrentAudio.play();
          if (p && typeof p.catch === 'function') {
            p.catch((err) => console.warn('[AudioManager] No se pudo reanudar la BGM:', err?.message || err));
          }
          this._bgmWasPlaying = false;
        }
      }
    });
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
    // (FIX 3) Unlock idempotente: varios clics no deben arrancar la BGM varias veces.
    if (this.isUnlocked) {
      this._ensureAudioGraph();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    this.isUnlocked = true;
    this._unlocked = true;
    const key = this._bgmPendingKey || this._resolveBgmKey(this.mode);
    if (key) {
      this._bgmPendingKey = null;
      this._startBgm(key, 0);
    }

    this._ensureAudioGraph();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    // (BLOQUE 1.3) Carga en segundo plano; si algo falla, quedan los sintetizadores.
    this.preloadSFX().catch((err) => {
      console.warn('[AudioManager] No se pudieron precargar los SFX:', err?.message || err);
    });
  }

  /**
   * (BLOQUE 1) Descarga y decodifica assets/sfx/* en buffers de Web Audio.
   * Tolera archivos ausentes o corruptos: cada fallo cae al sintetizador.
   */
  async preloadSFX() {
    if (this._sfxPreloadPromise) return this._sfxPreloadPromise;
    this._sfxPreloadPromise = (async () => {
      this._ensureAudioGraph();
      if (!this.ctx || typeof fetch !== 'function') return;
      await Promise.all(SFX_NAMES.map(async (name) => {
        if (this.sfxBuffers[name]) return;
        const bases = SFX_FILE_ALIASES[name] || [name];
        for (const base of bases) {
          for (const ext of SFX_EXTENSIONS) {
            try {
              const res = await fetch(`assets/sfx/${base}.${ext}`, { cache: 'force-cache' });
              if (!res.ok) continue;
              const arrayBuffer = await res.arrayBuffer();
              const decoded = await new Promise((resolve, reject) => {
                try {
                  const p = this.ctx.decodeAudioData(arrayBuffer, resolve, reject);
                  if (p && typeof p.then === 'function') p.then(resolve, reject);
                } catch (err) {
                  reject(err);
                }
              });
              if (decoded) {
                this.sfxBuffers[name] = decoded;
                return;
              }
            } catch {
              // Probar siguiente extensión/alias.
            }
          }
        }
        console.warn(`[AudioManager] SFX no disponible: ${name}; se usará el sintetizador.`);
      }));
    })();
    return this._sfxPreloadPromise;
  }

  /**
   * (BLOQUE 2) Dispara un SFX pregrabado con polifonía y variación de tono.
   * Devuelve false si el buffer no está cargado para que el llamador use el fallback.
   */
  playSFX(name, options = {}) {
    if (!name) return false;
    const buffer = this.sfxBuffers && this.sfxBuffers[name];
    if (!buffer) return false;
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return false;
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const requestedRate = Number.isFinite(options.playbackRate)
        ? options.playbackRate
        : 1.0 + (Math.random() * 0.2 - 0.1);
      source.playbackRate.value = Math.max(0.5, Math.min(2, requestedRate));
      const gain = this.ctx.createGain();
      const volume = Math.max(0, Math.min(1, options.volume ?? 0.9));
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(this.sfxGainNode);
      if (name === 'player_hurt' || name === 'hit_metal' || name === 'parry') {
        this._duckMusicForImpact();
      }
      source.start(0);
      this._autoDisconnect(source, gain);
      return true;
    } catch (err) {
      console.warn('[AudioManager] No se pudo reproducir SFX:', name, err?.message || err);
      return false;
    }
  }

  /** (BLOQUE 4) Baja la BGM al 20% del volumen actual y la restaura en 300 ms. */
  _duckMusicForImpact() {
    if (!this._bgmCurrentAudio) return;
    const current = this._bgmCurrentAudio.volume;
    this.duckMusic(300, Math.max(0.001, current * 0.2), 300);
  }


  // ===========================================================================
  // BGM pregrabada (HTMLAudioElement) · crossfade y control de volumen
  // ===========================================================================

  _preloadTrackEntries(entries) {
    if (typeof Audio === 'undefined') return;
    for (const [key, src] of entries) {
      if (this._bgmAudio.has(key)) continue;
      try {
        const audio = new Audio();
        audio.src = src;
        audio.loop = true;
        audio.preload = key === 'title' ? 'auto' : 'metadata';
        audio.volume = 0;
        audio.addEventListener('error', () => {
          console.warn(`[AudioManager] No se pudo cargar la BGM: ${src}`);
        });
        if (key === 'title') {
          try { audio.load(); } catch { /* carga diferida */ }
        }
        this._bgmAudio.set(key, audio);
      } catch (err) {
        console.warn(`[AudioManager] Error creando la BGM ${src}:`, err?.message || err);
      }
    }
  }

  /** Precarga estrictamente las pistas base (01..10) definidas en BASE_BGM_TRACKS. */
  preloadMusic() {
    this._preloadTrackEntries(Object.entries(BASE_BGM_TRACKS));
  }

  /** Registra y precarga las pistas de la expansión (11..15) solo al iniciar ExpansionManager. */
  loadExpansionMusic() {
    registerExpansionMusic();
    this.expansionAudioLoaded = true;
    this._preloadTrackEntries(Object.entries(EXPANSION_BGM));
  }

  _resolveBgmKey(mode) {
    if (!mode || mode === 'none' || mode === 'silent') return null;
    if (BGM_TRACKS[mode]) return mode;
    return BGM_MODE_ALIASES[mode] || null;
  }

  _getBgmAudio(key) {
    if (!key || !BGM_TRACKS[key]) return null;
    let audio = this._bgmAudio.get(key) || null;
    if (!audio) {
      if (typeof Audio === 'undefined') return null;
      try {
        audio = new Audio();
        audio.src = BGM_TRACKS[key];
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = 0;
        audio.addEventListener('error', () => {
          console.warn(`[AudioManager] No se pudo cargar la BGM: ${BGM_TRACKS[key]}`);
        });
        this._bgmAudio.set(key, audio);
      } catch (err) {
        console.warn('[AudioManager] Error creando la BGM:', err?.message || err);
        return null;
      }
    }
    if (audio.preload !== 'auto') {
      audio.preload = 'auto';
      try { audio.load(); } catch { /* carga diferida */ }
    }
    return audio;
  }

  _bgmBaseVolume() {
    if (!this.settings) return 0;
    if (typeof this.isMusicMuted === 'function' && this.isMusicMuted()) return 0;
    const master = this.settings.master ?? 1;
    const music = this.settings.music ?? 0.8;
    // (BLOQUE 7) La BGM nunca supera el 35% del volumen efectivo.
    return Math.max(0, Math.min(BGM_MAX_VOLUME, master * music * BGM_MAX_VOLUME));
  }

  _bgmEffectiveVolume() {
    const base = this._bgmBaseVolume();
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return now < this._bgmDuckUntil ? Math.min(base, this._bgmDuckLevel) : base;
  }

  _applyBgmMode(mode, fadeMs = 1500) {
    const key = this._resolveBgmKey(mode);
    if (!key) {
      this._bgmPendingKey = null;
      this._stopBgm(fadeMs);
      return;
    }
    if (key === this._bgmCurrentKey && this._bgmCurrentAudio && !this._bgmCurrentAudio.paused) {
      return;
    }
    this._bgmPendingKey = key;
    if (!this._unlocked) return;
    this._startBgm(key, fadeMs);
  }

  _startBgm(key, fadeMs = 1500) {
    const audio = this._getBgmAudio(key);
    if (!audio) return;
    const old = this._bgmCurrentAudio;

    if (old === audio) {
      this._bgmCurrentKey = key;
      this.currentMusic = audio;
      audio.volume = this._bgmEffectiveVolume();
      if (audio.paused) {
        const p = audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch((err) => this._warnBgmPlayFailure(err));
        }
      }
      return;
    }

    // (FIX 1/4) Cancelar el fade anterior MATANDO su pista saliente antes de crear otro.
    this._clearBgmFade(true);

    this._bgmCurrentKey = key;
    this._bgmCurrentAudio = audio;
    this.currentMusic = audio;
    this._bgmPendingKey = null;

    audio.loop = true;
    try { audio.currentTime = 0; } catch { /* metadata no lista */ }
    audio.volume = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err) => this._warnBgmPlayFailure(err));
    }

    const target = this._bgmEffectiveVolume();
    if (!fadeMs || fadeMs <= 0 || typeof setInterval === 'undefined') {
      if (old && old !== audio) {
        old.pause();
        try { old.currentTime = 0; } catch { /* noop */ }
        old.volume = 0;
      }
      audio.volume = target;
      return;
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._bgmFade = {
      audio,
      old,
      start: now,
      // (FIX 1) Saliente rápido de 200 ms; entrada suave acotada para no eternizar el cambio.
      oldDuration: 200,
      duration: Math.min(900, Math.max(200, fadeMs)),
      oldStart: old ? old.volume : 0
    };
    this._bgmFadeTimer = setInterval(() => this._tickBgmFade(), 30);
    this.fadeInterval = this._bgmFadeTimer;
  }

  /** Filtra el AbortError benigno de play() interrumpido por un cambio de pista. */
  _warnBgmPlayFailure(err) {
    if (!err) return;
    if (err.name === 'AbortError' || /interrupted/i.test(String(err.message || ''))) return;
    console.warn('[AudioManager] BGM bloqueada o fallida:', err?.message || err);
  }

  _stopBgm(fadeMs = 800) {
    this._bgmPendingKey = null;
    const old = this._bgmCurrentAudio;
    this._bgmCurrentAudio = null;
    this._bgmCurrentKey = null;
    this.currentMusic = null;
    if (!old) return;
    // (FIX 1) Saliente de 200 ms; pausa + currentTime=0 al terminar (sin destruir la instancia).
    this.fadeOut(old, 200);
  }

  /** (FIX 4) Fade-out seguro de una instancia; cancela cualquier fade previo. */
  fadeOut(audioElement, duration = 200) {
    if (!audioElement) return;
    this._clearBgmFade(true);
    if (!duration || duration <= 0 || typeof setInterval === 'undefined') {
      try {
        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement.volume = 0;
      } catch { /* noop */ }
      return;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._bgmFade = {
      audio: null,
      old: audioElement,
      start: now,
      oldDuration: duration,
      duration,
      oldStart: audioElement.volume
    };
    this._bgmFadeTimer = setInterval(() => this._tickBgmFade(), 30);
    this.fadeInterval = this._bgmFadeTimer;
  }

  _tickBgmFade() {
    if (!this._bgmFade) {
      this._tickBgmDuck();
      if (!this._bgmDuckUntil) this._clearBgmFade();
      return;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const { audio, old, oldStart, oldDuration, duration } = this._bgmFade;
    const newRaw = Math.min(1, (now - this._bgmFade.start) / Math.max(1, duration));
    const oldRaw = Math.min(1, (now - this._bgmFade.start) / Math.max(1, oldDuration || duration));
    const newEase = newRaw * newRaw * (3 - 2 * newRaw);
    const oldEase = oldRaw * oldRaw * (3 - 2 * oldRaw);
    const target = this._bgmEffectiveVolume();

    if (audio) audio.volume = target * newEase;
    if (old) {
      old.volume = Math.max(0, oldStart * (1 - oldEase));
      if (oldRaw >= 1) {
        try {
          old.pause();
          old.currentTime = 0;
        } catch { /* noop */ }
        old.volume = 0;
      }
    }
    if (newRaw >= 1 && oldRaw >= 1) {
      if (audio) audio.volume = target;
      this._clearBgmFade(false);
    }
  }

  _clearBgmFade(pauseOutgoing = true) {
    // (FIX 1) Al cancelar un crossfade, la pista saliente anterior NUNCA debe quedar sonando.
    if (pauseOutgoing && this._bgmFade) {
      const outgoing = this._bgmFade.old;
      if (outgoing && outgoing !== this._bgmCurrentAudio) {
        try {
          outgoing.pause();
          outgoing.currentTime = 0;
          outgoing.volume = 0;
        } catch { /* noop */ }
      }
    }
    if (this._bgmFadeTimer) {
      clearInterval(this._bgmFadeTimer);
      this._bgmFadeTimer = null;
    }
    this.fadeInterval = null;
    this._bgmFade = null;
  }

  _updateBgmVolumes() {
    if (!this._bgmAudio) return;
    const target = this._bgmEffectiveVolume();
    for (const [key, audio] of this._bgmAudio) {
      if (!audio) continue;
      const inFade = this._bgmFade && (this._bgmFade.audio === audio || this._bgmFade.old === audio);
      if (key === this._bgmCurrentKey && !this._bgmFade) {
        audio.volume = target;
      } else if (!inFade) {
        // (FIX 1) Cualquier instancia ajena al fade actual se silencia y se pausa.
        audio.volume = 0;
        if (!audio.paused) {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch { /* noop */ }
        }
      }
    }
  }

  /**
   * (BLOQUE 7) Ducking: baja la BGM a 0.1 durante 0.5 s y la recupera suavemente.
   * Solo afecta a la música; el bus SFX permanece a 1.0.
   */
  duckMusic(durationMs = 500, level = BGM_DUCK_VOLUME, restoreMs = BGM_DUCK_RESTORE_MS) {
    if (!this._bgmCurrentAudio) return;
    this._bgmDuckRestoreMs = restoreMs;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._bgmDuckUntil = now + Math.max(0, durationMs);
    this._bgmDuckLevel = Math.max(0, Math.min(BGM_MAX_VOLUME, level));
    this._bgmDuckRestoreStart = 0;
    this._bgmDuckRestoreFrom = 0;
    if (typeof setInterval !== 'undefined' && !this._bgmFadeTimer) {
      this._bgmFadeTimer = setInterval(() => this._tickBgmFade(), 30);
      this.fadeInterval = this._bgmFadeTimer;
    }
    this._tickBgmDuck();
  }

  _tickBgmDuck() {
    const audio = this._bgmCurrentAudio;
    if (!audio) {
      this._clearBgmDuck();
      return;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const base = this._bgmBaseVolume();
    if (now < this._bgmDuckUntil) {
      this._bgmDuckRestoreStart = 0;
      audio.volume = Math.min(base, this._bgmDuckLevel);
      return;
    }
    if (!this._bgmDuckRestoreStart) {
      this._bgmDuckRestoreStart = now;
      this._bgmDuckRestoreFrom = audio.volume;
    }
    const raw = Math.min(1, (now - this._bgmDuckRestoreStart) / (this._bgmDuckRestoreMs || BGM_DUCK_RESTORE_MS));
    const eased = raw * raw * (3 - 2 * raw);
    audio.volume = this._bgmDuckRestoreFrom + (base - this._bgmDuckRestoreFrom) * eased;
    if (raw >= 1) this._clearBgmDuck();
  }

  _clearBgmDuck() {
    this._bgmDuckUntil = 0;
    this._bgmDuckUntil = 0;
    this._bgmDuckLevel = 0;
    this._bgmDuckRestoreStart = 0;
    this._bgmDuckRestoreFrom = 0;
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

    // (REFACTOR 3) Con MP3, cancelar el secuenciador chiptune.
    const bgmKey = this._resolveBgmKey(mode);
    if (bgmKey) {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    }

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

    // (BLOQUE 3) Crossfade entre pistas MP3; el sintetizador BGM queda dormido.
    this._applyBgmMode(mode, fadeMs);
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
      // (REFACTOR 3) Si hay un MP3 sonando, el sintetizador chiptune debe callar.
      if (this._bgmCurrentAudio && !this._bgmCurrentAudio.paused) return;
      if (!this.ctx || this.isMusicMuted()) return;
      // (FIX M2.4) No reanudar ni programar notas mientras está en segundo plano
      if (this._isHidden) return;
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
    if (this._isHidden) return;
    // (FIX M2.4) Cualquier SFX es una oportunidad de reanudar tras volver a la pestaña
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
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

  // ===========================================================================
  // (EXPANSIÓN v2.0) SFX del Update Universal
  // ===========================================================================
  /** Glitch de interfaz: consistente (sin variación) para no sonar aleatorio. */
  playGlitch() {
    return this.playSFX('ui_glitch', { volume: 0.85, playbackRate: 1.0 });
  }

  /** Consola de Mister Alex: variación leve para evitar repetición robótica. */
  playConsoleLog() {
    return this.playSFX('console_log', {
      volume: 0.8,
      playbackRate: 0.94 + Math.random() * 0.12
    });
  }

  /** Holograma de Cepedita 2.0: tono estable de proyección. */
  playHologram() {
    return this.playSFX('hologram_on', { volume: 0.85, playbackRate: 1.0 });
  }

  /** Error del sistema: variación corta. */
  playError() {
    return this.playSFX('error_buzz', {
      volume: 0.85,
      playbackRate: 0.95 + Math.random() * 0.1
    });
  }

  /** Teclado corporativo: variación media. */
  playKeyboard() {
    return this.playSFX('keyboard_type', {
      volume: 0.55,
      playbackRate: 0.92 + Math.random() * 0.16
    });
  }

  /** Descarga eléctrica: variación media. */
  playShock() {
    return this.playSFX('electric_shock', {
      volume: 0.85,
      playbackRate: 0.95 + Math.random() * 0.1
    });
  }

  /** Sorbo de café de Iñakito: variación media. */
  playCoffee() {
    return this.playSFX('coffee_sip', {
      volume: 0.7,
      playbackRate: 0.94 + Math.random() * 0.12
    });
  }

  /** Esclusa de aire: variación sutil. */
  playAirlock() {
    return this.playSFX('door_airlock', {
      volume: 0.85,
      playbackRate: 0.97 + Math.random() * 0.06
    });
  }

  playMenuMove() {
    if (this.playSFX('ui_hover')) return;
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
    if (this.playSFX('ui_click')) return;
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
    // (BLOQUE 7) SFX fuerte: bajar la BGM temporalmente.
    this.duckMusic();
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
    if (this.playSFX('sword_slash')) return;
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
    if (this.playSFX('charge_attack')) return;
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
    if (this.playSFX('dash')) return;
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
    if (this.playSFX('hit_flesh')) return;
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

  playPunch() {
    if (this.playSFX('hit_flesh')) return;
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({
      freq: 95,
      type: 'triangle',
      startTime: now,
      duration: 0.1,
      peakGain: 0.16
    });
  }

  playEnemyHit(isBoss = false) {
    if (this.playSFX(isBoss ? 'hit_metal' : 'hit_flesh')) return;
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
    if (this.playSFX('player_hurt')) return;
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
    if (this.playSFX('hit_metal')) return;
    // (BLOQUE 7) SFX fuerte: bajar la BGM temporalmente.
    this.duckMusic();
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
    if (this.playSFX('parry')) return;
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
    if (this.playSFX('door_open')) return;
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
    if (this.playSFX('pickup_item')) return;
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

  // (BLOQUE 3) SFX nuevos: buffer pregrabado y fallback sintetizado.
  playCoin() {
    if (this.playSFX('coin', { volume: 0.8 })) return;
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({ freq: 987.77, type: 'square', startTime: now, duration: 0.05, peakGain: 0.08 });
    this._playSfxTone({ freq: 1318.51, type: 'square', startTime: now + 0.05, duration: 0.09, peakGain: 0.08 });
  }

  playLevelUp() {
    if (this.playSFX('level_up')) return;
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      this._playSfxTone({
        freq,
        type: 'triangle',
        startTime: now + i * 0.07,
        duration: 0.12,
        peakGain: 0.1
      });
    });
  }

  playEnemyDeath() {
    if (this.playSFX('enemy_death')) return;
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({ freq: 320, type: 'sawtooth', startTime: now, duration: 0.25, peakGain: 0.09 });
    this._playSfxTone({ freq: 90, type: 'sawtooth', startTime: now + 0.08, duration: 0.3, peakGain: 0.09 });
  }

  playBossRoar() {
    if (this.playSFX('boss_roar')) return;
    this.duckMusic(400, 0.12);
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({ freq: 85, type: 'sawtooth', startTime: now, duration: 0.45, peakGain: 0.12 });
    this._playSfxTone({ freq: 55, type: 'square', startTime: now + 0.12, duration: 0.4, peakGain: 0.1 });
  }

  playThrowLog() {
    if (this.playSFX('throw_log')) return;
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({ freq: 260, type: 'triangle', startTime: now, duration: 0.08, peakGain: 0.06 });
    this._playSfxTone({ freq: 130, type: 'triangle', startTime: now + 0.06, duration: 0.1, peakGain: 0.05 });
  }

  playFishSplash() {
    if (this.playSFX('fish_splash')) return;
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    const noise = this._getWhiteNoiseBuffer();
    if (!noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);
    this._autoDisconnect(src, gain);
    src.start(now);
    src.stop(now + 0.19);
  }

  playTextType() {
    if (this.playSFX('text_type', { volume: 0.35, playbackRate: 0.98 + Math.random() * 0.06 })) return;
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    this._playSfxTone({
      freq: 620,
      type: 'triangle',
      startTime: this.ctx.currentTime,
      duration: 0.018,
      peakGain: 0.02
    });
  }

  playUIError() {
    if (this.playSFX('ui_error')) return;
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    const now = this.ctx.currentTime;
    this._playSfxTone({ freq: 220, type: 'square', startTime: now, duration: 0.08, peakGain: 0.07 });
    this._playSfxTone({ freq: 180, type: 'square', startTime: now + 0.08, duration: 0.1, peakGain: 0.06 });
  }

  playFootstep(surface = 'grass') {
    const stone = surface === 'stone' || surface === 'dungeon';
    const name = stone ? 'footstep_stone' : 'footstep_grass';
    if (this.playSFX(name, { volume: 0.5, playbackRate: 0.95 + Math.random() * 0.1 })) return;
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) return;
    this._playSfxTone({
      freq: stone ? 180 : 120,
      type: 'triangle',
      startTime: this.ctx.currentTime,
      duration: 0.03,
      peakGain: 0.035
    });
  }

  // Alias con los nombres de la especificación.
  playItemPickup() { this.playItemPickupSound(); }
  playChargeAttack() { this.playChargedAttack(); }

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
    // (BLOQUE 7) SFX fuerte: bajar la BGM temporalmente.
    this.duckMusic();
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
    if (this.playSFX('pet_animal')) return;
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

  /**
   * Balido/chillido distorsionado cuando el jugador ataca a un animal del pueblo.
   */
  playAnimalHurtSound(species) {
    this._ensureAudioGraph();
    if (!this.ctx || this.isMasterMuted() || this.isSfxMuted()) {
      this.playSFX('hit_flesh');
      return;
    }
    const now = this.ctx.currentTime;
    const baseFreq = species === 'chicken' ? 780 : (species === 'dog' ? 390 : 320);
    // "Beee" / alarido en dos tonos descendentes distorsionados
    this._playSfxTone({
      freq: baseFreq,
      endFreq: baseFreq * 0.52,
      type: 'sawtooth',
      startTime: now,
      duration: 0.24,
      peakGain: 0.14
    });
    this._playSfxTone({
      freq: baseFreq * 1.18,
      endFreq: baseFreq * 0.45,
      type: 'square',
      startTime: now + 0.04,
      duration: 0.20,
      peakGain: 0.09
    });
  }

  playGameOver() {
    // (BLOQUE 7) SFX fuerte: bajar la BGM temporalmente.
    this.duckMusic();
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
    // (BLOQUE 7) SFX fuerte: bajar la BGM temporalmente.
    this.duckMusic();
    this.playFanfare();
  }

  // Compatibilidad hacia atrás para llamadas con parámetro único de volumen general
  setVolume(vol) {
    this.setMasterVolume(vol);
  }
}
