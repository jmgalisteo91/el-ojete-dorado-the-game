/**
 * DungeonGenerator - Generación procedural de mazmorras al estilo roguelike.
 * Utiliza BSP (Binary Space Partitioning) para crear habitaciones y pasillos.
 */

const TILES = {
  FLOOR: 0,
  WALL: 1,
  DOOR: 2,
  STAIRS_UP: 3,
  STAIRS_DOWN: 4,
  CHEST: 5,
  BOSS_ROOM: 6,
  PUZZLE: 7,
  TRAP: 8,
  WATER: 9,
  LAVA: 10
};

class SeededRandom {
  constructor(seed) {
    this.seed = seed >>> 0;
  }
  next() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return (this.seed >>> 0) / 0xffffffff;
  }
  range(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick(array) {
    return array[this.range(0, array.length - 1)];
  }
}

class Room {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.centerX = x + Math.floor(w / 2);
    this.centerY = y + Math.floor(h / 2);
  }
  intersects(other) {
    return (
      this.x < other.x + other.w &&
      this.x + this.w > other.x &&
      this.y < other.y + other.h &&
      this.y + this.h > other.y
    );
  }
}

export function generateDungeon(config) {
  const {
    cols = 36,
    rows = 24,
    seed = Date.now(),
    minRooms = 5,
    maxRooms = 12,
    minRoomSize = 5,
    maxRoomSize = 10,
    theme = 'sewers'
  } = config;

  const rng = new SeededRandom(seed);
  const ground = Array.from({ length: rows }, () => new Array(cols).fill(TILES.WALL));
  const decoration = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  const collision = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ground[r][c] = TILES.WALL;
      collision[r][c] = 1;
    }
  }

  const rooms = [];

  for (let i = 0; i < maxRooms * 4; i++) {
    if (rooms.length >= maxRooms) break;

    const w = rng.range(minRoomSize, maxRoomSize);
    const h = rng.range(minRoomSize, maxRoomSize);
    const x = rng.range(1, cols - w - 2);
    const y = rng.range(1, rows - h - 2);

    const newRoom = new Room(x, y, w, h);

    let intersects = false;
    for (const existing of rooms) {
      const margin = 2;
      if (
        newRoom.x < existing.x + existing.w + margin &&
        newRoom.x + newRoom.w > existing.x - margin &&
        newRoom.y < existing.y + existing.h + margin &&
        newRoom.y + newRoom.h > existing.y - margin
      ) {
        intersects = true;
        break;
      }
    }

    if (!intersects) {
      rooms.push(newRoom);
      carveRoom(ground, collision, decoration, newRoom, theme);
    }
  }

  if (rooms.length < minRooms) {
    return generateMinimalDungeon(cols, rows, theme);
  }

  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1];
    const curr = rooms[i];
    connectRooms(ground, collision, decoration, prev, curr, theme, rng);
  }

  const startRoom = rooms[0];
  const bossRoom = rooms[rooms.length - 1];
  const puzzleRooms = rooms.slice(1, Math.min(rooms.length - 1, 3));

  markRoomSpecial(ground, decoration, collision, startRoom, TILES.STAIRS_UP, theme);
  markRoomSpecial(ground, decoration, collision, bossRoom, TILES.BOSS_ROOM, theme);

  for (const puzzleRoom of puzzleRooms) {
    markRoomSpecial(ground, decoration, collision, puzzleRoom, TILES.PUZZLE, theme);
  }

  for (let i = 1; i < rooms.length - 1; i++) {
    if (rng.next() < 0.4) {
      const room = rooms[i];
      const cx = rng.range(room.x + 1, room.x + room.w - 2);
      const cy = rng.range(room.y + 1, room.y + room.h - 2);
      decoration[cy][cx] = TILES.CHEST;
    }
  }

  addAmbientDetails(ground, decoration, collision, rooms, theme, rng);

  return {
    ground,
    decoration,
    collision,
    rooms,
    startRoom,
    bossRoom,
    puzzleRooms,
    theme,
    cols,
    rows
  };
}

function carveRoom(ground, collision, decoration, room, theme) {
  const floorTile = getFloorTile(theme);
  const wallTile = getWallTile(theme);

  for (let r = room.y; r < room.y + room.h; r++) {
    for (let c = room.x; c < room.x + room.w; c++) {
      if (r === room.y || r === room.y + room.h - 1 || c === room.x || c === room.x + room.w - 1) {
        ground[r][c] = wallTile;
        decoration[r][c] = wallTile;
        collision[r][c] = 1;
      } else {
        ground[r][c] = floorTile;
        collision[r][c] = 0;
      }
    }
  }
}

