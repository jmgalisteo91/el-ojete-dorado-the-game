import { Player } from '../../src/entities/Player.js';
import { GarbageCollectorBoss } from '../../src/entities/bosses/GarbageCollectorBoss.js';
import { StackOverflowBoss } from '../../src/entities/bosses/StackOverflowBoss.js';
import { PrototypeMicrowaveBoss } from '../../src/entities/bosses/PrototypeMicrowaveBoss.js';
import { FinalBossAlex } from '../../src/entities/bosses/FinalBossAlex.js';
import { Boss } from '../../src/entities/bosses/Boss.js';
import { RPGGame } from '../../src/main.js';
import { Tilemap } from '../../src/world/Tilemap.js';
import { CollisionSystem } from '../../src/physics/CollisionSystem.js';
import { Camera2D } from '../../src/core/Camera2D.js';
import { SceneTransitionController } from '../../src/core/SceneTransitionController.js';
import { DayNightCycle } from '../../src/world/DayNightCycle.js';
import { UILayout } from '../../src/ui/UILayout.js';
import { KernelBoss } from '../../src/expansion/entities/KernelBoss.js';
import { RosaShop } from '../../src/expansion/entities/RosaShop.js';
import { AlexUpdateBoss, ALEX_UPDATE_DEATH_QUOTE } from '../../src/expansion/entities/AlexUpdateBoss.js';
import { TechnicalDebtBoss, TECH_DEBT_DEATH_QUOTE } from '../../src/expansion/entities/TechnicalDebtBoss.js';
import { AchievementManager } from '../../src/core/AchievementManager.js';
import { MainMenuAndScenes } from '../../src/ui/MainMenuAndScenes.js';
import { EXPANSION_INFO, EXPANSION_NPCS, EXPANSION_UNLOCK_KEY, EXPANSION_BOSS_FLEE_TAUNTS } from '../../src/expansion/ExpansionData.js';
import { DialogueBox } from '../../src/ui/DialogueBox.js';
import { TonyRandazzo } from '../../src/expansion/entities/TonyRandazzo.js';
import { FrancoPancho } from '../../src/expansion/entities/FrancoPancho.js';
import { IñakitoBoss } from '../../src/expansion/entities/IñakitoBoss.js';
import {
  SCENE_AI_ALEX_PREBATTLE,
  SCENE_ALEX_FINAL,
  getCinematicTimeline
} from '../../src/assets/CinematicTimelines.js';
import { SCENE_AI_ALEX_PREBATTLE as VILLAIN_PREBATTLE } from '../../src/assets/VillainDialogues.js';
import { HUD } from '../../src/ui/HUD.js?v=8';
import {
  makeMap,
  openMap,
  makePlayer,
} from './mocks.mjs';

