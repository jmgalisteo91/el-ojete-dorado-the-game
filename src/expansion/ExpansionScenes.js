import { TILES } from '../graphics/SpriteSheetGenerator.js?v=8';

const CHASM_COLLISION_VALUE = 2;

export const EXPANSION_SCENE_IDS = [
  'valleverde_corp',
  'inakito_office',
  'vertedero_digital',
  'kernel_arena',
  'rosa_bar',
  'ai_nucleus_core'
];

function createSceneHelpers(tilemap, cols, rows) {
  const ground = tilemap._createGrid(cols, rows, TILES.STONE_FLOOR);
  const decoration = tilemap._createGrid(cols, rows, -1);
  const collision = tilemap._createGrid(cols, rows, 0);
  const setDeco = (c, r, tileId, blocks = true) => {
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      decoration[r][c] = tileId;
      collision[r][c] = blocks ? 1 : 0;
    }
  };
  return { ground, decoration, collision, setDeco };
}

function buildValleverdeCorpScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const ground = tilemap._createGrid(cols, rows, TILES.CORP_FLOOR);
  const decoration = tilemap._createGrid(cols, rows, -1);
  const collision = tilemap._createGrid(cols, rows, 0);
  const lightSources = [];

  const setDeco = (c, r, tileId, blocks = true) => {
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      decoration[r][c] = tileId;
      collision[r][c] = blocks ? 1 : 0;
    }
  };

  for (let c = 0; c < cols; c++) {
    setDeco(c, 0, TILES.CORP_GLASS_WALL, true);
    setDeco(c, 1, TILES.CORP_GLASS_WALL, true);
    setDeco(c, rows - 1, TILES.CORP_GLASS_WALL, true);
  }
  for (let r = 0; r < rows; r++) {
    setDeco(0, r, TILES.CORP_GLASS_WALL, true);
    setDeco(cols - 1, r, TILES.CORP_GLASS_WALL, true);
  }

  for (let c = 6; c <= 8; c++) setDeco(c, 1, TILES.CORP_CRT_WALL, true);
  for (let c = 15; c <= 17; c++) setDeco(c, 1, TILES.CORP_CRT_WALL, true);

  setDeco(11, 1, TILES.PORTAL_GATE_CLOSED, true);
  setDeco(12, 1, TILES.PORTAL_GATE_CLOSED, true);
  setDeco(9, 1, TILES.WALL_DOOR, true);
  setDeco(19, 1, TILES.WALL_DOOR, true);

  setDeco(11, rows - 1, -1, false);
  setDeco(12, rows - 1, -1, false);

  for (let c = 1; c <= 6; c++) setDeco(c, 4, TILES.CORP_GLASS_WALL, true);
  setDeco(6, 2, TILES.CORP_GLASS_WALL, true);
  setDeco(6, 3, TILES.CORP_GLASS_WALL, true);
  setDeco(4, 4, TILES.WALL_DOOR, true);

  setDeco(16, 4, TILES.CORP_GLASS_WALL, true);
  setDeco(17, 4, TILES.CORP_GLASS_WALL, true);
  setDeco(18, 4, TILES.CORP_CUBICLE, true);
  setDeco(19, 4, TILES.CORP_GLASS_WALL, true);
  setDeco(20, 4, TILES.CORP_GLASS_WALL, true);
  setDeco(18, 5, TILES.TABLE, false);

  setDeco(7, 8, TILES.CORP_CUBICLE, true);
  setDeco(8, 8, TILES.CORP_CUBICLE, true);
  setDeco(14, 8, TILES.CORP_CUBICLE, true);
  setDeco(15, 8, TILES.CORP_CUBICLE, true);
  setDeco(7, 12, TILES.CORP_CUBICLE, true);
  setDeco(8, 12, TILES.CORP_CUBICLE, true);

  setDeco(2, 14, TILES.TABLE, false);
  setDeco(2, 13, TILES.CORP_PLANT, false);

  setDeco(20, 10, TILES.ANVIL, false);
  setDeco(21, 10, TILES.CRATE, false);
  setDeco(20, 15, TILES.CORP_ELEVATOR, false);

  setDeco(2, 5, TILES.CORP_PLANT, false);
  setDeco(10, 2, TILES.CORP_PLANT, false);
  setDeco(13, 2, TILES.CORP_PLANT, false);
  setDeco(22, 5, TILES.CORP_PLANT, false);
  setDeco(10, 15, TILES.CORP_PLANT, false);
  setDeco(13, 15, TILES.CORP_PLANT, false);

  setDeco(1, 7, TILES.CORP_EXTINGUISHER, false);
  setDeco(22, 7, TILES.CORP_EXTINGUISHER, false);
  setDeco(19, 15, TILES.CORP_EXTINGUISHER, false);

  setDeco(3, 1, TILES.CORP_ALEX_POSTER, false);
  setDeco(21, 1, TILES.CORP_ALEX_POSTER, false);
  setDeco(1, 11, TILES.CORP_ALEX_POSTER, false);
  setDeco(22, 12, TILES.CORP_ALEX_POSTER, false);

  lightSources.push(
    { x: 7.5 * 16, y: 2.0 * 16, radius: 64, intensity: 0.9, color: '#22d3ee' },
    { x: 16.5 * 16, y: 2.0 * 16, radius: 64, intensity: 0.9, color: '#22d3ee' },
    { x: 11.5 * 16, y: 2.0 * 16, radius: 56, intensity: 0.85, color: '#ec4899' },
    { x: 11.5 * 16, y: 10.0 * 16, radius: 96, intensity: 0.75, color: '#bae6fd' },
    { x: 20.5 * 16, y: 15.5 * 16, radius: 48, intensity: 0.85, color: '#38bdf8' }
  );

  tilemap.scenes.valleverde_corp = {
    title: 'Valleverde 2.0 · Distrito Corporativo',
    cols,
    rows,
    layers: { ground, decoration, collision },
    lightSources,
    exitDoor: {
      worldX: 11.5 * 16,
      worldY: 16.5 * 16,
      returnX: 17.5 * 16,
      returnY: 12.5 * 16,
      returnScene: 'overworld'
    }
  };
}

