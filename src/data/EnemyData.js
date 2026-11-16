import { CHARACTER_TYPES } from '../graphics/SpriteSheetGenerator.js?v=8';

// (FIX 3.3) Arquetipo por hueco: alarma en cadena (sentinel), teletransporte (glitch),
// persecución pura (grunt) y el clásico hostigador a distancia (drone).
export const REGIONAL_PATROL_CONFIGS = [
  {
    prefix: 'peaks',
    sceneId: 'north_peaks',
    label: 'de las Cumbres',
    xp: 40,
    droneHp: 3,
    knightHp: 4,
    speed: 60,
    archetypes: ['glitch', 'drone', 'sentinel', 'knight'],
    spots: [[6, 9, 'drone'], [25, 9, 'drone'], [8, 16, 'knight'], [24, 16, 'knight']]
  },
  {
    prefix: 'swamp',
    sceneId: 'south_swamp',
    label: 'de las Marismas',
    xp: 50,
    droneHp: 3,
    knightHp: 5,
    speed: 62,
    archetypes: ['glitch', 'drone', 'sentinel', 'knight'],
    spots: [[8, 4, 'drone'], [24, 4, 'drone'], [12, 18, 'knight'], [21, 18, 'knight']]
  },
  {
    prefix: 'wastes',
    sceneId: 'west_wastes',
    label: 'del Páramo',
    xp: 60,
    droneHp: 4,
    knightHp: 6,
    speed: 64,
    archetypes: ['grunt', 'drone', 'sentinel', 'knight'],
    spots: [[8, 4, 'drone'], [25, 4, 'drone'], [12, 18, 'knight'], [25, 18, 'knight']]
  }
];

