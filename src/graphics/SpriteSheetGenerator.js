/**
 * Generador procedural de Spritesheets Pixel Art (16x16 px por celda).
 * Incluye:
 * - Personajes humanos (0..4) y Animales del pueblo (5: Oveja, 6: Gallina, 7: Perro)
 * - Tileset exterior + interior de viviendas + barrera de horario del puente
 * - Spritesheet de objetos de inventario (Items)
 */

const TILE_SIZE = 16;
export const ATLAS_SCALE = 4;

export const CHARACTER_TYPES = {
  HERO: 0,
  ELDER: 1,
  BLACKSMITH: 2,
  HERBALIST: 3,
  GUARD: 4,
  SHEEP: 5,
  CHICKEN: 6,
  DOG: 7,
  AI_ORACLE: 8,
  HERO_ARMORED: 9,
  SHADOW_DRONE: 10,
  SHADOW_KNIGHT: 11
};

export const TILES = {
  GRASS_1: 0,
  GRASS_2: 1,
  PATH: 2,
  COBBLE: 3,
  WATER_1: 4,
  WATER_2: 5,
  BRIDGE: 6,
  FLOWERS_1: 7,
  FLOWERS_2: 8,
  TREE_TOP: 9,
  TREE_TRUNK: 10,
  ROOF_RED: 11,
  ROOF_BLUE: 12,
  WALL_WOOD: 13,
  WALL_WINDOW: 14,
  WALL_DOOR: 15,
  FENCE_H: 16,
  FENCE_POST: 17,
  LAMPPOST: 18,
  WELL: 19,
  SIGNPOST: 20,
  CRATE: 21,
  BUSH: 22,
  ANVIL: 23,
  BRIDGE_GATE: 24,
  FLOOR_WOOD: 25,
  WALL_INTERIOR: 26,
  RUG_RED: 27,
  TABLE: 28,
  BOOKSHELF: 29,
  BED: 30,
  FIREPLACE: 31,
  EXIT_MAT: 32,
  CHEST_CLOSED: 33,
  CHEST_OPEN: 34,
  JAIL_BARS: 35,
  STONE_FLOOR: 36,
  ALTAR_PEDESTAL: 37,
  PORTAL_GATE_CLOSED: 38,
  PORTAL_GATE_OPEN: 39,

  // Tiles exclusivos para Mazmorras y Mainframe Cuántico (v3.6+)
  SEWER_SLIME_FLOOR: 40,
  SEWER_PIPE_WALL: 41,
  MINE_CRYSTAL_FLOOR: 42,
  MINE_CHASM: 43,
  MINE_CRYSTAL_WALL: 44,
  FORGE_LAVA_FLOOR: 45,
  FORGE_BOILER_WALL: 46,
  MAINFRAME_FLOOR: 47,
  MAINFRAME_WALL: 48,
  CRYSTAL_BARRIER: 49,
  CORE_PEDESTAL: 50,

  // Alias semánticos usados por los constructores de escenas
  DOOR: 15,          // WALL_DOOR
  ALTAR: 37,         // ALTAR_PEDESTAL
  STONE_PATH: 36,    // STONE_FLOOR
  TEMPLE_WALL: 26,   // WALL_INTERIOR
  TEMPLE_PILLAR: 37  // ALTAR_PEDESTAL (columna de piedra)
};

export const ITEM_ICONS = {
  POTION: 0,
  BREAD: 1,
  WHEAT: 2,
  LANTERN: 3,
  BRIDGE_PASS: 4,
  GOLDEN_APPLE: 5,
  ARMOR: 6,
  SWORD: 7,
  ABYSSAL_POINTER: 8,
  SILICON_FLOWER: 9,
  DRONE_SCRAP: 10,
  FISH: 11,
  POTION_ARMOR: 12,
  SILICON_ORE: 13,
  MICROWAVE_MAGNETRON: 14,
  DUNGEON_CORE_GC: 15,
  DUNGEON_CORE_STACK: 16,
  DUNGEON_CORE_MICROWAVE: 17
};

function canvasToImage(canvas) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = canvas.toDataURL('image/png');
  });
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  if (w >= 3 && h >= 3 && typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 0.45);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

function drawHumanFrame(ctx, ox, oy, dir, frame, palette) {
  const isWalking = frame === 1 || frame === 3;
  const stepDir = frame === 1 ? -1 : frame === 3 ? 1 : 0;
  const bob = isWalking ? -1 : 0;

  px(ctx, ox + 4, oy + 14, 8, 2, 'rgba(0, 0, 0, 0.35)');

  const leftLegY = oy + 12 + (stepDir === -1 ? -1 : 0);
  const rightLegY = oy + 12 + (stepDir === 1 ? -1 : 0);
  if (dir === 2 || dir === 3) {
    px(ctx, ox + 6 + stepDir, oy + 12, 2, 3, palette.boots);
    px(ctx, ox + 8 - stepDir, oy + 12, 2, 3, palette.boots);
  } else {
    px(ctx, ox + 5, leftLegY, 2, 3, palette.boots);
    px(ctx, ox + 9, rightLegY, 2, 3, palette.boots);
  }

  px(ctx, ox + 4, oy + 7 + bob, 8, 5, palette.tunic);
  px(ctx, ox + 5, oy + 7 + bob, 6, 4, palette.tunicLight);
  px(ctx, ox + 4, oy + 11 + bob, 8, 1, palette.belt);
  px(ctx, ox + 7, oy + 11 + bob, 2, 1, '#f4d06f');

  const leftArmSwing = stepDir === 1 ? -1 : stepDir === -1 ? 1 : 0;
  const rightArmSwing = -leftArmSwing;
  if (dir === 0 || dir === 1) {
    px(ctx, ox + 3, oy + 7 + bob + leftArmSwing, 1, 4, palette.tunic);
    px(ctx, ox + 3, oy + 10 + bob + leftArmSwing, 1, 1, palette.skin);
    px(ctx, ox + 12, oy + 7 + bob + rightArmSwing, 1, 4, palette.tunic);
    px(ctx, ox + 12, oy + 10 + bob + rightArmSwing, 1, 1, palette.skin);
  } else if (dir === 2) {
    px(ctx, ox + 6 + leftArmSwing, oy + 8 + bob, 3, 3, palette.tunicLight);
    px(ctx, ox + 6 + leftArmSwing, oy + 10 + bob, 2, 1, palette.skin);
  } else if (dir === 3) {
    px(ctx, ox + 7 + rightArmSwing, oy + 8 + bob, 3, 3, palette.tunicLight);
    px(ctx, ox + 8 + rightArmSwing, oy + 10 + bob, 2, 1, palette.skin);
  }

  px(ctx, ox + 4, oy + 2 + bob, 8, 6, palette.skin);

  if (dir === 0) {
    px(ctx, ox + 4, oy + 1 + bob, 8, 2, palette.hair);
    px(ctx, ox + 3, oy + 2 + bob, 1, 3, palette.hair);
    px(ctx, ox + 12, oy + 2 + bob, 1, 3, palette.hair);
    px(ctx, ox + 5, oy + 5 + bob, 1, 2, '#1a1c2c');
    px(ctx, ox + 10, oy + 5 + bob, 1, 2, '#1a1c2c');
    if (palette.beard) {
      px(ctx, ox + 5, oy + 7 + bob, 6, 3, palette.beard);
    } else if (palette.accent) {
      px(ctx, ox + 5, oy + 7 + bob, 6, 1, palette.accent);
    }
  } else if (dir === 1) {
    px(ctx, ox + 4, oy + 1 + bob, 8, 6, palette.hair);
    px(ctx, ox + 3, oy + 2 + bob, 10, 4, palette.hair);
    if (palette.accent) {
      px(ctx, ox + 5, oy + 7 + bob, 6, 1, palette.accent);
    }
  } else if (dir === 2) {
    px(ctx, ox + 5, oy + 1 + bob, 7, 3, palette.hair);
    px(ctx, ox + 8, oy + 2 + bob, 4, 5, palette.hair);
    px(ctx, ox + 5, oy + 5 + bob, 1, 2, '#1a1c2c');
    if (palette.beard) {
      px(ctx, ox + 4, oy + 7 + bob, 3, 2, palette.beard);
    }
  } else if (dir === 3) {
    px(ctx, ox + 4, oy + 1 + bob, 7, 3, palette.hair);
    px(ctx, ox + 4, oy + 2 + bob, 4, 5, palette.hair);
    px(ctx, ox + 10, oy + 5 + bob, 1, 2, '#1a1c2c');
    if (palette.beard) {
      px(ctx, ox + 9, oy + 7 + bob, 3, 2, palette.beard);
    }
  }

  if (palette.plume) {
    px(ctx, ox + 7, oy + bob, 2, 2, palette.plume);
  }
}

