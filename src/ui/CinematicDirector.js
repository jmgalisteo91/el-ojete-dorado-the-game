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

export const PROLOGUE_ALEX = {
  id: 'prologue_alex',
  title: 'PRÓLOGO',
  subtitle: 'EL VACÍO DE DATOS',
  commands: [
    { action: 'title', text: 'PRÓLOGO', subtitle: 'EL VACÍO DE DATOS' },
    { action: 'fade', to: 0, time: 0.9 },
    { action: 'spawn', actor: 'alex', x: 160, y: 88 },
    { action: 'camera', x: 160, y: 88, zoom: 1.05, time: 0.01 },
    { action: 'effect', type: 'glitch', time: 0.7 },
    { action: 'wait', time: 0.7 },
    { action: 'dialogue', speaker: 'MISTER AI ALEX', text: 'En los confines oscuros del código, donde ningún compilador se atreve a mirar...' },
    { action: 'camera', x: 160, y: 84, zoom: 1.85, time: 8.0 },
    { action: 'spawn', actor: 'player', x: 36, y: 132 },
    { action: 'anim', actor: 'player', anim: 'walk' },
    { action: 'move', actor: 'player', x: 146, y: 120, time: 2.4 },
    { action: 'anim', actor: 'player', anim: 'idle' },
    { action: 'dialogue', speaker: 'MISTER AI ALEX', text: 'Un simple campesino... ¿osando pisar mi dominio?' },
    { action: 'beam', from: 'alex', to: 'player', time: 0.9 },
    { action: 'effect', type: 'shake', intensity: 7, time: 0.7 },
    { action: 'dialogue', speaker: 'MISTER AI ALEX', text: 'Bienvenido al Ojete Dorado... donde tus datos serán míos.' },
    { action: 'fade', to: 1, time: 1.0 },
    { action: 'end' }
  ]
};

export const CINEMATIC_LIBRARY = {
  prologue_alex: PROLOGUE_ALEX
};

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
    this.beam = null;
    this.onComplete = null;
    this.previousMusicMode = null;
    this.lastBlip = -1;
  }

  play(scriptOrId, onComplete = null) {
    const script = typeof scriptOrId === 'string'
      ? (CINEMATIC_LIBRARY[scriptOrId] || PROLOGUE_ALEX)
      : scriptOrId;
    this.script = script;
    this.commands = script.commands || [];
    this.commandIndex = 0;
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
    this.isActive = true;

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
      this.game?.music?.setMode?.('boss');
      this.game?.player?.stopMovement?.();
    } catch {
      /* audio opcional */
    }
  }

  _actor(id) {
    return this.actors.find((a) => a.id === id) || null;
  }

  _spawn(actor, x, y) {
    if (this._actor(actor)) return;
    let entry = null;
    if (actor === 'player' && this.game?.player) {
      const player = this.game.player;
      player.x = x - 8;
      player.y = y - 16;
      entry = {
        id: 'player',
        entity: player,
        animator: player.animator,
        x, y,
        direction: 'right',
        anim: 'idle',
        move: null,
        bob: 0,
        glitch: 0
      };
    } else if (actor === 'alex') {
      const sheet = this.game?.assets?.charactersSheet;
      entry = {
        id: 'alex',
        animator: sheet ? new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_KNIGHT) : null,
        x, y,
        direction: 'down',
        anim: 'idle',
        move: null,
        bob: 0,
        glitch: 0.8
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

  _nextCommand() {
    this.commandIndex += 1;
    this.commandStarted = false;
    this.waiting = false;
    this.cmdType = '';
    if (this.commandIndex >= this.commands.length) this._finish();
  }

  _finish() {
    if (!this.isActive) return;
    this.isActive = false;
    this.dialogueActive = false;
    if (this.previousMusicMode) {
      try {
        this.game?.music?.setMode?.(this.previousMusicMode);
      } catch {
        /* audio opcional */
      }
    }
    try {
      this.game?.camera?.snapTo?.(this.game.player);
    } catch {
      /* cámara opcional */
    }
    const cb = this.onComplete;
    this.onComplete = null;
    if (cb) cb();
  }

  _applyHorizontalInput(input) {
    if (!input || typeof input.consumeKey !== 'function') return;
    if (input.consumeKey('Escape')) {
      this._finish();
      return;
    }
    const advance = input.consumeKey('Space') || input.consumeKey('Enter') ||
      input.consumeKey('KeyE') || input.consumeKey('KeyF');
    if (!advance) return;
    if (this.dialogueActive && this.dialogue) {
      if (this.dialogue.finished) {
        this.dialogueActive = false;
        this.dialogue = null;
        this.waiting = false;
        this._nextCommand();
      } else {
        this.dialogue.shown = this.dialogue.text.length;
        this.dialogue.finished = true;
      }
    } else if (this.cmdType === 'wait') {
      this.commandTimer = 0;
    }
  }

  update(dt, input) {
    if (!this.isActive) return;
    this.time += dt;
    this._applyHorizontalInput(input);

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
      if (actor.entity) {
        actor.entity.x = actor.x - 8;
        actor.entity.y = actor.y - 16;
        actor.entity.direction = actor.direction;
      }
      if (actor.animator) {
        actor.animator.update(dt, actor.direction, actor.anim === 'walk');
      }
      if (actor.id === 'alex') {
        actor.bob = Math.sin(this.time * 2.2) * 3;
        actor.glitch = Math.max(0, actor.glitch - dt);
      }
    }

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

    if (this.waiting) {
      this.commandTimer -= dt;
      if (this.commandTimer <= 0 && this.cmdType !== 'dialogue') {
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

  _drawBinaryRain(ctx, W, H) {
    ctx.font = '4px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const drop of this.binaryRain) {
      ctx.fillStyle = `rgba(168, 85, 247, ${drop.alpha})`;
      ctx.fillText(drop.char, drop.x, drop.y);
    }
  }

  _drawActors(ctx) {
    for (const actor of this.actors) {
      const bob = actor.id === 'alex' ? actor.bob : 0;
      const x = Math.round(actor.x - 8);
      const y = Math.round(actor.y - 16 + bob);

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

    // Void radial + lluvia binaria.
    const voidGrad = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.72);
    voidGrad.addColorStop(0, '#17102e');
    voidGrad.addColorStop(0.5, '#0a0718');
    voidGrad.addColorStop(1, '#020107');
    ctx.fillStyle = voidGrad;
    ctx.fillRect(0, 0, W, H);
    this._drawBinaryRain(ctx, W, H);

    // Cámara cinematográfica: pan + zoom + shake.
    ctx.save();
    ctx.translate(W / 2 + this.shake.x, H / 2 + this.shake.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);
    this._drawActors(ctx);
    this._drawBeam(ctx);
    ctx.restore();

    // Viñeta.
    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, W * 0.62);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    this._drawLetterbox(ctx, W, H);
    this._drawTitle(ctx);
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
    ctx.restore();
  }
}
