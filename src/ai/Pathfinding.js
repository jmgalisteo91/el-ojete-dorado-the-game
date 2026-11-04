/**
 * Pathfinding: A* sobre la rejilla de colisión del Tilemap (8 direcciones, sin cortar esquinas).
 * Módulo puro: solo necesita un objeto con { tileSize, isSolidAtTile(col, row) }.
 */

const SQRT2 = Math.SQRT2;

class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(node) {
    const a = this.items;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

const NEIGHBORS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [-1, 1, SQRT2], [1, -1, SQRT2], [-1, -1, SQRT2]
];

/**
 * Busca la baldosa libre más cercana (hasta `radius` baldosas) a la indicada.
 */
function nearestFreeTile(tilemap, col, row, radius = 3) {
  if (!tilemap.isSolidAtTile(col, row)) return { col, row };
  for (let r = 1; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!tilemap.isSolidAtTile(col + dx, row + dy)) {
          return { col: col + dx, row: row + dy };
        }
      }
    }
  }
  return null;
}

/**
 * Calcula un camino en coordenadas de mundo (centro de baldosa) entre dos puntos.
 * @returns {Array<{x:number,y:number}>} Camino sin el punto inicial; [] si no hay ruta o ya está en destino.
 */
export function findPath(tilemap, startX, startY, goalX, goalY, maxNodes = 500) {
  const ts = tilemap.tileSize;
  const sc = Math.floor(startX / ts);
  const sr = Math.floor(startY / ts);
  const goal = nearestFreeTile(tilemap, Math.floor(goalX / ts), Math.floor(goalY / ts));
  if (!goal) return [];
  const start = nearestFreeTile(tilemap, sc, sr, 1) || { col: sc, row: sr };
  if (start.col === goal.col && start.row === goal.row) return [];

  const key = (c, r) => (r + 1000) * 4096 + (c + 1000);
  const open = new MinHeap();
  const best = new Map();
  const parent = new Map();
  const heuristic = (c, r) => {
    const dx = Math.abs(c - goal.col);
    const dy = Math.abs(r - goal.row);
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
  };

  best.set(key(start.col, start.row), 0);
  open.push({ c: start.col, r: start.row, g: 0, f: heuristic(start.col, start.row) });
  let expanded = 0;
  let found = false;

  while (open.size > 0 && expanded < maxNodes) {
    const cur = open.pop();
    const curKey = key(cur.c, cur.r);
    if (cur.g > (best.get(curKey) ?? Infinity)) continue;
    expanded++;

    if (cur.c === goal.col && cur.r === goal.row) {
      found = true;
      break;
    }

    for (const [dx, dy, cost] of NEIGHBORS) {
      const nc = cur.c + dx;
      const nr = cur.r + dy;
      if (tilemap.isSolidAtTile(nc, nr)) continue;
      if (dx !== 0 && dy !== 0 && (tilemap.isSolidAtTile(cur.c + dx, cur.r) || tilemap.isSolidAtTile(cur.c, cur.r + dy))) {
        continue;
      }
      const g = cur.g + cost;
      const nKey = key(nc, nr);
      if (g < (best.get(nKey) ?? Infinity)) {
        best.set(nKey, g);
        parent.set(nKey, curKey);
        open.push({ c: nc, r: nr, g, f: g + heuristic(nc, nr) });
      }
    }
  }

  if (!found) return [];

  const path = [];
  let k = key(goal.col, goal.row);
  const startKey = key(start.col, start.row);
  while (k !== startKey && k !== undefined) {
    const c = (k % 4096) - 1000;
    const r = Math.floor(k / 4096) - 1000;
    path.push({ x: c * ts + ts / 2, y: r * ts + ts / 2 });
    k = parent.get(k);
  }
  path.reverse();
  return path;
}

/**
 * Línea de visión entre dos puntos de mundo: ninguna baldosa sólida entre ambos (muestreo por pasos).
 */
export function hasLineOfSight(tilemap, x0, y0, x1, y1) {
  const ts = tilemap.tileSize;
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / (ts / 2)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (tilemap.isSolidAtTile(Math.floor(x / ts), Math.floor(y / ts))) {
      return false;
    }
  }
  return true;
}
