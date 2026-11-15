import { TILES, ATLAS_SCALE } from '../graphics/SpriteSheetGenerator.js?v=8';
import { SpeechBubble } from '../ui/SpeechBubble.js?v=8';
import { buildValleverdeScenes } from './scenes/ValleverdeScenes.js?v=8';
import { buildDungeonScenes, TEMPLE_TILES } from './scenes/DungeonScenes.js?v=8';
import { getEnvironmentTheme } from '../data/EnvironmentData.js';

/**
 * Elementos estéticos y decorativos atravesables por jugador, NPCs y animales:
 * nunca bloquean el paso en `isSolidAtTile()`, independientemente de su capa visual
 * (CAPA 0 suelo, CAPA 1 Y-sorted o CAPA 2 overhead).
 */
const PASSABLE_AESTHETIC_TILES = new Set([
  TILES.FLOWERS_1, TILES.FLOWERS_2, TILES.SIGNPOST,
  TILES.FENCE_H, TILES.FENCE_POST, TILES.CRATE, TILES.BUSH, TILES.TABLE, TILES.ANVIL,
  TILES.LAMPPOST, TILES.WELL,
  TILES.BOOKSHELF, TILES.BED, TILES.FIREPLACE,
  TILES.TREE_TOP, TILES.ROOF_RED, TILES.ROOF_BLUE, TILES.ROOF_GREEN,
  TILES.CHIMNEY, TILES.STALACTITE, TILES.ROCK, TILES.BEAM,
  TILES.BARREL, TILES.FLOWER_POT, TILES.SANDBAG, TILES.WALL_TORCH,
  TILES.CORP_PLANT, TILES.CORP_EXTINGUISHER, TILES.CORP_ALEX_POSTER,
  TILES.INAKITO_PAPERS
]);

/**
 * Tiles de la CAPA 2 (estructuras elevadas) del pipeline 2.5D: se dibujan siempre por encima
 * de las entidades (copas de árboles, tejados y toldos).
 */
const OVERHEAD_TILE_IDS = new Set([
  TILES.TREE_TOP, TILES.ROOF_RED, TILES.ROOF_BLUE, TILES.ROOF_GREEN,
  TILES.CHIMNEY, TILES.STALACTITE, TILES.ROCK, TILES.BEAM,
  TILES.CORP_PLANT, TILES.CORP_EXTINGUISHER, TILES.CORP_ALEX_POSTER,
  TILES.INAKITO_PAPERS
]);

/** Valor de la capa de colisión para abismos: sólidos salvo durante el Dash Asíncrono. */
export const CHASM_COLLISION = 2;

/**
 * Tilemap multicapa con soporte para:
 * - Primer Escenario: Las Ruinas del Despertar ('first_stage' 36x24 tiles) donde el jugador consigue su Armadura y primera Espada
 * - Mundo exterior del pueblo (Overworld 36x24 tiles)
 * - Interiores de las viviendas del pueblo (12x9 tiles)
 * - Apertura/cierre dinámico del puente según horario (07:00 a 20:00)
 */
export class Tilemap {
  constructor(tilesetSheet, tileSize = 16) {
    this.tilesetSheet = tilesetSheet;
    this.tileSize = tileSize;
    this.tilesetCols = 8;

    this.animTimer = 0;
    this.animFrame = 0;
    this.waterClock = 0;
    // (BLOQUE 1) Reloj maestro de animaciones ambientales y de tiles.
    this.animationClock = 0;
    this._propPool = [];
    this.windowLights = [];

    // Estado del puente de Valleverde y del portal del Primer Escenario
    this.bridgeOpen = false;
    this.bridgeForceUnlocked = false;
    this.firstStageGateOpen = false;

    this.currentSceneId = 'overworld';
    this.scenes = {};

    // Estado del Puzle 1: Templo de la Armadura (4 Interruptores y 3 Monolitos Crípticos)
    this.armorPuzzle = {
      switches: { A: 0, B: 0, C: 0, D: 0 },
      solved: false,
      barrierActive: true,
      barrierCol: 10,
      barrierRow: 5,
      switchPositions: {
        SWITCH_A: { col: 4, row: 10, label: 'SWITCH_A', name: 'Terminal A' },
        SWITCH_B: { col: 6, row: 10, label: 'SWITCH_B', name: 'Terminal B' },
        SWITCH_C: { col: 15, row: 10, label: 'SWITCH_C', name: 'Terminal C' },
        SWITCH_D: { col: 17, row: 10, label: 'SWITCH_D', name: 'Terminal D' }
      },
      monoliths: {
        MONOLITH_ALFA: {
          id: 'alfa',
          col: 4,
          row: 6,
          name: 'Monolito de Paridad (Alfa)',
          symbol: '∑₂',
          clue: 'La paridad del núcleo exige equilibrio absoluto: exactamente dos de las cuatro terminales deben permanecer activas en resonancia.'
        },
        MONOLITH_BETA: {
          id: 'beta',
          col: 10,
          row: 7,
          name: 'Monolito de Complemento (Beta)',
          symbol: '¬A',
          clue: 'La compuerta D actúa como la negación pura del origen A (D = ¬A); empero, la terminal A carece de potencial y yace en reposo (A = 0).'
        },
        MONOLITH_GAMMA: {
          id: 'gamma',
          col: 17,
          row: 6,
          name: 'Monolito de Conducción (Gamma)',
          symbol: 'B⚡',
          clue: 'El canal C se mantiene en tierra nula (C = 0), permitiendo que la terminal B conduzca toda la energía restante.'
        }
      }
    };

    // Estado del Puzle 2: Templo de la Espada (Recursión y Caso Base)
    this.swordPuzzle = {
      stack: [], // Pila de llamadas recursivas actual
      correctOrder: [3, 1, 2], // Monolito 3 (N) -> Monolito 1 (0) -> Monolito 2 (Retorno)
      solved: false,
      portalOpen: false,
      portalCols: [11, 12],
      portalRow: 1,
      monoliths: {
        MONOLITH_3: {
          id: 3,
          col: 17,
          row: 8,
          name: 'Runa del Límite Superior (λ_N)',
          symbol: 'λ_N',
          clue: 'Límite Superior N: El marco de llamada inicial se apila en el tope. Primero invoca al límite superior N.'
        },
        MONOLITH_1: {
          id: 1,
          col: 6,
          row: 8,
          name: 'Runa de la Singularidad (λ_0)',
          symbol: 'λ_0',
          clue: 'Singularidad Base 0: Se alcanza el fondo del abismo recursivo. El caso base 0 desciende antes de cualquier retorno.'
        },
        MONOLITH_2: {
          id: 2,
          col: 11,
          row: 10,
          name: 'Runa del Desenredo (λ_ret)',
          symbol: 'λ_ret',
          clue: 'Desenredo Pendiente: Resuelve la computación aplazada, desapila la memoria y libera el portal.'
        }
      }
    };

    // =========================================================================
    // PUZLES DE MAZMORRA (v3.9): cada sala bloquea su puerta norte con una
    // barrera energética y la desbloquea al resolverse el mecanismo.
    // =========================================================================

    // Puzle 3 · Cloacas del Legacy: girar la válvula de presión drena el canal.
    this.sewersPuzzle = {
      solved: false,
      drained: false,
      drainedCells: [],
      barrierActive: true,
      barrierRow: 3,
      barrierCols: [],
      valve: {
        col: 11,
        row: 8,
        name: 'Válvula de Presión',
        turns: 0,
        turnsRequired: 3
      }
    };

    // Puzle 4 · Minas de la Recursión: golpear 3 runas de bit en orden MSB -> LSB.
    this.minesPuzzle = {
      solved: false,
      barrierActive: true,
      barrierRow: 3,
      barrierCols: [],
      stack: [],
      correctOrder: [4, 2, 1],
      monoliths: {
        MONOLITH_4: {
          id: 4,
          weight: 4,
          col: 6,
          row: 8,
          name: 'Runa del Bit Superior (B₂)',
          symbol: 'B₂',
          clue: 'El flujo de memoria se evalúa desde el bit de mayor peso: la runa B₂ (valor 4) abre la pila antes que ninguna otra.'
        },
        MONOLITH_2: {
          id: 2,
          weight: 2,
          col: 11,
          row: 10,
          name: 'Runa del Bit Medio (B₁)',
          symbol: 'B₁',
          clue: 'Tras el bit superior se desplaza el registro intermedio: la runa B₁ (valor 2) solo responde en el segundo ciclo.'
        },
        MONOLITH_1: {
          id: 1,
          weight: 1,
          col: 17,
          row: 8,
          name: 'Runa del Bit Inferior (B₀)',
          symbol: 'B₀',
          clue: 'El bit menos significativo cierra la operación: la runa B₀ (valor 1) se apila en último lugar, justo antes del retorno.'
        }
      }
    };

    // Puzle 5 · La Forja del Prototipo: activar los 2 reguladores térmicos a la vez.
    this.forgePuzzle = {
      solved: false,
      barrierActive: true,
      barrierRow: 3,
      barrierCols: [],
      regulators: { LEFT: 0, RIGHT: 0 },
      positions: {
        LEFT: { side: 'LEFT', col: 6, row: 8, name: 'Regulador Térmico Izquierdo' },
        RIGHT: { side: 'RIGHT', col: 17, row: 8, name: 'Regulador Térmico Derecho' }
      }
    };

    // Estado de Puzles y Progresión de Mazmorras (v3.6+)
    this.quantumGate = { coresPlaced: { gc: false, stack: false, microwave: false } };
    // Solo el Dash Asíncrono lo activa mientras dura el impulso (abismos = colisión CHASM_COLLISION)
    this.allowChasmCrossing = false;
    this.alexCoreUnlocked = false;
    this.inakitoOfficeGateOpen = false;

    this.scenes = {
      ...buildValleverdeScenes(this),
      ...buildDungeonScenes(this)
    };
    for (const [sceneId, rawScene] of Object.entries(this.scenes)) {
      if (this._isTiledScene(rawScene)) {
        this.scenes[sceneId] = this.parseTiledScene(sceneId, rawScene);
      }
    }

    // (FIX 1) Los carteles son decorativos: nunca deben bloquear el paso.
    // Se normaliza después de construir TODAS las escenas para cubrir también
    // las asignaciones directas de `collision[...] = 1`.
    for (const scene of Object.values(this.scenes)) {
      const layers = scene && scene.layers;
      if (!layers || !layers.decoration || !layers.collision) continue;
      for (let r = 0; r < scene.rows; r++) {
        for (let c = 0; c < scene.cols; c++) {
          if (layers.decoration[r][c] === TILES.SIGNPOST) {
            layers.collision[r][c] = 0;
          }
        }
      }
    }

    this._decorateScenes();
    this.expansionLoaded = false;
    this._expansionOverlayRenderer = null;
    this._expansionController = null;
    this.vertederoFloorOrder = ['vertedero_digital', 'sewers_dungeon', 'mines_entry', 'forge_entry', 'forge_puzzle'];
    this.loadScene('overworld');
  }

  _createGrid(cols, rows, defaultValue) {
    return Array.from({ length: rows }, () =>
      new Array(cols).fill(defaultValue)
    );
  }

  _isTiledScene(scene) {
    return Boolean(scene && scene.type === 'map' && Array.isArray(scene.layers));
  }

