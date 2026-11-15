import { findPath, hasLineOfSight } from '../../src/ai/Pathfinding.js';
import { Enemy } from '../../src/entities/Enemy.js';
import { Player, LEVEL_XP_THRESHOLDS, XP_REWARDS } from '../../src/entities/Player.js';
import { ZONE_LEVEL_REQUIREMENTS } from '../../src/core/DoorGatekeeper.js';
import { AI_STATE, inferArchetype } from '../../src/ai/EnemyBrain.js';
import { RPGGame } from '../../src/main.js';
import { Tilemap } from '../../src/world/Tilemap.js';
import { CollisionSystem } from '../../src/physics/CollisionSystem.js';
import { NPC } from '../../src/entities/NPC.js';
import { DemonVengador, DEMON_GAME_OVER_MESSAGE } from '../../src/expansion/entities/DemonVengador.js?v=8';
import { Animal } from '../../src/entities/Animal.js';
import { MainMenuAndScenes } from '../../src/ui/MainMenuAndScenes.js';
import { CombatManager } from '../../src/core/CombatManager.js?v=8';
import {
  makeMap,
  wallMap,
  openMap,
  makePlayer,
  makeEnemy,
  makeFakePlayer,
  runEnemySim,
  makeMockCtx,
  makeFakeGame,
} from './mocks.mjs';

