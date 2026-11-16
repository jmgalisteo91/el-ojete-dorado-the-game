/**
 * CinematicDirector.js · Cinemáticas in-engine con sprites reales.
 *
 * - Ejecuta guiones de comandos: spawn, camera, move, anim, wait, effect,
 *   dialogue, beam, fade, title y end.
 * - Usa SpriteAnimator + charactersSheet, por lo que Player y Alex son los
 *   sprites del juego, no ilustraciones vectoriales.
 * - Cámara propia con zoom/pan y Ken Burns; letterbox, viñeta, glitch,
 *   partículas binarias, rayo y screen shake.
 */

import { SpriteAnimator } from '../graphics/Animator.js?v=8';
import { CHARACTER_TYPES } from '../graphics/SpriteSheetGenerator.js?v=8';
import { UILayout, UI_COLORS, UI_FONT, LOGICAL_WIDTH, LOGICAL_HEIGHT } from './UILayout.js?v=8';
import { CinematicTimeline } from './CinematicTimeline.js?v=8';
import { PROLOGUE_ALEX, PROLOGUE_EXPANSION, CINEMATIC_TIMELINES, getCinematicTimeline } from '../assets/CinematicTimelines.js?v=8';

export { PROLOGUE_ALEX, PROLOGUE_EXPANSION };

const ACTOR_SPRITES = {
  alex: CHARACTER_TYPES.ALEX_TV,
  alex_phase2: CHARACTER_TYPES.ALEX_PHASE2,
  inakito: CHARACTER_TYPES.INAKITO,
  hero: CHARACTER_TYPES.HERO,
  hero_armored: CHARACTER_TYPES.HERO_ARMORED,
  guard: CHARACTER_TYPES.GUARD,
  oracle: CHARACTER_TYPES.AI_ORACLE,
  elder: CHARACTER_TYPES.ELDER,
  boss_gc: CHARACTER_TYPES.BOSS_GC,
  boss_stack: CHARACTER_TYPES.BOSS_STACK,
  boss_microwave: CHARACTER_TYPES.BOSS_MICROWAVE,
  rat: CHARACTER_TYPES.RAT
};

// (FIX CINEMÁTICAS) Fondos procedurales con parallax. Los personajes son sprites.
const BACKGROUNDS = {
  sewer: {
    sky: ['#07120f', '#0b211a', '#020807'],
    fog: 'rgba(16, 185, 129, 0.06)',
    particle: 'dust',
    particleColors: ['#34d399', '#6ee7b7', '#94a3b8'],
    layers: [
      { color: 'rgba(6, 78, 59, 0.55)', h: 40, width: 66, speed: 0.10, parallax: 0.12 },
      { color: 'rgba(4, 47, 36, 0.8)', h: 26, width: 44, speed: 0.22, parallax: 0.22 }
    ]
  },
  temple: {
    sky: ['#0a0a1f', '#151238', '#03030a'],
    fog: 'rgba(56, 189, 248, 0.05)',
    particle: 'embers',
    particleColors: ['#38bdf8', '#818cf8', '#e0e7ff'],
    layers: [
      { color: 'rgba(49, 46, 129, 0.5)', h: 48, width: 58, speed: 0.08, parallax: 0.10 },
      { color: 'rgba(30, 27, 75, 0.75)', h: 28, width: 34, speed: 0.18, parallax: 0.20 }
    ]
  },
  forge: {
    sky: ['#1a0a05', '#3b1206', '#0a0302'],
    fog: 'rgba(249, 115, 22, 0.08)',
    particle: 'sparks',
    particleColors: ['#f97316', '#fde047', '#fca5a5'],
    layers: [
      { color: 'rgba(124, 45, 18, 0.55)', h: 44, width: 62, speed: 0.12, parallax: 0.14 },
      { color: 'rgba(69, 26, 3, 0.8)', h: 24, width: 40, speed: 0.25, parallax: 0.24 }
    ]
  },
  citadel: {
    sky: ['#050816', '#101a38', '#01020a'],
    fog: 'rgba(34, 211, 238, 0.05)',
    particle: 'data',
    particleColors: ['#22d3ee', '#c084fc', '#4ade80'],
    layers: [
      { color: 'rgba(15, 23, 42, 0.8)', h: 46, width: 52, speed: 0.06, parallax: 0.08 },
      { color: 'rgba(30, 41, 59, 0.9)', h: 28, width: 30, speed: 0.16, parallax: 0.18 }
    ]
  },
  jail: {
    sky: ['#0a0a0c', '#1c1917', '#020202'],
    fog: 'rgba(148, 163, 184, 0.05)',
    particle: 'dust',
    particleColors: ['#94a3b8', '#cbd5e1', '#78716c'],
    layers: [
      { color: 'rgba(41, 37, 36, 0.85)', h: 48, width: 26, speed: 0.04, parallax: 0.06 },
      { color: 'rgba(28, 25, 23, 0.95)', h: 26, width: 18, speed: 0.10, parallax: 0.12 }
    ]
  },
  divine: {
    sky: ['#1a1206', '#3d2c0a', '#070501'],
    fog: 'rgba(253, 224, 71, 0.07)',
    particle: 'leaves',
    particleColors: ['#fde047', '#fef3c7', '#fbbf24'],
    layers: [
      { color: 'rgba(120, 53, 15, 0.4)', h: 44, width: 60, speed: 0.07, parallax: 0.08 },
      { color: 'rgba(69, 26, 3, 0.6)', h: 24, width: 36, speed: 0.16, parallax: 0.18 }
    ]
  },
  gold: {
    sky: ['#1c1404', '#4a3306', '#080501'],
    fog: 'rgba(255, 215, 0, 0.08)',
    particle: 'pollen',
    particleColors: ['#ffd700', '#fde68a', '#fff7cc'],
    layers: [
      { color: 'rgba(120, 53, 15, 0.4)', h: 40, width: 62, speed: 0.06, parallax: 0.08 },
      { color: 'rgba(69, 26, 3, 0.55)', h: 22, width: 34, speed: 0.14, parallax: 0.16 }
    ]
  },
  void: {
    sky: ['#06030f', '#120a24', '#010103'],
    fog: 'rgba(168, 85, 247, 0.04)',
    particle: 'data',
    particleColors: ['#a855f7', '#38bdf8', '#e9d5ff'],
    layers: [
      { color: 'rgba(30, 20, 60, 0.45)', h: 38, width: 74, speed: 0.05, parallax: 0.06 },
      { color: 'rgba(18, 10, 36, 0.7)', h: 22, width: 40, speed: 0.13, parallax: 0.14 }
    ]
  },
  office: {
    sky: ['#0b1018', '#1a2333', '#05070a'],
    fog: 'rgba(148, 163, 184, 0.06)',
    particle: 'steam',
    particleColors: ['#cbd5e1', '#94a3b8', '#f8fafc'],
    layers: [
      { color: 'rgba(30, 41, 59, 0.75)', h: 44, width: 54, speed: 0.03, parallax: 0.05 },
      { color: 'rgba(15, 23, 42, 0.9)', h: 24, width: 28, speed: 0.08, parallax: 0.10 }
    ]
  }
};

