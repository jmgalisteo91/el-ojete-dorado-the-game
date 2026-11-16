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
    this._initPromise = null;
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
      EXPANSION_BOSS_FLEE_TAUNTS: dataMod.EXPANSION_BOSS_FLEE_TAUNTS,
      EXPANSION_XP_REWARDS: dataMod.EXPANSION_XP_REWARDS,
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
    manoplo.resolveDialogues = (dialogueBox) => {
      const player = game?.player;
      const inv = game?.inventory;
      const eq = mods.EXPANSION_EQUIPMENT;
      const craftTool = (eqKey, byteCost, currCost = 0) => {
        const spec = eq[eqKey];
        if (!spec || !player) return;
        const alreadyOwned = inv?.items?.some((it) => it && (it.id === spec.id || it.id === spec.itemId));
        if (alreadyOwned || player.equippedWeapon === spec.id || player.equippedShield === spec.id) {
          player.equipExpansionItem?.(spec.id);
          game.menuSystem?.showNotice?.(`🧰 Ya tienes [${spec.name}]. ¡Re-equipado!`, 2.6);
          dialogueBox?.close?.();
          return;
        }
        if ((player.coins || 0) < byteCost) {
          dialogueBox?.showMessage?.('Tío Manoplo · Taller', [
            `Necesitas ${byteCost} Bytes para forjar [${spec.name}] (tienes ${player.coins || 0}).`
          ]);
          return;
        }
        if (currCost > 0 && (game.curriculum || 0) < currCost) {
          dialogueBox?.showMessage?.('Tío Manoplo · Taller', [
            `Necesitas ${currCost} Currículums 📄 además de ${byteCost} Bytes para [${spec.name}] (tienes ${game.curriculum || 0} 📄).`
          ]);
          return;
        }
        player.coins -= byteCost;
        if (currCost > 0) game.curriculum = Math.max(0, (game.curriculum || 0) - currCost);
        inv?.addItem?.({
          id: spec.id,
          name: spec.name,
          description: spec.description,
          iconIndex: spec.iconIndex ?? (spec.slot === 'shield' ? 4 : 3)
        });
        player.equipExpansionItem?.(spec.id);
        if (eqKey === 'grapadora' || eqKey === 'destornillador') {
          game.achievementManager?.unlock?.('ach_exp_gear');
        }
        if (eqKey === 'destornillador') {
          game.questLog?.completeQuest?.('exp_quest_manoplo_gear', '¡Destornillador del Destino fabricado! Listo para perforar la armadura de Mister Alex IA.');
        } else {
          game.questLog?.advanceStep?.('exp_quest_manoplo_gear', `Has conseguido [${spec.name}]. Vuelve a por el Destornillador del Destino (100 Bytes + 2 📄).`);
        }
        game.music?.playMenuSelect?.();
        game._saveExpansionProgress?.();
        dialogueBox?.close?.();
        game.menuSystem?.showNotice?.(`🔧 ¡Tío Manoplo te ha equipado [${spec.name}]!`, 3.2);
      };

      const hasGrapadora = Boolean(inv?.items?.some((it) => it && (it.id === 'grapadora' || it.id === 'equip_grapadora')));
      const hasDestorn = Boolean(inv?.items?.some((it) => it && (it.id === 'destornillador' || it.id === 'equip_destornillador')));
      const hasEscudo = Boolean(inv?.items?.some((it) => it && (it.id === 'escudo_becario' || it.id === 'equip_escudo_becario')));

      return {
        lines: [
          'Cinta aislante, acero de oficina y mala leche. Si RRHH te quitó la espada, aquí te apaño equipo de verdad.',
          'Puedes cambiar tus armas y escudos cuando quieras desde el Inventario [I].'
        ],
        choices: [
          {
            label: hasGrapadora ? '📎 Grapadora Industrial (Ya equipada/en mochila)' : '📎 Fabricar Grapadora Industrial (60 Bytes)',
            onSelect: () => craftTool('grapadora', 60, 0)
          },
          {
            label: hasDestorn ? '🪛 Destornillador del Destino (Ya en mochila)' : '🪛 Destornillador del Destino (100 Bytes + 2 📄)',
            onSelect: () => craftTool('destornillador', 100, 2)
          },
          {
            label: hasEscudo ? '🛡️ Escudo del Becario (Ya en mochila)' : '🛡️ Escudo del Becario (50 Bytes)',
            onSelect: () => craftTool('escudo_becario', 50, 0)
          },
          {
            label: 'Volver',
            onSelect: () => dialogueBox?.close?.()
          }
        ]
      };
    };

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
        game.achievementManager?.unlock?.('ach_exp_franco');
        game.questLog?.completeQuest?.('exp_quest_franco', '¡Franco el Pancho rescatado del Vertedero Digital!');
        game.questLog?.advanceStep?.('exp_quest_kernel', 'Llega al fondo del Vertedero (Piso 5 → Sala de Servidores) y derrota a El Kernel.');
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
          xpReward: 75 + floor * 35,
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
    const { IñakitoBoss, KernelBoss, AlexUpdateBoss, TechnicalDebtBoss, EXPANSION_XP_REWARDS } = mods;
    const inakito = new IñakitoBoss({ x: 9.2 * 16, y: 6.5 * 16, sceneId: 'inakito_office', hp: 100 });
    inakito.xpReward = EXPANSION_XP_REWARDS?.boss_inakito ?? 500;
    const kernel = new KernelBoss({ x: 9.2 * 16, y: 6.2 * 16, sceneId: 'kernel_arena', hp: 150 });
    kernel.xpReward = EXPANSION_XP_REWARDS?.boss_kernel ?? 850;
    const alex = new AlexUpdateBoss({ x: 11 * 16, y: 7.5 * 16, sceneId: 'ai_nucleus_core', hp: 200 });
    alex.xpReward = EXPANSION_XP_REWARDS?.boss_alex_update ?? 1200;
    const debt = new TechnicalDebtBoss({ x: 11 * 16, y: 7.5 * 16, sceneId: 'ai_nucleus_core', hp: 300 });
    debt.xpReward = EXPANSION_XP_REWARDS?.boss_technical_debt ?? 1800;
    return [
      inakito,
      kernel,
      alex,
      debt,
      ...this._buildVertederoFloorEnemies(game, mods)
    ];
  }

  /** Adjunta de forma idempotente Tienda de Rosa, NPCs y jefes/enemigos de la expansión al juego activo. */
  attachCachedEntities(game = this.game) {
    if (!game || !this._cachedModules) return false;
    const mods = this._cachedModules;
    game.expansionEquipment = mods.EXPANSION_EQUIPMENT;
    game.expansionBossFleeTaunts = mods.EXPANSION_BOSS_FLEE_TAUNTS;
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

    const hasVictoryTrophy = (() => {
      try {
        return typeof localStorage !== 'undefined' && localStorage.getItem('el_ojete_dorado_victory_trophy') === 'true';
      } catch {
        return false;
      }
    })();
    if (!hasVictoryTrophy) {
      target.menuSystem?.showNotice?.('🔒 Completa el juego base para desbloquear la expansión.', 3.0);
      return null;
    }
    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = (async () => {
      try {
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
        if (target.menuSystem) {
          target.menuSystem.state = 'none';
          target.menuSystem.fadeAlpha = 0;
        }
        return target;
      } catch (err) {
        console.error('[ExpansionManager] Error iniciando la expansión:', err);
        target.isExpansionActive = false;
        target.isExpansionMode = false;
        target.gameState = 'base';
        if (target.menuSystem) {
          target.menuSystem.openTitleScreen?.();
          target.menuSystem.showNotice?.('⚠️ No se pudo iniciar la expansión. Inténtalo de nuevo.', 3.5);
        }
        return null;
      } finally {
        this._initPromise = null;
      }
    })();

    return this._initPromise;
  }
}
