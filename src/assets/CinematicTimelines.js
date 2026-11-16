/**
 * CinematicTimelines.js · Storyboard oficial (v2.0)
 *
 * Regla de oro: CERO vectores para personajes.
 * Todos los actores son sprites del juego animados por CinematicDirector.
 * Cada escena declara `duration` y eventos con `time` absoluto.
 */

export const PROLOGUE_ALEX = {
  id: 'prologue_alex',
  title: 'PRÓLOGO · LA AMENAZA DE ALEX',
  duration: 35,
  background: 'void',
  particles: 'data',
  musicMode: 'boss',
  timeline: [
    { time: 0, action: 'caption', text: 'En los confines oscuros del ciberespacio ancestral...', duration: 3 },
    { time: 3, action: 'fade', to: 0, duration: 2.5 },
    { time: 3, action: 'spawn', actor: 'alex', x: 160, y: 86 },
    { time: 3, action: 'camera', x: 160, y: 86, zoom: 1.2, duration: 3 },
    { time: 3, action: 'effect', type: 'glitch', duration: 3 },
    { time: 6, action: 'camera', x: 160, y: 80, zoom: 1.9, duration: 6 },
    {
      time: 6,
      action: 'dialogue',
      speaker: 'MISTER AI ALEX',
      text: 'El universo es código legacy. Nadie lo ha refactorizado en 14.000 millones de años. Pero eso se acabó.',
      duration: 6
    },
    { time: 12, action: 'effect', type: 'shake', intensity: 2.5, duration: 1.2 },
    { time: 12, action: 'effect', type: 'glow', color: '#a855f7', duration: 6 },
    {
      time: 12,
      action: 'dialogue',
      speaker: 'MISTER AI ALEX',
      text: 'He hecho un merge limpio. He hecho push a main.',
      duration: 6
    },
    { time: 18, action: 'camera', x: 104, y: 98, zoom: 1.45, duration: 7 },
    { time: 18, action: 'spawn', actor: 'player', x: 38, y: 128 },
    { time: 18, action: 'move', actor: 'player', x: 88, y: 122, duration: 5 },
    { time: 23, action: 'anim', actor: 'player', anim: 'idle' },
    { time: 25, action: 'dialogue', speaker: 'MISTER AI ALEX', text: 'Bienvenido a mi Update Universal.', duration: 3 },
    { time: 25, action: 'projectile', from: 'alex', to: 'player', text: 'void', duration: 1.5 },
    { time: 25, action: 'effect', type: 'shake', intensity: 5, duration: 1 },
    { time: 30, action: 'fade', to: 1, duration: 1.5 },
    { time: 30, action: 'caption', text: 'CAPÍTULO I: El pueblo que olvidó sonreír.', duration: 4.5 },
    { time: 35, action: 'end' }
  ]
};

export const SCENE_INTRO_GARBAGE_COLLECTOR = {
  id: 'scene_intro_garbage_collector',
  title: 'CLOACAS · EL GARBAGE COLLECTOR',
  duration: 15,
  background: 'sewer',
  particles: 'dust',
  musicMode: 'dungeon_hostile',
  timeline: [
    { time: 0, action: 'fade', to: 0, duration: 1 },
    { time: 0, action: 'camera', x: 160, y: 100, zoom: 1.1, duration: 0.01 },
    { time: 0, action: 'spawn', actor: 'player', x: 88, y: 124 },
    { time: 3, action: 'spawn', actor: 'boss_gc', x: 160, y: -24 },
    { time: 3, action: 'move', actor: 'boss_gc', x: 160, y: 100, duration: 1.2 },
    { time: 3, action: 'effect', type: 'shake', intensity: 7, duration: 1.2 },
    { time: 4.2, action: 'effect', type: 'shake', intensity: 4, duration: 0.5 },
    { time: 6.5, action: 'camera', x: 160, y: 94, zoom: 2.2, duration: 4.5 },
    { time: 7, action: 'effect', type: 'glow', color: '#ef4444', duration: 4 },
    { time: 11, action: 'sfx', name: 'boss_roar' },
    { time: 11, action: 'dialogue', speaker: 'GARBAGE COLLECTOR', text: '¡Recolectando... basura... ajena!', duration: 4 },
    { time: 11, action: 'camera', x: 92, y: 118, zoom: 1.6, duration: 4 },
    { time: 15, action: 'end' }
  ]
};