export const DUNGEON_ROOM_ENEMY_SPAWNS = [
  // ==================== CLOACAS · ENTRADA DE DESAGÜE ====================
  {
    id: 'sewer_entry_sentinel_1',
    name: 'Centinela de Válvulas Oxidado',
    sceneId: 'sewers_entry',
    col: 4,
    row: 4,
    hp: 3,
    speed: 52,
    aggro: 130,
    xp: 35,
    archetype: 'sentinel',
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    patrol: [[3, 4], [6, 4], [6, 6]]
  },
  {
    id: 'sewer_entry_glitch_1',
    name: 'Anomalía de Desagüe',
    sceneId: 'sewers_entry',
    col: 18,
    row: 4,
    hp: 2,
    speed: 54,
    aggro: 130,
    xp: 35,
    archetype: 'glitch',
    sprite: CHARACTER_TYPES.SHADOW_DRONE,
    patrol: [[17, 4], [20, 4], [20, 6]]
  },
  {
    id: 'sewer_entry_knight_1',
    name: 'Caballero del Fango Corrupto',
    sceneId: 'sewers_entry',
    col: 5,
    row: 14,
    hp: 3,
    speed: 53,
    aggro: 130,
    xp: 35,
    archetype: 'knight',
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    patrol: [[4, 14], [8, 14], [8, 16]]
  },

  // ==================== CLOACAS · SALA DE VÁLVULAS ====================
  {
    id: 'sewer_puzzle_glitch_1',
    name: 'Eco de Memoria Estancada',
    sceneId: 'sewers_puzzle',
    col: 4,
    row: 14,
    hp: 2,
    speed: 54,
    aggro: 135,
    xp: 35,
    archetype: 'glitch',
    sprite: CHARACTER_TYPES.SHADOW_DRONE,
    patrol: [[3, 14], [7, 14], [7, 16]]
  },
  {
    id: 'sewer_puzzle_sentinel_1',
    name: 'Guardián del Canal Inundado',
    sceneId: 'sewers_puzzle',
    col: 19,
    row: 14,
    hp: 3,
    speed: 54,
    aggro: 135,
    xp: 35,
    archetype: 'sentinel',
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    patrol: [[18, 14], [20, 14], [20, 16]]
  },
  {
    id: 'sewer_puzzle_drone_1',
    name: 'Dron Bomba de Presión',
    sceneId: 'sewers_puzzle',
    col: 10,
    row: 10,
    hp: 2,
    speed: 56,
    aggro: 135,
    xp: 35,
    archetype: 'drone',
    sprite: CHARACTER_TYPES.SHADOW_DRONE,
    patrol: [[10, 10], [13, 10], [13, 12]]
  },

  // ==================== MINAS · EL GRAN ABISMO ====================
  {
    id: 'mines_entry_sentinel_1',
    name: 'Centinela del Borde del Abismo',
    sceneId: 'mines_entry',
    col: 5,
    row: 12,
    hp: 3,
    speed: 56,
    aggro: 140,
    xp: 45,
    archetype: 'sentinel',
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    patrol: [[4, 12], [8, 12], [8, 14]]
  },
  {
    id: 'mines_entry_glitch_1',
    name: 'Glitch de Silicio',
    sceneId: 'mines_entry',
    col: 18,
    row: 12,
    hp: 3,
    speed: 57,
    aggro: 140,
    xp: 45,
    archetype: 'glitch',
    sprite: CHARACTER_TYPES.SHADOW_DRONE,
    patrol: [[17, 12], [20, 12], [20, 14]]
  },
  {
    id: 'mines_entry_knight_1',
    name: 'Caballero de la Veta Estrecha',
    sceneId: 'mines_entry',
    col: 11,
    row: 4,
    hp: 4,
    speed: 55,
    aggro: 140,
    xp: 45,
    archetype: 'knight',
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    patrol: [[9, 4], [14, 4], [14, 6]]
  },

  // ==================== MINAS · SALA DE RUNAS ====================
  {
    id: 'mines_puzzle_glitch_1',
    name: 'Runa Glitch Incompleta',
    sceneId: 'mines_puzzle',
    col: 5,
    row: 5,
    hp: 3,
    speed: 57,
    aggro: 145,
    xp: 45,
    archetype: 'glitch',
    sprite: CHARACTER_TYPES.SHADOW_DRONE,
    patrol: [[4, 5], [8, 5], [8, 7]]
  },
  {
    id: 'mines_puzzle_sentinel_1',
    name: 'Centinela del Registro de Bits',
    sceneId: 'mines_puzzle',
    col: 18,
    row: 5,
    hp: 4,
    speed: 56,
    aggro: 145,
    xp: 45,
    archetype: 'sentinel',
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    patrol: [[17, 5], [20, 5], [20, 7]]
  },
  {
    id: 'mines_puzzle_knight_1',
    name: 'Caballero del Caso Base',
    sceneId: 'mines_puzzle',
    col: 7,
    row: 14,
    hp: 4,
    speed: 55,
    aggro: 145,
    xp: 45,
    archetype: 'knight',
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    patrol: [[5, 14], [10, 14], [10, 16]]
  },

  // ==================== FORJA · GALERÍA DE CALDERAS ====================
  {
    id: 'forge_entry_sentinel_1',
    name: 'Centinela de Calderas',
    sceneId: 'forge_entry',
    col: 8,
    row: 4,
    hp: 4,
    speed: 58,
    aggro: 150,
    xp: 55,
    archetype: 'sentinel',
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    patrol: [[6, 4], [10, 4], [10, 6]]
  },
  {
    id: 'forge_entry_glitch_1',
    name: 'Fuga de Vapor Corrupta',
    sceneId: 'forge_entry',
    col: 15,
    row: 4,
    hp: 3,
    speed: 59,
    aggro: 150,
    xp: 55,
    archetype: 'glitch',
    sprite: CHARACTER_TYPES.SHADOW_DRONE,
    patrol: [[14, 4], [18, 4], [18, 6]]
  },
  {
    id: 'forge_entry_knight_1',
    name: 'Caballero Escoriado',
    sceneId: 'forge_entry',
    col: 8,
    row: 9,
    hp: 4,
    speed: 57,
    aggro: 150,
    xp: 55,
    archetype: 'knight',
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    patrol: [[7, 9], [11, 9], [11, 11]]
  },

  // ==================== FORJA · VÁLVULAS TÉRMICAS ====================
  {
    id: 'forge_puzzle_knight_1',
    name: 'Caballero de la Cámara de Vapor',
    sceneId: 'forge_puzzle',
    col: 4,
    row: 12,
    hp: 4,
    speed: 58,
    aggro: 150,
    xp: 55,
    archetype: 'knight',
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    patrol: [[3, 12], [7, 12], [7, 14]]
  },
  {
    id: 'forge_puzzle_sentinel_1',
    name: 'Centinela Termopar',
    sceneId: 'forge_puzzle',
    col: 19,
    row: 12,
    hp: 4,
    speed: 58,
    aggro: 150,
    xp: 55,
    archetype: 'sentinel',
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    patrol: [[18, 12], [20, 12], [20, 14]]
  },
  {
    id: 'forge_puzzle_glitch_1',
    name: 'Sobrecarga del Prototipo',
    sceneId: 'forge_puzzle',
    col: 11,
    row: 6,
    hp: 3,
    speed: 60,
    aggro: 150,
    xp: 55,
    archetype: 'glitch',
    sprite: CHARACTER_TYPES.SHADOW_DRONE,
    patrol: [[9, 6], [14, 6], [14, 8]]
  }
];

