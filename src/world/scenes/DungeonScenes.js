import { TILES } from '../../graphics/SpriteSheetGenerator.js?v=8';

const CHASM_COLLISION_VALUE = 2;

export const TEMPLE_TILES = Object.freeze({
  BINARY_RUNE_CYAN: 101,
  ABYSS_VOID: 102,
  COBWEB: 201,
  TORCH_CYAN: 202,
  TORCH_AMBER: 203,
  CANDLE_CLUSTER: 204,
  FLOATING_MONOLITH: 205,
  STATUE_KNIGHT: 206,
  STATUE_SENTINEL: 207,
  BANNER_CYAN: 208,
  BANNER_CRIMSON: 209,
  TORCH_UNLIT: 210
});

/**
 * Compila plantillas ASCII por capas a un objeto JSON estándar de Tiled (.tmj)
 * con capas separadas: `ground`, `walls`, `decor_over`, `lights` y `props`.
 */
function buildTiledTemplateScene({
  title,
  cols,
  rows,
  legend,
  groundRows,
  wallsRows,
  decorOverRows,
  lights = [],
  props = [],
  torchTriggers = [],
  exitDoor
}) {
  const FIRST_GID = 1;
  const encodeRows = (charRows) => {
    const data = new Array(cols * rows).fill(0);
    for (let r = 0; r < rows; r++) {
      const line = charRows[r] || '';
      for (let c = 0; c < cols; c++) {
        const ch = line[c] || '.';
        const tileId = legend[ch];
        if (tileId !== undefined && tileId !== null && tileId >= 0) {
          data[r * cols + c] = tileId + FIRST_GID;
        }
      }
    }
    return data;
  };

  return {
    type: 'map',
    tiledversion: '1.10.2',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    width: cols,
    height: rows,
    tilewidth: 16,
    tileheight: 16,
    title,
    torchTriggers,
    exitDoor,
    tilesets: [
      { firstgid: FIRST_GID, name: 'el_ojete_tiles' }
    ],
    layers: [
      {
        id: 1,
        name: 'ground',
        type: 'tilelayer',
        width: cols,
        height: rows,
        visible: true,
        opacity: 1,
        data: encodeRows(groundRows)
      },
      {
        id: 2,
        name: 'walls',
        type: 'tilelayer',
        width: cols,
        height: rows,
        visible: true,
        opacity: 1,
        data: encodeRows(wallsRows)
      },
      {
        id: 3,
        name: 'decor_over',
        type: 'tilelayer',
        width: cols,
        height: rows,
        visible: true,
        opacity: 1,
        data: encodeRows(decorOverRows)
      },
      {
        id: 4,
        name: 'lights',
        type: 'objectgroup',
        visible: true,
        objects: lights.map((l, idx) => ({ id: idx + 1, ...l }))
      },
      {
        id: 5,
        name: 'props',
        type: 'objectgroup',
        visible: true,
        objects: props.map((p, idx) => ({
          id: idx + 1,
          x: p.col * 16,
          y: p.row * 16,
          width: 16,
          height: 16,
          ...p
        }))
      }
    ]
  };
}

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
  const barrierActive = tilemap?.armorPuzzle ? tilemap.armorPuzzle.barrierActive : true;
  const fCh = barrierActive ? 'F' : '.';

  const legend = {
    '.': -1,
    S: TILES.STONE_FLOOR,
    c: TILES.COBBLE,
    R: TILES.RUG_RED,
    B: TEMPLE_TILES.BINARY_RUNE_CYAN,
    W: TILES.WALL_INTERIOR,
    M: TILES.MAINFRAME_WALL,
    A: TILES.ALTAR_PEDESTAL,
    F: TILES.FIREPLACE,
    E: TILES.EXIT_MAT,
    L: TILES.LAMPPOST,
    w: TEMPLE_TILES.COBWEB,
    t: TEMPLE_TILES.TORCH_CYAN,
    u: TEMPLE_TILES.TORCH_UNLIT,
    k: TEMPLE_TILES.CANDLE_CLUSTER,
    s: TEMPLE_TILES.STATUE_SENTINEL,
    n: TEMPLE_TILES.BANNER_CYAN
  };

  // 22 cols (0..21) x 18 rows (0..17) — Planta en Cruz / Salón del Trono (puerta Sur 3 tiles libre: cols 9..11)
  const groundRows = [
    'SSSSSSSSSSSSSSSSSSSSSS', // 00
    'SSSSSSSSSSSSSSSSSSSSSS', // 01
    'SSSSSScBRRRRRRBcSSSSSS', // 02 Ábside Norte (Altar elevado)
    'SSSSSScSRRRRRRScSSSSSS', // 03
    'SScBSSSBRRRRRRBSSSBcSS', // 04 Plataforma del Altar (10,4)
    'SScBSSSScRRRRcSSSSBcSS', // 05 Barrera de fuego (9..11,5)
    'SScccBccSRRRRSccBcccSS', // 06 Monolitos Alfa (4,6) y Gamma (17,6)
    'SSccccccSRRRRSccccccSS', // 07 Monolito Beta (10,7)
    'SSccBcccSSSSSScccBccSS', // 08 Alas laterales de interruptores
    'SSccBcccSSSSSScccBccSS', // 09
    'SSccccccSSSSSSccccccSS', // 10 Interruptores A(4,10) B(6,10) C(15,10) D(17,10)
    'SSccBcccSSSSSScccBccSS', // 11
    'SScccBcccRRRRcccBcccSS', // 12
    'SSSSSSSScRRRRcSSSSSSSS', // 13 Pasillo central de entrada (3+ tiles)
    'SSSSSSSScRRRRcSSSSSSSS', // 14 Spawn jugador (10,14)
    'SSSSSSSScRRRRcSSSSSSSS', // 15
    'SSSSSSSScEEEEcSSSSSSSS', // 16 Puerta Sur 3 tiles (cols 9..11) + borde
    'SSSSSSSSSSSSSSSSSSSSSS'  // 17
  ];

  const wallsRows = [
    'WWWWWWWWWWWWWWWWWWWWWW', // 00
    'WWWWWWWWWWWWWWWWWWWWWW', // 01
    'WWWWWW..........WWWWWW', // 02 Silueta en Cruz: ábside superior enmarcado
    'WWWWWW..L....L..WWWWWW', // 03 Lámparas (8,3),(13,3) fuera del camino central 9..11
    'WW.....W..A..W......WW', // 04 Altar (10,4) no sólido; pilares (7,4),(14,4)
    `WW......W${fCh}${fCh}${fCh}W......WW`, // 05 Barrera de fuego (9..11,5)
    'WW..................WW', // 06 Monolitos Alfa (4,6), Gamma (17,6)
    'WW...L..........L...WW', // 07 Lámparas (5,7),(16,7)
    'WW....W.WWWWWW.W....WW', // 08 Divisor central + pilares despejando interruptores
    'WW......WWWWWW......WW', // 09
    'WW......WWWWWW......WW', // 10 Interruptores (4,10),(6,10),(15,10),(17,10) libres
    'WW....W.WWWWWW.W....WW', // 11
    'WW..................WW', // 12
    'WWWWWWWW......WWWWWWWW', // 13 Umbral del Salón del Trono (cols 8..13 libres)
    'WWWWWW..L....L..WWWWWW', // 14 Lámparas (8,14),(13,14) -> camino central 9..11 100% libre
    'WWWWWW..........WWWWWW', // 15
    'WWWWWW...EEE....WWWWWW', // 16 Salida de 3 tiles libre (cols 9..11)
    'WWWWWWWWWWWWWWWWWWWWWW'  // 17
  ];

  const decorOverRows = [
    '......................', // 00
    '......w.n....n.w......', // 01 Estandartes cian sobre el altar
    '......w........w......', // 02
    '..t......k..k......t..', // 03 Antorchas de muro y velas del altar
    '.......u.....u........', // 04 Antorchas del sagrario norte
    '......................', // 05
    '......................', // 06
    '..ts..............st..', // 07 Estatuas de Centinela en alas (3,7) y (18,7) + antorchas
    '......................', // 08
    '......................', // 09
    '..t................t..', // 10 Antorchas laterales de los pedestales
    '......................', // 11
    '..w................w..', // 12
    '.......u......u.......', // 13 Antorchas del umbral (se encienden al entrar)
    '.......s......s.......', // 14 Estatuas de entrada (7,14) y (14,14) flanqueando el pasillo
    '......t........t......', // 15
    '......w........w......', // 16
    '......................'  // 17
  ];

  const lights = [
    { x: 10.5 * 16, y: 4.5 * 16, radius: 52, intensity: 0.78, glow: 'cyan', color: '#38bdf8' },
    { x: 9.5 * 16, y: 3.5 * 16, radius: 38, intensity: 0.65, glow: 'warm', color: '#fde047' },
    { x: 12.5 * 16, y: 3.5 * 16, radius: 38, intensity: 0.65, glow: 'warm', color: '#fde047' },
    { x: 10.5 * 16, y: 5.5 * 16, radius: 46, intensity: 0.72, glow: 'warm', color: '#f97316' },
    { x: 4.5 * 16, y: 6.5 * 16, radius: 38, intensity: 0.58, glow: 'cyan', color: '#38bdf8' },
    { x: 17.5 * 16, y: 6.5 * 16, radius: 38, intensity: 0.58, glow: 'cyan', color: '#38bdf8' },
    { x: 5.5 * 16, y: 10.5 * 16, radius: 42, intensity: 0.55, glow: 'cyan', color: '#38bdf8' },
    { x: 16.5 * 16, y: 10.5 * 16, radius: 42, intensity: 0.55, glow: 'cyan', color: '#38bdf8' },
    { x: 9.5 * 16, y: 14.5 * 16, radius: 44, intensity: 0.68, glow: 'warm', color: '#fbbf24' },
    { x: 12.5 * 16, y: 14.5 * 16, radius: 44, intensity: 0.68, glow: 'warm', color: '#fbbf24' },
    { x: 2.5 * 16, y: 7.5 * 16, radius: 34, intensity: 0.52, glow: 'cyan', color: '#38bdf8' },
    { x: 19.5 * 16, y: 7.5 * 16, radius: 34, intensity: 0.52, glow: 'cyan', color: '#38bdf8' }
  ];

  const props = [
    {
      id: 'armor_statue_west',
      kind: 'statue',
      col: 7,
      row: 14,
      solid: true,
      name: 'Estatua del Centinela Binario (Oeste)',
      title: '🛡️ [ESTATUA DEL CENTINELA BINARIO]',
      lines: [
        '«Solo quien equilibra dos pulsos entre cuatro compuertas merece vestir el código del alba.»',
        'Su coraza de obsidiana vibra suavemente en armonía con las runas cian del suelo.'
      ]
    },
    {
      id: 'armor_statue_east',
      kind: 'statue',
      col: 14,
      row: 14,
      solid: true,
      name: 'Estatua del Arquitecto de Paridad (Este)',
      title: '🏛️ [ESTATUA DEL ARQUITECTO DE PARIDAD]',
      lines: [
        '«La fuerza bruta quiebra los circuitos; la lógica pura apaga las llamas del bastión.»',
        'A sus pies yacen antiguos grabados sobre puertas XOR y paridad binaria.'
      ]
    },
    {
      id: 'armor_statue_wing_w',
      kind: 'statue',
      col: 3,
      row: 7,
      solid: true,
      name: 'Efigie del Custodio de Bits (Ala Oeste)',
      title: '💠 [EFIGIE DEL CUSTODIO DE BITS]',
      lines: [
        '«Cuando los compiladores dormían, nosotros forjamos cada bit de la Armadura con paciencia eterna.»'
      ]
    },
    {
      id: 'armor_statue_wing_e',
      kind: 'statue',
      col: 18,
      row: 7,
      solid: true,
      name: 'Efigie del Custodio de Bits (Ala Este)',
      title: '💠 [EFIGIE DEL CUSTODIO DE BITS]',
      lines: [
        '«Cuidado con los bucles sin reposo: si la armadura acumula estática binaria, busca café o descanso.»'
      ]
    }
  ];

  return buildTiledTemplateScene({
    title: 'Templo de la Armadura Binaria · Santuario del Bastión',
    cols,
    rows,
    legend,
    groundRows,
    wallsRows,
    decorOverRows,
    lights,
    props,
    torchTriggers: [
      {
        id: 'armor_entry_torches',
        stepTiles: [{ col: 10, row: 13 }, { col: 11, row: 13 }],
        torches: [
          { col: 7, row: 13, tile: TEMPLE_TILES.TORCH_CYAN, color: '#38bdf8', glow: 'cyan', radius: 44, intensity: 0.72 },
          { col: 14, row: 13, tile: TEMPLE_TILES.TORCH_CYAN, color: '#38bdf8', glow: 'cyan', radius: 44, intensity: 0.72 }
        ],
        notice: '🔥 Las antorchas de entrada despiertan con luz binaria.'
      },
      {
        id: 'armor_sanctum_torches',
        stepTiles: [{ col: 9, row: 6 }, { col: 10, row: 6 }, { col: 11, row: 6 }, { col: 12, row: 6 }],
        torches: [
          { col: 7, row: 4, tile: TEMPLE_TILES.TORCH_CYAN, color: '#38bdf8', glow: 'cyan', radius: 46, intensity: 0.78 },
          { col: 13, row: 4, tile: TEMPLE_TILES.TORCH_CYAN, color: '#38bdf8', glow: 'cyan', radius: 46, intensity: 0.78 }
        ],
        notice: '🔥 Las antorchas del sagrario cian iluminan el altar.'
      }
    ],
    exitDoor: {
      worldX: 10.5 * 16,
      worldY: 16.5 * 16,
      returnX: 6.5 * 16,
      returnY: 10 * 16,
      returnScene: 'first_stage'
    }
  });
}

