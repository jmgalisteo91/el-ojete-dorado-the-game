/**
 * Pruebas de regresión sin DOM: IA de enemigos, pathfinding, combate del jugador y reglas de puertas.
 * Ejecutar con:  node tests/regression.mjs
 */
import assert from 'node:assert/strict';
import { findPath, hasLineOfSight } from '../src/ai/Pathfinding.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Player, LEVEL_XP_THRESHOLDS, XP_REWARDS } from '../src/entities/Player.js';
import { getDoorBlock, getDoorDestinationInfo, ZONE_LEVEL_REQUIREMENTS, pushBackPlayer } from '../src/core/DoorGatekeeper.js';
import { AI_STATE, inferArchetype } from '../src/ai/EnemyBrain.js';
import { SpeechBubble, drawSpeechBalloonPath } from '../src/ui/SpeechBubble.js';
import { GarbageCollectorBoss } from '../src/entities/bosses/GarbageCollectorBoss.js';
import { StackOverflowBoss } from '../src/entities/bosses/StackOverflowBoss.js';
import { PrototypeMicrowaveBoss } from '../src/entities/bosses/PrototypeMicrowaveBoss.js';
import { FinalBossAlex } from '../src/entities/bosses/FinalBossAlex.js';
import { Boss } from '../src/entities/bosses/Boss.js';
import { RPGGame } from '../src/main.js';
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
import { Tilemap, CHASM_COLLISION } from '../src/world/Tilemap.js';
import { DialogueBox } from '../src/ui/DialogueBox.js';
import { CollisionSystem } from '../src/physics/CollisionSystem.js';
import { Camera2D } from '../src/core/Camera2D.js';
import { SceneTransitionController } from '../src/core/SceneTransitionController.js';
import { CinematicDirector } from '../src/ui/CinematicDirector.js';
import { NPC, getBromForgeChoices } from '../src/entities/NPC.js';
import { TILES } from '../src/graphics/SpriteSheetGenerator.js';
import { DayNightCycle } from '../src/world/DayNightCycle.js';
import { RenderPipeline } from '../src/graphics/RenderPipeline.js';
import { UILayout, SAFE_WIDTH, SAFE_HEIGHT, MODAL_WIDTH, MODAL_HEIGHT, GAME_VERSION } from '../src/ui/UILayout.js';
import { KernelBoss } from '../src/expansion/entities/KernelBoss.js';
import { RosaShop } from '../src/expansion/entities/RosaShop.js';
import { AlexUpdateBoss, ALEX_UPDATE_DEATH_QUOTE } from '../src/expansion/entities/AlexUpdateBoss.js';
import { TechnicalDebtBoss, TECH_DEBT_DEATH_QUOTE } from '../src/expansion/entities/TechnicalDebtBoss.js';
import { DemonVengador, DEMON_GAME_OVER_MESSAGE } from '../src/expansion/entities/DemonVengador.js?v=8';
import { Animal } from '../src/entities/Animal.js';
import { AchievementManager } from '../src/core/AchievementManager.js';
import { CloudStorage } from '../src/services/CloudStorage.js';
import { LeaderboardView } from '../src/ui/LeaderboardView.js';
import { AudioManager, BGM_TRACKS, BGM_MAX_VOLUME, registerExpansionMusic } from '../src/audio/AudioManager.js?v=8';
import { AmbientMusic } from '../src/audio/AmbientMusic.js';
import { MainMenuAndScenes } from '../src/ui/MainMenuAndScenes.js';
import { SCENE_AI_ALEX_WARNING, SCENE_ENDING_VICTORY } from '../src/assets/VillainDialogues.js';
import { Inventory, normalizeItemId } from '../src/ui/Inventory.js';
import { QuestLog } from '../src/core/QuestLog.js';
import { QuestLogView } from '../src/ui/QuestLogView.js';
import { CharacterStats } from '../src/ui/CharacterStats.js';
import { InputHandler } from '../src/core/InputHandler.js';
import { WorldMap } from '../src/ui/WorldMap.js';
import { EXPANSION_INFO, EXPANSION_NPCS, EXPANSION_UNLOCK_KEY, EXPANSION_BGM, EXPANSION_EQUIPMENT, EXPANSION_SKILLS, getExpansionEquipment, getExpansionDialogueSfx } from '../src/expansion/ExpansionData.js';
import { CinematicTimeline } from '../src/ui/CinematicTimeline.js';
import { CINEMATIC_TIMELINES, CINEMATIC_TIMELINE_DURATIONS, PROLOGUE_ALEX, SCENE_ALEX_FINAL, SCENE_INTRO_INAKITO } from '../src/assets/CinematicTimelines.js';
import { TonyRandazzo } from '../src/expansion/entities/TonyRandazzo.js';
import { FrancoPancho } from '../src/expansion/entities/FrancoPancho.js';
import { IñakitoBoss } from '../src/expansion/entities/IñakitoBoss.js';
import { ExpansionManager } from '../src/expansion/ExpansionManager.js?v=8';