export const FIRST_STAGE_ENEMY_SPAWNS = [
  // ==================== ENEMIGOS EN RUINAS DEL DESPERTAR (EXTERIOR) ====================
  {
    id: 'drone_west_1',
    archetype: 'glitch',
    name: 'Dron Sombrío de AI Alex',
    x: 10 * 16,
    y: 14 * 16,
    sceneId: 'first_stage',
    speed: 56,
    maxHp: 2,
    aggroRange: 90,
    sprite: CHARACTER_TYPES.SHADOW_DRONE,
    frameDuration: 0.12,
    patrolPoints: [
      { x: 10 * 16, y: 14 * 16 },
      { x: 10 * 16, y: 9 * 16 },
      { x: 13 * 16, y: 9 * 16 },
      { x: 13 * 16, y: 14 * 16 }
    ]
  },
  {
    id: 'drone_west_2',
    archetype: 'sentinel',
    name: 'Dron Centinela del Bastión',
    x: 6 * 16,
    y: 13 * 16,
    sceneId: 'first_stage',
    speed: 55,
    maxHp: 2,
    aggroRange: 85,
    sprite: CHARACTER_TYPES.SHADOW_DRONE,
    frameDuration: 0.12,
    patrolPoints: [
      { x: 4 * 16, y: 13 * 16 },
      { x: 9 * 16, y: 13 * 16 },
      { x: 9 * 16, y: 15 * 16 },
      { x: 4 * 16, y: 15 * 16 }
    ]
  },
  {
    id: 'drone_east_1',
    archetype: 'drone',
    name: 'Dron Sombrío de AI Alex',
    x: 21 * 16,
    y: 14 * 16,
    sceneId: 'first_stage',
    speed: 58,
    maxHp: 2,
    aggroRange: 95,
    sprite: CHARACTER_TYPES.SHADOW_DRONE,
    frameDuration: 0.12,
    patrolPoints: [
      { x: 20 * 16, y: 14 * 16 },
      { x: 25 * 16, y: 14 * 16 },
      { x: 25 * 16, y: 10 * 16 },
      { x: 20 * 16, y: 10 * 16 }
    ]
  },
  {
    id: 'knight_north_west',
    archetype: 'sentinel',
    name: 'Caballero de Tinieblas de AI Alex',
    x: 13 * 16,
    y: 8 * 16,
    sceneId: 'first_stage',
    speed: 57,
    maxHp: 3,
    aggroRange: 95,
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    frameDuration: 0.13,
    patrolPoints: [
      { x: 12 * 16, y: 8 * 16 },
      { x: 15 * 16, y: 8 * 16 },
      { x: 15 * 16, y: 6 * 16 },
      { x: 12 * 16, y: 6 * 16 }
    ]
  },
  {
    id: 'knight_north_east',
    archetype: 'knight',
    name: 'Caballero de Tinieblas de AI Alex',
    x: 19 * 16,
    y: 8 * 16,
    sceneId: 'first_stage',
    speed: 57,
    maxHp: 3,
    aggroRange: 95,
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    frameDuration: 0.13,
    patrolPoints: [
      { x: 18 * 16, y: 8 * 16 },
      { x: 21 * 16, y: 8 * 16 },
      { x: 21 * 16, y: 6 * 16 },
      { x: 18 * 16, y: 6 * 16 }
    ]
  },
  {
    id: 'knight_portal_guard',
    archetype: 'sentinel',
    name: 'Guardián Abisal de Mister AI Alex',
    x: 28 * 16,
    y: 12 * 16,
    sceneId: 'first_stage',
    speed: 60,
    maxHp: 4,
    aggroRange: 100,
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    frameDuration: 0.12,
    patrolPoints: [
      { x: 27 * 16, y: 11 * 16 },
      { x: 30 * 16, y: 11 * 16 },
      { x: 30 * 16, y: 14 * 16 },
      { x: 27 * 16, y: 14 * 16 }
    ]
  },

  // ==================== NIVEL: TEMPLO DEL ALTAR SAGRADO (ESPADA) ====================
  {
    id: 'knight_temple_west',
    archetype: 'knight',
    name: 'Caballero Abisal del Altar',
    x: 5 * 16,
    y: 9 * 16,
    sceneId: 'sword_temple',
    speed: 60,
    maxHp: 3,
    aggroRange: 145,
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    frameDuration: 0.12,
    patrolPoints: [
      { x: 4 * 16, y: 8 * 16 },
      { x: 6 * 16, y: 8 * 16 },
      { x: 6 * 16, y: 11 * 16 },
      { x: 4 * 16, y: 11 * 16 }
    ]
  },
  {
    id: 'knight_temple_east',
    archetype: 'sentinel',
    name: 'Caballero Abisal del Altar',
    x: 18 * 16,
    y: 9 * 16,
    sceneId: 'sword_temple',
    speed: 60,
    maxHp: 3,
    aggroRange: 145,
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    frameDuration: 0.12,
    patrolPoints: [
      { x: 17 * 16, y: 8 * 16 },
      { x: 19 * 16, y: 8 * 16 },
      { x: 19 * 16, y: 11 * 16 },
      { x: 17 * 16, y: 11 * 16 }
    ]
  },
  {
    id: 'knight_temple_boss',
    archetype: 'knight',
    name: 'Paladín Oscuro de Mister AI Alex',
    x: 11 * 16,
    y: 12 * 16,
    sceneId: 'sword_temple',
    speed: 62,
    maxHp: 5,
    aggroRange: 100,
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    frameDuration: 0.11,
    patrolPoints: [
      { x: 9 * 16, y: 12 * 16 },
      { x: 14 * 16, y: 12 * 16 },
      { x: 14 * 16, y: 13 * 16 },
      { x: 9 * 16, y: 13 * 16 }
    ]
  },

  // ==================== ENEMIGOS NOCTURNOS (EN EL VALLE DE LOS TEMPLOS) ====================
  {
    id: 'night_bug_east_1',
    archetype: 'glitch',
    name: 'Bug de Memoria Nocturno',
    x: 23 * 16,
    y: 11 * 16,
    sceneId: 'first_stage',
    nightOnly: true,
    speed: 58,
    maxHp: 2,
    aggroRange: 95,
    sprite: CHARACTER_TYPES.SHADOW_DRONE,
    frameDuration: 0.12,
    patrolPoints: [
      { x: 21 * 16, y: 11 * 16 },
      { x: 25 * 16, y: 11 * 16 },
      { x: 25 * 16, y: 13 * 16 },
      { x: 21 * 16, y: 13 * 16 }
    ]
  },
  {
    id: 'night_bug_east_2',
    archetype: 'knight',
    name: 'Dron Cazador de Nocturnidad',
    x: 18 * 16,
    y: 8 * 16,
    sceneId: 'first_stage',
    nightOnly: true,
    speed: 62,
    maxHp: 3,
    aggroRange: 100,
    sprite: CHARACTER_TYPES.SHADOW_KNIGHT,
    frameDuration: 0.12,
    patrolPoints: [
      { x: 17 * 16, y: 8 * 16 },
      { x: 20 * 16, y: 8 * 16 },
      { x: 20 * 16, y: 10 * 16 },
      { x: 17 * 16, y: 10 * 16 }
    ]
  },
  {
    id: 'night_glitch_stage1_1',
    archetype: 'glitch',
    name: 'Glitch Corrupto Nocturno',
    x: 17 * 16,
    y: 13 * 16,
    sceneId: 'first_stage',
    nightOnly: true,
    speed: 58,
    maxHp: 2,
    aggroRange: 95,
    sprite: CHARACTER_TYPES.SHADOW_DRONE,
    frameDuration: 0.12,
    patrolPoints: [
      { x: 16 * 16, y: 13 * 16 },
      { x: 19 * 16, y: 13 * 16 },
      { x: 19 * 16, y: 15 * 16 },
      { x: 16 * 16, y: 15 * 16 }
    ]
  }
];