function buildInakitoOfficeScene(tilemap) {
  const cols = 12;
  const rows = 10;
  const ground = tilemap._createGrid(cols, rows, TILES.INAKITO_CARPET);
  const decoration = tilemap._createGrid(cols, rows, -1);
  const collision = tilemap._createGrid(cols, rows, 0);
  const lightSources = [];

  const setDeco = (c, r, tileId, blocks = true) => {
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      decoration[r][c] = tileId;
      collision[r][c] = blocks ? 1 : 0;
    }
  };

  for (let c = 0; c < cols; c++) {
    setDeco(c, 0, TILES.INAKITO_CUBICLE_WALL, true);
    setDeco(c, rows - 1, TILES.INAKITO_CUBICLE_WALL, true);
  }
  for (let r = 0; r < rows; r++) {
    setDeco(0, r, TILES.INAKITO_CUBICLE_WALL, true);
    setDeco(cols - 1, r, TILES.INAKITO_CUBICLE_WALL, true);
  }

  setDeco(5, rows - 1, -1, false);
  setDeco(6, rows - 1, -1, false);
  setDeco(5, 0, TILES.CRYSTAL_BARRIER, true);
  setDeco(6, 0, TILES.CRYSTAL_BARRIER, true);

  setDeco(2, 2, TILES.INAKITO_OVERTURNED_DESK, true);
  setDeco(2, 6, TILES.INAKITO_OVERTURNED_DESK, true);
  setDeco(9, 6, TILES.INAKITO_OVERTURNED_DESK, true);
  setDeco(9, 2, TILES.INAKITO_COPIER, true);
  setDeco(1, 3, TILES.INAKITO_COFFEE_MOUND, true);
  setDeco(10, 4, TILES.INAKITO_COFFEE_MOUND, true);
  setDeco(3, 7, TILES.INAKITO_COFFEE_MOUND, false);

  setDeco(4, 3, TILES.INAKITO_PAPERS, false);
  setDeco(7, 4, TILES.INAKITO_PAPERS, false);
  setDeco(5, 6, TILES.INAKITO_PAPERS, false);
  setDeco(8, 7, TILES.INAKITO_PAPERS, false);

  lightSources.push(
    { x: 6 * 16, y: 4.5 * 16, radius: 96, intensity: 0.9, color: '#93c5fd' },
    { x: 5.5 * 16, y: 0.8 * 16, radius: 42, intensity: 0.8, color: '#f59e0b' }
  );

  tilemap.scenes.inakito_office = {
    title: 'Cubículo de Iñakito 2.0 · El Becario Eterno',
    cols,
    rows,
    layers: { ground, decoration, collision },
    lightSources,
    exitDoor: {
      worldX: 5.5 * 16,
      worldY: 9.0 * 16,
      returnX: 9.5 * 16,
      returnY: 2.5 * 16,
      returnScene: 'valleverde_corp'
    }
  };
}

function buildVertederoDigitalScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const { ground, decoration, collision, setDeco } = createSceneHelpers(tilemap, cols, rows);
  const lightSources = [];

  for (let c = 0; c < cols; c++) {
    setDeco(c, 0, TILES.INAKITO_CUBICLE_WALL, true);
    setDeco(c, 1, TILES.MAINFRAME_WALL, true);
    setDeco(c, rows - 1, TILES.INAKITO_CUBICLE_WALL, true);
  }
  for (let r = 0; r < rows; r++) {
    setDeco(0, r, TILES.INAKITO_CUBICLE_WALL, true);
    setDeco(cols - 1, r, TILES.INAKITO_CUBICLE_WALL, true);
  }

  for (let r = 2; r < rows - 1; r++) {
    ground[r][11] = TILES.RUG_RED;
    ground[r][12] = TILES.RUG_RED;
  }
  for (let r = 7; r <= 10; r++) {
    for (let c = 9; c <= 14; c++) ground[r][c] = TILES.RUG_RED;
  }

  for (let c = 5; c <= 7; c++) setDeco(c, 1, TILES.CORP_CRT_WALL, true);
  for (let c = 16; c <= 18; c++) setDeco(c, 1, TILES.CORP_CRT_WALL, true);

  for (const [c, r] of [
    [5, 5], [6, 5], [17, 5], [18, 5],
    [6, 12], [7, 12], [16, 12], [17, 12]
  ]) {
    setDeco(c, r, TILES.CORP_CUBICLE, true);
  }
  for (const [c, r] of [[4, 9], [19, 9], [9, 6], [14, 13]]) {
    setDeco(c, r, TILES.INAKITO_OVERTURNED_DESK, true);
  }
  for (const [c, r] of [[4, 4], [10, 8], [13, 9], [8, 14], [15, 14], [18, 7]]) {
    setDeco(c, r, TILES.INAKITO_PAPERS, false);
  }

  setDeco(11, rows - 1, TILES.EXIT_MAT, false);
  setDeco(12, rows - 1, TILES.EXIT_MAT, false);
  setDeco(11, 0, -1, false);
  setDeco(12, 0, -1, false);
  setDeco(11, 1, -1, false);
  setDeco(12, 1, -1, false);
  setDeco(10, 1, TILES.PORTAL_GATE_OPEN, true);
  setDeco(13, 1, TILES.PORTAL_GATE_OPEN, true);

  lightSources.push(
    { x: 6.5 * 16, y: 2.2 * 16, radius: 68, intensity: 0.95, color: '#ef4444' },
    { x: 17.5 * 16, y: 2.2 * 16, radius: 68, intensity: 0.95, color: '#ef4444' },
    { x: 11.5 * 16, y: 9.0 * 16, radius: 74, intensity: 0.85, color: '#f97316' },
    { x: 11.5 * 16, y: 16.0 * 16, radius: 52, intensity: 0.8, color: '#dc2626' }
  );

  tilemap.scenes.vertedero_digital = {
    title: 'Vertedero Digital 2.0 · Oficina Siniestra',
    cols,
    rows,
    floorNumber: 1,
    layers: { ground, decoration, collision },
    lightSources,
    exitDoor: {
      worldX: 11.5 * 16,
      worldY: 17.0 * 16,
      returnX: 20.5 * 16,
      returnY: 14.2 * 16,
      returnScene: 'valleverde_corp'
    }
  };
}

