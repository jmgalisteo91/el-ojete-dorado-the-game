import { TILES, ATLAS_SCALE } from '../graphics/SpriteSheetGenerator.js?v=7';
import { SpeechBubble, renderFloatingBadge } from '../ui/SpeechBubble.js?v=7';

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

    // Estado del puente de Valleverde y del portal del Primer Escenario
    this.bridgeOpen = false;
    this.bridgeForceUnlocked = false;
    this.bridgeOpenHour = 7;   // 07:00 AM
    this.bridgeCloseHour = 20; // 20:00 PM
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

    this._buildFirstStageScene();
    this._buildArmorTempleScene();
    this._buildSwordTempleScene();
    this._buildCondemnedRealmsScene();
    this._buildSewersDungeonScene();
    this._buildFortressGateScene();
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
    this.sceneTitle = scene.title;
  }

  isInterior() {
    return this.currentSceneId !== 'overworld' && this.currentSceneId !== 'first_stage';
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

  update(dt, currentHour = 12) {
    this.animTimer += dt;
    if (this.animTimer >= 0.45) {
      this.animTimer -= 0.45;
      this.animFrame = (this.animFrame + 1) % 2;
    }

    this._updateBridgeSchedule(currentHour);
  }

  /**
   * Actualiza si el puente está abierto.
   * El puente permanece clausurado por orden del Sabio Aurelio hasta que se desbloquea
   * con la autorización / Pase del Puente. Una vez desbloqueado, permanece abierto permanentemente.
   */
  _updateBridgeSchedule(currentHour) {
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

  isSolidAtTile(col, row) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
      return true;
    }
    return this.layers.collision[row][col] === 1;
  }

  /**
   * Devuelve la puerta de vivienda cercana si el jugador está en el exterior,
   * o la alfombra de salida si está en el interior.
   */
  findNearbyDoor(player) {
    if (this.currentSceneId === 'first_stage') {
      // 1. Portal del Este hacia el Pueblo de Valleverde (siempre accesible para retornar a zona segura)
      const gateX = 33 * this.tileSize;
      const gateY = 12.5 * this.tileSize;
      if (Math.hypot(player.centerX - gateX, player.centerY - gateY) <= 24) {
        return {
          type: 'stage_transition',
          targetScene: 'overworld',
          label: 'Regresar a la Aldea de Valleverde (Zona Segura)',
          worldX: gateX,
          worldY: gateY,
          spawnX: 3.5 * this.tileSize,
          spawnY: 12.5 * this.tileSize
        };
      }

      // 2. Puerta del Templo del Bastión (Mazmorra de la Armadura del Alba)
      const armorDoorX = 6.5 * this.tileSize;
      const armorDoorY = 8.5 * this.tileSize;
      if (Math.hypot(player.centerX - armorDoorX, player.centerY - armorDoorY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'armor_temple',
          label: 'Entrar al Templo de la Armadura (Nivel)',
          worldX: armorDoorX,
          worldY: armorDoorY,
          spawnX: 10.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }

      // 3. Puerta del Templo del Altar Sagrado (Mazmorra de la Espada del Alba)
      const swordDoorX = 17.5 * this.tileSize;
      const swordDoorY = 2.5 * this.tileSize;
      if (Math.hypot(player.centerX - swordDoorX, player.centerY - swordDoorY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'sword_temple',
          label: 'Entrar al Templo de la Espada (Nivel)',
          worldX: swordDoorX,
          worldY: swordDoorY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }

      // 4. Puerta al Umbral de la Fortaleza (Jefe Microondas Prototipo)
      const fortressDoorX = 28.5 * this.tileSize;
      const fortressDoorY = 3.5 * this.tileSize;
      if (Math.hypot(player.centerX - fortressDoorX, player.centerY - fortressDoorY) <= 24) {
        return {
          type: 'stage_transition',
          targetScene: 'ai_fortress_gate',
          label: 'Entrar al Umbral de la Fortaleza (Microondas Prototipo)',
          worldX: fortressDoorX,
          worldY: fortressDoorY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }

      return null;
    }

    if (
      this.currentSceneId === 'armor_temple' ||
      this.currentSceneId === 'sword_temple' ||
      this.currentSceneId === 'condemned_realms' ||
      this.currentSceneId === 'sewers_dungeon' ||
      this.currentSceneId === 'ai_fortress_gate' ||
      this.currentSceneId === 'ai_citadel'
    ) {
      // Puerta norte en el Umbral de la Fortaleza hacia la Ciudadela
      if (this.currentSceneId === 'ai_fortress_gate') {
        const portalX = 11.5 * this.tileSize;
        const portalY = 1.5 * this.tileSize;
        if (Math.hypot(player.centerX - portalX, player.centerY - portalY) <= 24) {
          return {
            type: 'stage_transition',
            targetScene: 'ai_citadel',
            label: 'Cruzar el Umbral hacia la Ciudadela de AI Alex (El Gran Ojal)',
            worldX: portalX,
            worldY: portalY,
            spawnX: 11.5 * this.tileSize,
            spawnY: 15 * this.tileSize
          };
        }
      }

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
              : this.currentSceneId === 'sewers_dungeon'
                ? 'Subir a Valleverde (Superficie)'
                : this.currentSceneId === 'ai_citadel'
                  ? 'Salir de la Ciudadela (Hacia el Umbral)'
                  : this.currentSceneId === 'ai_fortress_gate'
                    ? 'Salir a las Ruinas del Despertar'
                    : 'Salir a Valleverde (Pruebas Sagradas)';
          return {
            type: 'exit',
            targetScene: scene.exitDoor.returnScene || 'overworld',
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
      // Trampilla / Rejilla a las Alcantarillas de Valleverde (Jefe Garbage Collector)
      const sewerGrateX = 12.5 * this.tileSize;
      const sewerGrateY = 20.5 * this.tileSize;
      if (Math.hypot(player.centerX - sewerGrateX, player.centerY - sewerGrateY) <= 22) {
        return {
          type: 'stage_transition',
          targetScene: 'sewers_dungeon',
          label: 'Bajar a las Alcantarillas de Valleverde (Fosa de Memoria)',
          worldX: sewerGrateX,
          worldY: sewerGrateY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }

      // Barrera del Puente hacia las Tierras Sagradas del este (cuando está cerrado)
      if (!this.bridgeOpen) {
        const bridgeX = 26.5 * this.tileSize;
        const bridgeY = 12.5 * this.tileSize;
        if (Math.hypot(player.centerX - bridgeX, player.centerY - bridgeY) <= 24) {
          return {
            type: 'bridge_gate',
            label: 'Barrera del Puente (Precintado por el Sabio)',
            worldX: bridgeX,
            worldY: bridgeY
          };
        }
      }

      const westRoadX = 1.5 * this.tileSize;
      const westRoadY = 12.5 * this.tileSize;
      if (Math.hypot(player.centerX - westRoadX, player.centerY - westRoadY) <= 30) {
        return {
          type: 'stage_transition',
          targetScene: 'first_stage',
          label: 'Viajar a Ruinas del Despertar (Escenario 1)',
          worldX: westRoadX,
          worldY: westRoadY,
          spawnX: 31 * this.tileSize,
          spawnY: 12 * this.tileSize
        };
      }

      // Portal norte cruzando el río hacia el Templo de la Armadura Binaria
      const armorGateX = 34.5 * this.tileSize;
      const armorGateY = 5.5 * this.tileSize;
      if (Math.hypot(player.centerX - armorGateX, player.centerY - armorGateY) <= 24) {
        return {
          type: 'stage_transition',
          targetScene: 'armor_temple',
          label: 'Prueba Sagrada: Templo de la Armadura del Código Binario',
          worldX: armorGateX,
          worldY: armorGateY,
          spawnX: 10.5 * this.tileSize,
          spawnY: 15 * this.tileSize
        };
      }

      // Portal sur cruzando el río hacia el Templo de la Espada de la Recursividad
      const swordGateX = 34.5 * this.tileSize;
      const swordGateY = 19.5 * this.tileSize;
      if (Math.hypot(player.centerX - swordGateX, player.centerY - swordGateY) <= 24) {
        return {
          type: 'stage_transition',
          targetScene: 'sword_temple',
          label: 'Prueba Sagrada: Templo de la Espada de la Recursividad',
          worldX: swordGateX,
          worldY: swordGateY,
          spawnX: 11.5 * this.tileSize,
          spawnY: 15 * this.tileSize
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
    if (this.currentSceneId !== 'overworld') return null;
    const scene = this.scenes.overworld;
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
   * Construye el Primer Escenario ("Las Ruinas del Despertar"):
   * - Santuario inicial en el sur junto al Sabio Aurelio
   * - Bastión Oeste donde se encuentra la Armadura del Alba
   * - Altar Sagrado del Norte donde descansa la primera arma: La Espada del Alba
   * - Caminos patrullados por los esbirros del malvado Mister AI Alex
   * - Portal del Este hacia el Pueblo de Valleverde
   */
  _buildFirstStageScene() {
    const cols = 36;
    const rows = 24;
    const ground = this._createGrid(cols, rows, TILES.GRASS_1);
    const decoration = this._createGrid(cols, rows, -1);
    const collision = this._createGrid(cols, rows, 0);
    const lightSources = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r * 11 + c * 7) % 4 === 0) {
          ground[r][c] = TILES.GRASS_2;
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

    // 1. Santuario Seguro del Sur (donde despierta el héroe junto al Sabio)
    fillRect(ground, 14, 17, 7, 5, TILES.COBBLE);
    // Caminos principales hacia el Oeste (Armadura), Norte (Espada) y Este (Portal a Valleverde)
    fillRect(ground, 16, 6, 3, 12, TILES.PATH);
    fillRect(ground, 6, 11, 28, 3, TILES.PATH);

    // 2. Bastión Oeste: Fachada de entrada al Templo de la Armadura
    fillRect(ground, 4, 8, 6, 7, TILES.STONE_FLOOR);
    setDeco(4, 8, TILES.WALL_INTERIOR, true);
    setDeco(5, 8, TILES.WALL_INTERIOR, true);
    setDeco(6, 8, TILES.DOOR, false);
    setDeco(7, 8, TILES.WALL_INTERIOR, true);
    setDeco(8, 8, TILES.WALL_INTERIOR, true);
    setDeco(4, 9, TILES.LAMPPOST, true);
    setDeco(8, 9, TILES.LAMPPOST, true);
    setDeco(5, 11, TILES.SIGNPOST, true);
    lightSources.push(
      { x: 6.5 * 16, y: 8.5 * 16, radius: 52, intensity: 1.0 },
      { x: 4.5 * 16, y: 9.5 * 16, radius: 42, intensity: 0.85 },
      { x: 8.5 * 16, y: 9.5 * 16, radius: 42, intensity: 0.85 }
    );

    // 3. Altar Sagrado del Norte: Fachada de entrada al Templo de la Espada
    fillRect(ground, 14, 2, 7, 6, TILES.STONE_FLOOR);
    setDeco(14, 2, TILES.WALL_INTERIOR, true);
    setDeco(15, 2, TILES.WALL_INTERIOR, true);
    setDeco(16, 2, TILES.WALL_INTERIOR, true);
    setDeco(17, 2, TILES.DOOR, false);
    setDeco(18, 2, TILES.WALL_INTERIOR, true);
    setDeco(19, 2, TILES.WALL_INTERIOR, true);
    setDeco(20, 2, TILES.WALL_INTERIOR, true);
    setDeco(15, 3, TILES.LAMPPOST, true);
    setDeco(19, 3, TILES.LAMPPOST, true);
    lightSources.push(
      { x: 17.5 * 16, y: 2.5 * 16, radius: 64, intensity: 1.0 },
      { x: 15.5 * 16, y: 3.5 * 16, radius: 46, intensity: 0.9 },
      { x: 19.5 * 16, y: 3.5 * 16, radius: 46, intensity: 0.9 }
    );

    // 3b. Umbral de la Fortaleza de AI Alex en el Noreste (Microondas Prototipo + Acceso a Mister AI Alex)
    fillRect(ground, 26, 2, 5, 4, TILES.STONE_FLOOR);
    fillRect(ground, 28, 6, 2, 6, TILES.PATH);
    setDeco(26, 2, TILES.WALL_INTERIOR, true);
    setDeco(27, 2, TILES.WALL_INTERIOR, true);
    setDeco(28, 2, TILES.PORTAL_GATE_OPEN, true);
    setDeco(29, 2, TILES.PORTAL_GATE_OPEN, true);
    setDeco(30, 2, TILES.WALL_INTERIOR, true);
    setDeco(26, 3, TILES.LAMPPOST, true);
    setDeco(30, 3, TILES.LAMPPOST, true);
    lightSources.push(
      { x: 28.5 * 16, y: 2.5 * 16, radius: 64, intensity: 1.0, color: '#ef4444' },
      { x: 26.5 * 16, y: 3.5 * 16, radius: 44, intensity: 0.85 },
      { x: 30.5 * 16, y: 3.5 * 16, radius: 44, intensity: 0.85 }
    );

    // 4. Farolas del Santuario del Sabio en el Sur
    setDeco(14, 17, TILES.LAMPPOST, true);
    setDeco(20, 17, TILES.LAMPPOST, true);
    setDeco(15, 16, TILES.SIGNPOST, true);
    lightSources.push(
      { x: 14.5 * 16, y: 17.5 * 16, radius: 48, intensity: 0.95 },
      { x: 20.5 * 16, y: 17.5 * 16, radius: 48, intensity: 0.95 }
    );

    // 5. Portal del Este hacia el Pueblo de Valleverde
    for (let r = 10; r <= 15; r++) {
      if (r !== 12 && r !== 13) {
        setDeco(33, r, TILES.FENCE_POST, true);
      }
    }
    setDeco(33, 12, TILES.PORTAL_GATE_CLOSED, true);
    setDeco(33, 13, TILES.PORTAL_GATE_CLOSED, true);
    lightSources.push({ x: 33.5 * 16, y: 12.5 * 16, radius: 50, intensity: 0.9 });

    // 6. Árboles y rocas perimetrales formando los senderos del escenario
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

    // Bosquecillos intermedios para crear rutas tácticas de esquiva
    const tacticalTrees = [
      [11, 7], [12, 8], [22, 7], [23, 8],
      [11, 16], [12, 17], [22, 16], [23, 17],
      [25, 8], [28, 16]
    ];
    for (const [tc, tr] of tacticalTrees) {
      placeTree(tc, tr);
    }

    const flowers = [
      [15, 19], [19, 19], [7, 14], [16, 8], [18, 8], [26, 11], [26, 13]
    ];
    for (const [fc, fr] of flowers) {
      setDeco(fc, fr, TILES.FLOWERS_1, false);
    }

    this.scenes.first_stage = {
      title: 'Escenario 1 · Ruinas del Despertar',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources
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

    // Camino Norte-Sur y ramales a puertas de las 5 viviendas
    fillRect(ground, 17, 4, 2, 18, TILES.PATH);
    fillRect(ground, 13, 9, 9, 7, TILES.COBBLE);
    fillRect(ground, 8, 7, 2, 5, TILES.PATH);
    fillRect(ground, 15, 7, 2, 2, TILES.PATH);
    fillRect(ground, 23, 7, 2, 5, TILES.PATH);
    fillRect(ground, 7, 19, 2, 2, TILES.PATH);
    fillRect(ground, 7, 14, 2, 2, TILES.PATH);
    fillRect(ground, 19, 19, 4, 2, TILES.PATH);
    fillRect(ground, 18, 19, 2, 2, TILES.PATH);

    // === PLAZA DE LA ALCANTARILLA MUNICIPAL (EL GARBAGE COLLECTOR FURIOSO) ===
    fillRect(ground, 11, 20, 4, 2, TILES.STONE_FLOOR);
    fillRect(ground, 15, 20, 3, 2, TILES.PATH);
    lightSources.push({
      x: 12.5 * this.tileSize,
      y: 20.5 * this.tileSize,
      radius: 44,
      intensity: 0.9,
      color: '#22c55e'
    });

    // === MERCADO CENTRAL DE LA PLAZA DE VALLEVERDE ===
    // 1. Puesto Noroeste: Panadería y Frutas de Clara
    setDeco(14, 9, TILES.ROOF_RED, true);
    setDeco(15, 9, TILES.ROOF_RED, true);
    setDeco(14, 10, TILES.TABLE, true);
    setDeco(15, 10, TILES.TABLE, true);
    setDeco(13, 10, TILES.CRATE, true);
    setDeco(13, 9, TILES.LAMPPOST, true);

    // 2. Puesto Noreste: Tienda de Software de Byte
    setDeco(19, 9, TILES.ROOF_BLUE, true);
    setDeco(20, 9, TILES.ROOF_BLUE, true);
    setDeco(19, 10, TILES.TABLE, true);
    setDeco(20, 10, TILES.TABLE, true);
    setDeco(21, 10, TILES.CRATE, true);
    setDeco(21, 9, TILES.LAMPPOST, true);

    // 3. Puesto Suroeste: Alquimia y Pociones de Pip
    setDeco(14, 14, TILES.ROOF_BLUE, true);
    setDeco(15, 14, TILES.ROOF_BLUE, true);
    setDeco(14, 15, TILES.TABLE, true);
    setDeco(15, 15, TILES.TABLE, true);
    setDeco(13, 15, TILES.CRATE, true);
    setDeco(13, 14, TILES.LAMPPOST, true);

    // 4. Puesto Sureste: Pescadería de Finn
    setDeco(19, 14, TILES.ROOF_RED, true);
    setDeco(20, 14, TILES.ROOF_RED, true);
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

    const buildHouse = (c0, r0, width, roofTile, doorOffset, sceneId, label, ownerName) => {
      for (let r = r0; r < r0 + 2; r++) {
        for (let c = c0; c < c0 + width; c++) {
          setDeco(c, r, roofTile, true);
        }
      }
      const wallRow = r0 + 2;
      for (let c = c0; c < c0 + width; c++) {
        const localC = c - c0;
        if (localC === doorOffset) {
          setDeco(c, wallRow, TILES.WALL_DOOR, true);
          this.houseDoors.push({
            sceneId,
            label,
            ownerName,
            doorCol: c,
            doorRow: wallRow,
            worldX: c * this.tileSize + 8,
            worldY: (wallRow + 1) * this.tileSize + 2,
            returnX: c * this.tileSize,
            returnY: (wallRow + 1) * this.tileSize + 2,
            interiorSpawnX: 5.5 * this.tileSize,
            interiorSpawnY: 6 * this.tileSize
          });
        } else if (localC === 1 || localC === width - 2) {
          setDeco(c, wallRow, TILES.WALL_WINDOW, true);
          lightSources.push({
            x: c * this.tileSize + 8,
            y: wallRow * this.tileSize + 8,
            radius: 28,
            intensity: 0.7
          });
        } else {
          setDeco(c, wallRow, TILES.WALL_WOOD, true);
        }
      }
    };

    // Viviendas del pueblo: las 5 de los vecinos + La Casa del Programador (Tu Hogar)
    buildHouse(1,  8, 4, TILES.ROOF_RED,  2, 'player_house',     'Casa del Programador (Tu Hogar)', 'Tú (Programador)');
    buildHouse(6,  4, 5, TILES.ROOF_BLUE, 2, 'elder_house',      'Casa de Aurelio (Cronista)',   'Anciano Aurelio');
    buildHouse(13, 4, 4, TILES.ROOF_BLUE, 2, 'oracle_house',     'Observatorio de Orion (IA)',   'Oráculo Orion [IA]');
    buildHouse(21, 4, 5, TILES.ROOF_RED,  2, 'blacksmith_house', 'Herrería de Brom (Forjador)',  'Herrero Brom');
    buildHouse(5, 16, 5, TILES.ROOF_RED,  2, 'herbalist_house',  'Cabaña de Lyra (Alquimista)',  'Herbolaria Lyra');
    buildHouse(20, 16, 5, TILES.ROOF_BLUE, 2, 'guard_house',     'Cuartel de Kael (Capitán)',    'Guardia Kael');

    // === PRUEBAS SAGRADAS AL ESTE DEL PUENTE ===
    // 1. Entrada norte a la Prueba de la Armadura del Código Binario
    setDeco(34, 5, TILES.PORTAL_GATE_OPEN, true);
    setDeco(35, 5, TILES.PORTAL_GATE_OPEN, true);
    setDeco(33, 5, TILES.LAMPPOST, true);
    setDeco(36, 5, TILES.LAMPPOST, true);

    // 2. Entrada sur a la Prueba de la Espada de la Recursividad
    setDeco(34, 19, TILES.PORTAL_GATE_OPEN, true);
    setDeco(35, 19, TILES.PORTAL_GATE_OPEN, true);
    setDeco(33, 19, TILES.LAMPPOST, true);
    setDeco(36, 19, TILES.LAMPPOST, true);

    // 3. Altar central de la Reliquia: El Microondas Little (Sin Despertador)
    setDeco(36, 12, TILES.ALTAR, true);
    setDeco(36, 13, TILES.ALTAR, true);
    setDeco(35, 12, TILES.FLOWERS_1, false);
    setDeco(35, 13, TILES.FLOWERS_1, false);

    setDeco(26, 6, TILES.ANVIL, true);
    setDeco(26, 5, TILES.CRATE, true);
    setDeco(20, 6, TILES.CRATE, true);

    // Corral / Jardín
    for (let c = 11; c <= 14; c++) {
      setDeco(c, 16, TILES.FENCE_H, true);
      setDeco(c, 19, TILES.FENCE_H, true);
    }
    setDeco(11, 17, TILES.FENCE_POST, true);
    setDeco(14, 17, TILES.FENCE_POST, true);
    setDeco(14, 18, TILES.FENCE_POST, true);

    const flowerCoords = [
      [12, 17], [13, 17], [12, 18], [13, 18],
      [5, 8], [11, 5], [20, 8],
      [25, 15], [32, 10], [33, 14]
    ];
    for (const [fc, fr] of flowerCoords) {
      setDeco(fc, fr, TILES.FLOWERS_1, false);
    }

    // Farolas
    const lampposts = [
      [13, 9], [21, 9], [13, 15], [21, 15],
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

    // === LETREROS DE SEÑALIZACIÓN DE CAMINOS ===
    const signposts = [
      {
        c: 4,
        r: 11,
        shortName: 'Camino Oeste',
        title: '🪧 Camino Oeste · Hacia las Ruinas del Despertar',
        lines: [
          '«← OESTE: Camino a las Ruinas del Despertar (Escenario 1) y el Santuario Sur.»',
          '«¡PRECAUCIÓN! Más allá de los límites protegidos de Valleverde acechan bugs, sombras y esbirros de AI Alex. Asegúrate de estar preparado antes de partir.»'
        ]
      },
      {
        c: 26,
        r: 11,
        shortName: 'Camino Este (Puente)',
        title: '🪧 Camino Este · Puente sobre el Río Alba',
        lines: [
          '«→ ESTE: Puente de Valleverde sobre el Río Alba.»',
          '«Conduce a las Pruebas Sagradas: Templo de la Armadura Binaria (Norte) y Templo de la Espada de la Recursividad (Sur).»',
          '«(Nota del Cronista: La Reliquia Divina del Microondas Little se custodia en el cofre del Sabio Aurelio).»'
        ]
      },
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
          '«← Oeste: Casa del Programador. ↑ Norte: Casa del Sabio. ↓ Sur: Cuartel de la Guardia.»'
        ]
      },
      {
        c: 16,
        r: 7,
        shortName: 'Cruce Norte',
        title: '🪧 Cruce Norte de Valleverde',
        lines: [
          '«← Casa del Sabio Aurelio (Cronista y Archivero).»',
          '«↑ Observatorio de Orion (Astrólogo IA).»',
          '«→ Herrería de Brom (Maestro Forjador).»'
        ]
      },
      {
        c: 18,
        r: 17,
        shortName: 'Cruce Sur',
        title: '🪧 Cruce Sur de Valleverde',
        lines: [
          '«← Cabaña de Lyra (Alquimista y Herbolaria).»',
          '«→ Cuartel de la Guardia del Binario y Calabozo Municipal.»',
          '«↙ SUROESTE: Alcantarillas Municipales (💀 Garbage Collector Furioso).»'
        ]
      },
      {
        c: 10,
        r: 20,
        shortName: 'Alcantarillas',
        title: '🪧 Entrada a las Alcantarillas · El Garbage Collector',
        lines: [
          '«↓ TRAMPILLA DE HIERRO: Acceso a la Fosa de Memoria Subterránea.»',
          '«💀 PELIGRO DE JEFE: El Garbage Collector Furioso custodia las cloacas. Requiere Armadura Binaria y Espada de la Recursividad.»',
          '«Recompensa al derrotarlo: Habilidad [Dash Asíncrono] (Tecla SHIFT).»'
        ]
      }
    ];

    for (const sp of signposts) {
      setDeco(sp.c, sp.r, TILES.SIGNPOST, true);
    }

    const bushes = [
      [5, 7], [11, 7], [20, 7], [4, 19], [10, 19], [25, 19]
    ];
    for (const [bc, br] of bushes) {
      setDeco(bc, br, TILES.BUSH, true);
    }

    // Comprueba si una celda corresponde a caminos hacia otras zonas o la plaza para NO plantar árboles
    const isRoadOrPlazaArea = (c, r) => {
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
      title: 'Templo del Bastión · Nivel de la Armadura',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 10.5 * 16,
        worldY: 16.5 * 16,
        returnX: 34.5 * 16,
        returnY: 7 * 16,
        returnScene: 'overworld'
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
      title: 'Templo del Altar Sagrado · Nivel de la Espada',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 34.5 * 16,
        returnY: 18 * 16,
        returnScene: 'overworld'
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
   * Construye las Alcantarillas de Valleverde (Fosa de Memoria):
   * Escenario de batalla subterráneo donde mora "El Garbage Collector Furioso".
   */
  _buildSewersDungeonScene() {
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

    const setDeco = (c, r, tileId, blocks = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (blocks) collision[r][c] = 1;
      }
    };

    // Muros perimetrales
    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.TEMPLE_WALL, true);
      setDeco(c, 1, TILES.TEMPLE_WALL, true);
      setDeco(c, rows - 1, TILES.TEMPLE_WALL, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.TEMPLE_WALL, true);
      setDeco(1, r, TILES.TEMPLE_WALL, true);
      setDeco(cols - 1, r, TILES.TEMPLE_WALL, true);
      setDeco(cols - 2, r, TILES.TEMPLE_WALL, true);
    }

    // Canales de aguas residuales / ácido
    fillRect(ground, 4, 4, 16, 10, TILES.STONE_PATH);
    fillRect(ground, 2, 7, 2, 4, TILES.WATER_1);
    fillRect(ground, 20, 7, 2, 4, TILES.WATER_1);

    // Columnas industriales de la fosa
    setDeco(5, 5, TILES.TEMPLE_PILLAR, true);
    setDeco(18, 5, TILES.TEMPLE_PILLAR, true);
    setDeco(5, 12, TILES.TEMPLE_PILLAR, true);
    setDeco(18, 12, TILES.TEMPLE_PILLAR, true);

    // Antorchas con bioluminiscencia verdosa de fosa de memoria
    lightSources.push({ x: 5.5 * 16, y: 5.5 * 16, radius: 48, intensity: 0.85, color: '#10b981' });
    lightSources.push({ x: 18.5 * 16, y: 5.5 * 16, radius: 48, intensity: 0.85, color: '#10b981' });
    lightSources.push({ x: 11.5 * 16, y: 9.5 * 16, radius: 64, intensity: 0.95, color: '#34d399' });

    // Puerta de salida (escalera de subida) en el muro sur
    setDeco(11, rows - 1, -1, false);
    setDeco(12, rows - 1, -1, false);
    collision[rows - 1][11] = 0;
    collision[rows - 1][12] = 0;

    this.scenes.sewers_dungeon = {
      title: 'Alcantarillas de Valleverde · Fosa de la Memoria',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 12.5 * 16,
        returnY: 21 * 16,
        returnScene: 'overworld'
      }
    };
  }

  /**
   * Construye el Umbral de la Fortaleza de AI Alex:
   * Arena cibernética donde custodia "El Microondas Prototipo (V0.1 Alpha)".
   */
  _buildFortressGateScene() {
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

    const setDeco = (c, r, tileId, blocks = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (blocks) collision[r][c] = 1;
      }
    };

    // Muros perimetrales reforzados
    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.TEMPLE_WALL, true);
      setDeco(c, 1, TILES.TEMPLE_WALL, true);
      setDeco(c, rows - 1, TILES.TEMPLE_WALL, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.TEMPLE_WALL, true);
      setDeco(1, r, TILES.TEMPLE_WALL, true);
      setDeco(cols - 1, r, TILES.TEMPLE_WALL, true);
      setDeco(cols - 2, r, TILES.TEMPLE_WALL, true);
    }

    // Pistas de circuitos de energía térmica
    fillRect(ground, 3, 3, 18, 12, TILES.STONE_PATH);

    // Columnas metálicas del umbral
    setDeco(5, 5, TILES.TEMPLE_PILLAR, true);
    setDeco(18, 5, TILES.TEMPLE_PILLAR, true);
    setDeco(5, 11, TILES.TEMPLE_PILLAR, true);
    setDeco(18, 11, TILES.TEMPLE_PILLAR, true);

    // Fuentes de luz roja/ámbar
    lightSources.push({ x: 5.5 * 16, y: 5.5 * 16, radius: 52, intensity: 0.9, color: '#f97316' });
    lightSources.push({ x: 18.5 * 16, y: 5.5 * 16, radius: 52, intensity: 0.9, color: '#f97316' });
    lightSources.push({ x: 11.5 * 16, y: 8.5 * 16, radius: 64, intensity: 1.0, color: '#ef4444' });

    // Puerta de salida en el sur
    setDeco(11, rows - 1, -1, false);
    setDeco(12, rows - 1, -1, false);
    collision[rows - 1][11] = 0;
    collision[rows - 1][12] = 0;

    // Portal al norte hacia la Ciudadela de AI Alex
    setDeco(11, 1, TILES.PORTAL_GATE_OPEN, false);
    setDeco(12, 1, TILES.PORTAL_GATE_OPEN, false);
    collision[1][11] = 0;
    collision[1][12] = 0;

    this.scenes.ai_fortress_gate = {
      title: 'Umbral de la Fortaleza · Microondas Prototipo',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 28.5 * 16,
        returnY: 5 * 16,
        returnScene: 'first_stage'
      }
    };
  }

  /**
   * Construye la Ciudadela de AI Alex (El Gran Ojal):
   * Arena cuántica monumental donde se libra la confrontación final contra Mister AI Alex.
   */
  _buildCitadelScene() {
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

    const setDeco = (c, r, tileId, blocks = true) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        decoration[r][c] = tileId;
        if (blocks) collision[r][c] = 1;
      }
    };

    // Muros perimetrales
    for (let c = 0; c < cols; c++) {
      setDeco(c, 0, TILES.TEMPLE_WALL, true);
      setDeco(c, 1, TILES.TEMPLE_WALL, true);
      setDeco(c, rows - 1, TILES.TEMPLE_WALL, true);
    }
    for (let r = 0; r < rows; r++) {
      setDeco(0, r, TILES.TEMPLE_WALL, true);
      setDeco(1, r, TILES.TEMPLE_WALL, true);
      setDeco(cols - 1, r, TILES.TEMPLE_WALL, true);
      setDeco(cols - 2, r, TILES.TEMPLE_WALL, true);
    }

    // Pavimento central con alfombra carmesí y circuitos cuánticos
    fillRect(ground, 3, 3, 18, 12, TILES.STONE_PATH);
    fillRect(ground, 8, 4, 8, 10, TILES.RUG_RED);

    // Pilares cuánticos del Gran Ojal
    setDeco(6, 6, TILES.TEMPLE_PILLAR, true);
    setDeco(17, 6, TILES.TEMPLE_PILLAR, true);
    setDeco(6, 12, TILES.TEMPLE_PILLAR, true);
    setDeco(17, 12, TILES.TEMPLE_PILLAR, true);

    // Altar del Gran Ojal en el norte
    setDeco(11, 2, TILES.ALTAR_PEDESTAL, false);
    setDeco(12, 2, TILES.ALTAR_PEDESTAL, false);

    // Fuentes de luz carmesí y dorada
    lightSources.push(
      { x: 11.5 * 16, y: 2.5 * 16, radius: 84, intensity: 1.0, color: '#ef4444' },
      { x: 6.5 * 16, y: 6.5 * 16, radius: 50, intensity: 0.85, color: '#fde047' },
      { x: 17.5 * 16, y: 6.5 * 16, radius: 50, intensity: 0.85, color: '#fde047' },
      { x: 11.5 * 16, y: 15.5 * 16, radius: 50, intensity: 0.8, color: '#38bdf8' }
    );

    // Felpudo y salida en el sur
    setDeco(11, rows - 1, TILES.EXIT_MAT, false);
    setDeco(12, rows - 1, TILES.EXIT_MAT, false);
    collision[rows - 1][11] = 0;
    collision[rows - 1][12] = 0;

    this.scenes.ai_citadel = {
      title: 'Ciudadela de AI Alex · El Gran Ojal',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: 16.5 * 16,
        returnX: 11.5 * 16,
        returnY: 3 * 16,
        returnScene: 'ai_fortress_gate'
      }
    };
  }

  render(ctx, camera, enemies = [], player = null) {
    const camX = camera.renderX;
    const camY = camera.renderY;

    const startCol = Math.max(0, Math.floor(camX / this.tileSize));
    const endCol = Math.min(
      this.cols - 1,
      Math.ceil((camX + camera.viewportWidth) / this.tileSize)
    );
    const startRow = Math.max(0, Math.floor(camY / this.tileSize));
    const endRow = Math.min(
      this.rows - 1,
      Math.ceil((camY + camera.viewportHeight) / this.tileSize)
    );

    const { ground, decoration } = this.layers;

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const screenX = c * this.tileSize - camX;
        const screenY = r * this.tileSize - camY;

        let groundTile = ground[r][c];
        if (groundTile === TILES.WATER_1 && this.animFrame === 1) {
          groundTile = TILES.WATER_2;
        }
        this._drawTile(ctx, groundTile, screenX, screenY);

        let decoTile = decoration[r][c];
        if (decoTile !== -1) {
          if (decoTile === TILES.FLOWERS_1 && this.animFrame === 1) {
            decoTile = TILES.FLOWERS_2;
          }
          this._drawTile(ctx, decoTile, screenX, screenY);
        }
      }
    }

    // Renderizar elementos dinámicos de los minijuegos y señalizaciones de Bosses/Mazmorras
    if (this.currentSceneId === 'armor_temple') {
      this.renderArmorPuzzle(ctx, camera);
    } else if (this.currentSceneId === 'sword_temple') {
      this.renderSwordPuzzle(ctx, camera);
    }

    this.renderBossAndDungeonIndicators(ctx, camera, enemies, player);
  }

  /**
   * Renderiza la trampilla pixel-art de la Alcantarilla en Valleverde y las indicaciones
   * flotantes de todos los Bosses y Templos principales para guiar visualmente al jugador.
   */
  renderBossAndDungeonIndicators(ctx, camera, enemies = [], player = null) {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const t = performance.now() * 0.003;

    const isBossDead = (bossId) => {
      if (!Array.isArray(enemies)) return false;
      const b = enemies.find((e) => e.id === bossId);
      return Boolean(b && b.dead);
    };

    const drawFloatingMarker = (worldX, worldY, label, subLabel, borderColor, textColor, pulseArrow = true) => {
      const sx = Math.round(worldX - camX);
      const sy = Math.round(worldY - camY + Math.sin(t * 2.2) * 1.8);
      if (sx < -90 || sx > camera.viewportWidth + 90 || sy < -40 || sy > camera.viewportHeight + 40) {
        return;
      }
      SpeechBubble.renderFloatingBadge(ctx, sx, sy, label, subLabel, borderColor, textColor, pulseArrow);
    };

    if (this.currentSceneId === 'overworld') {
      // 1. DIBUJAR ALCANTARILLA / TRAMPILLA SUBTERRÁNEA EN (12..13, 20)
      const gx = Math.round(12 * this.tileSize - camX);
      const gy = Math.round(20 * this.tileSize - camY);
      const garbageCollectorDead = isBossDead('boss_garbage_collector');

      ctx.save();
      // Brocal de piedra oscura (24x16 px centrado en 12.5, 20.5)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(gx + 4, gy + 1, 24, 15);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.strokeRect(gx + 4.5, gy + 1.5, 23, 14);

      // Foso abisal interior
      ctx.fillStyle = '#020617';
      ctx.fillRect(gx + 6, gy + 3, 20, 11);

      // Escalera metálica descendente en el lado derecho de la alcantarilla
      ctx.fillStyle = '#b45309';
      ctx.fillRect(gx + 18, gy + 3, 1, 11);
      ctx.fillRect(gx + 23, gy + 3, 1, 11);
      ctx.fillStyle = '#f59e0b';
      for (let ry = 5; ry <= 12; ry += 3) {
        ctx.fillRect(gx + 19, gy + ry, 4, 1);
      }

      // Barrotes de hierro forjado en la mitad izquierda
      ctx.fillStyle = '#475569';
      for (let bx = 8; bx <= 15; bx += 3) {
        ctx.fillRect(gx + bx, gy + 3, 1, 11);
      }
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(gx + 6, gy + 8, 11, 1);

      // Vapores verdes de Memory Leak emanando si el Garbage Collector sigue activo
      if (!garbageCollectorDead) {
        const fumeAlpha = 0.35 + Math.sin(t * 2.5) * 0.2;
        ctx.fillStyle = `rgba(34, 197, 94, ${fumeAlpha.toFixed(2)})`;
        const fy1 = Math.round((t * 8) % 10);
        const fy2 = Math.round(((t * 8) + 5) % 10);
        ctx.fillRect(gx + 9, gy + 8 - fy1, 3, 3);
        ctx.fillRect(gx + 15, gy + 9 - fy2, 2, 2);
      }
      ctx.restore();

      // Indicador flotante sobre la Alcantarilla (Garbage Collector)
      drawFloatingMarker(
        12.5 * this.tileSize,
        19.6 * this.tileSize,
        garbageCollectorDead ? '✓ ALCANTARILLA (GARBAGE COLLECTOR PURGADO)' : '💀 ALCANTARILLAS: GARBAGE COLLECTOR [E]',
        garbageCollectorDead ? 'Habilidad: Dash Asíncrono' : 'El Garbage Collector Furioso',
        garbageCollectorDead ? '#22c55e' : '#ef4444',
        garbageCollectorDead ? '#86efac' : '#fca5a5'
      );

      // Indicador flotante sobre Templo de la Armadura Binaria
      const hasArmor = Boolean(player && player.hasArmor);
      drawFloatingMarker(
        34.5 * this.tileSize,
        4.4 * this.tileSize,
        hasArmor ? '✓ TEMPLO DE LA ARMADURA BINARIA' : '🛡️ TEMPLO DE LA ARMADURA BINARIA [E]',
        'Prueba de Paridad y Lógica Binaria',
        hasArmor ? '#22c55e' : '#38bdf8',
        hasArmor ? '#86efac' : '#7dd3fc'
      );

      // Indicador flotante sobre Templo de la Espada (Guardián del Stack Overflow)
      const stackOverflowDead = isBossDead('boss_stack_overflow');
      const hasSword = Boolean(player && player.hasSword);
      drawFloatingMarker(
        34.5 * this.tileSize,
        18.4 * this.tileSize,
        stackOverflowDead && hasSword ? '✓ TEMPLO DE LA ESPADA: DESPEJADO' : '⚔️ TEMPLO DE LA ESPADA + 💀 GUARDIÁN DEL STACK [E]',
        'Guardián del Stack Overflow',
        stackOverflowDead && hasSword ? '#22c55e' : '#f59e0b',
        stackOverflowDead && hasSword ? '#86efac' : '#fde047'
      );

      // Indicador en la salida Oeste hacia Ruinas del Despertar
      drawFloatingMarker(
        2.4 * this.tileSize,
        11.3 * this.tileSize,
        '◀ RUINAS DEL DESPERTAR',
        '💀 Fortaleza de AI Alex',
        '#c084fc',
        '#e9d5ff'
      );
    } else if (this.currentSceneId === 'first_stage') {
      const hasArmor = Boolean(player && player.hasArmor);
      const hasSword = Boolean(player && player.hasSword);
      const stackOverflowDead = isBossDead('boss_stack_overflow');
      const microwaveDead = isBossDead('boss_prototype_microwave');

      drawFloatingMarker(
        6.5 * this.tileSize,
        6.3 * this.tileSize,
        hasArmor ? '✓ TEMPLO ARMADURA BINARIA' : '🛡️ TEMPLO ARMADURA BINARIA [E]',
        'Oeste · Equípate primero aquí',
        hasArmor ? '#22c55e' : '#38bdf8',
        hasArmor ? '#86efac' : '#7dd3fc'
      );

      drawFloatingMarker(
        17.5 * this.tileSize,
        1.6 * this.tileSize,
        stackOverflowDead && hasSword ? '✓ TEMPLO ESPADA + GUARDIÁN' : '⚔️ TEMPLO ESPADA + 💀 GUARDIÁN DEL STACK [E]',
        'Norte · Guardián del Stack Overflow',
        stackOverflowDead && hasSword ? '#22c55e' : '#f59e0b',
        stackOverflowDead && hasSword ? '#86efac' : '#fde047'
      );

      drawFloatingMarker(
        28.5 * this.tileSize,
        1.6 * this.tileSize,
        microwaveDead ? '👑 ACCESO CIUDADELA (MISTER AI ALEX) [E]' : '💀 LABORATORIO ALPHA: MICROONDAS PROTOTIPO [E]',
        microwaveDead ? 'Hacia Mister AI Alex' : 'Microondas Prototipo V0.1 + Ciudadela',
        '#ef4444',
        '#fca5a5'
      );
    } else if (this.currentSceneId === 'sword_temple') {
      const stackOverflowDead = isBossDead('boss_stack_overflow');
      if (!stackOverflowDead) {
        drawFloatingMarker(
          11.5 * this.tileSize,
          1.3 * this.tileSize,
          this.swordPuzzle?.portalOpen ? '💀 GUARDIÁN DEL STACK OVERFLOW (ACTIVO)' : '🔒 PORTAL SELLADO DEL ABISMO',
          this.swordPuzzle?.portalOpen ? '¡Derrota al jefe en la arena!' : 'Descifra el paso recursivo en las runas',
          '#a855f7',
          '#e9d5ff'
        );
      }
    } else if (this.currentSceneId === 'ai_fortress_gate') {
      const microwaveDead = isBossDead('boss_prototype_microwave');
      const finalDead = isBossDead('boss_final_ai_alex');
      drawFloatingMarker(
        11.5 * this.tileSize,
        1.3 * this.tileSize,
        finalDead ? '✓ CIUDADELA DE AI ALEX LIBERADA' : '👑 BATALLA FINAL: CIUDADELA DE AI ALEX [E]',
        microwaveDead ? 'Cruza el portal norte hacia El Gran Ojal' : '¡Cuidado: Microondas Prototipo en sala!',
        '#ef4444',
        '#fde047'
      );
    }
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

      // Retirar la barrera de fuego en la capa de colisión y decoración del templo
      const temple = this.scenes.armor_temple;
      if (temple && temple.layers) {
        for (let c = 9; c <= 11; c++) {
          temple.layers.collision[5][c] = 0;
          temple.layers.decoration[5][c] = -1;
        }
      }
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
  renderArmorPuzzle(ctx, camera) {
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

    // 2. Render de los 3 Monolitos Crípticos de Lógica Abstracta (Alfa, Beta, Gamma)
    if (this.armorPuzzle.monoliths) {
      for (const mono of Object.values(this.armorPuzzle.monoliths)) {
        const mx = Math.round(mono.col * this.tileSize - camX);
        const my = Math.round(mono.row * this.tileSize - camY);

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

        // Abrir el portal en la pared norte del templo
        const temple = this.scenes.sword_temple;
        if (temple && temple.layers) {
          temple.layers.decoration[1][11] = TILES.PORTAL_GATE_OPEN;
          temple.layers.decoration[1][12] = TILES.PORTAL_GATE_OPEN;
          temple.layers.collision[1][11] = 0;
          temple.layers.collision[1][12] = 0;
        }

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
  renderSwordPuzzle(ctx, camera) {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const t = performance.now() * 0.003;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 1. Render de los 3 Monolitos Rúnicos
    for (const [key, mono] of Object.entries(this.swordPuzzle.monoliths)) {
      const isActiveInStack = this.swordPuzzle.stack.includes(mono.id);
      const mx = Math.round(mono.col * this.tileSize - camX);
      const my = Math.round(mono.row * this.tileSize - camY);

      // Obelisco / Estela de piedra
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(mx + 2, my - 2, 12, 18);
      ctx.strokeStyle = isActiveInStack ? '#fde047' : '#64748b';
      ctx.lineWidth = 1;
      ctx.strokeRect(mx + 2.5, my - 1.5, 11, 17);

      // Símbolo rúnico grabado
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = isActiveInStack ? '#fde047' : '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(mono.symbol, mx + 8, my + 6);

      // Halo áureo flotante si la runa está activada en la pila
      if (isActiveInStack) {
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.45)';
        ctx.strokeRect(mx, my - 4, 16, 22);
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