/**
 * Dibuja los frames de la Oveja (Sheep - Arquetipo 5)
 */
function drawSheepFrame(ctx, ox, oy, dir, frame) {
  const step = frame === 1 ? -1 : frame === 3 ? 1 : 0;
  const bob = frame === 1 || frame === 3 ? -1 : 0;

  px(ctx, ox + 3, oy + 13, 10, 2, 'rgba(0,0,0,0.3)');
  // Patitas oscuras
  px(ctx, ox + 4, oy + 11 + (step === -1 ? -1 : 0), 2, 3, '#3b322c');
  px(ctx, ox + 10, oy + 11 + (step === 1 ? -1 : 0), 2, 3, '#3b322c');

  // Cuerpo de lana esponjosa
  px(ctx, ox + 3, oy + 5 + bob, 10, 7, '#e8eef5');
  px(ctx, ox + 2, oy + 6 + bob, 12, 5, '#ffffff');
  px(ctx, ox + 4, oy + 5 + bob, 8, 5, '#ffffff');

  // Cabeza según dirección
  if (dir === 0) {
    px(ctx, ox + 5, oy + 6 + bob, 6, 5, '#473c35');
    px(ctx, ox + 6, oy + 4 + bob, 4, 2, '#f0f4f8');
    px(ctx, ox + 4, oy + 6 + bob, 1, 2, '#473c35');
    px(ctx, ox + 11, oy + 6 + bob, 1, 2, '#473c35');
    px(ctx, ox + 6, oy + 8 + bob, 1, 1, '#ffffff');
    px(ctx, ox + 9, oy + 8 + bob, 1, 1, '#ffffff');
  } else if (dir === 2) {
    px(ctx, ox + 2, oy + 5 + bob, 4, 5, '#473c35');
    px(ctx, ox + 3, oy + 6 + bob, 1, 1, '#ffffff');
  } else if (dir === 3) {
    px(ctx, ox + 10, oy + 5 + bob, 4, 5, '#473c35');
    px(ctx, ox + 12, oy + 6 + bob, 1, 1, '#ffffff');
  }
}

/**
 * Dibuja los frames de la Gallina (Chicken - Arquetipo 6)
 */
function drawChickenFrame(ctx, ox, oy, dir, frame) {
  const step = frame === 1 ? -1 : frame === 3 ? 1 : 0;
  const bob = frame === 1 || frame === 3 ? -1 : 0;

  px(ctx, ox + 5, oy + 14, 6, 1, 'rgba(0,0,0,0.3)');
  // Patitas amarillas
  px(ctx, ox + 6, oy + 12 + (step === -1 ? -1 : 0), 1, 2, '#f2a93b');
  px(ctx, ox + 9, oy + 12 + (step === 1 ? -1 : 0), 1, 2, '#f2a93b');

  // Cuerpo redondeado blanco/crema
  px(ctx, ox + 5, oy + 7 + bob, 6, 5, '#f5efe6');
  px(ctx, ox + 4, oy + 8 + bob, 8, 3, '#ffffff');

  // Cresta roja y pico
  const headX = dir === 2 ? ox + 4 : dir === 3 ? ox + 9 : ox + 6;
  px(ctx, headX, oy + 5 + bob, 3, 3, '#ffffff');
  px(ctx, headX + 1, oy + 3 + bob, 2, 2, '#e63946'); // Cresta

  if (dir === 2) {
    px(ctx, ox + 2, oy + 6 + bob, 2, 1, '#ffb703'); // Pico izq
    px(ctx, ox + 4, oy + 6 + bob, 1, 1, '#1d3557'); // Ojo
  } else if (dir === 3) {
    px(ctx, ox + 12, oy + 6 + bob, 2, 1, '#ffb703'); // Pico der
    px(ctx, ox + 11, oy + 6 + bob, 1, 1, '#1d3557');
  } else if (dir === 0) {
    px(ctx, ox + 7, oy + 7 + bob, 2, 1, '#ffb703');
    px(ctx, ox + 6, oy + 6 + bob, 1, 1, '#1d3557');
    px(ctx, ox + 9, oy + 6 + bob, 1, 1, '#1d3557');
  }
}

/**
 * Dibuja los frames del Perro Pastor (Dog - Arquetipo 7)
 */
function drawDogFrame(ctx, ox, oy, dir, frame) {
  const step = frame === 1 ? -1 : frame === 3 ? 1 : 0;
  const bob = frame === 1 || frame === 3 ? -1 : 0;

  px(ctx, ox + 4, oy + 14, 8, 1, 'rgba(0,0,0,0.32)');
  // Patas
  px(ctx, ox + 4, oy + 11 + (step === -1 ? -1 : 0), 2, 3, '#8c5327');
  px(ctx, ox + 10, oy + 11 + (step === 1 ? -1 : 0), 2, 3, '#8c5327');

  // Cuerpo canela
  px(ctx, ox + 4, oy + 7 + bob, 8, 5, '#ba7338');
  px(ctx, ox + 5, oy + 8 + bob, 6, 3, '#d48b4d');

  // Cabeza y orejas
  if (dir === 2) {
    px(ctx, ox + 2, oy + 4 + bob, 5, 5, '#ba7338');
    px(ctx, ox + 1, oy + 6 + bob, 2, 2, '#3b2313'); // Hocico
    px(ctx, ox + 5, oy + 4 + bob, 2, 3, '#6e3d18'); // Oreja
    px(ctx, ox + 3, oy + 5 + bob, 1, 1, '#141824'); // Ojo
    px(ctx, ox + 12, oy + 5 + bob + step, 2, 3, '#8c5327'); // Cola
  } else if (dir === 3) {
    px(ctx, ox + 9, oy + 4 + bob, 5, 5, '#ba7338');
    px(ctx, ox + 13, oy + 6 + bob, 2, 2, '#3b2313');
    px(ctx, ox + 9, oy + 4 + bob, 2, 3, '#6e3d18');
    px(ctx, ox + 12, oy + 5 + bob, 1, 1, '#141824');
    px(ctx, ox + 2, oy + 5 + bob + step, 2, 3, '#8c5327');
  } else {
    px(ctx, ox + 5, oy + 4 + bob, 6, 5, '#ba7338');
    px(ctx, ox + 4, oy + 4 + bob, 1, 3, '#6e3d18');
    px(ctx, ox + 11, oy + 4 + bob, 1, 3, '#6e3d18');
    if (dir === 0) {
      px(ctx, ox + 6, oy + 6 + bob, 1, 1, '#141824');
      px(ctx, ox + 9, oy + 6 + bob, 1, 1, '#141824');
      px(ctx, ox + 7, oy + 7 + bob, 2, 2, '#f5e6d3');
      px(ctx, ox + 7, oy + 7 + bob, 2, 1, '#2b190e');
    } else {
      px(ctx, ox + 7 + step, oy + 4 + bob, 2, 3, '#8c5327');
    }
  }
}