function buildKernelArenaScene(tilemap) {
  const cols = 12;
  const rows = 10;
  const ground = tilemap._createGrid(cols, rows, TILES.MAINFRAME_FLOOR);
  const decoration = tilemap._createGrid(cols, rows, -1);
  const collision = tilemap._createGrid(cols, rows, 0);

  const setDeco = (c, r, tileId, blocks = true) => {
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      decoration[r][c] = tileId;
      collision[r][c] = blocks ? 1 : 0;
    }
  };

  for (let c = 0; c < cols; c++) {
    setDeco(c, 0, TILES.MAINFRAME_WALL, true);
    setDeco(c, 1, TILES.MAINFRAME_WALL, true);
    setDeco(c, rows - 1, TILES.MAINFRAME_WALL, true);
  }
  for (let r = 0; r < rows; r++) {
    setDeco(0, r, TILES.MAINFRAME_WALL, true);
    setDeco(cols - 1, r, TILES.MAINFRAME_WALL, true);
  }

  setDeco(2, 1, TILES.CORP_CRT_WALL, true);
  setDeco(3, 1, TILES.CORP_CRT_WALL, true);
  setDeco(8, 1, TILES.CORP_CRT_WALL, true);
  setDeco(9, 1, TILES.CORP_CRT_WALL, true);
  setDeco(5, 1, TILES.PORTAL_GATE_CLOSED, true);
  setDeco(6, 1, TILES.PORTAL_GATE_CLOSED, true);

  setDeco(5, rows - 1, TILES.EXIT_MAT, false);
  setDeco(6, rows - 1, TILES.EXIT_MAT, false);

  tilemap.scenes.kernel_arena = {
    title: 'Arena del Kernel · Servidor Central (12x10)',
    cols,
    rows,
    layers: { ground, decoration, collision },
    lightSources: [
      { x: 6.0 * 16, y: 4.5 * 16, radius: 92, intensity: 1.0, color: '#22c55e' },
      { x: 5.5 * 16, y: 8.5 * 16, radius: 44, intensity: 0.75, color: '#0ea5e9' }
    ],
    exitDoor: {
      worldX: 5.5 * 16,
      worldY: 9.0 * 16,
      returnX: 20.5 * 16,
      returnY: 14.2 * 16,
      returnScene: 'valleverde_corp'
    }
  };
}

function buildRosaBarScene(tilemap) {
  const cols = 10;
  const rows = 8;
  const ground = tilemap._createGrid(cols, rows, TILES.FLOOR_WOOD);
  const decoration = tilemap._createGrid(cols, rows, -1);
  const collision = tilemap._createGrid(cols, rows, 0);

  const setDeco = (c, r, tileId, blocks = true) => {
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      decoration[r][c] = tileId;
      collision[r][c] = blocks ? 1 : 0;
    }
  };

  for (let c = 0; c < cols; c++) {
    setDeco(c, 0, TILES.WALL_WOOD, true);
    setDeco(c, 1, TILES.WALL_WOOD, true);
    setDeco(c, rows - 1, TILES.WALL_WOOD, true);
  }
  for (let r = 0; r < rows; r++) {
    setDeco(0, r, TILES.WALL_WOOD, true);
    setDeco(cols - 1, r, TILES.WALL_WOOD, true);
  }

  for (let c = 2; c <= 6; c++) setDeco(c, 3, TILES.TABLE, false);
  setDeco(1, 5, TILES.TABLE, false);
  setDeco(8, 5, TILES.TABLE, false);
  setDeco(1, 2, TILES.CORP_PLANT, false);
  setDeco(8, 2, TILES.CORP_PLANT, false);

  setDeco(4, rows - 1, TILES.EXIT_MAT, false);
  setDeco(5, rows - 1, TILES.EXIT_MAT, false);

  tilemap.scenes.rosa_bar = {
    title: 'Bar Corporativo de Rosa',
    cols,
    rows,
    layers: { ground, decoration, collision },
    lightSources: [
      { x: 4.5 * 16, y: 2.5 * 16, radius: 88, intensity: 1.0, color: '#f59e0b' },
      { x: 4.5 * 16, y: 5.2 * 16, radius: 64, intensity: 0.85, color: '#fb923c' }
    ],
    exitDoor: {
      worldX: 4.5 * 16,
      worldY: (rows - 1) * 16,
      returnX: 19.5 * 16,
      returnY: 2.6 * 16,
      returnScene: 'valleverde_corp'
    }
  };
}

