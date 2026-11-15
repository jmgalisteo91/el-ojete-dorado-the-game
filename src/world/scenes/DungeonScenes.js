import { TILES } from '../../graphics/SpriteSheetGenerator.js?v=8';

const CHASM_COLLISION_VALUE = 2;

function createSceneHelpers(tilemap, cols, rows, defaultGround) {
  const createGrid = tilemap?._createGrid
    ? (c, r, val) => tilemap._createGrid(c, r, val)
    : (c, r, val) => Array.from({ length: r }, () => new Array(c).fill(val));

  const ground = createGrid(cols, rows, defaultGround);
  const decoration = createGrid(cols, rows, -1);
  const collision = createGrid(cols, rows, 0);

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

  return { ground, decoration, collision, fillRect, setDeco };
}

function applyRoomBorderWalls(setDeco, cols, rows, wallTile) {
  for (let c = 0; c < cols; c++) {
    setDeco(c, 0, wallTile, true);
    setDeco(c, 1, wallTile, true);
    setDeco(c, rows - 1, wallTile, true);
  }
  for (let r = 0; r < rows; r++) {
    setDeco(0, r, wallTile, true);
    setDeco(1, r, wallTile, true);
    setDeco(cols - 2, r, wallTile, true);
    setDeco(cols - 1, r, wallTile, true);
  }
}

function applyPuzzleBarrier(scene, puzzleState, barrierRow = 3) {
  const cols = Array.from({ length: Math.max(0, scene.cols - 4) }, (_, i) => i + 2);
  for (const c of cols) {
    scene.layers.collision[barrierRow][c] = 1;
    scene.layers.decoration[barrierRow][c] = TILES.CRYSTAL_BARRIER;
  }
  if (puzzleState) {
    puzzleState.barrierRow = barrierRow;
    puzzleState.barrierCols = cols;
    puzzleState.barrierActive = true;
  }
}

