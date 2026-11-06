import { TILES, ATLAS_SCALE } from '../graphics/SpriteSheetGenerator.js?v=8';
import { SpeechBubble } from '../ui/SpeechBubble.js?v=8';

/**
 * Tiles de la CAPA 2 (estructuras elevadas) del pipeline 2.5D: se dibujan siempre por encima
 * de las entidades (copas de árboles y tejados).
 */
const OVERHEAD_TILE_IDS = new Set([TILES.TREE_TOP, TILES.ROOF_RED, TILES.ROOF_BLUE]);

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

    // Estado de Puzles y Progresión de Mazmorras (v3.6+)
    this.quantumGate = { coresPlaced: { gc: false, stack: false, microwave: false } };
    // Solo el Dash Asíncrono lo activa mientras dura el impulso (abismos = colisión CHASM_COLLISION)
    this.allowChasmCrossing = false;

    this._buildFirstStageScene();
    this._buildNorthPeaksScene();
    this._buildSouthSwampScene();
    this._buildWestWastesScene();
    this._buildArmorTempleScene();
    this._buildSwordTempleScene();
    this._buildCondemnedRealmsScene();
    this._buildSewersEntryScene();
    this._buildSewersPuzzleScene();
    this._buildSewersDungeonScene();
    this._buildMinesEntryScene();
    this._buildMinesPuzzleScene();
    this._buildForgeEntryScene();
    this._buildForgePuzzleScene();
    this._buildFortressGateScene();
    this._buildQuantumGateScene();
    this._buildCitadelScene();
    this._buildOverworldScene();
    this._buildHouseInteriors();
    this.loadScene('overworld');
  }

  _createGrid(cols, rows, defaultValue) {
    return Array.from({ length: rows }, () =>
      new Array(cols).fill(defaultValue)
    );
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
    this.lightSources = scene.lightSources;

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
        if (deco[r][c] === TILES.WALL_WINDOW) {
          lights.push({
            x: c * this.tileSize + 8,
            y: r * this.tileSize + 9,
            radius: 26,
            intensity: 0.8,
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
    this.animTimer += dt;
    this.waterClock += dt;
    if (this.animTimer >= 0.45) {
      this.animTimer -= 0.45;
      this.animFrame = (this.animFrame + 1) % 2;
    }

    this._updateBridgeSchedule();
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
    }
  }

  /** Abre o sella el portal norte (columnas 11-12, fila 1) del Templo de la Espada. */
  setSwordPortal(open) {
    const temple = this.scenes.sword_temple;
    if (!temple || !temple.layers) return;
    for (const c of [11, 12]) {
      temple.layers.collision[1][c] = open ? 0 : 1;
      temple.layers.decoration[1][c] = open ? TILES.PORTAL_GATE_OPEN : TILES.PORTAL_GATE_CLOSED;
    }
  }

  isSolidAtTile(col, row) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
      return true;
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
      // Portal del Este hacia el Pueblo de Valleverde (retorno a la aldea pacífica)
      const gateX = 33 * this.tileSize;
      const gateY = 12.5 * this.tileSize;
      if (Math.hypot(player.centerX - gateX, player.centerY - gateY) <= 26) {
        return {
          type: 'stage_transition',
          targetScene: 'overworld',
          label: 'Regresar a la Aldea de Valleverde (Oeste)',
          worldX: gateX,
          worldY: gateY,
          spawnX: 30 * this.tileSize,
          spawnY: 12.5 * this.tileSize
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
          spawnY: 15 * this.tileSize
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
          spawnY: 15 * this.tileSize
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
      if (Math.hypot(player.centerX - northDoorX, player.centerY - northDoorY) <= 22) {
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
      if (Math.hypot(player.centerX - northDoorX, player.centerY - northDoorY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'sword_temple',
          label: 'Cruzar el Portal a la Cámara del Guardián del Stack Overflow',
          worldX: northDoorX,
          worldY: northDoorY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
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
      if (Math.hypot(player.centerX - northDoorX, player.centerY - northDoorY) <= 22) {
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

    if (
      this.currentSceneId === 'armor_temple' ||
      this.currentSceneId === 'sword_temple' ||
      this.currentSceneId === 'condemned_realms' ||
      this.currentSceneId === 'sewers_entry' ||
      this.currentSceneId === 'sewers_puzzle' ||
      this.currentSceneId === 'sewers_dungeon' ||
      this.currentSceneId === 'mines_entry' ||
      this.currentSceneId === 'mines_puzzle' ||
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
            spawnY: scene.exitDoor.returnY
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
          spawnY: 12.5 * this.tileSize
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
            spawnY: scene.exitDoor.returnY
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

  /**
   * Construye el Santuario de las Tierras Corruptas (Zona Malvada de las Pruebas Sagradas):
   * - Escenario sombrío con adoquines oscuros, antorchas de fuego espectral y reliquias del código antiguo.
   * - Bastión Oeste: Templo de la Armadura del Código Binario (Prueba de Lógica).
   * - Altar Sagrado del Norte: Templo de la Espada de la Recursividad (desbloqueado con Armadura).
   * - Portal del Este: Vórtice dimensional de retorno a la seguridad de la Aldea de Valleverde.
   */
  _buildFirstStageScene() {
    const cols = 36;
    const rows = 24;
    const ground = this._createGrid(cols, rows, TILES.STONE_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r * 11 + c * 7) % 3 === 0) {
          ground[r][c] = TILES.COBBLE;
        }
      }
    }

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            layer[r][c] = val;
          }
        }
      }
    };

    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    // 1. Red de Caminos de Piedra Sagrada conectando los templos del Héroe
    // Eje horizontal principal (conecta Templo Armadura, Altar Central y Portal Este a Valleverde)
    fillRect(ground, 6, 12, 28, 2, TILES.PATH);
    fillRect(ground, 6, 7, 2, 7, TILES.PATH);
    fillRect(ground, 17, 2, 2, 11, TILES.PATH);
    fillRect(ground, 15, 10, 6, 5, TILES.COBBLE);

    // 2. Templo Occidental: Templo de la Armadura Binaria (c = 6.5, r = 8.5)
    fillRect(ground, 4, 7, 6, 4, TILES.STONE_FLOOR);
    setDeco(4, 8, TILES.WALL_INTERIOR, true);
    setDeco(5, 8, TILES.WALL_INTERIOR, true);
    setDeco(6, 8, TILES.DOOR, false);
    setDeco(7, 8, TILES.WALL_INTERIOR, true);
    setDeco(8, 8, TILES.WALL_INTERIOR, true);
    setDeco(4, 9, TILES.LAMPPOST, true);
    setDeco(8, 9, TILES.LAMPPOST, true);
    setDeco(5, 10, TILES.SIGNPOST, false);
    lightSources.push(
      { x: 6.5 * 16, y: 8.5 * 16, radius: 56, intensity: 1.0, color: '#38bdf8' },
      { x: 4.5 * 16, y: 9.5 * 16, radius: 44, intensity: 0.85, color: '#38bdf8' },
      { x: 8.5 * 16, y: 9.5 * 16, radius: 44, intensity: 0.85, color: '#38bdf8' }
    );

    // 3. Templo Septentrional: Templo de la Espada de la Recursividad (c = 17.5, r = 2.5)
    fillRect(ground, 14, 1, 8, 4, TILES.STONE_FLOOR);
    setDeco(14, 2, TILES.WALL_INTERIOR, true);
    setDeco(15, 2, TILES.WALL_INTERIOR, true);
    setDeco(16, 2, TILES.WALL_INTERIOR, true);
    setDeco(17, 2, TILES.DOOR, false);
    setDeco(18, 2, TILES.WALL_INTERIOR, true);
    setDeco(19, 2, TILES.WALL_INTERIOR, true);
    setDeco(20, 2, TILES.WALL_INTERIOR, true);
    setDeco(15, 3, TILES.LAMPPOST, true);
    setDeco(19, 3, TILES.LAMPPOST, true);
    setDeco(16, 4, TILES.SIGNPOST, true);
    lightSources.push(
      { x: 17.5 * 16, y: 2.5 * 16, radius: 64, intensity: 1.0, color: '#f59e0b' },
      { x: 15.5 * 16, y: 3.5 * 16, radius: 46, intensity: 0.9, color: '#f59e0b' },
      { x: 19.5 * 16, y: 3.5 * 16, radius: 46, intensity: 0.9, color: '#f59e0b' }
    );

    // 4. Portal del Este (Retorno al Puente de la Aldea de Valleverde)
    for (let r = 10; r <= 15; r++) {
      if (r !== 12 && r !== 13) {
        setDeco(33, r, TILES.FENCE_POST, true);
      }
    }
    setDeco(33, 12, TILES.PORTAL_GATE_CLOSED, true);
    setDeco(33, 13, TILES.PORTAL_GATE_CLOSED, true);
    setDeco(32, 11, TILES.SIGNPOST, true);
    lightSources.push({ x: 33.5 * 16, y: 12.5 * 16, radius: 50, intensity: 0.9, color: '#38bdf8' });

    // 5. Letreros Informativos con Lore y Guía
    const signposts = [
      {
        c: 5,
        r: 10,
        shortName: 'Templo de la Armadura',
        title: '🛡️ Templo de la Armadura del Código Binario',
        lines: [
          '«TEMPLO OCCIDENTAL DEL VALLE · Santuario del Blindaje Metálico.»',
          '«Consagra aquí tu Armadura Binaria resolviendo los interruptores de paridad lógica antes de encarar los peligros del exterior.»'
        ]
      },
      {
        c: 16,
        r: 4,
        shortName: 'Templo de la Espada',
        title: '⚔️ Templo de la Espada de la Recursividad',
        lines: [
          '«TEMPLO SEPTENTRIONAL DEL VALLE · Altar Sagrado de la Recursión.»',
          '«(Requiere Armadura Binaria). Supera las runas del paso recursivo para empuñar la Espada de la Recursividad.»'
        ]
      },
      {
        c: 32,
        r: 11,
        shortName: 'Camino a Valleverde',
        title: '🪧 Portal Este · Regreso a Valleverde',
        lines: [
          '«← OESTE: Valle de la Consagración (Santuarios de la Armadura y la Espada).»',
          '«→ ESTE: Puente sobre el Río Alba hacia el Pueblo de Valleverde (Zona Pacífica y Tiendas).»'
        ]
      }
    ];

    // Árboles y rocas perimetrales
    const placeTree = (c, r) => {
      if (r >= 1 && r < rows && c >= 0 && c < cols) {
        setDeco(c, r - 1, TILES.TREE_TOP, true);
        setDeco(c, r, TILES.TREE_TRUNK, true);
      }
    };

    for (let c = 0; c < cols; c += 2) {
      if (c < 26 || c > 30) {
        placeTree(c, 1);
      }
      placeTree(c + 1, 23);
    }
    for (let r = 3; r < rows - 2; r += 2) {
      placeTree(1, r);
      if (r !== 11 && r !== 13) {
        placeTree(35, r);
      }
    }

    // Bosquecillos tácticos intermedios
    const tacticalTrees = [
      [11, 7], [12, 8], [22, 7], [23, 8],
      [11, 16], [12, 17], [22, 16], [23, 17],
      [25, 8], [28, 12]
    ];
    for (const [tc, tr] of tacticalTrees) {
      placeTree(tc, tr);
    }

    const flowers = [
      [15, 15], [19, 15], [7, 14], [16, 8], [18, 8], [26, 11], [26, 13]
    ];
    for (const [fc, fr] of flowers) {
      setDeco(fc, fr, TILES.FLOWERS_1, false);
    }

    this.scenes.first_stage = {
      title: 'Valle de la Consagración (Este)',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      signposts
    };
  }

  /**
   * ZONA NORTE: Las Cumbres de la Recursión (Picos de Silicio, Nieve y Minas de la Recursión).
   */
  _buildNorthPeaksScene() {
    const cols = 36;
    const rows = 24;
    const ground = this._createGrid(cols, rows, TILES.COBBLE);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r * 13 + c * 7) % 3 === 0) {
          ground[r][c] = TILES.STONE_FLOOR;
        }
      }
    }

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            layer[r][c] = val;
          }
        }
      }
    };

    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    // Camino central norte-sur desde el sur (Valleverde) hasta la entrada de las minas
    fillRect(ground, 16, 2, 4, 22, TILES.PATH);
    fillRect(ground, 14, 2, 8, 4, TILES.STONE_FLOOR);

    // Entrada a las Minas de la Recursión (c = 17.5, r = 3.5)
    setDeco(14, 2, TILES.WALL_INTERIOR, true);
    setDeco(15, 2, TILES.WALL_INTERIOR, true);
    setDeco(16, 2, TILES.WALL_INTERIOR, true);
    setDeco(17, 2, TILES.DOOR, false);
    setDeco(18, 2, TILES.DOOR, false);
    setDeco(19, 2, TILES.WALL_INTERIOR, true);
    setDeco(20, 2, TILES.WALL_INTERIOR, true);
    setDeco(21, 2, TILES.WALL_INTERIOR, true);

    setDeco(15, 3, TILES.LAMPPOST, true);
    setDeco(20, 3, TILES.LAMPPOST, true);
    setDeco(16, 4, TILES.SIGNPOST, true);

    // Luces de cristal cian de las cumbres
    lightSources.push(
      { x: 17.5 * 16, y: 3.5 * 16, radius: 64, intensity: 1.0, color: '#38bdf8' },
      { x: 15.5 * 16, y: 4.5 * 16, radius: 48, intensity: 0.9, color: '#06b6d4' },
      { x: 20.5 * 16, y: 4.5 * 16, radius: 48, intensity: 0.9, color: '#06b6d4' },
      { x: 17.5 * 16, y: 14 * 16, radius: 40, intensity: 0.8, color: '#38bdf8' }
    );

    // Monolitos de silicio en los flancos
    setDeco(10, 6, TILES.ANVIL, true);
    setDeco(25, 6, TILES.ANVIL, true);
    setDeco(8, 12, TILES.CRATE, true);
    setDeco(27, 12, TILES.CRATE, true);

    // Árboles perimetrales / rocas montañosas
    const placeTree = (c, r) => {
      if (r >= 1 && r < rows && c >= 0 && c < cols) {
        setDeco(c, r - 1, TILES.TREE_TOP, true);
        setDeco(c, r, TILES.TREE_TRUNK, true);
      }
    };

    for (let c = 0; c < cols; c += 2) {
      placeTree(c, 1);
      if (c < 15 || c > 20) {
        placeTree(c + 1, 23);
      }
    }
    for (let r = 2; r < rows - 1; r += 2) {
      placeTree(1, r);
      placeTree(2, r + 1);
      placeTree(33, r);
      placeTree(34, r + 1);
    }

    const signposts = [
      {
        c: 16,
        r: 4,
        shortName: 'Minas de la Recursión',
        title: '💎 Minas de la Recursión · Guardián del Stack Overflow',
        lines: [
          '«MINAS DE SILICIO · Morada del temible Guardián del Stack Overflow.»',
          '«Supera el gran abismo con el Dash [Shift] y derrota al guardián para conseguir el Núcleo Cian y fragmentos de Silicio.»'
        ]
      },
      {
        c: 19,
        r: 21,
        shortName: 'Camino a Valleverde',
        title: '🪧 Sendero Sur · Retorno a Valleverde',
        lines: [
          '«↓ SUR: Sendero montañoso que desciende hacia la pacífica Aldea de Valleverde.»',
          '«↑ NORTE: Ascenso a las Minas de la Recursión.»'
        ]
      }
    ];

    for (const sp of signposts) {
      setDeco(sp.c, sp.r, TILES.SIGNPOST, true);
    }

    this.scenes.north_peaks = {
      title: 'Las Cumbres de la Recursión (Norte)',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      signposts
    };
  }

  /**
   * ZONA SUR: Las Marismas del Hardware Legacy (Cloacas y La Forja del Prototipo).
   * Las sub-mazmorras se generan proceduralmente con DungeonGenerator.
   */
  _buildSouthSwampScene() {
    const cols = 36;
    const rows = 24;
    const ground = this._createGrid(cols, rows, TILES.DIRT);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r * 11 + c * 17) % 4 === 0) {
          ground[r][c] = TILES.COBBLE;
        }
      }
    }

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            layer[r][c] = val;
          }
        }
      }
    };

    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    // Camino central norte-sur desde el norte (Valleverde) y ramales a Suroeste y Sureste
    fillRect(ground, 16, 0, 4, 12, TILES.PATH);
    fillRect(ground, 8, 11, 20, 2, TILES.PATH);
    fillRect(ground, 7, 12, 3, 6, TILES.PATH);
    fillRect(ground, 25, 12, 3, 6, TILES.PATH);

    // Charcas de líquido tóxico
    for (let r = 6; r <= 8; r++) {
      for (let c = 5; c <= 7; c++) {
        ground[r][c] = TILES.WATER_1;
        collision[r][c] = 1;
      }
      for (let c = 27; c <= 29; c++) {
        ground[r][c] = TILES.WATER_1;
        collision[r][c] = 1;
      }
    }

    // 1. Entrada Suroeste: Cloacas del Legacy (c = 8.5, r = 14.5 · Garbage Collector)
    fillRect(ground, 6, 13, 5, 4, TILES.STONE_FLOOR);
    setDeco(6, 14, TILES.WALL_INTERIOR, true);
    setDeco(7, 14, TILES.WALL_INTERIOR, true);
    setDeco(8, 14, TILES.DOOR, false);
    setDeco(9, 14, TILES.WALL_INTERIOR, true);
    setDeco(10, 14, TILES.WALL_INTERIOR, true);
    setDeco(6, 15, TILES.LAMPPOST, true);
    setDeco(10, 15, TILES.LAMPPOST, true);

    lightSources.push(
      { x: 8.5 * 16, y: 14.5 * 16, radius: 56, intensity: 1.0, color: '#22c55e' },
      { x: 6.5 * 16, y: 15.5 * 16, radius: 44, intensity: 0.85, color: '#22c55e' },
      { x: 10.5 * 16, y: 15.5 * 16, radius: 44, intensity: 0.85, color: '#22c55e' }
    );

    // 2. Entrada Sureste: La Forja del Prototipo (c = 26.5, r = 14.5 · Microondas)
    fillRect(ground, 24, 13, 5, 4, TILES.STONE_FLOOR);
    setDeco(24, 14, TILES.WALL_INTERIOR, true);
    setDeco(25, 14, TILES.WALL_INTERIOR, true);
    setDeco(26, 14, TILES.DOOR, false);
    setDeco(27, 14, TILES.WALL_INTERIOR, true);
    setDeco(28, 14, TILES.WALL_INTERIOR, true);
    setDeco(24, 15, TILES.LAMPPOST, true);
    setDeco(28, 15, TILES.LAMPPOST, true);

    lightSources.push(
      { x: 26.5 * 16, y: 14.5 * 16, radius: 56, intensity: 1.0, color: '#f97316' },
      { x: 24.5 * 16, y: 15.5 * 16, radius: 44, intensity: 0.85, color: '#f97316' },
      { x: 28.5 * 16, y: 15.5 * 16, radius: 44, intensity: 0.85, color: '#f97316' }
    );

    // Perímetro arbolado / ciénaga
    const placeTree = (c, r) => {
      if (r >= 1 && r < rows && c >= 0 && c < cols) {
        setDeco(c, r - 1, TILES.TREE_TOP, true);
        setDeco(c, r, TILES.TREE_TRUNK, true);
      }
    };

    for (let c = 0; c < cols; c += 2) {
      if (c < 15 || c > 20) {
        placeTree(c, 1);
      }
      placeTree(c + 1, 23);
    }
    for (let r = 2; r < rows - 1; r += 2) {
      placeTree(1, r);
      placeTree(2, r + 1);
      placeTree(33, r);
      placeTree(34, r + 1);
    }

    const signposts = [
      {
        c: 7,
        r: 16,
        shortName: 'Cloacas del Legacy',
        title: '☣️ Cloacas del Legacy · Garbage Collector',
        lines: [
          '«DESAGÜE SUBTERRÁNEO · Dominio del Garbage Collector Furioso.»',
          '«Purga al monstruo de memoria para conseguir el Núcleo Verde y el Dash Asíncrono [Shift].»'
        ]
      },
      {
        c: 25,
        r: 16,
        shortName: 'La Forja del Prototipo',
        title: '🔥 La Forja del Prototipo · Microondas',
        lines: [
          '«CALDERAS TÉRMICAS · Dominio del Microondas Prototipo V0.1 Alpha.»',
          '«Requiere Blindaje Térmico de Brom. Custodia el Núcleo Carmesí para la Espada Overclockeada.»'
        ]
      },
      {
        c: 19,
        r: 3,
        shortName: 'Camino a Valleverde',
        title: '🪧 Sendero Norte · Retorno a Valleverde',
        lines: [
          '«↑ NORTE: Sendero principal de regreso a la seguridad de la Aldea de Valleverde.»',
          '«↙ SUROESTE: Cloacas del Legacy. ↘ SURESTE: La Forja del Prototipo.»'
        ]
      }
    ];

    for (const sp of signposts) {
      setDeco(sp.c, sp.r, TILES.SIGNPOST, true);
    }

    this.scenes.south_swamp = {
      title: 'Las Marismas del Hardware Legacy (Sur)',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      signposts
    };
  }

  /**
   * ZONA OESTE: El Páramo Corrupto de Mister AI Alex (Gran Puerta del Núcleo Cuántico).
   */
  _buildWestWastesScene() {
    const cols = 36;
    const rows = 24;
    const ground = this._createGrid(cols, rows, TILES.STONE_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r * 7 + c * 19) % 3 === 0) {
          ground[r][c] = TILES.COBBLE;
        }
      }
    }

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            layer[r][c] = val;
          }
        }
      }
    };

    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    // Camino Este-Oeste desde el Este (Valleverde) hasta la Gran Puerta del Núcleo Cuántico
    fillRect(ground, 8, 12, 28, 2, TILES.PATH);
    fillRect(ground, 6, 10, 6, 6, TILES.STONE_FLOOR);

    // Gran Puerta del Núcleo Cuántico (c = 8.5, r = 12.5)
    setDeco(6, 11, TILES.WALL_INTERIOR, true);
    setDeco(7, 11, TILES.WALL_INTERIOR, true);
    setDeco(8, 11, TILES.PORTAL_GATE_OPEN, false);
    setDeco(9, 11, TILES.PORTAL_GATE_OPEN, false);
    setDeco(10, 11, TILES.WALL_INTERIOR, true);
    setDeco(11, 11, TILES.WALL_INTERIOR, true);

    setDeco(6, 12, TILES.LAMPPOST, true);
    setDeco(11, 12, TILES.LAMPPOST, true);
    setDeco(8, 14, TILES.SIGNPOST, true);

    lightSources.push(
      { x: 8.5 * 16, y: 12.5 * 16, radius: 70, intensity: 1.0, color: '#a855f7' },
      { x: 6.5 * 16, y: 12.5 * 16, radius: 48, intensity: 0.9, color: '#ef4444' },
      { x: 11.5 * 16, y: 12.5 * 16, radius: 48, intensity: 0.9, color: '#ef4444' }
    );

    // Columnas y escombros del páramo
    setDeco(16, 8, TILES.ANVIL, true);
    setDeco(22, 16, TILES.ANVIL, true);
    setDeco(18, 16, TILES.CRATE, true);
    setDeco(24, 8, TILES.CRATE, true);

    // Árboles perimetrales oscuros
    const placeTree = (c, r) => {
      if (r >= 1 && r < rows && c >= 0 && c < cols) {
        setDeco(c, r - 1, TILES.TREE_TOP, true);
        setDeco(c, r, TILES.TREE_TRUNK, true);
      }
    };

    for (let c = 0; c < cols; c += 2) {
      placeTree(c, 1);
      placeTree(c + 1, 23);
    }
    for (let r = 2; r < rows - 1; r += 2) {
      placeTree(1, r);
      placeTree(2, r + 1);
      if (r < 11 || r > 14) {
        placeTree(34, r);
        placeTree(35, r + 1);
      }
    }

    const signposts = [
      {
        c: 8,
        r: 14,
        shortName: 'Gran Puerta del Núcleo',
        title: '🌌 Gran Puerta del Núcleo Cuántico · Antesala a la Ciudadela',
        lines: [
          '«PORTAL DE ACCESO A LA CIUDADELA CUÁNTICA DE MISTER AI ALEX.»',
          '«Solo quien coloque los 3 Núcleos de Mazmorra (Verde, Cian y Carmesí) franqueará el cortafuegos hacia El Gran Ojal.»'
        ]
      },
      {
        c: 32,
        r: 11,
        shortName: 'Camino a Valleverde',
        title: '🪧 Frontera Este · Retorno a Valleverde',
        lines: [
          '«→ ESTE: Camino protegido hacia la Aldea de Valleverde.»',
          '«← OESTE: La Gran Puerta del Núcleo Cuántico y la Ciudadela Final de AI Alex.»'
        ]
      }
    ];

    for (const sp of signposts) {
      setDeco(sp.c, sp.r, TILES.SIGNPOST, true);
    }

    this.scenes.west_wastes = {
      title: 'Páramo Corrupto de Mister AI Alex (Oeste)',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      signposts
    };
  }

  _buildOverworldScene() {
    const cols = 36;
    const rows = 24;
    const ground = this._createGrid(cols, rows, TILES.GRASS_1);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r * 7 + c * 13) % 5 === 0) {
          ground[r][c] = TILES.GRASS_2;
        }
      }
    }

    const fillRect = (layer, c0, r0, w, h, value) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            layer[r][c] = value;
          }
        }
      }
    };

    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    // Río en el este
    for (let r = 0; r < rows; r++) {
      const riverCol = 28 + Math.round(Math.sin(r * 0.35));
      for (let w = 0; w < 3; w++) {
        const c = riverCol + w;
        ground[r][c] = TILES.WATER_1;
        collision[r][c] = 1;
      }
    }

    // Plaza central adoquinada
    fillRect(ground, 13, 9, 9, 7, TILES.COBBLE);

    // Caminos principales (Camino Oeste extendido hasta el borde c=0 sin árboles para ver la salida)
    fillRect(ground, 0, 12, 33, 2, TILES.PATH);
    fillRect(ground, 2, 11, 2, 2, TILES.PATH); // Conexión a la Casa del Programador
    fillRect(ground, 31, 12, 6, 2, TILES.PATH); // Conexión este hacia las Pruebas Sagradas
    fillRect(ground, 34, 6, 2, 14, TILES.PATH); // Camino norte-sur a los Templos Sagrados al este
    fillRect(ground, 13, 9, 9, 7, TILES.COBBLE);

    // Puente sobre el río (filas 12 y 13)
    for (let r = 12; r <= 13; r++) {
      for (let c = 27; c <= 31; c++) {
        if (ground[r][c] === TILES.WATER_1 || c === 28 || c === 29 || c === 30) {
          ground[r][c] = TILES.BRIDGE;
          collision[r][c] = 0;
        }
      }
    }

    // Barrera de precinto inicial en el puente del este (filas 12 y 13, col 27)
    for (let r = 12; r <= 13; r++) {
      decoration[r][27] = TILES.BRIDGE_GATE;
      collision[r][27] = 1;
    }

    // Camino Norte-Sur (extendiéndose de borde a borde para conectar Cumbres Norte y Marismas Sur)
    fillRect(ground, 17, 0, 2, 24, TILES.PATH);
    fillRect(ground, 13, 9, 9, 7, TILES.COBBLE);
    fillRect(ground, 8, 7, 2, 5, TILES.PATH);
    fillRect(ground, 15, 7, 2, 2, TILES.PATH);
    fillRect(ground, 23, 7, 2, 5, TILES.PATH);
    fillRect(ground, 7, 19, 2, 2, TILES.PATH);
    fillRect(ground, 7, 14, 2, 2, TILES.PATH);
    fillRect(ground, 19, 19, 4, 2, TILES.PATH);
    fillRect(ground, 18, 19, 2, 2, TILES.PATH);

    // === PLAZA SUR DE VALLEVERDE (ZONA PACÍFICA DE DESCANSO) ===
    fillRect(ground, 11, 20, 4, 2, TILES.COBBLE);
    fillRect(ground, 15, 20, 3, 2, TILES.PATH);
    setDeco(12, 20, TILES.FLOWERS_1, false);
    setDeco(13, 20, TILES.FLOWERS_1, false);

    // === MERCADO CENTRAL DE LA PLAZA DE VALLEVERDE ===
    // Puestos despejados: toldo en fila 8/13 (Capa 3 overhead), vendedor visible en fila 9/14, mostrador en fila 10/15
    // 1. Puesto Noroeste: Panadería y Frutas de Clara
    setDeco(14, 8, TILES.ROOF_RED, true);
    setDeco(15, 8, TILES.ROOF_RED, true);
    setDeco(14, 10, TILES.TABLE, true);
    setDeco(15, 10, TILES.TABLE, true);
    setDeco(13, 10, TILES.CRATE, true);
    setDeco(13, 9, TILES.LAMPPOST, true);

    // 2. Puesto Noreste: Tienda de Software de Byte
    setDeco(19, 8, TILES.ROOF_BLUE, true);
    setDeco(20, 8, TILES.ROOF_BLUE, true);
    setDeco(19, 10, TILES.TABLE, true);
    setDeco(20, 10, TILES.TABLE, true);
    setDeco(21, 10, TILES.CRATE, true);
    setDeco(21, 9, TILES.LAMPPOST, true);

    // 3. Puesto Suroeste: Alquimia y Pociones de Pip
    setDeco(14, 13, TILES.ROOF_BLUE, true);
    setDeco(15, 13, TILES.ROOF_BLUE, true);
    setDeco(14, 15, TILES.TABLE, true);
    setDeco(15, 15, TILES.TABLE, true);
    setDeco(13, 15, TILES.CRATE, true);
    setDeco(13, 14, TILES.LAMPPOST, true);

    // 4. Puesto Sureste: Pescadería de Finn
    setDeco(19, 13, TILES.ROOF_RED, true);
    setDeco(20, 13, TILES.ROOF_RED, true);
    setDeco(19, 15, TILES.TABLE, true);
    setDeco(20, 15, TILES.TABLE, true);
    setDeco(21, 15, TILES.CRATE, true);
    setDeco(21, 14, TILES.LAMPPOST, true);

    // Pozo central y flores de la plaza
    setDeco(17, 12, TILES.WELL, true);
    setDeco(16, 13, TILES.FLOWERS_1, false);
    setDeco(18, 13, TILES.FLOWERS_1, false);

    // Luces de los faroles de los puestos del mercado
    lightSources.push(
      { x: 13 * this.tileSize + 8, y: 9 * this.tileSize + 4, radius: 44, intensity: 0.95 },
      { x: 21 * this.tileSize + 8, y: 9 * this.tileSize + 4, radius: 44, intensity: 0.95 },
      { x: 13 * this.tileSize + 8, y: 14 * this.tileSize + 4, radius: 44, intensity: 0.95 },
      { x: 21 * this.tileSize + 8, y: 14 * this.tileSize + 4, radius: 44, intensity: 0.95 }
    );

    this.houseDoors = [];

    // === HOGARES Y EDIFICIOS DE VALLEVERDE (CADA UNO CON SU PROPIA VERSIÓN ARQUITECTÓNICA ÚNICA) ===
    // 1. Casa del Programador (Tu Hogar): cabaña acogedora de madera con tejado a dos aguas rojo, macetero y leñera
    for (let r = 8; r <= 9; r++) {
      for (let c = 2; c <= 6; c++) {
        setDeco(c, r, TILES.ROOF_RED, true);
      }
    }
    setDeco(2, 10, TILES.WALL_WOOD, true);
    setDeco(3, 10, TILES.WALL_WINDOW, true);
    setDeco(4, 10, TILES.WALL_DOOR, true);
    setDeco(5, 10, TILES.WALL_WINDOW, true);
    setDeco(6, 10, TILES.WALL_WOOD, true);
    setDeco(2, 11, TILES.CRATE, true);
    setDeco(3, 11, TILES.FLOWERS_1, false);
    ground[11][4] = TILES.PATH;
    setDeco(6, 11, TILES.FLOWERS_2, false);
    this.houseDoors.push({
      sceneId: 'player_house',
      label: 'Casa del Programador (Tu Hogar)',
      ownerName: 'Tú (Programador)',
      doorCol: 4,
      doorRow: 10,
      worldX: 4 * this.tileSize + 8,
      worldY: 11 * this.tileSize + 2,
      returnX: 4 * this.tileSize,
      returnY: 11 * this.tileSize + 2,
      interiorSpawnX: 5.5 * this.tileSize,
      interiorSpawnY: 6 * this.tileSize
    });

    // 2. Mansión del Sabio Aurelio: residencia señorial con columnas de piedra, doble ventana y tejado de pizarra azul
    for (let r = 3; r <= 4; r++) {
      for (let c = 6; c <= 11; c++) {
        setDeco(c, r, TILES.ROOF_BLUE, true);
      }
    }
    setDeco(6, 5, TILES.WALL_WOOD, true);
    setDeco(7, 5, TILES.WALL_WINDOW, true);
    setDeco(8, 5, TILES.WALL_DOOR, true);
    setDeco(9, 5, TILES.WALL_WINDOW, true);
    setDeco(10, 5, TILES.WALL_WINDOW, true);
    setDeco(11, 5, TILES.WALL_WOOD, true);
    setDeco(6, 6, TILES.TEMPLE_PILLAR, true);
    setDeco(7, 6, TILES.FLOWERS_1, false);
    ground[6][8] = TILES.COBBLE;
    ground[7][8] = TILES.PATH;
    setDeco(10, 6, TILES.FLOWERS_2, false);
    setDeco(11, 6, TILES.TEMPLE_PILLAR, true);
    this.houseDoors.push({
      sceneId: 'elder_house',
      label: 'Casa de Aurelio (Cronista)',
      ownerName: 'Anciano Aurelio',
      doorCol: 8,
      doorRow: 5,
      worldX: 8 * this.tileSize + 8,
      worldY: 6 * this.tileSize + 2,
      returnX: 8 * this.tileSize,
      returnY: 6 * this.tileSize + 2,
      interiorSpawnX: 5.5 * this.tileSize,
      interiorSpawnY: 6 * this.tileSize
    });

    // 3. Observatorio de Orion: torre technomántica de piedra pulida con portal lumínico y cúpula azul
    for (let r = 3; r <= 4; r++) {
      for (let c = 13; c <= 16; c++) {
        setDeco(c, r, TILES.ROOF_BLUE, true);
      }
    }
    setDeco(13, 5, TILES.WALL_INTERIOR, true);
    setDeco(14, 5, TILES.WALL_DOOR, true);
    setDeco(15, 5, TILES.WALL_WINDOW, true);
    setDeco(16, 5, TILES.WALL_INTERIOR, true);
    setDeco(13, 6, TILES.CRATE, true);
    ground[6][14] = TILES.PATH;
    setDeco(16, 6, TILES.LAMPPOST, true);
    this.houseDoors.push({
      sceneId: 'oracle_house',
      label: 'Observatorio de Orion (IA)',
      ownerName: 'Oráculo Orion [IA]',
      doorCol: 14,
      doorRow: 5,
      worldX: 14 * this.tileSize + 8,
      worldY: 6 * this.tileSize + 2,
      returnX: 14 * this.tileSize,
      returnY: 6 * this.tileSize + 2,
      interiorSpawnX: 5.5 * this.tileSize,
      interiorSpawnY: 6 * this.tileSize
    });

    // 4. Herrería y Forja de Brom: taller industrial con chimenea exterior, patio de adoquín y YUNQUE permanente
    for (let r = 4; r <= 5; r++) {
      for (let c = 21; c <= 25; c++) {
        setDeco(c, r, TILES.ROOF_RED, true);
      }
    }
    setDeco(21, 6, TILES.WALL_WOOD, true);
    setDeco(22, 6, TILES.WALL_DOOR, true);
    setDeco(23, 6, TILES.WALL_WINDOW, true);
    setDeco(24, 6, TILES.WALL_WOOD, true);
    setDeco(25, 6, TILES.FIREPLACE, true); // Horno de forja en fachada
    // Patio empedrado del herrero
    fillRect(ground, 24, 5, 3, 3, TILES.COBBLE);
    setDeco(24, 5, TILES.CRATE, true);
    setDeco(26, 5, TILES.CRATE, true);
    setDeco(26, 6, TILES.ANVIL, true); // El Yunque de trabajo
    ground[7][22] = TILES.PATH;
    this.houseDoors.push({
      sceneId: 'blacksmith_house',
      label: 'Herrería de Brom (Forjador)',
      ownerName: 'Herrero Brom',
      doorCol: 22,
      doorRow: 6,
      worldX: 22 * this.tileSize + 8,
      worldY: 7 * this.tileSize + 2,
      returnX: 22 * this.tileSize,
      returnY: 7 * this.tileSize + 2,
      interiorSpawnX: 5.5 * this.tileSize,
      interiorSpawnY: 6 * this.tileSize
    });

    // 5. Cabaña Botánica de Lyra: casa rústica con huerto alquímico vallado, bancales de flores y alambique
    for (let r = 16; r <= 17; r++) {
      for (let c = 4; c <= 8; c++) {
        setDeco(c, r, TILES.ROOF_RED, true);
      }
    }
    setDeco(4, 18, TILES.WALL_WINDOW, true);
    setDeco(5, 18, TILES.WALL_WOOD, true);
    setDeco(6, 18, TILES.WALL_DOOR, true);
    setDeco(7, 18, TILES.WALL_WINDOW, true);
    setDeco(8, 18, TILES.WALL_WOOD, true);
    // Jardín botánico vallado
    setDeco(4, 19, TILES.FENCE_POST, true);
    setDeco(5, 19, TILES.FLOWERS_1, false);
    ground[19][6] = TILES.PATH;
    setDeco(7, 19, TILES.FLOWERS_2, false);
    setDeco(8, 19, TILES.FENCE_POST, true);
    setDeco(4, 20, TILES.FENCE_H, true);
    setDeco(5, 20, TILES.FLOWERS_2, false);
    ground[20][6] = TILES.PATH;
    setDeco(7, 20, TILES.FLOWERS_1, false);
    setDeco(8, 20, TILES.FENCE_H, true);
    this.houseDoors.push({
      sceneId: 'herbalist_house',
      label: 'Cabaña de Lyra (Alquimista)',
      ownerName: 'Herbolaria Lyra',
      doorCol: 6,
      doorRow: 18,
      worldX: 6 * this.tileSize + 8,
      worldY: 19 * this.tileSize + 2,
      returnX: 6 * this.tileSize,
      returnY: 19 * this.tileSize + 2,
      interiorSpawnX: 5.5 * this.tileSize,
      interiorSpawnY: 6 * this.tileSize
    });

    // 6. Cuartel de Kael y Campo de Entrenamiento del Binario:
    // Barracón militar fortificado con rejas de hierro y campo de sparring vallado
    for (let r = 16; r <= 17; r++) {
      for (let c = 20; c <= 24; c++) {
        setDeco(c, r, TILES.ROOF_BLUE, true);
      }
    }
    setDeco(20, 18, TILES.WALL_WOOD, true);
    setDeco(21, 18, TILES.JAIL_BARS, true);
    setDeco(22, 18, TILES.WALL_DOOR, true);
    setDeco(23, 18, TILES.WALL_WINDOW, true);
    setDeco(24, 18, TILES.WALL_WOOD, true);
    setDeco(21, 19, TILES.CRATE, true);
    ground[19][22] = TILES.PATH;
    // Ring de arena del Campo de Entrenamiento del Binario
    fillRect(ground, 22, 19, 5, 4, TILES.PATH);
    setDeco(23, 19, TILES.FENCE_H, true);
    setDeco(24, 19, TILES.FENCE_H, true);
    setDeco(25, 19, TILES.FENCE_H, true);
    setDeco(26, 19, TILES.FENCE_POST, true);
    setDeco(26, 20, TILES.FENCE_POST, true);
    setDeco(26, 21, TILES.FENCE_POST, true);
    setDeco(26, 22, TILES.FENCE_POST, true);
    setDeco(25, 22, TILES.FENCE_H, true);
    setDeco(24, 22, TILES.FENCE_H, true);
    setDeco(23, 22, TILES.FENCE_H, true);
    setDeco(22, 22, TILES.FENCE_POST, true);
    this.houseDoors.push({
      sceneId: 'guard_house',
      label: 'Cuartel de Kael (Capitán)',
      ownerName: 'Guardia Kael',
      doorCol: 22,
      doorRow: 18,
      worldX: 22 * this.tileSize + 8,
      worldY: 19 * this.tileSize + 2,
      returnX: 22 * this.tileSize,
      returnY: 19 * this.tileSize + 2,
      interiorSpawnX: 5.5 * this.tileSize,
      interiorSpawnY: 6 * this.tileSize
    });

    // === ARCO DE SALIDA AL VALLE DE LOS TEMPLOS (AL ESTE DEL PUENTE) ===
    setDeco(33, 11, TILES.LAMPPOST, true);
    setDeco(33, 14, TILES.LAMPPOST, true);
    setDeco(34, 12, TILES.PORTAL_GATE_OPEN, true);
    setDeco(34, 13, TILES.PORTAL_GATE_OPEN, true);
    lightSources.push({
      x: 34.5 * this.tileSize,
      y: 12.5 * this.tileSize,
      radius: 50,
      intensity: 0.95,
      color: '#38bdf8'
    });

    setDeco(20, 6, TILES.CRATE, true);

    // Corral central / Jardín municipal
    for (let c = 11; c <= 14; c++) {
      setDeco(c, 16, TILES.FENCE_H, true);
      setDeco(c, 19, TILES.FENCE_H, true);
    }
    setDeco(11, 17, TILES.FENCE_POST, true);
    setDeco(14, 17, TILES.FENCE_POST, true);
    setDeco(14, 18, TILES.FENCE_POST, true);

    const flowerCoords = [
      [12, 17], [13, 17], [12, 18], [13, 18],
      [20, 8], [25, 15], [32, 10], [33, 14]
    ];
    for (const [fc, fr] of flowerCoords) {
      setDeco(fc, fr, TILES.FLOWERS_1, false);
    }

    // Farolas
    const lampposts = [
      [13, 9], [21, 9], [13, 14], [21, 14],
      [8, 11], [26, 11], [32, 11]
    ];
    for (const [lc, lr] of lampposts) {
      setDeco(lc, lr, TILES.LAMPPOST, true);
      lightSources.push({
        x: lc * this.tileSize + 8,
        y: lr * this.tileSize + 4,
        radius: 48,
        intensity: 1.0
      });
    }

    // === LETREROS DE SEÑALIZACIÓN VISIBLES DE TIENDAS Y CAMINOS ===
    const signposts = [
      // 1. Tienda de Panadería de Clara
      {
        c: 13,
        r: 11,
        shortName: 'Panadería Clara',
        title: '🪧 [MERCADO] Panadería y Frutas de Clara · Alimentos & Fruta [Comprar / Vender]',
        lines: [
          '«Panadería y Frutas de Clara: Pan campesino recién horneado, manzanas jugosas y pasteles de bayas.»',
          '«¡Acércate a Clara tras el mostrador para comprar provisiones o vender tus cosechas!»'
        ]
      },
      // 2. Tienda de Software de Byte
      {
        c: 21,
        r: 11,
        shortName: 'Almacén Byte',
        title: '🪧 [TIENDA] Almacén de Byte · Software & Café [Comprar / Vender]',
        lines: [
          '«Almacén de Dependencias de Byte: Café Compilado, Parches Hotfix y optimizaciones de software.»',
          '«¡Acércate a Byte tras el mostrador para adquirir mejoras o vender chatarra de silicio!»'
        ]
      },
      // 3. Botica de Pip
      {
        c: 13,
        r: 16,
        shortName: 'Botica de Pip',
        title: '🪧 [BOTICA] Pociones de Pip · Herboristería [Pociones & Remedios]',
        lines: [
          '«Herboristería y Pociones de Pip: Elixires herbales, brebajes curativos y ungüentos anti-robotización.»',
          '«¡Acércate a Pip tras el mostrador para reponer tus pociones!»'
        ]
      },
      // 4. Pescadería de Finn
      {
        c: 21,
        r: 16,
        shortName: 'Pescadería Finn',
        title: '🪧 [PESCADERÍA] Muelle de Finn · Pescado del Río Alba [Comprar / Vender]',
        lines: [
          '«Pescadería de Finn: Truchas plateadas y salmones frescos pescados en el Río Alba.»',
          '«¡Acércate a Finn tras el mostrador para vender capturas de pesca o comprar pescado fresco!»'
        ]
      },
      // 5. Forja de Brom
      {
        c: 23,
        r: 7,
        shortName: 'Forja de Brom',
        title: '🪧 [FORJA] Taller de Brom · Forja de Espadas y Armaduras [Mejora & Venta]',
        lines: [
          '«Maestro Forjador Brom: Forjado de Espada de Silicio, Espada Overclockeada y Blindaje Térmico.»',
          '«Brom trabaja incansablemente en su yunque exterior durante las horas diurnas.»'
        ]
      },
      // 6. Invernadero de Lyra
      {
        c: 9,
        r: 18,
        shortName: 'Invernadero Lyra',
        title: '🪧 [BOTICA] Invernadero de Lyra · Alquimia & Silicio [Pociones & Remedios]',
        lines: [
          '«Cabaña Botánica y Alambique de Lyra: Recolección de Flores de Silicio y elixires mágicos.»',
          '«Lyra cuida sus plantas y atiende a los viajeros en su huerto aromático.»'
        ]
      },
      // 7. Campo de Entrenamiento del Binario
      {
        c: 20,
        r: 18,
        shortName: 'Campo Entrenamiento',
        title: '🪧 [CUARTEL] Guardia del Binario · Campo de Entrenamiento [Práctica & Nivel]',
        lines: [
          '«Campo de Entrenamiento de Valleverde: Área cercada para combate de práctica militar.»',
          '«¡Derrota los drones y bugs de prueba para ganar experiencia (XP) y subir de nivel antes de partir!»'
        ]
      },
      // 8. Casa del Programador
      {
        c: 5,
        r: 11,
        shortName: 'Tu Hogar',
        title: '🪧 [HOGAR] Casa del Programador · Tu Refugio',
        lines: [
          '«Tu residencia en Valleverde. Usa tu cama en el interior con [E] para descansar y cambiar el ciclo día/noche.»',
          '«Dormir purga al 100% la robotización binaria y restaura tu salud y energía.»'
        ]
      },
      // 9. Mansión de Aurelio
      {
        c: 9,
        r: 6,
        shortName: 'Mansión Aurelio',
        title: '🪧 [ARCHIVO] Mansión del Sabio Aurelio · Cronista de Valleverde',
        lines: [
          '«Residencia y archivo histórico del Gran Sabio Aurelio. Consulta la crónica del Reino y tramita el Pase del Puente.»'
        ]
      },
      // 10. Observatorio de Orion
      {
        c: 15,
        r: 6,
        shortName: 'Torre de Orion',
        title: '🪧 [OBSERVATORIO] Torre de Orion · Astrología Cuántica e IA',
        lines: [
          '«Observatorio Astronómico y Computacional del Oráculo Orion [IA]. Consulta predicciones y charla con la IA.»'
        ]
      },
      // 11. Frontera Oeste
      {
        c: 4,
        r: 11,
        shortName: 'Frontera Oeste',
        title: '🪧 Frontera Oeste · Páramo de Mister AI Alex',
        lines: [
          '«← OESTE: Camino al Páramo Corrupto de Mister AI Alex y la Gran Puerta del Núcleo Cuántico.»',
          '«¡PRECAUCIÓN! Más allá de los límites protegidos de Valleverde acechan drones y anomalías corruptas. Requieres equipo completo.»'
        ]
      },
      // 12. Puente Este
      {
        c: 26,
        r: 11,
        shortName: 'Puente Este',
        title: '🪧 Camino Este · Puente sobre el Río Alba',
        lines: [
          '«→ ESTE: Puente hacia el Valle de la Consagración.»',
          '«Conduce a los Santuarios Sagrados de la Armadura Binaria y la Espada de la Recursividad.»',
          '«(Valleverde es una aldea pacífica de descanso. El entrenamiento se realiza en el cuartel sur).»'
        ]
      },
      // 13. Plaza Central
      {
        c: 16,
        r: 12,
        shortName: 'Plaza Mayor (Mercado)',
        title: '🪧 Plaza Mayor de Valleverde · Mercado Central',
        lines: [
          '«¡Bienvenido al Mercado Central de Valleverde! Puestos disponibles:»',
          '«• Noreste: Tienda de Software de Byte (Café Compilado y Parches Hotfix).»',
          '«• Noroeste: Panadería de Clara (Pan Campesino y Manzanas frescas).»',
          '«• Suroeste: Alquimia de Pip (Pociones Herbales y Ungüentos).»',
          '«• Sureste: Pescadería de Finn (Truchas plateadas y Agua fresca).»',
          '«← Oeste: Casa del Programador. ↑ Norte: Casa del Sabio. ↓ Sur: Cuartel y Campo de Entrenamiento.»'
        ]
      },
      {
        c: 16,
        r: 7,
        shortName: 'Cruce Norte',
        title: '🪧 Cruce Norte de Valleverde · Cumbres de la Recursión',
        lines: [
          '«↑ NORTE: Ascenso a las Cumbres de la Recursión (Picos de Silicio y Minas de la Recursión).»',
          '«← Casa del Sabio Aurelio. → Herrería de Brom.»'
        ]
      },
      {
        c: 18,
        r: 17,
        shortName: 'Cruce Sur',
        title: '🪧 Cruce Sur de Valleverde · Marismas del Hardware Legacy',
        lines: [
          '«↓ SUR: Descenso a las Marismas del Hardware Legacy (Cloacas y La Forja del Prototipo).»',
          '«← Cabaña de Lyra. → Cuartel de Kael y Campo de Entrenamiento.»'
        ]
      },
      {
        c: 10,
        r: 20,
        shortName: 'Jardín Sur',
        title: '🪧 Jardín Sur de Valleverde',
        lines: [
          '«Jardín botánico y zona de paseo municipal de Valleverde.»',
          '«Un rincón apacible cuidado por la comunidad donde florecen las orquídeas del Alba.»'
        ]
      }
    ];

    for (const sp of signposts) {
      setDeco(sp.c, sp.r, TILES.SIGNPOST, true);
    }

    const bushes = [
      [5, 7], [11, 7], [20, 7], [4, 21], [10, 19], [21, 21]
    ];
    for (const [bc, br] of bushes) {
      setDeco(bc, br, TILES.BUSH, true);
    }

    // Delimita las huellas espaciales protegidas de cada edificio para que NINGÚN árbol recorte tejados o muros
    const isHouseProtected = (c, r) => {
      // 1. Casa del Programador: cols 1..7, rows 6..12
      if (c >= 1 && c <= 7 && r >= 6 && r <= 12) return true;
      // 2. Mansión de Aurelio: cols 5..12, rows 2..8
      if (c >= 5 && c <= 12 && r >= 2 && r <= 8) return true;
      // 3. Observatorio de Orion: cols 12..17, rows 2..8
      if (c >= 12 && c <= 17 && r >= 2 && r <= 8) return true;
      // 4. Herrería de Brom: cols 20..27, rows 3..8
      if (c >= 20 && c <= 27 && r >= 3 && r <= 8) return true;
      // 5. Cabaña de Lyra: cols 3..10, rows 15..21
      if (c >= 3 && c <= 10 && r >= 15 && r <= 21) return true;
      // 6. Cuartel y Campo de Entrenamiento: cols 19..27, rows 15..23
      if (c >= 19 && c <= 27 && r >= 15 && r <= 23) return true;
      return false;
    };

    // Comprueba si una celda corresponde a caminos hacia otras zonas, plaza o viviendas protegidas
    const isRoadOrPlazaArea = (c, r) => {
      if (isHouseProtected(c, r)) return true;
      // Portal rúnico místico al norte hacia Reinos Condenados
      if (c >= 10 && c <= 13 && r <= 4) return true;
      // Camino Oeste hacia Ruinas del Despertar (completamente despejado para ver la salida)
      if (c <= 4 && r >= 10 && r <= 15) return true;
      // Camino Este hacia el río y puente
      if (c >= 26 && r >= 10 && r <= 15) return true;
      // Camino Norte
      if (c >= 16 && c <= 19 && r <= 6) return true;
      // Camino Sur y Plaza de la Alcantarilla (Garbage Collector)
      if (c >= 16 && c <= 19 && r >= 18) return true;
      if (c >= 10 && c <= 16 && r >= 19 && r <= 22) return true;
      // Plaza central y mercado
      if (c >= 12 && c <= 22 && r >= 8 && r <= 16) return true;
      return false;
    };

    const placeTree = (c, r) => {
      if (r >= 1 && r < rows && c >= 0 && c < cols) {
        if (ground[r][c] === TILES.WATER_1 || ground[r - 1][c] === TILES.WATER_1) {
          return;
        }
        if (isRoadOrPlazaArea(c, r) || isRoadOrPlazaArea(c, r - 1)) {
          return;
        }
        setDeco(c, r - 1, TILES.TREE_TOP, true);
        setDeco(c, r, TILES.TREE_TRUNK, true);
      }
    };

    for (let c = 0; c < cols; c += 2) {
      placeTree(c, 1);
      placeTree(c + 1, 22);
    }
    for (let r = 3; r < rows - 2; r += 2) {
      placeTree(1, r);
      placeTree(2, r + 1);
      placeTree(34, r);
    }
    const extraTrees = [
      [4, 5], [26, 9], [6, 14], [25, 20], [32, 7], [32, 17]
    ];
    for (const [tc, tr] of extraTrees) {
      placeTree(tc, tr);
    }

    this.scenes.overworld = {
      title: 'Pueblo de Valleverde',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      signposts
    };
  }

  /**
   * Construye los interiores de las 3 viviendas para que el jugador pueda entrar y explorarlas.
   */
  _buildHouseInteriors() {
    const createInterior = (sceneId, title, doorMeta, customSetup) => {
      const cols = 12;
      const rows = 9;
      const ground = this._createGrid(cols, rows, TILES.FLOOR_WOOD);
      const decoration = this._createGrid(cols, rows, -1);
      const collision = this._createGrid(cols, rows, 0);
      const lightSources = [];

      // Paredes perimetrales del interior
      for (let c = 0; c < cols; c++) {
        decoration[0][c] = TILES.WALL_INTERIOR;
        collision[0][c] = 1;
        decoration[1][c] = TILES.WALL_INTERIOR;
        collision[1][c] = 1;
        collision[rows - 1][c] = 1;
      }
      for (let r = 0; r < rows; r++) {
        decoration[r][0] = TILES.WALL_INTERIOR;
        collision[r][0] = 1;
        decoration[r][cols - 1] = TILES.WALL_INTERIOR;
        collision[r][cols - 1] = 1;
      }

      // Alfombra central
      for (let r = 4; r <= 6; r++) {
        for (let c = 4; c <= 7; c++) {
          ground[r][c] = TILES.RUG_RED;
        }
      }

      // Felpudo de salida en la parte inferior central (cols 5 y 6, row 7)
      decoration[7][5] = TILES.EXIT_MAT;
      decoration[7][6] = TILES.EXIT_MAT;
      collision[8][5] = 0;
      collision[8][6] = 0;

      // Chimenea cálida con fuente de luz
      decoration[1][6] = TILES.FIREPLACE;
      collision[1][6] = 1;
      lightSources.push({
        x: 6 * this.tileSize + 8,
        y: 2 * this.tileSize,
        radius: 65,
        intensity: 1.0
      });

      customSetup({ ground, decoration, collision, lightSources });

      this.scenes[sceneId] = {
        title,
        ownerName: doorMeta.ownerName,
        cols,
        rows,
        layers: { ground, decoration, collision },
        lightSources,
        exitDoor: {
          worldX: 6 * this.tileSize,
          worldY: 7.5 * this.tileSize,
          returnX: doorMeta.returnX,
          returnY: doorMeta.returnY
        }
      };
    };

    const playerDoor = this.houseDoors.find((d) => d.sceneId === 'player_house');
    createInterior('player_house', 'Casa del Programador (Tu Hogar)', playerDoor, ({ decoration, collision, lightSources }) => {
      decoration[2][2] = TILES.BOOKSHELF; collision[2][2] = 1; // Libros de StackOverflow y Clean Code
      decoration[2][3] = TILES.TABLE;     collision[2][3] = 1; // Escritorio de desarrollo
      decoration[2][8] = TILES.LAMPPOST;  collision[2][8] = 1; // Flexo
      decoration[2][9] = TILES.BED;       collision[2][9] = 1; // Cama reparadora (ciclo día/tarde/noche)
      decoration[4][2] = TILES.CRATE;     collision[4][2] = 1; // Cajas de periféricos
      decoration[4][8] = TILES.TABLE;     collision[4][8] = 1; // Cafetera
      lightSources.push({
        x: 3.5 * this.tileSize,
        y: 2.5 * this.tileSize,
        radius: 46,
        intensity: 0.95
      });
    });

    const elderDoor = this.houseDoors.find((d) => d.sceneId === 'elder_house');
    createInterior('elder_house', 'Casa de Aurelio (Cronista)', elderDoor, ({ ground, decoration, collision, lightSources }) => {
      // Estanterías repletas de pergaminos antiguos y códices
      decoration[2][2] = TILES.BOOKSHELF; collision[2][2] = 1;
      decoration[2][3] = TILES.BOOKSHELF; collision[2][3] = 1;
      decoration[2][4] = TILES.BOOKSHELF; collision[2][4] = 1;
      decoration[2][5] = TILES.BOOKSHELF; collision[2][5] = 1;
      // Escritorio de estudio y lectura
      decoration[4][3] = TILES.TABLE;     collision[4][3] = 1;
      decoration[4][4] = TILES.TABLE;     collision[4][4] = 1;
      // Telescopio / flexo astronómico y lecho
      decoration[2][8] = TILES.LAMPPOST;  collision[2][8] = 1;
      decoration[2][9] = TILES.BED;       collision[2][9] = 1;
      lightSources.push({
        x: 8.5 * this.tileSize,
        y: 2.5 * this.tileSize,
        radius: 48,
        intensity: 0.95
      });
    });

    const oracleDoor = this.houseDoors.find((d) => d.sceneId === 'oracle_house');
    createInterior('oracle_house', 'Observatorio de Orion (Oráculo IA)', oracleDoor, ({ ground, decoration, collision, lightSources }) => {
      decoration[2][2] = TILES.BOOKSHELF; collision[2][2] = 1;
      decoration[2][3] = TILES.LAMPPOST;  collision[2][3] = 1;
      decoration[2][8] = TILES.LAMPPOST;  collision[2][8] = 1;
      decoration[2][9] = TILES.BED;       collision[2][9] = 1;
      decoration[4][3] = TILES.TABLE;     collision[4][3] = 1;
      decoration[4][8] = TILES.BOOKSHELF; collision[4][8] = 1;
      lightSources.push({
        x: 3.5 * this.tileSize,
        y: 2.5 * this.tileSize,
        radius: 50,
        intensity: 1.0
      });
    });

    const smithDoor = this.houseDoors.find((d) => d.sceneId === 'blacksmith_house');
    createInterior('blacksmith_house', 'Herrería de Brom (Forjador)', smithDoor, ({ ground, decoration, collision, lightSources }) => {
      // Suelo reforzado de piedra y adoquín en el sector de forja
      for (let r = 2; r <= 5; r++) {
        for (let c = 1; c <= 4; c++) {
          ground[r][c] = TILES.COBBLE;
        }
      }
      // Fragua ardiente secundaria con resplandor
      decoration[1][3] = TILES.FIREPLACE; collision[1][3] = 1;
      lightSources.push({
        x: 3.5 * this.tileSize,
        y: 1.5 * this.tileSize,
        radius: 58,
        intensity: 1.05
      });
      // Yunques, lingotes y barril de templado
      decoration[2][2] = TILES.ANVIL;     collision[2][2] = 1;
      decoration[3][2] = TILES.CRATE;     collision[3][2] = 1; // Lingotes apilados
      decoration[4][2] = TILES.CRATE;     collision[4][2] = 1;
      decoration[3][3] = TILES.WELL;      collision[3][3] = 1; // Barril de agua/templado
      // Banco de trabajo y lecho
      decoration[4][8] = TILES.TABLE;     collision[4][8] = 1;
      decoration[2][9] = TILES.BED;       collision[2][9] = 1;
    });

    const herbDoor = this.houseDoors.find((d) => d.sceneId === 'herbalist_house');
    createInterior('herbalist_house', 'Cabaña de Lyra (Alquimista)', herbDoor, ({ ground, decoration, collision }) => {
      // Estantes de frascos medicinales y elixires
      decoration[2][2] = TILES.BOOKSHELF; collision[2][2] = 1;
      decoration[2][3] = TILES.BOOKSHELF; collision[2][3] = 1;
      // Maceteros botánicos y flores secas
      decoration[2][4] = TILES.FLOWERS_1;
      decoration[2][5] = TILES.FLOWERS_2;
      decoration[3][2] = TILES.BUSH;      collision[3][2] = 1; // Arbusto medicinal cultivado
      decoration[4][2] = TILES.FLOWERS_2;
      decoration[5][9] = TILES.FLOWERS_1;
      // Mesa de destilación y mezclas
      decoration[4][7] = TILES.TABLE;     collision[4][7] = 1;
      decoration[4][8] = TILES.TABLE;     collision[4][8] = 1;
      decoration[2][9] = TILES.BED;       collision[2][9] = 1;
    });

    const guardDoor = this.houseDoors.find((d) => d.sceneId === 'guard_house');
    createInterior('guard_house', 'Cuartel de Kael (Capitán)', guardDoor, ({ ground, decoration, collision }) => {
      // Pavimento táctico de piedra
      for (let r = 3; r <= 6; r++) {
        for (let c = 4; c <= 7; c++) {
          ground[r][c] = TILES.STONE_FLOOR;
        }
      }
      // Mesa táctica de operaciones con mapas de campaña
      decoration[4][5] = TILES.TABLE;     collision[4][5] = 1;
      decoration[4][6] = TILES.TABLE;     collision[4][6] = 1;
      // Armeros de lanzas, escudos y suministros de la guardia
      decoration[2][2] = TILES.CRATE;     collision[2][2] = 1;
      decoration[2][3] = TILES.ANVIL;     collision[2][3] = 1;
      decoration[3][2] = TILES.CRATE;     collision[3][2] = 1;
      // Literas de descanso militar
      decoration[2][8] = TILES.BED;       collision[2][8] = 1;
      decoration[2][9] = TILES.BED;       collision[2][9] = 1;
      decoration[2][5] = TILES.SIGNPOST;  collision[2][5] = 1; // Tablón de órdenes del cuartel
    });

    // Escena especial: Calabozo Municipal del Pueblo (Cárcel por insultar a la IA)
    {
      const cols = 12;
      const rows = 9;
      const ground = this._createGrid(cols, rows, TILES.STONE_FLOOR);
      const decoration = this._createGrid(cols, rows, -1);
      const collision = this._createGrid(cols, rows, 0);

      for (let c = 0; c < cols; c++) {
        decoration[0][c] = TILES.WALL_INTERIOR; collision[0][c] = 1;
        decoration[1][c] = TILES.WALL_INTERIOR; collision[1][c] = 1;
        decoration[rows - 1][c] = TILES.WALL_INTERIOR; collision[rows - 1][c] = 1;
      }
      for (let r = 0; r < rows; r++) {
        decoration[r][0] = TILES.WALL_INTERIOR; collision[r][0] = 1;
        decoration[r][cols - 1] = TILES.WALL_INTERIOR; collision[r][cols - 1] = 1;
      }

      // Hilera de barrotes de hierro en la fila 5 encerrando al jugador en la celda superior (filas 2..4)
      for (let c = 1; c < cols - 1; c++) {
        decoration[5][c] = TILES.JAIL_BARS;
        collision[5][c] = 1;
      }

      // Mobiliario espartano de la celda
      decoration[2][2] = TILES.BED;   collision[2][2] = 1;
      decoration[2][9] = TILES.CRATE; collision[2][9] = 1;
      decoration[2][5] = TILES.LAMPPOST; collision[2][5] = 1;

      this.scenes.jail_cell = {
        title: 'Calabozo Municipal de Valleverde',
        cols,
        rows,
        layers: { ground, decoration, collision },
        lightSources: [
          { x: 5.5 * this.tileSize, y: 2.5 * this.tileSize, radius: 58, intensity: 0.9 }
        ],
        exitDoor: null // No se puede salir por puerta mientras dure el arresto
      };
    }
  }

  /**
   * Construye el Templo del Bastión (Mazmorra de la Armadura del Alba):
   * Nivel desafiante con pasillos estrechos, columnas de piedra y patrullas de drones
   * donde el jugador está completamente indefenso hasta alcanzar la cámara sagrada.
   */
  _buildArmorTempleScene() {
    const cols = 22;
    const rows = 18;
    const ground = this._createGrid(cols, rows, TILES.STONE_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            layer[r][c] = val;
          }
        }
      }
    };

    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    // Paredes perimetrales
    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.WALL_INTERIOR, true);
      setDeco(c, 1, TILES.WALL_INTERIOR, true);
      setDeco(c, rows - 1, TILES.WALL_INTERIOR, true);
    }

    // Portal místico hacia la arena del Guardián del Stack Overflow
    if (this.swordPuzzle.portalOpen) {
      setDeco(11, 1, TILES.PORTAL_GATE_OPEN, false);
      setDeco(12, 1, TILES.PORTAL_GATE_OPEN, false);
    } else {
      setDeco(11, 1, TILES.PORTAL_GATE_CLOSED, true);
      setDeco(12, 1, TILES.PORTAL_GATE_CLOSED, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.WALL_INTERIOR, true);
      setDeco(1, r, TILES.WALL_INTERIOR, true);
      setDeco(cols - 2, r, TILES.WALL_INTERIOR, true);
      setDeco(cols - 1, r, TILES.WALL_INTERIOR, true);
    }

    // Suelo adoquinado en caminos
    fillRect(ground, 9, 13, 4, 4, TILES.COBBLE);
    fillRect(ground, 3, 6, 4, 8, TILES.COBBLE);
    fillRect(ground, 15, 6, 4, 8, TILES.COBBLE);
    fillRect(ground, 3, 6, 16, 2, TILES.COBBLE);
    fillRect(ground, 8, 2, 6, 4, TILES.RUG_RED);

    // Muros divisorios internos que forman el laberinto
    fillRect(decoration, 2, 13, 7, 1, TILES.WALL_INTERIOR);
    fillRect(collision, 2, 13, 7, 1, 1);
    fillRect(decoration, 13, 13, 7, 1, TILES.WALL_INTERIOR);
    fillRect(collision, 13, 13, 7, 1, 1);

    // Muro central que divide las dos rutas de sigilo
    fillRect(decoration, 8, 8, 6, 4, TILES.WALL_INTERIOR);
    fillRect(collision, 8, 8, 6, 4, 1);

    // Columnas de piedra interiores (obstáculos tácticos para esquivar)
    const pillars = [
      [5, 8], [5, 11], [16, 8], [16, 11],
      [7, 4], [14, 4], [8, 5], [13, 5]
    ];
    for (const [pc, pr] of pillars) {
      setDeco(pc, pr, TILES.WALL_INTERIOR, true);
    }

    // Pedestal sagrado de la Armadura del Alba en la Cámara Norte
    setDeco(10, 4, TILES.ALTAR_PEDESTAL, false);
    setDeco(9, 3, TILES.LAMPPOST, true);
    setDeco(12, 3, TILES.LAMPPOST, true);

    // Barrera de fuego bloqueando el acceso al Altar (se disipa al resolver el puzle booleano)
    if (this.armorPuzzle.barrierActive) {
      setDeco(9, 5, TILES.FIREPLACE, true);
      setDeco(10, 5, TILES.FIREPLACE, true);
      setDeco(11, 5, TILES.FIREPLACE, true);
    }
    lightSources.push(
      { x: 10.5 * 16, y: 4.5 * 16, radius: 64, intensity: 1.0 },
      { x: 9.5 * 16, y: 3.5 * 16, radius: 44, intensity: 0.9 },
      { x: 12.5 * 16, y: 3.5 * 16, radius: 44, intensity: 0.9 },
      { x: 10.5 * 16, y: 5.5 * 16, radius: 52, intensity: 0.95 } // Resplandor de la barrera de fuego
    );

    // Antorchas en el vestíbulo sur y en las alas este/oeste
    setDeco(9, 14, TILES.LAMPPOST, true);
    setDeco(12, 14, TILES.LAMPPOST, true);
    setDeco(3, 7, TILES.LAMPPOST, true);
    setDeco(18, 7, TILES.LAMPPOST, true);
    lightSources.push(
      { x: 9.5 * 16, y: 14.5 * 16, radius: 46, intensity: 0.85 },
      { x: 12.5 * 16, y: 14.5 * 16, radius: 46, intensity: 0.85 },
      { x: 3.5 * 16, y: 7.5 * 16, radius: 44, intensity: 0.8 },
      { x: 18.5 * 16, y: 7.5 * 16, radius: 44, intensity: 0.8 }
    );

    // Felpudo de salida al sur
    setDeco(10, 16, TILES.EXIT_MAT, false);
    setDeco(11, 16, TILES.EXIT_MAT, false);

    this.scenes.armor_temple = {
      title: 'Templo de la Armadura Binaria · Santuario del Bastión',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 10.5 * 16,
        worldY: 16.5 * 16,
        returnX: 6.5 * 16,
        returnY: 10 * 16,
        returnScene: 'first_stage'
      }
    };
  }

  /**
   * Construye el Templo del Altar Sagrado (Mazmorra de la Espada del Alba):
   * Nivel con caballeros pesados de Mister AI Alex, columnas corrompidas
   * y un santuario glorioso donde descansa tu primera arma.
   */
  _buildSwordTempleScene() {
    const cols = 24;
    const rows = 18;
    const ground = this._createGrid(cols, rows, TILES.STONE_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            layer[r][c] = val;
          }
        }
      }
    };

    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    // Paredes perimetrales
    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.WALL_INTERIOR, true);
      setDeco(c, 1, TILES.WALL_INTERIOR, true);
      setDeco(c, rows - 1, TILES.WALL_INTERIOR, true);
    }

    // Portal místico hacia la arena del Guardián del Stack Overflow
    if (this.swordPuzzle.portalOpen) {
      setDeco(11, 1, TILES.PORTAL_GATE_OPEN, false);
      setDeco(12, 1, TILES.PORTAL_GATE_OPEN, false);
    } else {
      setDeco(11, 1, TILES.PORTAL_GATE_CLOSED, true);
      setDeco(12, 1, TILES.PORTAL_GATE_CLOSED, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.WALL_INTERIOR, true);
      setDeco(1, r, TILES.WALL_INTERIOR, true);
      setDeco(cols - 2, r, TILES.WALL_INTERIOR, true);
      setDeco(cols - 1, r, TILES.WALL_INTERIOR, true);
    }

    // Pavimento central adoquinado
    fillRect(ground, 10, 13, 4, 4, TILES.COBBLE);
    fillRect(ground, 8, 6, 8, 8, TILES.COBBLE);
    fillRect(ground, 3, 7, 5, 6, TILES.COBBLE);
    fillRect(ground, 16, 7, 5, 6, TILES.COBBLE);
    fillRect(ground, 9, 2, 6, 4, TILES.RUG_RED);

    // Muro frontal del vestíbulo: paso central amplio de 12 baldosas para evitar cuellos de botella
    fillRect(decoration, 2, 13, 4, 1, TILES.WALL_INTERIOR);
    fillRect(collision, 2, 13, 4, 1, 1);
    fillRect(decoration, 18, 13, 4, 1, TILES.WALL_INTERIOR);
    fillRect(collision, 18, 13, 4, 1, 1);

    // Columnata de honor perimetral: columnas esquineras amplias sin crear trampas de atasco
    const holyPillars = [
      [5, 5], [18, 5],
      [5, 12], [18, 12]
    ];
    for (const [hc, hr] of holyPillars) {
      setDeco(hc, hr, TILES.WALL_INTERIOR, true);
    }

    // Monolitos rúnicos del puzle marcados como sólidos en colisión
    setDeco(6, 8, -1, true);
    setDeco(11, 10, -1, true);
    setDeco(17, 8, -1, true);

    // Pedestal sagrado de la Espada del Alba en la Cámara Alta
    setDeco(11, 4, TILES.ALTAR_PEDESTAL, false);
    setDeco(10, 3, TILES.LAMPPOST, true);
    setDeco(13, 3, TILES.LAMPPOST, true);
    lightSources.push(
      { x: 11.5 * 16, y: 4.5 * 16, radius: 72, intensity: 1.0 },
      { x: 10.5 * 16, y: 3.5 * 16, radius: 48, intensity: 0.9 },
      { x: 13.5 * 16, y: 3.5 * 16, radius: 48, intensity: 0.9 }
    );

    // Farolas de iluminación en los accesos de la gran sala
    setDeco(5, 14, TILES.LAMPPOST, true);
    setDeco(18, 14, TILES.LAMPPOST, true);
    setDeco(3, 7, TILES.LAMPPOST, true);
    setDeco(20, 7, TILES.LAMPPOST, true);
    lightSources.push(
      { x: 5.5 * 16, y: 14.5 * 16, radius: 48, intensity: 0.85 },
      { x: 18.5 * 16, y: 14.5 * 16, radius: 48, intensity: 0.85 },
      { x: 3.5 * 16, y: 7.5 * 16, radius: 46, intensity: 0.85 },
      { x: 20.5 * 16, y: 7.5 * 16, radius: 46, intensity: 0.85 }
    );

    // Felpudo de salida al sur
    setDeco(11, 16, TILES.EXIT_MAT, false);
    setDeco(12, 16, TILES.EXIT_MAT, false);

    this.scenes.sword_temple = {
      title: 'Templo de la Espada de la Recursividad · Altar del Abismo',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 17.5 * 16,
        returnY: 4.5 * 16,
        returnScene: 'first_stage'
      }
    };
  }

  /**
   * Construye los Reinos Condenados (Santuario del Más Allá):
   * Dimensión mística y solemne donde mora el Dios Supremo.
   * Aquellos afligidos con la Maldición del Corazón Roto (💔) por desacato carcelario
   * deben acudir ante su altar celestial para purificar su falta.
   */
  _buildCondemnedRealmsScene() {
    const cols = 24;
    const rows = 18;
    const ground = this._createGrid(cols, rows, TILES.STONE_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            layer[r][c] = val;
          }
        }
      }
    };

    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    // Muros perimetrales del santuario abisal
    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.WALL_INTERIOR, true);
      setDeco(c, 1, TILES.WALL_INTERIOR, true);
      setDeco(c, rows - 1, TILES.WALL_INTERIOR, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.WALL_INTERIOR, true);
      setDeco(1, r, TILES.WALL_INTERIOR, true);
      setDeco(cols - 2, r, TILES.WALL_INTERIOR, true);
      setDeco(cols - 1, r, TILES.WALL_INTERIOR, true);
    }

    // Pavimento ceremonial de adoquines abisales en los laterales
    fillRect(ground, 2, 2, cols - 4, rows - 3, TILES.COBBLE);
    // Pasarela mística central alfombrada
    fillRect(ground, 11, 2, 2, rows - 3, TILES.STONE_FLOOR);
    fillRect(decoration, 11, 5, 2, 11, TILES.RUG_RED);

    // Columnata de monolitos del inframundo
    const monoliths = [
      [6, 4], [6, 8], [6, 12],
      [17, 4], [17, 8], [17, 12],
      [9, 9], [14, 9]
    ];
    for (const [mc, mr] of monoliths) {
      setDeco(mc, mr, TILES.WALL_INTERIOR, true);
      setDeco(mc, mr - 1, TILES.LAMPPOST, true);
      lightSources.push({
        x: mc * 16 + 8,
        y: (mr - 1) * 16 + 8,
        radius: 46,
        intensity: 0.9
      });
    }

    // Altar Celestial del Dios Supremo en la Cámara Alta
    setDeco(11, 4, TILES.ALTAR_PEDESTAL, true);
    setDeco(12, 4, TILES.ALTAR_PEDESTAL, true);
    setDeco(10, 3, TILES.LAMPPOST, true);
    setDeco(13, 3, TILES.LAMPPOST, true);
    setDeco(9, 4, TILES.LAMPPOST, true);
    setDeco(14, 4, TILES.LAMPPOST, true);

    lightSources.push(
      { x: 11.5 * 16, y: 4.5 * 16, radius: 84, intensity: 1.0 },
      { x: 10.5 * 16, y: 3.5 * 16, radius: 52, intensity: 0.95 },
      { x: 13.5 * 16, y: 3.5 * 16, radius: 52, intensity: 0.95 }
    );

    // Farolas del círculo de retorno dimensional al sur (sin puerta física: se entra y sale por el Portal Abisal del jugador)
    setDeco(10, 15, TILES.LAMPPOST, true);
    setDeco(13, 15, TILES.LAMPPOST, true);
    lightSources.push({
      x: 11.5 * 16,
      y: 15.5 * 16,
      radius: 58,
      intensity: 0.95
    });

    this.scenes.condemned_realms = {
      title: 'Reinos Condenados · Santuario del Dios Supremo',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: null // Solo accesible y retornable mediante el Portal Abisal estilo Diablo
    };
  }

  /**
   * MAZMORRA 1 · SALA 1: 'Cloacas del Legacy · Entrada de Desagüe'
   * Tuberías de drenaje, rejillas metálicas y agua estancada.
   */
  _buildSewersEntryScene() {
    const cols = 24;
    const rows = 18;
    const ground = this._createGrid(cols, rows, TILES.SEWER_SLIME_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) layer[r][c] = val;
        }
      }
    };
    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    // Muros perimetrales de tuberías
    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.SEWER_PIPE_WALL, true);
      setDeco(c, 1, TILES.SEWER_PIPE_WALL, true);
      setDeco(c, rows - 1, TILES.SEWER_PIPE_WALL, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.SEWER_PIPE_WALL, true);
      setDeco(1, r, TILES.SEWER_PIPE_WALL, true);
      setDeco(cols - 2, r, TILES.SEWER_PIPE_WALL, true);
      setDeco(cols - 1, r, TILES.SEWER_PIPE_WALL, true);
    }

    // Canales laterales de agua residual ácida
    fillRect(ground, 2, 4, 3, 10, TILES.WATER_1);
    fillRect(ground, cols - 5, 4, 3, 10, TILES.WATER_1);
    // Pasarela central segura
    fillRect(ground, 8, 2, 8, 14, TILES.STONE_FLOOR);

    // Tuberías industriales intermedias
    setDeco(7, 6, TILES.SEWER_PIPE_WALL, true);
    setDeco(16, 6, TILES.SEWER_PIPE_WALL, true);
    setDeco(7, 11, TILES.SEWER_PIPE_WALL, true);
    setDeco(16, 11, TILES.SEWER_PIPE_WALL, true);

    // Luminiscencia verde de filtración ácida
    lightSources.push(
      { x: 3.5 * 16, y: 8.5 * 16, radius: 48, intensity: 0.85, color: '#10b981' },
      { x: 20.5 * 16, y: 8.5 * 16, radius: 48, intensity: 0.85, color: '#10b981' },
      { x: 11.5 * 16, y: 3.5 * 16, radius: 52, intensity: 0.9, color: '#34d399' }
    );

    // Salida sur: escalera de subida a la superficie
    setDeco(11, rows - 1, TILES.EXIT_MAT, false);
    setDeco(12, rows - 1, TILES.EXIT_MAT, false);
    collision[rows - 1][11] = 0;
    collision[rows - 1][12] = 0;

    // Paso norte hacia la sala de puzle de válvulas
    setDeco(11, 1, -1, false);
    setDeco(12, 1, -1, false);
    collision[1][11] = 0;
    collision[1][12] = 0;

    this.scenes.sewers_entry = {
      title: 'Cloacas del Legacy · Entrada de Desagüe',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 8.5 * 16,
        returnY: 16.5 * 16,
        returnScene: 'south_swamp'
      }
    };
  }

  /**
   * MAZMORRA 1 · SALA 2: 'Cloacas del Legacy · Sala de Válvulas y Drenaje'
   * Puzle de válvula de presión para drenar el canal de memoria fétida.
   */
  _buildSewersPuzzleScene() {
    const cols = 24;
    const rows = 18;
    const ground = this._createGrid(cols, rows, TILES.SEWER_SLIME_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) layer[r][c] = val;
        }
      }
    };
    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.SEWER_PIPE_WALL, true);
      setDeco(c, 1, TILES.SEWER_PIPE_WALL, true);
      setDeco(c, rows - 1, TILES.SEWER_PIPE_WALL, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.SEWER_PIPE_WALL, true);
      setDeco(1, r, TILES.SEWER_PIPE_WALL, true);
      setDeco(cols - 2, r, TILES.SEWER_PIPE_WALL, true);
      setDeco(cols - 1, r, TILES.SEWER_PIPE_WALL, true);
    }

    // Estanque de fango central
    fillRect(ground, 4, 4, 16, 9, TILES.WATER_1);
    // Pasarela de adoquines que lleva a la válvula central
    fillRect(ground, 10, 5, 4, 8, TILES.STONE_FLOOR);

    // Válvula central de bombeo
    setDeco(11, 8, TILES.WELL, true);
    setDeco(12, 8, TILES.WELL, true);

    lightSources.push(
      { x: 11.5 * 16, y: 8.5 * 16, radius: 60, intensity: 0.95, color: '#34d399' },
      { x: 5.5 * 16, y: 5.5 * 16, radius: 44, intensity: 0.8, color: '#10b981' },
      { x: 18.5 * 16, y: 5.5 * 16, radius: 44, intensity: 0.8, color: '#10b981' }
    );

    // Retorno al sur (entrada)
    setDeco(11, rows - 1, -1, false);
    setDeco(12, rows - 1, -1, false);
    collision[rows - 1][11] = 0;
    collision[rows - 1][12] = 0;

    // Puerta norte a la fosa del Garbage Collector
    setDeco(11, 1, -1, false);
    setDeco(12, 1, -1, false);
    collision[1][11] = 0;
    collision[1][12] = 0;

    this.scenes.sewers_puzzle = {
      title: 'Cloacas del Legacy · Sala de Válvulas y Drenaje',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 11.5 * 16,
        returnY: 3 * 16,
        returnScene: 'sewers_entry'
      }
    };
  }

  /**
   * MAZMORRA 1 · SALA 3: 'Cloacas del Legacy · Fosa de la Memoria' (Garbage Collector)
   * Escenario de batalla subterráneo con tileset de alcantarillas industriales.
   */
  _buildSewersDungeonScene() {
    const cols = 24;
    const rows = 18;
    const ground = this._createGrid(cols, rows, TILES.SEWER_SLIME_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) layer[r][c] = val;
        }
      }
    };

    const setDeco = (c, r, tileId, blocks = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (blocks) collision[r][c] = 1;
      }
    };

    // Muros perimetrales
    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.SEWER_PIPE_WALL, true);
      setDeco(c, 1, TILES.SEWER_PIPE_WALL, true);
      setDeco(c, rows - 1, TILES.SEWER_PIPE_WALL, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.SEWER_PIPE_WALL, true);
      setDeco(1, r, TILES.SEWER_PIPE_WALL, true);
      setDeco(cols - 1, r, TILES.SEWER_PIPE_WALL, true);
      setDeco(cols - 2, r, TILES.SEWER_PIPE_WALL, true);
    }

    // Canales de aguas residuales / ácido
    fillRect(ground, 4, 4, 16, 10, TILES.STONE_PATH);
    fillRect(ground, 2, 7, 2, 4, TILES.WATER_1);
    fillRect(ground, 20, 7, 2, 4, TILES.WATER_1);

    // Columnas industriales de la fosa
    setDeco(5, 5, TILES.SEWER_PIPE_WALL, true);
    setDeco(18, 5, TILES.SEWER_PIPE_WALL, true);
    setDeco(5, 12, TILES.SEWER_PIPE_WALL, true);
    setDeco(18, 12, TILES.SEWER_PIPE_WALL, true);

    // Antorchas con bioluminiscencia verdosa de fosa de memoria
    lightSources.push({ x: 5.5 * 16, y: 5.5 * 16, radius: 48, intensity: 0.85, color: '#10b981' });
    lightSources.push({ x: 18.5 * 16, y: 5.5 * 16, radius: 48, intensity: 0.85, color: '#10b981' });
    lightSources.push({ x: 11.5 * 16, y: 9.5 * 16, radius: 64, intensity: 0.95, color: '#34d399' });

    // Puerta de salida (retorno a la sala de puzle) en el muro sur
    setDeco(11, rows - 1, -1, false);
    setDeco(12, rows - 1, -1, false);
    collision[rows - 1][11] = 0;
    collision[rows - 1][12] = 0;

    this.scenes.sewers_dungeon = {
      title: 'Cloacas del Legacy · Fosa de la Memoria (Garbage Collector)',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 11.5 * 16,
        returnY: 3 * 16,
        returnScene: 'sewers_puzzle'
      }
    };
  }

  /**
   * MAZMORRA 2 · SALA 1: 'Minas de la Recursión · El Gran Abismo'
   * Paredes de cristal violeta, vetas de silicio y un abismo central infranqueable sin Dash.
   */
  _buildMinesEntryScene() {
    const cols = 24;
    const rows = 18;
    const ground = this._createGrid(cols, rows, TILES.MINE_CRYSTAL_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) layer[r][c] = val;
        }
      }
    };
    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.MINE_CRYSTAL_WALL, true);
      setDeco(c, 1, TILES.MINE_CRYSTAL_WALL, true);
      setDeco(c, rows - 1, TILES.MINE_CRYSTAL_WALL, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.MINE_CRYSTAL_WALL, true);
      setDeco(1, r, TILES.MINE_CRYSTAL_WALL, true);
      setDeco(cols - 2, r, TILES.MINE_CRYSTAL_WALL, true);
      setDeco(cols - 1, r, TILES.MINE_CRYSTAL_WALL, true);
    }

    // EL GRAN ABISMO (filas 8 y 9): intransitable a pie, exige Dash Asíncrono para cruzar
    fillRect(ground, 2, 8, cols - 4, 2, TILES.MINE_CHASM);
    for (let c = 2; c < cols - 2; c++) {
      collision[8][c] = CHASM_COLLISION;
      collision[9][c] = CHASM_COLLISION;
    }

    // Veta de Silicio Puro en el rincón noreste
    setDeco(19, 4, TILES.CRYSTAL_BARRIER, true);
    setDeco(20, 4, TILES.CRYSTAL_BARRIER, true);

    lightSources.push(
      { x: 11.5 * 16, y: 8.5 * 16, radius: 56, intensity: 0.9, color: '#818cf8' },
      { x: 5.5 * 16, y: 4.5 * 16, radius: 48, intensity: 0.85, color: '#38bdf8' },
      { x: 19.5 * 16, y: 4.5 * 16, radius: 52, intensity: 0.95, color: '#a855f7' }
    );

    // Salida sur al exterior (Valleverde Noroeste)
    setDeco(11, rows - 1, TILES.EXIT_MAT, false);
    setDeco(12, rows - 1, TILES.EXIT_MAT, false);
    collision[rows - 1][11] = 0;
    collision[rows - 1][12] = 0;

    // Paso norte a la sala de runas
    setDeco(11, 1, -1, false);
    setDeco(12, 1, -1, false);
    collision[1][11] = 0;
    collision[1][12] = 0;

    this.scenes.mines_entry = {
      title: 'Minas de la Recursión · El Gran Abismo',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 17.5 * 16,
        returnY: 5.5 * 16,
        returnScene: 'north_peaks'
      }
    };
  }

  /**
   * MAZMORRA 2 · SALA 2: 'Minas de la Recursión · Sala de Runas Recursivas'
   * Monolitos de recursión matemática que abren el paso a la cámara del jefe.
   */
  _buildMinesPuzzleScene() {
    const cols = 24;
    const rows = 18;
    const ground = this._createGrid(cols, rows, TILES.MINE_CRYSTAL_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.MINE_CRYSTAL_WALL, true);
      setDeco(c, 1, TILES.MINE_CRYSTAL_WALL, true);
      setDeco(c, rows - 1, TILES.MINE_CRYSTAL_WALL, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.MINE_CRYSTAL_WALL, true);
      setDeco(1, r, TILES.MINE_CRYSTAL_WALL, true);
      setDeco(cols - 2, r, TILES.MINE_CRYSTAL_WALL, true);
      setDeco(cols - 1, r, TILES.MINE_CRYSTAL_WALL, true);
    }

    // Monolitos de recursión
    setDeco(6, 8, TILES.ALTAR_PEDESTAL, true);
    setDeco(11, 10, TILES.ALTAR_PEDESTAL, true);
    setDeco(17, 8, TILES.ALTAR_PEDESTAL, true);

    lightSources.push(
      { x: 6.5 * 16, y: 8.5 * 16, radius: 48, intensity: 0.9, color: '#38bdf8' },
      { x: 11.5 * 16, y: 10.5 * 16, radius: 48, intensity: 0.9, color: '#818cf8' },
      { x: 17.5 * 16, y: 8.5 * 16, radius: 48, intensity: 0.9, color: '#a855f7' }
    );

    // Salida sur: vuelta a la entrada de las minas
    setDeco(11, rows - 1, -1, false);
    setDeco(12, rows - 1, -1, false);
    collision[rows - 1][11] = 0;
    collision[rows - 1][12] = 0;

    // Portal norte hacia la cámara de contención del Stack Overflow
    setDeco(11, 1, TILES.PORTAL_GATE_OPEN, false);
    setDeco(12, 1, TILES.PORTAL_GATE_OPEN, false);
    collision[1][11] = 0;
    collision[1][12] = 0;

    this.scenes.mines_puzzle = {
      title: 'Minas de la Recursión · Sala de Runas Recursivas',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 11.5 * 16,
        returnY: 3 * 16,
        returnScene: 'mines_entry'
      }
    };
  }

  /**
   * MAZMORRA 3 · SALA 1: 'La Forja del Prototipo · Galería de Calderas'
   * Rejillas sobre lava, calderas de bronce y calor sofocante (requiere Blindaje Térmico).
   */
  _buildForgeEntryScene() {
    const cols = 24;
    const rows = 18;
    const ground = this._createGrid(cols, rows, TILES.FORGE_LAVA_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) layer[r][c] = val;
        }
      }
    };
    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.FORGE_BOILER_WALL, true);
      setDeco(c, 1, TILES.FORGE_BOILER_WALL, true);
      setDeco(c, rows - 1, TILES.FORGE_BOILER_WALL, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.FORGE_BOILER_WALL, true);
      setDeco(1, r, TILES.FORGE_BOILER_WALL, true);
      setDeco(cols - 2, r, TILES.FORGE_BOILER_WALL, true);
      setDeco(cols - 1, r, TILES.FORGE_BOILER_WALL, true);
    }

    // Pasarela de hierro central
    fillRect(ground, 8, 2, 8, 14, TILES.STONE_FLOOR);

    // Calderas ardientes en los flancos
    setDeco(4, 5, TILES.FIREPLACE, true);
    setDeco(19, 5, TILES.FIREPLACE, true);
    setDeco(4, 11, TILES.FIREPLACE, true);
    setDeco(19, 11, TILES.FIREPLACE, true);

    lightSources.push(
      { x: 4.5 * 16, y: 5.5 * 16, radius: 64, intensity: 1.0, color: '#f97316' },
      { x: 19.5 * 16, y: 5.5 * 16, radius: 64, intensity: 1.0, color: '#f97316' },
      { x: 11.5 * 16, y: 8.5 * 16, radius: 72, intensity: 0.95, color: '#ef4444' }
    );

    // Salida sur al exterior (Tierras del Este)
    setDeco(11, rows - 1, TILES.EXIT_MAT, false);
    setDeco(12, rows - 1, TILES.EXIT_MAT, false);
    collision[rows - 1][11] = 0;
    collision[rows - 1][12] = 0;

    // Paso norte a la sala de válvulas térmicas
    setDeco(11, 1, -1, false);
    setDeco(12, 1, -1, false);
    collision[1][11] = 0;
    collision[1][12] = 0;

    this.scenes.forge_entry = {
      title: 'La Forja del Prototipo · Galería de Calderas',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 26.5 * 16,
        returnY: 16.5 * 16,
        returnScene: 'south_swamp'
      }
    };
  }

  /**
   * MAZMORRA 3 · SALA 2: 'La Forja del Prototipo · Sala de Válvulas Térmicas'
   * Reguladores de sobrepresión para purgar el vapor y abrir la cámara del Microondas.
   */
  _buildForgePuzzleScene() {
    const cols = 24;
    const rows = 18;
    const ground = this._createGrid(cols, rows, TILES.FORGE_LAVA_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) layer[r][c] = val;
        }
      }
    };
    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.FORGE_BOILER_WALL, true);
      setDeco(c, 1, TILES.FORGE_BOILER_WALL, true);
      setDeco(c, rows - 1, TILES.FORGE_BOILER_WALL, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.FORGE_BOILER_WALL, true);
      setDeco(1, r, TILES.FORGE_BOILER_WALL, true);
      setDeco(cols - 2, r, TILES.FORGE_BOILER_WALL, true);
      setDeco(cols - 1, r, TILES.FORGE_BOILER_WALL, true);
    }

    fillRect(ground, 5, 5, 14, 8, TILES.STONE_FLOOR);

    // Válvulas de vapor izquierda y derecha
    setDeco(6, 8, TILES.WELL, true);
    setDeco(17, 8, TILES.WELL, true);

    lightSources.push(
      { x: 6.5 * 16, y: 8.5 * 16, radius: 56, intensity: 0.95, color: '#f97316' },
      { x: 17.5 * 16, y: 8.5 * 16, radius: 56, intensity: 0.95, color: '#f97316' },
      { x: 11.5 * 16, y: 4.5 * 16, radius: 64, intensity: 1.0, color: '#ef4444' }
    );

    // Retorno al sur
    setDeco(11, rows - 1, -1, false);
    setDeco(12, rows - 1, -1, false);
    collision[rows - 1][11] = 0;
    collision[rows - 1][12] = 0;

    // Paso norte a la cámara de contención del Microondas Prototipo
    setDeco(11, 1, -1, false);
    setDeco(12, 1, -1, false);
    collision[1][11] = 0;
    collision[1][12] = 0;

    this.scenes.forge_puzzle = {
      title: 'La Forja del Prototipo · Sala de Válvulas Térmicas',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 11.5 * 16,
        returnY: 3 * 16,
        returnScene: 'forge_entry'
      }
    };
  }

  /**
   * MAZMORRA 3 · SALA 3: 'La Forja del Prototipo · Cámara de Contención' (Microondas Prototipo)
   * Arena de calderas incandescentes y vapor presurizado.
   */
  _buildFortressGateScene() {
    const cols = 24;
    const rows = 18;
    const ground = this._createGrid(cols, rows, TILES.FORGE_LAVA_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) layer[r][c] = val;
        }
      }
    };

    const setDeco = (c, r, tileId, blocks = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (blocks) collision[r][c] = 1;
      }
    };

    // Muros perimetrales reforzados
    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.FORGE_BOILER_WALL, true);
      setDeco(c, 1, TILES.FORGE_BOILER_WALL, true);
      setDeco(c, rows - 1, TILES.FORGE_BOILER_WALL, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.FORGE_BOILER_WALL, true);
      setDeco(1, r, TILES.FORGE_BOILER_WALL, true);
      setDeco(cols - 1, r, TILES.FORGE_BOILER_WALL, true);
      setDeco(cols - 2, r, TILES.FORGE_BOILER_WALL, true);
    }

    // Pistas de circuitos de energía térmica
    fillRect(ground, 3, 3, 18, 12, TILES.STONE_PATH);

    // Columnas metálicas del umbral
    setDeco(5, 5, TILES.FORGE_BOILER_WALL, true);
    setDeco(18, 5, TILES.FORGE_BOILER_WALL, true);
    setDeco(5, 11, TILES.FORGE_BOILER_WALL, true);
    setDeco(18, 11, TILES.FORGE_BOILER_WALL, true);

    // Fuentes de luz roja/ámbar
    lightSources.push({ x: 5.5 * 16, y: 5.5 * 16, radius: 52, intensity: 0.9, color: '#f97316' });
    lightSources.push({ x: 18.5 * 16, y: 5.5 * 16, radius: 52, intensity: 0.9, color: '#f97316' });
    lightSources.push({ x: 11.5 * 16, y: 8.5 * 16, radius: 64, intensity: 1.0, color: '#ef4444' });

    // Puerta de salida en el sur (retorno a la sala de puzle)
    setDeco(11, rows - 1, -1, false);
    setDeco(12, rows - 1, -1, false);
    collision[rows - 1][11] = 0;
    collision[rows - 1][12] = 0;

    this.scenes.ai_fortress_gate = {
      title: 'La Forja del Prototipo · Horno del Microondas Prototipo',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 11.5 * 16,
        returnY: 3 * 16,
        returnScene: 'forge_puzzle'
      }
    };
  }

  /**
   * ZONA FINAL · ANTESALA: 'La Gran Puerta del Núcleo Cuántico'
   * Monumental puerta con 3 zócalos de núcleo para desbloquear la Ciudadela Cuántica.
   */
  _buildQuantumGateScene() {
    const cols = 24;
    const rows = 18;
    const ground = this._createGrid(cols, rows, TILES.STONE_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) layer[r][c] = val;
        }
      }
    };
    const setDeco = (c, r, tileId, solid = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (solid) collision[r][c] = 1;
      }
    };

    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.TEMPLE_WALL, true);
      setDeco(c, 1, TILES.TEMPLE_WALL, true);
      setDeco(c, rows - 1, TILES.TEMPLE_WALL, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.TEMPLE_WALL, true);
      setDeco(1, r, TILES.TEMPLE_WALL, true);
      setDeco(cols - 2, r, TILES.TEMPLE_WALL, true);
      setDeco(cols - 1, r, TILES.TEMPLE_WALL, true);
    }

    // Pavimento ceremonial de adoquines
    fillRect(ground, 4, 3, 16, 12, TILES.COBBLE);

    // Los 3 pedestales de núcleo
    setDeco(8, 7, TILES.CORE_PEDESTAL, true);  // Núcleo GC (Verde)
    setDeco(11, 6, TILES.CORE_PEDESTAL, true); // Núcleo Stack (Cian)
    setDeco(14, 7, TILES.CORE_PEDESTAL, true); // Núcleo Microondas (Rojo)

    // Fuentes de luz de los 3 zócalos
    lightSources.push(
      { x: 8.5 * 16, y: 7.5 * 16, radius: 46, intensity: 0.9, color: '#10b981' },
      { x: 11.5 * 16, y: 6.5 * 16, radius: 52, intensity: 0.95, color: '#38bdf8' },
      { x: 14.5 * 16, y: 7.5 * 16, radius: 46, intensity: 0.9, color: '#ef4444' },
      { x: 11.5 * 16, y: 2.5 * 16, radius: 72, intensity: 1.0, color: '#ec4899' }
    );

    // Salida sur a Valleverde Este
    setDeco(11, rows - 1, TILES.EXIT_MAT, false);
    setDeco(12, rows - 1, TILES.EXIT_MAT, false);
    collision[rows - 1][11] = 0;
    collision[rows - 1][12] = 0;

    // Portal norte hacia la Ciudadela Cuántica de Alex
    setDeco(11, 1, TILES.PORTAL_GATE_OPEN, false);
    setDeco(12, 1, TILES.PORTAL_GATE_OPEN, false);
    collision[1][11] = 0;
    collision[1][12] = 0;

    this.scenes.quantum_gate = {
      title: 'La Gran Puerta del Núcleo Cuántico',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 8.5 * 16,
        returnY: 14.5 * 16,
        returnScene: 'west_wastes'
      }
    };
  }

  /**
   * ZONA FINAL · EL CLÍMAX: 'Ciudadela Cuántica de AI Alex · El Gran Ojal'
   * 100% exclusivo: Servidor Cuántico / Mainframe (rejillas metálicas oscuras, cables de fibra neón y racks de servidores).
   */
  _buildCitadelScene() {
    const cols = 24;
    const rows = 18;
    const ground = this._createGrid(cols, rows, TILES.MAINFRAME_FLOOR);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    const fillRect = (layer, c0, r0, w, h, val) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) layer[r][c] = val;
        }
      }
    };
    const setDeco = (c, r, tileId, blocks = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (blocks) collision[r][c] = 1;
      }
    };

    // Muros perimetrales: Racks de servidores cuánticos con LEDs titilantes
    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.MAINFRAME_WALL, true);
      setDeco(c, 1, TILES.MAINFRAME_WALL, true);
      setDeco(c, rows - 1, TILES.MAINFRAME_WALL, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.MAINFRAME_WALL, true);
      setDeco(1, r, TILES.MAINFRAME_WALL, true);
      setDeco(cols - 1, r, TILES.MAINFRAME_WALL, true);
      setDeco(cols - 2, r, TILES.MAINFRAME_WALL, true);
    }

    // Servidores en batería interior
    setDeco(5, 5, TILES.MAINFRAME_WALL, true);
    setDeco(18, 5, TILES.MAINFRAME_WALL, true);
    setDeco(5, 12, TILES.MAINFRAME_WALL, true);
    setDeco(18, 12, TILES.MAINFRAME_WALL, true);

    // Altar Cuántico del Gran Ojal (Pedestal cuántico de bus de memoria)
    setDeco(11, 3, TILES.CORE_PEDESTAL, false);
    setDeco(12, 3, TILES.CORE_PEDESTAL, false);

    // Iluminación cuántica hiperdimensional
    lightSources.push(
      { x: 11.5 * 16, y: 3.5 * 16, radius: 88, intensity: 1.0, color: '#ec4899' },
      { x: 5.5 * 16, y: 5.5 * 16, radius: 52, intensity: 0.9, color: '#06b6d4' },
      { x: 18.5 * 16, y: 5.5 * 16, radius: 52, intensity: 0.9, color: '#06b6d4' },
      { x: 11.5 * 16, y: 14.5 * 16, radius: 56, intensity: 0.85, color: '#3b82f6' }
    );

    // Salida sur hacia La Gran Puerta del Núcleo
    setDeco(11, rows - 1, -1, false);
    setDeco(12, rows - 1, -1, false);
    collision[rows - 1][11] = 0;
    collision[rows - 1][12] = 0;

    this.scenes.ai_citadel = {
      title: 'Ciudadela Cuántica · El Mainframe de AI Alex',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 11.5 * 16,
        returnY: 3 * 16,
        returnScene: 'quantum_gate'
      }
    };
  }

  /** Rango de tiles visibles (con 1 tile de margen para las copas/tejados que sobresalen). */
  /**
   * Genera una mazmorra procedural al estilo roguelike usando BSP.
   * @param {string} theme - Tema de la mazmorra ('sewers', 'mines', 'forge', 'citadel', 'quantum')
   * @param {number} cols - Columnas del mapa
   * @param {number} rows - Filas del mapa
   * @param {number} seed - Semilla determinista para reproducibilidad
   * @returns {Object} Datos del mapa generado
   */
  async _generateDungeon(theme, cols, rows, seed) {
    const { generateDungeon } = await import('./DungeonGenerator.js');
    const dungeon = generateDungeon({
      cols,
      rows,
      seed: seed || Date.now(),
      theme
    });
    return dungeon;
  }

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
  renderGround(ctx, camera) {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const { startCol, endCol, startRow, endRow } = this._visibleTileRange(camera);
    const { ground, decoration, collision } = this.layers;

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const screenX = c * this.tileSize - camX;
        const screenY = r * this.tileSize - camY;

        let groundTile = ground[r][c];
        const isWater = groundTile === TILES.WATER_1 || groundTile === TILES.WATER_2;
        if (groundTile === TILES.WATER_1 && this.animFrame === 1) {
          groundTile = TILES.WATER_2;
        }
        this._drawTile(ctx, groundTile, screenX, screenY);
        if (isWater) {
          this._drawWaterRipple(ctx, screenX, screenY, c, r);
        }

        let decoTile = decoration[r][c];
        if (decoTile === -1 || decoTile === undefined || decoTile === null) continue;
        if (OVERHEAD_TILE_IDS.has(decoTile) || collision[r][c] === 1) continue;

        if (decoTile === TILES.FLOWERS_1 && this.animFrame === 1) {
          decoTile = TILES.FLOWERS_2;
        }
        this._drawTile(ctx, decoTile, screenX, screenY);
      }
    }

    // Elementos de suelo de los minijuegos (interruptores, barrera de fuego, indicador de pila, portal)
    if (this.currentSceneId === 'armor_temple') {
      this.renderArmorPuzzle(ctx, camera, false);
    } else if (this.currentSceneId === 'sword_temple') {
      this.renderSwordPuzzle(ctx, camera, false);
    }
  }

  /** Ondulación del agua: dos destellos horizontales por tile que fluyen con una onda senoidal. */
  _drawWaterRipple(ctx, screenX, screenY, col, row) {
    const t = this.waterClock;
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
        p = { isTileProp: true, tileId: 0, sx: 0, sy: 0, sortY: 0, puzzle: null, mono: null };
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
        out.push(p);
      }
    }
  }

  /** Dibuja una entrada devuelta por collectYSortedProps(). */
  drawProp(ctx, camera, prop) {
    if (prop.puzzle === 'armor') {
      this.drawArmorMonolith(ctx, camera, prop.mono);
    } else if (prop.puzzle === 'sword') {
      this.drawSwordMonolith(ctx, camera, prop.mono);
    } else {
      this._drawTile(ctx, prop.tileId, prop.sx, prop.sy);
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
        this._drawTile(ctx, decoTile, screenX, screenY);

        // Sombra de alero proyectada sobre el muro situado justo debajo del tejado
        if (decoTile !== TILES.TREE_TOP && r + 1 < this.rows) {
          const below = decoration[r + 1][c];
          if (below === TILES.WALL_WOOD || below === TILES.WALL_WINDOW || below === TILES.WALL_DOOR) {
            const baseY = Math.round(screenY) + this.tileSize;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
            ctx.fillRect(Math.round(screenX), baseY, this.tileSize, 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.fillRect(Math.round(screenX), baseY + 2, this.tileSize, 2);
          }
        }
      }
    }
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

  _drawTile(ctx, tileId, screenX, screenY) {
    const sx = (tileId % this.tilesetCols) * this.tileSize * ATLAS_SCALE;
    const sy = Math.floor(tileId / this.tilesetCols) * this.tileSize * ATLAS_SCALE;
    ctx.drawImage(
      this.tilesetSheet,
      sx,
      sy,
      this.tileSize * ATLAS_SCALE,
      this.tileSize * ATLAS_SCALE,
      screenX,
      screenY,
      this.tileSize,
      this.tileSize
    );
  }
}