async function generateCharacterSheet() {
  const humanPalettes = [
    // 0: Hero
    {
      skin: '#f4cca1',
      hair: '#8f4d27',
      tunic: '#1e6f50',
      tunicLight: '#2ea36c',
      belt: '#4b2d1f',
      boots: '#3b2115',
      accent: '#d94141'
    },
    // 1: Elder
    {
      skin: '#f0c296',
      hair: '#d9e2ec',
      tunic: '#2b4c7e',
      tunicLight: '#3e6bae',
      belt: '#7a542e',
      boots: '#2d231e',
      beard: '#e6edf5'
    },
    // 2: Blacksmith
    {
      skin: '#e0a97b',
      hair: '#2b211e',
      tunic: '#5c3828',
      tunicLight: '#7a4b36',
      belt: '#1f1917',
      boots: '#1f1917',
      accent: '#c97a3e'
    },
    // 3: Herbalist
    {
      skin: '#f6d2ad',
      hair: '#b8532a',
      tunic: '#7d3870',
      tunicLight: '#a64d95',
      belt: '#f2c94c',
      boots: '#472836',
      accent: '#f2c94c'
    },
    // 4: Guard
    {
      skin: '#ebbd92',
      hair: '#6e788c',
      tunic: '#4a5568',
      tunicLight: '#718096',
      belt: '#2d3748',
      boots: '#2d3748',
      plume: '#e53e3e',
      accent: '#e53e3e'
    }
  ];

  const totalArchetypes = 12; // 0..8 + 9:HERO_ARMORED + 10:SHADOW_DRONE + 11:SHADOW_KNIGHT
  const cols = 4;
  const rowsPerChar = 4;
  const canvas = document.createElement('canvas');
  canvas.width = cols * TILE_SIZE * ATLAS_SCALE;
  canvas.height = totalArchetypes * rowsPerChar * TILE_SIZE * ATLAS_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(ATLAS_SCALE, ATLAS_SCALE);

  humanPalettes.forEach((palette, charIndex) => {
    for (let dir = 0; dir < 4; dir++) {
      for (let frame = 0; frame < 4; frame++) {
        const ox = frame * TILE_SIZE;
        const oy = (charIndex * rowsPerChar + dir) * TILE_SIZE;
        drawHumanFrame(ctx, ox, oy, dir, frame, palette);
      }
    }
  });

  // 5: Sheep, 6: Chicken, 7: Dog
  for (let dir = 0; dir < 4; dir++) {
    for (let frame = 0; frame < 4; frame++) {
      const ox = frame * TILE_SIZE;
      drawSheepFrame(ctx, ox, (CHARACTER_TYPES.SHEEP * 4 + dir) * TILE_SIZE, dir, frame);
      drawChickenFrame(ctx, ox, (CHARACTER_TYPES.CHICKEN * 4 + dir) * TILE_SIZE, dir, frame);
      drawDogFrame(ctx, ox, (CHARACTER_TYPES.DOG * 4 + dir) * TILE_SIZE, dir, frame);
    }
  }

  // 8: AI_ORACLE (Oráculo Orion con túnica arcana cian/índigo)
  const oraclePalette = {
    skin: '#e8d7ff',
    hair: '#4cc9f0',
    tunic: '#3a0ca3',
    tunicLight: '#4361ee',
    belt: '#f72585',
    boots: '#240046',
    plume: '#4cc9f0',
    accent: '#4cc9f0'
  };
  for (let dir = 0; dir < 4; dir++) {
    for (let frame = 0; frame < 4; frame++) {
      const ox = frame * TILE_SIZE;
      const oy = (CHARACTER_TYPES.AI_ORACLE * rowsPerChar + dir) * TILE_SIZE;
      drawHumanFrame(ctx, ox, oy, dir, frame, oraclePalette);
    }
  }

  // 9: HERO_ARMORED (Héroe equipado con la Armadura del Alba)
  const armoredHeroPalette = {
    skin: '#f4cca1',
    hair: '#8f4d27',
    tunic: '#94a3b8',
    tunicLight: '#e2e8f0',
    belt: '#d97706',
    boots: '#475569',
    plume: '#ffd166',
    accent: '#10b981'
  };
  for (let dir = 0; dir < 4; dir++) {
    for (let frame = 0; frame < 4; frame++) {
      const ox = frame * TILE_SIZE;
      const oy = (CHARACTER_TYPES.HERO_ARMORED * rowsPerChar + dir) * TILE_SIZE;
      drawHumanFrame(ctx, ox, oy, dir, frame, armoredHeroPalette);
      // Hombreras doradas y emblema del pecho
      const bob = frame === 1 || frame === 3 ? -1 : 0;
      px(ctx, ox + 3, oy + 7 + bob, 2, 2, '#fbbf24');
      px(ctx, ox + 11, oy + 7 + bob, 2, 2, '#fbbf24');
      px(ctx, ox + 7, oy + 8 + bob, 2, 2, '#10b981');
    }
  }

  // 10: SHADOW_DRONE (Dron Sombrío de Mister AI Alex)
  for (let dir = 0; dir < 4; dir++) {
    for (let frame = 0; frame < 4; frame++) {
      const ox = frame * TILE_SIZE;
      const oy = (CHARACTER_TYPES.SHADOW_DRONE * rowsPerChar + dir) * TILE_SIZE;
      const hover = frame === 1 ? -1 : frame === 3 ? 1 : 0;
      px(ctx, ox + 4, oy + 14, 8, 2, 'rgba(124, 58, 237, 0.38)');
      // Cuerpo esférico oscuro cibernético
      px(ctx, ox + 3, oy + 4 + hover, 10, 8, '#1e1b4b');
      px(ctx, ox + 4, oy + 3 + hover, 8, 10, '#312e81');
      // Anillo de energía carmesí de AI Alex
      px(ctx, ox + 2, oy + 7 + hover, 12, 2, '#7f1d1d');
      // Ojo cibernético omnipotente
      const eyeShift = dir === 2 ? -1 : dir === 3 ? 1 : 0;
      px(ctx, ox + 6 + eyeShift, oy + 6 + hover, 4, 4, '#ef4444');
      px(ctx, ox + 7 + eyeShift, oy + 7 + hover, 2, 2, '#fef08a');
      // Tentáculos de datos oscuros
      px(ctx, ox + 5, oy + 12 + hover, 2, 2, '#4c1d95');
      px(ctx, ox + 9, oy + 12 + hover, 2, 2, '#4c1d95');
    }
  }

  // 11: SHADOW_KNIGHT (Caballero de las Tinieblas de Mister AI Alex)
  const shadowKnightPalette = {
    skin: '#1e1b4b',
    hair: '#0f172a',
    tunic: '#1e1b4b',
    tunicLight: '#312e81',
    belt: '#991b1b',
    boots: '#0f172a',
    plume: '#ef4444',
    accent: '#ef4444'
  };
  for (let dir = 0; dir < 4; dir++) {
    for (let frame = 0; frame < 4; frame++) {
      const ox = frame * TILE_SIZE;
      const oy = (CHARACTER_TYPES.SHADOW_KNIGHT * rowsPerChar + dir) * TILE_SIZE;
      drawHumanFrame(ctx, ox, oy, dir, frame, shadowKnightPalette);
      const bob = frame === 1 || frame === 3 ? -1 : 0;
      // Visor láser rojo de AI Alex
      px(ctx, ox + 5, oy + 4 + bob, 6, 2, '#ff2a55');
      px(ctx, ox + 6, oy + 4 + bob, 4, 1, '#ffffff');
    }
  }

  return canvasToImage(canvas);
}