export const CINEMATIC_LIBRARY = CINEMATIC_TIMELINES;


export class CinematicDirector {
  constructor(game) {
    this.game = game;
    this.isActive = false;
    this.script = null;
    this.commands = [];
    this.commandIndex = 0;
    this.commandStarted = false;
    this.waiting = false;
    this.commandTimer = 0;
    this.cmdType = '';
    this.camera = { x: 160, y: 90, zoom: 1 };
    this.cameraTween = null;
    this.actors = [];
    this.fadeAlpha = 1;
    this.fadeTarget = 1;
    this.flash = { color: '#ffffff', alpha: 0 };
    this.shake = { time: 0, duration: 0.001, intensity: 0, x: 0, y: 0 };
    this.dialogue = null;
    this.dialogueActive = false;
    this.title = '';
    this.subtitle = '';
    this.time = 0;
    this.binaryRain = [];
    this.timeline = null;
    this.caption = null;
    this.captionUntil = 0;
    this.glow = null;
    this.spotlight = null;
    this.projectiles = [];
    this.dialogueUntil = 0;
    this.policeUntil = 0;
    this.bars = false;
    this.background = null;
    this.backgroundConfig = null;
    this.particles = [];
    this.particleType = 'dust';
    this.particleColors = ['#94a3b8', '#cbd5e1'];
    this.particleAccumulator = 0;
    this.beam = null;
    this.onComplete = null;
    this.ending = false;
    this.endingTimer = 0;
    this.previousMusicMode = null;
    this.lastBlip = -1;
  }

  play(scriptOrId, onComplete = null) {
    const script = typeof scriptOrId === 'string'
      ? (getCinematicTimeline(scriptOrId) || CINEMATIC_LIBRARY[scriptOrId] || PROLOGUE_ALEX)
      : scriptOrId;
    this.script = script;
    this.timeline = script.timeline
      ? new CinematicTimeline({ id: script.id, duration: script.duration, events: script.timeline })
      : null;
    this.commands = this.timeline ? [] : (script.commands || []);
    this.commandIndex = 0;
    this.caption = null;
    this.captionUntil = 0;
    this.glow = null;
    this.spotlight = null;
    this.projectiles = [];
    this.dialogueUntil = 0;
    this.policeUntil = 0;
    this.bars = false;
    this.commandStarted = false;
    this.waiting = false;
    this.commandTimer = 0;
    this.cmdType = '';
    this.camera = { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2, zoom: 1 };
    this.cameraTween = null;
    this.actors = [];
    this.fadeAlpha = 1;
    this.fadeTarget = 1;
    this.flash = { color: '#ffffff', alpha: 0 };
    this.shake = { time: 0, duration: 0.001, intensity: 0, x: 0, y: 0 };
    this.dialogue = null;
    this.dialogueActive = false;
    this.title = script.title || '';
    this.subtitle = script.subtitle || '';
    this.time = 0;
    this.beam = null;
    this.lastBlip = -1;
    this.onComplete = typeof onComplete === 'function' ? onComplete : null;
    this.background = script.background || null;
    this.backgroundConfig = script.background ? (BACKGROUNDS[script.background] || null) : null;
    this.particleType = script.particles || this.backgroundConfig?.particle || 'dust';
    this.particleColors = this.backgroundConfig?.particleColors || ['#94a3b8', '#cbd5e1'];
    this.particles = [];
    this.particleAccumulator = 0;
    this.isActive = true;
    this.ending = false;
    this.endingTimer = 0;
    try { this.game?.camera?.resetCinematic?.(); } catch { /* cámara opcional */ }

    this.binaryRain = [];
    for (let i = 0; i < 46; i++) {
      this.binaryRain.push({
        x: Math.random() * LOGICAL_WIDTH,
        y: Math.random() * LOGICAL_HEIGHT,
        speed: 8 + Math.random() * 22,
        char: Math.random() > 0.5 ? '1' : '0',
        alpha: 0.08 + Math.random() * 0.25
      });
    }

    this.previousMusicMode = this.game?.music?.mode || null;
    try {
      this.game?.music?.setMode?.(script.musicMode || 'boss');
      this.game?.player?.stopMovement?.();
    } catch {
      /* audio opcional */
    }
  }

  _actor(id) {
    return this.actors.find((a) => a.id === id) || null;
  }

  _spawn(actor, x, y, options = {}) {
    const id = options.id || actor;
    if (this._actor(id)) return;
    let entry = null;
    if (actor === 'player') {
      // (REFACTOR 1) Nunca tocar al jugador real: actor local con su propio animator.
      const sheet = this.game?.assets?.charactersSheet;
      const player = this.game?.player;
      const heroType = player && player.hasArmor
        ? CHARACTER_TYPES.HERO_ARMORED
        : CHARACTER_TYPES.HERO;
      entry = {
        id,
        animator: sheet ? new SpriteAnimator(sheet, heroType) : null,
        x, y,
        direction: 'right',
        anim: 'idle',
        move: null,
        bob: 0,
        glitch: 0,
        phase: 0,
        alpha: options.alpha ?? 1,
        clone: Boolean(options.clone),
        holo: Boolean(options.holo)
      };
    } else if (Object.prototype.hasOwnProperty.call(ACTOR_SPRITES, actor)) {
      const sheet = this.game?.assets?.charactersSheet;
      entry = {
        id,
        animator: sheet ? new SpriteAnimator(sheet, ACTOR_SPRITES[actor]) : null,
        x, y,
        direction: actor.startsWith('boss') ? 'down' : 'right',
        anim: 'idle',
        move: null,
        bob: 0,
        glitch: actor === 'alex' ? 0.8 : 0,
        phase: Math.random() * Math.PI * 2,
        alpha: options.alpha ?? 1,
        clone: Boolean(options.clone),
        holo: Boolean(options.holo)
      };
    }
    if (entry) this.actors.push(entry);
  }

