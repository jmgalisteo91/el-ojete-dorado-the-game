import { Enemy } from '../../src/entities/Enemy.js';
import { Player, LEVEL_XP_THRESHOLDS, MAX_PLAYER_LEVEL, DIVINE_BLESSINGS } from '../../src/entities/Player.js';
import { getDoorBlock, ZONE_LEVEL_REQUIREMENTS } from '../../src/core/DoorGatekeeper.js';
import { Boss } from '../../src/entities/bosses/Boss.js';
import { RPGGame } from '../../src/main.js';
import { Tilemap } from '../../src/world/Tilemap.js';
import { getBromForgeChoices } from '../../src/entities/NPC.js';
import { TILES } from '../../src/graphics/SpriteSheetGenerator.js';
import { AlexUpdateBoss } from '../../src/expansion/entities/AlexUpdateBoss.js';
import { CloudStorage } from '../../src/services/CloudStorage.js';
import { Inventory, normalizeItemId } from '../../src/ui/Inventory.js';
import { QuestLog } from '../../src/core/QuestLog.js';
import { CharacterStats } from '../../src/ui/CharacterStats.js';
import { InputHandler } from '../../src/core/InputHandler.js';
import { EXPANSION_EQUIPMENT, EXPANSION_SKILLS, getExpansionEquipment } from '../../src/expansion/ExpansionData.js';
import { IñakitoBoss } from '../../src/expansion/entities/IñakitoBoss.js';
import { HUD } from '../../src/ui/HUD.js?v=8';
import {
  makeMap,
  openMap,
  stubInput,
  makePlayer,
  makeEnemy,
} from './mocks.mjs';