function buildSwordTempleScene(tilemap) {
  const cols = 24;
  const rows = 18;
  const portalOpen = Boolean(tilemap?.swordPuzzle?.portalOpen);
  const pCh = portalOpen ? 'P' : 'G';

  const legend = {
    '.': -1,
    S: TILES.STONE_FLOOR,
    c: TILES.COBBLE,
    R: TILES.RUG_RED,
    V: TEMPLE_TILES.ABYSS_VOID,
    W: TILES.WALL_INTERIOR,
    A: TILES.ALTAR_PEDESTAL,
    G: TILES.PORTAL_GATE_CLOSED,
    P: TILES.PORTAL_GATE_OPEN,
    E: TILES.EXIT_MAT,
    L: TILES.LAMPPOST,
    w: TEMPLE_TILES.COBWEB,
    t: TEMPLE_TILES.TORCH_AMBER,
    u: TEMPLE_TILES.TORCH_UNLIT,
    k: TEMPLE_TILES.CANDLE_CLUSTER,
    m: TEMPLE_TILES.FLOATING_MONOLITH,
    K: TEMPLE_TILES.STATUE_KNIGHT,
    b: TEMPLE_TILES.BANNER_CRIMSON
  };

  // 24 cols (0..23) x 18 rows (0..17) — Planta en Cruz con puente central sobre el foso del Abismo
  const groundRows = [
    'SSSSSSSSSSSSSSSSSSSSSSSS', // 00
    'SSSSSSSSSSSSSSSSSSSSSSSS', // 01 Portal Norte (11..12,1)
    'SSSSSScSSRRRRRRSScSSSSSS', // 02 Ábside del Altar dorado
    'SSSSSScSSRRRRRRSScSSSSSS', // 03
    'SScSSccSSRRRRRRSSccSScSS', // 04 Pedestal del Altar (11,4)
    'SScccccSSRRRRRRSScccccSS', // 05 Cabecera del puente
    'SScccccSSVVRRVVSScccccSS', // 06 Puente central (11..12) flanqueado por el foso (9..10 y 13..14)
    'SScccccSSVVRRVVSScccccSS', // 07 Pasillos laterales (7..8 y 15..16)
    'SScccccSSVVRRVVSScccccSS', // 08 Monolitos 1 (6,8) y 3 (17,8)
    'SScccccSSccRRccSScccccSS', // 09 Terraza sur del puente
    'SSccccccSRRRRRRSccccccSS', // 10 Monolito 2 (11,10)
    'SSccccccSRRRRRRSccccccSS', // 11 Pasillo central libre (cols 10..12 desde fila 11)
    'SSccccccSRRRRRRSccccccSS', // 12
    'SSSSSScSScRRRRcSScSSSSSS', // 13 Pasillo sur de entrada (3 tiles libre: cols 10..12)
    'SSSSSScSScRRRRcSScSSSSSS', // 14 Spawn jugador (11.5,14.5)
    'SSSSSScSScRRRRcSScSSSSSS', // 15
    'SSSSSSSSScREEERSSSSSSSSS', // 16 Puerta Sur 3 tiles libre (cols 10..12)
    'SSSSSSSSSSSSSSSSSSSSSSSS'  // 17
  ];

  const wallsRows = [
    'WWWWWWWWWWWWWWWWWWWWWWWW', // 00
    `WWWWWWWWWWW${pCh}${pCh}WWWWWWWWWWW`, // 01 Portal Norte (11..12,1)
    'WWWWWW............WWWWWW', // 02 Silueta en Cruz: ábside superior
    'WWWWWW...L....L...WWWWWW', // 03 Lámparas (9,3),(14,3) -> acceso norte de 3+ tiles libre
    'WW.........A..........WW', // 04 Altar (11,4) no sólido
    'WW...W............W...WW', // 05 Pilares (5,5),(18,5)
    'WW....................WW', // 06
    'WW.L................L.WW', // 07 Lámparas (3,7),(20,7)
    'WW....................WW', // 08 Monolitos en alas/esquinas
    'WW....................WW', // 09
    'WW....................WW', // 10 Monolito 2 (11,10)
    'WW....................WW', // 11
    'WW...W............W...WW', // 12 Pilares (5,12),(18,12)
    'WWWWWW............WWWWWW', // 13 Silueta en Cruz: nave sur
    'WWWWWWL..........LWWWWWW', // 14 Lámparas (6,14),(17,14) -> camino central 10..12 100% despejado
    'WWWWWW............WWWWWW', // 15
    'WWWWWW....EEE.....WWWWWW', // 16 Salida Sur de 3 tiles libre (cols 10..12)
    'WWWWWWWWWWWWWWWWWWWWWWWW'  // 17
  ];

  const decorOverRows = [
    '........................', // 00
    '......w..b....b..w......', // 01 Estandartes carmesí y telarañas en el ábside
    '......w..........w......', // 02
    '...K................K...', // 03 Caballeros caídos (3,3) y (20,3)
    '........................', // 04
    '..t..u............u..t..', // 05 Antorchas norte
    '........................', // 06
    '.........m....m.........', // 07 Monolitos flotantes (9,7) y (14,7) sobre el foso
    '........................', // 08
    '........................', // 09
    '..t..................t..', // 10 Antorchas laterales
    '........................', // 11
    '.....u............u.....', // 12 Antorchas de pilares sur
    '......w..........w......', // 13
    '........................', // 14
    '...K................K...', // 15 Caballeros caídos (3,15) y (20,15)
    '......w..........w......', // 16
    '........................'  // 17
  ];

  const lights = [
    { x: 11.5 * 16, y: 4.5 * 16, radius: 68, intensity: 0.92, glow: 'warm', color: '#fbbf24' },
    { x: 10.5 * 16, y: 3.5 * 16, radius: 46, intensity: 0.78, glow: 'warm', color: '#f59e0b' },
    { x: 13.5 * 16, y: 3.5 * 16, radius: 46, intensity: 0.78, glow: 'warm', color: '#f59e0b' },
    { x: 11.5 * 16, y: 7.5 * 16, radius: 56, intensity: 0.6, glow: 'cyan', color: '#38bdf8' },
    { x: 6.5 * 16, y: 14.5 * 16, radius: 46, intensity: 0.75, glow: 'warm', color: '#f59e0b' },
    { x: 17.5 * 16, y: 14.5 * 16, radius: 46, intensity: 0.75, glow: 'warm', color: '#f59e0b' },
    { x: 3.5 * 16, y: 7.5 * 16, radius: 44, intensity: 0.72, glow: 'warm', color: '#f59e0b' },
    { x: 20.5 * 16, y: 7.5 * 16, radius: 44, intensity: 0.72, glow: 'warm', color: '#f59e0b' },
    { x: 3.5 * 16, y: 3.5 * 16, radius: 36, intensity: 0.55, glow: 'amber', color: '#fde047' },
    { x: 20.5 * 16, y: 3.5 * 16, radius: 36, intensity: 0.55, glow: 'amber', color: '#fde047' }
  ];

  const props = [
    {
      id: 'sword_knight_nw',
      kind: 'statue',
      col: 3,
      row: 3,
      solid: true,
      name: 'Estatua del Caballero Caído (Noroeste)',
      title: '⚔️ [ESTATUA DEL CABALLERO CAÍDO]',
      lines: [
        '«Olvidó definir el Caso Base antes de invocar su filo. Su alma aún cae en el Abismo sin retorno.»',
        'La hoja de piedra yace partida frente al foso central.'
      ]
    },
    {
      id: 'sword_knight_ne',
      kind: 'statue',
      col: 20,
      row: 3,
      solid: true,
      name: 'Estatua del Caballero Caído (Noreste)',
      title: '⚔️ [ESTATUA DEL CABALLERO CAÍDO]',
      lines: [
        '«Primero invoca el Límite N, desciende a la Singularidad 0 y solo entonces desenreda la pila.»',
        'Su yelmo agrietado apunta hacia las runas luminosas.'
      ]
    },
    {
      id: 'sword_knight_sw',
      kind: 'statue',
      col: 3,
      row: 15,
      solid: true,
      name: 'Estatua del Caballero Caído (Suroeste)',
      title: '🪦 [MEMORIAL DEL PRIMER RECURSIVO]',
      lines: [
        '«Aquí cayó Sir Iterador, convencido de poder cruzar el Abismo sin comprender la recursión.»'
      ]
    },
    {
      id: 'sword_knight_se',
      kind: 'statue',
      col: 20,
      row: 15,
      solid: true,
      name: 'Estatua del Caballero Caído (Sureste)',
      title: '🪦 [MEMORIAL DE LA PILA ROTA]',
      lines: [
        '«Cada monolito que flota sobre el foso sostiene un marco de memoria del santuario.»'
      ]
    }
  ];

  return buildTiledTemplateScene({
    title: 'Templo de la Espada de la Recursividad · Altar del Abismo',
    cols,
    rows,
    legend,
    groundRows,
    wallsRows,
    decorOverRows,
    lights,
    props,
    torchTriggers: [
      {
        id: 'sword_hall_torches',
        stepTiles: [{ col: 11, row: 13 }, { col: 12, row: 13 }, { col: 11, row: 12 }, { col: 12, row: 12 }],
        torches: [
          { col: 5, row: 12, tile: TEMPLE_TILES.TORCH_AMBER, color: '#f59e0b', glow: 'warm', radius: 48, intensity: 0.78 },
          { col: 18, row: 12, tile: TEMPLE_TILES.TORCH_AMBER, color: '#f59e0b', glow: 'warm', radius: 48, intensity: 0.78 }
        ],
        notice: '🔥 Los hacheros del templo arden al sentir tus pasos.'
      },
      {
        id: 'sword_north_torches',
        stepTiles: [
          { col: 7, row: 5 }, { col: 8, row: 5 },
          { col: 11, row: 5 }, { col: 12, row: 5 },
          { col: 15, row: 5 }, { col: 16, row: 5 }
        ],
        torches: [
          { col: 5, row: 5, tile: TEMPLE_TILES.TORCH_AMBER, color: '#fbbf24', glow: 'warm', radius: 48, intensity: 0.82 },
          { col: 18, row: 5, tile: TEMPLE_TILES.TORCH_AMBER, color: '#fbbf24', glow: 'warm', radius: 48, intensity: 0.82 }
        ],
        notice: '🔥 Las antorchas del altar iluminan el filo ancestral.'
      }
    ],
    exitDoor: {
      worldX: 11.5 * 16,
      worldY: 16.5 * 16,
      returnX: 17.5 * 16,
      returnY: 4.5 * 16,
      returnScene: 'first_stage'
    }
  });
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

  // Amplio suelo central y laterales 100% despejados para esquivar embestidas y charcos de ácido
  fillRect(ground, 2, 2, 20, 14, TILES.STONE_PATH);

  lightSources.push(
    { x: 2.5 * 16, y: 2.5 * 16, radius: 52, intensity: 0.85, color: '#10b981' },
    { x: 21.5 * 16, y: 2.5 * 16, radius: 52, intensity: 0.85, color: '#10b981' },
    { x: 11.5 * 16, y: 9.0 * 16, radius: 72, intensity: 0.95, color: '#34d399' }
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
  const cols = 20;
  const rows = 15;
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

  // Faroles pegados a la pared norte; centro y las 4 esquinas interiores 100% libres
  setDeco(4, 0, TILES.LAMPPOST, true);
  setDeco(15, 0, TILES.LAMPPOST, true);
  lightSources.push(
    { x: 4.5 * 16, y: 1.5 * 16, radius: 64, intensity: 0.95, color: '#f59e0b' },
    { x: 15.5 * 16, y: 1.5 * 16, radius: 64, intensity: 0.95, color: '#f59e0b' },
    { x: 10.0 * 16, y: 7.5 * 16, radius: 80, intensity: 0.75, color: '#38bdf8' }
  );

  setDeco(9, rows - 1, TILES.PORTAL_GATE_OPEN, false);
  setDeco(10, rows - 1, TILES.PORTAL_GATE_OPEN, false);
  collision[rows - 1][9] = 0;
  collision[rows - 1][10] = 0;

  setDeco(9, 0, TILES.PORTAL_GATE_CLOSED, true);
  setDeco(10, 0, TILES.PORTAL_GATE_CLOSED, true);

  return {
    title: 'Minas de la Recursión · Cámara del Stack Overflow',
    cols,
    rows,
    layers: { ground, decoration, collision },
    lightSources,
    exitDoor: {
      worldX: 10 * 16,
      worldY: (rows - 1) * 16,
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

  // Pasarela amplia y centro 100% libre de columnas para correr entre los fusibles y esquivar ondas
  fillRect(ground, 2, 2, 20, 14, TILES.STONE_PATH);

  lightSources.push(
    { x: 2.5 * 16, y: 2.5 * 16, radius: 56, intensity: 0.9, color: '#f97316' },
    { x: 21.5 * 16, y: 2.5 * 16, radius: 56, intensity: 0.9, color: '#f97316' },
    { x: 11.5 * 16, y: 8.5 * 16, radius: 74, intensity: 1.0, color: '#ef4444' }
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

  // Pedestales decorativos pegados a la pared norte; todo el centro (22x16) 100% despejado para láseres y fases
  setDeco(11, 1, TILES.CORE_PEDESTAL, false);
  setDeco(12, 1, TILES.CORE_PEDESTAL, false);

  lightSources.push(
    { x: 11.5 * 16, y: 2.5 * 16, radius: 88, intensity: 1.0, color: '#ec4899' },
    { x: 2.5 * 16, y: 2.5 * 16, radius: 56, intensity: 0.9, color: '#06b6d4' },
    { x: 21.5 * 16, y: 2.5 * 16, radius: 56, intensity: 0.9, color: '#06b6d4' },
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