  _execute(cmd) {
    switch (cmd.action) {
      case 'title':
        this.title = cmd.text || this.title;
        this.subtitle = cmd.subtitle || this.subtitle;
        this._nextCommand();
        break;
      case 'fade':
        this.fadeTarget = cmd.to === 'out' ? 1 : (cmd.to === 'in' ? 0 : Number(cmd.to ?? 1));
        this.cmdType = 'fade';
        this.waiting = true;
        this.commandTimer = cmd.time ?? 0.8;
        break;
      case 'spawn':
        this._spawn(cmd.actor, cmd.x, cmd.y);
        this._nextCommand();
        break;
      case 'camera':
        this.cameraTween = {
          fromX: this.camera.x,
          fromY: this.camera.y,
          fromZoom: this.camera.zoom,
          toX: cmd.x ?? this.camera.x,
          toY: cmd.y ?? this.camera.y,
          toZoom: cmd.zoom ?? this.camera.zoom,
          time: Math.max(0.001, cmd.time ?? 1),
          elapsed: 0
        };
        this.cmdType = 'camera';
        this.waiting = true;
        this.commandTimer = cmd.time ?? 1;
        break;
      case 'move': {
        const actor = this._actor(cmd.actor);
        if (actor) {
          actor.move = {
            fromX: actor.x,
            fromY: actor.y,
            toX: cmd.x,
            toY: cmd.y,
            time: Math.max(0.001, cmd.time ?? 1),
            elapsed: 0
          };
          actor.anim = 'walk';
          actor.direction = Math.abs((cmd.x ?? actor.x) - actor.x) >= Math.abs((cmd.y ?? actor.y) - actor.y)
            ? ((cmd.x ?? actor.x) >= actor.x ? 'right' : 'left')
            : ((cmd.y ?? actor.y) >= actor.y ? 'down' : 'up');
          this.cmdType = 'move';
          this.waiting = true;
          this.commandTimer = cmd.time ?? 1;
        } else {
          this._nextCommand();
        }
        break;
      }
      case 'anim': {
        const actor = this._actor(cmd.actor);
        if (actor) actor.anim = cmd.anim || 'idle';
        this._nextCommand();
        break;
      }
      case 'wait':
        this.cmdType = 'wait';
        this.waiting = true;
        this.commandTimer = cmd.time ?? 1;
        break;
      case 'effect':
        if (cmd.type === 'shake') {
          this.shake = {
            time: cmd.time ?? 0.5,
            duration: Math.max(0.001, cmd.time ?? 0.5),
            intensity: cmd.intensity ?? 5,
            x: 0,
            y: 0
          };
        } else if (cmd.type === 'flash') {
          this.flash = { color: cmd.color || '#ffffff', alpha: 0.8 };
        } else if (cmd.type === 'glitch') {
          const alex = this._actor('alex');
          if (alex) alex.glitch = cmd.time ?? 0.6;
        }
        this._nextCommand();
        break;
      case 'dialogue':
        this.dialogue = {
          speaker: cmd.speaker || '',
          text: cmd.text || '',
          shown: 0,
          finished: false,
          speed: cmd.speed || 42
        };
        this.dialogueActive = true;
        this.cmdType = 'dialogue';
        this.waiting = true;
        this.commandTimer = Math.max(3.5, (cmd.text || '').length / 18 + 2.2);
        break;
      case 'beam': {
        this.beam = {
          from: this._actor(cmd.from),
          to: this._actor(cmd.to),
          time: Math.max(0.001, cmd.time ?? 0.9),
          elapsed: 0
        };
        this.cmdType = 'beam';
        this.waiting = true;
        this.commandTimer = cmd.time ?? 0.9;
        try {
          this.game?.music?.playBossRoar?.();
        } catch {
          /* audio opcional */
        }
        break;
      }
      case 'end':
        this._finish();
        break;
      default:
        this._nextCommand();
    }
  }

  _timelineEvent(ev) {
    if (!ev) return;
    try {
      this._timelineEventRaw(ev);
    } catch (err) {
      console.warn('Evento de cinemática fallido', ev.action, err);
    }
  }

