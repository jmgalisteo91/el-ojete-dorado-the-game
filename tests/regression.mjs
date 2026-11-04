/**
 * Pruebas de regresión sin DOM: IA de enemigos, pathfinding, combate del jugador y reglas de puertas.
 * Ejecutar con:  node tests/regression.mjs
 */
import assert from 'node:assert/strict';
import { findPath, hasLineOfSight } from '../src/ai/Pathfinding.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Player } from '../src/entities/Player.js';
import { getDoorBlock, getDoorDestinationInfo } from '../src/core/DoorGatekeeper.js';
import { AI_STATE, inferArchetype } from '../src/ai/EnemyBrain.js';

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}

/** Tilemap falso a partir de un mapa ASCII ('#' = sólido). */
function makeMap(rows) {
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

const stubInput = {
  getMovementVector: () => ({ x: 0, y: 0 }),
  consumeDash: () => false,
  consumeBarrier: () => false,
  consumeKey: () => false,
  isAttackHeld: () => false
};

function makePlayer(x, y) {
  const p = new Player({ x, y, animator: null });
  p.hasSword = true;
  p.hasArmor = true;
  return p;
}

console.log('Pathfinding');
const wallMap = makeMap([
  '##########',
  '#........#',
  '#.######.#',
  '#........#',
  '##########'
]);
test('A* rodea un muro por el hueco', () => {
  const path = findPath(wallMap, 56, 24, 56, 56);
  assert.ok(path.length > 4, `ruta demasiado corta: ${path.length}`);
  assert.ok(path.every((p) => !wallMap.isSolidAtTile(Math.floor(p.x / 16), Math.floor(p.y / 16))));
});
test('A* devuelve [] si el destino está sellado', () => {
  const sealed = makeMap(['#####', '#.#.#', '#####']);
  assert.deepEqual(findPath(sealed, 24, 24, 56, 24), []);
});
test('Línea de visión bloqueada por un muro', () => {
  assert.equal(hasLineOfSight(wallMap, 56, 24, 56, 56), false);
  assert.equal(hasLineOfSight(wallMap, 24, 24, 100, 24), true);
});

console.log('Enemigos e IA');
const openMap = makeMap(Array.from({ length: 12 }, (_, r) => (r === 0 || r === 11 ? '#'.repeat(20) : '#' + '.'.repeat(18) + '#')));

function makeEnemy(id, x = 48, y = 48) {
  return new Enemy({ id, name: 'Test', x, y, hp: 3, speed: 40, aggroRange: 90, sceneId: 'first_stage', animator: null });
}
function makeFakePlayer(x, y) {
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
function run(enemy, player, seconds, ai = null) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    player.worldBoundingBox = { x: player.x + 3, y: player.y + 8, width: 10, height: 7 };
    enemy.update(dt, openMap, player, false, null, ai || { enemies: [enemy], attackers: new Set() });
  }
}

