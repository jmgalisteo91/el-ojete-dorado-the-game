import { TILES } from '../../graphics/SpriteSheetGenerator.js?v=8';

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

function buildFirstStageScene(tilemap) {
  const cols = 36;
  const rows = 24;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.STONE_FLOOR);
  const lightSources = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r * 11 + c * 7) % 3 === 0) {
        ground[r][c] = TILES.COBBLE;
      }
    }
  }

  // 1. Red de Caminos de Piedra Sagrada conectando los templos del Héroe
  fillRect(ground, 6, 12, 28, 2, TILES.PATH);
  fillRect(ground, 6, 7, 2, 7, TILES.PATH);
  fillRect(ground, 17, 2, 2, 11, TILES.PATH);
  fillRect(ground, 15, 10, 6, 5, TILES.COBBLE);

  // 2. Templo Occidental: Templo de la Armadura Binaria (c = 6.5, r = 8.5)
  fillRect(ground, 4, 7, 6, 4, TILES.STONE_FLOOR);
  fillRect(ground, 6, 9, 2, 2, TILES.PATH);
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
  fillRect(ground, 17, 3, 2, 2, TILES.PATH);
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
    // Evitar árboles tapando el Templo de la Espada (cols 14..21) ni la senda noreste (26..30)
    if ((c < 14 || c > 21) && (c < 26 || c > 30)) {
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

  return {
    title: 'Valle de la Consagración (Este)',
    cols,
    rows,
    layers: { ground, decoration, collision },
    lightSources,
    signposts
  };
}

function buildNorthPeaksScene(tilemap) {
  const cols = 36;
  const rows = 24;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.COBBLE);
  const lightSources = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r * 13 + c * 7) % 3 === 0) {
        ground[r][c] = TILES.STONE_FLOOR;
      }
    }
  }

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

  return {
    title: 'Las Cumbres de la Recursión (Norte)',
    cols,
    rows,
    layers: { ground, decoration, collision },
    lightSources,
    signposts
  };
}

function buildSouthSwampScene(tilemap) {
  const cols = 36;
  const rows = 24;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.DIRT);
  const lightSources = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r * 11 + c * 17) % 4 === 0) {
        ground[r][c] = TILES.COBBLE;
      }
    }
  }

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

  return {
    title: 'Las Marismas del Hardware Legacy (Sur)',
    cols,
    rows,
    layers: { ground, decoration, collision },
    lightSources,
    signposts
  };
}

function buildWestWastesScene(tilemap) {
  const cols = 36;
  const rows = 24;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.STONE_FLOOR);
  const lightSources = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r * 7 + c * 19) % 3 === 0) {
        ground[r][c] = TILES.COBBLE;
      }
    }
  }

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

  return {
    title: 'Páramo Corrupto de Mister AI Alex (Oeste)',
    cols,
    rows,
    layers: { ground, decoration, collision },
    lightSources,
    signposts
  };
}

