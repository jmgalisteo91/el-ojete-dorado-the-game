/**
 * WorldMap.js - Cartografía Real Pixel-Art estilo The Legend of Zelda
 * Reino del Gran Ojal · Atlas generado directamente desde los tiles reales de Tilemap.js:
 *
 * • CENTRO: Aldea de Valleverde (overworld + interiores)
 * • NORTE: Cumbres de la Recursión (north_peaks + Minas de la Recursión)
 * • ESTE: Valle de la Consagración (first_stage + Templos de Armadura y Espada)
 * • SUR: Marismas del Hardware Legacy (south_swamp + Cloacas y La Forja)
 * • OESTE: Dominio de Mister AI Alex (west_wastes + Puerta Cuántica + Ciudadela)
 */

import { TILES } from '../graphics/SpriteSheetGenerator.js?v=8';
import { Tilemap } from '../world/Tilemap.js?v=8';
import { UILayout, LOGICAL_WIDTH, LOGICAL_HEIGHT } from './UILayout.js?v=8';

export const ATLAS_WIDTH = 652;
export const ATLAS_HEIGHT = 288;

/**
 * Distribución cartográfica unificada de escenas en el canvas offscreen (652x288).
 * Las 5 regiones exteriores (36x24 @ 4px = 144x96) forman la cruz central continua;
 * los subterráneos, templos y zonas especiales ocupan recuadros en los bordes oceánicos.
 */
export const ATLAS_SCENE_SLOTS = {
  // 5 Regiones Exteriores (cruz central Zelda: 4x4 px por tile)
  north_peaks:      { zone: 'north',  ax: 254, ay: 0,   cols: 36, rows: 24, tilePx: 4, biome: 'north',   inset: false },
  west_wastes:      { zone: 'west',   ax: 110, ay: 96,  cols: 36, rows: 24, tilePx: 4, biome: 'west',    inset: false },
  overworld:        { zone: 'center', ax: 254, ay: 96,  cols: 36, rows: 24, tilePx: 4, biome: 'center',  inset: false },
  first_stage:      { zone: 'east',   ax: 398, ay: 96,  cols: 36, rows: 24, tilePx: 4, biome: 'east',    inset: false },
  south_swamp:      { zone: 'south',  ax: 254, ay: 192, cols: 36, rows: 24, tilePx: 4, biome: 'south',   inset: false },

  // Ala Oeste: Puerta Cuántica, Ciudadela Final y Reino Abisal
  quantum_gate:     { zone: 'west',   ax: 18,  ay: 18,  cols: 24, rows: 18, tilePx: 3, biome: 'citadel', inset: true, label: 'PUERTA CUÁNTICA', accent: '#a855f7' },
  ai_citadel:       { zone: 'west',   ax: 8,   ay: 108, cols: 24, rows: 18, tilePx: 4, biome: 'citadel', inset: true, label: 'CIUDADELA ALEX', accent: '#d946ef' },
  condemned_realms: { zone: 'west',   ax: 192, ay: 18,  cols: 24, rows: 18, tilePx: 2, biome: 'citadel', inset: true, label: 'ABISMO', accent: '#c084fc' },

  // Ala Este: Templos Binarios Sagrados
  armor_temple:     { zone: 'east',   ax: 562, ay: 82,  cols: 22, rows: 18, tilePx: 3, biome: 'east',    inset: true, label: 'T. ARMADURA', accent: '#38bdf8' },
  sword_temple:     { zone: 'east',   ax: 558, ay: 146, cols: 24, rows: 18, tilePx: 3, biome: 'east',    inset: true, label: 'T. ESPADA', accent: '#fbbf24' },

  // Ala Noreste: Minas de la Recursión
  mines_entry:      { zone: 'north',  ax: 410, ay: 16,  cols: 24, rows: 18, tilePx: 3, biome: 'mines',   inset: true, label: 'MINAS I', accent: '#06b6d4' },
  mines_puzzle:     { zone: 'north',  ax: 492, ay: 16,  cols: 24, rows: 18, tilePx: 3, biome: 'mines',   inset: true, label: 'RUNAS', accent: '#06b6d4' },
  mines_boss_arena: { zone: 'north',  ax: 576, ay: 28,  cols: 12, rows: 8,  tilePx: 3, biome: 'mines',   inset: true, label: 'STACK BOSS', accent: '#38bdf8' },

  // Ala Suroeste: Cloacas del Legacy
  sewers_dungeon:   { zone: 'south',  ax: 8,   ay: 214, cols: 24, rows: 18, tilePx: 3, biome: 'sewers',  inset: true, label: 'GARBAGE COL.', accent: '#22c55e' },
  sewers_puzzle:    { zone: 'south',  ax: 88,  ay: 214, cols: 24, rows: 18, tilePx: 3, biome: 'sewers',  inset: true, label: 'VÁLVULAS', accent: '#22c55e' },
  sewers_entry:     { zone: 'south',  ax: 168, ay: 214, cols: 24, rows: 18, tilePx: 3, biome: 'sewers',  inset: true, label: 'CLOACAS', accent: '#22c55e' },

  // Ala Sureste: La Forja del Prototipo
  forge_entry:      { zone: 'south',  ax: 410, ay: 214, cols: 24, rows: 18, tilePx: 3, biome: 'forge',   inset: true, label: 'LA FORJA', accent: '#f97316' },
  forge_puzzle:     { zone: 'south',  ax: 490, ay: 214, cols: 24, rows: 18, tilePx: 3, biome: 'forge',   inset: true, label: 'CALDERAS', accent: '#f97316' },
  ai_fortress_gate: { zone: 'south',  ax: 570, ay: 214, cols: 24, rows: 18, tilePx: 3, biome: 'forge',   inset: true, label: 'MICROONDAS', accent: '#ef4444' },

  // Expansión v2.0 (oculta bajo niebla hasta que se visita)
  valleverde_corp:  { zone: 'corp',   ax: 102, ay: 18,  cols: 24, rows: 18, tilePx: 2, biome: 'corp',    inset: true, label: 'VALLEVERDE 2.0', accent: '#22d3ee' },
  inakito_office:   { zone: 'corp',   ax: 158, ay: 24,  cols: 12, rows: 10, tilePx: 2, biome: 'corp',    inset: true, label: 'IÑAKITO', accent: '#38bdf8' },
  vertedero_digital:{ zone: 'corp',   ax: 102, ay: 58,  cols: 24, rows: 18, tilePx: 2, biome: 'corp',    inset: true, label: 'VERTEDERO 2.0', accent: '#a855f7' },
  vertedero_piso_1: { zone: 'corp',   ax: 102, ay: 58,  cols: 24, rows: 18, tilePx: 2, biome: 'corp',    inset: true, label: 'VERTEDERO P1', accent: '#a855f7' },
  vertedero_piso_2: { zone: 'corp',   ax: 102, ay: 58,  cols: 24, rows: 18, tilePx: 2, biome: 'corp',    inset: true, label: 'VERTEDERO P2', accent: '#a855f7' },
  vertedero_piso_3: { zone: 'corp',   ax: 102, ay: 58,  cols: 24, rows: 18, tilePx: 2, biome: 'corp',    inset: true, label: 'VERTEDERO P3', accent: '#a855f7' },
  vertedero_piso_4: { zone: 'corp',   ax: 102, ay: 58,  cols: 24, rows: 18, tilePx: 2, biome: 'corp',    inset: true, label: 'VERTEDERO P4', accent: '#a855f7' },
  vertedero_piso_5: { zone: 'corp',   ax: 102, ay: 58,  cols: 24, rows: 18, tilePx: 2, biome: 'corp',    inset: true, label: 'VERTEDERO P5', accent: '#a855f7' },
  kernel_arena:     { zone: 'corp',   ax: 158, ay: 56,  cols: 12, rows: 10, tilePx: 2, biome: 'corp',    inset: true, label: 'KERNEL', accent: '#22c55e' },
  rosa_bar:         { zone: 'corp',   ax: 158, ay: 40,  cols: 10, rows: 8,  tilePx: 2, biome: 'corp',    inset: true, label: 'BAR ROSA', accent: '#f59e0b' },
  ai_nucleus_core:  { zone: 'corp',   ax: 158, ay: 78,  cols: 14, rows: 12, tilePx: 2, biome: 'corp',    inset: true, label: 'NÚCLEO ALEX', accent: '#22d3ee' }
};