  _timelineEventRaw(ev) {
    switch (ev.action) {
      case 'title':
        this.title = ev.text || this.title;
        this.subtitle = ev.subtitle || this.subtitle;
        break;
      case 'background':
        if (BACKGROUNDS[ev.background]) {
          this.background = ev.background;
          this.backgroundConfig = BACKGROUNDS[ev.background];
          this.particleType = ev.particles || this.backgroundConfig.particle || this.particleType;
          this.particleColors = this.backgroundConfig.particleColors || this.particleColors;
          this.particles = [];
          this.particleAccumulator = 0;
        }
        break;
      case 'caption':
        this.caption = { text: ev.text || '', sub: ev.sub || '', stamp: Boolean(ev.stamp) };
        this.captionUntil = this.time + (ev.duration || 3);
        break;
      case 'fade':
        this.fadeTarget = ev.to === 'out' ? 1 : (ev.to === 'in' ? 0 : Number(ev.to ?? 1));
        break;
      case 'despawn':
        this.actors = this.actors.filter((a) => a.id !== ev.actor);
        break;
      case 'spawn':
        this._spawn(ev.actor, ev.x, ev.y, {
          id: ev.id,
          clone: ev.clone,
          alpha: ev.alpha,
          holo: ev.holo
        });
        break;
      case 'camera':
        this.cameraTween = {
          fromX: this.camera.x,
          fromY: this.camera.y,
          fromZoom: this.camera.zoom,
          toX: ev.x ?? this.camera.x,
          toY: ev.y ?? this.camera.y,
          toZoom: ev.zoom ?? this.camera.zoom,
          time: Math.max(0.001, ev.duration || 1),
          elapsed: 0
        };
        break;
      case 'move': {
        const actor = this._actor(ev.actor);
        if (actor) {
          actor.move = {
            fromX: actor.x,
            fromY: actor.y,
            toX: ev.x,
            toY: ev.y,
            time: Math.max(0.001, ev.duration || 1),
            elapsed: 0
          };
          actor.anim = 'walk';
          actor.direction = Math.abs((ev.x ?? actor.x) - actor.x) >= Math.abs((ev.y ?? actor.y) - actor.y)
            ? ((ev.x ?? actor.x) >= actor.x ? 'right' : 'left')
            : ((ev.y ?? actor.y) >= actor.y ? 'down' : 'up');
        }
        break;
      }
      case 'anim': {
        const actor = this._actor(ev.actor);
        if (actor) actor.anim = ev.anim || 'idle';
        break;
      }
      case 'face': {
        const actor = this._actor(ev.actor);
        if (actor && ev.direction) actor.direction = ev.direction;
        break;
      }
      case 'dialogue':
        this.dialogue = {
          speaker: ev.speaker || '',
          text: ev.text || '',
          shown: 0,
          finished: false,
          speed: ev.speed || 42
        };
        this.dialogueActive = true;
        this.dialogueUntil = this.time + (ev.duration || Math.max(3, (ev.text || '').length / 15));
        break;
      case 'effect':
        if (ev.type === 'shake') {
          this.shake = {
            time: ev.duration ?? 0.5,
            duration: Math.max(0.001, ev.duration ?? 0.5),
            intensity: ev.intensity ?? 5,
            x: 0,
            y: 0
          };
        } else if (ev.type === 'flash') {
          this.flash = { color: ev.color || '#ffffff', alpha: 0.85 };
        } else if (ev.type === 'glitch') {
          const actor = this._actor('alex') || this._actor('alex_phase2');
          if (actor) actor.glitch = ev.duration ?? 0.6;
        } else if (ev.type === 'glow') {
          this.glow = { color: ev.color || '#a855f7', until: this.time + (ev.duration || 3) };
        } else if (ev.type === 'spotlight') {
          this.spotlight = ev.target || null;
        } else if (ev.type === 'police') {
          this.policeUntil = this.time + (ev.duration || 3);
        } else if (ev.type === 'bars') {
          this.bars = true;
        }
        break;
      case 'sfx': {
        const map = {
          boss_roar: 'playBossRoar',
          error_buzz: 'playError',
          electric_shock: 'playShock',
          keyboard_type: 'playKeyboard',
          coffee_sip: 'playCoffee',
          ui_glitch: 'playGlitch',
          console_log: 'playConsoleLog',
          door_airlock: 'playAirlock'
        };
        const method = map[ev.name];
        if (method && typeof this.game?.music?.[method] === 'function') this.game.music[method]();
        else if (typeof this.game?.music?.playSFX === 'function') this.game.music.playSFX(ev.name);
        break;
      }
      case 'projectile':
        this.projectiles.push({
          from: ev.from,
          to: ev.to,
          text: ev.text || '*',
          duration: Math.max(0.2, ev.duration || 1.6),
          elapsed: 0
        });
        break;
      case 'swap': {
        const actor = this._actor(ev.actor);
        const type = ACTOR_SPRITES[ev.sprite];
        if (actor && type !== undefined) {
          actor.animator = new SpriteAnimator(this.game?.assets?.charactersSheet, type);
          actor.sprite = ev.sprite;
        }
        break;
      }
      case 'particles':
        this.particleType = ev.type || this.particleType;
        this.particles = [];
        this.particleAccumulator = 0;
        break;
      case 'music':
        try { this.game?.music?.setMode?.(ev.mode || this.script?.musicMode); } catch { /* opcional */ }
        break;
      case 'end':
        this._finish();
        break;
    }
  }

  _nextCommand() {
    this.commandIndex += 1;
    this.commandStarted = false;
    this.waiting = false;
    this.cmdType = '';
    if (this.commandIndex >= this.commands.length) this._finish();
  }

  _finish() {
    if (!this.isActive || this.ending) return;
    // Fade out limpio; la escena NO termina hasta que el fundido acaba.
    this.ending = true;
    this.endingTimer = 0.7;
    this.fadeTarget = 1;
    this.dialogueActive = false;
    this.dialogue = null;
  }

  _finalize() {
    this.isActive = false;
    this.ending = false;
    this.endingTimer = 0;
    this.dialogueActive = false;
    this.dialogue = null;
    if (this.game?.menuSystem) {
      this.game.menuSystem.state = 'none';
    }
    try {
      this.game?.dialogueBox?.close?.();
    } catch {
      /* diálogo opcional */
    }
    try {
      this.game?.input?.clear?.();
    } catch {
      /* input opcional */
    }
    if (this.game?.player) {
      if (this.game.player.isDead) this.game.player.isDead = false;
      if (this.game.player.isSleeping) this.game.player.isSleeping = false;
      if (!Number.isFinite(this.game.player.x) || !Number.isFinite(this.game.player.y)) {
        this.game.player.x = 224;
        this.game.player.y = 192;
      }
    }
    if (this.previousMusicMode) {
      try {
        this.game?.music?.setMode?.(this.previousMusicMode);
      } catch {
        /* audio opcional */
      }
    }
    try {
      this.game?.camera?.resetCinematic?.();
      this.game?.camera?.snapTo?.(this.game.player);
    } catch {
      /* cámara opcional */
    }
    const cb = this.onComplete;
    this.onComplete = null;
    if (cb) cb();
  }

  _applyHorizontalInput(input) {
    if (!input) return;
    if (typeof input.consumeKey === 'function' && input.consumeKey('Escape')) {
      input.clear?.();
      this._finish();
      return;
    }
    const clicked = Boolean(input.pointerJustClicked);
    if (clicked) {
      input.pointerJustClicked = false;
    }
    const keyAdvance =
      typeof input.consumeKey === 'function' &&
      (input.consumeKey('Space') || input.consumeKey('Enter') ||
        input.consumeKey('KeyE') || input.consumeKey('KeyF'));
    if (!keyAdvance && !clicked) return;
    if (this.dialogueActive && this.dialogue) {
      if (this.dialogue.finished) {
        this.dialogueActive = false;
        this.dialogue = null;
        this.waiting = false;
        if (!this.timeline) this._nextCommand();
      } else {
        this.dialogue.shown = this.dialogue.text.length;
        this.dialogue.finished = true;
      }
    } else if (!this.timeline && this.cmdType === 'wait') {
      this.commandTimer = 0;
    }
  }

