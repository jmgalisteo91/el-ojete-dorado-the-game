import { Player } from '../../src/entities/Player.js';
import { Enemy } from '../../src/entities/Enemy.js';
import { RPGGame } from '../../src/main.js';

/** Store compartida en memoria para el mock global de localStorage. */
export const sharedMockStore = {};

export function installSharedLocalStorage() {
  globalThis.localStorage = {
    getItem: (k) => sharedMockStore[k] ?? null,
    setItem: (k, v) => { sharedMockStore[k] = String(v); },
    removeItem: (k) => { delete sharedMockStore[k]; },
    clear: () => {
      for (const key of Object.keys(sharedMockStore)) {
        delete sharedMockStore[key];
      }
    }
  };
  return sharedMockStore;
}

installSharedLocalStorage();

/** Ejecuta un callback con un localStorage aislado en Map y lo restaura al finalizar. */
export async function withIsolatedLocalStorage(initialEntries, fn) {
  const prevStorage = globalThis.localStorage;
  const storeMap = new Map(initialEntries);
  globalThis.localStorage = {
    getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
    setItem: (k, v) => storeMap.set(k, String(v)),
    removeItem: (k) => storeMap.delete(k)
  };
  try {
    return await fn(storeMap);
  } finally {
    if (typeof prevStorage === 'undefined') delete globalThis.localStorage;
    else globalThis.localStorage = prevStorage;
  }
}

/** Tilemap falso a partir de un mapa ASCII ('#' = sólido). */
export function makeMap(rows) {
  return {
    tileSize: 16,
    cols: rows[0].length,
    rows: rows.length,
    isSolidAtTile(c, r) {
      if (c < 0 || r < 0 || r >= rows.length || c >= rows[0].length) return true;
      return rows[r][c] === '#';
    }
  };
}

export const wallMap = makeMap([
  '##########',
  '#........#',
  '#.######.#',
  '#........#',
  '##########'
]);

export const openMap = makeMap(
  Array.from({ length: 12 }, (_, r) => (r === 0 || r === 11 ? '#'.repeat(20) : '#' + '.'.repeat(18) + '#'))
);

export const stubInput = {
  getMovementVector: () => ({ x: 0, y: 0 }),
  consumeDash: () => false,
  consumeBarrier: () => false,
  consumeKey: () => false,
  isAttackHeld: () => false
};

export function makePlayer(x, y) {
  const p = new Player({ x, y, animator: null });
  p.hasSword = true;
  p.hasArmor = true;
  return p;
}

export function makeEnemy(id, x = 48, y = 48) {
  return new Enemy({ id, name: 'Test', x, y, hp: 3, speed: 40, aggroRange: 90, sceneId: 'first_stage', animator: null });
}

export function makeFakePlayer(x, y) {
  return {
    x, y, width: 16, height: 16, hp: 3,
    get centerX() { return this.x + 8; },
    get centerY() { return this.y + 8; },
    worldBoundingBox: { x: x + 3, y: y + 8, width: 10, height: 7 },
    thrownLogs: [],
    hits: 0,
    takeHit() { this.hits++; return true; },
    getSwordHitbox: () => null,
    getSpinHitbox: () => null
  };
}

export function runEnemySim(enemy, player, seconds, ai = null) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    player.worldBoundingBox = { x: player.x + 3, y: player.y + 8, width: 10, height: 7 };
    enemy.update(dt, openMap, player, false, null, ai || { enemies: [enemy], attackers: new Set() });
  }
}

export function makeMockCtx() {
  const calls = [];
  return {
    calls,
    canvas: { width: 320, height: 180 },
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    closePath: () => calls.push('closePath'),
    moveTo: (x, y) => calls.push(`moveTo(${x},${y})`),
    lineTo: (x, y) => calls.push(`lineTo(${x},${y})`),
    arcTo: (x1, y1, x2, y2, r) => calls.push(`arcTo(${x1},${y1},${x2},${y2},${r})`),
    arc: (...args) => calls.push(['arc', ...args]),
    ellipse: (...args) => calls.push(['ellipse', ...args]),
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    strokeRect: () => calls.push('strokeRect'),
    fillRect: () => calls.push('fillRect'),
    clearRect: () => calls.push('clearRect'),
    fillText: (text, x, y) => calls.push(`fillText(${text},${x},${y})`),
    measureText: (text) => ({ width: (text || '').length * 4 }),
    translate: () => calls.push('translate'),
    rotate: () => calls.push('rotate'),
    scale: () => calls.push('scale'),
    setTransform: () => calls.push('setTransform'),
    setLineDash: () => calls.push('setLineDash'),
    drawImage: (...args) => calls.push(['drawImage', ...args]),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} })
  };
}

export function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    end() { return this; }
  };
}

export function makeFakeGame() {
  const game = Object.create(RPGGame.prototype);
  game.assets = { charactersSheet: null };
  return game;
}

export function makeFakeMusic() {
  return {
    setMode: () => {},
    playMenuSelect: () => {},
    playMenuMove: () => {},
    playFanfare: () => {},
    getMasterVolume: () => 1.0,
    getMusicVolume: () => 0.8,
    getSfxVolume: () => 1.0,
    isMasterMuted: () => false,
    isMusicMuted: () => false,
    isSfxMuted: () => false
  };
}
