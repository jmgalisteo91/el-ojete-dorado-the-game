/**
 * AnimeCutsceneManager.js · (REESCRITO v2.0)
 *
 * Las cinemáticas ya NO usan ilustraciones vectoriales ni diapositivas SVG.
 * Este manager construye guiones para `CinematicDirector`, que renderiza
 * personajes sprite reales (Player, guardias, oráculo, Alex y los 3 jefes),
 * cámara con zoom/pan, fondos procedurales con parallax, partículas,
 * iluminación y letterbox.
 *
 * API compatible con main.js: playCutscene(scene, onComplete), isActive,
 * cameraShake(), flash().
 */

import {
  SCENE_AI_ALEX_WARNING,
  SCENE_ENDING_VICTORY
} from '../assets/VillainDialogues.js?v=8';

import {
  PROLOGUE_ALEX,
  CINEMATIC_TIMELINES,
  SCENE_ALEX_FINAL,
  SCENE_AI_ALEX_PREBATTLE,
  SCENE_INTRO_INAKITO,
  SCENE_JAIL_ARREST
} from '../assets/CinematicTimelines.js?v=8';

import {
  SCENE_INTRO_GARBAGE_COLLECTOR,
  SCENE_INTRO_STACK_OVERFLOW,
  SCENE_INTRO_PROTOTYPE_MICROWAVE,
  BOSS_CUTSCENES,
  getBossIntroCutscene
} from '../assets/BossCutscenes.js?v=8';

const SCENE_META = {
  scene_jail_arrest: { background: 'jail', particles: 'dust', actor: 'guard', camera: { x: 174, y: 104, zoom: 1.85 } },
  scene_deus_purification: { background: 'divine', particles: 'leaves', actor: 'oracle', camera: { x: 174, y: 104, zoom: 1.85 } },
  scene_ai_alex_warning: { background: 'citadel', particles: 'data', actor: 'alex', camera: { x: 176, y: 104, zoom: 1.9 } },
  scene_ai_alex_prebattle: { background: 'citadel', particles: 'data', actor: 'alex', camera: { x: 176, y: 104, zoom: 1.9 } },
  scene_ending_victory: { background: 'gold', particles: 'pollen', actor: 'alex', camera: { x: 170, y: 104, zoom: 1.85 } },
  scene_intro_garbage_collector: { background: 'sewer', particles: 'dust', actor: 'boss_gc', camera: { x: 178, y: 104, zoom: 1.95 } },
  scene_intro_stack_overflow: { background: 'temple', particles: 'embers', actor: 'boss_stack', camera: { x: 178, y: 104, zoom: 1.95 } },
  scene_intro_prototype_microwave: { background: 'forge', particles: 'sparks', actor: 'boss_microwave', camera: { x: 178, y: 104, zoom: 1.95 } }
};