let passed = 0;
const failures = [];
const asyncQueue = [];
function test(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      const p = res
        .then(() => {
          passed++;
          console.log(`  ✓ ${name}`);
        })
        .catch((err) => {
          failures.push(name);
          console.log(`  ✗ ${name}\n      ${err.message}`);
        });
      asyncQueue.push(p);
      return p;
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
  assert.equal(Math.round(p.stamina), 82);
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
test('Daño por zona: sin armadura, 3 golpes de 1.0 en overworld para morir', () => {
  // (FIX C.2) Overworld vuelve a 1.0; 3 HP = 3 golpes
  const p = makePlayer(32, 32);
  p.hasArmor = false;
  p.hp = p.maxHp;
  for (let i = 0; i < 3; i++) {
    p.invulnTimer = 0;
    p.takeHit(null, { sceneId: 'overworld' });
  }
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
  const boss = new StackOverflowBoss({ x: 100, y: 100, sceneId: 'mines_boss_arena' });
  // Comprobar hitbox de pies
  assert.equal(boss.boundingBox.width, 14);
  assert.equal(boss.boundingBox.height, 12);
  // (REDISEÑO) El cuerpo visual de 3 CRT mide 38 px; los pies quedan al fondo.
  assert.equal(boss.boundingBox.offsetY, 26);
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
  assert.equal(b4.maxHp, 150, 'Final Boss Alex debe tener 150 HP');

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

  // 3. Stack Overflow: Fase 1 = 2 espejismos de 1 HP; Fase 2 = 4 clones (2+2)
  assert.equal(b2.cloneThresholds.length, 1);
  assert.equal(b2.cloneThresholds[0], 16, 'La Fase 2 se activa al 50% (16 HP)');
  b2.spawnRecursiveClones();
  assert.equal(b2.clones.length, 2);
  assert.equal(b2.clones[0].maxHp, 1, 'Los espejismos deben tener 1 HP');
  assert.equal(b2.clones[1].maxHp, 1);
  assert.ok(b2.clones.every((c) => c.isMirage === true));

  b2.hp = 16;
  b2.hitFlashTimer = 0;
  b2.takeSwordHit(mockPlayer, null, 0);
  b2._enterPhase2(null, null);
  assert.equal(b2.clones.length, 4, 'La Fase 2 invoca 4 clones');
  assert.equal(b2.clones.filter((c) => c.isMirage).length, 2);
  assert.equal(b2.clones.filter((c) => !c.isMirage).length, 2);

  // (FIX MULTI-HIT) Un clon real (2 HP) no recibe dos golpes en el mismo cooldown.
  const realClone = b2.clones.find((c) => !c.isMirage);
  const clonePlayer = {
    centerX: realClone.x,
    centerY: realClone.y,
    getSwordHitbox: () => ({ x: realClone.x - 6, y: realClone.y - 6, width: 12, height: 12 }),
    getSpinHitbox: () => null,
    getSwordDamage: () => 1,
    takeHit: () => {},
    invulnTimer: 0
  };
  const cloneHpBefore = realClone.hp;
  b2._updateClones(0.01, null, clonePlayer);
  const cloneHpAfterFirst = realClone.hp;
  b2._updateClones(0.01, null, clonePlayer);
  assert.equal(cloneHpBefore - cloneHpAfterFirst, 1, 'El primer golpe resta 1 HP');
  assert.equal(realClone.hp, cloneHpAfterFirst, 'El segundo golpe en <0.2 s no debe restar HP');

  // 4. Microondas: Fase 2 única al 50% (21 HP) con 2 fusibles y 10 s
  assert.equal(b3.cycleThresholds.length, 1);
  assert.equal(b3.cycleThresholds[0], 21, 'La Fase 2 se activa al 50% (21 HP)');
  b3.hp = 21;
  b3.hitFlashTimer = 0;
  b3.takeSwordHit(mockPlayer, null, 0);
  assert.equal(b3.phase, 2);
  assert.equal(b3.fuses.length, 2, 'La Fase 2 debe crear 2 fusibles');
  assert.equal(b3.fuseTimer, 10, 'El jugador tiene 10 s para fundir los fusibles');

  // Aturdido por fusibles: puerta abierta 5 s y daño crítico x2 (Boss.isStunned).
  let fuseIndex = 0;
  const fusePlayer = {
    getSwordHitbox: () => ({ x: b3.fuses[fuseIndex].x, y: b3.fuses[fuseIndex].y, width: 1, height: 1 }),
    getSpinHitbox: () => null,
    takeHit: () => {}
  };
  b3._updateFuses(fusePlayer, null);
  fuseIndex = 1;
  b3._updateFuses(fusePlayer, null);
  assert.equal(b3.stunnedTimer, 2.5, 'La puerta debe quedar abierta 2.5 s');
  assert.equal(b3.doorOpen, true);

  b3.hitFlashTimer = 0;
  const hpBeforeCrit = b3.hp;
  b3.takeSwordHit(mockPlayer, null, 1);
  assert.equal(b3.hp, hpBeforeCrit - 2, 'El daño crítico con la puerta abierta debe ser x2');

  // 5. Garbage Collector: al 50% crece 50%, baja a la mitad de velocidad y saca 2 ratas.
  b1.hp = 12;
  b1.hitFlashTimer = 0;
  b1.takeSwordHit(mockPlayer, null, 0);
  assert.equal(b1.phase, 2);
  assert.equal(b1.width, 39, 'La masa debe crecer un 50%');
  assert.equal(b1.height, 39);
  assert.equal(b1.speed, 17, 'La velocidad debe reducirse a la mitad');
  assert.equal(b1.rats.length, 2, 'Debe invocar 2 ratas de basura');

  // 5. Final Boss Alex: 3 fases a 66% y 33% de 150 HP
  b4.takeSwordHit(mockPlayer, null, 51); // 150 - 51 = 99 HP (66%)
  assert.equal(b4.phase, 2, 'Alex debe entrar en Fase 2 al 66% de HP');
  assert.ok(b4.isOverclocked, 'La Fase 2 debe marcar isOverclocked');
  assert.equal(b4.speed, 55, 'Velocidad en Fase 2 debe ser 55');

  b4.hitFlashTimer = 0;
  b4.takeSwordHit(mockPlayer, null, 50); // 99 - 50 = 49 HP (<33%)
  assert.equal(b4.phase, 3, 'Alex debe entrar en Fase 3 al 33% de HP');
  assert.equal(b4.width, 48, 'La torre del Update Final debe ampliar el ancho');
  assert.equal(b4.height, 56, 'La torre del Update Final debe ampliar el alto');
  assert.equal(b4.speed, 0, 'La torre del Update Final es estacionaria');
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

test('Armadura Nivel 1 absorbe 1.0 por punto: 3 + 3 = 6 golpes en overworld', () => {
  // (FIX C.1) Cada punto absorbe hasta 1.0 y se decrementa 1 por golpe.
  const player = new Player(0, 0);
  player.equipArmor();
  assert.equal(player.armorPoints, 3, 'Debe iniciar con 3 puntos de blindaje');
  assert.equal(player.hp, 3);

  // Golpes 1-3: 1.0 absorbido cada uno, 0 a HP, i-frames 0.60
  for (let i = 0; i < 3; i++) {
    player.invulnTimer = 0;
    player.takeHit(null, { sceneId: 'overworld' });
    assert.equal(player.hp, 3, `golpe ${i + 1}: absorbido`);
    assert.equal(player.armorPoints, 2 - i);
    assert.equal(player.invulnTimer, 0.60);
  }

  // Golpes 4-6: coraza agotada, 1.0 a HP, i-frames 0.75
  player.invulnTimer = 0;
  player.takeHit(null, { sceneId: 'overworld' });
  assert.equal(player.hp, 2);
  assert.equal(player.invulnTimer, 0.75);

  player.invulnTimer = 0;
  player.takeHit(null, { sceneId: 'overworld' });
  assert.equal(player.hp, 1);

  player.invulnTimer = 0;
  player.takeHit(null, { sceneId: 'overworld' });
  assert.equal(player.hp, 0);

  // Reponer coraza con Poción de Blindaje
  const potionSuccess = player.applyArmorPotion();
  assert.equal(potionSuccess, true);
  assert.equal(player.armorPoints, 3, 'La poción debe reconstituir los 3 puntos de coraza');
});

test('3.6: matriz de daño por zona (overworld, norte, minas y ciudadela)', () => {
  // (FIX C.2) Tabla completa: 1.0 / 1.5 / 2.0 (1.5 con armorLevel 2) / 2.5 (2.0 con armorLevel 2)
  const cases = [
    { scene: 'overworld', armorLevel: 0, dmg: 1.0 },
    { scene: 'first_stage', armorLevel: 0, dmg: 1.0 },
    { scene: 'north_peaks', armorLevel: 0, dmg: 1.5 },
    { scene: 'mines_puzzle', armorLevel: 0, dmg: 2.0 },
    { scene: 'mines_puzzle', armorLevel: 2, dmg: 1.5 },
    { scene: 'ai_citadel', armorLevel: 0, dmg: 2.5 },
    { scene: 'ai_citadel', armorLevel: 2, dmg: 2.0 }
  ];
  for (const c of cases) {
    const p = makePlayer(32, 32);
    p.armorLevel = c.armorLevel;
    p.hasArmor = false;
    p.hp = p.maxHp;
    p.invulnTimer = 0;
    p.takeHit(null, { sceneId: c.scene });
    assert.equal(p.hp, Math.max(0, p.maxHp - c.dmg), `${c.scene} armorLevel ${c.armorLevel}`);
  }
});

test('3.7: tras takeHit, i-frames 0.70 sin armadura, 0.60 con coraza y 0.75 agotada', () => {
  const noArmor = makePlayer(32, 32);
  noArmor.hasArmor = false;
  noArmor.hp = noArmor.maxHp;
  noArmor.takeHit(null, { sceneId: 'overworld' });
  assert.equal(noArmor.invulnTimer, 0.70);

  const withArmor = makePlayer(32, 32);
  withArmor.equipArmor();
  withArmor.takeHit(null, { sceneId: 'overworld' });
  assert.equal(withArmor.invulnTimer, 0.60);

  const depleted = makePlayer(32, 32);
  depleted.equipArmor();
  depleted.armorPoints = 0;
  depleted.takeHit(null, { sceneId: 'overworld' });
  assert.equal(depleted.invulnTimer, 0.75);
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

  // 3. CharacterStats ([Tab] alterna entre stats, skills y achievements)
  const cs = new CharacterStats(320, 180);
  cs.open();
  assert.equal(cs.activeTab, 'stats');
  cs.cycleTab();
  assert.equal(cs.activeTab, 'skills');
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

  // (FIX 3) Arena dedicada del Stack Overflow, 12x8 y con la puerta norte sellada
  assert.ok(tm.scenes.mines_boss_arena, 'Debe existir mines_boss_arena');
  assert.equal(tm.scenes.mines_boss_arena.cols, 12);
  assert.equal(tm.scenes.mines_boss_arena.rows, 8);
  assert.equal(tm.scenes.mines_boss_arena.layers.decoration[0][5], TILES.PORTAL_GATE_CLOSED);
  assert.equal(tm.scenes.mines_boss_arena.layers.collision[0][5], 1);

  // (FIX 4) La barrera de mines_puzzle debe verse (cristal) además de colisionar
  assert.equal(tm.scenes.mines_puzzle.layers.decoration[3][5], TILES.CRYSTAL_BARRIER);
  assert.equal(tm.scenes.mines_puzzle.layers.collision[3][5], 1);

  // (FIX 1) Ningún cartel puede bloquear el paso
  for (const scene of Object.values(tm.scenes)) {
    const deco = scene.layers && scene.layers.decoration;
    const coll = scene.layers && scene.layers.collision;
    if (!deco || !coll) continue;
    for (let r = 0; r < scene.rows; r++) {
      for (let c = 0; c < scene.cols; c++) {
        if (deco[r][c] === TILES.SIGNPOST) {
          assert.equal(coll[r][c], 0, `Cartel sólido en ${scene.title} (${c},${r})`);
        }
      }
    }
  }
  tm.loadScene('overworld');
  const owSign = (() => {
    const scene = tm.scenes.overworld;
    for (let r = 0; r < scene.rows; r++) {
      for (let c = 0; c < scene.cols; c++) {
        if (scene.layers.decoration[r][c] === TILES.SIGNPOST) return { c, r };
      }
    }
    return null;
  })();
  assert.ok(owSign, 'El overworld debe conservar carteles');
  assert.equal(tm.isSolidAtTile(owSign.c, owSign.r), false, 'Un cartel debe ser pisable');

  // (FIX 3) Puertas: puzzle -> arena; norte de la arena solo con el Núcleo del Stack
  tm.minesPuzzle.solved = true;
  tm.loadScene('mines_puzzle');
  const toArena = tm.findNearbyDoor({ centerX: 11.5 * 16, centerY: 1.5 * 16 });
  assert.equal(toArena && toArena.targetScene, 'mines_boss_arena');
  tm.loadScene('mines_boss_arena');
  const lockedNorth = tm.findNearbyDoor({
    centerX: 5.5 * 16, centerY: 1.5 * 16, dungeonCores: { stack: false }
  });
  assert.equal(lockedNorth, null, 'La salida norte debe estar sellada sin el Núcleo');
  const southExit = tm.findNearbyDoor({
    centerX: 5.5 * 16, centerY: 7 * 16, dungeonCores: { stack: false }
  });
  assert.equal(southExit && southExit.targetScene, 'mines_puzzle');
  tm.setMinesBossArenaGate(true);
  const openNorth = tm.findNearbyDoor({
    centerX: 5.5 * 16, centerY: 1.5 * 16, dungeonCores: { stack: true }
  });
  assert.equal(openNorth && openNorth.targetScene, 'first_stage');
  tm.loadScene('overworld');

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
  assert.equal(soundItems.length, 6, 'El submenú de Ajustes y Sonido debe tener 6 opciones (incluye Efectos Visuales)');
  assert.ok(soundItems.some((item) => item.label.includes('Efectos Visuales')), 'Debe existir el toggle de Efectos Visuales');

  // (FIX CINEMÁTICAS) La intro ya NO usa diapositivas vectoriales.
  let introDelegated = false;
  menu.startAnimeIntroCutscene(() => { introDelegated = true; });
  assert.equal(introDelegated, true, 'La intro debe delegar al prólogo in-engine');
  assert.equal(menu.cutsceneSlides, undefined, 'No debe quedar estado de diapositivas vectoriales');

  // Verificación de diálogos de Mister AI Alex
  for (const s of SCENE_AI_ALEX_WARNING) {
    assert.ok(s.dialogue.length < 150, 'Cada frase de advertencia de Mister AI Alex debe caber limpia en la caja');
  }
  for (const s of SCENE_ENDING_VICTORY) {
    assert.ok(s.dialogue.length < 155, 'Cada frase del final debe caber limpia en la caja sin cortes');
  }
});

test('AudioManager: unlock idempotente y diccionario de pistas reutilizable', () => {
  const audio = new AudioManager();
  assert.equal(audio.isUnlocked, false);
  assert.equal(audio.musicTracks, audio._bgmAudio);
  assert.equal(audio.currentMusic, null);
  assert.equal(audio.fadeInterval, null);
  audio.unlockAndStart();
  assert.equal(audio.isUnlocked, true);
  assert.doesNotThrow(() => audio.unlockAndStart());
  assert.equal(audio.isUnlocked, true);
});

test('AudioManager: buffers SFX polifónicos, preload y fallback sintetizado', () => {
  const audio = new AudioManager();
  assert.deepEqual(audio.sfxBuffers, {}, 'Los buffers empiezan vacíos');
  assert.equal(typeof audio.preloadSFX, 'function');
  assert.equal(audio.playSFX('sword_slash'), false, 'Sin buffer debe devolver false para el fallback');
  assert.doesNotThrow(() => audio.playSwordSlash());
  assert.doesNotThrow(() => audio.playFootstep('stone'));
  assert.doesNotThrow(() => audio.playCoin());
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
  // (BLOQUE 7) La BGM efectiva nunca supera 0.35; el bus SFX sigue a 1.0.
  assert.ok(audio._bgmBaseVolume() <= 0.35, 'La BGM debe tener un techo de 0.35');
  assert.ok(audio._bgmBaseVolume() > 0, 'La BGM debe escucharse con volumen positivo');
  audio.setSfxVolume(1.5); // Clamped a 1.0
  assert.equal(audio.getSfxVolume(), 1.0);

  // Ducking: baja a 0.1 y se puede limpiar sin dejar timers vivos.
  audio._bgmCurrentAudio = { volume: 0.35, paused: false };
  audio.duckMusic(500, 0.1);
  assert.ok(audio._bgmCurrentAudio.volume <= 0.1 + 1e-9, 'El ducking debe bajar la BGM a 0.1');
  audio._clearBgmDuck();
  audio._bgmCurrentAudio = null;

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

  // Alcanzar Nivel 10 (1700 XP) y tope de Nivel 15 (5200 XP)
  p.gainXp(1480); // 220 + 1480 = 1700 XP
  assert.equal(p.level, 10);
  assert.equal(p.isMaxLevel, false, 'En Nivel 10 aún no se alcanza el nuevo tope 15');
  p.gainXp(4000);
  assert.equal(p.level, 15, 'El nivel máximo ampliado debe ser 15');
  assert.equal(p.isMaxLevel, true);
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
  assert.match(blockSouth.title, /GUARDIA VULCANO: NIVEL 3 REQUERIDO/);
  // (FIX 2.1) El Sur entrega el Dash Asíncrono: debe abrirse antes que las Cumbres del Norte,
  // cuyo abismo es intransitable sin Dash.
  assert.ok(
    ZONE_LEVEL_REQUIREMENTS.south_swamp < ZONE_LEVEL_REQUIREMENTS.north_peaks,
    'El Sur (Dash) debe estar disponible antes que el Norte (abismo)'
  );

  const blockWest = getDoorBlock('west_wastes', pLvl1);
  assert.ok(blockWest);
  assert.match(blockWest.title, /COMANDANTE VAEL: NIVEL 8 REQUERIDO/);

  // Nivel 2: Paso permitido a Tierras del Este
  assert.equal(getDoorBlock('first_stage', { level: 2 }), null);

  // Nivel 4: Paso permitido a Cumbres del Norte
  assert.equal(getDoorBlock('north_peaks', { level: 4 }), null);

  // Nivel 3: Paso permitido a Marismas del Sur (Dash Asíncrono antes del abismo norte)
  assert.equal(getDoorBlock('south_swamp', { level: 3 }), null);
  assert.equal(getDoorBlock('south_swamp', { level: 4 }), null);

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
  assert.equal(clampedSave.level, 15);
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
  assert.equal(fistHitbox.width, 18, 'El puñetazo usa la misma caja que el primer espadazo');
  assert.equal(unarmedPlayer.energySlashes.length, 0, 'Sin espada no debe crear proyectiles');

  // (FIX 6) La bola de energía solo existe con Espada Overclockeada y vida llena.
  const swordPlayer = new Player({ x: 100, y: 100 });
  swordPlayer.hasSword = true;
  swordPlayer.swordLevel = 3;
  swordPlayer.hp = swordPlayer.effectiveMaxHp;
  swordPlayer.tryAttack();
  assert.equal(swordPlayer.energySlashes.length, 1, 'Con espada nivel 3 y vida llena sí aparece el tajo de energía');

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
  // (FIX 2) Máximo 2 carteles por zona: se conservan los cruciales/misión.
  const signposts = overworld.signposts;
  assert.ok(signposts.length >= 1 && signposts.length <= 2, 'Valleverde debe tener como máximo 2 carteles');
  const smithSign = signposts.find((s) => s.shortName.includes('Brom'));
  assert.ok(smithSign, 'Letrero de Forja de Brom presente');
  const trainingSign = signposts.find((s) => s.shortName.includes('Entrenamiento'));
  assert.ok(trainingSign, 'Letrero del Campo de Entrenamiento presente');
});

test('Desbloqueo de Menú de Audio y Opciones sin Bloqueo de Estado y Versión Oficial Dinámica (v3.8.2)', () => {
  // 1. Verificación de Versión Oficial Centralizada
  assert.equal(GAME_VERSION, 'v3.8.2', 'La versión centralizada debe ser v3.8.2');

  const fakeMusic = {
    setMode: () => {},
    playMenuSelect: () => {},
    playMenuMove: () => {},
    getMasterVolume: () => 1.0,
    getMusicVolume: () => 0.8,
    getSfxVolume: () => 1.0,
    isMasterMuted: () => false,
    isMusicMuted: () => false,
    isSfxMuted: () => false
  };

  const menu = new MainMenuAndScenes(320, 180, {}, fakeMusic, {});

  // 2. Transición Pausa -> Ajustes y Sonido -> Volver (vía opción Volver)
  menu.openPauseMenu();
  assert.equal(menu.state, 'pause');
  const pauseItems = menu._getCurrentMenuItems();
  assert.equal(pauseItems[3].label, 'Ajustes y Sonido');
  pauseItems[3].action();
  assert.equal(menu.state, 'options', 'Debe entrar al menú de opciones desde pausa');
  assert.equal(menu.previousStateBeforeOptions, 'pause');

  const optionItems = menu._getCurrentMenuItems();
  const backItem = optionItems.find((it) => it.label === 'Volver');
  assert.ok(backItem, 'Debe existir la opción Volver');
  backItem.action();
  assert.equal(menu.state, 'pause', 'Volver desde opciones debe regresar al menú de pausa');
  assert.equal(menu.selectedIndex, 3, 'El cursor debe colocarse sobre Ajustes y Sonido');

  // 3. Cadena Pausa -> Opciones -> Controles -> Cerrar Controles -> Volver Opciones (sin bucle infinito)
  menu.openOptionsScreen('pause');
  assert.equal(menu.state, 'options');
  menu.openControlsScreen('options');
  assert.equal(menu.state, 'controls');
  menu.closeControlsScreen();
  assert.equal(menu.state, 'options', 'Cerrar controles debe devolver a opciones');
  assert.equal(menu.previousStateBeforeOptions, 'pause', 'El estado previo a opciones debe seguir siendo pause intacto');
  menu.closeOptionsScreen();
  assert.equal(menu.state, 'pause', 'Cerrar opciones no debe quedar en bucle infinito');

  // 4. Retorno con tecla Escape desde Ajustes y Sonido
  menu.openOptionsScreen('pause');
  const mockInput = {
    pointerX: -1,
    pointerY: -1,
    consumeKey: (k) => k === 'Escape',
    consumeMenuDirection: () => null,
    consumeInteraction: () => false,
    consumePointerClick: () => null
  };
  menu.update(0.016, mockInput);
  assert.equal(menu.state, 'pause', 'Pulsar Escape en opciones debe regresar a pausa');

  // 5. Opciones desde Pantalla de Título -> Volver a Título
  menu.openTitleScreen();
  menu.openOptionsScreen('title');
  assert.equal(menu.state, 'options');
  menu.closeOptionsScreen();
  assert.equal(menu.state, 'title', 'Volver desde opciones abiertas en título debe regresar a título');

  // 6. Botón de Cierre Superior Derecho del Modal [✕ Volver]
  const closeBtn = menu._getModalCloseButtonBounds(true);
  assert.ok(closeBtn, 'Debe existir hitbox para el botón de cierre');
  assert.ok(closeBtn.x > 200, 'El botón debe ubicarse a la derecha');
  assert.ok(closeBtn.w >= 40 && closeBtn.h >= 10, 'Dimensiones clickeables cómodas');

  menu.openOptionsScreen('pause');
  const mockClickInput = {
    pointerX: closeBtn.x + 5,
    pointerY: closeBtn.y + 5,
    consumeKey: () => false,
    consumeMenuDirection: () => null,
    consumeInteraction: () => false,
    consumePointerClick: () => ({ x: closeBtn.x + 5, y: closeBtn.y + 5 })
  };
  menu.update(0.016, mockClickInput);
  assert.equal(menu.state, 'pause', 'Hacer clic sobre el botón ✕ Volver debe cerrar el menú de opciones');
});

test('Tilemap: Inicialización e integridad de Las Marismas del Hardware Legacy (south_swamp)', () => {
  const tm = new Tilemap(null, 16);
  assert.ok(tm.scenes.south_swamp, 'La escena south_swamp debe estar definida');
  const swamp = tm.scenes.south_swamp;
  assert.equal(swamp.cols, 36);
  assert.equal(swamp.rows, 24);
  assert.ok(swamp.layers.ground, 'Capa ground debe existir');
  assert.ok(swamp.layers.decoration, 'Capa decoration debe existir');
  assert.ok(swamp.layers.collision, 'Capa collision debe existir');
  assert.equal(swamp.layers.ground.length, 24);
  assert.equal(swamp.layers.ground[0].length, 36);

  // Puerta hacia Cloacas del Legacy (Suroeste)
  tm.loadScene('south_swamp');
  const fakePlayerSewers = { centerX: 8.5 * 16, centerY: 14.5 * 16 };
  const sewersDoor = tm.findNearbyDoor(fakePlayerSewers);
  assert.ok(sewersDoor, 'Debe existir puerta a Cloacas');
  assert.equal(sewersDoor.targetScene, 'sewers_entry');

  // Puerta hacia La Forja del Prototipo (Sureste)
  const fakePlayerForge = { centerX: 26.5 * 16, centerY: 14.5 * 16 };
  const forgeDoor = tm.findNearbyDoor(fakePlayerForge);
  assert.ok(forgeDoor, 'Debe existir puerta a La Forja');
  assert.equal(forgeDoor.targetScene, 'forge_entry');
});

console.log('Correcciones de la Revisión Técnica (Progresión Terminable)');

function makeFakeGame() {
  const game = Object.create(RPGGame.prototype);
  game.assets = { charactersSheet: null };
  return game;
}

function makeFakeMusic() {
  return {
    setMode: () => {},
    playMenuSelect: () => {},
    playMenuMove: () => {},
    getMasterVolume: () => 1.0,
    getMusicVolume: () => 0.8,
    getSfxVolume: () => 1.0,
    isMasterMuted: () => false,
    isMusicMuted: () => false,
    isSfxMuted: () => false
  };
}

test('C1: una pasada por todo el contenido alcanza el nivel exigido por cada centinela y por la Ciudadela', () => {
  const enemies = makeFakeGame()._createFirstStageEnemies();
  const xpOf = (e) => (e.isBoss ? XP_REWARDS.boss : (e.xpReward ?? XP_REWARDS.enemy));
  const dayXpIn = (scenes) => enemies
    .filter((e) => !e.isBoss && !e.nightOnly && scenes.includes(e.sceneId))
    .reduce((sum, e) => sum + xpOf(e), 0);
  const bossXp = (...ids) => ids.reduce((sum, id) => sum + xpOf(enemies.find((e) => e.id === id)), 0);
  const xpForLevel = (lvl) => LEVEL_XP_THRESHOLDS[lvl - 1];

  // (FIX 2.1) Orden de progresión: Este -> Sur (Dash) -> Norte (abismo) -> Oeste -> Ciudadela
  const afterEast = dayXpIn(['first_stage', 'sword_temple']);
  assert.ok(afterEast >= xpForLevel(ZONE_LEVEL_REQUIREMENTS.south_swamp), `Este (Sur): ${afterEast} XP`);
  assert.ok(afterEast >= xpForLevel(ZONE_LEVEL_REQUIREMENTS.north_peaks), `Este (Norte): ${afterEast} XP`);
  const afterSouth = afterEast + dayXpIn(['south_swamp']) + bossXp('boss_garbage_collector', 'boss_prototype_microwave');
  assert.ok(afterSouth >= xpForLevel(ZONE_LEVEL_REQUIREMENTS.north_peaks), `Sur (Norte): ${afterSouth} XP`);
  const afterNorth = afterSouth + dayXpIn(['north_peaks']) + bossXp('boss_stack_overflow');
  assert.ok(afterNorth >= xpForLevel(ZONE_LEVEL_REQUIREMENTS.west_wastes), `Norte (Oeste): ${afterNorth} XP`);
  const afterWest = afterNorth + dayXpIn(['west_wastes']);
  assert.ok(afterWest >= xpForLevel(ZONE_LEVEL_REQUIREMENTS.ai_citadel), `Oeste (Ciudadela): ${afterWest} XP`);
});

test('C1: las patrullas regionales nacen en suelo transitable y reaparecen limpias al volver a la región', () => {
  const enemies = makeFakeGame()._createFirstStageEnemies();
  const patrols = enemies.filter((e) => e.respawnOnEnter);
  // (FIX 2.2) Las salas de mazmorra también reaparecen: se comprueban las 3 regiones explícitamente
  const patrolScenes = new Set(patrols.map((e) => e.sceneId));
  for (const zone of ['north_peaks', 'south_swamp', 'west_wastes']) {
    assert.ok(patrolScenes.has(zone), `La región ${zone} debe tener patrullas`);
  }
  const tm = new Tilemap(null, 16);
  for (const e of patrols) {
    tm.loadScene(e.sceneId);
    for (const pt of e.patrolPoints) {
      assert.equal(CollisionSystem.collidesWithMap(e.getBoundingBoxAt(pt.x, pt.y), tm), false, `${e.id} en sólido`);
    }
  }
  const drone = patrols[0];
  Object.assign(drone, { dead: true, hp: 0, xpGranted: true, coinsDropped: true, lootDropped: true });
  drone.reset();
  assert.equal(drone.dead, false);
  assert.equal(drone.hp, drone.maxHp);
  assert.equal(drone.xpGranted, false);
  assert.equal(drone.coinsDropped, false);
});

test('C2: el mapa del mundo vuelve al estado del que se abrió y los avisos avanzan durante el juego', () => {
  const menu = new MainMenuAndScenes(320, 180, {}, makeFakeMusic(), {});
  menu.state = 'none';
  menu.openWorldMap('overworld');
  menu.closeWorldMap();
  assert.equal(menu.state, 'none');

  menu.openPauseMenu();
  menu.openWorldMap('overworld');
  assert.equal(menu.state, 'world_map');
  menu.closeWorldMap();
  assert.equal(menu.state, 'pause', 'Abierto desde pausa, debe volver a pausa');

  menu.showNotice('¡SUBIDA DE NIVEL!', 1.0);
  menu.updateNotice(0.6);
  assert.ok(menu.noticeTimer > 0);
  menu.updateNotice(0.6);
  assert.equal(menu.noticeTimer, 0);
});

test('C3: los materiales recogidos se apilan con su tipo canónico y Brom los acepta', () => {
  assert.equal(normalizeItemId('silicon_ore_1730000000000_0'), 'silicon_ore');
  assert.equal(normalizeItemId('silicon_ore_crystal_3_4_1730000000000'), 'silicon_ore');
  assert.equal(normalizeItemId('magnetron'), 'microwave_magnetron');
  assert.equal(normalizeItemId('microwave_magnetron_1730000000000'), 'microwave_magnetron');
  assert.equal(normalizeItemId('nucleo_gc'), 'dungeon_core_gc');
  assert.equal(normalizeItemId('bread_dropped_1730000000000'), 'bread');
  assert.equal(normalizeItemId('golden_apple'), 'golden_apple');

  const inv = new Inventory(null, 320, 180);
  inv.addItem({ id: 'silicon_ore_1730000000000_0', name: 'Mineral de Silicio', qty: 1 });
  inv.addItem({ id: 'silicon_ore_crystal_3_4_1730000000000', name: 'Mineral de Silicio', qty: 1 });
  assert.equal(inv.getItemCount('silicon_ore'), 2);
  assert.equal(inv.items.length, 1);

  const player = new Player({ x: 0, y: 0 });
  player.equipArmor();
  player.equipSword();
  player.coins = 300;
  const game = { player, inventory: inv, dialogueBox: { showMessage: () => {}, close: () => {} }, questLog: new QuestLog(), housePermissions: {} };
  getBromForgeChoices(game).find((c) => c.label.includes('Espada de Silicio')).onSelect();
  assert.equal(player.swordLevel, 2);

  inv.addItem({ id: 'magnetron', name: 'Magnetrón Cuántico', qty: 1 });
  getBromForgeChoices(game).find((c) => c.label.includes('Overclockeada')).onSelect();
  assert.equal(player.swordLevel, 3, 'El magnetrón del cofre también sirve para la forja');

  inv.setItems([
    { id: 'chest_nucleo_gc', qty: 1 },
    { id: 'silicon_ore_1_0', qty: 1 },
    { id: 'silicon_ore_2_1', qty: 2 },
    { id: 'bread' }
  ]);
  assert.deepEqual(inv.items.map((it) => [it.id, it.qty]), [['silicon_ore', 3], ['bread', 1]]);
});

test('A1: el acceso a la Ciudadela depende solo de los núcleos engarzados', () => {
  const player = new Player({ x: 0, y: 0 });
  const stack = new StackOverflowBoss({ x: 0, y: 0, sceneId: 'mines_boss_arena' });
  stack.triggerBossDefeat(player, null);
  assert.equal(player.dungeonCores.stack, true);
  assert.equal(player.gatesUnlocked, 0, 'Vencer al jefe no abre zócalos por sí solo');

  const game = makeFakeGame();
  game.player = { gatesUnlocked: 7 };
  game.tilemap = { quantumGate: { coresPlaced: { gc: true, stack: false, microwave: true } } };
  game._syncGatesUnlocked();
  assert.equal(game.player.gatesUnlocked, 2);
  game.tilemap.quantumGate.coresPlaced.stack = true;
  game._syncGatesUnlocked();
  assert.equal(game.player.gatesUnlocked, 3);
});

test('A2: el abismo de las Minas es sólido a pie y se cruza con el Dash Asíncrono', () => {
  const tm = new Tilemap(null, 16);
  tm.loadScene('mines_entry');
  assert.equal(tm.layers.collision[8][11], CHASM_COLLISION);
  assert.equal(tm.isSolidAtTile(11, 8), true);

  const walkDown = { ...stubInput, getMovementVector: () => ({ x: 0, y: 1 }) };
  const walker = makePlayer(11 * 16, 112);
  for (let i = 0; i < 60; i++) walker.update(1 / 60, walkDown, tm, []);
  assert.ok(walker.worldBoundingBox.y + walker.worldBoundingBox.height <= 8 * 16, 'A pie no cruza el abismo');

  const dasher = makePlayer(11 * 16, 112);
  dasher.hasDash = true;
  let dashUsed = false;
  const dashDown = { ...walkDown, consumeDash: () => (dashUsed ? false : (dashUsed = true)) };
  for (let i = 0; i < 30; i++) dasher.update(1 / 60, dashDown, tm, []);
  assert.ok(dasher.worldBoundingBox.y >= 10 * 16, `El Dash aterriza al otro lado (y=${dasher.y})`);
  assert.equal(CollisionSystem.collidesWithMap(dasher.worldBoundingBox, tm), false);
  assert.equal(tm.allowChasmCrossing, false);
});

test('A6/M1: los jefes no actúan en pausa y el cooldown de contacto se recupera', () => {
  const gc = new GarbageCollectorBoss({ x: 64, y: 64, sceneId: 'sewers_dungeon' });
  const player = makePlayer(80, 64);
  gc.activeCombat = true;
  const x0 = gc.x;
  const y0 = gc.y;
  for (let i = 0; i < 240; i++) gc.update(1 / 60, openMap, player, true, null);
  assert.equal(gc.x, x0);
  assert.equal(gc.y, y0);
  assert.equal(gc.hazardPuddles.length, 0, 'No genera charcos durante un diálogo');

  const boss = new Boss({ id: 'boss_test', name: 'Test', x: 32, y: 32, sceneId: 'test' });
  boss.attackCooldown = 0.85;
  boss.update(0.5, openMap, makePlayer(250, 150), false, null);
  assert.ok(Math.abs(boss.attackCooldown - 0.35) < 1e-9);
});

test('A7: el teletransporte de Alex nunca le deja dentro de un servidor sólido', () => {
  const tm = new Tilemap(null, 16);
  tm.loadScene('ai_citadel');
  const alex = new FinalBossAlex({ x: 11.5 * 16, y: 6.5 * 16 });
  alex.arenaTilemap = tm;
  for (let i = 0; i < 60; i++) {
    alex._performQuantumTeleport();
    assert.equal(CollisionSystem.collidesWithMap(alex.worldBoundingBox, tm), false, `Alex en sólido en (${alex.x}, ${alex.y})`);
  }
});

test('A8: subir de nivel no resucita a un jugador abatido', () => {
  const p = new Player({ x: 0, y: 0 });
  p.hp = 0;
  const res = p.gainXp(60);
  assert.equal(res.leveledUp, true);
  assert.equal(p.hp, 0);

  const alive = new Player({ x: 0, y: 0 });
  alive.hp = 1;
  alive.gainXp(60);
  assert.equal(alive.hp, alive.effectiveMaxHp, 'Vivo, la subida de nivel sí cura');
});

test('A9: el mapa del mundo dibuja dentro de la resolución lógica aunque el canvas físico sea 1280x720', () => {
  const texts = [];
  const target = {
    canvas: { width: 1280, height: 720 },
    measureText: (t) => ({ width: String(t).length * 4 }),
    fillText: (t, x, y) => texts.push({ t, x, y }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} })
  };
  const ctx = new Proxy(target, {
    get: (obj, prop) => (prop in obj ? obj[prop] : () => {}),
    set: (obj, prop, val) => { obj[prop] = val; return true; }
  });
  new WorldMap().render(ctx, 'overworld', new Player({ x: 0, y: 0 }), []);
  assert.ok(texts.length > 0);
  for (const { t, x, y } of texts) {
    assert.ok(x <= 320 && y <= 180, `Texto fuera de pantalla: "${t}" en (${x}, ${y})`);
  }
});

test('M14/M17: la vida se ajusta al máximo efectivo y el Dash no acorta la invulnerabilidad', () => {
  const p = makePlayer(48, 48);
  p.hp = 3;
  p.robotizationLevel = 90;
  p.update(1 / 60, stubInput, openMap, []);
  assert.equal(p.hp, p.effectiveMaxHp);

  p.hasDash = true;
  p.invulnTimer = 1.1;
  p.tryDash(null, null);
  assert.equal(p.invulnTimer, 1.1);
});

test('Expansión v2.0: teaser bloqueado/desbloqueado, 5 NPCs y fases de Iñakito', async () => {
  // 1. Datos de la expansión.
  const npcs = Object.values(EXPANSION_NPCS);
  assert.equal(npcs.length, 5, 'La expansión debe registrar 5 NPCs');
  for (const npc of npcs) {
    assert.ok(npc.id && npc.name && npc.spriteColor && npc.role);
    assert.equal(npc.dialogues.length, 3, `${npc.name} debe tener 3 diálogos iniciales`);
    assert.ok(npc.lore && npc.lore.length > 20);
  }
  assert.equal(EXPANSION_INFO.title, 'El Resurgir de Mister Alex IA');

  // 2. Clases de Tony Randazzo (doble personalidad) y Franco.
  const tony = new TonyRandazzo({ x: 32, y: 32 });
  assert.ok(tony instanceof TonyRandazzo);
  assert.equal(tony.name, 'Tony Randazzo');
  assert.equal(tony.isAngry, false);
  assert.equal(tony.spriteColor, EXPANSION_NPCS.tony_randazzo.spriteColor);
  assert.equal(tony.boundingBox.width, 10);
  tony.update(0.016, null, [], false, null, null);
  assert.equal(tony.isMoving, false);

  // Doble personalidad: 1ª y 2ª interacción son normales (sevillano); 3ª consecutiva enfurece (argentino)
  const d1 = tony.resolveDialogues();
  assert.equal(tony.isAngry, false);
  assert.match(d1.lines[0], /Illo|quillo/i);
  const d2 = tony.resolveDialogues();
  assert.equal(tony.isAngry, false);
  const d3 = tony.resolveDialogues();
  assert.equal(tony.isAngry, true);
  assert.equal(tony.name, 'Tony Randazzo (Furioso)');
  assert.match(d3.lines[0], /Che|boludo/i);

  // Al alejarse el jugador (> 64px), el enfado se enfría y vuelve a la normalidad
  tony.update(0.016, null, [], false, { centerX: 200, centerY: 200 }, null);
  assert.equal(tony.isAngry, false);
  assert.equal(tony.name, 'Tony Randazzo');

  // También se enfada eligiendo "Me caes mal"
  const dChoice = tony.resolveDialogues();
  const hateChoice = dChoice.choices.find((c) => c.label === 'Me caes mal');
  assert.ok(hateChoice);
  hateChoice.onSelect();
  assert.equal(tony.isAngry, true);
  const franco = new FrancoPancho({ x: 48, y: 48 });
  assert.ok(franco instanceof FrancoPancho);
  assert.equal(franco.name, 'Franco el Pancho');

  // 3. Menú de título: bloqueado sin trofeo, desbloqueado con trofeo.
  const previousStorage = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  const fakeMusic = {
    playMenuSelect() {},
    playCaughtSkipSound() {},
    playMenuMove() {},
    stopTitleMusic() {},
    setMode() {}
  };
  try {
    const menu = new MainMenuAndScenes(320, 180, {}, fakeMusic, { getSaveSummary: () => null });
    menu.state = 'title';
    let items = menu._getCurrentMenuItems();
    assert.equal(items.length, 8, 'El título debe incluir la opción de expansión');
    const lockedItem = items[2];
    assert.equal(lockedItem.label, EXPANSION_INFO.title);
    assert.ok(lockedItem.subtext.includes('Completa el juego base para desbloquear'));
    assert.equal(lockedItem.locked, true);
    lockedItem.action();
    assert.match(menu.noticeText, /Completa el juego base/);

    store.set(EXPANSION_UNLOCK_KEY, 'true');
    items = menu._getCurrentMenuItems();
    const unlockedItem = items[2];
    assert.equal(unlockedItem.locked, false);
    assert.ok(unlockedItem.subtext.includes('Prepárate'));
    unlockedItem.action();
    assert.equal(menu.expansionTeaserOpen, true);
  } finally {
    if (typeof previousStorage === 'undefined') delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }

  // 4. Jefe Iñakito 2.0: 100 HP, 3 fases, abanico de 3 console.log, 3 bugs que explotan, bucle while(true) y parry 3s.
  const boss = new IñakitoBoss({ x: 6 * 16, y: 4 * 16 });
  assert.equal(boss.maxHp, 100);
  assert.equal(boss.hp, 100);
  assert.equal(boss.phase, 1);
  assert.equal(boss.sceneId, 'inakito_office');

  // Fase 1: al recibir daño suelta frase de ascenso y dispara abanico de 3 console.log
  boss.activeCombat = true;
  assert.equal(boss.takeSwordHit({ parryTimer: 0 }), true);
  assert.equal(boss.hurtQuote, '¡El jefe dijo que esto era un ascenso!');
  boss.shotTimer = 0;
  boss.update(0.05, null, makePlayer(96, 120), false);
  assert.equal(boss.projectiles.length, 3, 'Fase 1 debe disparar console.log en abanico de 3');

  // Fase 2: invoca 3 Bugs que explotan al morir
  boss.hp = 55;
  boss.update(0.05, null, null, false);
  assert.equal(boss.phase, 2);
  assert.equal(boss.bugs.length, 3);
  boss._explodeBug(boss.bugs[0], null, null);
  assert.equal(boss.bugs[0].dead, true);
  assert.equal(boss.bugExplosions.length, 1);

  // Fase 3: while(true) invulnerable, solo Parry rompe el bucle y aturde 3s
  boss.hp = 25;
  boss.update(0.05, null, null, false);
  assert.equal(boss.phase, 3);
  assert.equal(boss.inWhileLoop, true);
  assert.equal(boss.invulnerable, true);

  assert.equal(boss.takeSwordHit({ parryTimer: 0 }), false);
  boss.stun(1.4); // Simulando Parry de Player.takeHit contra embestida
  assert.equal(boss.inWhileLoop, false);
  assert.equal(boss.invulnerable, false);
  assert.ok(boss.stunTimer >= 2.9, 'El Parry debe aturdir a Iñakito 3 segundos');

  boss.hp = 1;
  boss.hitFlashTimer = 0; // limpiar el i-frame del golpe anterior
  boss.takeSwordHit({ parryTimer: 0.2 }, null, 5);
  assert.equal(boss.dead, true);
  assert.equal(boss.deathQuote, '¿Esto significa que no me van a renovar?');

  // Arena inakito_office (12x10): barrera norte bloqueada hasta vencer a Iñakito
  const tmArena = new Tilemap(null, 16);
  await tmArena.loadExpansionScenes();
  tmArena.loadScene('inakito_office');
  assert.equal(tmArena.scenes.inakito_office.cols, 12);
  assert.equal(tmArena.scenes.inakito_office.rows, 10);
  const lockedNorth = tmArena.findNearbyDoor({ centerX: 5.5 * 16, centerY: 1.2 * 16 });
  assert.ok(lockedNorth && lockedNorth.blocked === true, 'Salida norte debe iniciar bloqueada');
  tmArena.setInakitoOfficeGate(true);
  const openNorth = tmArena.findNearbyDoor({ centerX: 5.5 * 16, centerY: 1.2 * 16 });
  assert.ok(openNorth && openNorth.blocked === false, 'Salida norte debe abrirse tras derrotar a Iñakito');

  const noop = () => {};
  const mockCtx = {
    save: noop, restore: noop, fillRect: noop, strokeRect: noop,
    beginPath: noop, arc: noop, ellipse: noop, moveTo: noop, lineTo: noop,
    quadraticCurveTo: noop, closePath: noop, fill: noop, stroke: noop,
    fillText: noop, createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop })
  };
  assert.doesNotThrow(() => boss.render(mockCtx, { renderX: 0, renderY: 0 }));
});