/** Metadatos descriptivos de cada escena para el HUD y marcador del jugador. */
const SCENE_METADATA = {
  overworld:        { zone: 'center', title: 'Aldea de Valleverde (Plaza Central)', detail: 'Refugio de la Aldea' },
  player_house:     { zone: 'center', title: 'Casa del Programador (Tu Hogar)', detail: 'Interior en Valleverde', houseCol: 4, houseRow: 10 },
  elder_house:      { zone: 'center', title: 'Casa del Sabio Aurelio', detail: 'Interior en Valleverde', houseCol: 8, houseRow: 5 },
  oracle_house:     { zone: 'center', title: 'Observatorio del Oráculo Orion', detail: 'Interior en Valleverde', houseCol: 14, houseRow: 5 },
  blacksmith_house: { zone: 'center', title: 'Herrería de Brom', detail: 'Taller de Forja', houseCol: 22, houseRow: 6 },
  herbalist_house:  { zone: 'center', title: 'Cabaña de Lyra (Herbolaria)', detail: 'Interior en Valleverde', houseCol: 6, houseRow: 18 },
  guard_house:      { zone: 'center', title: 'Cuartel de Kael', detail: 'Interior en Valleverde', houseCol: 22, houseRow: 18 },
  jail_cell:        { zone: 'center', title: 'Calabozo Municipal de Valleverde', detail: 'Arresto por Falta Leve', houseCol: 22, houseRow: 19 },
  first_stage:      { zone: 'east',   title: 'Valle de la Consagración (Santuarios)', detail: 'Tierras Sagradas del Este' },
  armor_temple:     { zone: 'east',   title: 'Templo de la Armadura Binaria', detail: 'Prueba de Paridad Lógica' },
  sword_temple:     { zone: 'east',   title: 'Templo de la Espada de la Recursividad', detail: 'Altar de la Recursión' },
  north_peaks:      { zone: 'north',  title: 'Cumbres de la Recursión (Picos de Silicio)', detail: 'Sendero Montañoso Norte' },
  mines_entry:      { zone: 'north',  title: 'Minas de la Recursión (Piso 1 · Caverna)', detail: 'Entrada del Gran Abismo' },
  mines_puzzle:     { zone: 'north',  title: 'Minas de la Recursión (Sala de Runas)', detail: 'Portal al Stack Overflow' },
  mines_boss_arena: { zone: 'north',  title: 'Minas de la Recursión · Cámara del Stack Overflow', detail: 'Arena del Guardián' },
  south_swamp:      { zone: 'south',  title: 'Marismas del Hardware Legacy', detail: 'Ciénaga Tóxica del Sur' },
  sewers_entry:     { zone: 'south',  title: 'Cloacas del Legacy (Acceso)', detail: 'Subterráneo Residual' },
  sewers_puzzle:    { zone: 'south',  title: 'Cloacas del Legacy (Válvulas y Desagüe)', detail: 'Subterráneo Residual' },
  sewers_dungeon:   { zone: 'south',  title: 'Cloacas: Fosa de Memoria (Garbage Collector)', detail: 'Arena del Mini-Boss' },
  forge_entry:      { zone: 'south',  title: 'La Forja del Prototipo (Acceso)', detail: 'Galería Térmica' },
  forge_puzzle:     { zone: 'south',  title: 'La Forja del Prototipo (Calderas)', detail: 'Galería Térmica' },
  ai_fortress_gate: { zone: 'south',  title: 'La Forja: Cámara del Microondas Prototipo', detail: 'Arena del Mini-Boss' },
  west_wastes:      { zone: 'west',   title: 'Páramo Corrupto de Mister AI Alex', detail: 'Frontera Occidental Desolada' },
  quantum_gate:     { zone: 'west',   title: 'La Gran Puerta del Núcleo Cuántico', detail: 'Antesala de la Ciudadela' },
  ai_citadel:       { zone: 'west',   title: 'Ciudadela Cuántica de AI Alex · El Gran Ojal', detail: 'Mainframe · Batalla Final' },
  condemned_realms: { zone: 'west',   title: 'Reino del Puntero Abisal', detail: 'Dimensión Corrupta' },
  valleverde_corp:  { zone: 'corp',   title: 'Valleverde 2.0 (Corporación Alex)', detail: 'Futuro Distópico Corporativo' },
  inakito_office:   { zone: 'corp',   title: 'Cubículo de Iñakito 2.0', detail: 'Arena del Becario Eterno' },
  vertedero_digital:{ zone: 'corp',   title: 'Vertedero Digital 2.0', detail: 'Mazmorra Rogue-lite (5 Pisos)' },
  vertedero_piso_1: { zone: 'corp',   title: 'Vertedero Digital 2.0 · Piso 1/5', detail: 'Subsuelo de Desechos Corporativos' },
  vertedero_piso_2: { zone: 'corp',   title: 'Vertedero Digital 2.0 · Piso 2/5', detail: 'Subsuelo de Desechos Corporativos' },
  vertedero_piso_3: { zone: 'corp',   title: 'Vertedero Digital 2.0 · Piso 3/5', detail: 'Zona de Seguridad · Franco el Pancho' },
  vertedero_piso_4: { zone: 'corp',   title: 'Vertedero Digital 2.0 · Piso 4/5', detail: 'Subsuelo Profundo del Sistema' },
  vertedero_piso_5: { zone: 'corp',   title: 'Vertedero Digital 2.0 · Piso 5/5', detail: 'Antesala de Kernel Arena' },
  kernel_arena:     { zone: 'corp',   title: 'Arena del Kernel · Servidor Central', detail: 'Jefe Acto 2 · El Kernel' },
  rosa_bar:         { zone: 'corp',   title: 'Bar Corporativo de Rosa', detail: 'Mejoras Permanentes (Currículums)' },
  ai_nucleus_core:  { zone: 'corp',   title: 'Núcleo de Mister Alex IA', detail: 'Acto 3 · Batalla Final' }
};

/** Enlaces gráficos sobre el atlas entre continentes y sus mazmorras satélite. */
const ATLAS_CONNECTOR_LINES = [
  { ax1: 298, ay1: 12,  ax2: 410, ay2: 42,  color: '#06b6d4', zone: 'north' }, // north_peaks -> mines
  { ax1: 482, ay1: 42,  ax2: 492, ay2: 42,  color: '#06b6d4', zone: 'north' },
  { ax1: 564, ay1: 42,  ax2: 576, ay2: 40,  color: '#38bdf8', zone: 'north' },
  { ax1: 288, ay1: 238, ax2: 240, ay2: 238, color: '#22c55e', zone: 'south' }, // south_swamp -> sewers
  { ax1: 168, ay1: 240, ax2: 160, ay2: 240, color: '#22c55e', zone: 'south' },
  { ax1: 88,  ay1: 240, ax2: 80,  ay2: 240, color: '#22c55e', zone: 'south' },
  { ax1: 356, ay1: 238, ax2: 410, ay2: 238, color: '#f97316', zone: 'south' }, // south_swamp -> forge
  { ax1: 482, ay1: 240, ax2: 490, ay2: 240, color: '#f97316', zone: 'south' },
  { ax1: 562, ay1: 240, ax2: 570, ay2: 240, color: '#ef4444', zone: 'south' },
  { ax1: 468, ay1: 112, ax2: 562, ay2: 109, color: '#38bdf8', zone: 'east'  }, // first_stage -> temples
  { ax1: 500, ay1: 152, ax2: 558, ay2: 168, color: '#fbbf24', zone: 'east'  },
  { ax1: 122, ay1: 128, ax2: 90,  ay2: 52,  color: '#a855f7', zone: 'west'  }, // west_wastes -> quantum_gate
  { ax1: 54,  ay1: 72,  ax2: 54,  ay2: 108, color: '#d946ef', zone: 'west'  }  // quantum_gate -> ai_citadel
];