async function generateTilesetSheet() {
  const cols = 8;
  const rows = 7;
  const canvas = document.createElement('canvas');
  canvas.width = cols * TILE_SIZE * ATLAS_SCALE;
  canvas.height = rows * TILE_SIZE * ATLAS_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(ATLAS_SCALE, ATLAS_SCALE);

  const cellOrigin = (id) => ({
    ox: (id % cols) * TILE_SIZE,
    oy: Math.floor(id / cols) * TILE_SIZE
  });

  const fillGrass = (ox, oy, variant = 0) => {
    px(ctx, ox, oy, 16, 16, '#3f7d3c');
    px(ctx, ox + 2, oy + 3, 2, 1, '#4f9649');
    px(ctx, ox + 10, oy + 7, 2, 1, '#4f9649');
    px(ctx, ox + 5, oy + 12, 2, 1, '#326630');
    if (variant === 1) {
      px(ctx, ox + 3, oy + 8, 1, 2, '#5cb054');
      px(ctx, ox + 4, oy + 9, 1, 1, '#5cb054');
      px(ctx, ox + 12, oy + 3, 1, 2, '#5cb054');
      px(ctx, ox + 11, oy + 13, 2, 1, '#326630');
    }
  };

  {
    const { ox, oy } = cellOrigin(TILES.GRASS_1);
    fillGrass(ox, oy, 0);
  }
  {
    const { ox, oy } = cellOrigin(TILES.GRASS_2);
    fillGrass(ox, oy, 1);
  }
  {
    const { ox, oy } = cellOrigin(TILES.PATH);
    px(ctx, ox, oy, 16, 16, '#b88b5a');
    px(ctx, ox + 2, oy + 2, 3, 2, '#a37748');
    px(ctx, ox + 10, oy + 5, 2, 2, '#c99e6e');
    px(ctx, ox + 5, oy + 11, 3, 2, '#a37748');
    px(ctx, ox + 12, oy + 13, 2, 1, '#8c6238');
  }
  {
    const { ox, oy } = cellOrigin(TILES.COBBLE);
    px(ctx, ox, oy, 16, 16, '#6f7987');
    const stones = [
      [1, 1, 6, 6], [8, 1, 7, 6],
      [1, 8, 4, 7], [6, 8, 5, 7], [12, 8, 3, 7]
    ];
    for (const [sx, sy, sw, sh] of stones) {
      px(ctx, ox + sx, oy + sy, sw, sh, '#8b95a5');
      px(ctx, ox + sx, oy + sy, sw - 1, 1, '#a3adbd');
    }
  }
  [TILES.WATER_1, TILES.WATER_2].forEach((id, idx) => {
    const { ox, oy } = cellOrigin(id);
    px(ctx, ox, oy, 16, 16, '#286494');
    const shift = idx * 3;
    px(ctx, ox + ((2 + shift) % 13), oy + 4, 4, 1, '#4ca0d9');
    px(ctx, ox + ((8 - shift + 13) % 13), oy + 10, 5, 1, '#4ca0d9');
    px(ctx, ox + ((5 + shift) % 13), oy + 14, 3, 1, '#1e4c73');
  });
  {
    const { ox, oy } = cellOrigin(TILES.BRIDGE);
    px(ctx, ox, oy, 16, 16, '#7d4e2d');
    for (let y = 0; y < 16; y += 4) {
      px(ctx, ox, oy + y, 16, 3, '#96613b');
      px(ctx, ox, oy + y + 3, 16, 1, '#54321b');
    }
    px(ctx, ox, oy, 2, 16, '#5e3920');
    px(ctx, ox + 14, oy, 2, 16, '#5e3920');
  }
  [TILES.FLOWERS_1, TILES.FLOWERS_2].forEach((id, idx) => {
    const { ox, oy } = cellOrigin(id);
    const sway = idx === 1 ? 1 : 0;
    px(ctx, ox + 3 + sway, oy + 5, 2, 3, '#2d592b');
    px(ctx, ox + 10 + sway, oy + 10, 2, 3, '#2d592b');
    px(ctx, ox + 3 + sway, oy + 4, 3, 3, '#e84a5f');
    px(ctx, ox + 4 + sway, oy + 5, 1, 1, '#ffd166');
    px(ctx, ox + 10 + sway, oy + 9, 3, 3, '#ffd166');
    px(ctx, ox + 11 + sway, oy + 10, 1, 1, '#ffffff');
  });
  {
    const { ox, oy } = cellOrigin(TILES.TREE_TOP);
    px(ctx, ox + 2, oy + 1, 12, 14, '#1f4d28');
    px(ctx, ox + 1, oy + 3, 14, 10, '#2a6634');
    px(ctx, ox + 3, oy + 2, 10, 8, '#398544');
    px(ctx, ox + 4, oy + 3, 6, 4, '#4da158');
  }
  {
    const { ox, oy } = cellOrigin(TILES.TREE_TRUNK);
    px(ctx, ox + 3, oy + 12, 10, 3, 'rgba(0,0,0,0.3)');
    px(ctx, ox + 5, oy + 5, 6, 9, '#5e3a24');
    px(ctx, ox + 6, oy + 5, 2, 8, '#784c31');
    px(ctx, ox + 1, oy, 14, 7, '#1f4d28');
    px(ctx, ox + 2, oy, 12, 5, '#2a6634');
    px(ctx, ox + 4, oy, 8, 3, '#398544');
  }
  {
    const { ox, oy } = cellOrigin(TILES.ROOF_RED);
    px(ctx, ox, oy, 16, 16, '#8f2d2d');
    for (let y = 0; y < 16; y += 4) {
      px(ctx, ox, oy + y, 16, 3, '#b03a3a');
      px(ctx, ox, oy + y, 16, 1, '#c94c4c');
    }
  }
  {
    const { ox, oy } = cellOrigin(TILES.ROOF_BLUE);
    px(ctx, ox, oy, 16, 16, '#2b4466');
    for (let y = 0; y < 16; y += 4) {
      px(ctx, ox, oy + y, 16, 3, '#385985');
      px(ctx, ox, oy + y, 16, 1, '#4c74ab');
    }
  }
  {
    const { ox, oy } = cellOrigin(TILES.WALL_WOOD);
    px(ctx, ox, oy, 16, 16, '#dfd3c3');
    px(ctx, ox, oy, 2, 16, '#5c3d28');
    px(ctx, ox + 14, oy, 2, 16, '#5c3d28');
    px(ctx, ox, oy, 16, 2, '#5c3d28');
    px(ctx, ox, oy + 13, 16, 3, '#6e737b');
  }
  {
    const { ox, oy } = cellOrigin(TILES.WALL_WINDOW);
    px(ctx, ox, oy, 16, 16, '#dfd3c3');
    px(ctx, ox, oy, 16, 2, '#5c3d28');
    px(ctx, ox, oy + 13, 16, 3, '#6e737b');
    px(ctx, ox + 4, oy + 4, 8, 7, '#4a3020');
    px(ctx, ox + 5, oy + 5, 6, 5, '#f6c967');
    px(ctx, ox + 7, oy + 5, 1, 5, '#4a3020');
    px(ctx, ox + 5, oy + 7, 6, 1, '#4a3020');
  }
  {
    const { ox, oy } = cellOrigin(TILES.WALL_DOOR);
    px(ctx, ox, oy, 16, 16, '#dfd3c3');
    px(ctx, ox, oy, 16, 2, '#5c3d28');
    px(ctx, ox, oy + 13, 16, 3, '#6e737b');
    px(ctx, ox + 3, oy + 3, 10, 13, '#4a2c18');
    px(ctx, ox + 4, oy + 4, 8, 12, '#7c4a2b');
    px(ctx, ox + 10, oy + 10, 1, 2, '#ffd166');
  }
  {
    const { ox, oy } = cellOrigin(TILES.FENCE_H);
    px(ctx, ox, oy + 6, 16, 2, '#8c5834');
    px(ctx, ox, oy + 10, 16, 2, '#734627');
    px(ctx, ox + 2, oy + 4, 3, 10, '#9e663f');
    px(ctx, ox + 11, oy + 4, 3, 10, '#9e663f');
  }
  {
    const { ox, oy } = cellOrigin(TILES.FENCE_POST);
    px(ctx, ox + 5, oy + 4, 6, 10, '#8c5834');
    px(ctx, ox + 6, oy + 3, 4, 9, '#a86e44');
  }
  {
    const { ox, oy } = cellOrigin(TILES.LAMPPOST);
    px(ctx, ox + 5, oy + 14, 6, 2, 'rgba(0,0,0,0.35)');
    px(ctx, ox + 7, oy + 5, 2, 10, '#2c3545');
    px(ctx, ox + 6, oy + 13, 4, 2, '#1f2633');
    px(ctx, ox + 5, oy + 1, 6, 5, '#1f2633');
    px(ctx, ox + 6, oy + 2, 4, 3, '#ffe373');
    px(ctx, ox + 7, oy + 2, 2, 2, '#ffffff');
  }
  {
    const { ox, oy } = cellOrigin(TILES.WELL);
    px(ctx, ox + 2, oy + 6, 12, 9, '#555e6b');
    px(ctx, ox + 3, oy + 7, 10, 6, '#747f8f');
    px(ctx, ox + 4, oy + 8, 8, 3, '#1e4c73');
    px(ctx, ox + 3, oy + 2, 2, 6, '#6e4226');
    px(ctx, ox + 11, oy + 2, 2, 6, '#6e4226');
    px(ctx, ox + 1, oy + 1, 14, 3, '#8f2d2d');
    px(ctx, ox + 2, oy, 12, 2, '#b03a3a');
  }
  {
    const { ox, oy } = cellOrigin(TILES.SIGNPOST);
    px(ctx, ox + 7, oy + 9, 2, 6, '#5e3a24');
    px(ctx, ox + 3, oy + 3, 10, 6, '#8c5834');
    px(ctx, ox + 4, oy + 4, 8, 4, '#b5784a');
    px(ctx, ox + 5, oy + 5, 6, 1, '#4a2c18');
    px(ctx, ox + 5, oy + 7, 4, 1, '#4a2c18');
  }
  {
    const { ox, oy } = cellOrigin(TILES.CRATE);
    px(ctx, ox + 3, oy + 4, 10, 10, '#6e4226');
    px(ctx, ox + 4, oy + 5, 8, 8, '#996039');
    px(ctx, ox + 4, oy + 8, 8, 2, '#6e4226');
  }
  {
    const { ox, oy } = cellOrigin(TILES.BUSH);
    px(ctx, ox + 2, oy + 5, 12, 9, '#23592c');
    px(ctx, ox + 3, oy + 4, 10, 8, '#327a3d');
    px(ctx, ox + 5, oy + 5, 6, 4, '#479c53');
    px(ctx, ox + 5, oy + 7, 1, 1, '#ff6b6b');
    px(ctx, ox + 10, oy + 9, 1, 1, '#ff6b6b');
  }
  {
    const { ox, oy } = cellOrigin(TILES.ANVIL);
    px(ctx, ox + 4, oy + 10, 8, 4, '#4a3020');
    px(ctx, ox + 5, oy + 8, 6, 3, '#3b4252');
    px(ctx, ox + 2, oy + 5, 12, 3, '#4c566a');
    px(ctx, ox + 3, oy + 5, 9, 1, '#81a1c1');
  }
  // 24: BRIDGE_GATE (Barrera nocturna del puente)
  {
    const { ox, oy } = cellOrigin(TILES.BRIDGE_GATE);
    px(ctx, ox + 1, oy + 2, 3, 13, '#4a2c18');
    px(ctx, ox + 12, oy + 2, 3, 13, '#4a2c18');
    px(ctx, ox, oy + 5, 16, 3, '#9e3b33');
    px(ctx, ox + 2, oy + 5, 4, 3, '#f2d06b');
    px(ctx, ox + 10, oy + 5, 4, 3, '#f2d06b');
    px(ctx, ox, oy + 10, 16, 2, '#6e4226');
  }
  // 25: FLOOR_WOOD (Suelo de madera interior)
  {
    const { ox, oy } = cellOrigin(TILES.FLOOR_WOOD);
    px(ctx, ox, oy, 16, 16, '#8f5d38');
    for (let y = 0; y < 16; y += 4) {
      px(ctx, ox, oy + y, 16, 3, '#a46d44');
      px(ctx, ox + ((y * 3) % 12), oy + y, 1, 3, '#754929');
    }
  }
  // 26: WALL_INTERIOR (Muro interior de vivienda)
  {
    const { ox, oy } = cellOrigin(TILES.WALL_INTERIOR);
    px(ctx, ox, oy, 16, 16, '#3b324a');
    px(ctx, ox, oy, 16, 4, '#251f30');
    px(ctx, ox + 2, oy + 6, 12, 6, '#524666');
    px(ctx, ox, oy + 13, 16, 3, '#5c3d28');
  }
  // 27: RUG_RED (Alfombra interior)
  {
    const { ox, oy } = cellOrigin(TILES.RUG_RED);
    px(ctx, ox, oy, 16, 16, '#8f2d38');
    px(ctx, ox + 1, oy + 1, 14, 14, '#b83b48');
    px(ctx, ox + 3, oy + 3, 10, 10, '#d99b4e');
    px(ctx, ox + 4, oy + 4, 8, 8, '#9e2a36');
  }
  // 28: TABLE (Mesa de madera interior)
  {
    const { ox, oy } = cellOrigin(TILES.TABLE);
    px(ctx, ox + 2, oy + 3, 12, 9, '#5c3820');
    px(ctx, ox + 3, oy + 4, 10, 7, '#875534');
    px(ctx, ox + 3, oy + 12, 2, 3, '#472a17');
    px(ctx, ox + 11, oy + 12, 2, 3, '#472a17');
  }
  // 29: BOOKSHELF (Estantería de libros)
  {
    const { ox, oy } = cellOrigin(TILES.BOOKSHELF);
    px(ctx, ox + 1, oy + 1, 14, 15, '#4a2c18');
    px(ctx, ox + 2, oy + 2, 12, 5, '#2b190e');
    px(ctx, ox + 3, oy + 3, 2, 4, '#e63946');
    px(ctx, ox + 6, oy + 3, 2, 4, '#457b9d');
    px(ctx, ox + 9, oy + 3, 3, 4, '#e9c46a');
    px(ctx, ox + 2, oy + 9, 12, 5, '#2b190e');
    px(ctx, ox + 3, oy + 10, 3, 4, '#2a9d8f');
    px(ctx, ox + 7, oy + 10, 2, 4, '#f4a261');
    px(ctx, ox + 10, oy + 10, 3, 4, '#a8dadc');
  }
  // 30: BED (Cama)
  {
    const { ox, oy } = cellOrigin(TILES.BED);
    px(ctx, ox + 2, oy + 1, 12, 14, '#5c3820');
    px(ctx, ox + 3, oy + 2, 10, 4, '#f0f4f8'); // Almohada
    px(ctx, ox + 3, oy + 6, 10, 8, '#3b6ea5'); // Manta
    px(ctx, ox + 3, oy + 6, 10, 2, '#588ec7');
  }
  // 31: FIREPLACE (Chimenea encendida)
  {
    const { ox, oy } = cellOrigin(TILES.FIREPLACE);
    px(ctx, ox + 1, oy + 1, 14, 15, '#596270');
    px(ctx, ox + 2, oy + 2, 12, 13, '#737d8c');
    px(ctx, ox + 4, oy + 6, 8, 9, '#1c1f26');
    px(ctx, ox + 5, oy + 9, 6, 5, '#ff6b35');
    px(ctx, ox + 6, oy + 10, 4, 4, '#ffd166');
  }
  // 32: EXIT_MAT (Felpudo de salida de la vivienda)
  {
    const { ox, oy } = cellOrigin(TILES.EXIT_MAT);
    px(ctx, ox + 2, oy + 4, 12, 10, '#6e472b');
    px(ctx, ox + 3, oy + 5, 10, 8, '#b57c4e');
    px(ctx, ox + 6, oy + 8, 4, 3, '#ffd166');
  }
  // 33 & 34: CHEST_CLOSED / CHEST_OPEN
  {
    const { ox, oy } = cellOrigin(TILES.CHEST_CLOSED);
    px(ctx, ox + 3, oy + 4, 10, 10, '#4a2c18');
    px(ctx, ox + 4, oy + 5, 8, 8, '#9c5a2b');
    px(ctx, ox + 3, oy + 8, 10, 2, '#d4a338');
    px(ctx, ox + 7, oy + 8, 2, 3, '#ffe373');
  }
  {
    const { ox, oy } = cellOrigin(TILES.CHEST_OPEN);
    px(ctx, ox + 3, oy + 3, 10, 4, '#754320');
    px(ctx, ox + 3, oy + 7, 10, 7, '#24150b');
    px(ctx, ox + 4, oy + 9, 8, 4, '#9c5a2b');
  }
  // 35: JAIL_BARS (Barrotes de hierro de la cárcel del pueblo)
  {
    const { ox, oy } = cellOrigin(TILES.JAIL_BARS);
    px(ctx, ox, oy + 2, 16, 2, '#2b303c');
    px(ctx, ox, oy + 12, 16, 2, '#2b303c');
    for (let x = 2; x <= 14; x += 4) {
      px(ctx, ox + x, oy, 2, 16, '#4c566a');
      px(ctx, ox + x, oy, 1, 16, '#81a1c1');
    }
  }
  // 36: STONE_FLOOR (Suelo frío de piedra del calabozo)
  {
    const { ox, oy } = cellOrigin(TILES.STONE_FLOOR);
    px(ctx, ox, oy, 16, 16, '#3b4252');
    px(ctx, ox + 1, oy + 1, 6, 6, '#434c5e');
    px(ctx, ox + 8, oy + 1, 7, 6, '#4c566a');
    px(ctx, ox + 1, oy + 8, 8, 7, '#4c566a');
    px(ctx, ox + 10, oy + 8, 5, 7, '#434c5e');
  }
  // 37: ALTAR_PEDESTAL (Pedestal sagrado para el arma y la armadura)
  {
    const { ox, oy } = cellOrigin(TILES.ALTAR_PEDESTAL);
    px(ctx, ox, oy, 16, 16, '#6f7987');
    px(ctx, ox + 1, oy + 10, 14, 5, '#475569');
    px(ctx, ox + 2, oy + 5, 12, 6, '#94a3b8');
    px(ctx, ox + 3, oy + 4, 10, 3, '#cbd5e1');
    px(ctx, ox + 5, oy + 6, 6, 2, '#fbbf24');
  }
  // 38: PORTAL_GATE_CLOSED (Barrera arcana hacia Valleverde cerrada)
  {
    const { ox, oy } = cellOrigin(TILES.PORTAL_GATE_CLOSED);
    px(ctx, ox + 1, oy + 1, 3, 14, '#312e81');
    px(ctx, ox + 12, oy + 1, 3, 14, '#312e81');
    px(ctx, ox + 4, oy + 4, 8, 8, 'rgba(239, 68, 68, 0.78)');
    px(ctx, ox + 6, oy + 6, 4, 4, '#fef08a');
  }
  // 39: PORTAL_GATE_OPEN (Arco sagrado abierto hacia Valleverde)
  {
    const { ox, oy } = cellOrigin(TILES.PORTAL_GATE_OPEN);
    px(ctx, ox, oy, 16, 16, '#b88b5a');
    px(ctx, ox + 1, oy + 1, 2, 14, '#fbbf24');
    px(ctx, ox + 13, oy + 1, 2, 14, '#fbbf24');
    px(ctx, ox + 5, oy + 6, 6, 4, 'rgba(52, 211, 153, 0.45)');
  }

  // 40: SEWER_SLIME_FLOOR (Fango y rejilla de las Cloacas del Legacy)
  {
    const { ox, oy } = cellOrigin(TILES.SEWER_SLIME_FLOOR);
    px(ctx, ox, oy, 16, 16, '#0f2416');
    px(ctx, ox + 1, oy + 2, 6, 5, '#163d23');
    px(ctx, ox + 8, oy + 7, 7, 6, '#13331d');
    px(ctx, ox + 3, oy + 10, 4, 3, '#10b981');
    px(ctx, ox + 11, oy + 3, 3, 2, '#34d399');
    // Rejilla de hierro corrosiva
    px(ctx, ox, oy + 7, 16, 1, '#1e293b');
    px(ctx, ox + 7, oy, 1, 16, '#1e293b');
  }
  // 41: SEWER_PIPE_WALL (Pared de tuberías de fango)
  {
    const { ox, oy } = cellOrigin(TILES.SEWER_PIPE_WALL);
    px(ctx, ox, oy, 16, 16, '#1a1f1a');
    px(ctx, ox, oy + 3, 16, 6, '#475569'); // Tubería metálica
    px(ctx, ox, oy + 4, 16, 4, '#64748b');
    px(ctx, ox + 4, oy + 2, 3, 8, '#334155'); // Abrazadera
    px(ctx, ox + 11, oy + 2, 3, 8, '#334155');
    px(ctx, ox + 5, oy + 9, 2, 4, '#10b981'); // Gota de ácido verde
    px(ctx, ox + 12, oy + 9, 1, 3, '#059669');
  }
  // 42: MINE_CRYSTAL_FLOOR (Suelo de silicio de las Minas de la Recursión)
  {
    const { ox, oy } = cellOrigin(TILES.MINE_CRYSTAL_FLOOR);
    px(ctx, ox, oy, 16, 16, '#181528');
    px(ctx, ox + 2, oy + 3, 5, 4, '#241e3d');
    px(ctx, ox + 9, oy + 8, 6, 5, '#2e274e');
    px(ctx, ox + 5, oy + 4, 3, 2, '#818cf8'); // Veta luminiscente de silicio
    px(ctx, ox + 12, oy + 11, 2, 3, '#38bdf8');
  }
  // 43: MINE_CHASM (Gran Abismo que exige Dash Asíncrono)
  {
    const { ox, oy } = cellOrigin(TILES.MINE_CHASM);
    px(ctx, ox, oy, 16, 16, '#03050a'); // Vacío abisal
    px(ctx, ox + 2, oy, 12, 2, '#0f172a');
    px(ctx, ox + 1, oy + 1, 14, 1, '#1e1b4b');
    px(ctx, ox + 5, oy + 12, 1, 1, '#818cf8'); // Partícula de estática
  }
  // 44: MINE_CRYSTAL_WALL (Pared cavernosa de prisma de cristal)
  {
    const { ox, oy } = cellOrigin(TILES.MINE_CRYSTAL_WALL);
    px(ctx, ox, oy, 16, 16, '#130d24');
    px(ctx, ox + 2, oy + 2, 12, 12, '#21173d');
    px(ctx, ox + 4, oy + 3, 4, 8, '#6366f1'); // Racimo de cristal
    px(ctx, ox + 8, oy + 5, 4, 6, '#a855f7');
    px(ctx, ox + 5, oy + 4, 2, 3, '#c084fc');
    px(ctx, ox + 6, oy + 5, 1, 1, '#ffffff'); // Reflejo
  }
  // 45: FORGE_LAVA_FLOOR (Rejilla sobre magma ardiente)
  {
    const { ox, oy } = cellOrigin(TILES.FORGE_LAVA_FLOOR);
    px(ctx, ox, oy, 16, 16, '#450a0a'); // Magma profundo
    px(ctx, ox + 1, oy + 1, 14, 14, '#b91c1c');
    px(ctx, ox + 4, oy + 4, 8, 8, '#f97316');
    px(ctx, ox + 6, oy + 6, 4, 4, '#fde047'); // Núcleo ígneo
    // Rejilla de hierro fundido
    px(ctx, ox, oy + 7, 16, 2, '#1c1917');
    px(ctx, ox + 7, oy, 2, 16, '#1c1917');
  }
  // 46: FORGE_BOILER_WALL (Caldera de bronce y vapor a presión)
  {
    const { ox, oy } = cellOrigin(TILES.FORGE_BOILER_WALL);
    px(ctx, ox, oy, 16, 16, '#1c1917');
    px(ctx, ox + 1, oy + 1, 14, 14, '#78350f'); // Cobre/bronce
    px(ctx, ox + 3, oy + 3, 10, 8, '#92400e');
    px(ctx, ox + 5, oy + 5, 6, 4, '#b45309');
    px(ctx, ox + 7, oy + 6, 2, 2, '#fde047'); // Indicador de presión
    px(ctx, ox + 2, oy + 12, 12, 2, '#451a03');
  }
  // 47: MAINFRAME_FLOOR (Suelo del Servidor Cuántico: rejilla metálica oscura y fibra óptica)
  {
    const { ox, oy } = cellOrigin(TILES.MAINFRAME_FLOOR);
    px(ctx, ox, oy, 16, 16, '#0b0f19'); // Metal oscuro mate
    px(ctx, ox + 1, oy + 1, 14, 14, '#111827');
    // Cables de fibra óptica neón
    px(ctx, ox, oy + 7, 16, 1, '#06b6d4'); // Bus cian
    px(ctx, ox + 7, oy, 1, 16, '#3b82f6'); // Bus azul
    px(ctx, ox + 7, oy + 7, 2, 2, '#ec4899'); // Nodo cuántico magenta
  }
  // 48: MAINFRAME_WALL (Racks de Servidores Cuánticos de Mister AI Alex)
  {
    const { ox, oy } = cellOrigin(TILES.MAINFRAME_WALL);
    px(ctx, ox, oy, 16, 16, '#030712'); // Bastidor de titanio
    px(ctx, ox + 1, oy + 1, 14, 4, '#1f2937'); // Blade server 1
    px(ctx, ox + 1, oy + 6, 14, 4, '#1f2937'); // Blade server 2
    px(ctx, ox + 1, oy + 11, 14, 4, '#1f2937'); // Blade server 3
    // Matriz de LEDs titilantes de procesamiento
    px(ctx, ox + 3, oy + 2, 2, 1, '#10b981');
    px(ctx, ox + 6, oy + 2, 2, 1, '#06b6d4');
    px(ctx, ox + 10, oy + 2, 3, 1, '#3b82f6');
    px(ctx, ox + 3, oy + 7, 2, 1, '#f43f5e');
    px(ctx, ox + 6, oy + 7, 2, 1, '#10b981');
    px(ctx, ox + 10, oy + 7, 3, 1, '#06b6d4');
    px(ctx, ox + 3, oy + 12, 2, 1, '#3b82f6');
    px(ctx, ox + 6, oy + 12, 2, 1, '#ec4899');
  }
  // 49: CRYSTAL_BARRIER (Barrera de cristal de silicio quebrable con Espada Nivel 2)
  {
    const { ox, oy } = cellOrigin(TILES.CRYSTAL_BARRIER);
    px(ctx, ox + 2, oy + 1, 12, 14, '#1e1b4b');
    px(ctx, ox + 3, oy + 2, 10, 12, 'rgba(99, 102, 241, 0.85)');
    px(ctx, ox + 5, oy + 4, 6, 8, '#a5b4fc');
    px(ctx, ox + 7, oy + 5, 2, 4, '#ffffff'); // Reflejo
  }
  // 50: CORE_PEDESTAL (Pedestal de Núcleo Cuántico para abrir la Ciudadela)
  {
    const { ox, oy } = cellOrigin(TILES.CORE_PEDESTAL);
    px(ctx, ox + 1, oy + 2, 14, 13, '#1f2937');
    px(ctx, ox + 2, oy + 3, 12, 10, '#374151');
    px(ctx, ox + 4, oy + 5, 8, 6, '#111827');
    px(ctx, ox + 6, oy + 7, 4, 3, '#6366f1'); // Resplandor de sincronización
  }

  return canvasToImage(canvas);
}

