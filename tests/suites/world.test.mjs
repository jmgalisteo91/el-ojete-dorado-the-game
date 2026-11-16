import { Enemy } from '../../src/entities/Enemy.js';
import { Player } from '../../src/entities/Player.js';
import { getDoorBlock, getDoorDestinationInfo, pushBackPlayer } from '../../src/core/DoorGatekeeper.js';
import { SpeechBubble, drawSpeechBalloonPath } from '../../src/ui/SpeechBubble.js';
import { StackOverflowBoss } from '../../src/entities/bosses/StackOverflowBoss.js';
import { FinalBossAlex } from '../../src/entities/bosses/FinalBossAlex.js';
import { RPGGame } from '../../src/main.js';
import { DEFAULT_LEADERBOARD } from '../../src/core/ScoreSystem.js';
import { Tilemap, CHASM_COLLISION } from '../../src/world/Tilemap.js';
import { TEMPLE_TILES } from '../../src/world/scenes/DungeonScenes.js';
import { DialogueBox } from '../../src/ui/DialogueBox.js';
import { CollisionSystem } from '../../src/physics/CollisionSystem.js';
import { Camera2D } from '../../src/core/Camera2D.js';
import { SceneTransitionController } from '../../src/core/SceneTransitionController.js';
import { CinematicDirector } from '../../src/ui/CinematicDirector.js';
import { NPC, getBromForgeChoices } from '../../src/entities/NPC.js';
import { TILES } from '../../src/graphics/SpriteSheetGenerator.js';
import { DayNightCycle } from '../../src/world/DayNightCycle.js';
import { RenderPipeline } from '../../src/graphics/RenderPipeline.js';
import { PremiumEffectsManager, resolveSceneBiome, BIOME_PRESETS } from '../../src/graphics/PremiumEffectsManager.js';
import { ENVIRONMENT_THEMES, getEnvironmentTheme } from '../../src/data/EnvironmentData.js';
import { installExpansionScenes } from '../../src/world/scenes/ExpansionScenes.js';
import { UILayout, SAFE_WIDTH, SAFE_HEIGHT, MODAL_WIDTH, MODAL_HEIGHT } from '../../src/ui/UILayout.js';
import { KernelBoss } from '../../src/expansion/entities/KernelBoss.js';
import { RosaShop } from '../../src/expansion/entities/RosaShop.js';
import { AlexUpdateBoss } from '../../src/expansion/entities/AlexUpdateBoss.js';
import { TechnicalDebtBoss } from '../../src/expansion/entities/TechnicalDebtBoss.js';
import { LeaderboardView } from '../../src/ui/LeaderboardView.js';
import { AudioManager, BGM_TRACKS, JUKEBOX_TRACKS } from '../../src/audio/AudioManager.js?v=8';
import { MainMenuAndScenes, FAKE_CHANGELOG_NOTES } from '../../src/ui/MainMenuAndScenes.js';
import { InputHandler, KONAMI_SEQUENCE } from '../../src/core/InputHandler.js';
import { TESTER_QA_DIALOGUES, VILLAGE_NPC_PROFILES } from '../../src/data/DialogueData.js';
import { BOSS_RUSH_QUEUE, BOSS_SPAWNS } from '../../src/data/EnemyData.js';
import { SCENE_AI_ALEX_WARNING, SCENE_ENDING_VICTORY } from '../../src/assets/VillainDialogues.js';
import { Inventory } from '../../src/ui/Inventory.js';
import { QuestLog } from '../../src/core/QuestLog.js';
import { QuestLogView } from '../../src/ui/QuestLogView.js';
import { CharacterStats } from '../../src/ui/CharacterStats.js';
import { WorldMap } from '../../src/ui/WorldMap.js';
import { EXPANSION_NPCS, EXPANSION_BGM } from '../../src/expansion/ExpansionData.js';
import { CinematicTimeline } from '../../src/ui/CinematicTimeline.js';
import { CINEMATIC_TIMELINES, CINEMATIC_TIMELINE_DURATIONS, PROLOGUE_ALEX, SCENE_ALEX_FINAL, SCENE_INTRO_INAKITO } from '../../src/assets/CinematicTimelines.js';
import { TonyRandazzo } from '../../src/expansion/entities/TonyRandazzo.js';
import { FrancoPancho } from '../../src/expansion/entities/FrancoPancho.js';
import { IñakitoBoss } from '../../src/expansion/entities/IñakitoBoss.js';
import { ExpansionManager } from '../../src/expansion/ExpansionManager.js?v=8';
import { HUD } from '../../src/ui/HUD.js?v=8';
import { CombatManager } from '../../src/core/CombatManager.js?v=8';
import { EXPANSION_EQUIPMENT } from '../../src/expansion/ExpansionData.js';
import {
  stubInput,
  makePlayer,
  makeMockCtx,
  makeFakeGame,
  makeFakeMusic,
} from './mocks.mjs';