export async function run(test, assert) {
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
      assert.equal(items.length, 9, 'El título debe incluir la opción de expansión y Banda Sonora');
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

    // Arena inakito_office (20x15): barrera norte bloqueada hasta vencer a Iñakito
    const tmArena = new Tilemap(null, 16);
    await tmArena.loadExpansionScenes();
    tmArena.loadScene('inakito_office');
    assert.equal(tmArena.scenes.inakito_office.cols, 20);
    assert.equal(tmArena.scenes.inakito_office.rows, 15);
    const lockedNorth = tmArena.findNearbyDoor({ centerX: 10 * 16, centerY: 1.2 * 16 });
    assert.ok(lockedNorth && lockedNorth.blocked === true, 'Salida norte debe iniciar bloqueada');
    tmArena.setInakitoOfficeGate(true);
    const openNorth = tmArena.findNearbyDoor({ centerX: 10 * 16, centerY: 1.2 * 16 });
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

  test('Acto 2: El Kernel (3 fases, HUD hack, clones, firewalls, Llave) y Bar de Rosa (RosaShop)', async () => {
    // 1. Escenas kernel_arena (20x15) y rosa_bar (10x8) y puertas en valleverde_corp
    const tm = new Tilemap(null, 16);
    await tm.loadExpansionScenes();
    tm.loadScene('kernel_arena');
    assert.equal(tm.cols, 20);
    assert.equal(tm.rows, 15);

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
    player.isExpansionActive = true;
    player.hasSword = true;
    player.hp = 5;
    player.maxHp = 5;

    const gameState = {
      isExpansionActive: true,
      isExpansionMode: true,
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

    // Verificar que HUD.render retorna sin dibujar cuando kernelHackActive es true
    let hudFillCalls = 0;
    const mockHudCtx = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'top',
      save: () => {}, restore: () => {},
      fillRect: () => { hudFillCalls += 1; },
      strokeRect: () => {},
      fillText: () => {}
    };
    new HUD(gameState).render(mockHudCtx);
    assert.equal(hudFillCalls, 0, 'HUD.render no debe dibujar nada mientras kernelHackActive esté activo');

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
    const northCoreDoor = tm.findNearbyDoor({ centerX: 10 * 16, centerY: 1.2 * 16 });
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

  test('Acto 3: ai_nucleus_core (24x18), AlexUpdateBoss (5 fases + punto débil), 3 Finales y Jefa Secreta Deuda Técnica', async () => {
    const prevStorage = globalThis.localStorage;
    const storeMap = new Map();
    globalThis.localStorage = {
      getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
      setItem: (k, v) => storeMap.set(k, String(v)),
      removeItem: (k) => storeMap.delete(k)
    };

    try {
      // 1. Escena ai_nucleus_core (24x18 abierto) y música boss_alex_final
      const tm = new Tilemap(null, 16);
      await tm.loadExpansionScenes();
      tm.setAlexCoreUnlocked(true);
      tm.loadScene('ai_nucleus_core');
      const core = tm.scenes.ai_nucleus_core;
      assert.ok(core, 'Escena ai_nucleus_core debe existir');
      assert.equal(core.cols, 24);
      assert.equal(core.rows, 18);
      assert.ok(Array.isArray(tm._coreDataPlatforms) && tm._coreDataPlatforms.length === 1);

      const exitDoor = tm.findNearbyDoor({ centerX: 12 * 16, centerY: 16.8 * 16 });
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

  test('Aislamiento FinalBossAlex: el juego base usa cinemática, música y jefe originales (no expansión)', async () => {
    // 1. La cinemática pre-combate de ai_citadel es la del juego base, nunca SCENE_ALEX_FINAL
    assert.notEqual(SCENE_AI_ALEX_PREBATTLE, SCENE_ALEX_FINAL);
    assert.equal(SCENE_AI_ALEX_PREBATTLE.id, 'scene_ai_alex_prebattle');
    assert.equal(SCENE_AI_ALEX_PREBATTLE.musicMode, 'theme_main_villain');
    assert.equal(VILLAIN_PREBATTLE.musicMode, 'theme_main_villain');
    assert.equal(SCENE_ALEX_FINAL.id, 'scene_alex_final');
    assert.equal(SCENE_ALEX_FINAL.musicMode, 'boss_alex_final');

    const baseTimelineText = JSON.stringify(SCENE_AI_ALEX_PREBATTLE.timeline);
    assert.equal(/RESUCITADO|finiquito|reestructurado|alex_phase2/i.test(baseTimelineText), false);
    assert.match(baseTimelineText, /Microondas Cuántico|Gran Ojal/i);
    assert.equal(getCinematicTimeline('scene_ai_alex_prebattle'), SCENE_AI_ALEX_PREBATTLE);
    assert.equal(getCinematicTimeline('scene_alex_final'), SCENE_ALEX_FINAL);

    // 2. SceneTransitionController: ai_citadel dispara SCENE_AI_ALEX_PREBATTLE y ai_nucleus_core dispara SCENE_ALEX_FINAL
    const tm = new Tilemap(null, 16);
    await tm.loadExpansionScenes();
    tm.setAlexCoreUnlocked(true);
    const playedCutscenes = [];
    const baseGame = {
      isExpansionActive: false,
      isExpansionMode: false,
      prebattleAlexCutscenePlayed: false,
      alexFinalCutscenePlayed: false,
      tilemap: tm,
      player: new Player({ x: 11.5 * 16, y: 15 * 16 }),
      camera: { snapTo: () => {}, setWorldBounds: () => {} },
      music: { setMode: () => {}, stopBossMusic: () => {}, playDoorOpenSound: () => {} },
      npcs: [],
      enemies: [],
      bossCutscenesSeen: {},
      animeCutscenes: { playCutscene: (scene) => playedCutscenes.push(scene?.id) },
      _resolveStageSpawn: () => ({ x: 11.5 * 16, y: 15 * 16, facing: 'up' }),
      _saveGameToStorage: () => {},
      _restoreAllNPCsToOverworld: () => {}
    };
    const baseStc = new SceneTransitionController(baseGame);
    baseStc.executeStageTransition({ type: 'stage_transition', targetScene: 'ai_citadel' }, { immediate: true });
    assert.deepEqual(playedCutscenes, ['scene_ai_alex_prebattle']);

    baseGame.isExpansionActive = true;
    baseGame.isExpansionMode = true;
    baseStc.executeStageTransition({ type: 'stage_transition', targetScene: 'ai_nucleus_core' }, { immediate: true });
    assert.deepEqual(playedCutscenes, ['scene_ai_alex_prebattle', 'scene_alex_final']);

    // 3. FinalBossAlex en ai_citadel mantiene su identidad original (Microondas Cuántico, sin billetes ni caja fuerte)
    const originalAlex = new FinalBossAlex({ x: 11 * 16, y: 7.5 * 16, sceneId: 'ai_citadel' });
    assert.equal(originalAlex.id, 'boss_final_ai_alex');
    assert.equal(originalAlex.trackName, 'theme_main_villain');
    assert.equal(originalAlex.rewardAbility, 'hasGoldenAnus');
    assert.equal(typeof originalAlex._drawSafe, 'undefined');

    originalAlex._spawnGoreParticles(6);
    assert.ok(originalAlex._damageParticles.every((p) => p.type !== 'bill'));

    const fillTexts = [];
    const mockCtx = new Proxy(
      {
        fillText: (t) => fillTexts.push(String(t)),
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        scale: () => {}
      },
      { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } }
    );
    originalAlex.phase = 1;
    originalAlex.render(mockCtx, { renderX: 0, renderY: 0 });
    originalAlex.phase = 3;
    originalAlex.render(mockCtx, { renderX: 0, renderY: 0 });
    assert.ok(fillTexts.includes('00:03'), 'Fase 1 debe mostrar el contador del Microondas Cuántico');
    assert.ok(fillTexts.includes('00:00'), 'Fase 3 debe mostrar el núcleo 00:00 del Gran Ojal');
    assert.equal(fillTexts.includes('ALEX'), false, 'No debe dibujar la caja fuerte corporativa ALEX');
  });

  test('UX y Humor: burla de jefe al huir por la puerta (3s) y aviso único de chatarra con persistencia', async () => {
    const prevStorage = globalThis.localStorage;
    const storeMap = new Map();
    globalThis.localStorage = {
      getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
      setItem: (k, v) => storeMap.set(k, String(v)),
      removeItem: (k) => storeMap.delete(k)
    };

    try {
      // 1. Entrar en sewers_dungeon y huir estando Garbage Collector vivo
      const tm = new Tilemap(null, 16);
      await tm.loadExpansionScenes();
      tm.loadScene('sewers_dungeon');
      const gcBoss = new GarbageCollectorBoss({ x: 11.2 * 16, y: 8 * 16, sceneId: 'sewers_dungeon' });
      const inakitoBoss = new IñakitoBoss({ x: 9.2 * 16, y: 6.5 * 16, sceneId: 'inakito_office' });
      const dlgBox = new DialogueBox(320, 180, null);

      const gameStub = {
        tilemap: tm,
        player: new Player({ x: 11.5 * 16, y: 15 * 16 }),
        camera: { snapTo: () => {}, setWorldBounds: () => {} },
        music: { setMode: () => {}, stopBossMusic: () => {}, playDoorOpenSound: () => {} },
        npcs: [],
        enemies: [gcBoss, inakitoBoss],
        bossCutscenesSeen: { boss_garbage_collector: true },
        dialogueBox: dlgBox,
        expansionBossFleeTaunts: EXPANSION_BOSS_FLEE_TAUNTS,
        _resolveStageSpawn: () => ({ x: 11.5 * 16, y: 2 * 16, facing: 'down' }),
        _saveGameToStorage: () => {},
        _restoreAllNPCsToOverworld: () => {}
      };
      const stc = new SceneTransitionController(gameStub);
      stc.executeStageTransition({ type: 'exit', targetScene: 'sewers_puzzle' }, { immediate: true });

      assert.equal(dlgBox.active, true, 'Al huir de Garbage Collector debe mostrarse su burla');
      assert.equal(dlgBox.speakerName, gcBoss.name);
      assert.equal(dlgBox.lines.join(' ').replace(/\n+/g, ' '), '¡Huye, cobarde! ¡Tu código está lleno de fugas de memoria!');
      assert.equal(dlgBox.autoCloseTimer, 3.0);

      // Tras 3s se cierra automáticamente sin bloquear al jugador
      dlgBox.update(3.1);
      assert.equal(dlgBox.active, false);

      // En expansión: huir de Iñakito muestra su frase de EXPANSION_BOSS_FLEE_TAUNTS
      gameStub.isExpansionActive = true;
      gameStub.isExpansionMode = true;
      tm.loadScene('inakito_office');
      stc.executeStageTransition({ type: 'exit', targetScene: 'valleverde_corp' }, { immediate: true });
      assert.equal(dlgBox.active, true);
      assert.equal(dlgBox.speakerName, inakitoBoss.name);
      assert.equal(dlgBox.lines.join(' ').replace(/\n+/g, ' '), EXPANSION_BOSS_FLEE_TAUNTS.boss_inakito);
      dlgBox.close();

      // 2. Filtro de tutorial de chatarra (drone_scrap): 1ª vez diálogo; 2ª vez + tras recarga solo floatingText
      const scrapDlgs = [];
      const floats = [];
      const scrapGame = {
        player: new Player({ x: 64, y: 64 }),
        inventory: { getItemCount: () => 1 },
        questLog: null,
        hasSeenScrapHint: false,
        dialogueBox: { showMessage: (title, lines) => scrapDlgs.push({ title, lines }) },
        spawnFloatingText: (ft) => floats.push(ft),
        _saveGameToStorage: () => {}
      };

      RPGGame.prototype._handleScrapItemPickup.call(scrapGame, { x: 64, y: 64 });
      assert.equal(scrapGame.hasSeenScrapHint, true);
      assert.equal(storeMap.get('el_ojete_has_seen_scrap_hint'), 'true');
      assert.equal(scrapDlgs.length, 1, 'La 1ª chatarra debe mostrar el aviso del herrero');
      assert.equal(floats.length, 0);

      // 2ª chatarra en la misma sesión
      RPGGame.prototype._handleScrapItemPickup.call(scrapGame, { x: 80, y: 64 });
      assert.equal(scrapDlgs.length, 1, 'La 2ª chatarra NO debe repetir el diálogo largo');
      assert.equal(floats.length, 1);
      assert.equal(floats[0].text, '+1 Chatarra');

      // Simular nueva instancia tras recargar página con localStorage conservado
      const reloadedStub = {
        ...scrapGame,
        hasSeenScrapHint: false,
        player: new Player({ x: 96, y: 64 })
      };
      RPGGame.prototype._handleScrapItemPickup.call(reloadedStub, { x: 96, y: 64 });
      assert.equal(scrapDlgs.length, 1, 'Al recargar con localStorage guardado tampoco repite el diálogo');
      assert.equal(floats.length, 2);
      assert.equal(floats[1].text, '+1 Chatarra');
    } finally {
      globalThis.localStorage = prevStorage;
    }
  });
}