function buildAiNucleusCoreScene(tilemap) {
  const cols = 14;
  const rows = 12;
  const { ground, decoration, collision } = createSceneHelpers(tilemap, cols, rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        collision[r][c] = 1;
      }
    }
  }

  collision[rows - 1][6] = 0;
  collision[rows - 1][7] = 0;
  decoration[rows - 1][6] = TILES.DOOR;
  decoration[rows - 1][7] = TILES.DOOR;

  tilemap._coreDataPlatforms = [
    { col: 2, row: 2, w: 10, h: 6 },
    { col: 5, row: 8, w: 4, h: 3 },
    { col: 1, row: 4, w: 1, h: 3 },
    { col: 12, row: 4, w: 1, h: 3 }
  ];

  tilemap.scenes.ai_nucleus_core = {
    id: 'ai_nucleus_core',
    name: 'Núcleo de Mister Alex IA',
    cols,
    rows,
    tileSize: tilemap.tileSize,
    spawnX: 6.5 * tilemap.tileSize,
    spawnY: 9.8 * tilemap.tileSize,
    layers: { ground, decoration, collision }
  };
}

export function setAlexCoreUnlocked(tilemap, unlocked) {
  tilemap.alexCoreUnlocked = Boolean(unlocked);
  const gateTile = tilemap.alexCoreUnlocked ? TILES.PORTAL_GATE_OPEN : TILES.PORTAL_GATE_CLOSED;
  const blocked = tilemap.alexCoreUnlocked ? 0 : 1;

  const corp = tilemap.scenes.valleverde_corp;
  if (corp && corp.layers) {
    for (const c of [11, 12]) {
      corp.layers.decoration[1][c] = gateTile;
      corp.layers.collision[1][c] = blocked;
    }
  }
  const arena = tilemap.scenes.kernel_arena;
  if (arena && arena.layers) {
    for (const c of [5, 6]) {
      arena.layers.decoration[1][c] = gateTile;
      arena.layers.collision[1][c] = blocked;
    }
  }
}