export async function run(test, assert) {
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

    // (FIX 3) Arena dedicada del Stack Overflow, ampliada a 20x15 y con la puerta norte sellada
    assert.ok(tm.scenes.mines_boss_arena, 'Debe existir mines_boss_arena');
    assert.equal(tm.scenes.mines_boss_arena.cols, 20);
    assert.equal(tm.scenes.mines_boss_arena.rows, 15);
    assert.equal(tm.scenes.mines_boss_arena.layers.decoration[0][9], TILES.PORTAL_GATE_CLOSED);
    assert.equal(tm.scenes.mines_boss_arena.layers.collision[0][9], 1);

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
      centerX: 10 * 16, centerY: 1.5 * 16, dungeonCores: { stack: false }
    });
    assert.equal(lockedNorth, null, 'La salida norte debe estar sellada sin el Núcleo');
    const southExit = tm.findNearbyDoor({
      centerX: 10 * 16, centerY: 14 * 16, dungeonCores: { stack: false }
    });
    assert.equal(southExit && southExit.targetScene, 'mines_puzzle');
    tm.setMinesBossArenaGate(true);
    const openNorth = tm.findNearbyDoor({
      centerX: 10 * 16, centerY: 1.5 * 16, dungeonCores: { stack: true }
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

    // Submenú de Ajustes y Sonido (incluye accesibilidad: Screen Shake, Partículas, Texto Rápido)
    menu.openPauseMenu();
    pauseItems[3].action();
    assert.equal(menu.state, 'options');
    const soundItems = menu._getCurrentMenuItems();
    assert.equal(soundItems.length, 10, 'El submenú de Ajustes y Sonido debe tener 10 opciones (audio + accesibilidad + Notas del Parche v2.0)');
    assert.ok(soundItems.some((item) => item.label.includes('Efectos Visuales')), 'Debe existir el toggle de Efectos Visuales');
    assert.ok(soundItems.some((item) => item.label.includes('Screen Shake')), 'Debe existir el toggle de Screen Shake');
    assert.ok(soundItems.some((item) => item.label.includes('Efectos de Partículas')), 'Debe existir el toggle de Partículas');
    assert.ok(soundItems.some((item) => item.label.includes('Texto Rápido')), 'Debe existir el toggle de Texto Rápido');

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

  test('Transiciones espaciales: salir por un borde aparece en el opuesto con margen de 2 tiles ignorando player.direction', () => {
    const fake = {
      tilemap: { tileSize: 16, width: 576, height: 384 },
      player: { direction: 'down' },
      _compassFromDirection: RPGGame.prototype._compassFromDirection
    };
    const resolve = (exitDirection, wrongPlayerDir, door = { spawnY: 200 }) => {
      fake.player.direction = wrongPlayerDir;
      return RPGGame.prototype._resolveStageSpawn.call(fake, { ...door, exitDirection });
    };

    const east = resolve('east', 'left');
    assert.equal(east.x, 32, 'Salir por el Este debe aparecer al Oeste (32 px)');
    assert.equal(east.y, 200);
    assert.equal(east.facing, 'right');

    const west = resolve('west', 'right');
    assert.equal(west.x, 576 - 32, 'Salir por el Oeste debe aparecer al Este');
    assert.equal(west.facing, 'left');

    const south = resolve('south', 'up', { spawnX: 288 });
    assert.equal(south.y, 32, 'Salir por el Sur debe aparecer arriba (margen 32 px)');
    assert.equal(south.x, 288);
    assert.equal(south.facing, 'down');

    const north = resolve('north', 'down', { spawnX: 288 });
    assert.equal(north.y, 384 - 32, 'Salir por el Norte debe aparecer abajo (margen 32 px)');
    assert.equal(north.x, 288);
    assert.equal(north.facing, 'up');
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
      assert.equal(menu.state, 'final_stats', 'Debe mostrar primero el resumen final de estadísticas tras los créditos');

      // Confirmar / cerrar la pantalla de estadísticas -> dispara el Falso Final Glitch
      const dummyInput = {
        consumeInteraction: () => false,
        consumeKey: () => false,
        consumePointerClick: () => false,
        pointerJustClicked: false
      };
      menu.update(0.4, dummyInput);
      const statsInput = {
        consumeInteraction: () => true,
        consumeKey: (k) => k === 'Enter',
        consumePointerClick: () => false,
        pointerJustClicked: false
      };
      menu.update(0.1, statsInput);
      assert.ok(sfxCalls.includes('ui_glitch'), 'Debe reproducir el SFX ui_glitch tras cerrar las estadísticas');
      assert.equal(menu.state, 'false_ending_glitch');
      assert.equal(menu.falseEndingText, 'SISTEMA CORRUPTO. BUSCANDO BACKUP...');

      // Avanzar 3.6s -> fundido a negro progresivo y mensaje activo
      menu.update(3.6, dummyInput);
      assert.equal(menu.state, 'false_ending_glitch');
      assert.ok(menu.fadeAlpha > 0 && menu.fadeAlpha <= 1, 'Debe hacer fundido a negro hacia el final de los 4s');

      // Completar los 4s -> vuelve al menú de título visible (fadeAlpha === 0) y con controles activos
      menu.update(0.6, dummyInput);
      assert.equal(worldResetCount, 1);
      assert.equal(menu.state, 'title');
      assert.equal(menu.fadeAlpha, 0, 'openTitleScreen() debe limpiar fadeAlpha a 0 tras false_ending_glitch');
      assert.equal(menu.fadeDirection, 0);

      // El menú responde de inmediato a la navegación tras volver del falso final
      const navInput = {
        ...dummyInput,
        consumeMenuDirection: () => 'down',
        consumeKey: () => false,
        consumeInteraction: () => false
      };
      menu.update(0.05, navInput);
      assert.equal(menu.selectedIndex, 1, 'El menú de título debe responder inmediatamente al teclado tras el glitch final');

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

      // 3. Gating estricto de UI, habilidades, inventario, drops y SFX en juego base
      const prevFetch = globalThis.fetch;
      const fetchedUrls = [];
      globalThis.fetch = async (url) => {
        fetchedUrls.push(String(url));
        return { ok: false };
      };
      audio.ctx = {
        state: 'running',
        destination: {},
        createGain: () => ({ gain: { value: 1, setValueAtTime() {} }, connect() {} })
      };
      audio.masterGainNode = audio.ctx.createGain();
      audio.musicGainNode = audio.ctx.createGain();
      audio.sfxGainNode = audio.ctx.createGain();
      await audio.preloadSFX();
      globalThis.fetch = prevFetch;
      for (const expSfx of ['ui_glitch', 'console_log', 'hologram_on', 'error_buzz', 'keyboard_type', 'electric_shock', 'coffee_sip', 'door_airlock']) {
        assert.equal(fetchedUrls.some((u) => u.includes(expSfx)), false, `Base preloadSFX() no debe cargar SFX de expansión (${expSfx})`);
      }

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
        characterStats: new CharacterStats(320, 180),
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
        isExpansionActive: false,
        isExpansionMode: false,
        gameState: 'base',
        kernelHackActive: false,
        kernelHudFlicker: false,
        curriculum: 5,
        curriculumFlashTimer: 0,
        touchControls: { isTouchEnabled: () => false },
        input: { touchActive: false, hasActiveTouchSession: () => false },
        cloudSyncStatus: 'synced',
        hasPendingCloudSync: false,
        syncHotbarWithInventory: () => {},
        _ensurePlayerHotbar: () => [null, null, null, null, null],
        _renderHotbar: () => {},
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
      player.game = fakeGame;
      inv.game = fakeGame;
      fakeGame.characterStats.game = fakeGame;
      mgr.game = fakeGame;

      // CharacterStats base: solo 4 habilidades originales, nunca Ejecutivo/Resiliencia
      fakeGame.characterStats.open();
      fakeGame.characterStats.switchTab('skills');
      assert.deepEqual(
        fakeGame.characterStats.getVisibleSkills(player).map((s) => s.key),
        ['vigor', 'filo', 'reflejo', 'log'],
        'En juego base solo deben mostrarse las 4 habilidades base'
      );
      const baseTexts = [];
      const baseCtx = {
        ...makeMockCtx(),
        fillText(t) { baseTexts.push(String(t)); },
        measureText(t) { return { width: String(t).length * 2.5 }; }
      };
      fakeGame.characterStats.render(baseCtx, player, null);
      assert.equal(baseTexts.some((t) => t.includes('Ejecutivo') || t.includes('Resiliencia')), false, 'CharacterStats base no debe dibujar Ejecutivo ni Resiliencia');

      // Inventory base: rechaza y filtra Grapadora / Bolígrafo si se inyectan
      assert.equal(inv.addItem({ ...EXPANSION_EQUIPMENT.boligrafo }), false);
      inv.items.push({ ...EXPANSION_EQUIPMENT.grapadora, qty: 1 });
      inv.open();
      baseTexts.length = 0;
      inv.render(baseCtx, player);
      assert.equal(baseTexts.some((t) => t.includes('Grapadora') || t.includes('Bolígrafo')), false, 'Inventory.render base no debe dibujar armas de expansión');
      inv.items.length = 0;

      // CombatManager drops base: nunca suelta Currículums
      const cm = new CombatManager(fakeGame);
      player.skills.reciclaje = true;
      player.lastKillCurriculumDrop = true;
      cm._spawnEnemyDrops({ isBoss: false, dead: true, coinsDropped: false, centerX: 50, centerY: 50, sceneId: 'vertedero_piso_1' });
      assert.equal(fakeGame.droppedCoins.some((c) => c.kind === 'curriculum'), false, 'Juego base nunca debe dropear Currículums');
      fakeGame.droppedCoins.length = 0;
      player.skills.reciclaje = false;
      player.lastKillCurriculumDrop = false;

      // HUD base: no muestra indicadores de expansión
      const hud = new HUD(fakeGame);
      player.equippedWeapon = 'grapadora';
      baseTexts.length = 0;
      hud.render(baseCtx);
      assert.equal(baseTexts.some((t) => t.includes('FELICIDAD') || t.includes('📄') || t.includes('📎') || t.includes('🖊')), false, 'HUD base no debe dibujar iconos ni currículums de expansión');
      player.equippedWeapon = 'default';

      // Arranque mediante ExpansionManager.init(game) desde MainMenuAndScenes

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
      assert.equal(fakeGame.isExpansionActive, true);
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

  test('PremiumEffectsManager: Clasificación de biomas y degradación segura en entorno headless', async () => {
    assert.equal(resolveSceneBiome('overworld'), 'valleverde');
    assert.equal(resolveSceneBiome('first_stage'), 'valleverde');
    assert.equal(resolveSceneBiome('sewers_entry'), 'cloacas');
    assert.equal(resolveSceneBiome('forge_entry'), 'forja');
    assert.equal(resolveSceneBiome('ai_fortress_gate'), 'forja');
    assert.equal(resolveSceneBiome('armor_temple'), 'templos');
    assert.equal(resolveSceneBiome('sword_temple'), 'templos');
    assert.equal(resolveSceneBiome('ai_citadel'), 'ciudadela');
    assert.equal(resolveSceneBiome('valleverde_corp'), 'ciudadela');
    assert.equal(resolveSceneBiome('kernel_arena'), 'ciudadela');
    assert.equal(resolveSceneBiome('house_player'), 'interior');
    assert.equal(resolveSceneBiome('rosa_bar'), 'interior');

    const mgr = new PremiumEffectsManager(null);
    const ok = await mgr.init();
    assert.equal(ok, false);
    assert.equal(mgr.ready, false);
    assert.equal(mgr.setScene('forge_entry'), 'forja');
    mgr.update(0.016, { sceneId: 'overworld' });
    mgr.render();
    mgr.destroy();
  });

  test('PremiumEffectsManager: Capa PixiJS v8 transparente, partículas por bioma y shaders de calor/agua', async () => {
    const prevDoc = globalThis.document;
    const prevWin = globalThis.window;

    const makeMockCanvas = () => ({
      width: 1280,
      height: 720,
      clientWidth: 1280,
      clientHeight: 720,
      offsetLeft: 10,
      offsetTop: 20,
      clientLeft: 2,
      clientTop: 2,
      style: {},
      attributes: {},
      parentNode: null,
      setAttribute(k, v) {
        this.attributes[k] = v;
      },
      getContext() {
        return {
          fillStyle: '',
          font: '',
          textAlign: '',
          textBaseline: '',
          fillRect() {},
          fillText() {},
          beginPath() {},
          arc() {},
          fill() {},
          createRadialGradient() {
            return { addColorStop() {} };
          }
        };
      }
    });

    const parentChildren = [];
    const parentNode = {
      insertBefore(node, ref) {
        const idx = parentChildren.indexOf(node);
        if (idx >= 0) parentChildren.splice(idx, 1);
        const refIdx = ref ? parentChildren.indexOf(ref) : -1;
        if (refIdx >= 0) parentChildren.splice(refIdx, 0, node);
        else parentChildren.push(node);
        node.parentNode = this;
        node.nextSibling = parentChildren[parentChildren.indexOf(node) + 1] || null;
      },
      removeChild(node) {
        const idx = parentChildren.indexOf(node);
        if (idx >= 0) parentChildren.splice(idx, 1);
        node.parentNode = null;
      }
    };

    const gameCanvas = makeMockCanvas();
    parentNode.insertBefore(gameCanvas, null);
    const overlayCanvas = makeMockCanvas();

    let initOpts = null;
    let renderCalls = 0;

    class MockContainer {
      constructor() {
        this.children = [];
        this.visible = true;
      }
      addChild(c) {
        this.children.push(c);
        return c;
      }
      removeChildren() {
        this.children.length = 0;
      }
    }

    class MockParticleContainer extends MockContainer {
      constructor(opts) {
        super();
        this.opts = opts;
        this.particleChildren = [];
      }
      addParticle(p) {
        this.particleChildren.push(p);
        return p;
      }
      removeParticles() {
        this.particleChildren.length = 0;
      }
    }

    class MockParticle {
      constructor(opts) {
        Object.assign(this, { x: 0, y: 0, rotation: 0, alpha: 1, scaleX: 1, scaleY: 1 }, opts);
      }
    }

    class MockSprite {
      constructor(texture) {
        this.texture = texture;
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
        this.visible = true;
        this.alpha = 1;
        this.filters = null;
      }
    }

    class MockUniformGroup {
      constructor(defs) {
        this.uniforms = {};
        for (const [k, def] of Object.entries(defs)) {
          this.uniforms[k] = def.value;
        }
      }
    }

    class MockFilter {
      constructor(opts) {
        this.glProgram = opts.glProgram;
        this.resources = opts.resources;
      }
    }

    const MockTexture = function Texture(opts) {
      this.source = opts?.source || {};
      this.frame = opts?.frame || null;
    };
    MockTexture.from = () => ({ source: { mock: true } });
    MockTexture.WHITE = { white: true };

    const listeners = {};
    const mockPixi = {
      Application: class {
        constructor() {
          this.stage = new MockContainer();
          this.ticker = { stop() {} };
          this.canvas = overlayCanvas;
        }
        async init(opts) {
          initOpts = opts;
        }
        render() {
          renderCalls++;
        }
        destroy() {}
      },
      Container: MockContainer,
      ParticleContainer: MockParticleContainer,
      Particle: MockParticle,
      Sprite: MockSprite,
      UniformGroup: MockUniformGroup,
      Filter: MockFilter,
      GlProgram: {
        from(cfg) {
          return { vertex: cfg.vertex || 'default', fragment: cfg.fragment };
        }
      },
      Rectangle: class {
        constructor(x, y, w, h) {
          this.x = x; this.y = y; this.width = w; this.height = h;
        }
      },
      Texture: MockTexture
    };

    try {
      globalThis.document = {
        createElement: () => makeMockCanvas()
      };
      globalThis.window = {
        addEventListener(ev, fn) { listeners[ev] = fn; },
        removeEventListener(ev, fn) { if (listeners[ev] === fn) delete listeners[ev]; }
      };

      const mgr = new PremiumEffectsManager(gameCanvas, { pixi: mockPixi, width: 320, height: 180 });
      const initialized = await mgr.init();
      assert.equal(initialized, true);
      assert.equal(initOpts.backgroundAlpha, 0, 'Pixi debe inicializar con fondo transparente');
      assert.equal(initOpts.width, 320);
      assert.equal(initOpts.height, 180);
      assert.equal(overlayCanvas.style.pointerEvents, 'none', 'El canvas de Pixi debe dejar pasar los clics');
      assert.equal(parentChildren[0], gameCanvas);
      assert.equal(parentChildren[1], overlayCanvas, 'Pixi canvas debe apilarse inmediatamente encima de #game-canvas');
      assert.equal(overlayCanvas.style.left, '12px');
      assert.equal(overlayCanvas.style.top, '22px');
      assert.equal(overlayCanvas.style.width, '1280px');
      assert.equal(overlayCanvas.style.height, '720px');

      // Biomas y partículas
      const tm = new Tilemap();
      tm.loadScene('overworld');
      mgr.update(0.05, { sceneId: 'overworld', tilemap: tm, camera: { renderX: 0, renderY: 0 } });
      assert.equal(mgr.biome, 'valleverde');
      assert.equal(mgr.particles.length, BIOME_PRESETS.valleverde.maxParticles);
      assert.ok(mgr.particles.every((p) => p.type === 'leaf' || p.type === 'pollen'));

      // Agua visible en Valleverde activa el shader de agua; escena sin agua lo oculta
      const waterTm = {
        tileSize: 16,
        cols: 6,
        rows: 4,
        layers: {
          ground: [
            [1, 1, 1, 1, 1, 1],
            [1, TILES.WATER_1, TILES.WATER_1, 1, 1, 1],
            [1, TILES.WATER_1, TILES.WATER_1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1]
          ]
        }
      };
      mgr.update(0.05, { sceneId: 'overworld', tilemap: waterTm, camera: { renderX: 0, renderY: 0 } });
      assert.equal(mgr.waterSprite.visible, true, 'El shader de agua debe activarse cuando hay agua visible en Valleverde');
      assert.equal(mgr.heatSprite.visible, false);

      // Forja: chispas + humo + shader de calor inferior
      mgr.update(0.05, { sceneId: 'forge_entry', tilemap: tm, camera: { renderX: 0, renderY: 0 } });
      assert.equal(mgr.biome, 'forja');
      assert.equal(mgr.particles.length, BIOME_PRESETS.forja.maxParticles);
      assert.ok(mgr.particles.every((p) => p.type === 'spark' || p.type === 'smoke'));
      assert.equal(mgr.heatSprite.visible, true, 'El shader de calor debe activarse en la Forja');
      assert.equal(mgr.waterSprite.visible, false);

      // Cloacas / Templos / Ciudadela
      mgr.update(0.05, { sceneId: 'sewers_entry' });
      assert.ok(mgr.particles.every((p) => p.type === 'drip' || p.type === 'fly'));
      mgr.update(0.05, { sceneId: 'armor_temple' });
      assert.ok(mgr.particles.every((p) => p.type === 'dust'));
      mgr.update(0.05, { sceneId: 'ai_citadel' });
      assert.ok(mgr.particles.every((p) => p.type === 'bit0' || p.type === 'bit1' || p.type === 'glitch'));

      mgr.render();
      assert.equal(renderCalls, 1);

      // Calidad baja reduce partículas y desactiva shaders pesados
      mgr.setQuality('low');
      assert.ok(mgr.particles.length < BIOME_PRESETS.ciudadela.maxParticles);
      mgr.update(0.05, { sceneId: 'forge_entry' });
      assert.equal(mgr.heatSprite.visible, false);

      // Interior limpia partículas y oculta el overlay
      mgr.setScene('house_player');
      assert.equal(mgr.particles.length, 0);
      assert.equal(overlayCanvas.style.display, 'none');

      mgr.destroy();
      assert.equal(parentChildren.includes(overlayCanvas), false);
    } finally {
      globalThis.document = prevDoc;
      globalThis.window = prevWin;
    }
  });

  test('Templos en formato JSON de Tiled: capas (ground, walls, decor_over, lights, props), ambientación y caminos despejados', () => {
    const tm = new Tilemap();

    // 1. Verificar estructura Tiled JSON y capas en ambos templos
    for (const id of ['armor_temple', 'sword_temple']) {
      const scene = tm.scenes[id];
      assert.equal(scene.tiledFormat, true, `${id} debe haberse cargado desde formato Tiled`);
      assert.equal(scene.tiledMap.type, 'map');
      const layerNames = scene.tiledMap.layers.map((l) => l.name);
      assert.deepEqual(layerNames, ['ground', 'walls', 'decor_over', 'lights', 'props']);
      assert.ok(scene.layers.ground && scene.layers.walls && scene.layers.decor_over);
      assert.ok(Array.isArray(scene.lights) && scene.lights.length >= 6);
      assert.ok(Array.isArray(scene.props) && scene.props.length >= 4);
    }

    // 2. Templo de la Armadura: runas cian animadas, luces tenues y estatuas interactivas
    const armor = tm.scenes.armor_temple;
    let cyanRunes = 0;
    for (let r = 0; r < armor.rows; r++) {
      for (let c = 0; c < armor.cols; c++) {
        if (armor.layers.ground[r][c] === TEMPLE_TILES.BINARY_RUNE_CYAN) cyanRunes++;
      }
    }
    assert.ok(cyanRunes >= 8, 'El Templo de la Armadura debe incluir runas cian en el suelo');
    assert.ok(armor.lights.some((l) => l.glow === 'cyan'), 'Debe incluir luces tenues cian');

    // Probar interacción con prop de estatua y camino de entrada/salida de 3 tiles despejado
    tm.loadScene('armor_temple');
    for (let r = 13; r <= 16; r++) {
      for (const c of [9, 10, 11]) {
        assert.equal(tm.layers.collision[r][c], 0, `Camino entrada/salida 3 tiles armor_temple libre en (${c},${r})`);
      }
    }
    for (let r = 2; r <= 4; r++) {
      for (const c of [9, 10, 11]) {
        assert.equal(tm.layers.collision[r][c], 0, `Acceso norte al altar armor_temple libre en (${c},${r})`);
      }
    }
    const fakePlayer = { centerX: 7 * 16 + 8, centerY: 15 * 16 + 8 };
    const propHit = tm.findNearbyProp(fakePlayer);
    assert.ok(propHit && propHit.kind === 'temple_prop', 'Debe detectar estatua interactiva cercana');
    assert.ok(Array.isArray(propHit.target.lines) && propHit.target.lines.length >= 1);

    // 3. Templo de la Espada: foso abismo central, monolitos flotantes y caballeros caídos en esquinas
    const sword = tm.scenes.sword_temple;
    let abyssCount = 0;
    let floatingCount = 0;
    let fallenKnights = 0;
    for (let r = 0; r < sword.rows; r++) {
      for (let c = 0; c < sword.cols; c++) {
        if (sword.layers.ground[r][c] === TEMPLE_TILES.ABYSS_VOID) {
          abyssCount++;
          assert.equal(sword.layers.collision[r][c], CHASM_COLLISION, 'El foso central debe marcar colisión de abismo');
        }
        if (sword.layers.decor_over[r][c] === TEMPLE_TILES.FLOATING_MONOLITH) floatingCount++;
        if (sword.layers.decor_over[r][c] === TEMPLE_TILES.STATUE_KNIGHT) fallenKnights++;
      }
    }
    assert.ok(abyssCount >= 12, 'El Templo de la Espada debe tener foso de abismo central');
    assert.ok(floatingCount >= 2, 'Debe tener monolitos flotantes sobre el abismo');
    assert.equal(fallenKnights, 4, 'Debe tener estatuas de caballeros caídos en las 4 esquinas');

    // Pasillos laterales navegables rodeando el abismo y altar/puerta despejados
    tm.loadScene('sword_temple');
    assert.equal(tm.layers.collision[4][11], 0, 'Altar de la Espada debe ser accesible');
    assert.equal(tm.layers.collision[7][7], 0, 'Pasillo oeste junto al abismo debe ser transitable');
    assert.equal(tm.layers.collision[7][16], 0, 'Pasillo este junto al abismo debe ser transitable');
    assert.equal(tm.layers.collision[10][11], 1, 'MONOLITH_2 debe ocupar su pedestal sólido en (11,10)');
    for (let r = 10; r <= 16; r++) {
      assert.equal(tm.layers.collision[r][12], 0, `Pasillo sur sword_temple libre en (12,${r})`);
      if (r >= 11) {
        assert.equal(tm.layers.collision[r][10], 0, `Pasillo sur 3 tiles sword_temple libre en (10,${r})`);
        assert.equal(tm.layers.collision[r][11], 0, `Pasillo sur 3 tiles sword_temple libre en (11,${r})`);
      }
    }
    // Puente central transitable sobre el foso y acceso norte de 3 tiles despejado
    for (let r = 6; r <= 8; r++) {
      assert.equal(tm.layers.collision[r][11], 0, `Puente central sword_temple libre en (11,${r})`);
      assert.equal(tm.layers.collision[r][12], 0, `Puente central sword_temple libre en (12,${r})`);
    }
    for (let r = 2; r <= 5; r++) {
      for (const c of [10, 11, 12]) {
        assert.equal(tm.layers.collision[r][c], 0, `Acceso norte al portal sword_temple libre en (${c},${r})`);
      }
    }

    // 4. Exterior en first_stage: sin árboles tapando las puertas de los templos
    const firstStage = tm.scenes.first_stage;
    for (let c = 14; c <= 21; c++) {
      for (let r = 0; r <= 3; r++) {
        const dec = firstStage.layers.decoration[r][c];
        assert.notEqual(dec, TILES.TREE_TOP, `No debe haber copa de árbol tapando el Templo de la Espada en (${c},${r})`);
        assert.notEqual(dec, TILES.TREE_TRUNK, `No debe haber tronco tapando el Templo de la Espada en (${c},${r})`);
      }
    }
    assert.equal(firstStage.layers.ground[10][6], TILES.PATH, 'Acceso con baldosas frente al Templo de la Armadura');
    assert.equal(firstStage.layers.ground[4][17], TILES.PATH, 'Acceso con baldosas frente al Templo de la Espada');

    // 5. Render completo de ambos templos sin errores con mock Canvas 2D
    const noopCtx = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
      globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: false,
      save() {}, restore() {}, fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {},
      lineTo() {}, arc() {}, ellipse() {}, fill() {}, stroke() {}, fillText() {}, drawImage() {},
      createRadialGradient() { return { addColorStop() {} }; }
    };
    const cam = new Camera2D(320, 180, tm.width, tm.height);
    tm.loadScene('armor_temple');
    tm.render(noopCtx, cam);
    tm.loadScene('sword_temple');
    tm.render(noopCtx, cam);
  });

  test('Eventos de escena: paneo suave de cámara (2s) al entrar por 1ª vez a mazmorra y antorchas activadas por baldosa en templos', () => {
    const tm = new Tilemap();
    tm.loadScene('armor_temple');
    const cam = new Camera2D(320, 180, tm.width, tm.height);
    const player = new Player({ x: 10.5 * 16, y: 14 * 16 });
    cam.snapTo(player);
    const startCamX = cam.x;
    const startCamY = cam.y;

    const fakeGame = {
      tilemap: tm,
      camera: cam,
      player,
      visitedDungeons: new Set(),
      dungeonPan: null,
      triggeredTempleTorches: new Set(),
      isExpansionActive: false,
      isExpansionMode: false,
      music: { playMenuSelect() {} },
      menuSystem: { showNotice() {} },
      _isDungeonPanScene: RPGGame.prototype._isDungeonPanScene,
      maybeStartDungeonIntroPan: RPGGame.prototype.maybeStartDungeonIntroPan,
      _updateDungeonIntroPan: RPGGame.prototype._updateDungeonIntroPan,
      _checkTempleTorchTriggers: RPGGame.prototype._checkTempleTorchTriggers
    };

    // 1. Primera entrada a armor_temple inicia paneo de 2 segundos y marca visitedDungeons
    const started = fakeGame.maybeStartDungeonIntroPan('armor_temple');
    assert.equal(started, true, 'Debe iniciar paneo en la primera visita a la mazmorra');
    assert.ok(fakeGame.visitedDungeons.has('armor_temple'));
    assert.equal(fakeGame.dungeonPan.duration, 2.0);

    fakeGame._updateDungeonIntroPan(0.6);
    assert.ok(fakeGame.dungeonPan !== null && cam.y <= startCamY, 'A mitad del paneo la cámara se desplaza suavemente hacia la sala');

    fakeGame._updateDungeonIntroPan(1.5);
    assert.equal(fakeGame.dungeonPan, null, 'Al completar 2.0s debe finalizar el paneo y devolver el control');
    assert.ok(Math.abs(cam.x - startCamX) < 0.01 && Math.abs(cam.y - startCamY) < 0.01, 'La cámara debe volver al jugador');

    // Segunda entrada a la misma mazmorra NO repite el paneo
    assert.equal(fakeGame.maybeStartDungeonIntroPan('armor_temple'), false, 'No debe repetir el paneo en visitas posteriores');

    // 2. Antorchas activadas al pisar baldosas en armor_temple y sword_temple
    assert.equal(tm.layers.decor_over[13][7], TEMPLE_TILES.TORCH_UNLIT, 'Antorcha de entrada empieza apagada');
    const baseArmorLights = tm.lightSources.length;
    player.x = 10 * 16;
    player.y = 13 * 16;
    fakeGame._checkTempleTorchTriggers();
    assert.equal(tm.layers.decor_over[13][7], TEMPLE_TILES.TORCH_CYAN, 'Pisar la entrada enciende la antorcha oeste');
    assert.equal(tm.layers.decor_over[13][14], TEMPLE_TILES.TORCH_CYAN, 'Pisar la entrada enciende la antorcha este');
    assert.equal(tm.lightSources.length, baseArmorLights + 2, 'Debe registrar 2 fuentes de luz nuevas');

    // Sword temple
    tm.loadScene('sword_temple');
    assert.equal(tm.layers.decor_over[12][5], TEMPLE_TILES.TORCH_UNLIT);
    const baseSwordLights = tm.lightSources.length;
    player.x = 11 * 16;
    player.y = 13 * 16;
    fakeGame._checkTempleTorchTriggers();
    assert.equal(tm.layers.decor_over[12][5], TEMPLE_TILES.TORCH_AMBER);
    assert.equal(tm.layers.decor_over[12][18], TEMPLE_TILES.TORCH_AMBER);
    assert.equal(tm.lightSources.length, baseSwordLights + 2);

    // Reset restaura las antorchas apagadas y elimina las luces dinámicas
    tm.resetTempleTorches();
    assert.equal(tm.layers.decor_over[12][5], TEMPLE_TILES.TORCH_UNLIT);
    assert.equal(tm.lightSources.length, baseSwordLights);
  });

  test('Transición Fade to Black (0.3s): fadeAlpha 0->1 (0.15s), cambio en el pico y 1->0 (0.15s)', () => {
    let swapped = false;
    let movedStopped = false;
    const game = {
      fadeAlpha: 0,
      sceneFade: null,
      player: { stopMovement: () => { movedStopped = true; } },
      tilemap: { currentSceneId: 'overworld', loadScene: (s) => { game.tilemap.currentSceneId = s; } },
      _loadScene(s, cb, opts) { return RPGGame.prototype._loadScene.call(this, s, cb, opts); },
      _updateSceneFade(dt) { return RPGGame.prototype._updateSceneFade.call(this, dt); },
      _renderSceneFadeOverlay(ctx) { return RPGGame.prototype._renderSceneFadeOverlay.call(this, ctx); }
    };

    game._loadScene('first_stage', () => {
      swapped = true;
      game.tilemap.loadScene('first_stage');
    });
    assert.equal(movedStopped, true, 'Al iniciar transición debe frenar al jugador');
    assert.equal(game.sceneFade.phase, 'out');
    assert.equal(swapped, false, 'La escena no debe cambiar antes de completar el fundido a negro');

    // Mitad de la primera fase (0.075s -> ~50% negro)
    game._updateSceneFade(0.075);
    assert.ok(Math.abs(game.fadeAlpha - 0.5) < 0.05);
    assert.equal(swapped, false);

    // Al alcanzar 0.15s (fadeAlpha == 1) cambia la escena y entra en fade-in
    game._updateSceneFade(0.08);
    assert.equal(swapped, true, 'La escena debe cargarse exactamente cuando fadeAlpha llega a 1');
    assert.equal(game.tilemap.currentSceneId, 'first_stage');
    assert.equal(game.sceneFade.phase, 'in');

    // Renderiza overlay negro en el pico
    const fadeRects = [];
    let lastFill = '';
    const fadeCtx = {
      save() {}, restore() {},
      set fillStyle(v) { lastFill = String(v); },
      get fillStyle() { return lastFill; },
      fillRect(x, y, w, h) { fadeRects.push({ x, y, w, h, fill: lastFill }); }
    };
    game._renderSceneFadeOverlay(fadeCtx);
    assert.ok(fadeRects.length === 1 && fadeRects[0].fill.includes('rgba(0, 0, 0, 1.000)'));

    // Al completar los otros 0.15s queda transparente
    game._updateSceneFade(0.16);
    assert.equal(game.fadeAlpha, 0);
    assert.equal(game.sceneFade, null);
  });

  test('Accesibilidad (Screen Shake, Partículas, Texto Rápido) persistida en el_ojete_options y Nueva Partida +', () => {
    const storeMap = new Map();
    const previousStorage = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
      setItem: (k, v) => { storeMap.set(k, String(v)); },
      removeItem: (k) => { storeMap.delete(k); }
    };

    try {
      const fakeMusic = {
        isMuted: false,
        volume: 0.75,
        playMenuSelect() {}, playMenuMove() {}, playCaughtSkipSound() {},
        setVolume(v) { this.volume = v; }, setMode() {}, stopTitleMusic() {}
      };
      const cam = new Camera2D(320, 180);
      const dialogueBox = new DialogueBox(320, 180);
      const pfx = new PremiumEffectsManager(320, 180);
      pfx.particleContainer = { visible: true, removeChildren() {}, addChild() {} };

      const menu = new MainMenuAndScenes(320, 180, {}, fakeMusic, {
        onApplyOptions: (opts) => RPGGame.prototype._applyGameOptions.call({
          music: fakeMusic,
          dialogueBox,
          camera: cam,
          premiumEffects: pfx,
          renderPipeline: { setEffects() {} },
          animeCutscenes: null
        }, opts)
      });

      // Abrir opciones y activar los 3 toggles
      menu.openOptionsScreen('title');
      const items = menu._getCurrentMenuItems();
      const shakeOpt = items.find((it) => it.label.startsWith('Screen Shake:'));
      const partOpt = items.find((it) => it.label.startsWith('Efectos de Partículas:'));
      const textOpt = items.find((it) => it.label.startsWith('Texto Rápido:'));
      assert.ok(shakeOpt && partOpt && textOpt);

      shakeOpt.action(); // ON -> OFF
      partOpt.action();  // High -> Low
      textOpt.action();  // OFF -> ON

      const saved = JSON.parse(storeMap.get('el_ojete_options'));
      assert.equal(saved.screenShake, false);
      assert.equal(saved.particleQuality, 'low');
      assert.equal(saved.fastText, true);

      // Cámara no tiembla si Screen Shake está OFF
      cam.shake(5, 0.3);
      assert.equal(cam.shakeDuration, 0, 'Con Screen Shake OFF no debe activarse shake()');

      // Partículas desactivadas en Low
      assert.equal(pfx.particleQuality, 'low');
      assert.equal(pfx.particlesEnabled, false);
      assert.equal(pfx.particleContainer.visible, false);

      // Texto rápido duplica la velocidad base (40 -> 80)
      assert.equal(dialogueBox.baseCharSpeed, 80);

      // Pantalla de Estadísticas Finales (Glassmorphism) muestra métricas y resumen
      menu.openFinalStatsScreen({
        defeatedEnemies: 18,
        jailVisits: 2,
        sheepAttacks: 4,
        demonDeaths: 1,
        playTimeFormatted: '07:45'
      });
      const renderedTexts = [];
      const mockCtx = {
        save() {}, restore() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {}, fillRect() {},
        createLinearGradient() { return { addColorStop() {} }; },
        fillText(t) { renderedTexts.push(String(t)); },
        measureText(t) { return { width: String(t).length * 4 }; }
      };
      menu.render(mockCtx);
      const joinedSummary = renderedTexts.join(' ');
      assert.ok(joinedSummary.includes('18'), 'Debe renderizar enemigos derrotados');
      assert.ok(joinedSummary.includes('Has ido a la cárcel 2 veces'), 'Debe incluir resumen de cárcel');
      assert.ok(joinedSummary.includes('te mató 1 vez'), 'Debe incluir resumen del Señor de las Ovejas');
      assert.ok(joinedSummary.includes('07:45'), 'Debe mostrar el tiempo de juego');

      // Nueva Partida +: requiere trofeo de victoria, conserva habilidades base y escala enemigos x1.5
      assert.equal(menu._hasVictoryTrophy(), false);
      storeMap.set('el_ojete_dorado_victory_trophy', 'true');
      assert.equal(menu._hasVictoryTrophy(), true);
      menu.state = 'title';
      const titleItems = menu._getCurrentMenuItems();
      assert.ok(titleItems.some((it) => it.label === 'Nueva Partida +'), 'Con trofeo debe aparecer Nueva Partida +');

      const p = new Player({ x: 64, y: 64 });
      p.hasDash = true;
      p.hasChargedAttack = true;
      p.skills.vigor = true;
      p.skills.ejecutivo = true; // habilidad de expansión NO debe filtrarse a base NG+
      const enemyA = new Enemy({ id: 'ng_slime', x: 96, y: 64, hp: 4, maxHp: 4 });
      const bossB = new StackOverflowBoss({ x: 128, y: 64 });
      const ngGame = {
        player: p,
        enemies: [enemyA, bossB],
        isNewGamePlus: false,
        totalJailVisits: 0,
        music: fakeMusic,
        camera: cam,
        menuSystem: menu,
        _resetWorldToInitialState: () => {
          p.unequipAllForNewGame();
          enemyA.reset();
        },
        _saveGameToStorage: () => {},
        _applyNewGamePlusMultipliers(list) {
          return RPGGame.prototype._applyNewGamePlusMultipliers.call(this, list);
        }
      };

      RPGGame.prototype._startNewGamePlus.call(ngGame);
      assert.equal(ngGame.isNewGamePlus, true);
      assert.equal(p.hasDash, true, 'NG+ conserva Dash');
      assert.equal(p.hasChargedAttack, true, 'NG+ conserva Ataque Cargado');
      assert.equal(p.skills.vigor, true, 'NG+ conserva skills base desbloqueadas');
      assert.equal(p.skills.ejecutivo, false, 'NG+ en base NO debe filtrar skills de expansión');
      assert.equal(enemyA.maxHp, 6, 'NG+ escala maxHp x1.5 (4 -> 6)');
      assert.equal(enemyA.hp, 6);
      assert.equal(enemyA.ngPlusDamageScale, 1.5, 'NG+ aplica multiplicador de daño x1.5');

      // También preserva escala x1.5 en reset() de enemigos
      enemyA.reset();
      assert.equal(enemyA.hp, 6, 'enemy.reset() en NG+ mantiene la vida x1.5');
    } finally {
      if (typeof previousStorage === 'undefined') delete globalThis.localStorage;
      else globalThis.localStorage = previousStorage;
    }
  });

  test('Blindaje estanco de expansión: bloqueo de menú/entrada, muro interdimensional y slot de guardado aislado', async () => {
    const previousStorage = globalThis.localStorage;
    const storeMap = new Map();
    globalThis.localStorage = {
      getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
      setItem: (k, v) => storeMap.set(k, String(v)),
      removeItem: (k) => storeMap.delete(k)
    };

    try {
      const tm = new Tilemap(null, 16);
      await tm.loadExpansionScenes();
      const player = new Player({ x: 12 * 16, y: 15 * 16 });
      const notices = [];
      let baseNewGameCalls = 0;
      let expansionStartCalls = 0;
      const fakeMenu = {
        state: 'title',
        fadeAlpha: 0,
        noticeText: '',
        showNotice(txt) {
          this.noticeText = txt;
          notices.push(txt);
        }
      };

      const fakeGame = {
        tilemap: tm,
        player,
        enemies: [],
        npcs: [],
        floatingTexts: [],
        transitionCooldown: 0,
        isExpansionActive: false,
        isExpansionMode: false,
        gameState: 'playing',
        gameOver: false,
        curriculum: 0,
        francoRescued: false,
        tonyForgiven: false,
        expansionEndingChosen: null,
        menuSystem: fakeMenu,
        music: {
          playMenuSelect() {},
          playCaughtSkipSound() {},
          playDoorOpenSound() {},
          stopTitleMusic() {},
          stopBossMusic() {},
          loadExpansionMusic() {},
          setMode() {}
        },
        camera: {
          setWorldBounds() {},
          resetCinematic() {},
          snapTo() {}
        },
        _resolveStageSpawn(door) {
          return { x: door.targetX ?? 160, y: door.targetY ?? 120, facing: door.forceDirection || 'up' };
        },
        _resetWorldToInitialState() {
          this.isExpansionActive = false;
          this.isExpansionMode = false;
          this.gameState = 'playing';
          tm.loadScene('overworld');
        },
        _restoreAllNPCsToOverworld() {},
        _syncFrancoNPCState() {},
        _readExpansionStorage: () => RPGGame.prototype._readExpansionStorage.call(fakeGame),
        _applySavedRosaUpgrades() {},
        _restoreExpansionSaveData: (d) => RPGGame.prototype._restoreExpansionSaveData.call(fakeGame, d),
        _saveExpansionProgress: () => RPGGame.prototype._saveExpansionProgress.call(fakeGame),
        _loadExpansionFromSlot: () => RPGGame.prototype._loadExpansionFromSlot.call(fakeGame),
        _saveGameToStorage: (opts) => RPGGame.prototype._saveGameToStorage.call(fakeGame, opts),
        _loadGameFromStorage: () => RPGGame.prototype._loadGameFromStorage.call(fakeGame),
        startExpansion: () => RPGGame.prototype.startExpansion.call(fakeGame)
      };

      const menu = new MainMenuAndScenes(320, 180, {}, fakeGame.music, {
        game: fakeGame,
        onNewGame: () => { baseNewGameCalls += 1; },
        onLoadGame: () => fakeGame._loadGameFromStorage(),
        onStartExpansion: () => {
          expansionStartCalls += 1;
          return fakeGame.startExpansion();
        }
      });
      fakeGame.menuSystem = menu;

      // 1. Sin trofeo de victoria: menú bloqueado, startExpansion() bloqueado, ExpansionManager.init() bloqueado
      assert.equal(menu._hasVictoryTrophy(), false);
      const lockedEntry = menu._getCurrentMenuItems()[2];
      assert.equal(lockedEntry.locked, true, 'La expansión debe mostrarse con candado sin el trofeo');
      lockedEntry.action();
      assert.equal(expansionStartCalls, 0, 'Pulsar expansión bloqueada no debe arrancar');
      assert.match(menu.noticeText, /Completa el juego base/, 'Debe indicar completar el juego base');
      assert.equal(RPGGame.prototype.startExpansion.call(fakeGame), false, 'startExpansion() debe abortar sin trofeo');
      assert.equal(fakeGame.isExpansionActive, false);

      const blockedMgr = new ExpansionManager();
      assert.equal(await blockedMgr.init(fakeGame), null, 'ExpansionManager.init() debe bloquearse sin trofeo');
      assert.equal(blockedMgr.initialized, false);

      // Valor distinto de 'true' tampoco desbloquea
      storeMap.set('el_ojete_dorado_victory_trophy', 'false');
      assert.equal(menu._hasVictoryTrophy(), false);
      assert.equal(RPGGame.prototype.startExpansion.call(fakeGame), false);

      // 2. Con trofeo === 'true', arranca la expansión en valleverde_corp
      storeMap.set('el_ojete_dorado_victory_trophy', 'true');
      assert.equal(menu._hasVictoryTrophy(), true);
      const unlockedEntry = menu._getCurrentMenuItems()[2];
      assert.equal(unlockedEntry.locked, false);
      unlockedEntry.action();
      assert.equal(expansionStartCalls, 1);
      assert.equal(fakeGame.isExpansionActive, true);
      assert.equal(tm.currentSceneId, 'valleverde_corp');

      // 3. Muro interdimensional: intentar cruzar puertas hacia escenas del juego base bloquea y avisa
      const transitions = new SceneTransitionController(fakeGame);
      const initialY = player.y;
      const blockedOverworld = transitions.executeStageTransition({
        type: 'exit',
        targetScene: 'overworld',
        targetX: 160,
        targetY: 160
      });
      assert.equal(blockedOverworld, false, 'En expansión NO se puede cruzar a overworld');
      assert.equal(tm.currentSceneId, 'valleverde_corp', 'El jugador debe seguir en valleverde_corp');
      assert.equal(menu.noticeText, 'Alex ha bloqueado la línea temporal.');
      assert.ok(fakeGame.floatingTexts.some((ft) => ft.text === 'Alex ha bloqueado la línea temporal.'));
      assert.ok(player.y !== initialY, 'Debe empujar suavemente al jugador hacia atrás');

      assert.equal(transitions.executeStageTransition({ type: 'door', targetScene: 'first_stage' }), false);
      assert.equal(transitions.executeStageTransition({ type: 'door', targetScene: 'armor_temple' }), false);
      assert.equal(tm.currentSceneId, 'valleverde_corp');

      // Puertas entre escenas de la expansión sí están permitidas
      const allowedRosaBar = transitions.executeStageTransition({
        type: 'door',
        targetScene: 'rosa_bar',
        targetX: 160,
        targetY: 120,
        forceDirection: 'up'
      });
      assert.equal(allowedRosaBar, true);
      assert.equal(tm.currentSceneId, 'rosa_bar');

      // 4. Aislamiento total de guardado/carga y Game Over en expansión
      const baseSentinel = JSON.stringify({
        savePayload: { player: { coins: 999 }, timeOfDayHours: 12 },
        savedAt: 100
      });
      storeMap.set('el_ojete_dorado_save_v1', baseSentinel);
      fakeGame.curriculum = 11;
      player.coins = 42;
      player.hp = 2;
      assert.equal(fakeGame._saveGameToStorage(), true);
      assert.equal(storeMap.get('el_ojete_dorado_save_v1'), baseSentinel, 'Guardar en expansión NO debe pisar el save del juego base');

      // Simular muerte y recarga desde Game Over -> carga slot de expansión, nunca base ni Nueva Partida
      fakeGame.gameOver = true;
      fakeGame.curriculum = 0;
      player.coins = 0;
      player.hp = 0;
      tm.loadScene('valleverde_corp');
      menu.state = 'game_over';
      const retryItem = menu._getCurrentMenuItems()[0];
      retryItem.action();
      assert.equal(baseNewGameCalls, 0, 'Game Over en expansión jamás debe reiniciar el juego base');
      assert.equal(fakeGame.isExpansionActive, true);
      assert.equal(tm.currentSceneId, 'rosa_bar', 'Debe restaurar la escena guardada en el slot de expansión');
      assert.equal(fakeGame.curriculum, 11, 'Debe restaurar el progreso del slot de expansión');
      assert.equal(player.coins, 42, 'Debe restaurar monedas de la expansión (no 999 del juego base)');
      assert.equal(player.hp, 2, 'Debe restaurar vida de la expansión');
    } finally {
      if (typeof previousStorage === 'undefined') delete globalThis.localStorage;
      else globalThis.localStorage = previousStorage;
    }
  });

  test('PremiumEffectsManager.spawnParticles y _loadScene: 50 hojas verdes (#4ade80), 50 chispas naranjas (#f97316) y limpieza al cambiar de escena', async () => {
    const prevDoc = globalThis.document;
    const prevWin = globalThis.window;

    let destroyedGraphics = 0;
    const drawnShapes = [];
    const overlayCanvas = {
      width: 1280,
      height: 720,
      style: {},
      attributes: {},
      parentNode: null,
      setAttribute(k, v) {
        this.attributes[k] = v;
      }
    };
    const gameCanvas = {
      width: 1280,
      height: 720,
      clientWidth: 1280,
      clientHeight: 720,
      offsetLeft: 0,
      offsetTop: 0,
      clientLeft: 0,
      clientTop: 0,
      style: {},
      parentNode: {
        children: [],
        insertBefore(node) {
          if (!this.children.includes(node)) this.children.push(node);
          node.parentNode = this;
        },
        removeChild(node) {
          this.children = this.children.filter((c) => c !== node);
          node.parentNode = null;
        }
      }
    };
    gameCanvas.parentNode.children.push(gameCanvas);

    class MockContainer {
      constructor() {
        this.children = [];
        this.visible = true;
      }
      addChild(c) {
        this.children.push(c);
        return c;
      }
      removeChildren() {
        this.children.length = 0;
      }
    }

    class MockGraphics {
      constructor() {
        this.x = 0;
        this.y = 0;
        this.rotation = 0;
        this.alpha = 1;
        this.scale = { set: (v) => { this.scaleVal = v; } };
        this.rects = [];
        this.fillColor = null;
      }
      rect(x, y, w, h) {
        this.rects.push({ x, y, w, h });
        return this;
      }
      fill(color) {
        this.fillColor = color;
        drawnShapes.push({ rects: this.rects, fillColor: color });
        return this;
      }
      destroy() {
        destroyedGraphics += 1;
      }
    }

    const mockPixi = {
      Application: class {
        constructor() {
          this.stage = new MockContainer();
          this.ticker = { stop() {} };
          this.view = overlayCanvas;
        }
        async init(opts) {
          this.initOpts = opts;
        }
        render() {}
        destroy() {}
      },
      Container: MockContainer,
      Graphics: MockGraphics
    };

    try {
      globalThis.document = {
        body: gameCanvas.parentNode,
        createElement: () => ({ width: 0, height: 0, getContext: () => null })
      };
      globalThis.window = { addEventListener() {}, removeEventListener() {} };

      const pfx = new PremiumEffectsManager(gameCanvas, {
        pixi: mockPixi,
        width: 1280,
        height: 720,
        useRaf: false
      });
      await pfx.init();
      assert.equal(pfx.pixiApp.initOpts.width, 1280);
      assert.equal(pfx.pixiApp.initOpts.height, 720);
      assert.equal(pfx.pixiApp.initOpts.backgroundAlpha, 0);
      assert.equal(overlayCanvas.style.pointerEvents, 'none');
      assert.equal(overlayCanvas.style.zIndex, '10');

      // 1. Valleverde (overworld / first_stage): 50 hojas verdes #4ade80 (4x4 px) cayendo hacia abajo
      const leafCount = pfx.spawnParticles('overworld');
      assert.equal(leafCount, 50, 'Valleverde debe generar exactamente 50 partículas de hojas verdes');
      assert.equal(pfx.particles.length, 50);
      assert.ok(pfx.particles.every((p) => p.type === 'leaf' && p.vy > 0 && p.obj.fillColor === 0x4ade80));
      assert.ok(pfx.particles.every((p) => p.obj.rects[0].w === 4 && p.obj.rects[0].h === 4));

      // Al avanzar un frame, las hojas bajan y oscilan
      const sampleY0 = pfx.particles[0].y;
      pfx.particles[0].y = 100;
      pfx.particles[0].life = 2.0;
      pfx.update(0.05, { sceneId: 'overworld' });
      assert.ok(pfx.particles[0].y > 100, 'Las hojas verdes deben caer hacia abajo');

      // 2. Cambiar a Forja via _loadScene -> destruye las 50 hojas anteriores y crea 50 chispas naranjas #f97316
      const tm = new Tilemap(null, 16);
      const fakeGame = {
        tilemap: tm,
        premiumEffects: pfx,
        player: { stopMovement() {} },
        fadeAlpha: 0,
        sceneFade: null
      };
      RPGGame.prototype._loadScene.call(fakeGame, 'forge_entry', null, { immediate: true });
      assert.equal(tm.currentSceneId, 'forge_entry');
      assert.equal(destroyedGraphics, 50, 'Cambiar de escena debe destruir las 50 partículas anteriores de PixiJS');
      assert.equal(pfx.particles.length, 50, 'La Forja debe generar 50 chispas naranjas');
      assert.ok(pfx.particles.every((p) => p.type === 'spark' && p.vy < 0 && p.obj.fillColor === 0xf97316));

      // Al avanzar un frame, las chispas suben desde abajo
      pfx.particles[0].y = 600;
      pfx.update(0.05, { sceneId: 'forge_entry' });
      assert.ok(pfx.particles[0].y < 600, 'Las chispas naranjas de la Forja deben subir');

      pfx.destroy();
      assert.equal(sampleY0 >= -8, true);
    } finally {
      globalThis.document = prevDoc;
      globalThis.window = prevWin;
    }
  });

  test('Edificios 2.5D, props exteriores, antorchas de mazmorra, ventanas nocturnas con Bloom, sombras y humo PixiJS en chimeneas', async () => {
    const prevDoc = globalThis.document;
    const prevWin = globalThis.window;

    try {
      // 1. Variantes de tejados, ventanas y props en Valleverde sin bloquear paso
      const tm = new Tilemap(null, 16);
      tm.loadScene('overworld');
      const deco = tm.layers.decoration;
      const flatDeco = deco.flat();
      assert.ok(flatDeco.includes(TILES.ROOF_RED), 'Valleverde debe tener tejados rojos');
      assert.ok(flatDeco.includes(TILES.ROOF_BLUE), 'Valleverde debe tener tejados azules');
      assert.ok(flatDeco.includes(TILES.ROOF_GREEN), 'Valleverde debe tener tejados verdes (3ª variante)');
      assert.ok(flatDeco.includes(TILES.WALL_WINDOW), 'Valleverde debe tener ventanas estándar');
      assert.ok(flatDeco.includes(TILES.WALL_WINDOW_FLOWER), 'Valleverde debe tener ventanas con maceta (2ª variante)');
      assert.ok(flatDeco.includes(TILES.BARREL), 'Debe haber barriles exteriores');
      assert.ok(flatDeco.includes(TILES.FLOWER_POT), 'Debe haber macetas en puertas');
      assert.ok(flatDeco.includes(TILES.SANDBAG), 'Debe haber sacos de arena junto a tiendas/cuartel');
      assert.ok(Array.isArray(tm.clotheslines) && tm.clotheslines.length >= 2, 'Debe haber ropa tendida entre casas');
      assert.ok(Array.isArray(tm.chimneys) && tm.chimneys.length >= 4, 'Valleverde debe registrar chimeneas');
      assert.ok(tm.windowLights.length >= 6, 'windowLights debe incluir ventanas estándar y con maceta');

      // Verificar que barriles, macetas y sacos de arena no bloquean al jugador
      for (let r = 0; r < tm.rows; r++) {
        for (let c = 0; c < tm.cols; c++) {
          const id = deco[r][c];
          if (id === TILES.BARREL || id === TILES.FLOWER_POT || id === TILES.SANDBAG) {
            assert.equal(tm.isSolidAtTile(c, r), false, `El prop exterior (${c},${r}) no debe bloquear al jugador`);
          }
        }
      }

      // Verificar datos de tejado en houseShadows (sombra más ancha en edificios con alero)
      assert.ok(tm.houseShadows.some((sh) => sh.hasRoof === true && sh.roofRows >= 1));

      // 2. Mazmorras: antorchas parpadeantes en paredes + estalactitas en techo
      for (const dungeonId of ['sewers_entry', 'mines_entry', 'forge_entry']) {
        tm.loadScene(dungeonId);
        assert.ok(tm.caveProps.some((p) => p.tileId === TILES.STALACTITE), `${dungeonId} debe tener estalactitas`);
        assert.ok(tm.caveProps.some((p) => p.tileId === TILES.WALL_TORCH), `${dungeonId} debe tener antorchas de pared`);
        assert.ok(tm.lightSources.some((l) => l.kind === 'torch'), `${dungeonId} debe tener luces dinámicas para antorchas`);
      }

      // 3. RenderPipeline: sombras proyectadas más anchas que el edificio con sol al oeste + luz en ventanas de noche
      tm.loadScene('overworld');
      const pipeline = new RenderPipeline(320, 180);
      const cam = new Camera2D(320, 180);
      cam.x = 0;
      cam.y = 0;
      const recordedPolys = [];
      const recordedGrads = [];
      const mockCtx = {
        canvas: { width: 320, height: 180 },
        fillStyle: '',
        strokeStyle: '',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        save() {},
        restore() {},
        beginPath() { this._pts = []; },
        moveTo(x, y) { this._pts.push({ x, y }); },
        lineTo(x, y) { this._pts.push({ x, y }); },
        closePath() { recordedPolys.push([...this._pts]); },
        fill() {},
        stroke() {},
        arc() {},
        fillRect() {},
        createRadialGradient() {
          const g = { addColorStop() {} };
          recordedGrads.push(g);
          return g;
        }
      };

      const roofShadowSample = tm.houseShadows.find((sh) => sh.hasRoof);
      pipeline._renderBuildingShadows(mockCtx, cam, { dx: 0.5, dy: 0.18, length: 1.5, alphaScale: 1 }, { houseShadows: [roofShadowSample] });
      assert.ok(recordedPolys.length >= 1, 'Debe proyectar polígono de sombra de edificio');
      const shadowSpan = Math.max(...recordedPolys[0].map((p) => p.x)) - Math.min(...recordedPolys[0].map((p) => p.x));
      assert.ok(shadowSpan > roofShadowSample.w, 'La sombra de casa con tejado debe ser más ancha que la fachada');

      const dn = new DayNightCycle(320, 180, 720);
      dn.timeOfDayHours = 22.5; // Noche
      assert.equal(dn.isNight(), true);
      pipeline._renderNightWindowGlows(mockCtx, cam, dn, tm);
      assert.ok(recordedGrads.length > 0, 'De noche debe dibujar halos cálidos en las ventanas antes del Bloom');

      // 4. PremiumEffectsManager: humo gris/blanco de chimeneas con PixiJS de día y de noche
      const createdSmokePuffs = [];
      class MockContainer {
        constructor() { this.children = []; this.visible = true; }
        addChild(c) { this.children.push(c); return c; }
        removeChild(c) { this.children = this.children.filter((x) => x !== c); }
        removeChildren() { this.children.length = 0; }
      }
      class MockGraphics {
        constructor() {
          this.x = 0; this.y = 0; this.alpha = 1; this.rotation = 0;
          this.scale = { set: (v) => { this.scaleVal = v; } };
          this.colors = [];
        }
        rect() { return this; }
        fill(c) { this.colors.push(c); createdSmokePuffs.push(c); return this; }
        destroy() {}
      }
      const overlayCanvas = { width: 1280, height: 720, style: {}, setAttribute() {} };
      const parentNode = { children: [], insertBefore() {}, removeChild() {} };
      const gameCanvas = { width: 1280, height: 720, clientWidth: 1280, clientHeight: 720, offsetLeft: 0, offsetTop: 0, clientLeft: 0, clientTop: 0, style: {}, parentNode };
      const mockPixi = {
        Application: class {
          constructor() { this.stage = new MockContainer(); this.ticker = { stop() {} }; this.view = overlayCanvas; }
          async init() {}
          render() {}
          destroy() {}
        },
        Container: MockContainer,
        Graphics: MockGraphics
      };
      globalThis.document = { body: parentNode, createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
      globalThis.window = { addEventListener() {}, removeEventListener() {} };

      const pfx = new PremiumEffectsManager(gameCanvas, { pixi: mockPixi, width: 1280, height: 720, useRaf: false });
      await pfx.init();
      pfx.spawnParticles('overworld', tm.chimneys);
      pfx.update(0.3, { sceneId: 'overworld', tilemap: tm, camera: cam, chimneys: tm.chimneys });
      assert.ok(pfx.chimneySmoke.length > 0, 'Debe emitir humo PixiJS desde las chimeneas de las casas');
      assert.ok(createdSmokePuffs.some((c) => c === 0xe2e8f0 || c === 0xcbd5e1), 'El humo debe usar tonos blanco/gris');
      const prevSmokeY = pfx.chimneySmoke[0].y;
      pfx.update(0.2, { sceneId: 'overworld', tilemap: tm, camera: cam, chimneys: tm.chimneys });
      assert.ok(pfx.chimneySmoke[0].y < prevSmokeY, 'El humo de chimenea debe ascender lentamente');
      pfx.destroy();
    } finally {
      globalThis.document = prevDoc;
      globalThis.window = prevWin;
    }
  });

  test('Biomas Visuales (EnvironmentData): partículas por bioma, props Y-sorted sin colisión, filtros de color y luces/bloom', async () => {
    // 1. Verificar EnvironmentData para los 8 biomas visuales principales
    assert.equal(getEnvironmentTheme('overworld').id, 'pueblo');
    assert.equal(getEnvironmentTheme('first_stage').id, 'bosque');
    assert.equal(getEnvironmentTheme('sewers_entry').id, 'cloacas');
    assert.equal(getEnvironmentTheme('mines_entry').id, 'minas');
    assert.equal(getEnvironmentTheme('forge_entry').id, 'forja');
    assert.equal(getEnvironmentTheme('armor_temple').id, 'templos');
    assert.equal(getEnvironmentTheme('valleverde_corp').id, 'corporativo');
    assert.equal(getEnvironmentTheme('inakito_office').id, 'corporativo');
    assert.equal(getEnvironmentTheme('kernel_arena').id, 'nucleo');
    assert.ok(ENVIRONMENT_THEMES.corporativo.bloomAlpha > ENVIRONMENT_THEMES.pueblo.bloomAlpha, 'Corporativo debe potenciar el bloom');

    // 2. Verificar props decorativos por bioma en Tilemap (Y-sorted y completamente atravesables)
    const tm = new Tilemap(null, 16);
    installExpansionScenes(tm);
    const cam = { renderX: 0, renderY: 0, viewportWidth: 320, viewportHeight: 180 };
    const scenePropExpectations = [
      ['sewers_entry', ['broken_pipe', 'moss', 'slime_puddle']],
      ['mines_entry', ['broken_rail', 'pickaxe', 'loose_rock']],
      ['forge_entry', ['mini_anvil', 'chain', 'ingot']],
      ['armor_temple', ['knight_statue', 'candle', 'carpet']],
      ['inakito_office', ['cubicle', 'chair', 'coffee_maker', 'papers']]
    ];

    for (const [sceneId, expectedKinds] of scenePropExpectations) {
      tm.loadScene(sceneId);
      assert.ok(Array.isArray(tm.biomeProps) && tm.biomeProps.length > 0, `${sceneId} debe generar biomeProps`);
      const foundKinds = new Set(tm.biomeProps.map((p) => p.kind));
      for (const kind of expectedKinds) {
        assert.ok(foundKinds.has(kind), `${sceneId} debe incluir prop decorativo '${kind}'`);
      }
      for (const p of tm.biomeProps) {
        const col = Math.floor(p.x / tm.tileSize);
        const row = Math.floor(p.y / tm.tileSize);
        assert.equal(tm.isSolidAtTile(col, row), false, `El prop '${p.kind}' de ${sceneId} nunca debe bloquear al jugador`);
      }
      const ySorted = [];
      tm.collectYSortedProps(cam, ySorted);
      assert.ok(ySorted.some((entry) => entry.biomeProp), `${sceneId} debe inyectar biomeProps en collectYSortedProps`);
    }

    // Templos: antorchas parpadeantes registradas en lightSources
    tm.loadScene('armor_temple');
    assert.ok(tm.lightSources.some((l) => l.kind === 'torch' && l.flicker), 'Los templos deben tener antorchas con parpadeo');

    // 3. RenderPipeline: filtro de tinte por bioma, luces de templo y Bloom corporativo
    const pipeline = new RenderPipeline(320, 180);
    const fillColors = [];
    const alphas = [];
    const arcCalls = [];
    const mockCtx = {
      canvas: { width: 320, height: 180 },
      save() {},
      restore() {},
      setTransform() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      arc(...args) { arcCalls.push(args); },
      fill() {},
      fillRect() { fillColors.push(this.fillStyle); },
      drawImage() { alphas.push(this.globalAlpha); },
      createLinearGradient() { return { addColorStop() {} }; },
      createRadialGradient() { return { addColorStop() {} }; },
      fillStyle: '#000',
      globalCompositeOperation: 'source-over',
      globalAlpha: 1
    };

    tm.loadScene('sewers_entry');
    pipeline._renderBiomeAtmosphere(mockCtx, tm);
    assert.ok(fillColors.some((c) => c === ENVIRONMENT_THEMES.cloacas.tintColor), 'Cloacas debe aplicar tinte verdoso');

    tm.loadScene('mines_entry');
    pipeline._renderBiomeAtmosphere(mockCtx, tm);
    assert.ok(fillColors.some((c) => c === ENVIRONMENT_THEMES.minas.tintColor), 'Minas debe aplicar tinte azulado');

    tm.loadScene('armor_temple');
    pipeline.clock = 1.25;
    pipeline._renderNightWindowGlows(mockCtx, cam, { isNight: () => false, areWindowsLit: () => false }, tm);
    assert.ok(arcCalls.length > 0, 'Los halos de antorchas de los templos deben dibujarse en _renderNightWindowGlows');

    pipeline._bloomCanvas = { width: 160, height: 90 };
    pipeline._bloomCtx = { setTransform() {}, clearRect() {}, save() {}, restore() {}, drawImage() {}, filter: '' };
    tm.loadScene('valleverde_corp');
    alphas.length = 0;
    pipeline._renderBloom(mockCtx, tm);
    assert.equal(alphas[0], ENVIRONMENT_THEMES.corporativo.bloomAlpha, 'Corporativo debe usar mayor intensidad de Bloom');

    // 4. PremiumEffectsManager: partículas diferenciadas en Cloacas, Corporativo ('0'/'1') y Núcleo (glitch)
    const prevDoc = globalThis.document;
    const prevWin = globalThis.window;
    try {
      class MockContainer {
        constructor() { this.children = []; this.visible = true; }
        addChild(c) { this.children.push(c); return c; }
        removeChildren() { const out = this.children; this.children = []; return out; }
        destroy() { this.children = []; }
      }
      class MockGraphics {
        constructor() { this.x = 0; this.y = 0; this.alpha = 1; this.rotation = 0; this.scale = { set() {} }; }
        rect() { return this; }
        fill(c) { this.fillColor = c; return this; }
        destroy() {}
      }
      const createdTexts = [];
      class MockText {
        constructor(opts) { this.text = opts.text; this.x = 0; this.y = 0; this.alpha = 1; this.scale = { set() {} }; createdTexts.push(opts.text); }
        destroy() {}
      }
      globalThis.document = { body: { children: [], insertBefore() {}, removeChild() {} }, createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
      globalThis.window = { addEventListener() {}, removeEventListener() {} };
      const mockPixi = {
        Application: class {
          constructor() { this.stage = new MockContainer(); this.ticker = { stop() {} }; this.view = { width: 1280, height: 720, style: {}, setAttribute() {} }; }
          async init() {}
          render() {}
          destroy() {}
        },
        Container: MockContainer,
        Graphics: MockGraphics,
        Text: MockText
      };
      const gameCanvas = { width: 1280, height: 720, style: {}, parentNode: { insertBefore() {}, removeChild() {} } };
      const pfx = new PremiumEffectsManager(gameCanvas, { pixi: mockPixi, width: 1280, height: 720, useRaf: false });
      await pfx.init();

      pfx.spawnParticles('sewers_entry');
      assert.ok(pfx.particles.some((p) => p.type === 'drip' && p.obj.fillColor === 0x38bdf8), 'Cloacas debe tener gotas azules cayendo');
      assert.ok(pfx.particles.some((p) => p.type === 'fly' && p.obj.fillColor === 0x0f172a), 'Cloacas debe tener moscas negras');

      pfx.spawnParticles('valleverde_corp');
      assert.ok(createdTexts.includes('0') && createdTexts.includes('1'), 'Corporativo debe renderizar código binario 0 y 1');

      pfx.spawnParticles('kernel_arena');
      assert.ok(pfx.particles.some((p) => p.type === 'glitch' && (p.obj.fillColor === 0xef4444 || p.obj.fillColor === 0x0f172a)), 'Núcleo debe emitir glitches rojos/negros');

      pfx.destroy();
    } finally {
      globalThis.document = prevDoc;
      globalThis.window = prevWin;
    }
  });

  test('Easter Eggs: Fake Changelog (Notas del Parche v2.0) scrollable y Código Konami (Modo Desarrollador + Modo Dios)', () => {
    const playedSfx = [];
    const fakeMusic = {
      setMode() {},
      playMenuSelect() {},
      playMenuMove() {},
      playCaughtSkipSound() {},
      stopTitleMusic() {},
      playSFX(name) { playedSfx.push(name); return true; }
    };

    const tm = new Tilemap(null, 16);
    const fakeGame = {
      isDevMode: false,
      debugMode: false,
      music: fakeMusic,
      tilemap: tm,
      player: { x: 0, y: 0, stopMovement() {} },
      camera: { resetCinematic() {}, snapTo() {} },
      fadeAlpha: 0,
      sceneFade: null,
      _resetWorldToInitialState() { tm.loadScene('overworld'); },
      _loadScene(sceneId, pos) {
        tm.loadScene(sceneId);
        if (pos) {
          this.player.x = pos.x;
          this.player.y = pos.y;
        }
      },
      _startGodModeDebug: RPGGame.prototype._startGodModeDebug
    };

    const menu = new MainMenuAndScenes(320, 180, {}, fakeMusic, {
      game: fakeGame,
      onStartGodMode: () => fakeGame._startGodModeDebug()
    });
    fakeGame.menuSystem = menu;

    // 1. Fake Changelog en Opciones
    menu.openOptionsScreen('title');
    const optItems = menu._getCurrentMenuItems();
    const patchBtn = optItems.find((it) => it.label === 'Notas del Parche v2.0');
    assert.ok(patchBtn, 'El menú de Opciones debe incluir el botón "Notas del Parche v2.0"');
    patchBtn.action();
    assert.equal(menu.state, 'changelog');
    assert.equal(FAKE_CHANGELOG_NOTES.length, 4);
    assert.ok(FAKE_CHANGELOG_NOTES[0].startsWith('v2.0.1: Se ha arreglado el bug por el que las ovejas mataban al jugador.'));
    assert.ok(FAKE_CHANGELOG_NOTES[1].startsWith('v2.0.2: El Carcelero ha recibido formación de Recursos Humanos'));
    assert.ok(FAKE_CHANGELOG_NOTES[2].startsWith('v2.0.3: Se ha optimizado el código.'));
    assert.ok(FAKE_CHANGELOG_NOTES[3].startsWith('v2.0.4: Los enemigos ya no se quedan atascados en las paredes.'));

    // Renderizar y hacer scroll con flechas y rueda del ratón
    const drawnTexts = [];
    const mockCtx = {
      save() {},
      restore() {},
      fillRect() {},
      strokeRect() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      arcTo() {},
      rect() {},
      clip() {},
      fill() {},
      stroke() {},
      createLinearGradient() { return { addColorStop() {} }; },
      createRadialGradient() { return { addColorStop() {} }; },
      measureText(txt) { return { width: String(txt).length * 3.4 }; },
      fillText(txt) { drawnTexts.push(String(txt)); }
    };
    menu.render(mockCtx);
    assert.ok(drawnTexts.some((t) => t.includes('NOTAS DEL PARCHE v2.0')), 'Debe renderizar la cabecera de Notas del Parche');
    assert.ok(drawnTexts.some((t) => t.includes('v2.0.1:')), 'Debe renderizar el contenido de las notas de Alex IA');

    const input = new InputHandler(null, null, fakeGame);
    input._onKeyDown({ code: 'ArrowDown', key: 'ArrowDown', preventDefault() {} });
    menu.update(0.016, input);
    assert.ok(menu.changelogScroll > 0, 'Pulsar flecha abajo debe desplazar las Notas del Parche');

    const prevScroll = menu.changelogScroll;
    input._onWheel({ deltaY: 100 });
    menu.update(0.016, input);
    assert.ok(menu.changelogScroll >= prevScroll, 'La rueda del ratón debe desplazar las Notas del Parche');

    input._onKeyDown({ code: 'Escape', key: 'Escape', preventDefault() {} });
    menu.update(0.016, input);
    assert.equal(menu.state, 'options', 'Escape debe cerrar las Notas del Parche y volver a Opciones');

    // 2. Código Konami en Menú de Título
    menu.openTitleScreen();
    assert.equal(
      menu._getCurrentMenuItems().some((it) => it.label === 'Modo Dios (Debug)'),
      false,
      'Modo Dios (Debug) debe estar oculto antes del Código Konami'
    );

    // Fallar la secuencia reinicia el buffer
    input._onKeyDown({ code: 'ArrowUp', preventDefault() {} });
    assert.equal(input.konamiBuffer.length, 1);
    input._onKeyDown({ code: 'KeyX', preventDefault() {} });
    assert.equal(input.konamiBuffer.length, 0, 'Equivocarse en el Código Konami debe reiniciar konamiBuffer');

    // Introducir la secuencia exacta: Up, Up, Down, Down, Left, Right, Left, Right, B, A
    for (const code of KONAMI_SEQUENCE) {
      input._onKeyDown({ code, preventDefault() {} });
    }

    assert.equal(fakeGame.isDevMode, true, 'El Código Konami debe activar this.game.isDevMode = true');
    assert.equal(
      menu.noticeText,
      'MODO DESARROLLADOR ACTIVADO. Alex IA no está contento.',
      'Debe mostrar el aviso de Modo Desarrollador en pantalla'
    );
    assert.ok(playedSfx.includes('error_buzz'), 'Debe reproducir el SFX error_buzz');

    // 3. Opción secreta "Modo Dios (Debug)" en el menú de Título
    const titleItemsAfter = menu._getCurrentMenuItems();
    const godModeItem = titleItemsAfter.find((it) => it.label === 'Modo Dios (Debug)');
    assert.ok(godModeItem, 'Con isDevMode activo debe aparecer "Modo Dios (Debug)" en el menú de Título');

    godModeItem.action();
    assert.equal(fakeGame.debugMode, true, 'Pulsar "Modo Dios (Debug)" debe activar this.game.debugMode = true');
    assert.equal(tm.currentSceneId, 'sword_temple', 'Pulsar "Modo Dios (Debug)" debe iniciar la partida en el Templo de la Espada');
    assert.equal(menu.state, 'none', 'Debe cerrar el menú de título e iniciar la partida');
  });

  test('NPC Tester QA (cuarta pared) y Modo Arcade (Boss Rush)', () => {
    // 1. Verificar perfil y diálogos del NPC Tester QA en Valleverde junto a la fuente
    const qaProfile = VILLAGE_NPC_PROFILES.tester_qa;
    assert.ok(qaProfile, 'Debe existir el perfil tester_qa en VILLAGE_NPC_PROFILES');
    assert.equal(qaProfile.name, 'Tester QA', 'El NPC debe llamarse "Tester QA"');
    assert.equal(qaProfile.sceneId, 'overworld', 'Tester QA debe estar en Valleverde (overworld)');
    assert.equal(qaProfile.x, 18 * 16, 'Tester QA debe estar al lado de la fuente (x = 18 * 16)');
    assert.equal(qaProfile.y, 12 * 16, 'Tester QA debe estar al lado de la fuente (y = 12 * 16)');
    assert.equal(qaProfile.shirtColor, '#facc15', 'Tester QA debe llevar camiseta amarilla llamativa');
    assert.equal(qaProfile.shirtText, 'I ❤️ Bugs', 'La camiseta debe decir "I ❤️ Bugs"');
    assert.equal(TESTER_QA_DIALOGUES.length, 3, 'Tester QA debe tener exactamente 3 diálogos que rompen la cuarta pared');
    assert.ok(TESTER_QA_DIALOGUES[0].includes('colisiones de esta fuente') && TESTER_QA_DIALOGUES[0].includes('A y D a la vez'));
    assert.ok(TESTER_QA_DIALOGUES[1].includes('jefe final de la Forja') && TESTER_QA_DIALOGUES[1].includes('estatua con patas'));
    assert.ok(TESTER_QA_DIALOGUES[2].includes('Carcelero') && TESTER_QA_DIALOGUES[2].includes('ticket a Jira'));

    const qaNpc = new NPC({
      ...qaProfile,
      dialogues: TESTER_QA_DIALOGUES,
    });
    assert.deepEqual(qaNpc.resolveDialogues(), TESTER_QA_DIALOGUES);

    // 2. Verificar desbloqueo y cola del Modo Arcade (Boss Rush)
    assert.deepEqual(
      BOSS_RUSH_QUEUE,
      ['GarbageCollector', 'StackOverflow', 'PrototypeMicrowave', 'FinalBossAlex'],
      'La cola de Boss Rush debe contener los 4 jefes en orden'
    );

    const savedFlag = typeof localStorage !== 'undefined' ? localStorage.getItem('el_ojete_expansion_boss_killed') : null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('el_ojete_expansion_boss_killed');
    }

    let bossRushStarted = false;
    const fakeMusic = {
      setMode() {},
      playMenuSelect() {},
      playMenuMove() {},
      playCaughtSkipSound() {},
      stopTitleMusic() {},
      playSFX() { return true; }
    };
    const fakeGame = {
      expansionActive: false,
      expansionBossDefeated: false,
      enemies: [],
      inventory: new Set(),
      music: fakeMusic,
    };

    const menu = new MainMenuAndScenes(320, 180, {}, fakeMusic, {
      game: fakeGame,
      onStartBossRush: () => {
        bossRushStarted = true;
      },
    });
    menu.openTitleScreen();

    const itemsLocked = menu._getCurrentMenuItems();
    assert.ok(
      !itemsLocked.some((it) => it.label === 'Modo Arcade (Boss Rush)'),
      'Modo Arcade (Boss Rush) NO debe aparecer si no se ha derrotado al menos un jefe de la expansión'
    );

    // Desbloquear derrotando a un jefe de la expansión
    fakeGame.expansionBossDefeated = true;
    const itemsUnlocked = menu._getCurrentMenuItems();
    const bossRushItem = itemsUnlocked.find((it) => it.label === 'Modo Arcade (Boss Rush)');
    assert.ok(bossRushItem, 'Modo Arcade (Boss Rush) DEBE aparecer tras derrotar al menos un jefe de la expansión');
    bossRushItem.action();
    assert.equal(bossRushStarted, true, 'Seleccionar "Modo Arcade (Boss Rush)" debe iniciar el modo Boss Rush');

    if (typeof localStorage !== 'undefined') {
      if (savedFlag !== null) localStorage.setItem('el_ojete_expansion_boss_killed', savedFlag);
      else localStorage.removeItem('el_ojete_expansion_boss_killed');
    }
  });

  test('Arenas de jefes ampliadas (base y expansión): >=20x15 / 24x18, centro libre, 2 dashes, cámara y spawns', async () => {
    const tm = new Tilemap(null, 16);
    installExpansionScenes(tm);

    const arenaSpecs = [
      { id: 'sewers_dungeon', minCols: 20, minRows: 15, doubleWallSide: true, spawnRef: BOSS_SPAWNS.find((b) => b.sceneId === 'sewers_dungeon') },
      { id: 'mines_boss_arena', minCols: 20, minRows: 15, spawnRef: BOSS_SPAWNS.find((b) => b.sceneId === 'mines_boss_arena') },
      { id: 'ai_fortress_gate', minCols: 20, minRows: 15, doubleWallSide: true, spawnRef: BOSS_SPAWNS.find((b) => b.sceneId === 'ai_fortress_gate') },
      { id: 'ai_citadel', minCols: 24, minRows: 18, doubleWallSide: true, spawnRef: BOSS_SPAWNS.find((b) => b.sceneId === 'ai_citadel') },
      { id: 'inakito_office', minCols: 20, minRows: 15, bossCtor: IñakitoBoss },
      { id: 'kernel_arena', minCols: 20, minRows: 15, topWallRows: 2, bossCtor: KernelBoss },
      { id: 'ai_nucleus_core', minCols: 24, minRows: 18, bossCtor: AlexUpdateBoss }
    ];

    const cam = new Camera2D(320, 180, tm.width, tm.height);
    const fakeGame = {
      tilemap: tm,
      camera: cam,
      player: { stopMovement() {} }
    };

    for (const spec of arenaSpecs) {
      tm.loadScene(spec.id);
      const scene = tm.scenes[spec.id];
      assert.ok(scene, `Debe existir la arena ${spec.id}`);
      assert.ok(scene.cols >= spec.minCols, `${spec.id} debe tener al menos ${spec.minCols} cols (tiene ${scene.cols})`);
      assert.ok(scene.rows >= spec.minRows, `${spec.id} debe tener al menos ${spec.minRows} rows (tiene ${scene.rows})`);

      // 1. Bordes exteriores con colisión (salvo puertas/portales), y suelo interior totalmente transitable
      const coll = scene.layers.collision;
      const minC = spec.doubleWallSide ? 2 : 1;
      const maxC = scene.cols - 1 - (spec.doubleWallSide ? 2 : 1);
      const minR = (spec.doubleWallSide || spec.topWallRows === 2) ? 2 : 1;
      const maxR = scene.rows - 2;
      assert.equal(coll[0][2], 1, `${spec.id}: pared norte debe tener colisión`);
      assert.equal(coll[scene.rows - 1][2], 1, `${spec.id}: pared sur debe tener colisión`);
      assert.equal(coll[Math.floor(scene.rows / 2)][0], 1, `${spec.id}: pared oeste debe tener colisión`);
      assert.equal(coll[Math.floor(scene.rows / 2)][scene.cols - 1], 1, `${spec.id}: pared este debe tener colisión`);

      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          assert.equal(coll[r][c], 0, `${spec.id}: el interior (${c},${r}) debe estar 100% libre de obstáculos sólidos`);
        }
      }

      // 2. Espacio de sobra para hacer 2 dashes seguidos (~76 px) en horizontal y vertical sin chocar
      const testPlayer = new Player({ x: Math.floor(scene.cols / 2) * 16 - 8, y: Math.floor(scene.rows / 2) * 16 - 8 });
      const twoDashDistance = 210 * 0.18 * 2; // ~75.6 px
      assert.equal(
        CollisionSystem.collidesWithMap(
          testPlayer.getBoundingBoxAt(testPlayer.x - twoDashDistance, testPlayer.y),
          tm
        ),
        false,
        `${spec.id}: debe caber doble dash hacia la izquierda desde el centro`
      );
      assert.equal(
        CollisionSystem.collidesWithMap(
          testPlayer.getBoundingBoxAt(testPlayer.x + twoDashDistance, testPlayer.y),
          tm
        ),
        false,
        `${spec.id}: debe caber doble dash hacia la derecha desde el centro`
      );
      assert.equal(
        CollisionSystem.collidesWithMap(
          testPlayer.getBoundingBoxAt(testPlayer.x, testPlayer.y - twoDashDistance * 0.8),
          tm
        ),
        false,
        `${spec.id}: amplio margen de dash vertical superior desde el centro`
      );

      // 3. El jefe aparece centrado en la arena (no pegado a una esquina) y sin colisionar
      const bossPos = spec.spawnRef || new spec.bossCtor();
      assert.ok(
        bossPos.x >= scene.cols * 16 * 0.3 && bossPos.x <= scene.cols * 16 * 0.7,
        `${spec.id}: spawnX del jefe (${bossPos.x}) debe estar centrado`
      );
      assert.ok(
        bossPos.y >= scene.rows * 16 * 0.25 && bossPos.y <= scene.rows * 16 * 0.65,
        `${spec.id}: spawnY del jefe (${bossPos.y}) debe estar centrado`
      );

      // 4. Camera2D actualiza sus límites al cargar la escena vía RPGGame._loadScene
      RPGGame.prototype._loadScene.call(fakeGame, spec.id, null, { immediate: true });
      assert.equal(cam.worldWidth, scene.cols * 16, `${spec.id}: Camera2D worldWidth actualizado`);
      assert.equal(cam.worldHeight, scene.rows * 16, `${spec.id}: Camera2D worldHeight actualizado`);
    }

    // 5. Checks específicos: inakito_office sin mesas ni obstáculos en el centro y ai_nucleus_core sin plataformas fragmentadas
    const inakitoDeco = tm.scenes.inakito_office.layers.decoration;
    for (let r = 2; r < tm.scenes.inakito_office.rows - 2; r++) {
      for (let c = 2; c < tm.scenes.inakito_office.cols - 2; c++) {
        assert.equal(inakitoDeco[r][c], -1, `inakito_office (${c},${r}) debe estar limpio en el centro`);
      }
    }
    assert.equal(tm._coreDataPlatforms.length, 1, 'ai_nucleus_core debe tener una única plataforma abierta');
    assert.equal(tm._coreDataPlatforms[0].w, 22);
    assert.equal(tm._coreDataPlatforms[0].h, 16);
  });

  test('HUD compacto y pantallas cómodas: barra de jefe superior, hotbar discreta abajo y menús sin apelotonar', () => {
    const rects = [];
    const texts = [];
    let tx = 0;
    let ty = 0;
    const tStack = [];
    const mockCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left',
      textBaseline: 'middle',
      save() { tStack.push([tx, ty]); },
      restore() { const prev = tStack.pop(); if (prev) { tx = prev[0]; ty = prev[1]; } },
      translate(dx, dy) { tx += dx; ty += dy; },
      scale() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      arcTo() {},
      quadraticCurveTo() {},
      fill() {},
      stroke() {},
      createLinearGradient() { return { addColorStop() {} }; },
      createRadialGradient() { return { addColorStop() {} }; },
      measureText(txt) { return { width: String(txt).length * 3.1 }; },
      fillRect(x, y, w, h) { rects.push({ x: x + tx, y: y + ty, w, h }); },
      strokeRect(x, y, w, h) { rects.push({ x: x + tx, y: y + ty, w, h, stroke: true }); },
      fillText(txt, x, y) { texts.push({ txt: String(txt), x: x + tx, y: y + ty }); }
    };

    const player = new Player({ x: 160, y: 90 });
    player.maxHp = 5;
    player.hp = 4;
    player.hasSword = true;
    player.coins = 109;
    player.level = 10;

    const boss = new StackOverflowBoss({ x: 144, y: 96, sceneId: 'mines_boss_arena' });
    boss.activeCombat = true;
    boss.statusText = '🌀 ¡EXCEPCIONES EN ZIGZAG INFINITO DE PRUEBA!';

    const fakeGame = {
      player,
      enemies: [boss],
      tilemap: { currentSceneId: 'mines_boss_arena' },
      dayNight: { timeOfDayHours: 18.7, getFormattedTime: () => '18:43' },
      syncHotbarWithInventory() {},
      _ensurePlayerHotbar: () => [null, null, null, null, null],
      floatingTexts: []
    };

    const hud = new HUD(fakeGame);
    hud.render(mockCtx);

    // 1. La barra del jefe debe estar en la franja superior (y <= 30), dejando libre todo el tercio inferior
    const bossBg = rects.find((r) => !r.stroke && r.w >= 190 && r.h <= 14);
    assert.ok(bossBg, 'Debe existir la barra compacta de jefe');
    assert.ok(bossBg.y >= 15 && bossBg.y + bossBg.h <= 32, `La barra de jefe (${bossBg.y}..${bossBg.y + bossBg.h}) debe ir arriba sin invadir la arena`);

    // Ningún panel inferior del combate de jefe debe situarse entre y=32 e y=162 (espacio central/inferior 100% libre)
    const intrusivePanels = rects.filter((r) => r.w > 40 && r.y >= 32 && r.y < 162);
    assert.equal(intrusivePanels.length, 0, `No debe haber paneles intrusivos en y=32..162 (encontrados: ${JSON.stringify(intrusivePanels)})`);

    // 2. La hotbar va discreta abajo (16x16 en y>=162 sin barra de jefe encima)
    const hotbarSlots = rects.filter((r) => !r.stroke && r.w === 16 && r.h === 16);
    assert.equal(hotbarSlots.length, 5, 'La hotbar debe dibujar sus 5 slots de 16x16');
    assert.ok(hotbarSlots.every((s) => s.y >= 162), 'La hotbar debe quedar pegada al borde inferior (y >= 162)');

    // 3. Menú de Título con todas las opciones en 2 columnas holgadas dentro de 66..168
    const fakeMusic = {
      setMode() {}, playMenuSelect() {}, playMenuMove() {}, playCaughtSkipSound() {}, stopTitleMusic() {}
    };
    const menu = new MainMenuAndScenes(320, 180, {}, fakeMusic, {
      game: { isDevMode: true, expansionBossDefeated: true, enemies: [], inventory: new Set() },
      hasSave: () => true
    });
    menu.isDevMode = true;
    menu.openTitleScreen();
    const titleItems = menu._getCurrentMenuItems();
    const titleBoxes = menu._getMenuHitboxes(titleItems.length, titleItems);
    assert.ok(titleItems.length >= 7);
    assert.ok(titleBoxes.some((b) => b.x > 140), 'El menú de título con muchas opciones debe distribuirse en 2 columnas');
    assert.ok(titleBoxes.every((b) => b.y >= 64 && b.y + b.h <= 168 && b.h >= 14), 'Todos los botones del menú deben ser holgados (h >= 14) y caber antes del pie de página');

    // 4. Menú de Opciones: todas las filas caben por encima del pie de página sin pisarlo
    menu.openOptionsScreen('title');
    const optItems = menu._getCurrentMenuItems();
    const optBoxes = menu._getMenuHitboxes(optItems.length, optItems);
    const maxOptBottom = Math.max(...optBoxes.map((b) => b.y + b.h));
    assert.ok(maxOptBottom <= 154, `Las opciones (bottom=${maxOptBottom}) no deben pisar el pie de página`);

    // 5. Aviso toast durante gameplay no se dibuja en mitad de la pantalla sobre el jugador
    menu.state = 'none';
    menu.showNotice('Aviso largo de prueba que no debe tapar al jugador ni salirse por los lados', 2.0);
    menu.callbacks.game = fakeGame;
    texts.length = 0;
    menu.render(mockCtx);
    const noticeDrawn = texts.find((t) => t.txt.includes('Aviso largo'));
    assert.ok(noticeDrawn, 'Debe renderizar el aviso toast');
    assert.ok(noticeDrawn.y <= 45, `El toast en gameplay (y=${noticeDrawn.y}) debe quedar en la parte superior y no encima del personaje`);
  });

  test('Banda Sonora (Jukebox): opción en menú, vinilo giratorio, 15 pistas con crossfade y retorno a título', () => {
    // 1. Verificar catálogo de las 15 pistas exactas sin contaminar BGM_TRACKS base
    assert.equal(JUKEBOX_TRACKS.length, 15, 'El Jukebox debe tener exactamente 15 canciones');
    assert.equal(JUKEBOX_TRACKS[0].id, '01_main_theme');
    assert.equal(JUKEBOX_TRACKS[14].id, '15_boss_alex_final');

    const audio = new AudioManager();
    const input = new InputHandler();
    const menu = new MainMenuAndScenes(320, 180, {}, audio, {});
    menu.openTitleScreen();

    // 2. Opción "🎵 Banda Sonora" presente en el menú principal
    const titleItems = menu._getCurrentMenuItems();
    const jukeboxItem = titleItems.find((it) => it.label === '🎵 Banda Sonora');
    assert.ok(jukeboxItem, 'Debe existir la opción "🎵 Banda Sonora" en el menú de título');
    jukeboxItem.action();

    assert.equal(menu.state, 'jukebox', 'Al seleccionar Banda Sonora debe entrar al estado jukebox');
    assert.equal(audio.isJukeboxPlaying(), true, 'Al abrir Banda Sonora debe sonar el tema inicial en el AudioManager');
    assert.equal(menu.jukeboxActiveTrackId, '01_main_theme');

    // 3. Vinilo gira mientras suena la música
    const angle0 = menu.vinylAngle;
    menu.update(0.25, input);
    assert.ok(menu.vinylAngle > angle0, 'El vinilo debe girar cuando hay una canción sonando');

    // Renderizar Jukebox y verificar rotate() + textos + indicador ▶
    const rotateCalls = [];
    const drawnTexts = [];
    const mockCtx = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'top',
      globalAlpha: 1,
      save() {}, restore() {}, translate() {}, scale() {},
      rotate(a) { rotateCalls.push(a); },
      beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, rect() {}, quadraticCurveTo() {},
      fill() {}, stroke() {}, fillRect() {}, strokeRect() {},
      createLinearGradient() { return { addColorStop() {} }; },
      createRadialGradient() { return { addColorStop() {} }; },
      measureText(t) { return { width: String(t).length * 3 }; },
      fillText(t) { drawnTexts.push(String(t)); }
    };
    menu.render(mockCtx);
    assert.ok(rotateCalls.some((a) => Math.abs(a - menu.vinylAngle) < 0.001), 'El render debe rotar el vinilo con ctx.rotate(vinylAngle)');
    assert.ok(drawnTexts.includes('▶'), 'La canción activa debe mostrar el icono ▶');
    assert.ok(drawnTexts.some((t) => t.includes('01. Tema Principal')));

    // 4. Pausar con Enter detiene el giro del vinilo
    const press = (code) => {
      input._onKeyDown({ code, key: code, preventDefault() {} });
      menu.update(0.05, input);
      input._onKeyUp({ code });
    };

    press('Enter');
    assert.equal(audio.jukeboxPaused, true, 'Pulsar Enter sobre la pista activa debe pausarla');
    const pausedAngle = menu.vinylAngle;
    menu.update(0.25, input);
    assert.equal(menu.vinylAngle, pausedAngle, 'Con la música en pausa, el vinilo NO debe girar');

    // 5. Navegar por la lista y cambiar de pista con Enter (crossfade 0.3s) y volumen con Left/Right
    press('ArrowDown');
    assert.equal(menu.jukeboxIndex, 1);

    press('Enter');
    assert.equal(audio.jukeboxTrackId, '02_valleverde_hub', 'Debe reproducir la pista seleccionada al pulsar Enter');
    assert.equal(audio.isJukeboxPlaying(), true);

    const volBefore = audio.getMusicVolume();
    press('ArrowLeft');
    assert.ok(audio.getMusicVolume() < volBefore, 'Flecha izquierda debe bajar el volumen de música');
    press('ArrowRight');
    assert.equal(audio.getMusicVolume(), volBefore, 'Flecha derecha debe subir el volumen de música');

    // 6. Pulsar [Esc] detiene el Jukebox y vuelve a activar la música 'title'
    press('Escape');
    assert.equal(menu.state, 'title', 'Pulsar Esc debe regresar al menú de título');
    assert.equal(audio.jukeboxActive, false, 'Debe detener el estado Jukebox');
    assert.equal(audio.mode, 'title', 'Debe restaurar setMode("title") para la música del menú');
  });

  test('Menú de Título minimalista en 2 columnas: sin caja dorada gigante, Cargar Partida limpio y candado en línea única', () => {
    const fakeMusic = { setMode() {}, playMenuSelect() {}, playMenuMove() {}, playCaughtSkipSound() {} };
    const noSaveMenu = new MainMenuAndScenes(320, 180, {}, fakeMusic, { getSaveSummary: () => null });
    noSaveMenu.openTitleScreen();

    const noSaveItems = noSaveMenu._getCurrentMenuItems();
    const loadNoSave = noSaveItems[1];
    assert.equal(loadNoSave.label, 'Cargar Partida');
    assert.equal(loadNoSave.subtext, 'No hay partidas guardadas');
    assert.equal(loadNoSave.disabled, true);
    assert.equal(noSaveItems[2].renderSubtext, false);

    const withSaveMenu = new MainMenuAndScenes(320, 180, {}, fakeMusic, {
      getSaveSummary: () => 'Valleverde · 15 obj · 0:45h'
    });
    withSaveMenu.openTitleScreen();
    const items = withSaveMenu._getCurrentMenuItems();
    assert.equal(items[1].label, 'Cargar Partida');
    assert.equal(items[1].subtext, 'Valleverde · 15 obj · 0:45h');
    assert.equal(items[1].disabled, false);

    const leftLabels = items.filter((it) => it.column === 'left').map((it) => it.label);
    const rightLabels = items.filter((it) => it.column === 'right').map((it) => it.label);
    assert.deepEqual(leftLabels, [
      'Nueva Partida',
      'Cargar Partida',
      'El Resurgir de Mister Alex IA',
      'Cargar de la Nube',
      'Salón de la Fama'
    ]);
    assert.deepEqual(rightLabels, [
      '🎵 Banda Sonora',
      'Controles',
      'Opciones',
      'Salir'
    ]);

    const strokeRects = [];
    const texts = [];
    const mockCtx = new Proxy(
      {
        fillText: (t, x, y) => texts.push({ t: String(t), x, y }),
        strokeRect: (x, y, w, h) => strokeRects.push({ x, y, w, h }),
        measureText: (t) => ({ width: String(t).length * 4 }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} })
      },
      { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } }
    );
    const hitboxes = withSaveMenu._getMenuHitboxes(items.length, items);
    withSaveMenu._renderTitleMenu(mockCtx, items, hitboxes);
    assert.equal(strokeRects.length, 0, 'El nuevo menú de título no debe dibujar la caja dorada gigante');
    assert.ok(texts.some((t) => t.t === '►'), 'Debe dibujar el indicador ► en la opción seleccionada');
    assert.ok(texts.some((t) => t.t === '🔒'), 'Debe dibujar el candado junto a la expansión bloqueada');
    assert.ok(texts.some((t) => t.t.includes('Valleverde · 15 obj')), 'Debe mostrar el resumen del save debajo de Cargar Partida');
  });

  test('WorldMap en Expansión: muestra solo su zona corporativa (sin continentes ni núcleos del juego base)', async () => {
    const prevDoc = globalThis.document;
    const offFillStyles = new Set();
    const offFillTexts = [];
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
      fillText: (t) => { offFillTexts.push(String(t)); },
      save: () => {},
      restore: () => {},
      fillRect: () => { offFillStyles.add(offMockCtx.fillStyle); }
    };
    globalThis.document = {
      createElement: (tag) => (tag === 'canvas' ? { width: 0, height: 0, getContext: () => offMockCtx } : {})
    };

    try {
      const tm = new Tilemap(null, 16);
      await tm.loadExpansionScenes();
      const player = new Player({ x: 12 * 16, y: 10 * 16 });
      player.isExpansionActive = true;
      const wm = new WorldMap();

      const renderTexts = [];
      const renderCtx = new Proxy(
        {
          fillText: (t) => { renderTexts.push(String(t)); },
          measureText: (t) => ({ width: String(t).length * 4 }),
          createLinearGradient: () => ({ addColorStop: () => {} }),
          createRadialGradient: () => ({ addColorStop: () => {} })
        },
        { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } }
      );

      wm.render(renderCtx, 'valleverde_corp', player, [], tm);

      assert.equal(wm._cachedExpansionMap, true);
      // En textura offscreen de expansión NO debe haberse pintado césped ni caminos medievales del juego base
      assert.equal(offFillStyles.has('#2d5a27'), false, 'No debe pintar el bioma base de Valleverde');
      assert.equal(offFillStyles.has('#8b5a2b'), false, 'No debe pintar caminos de tierra del juego base');
      assert.ok(offFillTexts.includes('OFICINA IÑAKITO'));
      assert.ok(offFillTexts.includes('VERTEDERO P1'));
      assert.ok(offFillTexts.includes('SALA DEL KERNEL'));
      assert.ok(offFillTexts.includes('NÚCLEO ALEX IA'));

      // En cabecera y HUD solo deben salir etiquetas de la expansión
      assert.ok(renderTexts.includes('RED CORPORATIVA VALLEVERDE 2.0 · MAPA DEL SISTEMA'));
      assert.ok(renderTexts.includes('ACTOS CORP.'));
      assert.ok(renderTexts.includes('IÑAK') && renderTexts.includes('KERN') && renderTexts.includes('ALEX'));
      assert.equal(renderTexts.includes('NÚCLEOS'), false, 'No debe mostrar los núcleos del juego base');
      assert.equal(renderTexts.includes('CUMBRES'), false);
      assert.equal(renderTexts.includes('MARISMAS'), false);
      assert.equal(renderTexts.includes('VALLEVERDE'), false);

      // Si vuelve al juego base, regenera textura base limpia
      player.isExpansionActive = false;
      renderTexts.length = 0;
      wm.render(renderCtx, 'overworld', player, [], tm);
      assert.equal(wm._cachedExpansionMap, false);
      assert.ok(renderTexts.includes('MAPA DEL REINO DEL GRAN OJAL · CARTOGRAFÍA SAGRADA'));
    } finally {
      globalThis.document = prevDoc;
    }
  });

  test('Cinemática introductoria de Expansión (PROLOGUE_EXPANSION) se reproduce al iniciar nueva expansión', async () => {
    const { PROLOGUE_EXPANSION, getCinematicTimeline } = await import('../../src/assets/CinematicTimelines.js');
    assert.equal(PROLOGUE_EXPANSION.id, 'prologue_expansion');
    assert.equal(PROLOGUE_EXPANSION.duration, 24);
    assert.equal(getCinematicTimeline('prologue_expansion'), PROLOGUE_EXPANSION);
    assert.equal(PROLOGUE_EXPANSION.timeline[PROLOGUE_EXPANSION.timeline.length - 1].action, 'end');

    const prevStorage = globalThis.localStorage;
    // Simular que ya existía un guardado previo sin haber completado la intro ni progresado
    const storeMap = new Map([
      ['el_ojete_dorado_victory_trophy', 'true'],
      ['el_ojete_dorado_expansion_save_v1', JSON.stringify({ curriculum: 0, coins: 25 })]
    ]);
    globalThis.localStorage = {
      getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
      setItem: (k, v) => storeMap.set(k, String(v)),
      removeItem: (k) => storeMap.delete(k)
    };

    try {
      const tm = new Tilemap(null, 16);
      await tm.loadExpansionScenes();
      const player = new Player({ x: 32, y: 32 });
      let playedScript = null;
      let finishCallback = null;
      let dialogShown = null;
      const fakeGame = {
        tilemap: tm,
        player,
        camera: { setWorldBounds: () => {}, resetCinematic: () => {}, snapTo: () => {} },
        music: { loadExpansionMusic: () => {}, setMode: () => {} },
        menuSystem: { state: 'title', fadeAlpha: 0, fadeDirection: 0, showNotice: () => {} },
        dialogueBox: { showMessage: (t, l) => { dialogShown = { t, l }; } },
        cinematicDirector: {
          play: (script, cb) => {
            playedScript = script;
            finishCallback = cb;
          }
        },
        _resetWorldToInitialState: () => player.unequipAllForNewGame(),
        _syncFrancoNPCState: () => {},
        _restoreExpansionSaveData: (d) => RPGGame.prototype._restoreExpansionSaveData.call(fakeGame, d),
        _applySavedRosaUpgrades: () => {},
        _readExpansionStorage: () => ({}),
        _saveExpansionProgress: () => RPGGame.prototype._saveExpansionProgress.call(fakeGame)
      };

      RPGGame.prototype.startExpansion.call(fakeGame);
      assert.equal(playedScript?.id, 'prologue_expansion', 'startExpansion debe lanzar PROLOGUE_EXPANSION aunque hubiera un slot sin introSeen');
      assert.deepEqual(playedScript, PROLOGUE_EXPANSION);
      assert.equal(dialogShown, null, 'El diálogo de RRHH espera a que concluya la cinemática');

      finishCallback();
      assert.equal(tm.currentSceneId, 'valleverde_corp');
      assert.equal(player.x, 12 * 16);
      assert.equal(player.y, 15 * 16);
      assert.ok(dialogShown && dialogShown.t.includes('RRHH'), 'Al terminar la cinemática aparece el diálogo inicial de RRHH en Valleverde 2.0');
      const savedAfter = JSON.parse(storeMap.get('el_ojete_dorado_expansion_save_v1'));
      assert.equal(savedAfter.introSeen, true, 'Debe persistir introSeen=true al terminar la cinemática');

      // Al reanudar una vez vista la intro ya no vuelve a reproducirla
      playedScript = null;
      RPGGame.prototype.startExpansion.call(fakeGame);
      assert.equal(playedScript, null, 'Con introSeen=true, reanudar entra directo sin repetir la intro');

      // Al iniciar desde el menú principal (freshStart: true), SIEMPRE vuelve a reproducir PROLOGUE_EXPANSION
      storeMap.set('el_ojete_dorado_expansion_save_v1', JSON.stringify({ introSeen: true, curriculum: 18, coins: 250 }));
      playedScript = null;
      let menuPassedOpts = null;
      const titleMenu = new MainMenuAndScenes(320, 180, {}, {
        playMenuSelect: () => {},
        playCaughtSkipSound: () => {},
        stopTitleMusic: () => {}
      }, {
        game: fakeGame,
        onStartExpansion: (opts) => {
          menuPassedOpts = opts;
          return RPGGame.prototype.startExpansion.call(fakeGame, opts);
        }
      });
      const menuExpansionItem = titleMenu._getCurrentMenuItems().find((it) => it.label === 'El Resurgir de Mister Alex IA');
      assert.ok(menuExpansionItem && !menuExpansionItem.locked);
      menuExpansionItem.action();
      assert.deepEqual(menuPassedOpts, { freshStart: true }, 'El botón del menú principal debe iniciar la expansión en modo freshStart');
      assert.equal(playedScript?.id, 'prologue_expansion', 'Iniciar desde el menú principal debe reproducir siempre la cinemática PROLOGUE_EXPANSION');
      assert.equal(fakeGame.curriculum, 0, 'freshStart debe empezar una partida limpia en Valleverde 2.0');
    } finally {
      globalThis.localStorage = prevStorage;
    }
  });

  test('Desbloqueo automático de expansión si la partida guardada derrotó al boss final del juego base', async () => {
    const prevStorage = globalThis.localStorage;
    const storeMap = new Map();
    globalThis.localStorage = {
      getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
      setItem: (k, v) => storeMap.set(k, String(v)),
      removeItem: (k) => storeMap.delete(k)
    };

    try {
      const { hasExpansionUnlocked } = await import('../../src/expansion/ExpansionData.js');
      assert.equal(hasExpansionUnlocked(), false, 'Sin trofeo ni partida completada debe estar bloqueada');

      // Partida guardada donde aún no se derrotó al boss final
      storeMap.set('el_ojete_dorado_save_v1', JSON.stringify({
        savePayload: {
          gameCompleted: false,
          defeatedEnemyIds: ['goblin_1']
        }
      }));
      assert.equal(hasExpansionUnlocked(), false, 'Una partida sin boss final derrotado no desbloquea la expansión');

      // Partida guardada (formato contenedor) con boss_final_ai_alex derrotado, sin cookie victory_trophy
      storeMap.set('el_ojete_dorado_save_v1', JSON.stringify({
        savePayload: {
          gameCompleted: false,
          defeatedEnemyIds: ['boss_final_ai_alex']
        }
      }));
      assert.equal(hasExpansionUnlocked(), true, 'Derrotar a boss_final_ai_alex en la partida guardada desbloquea la expansión');

      const menuFromBossKill = new MainMenuAndScenes(320, 180, {}, {}, { game: null });
      assert.equal(menuFromBossKill._hasVictoryTrophy(), true, 'El menú debe desbloquearse con boss_final_ai_alex derrotado en save');
      assert.equal(menuFromBossKill._getCurrentMenuItems().find((it) => it.label === 'El Resurgir de Mister Alex IA').locked, false);

      // Partida guardada con gameCompleted=true en formato plano heredado
      storeMap.set('el_ojete_dorado_save_v1', JSON.stringify({ gameCompleted: true }));
      assert.equal(hasExpansionUnlocked(), true, 'gameCompleted=true en partida guardada desbloquea la expansión');
    } finally {
      globalThis.localStorage = prevStorage;
    }
  });
}