export class AnimeCutsceneManager {
  constructor(viewportWidth = 320, viewportHeight = 180, music = null, director = null) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.music = music;
    this.director = director;
    this.effectsEnabled = true;
  }

  get isActive() {
    return Boolean(this.director && this.director.isActive);
  }

  _buildScript(scene) {
    const slides = Array.isArray(scene) ? scene : (scene && scene.slides ? scene.slides : []);
    const id = (scene && scene.id) || 'cutscene';
    const meta = SCENE_META[id] || { background: 'citadel', particles: 'data', actor: 'alex' };
    const title = (scene && scene.title) || '';
    const actor = meta.actor || 'alex';

    const commands = [
      { action: 'fade', to: 0, time: 0.35 },
      { action: 'title', text: title, subtitle: (scene && scene.subtitle) || '' },
      { action: 'spawn', actor: 'hero', x: 112, y: 116 }
    ];

    if (actor === 'alex') commands.push({ action: 'spawn', actor: 'alex', x: 204, y: 116 });
    else if (actor === 'guard') commands.push({ action: 'spawn', actor: 'guard', x: 204, y: 120 });
    else if (actor === 'oracle') commands.push({ action: 'spawn', actor: 'oracle', x: 204, y: 120 });
    else commands.push({ action: 'spawn', actor, x: 204, y: 116 });

    const camera = meta.camera || { x: 160, y: 98, zoom: 1.55 };
    commands.push(
      { action: 'camera', x: camera.x, y: camera.y, zoom: camera.zoom, time: 0.01 },
      { action: 'wait', time: 0.35 }
    );

    for (const slide of slides) {
      const text = slide.text || slide.dialogue || '';
      if (!text) continue;
      commands.push({
        action: 'dialogue',
        speaker: slide.speaker || title,
        text
      });
      if (slide.shake || slide.cameraShake) {
        commands.push({
          action: 'effect',
          type: 'shake',
          intensity: (slide.shake && slide.shake.intensity) || 4.5,
          time: (slide.shake && slide.shake.duration) || 0.35
        });
      }
      if (slide.flash) {
        commands.push({
          action: 'effect',
          type: 'flash',
          color: (slide.flash && slide.flash.color) || '#ffffff'
        });
      }
    }

    commands.push(
      { action: 'fade', to: 1, time: 0.6 },
      { action: 'end' }
    );

    return {
      id,
      title,
      subtitle: (scene && scene.subtitle) || '',
      background: meta.background,
      particles: meta.particles,
      musicMode: (scene && scene.musicMode) || 'boss',
      commands
    };
  }

  _resolveTimeline(scene) {
    if (!scene) return null;
    const id = typeof scene === 'string' ? scene : scene.id;
    return CINEMATIC_TIMELINES[id] || null;
  }

  playCutscene(scene, onComplete = null) {
    if (!scene || !this.director) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    const timeline = this._resolveTimeline(scene);
    if (timeline) {
      this.director.play(timeline, onComplete);
      return;
    }
    this.director.play(this._buildScript(scene), onComplete);
  }

  playBossIntro(scene, onComplete = null) {
    this.playCutscene(scene, onComplete);
  }

  playItemCutscene(kind, onComplete = null) {
    if (!this.director) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    const isSword = kind === 'sword';
    const script = {
      id: `item_${kind}`,
      title: isSword ? 'ESPADA DE LA RECURSIVIDAD' : 'EL MICROONDAS LITTLE',
      background: isSword ? 'temple' : 'gold',
      particles: isSword ? 'embers' : 'pollen',
      musicMode: 'victory',
      commands: [
        { action: 'fade', to: 0, time: 0.25 },
        { action: 'spawn', actor: 'hero', x: 160, y: 120 },
        { action: 'camera', x: 160, y: 100, zoom: 1.65, time: 0.01 },
        {
          action: 'dialogue',
          speaker: 'EL OJETE DORADO',
          text: isSword
            ? 'Has empuñado la Espada de la Recursividad. Cada tajo se llama a sí mismo en un bucle controlado.'
            : 'Has consagrado el Microondas Little. Recalienta café y código espagueti en O(1), sin despertador mortal.'
        },
        { action: 'effect', type: 'flash', color: isSword ? '#38bdf8' : '#ffd700' },
        { action: 'fade', to: 1, time: 0.55 },
        { action: 'end' }
      ]
    };
    this.director.play(script, onComplete);
  }

  flash(color = '#ffffff', _duration = 0.2) {
    if (!this.effectsEnabled || !this.director) return;
    this.director.flash = { color, alpha: 0.8 };
  }

  cameraShake(intensity = 4, duration = 0.3) {
    if (!this.effectsEnabled || !this.director) return;
    this.director.shake = {
      time: duration,
      duration: Math.max(0.001, duration),
      intensity,
      x: 0,
      y: 0
    };
  }

  update() {
    // El CinematicDirector se actualiza en main.update(); no hay lógica vectorial aquí.
  }

  render() {
    // El CinematicDirector se renderiza en main.render(); no hay ilustraciones aquí.
  }
}

// =========================================================================
// Datos narrativos de las escenas (solo texto; sin imágenes ni vectores)
// =========================================================================

export const SCENE_DEUS_PURIFICATION = {
  id: 'scene_deus_purification',
  title: 'El Juicio del Dios Supremo en los Reinos Condenados',
  musicMode: 'village',
  slides: [
    {
      speaker: 'DIOS SUPREMO · DEIDAD DE LA REDENCIÓN',
      text: 'Mortal... Has descendido al abismo de los Reinos Condenados portando la marca del desacato y la fractura del alma.',
      flash: { color: '#fde047', duration: 0.25 }
    },
    {
      speaker: 'DIOS SUPREMO',
      text: 'Que el resplandor cósmico del compilador sagrado suelde tu corazón roto. Tu expediente penal queda purificado.',
      shake: { intensity: 3, duration: 0.3 },
      flash: { color: '#ffffff', duration: 0.35 }
    },
    {
      speaker: 'DIOS SUPREMO · BENDICIÓN CELESTIAL',
      text: 'Regresa al plano terrenal por el portal del mediodía. Camina con cautela y honra tu destino ante el Ojete Dorado.',
      flash: { color: '#38bdf8', duration: 0.2 }
    }
  ]
};

export {
  SCENE_AI_ALEX_WARNING,
  SCENE_AI_ALEX_PREBATTLE,
  SCENE_ENDING_VICTORY,
  SCENE_INTRO_GARBAGE_COLLECTOR,
  SCENE_INTRO_STACK_OVERFLOW,
  SCENE_INTRO_PROTOTYPE_MICROWAVE,
  BOSS_CUTSCENES,
  getBossIntroCutscene,
  PROLOGUE_ALEX,
  CINEMATIC_TIMELINES,
  SCENE_ALEX_FINAL,
  SCENE_INTRO_INAKITO,
  SCENE_JAIL_ARREST
};

export { SCENE_VICTORY_CREDITS } from '../assets/VillainDialogues.js?v=8';