test('Enemy conserva id y maxHp (bug: antes se ignoraban)', () => {
  const e = new Enemy({ id: 'drone_x', x: 0, y: 0, maxHp: 5, animator: null });
  assert.equal(e.id, 'drone_x');
  assert.equal(e.maxHp, 5);
  assert.equal(e.hp, 5);
});
test('Arquetipos inferidos por id', () => {
  assert.equal(inferArchetype('drone_west_1'), 'drone');
  assert.equal(inferArchetype('drone_west_2'), 'sentinel');
  assert.equal(inferArchetype('knight_north_west'), 'knight');
  assert.equal(inferArchetype('night_glitch_stage1_1'), 'glitch');
  assert.equal(inferArchetype('otro'), 'grunt');
});
test('PATROL → ALERT → CHASE al ver al jugador', () => {
  const e = makeEnemy('grunt_1');
  const p = makeFakePlayer(100, 48);
  run(e, p, 0.1);
  assert.equal(e.aiState, AI_STATE.ALERT);
  run(e, p, 0.5);
  assert.equal(e.aiState, AI_STATE.CHASE);
});
test('Pierde al jugador → SEARCH → RETURN → PATROL', () => {
  const e = makeEnemy('grunt_2');
  const p = makeFakePlayer(100, 48);
  run(e, p, 1.0);
  p.x = 280;
  p.y = 160;
  run(e, p, 1.5);
  assert.equal(e.aiState, AI_STATE.SEARCH);
  run(e, p, 12);
  assert.ok([AI_STATE.RETURN, AI_STATE.PATROL].includes(e.aiState), `estado: ${e.aiState}`);
});
test('Un enemigo no detecta al jugador a través de una pared', () => {
  const wallEnemyMap = makeMap(Array.from({ length: 12 }, (_, r) => (r === 0 || r === 11 ? '#'.repeat(20) : '#....#............#')));
  const e = makeEnemy('grunt_3', 32, 48);
  const p = makeFakePlayer(100, 48);
  e.update(1 / 60, wallEnemyMap, p, false, null, { enemies: [e], attackers: new Set() });
  assert.equal(e.aiState, AI_STATE.PATROL);
});
test('Dron dispara un proyectil tras telegrafiar', () => {
  const e = makeEnemy('drone_t', 48, 48);
  const p = makeFakePlayer(110, 48);
  run(e, p, 3.5);
  assert.ok(e.shots.length > 0 || p.hits > 0, 'no hubo proyectiles ni impactos');
});
test('Centinela da la alarma a aliados cercanos', () => {
  const sentinel = makeEnemy('drone_west_2', 48, 48);
  const ally = makeEnemy('grunt_ally', 70, 80);
  ally.aggroRange = 5;
  const p = makeFakePlayer(100, 48);
  const ai = { enemies: [sentinel, ally], attackers: new Set() };
  run(sentinel, p, 0.2, ai);
  assert.ok([AI_STATE.ALERT, AI_STATE.CHASE].includes(ally.aiState), `aliado: ${ally.aiState}`);
});
test('Máximo 2 atacantes simultáneos', () => {
  const enemies = [0, 1, 2, 3].map((i) => makeEnemy(`grunt_g${i}`, 90 + i * 2, 60 + i * 2));
  const p = makeFakePlayer(100, 60);
  const ai = { enemies, attackers: new Set() };
  for (let t = 0; t < 120; t++) {
    ai.attackers.clear();
    for (const e of enemies) e.update(1 / 60, openMap, p, false, null, ai);
  }
  assert.ok(ai.attackers.size <= 2);
});
test('Enemigo aturdido no se mueve y recibe doble daño', () => {
  const e = makeEnemy('grunt_s');
  const p = makeFakePlayer(300, 150);
  e.stun(1);
  const x0 = e.x;
  run(e, p, 0.5);
  assert.equal(e.x, x0);
  const hp0 = e.hp;
  e.takeSwordHit({ centerX: 0, centerY: 0, getSwordDamage: () => 1 }, null);
  assert.equal(hp0 - e.hp, 2);
});

