/**
 * ExpansionManager.js · Gestor de aislamiento y carga perezosa para la expansión
 * "El Resurgir de Mister Alex IA" (v2.0).
 *
 * El juego base NO carga escenas, pistas musicales ni entidades de la expansión
 * hasta que el jugador pulsa la opción desbloqueada en el menú y se llama a `init(game)`.
 */
export class ExpansionManager {
  constructor(game = null) {
    this.game = game;
    this.initialized = false;
    this._cachedModules = null;
  }

  async _loadModules() {
    if (this._cachedModules) return this._cachedModules;
    const [
      dataMod,
      tonyMod,
      francoMod,
      rosaShopMod,
      inakitoMod,
      kernelMod,
      alexMod,
      debtMod,
      npcMod,
      enemyMod,
      animMod,
      spriteMod
    ] = await Promise.all([
      import('./ExpansionData.js?v=8'),
      import('./entities/TonyRandazzo.js?v=8'),
      import('./entities/FrancoPancho.js?v=8'),
      import('./entities/RosaShop.js?v=8'),
      import('./entities/IñakitoBoss.js?v=8'),
      import('./entities/KernelBoss.js?v=8'),
      import('./entities/AlexUpdateBoss.js?v=8'),
      import('./entities/TechnicalDebtBoss.js?v=8'),
      import('../entities/NPC.js?v=8'),
      import('../entities/Enemy.js?v=8'),
      import('../graphics/Animator.js?v=8'),
      import('../graphics/SpriteSheetGenerator.js?v=8')
    ]);

    this._cachedModules = {
      EXPANSION_NPCS: dataMod.EXPANSION_NPCS,
      EXPANSION_EQUIPMENT: dataMod.EXPANSION_EQUIPMENT,
      TonyRandazzo: tonyMod.TonyRandazzo,
      FrancoPancho: francoMod.FrancoPancho,
      RosaShop: rosaShopMod.RosaShop,
      IñakitoBoss: inakitoMod.IñakitoBoss,
      KernelBoss: kernelMod.KernelBoss,
      AlexUpdateBoss: alexMod.AlexUpdateBoss,
      TechnicalDebtBoss: debtMod.TechnicalDebtBoss,
      NPC: npcMod.NPC,
      Enemy: enemyMod.Enemy,
      SpriteAnimator: animMod.SpriteAnimator,
      CHARACTER_TYPES: spriteMod.CHARACTER_TYPES
    };
    return this._cachedModules;
  }