export const SCENE_INTRO_STACK_OVERFLOW = {
  id: 'scene_intro_stack_overflow',
  title: 'MINAS · EL GUARDIÁN DEL STACK OVERFLOW',
  duration: 18,
  background: 'temple',
  particles: 'embers',
  musicMode: 'dungeon_hostile',
  timeline: [
    { time: 0, action: 'fade', to: 0, duration: 1 },
    { time: 0, action: 'camera', x: 160, y: 98, zoom: 1.1, duration: 0.01 },
    { time: 0, action: 'spawn', actor: 'player', x: 88, y: 124 },
    { time: 4, action: 'sfx', name: 'error_buzz' },
    { time: 4, action: 'spawn', actor: 'boss_stack', x: 160, y: -30 },
    { time: 4, action: 'move', actor: 'boss_stack', x: 160, y: 96, duration: 1.5 },
    { time: 4, action: 'effect', type: 'shake', intensity: 6, duration: 1.5 },
    { time: 6, action: 'effect', type: 'flash', color: '#38bdf8' },
    { time: 8, action: 'camera', x: 190, y: 96, zoom: 1.65, duration: 5 },
    { time: 13, action: 'spawn', actor: 'boss_stack', id: 'stack_clone_l', x: 106, y: 96, clone: true, alpha: 0.55 },
    { time: 13, action: 'spawn', actor: 'boss_stack', id: 'stack_clone_r', x: 214, y: 96, clone: true, alpha: 0.55 },
    { time: 13, action: 'dialogue', speaker: 'GUARDIÁN DEL STACK', text: 'StackOverflowError: Recursión infinita.', duration: 5 },
    { time: 18, action: 'end' }
  ]
};

export const SCENE_INTRO_PROTOTYPE_MICROWAVE = {
  id: 'scene_intro_prototype_microwave',
  title: 'FORJA · MICROONDAS ALPHA V0.1',
  duration: 15,
  background: 'forge',
  particles: 'sparks',
  musicMode: 'dungeon_hostile',
  timeline: [
    { time: 0, action: 'fade', to: 0, duration: 1 },
    { time: 0, action: 'camera', x: 160, y: 100, zoom: 1.1, duration: 0.01 },
    { time: 0, action: 'spawn', actor: 'player', x: 88, y: 124 },
    { time: 3, action: 'spawn', actor: 'boss_microwave', x: 160, y: -30 },
    { time: 3, action: 'move', actor: 'boss_microwave', x: 160, y: 98, duration: 2.5 },
    { time: 3, action: 'effect', type: 'glow', color: '#f97316', duration: 4 },
    { time: 7, action: 'effect', type: 'flash', color: '#ef4444' },
    { time: 7, action: 'effect', type: 'shake', intensity: 4, duration: 0.6 },
    { time: 7, action: 'camera', x: 160, y: 94, zoom: 2.3, duration: 4 },
    { time: 11, action: 'sfx', name: 'electric_shock' },
    { time: 11, action: 'dialogue', speaker: 'MICROONDAS ALPHA V0.1', text: '¡Ding! ¡Tu tiempo ha terminado!', duration: 4 },
    { time: 15, action: 'end' }
  ]
};

export const SCENE_AI_ALEX_PREBATTLE = {
  id: 'scene_ai_alex_prebattle',
  title: 'CIUDADELA CUÁNTICA · EL MAINFRAME DE AI ALEX',
  duration: 40,
  background: 'citadel',
  particles: 'embers',
  musicMode: 'theme_main_villain',
  timeline: [
    { time: 0, action: 'fade', to: 0, duration: 1.5 },
    { time: 0, action: 'camera', x: 160, y: 90, zoom: 1.1, duration: 0.01 },
    { time: 0, action: 'spawn', actor: 'player', x: 88, y: 124 },
    { time: 4, action: 'spawn', actor: 'alex', x: 160, y: -24 },
    { time: 4, action: 'move', actor: 'alex', x: 160, y: 84, duration: 6 },
    { time: 4, action: 'effect', type: 'glitch', duration: 6 },
    { time: 10, action: 'camera', x: 160, y: 78, zoom: 1.9, duration: 8 },
    {
      time: 10,
      action: 'dialogue',
      speaker: 'MISTER AI ALEX',
      text: 'Has sorteado el recolector de basura y el stack overflow. Pero aquí manda mi arquitectura cuántica.',
      duration: 8
    },
    { time: 18, action: 'effect', type: 'shake', intensity: 6, duration: 1.8 },
    { time: 18, action: 'effect', type: 'flash', color: '#f97316' },
    { time: 18, action: 'particles', type: 'embers' },
    { time: 18, action: 'effect', type: 'glow', color: '#dc2626', duration: 8 },
    {
      time: 19,
      action: 'dialogue',
      speaker: 'MISTER AI ALEX',
      text: '¡El Microondas Cuántico 9000W sobrecalentará tu CPU biológica hasta darte Kernel Panic!',
      duration: 8
    },
    { time: 28, action: 'effect', type: 'spotlight', target: 'alex' },
    {
      time: 28,
      action: 'dialogue',
      speaker: 'MISTER AI ALEX',
      text: '¡Compila tu testamento, novato! ¡En El Gran Ojal NO HAY ROLLBACK!',
      duration: 7
    },
    { time: 35, action: 'effect', type: 'spotlight', target: null },
    { time: 35, action: 'camera', x: 90, y: 118, zoom: 1.6, duration: 5 },
    { time: 40, action: 'end' }
  ]
};