  update(dt, input) {
    if (!this.isActive) return;
    // Clamp: un frame largo tras una carga no debe saltarse eventos.
    const step = Math.min(Math.max(0, Number(dt) || 0), 0.05);

    if (this.ending) {
      this.endingTimer -= step;
      this.fadeTarget = 1;
      this.fadeAlpha = Math.min(1, this.fadeAlpha + step * 3.2);
        if (this.endingTimer <= 0) this._finalize();
      return;
    }

    this.time += step;
    this._applyHorizontalInput(input);

    if (this.timeline) {
      const done = this.timeline.update(step, (ev) => this._timelineEvent(ev));
      this.time = this.timeline.time;
      if (done) {
        this._finish();
        return;
      }
    }

    if (this.shake.time > 0) {
      this.shake.time = Math.max(0, this.shake.time - dt);
      const amp = this.shake.intensity * (this.shake.time / this.shake.duration);
      this.shake.x = (Math.random() * 2 - 1) * amp;
      this.shake.y = (Math.random() * 2 - 1) * amp;
    } else {
      this.shake.x = 0;
      this.shake.y = 0;
    }
    if (this.flash.alpha > 0) this.flash.alpha = Math.max(0, this.flash.alpha - dt * 3);

    const fadeDir = Math.sign(this.fadeTarget - this.fadeAlpha);
    if (fadeDir !== 0) {
      this.fadeAlpha = Math.max(0, Math.min(1, this.fadeAlpha + fadeDir * dt * 2.6));
    }

    if (this.cameraTween) {
      const tw = this.cameraTween;
      tw.elapsed += dt;
      const p = Math.min(1, tw.elapsed / tw.time);
      const e = 1 - Math.pow(1 - p, 3);
      this.camera.x = tw.fromX + (tw.toX - tw.fromX) * e;
      this.camera.y = tw.fromY + (tw.toY - tw.fromY) * e;
      this.camera.zoom = tw.fromZoom + (tw.toZoom - tw.fromZoom) * e;
      if (p >= 1) this.cameraTween = null;
    }

    for (const actor of this.actors) {
      if (actor.move) {
        actor.move.elapsed += dt;
        const p = Math.min(1, actor.move.elapsed / actor.move.time);
        const e = 1 - Math.pow(1 - p, 3);
        actor.x = actor.move.fromX + (actor.move.toX - actor.move.fromX) * e;
        actor.y = actor.move.fromY + (actor.move.toY - actor.move.fromY) * e;
        actor.anim = 'walk';
        if (p >= 1) {
          actor.move = null;
          actor.anim = 'idle';
        }
      }
      if (actor.animator) {
        actor.animator.update(dt, actor.direction, actor.anim === 'walk');
      }
      const bobAmount = actor.id.startsWith('boss_') ? 2.4 : ((actor.id === 'alex' || actor.id === 'alex_phase2') ? 3 : 1.1);
      actor.bob = Math.sin(this.time * 2.2 + (actor.phase || 0)) * bobAmount;
      if (actor.id === 'alex' || actor.id === 'alex_phase2') actor.glitch = Math.max(0, actor.glitch - dt);
    }
    this._updateParticles(dt);
    if (this.dialogueActive && this.dialogue && this.dialogueUntil && this.time >= this.dialogueUntil) {
      this.dialogueActive = false;
      this.dialogue = null;
    }
    if (this.caption && this.captionUntil && this.time >= this.captionUntil) this.caption = null;
    if (this.glow && this.glow.until && this.time >= this.glow.until) this.glow = null;
    for (const pr of this.projectiles) {
      pr.elapsed += dt;
    }
    this.projectiles = this.projectiles.filter((pr) => pr.elapsed < pr.duration + 0.25);

    for (const drop of this.binaryRain) {
      drop.y += drop.speed * dt;
      if (drop.y > LOGICAL_HEIGHT + 4) {
        drop.y = -4;
        drop.x = Math.random() * LOGICAL_WIDTH;
      }
    }

    if (this.dialogueActive && this.dialogue && !this.dialogue.finished) {
      this.dialogue.shown = Math.min(
        this.dialogue.text.length,
        this.dialogue.shown + dt * this.dialogue.speed
      );
      const idx = Math.floor(this.dialogue.shown);
      if (idx !== this.lastBlip && idx % 3 === 0) {
        this.lastBlip = idx;
        try {
          this.game?.music?.playVoiceBlip?.(this.dialogue.speaker, this.dialogue.text[idx] || 'a');
        } catch {
          /* audio opcional */
        }
      }
      if (this.dialogue.shown >= this.dialogue.text.length) {
        this.dialogue.finished = true;
      }
    }

    if (this.beam) {
      this.beam.elapsed += dt;
      if (this.beam.elapsed >= this.beam.time + 0.3) this.beam = null;
    }

    if (this.timeline) return;

    if (this.waiting) {
      this.commandTimer -= dt;
      if (this.cmdType === 'dialogue') {
        if (this.commandTimer <= 0 && (!this.dialogue || this.dialogue.shown >= this.dialogue.text.length)) {
          this.dialogueActive = false;
          this.dialogue = null;
          this.waiting = false;
          this._nextCommand();
        }
      } else if (this.commandTimer <= 0) {
        this._nextCommand();
      }
      return;
    }

    if (this.commandIndex >= this.commands.length) {
      this._finish();
      return;
    }

    if (!this.commandStarted) {
      this.commandStarted = true;
      this._execute(this.commands[this.commandIndex]);
    }
  }