export function configureVertederoFloors(tilemap, order = null) {
  const fallbackOrder = ['vertedero_digital', 'sewers_dungeon', 'mines_entry', 'forge_entry', 'forge_puzzle'];
  const ids = Array.isArray(order) && order.length >= 5 ? order.slice(0, 5) : fallbackOrder;
  tilemap.vertederoFloorOrder = [...ids];

  for (let idx = 0; idx < 5; idx++) {
    const floorNum = idx + 1;
    const templateId = ids[idx];
    const tmpl = tilemap.scenes[templateId] || tilemap.scenes.vertedero_digital;
    if (!tmpl) continue;

    const cols = tmpl.cols || 24;
    const rows = tmpl.rows || 18;
    const ground = tmpl.layers.ground.map((r) => [...r]);
    const decoration = tmpl.layers.decoration.map((r) => [...r]);
    const collision = tmpl.layers.collision.map((r) => [...r]);

    for (let r = 1; r < rows - 1; r++) {
      for (let c = 11; c <= 12; c++) {
        if (collision[r][c] === CHASM_COLLISION_VALUE || ground[r][c] === TILES.MINE_CHASM) {
          ground[r][c] = TILES.BRIDGE;
          collision[r][c] = 0;
        }
        if (decoration[r][c] === TILES.CRYSTAL_BARRIER || decoration[r][c] === TILES.PORTAL_GATE_CLOSED) {
          decoration[r][c] = -1;
          collision[r][c] = 0;
        }
        if (ground[r][c] !== TILES.BRIDGE && r >= 2 && r <= rows - 2 && collision[r][c] === 0) {
          ground[r][c] = TILES.RUG_RED;
        }
      }
    }

    for (const c of [11, 12]) {
      decoration[rows - 1][c] = TILES.EXIT_MAT;
      collision[rows - 1][c] = 0;
      decoration[0][c] = -1;
      collision[0][c] = 0;
      decoration[1][c] = -1;
      collision[1][c] = 0;
    }
    decoration[1][10] = TILES.PORTAL_GATE_OPEN;
    collision[1][10] = 1;
    decoration[1][13] = TILES.PORTAL_GATE_OPEN;
    collision[1][13] = 1;

    const floorSceneId = `vertedero_piso_${floorNum}`;
    tilemap.scenes[floorSceneId] = {
      title: `Vertedero Digital · Piso ${floorNum}/5`,
      cols,
      rows,
      floorNumber: floorNum,
      templateSceneId: templateId,
      layers: { ground, decoration, collision },
      lightSources: [
        ...(tmpl.lightSources ? tmpl.lightSources.map((l) => ({ ...l })) : []),
        { x: 11.5 * 16, y: 1.5 * 16, radius: 56, intensity: 0.9, color: floorNum === 5 ? '#a855f7' : '#ef4444' },
        { x: 11.5 * 16, y: (rows - 1.5) * 16, radius: 48, intensity: 0.8, color: '#f97316' }
      ],
      exitDoor: {
        worldX: 11.5 * 16,
        worldY: (rows - 1) * 16,
        returnX: 20.5 * 16,
        returnY: 14.2 * 16,
        returnScene: 'valleverde_corp'
      }
    };
    if (typeof tilemap.decorateScene === 'function') {
      tilemap.decorateScene(floorSceneId);
    }
  }
}

function drawCorpOverlay(tilemap, ctx, camera) {
  const camX = camera.renderX;
  const camY = camera.renderY;
  ctx.save();
  const screens = [
    { col: 6, row: 1, wCols: 3 },
    { col: 15, row: 1, wCols: 3 }
  ];
  for (const scr of screens) {
    const x = Math.round(scr.col * tilemap.tileSize - camX);
    const y = Math.round(scr.row * tilemap.tileSize - camY);
    const w = scr.wCols * tilemap.tileSize;
    const h = tilemap.tileSize;

    ctx.fillStyle = '#022c22';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);

    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#34d399';
    ctx.fillText('TODO ESTÁ BIEN', x + w / 2, y + h / 2 + 0.5);
  }

  const elevX = Math.round(20.5 * tilemap.tileSize - camX);
  const elevY = Math.round(14.8 * tilemap.tileSize - camY);
  ctx.font = 'bold 4px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#22d3ee';
  ctx.fillText('VERTEDERO', elevX, elevY);
  ctx.restore();
}

