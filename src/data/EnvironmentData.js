// ============================================================
// EnvironmentData.js — Configuración global de Biomas Visuales
// Asocia cada escena del juego base y la expansión con su tema
// de partículas, luces ambientales, filtros de color y props.
// ============================================================

export const ENVIRONMENT_THEMES = {
  pueblo: {
    id: 'pueblo',
    biomeId: 'valleverde',
    label: 'Pueblo de Valleverde',
    particles: { count: 50, types: ['leaf'] },
    lightColor: '#fde047',
    lightAlpha: 0.16,
    tintColor: null,
    tintAlpha: 0,
    bloomAlpha: 0.5,
    lowFog: false,
    shader: null,
    propSet: null,
  },
  bosque: {
    id: 'bosque',
    biomeId: 'valleverde',
    label: 'Bosque y Páramos',
    particles: { count: 44, types: ['pollen', 'firefly', 'leaf'] },
    lightColor: '#bef264',
    lightAlpha: 0.14,
    tintColor: 'rgba(22, 101, 52, 0.08)',
    tintAlpha: 0.08,
    bloomAlpha: 0.52,
    lowFog: true,
    shader: 'mist',
    propSet: null,
  },
  cloacas: {
    id: 'cloacas',
    biomeId: 'cloacas',
    label: 'Cloacas de Valleverde',
    particles: { count: 46, types: ['drip', 'fly'] },
    lightColor: '#22c55e',
    lightAlpha: 0.22,
    tintColor: 'rgba(16, 185, 129, 0.14)',
    tintAlpha: 0.14,
    bloomAlpha: 0.52,
    lowFog: true,
    shader: 'toxic',
    propSet: 'cloacas',
  },
  minas: {
    id: 'minas',
    biomeId: 'templos',
    label: 'Minas Profundas',
    particles: { count: 38, types: ['dust'] },
    lightColor: '#38bdf8',
    lightAlpha: 0.2,
    tintColor: 'rgba(30, 58, 138, 0.18)',
    tintAlpha: 0.18,
    bloomAlpha: 0.48,
    lowFog: true,
    shader: 'damp',
    propSet: 'minas',
  },
  forja: {
    id: 'forja',
    biomeId: 'forja',
    label: 'Forja Volcánica',
    particles: { count: 50, types: ['spark'] },
    lightColor: '#f97316',
    lightAlpha: 0.24,
    tintColor: 'rgba(194, 65, 12, 0.10)',
    tintAlpha: 0.1,
    bloomAlpha: 0.58,
    lowFog: false,
    shader: 'heat',
    propSet: 'forja',
  },
  templos: {
    id: 'templos',
    biomeId: 'templos',
    label: 'Templos Antiguos',
    particles: { count: 40, types: ['dust'] },
    lightColor: '#fbbf24',
    secondaryLightColor: '#22d3ee',
    lightAlpha: 0.24,
    tintColor: 'rgba(15, 23, 42, 0.08)',
    tintAlpha: 0.08,
    bloomAlpha: 0.56,
    flickeringTorches: true,
    lowFog: false,
    shader: null,
    propSet: 'templos',
  },
  corporativo: {
    id: 'corporativo',
    biomeId: 'ciudadela',
    label: 'Distrito Corporativo',
    particles: { count: 46, types: ['bit0', 'bit1'] },
    lightColor: '#22d3ee',
    lightAlpha: 0.24,
    tintColor: 'rgba(14, 116, 144, 0.10)',
    tintAlpha: 0.1,
    bloomAlpha: 0.74,
    neonGlow: true,
    lowFog: false,
    shader: 'neon',
    propSet: 'corporativo',
  },
  nucleo: {
    id: 'nucleo',
    biomeId: 'ciudadela',
    label: 'Núcleo de la IA',
    particles: { count: 52, types: ['glitch', 'bit0', 'bit1'] },
    lightColor: '#ef4444',
    lightAlpha: 0.28,
    tintColor: 'rgba(127, 29, 29, 0.12)',
    tintAlpha: 0.12,
    bloomAlpha: 0.78,
    neonGlow: true,
    lowFog: false,
    shader: 'glitch',
    propSet: 'corporativo',
  },
  interior: {
    id: 'interior',
    biomeId: 'interior',
    label: 'Interior',
    particles: { count: 0, types: [] },
    lightColor: '#fef08a',
    lightAlpha: 0.1,
    tintColor: null,
    tintAlpha: 0,
    bloomAlpha: 0.45,
    lowFog: false,
    shader: null,
    propSet: null,
  },
};

const EXACT_SCENE_THEME = {
  overworld: 'pueblo',
  first_stage: 'bosque',
  north_peaks: 'bosque',
  south_swamp: 'bosque',
  west_wastes: 'bosque',
  armor_temple: 'templos',
  sword_temple: 'templos',
  condemned_realms: 'templos',
  jail_cell: 'templos',
  ai_fortress_gate: 'forja',
  valleverde_corp: 'corporativo',
  inakito_office: 'corporativo',
  oficina_tony: 'corporativo',
  kernel_arena: 'nucleo',
  ai_nucleus_core: 'nucleo',
  ai_citadel: 'nucleo',
  player_house: 'interior',
  house_player: 'interior',
  elder_house: 'interior',
  oracle_house: 'interior',
  blacksmith_house: 'interior',
  herbalist_house: 'interior',
  guard_house: 'interior',
  rosa_bar: 'interior',
};

/**
 * Resuelve el ID del tema visual para cualquier ID de escena.
 * Soporta coincidencias exactas y prefijos (sewers_*, mines_*, forge_*, vertedero_*, quantum_*).
 */
export function resolveEnvironmentThemeId(sceneId) {
  if (!sceneId) return 'pueblo';
  const s = String(sceneId);
  if (EXACT_SCENE_THEME[s]) return EXACT_SCENE_THEME[s];
  if (s.startsWith('sewers_')) return 'cloacas';
  if (s.startsWith('mines_')) return 'minas';
  if (s.startsWith('forge_')) return 'forja';
  if (s.startsWith('vertedero_')) return 'corporativo';
  if (s.startsWith('quantum_')) return 'nucleo';
  if (s.includes('house') || s.startsWith('interior') || s === 'rosa_bar') return 'interior';
  return 'pueblo';
}

/**
 * Devuelve el objeto completo de configuración visual del bioma.
 */
export function getEnvironmentTheme(sceneId) {
  const id = resolveEnvironmentThemeId(sceneId);
  return ENVIRONMENT_THEMES[id] || ENVIRONMENT_THEMES.pueblo;
}

/**
 * Devuelve el identificador de bioma compatible con el sistema legado de partículas.
 */
export function resolveEnvironmentBiome(sceneId) {
  return getEnvironmentTheme(sceneId).biomeId;
}
