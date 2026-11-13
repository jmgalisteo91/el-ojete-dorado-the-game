/**
 * BossCutscenes.js · (TIMELINE v2.0)
 *
 * Las intros de jefes viven ahora en CinematicTimelines.js con tiempos
 * absolutos. Este módulo solo expone los mapas de compatibilidad.
 */
import {
  SCENE_INTRO_GARBAGE_COLLECTOR,
  SCENE_INTRO_STACK_OVERFLOW,
  SCENE_INTRO_PROTOTYPE_MICROWAVE,
  SCENE_INTRO_INAKITO
} from './CinematicTimelines.js?v=8';

export {
  SCENE_INTRO_GARBAGE_COLLECTOR,
  SCENE_INTRO_STACK_OVERFLOW,
  SCENE_INTRO_PROTOTYPE_MICROWAVE,
  SCENE_INTRO_INAKITO
};

export const BOSS_CUTSCENES = {
  SCENE_INTRO_GARBAGE_COLLECTOR,
  SCENE_INTRO_STACK_OVERFLOW,
  SCENE_INTRO_PROTOTYPE_MICROWAVE
};

export function getBossIntroCutscene(bossId) {
  if (bossId === 'boss_garbage_collector') return SCENE_INTRO_GARBAGE_COLLECTOR;
  if (bossId === 'boss_stack_overflow') return SCENE_INTRO_STACK_OVERFLOW;
  if (bossId === 'boss_prototype_microwave') return SCENE_INTRO_PROTOTYPE_MICROWAVE;
  if (bossId === 'boss_inakito') return SCENE_INTRO_INAKITO;
  return null;
}