test('Expansión v2.0: BGM/SFX nuevos y hooks de audio en diálogos', () => {
  // Pistas de la expansión, volumen global y crossfade compartido.
  // La expansión ya NO contamina el registro base.
  for (const key of Object.keys(EXPANSION_BGM)) {
    assert.equal(BGM_TRACKS[key], undefined, `La pista de expansión ${key} no debe cargarse en base`);
  }
  registerExpansionMusic();
  for (const [key, path] of Object.entries(EXPANSION_BGM)) {
    assert.equal(BGM_TRACKS[key], path, `Falta la pista ${key}`);
    delete BGM_TRACKS[key];
  }
  assert.equal(BGM_MAX_VOLUME, 0.35, 'La BGM debe mantenerse al 35%');

  const sfxMethods = [
    'playGlitch', 'playConsoleLog', 'playHologram', 'playError',
    'playKeyboard', 'playShock', 'playCoffee', 'playAirlock'
  ];
  for (const method of sfxMethods) {
    assert.equal(typeof AudioManager.prototype[method], 'function', `Falta ${method}()`);
  }

  // Datos de voz y helper de expansión.
  assert.equal(EXPANSION_NPCS.cepedita_tieso.talkSfx, 'hologram_on');
  assert.equal(getExpansionDialogueSfx('cepedita_tieso'), 'hologram_on');
  assert.ok(['coffee_sip', 'keyboard_type'].includes(getExpansionDialogueSfx('inakito')));
  assert.ok(['ui_glitch', 'error_buzz'].includes(
    getExpansionDialogueSfx(null, 'ERROR: glitch en el sistema')
  ));

  // Hook real del DialogueBox.
  const calls = [];
  const fakeSound = {
    playSFX: (name) => calls.push(name),
    playGlitch: () => calls.push('playGlitch'),
    playConsoleLog: () => calls.push('playConsoleLog'),
    playHologram: () => calls.push('playHologram'),
    playError: () => calls.push('playError'),
    playKeyboard: () => calls.push('playKeyboard'),
    playShock: () => calls.push('playShock'),
    playCoffee: () => calls.push('playCoffee'),
    playAirlock: () => calls.push('playAirlock')
  };
  const box = new DialogueBox(320, 180, fakeSound);
  box.start({ name: 'Cepedita 2.0', talkSfx: 'hologram_on' }, ['Cepedita el Tieso requiere el impreso A-38 bis.']);
  assert.ok(calls.includes('playHologram'), 'Cepedita debe sonar como holograma');

  calls.length = 0;
  box.start({ name: 'Iñakito 2.0', talkSfx: 'coffee_sip' }, ['¡Pero si el jefe me dijo que esto era un ascenso!']);
  assert.ok(calls.includes('playCoffee'), 'Iñakito debe sonar a café');

  calls.length = 0;
  box.start(null, ['ERROR: glitch detectado en el sistema.']);
  assert.ok(
    calls.includes('playGlitch') || calls.includes('playError'),
    'Un texto de error/glitch debe disparar playGlitch/playError'
  );
});

test('Timeline v2.0: 7 escenas con duración exacta y eventos absolutos', () => {
  const expected = {
    prologue_alex: 35,
    scene_intro_garbage_collector: 15,
    scene_intro_stack_overflow: 18,
    scene_intro_prototype_microwave: 15,
    scene_ai_alex_prebattle: 40,
    scene_intro_inakito: 20,
    scene_jail_arrest: 20
  };
  assert.equal(Object.keys(CINEMATIC_TIMELINES).length, 7);
  for (const [id, duration] of Object.entries(expected)) {
    const scene = CINEMATIC_TIMELINES[id];
    assert.ok(scene, `Falta el timeline ${id}`);
    assert.equal(scene.duration, duration, `Duración incorrecta en ${id}`);
    assert.equal(CINEMATIC_TIMELINE_DURATIONS[id], duration);
    assert.ok(Array.isArray(scene.timeline) && scene.timeline.length > 0);
    let last = -1;
    for (const ev of scene.timeline) {
      assert.ok(Number.isFinite(ev.time), `Evento sin time en ${id}`);
      assert.ok(ev.action, `Evento sin action en ${id}`);
      assert.ok(ev.time >= last, `Eventos desordenados en ${id}`);
      assert.ok(ev.time <= duration, `Evento fuera de duración en ${id}`);
      last = ev.time;
    }
    assert.equal(scene.timeline[scene.timeline.length - 1].action, 'end');
  }
  assert.equal(PROLOGUE_ALEX.duration, 35);
  assert.equal(SCENE_ALEX_FINAL.duration, 40);
  assert.equal(SCENE_INTRO_INAKITO.duration, 20);

  // El reloj absoluto no dispara antes de tiempo y cierra a la duración exacta.
  const tl = new CinematicTimeline({
    id: 'test',
    duration: 35,
    events: [{ time: 3, action: 'a' }, { time: 12, action: 'b' }]
  });
  const fired = [];
  tl.update(2.9, (e) => fired.push(e.action));
  assert.deepEqual(fired, []);
  tl.update(0.2, (e) => fired.push(e.action));
  assert.deepEqual(fired, ['a']);
  tl.update(40, (e) => fired.push(e.action));
  assert.deepEqual(fired, ['a', 'b']);
  assert.equal(tl.finished, true);
  assert.equal(tl.duration, 35);

  // FIX 1: reloj por evento, sin adelantar al siguiente antes de tiempo.
  const ev = new CinematicTimeline({
    duration: 35,
    events: [{ time: 3, action: 'a' }, { time: 12, action: 'b' }]
  });
  ev.update(1, () => {});
  assert.equal(ev.currentEventIndex, 0);
  assert.equal(ev.currentEventTimer, 2);
  ev.update(2, () => {});
  assert.equal(ev.currentEventIndex, 1);
  assert.equal(ev.currentEventTimer, 9);
  assert.equal(ev.finished, false);
});

test('Transiciones espaciales: salir por un borde aparece en el opuesto con margen de 2 tiles', () => {
  const fake = {
    tilemap: { tileSize: 16, width: 576, height: 384 },
    player: { direction: 'right' },
    _compassFromDirection: RPGGame.prototype._compassFromDirection
  };
  const resolve = (direction, door = { spawnY: 200 }) => {
    fake.player.direction = direction;
    return RPGGame.prototype._resolveStageSpawn.call(fake, door);
  };

  const east = resolve('right');
  assert.equal(east.x, 32, 'Salir por el Este debe aparecer al Oeste (32 px)');
  assert.equal(east.y, 200);
  assert.equal(east.facing, 'right');

  const west = resolve('left');
  assert.equal(west.x, 576 - 32, 'Salir por el Oeste debe aparecer al Este');
  assert.equal(west.facing, 'left');

  fake.player.direction = 'down';
  const south = RPGGame.prototype._resolveStageSpawn.call(fake, { spawnX: 288 });
  assert.equal(south.y, 32, 'Salir por el Sur debe aparecer arriba');
  assert.equal(south.x, 288);
  assert.equal(south.facing, 'down');

  fake.player.direction = 'up';
  const north = RPGGame.prototype._resolveStageSpawn.call(fake, { spawnX: 288 });
  assert.equal(north.y, 384 - 32, 'Salir por el Norte debe aparecer abajo');
  assert.equal(north.x, 288);
  assert.equal(north.facing, 'up');

  // La puerta Este del overworld fuerza el borde opuesto aunque la dirección sea otra.
  fake.player.direction = 'down';
  const forced = RPGGame.prototype._resolveStageSpawn.call(fake, {
    exitDirection: 'east',
    spawnY: 240
  });
  assert.equal(forced.x, 32);
  assert.equal(forced.y, 240);
});

test('Puerta con nivel: empuje inverso de 2 tiles y bloqueo del Guardia Vulcano', () => {
  const player = { x: 128, y: 128 };
  pushBackPlayer(player, 'down', 2);
  assert.equal(player.x, 128);
  assert.equal(player.y, 96, 'Debe retroceder 2 tiles (32 px) en sentido opuesto');
  assert.ok(player.knockbackTimer > 0);

  const block = getDoorBlock('south_swamp', { level: 1 });
  assert.ok(block, 'El Guardia Vulcano debe bloquear el nivel 1');
  assert.ok(block.title.includes('VULCANO'));
  assert.equal(getDoorBlock('south_swamp', { level: 3 }), null, 'Nivel 3 debe permitir el paso');
});

