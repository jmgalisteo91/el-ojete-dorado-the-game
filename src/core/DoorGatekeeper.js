/**
 * DoorGatekeeper: reglas puras de acceso a zonas hostiles (sin dependencias de UI ni de estado global).
 * Decide si el jugador puede cruzar una puerta y qué título/descripción mostrar al confirmar el paso.
 */

const BLOCK_MESSAGES = {
  first_stage: {
    title: '⚠️ [NO ESTÁS PREPARADO]',
    lines: [
      '¡Detente! Las Ruinas del Despertar están infestadas de drones y anomalías corruptas de Mister AI Alex.',
      'Sin tu [Armadura del Código Binario] cualquier impacto te aniquilará al instante, y sin tu [Espada de la Recursividad] no podrás defenderte.',
      'Habla con el Gran Sabio Aurelio en Valleverde y cruza el Puente del Este para superar las Pruebas Sagradas y consagrar tu equipo primero.'
    ]
  },
  sewers_dungeon: {
    title: '⚠️ [NO ESTÁS PREPARADO]',
    lines: [
      '¡Un hedor a memoria corrompida y fugas de punteros brota de la trampilla de la alcantarilla!',
      'No puedes descender a la Fosa de Memoria sin tu Armadura Binaria y tu Espada de la Recursividad para enfrentar a El Garbage Collector Furioso.',
      'Habla con Aurelio y supera las Pruebas Sagradas del Este antes de descender a las cloacas.'
    ]
  },
  sword_temple: {
    title: '⚠️ [ORDEN DE LAS PRUEBAS SAGRADAS]',
    lines: [
      'El Gran Sabio Aurelio te encomendó consagrar primero la Armadura del Código Binario en el Templo Septentrional (Norte).',
      'La energía de la Espada de la Recursividad ejerce una presión psíquica letal sobre quien no vista la armadura sagrada.',
      'Dirígete al Templo Norte para forjar tu armadura primero.'
    ]
  },
  fortress: {
    title: '⚠️ [NO ESTÁS PREPARADO]',
    lines: [
      'La Fortaleza de Mister AI Alex está protegida por barreras electromagnéticas letales.',
      'Necesitas tu equipo sagrado completo (Armadura Binaria y Espada de la Recursividad) antes de franquear este umbral.'
    ]
  }
};

const DESTINATION_TITLES = {
  first_stage: 'Ruinas del Despertar (Escenario 1)',
  armor_temple: 'Templo de la Armadura del Código Binario',
  sword_temple: 'Templo de la Espada de la Recursividad (Guardián del Stack Overflow)',
  sewers_dungeon: 'Alcantarillas de Valleverde (Garbage Collector Furioso)',
  ai_fortress_gate: 'Umbral de la Fortaleza (Microondas Prototipo V0.1)',
  ai_citadel: 'Ciudadela de AI Alex (El Gran Ojal)'
};

const BOSS_ARENAS = new Set(['sewers_dungeon', 'ai_fortress_gate', 'ai_citadel']);
const TEMPLES = new Set(['armor_temple', 'sword_temple']);

/**
 * Devuelve { title, lines } si el jugador NO puede cruzar la puerta, o null si el paso está permitido.
 */
export function getDoorBlock(targetScene, player) {
  const fullyEquipped = player.hasArmor && player.hasSword;
  switch (targetScene) {
    case 'first_stage':
      return fullyEquipped ? null : BLOCK_MESSAGES.first_stage;
    case 'sewers_dungeon':
      return fullyEquipped ? null : BLOCK_MESSAGES.sewers_dungeon;
    case 'sword_temple':
      return player.hasArmor ? null : BLOCK_MESSAGES.sword_temple;
    case 'ai_fortress_gate':
    case 'ai_citadel':
      return fullyEquipped ? null : BLOCK_MESSAGES.fortress;
    default:
      return null;
  }
}

/**
 * Información textual del destino para el diálogo de confirmación.
 */
export function getDoorDestinationInfo(targetScene) {
  const title = DESTINATION_TITLES[targetScene] || 'las Tierras Exteriores';
  const isBossArena = BOSS_ARENAS.has(targetScene);
  const isTemple = TEMPLES.has(targetScene);
  const description = isBossArena
    ? '¡PELIGRO DE JEFE! En el interior de esta cámara aguarda uno de los grandes guardianes de Mister AI Alex.'
    : isTemple
      ? 'En su interior reposan reliquias sagradas y pruebas del Código Primigenio.'
      : 'Más allá de los límites protegidos de Valleverde acechan bugs salvajes y la corrupción de Mister AI Alex.';
  return { title, description };
}
