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
  first_stage: 'Valle de la Consagración (Santuarios Sagrados del Este)',
  north_peaks: 'Las Cumbres de la Recursión (Picos de Silicio)',
  south_swamp: 'Las Marismas del Hardware Legacy (Ciénaga Tóxica)',
  west_wastes: 'Páramo Corrupto de Mister AI Alex',
  armor_temple: 'Templo de la Armadura del Código Binario',
  sword_temple: 'Templo de la Espada de la Recursividad',
  sewers_dungeon: 'Cloacas del Legacy · Fosa de la Memoria (Garbage Collector)',
  sewers_entry: 'Cloacas del Legacy · Entrada de Desagüe',
  sewers_puzzle: 'Cloacas del Legacy · Sala de Válvulas y Drenaje',
  mines_entry: 'Minas de la Recursión · Caverna del Gran Abismo',
  mines_puzzle: 'Minas de la Recursión · Sala de Runas Recursivas',
  forge_entry: 'La Forja del Prototipo · Galería de Calderas',
  forge_puzzle: 'La Forja del Prototipo · Sala de Válvulas Térmicas',
  ai_fortress_gate: 'La Forja del Prototipo · Cámara de Contención (Microondas Prototipo)',
  quantum_gate: 'La Gran Puerta del Núcleo Cuántico',
  ai_citadel: 'Ciudadela Cuántica de AI Alex (Mainframe · El Gran Ojal)'
};

const BOSS_ARENAS = new Set(['sewers_dungeon', 'ai_fortress_gate', 'ai_citadel']);
const TEMPLES = new Set(['armor_temple', 'sword_temple']);

export const ZONE_LEVEL_REQUIREMENTS = {
  first_stage: 2,
  north_peaks: 4,
  south_swamp: 6,
  west_wastes: 8,
  ai_citadel: 10
};

/**
 * Devuelve { title, lines } si el jugador NO puede cruzar la puerta, o null si el paso está permitido.
 */
export function getDoorBlock(targetScene, player) {
  const pLevel = player?.level ?? 1;
  const fullyEquipped = Boolean(player?.hasArmor && player?.hasSword);

  // 1. Gating por Nivel de Programador y Centinelas Guardianes
  if (targetScene === 'first_stage' && pLevel < 2) {
    return {
      title: '🛡️ [GUARDIA KAEL: NIVEL 2 REQUERIDO]',
      lines: [
        '¡Alto ahí, novato! Más allá del puente oriental yacen las Tierras Corruptas y los Templos Sagrados.',
        'El éter salvaje y los drones de Alex desgarrarán tu código si no alcanzas al menos el NIVEL 2.',
        'Entrena derrotando anomalías menores en Valleverde antes de cruzar el puente.'
      ]
    };
  }

  if (targetScene === 'north_peaks' && pLevel < 4) {
    return {
      title: '❄️ [GUARDIA BOREAS: NIVEL 4 REQUERIDO]',
      lines: [
        '¡Detente! Las Cumbres de la Recursión sufren una ventisca algorítmica de "Memory Freeze".',
        'Solo guerreros con un hilo de ejecución optimizado de NIVEL 4 pueden resistir la congelación del stack.',
        'Consagra tu equipo en los Templos del Este y sube de nivel antes de ascender a los picos.'
      ]
    };
  }

  if (targetScene === 'south_swamp' && pLevel < 6) {
    return {
      title: '☣️ [GUARDIA VULCANO: NIVEL 6 REQUERIDO]',
      lines: [
        '¡Zona bajo estricta cuarentena militar! Las Marismas del Hardware Legacy hierven con fugas de ácido residual y el calor infernal de la Forja.',
        'Necesitas temple y resistencia de NIVEL 6 para no fundir tus circuitos en el fango.',
        'Conquista las Cumbres de la Recursión antes de descender al pantano.'
      ]
    };
  }

  if (targetScene === 'west_wastes' && pLevel < 8) {
    return {
      title: '⚡ [COMANDANTE VAEL: NIVEL 8 REQUERIDO]',
      lines: [
        '¡Paso terminantemente restringido! Al oeste se extiende el Páramo de Mister AI Alex.',
        'Sus cortafuegos cuánticos desintegran en nanosegundos a cualquier entidad con nivel inferior a NIVEL 8.',
        'Purga las mazmorras y forja tu equipo completo antes de encarar la frontera occidental.'
      ]
    };
  }

  switch (targetScene) {
    case 'first_stage':
    case 'north_peaks':
    case 'south_swamp':
    case 'west_wastes':
      // Las regiones exteriores cardinales permiten libre exploración si cumplen el nivel requerido
      return null;
    case 'armor_temple':
      // La prueba de la armadura es el primer paso libre
      return null;
    case 'sword_temple':
      // Se requiere portar la armadura para resistir la presión psíquica de la recursión
      return player?.hasArmor ? null : BLOCK_MESSAGES.sword_temple;
    case 'sewers_entry':
    case 'sewers_puzzle':
    case 'sewers_dungeon':
      return fullyEquipped ? null : BLOCK_MESSAGES.sewers_dungeon;
    case 'mines_entry':
    case 'mines_puzzle':
      return fullyEquipped ? null : BLOCK_MESSAGES.sewers_dungeon;
    case 'forge_entry':
    case 'forge_puzzle':
    case 'ai_fortress_gate':
      return fullyEquipped ? null : BLOCK_MESSAGES.fortress;
    case 'ai_citadel': {
      if (!fullyEquipped) return BLOCK_MESSAGES.fortress;
      if (player?.gatesUnlocked !== undefined && player.gatesUnlocked < 3) {
        return {
          title: '🔒 [PUERTA DEL NÚCLEO SELLADA]',
          lines: [
            'El cortafuegos hiperdimensional de la Ciudadela Cuántica está activo.',
            'Debes colocar los 3 Núcleos de Mazmorra (Garbage Collector, Stack Overflow y Microondas) en la Puerta del Núcleo para desbloquear el acceso.'
          ]
        };
      }
      if (player?.level !== undefined && player.level < 10) {
        return {
          title: '⚡ [MAINFRAME CUÁNTICO: NIVEL 10 REQUERIDO]',
          lines: [
            'La densidad del flujo de datos del Mainframe de AI Alex sobrecargará cualquier núcleo inferior a NIVEL 10.',
            'Derrota a todos los guardianes regionales y maximiza tu nivel de compilación antes de la batalla final.'
          ]
        };
      }
      return null;
    }
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
