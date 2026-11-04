/**
 * BossCutscenes.js
 * 
 * Guion narrativo y secuencias cinemáticas estilo Novela Visual / Anime PC-98
 * para la presentación de los 3 mini-jefes de 'El Ojete Dorado: The Game'.
 * 
 * 1. SCENE_INTRO_GARBAGE_COLLECTOR (Garbage Collector · Alcantarillas de Valleverde)
 * 2. SCENE_INTRO_STACK_OVERFLOW (Guardián del Stack Overflow · Templo de la Espada)
 * 3. SCENE_INTRO_PROTOTYPE_MICROWAVE (Microondas Prototipo · Laboratorio Alpha)
 */

// Jefe Regional 1: Alcantarillas / Sótano de Valleverde
export const SCENE_INTRO_GARBAGE_COLLECTOR = [
  {
    imageKey: "BOSS_GARBAGE_COLLECTOR_INTRO",
    speaker: "GARBAGE COLLECTOR",
    speakerTitle: "Limpiador de Punteros Huérfanos · 24 HP",
    dialogue: "¡ALERTA DE FUGAS DETECTADA! Demasiadas variables declaradas con 'var' pudriéndose en los sótanos...",
    cameraShake: false,
    flash: false
  },
  {
    imageKey: "BOSS_GARBAGE_COLLECTOR_INTRO",
    speaker: "GARBAGE COLLECTOR",
    speakerTitle: "Limpiador de Punteros Huérfanos · 24 HP",
    dialogue: "¿Qué hace un programador sin referencia viva caminando por mis cloacas? Todo lo que no esté en el árbol raíz será RECOLECTADO Y PURGADO.",
    cameraShake: true,
    flash: true
  }
];

// Metadatos de retrocompatibilidad
SCENE_INTRO_GARBAGE_COLLECTOR.slides = SCENE_INTRO_GARBAGE_COLLECTOR;
SCENE_INTRO_GARBAGE_COLLECTOR.id = 'scene_intro_garbage_collector';
SCENE_INTRO_GARBAGE_COLLECTOR.title = 'ALCANTARILLAS · EL GARBAGE COLLECTOR FURIOSO';
SCENE_INTRO_GARBAGE_COLLECTOR.musicMode = 'dungeon_hostile';

// Guardián del Stack Overflow: Fin del Templo de la Espada
export const SCENE_INTRO_STACK_OVERFLOW = [
  {
    imageKey: "BOSS_STACK_OVERFLOW_INTRO",
    speaker: "GUARDIÁN DEL STACK",
    speakerTitle: "Espectro Recursivo · 32 HP",
    dialogue: "Bienvenido al bucle perpetuo, forastero. Cada paso que diste en este templo fue una llamada apilada en tu memoria...",
    cameraShake: false,
    flash: false
  },
  {
    imageKey: "BOSS_STACK_OVERFLOW_INTRO",
    speaker: "GUARDIÁN DEL STACK",
    speakerTitle: "Espectro Recursivo · 32 HP",
    dialogue: "¡No existe caso base que detenga mi invocación! ¡Tu pila de ejecución va a reventar!",
    cameraShake: true,
    flash: true
  }
];

// Metadatos de retrocompatibilidad
SCENE_INTRO_STACK_OVERFLOW.slides = SCENE_INTRO_STACK_OVERFLOW;
SCENE_INTRO_STACK_OVERFLOW.id = 'scene_intro_stack_overflow';
SCENE_INTRO_STACK_OVERFLOW.title = 'TEMPLO DE LA ESPADA · EL GUARDIÁN DEL STACK OVERFLOW';
SCENE_INTRO_STACK_OVERFLOW.musicMode = 'dungeon_hostile';

// Microondas Prototipo: Laboratorio Alpha / Puerta de la Brecha
export const SCENE_INTRO_PROTOTYPE_MICROWAVE = [
  {
    imageKey: "BOSS_PROTOTYPE_MICROWAVE_INTRO",
    speaker: "MICROONDAS ALPHA V0.1",
    speakerTitle: "Prototipo Inestable de Alex · 42 HP",
    dialogue: "*BEEP BEEP BEEP* ... ERROR 500: TEMPERATURA NO ASIGNADA. INICIANDO CICLO DE CALENTAMIENTO IRREVERSIBLE...",
    cameraShake: true,
    flash: false
  },
  {
    imageKey: "BOSS_PROTOTYPE_MICROWAVE_INTRO",
    speaker: "MICROONDAS ALPHA V0.1",
    speakerTitle: "Prototipo Inestable de Alex · 42 HP",
    dialogue: "Mister AI Alex me descartó por exceso de radiación. ¡Demostraré que puedo desintegrar código en tiempo O(1) antes de que suene la alarma!",
    cameraShake: true,
    flash: true
  }
];

// Metadatos de retrocompatibilidad
SCENE_INTRO_PROTOTYPE_MICROWAVE.slides = SCENE_INTRO_PROTOTYPE_MICROWAVE;
SCENE_INTRO_PROTOTYPE_MICROWAVE.id = 'scene_intro_prototype_microwave';
SCENE_INTRO_PROTOTYPE_MICROWAVE.title = 'UMBRAL DE LA FORTALEZA · MICROONDAS ALPHA V0.1';
SCENE_INTRO_PROTOTYPE_MICROWAVE.musicMode = 'dungeon_hostile';

/**
 * Diccionario maestro con las cinemáticas de presentación de jefes
 */
export const BOSS_CUTSCENES = {
  SCENE_INTRO_GARBAGE_COLLECTOR,
  SCENE_INTRO_STACK_OVERFLOW,
  SCENE_INTRO_PROTOTYPE_MICROWAVE
};

/**
 * Obtiene la cinemática de presentación según el id del jefe
 * @param {string} bossId
 * @returns {Array|null}
 */
export function getBossIntroCutscene(bossId) {
  if (bossId === 'boss_garbage_collector') return SCENE_INTRO_GARBAGE_COLLECTOR;
  if (bossId === 'boss_stack_overflow') return SCENE_INTRO_STACK_OVERFLOW;
  if (bossId === 'boss_prototype_microwave') return SCENE_INTRO_PROTOTYPE_MICROWAVE;
  return null;
}