console.log('Jugador');
test('Combo de 3 golpes: daños 1, 1, 2', () => {
  const p = makePlayer(32, 32);
  const dmg = [];
  for (let i = 0; i < 3; i++) {
    assert.ok(p.tryAttack());
    dmg.push(p.getSwordDamage());
    for (let t = 0; t < 0.3; t += 1 / 60) p.update(1 / 60, stubInput, openMap, []);
    if (i < 2) p.attackCooldown = 0;
  }
  assert.deepEqual(dmg, [1, 1, 2]);
});
test('Sin stamina no se puede atacar', () => {
  const p = makePlayer(32, 32);
  p.stamina = 3;
  assert.equal(p.tryAttack(), false);
});
test('Dash consume stamina y habilita tajo de embestida (daño 2)', () => {
  const p = makePlayer(32, 32);
  p.hasDash = true;
  assert.ok(p.tryDash(stubInput));
  assert.equal(Math.round(p.stamina), 75);
  p.dashCooldown = 0;
  assert.ok(p.tryAttack());
  assert.equal(p.getSwordDamage(), 2);
});
test('Parry perfecto aturde al atacante; fuera de ventana solo absorbe', () => {
  const p = makePlayer(32, 32);
  p.hasBarrier = true;
  p.tryBarrier();
  let stunned = 0;
  assert.equal(p.takeHit(null, { stun: (s) => (stunned = s) }), false);
  assert.ok(stunned > 0);
  const q = makePlayer(32, 32);
  q.hasBarrier = true;
  q.tryBarrier();
  q.parryTimer = 0;
  let stunned2 = 0;
  q.takeHit(null, { stun: (s) => (stunned2 = s) });
  assert.equal(stunned2, 0);
});
test('Indefenso (sin armadura) muere de un golpe', () => {
  const p = makePlayer(32, 32);
  p.hasArmor = false;
  p.takeHit();
  assert.equal(p.hp, 0);
});
test('Árbol de habilidades: compra y puntos', () => {
  const p = makePlayer(32, 32);
  assert.equal(p.purchaseSkill('log'), false);
  p.skillPoints = 3;
  assert.ok(p.purchaseSkill('log'));
  assert.equal(p.skillPoints, 1);
  assert.ok(p.purchaseSkill('vigor'));
  assert.equal(p.effectiveMaxStamina, 140);
  assert.equal(p.purchaseSkill('vigor'), false);
});
test('Puntos de habilidad: 1 cada 4 kills, 2 por jefe', () => {
  const p = makePlayer(32, 32);
  for (let i = 0; i < 4; i++) p.awardKill(false);
  assert.equal(p.skillPoints, 1);
  p.awardKill(true);
  assert.equal(p.skillPoints, 3);
});
test('console.log arrojadizo aturde y revela al enemigo', () => {
  const p = makePlayer(48, 48);
  p.skills.log = true;
  assert.ok(p.throwLog());
  const e = makeEnemy('grunt_l', 60, 48);
  p.thrownLogs[0].x = e.centerX;
  p.thrownLogs[0].y = e.centerY;
  e.update(1 / 60, openMap, p, false, null, { enemies: [e], attackers: new Set() });
  assert.ok(e.stunTimer > 0 || e.revealedTimer > 0);
});
test('Autodesbloqueo: jugador solapado con un sólido sale solo', () => {
  const solid = makeMap(['#######', '#.....#', '#..#..#', '#.....#', '#######']);
  const p = makePlayer(3 * 16, 2 * 16);
  p.update(1 / 60, stubInput, solid, []);
  const box = p.worldBoundingBox;
  const c0 = Math.floor(box.x / 16);
  const c1 = Math.floor((box.x + box.width - 0.01) / 16);
  const r0 = Math.floor(box.y / 16);
  const r1 = Math.floor((box.y + box.height - 0.01) / 16);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) assert.equal(solid.isSolidAtTile(c, r), false);
});

console.log('Puertas');
test('Gatekeeper bloquea sin equipo y permite con equipo', () => {
  assert.ok(getDoorBlock('sewers_dungeon', { hasArmor: false, hasSword: false }));
  assert.equal(getDoorBlock('sewers_dungeon', { hasArmor: true, hasSword: true }), null);
  assert.ok(getDoorBlock('sword_temple', { hasArmor: false, hasSword: false }));
  assert.equal(getDoorBlock('sword_temple', { hasArmor: true, hasSword: false }), null);
  assert.equal(getDoorBlock('armor_temple', { hasArmor: false, hasSword: false }), null);
});
test('Gatekeeper describe arenas de jefe', () => {
  assert.match(getDoorDestinationInfo('sewers_dungeon').description, /JEFE/);
});

console.log(`\n${passed} pruebas OK, ${failures.length} fallos.`);
if (failures.length) process.exit(1);