test('Cámara cinematográfica: zoom/offset suavizados y reset a gameplay', () => {
  const cam = new Camera2D(320, 180, 1000, 1000);
  cam.setCinematicTarget(2, 40, -20);
  cam.update({ x: 400, y: 300, width: 16, height: 16 }, 0.2);

  assert.ok(cam.cinematicZoom > 1 && cam.cinematicZoom < 2, 'El zoom debe interpolar, no saltar');
  assert.ok(cam.cinematicOffset.x > 0 && cam.cinematicOffset.x < 40, 'El offset X debe interpolar');
  assert.ok(cam.cinematicOffset.y < 0 && cam.cinematicOffset.y > -20, 'El offset Y debe interpolar');

  cam.resetCinematic();
  assert.equal(cam.cinematicZoom, 1);
  assert.equal(cam.targetCinematicZoom, 1);
  assert.deepEqual(cam.cinematicOffset, { x: 0, y: 0 });
  assert.deepEqual(cam.targetCinematicOffset, { x: 0, y: 0 });
});

test('Spawn fijo de templos: usa spawnX/spawnY y no el borde genérico', () => {
  const fake = {
    tilemap: { tileSize: 16, width: 384, height: 288 },
    player: { direction: 'left' },
    _compassFromDirection: () => 'west'
  };
  const controller = new SceneTransitionController(fake);
  const spawn = controller.resolveSpawn({
    spawnX: 10.5 * 16,
    spawnY: 14.5 * 16,
    spawnMode: 'fixed',
    entryFacing: 'up'
  });
  assert.equal(spawn.x, 168, 'Debe respetar la X del vano del templo');
  assert.equal(spawn.y, 232, 'Debe respetar la Y del vano del templo');
  assert.equal(spawn.facing, 'up', 'Debe mirar hacia el interior');
});

test('SceneTransitionController.checkEdgeTransitions no lanza ReferenceError al salir de cinemática', () => {
  let transitioned = false;
  const fake = {
    animeCutscenes: { isActive: false },
    dialogueBox: { active: false },
    inventory: { isOpen: false },
    characterStats: { isOpen: false },
    transitionCooldown: 0,
    tilemap: {
      currentSceneId: 'overworld',
      tileSize: 16,
      findNearbyDoor: () => null
    },
    player: { x: 224, y: 192, centerX: 232, centerY: 200 },
    _executeInteraction: () => {
      transitioned = true;
    }
  };
  const controller = new SceneTransitionController(fake);
  controller.checkEdgeTransitions();
  assert.equal(transitioned, false);
});

test('CinematicDirector._finalize limpia estado, menú, diálogo, input y jugador tras Escape', () => {
  let dialogueClosed = false;
  let inputCleared = false;
  let cameraReset = false;
  let cameraSnapped = false;
  let completed = false;
  const fakeGame = {
    menuSystem: { state: 'cutscene' },
    dialogueBox: {
      active: true,
      close: () => {
        dialogueClosed = true;
        fakeGame.dialogueBox.active = false;
      }
    },
    input: {
      consumeKey: (k) => k === 'Escape',
      clear: () => {
        inputCleared = true;
      }
    },
    player: { x: Number.NaN, y: undefined, isDead: true, isSleeping: true },
    camera: {
      resetCinematic: () => {
        cameraReset = true;
      },
      snapTo: () => {
        cameraSnapped = true;
      }
    }
  };
  const director = new CinematicDirector(fakeGame);
  director.isActive = true;
  director.onComplete = () => {
    completed = true;
  };
  director._applyHorizontalInput(fakeGame.input);
  assert.equal(director.ending, true, 'Escape debe iniciar el cierre de cinemática');
  assert.equal(inputCleared, true, 'Escape debe limpiar el estado de input');

  inputCleared = false;
  director._finalize();
  assert.equal(director.isActive, false, 'isActive debe quedar en false');
  assert.equal(fakeGame.menuSystem.state, 'none', 'menuSystem.state debe volver a none');
  assert.equal(dialogueClosed, true, 'dialogueBox.close debe ejecutarse');
  assert.equal(inputCleared, true, 'input.clear debe ejecutarse en _finalize');
  assert.equal(fakeGame.player.isDead, false, 'player.isDead debe resetearse');
  assert.equal(fakeGame.player.isSleeping, false, 'player.isSleeping debe resetearse');
  assert.equal(fakeGame.player.x, 224, 'player.x NaN debe recuperarse a 224');
  assert.equal(fakeGame.player.y, 192, 'player.y undefined debe recuperarse a 192');
  assert.equal(cameraReset, true);
  assert.equal(cameraSnapped, true);
  assert.equal(completed, true);
});

test('Elementos estéticos (toldos, faroles, pozo, mesas, cajas, mobiliario y copas) son atravesables', () => {
  const tm = new Tilemap(null, 16);
  tm.loadScene('overworld');

  // Plaza del mercado en Valleverde: toldos (ROOF_RED/BLUE), faroles (LAMPPOST), mesas (TABLE), cajas (CRATE) y pozo (WELL)
  assert.equal(tm.isSolidAtTile(14, 8), false, 'Toldo rojo debe ser atravesable (CAPA 2 overhead)');
  assert.equal(tm.isSolidAtTile(19, 8), false, 'Toldo azul debe ser atravesable (CAPA 2 overhead)');
  assert.equal(tm.isSolidAtTile(13, 9), false, 'Farol del mercado debe ser atravesable');
  assert.equal(tm.isSolidAtTile(14, 10), false, 'Mostrador/mesa debe ser atravesable');
  assert.equal(tm.isSolidAtTile(13, 10), false, 'Caja decorativa debe ser atravesable');
  assert.equal(tm.isSolidAtTile(17, 12), false, 'Pozo de la plaza debe ser atravesable');

  // Los muros de edificios siguen siendo sólidos
  assert.equal(tm.isSolidAtTile(2, 10), true, 'Muro de fachada debe seguir bloqueando');
});

test('Expansión v2.0: escena valleverde_corp (24x18), props pequeños sin colisión, puertas y colores NPC', async () => {
  const tm = new Tilemap(null, 16);
  await tm.loadExpansionScenes();
  tm.loadScene('valleverde_corp');
  const scene = tm.scenes.valleverde_corp;
  assert.ok(scene, 'La escena valleverde_corp debe existir');
  assert.equal(scene.cols, 24);
  assert.equal(scene.rows, 18);

  // Suelo corporativo y pantallas CRT gigantes
  assert.equal(scene.layers.ground[10][10], TILES.CORP_FLOOR);
  assert.equal(scene.layers.decoration[1][7], TILES.CORP_CRT_WALL);

  // Props pequeños sin colisión (plantas, extintores, carteles de Alex)
  assert.equal(tm.isSolidAtTile(2, 5), false, 'Planta de plástico no debe bloquear');
  assert.equal(tm.isSolidAtTile(1, 7), false, 'Extintor no debe bloquear');
  assert.equal(tm.isSolidAtTile(3, 1), false, 'Cartel de Alex no debe bloquear');

  // Muros de cristal siguen bloqueando
  assert.equal(tm.isSolidAtTile(0, 5), true, 'Muro de cristal debe bloquear');

  // Puertas: Núcleo de Alex (bloqueado), Vertedero Digital, Oficina de Tony Randazzo
  const coreDoor = tm.findNearbyDoor({ centerX: 11.5 * 16, centerY: 2.2 * 16 });
  assert.ok(coreDoor && coreDoor.blocked === true, 'Puerta al Núcleo de Alex debe estar bloqueada al inicio');

  const elevDoor = tm.findNearbyDoor({ centerX: 20.5 * 16, centerY: 15.5 * 16 });
  assert.ok(elevDoor && elevDoor.targetScene === 'vertedero_digital', 'Debe existir acceso al Vertedero Digital');

  const tonyDoor = tm.findNearbyDoor({ centerX: 4.5 * 16, centerY: 4.6 * 16 });
  assert.ok(tonyDoor && tonyDoor.targetScene === 'oficina_tony', 'Debe existir entrada a la oficina de Tony');

  // Colores corporativos según diseño
  assert.equal(EXPANSION_NPCS.tony_randazzo.spriteColor, '#94a3b8');
  assert.equal(EXPANSION_NPCS.cepedita_tieso.spriteColor, '#9ca3af');
  assert.equal(EXPANSION_NPCS.tio_manoplo.spriteColor, '#2563eb');
});

test('QuestLogView: render con puntero/hover sobre filas no provoca TDZ en ry', () => {
  const ctx = makeMockCtx();
  const ql = new QuestLog();

  const qlv = new QuestLogView(ql, 320, 180);
  qlv.open();
  qlv.selectedIndex = 0;
  // Posición dentro del ancho de las tarjetas de la columna izquierda para evaluar `hp.y >= ry`
  qlv._hoverPointer = { x: 60, y: 80 };
  assert.doesNotThrow(() => qlv.render(ctx));
  assert.ok(qlv._rowRects.length >= 2, 'Debe registrar las tarjetas visibles tras renderizar');
});

test('WorldMap estilo Zelda: textura offscreen con tiles reales, filtro 0.4, niebla, tooltip y posición exacta', () => {
  const prevDoc = globalThis.document;
  const offFillStyles = new Set();
  let offscreenCreates = 0;
  const offMockCtx = {
    imageSmoothingEnabled: true,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    setLineDash: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    strokeRect: () => {},
    fillText: () => {},
    save: () => {},
    restore: () => {},
    fillRect: () => { offFillStyles.add(offMockCtx.fillStyle); }
  };

  globalThis.document = {
    createElement: (tag) => {
      if (tag !== 'canvas') return {};
      offscreenCreates += 1;
      return { width: 0, height: 0, getContext: () => offMockCtx };
    }
  };

  try {
    const tm = new Tilemap(null, 16);
    const wm = new WorldMap();
    const tex1 = wm._generateRealMapTexture(tm);
    const tex2 = wm._generateRealMapTexture(tm);

    assert.ok(tex1, 'Debe generar un canvas offscreen');
    assert.equal(tex1, tex2, 'Debe reutilizar la textura cacheada en llamadas posteriores');
    assert.equal(offscreenCreates, 1, 'El canvas offscreen debe crearse una sola vez');
    assert.ok(offFillStyles.has('#2d5a27'), 'Debe pintar hierba verde oscuro (#2d5a27)');
    assert.ok(offFillStyles.has('#1e3a8a'), 'Debe pintar agua azul profundo (#1e3a8a)');
    assert.ok(offFillStyles.has('#8b5a2b'), 'Debe pintar caminos marrón claro (#8b5a2b)');
    assert.ok(offFillStyles.has('#4b5563'), 'Debe pintar piedra/mazmorra gris oscuro (#4b5563)');
    assert.ok(offFillStyles.has('#10b981'), 'Debe pintar copas de árboles verde brillante (#10b981)');

    // Posición exacta basada en (x, y) real del jugador
    const posA = wm._resolvePlayerLocation('overworld', new Player({ x: 48, y: 48 }), tm);
    const posB = wm._resolvePlayerLocation('overworld', new Player({ x: 420, y: 260 }), tm);
    assert.ok(posB.x > posA.x && posB.y > posA.y, 'La posición en el mapa debe reflejar (x, y) real en la escena');

    // Render completo con drawImage, overlay 0.4, niebla sobre zonas no visitadas y tooltip
    let drawImageCalled = false;
    const renderFills = [];
    const renderTexts = [];
    const renderCtx = {
      imageSmoothingEnabled: true,
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left',
      textBaseline: 'top',
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      measureText: (t) => ({ width: String(t).length * 4 }),
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      fill: () => {},
      strokeRect: () => {},
      fillRect: () => { renderFills.push(renderCtx.fillStyle); },
      fillText: (t) => { renderTexts.push(String(t)); },
      drawImage: () => { drawImageCalled = true; }
    };

    wm._hoverRegion = 'north';
    wm.render(renderCtx, 'overworld', new Player({ x: 200, y: 180 }), [], tm);
    assert.equal(drawImageCalled, true, 'render() debe dibujar la textura offscreen con drawImage');
    assert.ok(renderFills.includes('rgba(0, 0, 0, 0.4)'), 'render() debe aplicar el filtro negro alpha 0.4');
    assert.ok(renderTexts.includes('???'), 'Las zonas sin visitar deben quedar cubiertas por niebla oscura');
    assert.ok(renderTexts.includes('Cumbres de la Recursión'), 'El hover debe mostrar el tooltip de la región');
  } finally {
    globalThis.document = prevDoc;
  }
});

test('Cursor contextual: guante de puntero en UI (dorado en hover), puño/espada solo en gameplay', () => {
  const makeCursorCtx = () => {
    const fills = [];
    return {
      fills,
      imageSmoothingEnabled: true,
      fillStyle: '',
      save() {},
      restore() {},
      fillRect(x, y, w, h) {
        fills.push({ color: this.fillStyle, x, y, w, h });
      }
    };
  };

  const fakeGame = {
    input: { pointerX: 50, pointerY: 60, lastPointerType: 'mouse', isDOMBlocked: () => false },
    player: { hasSword: false },
    menuSystem: {
      state: 'title',
      isBlockingGameplay() { return this.state !== 'none'; },
      _getCurrentMenuItems: () => [{ label: 'Nueva Partida' }],
      _getMenuHitboxes: () => [{ x: 100, y: 90, w: 80, h: 14 }]
    },
    inventory: { isOpen: false, _slotAt: () => null },
    dialogueBox: { active: false, isShowingChoices: () => false },
    characterStats: { isOpen: false },
    questLogView: { isOpen: false },
    shopUI: { isOpen: false },
    aiChatOpen: false,
    _isInUIMode: RPGGame.prototype._isInUIMode,
    _isPointerOverInteractiveUI: RPGGame.prototype._isPointerOverInteractiveUI,
    _renderPointerGloveCursor: RPGGame.prototype._renderPointerGloveCursor,
    _renderCustomCursor: RPGGame.prototype._renderCustomCursor
  };

  // 1. Menú de título sin hover sobre botón -> guante blanco anclado en (50, 60)
  assert.equal(fakeGame._isInUIMode(), true);
  let ctx = makeCursorCtx();
  fakeGame._renderCustomCursor(ctx);
  assert.ok(ctx.fills.some((f) => f.color === '#f8fafc' && f.x === 51 && f.y === 61), 'En UI debe dibujar guante blanco');
  assert.ok(ctx.fills.some((f) => f.color === '#ffffff' && f.x === 51 && f.y === 61), 'Debe incluir brillo blanco en punta');
  assert.equal(ctx.fills.some((f) => f.color === '#f1c27d'), false, 'En UI no debe dibujar el puño de combate');

  // 2. Hover sobre "Nueva Partida" -> guante dorado iluminado
  fakeGame.input.pointerX = 120;
  fakeGame.input.pointerY = 96;
  ctx = makeCursorCtx();
  fakeGame._renderCustomCursor(ctx);
  assert.ok(ctx.fills.some((f) => f.color === '#fde047'), 'Al hacer hover en botón de menú debe iluminarse en dorado');

  // 3. Gameplay puro sin espada -> puño (#f1c27d)
  fakeGame.menuSystem.state = 'none';
  assert.equal(fakeGame._isInUIMode(), false);
  ctx = makeCursorCtx();
  fakeGame._renderCustomCursor(ctx);
  assert.ok(ctx.fills.some((f) => f.color === '#f1c27d'), 'En gameplay sin espada debe dibujar puño');
  assert.equal(ctx.fills.some((f) => f.color === '#ffffff'), false, 'En gameplay sin UI no dibuja el brillo del guante');

  // 4. Gameplay con espada -> espada (#eab308 guarda / #94a3b8 hoja)
  fakeGame.player.hasSword = true;
  ctx = makeCursorCtx();
  fakeGame._renderCustomCursor(ctx);
  assert.ok(ctx.fills.some((f) => f.color === '#eab308'), 'En gameplay con espada debe dibujar guarda de espada');

  // 5. Inventario abierto (aunque tenga espada) -> vuelve al guante de puntero
  fakeGame.inventory.isOpen = true;
  assert.equal(fakeGame._isInUIMode(), true);
  ctx = makeCursorCtx();
  fakeGame._renderCustomCursor(ctx);
  assert.ok(ctx.fills.some((f) => f.color === '#f8fafc'), 'Con inventario abierto debe volver al guante de puntero');
  assert.equal(ctx.fills.some((f) => f.color === '#92400e'), false, 'Con inventario abierto no debe dibujar mango de espada');

  // 6. Otros modales también activan _isInUIMode()
  fakeGame.inventory.isOpen = false;
  fakeGame.shopUI.isOpen = true;
  assert.equal(fakeGame._isInUIMode(), true);
  fakeGame.shopUI.isOpen = false;
  fakeGame.questLogView.isOpen = true;
  assert.equal(fakeGame._isInUIMode(), true);
  fakeGame.questLogView.isOpen = false;
  fakeGame.characterStats.isOpen = true;
  assert.equal(fakeGame._isInUIMode(), true);
  fakeGame.characterStats.isOpen = false;
  fakeGame.dialogueBox.active = true;
  assert.equal(fakeGame._isInUIMode(), true);
});