  /**
   * Convierte una definición en formato JSON de Tiled (`ground`, `walls`, `decor_over`,
   * `lights`, `props`) a las capas y estructuras internas del motor Tilemap.
   */
  parseTiledScene(sceneId, tiledMap) {
    const cols = tiledMap.width || tiledMap.cols || 24;
    const rows = tiledMap.height || tiledMap.rows || 18;
    const firstgid = (tiledMap.tilesets && tiledMap.tilesets[0] && tiledMap.tilesets[0].firstgid) ?? 1;

    const findLayer = (name) => tiledMap.layers.find((l) => l && l.name === name) || null;
    const decodeTileLayer = (layer, defaultVal = -1) => {
      const grid = this._createGrid(cols, rows, defaultVal);
      if (!layer) return grid;
      if (Array.isArray(layer.data)) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const gid = layer.data[r * cols + c] || 0;
            if (gid > 0) grid[r][c] = gid - firstgid;
          }
        }
      }
      return grid;
    };

    const ground = decodeTileLayer(findLayer('ground'), TILES.STONE_FLOOR);
    const walls = decodeTileLayer(findLayer('walls'), -1);
    const decor_over = decodeTileLayer(findLayer('decor_over'), -1);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);

    const nonSolidWallTiles = new Set([
      TILES.PORTAL_GATE_OPEN,
      TILES.EXIT_MAT,
      TILES.ALTAR_PEDESTAL,
      TILES.SIGNPOST,
      TILES.DOOR
    ]);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (ground[r][c] === TEMPLE_TILES.ABYSS_VOID || ground[r][c] === TILES.MINE_CHASM) {
          collision[r][c] = CHASM_COLLISION;
        }
        const wallTile = walls[r][c];
        if (wallTile >= 0) {
          decoration[r][c] = wallTile;
          if (!nonSolidWallTiles.has(wallTile)) {
            collision[r][c] = 1;
          }
        }
      }
    }

    const lightsLayer = findLayer('lights');
    const lights = (lightsLayer && Array.isArray(lightsLayer.objects) ? lightsLayer.objects : (tiledMap.lights || []))
      .map((l) => ({ ...l }));

    const propsLayer = findLayer('props');
    const rawProps = propsLayer && Array.isArray(propsLayer.objects) ? propsLayer.objects : (tiledMap.props || []);
    const props = rawProps.map((p, idx) => {
      const col = p.col !== undefined ? p.col : Math.floor((p.x || 0) / this.tileSize);
      const row = p.row !== undefined ? p.row : Math.floor((p.y || 0) / this.tileSize);
      const prop = {
        id: p.id || `prop_${idx + 1}`,
        kind: p.kind || 'statue',
        col,
        row,
        x: p.x !== undefined ? p.x : col * this.tileSize,
        y: p.y !== undefined ? p.y : row * this.tileSize,
        name: p.name || 'Relieve Antiguo',
        title: p.title || `🏛️ [${p.name || 'RELIQUIA ANTIGUA'}]`,
        lines: Array.isArray(p.lines) ? p.lines : [p.lore || '...'],
        solid: p.solid !== false
      };
      if (prop.solid && row >= 0 && row < rows && col >= 0 && col < cols) {
        collision[row][col] = 1;
      }
      return prop;
    });

    if (sceneId === 'sword_temple' && this.swordPuzzle && this.swordPuzzle.monoliths) {
      for (const mono of Object.values(this.swordPuzzle.monoliths)) {
        if (mono.row >= 0 && mono.row < rows && mono.col >= 0 && mono.col < cols) {
          collision[mono.row][mono.col] = 1;
        }
      }
    }

    return {
      title: tiledMap.title || sceneId,
      cols,
      rows,
      tiledFormat: true,
      tiledMap,
      layers: { ground, walls, decor_over, decoration, collision },
      lights,
      lightSources: lights,
      props,
      torchTriggers: Array.isArray(tiledMap.torchTriggers)
        ? tiledMap.torchTriggers.map((t) => ({
            ...t,
            stepTiles: (t.stepTiles || []).map((st) => ({ ...st })),
            torches: (t.torches || []).map((tr) => ({ ...tr }))
          }))
        : [],
      exitDoor: tiledMap.exitDoor || null
    };
  }

  /** Registra y carga dinámicamente una escena en formato JSON de Tiled. */
  loadTiledScene(sceneId, tiledMap) {
    this.scenes[sceneId] = this.parseTiledScene(sceneId, tiledMap);
    this.decorateScene(sceneId);
    if (this.currentSceneId === sceneId) {
      this.loadScene(sceneId);
    }
    return this.scenes[sceneId];
  }

  /**
   * Cambia entre escenas ('first_stage', 'overworld' o interiores).
   */
  loadScene(sceneId) {
    const scene = this.scenes[sceneId];
    if (!scene) return;
    this.currentSceneId = sceneId;
    this.cols = scene.cols;
    this.rows = scene.rows;
    this.width = scene.cols * this.tileSize;
    this.height = scene.rows * this.tileSize;
    this.layers = scene.layers;
    this.lightSources = scene.lightSources || scene.lights || [];
    this.lights = scene.lights || this.lightSources;
    this.props = scene.props || [];
    this.torchTriggers = scene.torchTriggers || [];
    this.floorDecals = scene.floorDecals || [];
    this.houseShadows = scene.houseShadows || [];
    this.caveProps = scene.caveProps || [];
    this.biomeProps = scene.biomeProps || [];
    this.chimneys = scene.chimneys || [];
    this.clotheslines = scene.clotheslines || [];

    // Luces de ventanas (se encienden al anochecer): se calculan una vez por escena y se cachean
    if (!scene.windowLights) {
      scene.windowLights = this._computeWindowLights(scene);
    }
    this.windowLights = scene.windowLights;
  }

  /** Busca los tiles de ventana de la escena y genera una luz ámbar por cada uno. */
  _computeWindowLights(scene) {
    const lights = [];
    const deco = scene.layers.decoration;
    for (let r = 0; r < scene.rows; r++) {
      for (let c = 0; c < scene.cols; c++) {
        if (deco[r][c] === TILES.WALL_WINDOW || deco[r][c] === TILES.WALL_WINDOW_FLOWER) {
          lights.push({
            x: c * this.tileSize + 8,
            y: r * this.tileSize + 8,
            radius: 28,
            intensity: 0.88,
            glow: 'amber',
            kind: 'window'
          });
        }
      }
    }
    return lights;
  }

  isInterior() {
    return (
      this.currentSceneId !== 'overworld' &&
      this.currentSceneId !== 'first_stage' &&
      this.currentSceneId !== 'north_peaks' &&
      this.currentSceneId !== 'south_swamp' &&
      this.currentSceneId !== 'west_wastes'
    );
  }

  unlockFirstStageGate() {
    this.firstStageGateOpen = true;
    const stage1 = this.scenes.first_stage;
    if (stage1) {
      for (let r = 12; r <= 13; r++) {
        stage1.layers.decoration[r][33] = TILES.PORTAL_GATE_OPEN;
        stage1.layers.collision[r][33] = 0;
      }
    }
  }

  lockFirstStageGate() {
    this.firstStageGateOpen = false;
    const stage1 = this.scenes.first_stage;
    if (stage1) {
      for (let r = 12; r <= 13; r++) {
        stage1.layers.decoration[r][33] = TILES.PORTAL_GATE_CLOSED;
        stage1.layers.collision[r][33] = 1;
      }
    }
  }

  update(dt) {
    this.animationClock += dt;
    this.animTimer += dt;
    this.waterClock += dt;
    if (this.animTimer >= 0.45) {
      this.animTimer -= 0.45;
      this.animFrame = (this.animFrame + 1) % 2;
    }
    this._updateAnimatedLights();

    this._updateBridgeSchedule();
  }

  /** (BLOQUE 2) Pulso suave de las luces de escena (antorchas, cristales, portales). */
  _updateAnimatedLights() {
    if (!this.lightSources) return;
    for (const source of this.lightSources) {
      if (!source) continue;
      if (source._baseIntensity === undefined) {
        source._baseIntensity = source.intensity ?? 0.8;
        source._baseRadius = source.radius ?? 40;
        source._phase = (source.x * 0.013 + source.y * 0.017) % (Math.PI * 2);
      }
      const pulse = 1 + Math.sin(this.animationClock * 3 + source._phase) * 0.06;
      source.intensity = source._baseIntensity * pulse;
      source.radius = source._baseRadius * (1 + Math.sin(this.animationClock * 2.1 + source._phase) * 0.03);
    }
  }

  /**
   * Actualiza si el puente está abierto.
   * El puente permanece clausurado por orden del Sabio Aurelio hasta que se desbloquea
   * con la autorización / Pase del Puente. Una vez desbloqueado, permanece abierto permanentemente.
   */
  _updateBridgeSchedule() {
    const shouldBeOpen = !!this.bridgeForceUnlocked;

    if (this.bridgeOpen !== shouldBeOpen) {
      this.bridgeOpen = shouldBeOpen;
      const overworld = this.scenes.overworld;
      if (overworld) {
        for (let r = 12; r <= 13; r++) {
          overworld.layers.decoration[r][27] = shouldBeOpen ? -1 : TILES.BRIDGE_GATE;
          overworld.layers.collision[r][27] = shouldBeOpen ? 0 : 1;
        }
      }
    }
  }

  unlockBridgePermanently() {
    this.bridgeForceUnlocked = true;
    this.bridgeOpen = true;
    const overworld = this.scenes.overworld;
    if (overworld) {
      for (let r = 12; r <= 13; r++) {
        overworld.layers.decoration[r][27] = -1;
        overworld.layers.collision[r][27] = 0;
      }
    }
  }

  /** Activa o retira la barrera de fuego (columnas 9-11, fila 5) del Templo de la Armadura. */
  setArmorBarrier(active) {
    const temple = this.scenes.armor_temple;
    if (!temple || !temple.layers) return;
    for (let c = 9; c <= 11; c++) {
      temple.layers.collision[5][c] = active ? 1 : 0;
      temple.layers.decoration[5][c] = active ? TILES.FIREPLACE : -1;
      if (temple.layers.walls) temple.layers.walls[5][c] = active ? TILES.FIREPLACE : -1;
    }
  }

  /**
   * (FIX 2.4) Guarda el destino original de la puerta de salida de una escena la primera vez
   * que se carga. Algunas salas (Templo de la Espada) tienen más de una entrada y su salida
   * debe devolver al jugador a la sala desde la que entró.
   */
  _ensureExitDoorDefaults(scene) {
    if (!scene || !scene.exitDoor || scene.exitDoor.defaults) return;
    scene.exitDoor.defaults = {
      returnScene: scene.exitDoor.returnScene,
      returnX: scene.exitDoor.returnX,
      returnY: scene.exitDoor.returnY
    };
  }

  /** Redirige la puerta de salida de una escena hacia la sala desde la que se acaba de entrar. */
  setSceneExitReturn(sceneId, { returnScene, returnX, returnY } = {}) {
    const scene = this.scenes[sceneId];
    if (!scene || !scene.exitDoor) return false;
    this._ensureExitDoorDefaults(scene);
    if (typeof returnScene === 'string') scene.exitDoor.returnScene = returnScene;
    if (Number.isFinite(returnX)) scene.exitDoor.returnX = returnX;
    if (Number.isFinite(returnY)) scene.exitDoor.returnY = returnY;
    return true;
  }

  /** Restaura la puerta de salida de una escena a su destino original de diseño. */
  resetSceneExitReturn(sceneId) {
    const scene = this.scenes[sceneId];
    if (!scene || !scene.exitDoor) return false;
    this._ensureExitDoorDefaults(scene);
    const d = scene.exitDoor.defaults;
    scene.exitDoor.returnScene = d.returnScene;
    scene.exitDoor.returnX = d.returnX;
    scene.exitDoor.returnY = d.returnY;
    return true;
  }

  /** Abre o sella el portal norte (columnas 11-12, fila 1) del Templo de la Espada. */
  setSwordPortal(open) {
    const temple = this.scenes.sword_temple;
    if (!temple || !temple.layers) return;
    for (const c of [11, 12]) {
      temple.layers.collision[1][c] = open ? 0 : 1;
      temple.layers.decoration[1][c] = open ? TILES.PORTAL_GATE_OPEN : TILES.PORTAL_GATE_CLOSED;
      if (temple.layers.walls) {
        temple.layers.walls[1][c] = open ? TILES.PORTAL_GATE_OPEN : TILES.PORTAL_GATE_CLOSED;
      }
    }
  }

  /** Enciende las antorchas asociadas a un disparador de baldosa en templos y añade su luz. */
  igniteTorchTrigger(sceneId, triggerId) {
    const scene = this.scenes[sceneId];
    if (!scene || !Array.isArray(scene.torchTriggers)) return null;
    const trigger = scene.torchTriggers.find((t) => t.id === triggerId);
    if (!trigger) return null;

    let changed = false;
    const lights = scene.lightSources || scene.lights || [];
    for (const torch of trigger.torches || []) {
      const decorOver = scene.layers?.decor_over;
      if (decorOver && decorOver[torch.row]?.[torch.col] !== undefined) {
        if (decorOver[torch.row][torch.col] !== torch.tile) {
          decorOver[torch.row][torch.col] = torch.tile;
          changed = true;
        }
      }
      const lx = (torch.col + 0.5) * this.tileSize;
      const ly = (torch.row + 0.5) * this.tileSize;
      const alreadyLit = lights.some(
        (l) => Math.abs(l.x - lx) < 2 && Math.abs(l.y - ly) < 2
      );
      if (!alreadyLit) {
        lights.push({
          x: lx,
          y: ly,
          radius: torch.radius || 46,
          intensity: torch.intensity || 0.75,
          glow: torch.glow || 'warm',
          color: torch.color || '#fbbf24',
          triggeredBy: triggerId
        });
        changed = true;
      }
    }
    scene.lightSources = lights;
    scene.lights = lights;
    if (this.currentSceneId === sceneId) {
      this.lightSources = lights;
      this.lights = lights;
    }
    return changed ? trigger : null;
  }

  /** Apaga las antorchas activadas dinámicamente en los templos al iniciar una nueva partida. */
  resetTempleTorches() {
    for (const sceneId of ['armor_temple', 'sword_temple']) {
      const scene = this.scenes[sceneId];
      if (!scene || !Array.isArray(scene.torchTriggers)) continue;
      for (const trigger of scene.torchTriggers) {
        for (const torch of trigger.torches || []) {
          if (scene.layers?.decor_over?.[torch.row]?.[torch.col] !== undefined) {
            scene.layers.decor_over[torch.row][torch.col] = TEMPLE_TILES.TORCH_UNLIT;
          }
        }
      }
      const baseLights = (scene.lightSources || scene.lights || []).filter((l) => !l.triggeredBy);
      scene.lightSources = baseLights;
      scene.lights = baseLights;
      if (this.currentSceneId === sceneId) {
        this.lightSources = baseLights;
        this.lights = baseLights;
      }
    }
  }

  /** (FIX 3) Abre/cierra la salida norte de la arena del Stack Overflow. */
  setMinesBossArenaGate(open) {
    const scene = this.scenes.mines_boss_arena;
    if (!scene || !scene.layers) return false;
    for (const c of [5, 6]) {
      scene.layers.collision[0][c] = open ? 0 : 1;
      scene.layers.decoration[0][c] = open ? TILES.PORTAL_GATE_OPEN : TILES.PORTAL_GATE_CLOSED;
    }
    return true;
  }

  /** (EXPANSIÓN v2.0) Abre/sella la salida norte (barrera de cristal) de inakito_office. */
  setInakitoOfficeGate(open) {
    this.inakitoOfficeGateOpen = Boolean(open);
    const scene = this.scenes.inakito_office;
    if (!scene || !scene.layers) return false;
    for (const c of [5, 6]) {
      scene.layers.collision[0][c] = open ? 0 : 1;
      scene.layers.decoration[0][c] = open ? TILES.PORTAL_GATE_OPEN : TILES.CRYSTAL_BARRIER;
      scene.layers.collision[1][c] = 0;
      scene.layers.decoration[1][c] = -1;
    }
    return true;
  }

  // =========================================================================
  // MECÁNICAS: PUZLES DE MAZMORRA (Cloacas · Minas · Forja)
  // =========================================================================

  /** Devuelve el estado del puzle asociado a una sala de mazmorra. */
  _dungeonPuzzleEntry(sceneId) {
    if (sceneId === 'sewers_puzzle') return this.sewersPuzzle;
    if (sceneId === 'mines_puzzle') return this.minesPuzzle;
    if (sceneId === 'forge_puzzle') return this.forgePuzzle;
    return null;
  }

  /**
   * Levanta o retira la barrera energética que sella la puerta norte de la sala.
   * La barrera ocupa una fila completa para que no se pueda rodear por los flancos.
   */
  setDungeonBarrier(sceneId, active) {
    const scene = this.scenes[sceneId];
    const puzzle = this._dungeonPuzzleEntry(sceneId);
    if (!scene || !scene.layers || !puzzle) return false;

    const cols = puzzle.barrierCols && puzzle.barrierCols.length > 0
      ? puzzle.barrierCols
      : Array.from({ length: Math.max(0, scene.cols - 4) }, (_, i) => i + 2);
    puzzle.barrierCols = cols;

    for (const c of cols) {
      scene.layers.collision[puzzle.barrierRow][c] = active ? 1 : 0;
      // (FIX 4) La barrera debe VERSE: cristal de silicio en la capa de decoración
      scene.layers.decoration[puzzle.barrierRow][c] = active ? TILES.CRYSTAL_BARRIER : -1;
    }
    puzzle.barrierActive = Boolean(active);
    return true;
  }

  /**
   * Inunda o drena el canal central de las Cloacas. Inundado es intransitable
   * (solo se cruza por la pasarela de piedra); drenado deja el limo pisable.
   */
  setSewerCanal(flooded) {
    const scene = this.scenes.sewers_puzzle;
    const puzzle = this.sewersPuzzle;
    if (!scene || !scene.layers || !puzzle) return false;
    const { ground, collision } = scene.layers;

    if (flooded) {
      for (const [r, c] of puzzle.drainedCells || []) {
        ground[r][c] = TILES.WATER_1;
        collision[r][c] = 1;
      }
      puzzle.drainedCells = [];
      puzzle.drained = false;
      return true;
    }

    if (puzzle.drained) return true; // ya drenado: no perder la lista de celdas

    puzzle.drainedCells = [];
    for (let r = 0; r < scene.rows; r++) {
      for (let c = 0; c < scene.cols; c++) {
        const tile = ground[r][c];
        if (tile === TILES.WATER_1 || tile === TILES.WATER_2) {
          ground[r][c] = TILES.SEWER_SLIME_FLOOR;
          collision[r][c] = 0;
          puzzle.drainedCells.push([r, c]);
        }
      }
    }
    puzzle.drained = true;
    return true;
  }

  /** Gira la válvula de presión. Al tercer giro drena el canal y abre la barrera. */
  toggleSewersValve() {
    const puzzle = this.sewersPuzzle;
    if (puzzle.solved) return { solved: true, alreadySolved: true };

    puzzle.valve.turns = Math.min(puzzle.valve.turnsRequired, puzzle.valve.turns + 1);
    if (puzzle.valve.turns < puzzle.valve.turnsRequired) {
      return {
        solved: false,
        turns: puzzle.valve.turns,
        turnsRequired: puzzle.valve.turnsRequired
      };
    }

    puzzle.solved = true;
    this.setSewerCanal(false);
    this.setDungeonBarrier('sewers_puzzle', false);
    return {
      solved: true,
      justSolved: true,
      turns: puzzle.valve.turns,
      turnsRequired: puzzle.valve.turnsRequired
    };
  }

  /**
   * Golpea una runa de bit de las Minas. El orden correcto es MSB -> LSB (4 -> 2 -> 1).
   * Un golpe fuera de orden reinicia la pila (desbordamiento de registro).
   */
  hitMinesMonolith(monolithId) {
    const puzzle = this.minesPuzzle;
    if (puzzle.solved) return { success: true, finished: true, alreadySolved: true };

    const expected = puzzle.correctOrder[puzzle.stack.length];
    if (monolithId === expected) {
      puzzle.stack.push(monolithId);
      if (puzzle.stack.length === puzzle.correctOrder.length) {
        puzzle.solved = true;
        this.setDungeonBarrier('mines_puzzle', false);
        return { success: true, finished: true, stack: [...puzzle.stack] };
      }
      return {
        success: true,
        finished: false,
        step: puzzle.stack.length,
        total: puzzle.correctOrder.length,
        stack: [...puzzle.stack]
      };
    }

    puzzle.stack = [];
    return {
      success: false,
      error: 'BIT_MISMATCH',
      damage: 1,
      expected
    };
  }

  /** Conmuta un regulador térmico de la Forja. Con los dos activos se abre la barrera. */
  toggleForgeRegulator(side) {
    const puzzle = this.forgePuzzle;
    if (puzzle.solved) return { solved: true, alreadySolved: true };
    if (side !== 'LEFT' && side !== 'RIGHT') return null;
    if (!puzzle.positions[side]) return null;

    puzzle.regulators[side] = puzzle.regulators[side] === 1 ? 0 : 1;
    const regulators = { ...puzzle.regulators };

    if (regulators.LEFT === 1 && regulators.RIGHT === 1) {
      puzzle.solved = true;
      this.setDungeonBarrier('forge_puzzle', false);
      return { solved: true, justSolved: true, regulators };
    }
    return { solved: false, justSolved: false, regulators };
  }

  /** Restaura los tres puzles a su estado inicial (nueva partida / reinicio de mundo). */
  resetDungeonPuzzles() {
    this.sewersPuzzle.solved = false;
    this.sewersPuzzle.valve.turns = 0;
    this.setSewerCanal(true);
    this.setDungeonBarrier('sewers_puzzle', true);

    this.minesPuzzle.solved = false;
    this.minesPuzzle.stack = [];
    this.setDungeonBarrier('mines_puzzle', true);

    this.forgePuzzle.solved = false;
    this.forgePuzzle.regulators = { LEFT: 0, RIGHT: 0 };
    this.setDungeonBarrier('forge_puzzle', true);
  }

  /** Reaplica desde un guardado el estado de los tres puzles de mazmorra. */
  applyDungeonPuzzleState(state = {}) {
    if (!state || typeof state !== 'object') return;

    if (state.sewers) {
      if (Number.isFinite(state.sewers.valveTurns)) {
        this.sewersPuzzle.valve.turns = Math.max(
          0,
          Math.min(this.sewersPuzzle.valve.turnsRequired, Math.floor(state.sewers.valveTurns))
        );
      }
      if (state.sewers.solved) {
        this.sewersPuzzle.solved = true;
        this.sewersPuzzle.valve.turns = this.sewersPuzzle.valve.turnsRequired;
        this.setSewerCanal(false);
        this.setDungeonBarrier('sewers_puzzle', false);
      }
    }

    if (state.mines) {
      if (Array.isArray(state.mines.stack)) {
        this.minesPuzzle.stack = state.mines.stack
          .filter((id) => this.minesPuzzle.correctOrder.includes(id))
          .slice(0, this.minesPuzzle.correctOrder.length);
      }
      if (state.mines.solved) {
        this.minesPuzzle.solved = true;
        this.minesPuzzle.stack = [...this.minesPuzzle.correctOrder];
        this.setDungeonBarrier('mines_puzzle', false);
      }
    }

    if (state.forge) {
      if (state.forge.regulators) {
        this.forgePuzzle.regulators.LEFT = state.forge.regulators.LEFT ? 1 : 0;
        this.forgePuzzle.regulators.RIGHT = state.forge.regulators.RIGHT ? 1 : 0;
      }
      if (state.forge.solved) {
        this.forgePuzzle.solved = true;
        this.forgePuzzle.regulators = { LEFT: 1, RIGHT: 1 };
        this.setDungeonBarrier('forge_puzzle', false);
      }
    }
  }

  isSolidAtTile(col, row, options = {}) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
      return true;
    }
    // Todos los elementos estéticos/decorativos son atravesables por jugador, NPCs y animales;
    // solo muros, agua, abismos, puertas cerradas y barreras de puzle bloquean el paso.
    if (
      this.layers.decoration &&
      PASSABLE_AESTHETIC_TILES.has(this.layers.decoration[row][col])
    ) {
      return false;
    }
    const value = this.layers.collision[row][col];
    if (value === CHASM_COLLISION) {
      return !this.allowChasmCrossing;
    }
    return value === 1;
  }

  /**
   * Devuelve la puerta de vivienda cercana si el jugador está en el exterior,
   * o la alfombra de salida si está en el interior.
   */
  findNearbyDoor(player) {
    // 1. ZONA ESTE: Valle de la Consagración (Templos del Héroe: Armadura y Espada)
    if (this.currentSceneId === 'first_stage') {
      // Portal Oeste hacia el Pueblo de Valleverde (retorno a la aldea pacífica).
      // El jugador entra al Valle por el Este y aparece al Oeste: la puerta queda detrás.
      const gateX = 0.5 * this.tileSize;
      const gateY = 12.5 * this.tileSize;
      if (Math.hypot(player.centerX - gateX, player.centerY - gateY) <= 26) {
        return {
          type: 'stage_transition',
          targetScene: 'overworld',
          label: 'Regresar a la Aldea de Valleverde (Oeste)',
          worldX: gateX,
          worldY: gateY,
          spawnX: 30 * this.tileSize,
          spawnY: 12.5 * this.tileSize,
          exitDirection: 'west'
        };
      }

      // Puerta del Templo de la Armadura Binaria (Oeste del Valle)
      const armorDoorX = 6.5 * this.tileSize;
      const armorDoorY = 8.5 * this.tileSize;
      if (Math.hypot(player.centerX - armorDoorX, player.centerY - armorDoorY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'armor_temple',
          label: 'Entrar al Templo de la Armadura Binaria',
          worldX: armorDoorX,
          worldY: armorDoorY,
          spawnX: 10.5 * this.tileSize,
          spawnY: 14.5 * this.tileSize,
          spawnMode: 'fixed',
          entryFacing: 'up'
        };
      }

      // Puerta del Templo de la Espada de la Recursividad (Norte del Valle)
      const swordDoorX = 17.5 * this.tileSize;
      const swordDoorY = 2.5 * this.tileSize;
      if (Math.hypot(player.centerX - swordDoorX, player.centerY - swordDoorY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'sword_temple',
          label: 'Entrar al Templo de la Espada de la Recursividad',
          worldX: swordDoorX,
          worldY: swordDoorY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 14.5 * this.tileSize,
          spawnMode: 'fixed',
          entryFacing: 'up'
        };
      }

      return null;
    }

    // 2. ZONA NORTE: Las Cumbres de la Recursión (Picos de Silicio y Minas)
    if (this.currentSceneId === 'north_peaks') {
      // Puerta de las Minas de la Recursión (Norte · Stack Overflow)
      const minesDoorX = 17.5 * this.tileSize;
      const minesDoorY = 3.5 * this.tileSize;
      if (Math.hypot(player.centerX - minesDoorX, player.centerY - minesDoorY) <= 24) {
        return {
          type: 'stage_transition',
          targetScene: 'mines_entry',
          label: 'Entrar a las Minas de la Recursión (Stack Overflow)',
          worldX: minesDoorX,
          worldY: minesDoorY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }

      // Retorno al Sur hacia Valleverde
      const southExitX = 17.5 * this.tileSize;
      const southExitY = 23 * this.tileSize;
      if (Math.hypot(player.centerX - southExitX, player.centerY - southExitY) <= 26) {
        return {
          type: 'stage_transition',
          targetScene: 'overworld',
          label: 'Descender hacia la Aldea de Valleverde (Sur)',
          worldX: southExitX,
          worldY: southExitY,
          spawnX: 17.5 * this.tileSize,
          spawnY: 2 * this.tileSize
        };
      }

      return null;
    }

    // 3. ZONA SUR: Las Marismas del Hardware Legacy (Cloacas y Forja)
    if (this.currentSceneId === 'south_swamp') {
      // Puerta de las Cloacas del Legacy (Suroeste · Garbage Collector)
      const sewersDoorX = 8.5 * this.tileSize;
      const sewersDoorY = 14.5 * this.tileSize;
      if (Math.hypot(player.centerX - sewersDoorX, player.centerY - sewersDoorY) <= 24) {
        return {
          type: 'stage_transition',
          targetScene: 'sewers_entry',
          label: 'Descender a las Cloacas del Legacy (Garbage Collector)',
          worldX: sewersDoorX,
          worldY: sewersDoorY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }

      // Puerta de La Forja del Prototipo (Sureste · Microondas)
      const forgeDoorX = 26.5 * this.tileSize;
      const forgeDoorY = 14.5 * this.tileSize;
      if (Math.hypot(player.centerX - forgeDoorX, player.centerY - forgeDoorY) <= 24) {
        return {
          type: 'stage_transition',
          targetScene: 'forge_entry',
          label: 'Entrar a La Forja del Prototipo (Microondas Prototipo)',
          worldX: forgeDoorX,
          worldY: forgeDoorY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }

      // Retorno al Norte hacia Valleverde
      const northExitX = 17.5 * this.tileSize;
      const northExitY = 1 * this.tileSize;
      if (Math.hypot(player.centerX - northExitX, player.centerY - northExitY) <= 26) {
        return {
          type: 'stage_transition',
          targetScene: 'overworld',
          label: 'Regresar a la Aldea de Valleverde (Norte)',
          worldX: northExitX,
          worldY: northExitY,
          spawnX: 17.5 * this.tileSize,
          spawnY: 21.5 * this.tileSize
        };
      }

      return null;
    }

    // 4. ZONA OESTE: Páramo Corrupto de Mister AI Alex
    if (this.currentSceneId === 'west_wastes') {
      // Gran Puerta del Núcleo Cuántico (Oeste · Acceso a Ciudadela)
      const quantumDoorX = 8.5 * this.tileSize;
      const quantumDoorY = 12.5 * this.tileSize;
      if (Math.hypot(player.centerX - quantumDoorX, player.centerY - quantumDoorY) <= 26) {
        return {
          type: 'stage_transition',
          targetScene: 'quantum_gate',
          label: 'Aproximarse a la Gran Puerta del Núcleo Cuántico',
          worldX: quantumDoorX,
          worldY: quantumDoorY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }

      // Retorno al Este hacia Valleverde
      const eastExitX = 34.5 * this.tileSize;
      const eastExitY = 12.5 * this.tileSize;
      if (Math.hypot(player.centerX - eastExitX, player.centerY - eastExitY) <= 26) {
        return {
          type: 'stage_transition',
          targetScene: 'overworld',
          label: 'Regresar a la Aldea de Valleverde (Este)',
          worldX: eastExitX,
          worldY: eastExitY,
          spawnX: 2 * this.tileSize,
          spawnY: 12.5 * this.tileSize
        };
      }

      return null;
    }

    // ==================== INTERIOR DE MAZMORRAS Y TRANSICIONES ====================
    // 1. Cloacas del Legacy (Mazmorra 1)
    if (this.currentSceneId === 'sewers_entry') {
      const northDoorY = 1.5 * this.tileSize;
      const northDoorX = 11.5 * this.tileSize;
      if (Math.hypot(player.centerX - northDoorX, player.centerY - northDoorY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'sewers_puzzle',
          label: 'Avanzar a la Sala de Válvulas y Drenaje',
          worldX: northDoorX,
          worldY: northDoorY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }
    } else if (this.currentSceneId === 'sewers_puzzle') {
      const northDoorY = 1.5 * this.tileSize;
      const northDoorX = 11.5 * this.tileSize;
      // (FIX 2.3) La puerta norte permanece sellada hasta resolver el mecanismo de la sala
      if (this.sewersPuzzle.solved && Math.hypot(player.centerX - northDoorX, player.centerY - northDoorY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'sewers_dungeon',
          label: 'Descender a la Fosa de la Memoria (Garbage Collector Furioso)',
          worldX: northDoorX,
          worldY: northDoorY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }
    }

    // 2. Minas de la Recursión (Mazmorra 2)
    if (this.currentSceneId === 'mines_entry') {
      const northDoorY = 1.5 * this.tileSize;
      const northDoorX = 11.5 * this.tileSize;
      if (Math.hypot(player.centerX - northDoorX, player.centerY - northDoorY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'mines_puzzle',
          label: 'Avanzar a la Sala de Runas Recursivas',
          worldX: northDoorX,
          worldY: northDoorY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }
    } else if (this.currentSceneId === 'mines_puzzle') {
      const northDoorY = 1.5 * this.tileSize;
      const northDoorX = 11.5 * this.tileSize;
      // (FIX 2.3) La puerta norte permanece sellada hasta resolver el mecanismo de la sala
      if (this.minesPuzzle.solved && Math.hypot(player.centerX - northDoorX, player.centerY - northDoorY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'mines_boss_arena',
          label: 'Cruzar el Portal a la Arena del Stack Overflow',
          worldX: northDoorX,
          worldY: northDoorY,
          spawnX: 5.5 * this.tileSize,
          spawnY: 5 * this.tileSize
        };
      }
    }

    // 3. La Forja del Prototipo (Mazmorra 3)
    if (this.currentSceneId === 'forge_entry') {
      const northDoorY = 1.5 * this.tileSize;
      const northDoorX = 11.5 * this.tileSize;
      if (Math.hypot(player.centerX - northDoorX, player.centerY - northDoorY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'forge_puzzle',
          label: 'Avanzar a la Sala de Válvulas Térmicas',
          worldX: northDoorX,
          worldY: northDoorY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }
    } else if (this.currentSceneId === 'forge_puzzle') {
      const northDoorY = 1.5 * this.tileSize;
      const northDoorX = 11.5 * this.tileSize;
      // (FIX 2.3) La puerta norte permanece sellada hasta resolver el mecanismo de la sala
      if (this.forgePuzzle.solved && Math.hypot(player.centerX - northDoorX, player.centerY - northDoorY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'ai_fortress_gate',
          label: 'Franquear la Cámara del Microondas Prototipo V0.1 Alpha',
          worldX: northDoorX,
          worldY: northDoorY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }
    }

    // 4. La Gran Puerta del Núcleo Cuántico (Antesala a la Ciudadela)
    if (this.currentSceneId === 'quantum_gate') {
      const portalX = 11.5 * this.tileSize;
      const portalY = 1.5 * this.tileSize;
      if (Math.hypot(player.centerX - portalX, player.centerY - portalY) <= 24) {
        return {
          type: 'stage_transition',
          targetScene: 'ai_citadel',
          label: 'Trascender hacia la Ciudadela Cuántica (Mainframe de AI Alex)',
          worldX: portalX,
          worldY: portalY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }
    }

    // (FIX 3) Salida norte de la arena: solo con el Núcleo del Stack
    if (this.currentSceneId === 'mines_boss_arena') {
      const gateX = 5.5 * this.tileSize;
      const gateY = 1.5 * this.tileSize;
      if (
        player?.dungeonCores?.stack &&
        Math.hypot(player.centerX - gateX, player.centerY - gateY) <= 24
      ) {
        return {
          type: 'stage_transition',
          targetScene: 'first_stage',
          label: 'Salir de la Arena hacia el Valle de la Consagración',
          worldX: gateX,
          worldY: gateY,
          spawnX: 17.5 * this.tileSize,
          spawnY: 4.5 * this.tileSize
        };
      }
    }

    if (
      this.currentSceneId === 'armor_temple' ||
      this.currentSceneId === 'sword_temple' ||
      this.currentSceneId === 'condemned_realms' ||
      this.currentSceneId === 'sewers_entry' ||
      this.currentSceneId === 'sewers_puzzle' ||
      this.currentSceneId === 'sewers_dungeon' ||
      this.currentSceneId === 'mines_entry' ||
      this.currentSceneId === 'mines_puzzle' ||
      this.currentSceneId === 'mines_boss_arena' ||
      this.currentSceneId === 'forge_entry' ||
      this.currentSceneId === 'forge_puzzle' ||
      this.currentSceneId === 'ai_fortress_gate' ||
      this.currentSceneId === 'quantum_gate' ||
      this.currentSceneId === 'ai_citadel'
    ) {
      const scene = this.scenes[this.currentSceneId];
      if (scene && scene.exitDoor) {
        const dist = Math.hypot(
          player.centerX - scene.exitDoor.worldX,
          player.centerY - scene.exitDoor.worldY
        );
        if (dist <= 24) {
          const exitLabel =
            this.currentSceneId === 'condemned_realms'
              ? 'Regresar a través de la Brecha Abisal'
              : this.currentSceneId === 'sewers_entry'
                ? 'Salir a las Marismas del Hardware Legacy'
                : this.currentSceneId === 'mines_entry'
                  ? 'Salir a las Cumbres de la Recursión'
                  : this.currentSceneId === 'mines_boss_arena'
                    ? 'Salir a la Sala de Runas Recursivas'
                    : this.currentSceneId === 'forge_entry'
                    ? 'Salir a las Marismas del Hardware Legacy'
                    : this.currentSceneId === 'quantum_gate'
                      ? 'Salir al Páramo de Mister AI Alex'
                      : this.currentSceneId === 'ai_citadel'
                        ? 'Regresar a la Puerta del Núcleo'
                        : 'Retroceder a la cámara anterior';
          return {
            type: 'exit',
            targetScene: scene.exitDoor.returnScene || 'first_stage',
            label: exitLabel,
            worldX: scene.exitDoor.worldX,
            worldY: scene.exitDoor.worldY,
            spawnX: scene.exitDoor.returnX,
            spawnY: scene.exitDoor.returnY,
            spawnMode: 'fixed',
            entryFacing: 'down'
          };
        }
      }
      return null;
    }

    if (this.currentSceneId === 'overworld') {
      // 1. Camino Este (Puente sobre el Río Alba -> Valle de la Consagración)
      const bridgeGateX = 33 * this.tileSize;
      const bridgeGateY = 12.5 * this.tileSize;
      if (Math.hypot(player.centerX - bridgeGateX, player.centerY - bridgeGateY) <= 32) {
        return {
          type: 'stage_transition',
          targetScene: 'first_stage',
          label: 'Cruzar el Puente al Valle de la Consagración (Este)',
          worldX: bridgeGateX,
          worldY: bridgeGateY,
          spawnX: 31 * this.tileSize,
          spawnY: 12.5 * this.tileSize,
          exitDirection: 'east'
        };
      }

      // 2. Camino Oeste (Frontera Oeste -> Páramo Corrupto de Mister AI Alex)
      const westX = 0.5 * this.tileSize;
      const westY = 12.5 * this.tileSize;
      if (Math.hypot(player.centerX - westX, player.centerY - westY) <= 26) {
        return {
          type: 'stage_transition',
          targetScene: 'west_wastes',
          label: 'Adentrarse en el Páramo Corrupto de Mister AI Alex (Oeste)',
          worldX: westX,
          worldY: westY,
          spawnX: 31 * this.tileSize,
          spawnY: 12.5 * this.tileSize
        };
      }

      // 3. Camino Norte (Cruce Norte -> Cumbres de la Recursión)
      const northX = 17.5 * this.tileSize;
      const northY = 0.5 * this.tileSize;
      if (Math.hypot(player.centerX - northX, player.centerY - northY) <= 26) {
        return {
          type: 'stage_transition',
          targetScene: 'north_peaks',
          label: 'Ascender a las Cumbres de la Recursión (Norte)',
          worldX: northX,
          worldY: northY,
          spawnX: 17.5 * this.tileSize,
          spawnY: 19.5 * this.tileSize
        };
      }

      // 4. Camino Sur (Jardín Sur -> Marismas del Hardware Legacy)
      const southX = 17.5 * this.tileSize;
      const southY = 23 * this.tileSize;
      if (Math.hypot(player.centerX - southX, player.centerY - southY) <= 26) {
        return {
          type: 'stage_transition',
          targetScene: 'south_swamp',
          label: 'Descender a las Marismas del Hardware Legacy (Sur)',
          worldX: southX,
          worldY: southY,
          spawnX: 17.5 * this.tileSize,
          spawnY: 2 * this.tileSize
        };
      }

      for (const door of this.houseDoors) {
        const dist = Math.hypot(player.centerX - door.worldX, player.centerY - door.worldY);
        if (dist <= 20) {
          return {
            type: 'enter',
            targetScene: door.sceneId,
            label: `Entrar: ${door.label}`,
            spawnX: door.interiorSpawnX,
            spawnY: door.interiorSpawnY
          };
        }
      }
    } else if (this.currentSceneId === 'valleverde_corp') {
      // 1. Puerta al Núcleo de Alex (Norte centro — desbloqueada tras derrotar a El Kernel)
      const coreX = 11.5 * this.tileSize;
      const coreY = 2.0 * this.tileSize;
      if (Math.hypot(player.centerX - coreX, player.centerY - coreY) <= 24) {
        return {
          type: 'stage_transition',
          targetScene: 'ai_nucleus_core',
          label: this.alexCoreUnlocked
            ? 'Acceder al Núcleo de Mister Alex IA'
            : 'Núcleo de Alex IA (Bloqueado)',
          worldX: coreX,
          worldY: coreY,
          spawnX: 6.5 * this.tileSize,
          spawnY: 9.8 * this.tileSize,
          spawnMode: 'fixed',
          entryFacing: 'up',
          blocked: !this.alexCoreUnlocked || !this.scenes.ai_nucleus_core,
          blockTitle: 'Núcleo de Alex IA · Sellado',
          blockLines: [
            'Acceso denegado. Nivel de autorización insuficiente.',
            'El Núcleo de Mister Alex IA permanece sellado hasta completar los protocolos de Valleverde 2.0.'
          ]
        };
      }

      // 2. Acceso al Vertedero Digital (Ascensor en la esquina sureste)
      const elevX = 20.5 * this.tileSize;
      const elevY = 15.5 * this.tileSize;
      if (Math.hypot(player.centerX - elevX, player.centerY - elevY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'vertedero_digital',
          label: 'Bajar al Vertedero Digital (Ascensor)',
          worldX: elevX,
          worldY: elevY,
          blocked: !this.scenes.vertedero_digital,
          blockTitle: 'Ascensor al Vertedero Digital',
          blockLines: [
            'Descenso al Vertedero Digital en mantenimiento corporativo.',
            'Habla con Tony Randazzo y Tío Manoplo para preparar la bajada.'
          ]
        };
      }

      // 3. Entrada a la oficina de Tony Randazzo (Noroeste)
      const tonyDoorX = 4.5 * this.tileSize;
      const tonyDoorY = 4.5 * this.tileSize;
      if (Math.hypot(player.centerX - tonyDoorX, player.centerY - tonyDoorY) <= 22) {
        return {
          type: 'enter',
          targetScene: 'oficina_tony',
          label: 'Oficina de Tony Randazzo',
          worldX: tonyDoorX,
          worldY: tonyDoorY,
          blocked: !this.scenes.oficina_tony,
          blockTitle: 'Despacho de Tony Randazzo',
          blockLines: [
            'Despacho privado de Tony Randazzo (Fixer).',
            'Tony atiende fuera de la puerta para evitar los micrófonos corporativos de Alex.'
          ]
        };
      }

      // 3b. Entrada a la arena de Iñakito 2.0 (Oficina del Becario)
      const inakitoDoorX = 9.5 * this.tileSize;
      const inakitoDoorY = 2.0 * this.tileSize;
      if (Math.hypot(player.centerX - inakitoDoorX, player.centerY - inakitoDoorY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'inakito_office',
          label: 'Cubículo de Iñakito 2.0 (Jefe)',
          worldX: inakitoDoorX,
          worldY: inakitoDoorY,
          spawnX: 5.5 * this.tileSize,
          spawnY: 8 * this.tileSize,
          spawnMode: 'fixed',
          entryFacing: 'up'
        };
      }

      // 3c. Entrada al Bar Corporativo de Rosa (Tienda de Currículums)
      const rosaDoorX = 19.5 * this.tileSize;
      const rosaDoorY = 2.0 * this.tileSize;
      if (Math.hypot(player.centerX - rosaDoorX, player.centerY - rosaDoorY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'rosa_bar',
          label: 'Bar de Rosa (Mejoras · Currículums)',
          worldX: rosaDoorX,
          worldY: rosaDoorY,
          spawnX: 4.5 * this.tileSize,
          spawnY: 6.2 * this.tileSize,
          spawnMode: 'fixed',
          entryFacing: 'up'
        };
      }

      // 4. Salida Sur de regreso a Valleverde Clásico
      const exitX = 11.5 * this.tileSize;
      const exitY = 16.5 * this.tileSize;
      if (Math.hypot(player.centerX - exitX, player.centerY - exitY) <= 22) {
        return {
          type: 'exit',
          targetScene: 'overworld',
          label: 'Volver a Valleverde',
          worldX: exitX,
          worldY: exitY,
          spawnX: 17.5 * this.tileSize,
          spawnY: 12.5 * this.tileSize,
          spawnMode: 'fixed',
          entryFacing: 'down'
        };
      }
    } else if (this.currentSceneId === 'inakito_office') {
      // Puerta SUR: regreso a Valleverde 2.0
      const southX = 5.5 * this.tileSize;
      const southY = 9.0 * this.tileSize;
      if (Math.hypot(player.centerX - southX, player.centerY - southY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'valleverde_corp',
          label: 'Salir a Valleverde 2.0',
          worldX: southX,
          worldY: southY,
          spawnX: 9.5 * this.tileSize,
          spawnY: 2.5 * this.tileSize,
          spawnMode: 'fixed',
          entryFacing: 'down'
        };
      }

      // Puerta NORTE: barrera de cristal / cinta de peligro (desbloqueada al derrotar a Iñakito 2.0)
      const northX = 5.5 * this.tileSize;
      const northY = 1.0 * this.tileSize;
      if (Math.hypot(player.centerX - northX, player.centerY - northY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'valleverde_corp',
          label: this.inakitoOfficeGateOpen
            ? 'Salida Norte (Seguridad Desactivada)'
            : 'Salida Norte (Precintada)',
          worldX: northX,
          worldY: northY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 3.0 * this.tileSize,
          spawnMode: 'fixed',
          entryFacing: 'down',
          blocked: !this.inakitoOfficeGateOpen,
          blockTitle: 'Barrera de Cristal · Cinta de Peligro',
          blockLines: [
            'La salida norte está sellada por una barrera de cristal y cinta de peligro.',
            'Derrota a Iñakito 2.0 (El Becario Eterno) para desbloquear la salida.'
          ]
        };
      }
    } else if (this.currentSceneId && this.currentSceneId.startsWith('vertedero_')) {
      const scene = this.scenes[this.currentSceneId];
      const rows = scene?.rows || 18;
      // Puerta SUR: salida de emergencia a Valleverde 2.0 en cualquier momento (para ir a la tienda de Rosa)
      const southX = 11.5 * this.tileSize;
      const southY = (rows - 1) * this.tileSize;
      if (Math.hypot(player.centerX - southX, player.centerY - southY) <= 24) {
        return {
          type: 'exit',
          targetScene: 'valleverde_corp',
          label: 'Salir del Vertedero (Ascensor a Valleverde 2.0)',
          worldX: southX,
          worldY: southY,
          spawnX: 20.5 * this.tileSize,
          spawnY: 14.2 * this.tileSize,
          spawnMode: 'fixed',
          entryFacing: 'down'
        };
      }

      // Puerta NORTE: avanza al siguiente piso (1→2→3→4→5) o a `kernel_arena` en el piso 5
      const northX = 11.5 * this.tileSize;
      const northY = 1.2 * this.tileSize;
      if (Math.hypot(player.centerX - northX, player.centerY - northY) <= 24) {
        const floorNum = scene?.floorNumber || (this.currentSceneId === 'vertedero_digital' ? 1 : 1);
        const isLastFloor = floorNum >= 5;
        return {
          type: 'stage_transition',
          targetScene: isLastFloor ? 'kernel_arena' : `vertedero_piso_${floorNum + 1}`,
          label: isLastFloor
            ? 'Acceder a la Arena del Kernel'
            : `Subir al Piso ${floorNum + 1}/5 del Vertedero`,
          worldX: northX,
          worldY: northY,
          spawnX: (isLastFloor ? 5.5 : 11.5) * this.tileSize,
          spawnY: (isLastFloor ? 8.2 : 15.2) * this.tileSize,
          spawnMode: 'fixed',
          entryFacing: 'up'
        };
      }
    } else if (this.currentSceneId === 'kernel_arena') {
      const northX = 5.5 * this.tileSize;
      const northY = 1.1 * this.tileSize;
      if (Math.hypot(player.centerX - northX, player.centerY - northY) <= 22) {
        const hasCoreScene = Boolean(this.scenes.ai_nucleus_core);
        return {
          type: 'stage_transition',
          targetScene: hasCoreScene ? 'ai_nucleus_core' : 'valleverde_corp',
          label: this.alexCoreUnlocked
            ? 'Acceder al Núcleo de Mister Alex IA'
            : 'Portal al Núcleo (Bloqueado)',
          worldX: northX,
          worldY: northY,
          spawnX: hasCoreScene ? 6.5 * this.tileSize : 11.5 * this.tileSize,
          spawnY: (hasCoreScene ? 9.8 : 2.8) * this.tileSize,
          spawnMode: 'fixed',
          entryFacing: hasCoreScene ? 'up' : 'down',
          blocked: !this.alexCoreUnlocked,
          blockTitle: 'Protocolo Kernel Activo',
          blockLines: [
            'El acceso al Núcleo de Alex requiere la Llave de Acceso al Núcleo.',
            'Derrota a El Kernel para desbloquear el paso.'
          ]
        };
      }

      const southX = 5.5 * this.tileSize;
      const southY = 9.0 * this.tileSize;
      if (Math.hypot(player.centerX - southX, player.centerY - southY) <= 22) {
        return {
          type: 'exit',
          targetScene: 'valleverde_corp',
          label: 'Regresar a Valleverde 2.0',
          worldX: southX,
          worldY: southY,
          spawnX: 20.5 * this.tileSize,
          spawnY: 14.2 * this.tileSize,
          spawnMode: 'fixed',
          entryFacing: 'down'
        };
      }
    } else if (this.currentSceneId === 'rosa_bar') {
      const southX = 4.5 * this.tileSize;
      const southY = 7.0 * this.tileSize;
      if (Math.hypot(player.centerX - southX, player.centerY - southY) <= 22) {
        return {
          type: 'exit',
          targetScene: 'valleverde_corp',
          label: 'Salir a Valleverde 2.0',
          worldX: southX,
          worldY: southY,
          spawnX: 19.5 * this.tileSize,
          spawnY: 2.6 * this.tileSize,
          spawnMode: 'fixed',
          entryFacing: 'down'
        };
      }
    } else if (this.currentSceneId === 'ai_nucleus_core') {
      const southX = 6.5 * this.tileSize;
      const southY = 10.7 * this.tileSize;
      if (Math.hypot(player.centerX - southX, player.centerY - southY) <= 22) {
        return {
          type: 'exit',
          targetScene: 'valleverde_corp',
          label: 'Salir del Núcleo de Alex IA',
          worldX: southX,
          worldY: southY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 2.8 * this.tileSize,
          spawnMode: 'fixed',
          entryFacing: 'down'
        };
      }
    } else {
      const scene = this.scenes[this.currentSceneId];
      if (scene && scene.exitDoor) {
        const dist = Math.hypot(
          player.centerX - scene.exitDoor.worldX,
          player.centerY - scene.exitDoor.worldY
        );
        if (dist <= 18) {
          return {
            type: 'exit',
            targetScene: 'overworld',
            label: 'Salir al Pueblo',
            spawnX: scene.exitDoor.returnX,
            spawnY: scene.exitDoor.returnY,
            spawnMode: 'fixed',
            entryFacing: 'down'
          };
        }
      }
    }
    return null;
  }

  /**
   * Permite descansar en una cama del interior para avanzar entre día y noche de forma natural.
   */
  findNearbyBed(player) {
    if (
      this.currentSceneId === 'overworld' ||
      this.currentSceneId === 'first_stage' ||
      this.currentSceneId === 'jail_cell'
    ) {
      return null;
    }
    const { decoration } = this.layers;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (decoration[r][c] === TILES.BED) {
          const worldX = c * this.tileSize + 8;
          const worldY = (r + 1) * this.tileSize;
          const dist = Math.hypot(player.centerX - worldX, player.centerY - worldY);
          if (dist <= 22) {
            return { worldX, worldY };
          }
        }
      }
    }
    return null;
  }

  /**
   * Detecta si el jugador está junto a un letrero indicador de caminos para leerlo.
   */
  findNearbySignpost(player) {
    const scene = this.scenes[this.currentSceneId];
    if (!scene || !scene.signposts) return null;

    for (const sign of scene.signposts) {
      const sx = sign.c * this.tileSize + 8;
      const sy = sign.r * this.tileSize + 8;
      if (Math.hypot(player.centerX - sx, player.centerY - sy) <= 24) {
        return {
          kind: 'signpost',
          target: sign,
          label: `[E] Leer: ${sign.shortName || 'Letrero'}`
        };
      }
    }
    return null;
  }

  /** Detecta props interactivos (estatuas, relieves de lore) cercanos al jugador. */
  findNearbyProp(player) {
    const scene = this.scenes[this.currentSceneId];
    const props = scene && scene.props;
    if (!props || !props.length) return null;

    let closest = null;
    let bestDist = Infinity;
    for (const prop of props) {
      const px = prop.col * this.tileSize + 8;
      const py = prop.row * this.tileSize + 8;
      const dist = Math.hypot(player.centerX - px, player.centerY - py);
      if (dist <= 26 && dist < bestDist) {
        bestDist = dist;
        closest = prop;
      }
    }
    if (!closest) return null;
    return {
      kind: 'temple_prop',
      target: {
        ...closest,
        centerX: closest.col * this.tileSize + 8,
        y: closest.row * this.tileSize + 8
      },
      label: `[E] Examinar: ${closest.name}`
    };
  }


  /** Carga dinámica y perezosa de las escenas v2.0 desde scenes/ExpansionScenes.js. */
  async loadExpansionScenes(order = null) {
    const mod = await import('./scenes/ExpansionScenes.js?v=8');
    return this.injectExpansionScenes(mod, order);
  }

  injectExpansionScenes(expansionMod, order = null) {
    if (!expansionMod || typeof expansionMod.installExpansionScenes !== 'function') {
      return this;
    }
    return expansionMod.installExpansionScenes(this, order || this.vertederoFloorOrder);
  }

  /** Desbloquea el acceso al Núcleo de Mister Alex IA tras derrotar a El Kernel (delegado si la expansión está cargada). */
  setAlexCoreUnlocked(unlocked) {
    this.alexCoreUnlocked = Boolean(unlocked);
    if (this._expansionController?.setAlexCoreUnlocked) {
      this._expansionController.setAlexCoreUnlocked(this, this.alexCoreUnlocked);
    }
  }

  /** Configura los 5 pisos modulares del Vertedero Digital 2.0 (delegado cuando la expansión está cargada). */
  configureVertederoFloors(order = null) {
    const fallbackOrder = ['vertedero_digital', 'sewers_dungeon', 'mines_entry', 'forge_entry', 'forge_puzzle'];
    const ids = Array.isArray(order) && order.length >= 5 ? order.slice(0, 5) : fallbackOrder;
    this.vertederoFloorOrder = [...ids];
    if (this._expansionController?.configureVertederoFloors) {
      this._expansionController.configureVertederoFloors(this, this.vertederoFloorOrder);
    }
  }

  /** Rango de tiles visibles (con 1 tile de margen para las copas/tejados que sobresalen). */
  _visibleTileRange(camera) {
    const camX = camera.renderX;
    const camY = camera.renderY;
    return {
      startCol: Math.max(0, Math.floor(camX / this.tileSize)),
      endCol: Math.min(this.cols - 1, Math.ceil((camX + camera.viewportWidth) / this.tileSize)),
      startRow: Math.max(0, Math.floor(camY / this.tileSize)),
      endRow: Math.min(this.rows - 1, Math.ceil((camY + camera.viewportHeight) / this.tileSize))
    };
  }

  /**
   * CAPA 0 · Suelo: hierba, caminos, baldosas, alfombras y agua con ondulación sinusoidal sutil
   * (Río Alba). Solo se dibujan aquí las decoraciones planas (flores, alfombras, felpudos...).
   * Los obstáculos sólidos van a la capa 1 (Y-sorted) y las copas/tejados a la capa 2.
   */
  renderGround(ctx, camera, sun = null, options = {}) {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const { startCol, endCol, startRow, endRow } = this._visibleTileRange(camera);
    const { ground, decoration, collision } = this.layers;

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        // (FIX 1) Tiles en coordenadas enteras: sin costuras de 1 px entre celdas.
        const screenX = Math.round(c * this.tileSize - camX);
        const screenY = Math.round(r * this.tileSize - camY);

        let groundTile = ground[r][c];
        const isWater = groundTile === TILES.WATER_1 || groundTile === TILES.WATER_2;
        // (BLOQUE 1) Agua a 4 fases; alterna las dos texturas sin cortes.
        const waterFrame = Math.floor(this.animationClock * 4) % 4;
        if (groundTile === TILES.WATER_1 && waterFrame % 2 === 1) {
          groundTile = TILES.WATER_2;
        }
        if (isWater) {
          // (FIX 5) Offset de textura del agua, tapando el hueco con el tono base.
          const flowX = Math.round(Math.sin(this.animationClock * 1.8 + c * 0.6 + r * 0.3));
          const flowY = Math.round(Math.cos(this.animationClock * 1.2 + c * 0.2 + r * 0.5));
          ctx.fillStyle = '#286494';
          ctx.fillRect(screenX, screenY, this.tileSize, this.tileSize);
          this._drawTile(ctx, groundTile, screenX, screenY, flowX, flowY);
          this._drawWaterRipple(ctx, screenX, screenY, c, r, waterFrame);
        } else {
          this._drawTile(ctx, groundTile, screenX, screenY);
        }
        this._drawAnimatedTileFx(ctx, groundTile, screenX, screenY);

        let decoTile = decoration[r][c];
        if (decoTile === -1 || decoTile === undefined || decoTile === null) continue;
        if (OVERHEAD_TILE_IDS.has(decoTile) || collision[r][c] === 1) continue;

        if (decoTile === TILES.FLOWERS_1 && this.animFrame === 1) {
          decoTile = TILES.FLOWERS_2;
        }
        this._drawTile(ctx, decoTile, screenX, screenY);
        this._drawAnimatedTileFx(ctx, decoTile, screenX, screenY);
      }
    }

    // (BLOQUES 2/3/4) Capa 0: decals estáticos y sombras de edificios, antes de entidades.
    this._drawFloorDecals(ctx, camera);
    if (!options.skipHouseShadows) {
      this._drawHouseShadows(ctx, camera, sun);
    }
    if (this._expansionOverlayRenderer) {
      this._expansionOverlayRenderer(this, ctx, camera);
    }

    // Elementos de suelo de los minijuegos (interruptores, barrera de fuego, indicador de pila, portal)
    if (this.currentSceneId === 'armor_temple') {
      this.renderArmorPuzzle(ctx, camera, false);
    } else if (this.currentSceneId === 'sword_temple') {
      this.renderSwordPuzzle(ctx, camera, false);
    } else if (this.currentSceneId === 'sewers_puzzle') {
      this.renderDungeonPuzzle(ctx, camera, 'sewers');
    } else if (this.currentSceneId === 'mines_puzzle') {
      this.renderDungeonPuzzle(ctx, camera, 'mines');
    } else if (this.currentSceneId === 'forge_puzzle') {
      this.renderDungeonPuzzle(ctx, camera, 'forge');
    }
  }

  /**
   * (FIX 2.3) Dibuja la barrera energética que sella la puerta norte y el indicador
   * de estado del mecanismo de cada sala de mazmorra.
   */
  renderDungeonPuzzle(ctx, camera, kind) {
    const cfg = kind === 'sewers'
      ? { puzzle: this.sewersPuzzle, color: '#34d399', glow: 'rgba(52, 211, 153, 0.22)' }
      : kind === 'mines'
        ? { puzzle: this.minesPuzzle, color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.22)' }
        : { puzzle: this.forgePuzzle, color: '#f97316', glow: 'rgba(249, 115, 22, 0.22)' };
    const puzzle = cfg.puzzle;
    if (!puzzle) return;

    const camX = camera.renderX;
    const camY = camera.renderY;
    const t = performance.now() * 0.003;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 1. Barrera energética
    if (puzzle.barrierActive) {
      const by = Math.round(puzzle.barrierRow * this.tileSize - camY);
      for (const c of puzzle.barrierCols) {
        const bx = Math.round(c * this.tileSize - camX);
        const pulse = 0.45 + 0.55 * Math.abs(Math.sin(t * 2.2 + c * 0.55));
        ctx.globalAlpha = 0.3 + 0.35 * pulse;
        ctx.fillStyle = cfg.glow;
        ctx.fillRect(bx, by, 16, 16);
        ctx.globalAlpha = 0.55 + 0.45 * pulse;
        ctx.fillStyle = cfg.color;
        ctx.fillRect(bx, by + 6, 16, 2);
        ctx.fillRect(bx + 6, by + 2, 2, 12);
      }
      ctx.globalAlpha = 1;
    }

    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 2. Indicador del mecanismo
    if (kind === 'sewers') {
      const v = this.sewersPuzzle.valve;
      const vx = Math.round(v.col * this.tileSize - camX) + 16;
      const vy = Math.round(v.row * this.tileSize - camY) - 4;
      ctx.fillStyle = this.sewersPuzzle.solved ? '#34d399' : '#fde047';
      ctx.fillText(
        this.sewersPuzzle.solved ? 'DRENADO' : `${v.turns}/${v.turnsRequired}`,
        vx,
        vy
      );
    } else if (kind === 'mines') {
      for (const mono of Object.values(this.minesPuzzle.monoliths)) {
        const mx = Math.round(mono.col * this.tileSize - camX) + 8;
        const my = Math.round(mono.row * this.tileSize - camY) - 8;
        const struck = this.minesPuzzle.stack.includes(mono.id);
        ctx.fillStyle = struck ? '#4ade80' : '#94a3b8';
        ctx.fillText(struck ? '●' : '○', mx, my);
      }
    } else if (kind === 'forge') {
      for (const reg of Object.values(this.forgePuzzle.positions)) {
        const rx = Math.round(reg.col * this.tileSize - camX) + 8;
        const ry = Math.round(reg.row * this.tileSize - camY) - 6;
        const on = this.forgePuzzle.regulators[reg.side] === 1;
        ctx.fillStyle = on ? '#4ade80' : '#fca5a5';
        ctx.fillText(`P${on ? 1 : 0}`, rx, ry);
      }
    }

    ctx.restore();
  }


  /** (BLOQUE 2) Halos aditivos que se suman al pase de iluminación dinámica. */
  _drawLightHalo(ctx, cx, cy, radius, rgb, alpha) {
    if (radius <= 0 || alpha <= 0) return;
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, radius);
    g.addColorStop(0, `rgba(${rgb}, ${alpha.toFixed(3)})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  /**
   * (BLOQUE 1/2) FX procedurales por tile: lava pulsante, llamas de antorcha,
   * cristales de mina y anillos de portal.
   */
  _drawAnimatedTileFx(ctx, tileId, screenX, screenY) {
    if (tileId === undefined || tileId === null || tileId < 0) return;
    const t = this.animationClock;
    // (FIX 1) Redondear evita costuras antialias entre overlays de tiles.
    const fx = Math.round(screenX);
    const fy = Math.round(screenY);
    const cx = fx + 8;
    const cy = fy + 8;

    if (tileId === TILES.FORGE_LAVA_FLOOR) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + fx * 0.05 + fy * 0.04);
      ctx.fillStyle = `rgba(249, 115, 22, ${(0.10 + pulse * 0.20).toFixed(3)})`;
      ctx.fillRect(fx, fy, this.tileSize, this.tileSize);
      ctx.fillStyle = `rgba(127, 29, 29, ${(0.08 + (1 - pulse) * 0.14).toFixed(3)})`;
      ctx.fillRect(fx + 1, fy + 1, this.tileSize - 2, this.tileSize - 2);
      for (let i = 0; i < 2; i++) {
        const bx = fx + 3 + ((i * 7 + Math.floor(t * 2)) % 10);
        const by = fy + 6 + Math.sin(t * 2.2 + i * 2 + fx * 0.03) * 4;
        ctx.fillStyle = 'rgba(253, 224, 71, 0.65)';
        ctx.fillRect(Math.round(bx), Math.round(by), 1, 1);
      }
      // Sin halo radial por tile: el resplandor global lo aporta la iluminación.
      return;
    }

    if (tileId === TILES.LAMPPOST || tileId === TILES.FIREPLACE || tileId === TILES.WALL_TORCH) {
      const flicker = Math.sin(t * 10 + fx * 0.12 + fy * 0.07);
      const flameY = tileId === TILES.LAMPPOST ? fy + 4 : tileId === TILES.WALL_TORCH ? fy + 3 : fy + 9;
      this._drawLightHalo(ctx, cx, flameY, tileId === TILES.WALL_TORCH ? 22 : 20, '255, 170, 60', 0.2 + 0.06 * (flicker * 0.5 + 0.5));
      ctx.fillStyle = 'rgba(249, 115, 22, 0.9)';
      ctx.fillRect(cx - 1 + Math.round(flicker), flameY - 2, 2, 4);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(cx + Math.round(flicker), flameY - 3, 1, 2);
      return;
    }

    if (tileId === TILES.MINE_CRYSTAL_FLOOR || tileId === TILES.MINE_CRYSTAL_WALL || tileId === TILES.CRYSTAL_BARRIER) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 + fx * 0.05 + fy * 0.03);
      ctx.fillStyle = `rgba(56, 189, 248, ${(0.06 + pulse * 0.14).toFixed(3)})`;
      ctx.fillRect(fx, fy, this.tileSize, this.tileSize);
      ctx.strokeStyle = `rgba(186, 230, 253, ${(0.25 + pulse * 0.5).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, fy + 3);
      ctx.lineTo(fx + 11, fy + 9);
      ctx.lineTo(fx + 5, fy + 13);
      ctx.stroke();
      if (tileId !== TILES.MINE_CRYSTAL_FLOOR) {
        this._drawLightHalo(ctx, cx, cy, 18, '56, 189, 248', 0.10 + pulse * 0.12);
      }
      return;
    }

    if (tileId === TILES.PORTAL_GATE_CLOSED || tileId === TILES.PORTAL_GATE_OPEN) {
      const open = tileId === TILES.PORTAL_GATE_OPEN;
      const speed = open ? 1.8 : 0.6;
      ctx.strokeStyle = `rgba(56, 189, 248, ${open ? 0.75 : 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = t * speed + i * (Math.PI / 3);
        const r = 7 + Math.sin(t * 2.4 + i) * 1.5;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        ctx.fillStyle = open ? '#7dd3fc' : '#475569';
        ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      }
      this._drawLightHalo(ctx, cx, cy, 22, '56, 189, 248', open ? 0.22 : 0.08);
    }
  }


  // =========================================================================
  // BLOQUES 1-3 · Fachadas, sombras, cuevas y decals estáticos (seed fijo)
  // =========================================================================

  _seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  _sceneSeed(sceneId) {
    let h = 2166136261;
    for (let i = 0; i < sceneId.length; i++) h = Math.imul(h ^ sceneId.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  decorateScene(sceneId) {
    const scene = this.scenes[sceneId];
    if (!scene || !scene.layers) return;
    const { decoration, collision } = scene.layers;
    if (decoration && collision) {
      for (let r = 0; r < scene.rows; r++) {
        for (let c = 0; c < scene.cols; c++) {
          if (decoration[r][c] === TILES.SIGNPOST) {
            collision[r][c] = 0;
          }
        }
      }
    }
    const seed = this._sceneSeed(sceneId);
    scene.floorDecals = this._generateFloorDecals(sceneId, scene, seed);
    scene.houseShadows = this._generateHouseShadows(sceneId, scene);
    scene.caveProps = this._generateCaveProps(sceneId, scene, seed);
    scene.biomeProps = this._generateBiomeProps(sceneId, scene, seed);
    scene.chimneys = [];
    this._pruneSignposts(sceneId, scene);
  }

  _decorateScenes() {
    for (const sceneId of Object.keys(this.scenes)) {
      this.decorateScene(sceneId);
    }
    this._addVillageChimneys(this.scenes.overworld);
  }

  _zoneDecalKind(sceneId) {
    if (/overworld|first_stage|north_peaks|south_swamp|west_wastes/.test(sceneId)) return 'valley';
    if (/forge/.test(sceneId)) return 'forge';
    if (/sewers|mines|temple|jail|condemned|quantum|citadel|ai_/.test(sceneId)) return 'dungeon';
    return 'dungeon';
  }

  _generateFloorDecals(sceneId, scene, seed) {
    const rand = this._seededRandom(seed ^ 0x9e3779b9);
    const kind = this._zoneDecalKind(sceneId);
    const { ground } = scene.layers;
    const decals = [];
    const cols = scene.cols;
    const rows = scene.rows;
    const count = Math.floor(cols * rows * 0.075);
    const types = kind === 'valley'
      ? ['grass', 'grass', 'flower', 'stone']
      : kind === 'forge'
        ? ['spark', 'oil', 'crack', 'stone']
        : ['crack', 'moss', 'bone', 'stone'];
    const palette = kind === 'valley'
      ? ['#5f8f3a', '#7fae4a', '#e8c547', '#9ca3af']
      : kind === 'forge'
        ? ['#f97316', '#1f2937', '#4b5563', '#78716c']
        : ['#0b0f14', '#3f6b3a', '#e5e7eb', '#6b7280'];
    for (let i = 0; i < count; i++) {
      const c = 1 + Math.floor(rand() * (cols - 2));
      const r = 1 + Math.floor(rand() * (rows - 2));
      const tile = ground[r][c];
      if (
        tile === TILES.WATER_1 ||
        tile === TILES.WATER_2 ||
        tile === TILES.FORGE_LAVA_FLOOR ||
        tile === TILES.MINE_CHASM ||
        tile === TEMPLE_TILES.BINARY_RUNE_CYAN ||
        tile === TEMPLE_TILES.ABYSS_VOID
      ) continue;
      const ti = Math.floor(rand() * types.length);
      decals.push({
        x: c * this.tileSize + 2 + rand() * 12,
        y: r * this.tileSize + 2 + rand() * 12,
        type: types[ti],
        color: palette[ti],
        size: 1 + rand() * 2,
        alpha: 0.4 + rand() * 0.3,
        rot: rand() * Math.PI
      });
    }
    return decals;
  }

  _generateHouseShadows(sceneId, scene) {
    // (FIX 1/4) Sombras de aleros y volumen de edificios: cualquier escena con muros de casa o tejados.
    const { decoration } = scene.layers;
    const walls = new Set([TILES.WALL_FRONT, TILES.WALL_WINDOW, TILES.WALL_WINDOW_FLOWER, TILES.WALL_DOOR]);
    const roofs = new Set([TILES.ROOF_RED, TILES.ROOF_BLUE, TILES.ROOF_GREEN]);
    const shadows = [];
    for (let r = 0; r < scene.rows; r++) {
      let c = 0;
      while (c < scene.cols) {
        if (walls.has(decoration[r][c])) {
          const c0 = c;
          let hasRoof = false;
          let roofRows = 0;
          while (c < scene.cols && walls.has(decoration[r][c])) {
            let rr = r - 1;
            let count = 0;
            while (rr >= 0 && roofs.has(decoration[rr][c])) {
              count++;
              rr--;
            }
            if (count > 0) hasRoof = true;
            if (count > roofRows) roofRows = count;
            c++;
          }
          shadows.push({
            x: c0 * this.tileSize,
            y: (r + 1) * this.tileSize,
            w: (c - c0) * this.tileSize,
            h: (1 + roofRows) * this.tileSize,
            roofRows,
            hasRoof
          });
        } else {
          c++;
        }
      }
    }
    return shadows;
  }

  _generateCaveProps(sceneId, scene, seed) {
    const isMines = sceneId.startsWith('mines');
    const isSewers = sceneId.startsWith('sewers');
    const isForge = sceneId.startsWith('forge') || sceneId === 'ai_fortress_gate';
    if (!isMines && !isSewers && !isForge) return [];

    const rand = this._seededRandom(seed ^ 0xc0ffee);
    const { decoration } = scene.layers;
    const props = [];

    // Estalactitas colgando del techo (en minas, cloacas y forja)
    for (let c = 1; c < scene.cols - 1; c += 2) {
      if (rand() > 0.55) continue;
      if (c === 11 || c === 12) continue; // Respetar paso de puerta norte
      props.push({ tileId: TILES.STALACTITE, x: c * this.tileSize, y: 0 });
    }
    for (let r = 3; r < scene.rows - 2; r += 4) {
      for (const c of [0, scene.cols - 1]) {
        if (rand() > 0.6) continue;
        props.push({ tileId: TILES.STALACTITE, x: c * this.tileSize, y: r * this.tileSize });
      }
    }

    // Antorchas en paredes que parpadean con luces dinámicas
    if (!Array.isArray(scene.lightSources)) scene.lightSources = [];
    const torchCols = [4, 8, 15, 19].filter((c) => c > 1 && c < scene.cols - 2);
    for (const tc of torchCols) {
      const tx = tc * this.tileSize;
      const ty = 1 * this.tileSize;
      props.push({ tileId: TILES.WALL_TORCH, x: tx, y: ty, animated: true });
      scene.lightSources.push({
        x: tx + 8,
        y: ty + 6,
        radius: 44,
        intensity: 0.9,
        glow: isSewers ? 'warm' : isMines ? 'cyan' : 'warm',
        kind: 'torch'
      });
    }

    if (isMines) {
      // Vigas horizontales que cruzan el techo de la cueva.
      for (const r of [2, 8, 14]) {
        if (r >= scene.rows) continue;
        for (let c = 1; c < scene.cols - 1; c++) {
          props.push({ tileId: TILES.BEAM, x: c * this.tileSize, y: r * this.tileSize });
        }
      }
      // Rocas junto a las paredes/ suelo.
      for (let i = 0; i < 8; i++) {
        const c = 1 + Math.floor(rand() * (scene.cols - 2));
        const r = 2 + Math.floor(rand() * (scene.rows - 4));
        if (decoration[r][c] !== -1) continue;
        props.push({ tileId: TILES.ROCK, x: c * this.tileSize, y: r * this.tileSize });
      }
    }
    return props;
  }

  _generateBiomeProps(sceneId, scene, seed) {
    if (!scene || !scene.layers) return [];
    const theme = getEnvironmentTheme(sceneId);
    const propSet = theme.propSet;
    if (!propSet) return [];

    const BIOME_PROP_KINDS = {
      cloacas: {
        floor: ['moss', 'slime_puddle'],
        upright: ['broken_pipe'],
      },
      minas: {
        floor: ['broken_rail'],
        upright: ['pickaxe', 'loose_rock'],
      },
      forja: {
        floor: [],
        upright: ['mini_anvil', 'chain', 'ingot'],
      },
      templos: {
        floor: ['carpet'],
        upright: ['knight_statue', 'candle'],
      },
      corporativo: {
        floor: ['papers'],
        upright: ['cubicle', 'chair', 'coffee_maker'],
      },
    };

    const catalog = BIOME_PROP_KINDS[propSet];
    if (!catalog) return [];

    const rand = this._seededRandom(seed ^ 0x9e3779b9);
    const { collision, decoration } = scene.layers;
    const ts = this.tileSize;
    const props = [];
    const occupied = new Set();

    // Templos: antorchas parpadeantes en los muros + luces dinámicas de halo
    if (propSet === 'templos') {
      if (!Array.isArray(scene.lightSources)) scene.lightSources = [];
      if (!Array.isArray(scene.caveProps)) scene.caveProps = [];
      const torchCols = [4, 7, 16, 19].filter((c) => c > 1 && c < scene.cols - 2);
      for (const tc of torchCols) {
        const tx = tc * ts;
        const ty = 1 * ts;
        scene.caveProps.push({ tileId: TILES.WALL_TORCH, x: tx, y: ty, animated: true });
        scene.lightSources.push({
          x: tx + 8,
          y: ty + 6,
          radius: 46,
          intensity: 0.95,
          glow: 'cyan',
          kind: 'torch',
          flicker: true,
        });
      }
    }

    const validCells = [];
    const midCol = Math.floor(scene.cols / 2);
    const midRow = Math.floor(scene.rows / 2);
    for (let r = 2; r < scene.rows - 2; r++) {
      for (let c = 2; c < scene.cols - 2; c++) {
        if (collision && collision[r] && collision[r][c] !== 0) continue;
        if (decoration && decoration[r] && decoration[r][c] !== -1 && decoration[r][c] !== undefined) continue;
        if (Math.abs(c - midCol) <= 1 && Math.abs(r - midRow) <= 1) continue;
        validCells.push([c, r]);
      }
    }

    // Mezcla determinista de celdas libres para garantizar variedad sin solapamientos
    for (let i = validCells.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = validCells[i];
      validCells[i] = validCells[j];
      validCells[j] = tmp;
    }

    let cursor = 0;

    // Props planos sobre el suelo (siempre debajo de entidades: sortY = y - 2)
    if (catalog.floor.length > 0 && validCells.length > 0) {
      const floorTarget = Math.max(
        catalog.floor.length,
        Math.min(8, Math.floor((scene.cols * scene.rows) / 48))
      );
      for (let i = 0; i < floorTarget && cursor < validCells.length; i++, cursor++) {
        const [c, r] = validCells[cursor];
        occupied.add(`${c},${r}`);
        const kind = catalog.floor[i % catalog.floor.length];
        const x = c * ts;
        const y = r * ts;
        props.push({
          kind,
          propSet,
          x,
          y,
          w: kind === 'carpet' ? 16 : 14,
          h: kind === 'carpet' ? 14 : 12,
          sortY: y - 2,
          variant: Math.floor(rand() * 3),
        });
      }
    }

    // Props verticales con Y-sorting (sin colisión: nunca alteran collision[r][c])
    if (catalog.upright.length > 0 && cursor < validCells.length) {
      const uprightTarget = Math.max(
        catalog.upright.length,
        Math.min(9, Math.floor((scene.cols * scene.rows) / 42))
      );
      for (let i = 0; i < uprightTarget && cursor < validCells.length; i++, cursor++) {
        const [c, r] = validCells[cursor];
        occupied.add(`${c},${r}`);
        const kind = catalog.upright[i % catalog.upright.length];
        const x = c * ts;
        const y = r * ts;
        const h = (kind === 'knight_statue' || kind === 'cubicle') ? 16 : 14;
        props.push({
          kind,
          propSet,
          x,
          y,
          w: 16,
          h,
          sortY: y + h,
          variant: Math.floor(rand() * 3),
        });

        if (kind === 'candle' && Array.isArray(scene.lightSources)) {
          scene.lightSources.push({
            x: x + 8,
            y: y + 5,
            radius: 28,
            intensity: 0.72,
            glow: 'warm',
            kind: 'candle',
            flicker: true,
          });
        }
      }
    }

    return props;
  }

  _drawBiomeProp(ctx, prop, sx, sy) {
    const x = Math.round(sx);
    const y = Math.round(sy);
    switch (prop.kind) {
      case 'broken_pipe': {
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + 2, y + 6, 12, 6);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(x + 2, y + 7, 12, 2);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x + 12, y + 7, 2, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(x + 4, y + 11, 5, 2);
        break;
      }
      case 'moss': {
        ctx.fillStyle = '#15803d';
        ctx.fillRect(x + 2, y + 5, 9, 5);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(x + 4, y + 4, 6, 3);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(x + 6, y + 5, 2, 2);
        break;
      }
      case 'slime_puddle': {
        ctx.fillStyle = '#0f766e';
        ctx.fillRect(x + 2, y + 6, 11, 6);
        ctx.fillStyle = '#14b8a6';
        ctx.fillRect(x + 4, y + 7, 7, 3);
        ctx.fillStyle = '#99f6e4';
        ctx.fillRect(x + 5, y + 8, 2, 1);
        break;
      }
      case 'broken_rail': {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(x + 3, y + 4, 2, 8);
        ctx.fillRect(x + 9, y + 4, 2, 8);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x + 1, y + 5, 11, 1);
        ctx.fillRect(x + 2, y + 10, 8, 1);
        break;
      }
      case 'pickaxe': {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(x + 7, y + 5, 2, 8);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(x + 3, y + 4, 10, 2);
        ctx.fillRect(x + 2, y + 5, 2, 2);
        ctx.fillRect(x + 12, y + 5, 2, 2);
        break;
      }
      case 'loose_rock': {
        ctx.fillStyle = '#475569';
        ctx.fillRect(x + 3, y + 8, 10, 5);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(x + 5, y + 6, 6, 4);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x + 8, y + 8, 2, 2);
        break;
      }
      case 'mini_anvil': {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x + 4, y + 10, 8, 4);
        ctx.fillStyle = '#475569';
        ctx.fillRect(x + 2, y + 6, 12, 4);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x + 3, y + 6, 10, 1);
        break;
      }
      case 'chain': {
        ctx.fillStyle = '#334155';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(x + 6 + (i % 2), y + 2 + i * 3, 3, 2);
        }
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x + 7, y + 5, 1, 2);
        ctx.fillRect(x + 7, y + 11, 1, 2);
        break;
      }
      case 'ingot': {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(x + 3, y + 10, 5, 3);
        ctx.fillRect(x + 8, y + 10, 5, 3);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(x + 5, y + 7, 6, 3);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(x + 6, y + 7, 4, 1);
        break;
      }
      case 'knight_statue': {
        ctx.fillStyle = '#475569';
        ctx.fillRect(x + 4, y + 11, 8, 5);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x + 5, y + 4, 6, 8);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(x + 6, y + 2, 4, 3);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x + 11, y + 3, 1, 8);
        break;
      }
      case 'candle': {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(x + 6, y + 11, 4, 2);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x + 7, y + 7, 2, 4);
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(x + 7, y + 5, 2, 2);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(x + 7, y + 4, 1, 1);
        break;
      }
      case 'carpet': {
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(x + 1, y + 2, 14, 11);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(x + 2, y + 3, 12, 9);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x + 4, y + 5, 8, 5);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(x + 5, y + 6, 6, 3);
        break;
      }
      case 'cubicle': {
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + 1, y + 2, 14, 12);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x + 2, y + 3, 12, 2);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(x + 2, y + 7, 12, 5);
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(x + 5, y + 4, 5, 4);
        break;
      }
      case 'chair': {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x + 5, y + 4, 6, 5);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(x + 4, y + 9, 8, 3);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(x + 7, y + 12, 2, 2);
        break;
      }
      case 'coffee_maker': {
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + 4, y + 4, 8, 10);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(x + 6, y + 9, 4, 3);
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(x + 6, y + 5, 3, 1);
        break;
      }
      case 'papers': {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x + 2, y + 5, 5, 6);
        ctx.fillRect(x + 8, y + 7, 5, 5);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x + 3, y + 7, 3, 1);
        ctx.fillRect(x + 9, y + 9, 3, 1);
        break;
      }
      default:
        break;
    }
  }

  _addVillageChimneys(scene) {
    if (!scene || !scene.layers) return;
    const spots = [
      [7, 2], [14, 2], [22, 3], [3, 7], [5, 15], [25, 15]
    ];
    for (const [c, r] of spots) {
      if (r < 0 || r >= scene.rows || c < 0 || c >= scene.cols) continue;
      scene.layers.decoration[r][c] = TILES.CHIMNEY;
      scene.layers.collision[r][c] = 1;
      scene.chimneys.push({ x: c * this.tileSize + 8, y: r * this.tileSize + 2 });
    }
  }

  /** (FIX 2) Máximo 2 carteles por zona; el resto se retira y su dato de lectura se elimina. */
  _pruneSignposts(sceneId, scene) {
    // (FIX 1) Exterminio estricto: se borran TODOS los carteles de la capa y sus datos.
    const deco = scene.layers.decoration;
    const collision = scene.layers.collision;
    for (let r = 0; r < scene.rows; r++) {
      for (let c = 0; c < scene.cols; c++) {
        if (deco[r][c] === TILES.SIGNPOST) {
          deco[r][c] = -1;
          collision[r][c] = 0;
        }
      }
    }
    scene.signposts = [];

    // Mazmorras, templos, minas e interiores: CERO carteles.
    if (sceneId !== 'overworld') return;

    // (FIX 1) Solo dos carteles manuales, fuera de caminos de tierra y puertas.
    const kept = [
      {
        c: 19,
        r: 20,
        shortName: 'Campo Entrenamiento',
        title: '🪧 [CUARTEL] Guardia del Binario · Campo de Entrenamiento [Práctica & Nivel]',
        lines: [
          '«Campo de Entrenamiento de Valleverde: Área cercada para combate de práctica militar.»',
          '«¡Derrota los drones y bugs de prueba para ganar experiencia (XP) y subir de nivel antes de partir!»'
        ]
      },
      {
        c: 22,
        r: 10,
        shortName: 'Forja de Brom',
        title: '🪧 [FORJA] Taller de Brom · Forja de Espadas y Armaduras [Mejora & Venta]',
        lines: [
          '«Maestro Forjador Brom: Forjado de Espada de Silicio, Espada Overclockeada y Blindaje Térmico.»',
          '«Brom trabaja incansablemente en su yunque exterior durante las horas diurnas.»'
        ]
      }
    ];
    for (const sp of kept) {
      deco[sp.r][sp.c] = TILES.SIGNPOST;
      collision[sp.r][sp.c] = 0;
      scene.signposts.push(sp);
    }
  }

  _drawFloorDecals(ctx, camera) {
    if (!this.floorDecals || this.floorDecals.length === 0) return;
    const camX = camera.renderX;
    const camY = camera.renderY;
    const W = 320;
    const H = 180;
    ctx.save();
    for (const d of this.floorDecals) {
      const sx = d.x - camX;
      const sy = d.y - camY;
      if (sx < -8 || sx > W + 8 || sy < -8 || sy > H + 8) continue;
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = d.color;
      switch (d.type) {
        case 'grass':
          ctx.fillRect(Math.round(sx), Math.round(sy), 1, Math.round(2 + d.size));
          ctx.fillRect(Math.round(sx) + 2, Math.round(sy) - 1, 1, Math.round(2 + d.size));
          ctx.fillRect(Math.round(sx) - 2, Math.round(sy), 1, 2);
          break;
        case 'flower':
          ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
          break;
        case 'stone':
          ctx.beginPath();
          ctx.ellipse(sx, sy, d.size, d.size * 0.7, d.rot, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'crack':
          ctx.strokeStyle = d.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + 4, sy + 3);
          ctx.lineTo(sx + 2, sy + 7);
          ctx.moveTo(sx + 4, sy + 3);
          ctx.lineTo(sx + 8, sy + 2);
          ctx.stroke();
          break;
        case 'moss':
          ctx.beginPath();
          ctx.ellipse(sx, sy, d.size * 2, d.size, d.rot, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'bone':
          ctx.fillRect(Math.round(sx), Math.round(sy), 3, 1);
          ctx.fillRect(Math.round(sx) + 1, Math.round(sy) - 1, 1, 1);
          break;
        case 'spark':
          ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
          break;
        case 'oil':
          ctx.beginPath();
          ctx.ellipse(sx, sy, d.size * 2.2, d.size, d.rot, 0, Math.PI * 2);
          ctx.fill();
          break;
        default:
          ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawHouseShadows(ctx, camera, sun) {
    if (!this.houseShadows || this.houseShadows.length === 0) return;
    const len = 8 * (sun && Number.isFinite(sun.length) ? sun.length : 0.8);
    const dx = sun && Number.isFinite(sun.dx) ? sun.dx * len * 0.4 : 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (const sh of this.houseShadows) {
      const sx = sh.x - camera.renderX;
      const sy = sh.y - camera.renderY;
      if (sx < -sh.w || sx > 320 + sh.w || sy < -len || sy > 180 + len) continue;
      ctx.fillRect(Math.round(sx + dx), Math.round(sy), sh.w, len);
    }
    ctx.restore();
  }

  _drawRoofEaves(ctx, camera) {
    const { decoration } = this.layers;
    for (let r = 0; r < this.rows - 1; r++) {
      for (let c = 0; c < this.cols; c++) {
        const roof = decoration[r][c];
        if (roof !== TILES.ROOF_RED && roof !== TILES.ROOF_BLUE && roof !== TILES.ROOF_GREEN) continue;
        const below = decoration[r + 1][c];
        if (below !== TILES.WALL_FRONT && below !== TILES.WALL_WINDOW && below !== TILES.WALL_WINDOW_FLOWER && below !== TILES.WALL_DOOR) continue;
        const sx = c * this.tileSize - camera.renderX;
        const sy = (r + 1) * this.tileSize - camera.renderY;
        if (sx < -16 || sx > 320 + 16 || sy < -16 || sy > 180 + 16) continue;
        // Alero de 4 px que sobresale sobre el muro frontal.
        ctx.fillStyle = roof === TILES.ROOF_RED ? '#5e1818' : roof === TILES.ROOF_GREEN ? '#163e26' : '#16263d';
        ctx.fillRect(Math.round(sx), Math.round(sy), this.tileSize, 4);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(Math.round(sx), Math.round(sy) + 4, this.tileSize, 2);
      }
    }
  }

  _drawCaveProps(ctx, camera) {
    if (!this.caveProps || this.caveProps.length === 0) return;
    for (const prop of this.caveProps) {
      const sx = prop.x - camera.renderX;
      const sy = prop.y - camera.renderY;
      if (sx < -16 || sx > 320 + 16 || sy < -16 || sy > 180 + 16) continue;
      this._drawTile(ctx, prop.tileId, sx, sy);
      if (prop.animated) {
        this._drawAnimatedTileFx(ctx, prop.tileId, sx, sy);
      }
    }
  }

  _drawClotheslines(ctx, camera) {
    if (!this.clotheslines || this.clotheslines.length === 0) return;
    ctx.save();
    for (const line of this.clotheslines) {
      const x1 = Math.round(line.x1 - camera.renderX);
      const y1 = Math.round(line.y1 - camera.renderY);
      const x2 = Math.round(line.x2 - camera.renderX);
      const y2 = Math.round(line.y2 - camera.renderY);
      if (Math.max(x1, x2) < -16 || Math.min(x1, x2) > 336 || Math.max(y1, y2) < -16 || Math.min(y1, y2) > 196) {
        continue;
      }
      const midX = (x1 + x2) * 0.5;
      const midY = (y1 + y2) * 0.5 + (line.sag || 5);
      ctx.strokeStyle = 'rgba(42, 30, 22, 0.85)';
      ctx.lineWidth = 1;
      if (typeof ctx.beginPath === 'function' && typeof ctx.moveTo === 'function' && typeof ctx.stroke === 'function') {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        if (typeof ctx.quadraticCurveTo === 'function') {
          ctx.quadraticCurveTo(midX, midY, x2, y2);
        } else if (typeof ctx.lineTo === 'function') {
          ctx.lineTo(midX, midY);
          ctx.lineTo(x2, y2);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(42, 30, 22, 0.85)';
        ctx.fillRect(Math.min(x1, x2), Math.round((y1 + y2) * 0.5), Math.max(1, Math.abs(x2 - x1)), 1);
      }

      const items = line.items || ['#f8fafc', '#38bdf8', '#f43f5e'];
      const count = items.length;
      for (let i = 0; i < count; i++) {
        const t = (i + 1) / (count + 1);
        const mt = 1 - t;
        const px = mt * mt * x1 + 2 * mt * t * midX + t * t * x2;
        const py = mt * mt * y1 + 2 * mt * t * midY + t * t * y2;
        const sway = Math.round(Math.sin(this.animationClock * 2.2 + i * 1.4) * 1);
        ctx.fillStyle = '#3b2416';
        ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 1);
        ctx.fillStyle = items[i];
        ctx.fillRect(Math.round(px) - 2 + sway, Math.round(py), 5, 6);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(Math.round(px) - 2 + sway, Math.round(py) + 5, 5, 1);
      }
    }
    ctx.restore();
  }

  /** Ondulación del agua: dos destellos horizontales por tile que fluyen con una onda senoidal. */
  _drawWaterRipple(ctx, screenX, screenY, col, row, phaseIndex = 0) {
    const t = this.animationClock + phaseIndex * 0.12;
    for (let k = 0; k < 2; k++) {
      const wobble = Math.sin(t * 1.3 + (col + k * 3) * 0.8 + row * 0.35) * 1.5;
      const localY = Math.round(3 + k * 8 + wobble);
      const phase = Math.sin(t * 0.9 + row * 1.3 + k * 2.1) * 0.5 + 0.5;
      const localX = Math.round(phase * 8);
      ctx.fillStyle = k === 0 ? 'rgba(255, 255, 255, 0.16)' : 'rgba(180, 225, 255, 0.10)';
      ctx.fillRect(Math.round(screenX) + localX, Math.round(screenY) + localY, 7, 1);
    }
    // Sombreado alterno muy tenue para sugerir profundidad
    const shade = 0.04 + (Math.sin(t * 0.7 + col * 0.5 - row * 0.9) * 0.5 + 0.5) * 0.04;
    ctx.fillStyle = `rgba(8, 24, 64, ${shade.toFixed(3)})`;
    ctx.fillRect(Math.round(screenX), Math.round(screenY), this.tileSize, this.tileSize);
  }

  /**
   * CAPA 1 · Obstáculos Y-sorted: recoge en `out` los tiles sólidos visibles (troncos, muros, cajas,
   * mobiliario, monolitos...) como entradas ordenables por `sortY` = borde inferior del tile.
   * Las entradas se reutilizan entre fotogramas (pool) para no generar basura.
   * @param {Camera2D} camera
   * @param {Array} out lista a la que se añaden los props (se mezcla con las entidades)
   */
  collectYSortedProps(camera, out) {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const { startCol, endCol, startRow, endRow } = this._visibleTileRange(camera);
    const { decoration, collision } = this.layers;
    let used = 0;

    const acquire = () => {
      let p = this._propPool[used];
      if (!p) {
        p = { isTileProp: true, tileId: 0, sx: 0, sy: 0, sortY: 0, puzzle: null, mono: null, biomeProp: null };
        this._propPool[used] = p;
      }
      used++;
      return p;
    };

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const decoTile = decoration[r][c];
        if (decoTile === -1 || decoTile === undefined || decoTile === null) continue;
        if (OVERHEAD_TILE_IDS.has(decoTile) || collision[r][c] !== 1) continue;

        const p = acquire();
        p.tileId = decoTile;
        p.sx = c * this.tileSize - camX;
        p.sy = r * this.tileSize - camY;
        p.sortY = (r + 1) * this.tileSize;
        p.puzzle = null;
        p.mono = null;
        p.biomeProp = null;
        out.push(p);
      }
    }

    // Props decorativos sin colisión específicos del bioma (ordenados por Y)
    if (this.biomeProps && this.biomeProps.length > 0) {
      const vw = camera.viewportWidth || 320;
      const vh = camera.viewportHeight || 180;
      for (let i = 0; i < this.biomeProps.length; i++) {
        const bp = this.biomeProps[i];
        const sx = bp.x - camX;
        const sy = bp.y - camY;
        if (sx + bp.w < -16 || sx > vw + 16 || sy + bp.h < -16 || sy > vh + 16) continue;
        const p = acquire();
        p.tileId = -1;
        p.sx = sx;
        p.sy = sy;
        p.sortY = bp.sortY;
        p.puzzle = null;
        p.mono = null;
        p.biomeProp = bp;
        out.push(p);
      }
    }

    // Monolitos de los templos: obeliscos altos que ocluyen al jugador según su posición Y
    let monoliths = null;
    let puzzleKind = null;
    if (this.currentSceneId === 'armor_temple' && this.armorPuzzle.monoliths) {
      monoliths = this.armorPuzzle.monoliths;
      puzzleKind = 'armor';
    } else if (this.currentSceneId === 'sword_temple' && this.swordPuzzle.monoliths) {
      monoliths = this.swordPuzzle.monoliths;
      puzzleKind = 'sword';
    } else if (this.currentSceneId === 'mines_puzzle' && this.minesPuzzle.monoliths) {
      monoliths = this.minesPuzzle.monoliths;
      puzzleKind = 'mines';
    }
    if (monoliths) {
      for (const mono of Object.values(monoliths)) {
        const p = acquire();
        p.tileId = -1;
        p.sx = 0;
        p.sy = 0;
        p.sortY = (mono.row + 1) * this.tileSize;
        p.puzzle = puzzleKind;
        p.mono = mono;
        p.biomeProp = null;
        out.push(p);
      }
    }
  }

  /** Dibuja una entrada devuelta por collectYSortedProps(). */
  drawProp(ctx, camera, prop) {
    if (prop.biomeProp) {
      this._drawBiomeProp(ctx, prop.biomeProp, prop.sx, prop.sy);
    } else if (prop.puzzle === 'armor') {
      this.drawArmorMonolith(ctx, camera, prop.mono);
    } else if (prop.puzzle === 'sword') {
      this.drawSwordMonolith(ctx, camera, prop.mono);
    } else if (prop.puzzle === 'mines') {
      this.drawMinesMonolith(ctx, camera, prop.mono);
    } else {
      this._drawTile(ctx, prop.tileId, prop.sx, prop.sy);
      this._drawAnimatedTileFx(ctx, prop.tileId, prop.sx, prop.sy);
    }
  }

  /**
   * CAPA 2 · Estructuras elevadas: copas de árboles, tejados (con sombra de alero sobre el muro) y
   * carteles de jefes/mazmorras. Se dibuja SIEMPRE por encima de jugador, NPCs y enemigos.
   */
  renderOverhead(ctx, camera, enemies = [], player = null) {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const { startCol, endCol, startRow, endRow } = this._visibleTileRange(camera);
    const { decoration } = this.layers;

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const decoTile = decoration[r][c];
        if (!OVERHEAD_TILE_IDS.has(decoTile)) continue;

        const screenX = c * this.tileSize - camX;
        const screenY = r * this.tileSize - camY;
        // (FIX 5) Balanceo de copas de árbol con el viento.
        const treeSway = decoTile === TILES.TREE_TOP
          ? Math.round(Math.sin(this.animationClock * 1.6 + c * 0.7 + r * 0.3))
          : 0;
        this._drawTile(ctx, decoTile, screenX + treeSway, screenY);
        this._drawAnimatedTileFx(ctx, decoTile, screenX + treeSway, screenY);

        // Sombra de alero proyectada sobre el muro situado justo debajo del tejado
        if (decoTile !== TILES.TREE_TOP && r + 1 < this.rows) {
          const below = decoration[r + 1][c];
          if (below === TILES.WALL_FRONT || below === TILES.WALL_WINDOW || below === TILES.WALL_WINDOW_FLOWER || below === TILES.WALL_DOOR) {
            const baseY = Math.round(screenY) + this.tileSize;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
            ctx.fillRect(Math.round(screenX), baseY, this.tileSize, 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.fillRect(Math.round(screenX), baseY + 2, this.tileSize, 2);
          }
        }
      }
    }

    // Capa `decor_over` (formato Tiled: estatuas, telarañas, antorchas, monolitos flotantes)
    if (this.layers.decor_over) {
      const decorOver = this.layers.decor_over;
      for (let r = startRow; r <= endRow; r++) {
        const row = decorOver[r];
        if (!row) continue;
        for (let c = startCol; c <= endCol; c++) {
          const overTile = row[c];
          if (overTile === -1 || overTile === undefined || overTile === null) continue;
          const sx = c * this.tileSize - camX;
          const sy = r * this.tileSize - camY;
          this._drawTile(ctx, overTile, sx, sy);
        }
      }
    }

    // (BLOQUE 1.2) Alero de 4 px y sombra bajo el tejado.
    this._drawRoofEaves(ctx, camera);
    // Ropa tendida entre casas
    this._drawClotheslines(ctx, camera);
    // (BLOQUE 2.1/2.2) Estalactitas, rocas, antorchas y vigas de cueva en la capa superior.
    this._drawCaveProps(ctx, camera);
  }

  /**
   * Renderizado completo compatible (sin entidades): suelo → props Y-sorted → estructuras elevadas.
   * El pipeline 2.5D (RenderPipeline) usa las tres capas por separado para intercalar entidades.
   */
  render(ctx, camera, enemies = [], player = null) {
    this.renderGround(ctx, camera);
    const props = [];
    this.collectYSortedProps(camera, props);
    props.sort((a, b) => a.sortY - b.sortY);
    for (const prop of props) {
      this.drawProp(ctx, camera, prop);
    }
    this.renderOverhead(ctx, camera, enemies, player);
  }

  /**
   * Las indicaciones flotantes intrusivas se han eliminado de la pantalla principal
   * para preservar la inmersión visual. Toda la orientación cartográfica reside en el Mapa [M].
   */
  renderBossAndDungeonIndicators(ctx, camera, enemies = [], player = null) {
    // No-op: textos flotantes eliminados por diseño limpio y atmosférico.
  }

  // =========================================================================
  // MÉTODOS Y MECÁNICAS: PUZLE DEL TEMPLO DE LA ARMADURA (PARIDAD Y CIRCUITOS)
  // =========================================================================

  /**
   * Conmuta el estado de un interruptor de presión (0 <-> 1) y evalúa la condición de paridad y compuertas.
   * @param {string} switchId 'SWITCH_A' | 'SWITCH_B' | 'SWITCH_C' | 'SWITCH_D'
   */
  toggleArmorSwitch(switchId) {
    if (this.armorPuzzle.solved) {
      return { solved: true, conditionResult: true };
    }
    const key = switchId.replace('SWITCH_', '');
    if (this.armorPuzzle.switches[key] === undefined) return null;

    this.armorPuzzle.switches[key] = this.armorPuzzle.switches[key] === 1 ? 0 : 1;
    return this.evaluateArmorPuzzle();
  }

  /**
   * Evalúa la condición lógica abstracta deducida de los 3 Monolitos Crípticos:
   * 1. Monolito Alfa: Paridad = exactamente 2 compuertas activas (A + B + C + D === 2).
   * 2. Monolito Beta: D = ¬A, con A en reposo (A === 0, por lo que D === 1).
   * 3. Monolito Gamma: C drena a tierra (C === 0), B conduce la energía (B === 1).
   * Solución única: { A: 0, B: 1, C: 0, D: 1 }
   */
  evaluateArmorPuzzle() {
    const { A, B, C, D } = this.armorPuzzle.switches;
    const activeCount = (A || 0) + (B || 0) + (C || 0) + (D || 0);
    const isConditionMet = A === 0 && B === 1 && C === 0 && D === 1;

    if (isConditionMet && !this.armorPuzzle.solved) {
      this.armorPuzzle.solved = true;
      this.armorPuzzle.barrierActive = false;
      this.setArmorBarrier(false);
      return { solved: true, justSolved: true, conditionResult: true, activeCount };
    }

    // Si se activan 2 compuertas y no es la combinación correcta, o se superan las 2 compuertas:
    // Se produce un cortocircuito violento, los interruptores se resetean y se dispara un arco de estática (-0.5 corazón)
    if (activeCount >= 2 && !isConditionMet) {
      this.armorPuzzle.switches = { A: 0, B: 0, C: 0, D: 0 };
      return {
        solved: false,
        justSolved: false,
        conditionResult: false,
        shock: true,
        damage: 1,
        message: '⚡ ¡Cortocircuito de Paridad! Arco de estática liberado (-0.5 corazón).'
      };
    }

    return { solved: false, justSolved: false, conditionResult: false, activeCount };
  }

  /**
   * Renderiza los 4 interruptores de presión, los 3 monolitos crípticos y la barrera de fuego.
   * Sin fórmulas explícitas en la pared.
   */
  renderArmorPuzzle(ctx, camera, withMonoliths = true) {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const t = performance.now() * 0.003;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 1. Render de los 4 Interruptores de Presión tipo Tile (SWITCH_A .. SWITCH_D)
    for (const [key, sw] of Object.entries(this.armorPuzzle.switchPositions)) {
      const swKey = key.replace('SWITCH_', '');
      const state = this.armorPuzzle.switches[swKey] || 0;
      const isPressed = state === 1;

      const sx = Math.round(sw.col * this.tileSize - camX);
      const sy = Math.round(sw.row * this.tileSize - camY);

      // Marco de la baldosa de presión
      ctx.fillStyle = isPressed ? '#064e3b' : '#0f172a';
      ctx.fillRect(sx + 1, sy + 1, 14, 14);

      ctx.strokeStyle = isPressed ? '#10b981' : '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 1.5, sy + 1.5, 13, 13);

      // Núcleo activo / botón deprimido
      ctx.fillStyle = isPressed ? '#34d399' : '#1e293b';
      ctx.fillRect(sx + 4, sy + 4, 8, 8);

      // Etiqueta del interruptor y valor [0 / 1]
      ctx.font = 'bold 5.5px monospace';
      ctx.fillStyle = isPressed ? '#ecfdf5' : '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${swKey}:${state}`, sx + 8, sy + 8);

      // Halo sutil cuando está activo
      if (isPressed) {
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
        ctx.strokeRect(sx - 0.5, sy - 0.5, 17, 17);
      }
    }

    // 2. Monolitos Crípticos (Alfa, Beta, Gamma): en el pipeline 2.5D se ordenan en Y con el resto
    // de props (withMonoliths = false); el modo compatible los dibuja aquí.
    if (withMonoliths && this.armorPuzzle.monoliths) {
      for (const mono of Object.values(this.armorPuzzle.monoliths)) {
        this.drawArmorMonolith(ctx, camera, mono);
      }
    }

    // 3. Barrera de fuego (si no está resuelto el puzle)
    if (this.armorPuzzle.barrierActive) {
      for (let c = 9; c <= 11; c++) {
        const barX = Math.round(c * this.tileSize - camX);
        const barY = Math.round(this.armorPuzzle.barrierRow * this.tileSize - camY);

        // Llamas animadas tipo pixel art
        const flameH = 10 + Math.sin(t * 8 + c) * 3;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(barX + 2, barY + 16 - flameH, 12, flameH);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(barX + 4, barY + 16 - flameH + 2, 8, flameH - 2);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(barX + 6, barY + 16 - flameH + 4, 4, flameH - 4);

        // Resplandor de calor
        ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
        ctx.fillRect(barX - 4, barY - 4, 24, 24);
      }
    }

    ctx.restore();
  }

  /** Dibuja un monolito críptico del Templo de la Armadura (obelisco de 12×18 px). */
  drawArmorMonolith(ctx, camera, mono) {
    const mx = Math.round(mono.col * this.tileSize - camera.renderX);
    const my = Math.round(mono.row * this.tileSize - camera.renderY);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(mx + 2, my - 2, 12, 18);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 2.5, my - 1.5, 11, 17);

    // Símbolo rúnico grabado
    ctx.font = 'bold 6.5px monospace';
    ctx.fillStyle = '#7dd3fc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mono.symbol, mx + 8, my + 6);
    ctx.restore();
  }

  // =========================================================================
  // MÉTODOS Y MECÁNICAS: PUZLE DEL TEMPLO DE LA ESPADA (RECURSIÓN Y CASO BASE)
  // =========================================================================

  /**
   * Registra el golpe o interacción con un monolito rúnico.
   * Deducción de paso recursivo: Monolito 3 (Límite N) -> Monolito 1 (Caso Base 0) -> Monolito 2 (Desenredo)
   * @param {number} monolithId 1, 2 o 3
   */
  hitSwordMonolith(monolithId) {
    if (this.swordPuzzle.solved) {
      return { success: true, finished: true, alreadySolved: true };
    }

    const stepIndex = this.swordPuzzle.stack.length;
    const expected = this.swordPuzzle.correctOrder[stepIndex];

    if (monolithId === expected) {
      this.swordPuzzle.stack.push(monolithId);

      if (this.swordPuzzle.stack.length === this.swordPuzzle.correctOrder.length) {
        this.swordPuzzle.solved = true;
        this.swordPuzzle.portalOpen = true;
        this.setSwordPortal(true);

        return { success: true, finished: true, stack: [...this.swordPuzzle.stack] };
      }

      return { success: true, finished: false, step: this.swordPuzzle.stack.length, stack: [...this.swordPuzzle.stack] };
    }

    // Orden incorrecto: Desbordamiento violento de pila (Stack Overflow)
    this.swordPuzzle.stack = [];
    return { success: false, error: 'STACK_OVERFLOW', stackOverflow: true, damage: 1, expected };
  }

  /**
   * Renderiza los 3 monolitos rúnicos, el indicador de pila y el portal de la arena.
   */
  renderSwordPuzzle(ctx, camera, withMonoliths = true) {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const t = performance.now() * 0.003;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 1. Monolitos Rúnicos: ordenados en Y por el pipeline 2.5D (withMonoliths = false)
    if (withMonoliths) {
      for (const mono of Object.values(this.swordPuzzle.monoliths)) {
        this.drawSwordMonolith(ctx, camera, mono);
      }
    }

    // 2. Indicador de Pila de Recursión en la parte superior
    const stackX = Math.round(11.5 * this.tileSize - camX);
    const stackY = Math.round(2.5 * this.tileSize - camY);

    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillRect(stackX - 45, stackY - 6, 90, 16);
    ctx.strokeStyle = this.swordPuzzle.portalOpen ? '#22c55e' : '#a855f7';
    ctx.strokeRect(stackX - 44.5, stackY - 5.5, 89, 15);

    const stackStr = this.swordPuzzle.stack.length > 0 ? this.swordPuzzle.stack.map(id => id === 3 ? 'λ_N' : id === 1 ? 'λ_0' : 'λ_ret').join(' -> ') : 'RAÍZ (VACÍA)';
    ctx.font = 'bold 5.5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.swordPuzzle.portalOpen ? '#4ade80' : '#c084fc';
    ctx.fillText(`PILA: [${stackStr}]`, stackX, stackY + 2);

    // 3. Efecto de vórtice dorado si el portal hacia el Guardián está abierto
    if (this.swordPuzzle.portalOpen) {
      const portX = Math.round(11.5 * this.tileSize - camX);
      const portY = Math.round(1.5 * this.tileSize - camY);

      const pulse = Math.sin(t * 6) * 3;
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(portX, portY, 14 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(253, 224, 71, 0.25)';
      ctx.fill();
    }

    ctx.restore();
  }

  /** Dibuja una runa/monolito del Templo de la Espada (estela de 12×18 px con halo si está en la pila). */
  drawSwordMonolith(ctx, camera, mono) {
    const isActiveInStack = this.swordPuzzle.stack.includes(mono.id);
    const mx = Math.round(mono.col * this.tileSize - camera.renderX);
    const my = Math.round(mono.row * this.tileSize - camera.renderY);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(mx + 2, my - 2, 12, 18);
    ctx.strokeStyle = isActiveInStack ? '#fde047' : '#64748b';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 2.5, my - 1.5, 11, 17);

    ctx.font = 'bold 7px monospace';
    ctx.fillStyle = isActiveInStack ? '#fde047' : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mono.symbol, mx + 8, my + 6);

    if (isActiveInStack) {
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.45)';
      ctx.strokeRect(mx, my - 4, 16, 22);
    }
    ctx.restore();
  }

  /** (FIX 2.3) Obelisco rúnico de las Minas: bit ya apilado en cian brillante. */
  drawMinesMonolith(ctx, camera, mono) {
    const struck = this.minesPuzzle.stack.includes(mono.id);
    const mx = Math.round(mono.col * this.tileSize - camera.renderX);
    const my = Math.round(mono.row * this.tileSize - camera.renderY);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(mx + 2, my - 2, 12, 18);
    ctx.strokeStyle = struck ? '#38bdf8' : '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 2.5, my - 1.5, 11, 17);

    ctx.font = 'bold 6.5px monospace';
    ctx.fillStyle = struck ? '#7dd3fc' : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mono.symbol, mx + 8, my + 6);

    if (struck) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.strokeRect(mx, my - 4, 16, 22);
    }
    ctx.restore();
  }

  _drawTile(ctx, tileId, screenX, screenY, offsetX = 0, offsetY = 0) {
    if (tileId >= 100) {
      this._drawTempleProceduralTile(ctx, tileId, screenX + offsetX, screenY + offsetY);
      return;
    }
    const sx = (tileId % this.tilesetCols) * this.tileSize * ATLAS_SCALE;
    const sy = Math.floor(tileId / this.tilesetCols) * this.tileSize * ATLAS_SCALE;
    ctx.drawImage(
      this.tilesetSheet,
      sx,
      sy,
      this.tileSize * ATLAS_SCALE,
      this.tileSize * ATLAS_SCALE,
      Math.round(screenX + offsetX),
      Math.round(screenY + offsetY),
      this.tileSize,
      this.tileSize
    );
  }

  /** Renderizado pixel-art procedural para las capas enriquecidas de los Templos (Tiled). */
  _drawTempleProceduralTile(ctx, tileId, screenX, screenY) {
    const x = Math.round(screenX);
    const y = Math.round(screenY);
    const t = this.animationClock;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (tileId === TEMPLE_TILES.BINARY_RUNE_CYAN) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + x * 0.08 + y * 0.06);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, 16, 16);
      ctx.strokeStyle = '#1e293b';
      ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
      ctx.strokeStyle = `rgba(56, 189, 248, ${(0.28 + pulse * 0.42).toFixed(3)})`;
      ctx.strokeRect(x + 2.5, y + 2.5, 11, 11);
      ctx.fillStyle = `rgba(103, 232, 249, ${(0.45 + pulse * 0.5).toFixed(3)})`;
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(((Math.floor(t * 1.2 + x + y)) % 2 === 0) ? '0' : '1', x + 8, y + 8);
      this._drawLightHalo(ctx, x + 8, y + 8, 12, '56, 189, 248', 0.06 + pulse * 0.08);
      ctx.restore();
      return;
    }

    if (tileId === TEMPLE_TILES.ABYSS_VOID) {
      const swirl = Math.sin(t * 2.1 + x * 0.1 + y * 0.1);
      ctx.fillStyle = '#02040a';
      ctx.fillRect(x, y, 16, 16);
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
      ctx.strokeStyle = `rgba(139, 92, 246, ${(0.22 + (swirl * 0.5 + 0.5) * 0.25).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x + 8, y + 8, 4.5 + swirl * 1.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.fillRect(x + 7 + Math.round(swirl * 2), y + 7, 1, 1);
      ctx.restore();
      return;
    }

    if (tileId === TEMPLE_TILES.COBWEB) {
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.42)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 15, y + 15);
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x + 15, y + 3);
      ctx.moveTo(x + 8, y);
      ctx.lineTo(x + 3, y + 15);
      ctx.arc(x + 2, y + 2, 6, 0, Math.PI * 0.5);
      ctx.arc(x + 2, y + 2, 11, 0, Math.PI * 0.5);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (tileId === TEMPLE_TILES.TORCH_UNLIT) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 6, y + 7, 4, 7);
      ctx.fillStyle = '#475569';
      ctx.fillRect(x + 7, y + 5, 2, 7);
      ctx.restore();
      return;
    }

    if (tileId === TEMPLE_TILES.TORCH_CYAN || tileId === TEMPLE_TILES.TORCH_AMBER) {
      const isCyan = tileId === TEMPLE_TILES.TORCH_CYAN;
      const flicker = Math.sin(t * 11 + x * 0.15 + y * 0.09);
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 6, y + 7, 4, 7);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 7, y + 6, 2, 7);
      ctx.fillStyle = isCyan ? '#06b6d4' : '#f97316';
      ctx.fillRect(x + 6 + Math.round(flicker * 0.6), y + 2, 4, 4);
      ctx.fillStyle = isCyan ? '#cffafe' : '#fde047';
      ctx.fillRect(x + 7 + Math.round(flicker * 0.6), y + 3, 2, 2);
      this._drawLightHalo(
        ctx,
        x + 8,
        y + 4,
        18,
        isCyan ? '34, 211, 238' : '251, 146, 60',
        0.16 + (flicker * 0.5 + 0.5) * 0.08
      );
      ctx.restore();
      return;
    }

    if (tileId === TEMPLE_TILES.CANDLE_CLUSTER) {
      const flk = Math.sin(t * 9 + x);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x + 4, y + 9, 2, 5);
      ctx.fillRect(x + 7, y + 7, 2, 7);
      ctx.fillRect(x + 10, y + 10, 2, 4);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(x + 4, y + 7 + Math.round(flk * 0.4), 2, 2);
      ctx.fillRect(x + 7, y + 5 - Math.round(flk * 0.4), 2, 2);
      ctx.fillRect(x + 10, y + 8, 2, 2);
      this._drawLightHalo(ctx, x + 8, y + 7, 14, '253, 224, 71', 0.14);
      ctx.restore();
      return;
    }

    if (tileId === TEMPLE_TILES.FLOATING_MONOLITH) {
      const bob = Math.sin(t * 2.2 + x * 0.07) * 2.2;
      const my = Math.round(y + bob);
      // Sombra proyectada en el abismo debajo
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x + 4, y + 13, 8, 2);
      // Obelisco levitante
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 4, my + 1, 8, 12);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(x + 4.5, my + 1.5, 7, 11);
      ctx.fillStyle = '#7dd3fc';
      ctx.fillRect(x + 7, my + 3, 2, 7);
      this._drawLightHalo(ctx, x + 8, my + 6, 16, '56, 189, 248', 0.18);
      ctx.restore();
      return;
    }

    if (tileId === TEMPLE_TILES.STATUE_KNIGHT) {
      // Plinto y estatua de caballero caído con espada partida
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 2, y + 11, 12, 4);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x + 4, y + 5, 8, 6);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x + 5, y + 2, 6, 4); // yelmo
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x + 11, y + 6, 2, 6); // espada apoyada
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x + 7, y + 3, 2, 1); // visera tenue
      ctx.restore();
      return;
    }

    if (tileId === TEMPLE_TILES.STATUE_SENTINEL) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 2, y + 11, 12, 4);
      ctx.fillStyle = '#475569';
      ctx.fillRect(x + 4, y + 4, 8, 7);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x + 5, y + 1, 6, 4);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x + 6, y + 2, 4, 1);
      ctx.fillRect(x + 7, y + 6, 2, 3);
      ctx.restore();
      return;
    }

    if (tileId === TEMPLE_TILES.BANNER_CYAN || tileId === TEMPLE_TILES.BANNER_CRIMSON) {
      const isCyan = tileId === TEMPLE_TILES.BANNER_CYAN;
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(x + 2, y + 1, 12, 2);
      ctx.fillStyle = isCyan ? '#0284c7' : '#991b1b';
      ctx.fillRect(x + 3, y + 3, 10, 10);
      ctx.fillStyle = isCyan ? '#7dd3fc' : '#f59e0b';
      ctx.fillRect(x + 7, y + 5, 2, 5);
      ctx.fillRect(x + 6, y + 6, 4, 2);
      ctx.restore();
      return;
    }

    ctx.restore();
  }
}