function connectRooms(ground, collision, decoration, roomA, roomB, theme, rng) {
  const floorTile = getFloorTile(theme);
  const x1 = roomA.centerX;
  const y1 = roomA.centerY;
  const x2 = roomB.centerX;
  const y2 = roomB.centerY;

  const horizontalFirst = rng.next() < 0.5;

  if (horizontalFirst) {
    const stepX = x2 > x1 ? 1 : -1;
    for (let x = x1; x !== x2; x += stepX) {
      if (y1 >= 0 && y1 < ground.length && x >= 0 && x < ground[0].length) {
        ground[y1][x] = floorTile;
        collision[y1][x] = 0;
        if (decoration[y1][x] === -1) decoration[y1][x] = floorTile;
      }
    }
    const stepY = y2 > y1 ? 1 : -1;
    for (let y = y1; y !== y2; y += stepY) {
      if (y >= 0 && y < ground.length && x2 >= 0 && x2 < ground[0].length) {
        ground[y][x2] = floorTile;
        collision[y][x2] = 0;
        if (decoration[y][x2] === -1) decoration[y][x2] = floorTile;
      }
    }
  } else {
    const stepY = y2 > y1 ? 1 : -1;
    for (let y = y1; y !== y2; y += stepY) {
      if (y >= 0 && y < ground.length && x1 >= 0 && x1 < ground[0].length) {
        ground[y][x1] = floorTile;
        collision[y][x1] = 0;
        if (decoration[y][x1] === -1) decoration[y][x1] = floorTile;
      }
    }
    const stepX = x2 > x1 ? 1 : -1;
    for (let x = x1; x !== x2; x += stepX) {
      if (y2 >= 0 && y2 < ground.length && x >= 0 && x < ground[0].length) {
        ground[y2][x] = floorTile;
        collision[y2][x] = 0;
        if (decoration[y2][x] === -1) decoration[y2][x] = floorTile;
      }
    }
  }
}

function markRoomSpecial(ground, decoration, collision, room, specialTile, theme) {
  const floorTile = getFloorTile(theme);
  const cx = room.centerX;
  const cy = room.centerY;

  if (cy >= 0 && cy < ground.length && cx >= 0 && cx < ground[0].length) {
    decoration[cy][cx] = specialTile;
    collision[cy][cx] = specialTile === TILES.BOSS_ROOM ? 1 : 0;
  }

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const ry = cy + dy;
      const rx = cx + dx;
      if (ry >= 0 && ry < ground.length && rx >= 0 && rx < ground[0].length) {
        if (decoration[ry][rx] === -1 || decoration[ry][rx] === floorTile) {
          decoration[ry][rx] = specialTile === TILES.BOSS_ROOM ? TILES.BOSS_ROOM : floorTile;
        }
      }
    }
  }
}

function addAmbientDetails(ground, decoration, collision, rooms, theme, rng) {
  const detailChance = theme === 'sewers' ? 0.15 : theme === 'forge' ? 0.1 : 0.05;

  for (let r = 1; r < ground.length - 1; r++) {
    for (let c = 1; c < ground[0].length - 1; c++) {
      if (ground[r][c] === getFloorTile(theme) && rng.next() < detailChance) {
        if (decoration[r][c] !== -1 && decoration[r][c] !== getFloorTile(theme)) continue;

        const detail = pickDetail(theme, rng);
        if (detail) {
          decoration[r][c] = detail.tile;
          if (detail.solid) collision[r][c] = 1;
        }
      }
    }
  }
}

function pickDetail(theme, rng) {
  const details = {
    sewers: [
      { tile: TILES.WATER, solid: false },
      { tile: TILES.TRAP, solid: false },
      { tile: TILES.WALL, solid: true }
    ],
    mines: [
      { tile: TILES.WALL, solid: true },
      { tile: TILES.TRAP, solid: false }
    ],
    forge: [
      { tile: TILES.LAVA, solid: false },
      { tile: TILES.WALL, solid: true }
    ],
    citadel: [
      { tile: TILES.WALL, solid: true },
      { tile: TILES.TRAP, solid: false }
    ],
    quantum: [
      { tile: TILES.WALL, solid: true },
      { tile: TILES.TRAP, solid: false }
    ]
  };

  const themeDetails = details[theme] || details.sewers;
  return rng.pick(themeDetails);
}

function generateMinimalDungeon(cols, rows, theme) {
  const ground = Array.from({ length: rows }, () => new Array(cols).fill(getFloorTile(theme)));
  const decoration = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  const collision = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let c = 0; c < cols; c++) {
    ground[0][c] = getWallTile(theme);
    decoration[0][c] = getWallTile(theme);
    collision[0][c] = 1;
    ground[rows - 1][c] = getWallTile(theme);
    decoration[rows - 1][c] = getWallTile(theme);
    collision[rows - 1][c] = 1;
  }
  for (let r = 0; r < rows; r++) {
    ground[r][0] = getWallTile(theme);
    decoration[r][0] = getWallTile(theme);
    collision[r][0] = 1;
    ground[r][cols - 1] = getWallTile(theme);
    decoration[r][cols - 1] = getWallTile(theme);
    collision[r][cols - 1] = 1;
  }

  return {
    ground,
    decoration,
    collision,
    rooms: [],
    startRoom: null,
    bossRoom: null,
    puzzleRooms: [],
    theme,
    cols,
    rows
  };
}

function getFloorTile(theme) {
  switch (theme) {
    case 'sewers': return 20;
    case 'mines': return 22;
    case 'forge': return 24;
    case 'citadel': return 26;
    case 'quantum': return 28;
    default: return 0;
  }
}

function getWallTile(theme) {
  switch (theme) {
    case 'sewers': return 21;
    case 'mines': return 23;
    case 'forge': return 25;
    case 'citadel': return 27;
    case 'quantum': return 29;
    default: return 1;
  }
}

export { Room, SeededRandom, TILES };
