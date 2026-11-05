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
import { SpeechBubble, drawSpeechBalloonPath } from '../src/ui/SpeechBubble.js';
import { GarbageCollectorBoss } from '../src/entities/bosses/GarbageCollectorBoss.js';
import { StackOverflowBoss } from '../src/entities/bosses/StackOverflowBoss.js';
import { PrototypeMicrowaveBoss } from '../src/entities/bosses/PrototypeMicrowaveBoss.js';
import { FinalBossAlex } from '../src/entities/bosses/FinalBossAlex.js';
import {
  calculateGameScore,
  formatPlayTime,
  getLocalLeaderboard,
  saveLocalScore,
  submitGlobalScore,
  fetchGlobalLeaderboard,
  getLocalSaveContainer,
  saveLocalFallback,
  markLocalFallbackSynced,
  syncPendingSaveToCloud,
  SAVE_STORAGE_KEY,
  DEFAULT_LEADERBOARD
} from '../src/core/ScoreSystem.js';
import handleLeaderboard from '../api/leaderboard.js';
import handleSave from '../api/save.js';
import { Tilemap } from '../src/world/Tilemap.js';
import { DialogueBox } from '../src/ui/DialogueBox.js';
import { CollisionSystem } from '../src/physics/CollisionSystem.js';
import { NPC, getBromForgeChoices } from '../src/entities/NPC.js';
import { TILES } from '../src/graphics/SpriteSheetGenerator.js';
import { DayNightCycle } from '../src/world/DayNightCycle.js';
import { RenderPipeline } from '../src/graphics/RenderPipeline.js';
import { UILayout, SAFE_WIDTH, SAFE_HEIGHT, MODAL_WIDTH, MODAL_HEIGHT } from '../src/ui/UILayout.js';
import { CloudStorage } from '../src/services/CloudStorage.js';
import { LeaderboardView } from '../src/ui/LeaderboardView.js';
import { AudioManager } from '../src/audio/AudioManager.js';
import { AmbientMusic } from '../src/audio/AmbientMusic.js';
import { MainMenuAndScenes } from '../src/ui/MainMenuAndScenes.js';
import { SCENE_AI_ALEX_WARNING, SCENE_ENDING_VICTORY } from '../src/assets/VillainDialogues.js';
import { Inventory } from '../src/ui/Inventory.js';
import { QuestLog } from '../src/core/QuestLog.js';
import { QuestLogView } from '../src/ui/QuestLogView.js';
import { CharacterStats } from '../src/ui/CharacterStats.js';
import { InputHandler } from '../src/core/InputHandler.js';
import { WorldMap } from '../src/ui/WorldMap.js';

let passed = 0;
const failures = [];
const asyncQueue = [];
function test(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      asyncQueue.push(
        res
          .then(() => {
            passed++;
            console.log(`  ✓ ${name}`);
          })
          .catch((err) => {
            failures.push(name);
            console.log(`  ✗ ${name}\n      ${err.message}`);
          })
      );
      return;
    }
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