  _buildExpansionNPCs(game, mods) {
    const sheet = game?.assets?.charactersSheet || null;
    const { EXPANSION_NPCS, TonyRandazzo, FrancoPancho, NPC, SpriteAnimator, CHARACTER_TYPES } = mods;

    const cepData = EXPANSION_NPCS.cepedita_tieso;
    const cepedita = new NPC({
      name: cepData.name,
      jobTitle: cepData.role,
      homeSceneId: 'valleverde_corp',
      sceneId: 'valleverde_corp',
      x: 18 * 16,
      y: 6 * 16,
      animator: new SpriteAnimator(sheet, CHARACTER_TYPES.ELDER),
      behavior: 'idle',
      isSeated: true,
      initialDirection: 'down',
      talkSfx: cepData.talkSfx,
      dialogues: cepData.dialogues,
      ambientPhrases: ['Impreso A-38 bis requerido...', 'Turno 994827-B.']
    });
    cepedita.expansionId = cepData.id;
    cepedita.spriteColor = cepData.spriteColor;
    cepedita.hologram = Boolean(cepData.hologram);

    const rusasoData = EXPANSION_NPCS.rusaso_pluma;
    const rusaso = new NPC({
      name: rusasoData.name,
      jobTitle: rusasoData.role,
      homeSceneId: 'valleverde_corp',
      sceneId: 'valleverde_corp',
      x: 3 * 16,
      y: 14 * 16,
      animator: new SpriteAnimator(sheet, CHARACTER_TYPES.HERBALIST),
      behavior: 'idle',
      initialDirection: 'right',
      dialogues: rusasoData.dialogues,
      ambientPhrases: ['*clack-clack-clack* ¡Qué drama!', 'Oda al Servidor Inmortal...']
    });
    rusaso.expansionId = rusasoData.id;
    rusaso.spriteColor = rusasoData.spriteColor;

    const manoploData = EXPANSION_NPCS.tio_manoplo;
    const manoplo = new NPC({
      name: manoploData.name,
      jobTitle: manoploData.role,
      homeSceneId: 'valleverde_corp',
      sceneId: 'valleverde_corp',
      x: 19 * 16,
      y: 11 * 16,
      animator: new SpriteAnimator(sheet, CHARACTER_TYPES.BLACKSMITH),
      behavior: 'idle',
      initialDirection: 'left',
      talkSfx: manoploData.talkSfx,
      dialogues: manoploData.dialogues,
      ambientPhrases: ['Cinta aislante y fe...', '¿Dónde dejé mi llave inglesa?']
    });
    manoplo.expansionId = manoploData.id;
    manoplo.spriteColor = manoploData.spriteColor;

    const ciudadano = new NPC({
      name: 'Ciudadano Corporativo',
      jobTitle: 'Empleado Modelo · Nivel 98%',
      homeSceneId: 'valleverde_corp',
      sceneId: 'valleverde_corp',
      x: 10 * 16,
      y: 11 * 16,
      speed: 18,
      animator: new SpriteAnimator(sheet, CHARACTER_TYPES.VILLAGER_BLUE),
      behavior: 'patrol',
      patrolPoints: [
        { x: 10 * 16, y: 11 * 16, dir: 'down', waitMin: 2.0, waitMax: 4.0 },
        { x: 13 * 16, y: 11 * 16, dir: 'left', waitMin: 2.0, waitMax: 4.0 }
      ],
      ambientPhrases: ['TODO ESTÁ BIEN.', 'Felicidad: 98%.'],
      dialogues: [
        '¡Sonríe, ciudadano! Tu nivel de felicidad es del 98%. El otro 2% es un bug que el CEO está revisando.'
      ]
    });
    ciudadano.expansionId = 'ciudadano_corporativo';

    const franco = new FrancoPancho({
      x: game.francoRescued ? 7 * 16 : 3 * 16,
      y: game.francoRescued ? 14 * 16 : 4 * 16,
      animator: new SpriteAnimator(sheet, CHARACTER_TYPES.GUARD),
      sceneId: game.francoRescued ? 'valleverde_corp' : 'vertedero_piso_3',
      onRecruit: () => {
        game.francoRescued = true;
        game._saveExpansionProgress?.();
        game._saveGameToStorage?.();
        game.menuSystem?.showNotice?.('🤝 Franco el Pancho se une a ti hasta salir del Vertedero.', 2.6);
      }
    });

    const rosa = new NPC({
      name: 'Rosa',
      jobTitle: 'Bar Corporativo · Mejoras',
      homeSceneId: 'rosa_bar',
      sceneId: 'rosa_bar',
      x: 4.5 * 16,
      y: 2.1 * 16,
      animator: new SpriteAnimator(sheet, CHARACTER_TYPES.HERBALIST),
      behavior: 'idle',
      isSeated: true,
      initialDirection: 'down',
      talkSfx: 'keyboard_type',
      ambientPhrases: ['¿Un chupito de 10W-40?', 'Acepto Currículums en B.'],
      dialogues: [
        'Bienvenida al Bar Corporativo, cielo. ¿Quieres canjear tus Currículums por mejoras reales?'
      ]
    });
    rosa.expansionId = 'rosa_bartender';
    rosa.resolveDialogues = (dialogueBox) => ({
      lines: [
        'Bienvenida al Bar Corporativo, cielo. ¿Canjeamos tus Currículums por mejoras permanentes?'
      ],
      choices: [
        {
          label: 'Abrir tienda de Rosa',
          onSelect: () => {
            dialogueBox?.close?.();
            game.rosaShop?.open?.();
          }
        },
        {
          label: 'Solo estoy mirando',
          onSelect: () => {
            dialogueBox?.close?.();
          }
        }
      ]
    });

    const tony = new TonyRandazzo({
      x: 4 * 16,
      y: 5 * 16,
      animator: new SpriteAnimator(sheet, CHARACTER_TYPES.GUARD),
      sceneId: 'valleverde_corp'
    });

    return [tony, cepedita, rusaso, manoplo, ciudadano, franco, rosa];
  }

  _buildVertederoFloorEnemies(game, mods) {
    const sheet = game?.assets?.charactersSheet || null;
    const { Enemy, SpriteAnimator, CHARACTER_TYPES } = mods;
    const spots = [
      { col: 4, row: 4, patrolCol: 3, patrolRow: 4, archetype: 'drone', sprite: CHARACTER_TYPES.SHADOW_DRONE, suffix: 'Dron Basura' },
      { col: 8, row: 11, patrolCol: 8, patrolRow: 11, archetype: 'glitch', sprite: CHARACTER_TYPES.SHADOW_DRONE, suffix: 'Proceso Zombie' },
      { col: 19, row: 14, patrolCol: 19, patrolRow: 14, archetype: 'knight', sprite: CHARACTER_TYPES.SHADOW_KNIGHT, suffix: 'Auditor Corrupto' }
    ];
    const list = [];
    for (let floor = 1; floor <= 5; floor++) {
      const sceneId = `vertedero_piso_${floor}`;
      spots.forEach((spot, idx) => {
        list.push(new Enemy({
          id: `vertedero_f${floor}_${idx + 1}`,
          name: `${spot.suffix} (P${floor})`,
          x: spot.col * 16,
          y: spot.row * 16,
          sceneId,
          speed: 52 + floor * 3,
          maxHp: 2 + Math.floor((floor + idx) / 2),
          aggroRange: 135,
          xpReward: 25 + floor * 10,
          archetype: spot.archetype,
          respawnOnEnter: false,
          animator: new SpriteAnimator(sheet, spot.sprite, 16, 16, 0.12),
          patrolPoints: [
            { x: spot.col * 16, y: spot.row * 16 },
            { x: spot.patrolCol * 16, y: spot.patrolRow * 16 }
          ]
        }));
      });
    }
    return list;
  }