function buildArmorTempleScene(tilemap) {
  const cols = 22;
  const rows = 18;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.STONE_FLOOR);
  const lightSources = [];

  applyRoomBorderWalls(setDeco, cols, rows, TILES.WALL_INTERIOR);

  // Portal místico hacia la arena del Guardián del Stack Overflow
  const portalOpen = Boolean(tilemap?.swordPuzzle?.portalOpen);
  if (portalOpen) {
    setDeco(11, 1, TILES.PORTAL_GATE_OPEN, false);
    setDeco(12, 1, TILES.PORTAL_GATE_OPEN, false);
  } else {
    setDeco(11, 1, TILES.PORTAL_GATE_CLOSED, true);
    setDeco(12, 1, TILES.PORTAL_GATE_CLOSED, true);
  }

  fillRect(ground, 9, 13, 4, 4, TILES.COBBLE);
  fillRect(ground, 3, 6, 4, 8, TILES.COBBLE);
  fillRect(ground, 15, 6, 4, 8, TILES.COBBLE);
  fillRect(ground, 3, 6, 16, 2, TILES.COBBLE);
  fillRect(ground, 8, 2, 6, 4, TILES.RUG_RED);

  fillRect(decoration, 2, 13, 7, 1, TILES.WALL_INTERIOR);
  fillRect(collision, 2, 13, 7, 1, 1);
  fillRect(decoration, 13, 13, 7, 1, TILES.WALL_INTERIOR);
  fillRect(collision, 13, 13, 7, 1, 1);

  fillRect(decoration, 8, 8, 6, 4, TILES.WALL_INTERIOR);
  fillRect(collision, 8, 8, 6, 4, 1);

  const pillars = [
    [5, 8], [5, 11], [16, 8], [16, 11],
    [7, 4], [14, 4], [8, 5], [13, 5]
  ];
  for (const [pc, pr] of pillars) {
    setDeco(pc, pr, TILES.WALL_INTERIOR, true);
  }

  setDeco(10, 4, TILES.ALTAR_PEDESTAL, false);
  setDeco(9, 3, TILES.LAMPPOST, true);
  setDeco(12, 3, TILES.LAMPPOST, true);

  const barrierActive = tilemap?.armorPuzzle ? tilemap.armorPuzzle.barrierActive : true;
  if (barrierActive) {
    setDeco(9, 5, TILES.FIREPLACE, true);
    setDeco(10, 5, TILES.FIREPLACE, true);
    setDeco(11, 5, TILES.FIREPLACE, true);
  }
  lightSources.push(
    { x: 10.5 * 16, y: 4.5 * 16, radius: 64, intensity: 1.0 },
    { x: 9.5 * 16, y: 3.5 * 16, radius: 44, intensity: 0.9 },
    { x: 12.5 * 16, y: 3.5 * 16, radius: 44, intensity: 0.9 },
    { x: 10.5 * 16, y: 5.5 * 16, radius: 52, intensity: 0.95 }
  );

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

  for (let r = 13; r <= 16; r++) {
    for (let c = 9; c <= 12; c++) {
      collision[r][c] = 0;
      decoration[r][c] = -1;
    }
  }
  fillRect(ground, 9, 13, 4, 4, TILES.COBBLE);
  fillRect(decoration, 10, 16, 2, 1, TILES.EXIT_MAT);
  collision[16][10] = 0;
  collision[16][11] = 0;

  return {
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

function buildSwordTempleScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.STONE_FLOOR);
  const lightSources = [];

  applyRoomBorderWalls(setDeco, cols, rows, TILES.WALL_INTERIOR);

  const portalOpen = Boolean(tilemap?.swordPuzzle?.portalOpen);
  if (portalOpen) {
    setDeco(11, 1, TILES.PORTAL_GATE_OPEN, false);
    setDeco(12, 1, TILES.PORTAL_GATE_OPEN, false);
  } else {
    setDeco(11, 1, TILES.PORTAL_GATE_CLOSED, true);
    setDeco(12, 1, TILES.PORTAL_GATE_CLOSED, true);
  }

  fillRect(ground, 10, 13, 4, 4, TILES.COBBLE);
  fillRect(ground, 8, 6, 8, 8, TILES.COBBLE);
  fillRect(ground, 3, 7, 5, 6, TILES.COBBLE);
  fillRect(ground, 16, 7, 5, 6, TILES.COBBLE);
  fillRect(ground, 9, 2, 6, 4, TILES.RUG_RED);

  fillRect(decoration, 2, 13, 4, 1, TILES.WALL_INTERIOR);
  fillRect(collision, 2, 13, 4, 1, 1);
  fillRect(decoration, 18, 13, 4, 1, TILES.WALL_INTERIOR);
  fillRect(collision, 18, 13, 4, 1, 1);

  const holyPillars = [
    [5, 5], [18, 5],
    [5, 12], [18, 12]
  ];
  for (const [hc, hr] of holyPillars) {
    setDeco(hc, hr, TILES.WALL_INTERIOR, true);
  }

  setDeco(6, 8, -1, true);
  setDeco(11, 10, -1, true);
  setDeco(17, 8, -1, true);

  setDeco(11, 4, TILES.ALTAR_PEDESTAL, false);
  setDeco(10, 3, TILES.LAMPPOST, true);
  setDeco(13, 3, TILES.LAMPPOST, true);
  lightSources.push(
    { x: 11.5 * 16, y: 4.5 * 16, radius: 72, intensity: 1.0 },
    { x: 10.5 * 16, y: 3.5 * 16, radius: 48, intensity: 0.9 },
    { x: 13.5 * 16, y: 3.5 * 16, radius: 48, intensity: 0.9 }
  );

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

  for (let r = 13; r <= 16; r++) {
    for (let c = 10; c <= 13; c++) {
      collision[r][c] = 0;
      decoration[r][c] = -1;
    }
  }
  fillRect(ground, 10, 13, 4, 4, TILES.COBBLE);
  fillRect(decoration, 11, 16, 2, 1, TILES.EXIT_MAT);
  collision[16][11] = 0;
  collision[16][12] = 0;

  return {
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

function buildCondemnedRealmsScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.STONE_FLOOR);
  const lightSources = [];

  applyRoomBorderWalls(setDeco, cols, rows, TILES.WALL_INTERIOR);

  fillRect(ground, 2, 2, cols - 4, rows - 3, TILES.COBBLE);
  fillRect(ground, 11, 2, 2, rows - 3, TILES.STONE_FLOOR);
  fillRect(decoration, 11, 5, 2, 11, TILES.RUG_RED);

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

  setDeco(10, 15, TILES.LAMPPOST, true);
  setDeco(13, 15, TILES.LAMPPOST, true);
  lightSources.push({
    x: 11.5 * 16,
    y: 15.5 * 16,
    radius: 58,
    intensity: 0.95
  });

  return {
    title: 'Reinos Condenados · Santuario del Dios Supremo',
    cols,
    rows,
    layers: { ground, decoration, collision },
    lightSources,
    exitDoor: null
  };
}

function buildSewersEntryScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.SEWER_SLIME_FLOOR);
  const lightSources = [];

  applyRoomBorderWalls(setDeco, cols, rows, TILES.SEWER_PIPE_WALL);

  fillRect(ground, 2, 4, 3, 10, TILES.WATER_1);
  fillRect(ground, cols - 5, 4, 3, 10, TILES.WATER_1);
  fillRect(ground, 8, 2, 8, 14, TILES.STONE_FLOOR);

  setDeco(7, 6, TILES.SEWER_PIPE_WALL, true);
  setDeco(16, 6, TILES.SEWER_PIPE_WALL, true);
  setDeco(7, 11, TILES.SEWER_PIPE_WALL, true);
  setDeco(16, 11, TILES.SEWER_PIPE_WALL, true);

  lightSources.push(
    { x: 3.5 * 16, y: 8.5 * 16, radius: 48, intensity: 0.85, color: '#10b981' },
    { x: 20.5 * 16, y: 8.5 * 16, radius: 48, intensity: 0.85, color: '#10b981' },
    { x: 11.5 * 16, y: 3.5 * 16, radius: 52, intensity: 0.9, color: '#34d399' }
  );

  setDeco(11, rows - 1, TILES.EXIT_MAT, false);
  setDeco(12, rows - 1, TILES.EXIT_MAT, false);
  collision[rows - 1][11] = 0;
  collision[rows - 1][12] = 0;

  setDeco(11, 1, -1, false);
  setDeco(12, 1, -1, false);
  collision[1][11] = 0;
  collision[1][12] = 0;

  return {
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

function buildSewersPuzzleScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.SEWER_SLIME_FLOOR);
  const lightSources = [];

  applyRoomBorderWalls(setDeco, cols, rows, TILES.SEWER_PIPE_WALL);

  fillRect(ground, 4, 4, 16, 9, TILES.WATER_1);
  fillRect(ground, 10, 5, 4, 8, TILES.STONE_FLOOR);

  setDeco(11, 8, TILES.WELL, true);
  setDeco(12, 8, TILES.WELL, true);

  for (let r = 4; r < 13; r++) {
    for (let c = 4; c < 20; c++) {
      if (ground[r][c] === TILES.WATER_1) collision[r][c] = 1;
    }
  }

  lightSources.push(
    { x: 11.5 * 16, y: 8.5 * 16, radius: 60, intensity: 0.95, color: '#34d399' },
    { x: 5.5 * 16, y: 5.5 * 16, radius: 44, intensity: 0.8, color: '#10b981' },
    { x: 18.5 * 16, y: 5.5 * 16, radius: 44, intensity: 0.8, color: '#10b981' }
  );

  setDeco(11, rows - 1, -1, false);
  setDeco(12, rows - 1, -1, false);
  collision[rows - 1][11] = 0;
  collision[rows - 1][12] = 0;

  setDeco(11, 1, -1, false);
  setDeco(12, 1, -1, false);
  collision[1][11] = 0;
  collision[1][12] = 0;

  const scene = {
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
  applyPuzzleBarrier(scene, tilemap?.sewersPuzzle, 3);
  return scene;
}

function buildSewersDungeonScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.SEWER_SLIME_FLOOR);
  const lightSources = [];

  applyRoomBorderWalls(setDeco, cols, rows, TILES.SEWER_PIPE_WALL);

  fillRect(ground, 4, 4, 16, 10, TILES.STONE_PATH);
  fillRect(ground, 2, 7, 2, 4, TILES.WATER_1);
  fillRect(ground, 20, 7, 2, 4, TILES.WATER_1);

  setDeco(5, 5, TILES.SEWER_PIPE_WALL, true);
  setDeco(18, 5, TILES.SEWER_PIPE_WALL, true);
  setDeco(5, 12, TILES.SEWER_PIPE_WALL, true);
  setDeco(18, 12, TILES.SEWER_PIPE_WALL, true);

  lightSources.push(
    { x: 5.5 * 16, y: 5.5 * 16, radius: 48, intensity: 0.85, color: '#10b981' },
    { x: 18.5 * 16, y: 5.5 * 16, radius: 48, intensity: 0.85, color: '#10b981' },
    { x: 11.5 * 16, y: 9.5 * 16, radius: 64, intensity: 0.95, color: '#34d399' }
  );

  setDeco(11, rows - 1, -1, false);
  setDeco(12, rows - 1, -1, false);
  collision[rows - 1][11] = 0;
  collision[rows - 1][12] = 0;

  return {
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

function buildMinesEntryScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.MINE_CRYSTAL_FLOOR);
  const lightSources = [];

  applyRoomBorderWalls(setDeco, cols, rows, TILES.MINE_CRYSTAL_WALL);

  fillRect(ground, 2, 8, cols - 4, 2, TILES.MINE_CHASM);
  for (let c = 2; c < cols - 2; c++) {
    collision[8][c] = CHASM_COLLISION_VALUE;
    collision[9][c] = CHASM_COLLISION_VALUE;
  }

  setDeco(19, 4, TILES.CRYSTAL_BARRIER, true);
  setDeco(20, 4, TILES.CRYSTAL_BARRIER, true);

  lightSources.push(
    { x: 11.5 * 16, y: 8.5 * 16, radius: 56, intensity: 0.9, color: '#818cf8' },
    { x: 5.5 * 16, y: 4.5 * 16, radius: 48, intensity: 0.85, color: '#38bdf8' },
    { x: 19.5 * 16, y: 4.5 * 16, radius: 52, intensity: 0.95, color: '#a855f7' }
  );

  setDeco(11, rows - 1, TILES.EXIT_MAT, false);
  setDeco(12, rows - 1, TILES.EXIT_MAT, false);
  collision[rows - 1][11] = 0;
  collision[rows - 1][12] = 0;

  setDeco(11, 1, -1, false);
  setDeco(12, 1, -1, false);
  collision[1][11] = 0;
  collision[1][12] = 0;

  return {
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

function buildMinesPuzzleScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const { ground, decoration, collision, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.MINE_CRYSTAL_FLOOR);
  const lightSources = [];

  applyRoomBorderWalls(setDeco, cols, rows, TILES.MINE_CRYSTAL_WALL);

  setDeco(6, 8, TILES.ALTAR_PEDESTAL, true);
  setDeco(11, 10, TILES.ALTAR_PEDESTAL, true);
  setDeco(17, 8, TILES.ALTAR_PEDESTAL, true);

  lightSources.push(
    { x: 6.5 * 16, y: 8.5 * 16, radius: 48, intensity: 0.9, color: '#38bdf8' },
    { x: 11.5 * 16, y: 10.5 * 16, radius: 48, intensity: 0.9, color: '#818cf8' },
    { x: 17.5 * 16, y: 8.5 * 16, radius: 48, intensity: 0.9, color: '#a855f7' }
  );

  setDeco(11, rows - 1, -1, false);
  setDeco(12, rows - 1, -1, false);
  collision[rows - 1][11] = 0;
  collision[rows - 1][12] = 0;

  setDeco(11, 1, TILES.PORTAL_GATE_OPEN, false);
  setDeco(12, 1, TILES.PORTAL_GATE_OPEN, false);
  collision[1][11] = 0;
  collision[1][12] = 0;

  const scene = {
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
  applyPuzzleBarrier(scene, tilemap?.minesPuzzle, 3);
  return scene;
}

function buildMinesBossArenaScene(tilemap) {
  const cols = 12;
  const rows = 8;
  const { ground, decoration, collision, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.MINE_CRYSTAL_FLOOR);
  const lightSources = [];

  for (let c = 0; c < cols; c++) {
    setDeco(c, 0, TILES.MINE_CRYSTAL_WALL, true);
    setDeco(c, rows - 1, TILES.MINE_CRYSTAL_WALL, true);
  }
  for (let r = 0; r < rows; r++) {
    setDeco(0, r, TILES.MINE_CRYSTAL_WALL, true);
    setDeco(cols - 1, r, TILES.MINE_CRYSTAL_WALL, true);
  }

  setDeco(2, 0, TILES.LAMPPOST, true);
  setDeco(9, 0, TILES.LAMPPOST, true);
  lightSources.push(
    { x: 2.5 * 16, y: 1.5 * 16, radius: 56, intensity: 0.95, color: '#f59e0b' },
    { x: 9.5 * 16, y: 1.5 * 16, radius: 56, intensity: 0.95, color: '#f59e0b' }
  );

  setDeco(5, rows - 1, TILES.PORTAL_GATE_OPEN, false);
  setDeco(6, rows - 1, TILES.PORTAL_GATE_OPEN, false);
  collision[rows - 1][5] = 0;
  collision[rows - 1][6] = 0;

  setDeco(5, 0, TILES.PORTAL_GATE_CLOSED, true);
  setDeco(6, 0, TILES.PORTAL_GATE_CLOSED, true);

  return {
    title: 'Minas de la Recursión · Cámara del Stack Overflow',
    cols,
    rows,
    layers: { ground, decoration, collision },
    lightSources,
    exitDoor: {
      worldX: 5.5 * 16,
      worldY: 7 * 16,
      returnX: 11.5 * 16,
      returnY: 2.5 * 16,
      returnScene: 'mines_puzzle'
    }
  };
}

function buildForgeEntryScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.FORGE_LAVA_FLOOR);
  const lightSources = [];

  applyRoomBorderWalls(setDeco, cols, rows, TILES.FORGE_BOILER_WALL);

  fillRect(ground, 8, 2, 8, 14, TILES.STONE_FLOOR);

  setDeco(4, 5, TILES.FIREPLACE, true);
  setDeco(19, 5, TILES.FIREPLACE, true);
  setDeco(4, 11, TILES.FIREPLACE, true);
  setDeco(19, 11, TILES.FIREPLACE, true);

  lightSources.push(
    { x: 4.5 * 16, y: 5.5 * 16, radius: 64, intensity: 1.0, color: '#f97316' },
    { x: 19.5 * 16, y: 5.5 * 16, radius: 64, intensity: 1.0, color: '#f97316' },
    { x: 11.5 * 16, y: 8.5 * 16, radius: 72, intensity: 0.95, color: '#ef4444' }
  );

  setDeco(11, rows - 1, TILES.EXIT_MAT, false);
  setDeco(12, rows - 1, TILES.EXIT_MAT, false);
  collision[rows - 1][11] = 0;
  collision[rows - 1][12] = 0;

  setDeco(11, 1, -1, false);
  setDeco(12, 1, -1, false);
  collision[1][11] = 0;
  collision[1][12] = 0;

  return {
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

function buildForgePuzzleScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.FORGE_LAVA_FLOOR);
  const lightSources = [];

  applyRoomBorderWalls(setDeco, cols, rows, TILES.FORGE_BOILER_WALL);

  fillRect(ground, 5, 5, 14, 8, TILES.STONE_FLOOR);

  setDeco(6, 8, TILES.WELL, true);
  setDeco(17, 8, TILES.WELL, true);

  lightSources.push(
    { x: 6.5 * 16, y: 8.5 * 16, radius: 56, intensity: 0.95, color: '#f97316' },
    { x: 17.5 * 16, y: 8.5 * 16, radius: 56, intensity: 0.95, color: '#f97316' },
    { x: 11.5 * 16, y: 4.5 * 16, radius: 64, intensity: 1.0, color: '#ef4444' }
  );

  setDeco(11, rows - 1, -1, false);
  setDeco(12, rows - 1, -1, false);
  collision[rows - 1][11] = 0;
  collision[rows - 1][12] = 0;

  setDeco(11, 1, -1, false);
  setDeco(12, 1, -1, false);
  collision[1][11] = 0;
  collision[1][12] = 0;

  const scene = {
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
  applyPuzzleBarrier(scene, tilemap?.forgePuzzle, 3);
  return scene;
}

function buildFortressGateScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.FORGE_LAVA_FLOOR);
  const lightSources = [];

  applyRoomBorderWalls(setDeco, cols, rows, TILES.FORGE_BOILER_WALL);

  fillRect(ground, 3, 3, 18, 12, TILES.STONE_PATH);

  setDeco(5, 5, TILES.FORGE_BOILER_WALL, true);
  setDeco(18, 5, TILES.FORGE_BOILER_WALL, true);
  setDeco(5, 11, TILES.FORGE_BOILER_WALL, true);
  setDeco(18, 11, TILES.FORGE_BOILER_WALL, true);

  lightSources.push(
    { x: 5.5 * 16, y: 5.5 * 16, radius: 52, intensity: 0.9, color: '#f97316' },
    { x: 18.5 * 16, y: 5.5 * 16, radius: 52, intensity: 0.9, color: '#f97316' },
    { x: 11.5 * 16, y: 8.5 * 16, radius: 64, intensity: 1.0, color: '#ef4444' }
  );

  setDeco(11, rows - 1, -1, false);
  setDeco(12, rows - 1, -1, false);
  collision[rows - 1][11] = 0;
  collision[rows - 1][12] = 0;

  return {
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

function buildQuantumGateScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.STONE_FLOOR);
  const lightSources = [];

  applyRoomBorderWalls(setDeco, cols, rows, TILES.TEMPLE_WALL);

  fillRect(ground, 4, 3, 16, 12, TILES.COBBLE);

  setDeco(8, 7, TILES.CORE_PEDESTAL, true);
  setDeco(11, 6, TILES.CORE_PEDESTAL, true);
  setDeco(14, 7, TILES.CORE_PEDESTAL, true);

  lightSources.push(
    { x: 8.5 * 16, y: 7.5 * 16, radius: 46, intensity: 0.9, color: '#10b981' },
    { x: 11.5 * 16, y: 6.5 * 16, radius: 52, intensity: 0.95, color: '#38bdf8' },
    { x: 14.5 * 16, y: 7.5 * 16, radius: 46, intensity: 0.9, color: '#ef4444' },
    { x: 11.5 * 16, y: 2.5 * 16, radius: 72, intensity: 1.0, color: '#ec4899' }
  );

  setDeco(11, rows - 1, TILES.EXIT_MAT, false);
  setDeco(12, rows - 1, TILES.EXIT_MAT, false);
  collision[rows - 1][11] = 0;
  collision[rows - 1][12] = 0;

  setDeco(11, 1, TILES.PORTAL_GATE_OPEN, false);
  setDeco(12, 1, TILES.PORTAL_GATE_OPEN, false);
  collision[1][11] = 0;
  collision[1][12] = 0;

  return {
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

function buildCitadelScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const { ground, decoration, collision, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.MAINFRAME_FLOOR);
  const lightSources = [];

  applyRoomBorderWalls(setDeco, cols, rows, TILES.MAINFRAME_WALL);

  setDeco(5, 5, TILES.MAINFRAME_WALL, true);
  setDeco(18, 5, TILES.MAINFRAME_WALL, true);
  setDeco(5, 12, TILES.MAINFRAME_WALL, true);
  setDeco(18, 12, TILES.MAINFRAME_WALL, true);

  setDeco(11, 3, TILES.CORE_PEDESTAL, false);
  setDeco(12, 3, TILES.CORE_PEDESTAL, false);

  lightSources.push(
    { x: 11.5 * 16, y: 3.5 * 16, radius: 88, intensity: 1.0, color: '#ec4899' },
    { x: 5.5 * 16, y: 5.5 * 16, radius: 52, intensity: 0.9, color: '#06b6d4' },
    { x: 18.5 * 16, y: 5.5 * 16, radius: 52, intensity: 0.9, color: '#06b6d4' },
    { x: 11.5 * 16, y: 14.5 * 16, radius: 56, intensity: 0.85, color: '#3b82f6' }
  );

  setDeco(11, rows - 1, -1, false);
  setDeco(12, rows - 1, -1, false);
  collision[rows - 1][11] = 0;
  collision[rows - 1][12] = 0;

  return {
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

/** Construye todas las escenas de templos, mazmorras y la Ciudadela Cuántica. */
export function buildDungeonScenes(tilemap = null) {
  return {
    armor_temple: buildArmorTempleScene(tilemap),
    sword_temple: buildSwordTempleScene(tilemap),
    condemned_realms: buildCondemnedRealmsScene(tilemap),
    sewers_entry: buildSewersEntryScene(tilemap),
    sewers_puzzle: buildSewersPuzzleScene(tilemap),
    sewers_dungeon: buildSewersDungeonScene(tilemap),
    mines_entry: buildMinesEntryScene(tilemap),
    mines_puzzle: buildMinesPuzzleScene(tilemap),
    mines_boss_arena: buildMinesBossArenaScene(tilemap),
    forge_entry: buildForgeEntryScene(tilemap),
    forge_puzzle: buildForgePuzzleScene(tilemap),
    ai_fortress_gate: buildFortressGateScene(tilemap),
    quantum_gate: buildQuantumGateScene(tilemap),
    ai_citadel: buildCitadelScene(tilemap)
  };
}

export const DUNGEON_SCENES = buildDungeonScenes();