export async function run(test, assert) {
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
      _renderHotbar: (ctx, hf, hs) => new HUD(fakeGame).renderHotbar(ctx, hf, hs)
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
    const mockHud = new HUD(mockHudGame);
    mockHud.render(hudCtx);
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
    mockHud.render(hudCtx);
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
    // En juego base no debe equipar equipamiento corporativo ni mostrarlo en inventario/HUD
    assert.equal(p.equipExpansionItem('boligrafo'), null, 'Base game must reject expansion equipment');
    const baseInv = new Inventory();
    assert.equal(baseInv.addItem({ ...EXPANSION_EQUIPMENT.grapadora }), false, 'Base Inventory must reject expansion items');

    p.isExpansionActive = true;
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
    inv.isExpansionActive = true;
    inv.isOpen = true;
    inv.addItem({ ...EXPANSION_EQUIPMENT.grapadora });
    inv.addItem({ ...EXPANSION_EQUIPMENT.carpeta });
    inv.selectedIndex = 0;
    const mockGame = {
      isExpansionActive: true,
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
    new HUD(hudMockGame).render(makeCtx(hudTexts));
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

    // Aislamiento base: sin isExpansionActive solo muestra las 4 habilidades base y bloquea compra de expansión
    const cs = new CharacterStats(320, 180);
    cs.open();
    cs.switchTab('skills');
    const baseVisibleKeys = cs.getVisibleSkills(p).map((d) => d.key);
    assert.deepEqual(baseVisibleKeys, ['vigor', 'filo', 'reflejo', 'log'], 'En juego base solo deben verse las 4 habilidades originales');
    assert.equal(p.purchaseSkill('ejecutivo'), false, 'purchaseSkill debe rechazar habilidades de expansión en juego base');
    assert.equal(p.purchaseSkill('resiliencia'), false);
    assert.equal(p.purchaseSkill('reciclaje'), false);

    // Activar modo expansión para probar el árbol ampliado completo
    p.isExpansionActive = true;
    cs.isExpansionActive = true;

    // Prerequisito: sin Vigor base no se puede comprar vigor_2 y tampoco aparece en UI
    assert.equal(p.purchaseSkill('vigor_2'), false, 'No debe permitir Vigor II sin Vigor base');
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

  test('Floating Combat Text (-1 blanco, -3 dorado, rojo jugador), subida/fade y Viñeta Roja de daño (0.2s)', () => {
    const fakeGame = {
      floatingTexts: [],
      damageVignetteTimer: 0,
      damageVignetteDuration: 0.2,
      spawnFloatingText(opts) {
        return RPGGame.prototype.spawnFloatingText.call(this, opts);
      },
      _updateFloatingTexts(dt) {
        return RPGGame.prototype._updateFloatingTexts.call(this, dt);
      },
      triggerDamageVignette(dur) {
        return RPGGame.prototype.triggerDamageVignette.call(this, dur);
      },
      _renderDamageVignette(ctx) {
        return RPGGame.prototype._renderDamageVignette.call(this, ctx);
      }
    };

    const player = new Player({ x: 80, y: 80 });
    player.game = fakeGame;

    // 1. Enemigo normal: -1 blanco y -3 dorado (#ffd700)
    const slime = new Enemy({ id: 'slime_ft', x: 96, y: 80, hp: 10 });
    slime._applyDamage(1, player, null);
    slime._applyDamage(3, player, null);
    assert.equal(fakeGame.floatingTexts.length, 2);
    assert.equal(fakeGame.floatingTexts[0].text, '-1');
    assert.equal(fakeGame.floatingTexts[0].color, '#ffffff');
    assert.equal(fakeGame.floatingTexts[0].life, 0.8);
    assert.equal(fakeGame.floatingTexts[1].text, '-3');
    assert.equal(fakeGame.floatingTexts[1].color, '#ffd700');

    // 2. Jefe (Boss): también emite número dorado cuando daño > 2
    const boss = new Boss({ id: 'boss_ft', x: 112, y: 80, hp: 20, maxHp: 20 });
    player.x = 112;
    player.y = 80;
    boss.takeSwordHit(player, null, 3);
    assert.equal(fakeGame.floatingTexts[2].text, '-3');
    assert.equal(fakeGame.floatingTexts[2].color, '#ffd700');

    // 3. Daño al jugador (takeHit & takeDamage) emite texto rojo (#ff0000) + dispara viñeta roja de 0.2s
    player.invulnTimer = 0;
    player.takeHit(null, { centerX: 120, centerY: 88, sceneId: 'first_stage', ngPlusDamageScale: 1.5 }, 1);
    const redHit = fakeGame.floatingTexts.find((ft) => ft.color === '#ff0000');
    assert.ok(redHit, 'El daño al jugador debe generar floating text rojo');
    assert.equal(redHit.text, '-1.5', 'El multiplicador ngPlusDamageScale 1.5x debe reflejarse en el daño recibido');
    assert.equal(fakeGame.damageVignetteTimer, 0.2, 'Recibir daño debe activar la viñeta roja de 0.2s');

    player.invulnTimer = 0;
    player.takeDamage(4);
    const directRed = fakeGame.floatingTexts[fakeGame.floatingTexts.length - 1];
    assert.equal(directRed.color, '#ff0000');
    assert.equal(directRed.text, '-2');

    // 4. Actualización: sube hacia arriba (Y decrece) y se renderiza en HUD con opacidad decreciente
    const startY = fakeGame.floatingTexts[0].y;
    fakeGame._updateFloatingTexts(0.4);
    assert.ok(fakeGame.floatingTexts[0].y < startY, 'El texto flotante debe desplazarse hacia arriba');
    assert.ok(Math.abs(fakeGame.floatingTexts[0].life - 0.4) < 0.01);

    const hudTexts = [];
    const alphas = [];
    const hud = new HUD({
      ...fakeGame,
      player,
      camera: { renderX: 0, renderY: 0 },
      tilemap: { currentSceneId: 'first_stage' }
    });
    const hudCtx = {
      save() {},
      restore() {},
      fillText(t) { hudTexts.push(String(t)); },
      set globalAlpha(v) { alphas.push(v); },
      get globalAlpha() { return alphas[alphas.length - 1] ?? 1; },
      set font(_) {},
      set textAlign(_) {},
      set fillStyle(_) {}
    };
    hud.renderFloatingTexts(hudCtx);
    assert.ok(hudTexts.includes('-1') && hudTexts.includes('-3') && hudTexts.includes('-2'), 'HUD debe dibujar los textos flotantes activos');
    assert.ok(alphas.some((a) => a > 0 && a < 1), 'La opacidad del texto debe desvanecerse con life/maxLife');

    // Render de viñeta radial roja
    const stops = [];
    const vigCtx = {
      save() {}, restore() {}, fillRect() {},
      createRadialGradient() {
        return { addColorStop(o, c) { stops.push([o, c]); } };
      },
      set fillStyle(_) {}
    };
    fakeGame._renderDamageVignette(vigCtx);
    assert.ok(stops.some(([, c]) => c.includes('180, 0, 0')), 'La viñeta debe usar gradiente radial rojo en los bordes');

    // Al pasar el resto de 0.8s, los textos desaparecen
    fakeGame._updateFloatingTexts(0.5);
    assert.equal(fakeGame.floatingTexts.length, 0, 'Al agotarse los 0.8s deben eliminarse los textos flotantes');
  });

  test('Juego base Nv. 10-15 y Altar del Dios Supremo: Trascendencia, Ofrendas XP, 3 Pactos Cósmicos y Juicio', () => {
    const player = new Player({ x: 64, y: 64 });
    player.hasSword = true;
    player.coins = 60;
    player.robotizationLevel = 45;
    player.gainXp(1700); // Llega al Nivel 10
    assert.equal(player.level, 10);

    const fakeGame = {
      player,
      jailerAnger: 3,
      jailerAngerCount: 3,
      totalJailVisits: 2,
      sheepAttacks: 1,
      music: { playFanfare: () => {}, playMenuSelect: () => {} },
      menuSystem: { showNotice: () => {} },
      dialogueBox: { showMessage: () => {}, close: () => {} },
      inventory: { statusMessage: '' },
      _saveGameToStorage: () => {},
      _grantSupremeGodBlessing: (id) => RPGGame.prototype._grantSupremeGodBlessing.call(fakeGame, id),
      _grantSupremeGodXp: (xp, opts) => RPGGame.prototype._grantSupremeGodXp.call(fakeGame, xp, opts),
      _performSupremeGodJudgement: () => RPGGame.prototype._performSupremeGodJudgement.call(fakeGame),
      _buildSupremeGodDialogues: () => RPGGame.prototype._buildSupremeGodDialogues.call(fakeGame)
    };

    // 1. Rito de Trascendencia: rompe el techo de Nv. 10 (+500 XP -> Nv. 11 y +1 PH) una sola vez
    const dlgInitial = fakeGame._buildSupremeGodDialogues();
    assert.ok(dlgInitial.choices.some((c) => /Trascendencia/i.test(c.label)));
    const spBefore = player.skillPoints;
    const tRes = fakeGame._grantSupremeGodXp(500, { skillPointsBonus: 1, markTranscendence: true });
    assert.equal(tRes.ok, true);
    assert.equal(player.level, 11);
    assert.equal(player.skillPoints, spBefore + 2);
    assert.equal(player.divineTranscendenceClaimed, true);

    const dlgAfter = fakeGame._buildSupremeGodDialogues();
    assert.equal(dlgAfter.choices.some((c) => /Trascendencia/i.test(c.label)), false);

    // 2. Ofrenda de Sabiduría Cósmica: 25 Bytes -> +350 XP hasta alcanzar Nv. 12+
    const failNoBytes = fakeGame._grantSupremeGodXp(350, { byteCost: 100 });
    assert.equal(failNoBytes.ok, false);
    assert.equal(failNoBytes.reason, 'insufficient_bytes');

    const offerRes = fakeGame._grantSupremeGodXp(600, { byteCost: 25 });
    assert.equal(offerRes.ok, true);
    assert.equal(player.coins, 35);
    assert.equal(player.level, 12);
    assert.equal(player.maxHp, 4);

    // 3. 3 Pactos Cósmicos del Dios Supremo con impacto mecánico real
    assert.equal(Object.keys(DIVINE_BLESSINGS).length, 3);

    // a) Filo de Luz Binaria: +25% daño
    const baseDmg = player.getSwordDamage();
    fakeGame._grantSupremeGodBlessing('blade');
    assert.equal(player.divineBlessing, 'blade');
    assert.ok(player.getSwordDamage() > baseDmg);

    // b) Égida Inmutable: -20% daño recibido y limpia robotización en -30
    fakeGame._grantSupremeGodBlessing('aegis');
    assert.equal(player.divineBlessing, 'aegis');
    assert.equal(player.robotizationLevel, 15);
    player.hp = 4;
    player.invulnTimer = 0;
    player.takeHit(null, null, 2);
    assert.equal(player.hp, 2.4, 'Égida Inmutable debe reducir 2 de daño a 1.6');

    // c) Paso Astral: -25% coste de stamina y +12% velocidad
    fakeGame._grantSupremeGodBlessing('swift');
    player.stamina = 100;
    assert.equal(player.spendStamina(20), true);
    assert.equal(player.stamina, 85, 'Paso Astral debe reducir un coste de 20 a 15');

    // 4. Juicio de Expediente: absuelve ira del Carcelero y limpia robotización restante
    const verdict = fakeGame._performSupremeGodJudgement();
    assert.equal(verdict.length, 2);
    assert.equal(fakeGame.jailerAngerCount, 0);
    assert.equal(fakeGame.jailerAnger, 0);
    assert.equal(player.robotizationLevel, 0);

    // 5. Persistencia de Nivel 14/15 y Pacto en CloudStorage + _loadGameData (sin cap de Nv. 10)
    player.gainXp(3000); // > 5200 XP -> Nv. 15
    assert.equal(player.level, MAX_PLAYER_LEVEL);
    const saved = CloudStorage.sanitizeSaveData({
      level: player.level,
      xp: player.xp,
      maxHp: player.maxHp,
      levelStaminaBonus: player.levelStaminaBonus,
      divineBlessing: player.divineBlessing,
      divineTranscendenceClaimed: player.divineTranscendenceClaimed
    });
    assert.equal(saved.level, 15);
    assert.equal(saved.divineBlessing, 'swift');
    assert.equal(saved.divineTranscendenceClaimed, true);

    const restoredPlayer = new Player({ x: 0, y: 0 });
    const tm = new Tilemap(null, 16);
    const loadGameStub = {
      isExpansionMode: false,
      isExpansionActive: false,
      tilemap: tm,
      player: restoredPlayer,
      dayNight: { timeOfDayHours: 8.5 },
      camera: { setWorldBounds: () => {}, snapTo: () => {} },
      inventory: new Inventory(null),
      music: { setMode: () => {} },
      npcs: [],
      animals: [],
      enemies: [],
      worldItems: [],
      housePermissions: {},
      bossCutscenesSeen: {},
      _resetWorldToInitialState: () => {
        restoredPlayer.unequipAllForNewGame();
      },
      _syncGatesUnlocked: () => {},
      _syncAchievementsWithProgress: () => {},
      _syncMinesBossArenaGate: () => {}
    };
    assert.equal(RPGGame.prototype._loadGameData.call(loadGameStub, saved), true);
    assert.equal(restoredPlayer.level, 15, 'Cargar partida en juego base debe conservar el Nivel 15');
    assert.equal(restoredPlayer.maxHp, 5);
    assert.equal(restoredPlayer.levelStaminaBonus, 20);
    assert.equal(restoredPlayer.divineBlessing, 'swift');
    assert.equal(restoredPlayer.divineTranscendenceClaimed, true);
  });

  test('Forja de Brom: opción Reparar Armadura (20 Bytes o 2 Chatarra) e indicador HUD xN', () => {
    const p = new Player({ x: 32, y: 32 });
    const inv = new Inventory(null);
    const messages = [];
    const forgeGame = {
      player: p,
      inventory: inv,
      dialogueBox: { showMessage: (title, lines) => messages.push({ title, lines }) },
      music: { playFanfare: () => {} },
      _saveGameToStorage: () => {}
    };

    // 1. Sin armadura NO aparece "Reparar Armadura"
    p.hasArmor = false;
    assert.equal(
      getBromForgeChoices(forgeGame).some((c) => /Reparar Armadura/i.test(c.label)),
      false,
      'Sin armadura no debe mostrarse Reparar Armadura'
    );

    // 2. Con armadura dañada (armorPoints = 1) aparece y repara con 20 Bytes
    p.equipArmor();
    p.armorPoints = 1;
    p.coins = 25;
    const repairChoice1 = getBromForgeChoices(forgeGame).find((c) => /Reparar Armadura/i.test(c.label));
    assert.ok(repairChoice1);
    repairChoice1.onSelect();
    assert.equal(p.coins, 5);
    assert.equal(p.armorPoints, 3);

    // 3. Con armadura al máximo (3/3) muestra "Tu armadura está en perfecto estado"
    const fullChoice = getBromForgeChoices(forgeGame).find((c) => /Reparar Armadura/i.test(c.label));
    assert.ok(fullChoice);
    assert.match(fullChoice.label, /Tu armadura está en perfecto estado/i);

    // 4. Con < 20 Bytes pero 2 de Chatarra, repara consumiendo 2 de Chatarra
    p.armorPoints = 0;
    inv.addItem({ id: 'drone_scrap', name: 'Chatarra', description: '', iconIndex: 10, qty: 2 });
    const repairChoice2 = getBromForgeChoices(forgeGame).find((c) => /Reparar Armadura/i.test(c.label));
    assert.ok(repairChoice2);
    repairChoice2.onSelect();
    assert.equal(p.armorPoints, 3);
    assert.equal(inv.getItemCount('drone_scrap'), 0);

    // 5. HUD muestra el contador de puntos de armadura (🛡 x3)
    const hudTexts = [];
    const hudCtx = new Proxy(
      {
        fillText(t) { hudTexts.push(String(t)); },
        measureText(t) { return { width: String(t).length * 4 }; },
        createLinearGradient() { return { addColorStop() {} }; }
      },
      { get: (t, k) => (k in t ? t[k] : () => {}) }
    );
    const hud = new HUD({
      kernelHackActive: false,
      kernelHudFlicker: false,
      touchControls: { isTouchEnabled: () => false },
      dayNight: { getFormattedTime: () => '12:00', timeOfDayHours: 12 },
      tilemap: { currentSceneId: 'overworld' },
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
    });
    hud.render(hudCtx);
    assert.ok(hudTexts.includes('🛡 x3'), 'HUD debe mostrar 🛡 x3 cuando el jugador lleva armadura');
  });
}