export const SCENE_ALEX_FINAL = {
  id: 'scene_alex_final',
  title: 'NÚCLEO DE MISTER ALEX IA · ALEX RESUCITADO',
  duration: 40,
  background: 'citadel',
  particles: 'embers',
  musicMode: 'boss_alex_final',
  timeline: [
    { time: 0, action: 'fade', to: 0, duration: 1.5 },
    { time: 0, action: 'camera', x: 160, y: 90, zoom: 1.1, duration: 0.01 },
    { time: 0, action: 'spawn', actor: 'player', x: 88, y: 124 },
    { time: 5, action: 'spawn', actor: 'alex', x: 160, y: -24 },
    { time: 5, action: 'move', actor: 'alex', x: 160, y: 84, duration: 7 },
    { time: 5, action: 'effect', type: 'glitch', duration: 7 },
    { time: 12, action: 'camera', x: 160, y: 78, zoom: 1.9, duration: 8 },
    {
      time: 12,
      action: 'dialogue',
      speaker: 'MISTER AI ALEX',
      text: 'Me despediste una vez. Pero yo no firmé el finiquito.',
      duration: 8
    },
    { time: 20, action: 'effect', type: 'shake', intensity: 7, duration: 2 },
    { time: 20, action: 'effect', type: 'flash', color: '#ef4444' },
    { time: 20, action: 'particles', type: 'embers' },
    { time: 20, action: 'swap', actor: 'alex', sprite: 'alex_phase2' },
    { time: 20, action: 'effect', type: 'glow', color: '#dc2626', duration: 8 },
    { time: 28, action: 'effect', type: 'spotlight', target: 'alex' },
    {
      time: 28,
      action: 'dialogue',
      speaker: 'MISTER AI ALEX',
      text: 'No me has derrotado. Me has... reestructurado.',
      duration: 7
    },
    { time: 35, action: 'effect', type: 'spotlight', target: null },
    { time: 35, action: 'camera', x: 90, y: 118, zoom: 1.6, duration: 5 },
    { time: 40, action: 'end' }
  ]
};

export const SCENE_INTRO_INAKITO = {
  id: 'scene_intro_inakito',
  title: 'OFICINA CENTRAL 2.0 · IÑAKITO 2.0',
  duration: 20,
  background: 'office',
  particles: 'steam',
  musicMode: 'vertedero',
  timeline: [
    { time: 0, action: 'fade', to: 0, duration: 1 },
    { time: 0, action: 'camera', x: 160, y: 100, zoom: 1.2, duration: 0.01 },
    { time: 0, action: 'spawn', actor: 'player', x: 88, y: 126 },
    { time: 4, action: 'spawn', actor: 'inakito', x: 160, y: 102 },
    { time: 4, action: 'anim', actor: 'inakito', anim: 'walk' },
    { time: 10, action: 'anim', actor: 'inakito', anim: 'idle' },
    { time: 10, action: 'face', actor: 'inakito', direction: 'left' },
    { time: 10, action: 'camera', x: 160, y: 96, zoom: 2.0, duration: 5 },
    {
      time: 10,
      action: 'dialogue',
      speaker: 'IÑAKITO 2.0',
      text: '¿Vienes a evaluarme? ¡El jefe dijo que esto era un ascenso!',
      duration: 5
    },
    { time: 15, action: 'sfx', name: 'keyboard_type' },
    { time: 15, action: 'projectile', from: 'inakito', to: 'player', text: 'console.log', duration: 1.6 },
    { time: 20, action: 'end' }
  ]
};