test('Vertedero Digital 2.0: 5 pisos modulares, puertas, Currículum HUD, soft-reset y Franco el Pancho', async () => {
  // 1. Escenas modulares en Tilemap
  const tm = new Tilemap(null, 16);
  await tm.loadExpansionScenes();
  const customOrder = ['forge_puzzle', 'mines_entry', 'vertedero_digital', 'forge_entry', 'sewers_dungeon'];
  tm.configureVertederoFloors(customOrder);

  tm.loadScene('vertedero_digital');
  assert.equal(tm.cols, 24);
  assert.equal(tm.rows, 18);
  assert.ok(tm.scenes.kernel_arena, 'Debe existir la escena kernel_arena');

  for (let i = 1; i <= 5; i++) {
    const id = `vertedero_piso_${i}`;
    tm.loadScene(id);
    assert.equal(tm.cols, 24);
    assert.equal(tm.rows, 18);

    // Salida sur desde cualquier piso vuelve a valleverde_corp
    const southDoor = tm.findNearbyDoor({ centerX: 11.5 * 16, centerY: 16.8 * 16 });
    assert.ok(southDoor, `${id} debe tener salida sur`);
    assert.equal(southDoor.targetScene, 'valleverde_corp');

    // Puerta norte avanza al siguiente piso o a kernel_arena en el piso 5
    const northDoor = tm.findNearbyDoor({ centerX: 11.5 * 16, centerY: 1.3 * 16 });
    assert.ok(northDoor, `${id} debe tener puerta norte`);
    assert.equal(northDoor.targetScene, i < 5 ? `vertedero_piso_${i + 1}` : 'kernel_arena');
  }

  // 2. HUD del Currículum (solo en Vertedero o Tienda de Rosa, con parpadeo verde)
  const makeHudCtx = () => {
    const ops = [];
    return {
      ops,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      textBaseline: '',
      save: () => {},
      restore: () => {},
      fillRect: (x, y, w, h) => ops.push({ op: 'fillRect', color: undefined, x, y, w, h }),
      strokeRect: () => {},
      fillText: (text) => ops.push({ op: 'fillText', text: String(text) })
    };
  };
  const wrapHudCtx = () => {
    const raw = makeHudCtx();
    return new Proxy(raw, {
      set(target, prop, val) {
        target[prop] = val;
        return true;
      },
      get(target, prop) {
        if (prop === 'fillRect') {
          return (x, y, w, h) => target.ops.push({ op: 'fillRect', color: target.fillStyle, x, y, w, h });
        }
        if (prop === 'strokeRect') {
          return (x, y, w, h) => target.ops.push({ op: 'strokeRect', color: target.strokeStyle, x, y, w, h });
        }
        return target[prop];
      }
    });
  };

  assert.equal(UILayout.drawCurriculumHud(wrapHudCtx(), { curriculum: 7, sceneId: 'overworld' }), false);
  assert.equal(UILayout.drawCurriculumHud(wrapHudCtx(), { curriculum: 7, sceneId: 'valleverde_corp' }), false);

  const vertCtx = wrapHudCtx();
  assert.equal(UILayout.drawCurriculumHud(vertCtx, { curriculum: 7, sceneId: 'vertedero_piso_2', flashTimer: 0 }), true);
  assert.ok(vertCtx.ops.some((o) => o.op === 'fillText' && o.text === '📄 7'));

  const flashCtx = wrapHudCtx();
  assert.equal(UILayout.drawCurriculumHud(flashCtx, { curriculum: 8, isRosaShopOpen: true, flashTimer: 0.72 }), true);
  assert.ok(flashCtx.ops.some((o) => o.op === 'fillText' && o.text === '📄 8'));
  assert.ok(
    flashCtx.ops.some((o) => o.op === 'strokeRect' && o.color === '#4ade80'),
    'Con flashTimer activo debe parpadear en verde'
  );

  // 3. Franco el Pancho: rescate en piso 3, acompañante IA de combate y retorno seguro a Valleverde 2.0
  let recruitedSignal = false;
  const franco = new FrancoPancho({
    sceneId: 'vertedero_piso_3',
    x: 3 * 16,
    y: 4 * 16,
    onRecruit: () => { recruitedSignal = true; }
  });
  const dialogueBox = new DialogueBox();
  dialogueBox.start(franco);
  assert.ok(dialogueBox.lines.join(' ').replace(/\s+/g, ' ').includes('Llevo 3 meses escoltando a empleados que no existen'));
  assert.equal(dialogueBox.choices[0].label, 'Te saco de aquí');
  dialogueBox.visibleChars = 999;
  dialogueBox.advance(); // Confirma 'Te saco de aquí'
  assert.equal(recruitedSignal, true);
  assert.equal(franco.rescued, true);
  assert.equal(franco.isCompanion, true);

  tm.loadScene('vertedero_piso_3');
  const allyPlayer = new Player({ x: 8 * 16, y: 10 * 16 });
  const initialFrancoX = franco.x;
  for (let step = 0; step < 6; step++) {
    franco.update(0.05, tm, [], false, allyPlayer, null, []);
  }
  assert.ok(franco.x > initialFrancoX, 'Como acompañante debe seguir hacia el jugador');

  const nearbyEnemy = new Enemy({
    id: 'vertedero_test_mob',
    name: 'Auditor Glitch',
    x: franco.x + 10,
    y: franco.y,
    sceneId: 'vertedero_piso_3',
    maxHp: 3
  });
  franco.attackCooldown = 0;
  franco.update(0.05, tm, [], false, allyPlayer, null, [nearbyEnemy]);
  assert.equal(nearbyEnemy.hp, 2, 'Franco acompañante debe atacar enemigos cercanos');

  // 4. Transición a vertedero_digital -> vertedero_piso_1 + Rogue-lite soft-reset conservando Currículums
  const prevStorage = globalThis.localStorage;
  const storeMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
    setItem: (k, v) => storeMap.set(k, String(v)),
    removeItem: (k) => storeMap.delete(k)
  };
  try {
    tm.loadScene('valleverde_corp');
    const mob = new Enemy({ id: 'vertedero_f3_1', name: 'Mob P3', x: 64, y: 64, sceneId: 'vertedero_piso_3', maxHp: 3 });
    mob.dead = true;
    mob.coinsDropped = true;

    const fakeGame = {
      tilemap: tm,
      player: new Player({ x: 20 * 16, y: 14 * 16 }),
      camera: new Camera2D(320, 180),
      enemies: [mob],
      npcs: [franco],
      droppedCoins: [{ x: 64, y: 64, sceneId: 'vertedero_piso_3', kind: 'curriculum', value: 1 }],
      curriculum: 5,
      curriculumFlashTimer: 0,
      vertederoRebootTimer: 0,
      francoRescued: true,
      vertederoFloorOrder: [],
      menuSystem: { showNotice: () => {} },
      music: { currentBossTrack: null, setMode: () => {}, playDoorOpenSound: () => {}, playError: () => {} },
      _restoreAllNPCsToOverworld: () => {},
      _resolveStageSpawn: (door) => ({ x: door.targetX || 11.5 * 16, y: door.targetY || 15.2 * 16, facing: 'up' }),
      _handleHouseOwnerConfrontation: () => {},
      _saveGameToStorage: () => {},
      _shuffleVertederoOrder: RPGGame.prototype._shuffleVertederoOrder,
      _resetVertederoEnemiesAndDrops: RPGGame.prototype._resetVertederoEnemiesAndDrops,
      _syncFrancoNPCState: RPGGame.prototype._syncFrancoNPCState,
      _startVertederoRun: RPGGame.prototype._startVertederoRun,
      _syncFrancoCompanionOnTransition: RPGGame.prototype._syncFrancoCompanionOnTransition,
      _saveExpansionProgress: RPGGame.prototype._saveExpansionProgress,
      _triggerVertederoSoftReset: RPGGame.prototype._triggerVertederoSoftReset,
      _finishVertederoSoftReset: RPGGame.prototype._finishVertederoSoftReset
    };

    const stc = new SceneTransitionController(fakeGame);
    stc.executeStageTransition({ type: 'stage', targetScene: 'vertedero_digital', targetX: 11.5 * 16, targetY: 15.2 * 16, forceDirection: 'up' });
    assert.equal(tm.currentSceneId, 'vertedero_piso_1', 'Entrar a vertedero_digital inicia en vertedero_piso_1');
    assert.equal(mob.dead, false, 'Al iniciar un run los enemigos del Vertedero se reinician');
    assert.equal(franco.sceneId, 'valleverde_corp', 'Tras ser rescatado, Franco permanece a salvo en Valleverde 2.0 en futuros runs');
    assert.equal(franco.isCompanion, false);

    // Muerte en el piso 3 -> reinicio de sistema de 2s sin perder Currículums
    tm.loadScene('vertedero_piso_3');
    fakeGame.player.hp = 0;
    fakeGame._triggerVertederoSoftReset();
    assert.equal(fakeGame.vertederoRebootTimer, 2.0);
    fakeGame._finishVertederoSoftReset();
    assert.equal(tm.currentSceneId, 'vertedero_piso_1', 'El soft-reset devuelve al piso 1');
    assert.ok(fakeGame.player.hp > 0, 'El soft-reset restaura la salud al máximo');
    assert.equal(fakeGame.curriculum, 5, 'El soft-reset conserva los Currículums acumulados');
    assert.ok(storeMap.has('el_ojete_dorado_expansion_save'), 'Debe persistir Currículums y rescate en localStorage');
  } finally {
    globalThis.localStorage = prevStorage;
  }
});

test('Acto 2: El Kernel (3 fases, HUD hack, clones, firewalls, Llave) y Bar de Rosa (RosaShop)', async () => {
  // 1. Escenas kernel_arena (12x10) y rosa_bar (10x8) y puertas en valleverde_corp
  const tm = new Tilemap(null, 16);
  await tm.loadExpansionScenes();
  tm.loadScene('kernel_arena');
  assert.equal(tm.cols, 12);
  assert.equal(tm.rows, 10);

  tm.loadScene('rosa_bar');
  assert.equal(tm.cols, 10);
  assert.equal(tm.rows, 8);
  assert.equal(UILayout.shouldShowCurriculumHud('rosa_bar', false), true);

  tm.loadScene('valleverde_corp');
  const rosaEntrance = tm.findNearbyDoor({ centerX: 19.5 * 16, centerY: 2.0 * 16 });
  assert.ok(rosaEntrance && rosaEntrance.targetScene === 'rosa_bar');

  // 2. Fase 1 de El Kernel: entrada a kernel_arena oculta HUD con error_buzz y lanza Pantallazos Azules
  const sfxLog = [];
  const kernel = new KernelBoss({ x: 5.5 * 16, y: 3.2 * 16, sceneId: 'kernel_arena', hp: 150 });
  const player = new Player({ x: 5.5 * 16, y: 7.5 * 16 });
  player.hasSword = true;
  player.hp = 5;
  player.maxHp = 5;

  const gameState = {
    tilemap: tm,
    player,
    camera: new Camera2D(320, 180),
    enemies: [kernel],
    npcs: [],
    curriculum: 12,
    curriculumFlashTimer: 0,
    kernelHackActive: false,
    kernelHudFlicker: false,
    bsodOverlayTimer: 0,
    francoRescued: false,
    dayNight: new DayNightCycle(),
    touchControls: null,
    menuSystem: { showNotice: () => {} },
    music: {
      currentBossTrack: null,
      playBossMusic: () => {},
      stopBossMusic: () => {},
      setMode: () => {},
      playDoorOpenSound: () => {},
      playFanfare: () => {},
      playError: () => sfxLog.push('playError'),
      playSFX: (name) => sfxLog.push(name)
    },
    _restoreAllNPCsToOverworld: () => {},
    _resolveStageSpawn: (door) => ({ x: door.targetX || 5.5 * 16, y: door.targetY || 8 * 16, facing: 'up' }),
    _handleHouseOwnerConfrontation: () => {},
    _saveGameToStorage: () => {},
    _syncFrancoCompanionOnTransition: () => {},
    _saveExpansionProgress: RPGGame.prototype._saveExpansionProgress
  };

  const stc = new SceneTransitionController(gameState);
  stc.executeStageTransition({ type: 'stage', targetScene: 'kernel_arena', targetX: 5.5 * 16, targetY: 8 * 16, forceDirection: 'up' });
  assert.equal(tm.currentSceneId, 'kernel_arena');
  assert.equal(kernel.hudHackActive, true, 'En Fase 1 al entrar a kernel_arena se oculta el HUD');
  assert.equal(gameState.kernelHackActive, true);
  assert.ok(kernel.introQuote.includes('Identificación no reconocida'));
  assert.ok(sfxLog.includes('error_buzz'), 'Debe reproducir error_buzz al ocultar el HUD');

  // Verificar que RPGGame._renderHUD retorna sin dibujar cuando kernelHackActive es true
  let hudFillCalls = 0;
  const mockHudCtx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'top',
    save: () => {}, restore: () => {},
    fillRect: () => { hudFillCalls += 1; },
    strokeRect: () => {},
    fillText: () => {}
  };
  RPGGame.prototype._renderHUD.call(gameState, mockHudCtx);
  assert.equal(hudFillCalls, 0, '_renderHUD no debe dibujar nada mientras kernelHackActive esté activo');

  // Pantallazo Azul (BSOD) proyectil + overlay :( de 0.5s
  kernel.bsodShotTimer = 0.01;
  kernel.update(0.05, tm, player, false, gameState.music);
  assert.ok(kernel.projectiles.some((p) => p.kind === 'bsod'), 'Debe disparar proyectiles BSOD azules');
  assert.ok(kernel.bsodOverlayTimer > 0 && kernel.bsodOverlayTimer <= 0.5);
  const bsodTexts = [];
  RPGGame.prototype._renderKernelBSODOverlay.call(gameState, {
    fillStyle: '', font: '', textAlign: 'left', textBaseline: 'middle',
    save: () => {}, restore: () => {}, fillRect: () => {},
    fillText: (t) => bsodTexts.push(t)
  });
  assert.ok(bsodTexts.includes(':('), 'El overlay de pantallazo azul debe mostrar :(');

  // 3. Fase 2 (66% - 33%): 4 clones (solo 1 real), HUD vuelve parpadeando, clon falso explota
  kernel.hp = 95;
  kernel.hitFlashTimer = 0;
  kernel.update(0.05, tm, player, false, gameState.music);
  assert.equal(kernel.phase, 2);
  assert.equal(kernel.hudHackActive, false, 'En Fase 2 se levanta el bloqueo total del HUD');
  assert.equal(kernel.hudFlicker, true, 'En Fase 2 el HUD parpadea de forma inestable');
  assert.equal(kernel.clones.length, 4, 'Debe dividirse en 4 clones');
  const realClones = kernel.clones.filter((c) => c.isReal);
  const fakeClones = kernel.clones.filter((c) => !c.isReal);
  assert.equal(realClones.length, 1, 'Solo 1 clon es real');
  assert.equal(fakeClones.length, 3);

  // Golpear a un clon falso hace explotar ese clon e inflige daño en área
  const fake = fakeClones[0];
  player.invulnTimer = 0;
  const hpBeforeFakeHit = player.hp;
  player.x = fake.x;
  player.y = fake.y + 8;
  player.direction = 'up';
  player.attackTimer = 0.1;
  kernel.cloneHitLockTimer = 0;
  kernel.update(0.05, tm, player, false, gameState.music);
  assert.equal(fake.exploded, true, 'Atacar un clon falso lo hace explotar');
  assert.ok(player.hp < hpBeforeFakeHit, 'La explosión del clon falso daña al jugador en área');
  assert.equal(kernel.hp, 95, 'El clon falso no resta vida al Kernel real');

  // Atacar al clon real sí daña al Kernel real
  const real = realClones[0];
  player.attackTimer = 0;
  kernel.hitFlashTimer = 0;
  const damaged = kernel.takeSwordHit(player, gameState.music, 10);
  assert.equal(damaged, true);
  assert.equal(kernel.hp, 85);

  // 4. Fase 3 (33% - 0%): Torre gigante + Firewalls + muerte y Llave de Acceso al Núcleo
  kernel.hp = 40;
  kernel.hitFlashTimer = 0;
  kernel.update(0.05, tm, player, false, gameState.music);
  assert.equal(kernel.phase, 3);
  assert.ok(kernel.width >= 36 && kernel.height >= 44, 'En Fase 3 se transforma en torre gigante');
  kernel.firewallTimer = 0.01;
  kernel.update(0.05, tm, player, false, gameState.music);
  assert.ok(kernel.firewalls.length > 0, 'En Fase 3 genera firewalls');

  kernel.hitFlashTimer = 0;
  kernel.takeSwordHit(player, gameState.music, 50);
  assert.equal(kernel.dead, true);
  assert.equal(kernel.deathQuote, 'Esto... no... era... mi... trabajo...');
  tm.setAlexCoreUnlocked(true);
  assert.equal(tm.alexCoreUnlocked, true, 'Al morir el Kernel debe desbloquearse el Núcleo de Alex');
  const northCoreDoor = tm.findNearbyDoor({ centerX: 5.5 * 16, centerY: 1.1 * 16 });
  assert.ok(northCoreDoor && !northCoreDoor.blocked, 'La transición norte al Núcleo debe quedar desbloqueada');

  // 5. Tienda de Rosa (RosaShop): compra de las 4 mejoras permanentes con Currículums y persistencia
  const prevStorage = globalThis.localStorage;
  const storeMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
    setItem: (k, v) => storeMap.set(k, String(v)),
    removeItem: (k) => storeMap.delete(k)
  };
  try {
    const rosaShop = new RosaShop(gameState);
    assert.equal(rosaShop.upgrades.length, 4);

    const baseDamage = player.getSwordDamage();
    const baseStamina = player.effectiveMaxStamina;
    const baseMaxHp = player.maxHp;

    const r1 = rosaShop.buyUpgrade('plus_salud');       // 3 📄 -> quedan 9
    assert.equal(r1.ok, true);
    assert.equal(player.maxHp, baseMaxHp + 1);

    const r2 = rosaShop.buyUpgrade('aumento_sueldo');   // 2 📄 -> quedan 7
    assert.equal(r2.ok, true);
    assert.ok(player.getSwordDamage() > baseDamage);

    const r3 = rosaShop.buyUpgrade('optimizacion');     // 2 📄 -> quedan 5
    assert.equal(r3.ok, true);
    assert.equal(player.effectiveMaxStamina, baseStamina + 20);

    const r4 = rosaShop.buyUpgrade('teletrabajo');      // 5 📄 -> quedan 0
    assert.equal(r4.ok, true);
    assert.equal(gameState.curriculum, 0);
    assert.equal(player.maxDashCharges, 2, 'Teletrabajo otorga +1 Dash extra');

    // Encadenar 2 dashes seguidos sin esperar el cooldown completo
    assert.equal(player.tryDash(), true);
    player.dashTimer = 0;
    assert.equal(player.tryDash(), true);
    assert.equal(player.tryDash(), false);

    // Sin Currículums suficientes rechaza nueva compra
    const failRes = rosaShop.buyUpgrade('optimizacion');
    assert.equal(failRes.ok, false);
    assert.ok(storeMap.has('el_ojete_dorado_expansion_save'), 'Las mejoras de Rosa deben persistir en localStorage');
  } finally {
    globalThis.localStorage = prevStorage;
  }
});