function drawVertederoOverlay(tilemap, ctx, camera) {
  const camX = camera.renderX;
  const camY = camera.renderY;
  const pulse = 0.45 + 0.55 * Math.abs(Math.sin((tilemap.animationClock || 0) * 3.5));

  ctx.save();
  const { decoration } = tilemap.layers;
  for (let r = 0; r < tilemap.rows; r++) {
    for (let c = 0; c < tilemap.cols; c++) {
      if (decoration[r][c] === TILES.CORP_CRT_WALL) {
        const sx = Math.round(c * tilemap.tileSize - camX);
        const sy = Math.round(r * tilemap.tileSize - camY);
        ctx.fillStyle = '#3b0712';
        ctx.fillRect(sx + 1, sy + 2, tilemap.tileSize - 2, tilemap.tileSize - 4);
        ctx.strokeStyle = `rgba(248, 113, 113, ${pulse.toFixed(2)})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 1.5, sy + 2.5, tilemap.tileSize - 3, tilemap.tileSize - 5);
        ctx.font = 'bold 4px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fca5a5';
        ctx.fillText('ERR', sx + 8, sy + 8);
      }
    }
  }

  const nx = Math.round(11.5 * tilemap.tileSize - camX);
  const ny = Math.round(1.0 * tilemap.tileSize - camY);
  ctx.fillStyle = `rgba(239, 68, 68, ${(0.18 + pulse * 0.25).toFixed(2)})`;
  ctx.fillRect(nx - 16, ny - 6, 32, 16);
  ctx.restore();
}

function drawKernelArenaOverlay(tilemap, ctx, camera) {
  const camX = camera.renderX;
  const camY = camera.renderY;
  const ts = tilemap.tileSize;
  ctx.save();

  ctx.strokeStyle = 'rgba(34, 197, 94, 0.16)';
  ctx.lineWidth = 1;
  for (let r = 2; r < 9; r++) {
    for (let c = 1; c < 11; c++) {
      const sx = Math.round(c * ts - camX);
      const sy = Math.round(r * ts - camY);
      ctx.strokeRect(sx + 2.5, sy + 2.5, 5, 5);
      ctx.strokeRect(sx + 8.5, sy + 8.5, 5, 5);
    }
  }

  for (const col of [2, 8]) {
    const rx = Math.round(col * ts - camX) + 2;
    const ry = Math.round(1 * ts - camY) + 2;
    ctx.fillStyle = '#052e16';
    ctx.fillRect(rx, ry, 28, 12);
    ctx.strokeStyle = '#22c55e';
    ctx.strokeRect(rx + 0.5, ry + 0.5, 27, 11);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 4px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KERNEL> _', rx + 14, ry + 6);
  }
  ctx.restore();
}

function drawRosaBarOverlay(tilemap, ctx, camera) {
  const camX = camera.renderX;
  const camY = camera.renderY;
  ctx.save();

  const signX = Math.round(3 * 16 - camX);
  const signY = Math.round(0.3 * 16 - camY);
  ctx.fillStyle = 'rgba(120, 53, 15, 0.9)';
  ctx.fillRect(signX, signY, 64, 11);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.strokeRect(signX + 0.5, signY + 0.5, 63, 10);
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 4.5px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BAR ROSA · MOTOR', signX + 32, signY + 5.5);

  const bottleColors = ['#d97706', '#22c55e', '#38bdf8', '#f59e0b', '#a855f7'];
  for (let i = 0; i < 5; i++) {
    const bx = Math.round((2.6 + i * 1.1) * 16 - camX);
    const by = Math.round(1.25 * 16 - camY);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(bx - 1, by - 2, 5, 7);
    ctx.fillStyle = bottleColors[i];
    ctx.fillRect(bx, by, 3, 4);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(bx + 1, by - 3, 1, 2);
  }

  for (let c = 2; c <= 6; c += 2) {
    const mx = Math.round((c + 0.4) * 16 - camX);
    const my = Math.round(3.15 * 16 - camY);
    ctx.fillStyle = '#334155';
    ctx.fillRect(mx, my, 4, 5);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(mx + 1, my + 1, 2, 2);
  }
  ctx.restore();
}

function drawAiNucleusCoreOverlay(tilemap, ctx, camera) {
  const camX = camera.renderX;
  const camY = camera.renderY;
  const ts = tilemap.tileSize;
  const cols = 14;
  const rows = 12;
  const totalW = cols * ts;
  const totalH = rows * ts;
  const t = tilemap.animationClock || 0;

  ctx.save();
  ctx.fillStyle = '#020206';
  ctx.fillRect(Math.round(-camX), Math.round(-camY), totalW, totalH);

  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  for (let c = 0; c < cols; c++) {
    const colX = Math.round(c * ts + 8 - camX);
    const speed = 22 + (c % 4) * 8;
    for (let drop = 0; drop < 3; drop++) {
      const rawY = ((t * speed + c * 37 + drop * 64) % totalH);
      const colY = Math.round(rawY - camY);
      const bit = ((c + drop + Math.floor(t * 2)) % 2 === 0) ? '1' : '0';
      ctx.fillStyle = drop === 0 ? 'rgba(34, 211, 238, 0.34)' : 'rgba(6, 182, 212, 0.16)';
      ctx.fillText(bit, colX, colY);
    }
  }

  const platforms = tilemap._coreDataPlatforms || [
    { col: 2, row: 2, w: 10, h: 6 },
    { col: 5, row: 8, w: 4, h: 3 }
  ];
  for (const p of platforms) {
    for (let r = p.row; r < p.row + p.h; r++) {
      for (let c = p.col; c < p.col + p.w; c++) {
        const sx = Math.round(c * ts - camX);
        const sy = Math.round(r * ts - camY);
        const pulse = 0.72 + 0.25 * Math.sin(t * 2.5 + c * 0.4 + r * 0.4);
        ctx.fillStyle = '#071422';
        ctx.fillRect(sx, sy, ts, ts);
        ctx.fillStyle = 'rgba(14, 116, 144, 0.28)';
        ctx.fillRect(sx + 2, sy + 2, ts - 4, ts - 4);
        ctx.strokeStyle = `rgba(34, 211, 238, ${pulse})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, ts - 1, ts - 1);
      }
    }
  }

  const portalX = Math.round(6 * ts - camX);
  const portalY = Math.round(10.85 * ts - camY);
  ctx.fillStyle = 'rgba(34, 211, 238, 0.22)';
  ctx.fillRect(portalX, portalY, ts * 2, 6);
  ctx.strokeStyle = '#67e8f9';
  ctx.strokeRect(portalX + 0.5, portalY + 0.5, ts * 2 - 1, 5);
  ctx.restore();
}