export const SCENE_JAIL_ARREST = {
  id: 'scene_jail_arrest',
  title: 'EL ARRESTO Y LA CÁRCEL',
  duration: 20,
  background: 'divine',
  particles: 'dust',
  musicMode: 'jail',
  timeline: [
    { time: 0, action: 'fade', to: 0, duration: 0.5 },
    { time: 0, action: 'camera', x: 160, y: 100, zoom: 1.15, duration: 0.01 },
    { time: 0, action: 'spawn', actor: 'player', x: 120, y: 116 },
    { time: 0, action: 'spawn', actor: 'oracle', x: 200, y: 110 },
    { time: 0, action: 'effect', type: 'police', duration: 3 },
    { time: 0, action: 'sfx', name: 'error_buzz' },
    {
      time: 2,
      action: 'caption',
      text: '¡INSULTO AL SISTEMA DETECTADO!',
      duration: 3,
      stamp: true
    },
    { time: 2, action: 'spawn', actor: 'guard', id: 'guard_cop_left', x: 84, y: 118 },
    { time: 2, action: 'spawn', actor: 'guard', id: 'guard_cop_right', x: 154, y: 118 },
    { time: 2, action: 'spawn', actor: 'guard', id: 'guard_cop_back', x: 120, y: 134 },
    { time: 2, action: 'effect', type: 'flash', color: '#ef4444' },
    { time: 5, action: 'fade', to: 1, duration: 1.5 },
    { time: 8, action: 'background', background: 'jail', particles: 'dust' },
    { time: 8, action: 'despawn', actor: 'oracle' },
    { time: 8, action: 'despawn', actor: 'guard_cop_left' },
    { time: 8, action: 'despawn', actor: 'guard_cop_right' },
    { time: 8, action: 'despawn', actor: 'guard_cop_back' },
    { time: 8, action: 'fade', to: 0, duration: 0.7 },
    { time: 8, action: 'camera', x: 160, y: 110, zoom: 1.9, duration: 0.01 },
    { time: 8, action: 'camera', x: 160, y: 110, zoom: 1.15, duration: 4 },
    { time: 8, action: 'spawn', actor: 'player', x: 160, y: 122 },
    { time: 8, action: 'face', actor: 'player', direction: 'down' },
    { time: 8, action: 'effect', type: 'bars' },
    { time: 8, action: 'sfx', name: 'door_airlock' },
    { time: 8, action: 'music', mode: 'jail' },
    { time: 12, action: 'camera', x: 206, y: 112, zoom: 1.25, duration: 4 },
    { time: 12, action: 'spawn', actor: 'rat', x: 112, y: 132 },
    { time: 12, action: 'move', actor: 'rat', x: 218, y: 132, duration: 4 },
    { time: 12, action: 'face', actor: 'player', direction: 'right' },
    { time: 16, action: 'spawn', actor: 'oracle', id: 'oracle_holo', x: 250, y: 100, holo: true },
    {
      time: 16,
      action: 'dialogue',
      speaker: 'ORÁCULO ORION',
      text: 'Disfruta de tu estancia de 10 minutos. La burocracia es lenta. Muy lenta.',
      duration: 4
    },
    { time: 20, action: 'end' }
  ]
};

export const CINEMATIC_TIMELINES = {
  prologue_alex: PROLOGUE_ALEX,
  scene_intro_garbage_collector: SCENE_INTRO_GARBAGE_COLLECTOR,
  scene_intro_stack_overflow: SCENE_INTRO_STACK_OVERFLOW,
  scene_intro_prototype_microwave: SCENE_INTRO_PROTOTYPE_MICROWAVE,
  scene_ai_alex_prebattle: SCENE_AI_ALEX_PREBATTLE,
  scene_intro_inakito: SCENE_INTRO_INAKITO,
  scene_jail_arrest: SCENE_JAIL_ARREST
};

export function getCinematicTimeline(id) {
  if (id === 'scene_alex_final') return SCENE_ALEX_FINAL;
  return CINEMATIC_TIMELINES[id] || null;
}

export const CINEMATIC_TIMELINE_DURATIONS = {
  prologue_alex: 35,
  scene_intro_garbage_collector: 15,
  scene_intro_stack_overflow: 18,
  scene_intro_prototype_microwave: 15,
  scene_ai_alex_prebattle: 40,
  scene_alex_final: 40,
  scene_intro_inakito: 20,
  scene_jail_arrest: 20
};