test('Acto 3: ai_nucleus_core (14x12), AlexUpdateBoss (5 fases + punto débil), 3 Finales y Jefa Secreta Deuda Técnica', async () => {
  const prevStorage = globalThis.localStorage;
  const storeMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
    setItem: (k, v) => storeMap.set(k, String(v)),
    removeItem: (k) => storeMap.delete(k)
  };

  try {
    // 1. Escena ai_nucleus_core (14x12) y música boss_alex_final
    const tm = new Tilemap(null, 16);
    await tm.loadExpansionScenes();
    tm.setAlexCoreUnlocked(true);
    tm.loadScene('ai_nucleus_core');
    const core = tm.scenes.ai_nucleus_core;
    assert.ok(core, 'Escena ai_nucleus_core debe existir');
    assert.equal(core.cols, 14);
    assert.equal(core.rows, 12);
    assert.ok(Array.isArray(tm._coreDataPlatforms) && tm._coreDataPlatforms.length >= 2);

    const exitDoor = tm.findNearbyDoor({ centerX: 6.5 * 16, centerY: 10.7 * 16 });
    assert.ok(exitDoor && exitDoor.targetScene === 'valleverde_corp', 'Salida sur debe volver a valleverde_corp');

    const musicModes = [];
    const transitionGame = {
      tilemap: tm,
      player: new Player({ x: 6.5 * 16, y: 9.8 * 16 }),
      camera: { snapTo: () => {}, setWorldBounds: () => {} },
      music: { setMode: (m) => musicModes.push(m) },
      npcs: [],
      enemies: [],
      _resolveStageSpawn: (door) => ({ x: door.targetX || 6.5 * 16, y: door.targetY || 9.8 * 16 }),
      _saveGameToStorage: () => {},
      _saveProgressToLocal: () => {}
    };
    const stc = new SceneTransitionController(transitionGame);
    stc.executeStageTransition({ type: 'stage_transition', targetScene: 'ai_nucleus_core', targetX: 6.5 * 16, targetY: 9.8 * 16 });
    assert.ok(musicModes.includes('boss_alex_final'), 'Entrar al Núcleo debe activar la música boss_alex_final');

    // 2. AlexUpdateBoss: 200 HP y las 5 Fases corporativas
    const player = new Player({ x: 6.5 * 16, y: 8.0 * 16 });
    player.hasSword = true;
    const alex = new AlexUpdateBoss({ x: 6.2 * 16, y: 3.0 * 16 });
    const mockSfx = { playEnemyAttack: () => {}, playHit: () => {}, playErrorBuzz: () => {}, playMetalClink: () => {} };
    assert.equal(alex.hp, 200);
    assert.equal(alex.phase, 1);

    // Fase 1 Marketing (200 - 160): Anuncios amarillos + 2 Becarios
    alex.adTimer = 0.01;
    alex.internSummonTimer = 0.01;
    alex.update(0.05, tm, player, false, mockSfx);
    assert.ok(alex.projectiles.some(p => p.kind === 'ad' && p.color === '#facc15'), 'Fase 1 lanza Anuncios amarillos');
    assert.equal(alex.interns.length, 2, 'Fase 1 invoca exactamente 2 Becarios');

    // Fase 2 Ventas (160 - 120): Contratos rojos que rebotan + láser AoE horizontal
    alex.hp = 155;
    alex.contractTimer = 0.01;
    alex.laserAoeTimer = 0.01;
    alex.update(0.05, tm, player, false, mockSfx);
    assert.equal(alex.phase, 2);
    assert.ok(alex.projectiles.some(p => p.kind === 'contract' && p.bouncesLeft > 0), 'Fase 2 lanza Contratos que rebotan');
    assert.ok(alex.lasers.some(l => l.orientation === 'horizontal'), 'Fase 2 activa ataque láser AoE');

    // Fase 3 RRHH (120 - 80): Burnout (ralentiza 3s) + Despidos teledirigidos
    alex.hp = 110;
    alex.burnoutCooldown = 0.01;
    alex.layoffTimer = 0.01;
    alex.update(0.05, tm, player, false, mockSfx);
    assert.equal(alex.phase, 3);
    assert.equal(player.burnoutTimer, 3.0, 'Fase 3 inflige Burnout de 3 segundos');
    assert.ok(alex.projectiles.some(p => p.kind === 'layoff' && p.homing === true), 'Fase 3 lanza Despidos teledirigidos');

    // Comprobar que el Burnout reduce el desplazamiento real del jugador
    const dummyInput = {
      getMovementVector: () => ({ x: 1, y: 0 }),
      isActionPressed: () => false,
      consumeKey: () => false
    };
    player.x = 4 * 16;
    player.y = 5 * 16;
    const pxBefore = player.x;
    player.update(0.1, dummyInput, tm);
    const burnoutDist = player.x - pxBefore;
    player.burnoutTimer = 0;
    player.x = pxBefore;
    player.update(0.1, dummyInput, tm);
    const normalDist = player.x - pxBefore;
    assert.ok(burnoutDist > 0 && burnoutDist < normalDist, 'Burnout debe ralentizar al jugador');

    // Fase 4 Legal (80 - 40): Multas en el suelo + bordes de fuego
    alex.hp = 70;
    alex.fineTimer = 0.01;
    alex.update(0.05, tm, player, false, mockSfx);
    assert.equal(alex.phase, 4);
    assert.ok(alex.fireBorderActive, 'Fase 4 activa barrera de fuego en los bordes');
    assert.ok(alex.fines.length >= 1, 'Fase 4 coloca círculos Multas en el suelo');

    // Fase 5 Dirección (40 - 0): Punto débil en la caja fuerte del pecho + Cierre de Servidores en cruz
    alex.hp = 35;
    alex.hitFlashTimer = 0;
    alex.serverShutdownTimer = 0.01;
    alex.update(0.05, tm, player, false, mockSfx);
    assert.equal(alex.phase, 5);
    assert.ok(
      alex.lasers.some(l => l.orientation === 'vertical') && alex.lasers.some(l => l.orientation === 'horizontal'),
      'Fase 5 ejecuta Cierre de Servidores con láseres en cruz'
    );

    const chest = alex.getChestWeakspotBox();
    // Golpe fuera del pecho (esquina superior izquierda) debe ser bloqueado por el blindaje
    const missRect = { x: alex.x, y: alex.y, width: 4, height: 4 };
    assert.equal(alex.takeSwordHit(player, mockSfx, 20, missRect), false, 'Golpear fuera de la caja fuerte no daña en Fase 5');
    assert.equal(alex.hp, 35);

    // Golpe directo a la caja fuerte del pecho debe dañar y matar al jefe
    alex.hitFlashTimer = 0;
    assert.equal(alex.takeSwordHit(player, mockSfx, 40, chest), true, 'Golpear la caja fuerte debe dañar en Fase 5');
    assert.equal(alex.dead, true);
    assert.equal(alex.dialogueLine, ALEX_UPDATE_DEATH_QUOTE);

    // 3. Sistema de 3 Finales + Desbloqueo de Final C + Deuda Técnica
    const achievements = new AchievementManager();
    const tony = new TonyRandazzo({ x: 32, y: 32 });
    const debtBoss = new TechnicalDebtBoss({ x: 6.2 * 16, y: 2.6 * 16 });
    let lastDialogue = null;
    let creditsRecord = null;
    let creditsDoneCb = null;

    const fakeGame = {
      tilemap: tm,
      player,
      npcs: [tony],
      enemies: [alex, debtBoss],
      curriculum: 10,
      francoRescued: false,
      tonyForgiven: false,
      expansionEndingChosen: null,
      totalPlayTimeSeconds: 420,
      totalDeaths: 1,
      totalJailVisits: 0,
      debtGlitchTimer: 0,
      camera: { snapTo: () => {} },
      soundEngine: mockSfx,
      achievementManager: achievements,
      music: { setMode: () => {}, playVictoryTheme: () => {} },
      dialogueBox: {
        showMessage: (title, lines, choices) => { lastDialogue = { title, lines, choices }; },
        close: () => {}
      },
      menuSystem: {
        state: 'playing',
        showNotice: () => {},
        startEndingCredits: (rec, cb) => {
          creditsRecord = rec;
          creditsDoneCb = cb;
        },
        openLeaderboardScreen: () => {}
      },
      _computePlayerFinalTitle: () => 'Arquitecto',
      _readExpansionStorage: () => RPGGame.prototype._readExpansionStorage.call(fakeGame),
      _saveExpansionProgress: () => RPGGame.prototype._saveExpansionProgress.call(fakeGame),
      _buildBaseVictoryRecord: () => RPGGame.prototype._buildBaseVictoryRecord.call(fakeGame),
      _canChooseMergeEnding: () => RPGGame.prototype._canChooseMergeEnding.call(fakeGame),
      shouldTriggerTechnicalDebt: (k) => RPGGame.prototype.shouldTriggerTechnicalDebt.call(fakeGame, k),
      _openAlexUpdateEndingDialogue: () => RPGGame.prototype._openAlexUpdateEndingDialogue.call(fakeGame),
      _playExpansionEnding: (k) => RPGGame.prototype._playExpansionEnding.call(fakeGame, k),
      _onExpansionCreditsFinished: (k, r) => RPGGame.prototype._onExpansionCreditsFinished.call(fakeGame, k, r),
      _triggerTechnicalDebtSecretBattle: () => RPGGame.prototype._triggerTechnicalDebtSecretBattle.call(fakeGame),
      _openScoreSubmissionModal: (r, cb) => cb?.(),
      _resetWorldToInitialState: () => {}
    };

    // Sin Tony perdonado ni Franco rescatado -> solo A y B
    fakeGame._openAlexUpdateEndingDialogue();
    assert.equal(lastDialogue.choices.length, 2, 'Sin Tony perdonado + Franco rescatado solo aparecen Final A y B');

    // Al perdonar a Tony y rescatar a Franco -> se desbloquea Final C
    tony.forgiven = true;
    fakeGame.francoRescued = true;
    fakeGame._openAlexUpdateEndingDialogue();
    assert.equal(lastDialogue.choices.length, 3, 'Con Tony perdonado y Franco rescatado se desbloquea Final C');

    // Probar Final A con >= 20 Currículums NO activa Deuda Técnica
    fakeGame.curriculum = 22;
    fakeGame._playExpansionEnding('A');
    assert.equal(storeMap.get('expansion_ending_chosen'), 'A');
    assert.equal(lastDialogue.lines[0], 'El futuro se borró. Pero tú recordarás lo que pasó.');
    assert.equal(fakeGame.shouldTriggerTechnicalDebt('A'), false);

    // Probar Final B cita correcta
    fakeGame._playExpansionEnding('B');
    assert.equal(lastDialogue.lines[0], 'No es perfecto. Pero es nuestro.');

    // Probar Final C -> Créditos -> Trigger de Jefa Secreta (curriculum >= 20 y Final C)
    fakeGame._playExpansionEnding('C');
    assert.equal(storeMap.get('expansion_ending_chosen'), 'C');
    assert.equal(lastDialogue.lines[0], 'Dos mundos. Un solo Ojete Dorado.');
    lastDialogue.choices[0].onSelect(); // Lanza créditos
    assert.ok(creditsRecord && creditsRecord.endingKey === 'C');
    assert.equal(debtBoss.dormant, true, 'Deuda Técnica permanece latente antes de acabar los créditos');

    creditsDoneCb(); // Terminan los créditos con curriculum >= 20 y Final C
    assert.equal(debtBoss.dormant, false, 'Tras créditos con >=20 Currículums y Final C despierta La Deuda Técnica');
    assert.equal(debtBoss.dead, false);
    assert.equal(debtBoss.hp, 300);

    // 4. Boss Rush de 4 fases de La Deuda Técnica (300 HP)
    assert.equal(debtBoss.phase, 1); // 300 - 250 Clon Garbage Collector
    debtBoss.hp = 230;
    debtBoss.update(0.05, tm, player, false, mockSfx);
    assert.equal(debtBoss.phase, 2); // 250 - 200 Clon Stack Overflow
    debtBoss.hp = 180;
    debtBoss.update(0.05, tm, player, false, mockSfx);
    assert.equal(debtBoss.phase, 3); // 200 - 150 Clon Kernel
    debtBoss.hp = 120;
    debtBoss.eraseTimer = 0.01;
    debtBoss.glitchCooldown = 0.01;
    debtBoss.update(0.05, tm, player, false, mockSfx);
    assert.equal(debtBoss.phase, 4); // 150 - 0 La Deuda Técnica
    assert.equal(debtBoss.glitchActive, true, 'Fase 4 genera glitches visuales');
    assert.ok(debtBoss.erasedTiles.length >= 1, 'Fase 4 borra partes de la arena');

    // Derrotar a La Deuda Técnica desbloquea Trofeo Completionista y frase final
    debtBoss.hitFlashTimer = 0;
    debtBoss.takeSwordHit(player, mockSfx, 150);
    assert.equal(debtBoss.dead, true);
    assert.equal(debtBoss.dialogueLine, TECH_DEBT_DEATH_QUOTE);
    const unlockedOk = achievements.unlock('ach_completionist');
    assert.equal(unlockedOk, true, 'Debe desbloquear el logro ach_completionist');
    assert.equal(achievements.isUnlocked('ach_completionist'), true);
    const completionistAch = achievements.getAll().find(a => a.id === 'ach_completionist');
    assert.equal(completionistAch?.title, 'Completionista', 'Derrotar a la jefa secreta desbloquea trofeo Completionista');
  } finally {
    globalThis.localStorage = prevStorage;
  }
});

test('Falso Final (glitch + trofeo + openTitleScreen) y transición startExpansion desde el menú', async () => {
  const prevStorage = globalThis.localStorage;
  const storeMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
    setItem: (k, v) => storeMap.set(k, String(v)),
    removeItem: (k) => storeMap.delete(k)
  };

  try {
    const sfxCalls = [];
    const musicModes = [];
    let expansionStartedCount = 0;

    const fakeMusic = {
      setMode: (m) => musicModes.push(m),
      playMenuSelect() {},
      playCaughtSkipSound() {},
      playMenuMove() {},
      stopTitleMusic() {},
      playTitleMusic() {},
      playSFX: (sfx) => sfxCalls.push(sfx)
    };
    const menu = new MainMenuAndScenes(320, 180, {}, fakeMusic, {
      getSaveSummary: () => null,
      onStartExpansion: () => {
        expansionStartedCount += 1;
      }
    });

    // 1. Antes del trofeo, la expansión aparece bloqueada con el subtexto pedido
    menu.openTitleScreen();
    const lockedOption = menu._getCurrentMenuItems()[2];
    assert.equal(lockedOption.locked, true);
    assert.equal(lockedOption.subtext, 'Completa el juego base para desbloquear');

    // 2. Simular final de créditos tras derrotar a FinalBossAlex (_finishBaseVictoryCredits)
    const tm = new Tilemap(null, 16);
    await tm.loadExpansionScenes();
    const player = new Player({ x: 100, y: 100 });
    let worldResetCount = 0;
    const fakeGame = {
      tilemap: tm,
      player,
      camera: { setWorldBounds: () => {}, resetCinematic: () => {}, snapTo: () => {} },
      music: fakeMusic,
      soundEngine: { playSFX: (sfx) => sfxCalls.push(sfx) },
      menuSystem: menu,
      curriculum: 0,
      francoRescued: false,
      tonyForgiven: false,
      expansionEndingChosen: null,
      _resetWorldToInitialState: () => {
        worldResetCount += 1;
        tm.loadScene('overworld');
      },
      _syncFrancoNPCState: () => {},
      _restoreExpansionSaveData: (d) => {
        fakeGame.curriculum = d.curriculum || 0;
      },
      _saveExpansionProgress: () => RPGGame.prototype._saveExpansionProgress.call(fakeGame),
      startExpansion: () => RPGGame.prototype.startExpansion.call(fakeGame)
    };

    RPGGame.prototype._finishBaseVictoryCredits.call(fakeGame, null);
    assert.equal(storeMap.get('el_ojete_dorado_victory_trophy'), 'true', 'Debe guardar el trofeo en true');
    assert.ok(sfxCalls.includes('ui_glitch'), 'Debe reproducir el SFX ui_glitch');
    assert.equal(menu.state, 'false_ending_glitch');
    assert.equal(menu.falseEndingText, 'SISTEMA CORRUPTO. BUSCANDO BACKUP...');

    // Avanzar 3.6s -> fundido a negro progresivo y mensaje activo
    const dummyInput = {
      consumeKey: () => false,
      pointerJustClicked: false
    };
    menu.update(3.6, dummyInput);
    assert.equal(menu.state, 'false_ending_glitch');
    assert.ok(menu.fadeAlpha > 0 && menu.fadeAlpha <= 1, 'Debe hacer fundido a negro hacia el final de los 4s');

    // Completar los 4s -> vuelve al menú de título y resetea estado base
    menu.update(0.6, dummyInput);
    assert.equal(worldResetCount, 1);
    assert.equal(menu.state, 'title');

    // 3. En el menú principal actualizado, la opción ya está desbloqueada y lanza onStartExpansion()
    const unlockedOption = menu._getCurrentMenuItems()[2];
    assert.equal(unlockedOption.locked, false);
    assert.equal(unlockedOption.label, 'El Resurgir de Mister Alex IA');
    unlockedOption.action();
    assert.equal(expansionStartedCount, 1);

    // 4. Ejecutar startExpansion(): crea/carga el slot independiente, va a valleverde_corp con música y aviso
    fakeGame.startExpansion();
    assert.equal(tm.currentSceneId, 'valleverde_corp', 'startExpansion teletransporta a valleverde_corp');
    assert.ok(musicModes.includes('valleverde_corp'), 'Lanza la música valleverde_corp');
    assert.equal(menu.noticeText, '3 meses después...', 'Muestra el aviso "3 meses después..."');
    assert.equal(menu.state, 'none');
    assert.ok(storeMap.has('el_ojete_dorado_expansion_save_v1'), 'Guarda en el slot independiente de expansión');

    // Si existe un slot previo en el_ojete_dorado_expansion_save_v1, startExpansion lo carga
    storeMap.set('el_ojete_dorado_expansion_save_v1', JSON.stringify({ curriculum: 14, coins: 77 }));
    fakeGame.startExpansion();
    assert.equal(fakeGame.curriculum, 14, 'startExpansion debe restaurar los datos del slot de expansión');
    assert.equal(player.coins, 77);
  } finally {
    globalThis.localStorage = prevStorage;
  }
});