export class WorldMap {
  constructor(menuSystem = null) {
    this.menuSystem = menuSystem;
    this._lastLocationName = 'Aldea de Valleverde';
    this._lastZoneId = 'center';

    // Vista navegable: pan + zoom + pinch
    this.isTouchDevice = false;
    this.view = { zoom: 1, panX: 0, panY: 0 };
    this.minZoom = 0.9;
    this.maxZoom = 2.2;
    this._buttons = [];
    this._touchWasDown = false;
    this._dragStart = null;
    this._pinchDist = null;
    this._closeRequested = false;
    this._hoverRegion = null;
    this._selectedRegion = null;

    // Textura offscreen generada una única vez desde los tiles reales del juego
    this._mapCanvas = null;
    this._realMapBuilt = false;
    this._sourceTilemap = null;
    this._fallbackTilemap = null;
    this._visitedScenes = new Set(['overworld']);
  }

  setTouchMode(isTouch) {
    this.isTouchDevice = Boolean(isTouch);
  }

  _mapRect() {
    return { x: 6, y: 16, w: LOGICAL_WIDTH - 12, h: 136 };
  }

  _getMapTransform() {
    const rect = this._mapRect();
    const scale = Math.min(rect.w / ATLAS_WIDTH, rect.h / ATLAS_HEIGHT);
    const drawW = ATLAS_WIDTH * scale;
    const drawH = ATLAS_HEIGHT * scale;
    const originX = rect.x + (rect.w - drawW) / 2;
    const originY = rect.y + (rect.h - drawH) / 2;
    return { scale, drawW, drawH, originX, originY, rect };
  }

  _atlasToScreen(ax, ay, tf = null) {
    const t = tf || this._getMapTransform();
    return {
      x: t.originX + ax * t.scale,
      y: t.originY + ay * t.scale
    };
  }

  _clampView() {
    const rect = this._mapRect();
    const maxX = (rect.w * (this.view.zoom - 1)) / 2 + 8;
    const maxY = (rect.h * (this.view.zoom - 1)) / 2 + 8;
    this.view.panX = Math.max(-maxX, Math.min(maxX, this.view.panX));
    this.view.panY = Math.max(-maxY, Math.min(maxY, this.view.panY));
  }

  _setZoom(zoom) {
    this.view.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    this._clampView();
  }

  resetView() {
    this.view.zoom = 1;
    this.view.panX = 0;
    this.view.panY = 0;
  }

  consumeCloseRequest() {
    const requested = this._closeRequested;
    this._closeRequested = false;
    return requested;
  }

  _handleButton(id) {
    if (id === 'close') {
      this._closeRequested = true;
    } else if (id === 'in') {
      this._setZoom(this.view.zoom * 1.25);
    } else if (id === 'out') {
      this._setZoom(this.view.zoom / 1.25);
    } else if (id === 'reset') {
      this.resetView();
    }
  }

  /**
   * Resuelve el tilemap vivo del juego o crea un Tilemap sin DOM de respaldo.
   */
  _resolveTilemap(explicitTilemap = null) {
    if (explicitTilemap?.scenes) return explicitTilemap;
    const ctxTm = this.menuSystem?.worldMapContext?.tilemap;
    if (ctxTm?.scenes) return ctxTm;
    const stateTm = this.menuSystem?.callbacks?.getGameState?.()?.tilemap;
    if (stateTm?.scenes) return stateTm;
    if (!this._fallbackTilemap) {
      this._fallbackTilemap = new Tilemap(null, 16);
    }
    return this._fallbackTilemap;
  }