/**
 * Genera el spritesheet de objetos (Items 16x16 en alta densidad) para el suelo y el Inventario.
 */
async function generateItemsSheet() {
  const count = 18;
  const canvas = document.createElement('canvas');
  canvas.width = count * TILE_SIZE * ATLAS_SCALE;
  canvas.height = TILE_SIZE * ATLAS_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(ATLAS_SCALE, ATLAS_SCALE);

  // 0: POTION (Poción de Hierbas)
  {
    const ox = ITEM_ICONS.POTION * 16;
    px(ctx, ox + 6, oy(3), 4, 2, '#b5784a');
    px(ctx, ox + 5, oy(5), 6, 2, '#a8dadc');
    px(ctx, ox + 4, oy(7), 8, 6, '#2ec4b6');
    px(ctx, ox + 5, oy(8), 2, 3, '#cbf3f0');
  }
  // 1: BREAD (Pan Campesino)
  {
    const ox = ITEM_ICONS.BREAD * 16;
    px(ctx, ox + 3, oy(6), 10, 6, '#9c5a2b');
    px(ctx, ox + 4, oy(5), 8, 6, '#d98a46');
    px(ctx, ox + 5, oy(6), 2, 2, '#f4cca1');
    px(ctx, ox + 9, oy(6), 2, 2, '#f4cca1');
  }
  // 2: WHEAT (Trigo Fresco para los animales)
  {
    const ox = ITEM_ICONS.WHEAT * 16;
    px(ctx, ox + 6, oy(10), 4, 4, '#8c5834');
    px(ctx, ox + 5, oy(4), 6, 7, '#f2c94c');
    px(ctx, ox + 4, oy(5), 8, 4, '#ffe373');
    px(ctx, ox + 6, oy(9), 4, 1, '#c94c4c');
  }
  // 3: LANTERN (Farol de Mano)
  {
    const ox = ITEM_ICONS.LANTERN * 16;
    px(ctx, ox + 6, oy(2), 4, 2, '#3b4252');
    px(ctx, ox + 5, oy(4), 6, 8, '#2e3440');
    px(ctx, ox + 6, oy(5), 4, 6, '#ffe373');
    px(ctx, ox + 7, oy(6), 2, 4, '#ffffff');
    px(ctx, ox + 4, oy(12), 8, 2, '#3b4252');
  }
  // 4: BRIDGE_PASS (Pase Real del Puente)
  {
    const ox = ITEM_ICONS.BRIDGE_PASS * 16;
    px(ctx, ox + 3, oy(3), 10, 10, '#f5e6c8');
    px(ctx, ox + 4, oy(4), 8, 8, '#fff7e6');
    px(ctx, ox + 5, oy(5), 6, 1, '#5c3d28');
    px(ctx, ox + 5, oy(7), 5, 1, '#5c3d28');
    px(ctx, ox + 8, oy(9), 3, 3, '#e63946'); // Sello lacrado
  }
  // 5: GOLDEN_APPLE (Manzana Dorada)
  {
    const ox = ITEM_ICONS.GOLDEN_APPLE * 16;
    px(ctx, ox + 7, oy(3), 2, 2, '#5c3d28');
    px(ctx, ox + 9, oy(3), 2, 2, '#4da158');
    px(ctx, ox + 4, oy(5), 8, 8, '#f59f00');
    px(ctx, ox + 5, oy(6), 6, 6, '#ffd43b');
    px(ctx, ox + 5, oy(6), 2, 2, '#fff9db');
  }
  // 6: ARMOR (Armadura del Alba)
  {
    const ox = ITEM_ICONS.ARMOR * 16;
    px(ctx, ox + 2, oy(3), 12, 4, '#fbbf24'); // Hombreras doradas
    px(ctx, ox + 4, oy(4), 8, 9, '#94a3b8');  // Peto de acero
    px(ctx, ox + 5, oy(5), 6, 7, '#e2e8f0');  // Brillo frontal
    px(ctx, ox + 7, oy(6), 2, 3, '#10b981');  // Gema esmeralda del Alba
    px(ctx, ox + 4, oy(11), 8, 2, '#d97706'); // Cinturón real
  }
  // 7: SWORD (Espada del Alba - Primera Arma)
  {
    const ox = ITEM_ICONS.SWORD * 16;
    px(ctx, ox + 7, oy(1), 2, 9, '#e2e8f0');  // Hoja reluciente
    px(ctx, ox + 7, oy(2), 1, 7, '#ffffff');  // Filo de luz
    px(ctx, ox + 4, oy(10), 8, 2, '#fbbf24'); // Guarda dorada
    px(ctx, ox + 7, oy(10), 2, 2, '#38bdf8'); // Gema en la cruz
    px(ctx, ox + 7, oy(12), 2, 3, '#92400e'); // Empuñadura
    px(ctx, ox + 6, oy(14), 4, 1, '#fbbf24'); // Pomo
  }
  // 8: ABYSSAL_POINTER (Puntero al Abismo - Cristal Rúnico Violeta)
  {
    const ox = ITEM_ICONS.ABYSSAL_POINTER * 16;
    px(ctx, ox + 7, oy(1), 2, 2, '#e9d5ff'); // Vértice superior radiante
    px(ctx, ox + 6, oy(3), 4, 3, '#c084fc'); // Faceta superior
    px(ctx, ox + 5, oy(6), 6, 4, '#9333ea'); // Cuerpo principal del cristal
    px(ctx, ox + 6, oy(10), 4, 3, '#7e22ce'); // Base geométrica cónica
    px(ctx, ox + 7, oy(13), 2, 2, '#581c87'); // Vértice inferior
    // Runa etérea central
    px(ctx, ox + 7, oy(5), 2, 4, '#f5d0fe');
    px(ctx, ox + 6, oy(7), 4, 1, '#ffffff');
    // Chispas de energía del vacío
    px(ctx, ox + 3, oy(4), 1, 1, '#d8b4fe');
    px(ctx, ox + 12, oy(8), 1, 1, '#c084fc');
    px(ctx, ox + 4, oy(11), 1, 1, '#e9d5ff');
  }
  // 9: SILICON_FLOWER (Flor de Silicio bioluminiscente de noche)
  {
    const ox = ITEM_ICONS.SILICON_FLOWER * 16;
    // Tallo y hojas de circuito
    px(ctx, ox + 7, oy(10), 2, 5, '#0f766e');
    px(ctx, ox + 5, oy(12), 2, 2, '#14b8a6');
    px(ctx, ox + 9, oy(11), 2, 2, '#14b8a6');
    // Pétalos de silicio cian neón
    px(ctx, ox + 6, oy(4), 4, 3, '#38bdf8');
    px(ctx, ox + 4, oy(6), 3, 4, '#06b6d4');
    px(ctx, ox + 9, oy(6), 3, 4, '#06b6d4');
    px(ctx, ox + 6, oy(9), 4, 2, '#0284c7');
    // Centro bioluminiscente
    px(ctx, ox + 7, oy(6), 2, 2, '#fde047');
    px(ctx, ox + 7, oy(7), 2, 1, '#ffffff');
    // Brillos de silicio
    px(ctx, ox + 5, oy(5), 1, 1, '#bae6fd');
    px(ctx, ox + 10, oy(5), 1, 1, '#bae6fd');
  }
  // 10: DRONE_SCRAP (Restos de Chatarra de Dron de AI Alex)
  {
    const ox = ITEM_ICONS.DRONE_SCRAP * 16;
    // Chasis metálico angular
    px(ctx, ox + 3, oy(4), 9, 8, '#334155');
    px(ctx, ox + 4, oy(5), 7, 6, '#475569');
    px(ctx, ox + 5, oy(6), 5, 4, '#64748b');
    // Circuito grabado y microchip
    px(ctx, ox + 6, oy(7), 3, 2, '#0f172a');
    px(ctx, ox + 7, oy(7), 1, 1, '#22c55e'); // Led verde de circuito
    // Trazas doradas de placa
    px(ctx, ox + 4, oy(9), 4, 1, '#fbbf24');
    px(ctx, ox + 8, oy(5), 2, 1, '#fbbf24');
    // Cableado expuesto y cobre
    px(ctx, ox + 11, oy(3), 2, 4, '#ea580c');
    px(ctx, ox + 2, oy(10), 2, 3, '#f97316');
    px(ctx, ox + 11, oy(8), 2, 3, '#94a3b8');
  }
  // 11: FISH (Trucha fresca del Río Alba)
  {
    const ox = ITEM_ICONS.FISH * 16;
    // Cuerpo hidrodinámico de trucha plateada
    px(ctx, ox + 3, oy(7), 9, 4, '#93c5fd');
    px(ctx, ox + 4, oy(6), 7, 6, '#60a5fa');
    px(ctx, ox + 5, oy(7), 5, 3, '#dbeafe'); // Vientre plateado
    // Ojo y boca
    px(ctx, ox + 3, oy(8), 2, 1, '#1e3a8a');
    px(ctx, ox + 4, oy(7), 1, 1, '#ffffff');
    // Cola en V
    px(ctx, ox + 12, oy(6), 2, 1, '#3b82f6');
    px(ctx, ox + 13, oy(5), 1, 2, '#2563eb');
    px(ctx, ox + 12, oy(10), 2, 1, '#3b82f6');
    px(ctx, ox + 13, oy(10), 1, 2, '#2563eb');
    // Aleta dorsal
    px(ctx, ox + 7, oy(4), 2, 2, '#38bdf8');
    px(ctx, ox + 7, oy(12), 2, 1, '#38bdf8');
  }
  // 12: POTION_ARMOR (Poción de Blindaje Metálico)
  {
    const ox = ITEM_ICONS.POTION_ARMOR * 16;
    // Frasco reforzado azul cobalto con cuello de plata
    px(ctx, ox + 6, oy(2), 4, 2, '#94a3b8'); // Tapón de aleación
    px(ctx, ox + 5, oy(4), 6, 2, '#cbd5e1'); // Cuello metálico
    px(ctx, ox + 4, oy(6), 8, 8, '#1e293b'); // Cuerpo reforzado
    px(ctx, ox + 5, oy(7), 6, 6, '#0284c7'); // Elixir de blindaje azul profundo
    px(ctx, ox + 6, oy(8), 4, 4, '#38bdf8'); // Núcleo radiante cian
    px(ctx, ox + 7, oy(9), 2, 2, '#e0f2fe'); // Destello estelar
    // Reborde de coraza plateada en las esquinas del frasco
    px(ctx, ox + 3, oy(7), 1, 6, '#94a3b8');
    px(ctx, ox + 12, oy(7), 1, 6, '#94a3b8');
    px(ctx, ox + 5, oy(14), 6, 1, '#64748b');
  }
  // 13: SILICON_ORE (Mineral de Silicio Puro de las Minas de la Recursión)
  {
    const ox = ITEM_ICONS.SILICON_ORE * 16;
    px(ctx, ox + 5, oy(3), 6, 10, '#312e81');
    px(ctx, ox + 4, oy(5), 8, 7, '#4338ca');
    px(ctx, ox + 6, oy(4), 4, 8, '#6366f1');
    px(ctx, ox + 7, oy(5), 2, 6, '#a5b4fc'); // Reflejo cristalino
    px(ctx, ox + 9, oy(7), 2, 2, '#ffffff');
  }
  // 14: MICROWAVE_MAGNETRON (Magnetrón de Alta Frecuencia del Microondas)
  {
    const ox = ITEM_ICONS.MICROWAVE_MAGNETRON * 16;
    px(ctx, ox + 4, oy(3), 8, 10, '#78350f'); // Bloque de cobre
    px(ctx, ox + 5, oy(4), 6, 8, '#b45309');
    px(ctx, ox + 6, oy(2), 4, 2, '#d97706'); // Filamento cátodo
    px(ctx, ox + 7, oy(6), 2, 4, '#fbbf24'); // Radiación de microondas
    px(ctx, ox + 4, oy(13), 8, 2, '#451a03'); // Placa de montaje
  }
  // 15: DUNGEON_CORE_GC (Núcleo del Garbage Collector - Esmeralda)
  {
    const ox = ITEM_ICONS.DUNGEON_CORE_GC * 16;
    px(ctx, ox + 3, oy(3), 10, 10, '#064e3b');
    px(ctx, ox + 4, oy(4), 8, 8, '#059669');
    px(ctx, ox + 5, oy(5), 6, 6, '#10b981');
    px(ctx, ox + 6, oy(6), 4, 4, '#34d399');
    px(ctx, ox + 7, oy(7), 2, 2, '#a7f3d0'); // Destello verde
  }
  // 16: DUNGEON_CORE_STACK (Núcleo de la Recursión - Zafiro Cian)
  {
    const ox = ITEM_ICONS.DUNGEON_CORE_STACK * 16;
    px(ctx, ox + 3, oy(3), 10, 10, '#1e1b4b');
    px(ctx, ox + 4, oy(4), 8, 8, '#2563eb');
    px(ctx, ox + 5, oy(5), 6, 6, '#06b6d4');
    px(ctx, ox + 6, oy(6), 4, 4, '#38bdf8');
    px(ctx, ox + 7, oy(7), 2, 2, '#cffafe'); // Destello cian
  }
  // 17: DUNGEON_CORE_MICROWAVE (Núcleo Térmico de la Forja - Rubí Ígneo)
  {
    const ox = ITEM_ICONS.DUNGEON_CORE_MICROWAVE * 16;
    px(ctx, ox + 3, oy(3), 10, 10, '#450a0a');
    px(ctx, ox + 4, oy(4), 8, 8, '#dc2626');
    px(ctx, ox + 5, oy(5), 6, 6, '#ea580c');
    px(ctx, ox + 6, oy(6), 4, 4, '#fde047');
    px(ctx, ox + 7, oy(7), 2, 2, '#fffbeb'); // Destello incandescente
  }

  return canvasToImage(canvas);
}

function oy(y) {
  return y;
}

export async function loadGameAssets() {
  const [charactersSheet, tilesetSheet, itemsSheet] = await Promise.all([
    generateCharacterSheet(),
    generateTilesetSheet(),
    generateItemsSheet()
  ]);

  return {
    charactersSheet,
    tilesetSheet,
    itemsSheet,
    tileSize: TILE_SIZE
  };
}