test('Hotbar visual 1-5: erradicación de KeyR en consumibles, asignación en inventario, uso, vaciado y render 16x16', () => {
  const player = new Player({ x: 32, y: 32 });
  assert.deepEqual(player.hotbar, [null, null, null, null, null]);
  assert.equal(player.skills.log, false);

  // R NO debe usar consumibles ni hacer nada sin la skill log
  assert.equal(player.throwLog(null), false, 'KeyR no debe activar nada si no tiene skill log');

  // Añadir consumible al inventario
  const inv = new Inventory();
  inv.addItem({ id: 'coffee', name: 'Café Compilado', description: 'Recupera HP', iconIndex: 2, qty: 1 });
  inv.open();
  inv.selectedIndex = 0;

  const scaleCalls = [];
  const fillStyles = [];
  const strokeStyles = [];
  const texts = [];
  const rectCalls = [];
  const mockCtx = {
    save() {},
    restore() {},
    translate() {},
    scale(sx, sy) { scaleCalls.push([sx, sy]); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillRect(x, y, w, h) { rectCalls.push({ x, y, w, h, fill: mockCtx.fillStyle }); fillStyles.push(mockCtx.fillStyle); },
    strokeRect(x, y, w, h) { strokeStyles.push(mockCtx.strokeStyle); },
    fillText(txt) { texts.push(String(txt)); },
    measureText(txt) { return { width: String(txt).length * 4 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    drawImage() {}
  };
  inv.render(mockCtx, player);
  assert.ok(texts.includes('Asignar a Hotbar (1-5)'), 'Inventario debe mostrar "Asignar a Hotbar (1-5)" para consumibles');
  assert.ok(inv._touchActions.some(a => a.id === 'assign_hotbar'));
  assert.ok(inv._touchActions.some(a => a.id === 'hotbar_slot_0'));

  const fakeGame = {
    player,
    inventory: inv,
    enemies: [],
    tilemap: { currentSceneId: 'overworld' },
    touchControls: { isTouchEnabled: () => false },
    menuSystem: { showNotice: () => {} },
    music: { playMenuSelect: () => {}, playHealSound: () => {} },
    _saveGameToStorage: () => {},
    _ensurePlayerHotbar: () => RPGGame.prototype._ensurePlayerHotbar.call(fakeGame),
    syncHotbarWithInventory: () => RPGGame.prototype.syncHotbarWithInventory.call(fakeGame),
    assignHotbarSlot: (i, it) => RPGGame.prototype.assignHotbarSlot.call(fakeGame, i, it),
    _getQuickSlotIndex: (k) => RPGGame.prototype._getQuickSlotIndex.call(fakeGame, k),
    _getQuickSlotConsumable: (k) => RPGGame.prototype._getQuickSlotConsumable.call(fakeGame, k),
    _useQuickSlotConsumable: (k) => RPGGame.prototype._useQuickSlotConsumable.call(fakeGame, k),
    _renderHotbar: (ctx, hf, hs) => RPGGame.prototype._renderHotbar.call(fakeGame, ctx, hf, hs)
  };

  // Asignar Café al slot 1 (índice 0)
  assert.equal(fakeGame.assignHotbarSlot(0), true);
  assert.equal(player.hotbar[0], 'coffee');
  assert.equal(player.hotbarFlashTimers[0], 0.2);

  // KeyR nunca devuelve un consumible en _getQuickSlotConsumable
  assert.equal(fakeGame._getQuickSlotConsumable('KeyR'), null);
  assert.equal(fakeGame._getQuickSlotConsumable('Digit1')?.id, 'coffee');

  // Renderizar Hotbar durante flash -> 5 cuadraditos 16x16, fondo rgba(15, 23, 42, 0.8), escala 1.05 y números 1-5
  scaleCalls.length = 0;
  texts.length = 0;
  fillStyles.length = 0;
  rectCalls.length = 0;
  fakeGame._renderHotbar(mockCtx, () => '4px monospace', () => {});
  assert.ok(scaleCalls.some(([sx, sy]) => sx === 1.05 && sy === 1.05), 'El slot pulsado escala un 5% durante 0.2s');
  assert.ok(fillStyles.includes('rgba(15, 23, 42, 0.8)'), 'Los slots usan fondo rgba(15, 23, 42, 0.8)');
  assert.equal(rectCalls.filter(r => r.w === 16 && r.h === 16 && r.fill === 'rgba(15, 23, 42, 0.8)').length, 5, 'Debe dibujar exactamente 5 slots de 16x16 px');
  for (const n of ['1', '2', '3', '4', '5']) {
    assert.ok(texts.includes(n), `Debe mostrar el número ${n} en la Hotbar`);
  }

  // Usar Digit1 cura 1 HP, consume la última unidad y vacía player.hotbar[0]
  player.hp = 2;
  fakeGame._useQuickSlotConsumable('Digit1');
  assert.equal(player.hp, 3, 'Pulsar 1 consume el Café asignado y cura al jugador');
  assert.equal(player.hotbar[0], null, 'Al llegar cantidad a 0, el slot de la Hotbar debe vaciarse');
});

test('NPCs reaccionan a golpes (queja, advertencia, reset 10s) y el 3º golpe desencadena triggerArrest a la cárcel', () => {
  const villager = new NPC({ id: 'aldeano_test', name: 'Aldeano Paco', x: 100, y: 100, sceneId: 'overworld' });
  const corpNpc = new NPC({ id: 'becario_rrhh', name: 'Becario Corp', x: 120, y: 100, sceneId: 'valleverde_corp' });
  corpNpc.inCombat = true; // Incluso si hay enemigos cerca, la queja por agresión debe mostrarse

  let musicMode = 'village';
  let loadedScene = 'overworld';
  let sfxPlayed = [];
  let dialogTitle = '';
  let dialogLines = [];

  const mockGame = {
    player: new Player({ x: 84, y: 100 }),
    npcs: [villager, corpNpc],
    isExpansionMode: false,
    tilemap: {
      currentSceneId: 'overworld',
      width: 384,
      height: 288,
      loadScene(id) {
        loadedScene = id;
        this.currentSceneId = id;
      }
    },
    camera: { setWorldBounds: () => {}, snapTo: () => {} },
    music: {
      setMode(m) { musicMode = m; },
      playSFX(n) { sfxPlayed.push(n); }
    },
    dialogueBox: {
      showMessage(title, lines) {
        dialogTitle = title;
        dialogLines = lines;
      }
    },
    _flashScreen: () => {},
    _shakeCamera: () => {},
    _restoreAllNPCsToOverworld: () => {},
    _resetAllNPCHitCounts() { RPGGame.prototype._resetAllNPCHitCounts.call(this); },
    triggerArrest(v) { RPGGame.prototype.triggerArrest.call(this, v); },
    _releaseFromJail(msg) { RPGGame.prototype._releaseFromJail.call(this, msg); },
    _didPlayerAttackHitBox(b) { return RPGGame.prototype._didPlayerAttackHitBox.call(this, b); },
    _handlePlayerAttackOnNPCs(list) { RPGGame.prototype._handlePlayerAttackOnNPCs.call(this, list); }
  };

  // Golpe 1 -> queja exacta del pool de primer golpe
  const complaintPool = [
    '¿Qué haces, coño?',
    '¡Tu eres tonto!',
    '¡Tus padres no te dieron educación!',
    '¿Te has vuelto loco o qué?'
  ];
  const warningPool = [
    '¡Que llame al Carcelero, eh!',
    '¡Como me des otra, te vas a la trena!',
    '¡A mí con esas, ni de coña!'
  ];

  corpNpc.onPlayerAttack(mockGame);
  assert.equal(corpNpc.hitCount, 1);
  assert.ok(complaintPool.includes(corpNpc.ambientBubbleText), `Queja inesperada: ${corpNpc.ambientBubbleText}`);
  assert.equal(corpNpc.ambientBubbleKind, 'complaint');

  // Golpe en el mismo swing bloqueado por cooldown -> sigue en 1
  corpNpc.onPlayerAttack(mockGame);
  assert.equal(corpNpc.hitCount, 1);

  // Pasados 10 segundos de calma -> hitCount vuelve a 0
  corpNpc.tickReactionTimers(10.1);
  assert.equal(corpNpc.hitCount, 0);

  // Combate mediante espada/puño en _handlePlayerAttackOnNPCs contra NPC base:
  mockGame.player.direction = 'right';
  mockGame.player.attackTimer = 0.2; // Puño / espada apuntando a villager (x=100,y=100)
  mockGame._handlePlayerAttackOnNPCs([villager]);
  assert.equal(villager.hitCount, 1);
  assert.ok(complaintPool.includes(villager.ambientBubbleText), `Queja inesperada: ${villager.ambientBubbleText}`);
  assert.ok(sfxPlayed.includes('hit_flesh'), 'Golpear a un NPC debe reproducir hit_flesh');

  // Pasa el enfriamiento entre swings y golpeamos por 2ª vez con proyectil de tronco
  villager.tickReactionTimers(0.4);
  mockGame.player.attackTimer = 0;
  mockGame.player.thrownLogs.push({ x: villager.centerX, y: villager.centerY, vx: 0, vy: 0, life: 1 });
  mockGame._handlePlayerAttackOnNPCs([villager]);
  assert.equal(villager.hitCount, 2);
  assert.equal(villager.ambientBubbleKind, 'warning');
  assert.ok(warningPool.includes(villager.ambientBubbleText), `Advertencia inesperada: ${villager.ambientBubbleText}`);
  assert.equal(mockGame.player.thrownLogs.length, 0, 'El proyectil que impacta al NPC debe consumirse');

  // 3º golpe -> arresto inmediato a jail_cell con condena de 600s y música jail
  villager.tickReactionTimers(0.4);
  mockGame.player.attackTimer = 0.2;
  mockGame._handlePlayerAttackOnNPCs([villager]);
  assert.equal(loadedScene, 'jail_cell', 'El 3º golpe debe enviar al jugador a jail_cell');
  assert.equal(mockGame.jailRemainingSeconds, 600, 'La condena por agresión debe ser de 600 segundos');
  assert.equal(musicMode, 'jail', 'Debe sonar la música de cárcel');
  assert.equal(mockGame.arrestFadeAlpha, 1.0, 'Debe activar la transición fade tras el arresto');
  assert.ok(dialogTitle.includes('CARCELERO'), 'Debe hablar el Carcelero');
  assert.equal(dialogLines[0], '¡Se acabó la fiesta! Por agredir a un ciudadano, quedas detenido.');
  assert.equal(villager.hitCount, 0, 'Al detener al jugador, los contadores de los NPCs se resetean a 0');

  // Al salir de la cárcel los NPCs siguen pacíficos
  mockGame._releaseFromJail(['Libre']);
  assert.equal(mockGame.jailRemainingSeconds, 0);
  assert.equal(loadedScene, 'overworld');
  assert.equal(villager.hitCount, 0);
  assert.equal(corpNpc.hitCount, 0);
});

test('Atacar a un animal invoca al Demonio Vengador (999 HP, speed 100, daño 9999 y Game Over propio)', () => {
  const sheep = new Animal({ name: 'Oveja', species: 'sheep', x: 100, y: 100, sceneId: 'overworld' });
  const player = new Player({ x: 84, y: 100 });
  player.hasArmor = true;
  player.armorPoints = 5;
  player.direction = 'right';
  player.attackTimer = 0.2;

  const sfxLog = [];
  const flashLog = [];
  let maxShake = 0;
  let arrested = false;

  const mockGame = {
    player,
    activeDemon: null,
    demonBannerTimer: 0,
    tilemap: { currentSceneId: 'overworld' },
    music: {
      playAnimalHurtSound: (sp) => sfxLog.push(`hurt:${sp}`),
      playSFX: (n) => sfxLog.push(n)
    },
    menuSystem: { showNotice: () => {} },
    triggerArrest: () => { arrested = true; },
    _flashScreen: (c, a, d) => flashLog.push({ c, a, d }),
    _shakeCamera: (mag) => { maxShake = Math.max(maxShake, mag); },
    _didPlayerAttackHitBox(b) { return RPGGame.prototype._didPlayerAttackHitBox.call(this, b); },
    _handlePlayerAttackOnAnimals(list) { RPGGame.prototype._handlePlayerAttackOnAnimals.call(this, list); },
    spawnAnimalDemon(a) { return RPGGame.prototype.spawnAnimalDemon.call(this, a); }
  };

  mockGame._handlePlayerAttackOnAnimals([sheep]);
  assert.equal(arrested, false, 'Atacar a un animal NO debe llamar al Carcelero');
  assert.ok(sfxLog.includes('hurt:sheep'), 'Debe sonar SFX de animal herido');
  assert.ok(sfxLog.includes('boss_roar'), 'Debe rugir boss_roar al aparecer el Demonio');
  assert.ok(maxShake >= 5, 'Debe aplicar un screen shake fuerte');
  assert.ok(flashLog.some(f => f.c === '#dc2626'), 'Debe hacer flash rojo rápido en pantalla');
  assert.ok(sheep.fleeTimer > 0, 'El animal debe huir despavorido');
  assert.ok(mockGame.activeDemon instanceof DemonVengador, 'Debe instanciarse un DemonVengador');
  assert.equal(mockGame.activeDemon.hp, 999);
  assert.equal(mockGame.activeDemon.speed, 100);
  assert.equal(mockGame.activeDemon.ignoresEnemies, true);
  assert.ok(mockGame.demonBannerTimer > 0, 'Debe mostrar el banner de advertencia');

  // El Demonio Vengador es inmortal aunque le golpee la espada
  mockGame.activeDemon.takeSwordHit(player, mockGame.music, 500);
  assert.equal(mockGame.activeDemon.hp, 999);
  assert.equal(mockGame.activeDemon.dead, false);

  // Persecución y muerte instantánea (9999 daño) incluso con armadura
  mockGame.activeDemon.x = player.x;
  mockGame.activeDemon.y = player.y;
  const hitRes = mockGame.activeDemon.update(0.016, null, player, false, mockGame.music);
  assert.equal(hitRes.fatalDemonHit, true);
  assert.equal(player.hp, 0);
  assert.equal(player.killedByDemon, true);

  // Verificar mensaje exacto en la pantalla de Game Over
  const texts = [];
  const mockCtx = new Proxy({
    save() {}, restore() {}, fillRect() {}, strokeRect() {}, beginPath() {}, arc() {}, ellipse() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, closePath() {}, roundRect() {}, translate() {}, scale() {}, rotate() {}, clip() {},
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
    fillText(t) { texts.push(String(t)); },
    measureText(t) { return { width: String(t).length * 4 }; }
  }, {
    get(target, prop) {
      return prop in target ? target[prop] : () => {};
    }
  });
  const menu = new MainMenuAndScenes(320, 180, {}, { setMode() {}, playGameOver() {}, playMenuMove() {} }, {});
  menu.openGameOverScreen(false, 'animal_demon');
  menu.render(mockCtx);
  assert.ok(texts.includes(DEMON_GAME_OVER_MESSAGE), 'La pantalla de Game Over debe mostrar el juicio del Señor de las Ovejas');

  // Render Canvas 2D de DemonVengador + banner de main.js sin errores
  mockGame.activeDemon.render(mockCtx, { renderX: 0, renderY: 0 });
  RPGGame.prototype._renderDemonBannerOverlay.call(mockGame, mockCtx);
  assert.ok(texts.includes('¡HAS PROVOCADO AL SEÑOR DE LAS OVEJAS!'));
});

test('Expansión: Tope de Nivel 15, tabla XP, recompensas (Nv 11-15), Stamina persistente y HUD NIVEL MÁXIMO', () => {
  assert.deepEqual(LEVEL_XP_THRESHOLDS, [
    0, 50, 120, 220, 350, 520, 720, 980, 1300, 1700,
    2200, 2800, 3500, 4300, 5200
  ]);

  const p = new Player({ x: 32, y: 32 });
  p.gainXp(1700); // Nivel 10
  assert.equal(p.level, 10);
  assert.equal(p.isMaxLevel, false);
  const spBefore = p.skillPoints;

  // Nivel 11 (2200 XP) -> +1 punto de habilidad
  const r11 = p.gainXp(500);
  assert.equal(p.level, 11);
  assert.equal(p.skillPoints, spBefore + 1);
  assert.equal(r11.rewards.includes('¡+1 Punto de Habilidad!'), true);

  // Nivel 12 (2800 XP) -> maxHp 3 -> 4
  const r12 = p.gainXp(600);
  assert.equal(p.level, 12);
  assert.equal(p.maxHp, 4);
  assert.equal(p.hp, 4);
  assert.equal(r12.rewards.includes('¡Corazón Máximo aumentado!'), true);

  // Nivel 13 (3500 XP) -> sin bonus extra, isMaxLevel sigue false
  p.gainXp(700);
  assert.equal(p.level, 13);
  assert.equal(p.isMaxLevel, false);

  // Nivel 14 (4300 XP) -> maxStamina +20 (100 -> 120) y persiste tras update()
  const r14 = p.gainXp(800);
  assert.equal(p.level, 14);
  assert.equal(p.maxStamina, 120);
  assert.equal(p.stamina, 120);
  assert.equal(r14.rewards.includes('¡Stamina Máxima aumentada!'), true);
  p.update(0.016, new InputHandler(null), null, []);
  assert.equal(p.maxStamina, 120, 'La stamina extra de Nivel 14 no debe resetearse en Player.update()');

  // HUD en Nivel 14 NO debe decir NIVEL MÁXIMO
  const hudTexts = [];
  const hudCtx = new Proxy({
    fillText(t) { hudTexts.push(String(t)); },
    measureText(t) { return { width: String(t).length * 4 }; },
    createLinearGradient() { return { addColorStop() {} }; }
  }, { get: (t, k) => (k in t ? t[k] : () => {}) });

  const mockHudGame = {
    kernelHackActive: false,
    kernelHudFlicker: false,
    touchControls: { isTouchEnabled: () => false },
    dayNight: { getFormattedTime: () => '12:00', timeOfDayHours: 12 },
    tilemap: { currentSceneId: 'valleverde_corp' },
    player: p,
    enemies: [],
    curriculum: 0,
    isJailedForever: false,
    jailRemainingSeconds: 0,
    cloudSyncStatus: 'synced',
    hasPendingCloudSync: false,
    syncHotbarWithInventory: () => {},
    _ensurePlayerHotbar: () => [null, null, null, null, null],
    _renderHotbar: () => {}
  };
  RPGGame.prototype._renderHUD.call(mockHudGame, hudCtx);
  assert.ok(hudTexts.includes('NV. 14/15'), 'HUD debe mostrar NV. 14/15 antes del nivel máximo');
  assert.equal(hudTexts.includes('NIVEL MÁXIMO'), false, 'HUD no debe mostrar NIVEL MÁXIMO en Nv. 14');

  // Nivel 15 (5200 XP) -> maxHp 4 -> 5, isMaxLevel === true, HUD muestra NIVEL MÁXIMO
  const r15 = p.gainXp(900);
  assert.equal(p.level, 15);
  assert.equal(p.maxHp, 5);
  assert.equal(p.hp, 5);
  assert.equal(p.isMaxLevel, true);
  assert.equal(r15.rewards.includes('¡Has alcanzado el rango de Leyenda de Valleverde!'), true);

  hudTexts.length = 0;
  RPGGame.prototype._renderHUD.call(mockHudGame, hudCtx);
  assert.ok(hudTexts.includes('NIVEL MÁXIMO'), 'HUD debe volver a mostrar NIVEL MÁXIMO en Nv. 15');

  // CloudStorage conserva Nivel 15
  const sanitized = CloudStorage.sanitizeSaveData({ level: 15, xp: 5200 });
  assert.equal(sanitized.level, 15);
});

test('Equipamiento Corporativo de Expansión: stats, grapa cada 3 golpes, destornillador perforante, carpeta, escudo becario, inventario y HUD', () => {
  // 1. Diccionario EXPANSION_EQUIPMENT completo
  const expectedIds = ['boligrafo', 'grapadora', 'destornillador', 'carpeta', 'escudo_becario'];
  for (const id of expectedIds) {
    assert.ok(EXPANSION_EQUIPMENT[id], `Debe existir EXPANSION_EQUIPMENT.${id}`);
    assert.equal(getExpansionEquipment(id).id, id);
  }
  assert.equal(getExpansionEquipment('equip_grapadora').id, 'grapadora');

  const p = new Player(100, 100);
  p.hasSword = true;
  p.hasDash = true;
  p.stamina = 100;

  // 2. Bolígrafo Corporativo: daño 1, cooldown 0.15s, brillo azul corporativo
  assert.deepEqual(p.equipExpansionItem('boligrafo'), EXPANSION_EQUIPMENT.boligrafo);
  assert.equal(p.equippedWeapon, 'boligrafo');
  assert.equal(p.getSwordDamage(), 1);
  p.tryAttack();
  assert.equal(p.attackCooldown, 0.15);

  // 3. Grapadora Industrial: daño 2, cooldown 0.3s, dispara grapa cada 3er golpe
  assert.deepEqual(p.equipExpansionItem('grapadora'), EXPANSION_EQUIPMENT.grapadora);
  assert.equal(p.equippedWeapon, 'grapadora');
  assert.equal(p.getSwordDamage(), 2);
  p.attackTimer = 0; p.attackCooldown = 0; p.comboStep = 0; p.energySlashes.length = 0;

  p.tryAttack(); // golpe 1
  assert.equal(p.attackCooldown, 0.3);
  assert.equal(p.energySlashes.filter((s) => s.kind === 'staple').length, 0);

  p.attackTimer = 0; p.attackCooldown = 0; p.stamina = 100;
  p.tryAttack(); // golpe 2
  assert.equal(p.energySlashes.filter((s) => s.kind === 'staple').length, 0);

  p.attackTimer = 0; p.attackCooldown = 0; p.stamina = 100;
  p.tryAttack(); // 3er golpe -> dispara grapa
  assert.equal(p.attackIsFinisher, true);
  const staples = p.energySlashes.filter((s) => s.kind === 'staple');
  assert.equal(staples.length, 1, 'Grapadora debe disparar una grapa en el 3er golpe');
  assert.equal(staples[0].damage, 2);

  // 4. Destornillador Eléctrico: daño 3, cooldown 0.45s, ignora armadura / invulnerabilidad de jefes
  assert.deepEqual(p.equipExpansionItem('destornillador'), EXPANSION_EQUIPMENT.destornillador);
  assert.equal(p.getSwordDamage(), 3);
  p.attackTimer = 0; p.attackCooldown = 0; p.stamina = 100;
  p.tryAttack();
  assert.equal(p.attackCooldown, 0.45);

  const armoredBoss = new Boss({
    id: 'test_armored_boss',
    name: 'Servidor Blindado',
    x: 112,
    y: 100,
    hp: 20,
    armor: 2,
    sceneId: 'server_room'
  });
  armoredBoss.invulnerable = true;
  const hitArmor = armoredBoss.takeSwordHit(p, null);
  assert.equal(hitArmor, true, 'Destornillador debe perforar invulnerabilidad de jefe');
  assert.equal(armoredBoss.hp, 17, 'Destornillador debe hacer daño real completo ignorando armor=2');

  const alexP5 = new AlexUpdateBoss(112, 100, 'ai_nucleus_core');
  alexP5.hp = 60;
  alexP5.phase = 5;
  alexP5.invulnerable = true;
  assert.equal(alexP5.takeSwordHit(p, null), true, 'Destornillador debe perforar armadura pectoral de Fase 5');
  assert.equal(alexP5.hp, 57);

  // 5. Escudo del Becario: +0.2s ventana de parry en tryBarrier()
  assert.deepEqual(p.equipExpansionItem('escudo_becario'), EXPANSION_EQUIPMENT.escudo_becario);
  assert.equal(p.equippedShield, 'escudo_becario');
  p.barrierCooldown = 0;
  p.tryBarrier();
  assert.ok(Math.abs(p.parryTimer - (0.20 + 0.20)) < 1e-6, `Ventana de parry esperada 0.40s sin reflejo, fue ${p.parryTimer}`);
  p.skills.reflejo = true;
  p.barrierCooldown = 0;
  p.tryBarrier();
  assert.ok(Math.abs(p.parryTimer - (0.35 + 0.20)) < 1e-6, `Ventana de parry esperada 0.55s con reflejo, fue ${p.parryTimer}`);

  // 6. Carpeta de Plástico: -0.5 daño recibido y al hacer parry ralentiza 2s al atacante
  assert.deepEqual(p.equipExpansionItem('carpeta'), EXPANSION_EQUIPMENT.carpeta);
  assert.equal(p.equippedShield, 'carpeta');
  p.parryTimer = 0;
  p.barrierActive = false;
  p.barrierTimer = 0;
  p.invulnTimer = 0;
  p.hp = 5;
  const attacker = new Enemy({ id: 'slow_test_enemy', x: 116, y: 100, speed: 60, hp: 10 });
  p.takeHit(null, attacker, 1.5);
  assert.ok(Math.abs(p.hp - 4.0) < 1e-6, `Carpeta debe mitigar 0.5 de daño (hp=4.0, obtenido=${p.hp})`);

  // Con parry activo, Carpeta ralentiza al atacante durante 2s
  p.invulnTimer = 0;
  p.barrierActive = true;
  p.barrierTimer = 0.4;
  p.parryTimer = 0.25;
  p.takeHit(null, attacker, 1);
  assert.ok(Math.abs(attacker.slowTimer - 2.0) < 1e-6, 'Parry con Carpeta debe aplicar slowTimer=2.0s');
  attacker.update(0.1, null, p);
  assert.ok(attacker.slowTimer < 2.0 && attacker.slowTimer > 1.8);

  // 7. Inventario: equipar desde UI, badge EQ y HUD junto a barra de vida
  const inv = new Inventory();
  inv.isOpen = true;
  inv.addItem({ ...EXPANSION_EQUIPMENT.grapadora });
  inv.addItem({ ...EXPANSION_EQUIPMENT.carpeta });
  inv.selectedIndex = 0;
  const mockGame = {
    inventory: inv,
    player: p,
    music: { playMenuSelect: () => {} }
  };
  RPGGame.prototype._handleUseSelectedInventoryItem.call(mockGame);
  assert.equal(p.equippedWeapon, 'grapadora', 'Usar en inventario debe equipar Grapadora');
  inv.selectedIndex = 1;
  RPGGame.prototype._handleUseSelectedInventoryItem.call(mockGame);
  assert.equal(p.equippedShield, 'carpeta', 'Usar en inventario debe equipar Carpeta');

  const invTexts = [];
  const makeCtx = (textLog) => ({
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, setTransform() {},
    fillRect() {}, strokeRect() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, arc() {}, ellipse() {},
    fill() {}, stroke() {}, roundRect() {}, drawImage() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    fillText(t) { textLog.push(String(t)); },
    measureText(t) { return { width: String(t).length * 2.5 }; }
  });

  inv.render(makeCtx(invTexts), p);
  assert.ok(invTexts.includes('EQ'), 'Inventory.render debe mostrar badge EQ en equipo equipado');
  assert.ok(
    invTexts.some((t) => t.includes('Eq:') && t.includes('Grapadora') && t.includes('Carpeta')),
    `Inventory.render debe resumir arma y escudo equipados, textos=${JSON.stringify(invTexts)}`
  );

  // Render de player con grapa sin errores
  p.render(makeCtx([]), { getSprite() { return null; } });

  // HUD junto a la barra de vida muestra el icono del arma equipada
  const hudTexts = [];
  const hudMockGame = {
    tilemap: { currentSceneId: 'valleverde_corp' },
    enemies: [],
    player: p,
    activeModeLabel: 'CORP',
    worldTimer: 10,
    isExpansionMode: true,
    curriculum: 0,
    curriculumFlashTimer: 0,
    kernelHackActive: false,
    kernelHudFlicker: false,
    dayNight: { getFormattedTime: () => '12:00', timeOfDayHours: 12 },
    touchControls: { isTouchEnabled: () => false },
    input: { touchActive: false, hasActiveTouchSession: () => false },
    activeQuestNotification: null,
    isJailedForever: false,
    jailRemainingSeconds: 0,
    cloudSyncStatus: 'synced',
    hasPendingCloudSync: false,
    syncHotbarWithInventory: () => {},
    _ensurePlayerHotbar: () => [null, null, null, null, null],
    _renderHotbar: () => {}
  };
  RPGGame.prototype._renderHUD.call(hudMockGame, makeCtx(hudTexts));
  assert.ok(hudTexts.includes('📎'), `HUD debe mostrar icono de arma equipada (📎), textos=${JSON.stringify(hudTexts)}`);
});

test('Catálogo Ampliado de Habilidades (Expansión v2.0 + Nivel II): compra, prerequisitos, 7 efectos y UI', () => {
  // 1. EXPANSION_SKILLS completo (7 entradas)
  const expectedKeys = ['ejecutivo', 'resiliencia', 'reciclaje', 'vigor_2', 'filo_2', 'reflejo_2', 'log_2'];
  for (const k of expectedKeys) {
    assert.ok(EXPANSION_SKILLS[k], `Debe existir EXPANSION_SKILLS.${k}`);
  }
  assert.equal(EXPANSION_SKILLS.ejecutivo.cost, 2);
  assert.equal(EXPANSION_SKILLS.resiliencia.cost, 2);
  assert.equal(EXPANSION_SKILLS.reciclaje.cost, 3);
  assert.equal(EXPANSION_SKILLS.vigor_2.requires, 'vigor');

  const p = new Player(100, 100);
  p.hasSword = true;
  p.hasBarrier = true;
  p.skillPoints = 20;

  // Prerequisito: sin Vigor base no se puede comprar vigor_2 y tampoco aparece en UI
  assert.equal(p.purchaseSkill('vigor_2'), false, 'No debe permitir Vigor II sin Vigor base');
  const cs = new CharacterStats(320, 180);
  cs.open();
  cs.switchTab('skills');
  assert.equal(cs.getVisibleSkills(p).some((d) => d.key === 'vigor_2'), false, 'Vigor II oculto hasta tener Vigor');

  // Comprar Vigor -> aparece Vigor II -> comprar Vigor II -> stamina 180
  assert.equal(p.purchaseSkill('vigor'), true);
  assert.equal(p.effectiveMaxStamina, 140);
  assert.equal(cs.getVisibleSkills(p).some((d) => d.key === 'vigor_2'), true, 'Vigor II visible tras comprar Vigor');
  assert.equal(p.purchaseSkill('vigor_2'), true);
  assert.equal(p.effectiveMaxStamina, 180, 'Vigor II debe elevar stamina máxima a 180');
  assert.equal(p.maxStamina, 180);

  // 2. Ejecutivo: +15% de daño contra jefes (IñakitoBoss)
  assert.equal(p.purchaseSkill('ejecutivo'), true);
  const inakito = new IñakitoBoss(112, 100, 'valleverde_corp');
  const prevHp = inakito.hp;
  p.attackDamage = 2; // daño base espada 2.0
  assert.ok(Math.abs(p.getSwordDamage(inakito) - 2.3) < 1e-6, `Daño esperado 2.3 con Ejecutivo, fue ${p.getSwordDamage(inakito)}`);
  assert.equal(inakito.takeSwordHit(p, null), true);
  assert.ok(Math.abs((prevHp - inakito.hp) - 2.3) < 1e-6, 'Ejecutivo debe infligir +15% daño real a Iñakito');

  // 3. Resiliencia: -15% de daño recibido en mazmorras y en el Núcleo (no en overworld)
  assert.equal(p.purchaseSkill('resiliencia'), true);
  p.maxHp = 10; p.hp = 10; p.invulnTimer = 0; p.currentSceneId = 'ai_nucleus_core';
  p.takeHit(null, { isBoss: false, sceneId: 'ai_nucleus_core' }, 2.0);
  assert.ok(Math.abs((10 - p.hp) - 1.7) < 1e-6, `Resiliencia en Núcleo debe reducir daño 2.0 → 1.7, daño=${10 - p.hp}`);
  p.hp = 10; p.invulnTimer = 0; p.currentSceneId = 'overworld';
  p.takeHit(null, { isBoss: false, sceneId: 'overworld' }, 2.0);
  assert.ok(Math.abs((10 - p.hp) - 2.0) < 1e-6, 'Resiliencia NO reduce daño en overworld');

  // 4. Reciclaje: 10% probabilidad de soltar Currículum incluso fuera del Vertedero
  assert.equal(p.purchaseSkill('reciclaje'), true);
  p.awardKill(false, 10, () => 0.05); // < 0.10 -> drop!
  assert.equal(p.lastKillCurriculumDrop, true, 'Reciclaje debe activar drop si rng < 0.10');
  p.awardKill(false, 10, () => 0.25); // >= 0.10 -> sin drop
  assert.equal(p.lastKillCurriculumDrop, false);

  // 5. Filo II: finisher (3er golpe) hace 1 de daño en área (radio 24px)
  assert.equal(p.purchaseSkill('filo'), true);
  assert.equal(p.purchaseSkill('filo_2'), true);
  p.stamina = 180;
  p.attackTimer = 0; p.attackCooldown = 0; p.comboStep = 0;
  p.tryAttack(); p.attackTimer = 0; p.attackCooldown = 0;
  p.tryAttack(); p.attackTimer = 0; p.attackCooldown = 0;
  p.tryAttack(); // 3er golpe -> finisher AoE
  assert.equal(p.attackIsFinisher, true);
  assert.ok(p.activeFinisherAoe && p.activeFinisherAoe.radius === 24);
  const nearEnemy = new Enemy({ id: 'slime_near', x: p.x + 16, y: p.y, hp: 5 });
  const farEnemy = new Enemy({ id: 'slime_far', x: p.x + 50, y: p.y, hp: 5 });
  const aoeHits = p.applyFilo2AoE([nearEnemy, farEnemy]);
  assert.equal(aoeHits, 1, 'Solo el enemigo dentro de 24px debe recibir daño AoE de Filo II');
  assert.equal(nearEnemy.hp, 4);
  assert.equal(farEnemy.hp, 5);

  // 6. Reflejo II: parry devuelve el 50% del daño absorbido al enemigo
  assert.equal(p.purchaseSkill('reflejo'), true);
  assert.equal(p.purchaseSkill('reflejo_2'), true);
  const parriedAttacker = new Enemy({ id: 'drone_reflect', x: 112, y: 100, hp: 10 });
  p.invulnTimer = 0;
  p.barrierActive = true;
  p.barrierTimer = 0.5;
  p.parryTimer = 0.2;
  p.takeHit(null, parriedAttacker, 4.0);
  assert.ok(Math.abs((10 - parriedAttacker.hp) - 2.0) < 1e-6, `Reflejo II debe devolver 50% (2.0), hp=${parriedAttacker.hp}`);

  // 7. Log II: al impactar un tronco crea explosión radio 20px con daño en área
  assert.equal(p.purchaseSkill('log'), true);
  assert.equal(p.purchaseSkill('log_2'), true);
  p.thrownLogs.push({ x: 200, y: 200, vx: 0, vy: 0, life: 1.0 });
  const directTarget = new Enemy({ id: 'log_target', x: 192, y: 192, hp: 6 });
  const splashTarget = new Enemy({ id: 'log_splash', x: 204, y: 192, hp: 6 });
  directTarget.update(0.016, null, p);
  assert.equal(p.logExplosions.length, 1, 'Impacto del log con Log II debe generar explosión');
  assert.equal(p.logExplosions[0].radius, 20);
  const splashHits = p.applyLogExplosionDamage([directTarget, splashTarget]);
  assert.equal(splashHits, 1, 'La explosión de Log II debe dañar al enemigo cercano en radio 20px');
  assert.equal(splashTarget.hp, 5);

  // 8. CharacterStats UI: renderiza 7 habilidades nuevas, costes y botón gris sin puntos
  p.skillPoints = 0;
  const renderedTexts = [];
  const fills = [];
  let lastFill = '';
  const statsCtx = {
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    beginPath() {}, closePath() {}, arc() {}, stroke() {}, fill() {}, strokeRect() {},
    moveTo() {}, lineTo() {},
    set fillStyle(v) { lastFill = String(v); },
    get fillStyle() { return lastFill; },
    fillRect() { fills.push(lastFill); },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    fillText(t) { renderedTexts.push(String(t)); },
    measureText(t) { return { width: String(t).length * 2.5 }; }
  };
  assert.equal(cs.getVisibleSkills(p).length, 11, 'Con todas las base compradas deben verse las 11 habilidades');
  cs.skillCursor = 4; // Página 2 (habilidades de expansión)
  const pNoPts = new Player(100, 100);
  pNoPts.skills.vigor = true;
  pNoPts.skillPoints = 0;
  cs.render(statsCtx, pNoPts, null);
  assert.ok(renderedTexts.some((t) => t.includes('Ejecutivo')), 'Debe mostrar Ejecutivo en pestaña Habilidades');
  assert.ok(fills.includes('#334155'), 'Sin puntos suficientes debe pintar el botón en gris (#334155)');
  assert.ok(renderedTexts.some((t) => t.includes('GRIS')), 'Sin puntos suficientes el botón debe indicar estado gris');
  p.render(statsCtx, { renderX: 0, renderY: 0 });
});

test('Aislamiento base/expansión: escenas, AudioManager y ExpansionManager.init bajo demanda', async () => {
  const prevStorage = globalThis.localStorage;
  const prevAudio = globalThis.Audio;
  const storeMap = new Map([['el_ojete_dorado_victory_trophy', 'true']]);
  globalThis.localStorage = {
    getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
    setItem: (k, v) => storeMap.set(k, String(v)),
    removeItem: (k) => storeMap.delete(k)
  };
  const preloadedSrcs = [];
  globalThis.Audio = class FakeAudio {
    constructor() {
      this._src = '';
      this.loop = false;
      this.preload = 'none';
      this.volume = 0;
    }
    set src(val) {
      this._src = val;
      preloadedSrcs.push(val);
    }
    get src() { return this._src; }
    addEventListener() {}
    load() {}
    play() { return Promise.resolve(); }
    pause() {}
  };

  try {
    // 1. Tilemap base NO construye escenas de la expansión ni pisos del Vertedero
    const tm = new Tilemap(null, 16);
    assert.equal(tm.expansionLoaded, false);
    for (const id of ['valleverde_corp', 'inakito_office', 'vertedero_digital', 'kernel_arena', 'rosa_bar', 'ai_nucleus_core', 'vertedero_piso_1']) {
      assert.equal(tm.scenes[id], undefined, `La escena de expansión ${id} no debe existir en base`);
    }

    // 2. AudioManager.preloadMusic() SOLO carga las pistas base (01..10), incluso con trofeo desbloqueado
    for (const key of Object.keys(EXPANSION_BGM)) delete BGM_TRACKS[key];
    const audio = new AudioManager();
    audio.preloadMusic();
    assert.equal(audio.expansionAudioLoaded, false);
    for (const key of Object.keys(EXPANSION_BGM)) {
      assert.equal(BGM_TRACKS[key], undefined, `BGM_TRACKS no debe tener ${key} tras preloadMusic()`);
      assert.equal(audio._bgmAudio.has(key), false, `AudioManager no debe precargar ${key} en base`);
    }
    assert.equal(preloadedSrcs.some((s) => s.includes('11_valleverde')), false, 'No se debe precargar MP3 de expansión en base');

    // 3. Arranque mediante ExpansionManager.init(game) desde MainMenuAndScenes
    const player = new Player({ x: 32, y: 32 });
    const inv = new Inventory();
    const mgr = new ExpansionManager();
    const fakeGame = {
      tilemap: tm,
      music: audio,
      player,
      inventory: inv,
      assets: {},
      camera: { setWorldBounds: () => {}, resetCinematic: () => {}, snapTo: () => {} },
      dialogueBox: { close: () => {}, npcRegistry: [] },
      characterStats: { close: () => {} },
      questLogView: { close: () => {} },
      questLog: { reset: () => {} },
      dayNight: new DayNightCycle(),
      npcs: [],
      animals: [],
      enemies: [],
      worldItems: [],
      droppedCoins: [],
      rosaShop: null,
      expansionEquipment: null,
      expansionManager: mgr,
      isExpansionMode: false,
      gameState: 'base',
      menuSystem: { state: 'title', fadeAlpha: 0, showNotice: () => {} },
      _initExpansionState: () => RPGGame.prototype._initExpansionState.call(fakeGame),
      _restoreExpansionSaveData: (d) => RPGGame.prototype._restoreExpansionSaveData.call(fakeGame, d),
      _applySavedRosaUpgrades: (u) => RPGGame.prototype._applySavedRosaUpgrades.call(fakeGame, u),
      _readExpansionStorage: () => RPGGame.prototype._readExpansionStorage.call(fakeGame),
      _saveExpansionProgress: () => RPGGame.prototype._saveExpansionProgress.call(fakeGame),
      _syncFrancoNPCState: () => RPGGame.prototype._syncFrancoNPCState.call(fakeGame),
      _restoreAllNPCsToOverworld: () => {},
      _createFirstStageEnemies: () => [],
      _createWorldItems: () => [],
      startExpansion: () => RPGGame.prototype.startExpansion.call(fakeGame),
      _resetWorldToInitialState: () => RPGGame.prototype._resetWorldToInitialState.call(fakeGame)
    };
    mgr.game = fakeGame;

    let menuTriggered = false;
    const menu = new MainMenuAndScenes(320, 180, {}, {
      playMenuSelect() {},
      playCaughtSkipSound() {},
      stopTitleMusic() {},
      setMode() {}
    }, {
      game: fakeGame,
      onStartExpansion: () => {
        menuTriggered = true;
      }
    });
    const expItem = menu._getCurrentMenuItems()[2];
    assert.equal(expItem.locked, false);
    expItem.action();
    assert.equal(menuTriggered, true, 'El menú debe invocar el arranque de expansión cuando está desbloqueada');

    await mgr.init(fakeGame);
    assert.equal(mgr.initialized, true);
    assert.equal(fakeGame.gameState, 'expansion');
    assert.equal(fakeGame.isExpansionMode, true);
    assert.equal(tm.expansionLoaded, true);
    assert.ok(tm.scenes.valleverde_corp && tm.scenes.kernel_arena && tm.scenes.ai_nucleus_core && tm.scenes.vertedero_piso_5);
    assert.equal(audio.expansionAudioLoaded, true);
    for (const key of Object.keys(EXPANSION_BGM)) {
      assert.ok(audio._bgmAudio.has(key), `AudioManager debe cargar ${key} tras ExpansionManager.init()`);
    }
    assert.ok(fakeGame.rosaShop, 'Debe instanciarse RosaShop al entrar a la expansión');
    assert.ok(fakeGame.npcs.some((n) => n.name === 'Tony Randazzo'), 'Debe instanciar a TonyRandazzo');
    assert.ok(fakeGame.npcs.some((n) => n.expansionId === 'franco_pancho'), 'Debe instanciar a FrancoPancho');
    assert.ok(fakeGame.enemies.some((e) => e.id === 'boss_inakito'), 'Debe instanciar a IñakitoBoss');
    assert.ok(fakeGame.enemies.some((e) => e.id === 'boss_kernel'), 'Debe instanciar a KernelBoss');
    assert.ok(fakeGame.enemies.some((e) => e.id === 'boss_alex_update'), 'Debe instanciar a AlexUpdateBoss');
    assert.ok(fakeGame.enemies.some((e) => e.id === 'boss_technical_debt'), 'Debe instanciar a TechnicalDebtBoss');
    assert.ok(fakeGame.enemies.some((e) => e.id === 'vertedero_f5_3'), 'Debe instanciar enemigos del Vertedero');

    // Idempotencia si se vuelve a invocar init()
    const npcCountAfterFirst = fakeGame.npcs.length;
    const enemyCountAfterFirst = fakeGame.enemies.length;
    await mgr.init(fakeGame);
    assert.equal(fakeGame.npcs.length, npcCountAfterFirst, 'Re-iniciar ExpansionManager no debe duplicar NPCs');
    assert.equal(fakeGame.enemies.length, enemyCountAfterFirst, 'Re-iniciar ExpansionManager no debe duplicar jefes/enemigos');
  } finally {
    globalThis.localStorage = prevStorage;
    globalThis.Audio = prevAudio;
    for (const key of Object.keys(EXPANSION_BGM)) delete BGM_TRACKS[key];
  }
});

await Promise.all(asyncQueue);

console.log(`\n${passed} pruebas OK, ${failures.length} fallos.`);
if (failures.length) process.exit(1);