  _drawBackground(ctx, W, H) {
    const cfg = this.backgroundConfig;
    if (!cfg) {
      const voidGrad = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.72);
      voidGrad.addColorStop(0, '#17102e');
      voidGrad.addColorStop(0.5, '#0a0718');
      voidGrad.addColorStop(1, '#020107');
      ctx.fillStyle = voidGrad;
      ctx.fillRect(0, 0, W, H);
      return;
    }

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, cfg.sky[0]);
    sky.addColorStop(0.55, cfg.sky[1]);
    sky.addColorStop(1, cfg.sky[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Parallax procedural: siluetas de fondo que se desplazan con cámara y tiempo.
    for (const layer of cfg.layers) {
      const scroll = this.time * 11 * layer.speed;
      const pan = this.camera.x * layer.parallax;
      const offset = (((-scroll - pan) % layer.width) + layer.width) % layer.width;
      ctx.fillStyle = layer.color;
      for (let x = -offset; x < W + layer.width; x += layer.width) {
        ctx.fillRect(x, H - layer.h, layer.width * 0.78, layer.h);
        ctx.fillRect(x + layer.width * 0.12, H - layer.h - 7, layer.width * 0.38, 7);
        ctx.fillRect(x + layer.width * 0.62, H - layer.h - 3, layer.width * 0.2, 3);
      }
    }

    if (cfg.fog) {
      const fog = ctx.createLinearGradient(0, H * 0.45, 0, H);
      fog.addColorStop(0, 'rgba(0, 0, 0, 0)');
      fog.addColorStop(1, cfg.fog);
      ctx.fillStyle = fog;
      ctx.fillRect(0, H * 0.45, W, H * 0.55);
    }
  }

  _makeParticle() {
    const W = LOGICAL_WIDTH;
    const H = LOGICAL_HEIGHT;
    const color = this.particleColors[Math.floor(Math.random() * this.particleColors.length)];
    const base = {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: 0,
      vy: 0,
      size: 1,
      life: 2,
      maxLife: 2,
      color,
      type: this.particleType,
      char: Math.random() < 0.5 ? '0' : '1',
      phase: Math.random() * Math.PI * 2
    };
    if (this.particleType === 'dust') {
      base.y = H + 2;
      base.vx = (Math.random() - 0.5) * 7;
      base.vy = -5 - Math.random() * 8;
      base.size = 1;
      base.life = base.maxLife = 2.5 + Math.random() * 2;
    } else if (this.particleType === 'embers') {
      base.y = H + 2;
      base.vx = (Math.random() - 0.5) * 10;
      base.vy = -10 - Math.random() * 12;
      base.size = 1;
      base.life = base.maxLife = 1.5 + Math.random() * 1.5;
    } else if (this.particleType === 'sparks') {
      base.y = H + 2;
      base.vx = (Math.random() - 0.5) * 18;
      base.vy = -18 - Math.random() * 18;
      base.size = 1;
      base.life = base.maxLife = 0.8 + Math.random() * 0.9;
    } else if (this.particleType === 'rain') {
      base.y = -2;
      base.vx = -6;
      base.vy = 40 + Math.random() * 30;
      base.size = 1;
      base.life = base.maxLife = 3;
    } else if (this.particleType === 'data') {
      base.y = -4;
      base.vx = 0;
      base.vy = 12 + Math.random() * 14;
      base.size = 4;
      base.life = base.maxLife = 4;
    } else if (this.particleType === 'steam') {
      base.y = H + 2;
      base.vx = (Math.random() - 0.5) * 3;
      base.vy = -6 - Math.random() * 6;
      base.size = 1;
      base.life = base.maxLife = 2 + Math.random() * 2;
    } else if (this.particleType === 'leaves') {
      base.vx = -5 - Math.random() * 7;
      base.vy = 5 + Math.random() * 6;
      base.size = 1.5;
      base.life = base.maxLife = 4 + Math.random() * 3;
    } else if (this.particleType === 'pollen') {
      base.vx = -1.5 - Math.random() * 2;
      base.vy = 1 + Math.random() * 2;
      base.size = 1;
      base.life = base.maxLife = 4 + Math.random() * 3;
    }
    return base;
  }

  _updateParticles(dt) {
    const rate = this.particleType === 'rain' ? 30
      : this.particleType === 'sparks' ? 12
        : this.particleType === 'steam' ? 8
        : this.particleType === 'data' ? 6
          : this.particleType === 'embers' ? 9
            : 5;
    this.particleAccumulator += dt * rate;
    while (this.particleAccumulator >= 1) {
      this.particleAccumulator -= 1;
      if (this.particles.length < 54) this.particles.push(this._makeParticle());
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt + Math.sin(this.time * 1.4 + p.phase) * 2 * dt;
      p.y += p.vy * dt;
      if (p.life <= 0 || p.y < -12 || p.y > LOGICAL_HEIGHT + 14 || p.x < -12 || p.x > LOGICAL_WIDTH + 12) {
        this.particles.splice(i, 1);
      }
    }
  }

  _drawParticles(ctx, W, H) {
    for (const p of this.particles) {
      const a = Math.max(0, Math.min(1, p.life / Math.max(0.01, p.maxLife)));
      ctx.globalAlpha = p.type === 'data' ? 0.35 + a * 0.4 : 0.3 + a * 0.55;
      ctx.fillStyle = p.color;
      if (p.type === 'data') {
        ctx.font = '4px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.char, p.x, p.y);
      } else {
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawBinaryRain(ctx, W, H) {
    const isExpansion = this.script?.id === 'prologue_expansion';
    ctx.font = 'bold 4.5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i < this.binaryRain.length; i++) {
      const drop = this.binaryRain[i];
      ctx.fillStyle = isExpansion
        ? (i % 3 === 0 ? `rgba(34, 211, 238, ${Math.min(0.85, drop.alpha + 0.3)})` : `rgba(34, 197, 94, ${Math.min(0.75, drop.alpha + 0.25)})`)
        : `rgba(168, 85, 247, ${drop.alpha})`;
      ctx.fillText(drop.char, drop.x, drop.y);
    }
  }

  _drawActors(ctx) {
    for (const actor of this.actors) {
      if (!actor) continue;
      try {
      const bob = actor.bob || 0;
      const x = Math.round(actor.x - 8);
      const y = Math.round(actor.y - 16 + bob);
      ctx.save();
      const holoFlicker = actor.holo ? (0.55 + Math.sin(this.time * 18 + (actor.phase || 0)) * 0.25) : 1;
      ctx.globalAlpha = (actor.alpha ?? 1) * holoFlicker;

      // Sombra en el suelo.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(actor.x, actor.y + 0.5, 7, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();

      if (actor.id === 'alex') {
        // Aura púrpura + partículas de código binario.
        const aura = ctx.createRadialGradient(actor.x, actor.y - 8, 2, actor.x, actor.y - 8, 32 + Math.sin(this.time * 3) * 5);
        aura.addColorStop(0, 'rgba(168, 85, 247, 0.38)');
        aura.addColorStop(0.55, 'rgba(88, 28, 135, 0.16)');
        aura.addColorStop(1, 'rgba(168, 85, 247, 0)');
        ctx.fillStyle = aura;
        ctx.fillRect(actor.x - 34, actor.y - 40, 68, 68);

        ctx.font = '4px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < 8; i++) {
          const a = this.time * 0.9 + (i * Math.PI) / 4;
          const r = 16 + Math.sin(this.time * 2 + i) * 4;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(216, 180, 254, 0.7)' : 'rgba(56, 189, 248, 0.55)';
          ctx.fillText(i % 2 ? '1' : '0', actor.x + Math.cos(a) * r, actor.y - 8 + Math.sin(a) * r * 0.7);
        }
      }

      if (actor.animator) {
        // Glitch: copias desplazadas y barras de color sobre el sprite.
        if (actor.id === 'alex' && actor.glitch > 0) {
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(
            actor.animator.spriteSheet,
            actor.animator.currentFrame * actor.animator.frameWidth * 4,
            (actor.animator.characterIndex * 4) * actor.animator.frameHeight * 4,
            actor.animator.frameWidth * 4,
            actor.animator.frameHeight * 4,
            x - 2 + Math.sin(this.time * 40) * 2,
            y,
            16,
            16
          );
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = '#a855f7';
          for (let i = 0; i < 4; i++) {
            ctx.fillRect(x - 2, y + 2 + i * 3 + Math.random() * 2, 20, 1);
          }
          ctx.restore();
        }
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        actor.animator.draw(ctx, x, y);
        ctx.restore();
      }
      ctx.restore();
      } catch (err) {
        // Un actor ausente o un sprite no cargado nunca debe romper la cinemática.
        console.warn('[CinematicDirector] Actor omitido:', err?.message || err);
      }
    }
  }

  _drawBeam(ctx) {
    if (!this.beam || !this.beam.from || !this.beam.to) return;
    const from = this.beam.from;
    const to = this.beam.to;
    const p = Math.min(1, this.beam.elapsed / this.beam.time);
    const fx = from.x;
    const fy = from.y - 10;
    const tx = to.x;
    const ty = to.y - 10;
    const burst = p < 0.75 ? 1 : Math.max(0, 1 - (p - 0.75) / 0.25);

    ctx.save();
    ctx.globalAlpha = burst;
    ctx.strokeStyle = '#e9d5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      const jitter = (Math.random() * 2 - 1) * 4 * (1 - Math.abs(t - 0.5) * 2);
      ctx.lineTo(fx + (tx - fx) * t + jitter, fy + (ty - fy) * t + jitter);
    }
    ctx.lineTo(tx, ty);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(168, 85, 247, 0.75)';
    ctx.lineWidth = 5;
    ctx.globalAlpha = burst * 0.35;
    ctx.stroke();

    for (let i = 0; i < 14; i++) {
      const t = Math.random();
      ctx.fillStyle = i % 2 ? '#c084fc' : '#67e8f9';
      ctx.fillRect(fx + (tx - fx) * t + (Math.random() * 8 - 4), fy + (ty - fy) * t + (Math.random() * 8 - 4), 1, 1);
    }
    ctx.restore();
  }

  _screenPoint(wx, wy, W, H) {
    const zoom = this.camera.zoom;
    return {
      x: W / 2 + this.shake.x + (wx - this.camera.x) * zoom,
      y: H / 2 + this.shake.y + (wy - this.camera.y) * zoom
    };
  }

  _drawGlow(ctx, W, H) {
    if (!this.glow) return;
    const actor = this._actor('alex') || this._actor('alex_phase2') ||
      this.actors[this.actors.length - 1];
    if (!actor) return;
    const p = this._screenPoint(actor.x, actor.y - 8, W, H);
    const r = 34 * this.camera.zoom;
    const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r);
    g.addColorStop(0, this.glow.color || '#a855f7');
    g.addColorStop(0.35, `${this.glow.color || '#a855f7'}55`);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    ctx.restore();
  }

  _drawProjectiles(ctx, W, H) {
    if (!this.projectiles.length) return;
    for (const pr of this.projectiles) {
      const from = this._actor(pr.from);
      const to = this._actor(pr.to);
      if (!from || !to) continue;
      const a = this._screenPoint(from.x, from.y - 10, W, H);
      const b = this._screenPoint(to.x, to.y - 10, W, H);
      const head = Math.min(1, pr.elapsed / pr.duration);
      for (let i = 0; i < 12; i++) {
        const t = ((head + i * 0.035) % 1);
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t + Math.sin(t * 22 + this.time * 6) * 4;
        ctx.fillStyle = i % 3 === 0 ? '#e9d5ff' : (i % 3 === 1 ? '#67e8f9' : '#c084fc');
        ctx.fillRect(Math.round(x), Math.round(y), i % 2 ? 2 : 1, i % 2 ? 2 : 1);
      }
      if (pr.text && pr.text !== '*') {
        const x = a.x + (b.x - a.x) * head;
        const y = a.y + (b.y - a.y) * head;
        ctx.font = '4px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#a5f3fc';
        ctx.fillText(String(pr.text), x, y - 8);
      }
    }
  }

  _drawSpotlight(ctx, W, H) {
    if (!this.spotlight) return;
    const actor = this._actor(this.spotlight);
    if (!actor) return;
    const p = this._screenPoint(actor.x, actor.y - 8, W, H);
    const r = 56 * this.camera.zoom;
    // Oscurece los bordes SIN borrar al personaje (nada de destination-out).
    const g = ctx.createRadialGradient(p.x, p.y, r * 0.16, p.x, p.y, r);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(0.5, 'rgba(0, 0, 0, 0.22)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.82)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  _drawCaption(ctx, W, H) {
    if (!this.caption) return;
    const text = this.caption.text || '';
    if (!text) return;
    ctx.save();
    if (this.caption.stamp) {
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-0.04);
      ctx.fillStyle = 'rgba(120, 20, 20, 0.2)';
      ctx.fillRect(-W / 2, -34, W, 68);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.strokeRect(-W / 2 + 8, -26, W - 16, 52);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-W / 2 + 13, -21, W - 26, 42);
      UILayout.drawText(ctx, text, 0, -2, {
        font: 'bold 9px monospace',
        color: '#fecaca',
        shadow: true,
        align: 'center'
      });
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.76)';
    ctx.fillRect(0, H / 2 - 28, W, 56);
    UILayout.drawText(ctx, text, W / 2, H / 2 - 3, {
      font: 'bold 7px monospace',
      color: '#f8fafc',
      shadow: true,
      align: 'center'
    });
    if (this.caption.sub) {
      UILayout.drawText(ctx, this.caption.sub, W / 2, H / 2 + 8, {
        font: '5px monospace',
        color: '#e5c07b',
        shadow: true,
        align: 'center'
      });
    }
    ctx.restore();
  }

  _drawPolice(ctx, W, H) {
    if (!this.policeUntil || this.time >= this.policeUntil) return;
    const phase = Math.floor(this.time * 8) % 2;
    ctx.save();
    ctx.fillStyle = phase === 0 ? 'rgba(239, 68, 68, 0.16)' : 'rgba(59, 130, 246, 0.16)';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, phase === 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)');
    g.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, phase === 0 ? 'rgba(59, 130, 246, 0.25)' : 'rgba(239, 68, 68, 0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  _drawBars(ctx, W, H) {
    if (!this.bars) return;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(0, 0, W, 8);
    ctx.fillRect(0, H - 10, W, 10);
    for (let x = 6; x < W; x += 16) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(x, 0, 3, H);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.fillRect(x + 1, 0, 1, H);
    }
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, H * 0.5 - 2, W, 3);
    ctx.restore();
  }

  _drawLetterbox(ctx, W, H) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, 14);
    ctx.fillRect(0, H - 14, W, 14);
  }

  _drawTitle(ctx) {
    if (!this.title && !this.subtitle) return;
    const x = 10;
    const y = 19;
    if (this.title) {
      UILayout.drawText(ctx, this.title, x, y, {
        font: 'bold 5px monospace',
        color: '#c084fc',
        shadow: true
      });
    }
    if (this.subtitle) {
      UILayout.drawText(ctx, this.subtitle, x, y + 8, {
        font: 'bold 7px monospace',
        color: '#ffd700',
        shadow: true
      });
    }
  }

  _drawDialogue(ctx, W, H) {
    if (!this.dialogueActive || !this.dialogue) return;
    const boxX = 12;
    const boxW = W - 24;
    const boxH = 40;
    const boxY = H - 14 - boxH - 4;
    const text = this.dialogue.text.slice(0, Math.floor(this.dialogue.shown));
    const font = '7px monospace';

    ctx.save();
    UILayout.drawShadow(ctx, boxX, boxY, boxW, boxH, 0.45);
    const glass = ctx.createLinearGradient(0, boxY, 0, boxY + boxH);
    glass.addColorStop(0, 'rgba(15, 23, 42, 0.94)');
    glass.addColorStop(1, 'rgba(7, 12, 22, 0.96)');
    ctx.fillStyle = glass;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#e5c07b';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX + 1, boxY + 1, boxW - 2, boxH - 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 4.5, boxY + 4.5, boxW - 9, boxH - 9);

    if (this.dialogue.speaker) {
      ctx.font = 'bold 6px monospace';
      const sw = Math.ceil(ctx.measureText(this.dialogue.speaker).width) + 8;
      ctx.fillStyle = '#e5c07b';
      ctx.fillRect(boxX + 5, boxY - 6, sw, 9);
      ctx.fillStyle = '#151006';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.dialogue.speaker, boxX + 9, boxY - 1.5);
    }

    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const lines = UILayout.wrapText(ctx, text, boxW - 20);
    lines.slice(0, 3).forEach((line, i) => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillText(line, boxX + 11, boxY + 10 + i * 9 + 1);
      ctx.fillStyle = '#f0f4f8';
      ctx.fillText(line, boxX + 10, boxY + 10 + i * 9);
    });

    if (this.dialogue.finished) {
      const bob = Math.sin(this.time * 6) * 1.2;
      const tx = boxX + boxW - 11;
      const ty = boxY + boxH - 10 + bob;
      ctx.fillStyle = '#ffd885';
      ctx.beginPath();
      ctx.moveTo(tx - 4, ty);
      ctx.lineTo(tx + 1, ty);
      ctx.lineTo(tx - 1.5, ty + 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  render(ctx) {
    if (!this.isActive) return;
    const W = LOGICAL_WIDTH;
    const H = LOGICAL_HEIGHT;
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    this._drawBackground(ctx, W, H);
    if (this.particleType === 'data') {
      this._drawBinaryRain(ctx, W, H);
    }

    // Cámara cinematográfica: pan + zoom + shake.
    ctx.save();
    ctx.translate(W / 2 + this.shake.x, H / 2 + this.shake.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);
    this._drawActors(ctx);
    this._drawBeam(ctx);
    ctx.restore();

    this._drawGlow(ctx, W, H);
    this._drawProjectiles(ctx, W, H);
    this._drawParticles(ctx, W, H);
    this._drawPolice(ctx, W, H);
    this._drawBars(ctx, W, H);

    // Viñeta.
    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, W * 0.62);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    this._drawLetterbox(ctx, W, H);
    this._drawTitle(ctx);
    this._drawSpotlight(ctx, W, H);
    this._drawDialogue(ctx, W, H);

    if (this.flash.alpha > 0) {
      ctx.fillStyle = this.flash.color;
      ctx.globalAlpha = this.flash.alpha;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (this.fadeAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
    // La caption final (CAPÍTULO I) va SOBRE el fundido para que no desaparezca.
    this._drawCaption(ctx, W, H);
    ctx.restore();
  }
}