function buildOverworldScene(tilemap) {
  const ts = tilemap?.tileSize ?? 16;
  const cols = 36;
  const rows = 24;
  const { ground, decoration, collision, fillRect, setDeco } = createSceneHelpers(tilemap, cols, rows, TILES.GRASS_1);
  const lightSources = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r * 7 + c * 13) % 5 === 0) {
        ground[r][c] = TILES.GRASS_2;
      }
    }
  }

  // Río en el este
  for (let r = 0; r < rows; r++) {
    const riverCol = 28 + Math.round(Math.sin(r * 0.35));
    for (let w = 0; w < 3; w++) {
      const c = riverCol + w;
      ground[r][c] = TILES.WATER_1;
      collision[r][c] = 1;
    }
  }

  // Plaza central adoquinada y caminos principales
  fillRect(ground, 13, 9, 9, 7, TILES.COBBLE);
  fillRect(ground, 0, 12, 33, 2, TILES.PATH);
  fillRect(ground, 2, 11, 2, 2, TILES.PATH);
  fillRect(ground, 31, 12, 6, 2, TILES.PATH);
  fillRect(ground, 34, 6, 2, 14, TILES.PATH);
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

  // Camino Norte-Sur
  fillRect(ground, 17, 0, 2, 24, TILES.PATH);
  fillRect(ground, 13, 9, 9, 7, TILES.COBBLE);
  fillRect(ground, 8, 7, 2, 5, TILES.PATH);
  fillRect(ground, 15, 7, 2, 2, TILES.PATH);
  fillRect(ground, 23, 7, 2, 5, TILES.PATH);
  fillRect(ground, 7, 19, 2, 2, TILES.PATH);
  fillRect(ground, 7, 14, 2, 2, TILES.PATH);
  fillRect(ground, 19, 19, 4, 2, TILES.PATH);
  fillRect(ground, 18, 19, 2, 2, TILES.PATH);

  // Plaza sur de Valleverde
  fillRect(ground, 11, 20, 4, 2, TILES.COBBLE);
  fillRect(ground, 15, 20, 3, 2, TILES.PATH);
  setDeco(12, 20, TILES.FLOWERS_1, false);
  setDeco(13, 20, TILES.FLOWERS_1, false);

  // Mercado central de la plaza de Valleverde
  setDeco(14, 8, TILES.ROOF_RED, true);
  setDeco(15, 8, TILES.ROOF_RED, true);
  setDeco(14, 10, TILES.TABLE, true);
  setDeco(15, 10, TILES.TABLE, true);
  setDeco(13, 10, TILES.CRATE, false);
  setDeco(16, 10, TILES.BARREL, false);
  setDeco(13, 9, TILES.LAMPPOST, true);

  setDeco(19, 8, TILES.ROOF_BLUE, true);
  setDeco(20, 8, TILES.ROOF_BLUE, true);
  setDeco(19, 10, TILES.TABLE, true);
  setDeco(20, 10, TILES.TABLE, true);
  setDeco(21, 10, TILES.CRATE, false);
  setDeco(18, 10, TILES.SANDBAG, false);
  setDeco(21, 9, TILES.LAMPPOST, true);

  setDeco(14, 13, TILES.ROOF_GREEN, true);
  setDeco(15, 13, TILES.ROOF_GREEN, true);
  setDeco(14, 15, TILES.TABLE, true);
  setDeco(15, 15, TILES.TABLE, true);
  setDeco(13, 15, TILES.CRATE, false);
  setDeco(16, 15, TILES.SANDBAG, false);
  setDeco(13, 14, TILES.LAMPPOST, true);

  setDeco(19, 13, TILES.ROOF_RED, true);
  setDeco(20, 13, TILES.ROOF_RED, true);
  setDeco(19, 15, TILES.TABLE, true);
  setDeco(20, 15, TILES.TABLE, true);
  setDeco(21, 15, TILES.CRATE, false);
  setDeco(18, 15, TILES.BARREL, false);
  setDeco(21, 14, TILES.LAMPPOST, true);

  // Pozo central y flores de la plaza
  setDeco(17, 12, TILES.WELL, true);
  setDeco(16, 13, TILES.FLOWERS_1, false);
  setDeco(18, 13, TILES.FLOWERS_1, false);

  lightSources.push(
    { x: 13 * ts + 8, y: 9 * ts + 4, radius: 44, intensity: 0.95 },
    { x: 21 * ts + 8, y: 9 * ts + 4, radius: 44, intensity: 0.95 },
    { x: 13 * ts + 8, y: 14 * ts + 4, radius: 44, intensity: 0.95 },
    { x: 21 * ts + 8, y: 14 * ts + 4, radius: 44, intensity: 0.95 }
  );

  const houseDoors = [];

  // 1. Casa del Programador (Tejado rojo + mix de ventanas + macetas y barril exterior)
  for (let r = 8; r <= 9; r++) {
    for (let c = 2; c <= 6; c++) setDeco(c, r, TILES.ROOF_RED, true);
  }
  setDeco(2, 10, TILES.WALL_FRONT, true);
  setDeco(3, 10, TILES.WALL_WINDOW_FLOWER, true);
  setDeco(4, 10, TILES.WALL_DOOR, true);
  setDeco(5, 10, TILES.WALL_WINDOW, true);
  setDeco(6, 10, TILES.WALL_FRONT, true);
  setDeco(2, 11, TILES.CRATE, false);
  setDeco(3, 11, TILES.FLOWER_POT, false);
  ground[11][4] = TILES.PATH;
  setDeco(5, 11, TILES.FLOWER_POT, false);
  setDeco(6, 11, TILES.BARREL, false);
  houseDoors.push({
    sceneId: 'player_house',
    label: 'Casa del Programador (Tu Hogar)',
    ownerName: 'Tú (Programador)',
    doorCol: 4,
    doorRow: 10,
    worldX: 4 * ts + 8,
    worldY: 11 * ts + 2,
    returnX: 4 * ts,
    returnY: 11 * ts + 2,
    interiorSpawnX: 5.5 * ts,
    interiorSpawnY: 6 * ts
  });

  // 2. Mansión del Sabio Aurelio (Tejado azul + ventanas alternas + macetas en puerta)
  for (let r = 3; r <= 4; r++) {
    for (let c = 6; c <= 11; c++) setDeco(c, r, TILES.ROOF_BLUE, true);
  }
  setDeco(6, 5, TILES.WALL_FRONT, true);
  setDeco(7, 5, TILES.WALL_WINDOW_FLOWER, true);
  setDeco(8, 5, TILES.WALL_DOOR, true);
  setDeco(9, 5, TILES.WALL_WINDOW, true);
  setDeco(10, 5, TILES.WALL_WINDOW_FLOWER, true);
  setDeco(11, 5, TILES.WALL_FRONT, true);
  setDeco(6, 6, TILES.TEMPLE_PILLAR, true);
  setDeco(7, 6, TILES.FLOWER_POT, false);
  ground[6][8] = TILES.COBBLE;
  ground[7][8] = TILES.PATH;
  setDeco(9, 6, TILES.FLOWER_POT, false);
  setDeco(10, 6, TILES.FLOWERS_2, false);
  setDeco(11, 6, TILES.TEMPLE_PILLAR, true);
  houseDoors.push({
    sceneId: 'elder_house',
    label: 'Casa de Aurelio (Cronista)',
    ownerName: 'Anciano Aurelio',
    doorCol: 8,
    doorRow: 5,
    worldX: 8 * ts + 8,
    worldY: 6 * ts + 2,
    returnX: 8 * ts,
    returnY: 6 * ts + 2,
    interiorSpawnX: 5.5 * ts,
    interiorSpawnY: 6 * ts
  });

  // 3. Observatorio de Orion (3ª variante: tejado verde + ventana con maceta + barril/cajas)
  for (let r = 3; r <= 4; r++) {
    for (let c = 13; c <= 16; c++) setDeco(c, r, TILES.ROOF_GREEN, true);
  }
  setDeco(13, 5, TILES.WALL_FRONT, true);
  setDeco(14, 5, TILES.WALL_DOOR, true);
  setDeco(15, 5, TILES.WALL_WINDOW_FLOWER, true);
  setDeco(16, 5, TILES.WALL_FRONT, true);
  setDeco(13, 6, TILES.CRATE, false);
  ground[6][14] = TILES.PATH;
  setDeco(15, 6, TILES.FLOWER_POT, false);
  setDeco(16, 6, TILES.LAMPPOST, true);
  houseDoors.push({
    sceneId: 'oracle_house',
    label: 'Observatorio de Orion (IA)',
    ownerName: 'Oráculo Orion [IA]',
    doorCol: 14,
    doorRow: 5,
    worldX: 14 * ts + 8,
    worldY: 6 * ts + 2,
    returnX: 14 * ts,
    returnY: 6 * ts + 2,
    interiorSpawnX: 5.5 * ts,
    interiorSpawnY: 6 * ts
  });

  // 4. Herrería y Forja de Brom (Tejado rojo + barriles, cajas y sacos de arena)
  for (let r = 4; r <= 5; r++) {
    for (let c = 21; c <= 25; c++) setDeco(c, r, TILES.ROOF_RED, true);
  }
  setDeco(21, 6, TILES.WALL_FRONT, true);
  setDeco(22, 6, TILES.WALL_DOOR, true);
  setDeco(23, 6, TILES.WALL_WINDOW, true);
  setDeco(24, 6, TILES.WALL_FRONT, true);
  setDeco(25, 6, TILES.FIREPLACE, true);
  fillRect(ground, 24, 5, 3, 3, TILES.COBBLE);
  setDeco(20, 6, TILES.BARREL, false);
  setDeco(21, 7, TILES.BARREL, false);
  setDeco(23, 7, TILES.SANDBAG, false);
  setDeco(24, 5, TILES.CRATE, false);
  setDeco(26, 5, TILES.CRATE, false);
  setDeco(26, 6, TILES.ANVIL, true);
  ground[7][22] = TILES.PATH;
  houseDoors.push({
    sceneId: 'blacksmith_house',
    label: 'Herrería de Brom (Forjador)',
    ownerName: 'Herrero Brom',
    doorCol: 22,
    doorRow: 6,
    worldX: 22 * ts + 8,
    worldY: 7 * ts + 2,
    returnX: 22 * ts,
    returnY: 7 * ts + 2,
    interiorSpawnX: 5.5 * ts,
    interiorSpawnY: 6 * ts
  });

  // 5. Cabaña Botánica de Lyra (Tejado verde + ventanas con flores + macetas y barril)
  for (let r = 16; r <= 17; r++) {
    for (let c = 4; c <= 8; c++) setDeco(c, r, TILES.ROOF_GREEN, true);
  }
  setDeco(4, 18, TILES.WALL_WINDOW_FLOWER, true);
  setDeco(5, 18, TILES.WALL_FRONT, true);
  setDeco(6, 18, TILES.WALL_DOOR, true);
  setDeco(7, 18, TILES.WALL_WINDOW_FLOWER, true);
  setDeco(8, 18, TILES.WALL_FRONT, true);
  setDeco(3, 18, TILES.BARREL, false);
  setDeco(4, 19, TILES.FENCE_POST, true);
  setDeco(5, 19, TILES.FLOWER_POT, false);
  ground[19][6] = TILES.PATH;
  setDeco(7, 19, TILES.FLOWER_POT, false);
  setDeco(8, 19, TILES.FENCE_POST, true);
  setDeco(4, 20, TILES.FENCE_H, true);
  setDeco(5, 20, TILES.FLOWERS_2, false);
  ground[20][6] = TILES.PATH;
  setDeco(7, 20, TILES.FLOWERS_1, false);
  setDeco(8, 20, TILES.FENCE_H, true);
  houseDoors.push({
    sceneId: 'herbalist_house',
    label: 'Cabaña de Lyra (Alquimista)',
    ownerName: 'Herbolaria Lyra',
    doorCol: 6,
    doorRow: 18,
    worldX: 6 * ts + 8,
    worldY: 19 * ts + 2,
    returnX: 6 * ts,
    returnY: 19 * ts + 2,
    interiorSpawnX: 5.5 * ts,
    interiorSpawnY: 6 * ts
  });

  // 6. Cuartel de Kael y Campo de Entrenamiento del Binario (Tejado azul + sacos de arena + cajas)
  for (let r = 16; r <= 17; r++) {
    for (let c = 20; c <= 24; c++) setDeco(c, r, TILES.ROOF_BLUE, true);
  }
  setDeco(20, 18, TILES.WALL_FRONT, true);
  setDeco(21, 18, TILES.JAIL_BARS, true);
  setDeco(22, 18, TILES.WALL_DOOR, true);
  setDeco(23, 18, TILES.WALL_WINDOW, true);
  setDeco(24, 18, TILES.WALL_FRONT, true);
  setDeco(20, 19, TILES.SANDBAG, false);
  setDeco(21, 19, TILES.CRATE, false);
  setDeco(25, 18, TILES.SANDBAG, false);
  ground[19][22] = TILES.PATH;
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
  houseDoors.push({
    sceneId: 'guard_house',
    label: 'Cuartel de Kael (Capitán)',
    ownerName: 'Guardia Kael',
    doorCol: 22,
    doorRow: 18,
    worldX: 22 * ts + 8,
    worldY: 19 * ts + 2,
    returnX: 22 * ts,
    returnY: 19 * ts + 2,
    interiorSpawnX: 5.5 * ts,
    interiorSpawnY: 6 * ts
  });

  if (tilemap) {
    tilemap.houseDoors = houseDoors;
  }

  // Arco de salida al Valle de los Templos (al este del puente)
  setDeco(33, 11, TILES.LAMPPOST, true);
  setDeco(33, 14, TILES.LAMPPOST, true);
  setDeco(34, 12, TILES.PORTAL_GATE_OPEN, true);
  setDeco(34, 13, TILES.PORTAL_GATE_OPEN, true);
  lightSources.push({
    x: 34.5 * ts,
    y: 12.5 * ts,
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

  // Farolas de pie (emiten luz cálida de noche)
  const lampposts = [
    [13, 9], [21, 9], [13, 14], [21, 14],
    [8, 11], [26, 11], [32, 11],
    [16, 6], [9, 17], [19, 18]
  ];
  for (const [lc, lr] of lampposts) {
    setDeco(lc, lr, TILES.LAMPPOST, true);
    lightSources.push({
      x: lc * ts + 8,
      y: lr * ts + 4,
      radius: 48,
      intensity: 1.0
    });
  }

  // Ropa tendida entre casas y puestos del mercado
  const clotheslines = [
    {
      x1: 6.5 * ts,
      y1: 8.6 * ts,
      x2: 11.2 * ts,
      y2: 5.2 * ts,
      sag: 6,
      items: ['#f43f5e', '#f8fafc', '#38bdf8', '#facc15']
    },
    {
      x1: 16.5 * ts,
      y1: 4.5 * ts,
      x2: 21.2 * ts,
      y2: 5.0 * ts,
      sag: 5,
      items: ['#e2e8f0', '#a855f7', '#4ade80']
    },
    {
      x1: 15.8 * ts,
      y1: 8.4 * ts,
      x2: 19.2 * ts,
      y2: 8.4 * ts,
      sag: 4,
      items: ['#fb923c', '#f8fafc', '#60a5fa']
    }
  ];

  const signposts = [
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

  for (const sp of signposts) {
    setDeco(sp.c, sp.r, TILES.SIGNPOST, true);
  }

  const bushes = [
    [5, 7], [11, 7], [20, 7], [4, 21], [10, 19], [21, 21]
  ];
  for (const [bc, br] of bushes) {
    setDeco(bc, br, TILES.BUSH, true);
  }

  const isHouseProtected = (c, r) => {
    if (c >= 1 && c <= 7 && r >= 6 && r <= 12) return true;
    if (c >= 5 && c <= 12 && r >= 2 && r <= 8) return true;
    if (c >= 12 && c <= 17 && r >= 2 && r <= 8) return true;
    if (c >= 20 && c <= 27 && r >= 3 && r <= 8) return true;
    if (c >= 3 && c <= 10 && r >= 15 && r <= 21) return true;
    if (c >= 19 && c <= 27 && r >= 15 && r <= 23) return true;
    return false;
  };

  const isRoadOrPlazaArea = (c, r) => {
    if (isHouseProtected(c, r)) return true;
    if (c >= 10 && c <= 13 && r <= 4) return true;
    if (c <= 4 && r >= 10 && r <= 15) return true;
    if (c >= 26 && r >= 10 && r <= 15) return true;
    if (c >= 16 && c <= 19 && r <= 6) return true;
    if (c >= 16 && c <= 19 && r >= 18) return true;
    if (c >= 10 && c <= 16 && r >= 19 && r <= 22) return true;
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

  return {
    scene: {
      title: 'Pueblo de Valleverde',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      clotheslines,
      signposts
    },
    houseDoors
  };
}

function buildHouseInteriors(tilemap, houseDoors) {
  const ts = tilemap?.tileSize ?? 16;
  const interiors = {};

  const createInterior = (sceneId, title, doorMeta, customSetup) => {
    const cols = 12;
    const rows = 9;
    const { ground, decoration, collision } = createSceneHelpers(tilemap, cols, rows, TILES.FLOOR_WOOD);
    const lightSources = [];

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

    for (let r = 4; r <= 6; r++) {
      for (let c = 4; c <= 7; c++) {
        ground[r][c] = TILES.RUG_RED;
      }
    }

    decoration[7][5] = TILES.EXIT_MAT;
    decoration[7][6] = TILES.EXIT_MAT;
    collision[8][5] = 0;
    collision[8][6] = 0;

    decoration[1][6] = TILES.FIREPLACE;
    collision[1][6] = 1;
    lightSources.push({
      x: 6 * ts + 8,
      y: 2 * ts,
      radius: 65,
      intensity: 1.0
    });

    customSetup({ ground, decoration, collision, lightSources });

    interiors[sceneId] = {
      title,
      ownerName: doorMeta.ownerName,
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources,
      exitDoor: {
        worldX: 6 * ts,
        worldY: 7.5 * ts,
        returnX: doorMeta.returnX,
        returnY: doorMeta.returnY
      }
    };
  };

  const playerDoor = houseDoors.find((d) => d.sceneId === 'player_house');
  createInterior('player_house', 'Casa del Programador (Tu Hogar)', playerDoor, ({ decoration, collision, lightSources }) => {
    decoration[2][2] = TILES.BOOKSHELF; collision[2][2] = 1;
    decoration[2][3] = TILES.TABLE;     collision[2][3] = 1;
    decoration[2][8] = TILES.LAMPPOST;  collision[2][8] = 1;
    decoration[2][9] = TILES.BED;       collision[2][9] = 1;
    decoration[4][2] = TILES.CRATE;     collision[4][2] = 1;
    decoration[4][8] = TILES.TABLE;     collision[4][8] = 1;
    lightSources.push({
      x: 3.5 * ts,
      y: 2.5 * ts,
      radius: 46,
      intensity: 0.95
    });
  });

  const elderDoor = houseDoors.find((d) => d.sceneId === 'elder_house');
  createInterior('elder_house', 'Casa de Aurelio (Cronista)', elderDoor, ({ decoration, collision, lightSources }) => {
    decoration[2][2] = TILES.BOOKSHELF; collision[2][2] = 1;
    decoration[2][3] = TILES.BOOKSHELF; collision[2][3] = 1;
    decoration[2][4] = TILES.BOOKSHELF; collision[2][4] = 1;
    decoration[2][5] = TILES.BOOKSHELF; collision[2][5] = 1;
    decoration[4][3] = TILES.TABLE;     collision[4][3] = 1;
    decoration[4][4] = TILES.TABLE;     collision[4][4] = 1;
    decoration[2][8] = TILES.LAMPPOST;  collision[2][8] = 1;
    decoration[2][9] = TILES.BED;       collision[2][9] = 1;
    lightSources.push({
      x: 8.5 * ts,
      y: 2.5 * ts,
      radius: 48,
      intensity: 0.95
    });
  });

  const oracleDoor = houseDoors.find((d) => d.sceneId === 'oracle_house');
  createInterior('oracle_house', 'Observatorio de Orion (Oráculo IA)', oracleDoor, ({ decoration, collision, lightSources }) => {
    decoration[2][2] = TILES.BOOKSHELF; collision[2][2] = 1;
    decoration[2][3] = TILES.LAMPPOST;  collision[2][3] = 1;
    decoration[2][8] = TILES.LAMPPOST;  collision[2][8] = 1;
    decoration[2][9] = TILES.BED;       collision[2][9] = 1;
    decoration[4][3] = TILES.TABLE;     collision[4][3] = 1;
    decoration[4][8] = TILES.BOOKSHELF; collision[4][8] = 1;
    lightSources.push({
      x: 3.5 * ts,
      y: 2.5 * ts,
      radius: 50,
      intensity: 1.0
    });
  });

  const smithDoor = houseDoors.find((d) => d.sceneId === 'blacksmith_house');
  createInterior('blacksmith_house', 'Herrería de Brom (Forjador)', smithDoor, ({ ground, decoration, collision, lightSources }) => {
    for (let r = 2; r <= 5; r++) {
      for (let c = 1; c <= 4; c++) {
        ground[r][c] = TILES.COBBLE;
      }
    }
    decoration[1][3] = TILES.FIREPLACE; collision[1][3] = 1;
    lightSources.push({
      x: 3.5 * ts,
      y: 1.5 * ts,
      radius: 58,
      intensity: 1.05
    });
    decoration[2][2] = TILES.ANVIL;     collision[2][2] = 1;
    decoration[3][2] = TILES.CRATE;     collision[3][2] = 1;
    decoration[4][2] = TILES.CRATE;     collision[4][2] = 1;
    decoration[3][3] = TILES.WELL;      collision[3][3] = 1;
    decoration[4][8] = TILES.TABLE;     collision[4][8] = 1;
    decoration[2][9] = TILES.BED;       collision[2][9] = 1;
  });

  const herbDoor = houseDoors.find((d) => d.sceneId === 'herbalist_house');
  createInterior('herbalist_house', 'Cabaña de Lyra (Alquimista)', herbDoor, ({ decoration, collision }) => {
    decoration[2][2] = TILES.BOOKSHELF; collision[2][2] = 1;
    decoration[2][3] = TILES.BOOKSHELF; collision[2][3] = 1;
    decoration[2][4] = TILES.FLOWERS_1;
    decoration[2][5] = TILES.FLOWERS_2;
    decoration[3][2] = TILES.BUSH;      collision[3][2] = 1;
    decoration[4][2] = TILES.FLOWERS_2;
    decoration[5][9] = TILES.FLOWERS_1;
    decoration[4][7] = TILES.TABLE;     collision[4][7] = 1;
    decoration[4][8] = TILES.TABLE;     collision[4][8] = 1;
    decoration[2][9] = TILES.BED;       collision[2][9] = 1;
  });

  const guardDoor = houseDoors.find((d) => d.sceneId === 'guard_house');
  createInterior('guard_house', 'Cuartel de Kael (Capitán)', guardDoor, ({ ground, decoration, collision }) => {
    for (let r = 3; r <= 6; r++) {
      for (let c = 4; c <= 7; c++) {
        ground[r][c] = TILES.STONE_FLOOR;
      }
    }
    decoration[4][5] = TILES.TABLE;     collision[4][5] = 1;
    decoration[4][6] = TILES.TABLE;     collision[4][6] = 1;
    decoration[2][2] = TILES.CRATE;     collision[2][2] = 1;
    decoration[2][3] = TILES.ANVIL;     collision[2][3] = 1;
    decoration[3][2] = TILES.CRATE;     collision[3][2] = 1;
    decoration[2][8] = TILES.BED;       collision[2][8] = 1;
    decoration[2][9] = TILES.BED;       collision[2][9] = 1;
    decoration[2][5] = TILES.SIGNPOST;  collision[2][5] = 1;
  });

  // Escena especial: Calabozo Municipal del Pueblo
  {
    const cols = 12;
    const rows = 9;
    const { ground, decoration, collision } = createSceneHelpers(tilemap, cols, rows, TILES.STONE_FLOOR);

    for (let c = 0; c < cols; c++) {
      decoration[0][c] = TILES.WALL_INTERIOR; collision[0][c] = 1;
      decoration[1][c] = TILES.WALL_INTERIOR; collision[1][c] = 1;
      decoration[rows - 1][c] = TILES.WALL_INTERIOR; collision[rows - 1][c] = 1;
    }
    for (let r = 0; r < rows; r++) {
      decoration[r][0] = TILES.WALL_INTERIOR; collision[r][0] = 1;
      decoration[r][cols - 1] = TILES.WALL_INTERIOR; collision[r][cols - 1] = 1;
    }

    for (let c = 1; c < cols - 1; c++) {
      decoration[5][c] = TILES.JAIL_BARS;
      collision[5][c] = 1;
    }

    decoration[2][2] = TILES.BED;      collision[2][2] = 1;
    decoration[2][9] = TILES.CRATE;    collision[2][9] = 1;
    decoration[2][5] = TILES.LAMPPOST; collision[2][5] = 1;

    interiors.jail_cell = {
      title: 'Calabozo Municipal de Valleverde',
      cols,
      rows,
      layers: { ground, decoration, collision },
      lightSources: [
        { x: 5.5 * ts, y: 2.5 * ts, radius: 58, intensity: 0.9 }
      ],
      exitDoor: null
    };
  }

  return interiors;
}

/** Construye todas las escenas de Valleverde y sus interiores de aldea. */
export function buildValleverdeScenes(tilemap = null) {
  const { scene: overworld, houseDoors } = buildOverworldScene(tilemap);
  return {
    first_stage: buildFirstStageScene(tilemap),
    north_peaks: buildNorthPeaksScene(tilemap),
    south_swamp: buildSouthSwampScene(tilemap),
    west_wastes: buildWestWastesScene(tilemap),
    overworld,
    ...buildHouseInteriors(tilemap, houseDoors)
  };
}

export const VALLEVERDE_SCENES = buildValleverdeScenes();