  /**
   * Crea un canvas offscreen (navegador u OffscreenCanvas) compatible con entornos sin DOM.
   */
  _createOffscreenCanvas(width, height) {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      return c;
    }
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height);
    }
    return null;
  }

  /**
   * Mapea el par (ground, decoration) a color base + acento pixel-art según bioma.
   */
  _getTilePalette(groundId, decoId, col, row, biome) {
    const jitter = ((col * 31 + row * 17) & 3);
    let ground = '#2d5a27'; // Hierba base por defecto

    if (groundId === TILES.WATER_1 || groundId === TILES.WATER_2) {
      ground = jitter === 0 ? '#1d4ed8' : (jitter === 1 ? '#1e40af' : '#1e3a8a');
    } else if (groundId === TILES.BRIDGE) {
      ground = jitter % 2 === 0 ? '#92400e' : '#b45309';
    } else if (groundId === TILES.PATH) {
      ground = jitter === 0 ? '#7c5025' : (jitter === 3 ? '#9a6532' : '#8b5a2b');
    } else if (groundId === TILES.COBBLE || groundId === TILES.EXIT_MAT) {
      if (biome === 'north') ground = jitter === 0 ? '#64748b' : '#526074';
      else if (biome === 'west') ground = jitter === 0 ? '#5b4b6b' : '#4a3d58';
      else if (biome === 'east') ground = jitter === 0 ? '#706b5c' : '#5e594c';
      else ground = jitter === 0 ? '#78716c' : '#68625d';
    } else if (groundId === TILES.STONE_FLOOR) {
      ground = jitter === 0 ? '#374151' : '#4b5563';
    } else if (groundId === TILES.MINE_CRYSTAL_FLOOR) {
      ground = jitter === 0 ? '#273549' : '#334155';
    } else if (groundId === TILES.MINE_CHASM) {
      ground = '#030712';
    } else if (groundId === TILES.SEWER_SLIME_FLOOR) {
      ground = jitter === 0 ? '#166534' : '#14532d';
    } else if (groundId === TILES.FORGE_LAVA_FLOOR) {
      ground = jitter === 0 ? '#c2410c' : '#7c2d12';
    } else if (groundId === TILES.MAINFRAME_FLOOR) {
      ground = jitter === 0 ? '#3b0764' : '#2e1065';
    } else if (groundId === TILES.CORP_FLOOR) {
      ground = jitter === 0 ? '#64748b' : '#475569';
    } else if (groundId === TILES.INAKITO_CARPET) {
      ground = '#1e3a8a';
    } else if (groundId === TILES.GRASS_1 || groundId === TILES.GRASS_2 || groundId === undefined || groundId < 0) {
      if (biome === 'south') {
        ground = jitter === 0 ? '#21441f' : (jitter === 2 ? '#295025' : '#244821');
      } else if (biome === 'west') {
        ground = jitter === 0 ? '#273d24' : '#2f492a';
      } else {
        ground = jitter === 0 ? '#264d21' : (jitter === 3 ? '#34682d' : '#2d5a27');
      }
    }

    let deco = null;
    let accent = null;
    if (decoId === TILES.TREE_TOP) {
      deco = '#10b981';
      accent = '#047857';
    } else if (decoId === TILES.TREE_TRUNK) {
      deco = '#5c3a21';
    } else if (decoId === TILES.BUSH) {
      deco = '#15803d';
    } else if (decoId === TILES.FLOWERS_1 || decoId === TILES.FLOWERS_2) {
      accent = decoId === TILES.FLOWERS_1 ? '#fde047' : '#f87171';
    } else if (decoId === TILES.ROOF_RED) {
      deco = '#b91c1c';
      accent = '#ef4444';
    } else if (decoId === TILES.ROOF_BLUE) {
      deco = '#1d4ed8';
      accent = '#3b82f6';
    } else if (decoId === TILES.WALL_WOOD || decoId === TILES.WALL_FRONT || decoId === TILES.CHIMNEY) {
      deco = '#78350f';
    } else if (decoId === TILES.WALL_WINDOW) {
      deco = '#78350f';
      accent = '#fde047';
    } else if (decoId === TILES.WALL_DOOR) {
      deco = '#451a03';
      accent = '#fbbf24';
    } else if (decoId === TILES.BRIDGE_GATE) {
      deco = '#d97706';
    } else if (decoId === TILES.WELL) {
      deco = '#4b5563';
      accent = '#38bdf8';
    } else if (decoId === TILES.LAMPPOST) {
      accent = '#fde047';
    } else if (decoId === TILES.ALTAR_PEDESTAL || decoId === TILES.CORE_PEDESTAL || decoId === TILES.CRYSTAL_BARRIER) {
      deco = '#0284c7';
      accent = '#38bdf8';
    } else if (decoId === TILES.PORTAL_GATE_CLOSED || decoId === TILES.PORTAL_GATE_OPEN) {
      deco = decoId === TILES.PORTAL_GATE_OPEN ? '#10b981' : '#e11d48';
      accent = '#fde047';
    } else if (decoId === TILES.MINE_CRYSTAL_WALL) {
      deco = '#1e293b';
      accent = jitter === 0 ? '#06b6d4' : null;
    } else if (decoId === TILES.SEWER_PIPE_WALL) {
      deco = '#334155';
      accent = jitter === 0 ? '#22c55e' : null;
    } else if (decoId === TILES.FORGE_BOILER_WALL) {
      deco = '#451a03';
      accent = jitter === 0 ? '#f97316' : null;
    } else if (decoId === TILES.MAINFRAME_WALL) {
      deco = '#4c1d95';
      accent = jitter === 0 ? '#d946ef' : null;
    } else if (decoId === TILES.CORP_GLASS_WALL || decoId === TILES.CORP_CRT_WALL || decoId === TILES.CORP_CUBICLE) {
      deco = '#1e293b';
      accent = '#22d3ee';
    } else if (decoId === TILES.CORP_PLANT) {
      deco = '#10b981';
    } else if (decoId === TILES.CORP_EXTINGUISHER) {
      deco = '#ef4444';
    } else if (decoId === TILES.INAKITO_CUBICLE_WALL) {
      deco = '#0f172a';
    } else if (decoId === TILES.INAKITO_COFFEE_MOUND) {
      deco = '#78350f';
    } else if (
      decoId === TILES.WALL_INTERIOR ||
      decoId === TILES.ROCK ||
      decoId === TILES.STALACTITE ||
      decoId === TILES.JAIL_BARS ||
      decoId === TILES.BEAM
    ) {
      deco = '#374151';
    } else if (decoId === TILES.CRATE || decoId === TILES.FENCE_H || decoId === TILES.FENCE_POST || decoId === TILES.SIGNPOST || decoId === TILES.ANVIL) {
      accent = '#92400e';
    }

    return { ground, deco, accent };
  }

  /**
   * Genera UNA SOLA VEZ el mapa offscreen gigante leyendo los tiles reales (`ground` y `decoration`)
   * de todas las escenas registradas en `game.tilemap.scenes`.
   */
  _generateRealMapTexture(explicitTilemap = null) {
    const tilemap = this._resolveTilemap(explicitTilemap);
    const expansionState = Boolean(
      tilemap?.expansionLoaded ||
      globalThis?.window?.game?.isExpansionActive ||
      globalThis?.window?.game?.isExpansionMode
    );
    if (
      this._realMapBuilt &&
      this._mapCanvas &&
      this._cachedExpansionLoaded === expansionState &&
      (!explicitTilemap || this._sourceTilemap === tilemap)
    ) {
      return this._mapCanvas;
    }

    this._sourceTilemap = tilemap;
    this._cachedExpansionLoaded = expansionState;
    this._realMapBuilt = true;

    const canvas = this._createOffscreenCanvas(ATLAS_WIDTH, ATLAS_HEIGHT);
    if (!canvas) {
      this._mapCanvas = null;
      return null;
    }
    const offCtx = canvas.getContext('2d');
    if (!offCtx) {
      this._mapCanvas = null;
      return null;
    }
    offCtx.imageSmoothingEnabled = false;

    // 1. Fondo oceánico oscuro con gradiente abisal y retícula náutica sutil
    const ocean = offCtx.createRadialGradient(
      ATLAS_WIDTH * 0.5, ATLAS_HEIGHT * 0.5, 40,
      ATLAS_WIDTH * 0.5, ATLAS_HEIGHT * 0.5, ATLAS_WIDTH * 0.65
    );
    ocean.addColorStop(0, '#0f223d');
    ocean.addColorStop(0.55, '#091529');
    ocean.addColorStop(1, '#040914');
    offCtx.fillStyle = ocean;
    offCtx.fillRect(0, 0, ATLAS_WIDTH, ATLAS_HEIGHT);

    // Retícula cartográfica pixel-art y oleaje tenue sobre el mar
    offCtx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    offCtx.lineWidth = 1;
    for (let x = 32; x < ATLAS_WIDTH; x += 48) {
      offCtx.beginPath();
      offCtx.moveTo(x, 0);
      offCtx.lineTo(x, ATLAS_HEIGHT);
      offCtx.stroke();
    }
    for (let y = 24; y < ATLAS_HEIGHT; y += 48) {
      offCtx.beginPath();
      offCtx.moveTo(0, y);
      offCtx.lineTo(ATLAS_WIDTH, y);
      offCtx.stroke();
    }
    for (let i = 0; i < 160; i++) {
      const wx = (i * 97 + 19) % (ATLAS_WIDTH - 6);
      const wy = (i * 53 + 11) % (ATLAS_HEIGHT - 2);
      offCtx.fillStyle = i % 5 === 0 ? 'rgba(56, 189, 248, 0.16)' : 'rgba(30, 58, 138, 0.25)';
      offCtx.fillRect(wx, wy, 4 + (i % 3) * 2, 1);
    }

    // 2. Halo costero alrededor de los 5 continentes principales
    for (const slot of Object.values(ATLAS_SCENE_SLOTS)) {
      const w = slot.cols * slot.tilePx;
      const h = slot.rows * slot.tilePx;
      if (!slot.inset) {
        offCtx.fillStyle = 'rgba(30, 58, 138, 0.55)';
        offCtx.fillRect(slot.ax - 4, slot.ay - 4, w + 8, h + 8);
        offCtx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        offCtx.fillRect(slot.ax - 2, slot.ay - 2, w + 4, h + 4);
      }
    }

    // 3. Rutas submarinas hacia las cámaras de mazmorras y templos
    offCtx.save();
    offCtx.setLineDash([4, 3]);
    offCtx.lineWidth = 1.5;
    for (const link of ATLAS_CONNECTOR_LINES) {
      offCtx.strokeStyle = link.color;
      offCtx.globalAlpha = 0.5;
      offCtx.beginPath();
      offCtx.moveTo(link.ax1, link.ay1);
      offCtx.lineTo(link.ax2, link.ay2);
      offCtx.stroke();
    }
    offCtx.restore();

    // 4. Recorrer todas las escenas de `tilemap.scenes` y pintar tiles reales (`ground` + `decoration`)
    const expansionActive = Boolean(
      tilemap?.expansionLoaded ||
      globalThis?.window?.game?.isExpansionActive ||
      globalThis?.window?.game?.isExpansionMode
    );
    const scenes = tilemap?.scenes || {};
    for (const [sceneId, scene] of Object.entries(scenes)) {
      const slot = ATLAS_SCENE_SLOTS[sceneId];
      if (!slot || !scene?.layers) continue;
      if (slot.zone === 'corp' && !expansionActive) continue;

      const groundLayer = scene.layers.ground;
      const decoLayer = scene.layers.decoration;
      const rows = Math.min(slot.rows, scene.rows || groundLayer?.length || 0);
      const cols = Math.min(slot.cols, scene.cols || groundLayer?.[0]?.length || 0);
      const p = slot.tilePx;

      if (slot.inset) {
        const boxW = slot.cols * p;
        const boxH = slot.rows * p;
        offCtx.fillStyle = 'rgba(3, 7, 18, 0.9)';
        offCtx.fillRect(slot.ax - 2, slot.ay - 2, boxW + 4, boxH + 4);
        offCtx.strokeStyle = slot.accent || '#64748b';
        offCtx.lineWidth = 1;
        offCtx.strokeRect(slot.ax - 1.5, slot.ay - 1.5, boxW + 3, boxH + 3);
      }

      for (let r = 0; r < rows; r++) {
        const gRow = groundLayer?.[r];
        const dRow = decoLayer?.[r];
        const py = slot.ay + r * p;
        for (let c = 0; c < cols; c++) {
          const px = slot.ax + c * p;
          const groundId = gRow ? gRow[c] : undefined;
          const decoId = dRow ? dRow[c] : -1;
          const pal = this._getTilePalette(groundId, decoId, c, r, slot.biome);

          offCtx.fillStyle = pal.ground;
          offCtx.fillRect(px, py, p, p);

          if (pal.deco) {
            offCtx.fillStyle = pal.deco;
            if (decoId === TILES.TREE_TOP) {
              // Copa de árbol verde brillante redondeada estilo pixel-art
              offCtx.fillRect(px, py, p, p);
              if (p >= 3 && pal.accent) {
                offCtx.fillStyle = pal.accent;
                offCtx.fillRect(px + p - 1, py + p - 1, 1, 1);
                offCtx.fillRect(px, py + p - 1, 1, 1);
              }
            } else {
              offCtx.fillRect(px, py, p, p);
            }
          }

          if (pal.accent && p >= 2 && decoId !== TILES.TREE_TOP) {
            offCtx.fillStyle = pal.accent;
            offCtx.fillRect(px + Math.floor(p / 2), py + Math.floor(p / 2), 1, 1);
          }
        }
      }

      if (slot.inset && slot.label) {
        offCtx.fillStyle = slot.accent || '#cbd5e1';
        offCtx.font = 'bold 6px monospace';
        offCtx.textAlign = 'center';
        offCtx.textBaseline = 'bottom';
        offCtx.fillText(slot.label, slot.ax + (slot.cols * p) / 2, slot.ay - 3);
      }
    }

    this._mapCanvas = canvas;
    return canvas;
  }

  /** Alias público por compatibilidad si el integrador prefiere generarlo al arrancar. */
  generateRealMapTexture(tilemap = null) {
    return this._generateRealMapTexture(tilemap);
  }

  /**
   * Pan con un dedo, zoom con pinch y botones de navegación.
   */
  updateInput(input) {
    if (!input) return;
    const px = input.pointerX;
    const py = input.pointerY;
    const down = Boolean(input.isPointerDown);

    const mapRect = this._mapRect();
    if (px >= mapRect.x && px <= mapRect.x + mapRect.w && py >= mapRect.y && py <= mapRect.y + mapRect.h) {
      const hit = this._regionAt(px, py);
      this._hoverRegion = hit ? hit.id : null;
      if (input.pointerJustClicked && hit) this._selectedRegion = hit.id;
    } else {
      this._hoverRegion = null;
    }
    if (typeof input.consumeMenuDirection === 'function') {
      const dir = input.consumeMenuDirection();
      if (dir) this._cycleSelection(dir);
    }

    if (input.pointerJustClicked && this.isTouchDevice) {
      for (const b of this._buttons) {
        if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
          this._handleButton(b.id);
          return;
        }
      }
    }

    const pointers = input.activePointers ? Array.from(input.activePointers.values()) : [];
    if (pointers.length >= 2) {
      const d = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
      if (this._pinchDist != null && this._pinchDist > 0) {
        this._setZoom(this.view.zoom * (d / this._pinchDist));
      }
      this._pinchDist = d;
      this._dragStart = null;
      return;
    }
    this._pinchDist = null;

    if (down && !this._touchWasDown) {
      this._touchWasDown = true;
      const rect = this._mapRect();
      if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) {
        this._dragStart = { x: px, y: py, panX: this.view.panX, panY: this.view.panY };
      }
    } else if (down && this._dragStart) {
      this.view.panX = this._dragStart.panX + (px - this._dragStart.x);
      this.view.panY = this._dragStart.panY + (py - this._dragStart.y);
      this._clampView();
    } else if (!down) {
      this._touchWasDown = false;
      this._dragStart = null;
    }
  }

  _drawMapButtons(ctx, W) {
    this._buttons = [];
    if (!this.isTouchDevice) return;
    const r = 8.5;
    const defs = [
      { id: 'close', x: W - 14, y: 26, r, icon: '✕', color: '#f87171' },
      { id: 'in', x: W - 14, y: 48, r, icon: '+', color: '#38bdf8' },
      { id: 'out', x: W - 14, y: 68, r, icon: '−', color: '#38bdf8' },
      { id: 'reset', x: 14, y: 26, r, icon: '⌂', color: '#e5c07b' }
    ];
    for (const b of defs) {
      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 14, 24, 0.85)';
      ctx.fill();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.icon, b.x, b.y + 0.5);
      ctx.restore();
      this._buttons.push({ id: b.id, x: b.x - b.r - 2, y: b.y - b.r - 2, w: (b.r + 2) * 2, h: (b.r + 2) * 2 });
    }
  }

  /**
   * Definición cartográfica de las regiones alineada con la geometría real del atlas.
   */
  _getRegionDefs() {
    const tf = this._getMapTransform();
    const pt = (ax, ay) => this._atlasToScreen(ax, ay, tf);
    const north = pt(326, 48);
    const west = pt(158, 144);
    const center = pt(326, 144);
    const east = pt(490, 144);
    const south = pt(326, 240);
    return [
      { id: 'north', name: 'Cumbres de la Recursión', short: 'CUMBRES', cx: north.x, cy: north.y, rx: 40, ry: 23, ax: 254, ay: 0, aw: 144, ah: 96, color: '#38bdf8', icon: 'mountain', desc: 'Minas y Guardián del Stack' },
      { id: 'west', name: 'Dominio de AI Alex', short: 'DOMINIO ALEX', cx: west.x, cy: west.y, rx: 52, ry: 26, ax: 8, ay: 96, aw: 246, ah: 96, color: '#a855f7', icon: 'eye', desc: 'Ciudadela y Puerta Cuántica' },
      { id: 'center', name: 'Aldea de Valleverde', short: 'VALLEVERDE', cx: center.x, cy: center.y, rx: 34, ry: 23, ax: 254, ay: 96, aw: 144, ah: 96, color: '#4ade80', icon: 'valley', desc: 'Refugio, mercado y herrería' },
      { id: 'east', name: 'Valle de la Consagración', short: 'VALLE SAGRADO', cx: east.x, cy: east.y, rx: 48, ry: 26, ax: 398, ay: 82, aw: 234, ah: 116, color: '#fbbf24', icon: 'temple', desc: 'Templos de Espada y Armadura' },
      { id: 'south', name: 'Marismas del Legacy', short: 'MARISMAS', cx: south.x, cy: south.y, rx: 46, ry: 23, ax: 254, ay: 192, aw: 144, ah: 96, color: '#22c55e', icon: 'skull', desc: 'Cloacas y Forja del Microondas' }
    ];
  }

  /** Región bajo un punto de pantalla, compensando pan/zoom. */
  _regionAt(px, py) {
    const rect = this._mapRect();
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const localX = (px - (cx + this.view.panX)) / this.view.zoom + cx;
    const localY = (py - (cy + this.view.panY)) / this.view.zoom + cy;
    for (const def of this._getRegionDefs()) {
      if (
        localX >= def.cx - def.rx &&
        localX <= def.cx + def.rx &&
        localY >= def.cy - def.ry &&
        localY <= def.cy + def.ry
      ) {
        return def;
      }
    }
    return null;
  }

  _cycleSelection(direction) {
    const defs = this._getRegionDefs();
    if (defs.length === 0) return;
    let idx = defs.findIndex((d) => d.id === (this._selectedRegion || this._lastZoneId));
    if (idx < 0) idx = 0;
    const delta = direction === 'up' || direction === 'left' ? -1 : 1;
    this._selectedRegion = defs[(idx + delta + defs.length) % defs.length].id;
  }

  _getExploredZones(currentZone, status, player = null) {
    const visited = new Set(['center', currentZone]);
    for (const sceneId of this._visitedScenes) {
      const z = SCENE_METADATA[sceneId]?.zone;
      if (z) visited.add(z);
    }
    if (Array.isArray(player?.visitedScenes)) {
      for (const sceneId of player.visitedScenes) {
        const z = SCENE_METADATA[sceneId]?.zone;
        if (z) visited.add(z);
      }
    }
    if (status.hasDash || status.gcDefeated) visited.add('south');
    if (status.hasChargedAttack || status.stackDefeated) visited.add('north');
    if (status.hasBarrier || status.microwaveDefeated) visited.add('south');
    if (status.hasArmor || status.hasSword) visited.add('east');
    if (status.placedCount > 0 || status.alexDefeated) visited.add('west');
    return visited;
  }

  _getQuestTarget(status, currentSceneId) {
    if (currentSceneId === 'valleverde_corp' || currentSceneId === 'inakito_office') {
      return { sceneId: 'inakito_office', tx: 6, ty: 5, label: 'Iñakito 2.0' };
    }
    if (!status.hasArmor) return { sceneId: 'armor_temple', tx: 11, ty: 9, label: 'Armadura Binaria' };
    if (!status.hasSword) return { sceneId: 'sword_temple', tx: 12, ty: 9, label: 'Espada Recursiva' };
    if (!status.gcDefeated) return { sceneId: 'sewers_dungeon', tx: 12, ty: 9, label: 'Garbage Collector' };
    if (!status.stackDefeated) return { sceneId: 'mines_boss_arena', tx: 6, ty: 4, label: 'Stack Overflow' };
    if (!status.microwaveDefeated) return { sceneId: 'ai_fortress_gate', tx: 12, ty: 9, label: 'Microondas Prototipo' };
    if (!status.alexDefeated) return { sceneId: 'ai_citadel', tx: 12, ty: 9, label: 'Mister AI Alex' };
    return null;
  }

  /**
   * Resuelve el centro o posición exacta en pantalla de un tile dentro de una escena.
   */
  _sceneTileToScreen(sceneId, tileX, tileY, tf = null) {
    const slot = ATLAS_SCENE_SLOTS[sceneId];
    if (!slot) return null;
    const clampedX = Math.max(0.5, Math.min(slot.cols - 0.5, tileX));
    const clampedY = Math.max(0.5, Math.min(slot.rows - 0.5, tileY));
    return this._atlasToScreen(slot.ax + clampedX * slot.tilePx, slot.ay + clampedY * slot.tilePx, tf);
  }

  /**
   * Dibuja marco tenue alrededor de las regiones activa / seleccionada y etiquetas limpias.
   */
  _drawRegionOverlays(ctx, defs, currentZone, explored, tf, t) {
    for (const def of defs) {
      if (!explored.has(def.id)) continue;
      const active = def.id === currentZone;
      const hover = this._hoverRegion === def.id || this._selectedRegion === def.id;
      const topLeft = this._atlasToScreen(def.ax, def.ay, tf);
      const w = def.aw * tf.scale;
      const h = def.ah * tf.scale;

      if (active || hover) {
        ctx.save();
        ctx.strokeStyle = active
          ? `rgba(253, 224, 71, ${(0.55 + Math.sin(t * 4) * 0.2).toFixed(2)})`
          : 'rgba(253, 224, 71, 0.45)';
        ctx.lineWidth = active ? 1.4 : 1;
        ctx.strokeRect(topLeft.x + 0.5, topLeft.y + 0.5, w - 1, h - 1);
        ctx.restore();
      }

      // Etiqueta compacta sobre el borde inferior de la provincia visitada
      const tagW = def.short.length * 3.1 + 8;
      const tagX = topLeft.x + w / 2;
      const tagY = topLeft.y + h - 4.5;
      ctx.save();
      ctx.fillStyle = 'rgba(4, 8, 18, 0.78)';
      ctx.fillRect(tagX - tagW / 2, tagY - 3.5, tagW, 7);
      ctx.strokeStyle = active ? '#ffd700' : 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(tagX - tagW / 2, tagY - 3.5, tagW, 7);
      UILayout.drawText(ctx, def.short, tagX, tagY + 0.2, {
        font: 'bold 3.8px monospace',
        color: active ? '#ffd700' : '#e2e8f0',
        align: 'center',
        baseline: 'middle',
        shadow: false
      });
      ctx.restore();
    }
  }

  /**
   * Cubre con nubes y niebla oscura cualquier zona/mazmorra aún no visitada.
   */
  _drawUnexploredClouds(ctx, explored, tf, t) {
    const expansionActive = Boolean(
      this._cachedExpansionLoaded ||
      globalThis?.window?.game?.isExpansionActive ||
      globalThis?.window?.game?.isExpansionMode
    );
    const fogEntries = Object.entries(ATLAS_SCENE_SLOTS).filter(
      ([, s]) => (s.zone !== 'corp' || expansionActive) && !explored.has(s.zone)
    );
    if (fogEntries.length === 0) return;

    ctx.save();
    for (const [sceneId, slot] of fogEntries) {
      const p0 = this._atlasToScreen(slot.ax - (slot.inset ? 3 : 2), slot.ay - (slot.inset ? 8 : 2), tf);
      const pw = (slot.cols * slot.tilePx + (slot.inset ? 6 : 4)) * tf.scale;
      const ph = (slot.rows * slot.tilePx + (slot.inset ? 10 : 4)) * tf.scale;

      // Velo negro base sobre la región oculta
      ctx.fillStyle = 'rgba(4, 7, 15, 0.88)';
      ctx.fillRect(p0.x, p0.y, pw, ph);

      // Nubes oscuras densas estilo Zelda sobre la zona sin explorar
      const cols = slot.inset ? 3 : 5;
      const rows = slot.inset ? 2 : 3;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seed = sceneId.length * 7 + r * 13 + c * 19;
          const drift = Math.sin(t * 0.7 + seed) * 1.4;
          const cx = p0.x + ((c + 0.5) / cols) * pw + drift;
          const cy = p0.y + ((r + 0.5) / rows) * ph;
          const rad = (slot.inset ? 6.5 : 10.5) + (seed % 3);

          ctx.fillStyle = 'rgba(10, 15, 28, 0.94)';
          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(30, 41, 59, 0.45)';
          ctx.beginPath();
          ctx.arc(cx - 1.5, cy - 1.5, rad * 0.65, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!slot.inset) {
        UILayout.drawText(ctx, '???', p0.x + pw / 2, p0.y + ph / 2, {
          font: 'bold 5.5px monospace',
          color: 'rgba(148, 163, 184, 0.65)',
          align: 'center',
          baseline: 'middle',
          shadow: true
        });
      }
    }
    ctx.restore();
  }

  /**
   * Dibuja los iconos de jefes (calavera / check) y la "!" dorada sobre el objetivo actual.
   */
  _drawQuestAndBossMarkers(ctx, currentSceneId, explored, status, tf, t) {
    const markers = [
      { sceneId: 'armor_temple', tx: 11, ty: 9, cleared: status.hasArmor, zone: 'east', color: '#38bdf8', kind: 'checkOnly' },
      { sceneId: 'sword_temple', tx: 12, ty: 9, cleared: status.hasSword, zone: 'east', color: '#fbbf24', kind: 'checkOnly' },
      { sceneId: 'sewers_dungeon', tx: 12, ty: 9, cleared: status.gcDefeated, zone: 'south', color: '#22c55e', kind: 'boss' },
      { sceneId: 'mines_boss_arena', tx: 6, ty: 4, cleared: status.stackDefeated, zone: 'north', color: '#06b6d4', kind: 'boss' },
      { sceneId: 'ai_fortress_gate', tx: 12, ty: 9, cleared: status.microwaveDefeated, zone: 'south', color: '#f97316', kind: 'boss' },
      { sceneId: 'ai_citadel', tx: 12, ty: 9, cleared: status.alexDefeated, zone: 'west', color: '#ef4444', kind: 'crownBoss' }
    ];

    for (const m of markers) {
      if (!explored.has(m.zone) && !m.cleared) continue;
      const pos = this._sceneTileToScreen(m.sceneId, m.tx, m.ty, tf);
      if (!pos) continue;
      if (m.cleared) {
        this._drawMiniCheck(ctx, pos.x, pos.y);
      } else if (m.kind !== 'checkOnly') {
        this._drawMiniSkull(ctx, pos.x, pos.y, m.color, t, m.kind === 'crownBoss');
      }
    }

    // "!" dorada animada sobre la sala de la misión principal actual
    const target = this._getQuestTarget(status, currentSceneId);
    if (target) {
      const pos = this._sceneTileToScreen(target.sceneId, target.tx, target.ty, tf);
      if (pos) {
        const bob = Math.sin(t * 5) * 1.6;
        const qx = pos.x;
        const qy = pos.y - 6 + bob;
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.arc(qx + 0.8, qy + 0.8, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(qx, qy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 6.8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', qx, qy + 0.5);
        ctx.restore();
      }
    }
  }

  _drawRegionTooltip(ctx, def, locInfo, explored, questZone) {
    const W = LOGICAL_WIDTH;
    const H = LOGICAL_HEIGHT;
    const rect = this._mapRect();
    const mapCX = rect.x + rect.w / 2;
    const mapCY = rect.y + rect.h / 2;
    const sx = (def.cx - mapCX) * this.view.zoom + mapCX + this.view.panX;
    const sy = (def.cy - mapCY) * this.view.zoom + mapCY + this.view.panY;
    const boxW = 104;
    const boxH = 28;
    const x = Math.max(8, Math.min(W - boxW - 8, sx - boxW / 2));
    const y = sy > H * 0.55 ? sy - boxH - 14 : sy + 14;
    const statusText = def.id === locInfo.zone
      ? 'ZONA ACTUAL'
      : (questZone === def.id ? 'MISIÓN PRINCIPAL' : (explored.has(def.id) ? 'EXPLORADA' : 'SIN EXPLORAR'));

    UILayout.drawShadow(ctx, x, y, boxW, boxH, 0.42);
    const g = ctx.createLinearGradient(0, y, 0, y + boxH);
    g.addColorStop(0, 'rgba(15, 23, 42, 0.96)');
    g.addColorStop(1, 'rgba(8, 13, 24, 0.96)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = '#e5c07b';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1);

    UILayout.drawIcon(ctx, def.icon, x + 10, y + 9, 10, def.color);
    UILayout.drawText(ctx, def.name, x + 19, y + 7, {
      font: 'bold 4.6px monospace',
      color: '#ffd700',
      baseline: 'middle',
      maxWidth: boxW - 23
    });
    UILayout.drawText(ctx, statusText, x + 6, y + 17, {
      font: 'bold 3.8px monospace',
      color: questZone === def.id ? '#fde047' : '#94a3b8',
      baseline: 'middle'
    });
    UILayout.drawText(ctx, def.desc, x + 6, y + 23, {
      font: '3.6px monospace',
      color: '#cbd5e1',
      baseline: 'middle',
      maxWidth: boxW - 12
    });
  }

  /**
   * Renderiza el mapa completo sobre el canvas lógico (320x180).
   */
  render(ctx, currentSceneId = 'overworld', player = null, enemies = null, tilemap = null) {
    const W = LOGICAL_WIDTH;
    const H = LOGICAL_HEIGHT;
    const t = performance.now() * 0.001;
    const rect = this._mapRect();
    const resolvedTm = this._resolveTilemap(tilemap);

    if (currentSceneId) this._visitedScenes.add(currentSceneId);
    this._generateRealMapTexture(resolvedTm);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 1. Marco glassmorphism oscuro con borde dorado
    this._drawZeldaFrame(ctx, W, H);

    const mapCX = rect.x + rect.w / 2;
    const mapCY = rect.y + rect.h / 2;
    const tf = this._getMapTransform();

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.translate(mapCX + this.view.panX, mapCY + this.view.panY);
    ctx.scale(this.view.zoom, this.view.zoom);
    ctx.translate(-mapCX, -mapCY);

    // 2. Dibujar la textura offscreen del mapa real centrada
    if (this._mapCanvas) {
      ctx.drawImage(this._mapCanvas, tf.originX, tf.originY, tf.drawW, tf.drawH);
    } else {
      ctx.fillStyle = '#091529';
      ctx.fillRect(tf.originX, tf.originY, tf.drawW, tf.drawH);
    }

    // 3. Filtro de oscurecimiento (alpha 0.4) + viñeta elegante
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(tf.originX, tf.originY, tf.drawW, tf.drawH);

    const status = this._computeProgressStatus(player, enemies);
    const locInfo = this._resolvePlayerLocation(currentSceneId, player, resolvedTm);
    this._lastLocationName = locInfo.title;
    this._lastZoneId = locInfo.zone;
    const defs = this._getRegionDefs();
    const explored = this._getExploredZones(locInfo.zone, status, player);
    const questTarget = this._getQuestTarget(status, currentSceneId);
    const questZone = questTarget ? (SCENE_METADATA[questTarget.sceneId]?.zone || null) : null;

    // 4. Niebla negra / nubes en zonas sin explorar
    this._drawUnexploredClouds(ctx, explored, tf, t);

    // 5. Resalte de regiones exploradas + iconos de misiones/jefes + brújula + posición exacta
    this._drawRegionOverlays(ctx, defs, locInfo.zone, explored, tf, t);
    this._drawQuestAndBossMarkers(ctx, currentSceneId, explored, status, tf, t);
    this._drawCompassRose(ctx, 20, 140);
    this._drawHeroLocationMarker(ctx, locInfo, t);
    ctx.restore();

    // 6. Cabecera superior, panel inferior HUD y controles táctiles
    this._drawZeldaHeader(ctx, W);
    this._drawZeldaHUD(ctx, W, H, locInfo, status, player);
    this._drawMapButtons(ctx, W);

    const tooltipDef = defs.find((d) => d.id === (this._selectedRegion || this._hoverRegion));
    if (tooltipDef) this._drawRegionTooltip(ctx, tooltipDef, locInfo, explored, questZone);

    ctx.restore();
  }

  /**
   * Calcula las coordenadas cartográficas exactas del jugador en el mapa real
   * usando `sceneId`, `player.x / player.y` y `tilemap.tileSize`.
   */
  _resolvePlayerLocation(sceneId, player = null, tilemap = null) {
    const meta = SCENE_METADATA[sceneId] || { zone: 'center', title: 'Reino del Gran Ojal', detail: 'Tierras Conocidas' };
    const tm = this._resolveTilemap(tilemap);
    const tileSize = tm?.tileSize || 16;
    const tf = this._getMapTransform();

    const directSlot = ATLAS_SCENE_SLOTS[sceneId];
    if (directSlot) {
      let tileX = directSlot.cols / 2;
      let tileY = directSlot.rows / 2;
      if (player && (Number.isFinite(player.centerX) || Number.isFinite(player.x))) {
        const px = Number.isFinite(player.centerX) ? player.centerX : (player.x + (player.width || 12) / 2);
        const py = Number.isFinite(player.centerY) ? player.centerY : (player.y + (player.height || 14) / 2);
        tileX = px / tileSize;
        tileY = py / tileSize;
      }
      const pos = this._sceneTileToScreen(sceneId, tileX, tileY, tf);
      return { zone: meta.zone, x: pos.x, y: pos.y, title: meta.title, detail: meta.detail };
    }

    // Interiores de Valleverde: ubicar sobre el tejado real de su edificio en `overworld`
    const doorMatch = tm?.houseDoors?.find((d) => d.sceneId === sceneId);
    const houseCol = doorMatch ? doorMatch.doorCol : (meta.houseCol ?? 18);
    const houseRow = doorMatch ? Math.max(0, doorMatch.doorRow - 1) : (meta.houseRow ?? 12);
    const pos = this._sceneTileToScreen('overworld', houseCol + 0.5, houseRow + 0.5, tf);
    return { zone: meta.zone, x: pos.x, y: pos.y, title: meta.title, detail: meta.detail };
  }

  /**
   * Determina qué jefes han sido purgados y qué equipo/núcleos posee el jugador.
   */
  _computeProgressStatus(player, enemies) {
    const isEnemyDead = (id) => {
      if (enemies && enemies.some((e) => e.id === id && e.dead)) return true;
      return false;
    };

    const gcDefeated = Boolean(
      player?.dungeonCores?.gc ||
      player?.hasDash ||
      isEnemyDead('boss_garbage_collector')
    );

    const stackDefeated = Boolean(
      player?.dungeonCores?.stack ||
      player?.hasChargedAttack ||
      isEnemyDead('boss_stack_overflow')
    );

    const microwaveDefeated = Boolean(
      player?.dungeonCores?.microwave ||
      player?.hasBarrier ||
      isEnemyDead('boss_prototype_microwave')
    );

    const alexDefeated = isEnemyDead('boss_final_ai_alex');
    const hasArmor = Boolean(player?.hasArmor);
    const hasSword = Boolean(player?.hasSword);
    const swordLevel = player?.swordLevel || (hasSword ? 1 : 0);
    const armorLevel = player?.armorLevel || (hasArmor ? 1 : 0);
    const coresCount = (gcDefeated ? 1 : 0) + (stackDefeated ? 1 : 0) + (microwaveDefeated ? 1 : 0);
    const placedCount = Math.max(0, Math.min(3, Number(player?.gatesUnlocked) || 0));

    return {
      gcDefeated,
      stackDefeated,
      microwaveDefeated,
      alexDefeated,
      hasArmor,
      hasSword,
      swordLevel,
      armorLevel,
      coresCount,
      placedCount
    };
  }

  /**
   * Marco antiguo de doble ribete dorado + glassmorphism oscuro.
   */
  _drawZeldaFrame(ctx, W, H) {
    ctx.fillStyle = '#03060c';
    ctx.fillRect(0, 0, W, H);
    const glass = ctx.createLinearGradient(0, 0, 0, H);
    glass.addColorStop(0, 'rgba(17, 29, 48, 0.94)');
    glass.addColorStop(1, 'rgba(4, 8, 15, 0.97)');
    ctx.fillStyle = glass;
    ctx.fillRect(2, 2, W - 4, H - 4);
    ctx.strokeStyle = '#e5c07b';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(6.5, 6.5, W - 13, H - 13);
    ctx.fillStyle = '#ffd700';
    for (const [cx, cy] of [[4, 4], [W - 6, 4], [4, H - 6], [W - 6, H - 6]]) {
      ctx.fillRect(cx, cy, 2, 2);
    }
  }

  /**
   * Marcador de posición animado "★ TÚ" del Héroe sobre su coordenada real.
   */
  _drawHeroLocationMarker(ctx, locInfo, t) {
    const px = locInfo.x;
    const py = locInfo.y;
    const pulse = 1 + Math.sin(t * 5) * 0.14;
    const rotation = Math.sin(t * 0.8) * 0.25;
    ctx.save();
    const glow = ctx.createRadialGradient(px, py, 1, px, py, 14 * pulse);
    glow.addColorStop(0, 'rgba(253, 224, 71, 0.58)');
    glow.addColorStop(0.55, 'rgba(253, 224, 71, 0.18)');
    glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - 15, py - 15, 30, 30);
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.72)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(px, py, 6 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.translate(px, py);
    ctx.rotate(rotation);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 4;
      const r = i % 2 === 0 ? 5.6 : 1.9;
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fffbeb';
    ctx.beginPath(); ctx.arc(0, 0, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const labelY = Math.max(23, py - 10.5);
    UILayout.drawText(ctx, '★ TÚ', px, labelY, {
      font: 'bold 4.6px monospace', color: '#ffd700', align: 'center', baseline: 'middle', shadow: true
    });
  }

  /**
   * Encabezado superior del mapa estilo pergamino Zelda.
   */
  _drawZeldaHeader(ctx, W) {
    UILayout.drawShadow(ctx, 6, 4, W - 12, 11, 0.4);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.fillRect(6, 4, W - 12, 11);
    ctx.strokeStyle = '#e5c07b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(6.75, 4.75, W - 13.5, 9.5);
    UILayout.drawIcon(ctx, 'map', 13, 9.5, 8, '#e5c07b');
    UILayout.drawText(ctx, 'MAPA DEL REINO DEL GRAN OJAL · CARTOGRAFÍA SAGRADA', 20, 9.5, {
      font: 'bold 5px monospace', color: '#ffd700', shadow: true
    });
    UILayout.drawText(ctx, '[Esc / M] Cerrar', W - 12, 9.5, {
      font: 'bold 4.5px monospace', color: '#e2e8f0', align: 'right', shadow: true
    });
  }

  /**
   * Barra inferior HUD estilo Zelda (Zona Actual · Progreso · Núcleos).
   */
  _drawZeldaHUD(ctx, W, H, locInfo, status) {
    const barX = 6;
    const barY = H - 24;
    const barW = W - 12;
    const barH = 21;

    ctx.save();
    UILayout.drawShadow(ctx, barX, barY, barW, barH, 0.42);
    const glass = ctx.createLinearGradient(0, barY, 0, barY + barH);
    glass.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
    glass.addColorStop(1, 'rgba(7, 12, 22, 0.96)');
    ctx.fillStyle = glass;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#e5c07b';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX + 1, barY + 1, barW - 2, barH - 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 4.5, barY + 4.5, barW - 9, barH - 9);

    // Columna 1: Zona actual
    UILayout.drawIcon(ctx, 'compass', barX + 12, barY + 8, 8, '#38bdf8');
    UILayout.drawText(ctx, 'ZONA ACTUAL', barX + 21, barY + 5.5, {
      font: 'bold 3.8px monospace', color: '#38bdf8', shadow: true
    });
    const zoneName = locInfo.title.split(' (')[0];
    UILayout.drawText(ctx, UILayout.fitText(ctx, zoneName, 112), barX + 8, barY + 15.5, {
      font: 'bold 4.6px monospace', color: '#f8fafc', shadow: true, maxWidth: 112
    });

    ctx.strokeStyle = 'rgba(229, 192, 123, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(barX + 137, barY + 4); ctx.lineTo(barX + 137, barY + barH - 4); ctx.stroke();

    // Columna 2: Progreso de misiones
    const questLog = this.menuSystem?.worldMapContext?.questLog;
    let done = 0;
    let total = 0;
    if (questLog && typeof questLog.getAllQuests === 'function') {
      const all = questLog.getAllQuests();
      total = all.length;
      done = all.filter((q) => q.status === 'COMPLETED').length;
    }
    if (total === 0) {
      total = 6;
      done = [
        status.hasArmor, status.hasSword, status.gcDefeated,
        status.stackDefeated, status.microwaveDefeated, status.alexDefeated
      ].filter(Boolean).length;
    }
    UILayout.drawIcon(ctx, 'scroll', barX + 147, barY + 8, 8, '#fde047');
    UILayout.drawText(ctx, 'PROGRESO', barX + 156, barY + 5.5, {
      font: 'bold 3.8px monospace', color: '#fde047', shadow: true
    });
    UILayout.drawText(ctx, `${done}/${total} MISIONES`, barX + 143, barY + 15.5, {
      font: 'bold 4.6px monospace', color: '#f8fafc', shadow: true
    });

    ctx.beginPath(); ctx.moveTo(barX + 222, barY + 4); ctx.lineTo(barX + 222, barY + barH - 4); ctx.stroke();

    // Columna 3: Núcleos
    UILayout.drawText(ctx, 'NÚCLEOS', barX + 230, barY + 5.5, {
      font: 'bold 3.8px monospace', color: '#a7f3d0', shadow: true
    });
    this._drawCrystalGem(ctx, barX + 238, barY + 12, status.gcDefeated, '#22c55e', 'GC');
    this._drawCrystalGem(ctx, barX + 258, barY + 12, status.stackDefeated, '#06b6d4', 'STACK');
    this._drawCrystalGem(ctx, barX + 283, barY + 12, status.microwaveDefeated, '#ef4444', 'FORJA');
    UILayout.drawText(ctx, `${status.coresCount}/3`, barX + barW - 6, barY + 15.5, {
      font: 'bold 4.4px monospace', color: '#ffd700', align: 'right', shadow: true
    });

    ctx.restore();
  }

  _drawCrystalGem(ctx, x, y, isCollected, glowColor, label) {
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.strokeStyle = isCollected ? glowColor : '#475569';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x - 2.5, y - 2.5, 5, 5);

    if (isCollected) {
      ctx.fillStyle = glowColor;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }

    ctx.font = 'bold 4px monospace';
    ctx.fillStyle = isCollected ? glowColor : '#64748b';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 5, y);
    ctx.restore();
  }

  _drawMiniSkull(ctx, x, y, accentColor = '#ef4444', t = 0, isCrown = false) {
    const pulse = 0.8 + Math.sin(t * 6) * 0.2;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = accentColor;
    ctx.fillRect(x - 3, y - 3, 7, 6);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - 2, y - 2, 5, 3);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 1, y - 1, 1, 1);
    ctx.fillRect(x + 1, y - 1, 1, 1);

    if (isCrown) {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x - 2, y - 4, 5, 1);
    }
    ctx.restore();
  }

  _drawMiniCheck(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x - 2.5, y - 2.5, 5, 5);

    ctx.fillStyle = '#6ee7b7';
    ctx.fillRect(x - 1, y + 1, 1, 1);
    ctx.fillRect(x, y + 2, 1, 1);
    ctx.fillRect(x + 1, y, 1, 2);
    ctx.restore();
  }

  _drawCompassRose(ctx, cx, cy) {
    const r = 7;
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.58)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - r - 2);
    ctx.lineTo(cx - 2, cy);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - r - 2);
    ctx.lineTo(cx + 2, cy);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + r + 1);
    ctx.lineTo(cx + 2, cy);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r + 1, cy);
    ctx.lineTo(cx, cy + 2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - r - 1, cy);
    ctx.lineTo(cx, cy + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('N', cx, cy - r - 3);
  }
}