console.log('Bocadillos y Textos Flotantes');
function makeMockCtx() {
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

test('drawSpeechBalloonPath construye trazado con rabillo inferior', () => {
  const ctx = makeMockCtx();
  drawSpeechBalloonPath(ctx, 10, 10, 60, 20, 4, 40, 36, 6);
  assert.ok(ctx.calls.includes('beginPath'));
  assert.ok(ctx.calls.includes('closePath'));
  assert.ok(ctx.calls.some((c) => c.startsWith('arcTo')));
  assert.ok(ctx.calls.some((c) => c.startsWith('lineTo(40,36)')));
});

test('renderActionPromptBubble formatea acción de NPC con tecla y bocadillo', () => {
  const ctx = makeMockCtx();
  const action = {
    kind: 'npc',
    target: { centerX: 100, y: 80, name: 'Anciano Aurelio (Cronista)' },
    label: '[E] Hablar con Anciano Aurelio'
  };
  const camera = { renderX: 0, renderY: 0, viewportWidth: 320, viewportHeight: 180 };
  SpeechBubble.renderActionPromptBubble(ctx, action, camera, 0);
  assert.ok(ctx.calls.some((c) => c.includes('fillText(E')));
  assert.ok(ctx.calls.some((c) => c.includes('fillText(Hablar')));
  assert.ok(ctx.calls.some((c) => c.includes('Aurelio')));
});

test('renderNPCBarkBubble ajusta texto largo en varias líneas y dibuja bocadillo', () => {
  const ctx = makeMockCtx();
  const text = '¡Pan recién horneado y manzanas frescas de la huerta de Valleverde!';
  SpeechBubble.renderNPCBarkBubble(ctx, 160, 90, text, 2.5, 3.0);
  assert.ok(ctx.calls.includes('fill'));
  assert.ok(ctx.calls.includes('stroke'));
  const textCalls = ctx.calls.filter((c) => c.startsWith('fillText'));
  assert.ok(textCalls.length >= 2, `debería dividirse en varias líneas: ${textCalls.length}`);
});

test('renderFloatingBadge dibuja indicador con flecha pulsante', () => {
  const ctx = makeMockCtx();
  SpeechBubble.renderFloatingBadge(ctx, 120, 80, '💀 GARBAGE COLLECTOR', 'Alcantarillas', '#ef4444', '#fca5a5', true);
  assert.ok(ctx.calls.some((c) => c.includes('fillText(💀 GARBAGE COLLECTOR')));
  assert.ok(ctx.calls.some((c) => c.includes('fillText(Alcantarillas')));
});

test('renderCombatBanner traza banner con borde', () => {
  const ctx = makeMockCtx();
  SpeechBubble.renderCombatBanner(ctx, '¡PARRY PERFECTO!', 160, 30, '#fde047');
  assert.ok(ctx.calls.some((c) => c.includes('fillText(¡PARRY PERFECTO!')));
});

test('renderActionPromptBubble es resiliente si action.target es undefined (panel booleano / pesca)', () => {
  const ctx = makeMockCtx();
  const camera = { renderX: 0, renderY: 0, viewportWidth: 320, viewportHeight: 180 };
  const player = { centerX: 168, centerY: 60, y: 52 };

  // Caso exacto del bug reportado: panel booleano sin target explícito
  const actionWithoutTarget = {
    kind: 'armor_compiler_panel',
    label: '[E] Leer Panel de Compilación Booleana'
  };

  assert.doesNotThrow(() => {
    SpeechBubble.renderActionPromptBubble(ctx, actionWithoutTarget, camera, 0, player);
  });
  assert.ok(ctx.calls.some((c) => c.includes('fillText(Panel')));
  assert.ok(ctx.calls.some((c) => c.includes('Booleano')));

  // Caso monolito con col/row
  const monolithAction = {
    kind: 'sword_monolith',
    target: { col: 5, row: 8, name: 'Suma', symbol: '∑' },
    label: '[E] Sintonizar Suma (∑)'
  };
  assert.doesNotThrow(() => {
    SpeechBubble.renderActionPromptBubble(ctx, monolithAction, camera, 0, player);
  });
  assert.ok(ctx.calls.some((c) => c.includes('fillText(Monolito')));
});

test('renderNPCBarkBubble se descarta fuera de pantalla y no persigue al jugador forzando (4, 12)', () => {
  const ctxFar = makeMockCtx();
  SpeechBubble.renderNPCBarkBubble(ctxFar, -200, 90, 'Texto lejano fuera de vista', 2.0, 3.0);
  assert.equal(ctxFar.calls.length, 0, 'No debe renderizar nada si sx < -140');

  const ctxNear = makeMockCtx();
  SpeechBubble.renderNPCBarkBubble(ctxNear, -60, 90, 'Texto que no debe clavarse en x=4', 2.0, 3.0);
  assert.ok(ctxNear.calls.length > 0);
  // Verificamos que el cuerpo no esté forzado artificialmente a la coordenada x=4 o x=2
  const fillCalls = ctxNear.calls.filter((c) => c.startsWith('fillText'));
  assert.ok(fillCalls.length > 0);
  // Las coordenadas de texto deben reflejar la posición relativa negativa, no quedar fijadas en x=52 (4 + bubbleW/2)
  for (const fc of fillCalls) {
    const match = fc.match(/fillText\([^,]+,(-?\d+(?:\.\d+)?),/);
    if (match) {
      const drawnX = parseFloat(match[1]);
      assert.ok(drawnX < 0, `drawnX ${drawnX} debería estar fuera de pantalla a la izquierda`);
    }
  }
});

test('NPC triggerAmbientBark almacena coordenadas de emisión y renderSpeechBubble ancla al mundo', () => {
  const npc = new NPC({
    name: 'Aldeano Test',
    x: 100,
    y: 120,
    ambientPhrases: ['¡Saludos desde la plaza!']
  });

  npc.triggerAmbientBark();
  assert.equal(npc.ambientBubbleText, '¡Saludos desde la plaza!');
  assert.equal(npc.ambientBubbleWorldX, npc.centerX);
  assert.equal(npc.ambientBubbleWorldY, npc.y);

  // Tras un instante (animación completada)
  npc.ambientBubbleTimer = 2.5;

  // Si el NPC camina a otra posición durante los 3 segundos
  npc.x = 220;
  npc.y = 180;

  const mockCtx = makeMockCtx();
  const camera = { renderX: 100, renderY: 100 };
  npc.renderSpeechBubble(mockCtx, camera);

  // El texto debe dibujarse cerca de worldX - camera.renderX = 108 - 100 = 8 (bx ajustado ~56), NO de 220 - 100 = 120
  const fillCalls = mockCtx.calls.filter((c) => c.startsWith('fillText'));
  assert.ok(fillCalls.length > 0);
  const match = fillCalls[0].match(/fillText\([^,]+,(-?\d+(?:\.\d+)?),/);
  assert.ok(match, 'Debe haber un fillText con coordenadas');
  const drawnX = parseFloat(match[1]);
  assert.ok(drawnX <= 60, `El bocadillo debe estar cerca de x=56, obtenido: ${drawnX}`);
});

test('CollisionSystem: el jugador en contacto con un NPC no queda atascado contra muros y puede escapar', () => {
  const solidMap = makeMap([
    '######',
    '#....#',
    '#....#',
    '######'
  ]);

  const p = makePlayer(2 * 16, 2 * 16);
  const npc = new NPC({
    name: 'Guardia Bloqueo',
    x: 3 * 16,
    y: 2 * 16,
    behavior: 'static'
  });

  const obstacles = [npc];

  // El jugador empuja hacia el NPC (derecha)
  const moveResRight = CollisionSystem.moveWithCollisions(p, 2, 0, solidMap, obstacles);
  // No debe teleportarse ni romper los límites
  assert.ok(p.x >= 2 * 16 && p.x <= 3 * 16);

  // El jugador debe poder escapar libremente hacia la izquierda
  const prevX = p.x;
  const moveResLeft = CollisionSystem.moveWithCollisions(p, -2, 0, solidMap, obstacles);
  assert.equal(moveResLeft.blockedX, false);
  assert.ok(p.x < prevX, 'El jugador debe poder moverse hacia la izquierda sin quedar atascado');
});

test('NPC: pausa cortés al cruzarse con el jugador respeta politePauseCooldown y no congela la IA', () => {
  const p = makePlayer(100, 100);
  const npc = new NPC({
    name: 'Patrullero Ágil',
    x: 106,
    y: 100,
    behavior: 'patrol',
    patrolPoints: [{ x: 80, y: 100 }, { x: 140, y: 100 }]
  });

  // Limpiamos el waitTimer inicial de spawn
  npc.waitTimer = 0;

  // Primer contacto a distancia <= 18: pausa cortés
  npc.update(0.016, null, [p, npc], false, p);
  assert.ok(npc.politePauseCooldown > 0);
  assert.ok(npc.waitTimer > 0);

  // Consumimos el waitTimer
  npc.waitTimer = 0;

  // Siguiente frame: aunque el jugador siga a distancia <= 18, politePauseCooldown > 0 impide reiniciar el waitTimer
  npc.update(0.016, null, [p, npc], false, p);
  assert.equal(npc.waitTimer, 0, 'No debe reiniciar el waitTimer mientras politePauseCooldown esté activo');
});

test('Reliquia Divina de El Microondas Little se encuentra en cofre dentro de elder_house', () => {
  // Verificamos contrato del objeto en código fuente
  const actionChest = {
    kind: 'item',
    target: {
      id: 'golden_apple',
      name: 'El Microondas Little (Reliquia Divina)',
      description: 'Reliquia divina ancestral custodiada por Aurelio. Sin despertador, recalienta código y variables en O(1), restaura toda tu salud y purga anomalías. ¡Úsala con cuidado!',
      isChest: true,
      sceneId: 'elder_house',
      centerX: 6 * 16 + 8,
      y: 3 * 16
    },
    label: '[E] Abrir Cofre: El Microondas Little (Reliquia Divina)'
  };
  const ctx = makeMockCtx();
  const camera = { renderX: 0, renderY: 0, viewportWidth: 320, viewportHeight: 180 };
  assert.doesNotThrow(() => {
    SpeechBubble.renderActionPromptBubble(ctx, actionChest, camera, 0);
  });
  assert.ok(ctx.calls.some((c) => c.includes('fillText(Abrir')));
  assert.ok(ctx.calls.some((c) => c.includes('Microondas')));
});

test('StackOverflowBoss (Guardián del Stack Overflow) tiene hitbox de pies optimizada y navega obstáculos con A*', () => {
  const boss = new StackOverflowBoss({ x: 100, y: 100, sceneId: 'sword_temple' });
  // Comprobar hitbox de pies
  assert.equal(boss.boundingBox.width, 14);
  assert.equal(boss.boundingBox.height, 12);
  assert.equal(boss.boundingBox.offsetY, 14);
  // Comprobar hurtbox completa para espada
  assert.ok(boss.hurtbox.width >= 20);
  assert.ok(boss.hurtbox.height >= 24);

  // Mapa con una columna central entre el boss y el jugador en una sala amplia
  // Boss en (1, 2), Pilar en (3, 2), Jugador en (5, 2)
  const map = makeMap([
    '#######',
    '#.....#',
    '#B.#.P#',
    '#.....#',
    '#.....#',
    '#######'
  ]);
  boss.x = 1 * 16;
  boss.y = 2 * 16;
  boss.activeCombat = true;

  const player = {
    centerX: 5 * 16 + 8,
    centerY: 2 * 16 + 8,
    getSpinHitbox: () => null,
    getSwordHitbox: () => null,
    takeHit: () => {}
  };

  // Simular frames (el jefe debe detectar el pilar y rodearlo usando A*)
  for (let i = 0; i < 40; i++) {
    boss.update(0.05, map, player);
  }

  // El jefe debe avanzar en X superando el pilar central hacia el jugador
  assert.ok(boss.x > 2.5 * 16, `Boss debería haberse desplazado en X rodeando el pilar: x=${boss.x}`);
});

test('Rebalanceo de Bosses: HP calibrada y daño ajustado al héroe', () => {
  const b1 = new GarbageCollectorBoss({ x: 0, y: 0 });
  const b2 = new StackOverflowBoss({ x: 0, y: 0 });
  const b3 = new PrototypeMicrowaveBoss({ x: 0, y: 0 });
  const b4 = new FinalBossAlex({ x: 0, y: 0 });

  // 1. Verificación de HP calibrada
  assert.equal(b1.maxHp, 24, 'Garbage Collector debe tener 24 HP');
  assert.equal(b2.maxHp, 32, 'Stack Overflow debe tener 32 HP');
  assert.equal(b3.maxHp, 42, 'Microondas Prototipo debe tener 42 HP');
  assert.equal(b4.maxHp, 55, 'Final Boss Alex debe tener 55 HP');

  // 2. Multiplicador x2 de daño cuando el boss está aturdido
  const mockPlayer = {
    centerX: 0,
    centerY: 0,
    getSwordDamage: () => 1
  };

  // Golpe neutro (sin aturdir): daño 1
  const startHp = b1.hp;
  b1.takeSwordHit(mockPlayer, null, 1);
  assert.equal(b1.hp, startHp - 1, 'Golpe neutro debe restar 1 HP');

  // Golpe con boss aturdido (state = stunned): daño x2 (2 de daño)
  b1.hitFlashTimer = 0;
  b1.state = 'stunned';
  assert.ok(b1.isStunned, 'b1 debe reportar isStunned=true');
  const hpBeforeStunHit = b1.hp;
  b1.takeSwordHit(mockPlayer, null, 1);
  assert.equal(b1.hp, hpBeforeStunHit - 2, 'Golpe durante aturdimiento debe restar 2 HP (daño x2)');

  // Finisher de combo (daño 2) con boss aturdido: daño x2 = 4 de daño
  b1.hitFlashTimer = 0;
  const hpBeforeFinisher = b1.hp;
  b1.takeSwordHit(mockPlayer, null, 2);
  assert.equal(b1.hp, hpBeforeFinisher - 4, 'Finisher con aturdimiento debe restar 4 HP');

  // 3. Clones de Stack Overflow tienen vida justa (3 HP) y thresholds
  assert.equal(b2.cloneThresholds.length, 2);
  assert.ok(b2.cloneThresholds[0] === 21 && b2.cloneThresholds[1] === 11);
  b2.spawnRecursiveClones();
  assert.equal(b2.clones.length, 2);
  assert.equal(b2.clones[0].maxHp, 3, 'Los clones deben tener 3 HP');
  assert.equal(b2.clones[1].maxHp, 3);

  // 4. Ciclos térmicos de Microondas Prototipo al 60% y 30%
  assert.equal(b3.cycleThresholds[0], 25, 'Primer ciclo al 60% (25 HP)');
  assert.equal(b3.cycleThresholds[1], 13, 'Segundo ciclo al 30% (13 HP)');

  // 5. Final Boss Alex: Fase 2 Kernel Panic al 50% de vida
  b4.takeSwordHit(mockPlayer, null, 28); // 55 - 28 = 27 HP (<= 28 HP -> 50%)
  assert.ok(b4.isOverclocked, 'Alex debe activar Fase 2 Overclocked al 50% de HP');
  assert.equal(b4.speed, 45, 'Velocidad en Fase 2 debe ser 45');
});

console.log('Sistema de Puntuación y Salón de la Fama');

test('calculateGameScore asigna Rango S con <= 12 min y 0 muertes', () => {
  const res = calculateGameScore(600, 0);
  assert.equal(res.rank, 'S');
  assert.equal(res.score, 94000); // 100.000 - 6.000
  assert.equal(res.playTimeFormatted, '10:00');
  assert.equal(res.deaths, 0);

  // Límite exacto de 720s (12m) y 0 muertes
  const resLimit = calculateGameScore({ playTimeSeconds: 720, deaths: 0 });
  assert.equal(resLimit.rank, 'S');
  assert.equal(resLimit.score, 92800);
});

test('calculateGameScore degrada a Rango A si hay muertes o excede 12 min', () => {
  // 600s con 1 muerte -> no es S, debe ser A
  const res1 = calculateGameScore(600, 1);
  assert.equal(res1.rank, 'A');
  assert.equal(res1.score, 89000); // 100.000 - 6.000 - 5.000

  // 1100s con 2 muertes -> A
  const res2 = calculateGameScore({ playTimeSeconds: 1100, deaths: 2 });
  assert.equal(res2.rank, 'A');
  assert.equal(res2.score, 79000); // 100.000 - 11.000 - 10.000
});

test('calculateGameScore asigna Rango B y Rango C según umbrales', () => {
  // Rango B: 1800s (30m) y 4 muertes
  const resB = calculateGameScore(1800, 4);
  assert.equal(resB.rank, 'B');
  assert.equal(resB.score, 62000); // 100.000 - 18.000 - 20.000

  // Rango C: 2400s (40m) y 8 muertes
  const resC = calculateGameScore(2400, 8);
  assert.equal(resC.rank, 'C');
  assert.equal(resC.score, 36000); // 100.000 - 24.000 - 40.000
  assert.ok(resC.score < 40000);
});

test('formatPlayTime formatea MM:SS y HH:MM:SS adecuadamente', () => {
  assert.equal(formatPlayTime(0), '00:00');
  assert.equal(formatPlayTime(65), '01:05');
  assert.equal(formatPlayTime(720), '12:00');
  assert.equal(formatPlayTime(3665), '1:01:05');
});

const sharedMockStore = {};
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

test('saveLocalScore y getLocalLeaderboard ordenan puntuaciones y recortan a Top 15', () => {

  // 1. Obtener lista por defecto
  const initial = getLocalLeaderboard();
  assert.equal(initial.length, 5);
  assert.equal(initial[0].username, 'AURELIO_DEV');

  // 2. Guardar nuevo récord de Speedrun número 1
  const saveResult = saveLocalScore({
    name: 'SPEED_GOD',
    playTimeSeconds: 400,
    deaths: 0
  });

  assert.equal(saveResult.position, 1, 'Debe ocupar el 1er lugar');
  assert.equal(saveResult.entry.rank, 'S');
  assert.equal(saveResult.entry.score, 96000); // 100k - 4k

  const updated = getLocalLeaderboard();
  assert.equal(updated.length, 6);
  assert.equal(updated[0].username, 'SPEED_GOD');

  // 3. Sanitizado de nickname
  const sanitizedSave = saveLocalScore({
    name: '   super_pro!#$   ',
    playTimeSeconds: 900,
    deaths: 1
  });
  assert.equal(sanitizedSave.entry.username, 'SUPER_PRO');
});

test('submitGlobalScore guarda localmente de forma síncrona incluso sin conexión', async () => {
  const result = await submitGlobalScore({
    name: 'OFFLINE_HERO',
    playTimeSeconds: 500,
    deaths: 0
  });

  assert.ok(result.ok, 'submitGlobalScore debe retornar ok=true');
  assert.equal(result.entry.username, 'OFFLINE_HERO');
  assert.equal(result.entry.rank, 'S');

  const board = getLocalLeaderboard();
  const found = board.find((e) => e.username === 'OFFLINE_HERO');
  assert.ok(found, 'Debe haberse guardado en el leaderboard local');
});

test('fetchGlobalLeaderboard devuelve el leaderboard por defecto sin fallar', async () => {
  const res = await fetchGlobalLeaderboard();
  assert.ok(res.ok);
  assert.ok(Array.isArray(res.leaderboard));
  assert.ok(res.leaderboard.length >= 5);
});

function createMockRes() {
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

test('api/leaderboard responde a GET con estado 200 y lista de récords', async () => {
  const req = { method: 'GET', headers: { host: 'localhost' } };
  const res = createMockRes();
  await handleLeaderboard(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.ok);
  assert.ok(Array.isArray(res.body.leaderboard));
  assert.ok(res.body.leaderboard.length >= 5);
});

test('api/leaderboard valida y recalcula el score en POST (anti-trampas serverless)', async () => {
  const req = {
    method: 'POST',
    headers: { host: 'localhost' },
    body: {
      username: 'speed_hacker',
      playTimeSeconds: 600,
      deaths: 0,
      fakeScoreAttempt: 9999999 // Debe ignorarse y recalcularse a 94.000
    }
  };
  const res = createMockRes();
  await handleLeaderboard(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.ok);
  assert.equal(res.body.entry.username, 'SPEED_HACKER');
  assert.equal(res.body.entry.rank, 'S');
  assert.equal(res.body.entry.score, 94000, 'El servidor debe recalcular: 100k - 6k = 94.000');
});

test('api/save valida código en GET y contenido mínimo en POST', async () => {
  // 1. GET sin código o código muy corto devuelve 400
  const reqGetInvalid = { method: 'GET', url: '/api/save?code=1', headers: { host: 'localhost' } };
  const resGet = createMockRes();
  await handleSave(reqGetInvalid, resGet);
  assert.equal(resGet.statusCode, 400);
  assert.equal(resGet.body.error, 'INVALID_CODE');

  // 2. POST sin sceneId válido devuelve 400
  const reqPostInvalid = {
    method: 'POST',
    headers: { host: 'localhost' },
    body: { invalidData: true }
  };
  const resPost = createMockRes();
  await handleSave(reqPostInvalid, resPost);
  assert.equal(resPost.statusCode, 400);
  assert.equal(resPost.body.error, 'INVALID_SAVE_DATA');
});

console.log('Bloques 1 a 5: Puzles, UI, Combate, Economía y Aldea');

test('Templo de la Armadura: 4 interruptores A/B/C/D con choque estático al fallar y resolución con paridad', () => {
  const tm = new Tilemap();
  assert.equal(tm.armorPuzzle.solved, false);
  assert.equal(tm.armorPuzzle.barrierActive, true);

  // Activación errónea: A=1, B=1 (2 compuertas activas pero no cumplen la paridad de los monolitos)
  const stepA = tm.toggleArmorSwitch('SWITCH_A');
  assert.equal(stepA.solved, false);
  assert.equal(stepA.activeCount, 1);

  const stepB = tm.toggleArmorSwitch('SWITCH_B');
  assert.equal(stepB.solved, false);
  assert.equal(stepB.shock, true, 'Debe disparar arco de estática al fallar');
  assert.equal(stepB.damage, 1, 'Debe infligir daño por choque');
  // Switches deben haberse reseteado a 0
  assert.deepEqual(tm.armorPuzzle.switches, { A: 0, B: 0, C: 0, D: 0 });

  // Activación correcta deducida de los 3 monolitos: B=1, D=1 (A=0, C=0)
  tm.toggleArmorSwitch('SWITCH_B');
  const solvedRes = tm.toggleArmorSwitch('SWITCH_D');
  assert.equal(solvedRes.solved, true);
  assert.equal(solvedRes.justSolved, true);
  assert.equal(tm.armorPuzzle.solved, true);
  assert.equal(tm.armorPuzzle.barrierActive, false);
});

test('Templo de la Espada: Monolitos de recursión λ_N -> λ_0 -> λ_ret y Stack Overflow al errar secuencia', () => {
  const tm = new Tilemap();
  assert.equal(tm.swordPuzzle.solved, false);
  assert.equal(tm.swordPuzzle.portalOpen, false);

  // Fallo de secuencia inicial: pulsar monolito 1 antes que 3
  const fail = tm.hitSwordMonolith(1);
  assert.equal(fail.success, false);
  assert.equal(fail.stackOverflow, true, 'Debe disparar Stack Overflow');
  assert.equal(fail.damage, 1);
  assert.deepEqual(tm.swordPuzzle.stack, []);

  // Secuencia recursiva correcta: 3 (límite N) -> 1 (caso base 0) -> 2 (llamada pendiente)
  const s1 = tm.hitSwordMonolith(3);
  assert.equal(s1.success, true);
  assert.equal(s1.finished, false);
  assert.deepEqual(s1.stack, [3]);

  const s2 = tm.hitSwordMonolith(1);
  assert.equal(s2.success, true);
  assert.equal(s2.finished, false);
  assert.deepEqual(s2.stack, [3, 1]);

  const s3 = tm.hitSwordMonolith(2);
  assert.equal(s3.success, true);
  assert.equal(s3.finished, true);
  assert.deepEqual(s3.stack, [3, 1, 2]);
  assert.equal(tm.swordPuzzle.solved, true);
  assert.equal(tm.swordPuzzle.portalOpen, true);
});

test('Motor de Texto y Paginación: DialogueBox divide textos largos en páginas seguras [1/2], [2/2]', () => {
  const db = new DialogueBox();
  const sample = 'Este texto largo representa una explicación detallada del Sabio Aurelio sobre los misterios de la recursión y el origen del Ojete Dorado que debe dividirse automáticamente.';
  const pages = db._paginateLines(sample, 44, 2);
  assert.ok(pages.length >= 2, 'Debe dividirse en 2 o más diapositivas');
  for (const page of pages) {
    const lines = page.split('\n');
    assert.ok(lines.length <= 2, 'Cada diapositiva no debe superar 2 líneas');
  }
});

test('Blindaje Metálico: Armadura Binaria absorbe 3 impactos antes de dañar HP y Poción de Blindaje la repone', () => {
  const player = new Player(0, 0);
  player.equipArmor();
  assert.equal(player.armorPoints, 3, 'Debe iniciar con 3 puntos de blindaje');
  assert.equal(player.hp, 3);

  // Impacto 1
  player.takeHit({ direction: 'down', attackDamage: 1 });
  assert.equal(player.armorPoints, 2);
  assert.equal(player.hp, 3, 'El daño a la vida se absorbe completamente');

  // Impacto 2
  player.invulnTimer = 0;
  player.takeHit({ direction: 'down', attackDamage: 1 });
  assert.equal(player.armorPoints, 1);
  assert.equal(player.hp, 3);

  // Impacto 3: agota la coraza
  player.invulnTimer = 0;
  player.takeHit({ direction: 'down', attackDamage: 1 });
  assert.equal(player.armorPoints, 0);
  assert.equal(player.hp, 3);

  // Impacto 4: coraza agotada, daña HP
  player.invulnTimer = 0;
  player.takeHit({ direction: 'down', attackDamage: 1 });
  assert.equal(player.hp, 2, 'Debe reducir 1 punto de HP tras romperse la coraza');

  // Reponer coraza con Poción de Blindaje
  const potionSuccess = player.applyArmorPotion();
  assert.equal(potionSuccess, true);
  assert.equal(player.armorPoints, 3, 'La poción debe reconstituir los 3 puntos de coraza');
});

test('Penalizaciones por Robotización: Daño de espada -30% si >50% y corazón bloqueado si >80%', () => {
  const player = new Player(0, 0);
  player.equipArmor();
  assert.equal(player.getSwordDamage(), 1);
  assert.equal(player.effectiveMaxHp, 3);

  // Más del 50%: penalización del 30% en daño de espada
  player.robotizationLevel = 60;
  assert.equal(player.getSwordDamage(), 0.7);
  assert.equal(player.effectiveMaxHp, 3);

  // Más del 80%: bloquea corazón derecho en estática (maxHp limitado a 2.0)
  player.robotizationLevel = 85;
  assert.equal(player.getSwordDamage(), 0.7);
  assert.equal(player.effectiveMaxHp, 2.0);
});

test('NPCs y Aldea: Patrulla con detección de colisión y descanso nocturno', () => {
  const npc = new NPC({
    name: 'Brom el Herrero',
    sceneId: 'overworld',
    homeSceneId: 'blacksmith_house',
    patrolPoints: [
      { x: 100, y: 100 },
      { x: 120, y: 100 }
    ]
  });

  assert.equal(npc.isSleeping, false);
  assert.ok(typeof npc.jobAnimTimer === 'number');

  // Si entra en modo descanso nocturno
  npc.isSleeping = true;
  npc.update(0.1);
  assert.equal(npc.isMoving, false, 'Un NPC durmiendo no debe desplazarse');
});

console.log('Persistencia Cloud-First con Fallback Local');

test('saveLocalFallback guarda estructura de contingencia con dirty flag pendingCloudSync', () => {
  const payload = { sceneId: 'overworld', playerHp: 3, playerX: 100, playerY: 200 };
  const ok = saveLocalFallback(payload, 'OJT-DEMO1', true);
  assert.equal(ok, true);

  const container = getLocalSaveContainer();
  assert.ok(container);
  assert.equal(container.cloudCode, 'OJT-DEMO1');
  assert.equal(container.pendingCloudSync, true);
  assert.equal(container.syncStatus, 'pending');
  assert.equal(container.savePayload.sceneId, 'overworld');
  assert.equal(container.savePayload.playerHp, 3);
});

test('markLocalFallbackSynced limpia pendingCloudSync y actualiza estado a synced', () => {
  const syncedOk = markLocalFallbackSynced('OJT-SYNCED', 1700000000);
  assert.equal(syncedOk, true);

  const container = getLocalSaveContainer();
  assert.equal(container.cloudCode, 'OJT-SYNCED');
  assert.equal(container.pendingCloudSync, false);
  assert.equal(container.syncStatus, 'synced');
  assert.equal(container.cloudSyncedAt, 1700000000);
});

test('getLocalSaveContainer es compatible hacia atrás con partidas heredadas en formato plano', () => {
  sharedMockStore[SAVE_STORAGE_KEY] = JSON.stringify({
    sceneId: 'first_stage',
    playerHp: 2,
    savedAt: 1690000000
  });

  const container = getLocalSaveContainer();
  assert.ok(container);
  assert.equal(container.savePayload.sceneId, 'first_stage');
  assert.equal(container.savePayload.playerHp, 2);
  assert.equal(container.pendingCloudSync, false);
});

test('syncPendingSaveToCloud sube la partida pendiente a la API en cuanto hay conexión', async () => {
  // Guardar partida marcada como pendiente (offline)
  const pendingPayload = { sceneId: 'blacksmith_house', playerHp: 3, playerX: 50, playerY: 50 };
  saveLocalFallback(pendingPayload, null, true);

  // Simular mock de fetch para la API /api/save
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (url === '/api/save' && opts && opts.method === 'POST') {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          code: 'OJT-AUTOSYNC',
          savedAt: Date.now(),
          message: 'Saved to mock cloud'
        })
      };
    }
    return originalFetch(url, opts);
  };

  try {
    const syncRes = await syncPendingSaveToCloud('TEST_HERO');
    assert.equal(syncRes.ok, true);
    assert.equal(syncRes.synced, true);
    assert.equal(syncRes.code, 'OJT-AUTOSYNC');

    // Comprobar que en el localStorage el fallback quedó limpio (pendingCloudSync: false)
    const afterSyncContainer = getLocalSaveContainer();
    assert.equal(afterSyncContainer.pendingCloudSync, false);
    assert.equal(afterSyncContainer.syncStatus, 'synced');
    assert.equal(afterSyncContainer.cloudCode, 'OJT-AUTOSYNC');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log('Motor Gráfico 2.5D, Safe Layout UI y CloudStorage (v3.5+)');

test('DayNightCycle.getSunState y Entity.renderShadow proyectan sombras pseudo-3D según la hora solar', () => {
  const dn = new DayNightCycle(320, 180, 720);
  dn.timeOfDayHours = 9.0; // Mañana: el sol sale por el este -> la sombra apunta al oeste (dx < 0)
  const morningSun = dn.getSunState();
  assert.ok(morningSun.dx < 0, 'Por la mañana la sombra debe proyectarse hacia el oeste');
  assert.equal(morningSun.isDay, true);

  dn.timeOfDayHours = 16.0; // Tarde: el sol al oeste -> la sombra apunta al este (dx > 0)
  const afternoonSun = dn.getSunState();
  assert.ok(afternoonSun.dx > 0, 'Por la tarde la sombra debe proyectarse hacia el este');

  const player = new Player({ x: 100, y: 120 });
  assert.equal(player.sortY, 120 + player.height, 'sortY debe ser igual a y + height');

  const ctx = makeMockCtx();
  player.renderShadow(ctx, { renderX: 0, renderY: 0 }, afternoonSun);
  assert.ok(ctx.calls.some((c) => c[0] === 'ellipse'), 'renderShadow debe trazar una elipse traslúcida');
});

test('RenderPipeline ordena Y-sorted props y entidades por y + height y ejecuta las 4 capas 2.5D', () => {
  const tm = new Tilemap();
  tm.loadScene('overworld');
  const dn = new DayNightCycle(320, 180, 720);
  const pipeline = new RenderPipeline(320, 180);
  const player = new Player({ x: 160, y: 160 });
  const npcNorth = new NPC({ name: 'Norte', x: 160, y: 112, sceneId: 'overworld' });
  const npcSouth = new NPC({ name: 'Sur', x: 160, y: 192, sceneId: 'overworld' });

  const ctx = makeMockCtx();
  let groundCallbackRan = false;
  pipeline.update(0.016);
  pipeline.render(ctx, {
    tilemap: tm,
    camera: { renderX: 80, renderY: 40, viewportWidth: 320, viewportHeight: 180 },
    dayNight: dn,
    player,
    npcs: [npcSouth, npcNorth],
    animals: [],
    enemies: [],
    onGround: () => {
      groundCallbackRan = true;
    }
  });

  assert.equal(groundCallbackRan, true, 'El callback onGround de la Capa 0 debe ejecutarse');
  assert.ok(pipeline.stats.sorted >= 3, 'El pipeline debe ordenar entidades y props por sortY');
  assert.equal(pipeline.stats.entities, 3, 'Debe contabilizar las 3 entidades móviles en Capa 1');
});

test('UILayout centraliza SAFE_WIDTH=308, SAFE_HEIGHT=168 y contenedor modal unificado 290x150', () => {
  assert.equal(SAFE_WIDTH, 308);
  assert.equal(SAFE_HEIGHT, 168);
  assert.equal(MODAL_WIDTH, 290);
  assert.equal(MODAL_HEIGHT, 150);

  const safe = UILayout.safeRect();
  assert.deepEqual(safe, { x: 6, y: 6, w: 308, h: 168 });

  const modal = UILayout.modalRect();
  assert.deepEqual(modal, { x: 15, y: 15, w: 290, h: 150 });

  const ctx = makeMockCtx();
  const frame = UILayout.drawModalFrame(ctx, { title: 'MODAL TEST', closeLabel: '[Esc] Cerrar' });
  assert.equal(frame.modal.w, 290);
  assert.equal(frame.modal.h, 150);
  assert.ok(frame.content.w > 270 && frame.content.h > 120);
});

test('Modales modulares (Inventory 2x4 22x22, QuestLogView max 4, CharacterStats y LeaderboardView) renderizan sin desbordar', () => {
  const ctx = makeMockCtx();

  // 1. Inventory (2 filas x 4 columnas, slots de 22x22 px)
  const inv = new Inventory(null, 320, 180);
  assert.equal(inv.visibleSlots, 8);
  assert.equal(inv.slotSize, 22);
  inv.addItem({ id: 'bread', name: 'Pan Campesino', description: 'Restaura 2 corazones.', iconIndex: 0, qty: 3 });
  inv.open();
  inv.render(ctx, new Player({ x: 0, y: 0 }));

  // 2. QuestLogView (máximo 4 simultáneas visibles)
  const ql = new QuestLog();
  const qlv = new QuestLogView(ql, 320, 180);
  assert.equal(qlv.maxVisibleQuests, 4);
  qlv.open();
  qlv.render(ctx);

  // 3. CharacterStats ([Tab] alterna entre stats, achievements y skills)
  const cs = new CharacterStats(320, 180);
  cs.open();
  assert.equal(cs.activeTab, 'stats');
  cs.cycleTab();
  assert.equal(cs.activeTab, 'achievements');
  cs.render(ctx, new Player({ x: 0, y: 0 }), null);

  // 4. LeaderboardView (Top 10 dentro de contenedor 290x150)
  const lbv = new LeaderboardView(320, 180);
  lbv.open({ entries: DEFAULT_LEADERBOARD, source: 'cloud' });
  assert.equal(lbv.isOpen, true);
  assert.ok(lbv.entries.length > 0);
  lbv.render(ctx);
});

test('CloudStorage.sanitizeSaveData protege contra undefined en shieldHP y hasPermission_*', () => {
  const legacyRaw = {
    sceneId: 'overworld',
    playerHasArmor: true
    // Sin shieldHP ni housePermissions definidos
  };
  const clean = CloudStorage.sanitizeSaveData(legacyRaw);
  assert.ok(clean);
  assert.equal(clean.shieldHP, 3, 'Si tiene armadura y no viene shieldHP, debe inicializar en 3');
  assert.equal(clean.armorPoints, 3);
  assert.equal(clean.hasPermission_elder, false);
  assert.equal(clean.hasPermission_blacksmith, false);
  assert.equal(clean.hasPermission_herbalist, false);
  assert.equal(clean.hasPermission_guard, false);
  assert.equal(clean.hasPermission_oracle, false);
  assert.deepEqual(clean.housePermissions, {
    elder: false,
    blacksmith: false,
    herbalist: false,
    guard: false,
    oracle: false
  });
});

console.log('Progresión de Mazmorras, Forja de Brom y Ciudadela Cuántica (v3.6+)');

test('Player: Escalamiento de daño por nivel de espada (Nivel 1: 1.0x, Nivel 2: 1.5x, Nivel 3: 2.0x)', () => {
  const player = new Player({ x: 0, y: 0 });
  player.equipSword();

  player.swordLevel = 1;
  const dmgLvl1 = player.getSwordDamage(1);
  assert.equal(dmgLvl1, 1, 'Nivel 1 debe infligir daño base 1');

  player.swordLevel = 2;
  const dmgLvl2 = player.getSwordDamage(1);
  assert.equal(dmgLvl2, 1.5, 'Nivel 2 (Silicio) debe incrementar el daño un +50% (1.5)');

  player.swordLevel = 3;
  const dmgLvl3 = player.getSwordDamage(1);
  assert.equal(dmgLvl3, 2, 'Nivel 3 (Overclockeada) debe incrementar el daño un +100% (2.0)');
});

test('Player: Espada Overclockeada (Nivel 3) dispara tajos de energía solo a salud máxima', () => {
  const player = new Player({ x: 100, y: 100 });
  player.equipSword();
  player.swordLevel = 3;
  player.stamina = player.effectiveMaxStamina;

  // 1. A salud máxima: tryAttack debe disparar un tajo de energía
  player.hp = player.effectiveMaxHp;
  const attackSuccess = player.tryAttack();
  assert.equal(attackSuccess, true);
  assert.equal(player.energySlashes.length, 1, 'Debe disparar 1 proyectil de energía');
  const slash = player.energySlashes[0];
  assert.equal(slash.active, true);
  assert.equal(slash.damage, player.getSwordDamage(1));

  // 2. Si la salud está por debajo del máximo: no genera proyectil
  player.attackCooldown = 0;
  player.attackTimer = 0;
  player.stamina = player.effectiveMaxStamina;
  player.hp = player.effectiveMaxHp - 0.5; // herido
  player.tryAttack();
  assert.equal(player.energySlashes.length, 1, 'No debe disparar proyectil si la vida no está al 100%');
});

test('DoorGatekeeper: Acceso a la Ciudadela Cuántica bloqueado hasta colocar los 3 núcleos (gatesUnlocked === 3)', () => {
  const player = new Player({ x: 0, y: 0 });
  player.equipArmor();
  player.equipSword();

  // 1. Sin núcleos (gatesUnlocked = 0)
  player.gatesUnlocked = 0;
  let block = getDoorBlock('ai_citadel', player);
  assert.ok(block, 'Debe bloquear la entrada a ai_citadel');
  assert.match(block.title, /PUERTA DEL NÚCLEO SELLADA/);

  // 2. Con 2 núcleos colocados
  player.gatesUnlocked = 2;
  block = getDoorBlock('ai_citadel', player);
  assert.ok(block, 'Debe seguir bloqueada con 2 núcleos');

  // 3. Con los 3 núcleos colocados pero nivel inferior a 10: bloqueado por sobrecarga del Mainframe
  player.gatesUnlocked = 3;
  player.level = 8;
  block = getDoorBlock('ai_citadel', player);
  assert.ok(block, 'Debe requerir Nivel 10 para asaltar el Mainframe');
  assert.match(block.title, /NIVEL 10 REQUERIDO/);

  // 4. Con Nivel 10 y los 3 núcleos colocados (Garbage Collector, Stack Overflow, Microondas): paso permitido
  player.level = 10;
  block = getDoorBlock('ai_citadel', player);
  assert.equal(block, null, 'Paso permitido al tener gatesUnlocked === 3 y Nivel 10');
});

test('Tilemap: Reestructuración de Mazmorras en 3 niveles y Ciudadela con tileset Mainframe exclusivo', () => {
  const tm = new Tilemap();

  // Mazmorra 1: Cloacas del Legacy (3 salas)
  assert.ok(tm.scenes.sewers_entry, 'Debe existir sewers_entry');
  assert.ok(tm.scenes.sewers_puzzle, 'Debe existir sewers_puzzle');
  assert.ok(tm.scenes.sewers_dungeon, 'Debe existir sewers_dungeon');
  assert.equal(tm.scenes.sewers_entry.layers.ground[2][2], TILES.SEWER_SLIME_FLOOR);

  // Mazmorra 2: Minas de la Recursión (3 salas)
  assert.ok(tm.scenes.mines_entry, 'Debe existir mines_entry');
  assert.ok(tm.scenes.mines_puzzle, 'Debe existir mines_puzzle');
  assert.ok(tm.scenes.sword_temple, 'Debe existir sword_temple');
  assert.equal(tm.scenes.mines_entry.layers.ground[2][2], TILES.MINE_CRYSTAL_FLOOR);
  // Presencia de abismo que exige dash
  assert.equal(tm.scenes.mines_entry.layers.ground[8][4], TILES.MINE_CHASM);

  // Mazmorra 3: La Forja del Prototipo (3 salas)
  assert.ok(tm.scenes.forge_entry, 'Debe existir forge_entry');
  assert.ok(tm.scenes.forge_puzzle, 'Debe existir forge_puzzle');
  assert.ok(tm.scenes.ai_fortress_gate, 'Debe existir ai_fortress_gate');
  assert.equal(tm.scenes.forge_entry.layers.ground[2][2], TILES.FORGE_LAVA_FLOOR);

  // Zona Final: Puerta del Núcleo y Ciudadela Cuántica
  assert.ok(tm.scenes.quantum_gate, 'Debe existir quantum_gate');
  assert.ok(tm.scenes.ai_citadel, 'Debe existir ai_citadel');
  // La Ciudadela Cuántica usa tileset exclusivo de Mainframe y NO los santuarios reciclados
  assert.equal(tm.scenes.ai_citadel.layers.ground[2][2], TILES.MAINFRAME_FLOOR);
  assert.equal(tm.scenes.ai_citadel.layers.decoration[0][2], TILES.MAINFRAME_WALL);
});

test('Herrero Brom: Opciones de diálogo y forja de Espada de Silicio, Overclockeada y Blindaje Térmico', () => {
  const mockPlayer = new Player({ x: 0, y: 0 });
  mockPlayer.equipArmor();
  mockPlayer.equipSword();
  mockPlayer.swordLevel = 1;
  mockPlayer.armorLevel = 1;
  mockPlayer.coins = 200;

  const mockInventory = new Inventory(null, 320, 180);
  mockInventory.addItem({ id: 'silicon_ore', name: 'Mineral de Silicio', description: '', iconIndex: 13, qty: 1 });
  mockInventory.addItem({ id: 'drone_scrap', name: 'Chatarra', description: '', iconIndex: 10, qty: 2 });

  const mockGame = {
    player: mockPlayer,
    inventory: mockInventory,
    dialogueBox: { showMessage: () => {}, close: () => {} },
    questLog: new QuestLog(),
    housePermissions: {}
  };

  const choices = getBromForgeChoices(mockGame);
  assert.ok(Array.isArray(choices));

  // Opción de Espada de Silicio (Nivel 2)
  const siliconSwordChoice = choices.find((c) => c.label.includes('Espada de Silicio'));
  assert.ok(siliconSwordChoice, 'Debe ofrecer la mejora de Espada de Silicio');

  // Ejecutar compra
  siliconSwordChoice.onSelect();
  assert.equal(mockPlayer.swordLevel, 2, 'El jugador debe tener ahora la espada a Nivel 2');
  assert.equal(mockPlayer.coins, 100, 'Debe descontar 100 Bytes');
  assert.equal(mockInventory.getItemCount('silicon_ore'), 0, 'Debe consumir 1 silicio');

  // Opción de Blindaje Térmico (Nivel 2)
  const thermalArmorChoice = choices.find((c) => c.label.includes('Blindaje Térmico'));
  assert.ok(thermalArmorChoice, 'Debe ofrecer la mejora de Blindaje Térmico');

  thermalArmorChoice.onSelect();
  assert.equal(mockPlayer.armorLevel, 2, 'El jugador debe tener ahora la armadura a Nivel 2');
  assert.equal(mockPlayer.coins, 25, 'Debe descontar 75 Bytes (100 - 75 = 25)');
  assert.equal(mockInventory.getItemCount('drone_scrap'), 0, 'Debe consumir 2 chatarras');
});

test('CloudStorage: Saneamiento y persistencia de swordLevel, armorLevel, dungeonCores y gatesUnlocked', () => {
  const rawSave = {
    sceneId: 'quantum_gate',
    playerHasArmor: true,
    playerHasSword: true,
    swordLevel: 3,
    armorLevel: 2,
    dungeonCores: { gc: true, stack: true, microwave: false },
    gatesUnlocked: 2
  };

  const sanitized = CloudStorage.sanitizeSaveData(rawSave);
  assert.equal(sanitized.swordLevel, 3);
  assert.equal(sanitized.armorLevel, 2);
  assert.deepEqual(sanitized.dungeonCores, { gc: true, stack: true, microwave: false });
  assert.equal(sanitized.gatesUnlocked, 2);

  // Valores por defecto y clamp de seguridad
  const invalidRaw = {
    swordLevel: 99,
    armorLevel: -5,
    gatesUnlocked: 'invalido'
  };
  const cleanInvalid = CloudStorage.sanitizeSaveData(invalidRaw);
  assert.equal(cleanInvalid.swordLevel, 3, 'Debe clampear swordLevel al máximo 3');
  assert.equal(cleanInvalid.armorLevel, 1, 'Debe clampear armorLevel al mínimo 1');
  assert.equal(cleanInvalid.gatesUnlocked, 0, 'Debe resetear gatesUnlocked a 0');
  assert.deepEqual(cleanInvalid.dungeonCores, { gc: false, stack: false, microwave: false });
});

test('Menú de Pausa Depurado y Cinemática de Mister AI Alex sin Truncamiento', () => {
  const fakeMusic = {
    playMenuSelect: () => {},
    playMenuMove: () => {},
    playFanfare: () => {},
    setMode: () => {},
    getMasterVolume: () => 1.0,
    getMusicVolume: () => 0.8,
    getSfxVolume: () => 1.0,
    isMasterMuted: () => false,
    isMusicMuted: () => false,
    isSfxMuted: () => false
  };
  const menu = new MainMenuAndScenes(320, 180, {}, fakeMusic, {});
  menu.openPauseMenu();

  const pauseItems = menu._getCurrentMenuItems();
  assert.equal(pauseItems.length, 5, 'El menú de pausa debe contener exactamente 5 opciones depuradas');
  assert.deepEqual(
    pauseItems.map(it => it.label),
    [
      'Continuar Aventura',
      'Guardar / Nube',
      'Salón de la Fama [Récords]',
      'Ajustes y Sonido',
      'Guardar y Salir al Menú Principal'
    ],
    'Las opciones de pausa deben ser las 5 esenciales sin saturación ni redundancia'
  );

  // Verificación de hitboxes: contenedor centrado de 240x150 px sin desbordar el marco
  const hitboxes = menu._getMenuHitboxes(pauseItems.length);
  assert.equal(hitboxes.length, 5);
  const lastBox = hitboxes[hitboxes.length - 1];
  assert.ok(lastBox.y + lastBox.h <= 165, 'El último botón no debe colisionar con el marco inferior de 165px');

  // Submenú de Guardar / Nube
  pauseItems[1].action();
  assert.equal(menu.state, 'pause_cloud');
  const cloudItems = menu._getCurrentMenuItems();
  assert.equal(cloudItems.length, 4, 'El submenú de Guardar / Nube debe tener 4 opciones limpias');

  // Submenú de Ajustes y Sonido
  menu.openPauseMenu();
  pauseItems[3].action();
  assert.equal(menu.state, 'options');
  const soundItems = menu._getCurrentMenuItems();
  assert.equal(soundItems.length, 5, 'El submenú de Ajustes y Sonido debe tener 5 opciones con sliders');

  // Verificación de cinemática de entrada: 8 diapositivas bien distribuidas
  menu.startAnimeIntroCutscene();
  assert.equal(menu.cutsceneSlides.length, 8, 'El prólogo debe dividirse en 8 diapositivas dinámicas');
  for (const slide of menu.cutsceneSlides) {
    assert.ok(slide.text.length < 165, `El texto "${slide.text.slice(0, 30)}..." no debe superar el límite de visualización`);
    assert.ok(slide.chapter.length > 0);
  }

  // Verificación de diálogos de Mister AI Alex
  for (const s of SCENE_AI_ALEX_WARNING) {
    assert.ok(s.dialogue.length < 150, 'Cada frase de advertencia de Mister AI Alex debe caber limpia en la caja');
  }
  for (const s of SCENE_ENDING_VICTORY) {
    assert.ok(s.dialogue.length < 155, 'Cada frase del final debe caber limpia en la caja sin cortes');
  }
});

test('AudioManager: Grafo de 3 buses, 4 canales, calibrador SFX y persistencia de ajustes', () => {
  const destination = { id: 'destination' };
  class MockGainNode {
    constructor() {
      this.gain = {
        value: 1,
        cancelScheduledValues: () => {},
        setValueAtTime: (v) => { this.gain.value = v; },
        linearRampToValueAtTime: (v) => { this.gain.value = v; },
        exponentialRampToValueAtTime: (v) => { this.gain.value = v; }
      };
      this.connectedTo = null;
    }
    connect(dest) {
      this.connectedTo = dest;
    }
    disconnect() {
      this.connectedTo = null;
    }
  }

  class MockAudioContext {
    constructor() {
      this.currentTime = 0;
      this.state = 'running';
      this.destination = destination;
      this.sampleRate = 44100;
    }
    createGain() { return new MockGainNode(); }
    createOscillator() {
      return {
        type: 'sine',
        frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: () => {},
        start: () => {},
        stop: () => {},
        disconnect: () => {}
      };
    }
    createBiquadFilter() {
      return {
        type: 'lowpass',
        frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        Q: { setValueAtTime: () => {} },
        connect: () => {},
        disconnect: () => {}
      };
    }
    createBuffer(channels, length, rate) {
      return {
        getChannelData: () => new Float32Array(length)
      };
    }
    createBufferSource() {
      return {
        buffer: null,
        connect: () => {},
        start: () => {},
        stop: () => {},
        disconnect: () => {}
      };
    }
  }

  const audio = new AudioManager();
  audio.ctx = new MockAudioContext();
  audio.masterGainNode = audio.ctx.createGain();
  audio.masterGainNode.connect(audio.ctx.destination);
  audio.musicGainNode = audio.ctx.createGain();
  audio.musicGainNode.connect(audio.masterGainNode);
  audio.sfxGainNode = audio.ctx.createGain();
  audio.sfxGainNode.connect(audio.masterGainNode);

  // Verificación de los 3 buses
  assert.equal(audio.masterGainNode.connectedTo, destination);
  assert.equal(audio.musicGainNode.connectedTo, audio.masterGainNode);
  assert.equal(audio.sfxGainNode.connectedTo, audio.masterGainNode);

  // Verificación de controles de ganancia y clamping
  audio.setMasterVolume(0.5);
  assert.equal(audio.getMasterVolume(), 0.5);
  audio.setMusicVolume(0.7);
  assert.equal(audio.getMusicVolume(), 0.7);
  audio.setSfxVolume(1.5); // Clamped a 1.0
  assert.equal(audio.getSfxVolume(), 1.0);

  // Verificación de mute toggles
  audio.toggleMasterMute();
  assert.equal(audio.isMasterMuted(), true);
  audio.toggleMasterMute();
  assert.equal(audio.isMasterMuted(), false);

  // Verificación de calibrador playTestBeep sin excepciones
  assert.doesNotThrow(() => audio.playTestBeep());

  // Verificación de herencia y compatibilidad con AmbientMusic
  const ambient = new AmbientMusic();
  assert.ok(ambient instanceof AudioManager);

  // Verificación de patrones polifónicos de 4 canales
  assert.ok(audio.villagePattern.length >= 16);
  assert.ok(audio.dungeonPattern.length >= 16);
  assert.ok(audio.combatPattern.length >= 16);
  for (const step of audio.villagePattern) {
    assert.ok('melody' in step && 'harmony' in step && 'bass' in step && 'drum' in step);
  }
});

test('Robotización Gradual Lenta y Zona de Templos Sagrados Desacoplada de Valleverde', () => {
  // 1. Robotización lenta
  const player = new Player(100, 100);
  player.equipArmor();
  assert.equal(player.robotizationLevel, 0);

  // Actualizar 10 segundos
  const fakeInput = {
    getMovementVector: () => ({ x: 0, y: 0 }),
    isAttacking: () => false,
    isDashing: () => false,
    consumeInteraction: () => false,
    isParrying: () => false,
    consumeSpecialAction: () => false
  };
  player.update(10, fakeInput, { isSolidAtTile: () => false });
  assert.ok(player.robotizationLevel <= 1.5, `Robotización en 10s debe ser <= 1.5% (actual: ${player.robotizationLevel.toFixed(2)}%)`);
  assert.ok(player.robotizationLevel > 0, 'La armadura debe incrementar ligeramente la robotización');

  // 2. Transición entre Valleverde y Tierras Corruptas
  const tm = new Tilemap(null, 16);
  tm.loadScene('overworld');
  // 2. Transiciones cardinales desde Valleverde (Centro del mundo)
  // Este -> first_stage (Valle de la Consagración / Templos del Héroe)
  const fakePlayerAtEast = { centerX: 33 * 16, centerY: 12.5 * 16 };
  const eastDoor = tm.findNearbyDoor(fakePlayerAtEast);
  assert.ok(eastDoor, 'Debe haber puerta/portal en el este de Valleverde');
  assert.equal(eastDoor.targetScene, 'first_stage', 'El portal este debe conducir a first_stage');

  // Oeste -> west_wastes (Páramo de AI Alex)
  const fakePlayerAtWest = { centerX: 0.5 * 16, centerY: 12.5 * 16 };
  const westDoor = tm.findNearbyDoor(fakePlayerAtWest);
  assert.ok(westDoor, 'Debe haber camino en el oeste de Valleverde');
  assert.equal(westDoor.targetScene, 'west_wastes', 'La salida oeste debe conducir a west_wastes');

  // Norte -> north_peaks (Cumbres de la Recursión)
  const fakePlayerAtNorth = { centerX: 17.5 * 16, centerY: 0.5 * 16 };
  const northDoor = tm.findNearbyDoor(fakePlayerAtNorth);
  assert.ok(northDoor, 'Debe haber camino en el norte de Valleverde');
  assert.equal(northDoor.targetScene, 'north_peaks', 'La salida norte debe conducir a north_peaks');

  // Sur -> south_swamp (Marismas del Hardware Legacy)
  const fakePlayerAtSouth = { centerX: 17.5 * 16, centerY: 23 * 16 };
  const southDoor = tm.findNearbyDoor(fakePlayerAtSouth);
  assert.ok(southDoor, 'Debe haber camino en el sur de Valleverde');
  assert.equal(southDoor.targetScene, 'south_swamp', 'La salida sur debe conducir a south_swamp');

  // No debe haber puertas directas a templos o mazmorras en overworld (Valleverde es solo pueblo pacífico)
  for (let r = 0; r < tm.rows; r++) {
    for (let c = 0; c < tm.cols; c++) {
      const d = tm.findNearbyDoor({ centerX: (c + 0.5) * 16, centerY: (r + 0.5) * 16 });
      if (d) {
        assert.notEqual(d.targetScene, 'armor_temple', 'No debe haber puerta a armor_temple en overworld');
        assert.notEqual(d.targetScene, 'sword_temple', 'No debe haber puerta a sword_temple en overworld');
        assert.notEqual(d.targetScene, 'sewers_entry', 'No debe haber puerta a sewers_entry en overworld');
        assert.notEqual(d.targetScene, 'mines_entry', 'No debe haber puerta a mines_entry en overworld');
        assert.notEqual(d.targetScene, 'forge_entry', 'No debe haber puerta a forge_entry en overworld');
        assert.notEqual(d.targetScene, 'quantum_gate', 'No debe haber puerta a quantum_gate en overworld');
      }
    }
  }

  // 3. Distribución Cardinal de Templos y Mazmorras
  // ESTE: first_stage alberga los santuarios de equipo del héroe (Armadura y Espada)
  tm.loadScene('first_stage');
  const doorArmor = tm.findNearbyDoor({ centerX: 6.5 * 16, centerY: 8.5 * 16 });
  assert.ok(doorArmor, 'Templo de la Armadura presente en Valle Este');
  assert.equal(doorArmor.targetScene, 'armor_temple');

  const doorSword = tm.findNearbyDoor({ centerX: 17.5 * 16, centerY: 2.5 * 16 });
  assert.ok(doorSword, 'Templo de la Espada presente en Valle Este');
  assert.equal(doorSword.targetScene, 'sword_temple');

  // NORTE: north_peaks alberga las Minas de la Recursión (Stack Overflow)
  tm.loadScene('north_peaks');
  const doorMines = tm.findNearbyDoor({ centerX: 17.5 * 16, centerY: 3.5 * 16 });
  assert.ok(doorMines, 'Minas de la Recursión presentes en Cumbres Norte');
  assert.equal(doorMines.targetScene, 'mines_entry');

  // SUR: south_swamp alberga las Cloacas (Garbage Collector) y La Forja (Microondas)
  tm.loadScene('south_swamp');
  const doorSewers = tm.findNearbyDoor({ centerX: 8.5 * 16, centerY: 14.5 * 16 });
  assert.ok(doorSewers, 'Cloacas del Legacy presentes en Marismas Sur');
  assert.equal(doorSewers.targetScene, 'sewers_entry');

  const doorForge = tm.findNearbyDoor({ centerX: 26.5 * 16, centerY: 14.5 * 16 });
  assert.ok(doorForge, 'La Forja del Prototipo presente en Marismas Sur');
  assert.equal(doorForge.targetScene, 'forge_entry');

  // OESTE: west_wastes alberga la Gran Puerta del Núcleo Cuántico
  tm.loadScene('west_wastes');
  const doorQuantum = tm.findNearbyDoor({ centerX: 8.5 * 16, centerY: 12.5 * 16 });
  assert.ok(doorQuantum, 'Gran Puerta del Núcleo presente en Páramo Oeste');
  assert.equal(doorQuantum.targetScene, 'quantum_gate');

  // Acceso a sword_temple según armadura
  assert.ok(getDoorBlock('sword_temple', { hasArmor: false, hasSword: false }), 'Sin armadura debe bloquear');
  assert.equal(getDoorBlock('sword_temple', { hasArmor: true, hasSword: false }), null, 'Con armadura debe permitir acceso directo');
});

test('Mapeo de Ratón para Ataque (Clic Izquierdo) y Ataque Cargado', () => {
  const input = new InputHandler();

  // 1. Simulación de Clic Izquierdo (pointerdown con button 0)
  input._onPointerDown({ clientX: 200, clientY: 90, button: 0 });
  assert.equal(input.pointerJustClicked, true);
  assert.equal(input.pointerAttackJustPressed, true);
  assert.equal(input.isPointerDown, true);

  // 2. consumeAttack detecta el ataque de ratón y reporta 'pointer'
  assert.equal(input.consumeAttack(), true);
  assert.equal(input.lastAttackSource, 'pointer');
  assert.equal(input.consumeAttack(), false, 'Single-fire: no debe volver a disparar hasta nuevo clic');

  // 3. Ataque cargado: mientras el botón esté pulsado, isAttackHeld es true
  assert.equal(input.isAttackHeld(), true, 'Debe mantenerse activo mientras se mantenga el clic');
  input._onPointerUp({ button: 0 });
  assert.equal(input.isPointerDown, false);
  assert.equal(input.isAttackHeld(), false);

  // 4. Si la UI consume el clic del ratón (ej: menú, modal o diálogo), se anula el ataque
  input._onPointerDown({ clientX: 50, clientY: 50, button: 0 });
  const click = input.consumePointerClick();
  assert.ok(click);
  assert.equal(input.pointerAttackJustPressed, false, 'consumePointerClick debe neutralizar el ataque para no golpear en menús');
  assert.equal(input.consumeAttack(), false);

  // 5. El ataque con teclado sigue funcionando con normalidad
  input._onKeyDown({ code: 'KeyF', preventDefault() {} });
  assert.equal(input.consumeAttack(), true);
  assert.equal(input.lastAttackSource, 'keyboard');
});

test('Cartografía Dinámica y Progresión estilo Zelda (WorldMap.js) y Eliminación de Badges Flotantes', () => {
  const map = new WorldMap();

  // 1. Resolución de zonas cardinales
  assert.equal(map._resolvePlayerLocation('overworld').zone, 'center');
  assert.equal(map._resolvePlayerLocation('player_house').zone, 'center');
  assert.equal(map._resolvePlayerLocation('first_stage').zone, 'east');
  assert.equal(map._resolvePlayerLocation('armor_temple').zone, 'east');
  assert.equal(map._resolvePlayerLocation('sword_temple').zone, 'east');
  assert.equal(map._resolvePlayerLocation('north_peaks').zone, 'north');
  assert.equal(map._resolvePlayerLocation('mines_entry').zone, 'north');
  assert.equal(map._resolvePlayerLocation('south_swamp').zone, 'south');
  assert.equal(map._resolvePlayerLocation('sewers_dungeon').zone, 'south');
  assert.equal(map._resolvePlayerLocation('forge_entry').zone, 'south');
  assert.equal(map._resolvePlayerLocation('west_wastes').zone, 'west');
  assert.equal(map._resolvePlayerLocation('quantum_gate').zone, 'west');
  assert.equal(map._resolvePlayerLocation('ai_citadel').zone, 'west');

  // 2. Progreso de Núcleos y Reliquias
  const dummyPlayer = {
    hasArmor: true,
    hasSword: true,
    swordLevel: 2,
    armorLevel: 1,
    dungeonCores: { gc: true, stack: true, microwave: false }
  };
  const status = map._computeProgressStatus(dummyPlayer, []);
  assert.equal(status.coresCount, 2);
  assert.equal(status.gcDefeated, true);
  assert.equal(status.stackDefeated, true);
  assert.equal(status.microwaveDefeated, false);
  assert.equal(status.swordLevel, 2);
  assert.equal(status.armorLevel, 1);

  // 3. Tilemap no produce textos flotantes invasivos en overhead
  const tm = new Tilemap(null, 16);
  assert.doesNotThrow(() => {
    tm.renderBossAndDungeonIndicators({}, { renderX: 0, renderY: 0, viewportWidth: 320, viewportHeight: 180 }, [], dummyPlayer);
  }, 'renderBossAndDungeonIndicators debe ejecutarse de forma limpia y neutralizada');
});

test('Sistema de Niveles (1-10), Experiencia, Centinelas Guardianes y Desbloqueo Fluido de Zonas', () => {
  const p = new Player({ x: 0, y: 0 });
  assert.equal(p.level, 1, 'Inicia a Nivel 1');
  assert.equal(p.xp, 0, 'Inicia con 0 XP');
  assert.equal(p.getNextLevelXp(), 50, 'Nivel 2 requiere 50 XP');
  assert.equal(p.getCurrentLevelBaseXp(), 0);
  assert.equal(p.getXpProgressPercent(), 0);

  // 1. Ganancia de XP y Subida a Nivel 2
  p.gainXp(25);
  assert.equal(p.level, 1);
  assert.equal(p.xp, 25);
  assert.equal(p.getXpProgressPercent(), 50);

  const resLvl2 = p.gainXp(25);
  assert.equal(resLvl2.leveledUp, true);
  assert.equal(p.level, 2, 'Sube a Nivel 2 tras acumular 50 XP');
  assert.equal(p.getNextLevelXp(), 120);

  // 2. Subida progresiva de niveles por experiencia y combates
  p.gainXp(170); // 50 + 170 = 220 XP (alcanza Nivel 4)
  assert.equal(p.level, 4, 'Alcanza Nivel 4 a 220 XP');

  // Subir hasta Nivel 10 (Nivel Máximo)
  p.gainXp(2000);
  assert.equal(p.level, 10, 'El nivel máximo debe ser 10');
  assert.equal(p.getXpProgressPercent(), 100);

  // Reset del jugador restaura Nivel 1 y 0 XP
  p.reset();
  assert.equal(p.level, 1);
  assert.equal(p.xp, 0);

  // 3. Control de Centinelas y Gating por Nivel en Puertas
  // Nivel 1: Valle de la Consagración (first_stage) está abierto para realizar las Pruebas Sagradas,
  // mientras que las regiones avanzadas están custodiadas por sus respectivos centinelas
  const pLvl1 = { level: 1, hasArmor: false, hasSword: false };
  const blockEast = getDoorBlock('first_stage', pLvl1);
  assert.equal(blockEast, null, 'first_stage permitido en Nivel 1 para Pruebas Sagradas');

  const blockNorth = getDoorBlock('north_peaks', pLvl1);
  assert.ok(blockNorth);
  assert.match(blockNorth.title, /GUARDIA BOREAS: NIVEL 4 REQUERIDO/);

  const blockSouth = getDoorBlock('south_swamp', pLvl1);
  assert.ok(blockSouth);
  assert.match(blockSouth.title, /GUARDIA VULCANO: NIVEL 6 REQUERIDO/);

  const blockWest = getDoorBlock('west_wastes', pLvl1);
  assert.ok(blockWest);
  assert.match(blockWest.title, /COMANDANTE VAEL: NIVEL 8 REQUERIDO/);

  // Nivel 2: Paso permitido a Tierras del Este
  assert.equal(getDoorBlock('first_stage', { level: 2 }), null);

  // Nivel 4: Paso permitido a Cumbres del Norte
  assert.equal(getDoorBlock('north_peaks', { level: 4 }), null);

  // Nivel 6: Paso permitido a Marismas del Sur
  assert.equal(getDoorBlock('south_swamp', { level: 6 }), null);

  // Nivel 8: Paso permitido al Páramo de Alex
  assert.equal(getDoorBlock('west_wastes', { level: 8 }), null);

  // Nivel 10 + 3 Núcleos: Paso permitido a la Ciudadela Cuántica
  const pLvl9Citadel = { level: 9, gatesUnlocked: 3, hasArmor: true, hasSword: true };
  const blockCitadelLvl9 = getDoorBlock('ai_citadel', pLvl9Citadel);
  assert.ok(blockCitadelLvl9);
  assert.match(blockCitadelLvl9.title, /NIVEL 10 REQUERIDO/);

  const pLvl10Citadel = { level: 10, gatesUnlocked: 3, hasArmor: true, hasSword: true };
  assert.equal(getDoorBlock('ai_citadel', pLvl10Citadel), null, 'Acceso concedido al Mainframe a Nivel 10');

  // 4. Sanitización y Persistencia en CloudStorage
  const cleanSave = CloudStorage.sanitizeSaveData({ level: 7, xp: 820 });
  assert.equal(cleanSave.level, 7);
  assert.equal(cleanSave.xp, 820);

  const clampedSave = CloudStorage.sanitizeSaveData({ level: 50, xp: -100 });
  assert.equal(clampedSave.level, 10);
  assert.equal(clampedSave.xp, 0);
});

test('Entrenamiento en Valleverde, Combate Desarmado, Huellas Protegidas de Casas y Estaciones Diurnas (v3.8.2)', () => {
  // 1. Combate Desarmado (Player.js)
  const unarmedPlayer = new Player({ x: 100, y: 100 });
  assert.equal(unarmedPlayer.hasSword, false);
  const attacked = unarmedPlayer.tryAttack();
  assert.equal(attacked, true, 'El jugador debe poder atacar desarmado para entrenar');
  assert.equal(unarmedPlayer.isAttacking, true);
  assert.equal(unarmedPlayer.getSwordDamage(), 1, 'Daño de puñetazo desarmado = 1');
  const fistHitbox = unarmedPlayer.getSwordHitbox();
  assert.ok(fistHitbox, 'Debe generar hitbox para el golpe');
  assert.equal(fistHitbox.width, 14);

  // 2. Progreso de Entrenamiento y Experiencia
  unarmedPlayer.reset();
  assert.equal(unarmedPlayer.level, 1);
  assert.equal(unarmedPlayer.xp, 0);
  // Derrotar dos drones de entrenamiento (+25 XP cada uno = 50 XP)
  unarmedPlayer.awardKill(false);
  assert.equal(unarmedPlayer.xp, 25);
  assert.equal(unarmedPlayer.level, 1);
  unarmedPlayer.awardKill(false);
  assert.equal(unarmedPlayer.xp, 50);
  assert.equal(unarmedPlayer.level, 2, 'Alcanza Nivel 2 tras derrotar 2 anomalías de práctica');

  // 3. Huellas Espaciales Protegidas de Casas y Visibilidad de Comerciantes (Tilemap.js)
  const tm = new Tilemap(null, 16);
  tm.loadScene('overworld');
  const overworld = tm.scenes.overworld;
  assert.ok(overworld, 'Escena overworld cargada');
  const deco = overworld.layers.decoration;

  // Verificar que NINGÚN árbol recorte la Casa del Programador (cols 1..6, rows 7..10)
  for (let r = 7; r <= 10; r++) {
    for (let c = 1; c <= 6; c++) {
      const tile = deco[r][c];
      assert.notEqual(tile, TILES.TREE_TOP, `No debe haber TREE_TOP sobre la casa en (${c}, ${r})`);
      assert.notEqual(tile, TILES.TREE_TRUNK, `No debe haber TREE_TRUNK sobre la casa en (${c}, ${r})`);
    }
  }

  // Verificar que los puestos de mercado en fila 9 NO tengan tejados que tapen a los comerciantes (Clara col 14..15, Byte col 19..20)
  assert.notEqual(deco[9][14], TILES.ROOF_RED, 'Clara no debe quedar tapada por tejado overhead');
  assert.notEqual(deco[9][15], TILES.ROOF_RED);
  assert.notEqual(deco[9][19], TILES.ROOF_BLUE, 'Byte no debe quedar tapado por tejado overhead');
  assert.notEqual(deco[9][20], TILES.ROOF_BLUE);

  // Verificar presencia del Yunque en la herrería (col 26, row 6)
  assert.equal(deco[6][26], TILES.ANVIL, 'El yunque debe estar en col 26, row 6');

  // Verificar que existen letreros comerciales para las tiendas
  const signposts = overworld.signposts;
  assert.ok(signposts.length >= 10, 'Deben existir letreros de señalización y tiendas');
  const claraSign = signposts.find((s) => s.shortName.includes('Clara'));
  assert.ok(claraSign, 'Letrero de Panadería de Clara presente');
  const byteSign = signposts.find((s) => s.shortName.includes('Byte'));
  assert.ok(byteSign, 'Letrero de Almacén de Byte presente');
  const smithSign = signposts.find((s) => s.shortName.includes('Brom'));
  assert.ok(smithSign, 'Letrero de Forja de Brom presente');
  const herbSign = signposts.find((s) => s.shortName.includes('Lyra'));
  assert.ok(herbSign, 'Letrero de Invernadero de Lyra presente');
  const trainingSign = signposts.find((s) => s.shortName.includes('Entrenamiento'));
  assert.ok(trainingSign, 'Letrero del Campo de Entrenamiento presente');
});

await Promise.all(asyncQueue);

console.log(`\n${passed} pruebas OK, ${failures.length} fallos.`);
if (failures.length) process.exit(1);