export async function run(test, assert) {
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
    runEnemySim(e, p, 0.1);
    assert.equal(e.aiState, AI_STATE.ALERT);
    runEnemySim(e, p, 0.5);
    assert.equal(e.aiState, AI_STATE.CHASE);
  });
  test('Pierde al jugador → SEARCH → RETURN → PATROL', () => {
    const e = makeEnemy('grunt_2');
    const p = makeFakePlayer(100, 48);
    runEnemySim(e, p, 1.0);
    p.x = 280;
    p.y = 160;
    runEnemySim(e, p, 1.5);
    assert.equal(e.aiState, AI_STATE.SEARCH);
    runEnemySim(e, p, 12);
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
    runEnemySim(e, p, 3.5);
    assert.ok(e.shots.length > 0 || p.hits > 0, 'no hubo proyectiles ni impactos');
  });
  test('Centinela da la alarma a aliados cercanos', () => {
    const sentinel = makeEnemy('drone_west_2', 48, 48);
    const ally = makeEnemy('grunt_ally', 70, 80);
    ally.aggroRange = 5;
    const p = makeFakePlayer(100, 48);
    const ai = { enemies: [sentinel, ally], attackers: new Set() };
    runEnemySim(sentinel, p, 0.2, ai);
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
    runEnemySim(e, p, 0.5);
    assert.equal(e.x, x0);
    const hp0 = e.hp;
    e.takeSwordHit({ centerX: 0, centerY: 0, getSwordDamage: () => 1 }, null);
    assert.equal(hp0 - e.hp, 2);
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
      _didPlayerAttackHitBox(b) { return new CombatManager(this).didPlayerAttackHitBox(b); },
      _handlePlayerAttackOnNPCs(list) { new CombatManager(this).handlePlayerAttackOnNPCs(list); }
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
      _didPlayerAttackHitBox(b) { return new CombatManager(this).didPlayerAttackHitBox(b); },
      _handlePlayerAttackOnAnimals(list) { new CombatManager(this).handlePlayerAttackOnAnimals(list); },
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

  test('NPC y Animal: animación idle de respiración (Math.sin), balanceo sentado y martillo periódico de Brom', () => {
    const npc = new NPC({ name: 'Aldeano', x: 80, y: 80, behavior: 'static', sceneId: 'overworld' });
    npc.isMoving = false;
    npc.idleClock = 0.5;
    assert.equal(npc.getIdleOffset().y, 1, 'Respiración idle debe subir/bajar 1 px');
    assert.equal(npc.getIdleOffset().x, 0);
    npc.idleClock = 1.5;
    assert.equal(npc.getIdleOffset().y, -1);

    npc.isMoving = true;
    assert.deepEqual(npc.getIdleOffset(), { x: 0, y: 0 }, 'En movimiento no debe aplicar offset idle');

    const seatedNpc = new NPC({ name: 'Cliente Taberna', x: 64, y: 64, behavior: 'seated', isSeated: true, sceneId: 'rosa_bar' });
    seatedNpc.idleClock = 0.75;
    const seatedOff = seatedNpc.getIdleOffset();
    assert.ok(seatedOff.x !== 0, 'NPC sentado debe balancearse horizontalmente');

    const mockCtx = makeMockCtx();
    const brom = new NPC({ name: 'Herrero Brom', x: 100, y: 100, tool: 'hammer', sceneId: 'overworld' });
    brom.isMoving = false;
    brom.jobAnimTimer = 0.1; // Fase activa de golpe con chispas
    brom.render(mockCtx, { renderX: 0, renderY: 0 });
    brom.jobAnimTimer = 3.0; // Fase de reposo entre golpes
    brom.render(mockCtx, { renderX: 0, renderY: 0 });
    assert.equal(brom.x, 100, 'La animación idle/martillo no debe alterar las coordenadas físicas');
    assert.equal(brom.y, 100);

    const sheep = new Animal({ name: 'Copito', species: 'sheep', x: 96, y: 96 });
    sheep.isMoving = false;
    sheep.idleClock = 0.5;
    assert.equal(sheep.getIdleOffset().y, 1, 'Animal quieto debe respirar 1 px');
    const prevClock = sheep.idleClock;
    sheep.update(0.25, null, [], false, null, null);
    assert.ok(sheep.idleClock > prevClock, 'Animal.update debe avanzar idleClock');
    sheep.isMoving = true;
    assert.deepEqual(sheep.getIdleOffset(), { x: 0, y: 0 });
  });

  test('Barks ambientales cada 15-20s (< 100px), cross-talk entre NPCs cercanos y aislamiento base/expansión', () => {
    const player = new Player({ x: 100, y: 100 });
    const farNpc = new NPC({ name: 'Lejano', x: 240, y: 100, ambientPhrases: ['Lejos'], sceneId: 'overworld' });
    const npcA = new NPC({ name: 'Aurelio', x: 128, y: 100, sceneId: 'overworld' });
    const npcB = new NPC({ name: 'Lyra', x: 158, y: 100, sceneId: 'overworld' });

    const fakeGame = {
      player,
      tilemap: { currentSceneId: 'overworld' },
      dialogueBox: { active: false },
      dungeonPan: null,
      menuSystem: { isBlockingGameplay: () => false },
      ambientBarkTimer: 0.2,
      pendingCrossBark: null,
      isExpansionActive: false,
      isExpansionMode: false,
      expansionAmbientConfig: null
    };

    // Solo NPC lejano (> 100px): no debe emitir bark aunque venza el temporizador
    RPGGame.prototype._updateAmbientBarks.call(fakeGame, 0.3, [farNpc]);
    assert.equal(farNpc.ambientBubbleTimer, 0, 'NPC a >100px no debe soltar bark ambiental');
    assert.ok(fakeGame.ambientBarkTimer >= 15 && fakeGame.ambientBarkTimer <= 20, 'El temporizador debe reiniciarse entre 15 y 20 s');

    // Un NPC cercano en juego base: emite bark y nunca contiene frases de la expansión
    fakeGame.ambientBarkTimer = 0.1;
    RPGGame.prototype._updateAmbientBarks.call(fakeGame, 0.2, [npcA]);
    assert.ok(npcA.ambientBubbleTimer > 0 && npcA.ambientBubbleText.length > 0, 'NPC a <100px debe emitir bark');
    assert.ok(!npcA.ambientBubbleText.includes('98%') && !npcA.ambientBubbleText.includes('binario'));

    // Cross-talk entre dos NPCs cercanos (<100px del jugador y <=72px entre sí)
    npcA.ambientBubbleTimer = 0;
    npcA.ambientBubbleText = '';
    fakeGame.ambientBarkTimer = 0.05;
    RPGGame.prototype._updateAmbientBarks.call(fakeGame, 0.1, [npcA, npcB], { forceGroup: true });
    assert.ok(npcA.ambientBubbleTimer > 0, 'El primer NPC del grupo debe hablar primero');
    assert.ok(fakeGame.pendingCrossBark, 'Debe quedar programada la respuesta del compañero');

    // Tras 2.4s el compañero responde mirando al iniciador
    RPGGame.prototype._updateAmbientBarks.call(fakeGame, 2.4, [npcA, npcB]);
    assert.ok(npcB.ambientBubbleTimer > 0 && npcB.ambientBubbleText.length > 0, 'El segundo NPC debe responder en la conversación');
    assert.equal(fakeGame.pendingCrossBark, null);
  });

  test('Cárcel v2.0: Fianza (50 Bytes), Espera, Enfado del Carcelero (tortazo 0.5 + shake) y Game Over jail_rebellion', () => {
    const player = new Player({ x: 80, y: 80 });
    player.hp = 3;
    player.coins = 20;

    const sfxLog = [];
    const shownMessages = [];
    let closedCount = 0;
    let shakeCalls = 0;
    let loadedScene = 'jail_cell';
    let musicMode = 'jail';

    const fakeMusic = {
      playSFX: (s) => sfxLog.push(s),
      setMode: (m) => { musicMode = m; },
      playMenuSelect() {},
      playMenuMove() {},
      playCaughtSkipSound() {},
      playGameOver() {}
    };
    const menu = new MainMenuAndScenes(320, 180, {}, fakeMusic, {});

    const game = {
      player,
      npcs: [],
      jailRemainingSeconds: 600,
      jailerAnger: 0,
      jailerAngerCount: 0,
      isJailedForever: false,
      isExpansionMode: false,
      music: fakeMusic,
      menuSystem: menu,
      dialogueBox: {
        showMessage: (title, lines) => shownMessages.push({ title, lines }),
        close: () => { closedCount += 1; }
      },
      tilemap: {
        currentSceneId: 'jail_cell',
        width: 320,
        height: 180,
        loadScene: (s) => {
          loadedScene = s;
          game.tilemap.currentSceneId = s;
        }
      },
      assets: { charactersSheet: {} },
      camera: { setWorldBounds() {}, snapTo() {} },
      inventory: { hasItem: () => false },
      _saveGameToStorage() {},
      _shakeCamera() { shakeCalls += 1; },
      _resetAllNPCHitCounts() {},
      _restoreAllNPCsToOverworld() {},
      _releaseFromJail(msg) {
        return RPGGame.prototype._releaseFromJail.call(this, msg);
      }
    };

    const npcs = RPGGame.prototype._createVillageNPCs.call(game);
    const jailer = npcs.find((n) => n.sceneId === 'jail_cell');
    assert.ok(jailer, 'Debe existir el NPC carcelero');

    // 1. Diálogo inicial sin opciones ofensivas y con las 3 opciones nuevas
    const res1 = jailer.getDialogues();
    assert.equal(res1.lines[0], '¿Qué quieres? Tienes dos opciones: pagas la fianza de 50 Bytes o te aguantas 10 minutos.');
    assert.deepEqual(res1.choices.map((c) => c.label), [
      'Pagar la fianza (50 Bytes)',
      'Vale, esperaré.',
      '¿Y si no quiero esperar?'
    ]);

    // 2. Pagar sin dinero -> risa del carcelero
    res1.choices[0].onSelect();
    assert.equal(shownMessages[shownMessages.length - 1].lines[0], 'No tienes ni para pipas. A esperar.');
    assert.equal(loadedScene, 'jail_cell');
    assert.equal(game.jailRemainingSeconds, 600);

    // 3. Esperar -> cierra diálogo y mantiene condena
    res1.choices[1].onSelect();
    assert.equal(closedCount, 1);
    assert.equal(game.jailRemainingSeconds, 600);

    // 4. Dar la chapa 3 veces: avisos 1 y 2, y en el 3º tortazo (-0.5 HP, hit_flesh, shake)
    res1.choices[2].onSelect();
    assert.equal(game.jailerAnger, 1);
    assert.equal(shownMessages[shownMessages.length - 1].lines[0], 'Te he dicho que pagues o esperes. No me des la chapa.');

    res1.choices[2].onSelect();
    assert.equal(game.jailerAnger, 2);
    assert.equal(shownMessages[shownMessages.length - 1].lines[0], '¡A la próxima te doy un tortazo, chaval!');

    res1.choices[2].onSelect();
    assert.equal(game.jailerAnger, 3);
    assert.ok(sfxLog.includes('hit_flesh'), 'El tortazo debe reproducir hit_flesh');
    assert.equal(player.hp, 2.5, 'El tortazo debe quitar medio corazón (0.5)');
    assert.equal(shakeCalls, 1, 'El tortazo debe hacer screen shake');
    assert.equal(shownMessages[shownMessages.length - 1].lines[0], '¡Te lo he advertido! ¡A la próxima tiro la llave!');

    // 5. Pagar con >= 50 Bytes antes de la 4ª vez -> sale de la cárcel y resetea jailerAnger = 0
    player.coins = 75;
    res1.choices[0].onSelect();
    assert.equal(player.coins, 25);
    assert.equal(game.jailRemainingSeconds, 0);
    assert.equal(game.jailerAnger, 0, 'Al salir de la cárcel jailerAnger debe resetearse a 0');
    assert.equal(loadedScene, 'overworld');
    assert.equal(musicMode, 'village');

    // 6. Si regresa a la cárcel y da la chapa 4 veces -> tira la llave y Game Over jail_rebellion
    game.tilemap.loadScene('jail_cell');
    game.jailRemainingSeconds = 600;
    const res2 = jailer.getDialogues();
    res2.choices[2].onSelect();
    res2.choices[2].onSelect();
    res2.choices[2].onSelect();
    res2.choices[2].onSelect();
    assert.ok(sfxLog.includes('pickup_item'), 'Tirar la llave debe reproducir sonido');
    assert.equal(menu.state, 'game_over');
    assert.equal(menu.gameOverReason, 'jail_rebellion');

    const renderedTexts = [];
    const mockCtx = {
      save() {}, restore() {}, translate() {}, scale() {}, fillRect() {}, strokeRect() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {},
      createLinearGradient() { return { addColorStop() {} }; },
      createRadialGradient() { return { addColorStop() {} }; },
      fillText(t) { renderedTexts.push(String(t)); },
      measureText(t) { return { width: String(t).length * 4 }; }
    };
    menu.render(mockCtx);
    assert.ok(
      renderedTexts.includes('El Carcelero tiró la llave. Ahora pudrirás en la cárcel para siempre.'),
      'La pantalla de Game Over debe mostrar el mensaje de la llave tirada'
    );
  });
}