export const BOSS_SPAWNS = [
  { bossType: 'GarbageCollectorBoss', x: 11.2 * 16, y: 8 * 16, sceneId: 'sewers_dungeon' },
  { bossType: 'StackOverflowBoss', x: 9.2 * 16, y: 6.5 * 16, sceneId: 'mines_boss_arena' },
  { bossType: 'PrototypeMicrowaveBoss', x: 11 * 16, y: 8 * 16, sceneId: 'ai_fortress_gate' },
  { bossType: 'FinalBossAlex', x: 11 * 16, y: 7.5 * 16, sceneId: 'ai_citadel' }
];

export const BOSS_RUSH_QUEUE = [
  'GarbageCollector',
  'StackOverflow',
  'PrototypeMicrowave',
  'FinalBossAlex'
];

export const BASE_BOSS_FLEE_TAUNTS = {
  boss_garbage_collector: '¡Huye, cobarde! ¡Tu código está lleno de fugas de memoria!',
  boss_stack_overflow: 'Me voy a quedar aquí recursivamente... y tú te vas a pudrir.',
  boss_prototype_microwave: '¡Ding! ¡Tu valentía ha terminado! ¡Vuelve cuando estés más caliente!',
  boss_final_ai_alex: 'Vete, vete. Total, el próximo trimestre te despido igual.',
  boss_final_alex: 'Vete, vete. Total, el próximo trimestre te despido igual.'
};

export const ENEMY_SPAWNS = {
  firstStage: FIRST_STAGE_ENEMY_SPAWNS,
  dungeonRooms: DUNGEON_ROOM_ENEMY_SPAWNS,
  regionalPatrols: REGIONAL_PATROL_CONFIGS,
  bosses: BOSS_SPAWNS
};