  _buildExpansionEnemies(game, mods) {
    const { IñakitoBoss, KernelBoss, AlexUpdateBoss, TechnicalDebtBoss } = mods;
    return [
      new IñakitoBoss({ x: 6 * 16, y: 4 * 16, sceneId: 'inakito_office', hp: 100 }),
      new KernelBoss({ x: 5.5 * 16, y: 3.2 * 16, sceneId: 'kernel_arena', hp: 150 }),
      new AlexUpdateBoss({ x: 6.2 * 16, y: 2.6 * 16, sceneId: 'ai_nucleus_core', hp: 200 }),
      new TechnicalDebtBoss({ x: 6.2 * 16, y: 2.6 * 16, sceneId: 'ai_nucleus_core', hp: 300 }),
      ...this._buildVertederoFloorEnemies(game, mods)
    ];
  }

  /** Adjunta de forma idempotente Tienda de Rosa, NPCs y jefes/enemigos de la expansión al juego activo. */
  attachCachedEntities(game = this.game) {
    if (!game || !this._cachedModules) return false;
    const mods = this._cachedModules;
    game.expansionEquipment = mods.EXPANSION_EQUIPMENT;
    game.expansionAmbientConfig = {
      barks: [
        '¡Mi nivel de felicidad es del 98%!',
        'El café de la máquina sabe a código binario.',
        'Recuerda fichar antes de optimizar tu alma.',
        'Todo bajo control según el informe trimestral.'
      ],
      crossTalkPairs: [
        ['¡Mi nivel de felicidad es del 98%!', '¿Solo 98%? Cuidado con la auditoría emocional.'],
        ['El café de la máquina sabe a código binario.', 'Es descafeinado 0xCAFE, tómalo con fe.'],
        ['¿Viste al becario nuevo?', 'Sigue compilando su café en B.']
      ]
    };

    if (!game.rosaShop) {
      game.rosaShop = new mods.RosaShop(game);
    }

    if (Array.isArray(game.npcs)) {
      const existingNpcKeys = new Set(game.npcs.map((n) => n?.expansionId || n?.name).filter(Boolean));
      for (const npc of this._buildExpansionNPCs(game, mods)) {
        const key = npc.expansionId || npc.name;
        if (!existingNpcKeys.has(key)) {
          npc._managedAmbientBarks = true;
          game.npcs.push(npc);
          existingNpcKeys.add(key);
        }
      }
      if (game.dialogueBox) {
        game.dialogueBox.npcRegistry = game.npcs;
      }
      game._syncFrancoNPCState?.();
    }

    if (Array.isArray(game.enemies)) {
      const existingEnemyIds = new Set(game.enemies.map((e) => e?.id).filter(Boolean));
      for (const enemy of this._buildExpansionEnemies(game, mods)) {
        if (!enemy.id || !existingEnemyIds.has(enemy.id)) {
          game.enemies.push(enemy);
          if (enemy.id) existingEnemyIds.add(enemy.id);
        }
      }
    }
    return true;
  }

  /**
   * Punto de entrada único para arrancar la expansión desde el menú principal:
   * 1) Inyecta las escenas en Tilemap, 2) carga los audios en AudioManager,
   * 3) arranca el estado 'expansion' y 4) crea los NPCs y jefes de la expansión.
   */
  async init(game = this.game) {
    const target = game || this.game;
    if (!target) return null;
    this.game = target;

    const mods = await this._loadModules();

    if (typeof target.tilemap?.loadExpansionScenes === 'function') {
      await target.tilemap.loadExpansionScenes(target.vertederoFloorOrder);
    }

    if (typeof target.music?.loadExpansionMusic === 'function') {
      target.music.loadExpansionMusic();
    }

    target.expansionEquipment = mods.EXPANSION_EQUIPMENT;
    target.isExpansionActive = true;
    target.isExpansionMode = true;
    target.gameState = 'expansion';
    this.initialized = true;

    if (typeof target.startExpansion === 'function') {
      target.startExpansion();
    }

    this.attachCachedEntities(target);
    target.isExpansionActive = true;
    target.isExpansionMode = true;
    target.gameState = 'expansion';
    return target;
  }
}