export function drawExpansionSceneOverlay(tilemap, ctx, camera) {
  const id = tilemap.currentSceneId;
  if (!id) return;
  if (id === 'valleverde_corp') drawCorpOverlay(tilemap, ctx, camera);
  else if (id.startsWith('vertedero_')) drawVertederoOverlay(tilemap, ctx, camera);
  else if (id === 'kernel_arena') drawKernelArenaOverlay(tilemap, ctx, camera);
  else if (id === 'rosa_bar') drawRosaBarOverlay(tilemap, ctx, camera);
  else if (id === 'ai_nucleus_core') drawAiNucleusCoreOverlay(tilemap, ctx, camera);
}

/** Inyecta las 6 escenas de la expansión v2.0 y sus pisos dinámicos en el Tilemap base. */
export function installExpansionScenes(tilemap, order = null) {
  if (!tilemap || !tilemap.scenes) return tilemap;
  buildValleverdeCorpScene(tilemap);
  buildInakitoOfficeScene(tilemap);
  buildVertederoDigitalScene(tilemap);
  buildKernelArenaScene(tilemap);
  buildRosaBarScene(tilemap);
  buildAiNucleusCoreScene(tilemap);

  for (const sceneId of EXPANSION_SCENE_IDS) {
    if (typeof tilemap.decorateScene === 'function') {
      tilemap.decorateScene(sceneId);
    }
  }

  tilemap._expansionOverlayRenderer = drawExpansionSceneOverlay;
  tilemap._expansionController = {
    configureVertederoFloors,
    setAlexCoreUnlocked
  };
  tilemap.expansionLoaded = true;

  configureVertederoFloors(tilemap, order || tilemap.vertederoFloorOrder);
  if (tilemap.alexCoreUnlocked) {
    setAlexCoreUnlocked(tilemap, true);
  }
  return tilemap;
}
