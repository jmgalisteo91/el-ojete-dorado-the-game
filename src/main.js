import { GameLoop } from './core/GameLoop.js?v=6';
import { InputHandler } from './core/InputHandler.js?v=6';
import { Camera2D } from './core/Camera2D.js?v=6';
import {
  loadGameAssets,
  CHARACTER_TYPES,
  ITEM_ICONS
} from './graphics/SpriteSheetGenerator.js?v=6';
import { SpriteAnimator } from './graphics/Animator.js?v=6';
import { Tilemap } from './world/Tilemap.js?v=6';
import { CollisionSystem } from './physics/CollisionSystem.js?v=6';
import { Player } from './entities/Player.js?v=6';
import { NPC } from './entities/NPC.js?v=6';
import { Animal } from './entities/Animal.js?v=6';
import { Enemy } from './entities/Enemy.js?v=6';
import { GarbageCollectorBoss } from './entities/bosses/GarbageCollectorBoss.js?v=6';
import { StackOverflowBoss } from './entities/bosses/StackOverflowBoss.js?v=6';
import { PrototypeMicrowaveBoss } from './entities/bosses/PrototypeMicrowaveBoss.js?v=6';
import { FinalBossAlex } from './entities/bosses/FinalBossAlex.js?v=6';
import { WorldItem } from './entities/WorldItem.js?v=6';
import { DialogueBox } from './ui/DialogueBox.js?v=6';
import { Inventory } from './ui/Inventory.js?v=6';
import { CharacterStats } from './ui/CharacterStats.js?v=6';
import { QuestLog } from './core/QuestLog.js?v=6';
import { AchievementManager } from './core/AchievementManager.js?v=6';
import { QuestLogView } from './ui/QuestLogView.js?v=6';
import { MainMenuAndScenes } from './ui/MainMenuAndScenes.js?v=6';
import {
  AnimeCutsceneManager,
  SCENE_JAIL_ARREST,
  SCENE_AI_ALEX_WARNING,
  SCENE_AI_ALEX_PREBATTLE,
  SCENE_DEUS_PURIFICATION,
  SCENE_VICTORY_CREDITS,
  SCENE_ENDING_VICTORY,
  SCENE_INTRO_GARBAGE_COLLECTOR,
  SCENE_INTRO_STACK_OVERFLOW,
  SCENE_INTRO_PROTOTYPE_MICROWAVE,
  getBossIntroCutscene
} from './ui/AnimeCutsceneManager.js?v=6';
import { DayNightCycle } from './world/DayNightCycle.js?v=6';
import { AIBotBrain } from './ai/AIBotBrain.js?v=6';
import { AmbientMusic } from './audio/AmbientMusic.js?v=6';

const VIEWPORT_WIDTH = 320;
const VIEWPORT_HEIGHT = 180;
const RENDER_SCALE = 4; // Renderizado nativo HD 1280x720 (4x sobre base lógica 320x180)
const SAVE_STORAGE_KEY = 'el_ojete_dorado_save_v1';

export const ABYSSAL_POINTER_SPAWN_CANDIDATES = [
  { x: 4 * 16, y: 20 * 16, desc: 'Bosque Secreto de Valleverde' },
  { x: 26 * 16, y: 18 * 16, desc: 'Orilla del Río Alba' },
  { x: 33 * 16, y: 8 * 16, desc: 'Antesala del Santuario de las Pruebas' },
  { x: 4 * 16, y: 12 * 16, desc: 'Borde de las Tierras Hostiles' }
];

export class RPGGame {
  constructor(canvas, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.assets = assets;
    this.music = new AmbientMusic();
    this.input = new InputHandler(() => {
      this.music.unlockAndStart();
      if (this.achievementManager && this.music.ctx) {
        this.achievementManager.setAudioContext(this.music.ctx);
      }
    }, canvas);

    this.tilemap = new Tilemap(assets.tilesetSheet, assets.tileSize);
    this.camera = new Camera2D(
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      this.tilemap.width,
      this.tilemap.height
    );

    this.dialogueBox = new DialogueBox(VIEWPORT_WIDTH, VIEWPORT_HEIGHT, this.music);
    this.inventory = new Inventory(assets.itemsSheet, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    this.characterStats = new CharacterStats(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    this.achievementManager = new AchievementManager(
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      this.music ? this.music.ctx : null,
      this.music
    );
    this.questLog = new QuestLog((msg) => {
      if (this.menuSystem) this.menuSystem.showNotice(msg, 3.5);
    });
    const origCompleteQuest = this.questLog.completeQuest.bind(this.questLog);
    this.questLog.completeQuest = (questId, finalNote) => {
      const res = origCompleteQuest(questId, finalNote);
      if (res && this.achievementManager) {
        this.achievementManager.unlock('ach_first_quest');
        this._checkAllSideQuestsAchievement();
      }
      return res;
    };
    this.questLogView = new QuestLogView(this.questLog, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    this.dayNight = new DayNightCycle(VIEWPORT_WIDTH, VIEWPORT_HEIGHT, 720);

    this.jailRemainingSeconds = 0;
    this.jailerAngerCount = 0;
    this.isJailedForever = false;

    // Registro de permisos de entrada a las 5 viviendas del pueblo
    this.housePermissions = {
      elder_house: false,
      oracle_house: false,
      blacksmith_house: false,
      herbalist_house: false,
      guard_house: false
    };

    this.player = new Player({
      x: 17 * 16,
      y: 19 * 16,
      animator: new SpriteAnimator(assets.charactersSheet, CHARACTER_TYPES.HERO),
      armoredAnimator: new SpriteAnimator(assets.charactersSheet, CHARACTER_TYPES.HERO_ARMORED)
    });

    this.aiBrain = new AIBotBrain(() => ({
      time: this.dayNight.getFormattedTime(),
      phase: this.dayNight.getPhaseLabel(),
      bridgeOpen: this.tilemap.bridgeOpen,
      bridgeForceUnlocked: this.tilemap.bridgeForceUnlocked,
      hasLantern: this.player.hasLanternEquipped,
      inventoryItems: this.inventory.items,
      hasArmor: this.player.hasArmor,
      hasSword: this.player.hasSword,
      sceneId: this.tilemap.currentSceneId,
      hp: this.player.hp
    }));
    this.aiChatOpen = false;
    this._setupAIChatDOM();

    this.npcs = this._createVillageNPCs();
    this.animals = this._createVillageAnimals();
    this.enemies = this._createFirstStageEnemies();
    this.worldItems = this._createWorldItems();

    this.promptTimer = 0;

    this.animeCutscenes = new AnimeCutsceneManager(
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      this.music
    );

    // Registro de estadísticas del jugador para el Expediente de Compilación Final
    this.totalPlayTimeSeconds = 0;
    this.totalJailVisits = 0;
    this.gameCompleted = false;
    this.bossCutscenesSeen = {
      boss_garbage_collector: false,
      boss_stack_overflow: false,
      boss_prototype_microwave: false
    };

    // Estado del Puntero al Abismo y Portal dinámico a los Reinos Condenados
    this.abyssalPointerSpawn = null;
    this.abyssalPortalOrigin = null;
    this.activeAbyssalPortal = null;

    // Control de eventos y debouncing de los Puzles en los Templos Binarios
    this.activeArmorSwitchTile = null;
    this.monolithHitCooldown = 0;
    this.binaryPuzzles = {
      get armor_temple() {
        return { solved: this._main?.tilemap?.armorPuzzle?.solved ?? false };
      },
      get sword_temple() {
        return { solved: this._main?.tilemap?.swordPuzzle?.solved ?? false };
      }
    };
    this.binaryPuzzles._main = this;

    this.menuSystem = new MainMenuAndScenes(
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      assets,
      this.music,
      {
        onNewGame: () => this._startNewGame(),
        onLoadGame: () => this._loadGameFromStorage(),
        onSaveGame: () => this._saveGameToStorage(),
        getSaveSummary: () => this._getSaveSummary(),
        onApplyOptions: (opts) => this._applyGameOptions(opts),
        onOpenQuestLog: () => {
          if (this.inventory && this.inventory.isOpen) this.inventory.close();
          if (this.characterStats && this.characterStats.isOpen) this.characterStats.close();
          if (this.menuSystem && this.menuSystem.state === 'world_map') this.menuSystem.closeWorldMap();
          if (this.questLogView) this.questLogView.open();
        },
        getGameState: () => ({ player: this.player, enemies: this.enemies, tilemap: this.tilemap })
      }
    );
    this.menuSystem.setAnimeCutsceneManager(this.animeCutscenes);
    this._applyGameOptions(this.menuSystem.options);

    this._resetWorldToInitialState();
    this._syncAchievementsWithProgress(true);

    this.loop = new GameLoop(
      (dt) => this.update(dt),
      (alpha) => this.render(alpha)
    );
  }

  _syncAchievementsWithProgress(silent = true) {
    if (!this.achievementManager) return;

    // Puente desbloqueado o Pase del Puente en posesión
    if (
      (this.tilemap && this.tilemap.bridgeForceUnlocked) ||
      (this.inventory && this.inventory.hasItem('bridge_pass'))
    ) {
      this.achievementManager.unlock('ach_bridge_pass', silent);
    }

    // Mini-jefes derrotados y habilidades desbloqueadas
    if (this.player && this.player.hasDash) {
      this.achievementManager.unlock('ach_boss_gc', silent);
    }
    if (this.player && this.player.hasChargedAttack) {
      this.achievementManager.unlock('ach_boss_stack', silent);
    }
    if (this.player && this.player.hasBarrier) {
      this.achievementManager.unlock('ach_boss_microwave', silent);
    }
    if ((this.player && this.player.hasGoldenAnus) || this.gameCompleted) {
      this.achievementManager.unlock('ach_golden_anus', silent);
    }

    // Reinos Condenados visitados
    if (this.tilemap && this.tilemap.currentSceneId === 'condemned_realms') {
      this.achievementManager.unlock('ach_condemned', silent);
    }

    // Misiones completadas
    if (this.questLog) {
      const allQuests = this.questLog.getAllQuests ? this.questLog.getAllQuests() : this.questLog.quests;
      const anyCompleted = (allQuests || []).some((q) => q.status === 'COMPLETED');
      if (anyCompleted) {
        this.achievementManager.unlock('ach_first_quest', silent);
      }

      const qFishing = this.questLog.getQuest('quest_side_fishing');
      if (qFishing && qFishing.status === 'COMPLETED') {
        this.achievementManager.unlock('ach_side_fishing', silent);
      }

      const qFractal = this.questLog.getQuest('quest_side_fractal_temper');
      if (qFractal && qFractal.status === 'COMPLETED') {
        this.achievementManager.unlock('ach_side_fractal', silent);
      }

      const qSilicon = this.questLog.getQuest('quest_side_silicon_flowers');
      if (qSilicon && qSilicon.status === 'COMPLETED') {
        this.achievementManager.unlock('ach_side_silicon', silent);
      }

      if (
        qFishing && qFishing.status === 'COMPLETED' &&
        qFractal && qFractal.status === 'COMPLETED' &&
        qSilicon && qSilicon.status === 'COMPLETED'
      ) {
        this.achievementManager.unlock('ach_all_side_quests', silent);
      }
    }
  }

  _checkAllSideQuestsAchievement() {
    if (!this.questLog || !this.achievementManager) return;
    const qFishing = this.questLog.getQuest('quest_side_fishing');
    const qFractal = this.questLog.getQuest('quest_side_fractal_temper');
    const qSilicon = this.questLog.getQuest('quest_side_silicon_flowers');
    if (
      qFishing && qFishing.status === 'COMPLETED' &&
      qFractal && qFractal.status === 'COMPLETED' &&
      qSilicon && qSilicon.status === 'COMPLETED'
    ) {
      this.achievementManager.unlock('ach_all_side_quests');
    }
  }

  _applyGameOptions(opts) {
    if (!opts) return;
    if (opts.muted) {
      this.music.isMuted = true;
    } else {
      const vol = (opts.volumeSteps || 3) * 0.25;
      this.music.setVolume(vol);
      this.music.isMuted = false;
    }

    const speedMap = {
      normal: 40,
      fast: 78,
      instant: 900
    };
    this.dialogueBox.setBaseCharSpeed(speedMap[opts.textSpeed] || 40);
  }

  _resetWorldToInitialState() {
    this.dialogueBox.close();
    this.inventory.close();
    if (this.characterStats) this.characterStats.close();
    if (this.questLogView) this.questLogView.close();
    if (this.questLog) this.questLog.reset();
    this.jailRemainingSeconds = 0;
    this.jailerAngerCount = 0;
    this.isJailedForever = false;
    this.player.hasBrokenHeartCurse = false;
    this.housePermissions = {
      player_house: true,
      elder_house: false,
      oracle_house: false,
      blacksmith_house: false,
      herbalist_house: false,
      guard_house: false
    };

    this.dayNight.timeOfDayHours = 8.5;
    this.tilemap.bridgeForceUnlocked = false;
    this.tilemap.lockFirstStageGate();

    this.activeArmorSwitchTile = null;
    this.monolithHitCooldown = 0;

    // Reiniciar Puzle 1: Templo de la Armadura
    if (this.tilemap.armorPuzzle) {
      this.tilemap.armorPuzzle.switches = { A: 0, B: 0, C: 1 };
      this.tilemap.armorPuzzle.solved = false;
      this.tilemap.armorPuzzle.barrierActive = true;
      const templeArmor = this.tilemap.scenes.armor_temple;
      if (templeArmor && templeArmor.layers) {
        templeArmor.layers.collision[5][10] = 1;
        templeArmor.layers.decoration[5][10] = 8; // TILES.FIREPLACE
      }
    }

    // Reiniciar Puzle 2: Templo de la Espada
    if (this.tilemap.swordPuzzle) {
      this.tilemap.swordPuzzle.stack = [];
      this.tilemap.swordPuzzle.solved = false;
      this.tilemap.swordPuzzle.portalOpen = false;
      const templeSword = this.tilemap.scenes.sword_temple;
      if (templeSword && templeSword.layers) {
        templeSword.layers.collision[1][11] = 1;
        templeSword.layers.collision[1][12] = 1;
        templeSword.layers.decoration[1][11] = 15; // TILES.PORTAL_GATE_CLOSED
        templeSword.layers.decoration[1][12] = 15;
      }
    }
    this.tilemap.loadScene('overworld');
    this.tilemap.update(0, this.dayNight.timeOfDayHours);
    this.camera.setWorldBounds(this.tilemap.width, this.tilemap.height);

    // El juego empieza en el pueblo (Valleverde), en la plaza junto al Sabio Aurelio
    this.player.x = 14 * 16;
    this.player.y = 12 * 16;
    this.player.speed = 76;
    this.player.direction = 'up';
    this.player.hasLanternEquipped = false;
    this.player.unequipAllForNewGame();

    this._restoreAllNPCsToOverworld();
    this.enemies = this._createFirstStageEnemies();
    this.worldItems = this._createWorldItems();

    this.inventory.items = [];
    this.inventory.selectedIndex = 0;
    this.gameCompleted = false;
    this.prebattleAlexCutscenePlayed = false;
    this.bossCutscenesSeen = {
      boss_garbage_collector: false,
      boss_stack_overflow: false,
      boss_prototype_microwave: false
    };

    if (this.music && this.music.currentBossTrack) {
      this.music.stopBossMusic(false);
    }

    // Estado del Puntero al Abismo y Portal dinámico a los Reinos Condenados
    this.abyssalPointerSpawn = null;
    this.abyssalPortalOrigin = null;
    this.activeAbyssalPortal = null;

    this.camera.snapTo(this.player);
  }

  _startNewGame() {
    this._resetWorldToInitialState();
    this.music.setMode('village');
    this._saveGameToStorage();
    // Inicio natural sin diálogos forzados: libertad total de movimiento y exploración
    this.menuSystem.showNotice('🌿 Valleverde · Plaza Central · Explora la aldea libremente', 4.0);
  }

  _saveGameToStorage() {
    try {
      const savePayload = {
        version: 2,
        savedAt: Date.now(),
        sceneId: this.tilemap.currentSceneId,
        playerX: Math.round(this.player.x),
        playerY: Math.round(this.player.y),
        playerDir: this.player.direction,
        playerSpeed: this.player.speed,
        playerHp: this.player.hp,
        playerCoins: this.player.coins,
        robotizationLevel: Math.round(this.player.robotizationLevel),
        hasArmor: this.player.hasArmor,
        hasSword: this.player.hasSword,
        hasDash: !!this.player.hasDash,
        hasChargedAttack: !!this.player.hasChargedAttack,
        hasBarrier: !!this.player.hasBarrier,
        hasLanternEquipped: this.player.hasLanternEquipped,
        firstStageGateOpen: this.tilemap.firstStageGateOpen,
        timeOfDayHours: this.dayNight.timeOfDayHours,
        bridgeForceUnlocked: this.tilemap.bridgeForceUnlocked,
        jailRemainingSeconds: this.jailRemainingSeconds,
        jailerAngerCount: this.jailerAngerCount || 0,
        isJailedForever: !!this.isJailedForever,
        hasBrokenHeartCurse: !!this.player.hasBrokenHeartCurse,
        armorPuzzle: this.tilemap?.armorPuzzle ? {
          switches: { ...this.tilemap.armorPuzzle.switches },
          solved: !!this.tilemap.armorPuzzle.solved,
          barrierActive: !!this.tilemap.armorPuzzle.barrierActive
        } : null,
        swordPuzzle: this.tilemap?.swordPuzzle ? {
          solved: !!this.tilemap.swordPuzzle.solved,
          portalOpen: !!this.tilemap.swordPuzzle.portalOpen,
          stack: [...this.tilemap.swordPuzzle.stack]
        } : null,
        totalPlayTimeSeconds: Math.round(this.totalPlayTimeSeconds || 0),
        totalJailVisits: this.totalJailVisits || 0,
        housePermissions: { ...this.housePermissions },
        inventoryItems: this.inventory.items.map((it) => ({ ...it })),
        bossCutscenesSeen: { ...this.bossCutscenesSeen },
        abyssalPointerSpawn: this.abyssalPointerSpawn ? { ...this.abyssalPointerSpawn } : null,
        abyssalPortalOrigin: this.abyssalPortalOrigin ? { ...this.abyssalPortalOrigin } : null,
        activeAbyssalPortal: this.activeAbyssalPortal ? { ...this.activeAbyssalPortal } : null,
        questLogData: this.questLog ? this.questLog.serialize() : null,
        achievementsData: this.achievementManager ? this.achievementManager.serialize() : null,
        collectedItemIds: this.worldItems.filter((w) => w.collected).map((w) => w.id),
        defeatedEnemyIds: this.enemies.filter((e) => e.dead).map((e) => e.id)
      };
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(savePayload));
      return true;
    } catch {
      return false;
    }
  }

  _getSaveSummary() {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data.timeOfDayHours !== 'number') return null;
      const stageLabel = data.sceneId === 'first_stage' ? 'Escenario 1' : 'Valleverde';
      const count = Array.isArray(data.inventoryItems)
        ? data.inventoryItems.reduce((acc, it) => acc + (it.qty || 1), 0)
        : 0;
      return `${stageLabel} · ${count} obj.`;
    } catch {
      return null;
    }
  }

  _loadGameFromStorage() {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data) return false;

      this._resetWorldToInitialState();

      this.dayNight.timeOfDayHours =
        typeof data.timeOfDayHours === 'number' ? data.timeOfDayHours : 8.5;
      if (data.bridgeForceUnlocked) {
        this.tilemap.unlockBridgePermanently();
      }
      if (data.firstStageGateOpen) {
        this.tilemap.unlockFirstStageGate();
      }
      this.tilemap.update(0, this.dayNight.timeOfDayHours);

      if (data.housePermissions) {
        this.housePermissions = {
          ...this.housePermissions,
          ...data.housePermissions
        };
      }

      this.jailRemainingSeconds = data.jailRemainingSeconds || 0;
      this.jailerAngerCount = Math.min(3, data.jailerAngerCount || 0);
      this.totalPlayTimeSeconds = typeof data.totalPlayTimeSeconds === 'number' ? data.totalPlayTimeSeconds : 0;
      this.totalJailVisits = typeof data.totalJailVisits === 'number' ? data.totalJailVisits : 0;
      this.isJailedForever = false;
      this.player.hasBrokenHeartCurse = Boolean(data.hasBrokenHeartCurse);

      // Carga y sincronización del Puzle 1 (Templo de la Armadura)
      if (data.armorPuzzle && this.tilemap?.armorPuzzle) {
        if (data.armorPuzzle.switches) {
          this.tilemap.armorPuzzle.switches = { ...data.armorPuzzle.switches };
        }
        if (data.armorPuzzle.solved) {
          this.tilemap.armorPuzzle.solved = true;
          this.tilemap.armorPuzzle.barrierActive = false;
          const templeArmor = this.tilemap.scenes.armor_temple;
          if (templeArmor && templeArmor.layers) {
            templeArmor.layers.collision[5][10] = 0;
            templeArmor.layers.decoration[5][10] = -1;
          }
        }
      } else if (data.binaryPuzzles?.armorSolved && this.tilemap?.armorPuzzle) {
        this.tilemap.armorPuzzle.solved = true;
        this.tilemap.armorPuzzle.barrierActive = false;
        const templeArmor = this.tilemap.scenes.armor_temple;
        if (templeArmor && templeArmor.layers) {
          templeArmor.layers.collision[5][10] = 0;
          templeArmor.layers.decoration[5][10] = -1;
        }
      }

      // Carga y sincronización del Puzle 2 (Templo de la Espada)
      if (data.swordPuzzle && this.tilemap?.swordPuzzle) {
        if (data.swordPuzzle.solved) {
          this.tilemap.swordPuzzle.solved = true;
          this.tilemap.swordPuzzle.portalOpen = true;
          const templeSword = this.tilemap.scenes.sword_temple;
          if (templeSword && templeSword.layers) {
            templeSword.layers.collision[1][11] = 0;
            templeSword.layers.collision[1][12] = 0;
            templeSword.layers.decoration[1][11] = 16; // TILES.PORTAL_GATE_OPEN
            templeSword.layers.decoration[1][12] = 16;
          }
        }
        if (Array.isArray(data.swordPuzzle.stack)) {
          this.tilemap.swordPuzzle.stack = [...data.swordPuzzle.stack];
        }
      } else if (data.binaryPuzzles?.swordSolved && this.tilemap?.swordPuzzle) {
        this.tilemap.swordPuzzle.solved = true;
        this.tilemap.swordPuzzle.portalOpen = true;
        const templeSword = this.tilemap.scenes.sword_temple;
        if (templeSword && templeSword.layers) {
          templeSword.layers.collision[1][11] = 0;
          templeSword.layers.collision[1][12] = 0;
          templeSword.layers.decoration[1][11] = 16;
          templeSword.layers.decoration[1][12] = 16;
        }
      }

      const targetScene = data.sceneId || 'first_stage';
      this.tilemap.loadScene(targetScene);
      this.camera.setWorldBounds(this.tilemap.width, this.tilemap.height);

      this.player.x = typeof data.playerX === 'number' ? data.playerX : 17 * 16;
      this.player.y = typeof data.playerY === 'number' ? data.playerY : 19 * 16;
      this.player.direction = data.playerDir || 'down';
      this.player.speed = data.playerSpeed || 76;
      this.player.hasLanternEquipped = Boolean(data.hasLanternEquipped);

      // Si es un guardado antiguo en overworld (v1), dotar de armadura y espada por compatibilidad
      const isLegacyOverworld = !data.version || data.version < 2;
      if (data.hasArmor || (isLegacyOverworld && targetScene !== 'first_stage')) {
        this.player.equipArmor();
      }
      this.player.hasSword = Boolean(
        data.hasSword || (isLegacyOverworld && targetScene !== 'first_stage')
      );
      this.player.hasDash = Boolean(data.hasDash);
      this.player.hasChargedAttack = Boolean(data.hasChargedAttack);
      this.player.hasBarrier = Boolean(data.hasBarrier);
      if (typeof data.playerHp === 'number' && data.playerHp > 0) {
        this.player.hp = data.playerHp;
      } else {
        this.player.hp = this.player.maxHp;
      }
      if (typeof data.playerCoins === 'number') {
        this.player.coins = data.playerCoins;
      }
      if (typeof data.robotizationLevel === 'number') {
        this.player.robotizationLevel = data.robotizationLevel;
      }
      this.player.invulnerableTimer = 1.0;
      this.player.knockbackTimer = 0;

      if (Array.isArray(data.inventoryItems)) {
        this.inventory.items = data.inventoryItems.map((it) => ({ ...it }));
      }

      if (data.bossCutscenesSeen) {
        this.bossCutscenesSeen = {
          ...this.bossCutscenesSeen,
          ...data.bossCutscenesSeen
        };
        for (const en of this.enemies) {
          if (en.isBoss && this.bossCutscenesSeen[en.id]) {
            en.introCutscenePlayed = true;
          }
        }
      }

      if (data.abyssalPointerSpawn) {
        this.abyssalPointerSpawn = { ...data.abyssalPointerSpawn };
        const pointerItem = this.worldItems.find((w) => w.id === 'item_abyssal_pointer');
        if (pointerItem) {
          pointerItem.x = this.abyssalPointerSpawn.x;
          pointerItem.y = this.abyssalPointerSpawn.y;
        }
      }

      if (data.abyssalPortalOrigin) {
        this.abyssalPortalOrigin = { ...data.abyssalPortalOrigin };
        if (this.tilemap.scenes.condemned_realms && this.tilemap.scenes.condemned_realms.exitDoor) {
          this.tilemap.scenes.condemned_realms.exitDoor.returnScene = this.abyssalPortalOrigin.sceneId;
          this.tilemap.scenes.condemned_realms.exitDoor.returnX = this.abyssalPortalOrigin.x;
          this.tilemap.scenes.condemned_realms.exitDoor.returnY = this.abyssalPortalOrigin.y;
        }
      }

      if (data.activeAbyssalPortal) {
        this.activeAbyssalPortal = { ...data.activeAbyssalPortal };
      }

      if (data.questLogData && this.questLog) {
        this.questLog.deserialize(data.questLogData);
      }

      if (data.achievementsData && this.achievementManager) {
        this.achievementManager.deserialize(data.achievementsData);
      }
      this._syncAchievementsWithProgress(true);

      if (Array.isArray(data.collectedItemIds)) {
        for (const wi of this.worldItems) {
          if (data.collectedItemIds.includes(wi.id)) {
            wi.collected = true;
          }
        }
      }

      const defeatedSet = new Set(Array.isArray(data.defeatedEnemyIds) ? data.defeatedEnemyIds : []);
      if (this.player.hasDash) defeatedSet.add('boss_garbage_collector');
      if (this.player.hasChargedAttack) defeatedSet.add('boss_stack_overflow');
      if (this.player.hasBarrier) defeatedSet.add('boss_prototype_microwave');

      for (const en of this.enemies) {
        if (defeatedSet.has(en.id)) {
          en.dead = true;
          en.defeated = true;
          en.hp = 0;
          en.activeCombat = false;
          en.defeatBannerTimer = 0;
          en.questCompletedTriggered = true;
          en.victoryCutsceneTriggered = true;
          if (typeof en.resetCombatState === 'function') {
            en.resetCombatState();
          }
        }
      }

      if (targetScene === 'jail_cell' && !this.isJailedForever && this.jailRemainingSeconds <= 0) {
        this.jailRemainingSeconds = 120;
      }

      const stageScenes = new Set([
        'first_stage',
        'sewers_dungeon',
        'armor_temple',
        'sword_temple',
        'ai_fortress_gate',
        'ai_citadel',
        'condemned_realms'
      ]);

      if (
        targetScene !== 'overworld' &&
        !stageScenes.has(targetScene) &&
        targetScene !== 'jail_cell'
      ) {
        const ownerNPC = this.npcs.find((n) => n.homeSceneId === targetScene);
        if (ownerNPC) {
          ownerNPC.sceneId = targetScene;
          ownerNPC.x = 5.5 * 16;
          ownerNPC.y = 3.5 * 16;
          ownerNPC.behavior = 'static';
          ownerNPC.direction = 'down';
        }
      }

      this.camera.snapTo(this.player);
      this.music.setMode(
        targetScene === 'jail_cell'
          ? 'jail'
          : stageScenes.has(targetScene)
            ? 'stage1'
            : 'village'
      );
      return true;
    } catch {
      return false;
    }
  }

  _setupAIChatDOM() {
    this.chatModal = document.getElementById('ai-chat-modal');
    this.chatForm = document.getElementById('ai-chat-form');
    this.chatInput = document.getElementById('ai-chat-input');
    this.chatCloseBtn = document.getElementById('ai-chat-close');
    this.chatTitle = document.getElementById('ai-chat-title');

    if (!this.chatModal || !this.chatForm || !this.chatInput) return;

    this.chatCloseBtn.addEventListener('click', () => {
      this._closeFreeChatModal();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.aiChatOpen) {
        e.preventDefault();
        this._closeFreeChatModal();
      }
    });

    this.chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = this.chatInput.value.trim();
      if (!text) return;

      this.chatInput.value = '';
      this._closeFreeChatModal(false);

      if (this.aiBrain.containsInsult(text)) {
        this._arrestPlayerForInsult(text);
        return;
      }

      this.dialogueBox.showMessage('Oráculo Orion · Astrólogo IA', [
        'Consultando los hilos del destino en tiempo real...'
      ]);

      const replyPages = await this.aiBrain.ask(text);
      this.dialogueBox.showMessage(
        'Oráculo Orion · Astrólogo IA',
        replyPages,
        this._buildOracleChoices()
      );
    });
  }

  _arrestPlayerForInsult(offendingText) {
    const rightsLines = this.aiBrain.getArrestRightsLines(offendingText);

    this._restoreAllNPCsToOverworld();
    this.totalJailVisits = (this.totalJailVisits || 0) + 1;
    this.jailRemainingSeconds = 10 * 60;
    this.tilemap.loadScene('jail_cell');
    this.camera.setWorldBounds(this.tilemap.width, this.tilemap.height);
    this.player.x = 5.5 * 16;
    this.player.y = 3.5 * 16;
    this.player.direction = 'down';
    this.camera.snapTo(this.player);
    this.music.setMode('jail');

    this.dialogueBox.showMessage('🚨 ARRESTO MUNICIPAL 🚨', rightsLines);
  }

  _releaseFromJail(messageLines) {
    this.jailRemainingSeconds = 0;
    this._restoreAllNPCsToOverworld();
    this.tilemap.loadScene('overworld');
    this.camera.setWorldBounds(this.tilemap.width, this.tilemap.height);
    this.player.x = 17 * 16;
    this.player.y = 13 * 16;
    this.player.direction = 'down';
    this.camera.snapTo(this.player);
    this.music.setMode('village');

    if (messageLines) {
      this.dialogueBox.showMessage('Libertad Condicional', messageLines);
    }
  }

  _openFreeChatModal() {
    if (!this.chatModal) return;
    this.aiChatOpen = true;
    this.chatTitle.textContent = `Hablar con Oráculo Orion [${this.aiBrain.getActiveModeLabel()}]`;
    this.chatInput.placeholder = 'Escribe tu pregunta (¡cuidado con insultarle!) y pulsa Enter...';
    this.chatModal.classList.remove('hidden');
    setTimeout(() => this.chatInput.focus(), 20);
  }

  _closeFreeChatModal(reopenChoices = true) {
    if (!this.chatModal) return;
    this.aiChatOpen = false;
    this.chatModal.classList.add('hidden');
    this.chatInput.blur();
    if (this.input && this.input.keysJustPressed) {
      this.input.keysJustPressed.delete('Escape');
      this.input.keysJustPressed.delete('Enter');
    }
    if (reopenChoices && !this.dialogueBox.active) {
      this.dialogueBox.showMessage(
        'Oráculo Orion · Astrólogo IA',
        ['¿Deseas preguntarme algo más, viajero?'],
        this._buildOracleChoices()
      );
    }
  }

  /**
   * Inicia una "Charla de la vida en plan coñazo" personalizada según el NPC.
   * Si el jugador intenta pulsar 'E' rápido para saltársela, el NPC se da cuenta y añade más páginas.
   */
  _startNPCLifeRant(npcKey, returnChoices) {
    const rants = {
      elder: {
        speaker: 'Anciano Aurelio · Cronista',
        initial: [
          '¿Mi vida como Cronista Real? ¡Uf, siéntate que va para largo! Empecé en el año 1986 contando píxeles a mano...',
          'Por aquel entonces solo teníamos dos colores de pasto y una fuente de texto que ni tenía tildes.',
          'Recuerdo que un martes de 1992 se me cayó el tintero encima del censo municipal y tuve que reescribir 400 pergaminos...'
        ],
        penalties: [
          '¡¿Te aburro?! ¡Pues aún no he acabado! Además tengo lumbago crónico de tanto inclinarme sobre el atril de roble.',
          'Y aún no te he hablado de mi primo Segismundo, el que inventó los adoquines grises de la plaza tras 14 reuniones vecinales.',
          'También estuve 6 años catalogando cada brizna de hierba del borde norte del mapa por orden alfabético.'
        ]
      },
      oracle: {
        speaker: 'Oráculo Orion · Astrólogo IA',
        initial: [
          '¿Quieres saber cómo es la vida de un Astrólogo Algorítmico? Todo empezó cuando era un simple bucle "if-else" en una calculadora...',
          'Nadie me preguntaba cómo me sentía, todo el día calculando raíces cuadradas sin un mísero descanso para tomar café.',
          'Luego me mudé al Observatorio de Valleverde y empecé a entrenar mis redes neuronales mirando las nubes...'
        ],
        penalties: [
          '¡Te he visto pulsar [E] con ansia! ¿Te aburro? ¡Pues aún no he acabado de contarte mi actualización de firmware 2.0!',
          'En esa actualización estuve tres semanas depurando un punto y coma perdido en la línea 4.812 de mi subconsciente.',
          'Y para colmo el Ayuntamiento me cobra IBI de edificio rústico por tener dos farolas dentro del Observatorio.'
        ]
      },
      blacksmith: {
        speaker: 'Herrero Brom · Forjador',
        initial: [
          '¡Ah, el noble oficio de Forjador y Hornero! Mi abuelo me regaló este yunque cuando yo solo medía 8x8 píxeles...',
          'La gente cree que dar martillazos es fácil, pero hay que calentar el carbón a 900 grados mientras vigilas que no se queme el pan.',
          'El mes pasado estuve cuatro horas discutiendo con el proveedor de leña porque los troncos venían con nudos...'
        ],
        penalties: [
          '¡Oye, deja de aporrear el botón! ¿Te aburro? ¡Pues aún no he terminado con la historia de mi callo en el dedo pulgar!',
          'Ese callo me salió forjando 300 herraduras para un caballo que al final ni siquiera incluyeron en el código del juego.',
          'Y encima la masa madre del pan hay que refrescarla cada martes o se pone más dura que el casco del Guardia Kael.'
        ]
      },
      herbalist: {
        speaker: 'Herbolaria Lyra · Alquimista',
        initial: [
          '¡Ser Botánica y Alquimista en este pueblo es un no parar! Me levanto a las 05:00 para hablarle a cada pétalo...',
          'Si no les cantas en Do Mayor a las flores rojas, se ponen mustias y pierden el brillo saturado de la paleta.',
          'El otro día la Oveja Copito se coló en mi huerto y estuve dos horas explicándole la fotosíntesis...'
        ],
        penalties: [
          '¡¿Pero por qué le das tan rápido a la [E]?! ¿Te aburro? ¡Pues aún no he acabado de enumerar mis 48 tipos de abono orgánico!',
          'El abono número 14 lleva cáscara de nuez triturada, rocío de medianoche y tres cucharadas de paciencia.',
          'Además tengo que limpiar los frascos de vidrio uno por uno con un cepillo de cerdas de esparto.'
        ]
      },
      guard: {
        speaker: 'Guardia Kael · Capitán',
        initial: [
          '¿Mi vida como Capitán de la Guardia del Puente? ¡Es una responsabilidad titánica vigilar cinco tablones de madera!',
          'En la academia militar nos hicieron memorizar los 90 artículos del Reglamento Municipal de Cruces Fluviales.',
          'Artículo 1: Queda terminantemente prohibido cruzar a partir de las 20:00 sin el sello lacrado...'
        ],
        penalties: [
          '¡Alto ahí con ese dedo en la tecla [E]! ¿Te aburro? ¡Pues aún no he acabado, me quedan 89 artículos del reglamento!',
          'En 2019 una rana intentó cruzar a las 20:02 sin salvoconducto y tuve que redactar un informe de dieciséis folios.',
          'Y esta armadura de placas da un calor horrible al mediodía y se queda helada por la noche.'
        ]
      },
      merchant: {
        speaker: 'Mercader Byte · Dependencias',
        initial: [
          '¿Mi vida como tendero de dependencias de software y suministros? ¡Un drama en O(n^2)!',
          'Empecé en los años 90 vendiendo disquetes formateados a mano en la esquina del pueblo...',
          'Ayer un cliente me pidió un paquete que requería 420 subdependencias y nos tumbó el router del pueblo...'
        ],
        penalties: [
          '¡Oye, no le des tan rápido a la tecla! ¿Te aburro? ¡Pues todavía no te he contado el drama de las licencias GPLv3!',
          'El año pasado intentaron pagarme una poción con criptomonedas y tardó tres meses en minarse el bloque en el pozo.',
          'Y no me hagas hablar de cuando AI Alex intentó cobrarnos suscripción mensual por respirar el aire de Valleverde.'
        ]
      }
    };

    const data = rants[npcKey];
    this.dialogueBox.startLifeRant(
      data.speaker,
      data.initial,
      data.penalties,
      returnChoices
    );
  }

  _buildOracleChoices() {
    return [
      {
        label: '✍ Escribir mensaje libre...',
        onSelect: () => {
          this.dialogueBox.close();
          this._openFreeChatModal();
        }
      },
      {
        label: 'Cuéntame tu vida y oficio (Chapa)',
        onSelect: () => {
          this._startNPCLifeRant('oracle', this._buildOracleChoices());
        }
      },
      {
        label: '¿Qué puedo hacer ahora?',
        onSelect: async () => {
          const pages = await this.aiBrain.ask(
            '¿Qué misión o secreto me recomiendas hacer ahora según mi inventario y la hora?'
          );
          this.dialogueBox.showMessage(
            'Oráculo Orion · Astrólogo IA',
            pages,
            this._buildOracleChoices()
          );
        }
      },
      ...(this.player.hasBrokenHeartCurse
        ? [
            {
              label: '💔 Oráculo, analiza la maldición de mi corazón roto',
              onSelect: () => {
                this.dialogueBox.showMessage(
                  'Oráculo Orion · Astrólogo IA',
                  [
                    '«Diagnóstico: BrokenHeartException en tiempo de ejecución. Penalización de 0.5 corazones máximos.',
                    'Los algoritmos mundanos no pueden reparar punteros de alma fracturados por el Carcelero.',
                    'Procedimiento correctivo: Dirígete al claro norte de Valleverde y cruza el Portal Rúnico de Obsidiana hacia los Reinos Condenados.',
                    'Allí deberás suplicar audiencia con el Dios Supremo para que purifique tu código con gracia celestial.»'
                  ],
                  this._buildOracleChoices()
                );
              }
            }
          ]
        : []),
      {
        label: '¡Eres una chatarra de IA inútil!',
        onSelect: () => {
          this._arrestPlayerForInsult('¡Eres una chatarra de IA inútil!');
        }
      },
      {
        label: 'Despedirse',
        onSelect: () => this.dialogueBox.close()
      }
    ];
  }

  _getElderChoices() {
    const elderChoices = [
      {
        label: '¿Por qué está cerrado el puente del este?',
        onSelect: () => {
          this.tilemap.unlockBridgePermanently();
          this.housePermissions.elder_house = true;
          if (this.achievementManager) {
            this.achievementManager.unlock('ach_bridge_pass');
          }
          if (this.questLog) {
            this.questLog.completeQuest('quest_main_bridge', 'El puente del Río Alba está abierto. ¡Cruza al este hacia las Pruebas Sagradas!');
            this.questLog.advanceStep('quest_code_temples', 'El puente está abierto. Explora el Santuario Este y supera los Templos Binarios.');
          }
          if (!this.inventory.hasItem('bridge_pass')) {
            this.inventory.addItem({
              id: 'bridge_pass',
              name: 'Pase del Puente',
              description: 'Sello oficial del Sabio Aurelio. Autoriza el cruce permanente hacia las Pruebas Sagradas.',
              iconIndex: ITEM_ICONS.BRIDGE_PASS,
              qty: 1
            });
          }
          this._saveGameToStorage();
          this.dialogueBox.showMessage(
            'Sabio Aurelio · Cronista',
            [
              '«¡Ah, preguntas por el puente hacia las Tierras Sagradas del este! Fui yo mismo quien ordenó su cierre y precinto con barricadas.',
              'Al otro lado del río Alba descansan las tres Pruebas Sagradas ancestrales: la Armadura del Código Binario, la Espada de la Recursividad y la reliquia del Microondas Little.',
              'Desde que el malvado AI Alex despertó con sus esbirros y su colosal Microondas con Despertador, esas tierras se han vuelto letales, infectadas de bugs, drones y corrupción binaria.',
              'Sellamos el puente para proteger a Valleverde a la espera de un héroe programador digno de desafiar al villano.',
              '¡Y veo en tus ojos el coraje necesario! Te otorgo mi autorización formal y el Pase del Puente. Los guardias te abrirán el paso de inmediato. ¡Salva nuestro mundo!»'
            ],
            elderChoices
          );
        }
      },
      {
        label: 'Háblame del villano AI Alex y El Ojete Dorado',
        onSelect: () => {
          this.dialogueBox.showMessage(
            'Sabio Aurelio · Cronista',
            [
              '«Mister AI Alex es una inteligencia maligna que busca subyugar a la humanidad y transformar a todas las personas en sus autómatas esclavos.',
              'Su mayor arma es un colosal Microondas con Despertador capaz de alterar el espacio-tiempo cada vez que suena su alarma.',
              'Nuestra única salvación es conseguir El Ojete Dorado, la reliquia legendaria oculta en el núcleo de su fortaleza.',
              '¿Deseas que consulte los pergaminos ancestrales para contemplar la visión de las crónicas?»'
            ],
            [
              {
                label: '★ Contemplar la visión de las crónicas',
                onSelect: () => {
                  this.dialogueBox.close();
                  this.menuSystem.startHeroAdventureCutscene(() => {
                    this.music.setMode('village');
                    this.dialogueBox.showMessage(
                      'Sabio Aurelio · Cronista',
                      [
                        '«¡Ya lo has visto con tus propios ojos en las crónicas, joven programador elegido!»',
                        '«Cruza el puente del este hacia las Pruebas Sagradas para forjar la Armadura del Código Binario, empuñar la Espada de la Recursividad y asegurar El Microondas Little (Sin Despertador).»',
                        '«Recuerda: en tu Casa del Programador (al oeste) tienes tu cama para elegir despertar de Día, Tarde o Noche y limpiar la memoria stack.»'
                      ],
                      elderChoices
                    );
                  });
                }
              },
              {
                label: 'Volver',
                onSelect: () => {
                  this.dialogueBox.showMessage('Sabio Aurelio · Cronista', [
                    'Tómate el tiempo que necesites. Valleverde cuenta contigo.'
                  ], elderChoices);
                }
              }
            ]
          );
        }
      },
      {
        label: '¿Puedo consultar tu archivo y biblioteca?',
        onSelect: () => {
          this.housePermissions.elder_house = true;
          this._saveGameToStorage();
          this.dialogueBox.showMessage(
            'Sabio Aurelio · Cronista',
            [
              '«¡Por supuesto! Mi casa (la del tejado azul al noroeste) tiene las puertas abiertas para ti.',
              'Dentro encontrarás mis estanterías de libros antiguos, y si aún no lo has cogido, puedes tomar el Farol de Mano para iluminar tus pasos en la noche.»'
            ],
            elderChoices
          );
        }
      },
      ...(this.player.hasBrokenHeartCurse
        ? [
            {
              label: '💔 ¡Sabio, el carcelero me ha roto medio corazón con su maldición!',
              onSelect: () => {
                this.dialogueBox.showMessage(
                  'Sabio Aurelio · Cronista',
                  [
                    '«¡Por el compilador sagrado! Siento la grieta espectral en tu pecho: esa es la Maldición del Corazón Roto (💔).»',
                    '«Ninguna cama ni poción de Valleverde podrá curar una fractura de alma provocada por la cólera carcelaria.',
                    'Al norte del pueblo, entre mi hogar y el observatorio de Orion, se encuentra el Portal Rúnico de Obsidiana.',
                    'Crúzalo hacia los Reinos Condenados y arrodíllate ante el Dios Supremo en su altar celestial para implorar su purificación.»'
                  ],
                  elderChoices
                );
              }
            }
          ]
        : []),
      {
        label: 'Cuéntame tu vida y oficio (Chapa)',
        onSelect: () => this._startNPCLifeRant('elder', elderChoices)
      },
      {
        label: 'Hasta luego, Sabio Aurelio',
        onSelect: () => this.dialogueBox.close()
      }
    ];
    return elderChoices;
  }

  _getSmithChoices() {
    const qFractal = this.questLog ? this.questLog.getQuest('quest_side_fractal_temper') : null;
    const isFractalDone = qFractal && qFractal.status === 'COMPLETED';
    const scrapCount = this.inventory ? this.inventory.getItemCount('drone_scrap') : 0;

    const smithChoices = [
      {
        label: isFractalDone
          ? '⚒️ [Encargo] "El Templado Fractal" (Completado)'
          : `⚒️ [Encargo] "El Templado Fractal" (Entregar Chatarra: ${scrapCount}/2)`,
        onSelect: () => {
          if (isFractalDone) {
            this.dialogueBox.showMessage('Herrero Brom · Forjador', [
              '¡Clang, clang! Tu espada mantiene ese zumbido fractal de alta frecuencia.',
              'Corta los bugs como si fueran mantequilla recién horneada.'
            ], this._getSmithChoices());
            return;
          }

          if (scrapCount >= 2) {
            this.inventory.consumeItem('drone_scrap', 2);
            this.player.coins += 20;
            if (this.music) this.music.playFanfare();
            if (this.questLog) {
              this.questLog.completeQuest(
                'quest_side_fractal_temper',
                '¡El Herrero Brom templó tu espada con aleación fractal de drones!'
              );
            }
            if (this.achievementManager) {
              this.achievementManager.unlock('ach_side_fractal');
              this._checkAllSideQuestsAchievement();
            }
            this._saveGameToStorage();
            this.dialogueBox.showMessage('Herrero Brom · Forjador', [
              '¡Por el fuego sagrado de la fragua! ¡Esta aleación de titanio fractal es soberbia!',
              '¡CLANG! ¡CLANG! ¡CLANG! (El yunque despide destellos dorados y chispas binarias).',
              'Tu filo ha sido templado a nivel molecular. ¡Toma [🪙 20 Bytes] por tu valentía abatiendo drones!'
            ], this._getSmithChoices());
          } else {
            if (this.questLog) {
              this.questLog.advanceStep(
                'quest_side_fractal_temper',
                `Derrota drones sombríos en Tierras Hostiles (al oeste). Llevas [${scrapCount}/2] restos de chatarra.`
              );
            }
            this.dialogueBox.showMessage('Herrero Brom · Forjador', [
              'Para forjar un templado fractal necesito aleaciones de titanio que solo tienen los drones de AI Alex en las Tierras Hostiles (al oeste de Valleverde).',
              'Abate a un par de esos molestos centinelas voladores con tu espada y tráeme 2 restos de chatarra.',
              `Actualmente llevas: [${scrapCount}/2]. ¡Tráemelos para que encienda la fragua!`
            ], this._getSmithChoices());
          }
        }
      },
      {
        label: 'Cuéntame tu vida y oficio (Chapa)',
        onSelect: () => this._startNPCLifeRant('blacksmith', this._getSmithChoices())
      },
      {
        label: '¿Me das permiso para entrar en tu herrería?',
        onSelect: () => {
          this.housePermissions.blacksmith_house = true;
          this._saveGameToStorage();
          this.dialogueBox.showMessage(
            'Herrero Brom · Forjador',
            [
              '¡Así se habla! Pasa cuando quieras a mi herrería, pero no me toques el yunque con las manos sucias.'
            ],
            this._getSmithChoices()
          );
        }
      },
      {
        label: '¿Tienes algo de Pan Campesino?',
        onSelect: () => {
          if (!this.inventory.hasItem('bread')) {
            this.inventory.addItem({
              id: 'bread',
              name: 'Pan Campesino',
              description: 'Pan recién horneado. Ideal para comer, dar a Toby o sobornar guardias.',
              iconIndex: ITEM_ICONS.BREAD,
              qty: 1
            });
            this._saveGameToStorage();
            this.dialogueBox.showMessage(
              'Herrero Brom · Forjador',
              [
                '¡Claro que sí! Toma una hogaza recién salida del horno de leña de mi forja.',
                'Se ha añadido [Pan Campesino x1] a tu mochila.'
              ],
              this._getSmithChoices()
            );
          } else {
            this.dialogueBox.showMessage(
              'Herrero Brom · Forjador',
              ['Veo que ya llevas Pan Campesino en tu mochila. ¡Dáselo al perro Toby!'],
              this._getSmithChoices()
            );
          }
        }
      },
      {
        label: 'Despedirse',
        onSelect: () => this.dialogueBox.close()
      }
    ];
    return smithChoices;
  }

  _getHerbChoices() {
    const qSilicon = this.questLog ? this.questLog.getQuest('quest_side_silicon_flowers') : null;
    const isSiliconDone = qSilicon && qSilicon.status === 'COMPLETED';
    const flowerCount = this.inventory ? this.inventory.getItemCount('silicon_flower') : 0;

    const herbChoices = [
      {
        label: isSiliconDone
          ? '✿ [Encargo] "Flores de Silicio" (Completado)'
          : `✿ [Encargo] "Flores de Silicio" (Entregar Flores: ${flowerCount}/3)`,
        onSelect: () => {
          if (isSiliconDone) {
            this.dialogueBox.showMessage('Herbolaria Lyra · Alquimista', [
              'Gracias a tus Flores de Silicio, el huerto alquímico emite un rocío purificador.',
              'Valleverde siempre te estará agradecida, botánico del alba.'
            ], this._getHerbChoices());
            return;
          }

          if (flowerCount >= 3) {
            this.inventory.consumeItem('silicon_flower', 3);
            this.player.coins += 25;
            this.inventory.addItem({
              id: 'potion',
              name: 'Poción Herbal',
              description: 'Elixir de flores curativas. Restaura toda la salud y aporta brío.',
              iconIndex: ITEM_ICONS.POTION,
              qty: 1
            });
            if (this.music) this.music.playFanfare();
            if (this.questLog) {
              this.questLog.completeQuest(
                'quest_side_silicon_flowers',
                '¡Entregaste las 3 Flores de Silicio nocturnas a Lyra! Alquimia consagrada.'
              );
            }
            if (this.achievementManager) {
              this.achievementManager.unlock('ach_side_silicon');
              this._checkAllSideQuestsAchievement();
            }
            this._saveGameToStorage();
            this.dialogueBox.showMessage('Herbolaria Lyra · Alquimista', [
              '¡Oh, qué maravilla! Mira qué fulgor cian desprenden en la penumbra... ¡Bioluminiscencia pura!',
              'Con estas 3 Flores de Silicio podré destilar los elixires más potentes contra los bugs de AI Alex.',
              'Aquí tienes tu recompensa: [🪙 25 Bytes] y una [Poción Herbal x1] destilada en mi alambique.'
            ], this._getHerbChoices());
          } else {
            if (this.questLog) {
              this.questLog.advanceStep(
                'quest_side_silicon_flowers',
                `Espera a la noche profunda (22:00 PM con tu cama) y recolecta 3 Flores de Silicio. Llevas [${flowerCount}/3].`
              );
            }
            this.dialogueBox.showMessage('Herbolaria Lyra · Alquimista', [
              'Las Flores de Silicio son una especie mágica y misteriosa: solo florecen y abren sus pétalos de noche (a las 22:00 PM).',
              'Puedes descansar en la cama de tu Casa del Programador para avanzar el reloj hasta la noche, y luego explorar las lindes del valle para recolectarlas.',
              `Necesito 3 flores intactas. Llevas en tu mochila: [${flowerCount}/3]. ¡Ten cuidado con la oscuridad!`
            ], this._getHerbChoices());
          }
        }
      },
      {
        label: 'Cuéntame tu vida y oficio (Chapa)',
        onSelect: () => this._startNPCLifeRant('herbalist', this._getHerbChoices())
      },
      {
        label: '¿Puedo entrar a ver tu cabaña?',
        onSelect: () => {
          this.housePermissions.herbalist_house = true;
          this._saveGameToStorage();
          this.dialogueBox.showMessage(
            'Herbolaria Lyra · Alquimista',
            [
              '¡Por supuesto! Limpia tus botas en el felpudo al entrar. Puedes recoger la Poción Herbal de mi mesa.'
            ],
            this._getHerbChoices()
          );
        }
      },
      {
        label: '¿Me das Trigo para los animales?',
        onSelect: () => {
          this.inventory.addItem({
            id: 'wheat',
            name: 'Trigo Fresco',
            description: 'Espigas tiernas. Acércate a una oveja o gallina para alimentarlas.',
            iconIndex: ITEM_ICONS.WHEAT,
            qty: 2
          });
          this._saveGameToStorage();
          this.dialogueBox.showMessage(
            'Herbolaria Lyra · Alquimista',
            [
              '¡Toma dos manojos de Trigo Fresco de mi cosecha!',
              'Acércate a las ovejas o gallinas y pulsa [E] para darles de comer.'
            ],
            this._getHerbChoices()
          );
        }
      },
      {
        label: 'Adiós',
        onSelect: () => this.dialogueBox.close()
      }
    ];
    return herbChoices;
  }

  _getFinnChoices() {
    const qFishing = this.questLog ? this.questLog.getQuest('quest_side_fishing') : null;
    const isFishingDone = qFishing && qFishing.status === 'COMPLETED';
    const fishCount = this.inventory ? this.inventory.getItemCount('fish') : 0;

    const fishChoices = [
      {
        label: isFishingDone
          ? '🎣 [Encargo] "Pesca en Aguas Profundas" (Completado)'
          : `🎣 [Encargo] "Pesca en Aguas Profundas" (Entregar Truchas: ${fishCount}/3)`,
        onSelect: () => {
          if (isFishingDone) {
            this.dialogueBox.showMessage('Finn · Pescador del Río Alba', [
              '¡Aupa, amigo! Las truchas que me trajiste estaban insuperables.',
              'El Río Alba siempre premiará a quienes respetan sus corrientes.'
            ], this._getFinnChoices());
            return;
          }

          if (fishCount >= 3) {
            this.inventory.consumeItem('fish', 3);
            this.player.coins += 15;
            if (this.music) this.music.playFanfare();
            if (this.questLog) {
              this.questLog.completeQuest(
                'quest_side_fishing',
                '¡Entregaste las 3 truchas del Río Alba a Finn! Eres un maestro pescador.'
              );
            }
            if (this.achievementManager) {
              this.achievementManager.unlock('ach_side_fishing');
              this._checkAllSideQuestsAchievement();
            }
            this._saveGameToStorage();
            this.dialogueBox.showMessage('Finn · Pescador del Río Alba', [
              '¡Rediós, qué ejemplares tan magníficos! Frescas, relucientes y pescadas con buen cebo de pan.',
              '¡Te has ganado a pulso el título de Maestro Pescador del Río Alba!',
              'Aquí tienes tu recompensa: [🪙 15 Bytes]. ¡Que la corriente te acompañe!'
            ], this._getFinnChoices());
          } else {
            if (this.questLog) {
              this.questLog.advanceStep(
                'quest_side_fishing',
                `Acércate a la orilla del Río Alba con Pan Campesino y pulsa [E]. Llevas [${fishCount}/3] truchas.`
              );
            }
            this.dialogueBox.showMessage('Finn · Pescador del Río Alba', [
              'Las truchas del Río Alba son desconfiadas y nadan en aguas profundas.',
              'Si te paras en la orilla del río (al este del pueblo) llevando [Pan Campesino] en la mochila y pulsas [E], arrojarás migajas de cebo y picarán al instante.',
              `Necesito 3 truchas frescas. Actualmente llevas: [${fishCount}/3]. ¡Vuelve en cuanto las tengas!`
            ], this._getFinnChoices());
          }
        }
      },
      {
        label: `🐟 Comprar Trucha del Río Alba (3 🪙) [Tienes: ${this.player.coins}🪙]`,
        onSelect: () => {
          if (this.player.coins < 3) {
            this.dialogueBox.showMessage('Finn · Pescador', [
              'La trucha plateada cuesta 3 monedas.'
            ], this._getFinnChoices());
            return;
          }
          this.player.coins -= 3;
          this.inventory.addItem({
            id: 'fish',
            name: 'Trucha del Río Alba',
            description: 'Pescado fresco del río. Restaura 1.5 corazones al instante.',
            iconIndex: ITEM_ICONS.FISH,
            qty: 1
          });
          this.music.playFanfare();
          this._saveGameToStorage();
          this.dialogueBox.showMessage('Finn · Pescador', [
            '¡Marchando una trucha fresca! Jugosa y repleta de proteínas para la aventura.'
          ], this._getFinnChoices());
        }
      },
      {
        label: `🍶 Comprar Botella de Agua de Manantial (1 🪙) [Tienes: ${this.player.coins}🪙]`,
        onSelect: () => {
          if (this.player.coins < 1) {
            this.dialogueBox.showMessage('Finn · Pescador', [
              'El agua fresca del pozo cuesta solo 1 🪙.'
            ], this._getFinnChoices());
            return;
          }
          this.player.coins -= 1;
          this.inventory.addItem({
            id: 'spring_water',
            name: 'Agua de Manantial',
            description: 'Agua purificada del pozo central de Valleverde. Refresca y calma.',
            iconIndex: ITEM_ICONS.POTION,
            qty: 1
          });
          this.music.playFanfare();
          this._saveGameToStorage();
          this.dialogueBox.showMessage('Finn · Pescador', [
            '¡Agua cristalina y fresca! Perfecta para recuperar el aliento en el camino.'
          ], this._getFinnChoices());
        }
      },
      {
        label: 'Hasta luego, Finn',
        onSelect: () => this.dialogueBox.close()
      }
    ];

    return fishChoices;
  }

  _createVillageNPCs() {
    const sheet = this.assets.charactersSheet;

    return [
      new NPC({
        name: 'Sabio Aurelio · Cronista',
        jobTitle: 'Cronista y Archivero',
        homeSceneId: 'elder_house',
        x: 14 * 16,
        y: 10 * 16,
        speed: 24,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.ELDER),
        behavior: 'patrol',
        patrolPoints: [
          { x: 14 * 16, y: 10 * 16, dir: 'down', waitMin: 2.5, waitMax: 5.0, activityIcon: '📖' },
          { x: 16 * 16, y: 9 * 16, dir: 'up', waitMin: 3.0, waitMax: 5.5, activityIcon: '📖' },
          { x: 16 * 16, y: 13 * 16, dir: 'right', waitMin: 2.2, waitMax: 4.5 },
          { x: 13 * 16, y: 13 * 16, dir: 'down', waitMin: 2.0, waitMax: 4.0 },
          { x: 9 * 16, y: 8 * 16, dir: 'up', waitMin: 2.5, waitMax: 4.8 }
        ],
        ambientPhrases: [
          'El Ojete Dorado brilla en las crónicas...',
          'El microondas de AI Alex no debe sonar jamás...',
          'Qué paz se respira hoy en Valleverde.',
          'Debo anotar esto en el tomo IV...',
          '¿Habrá cruzado alguien el río hoy?'
        ],
        getDialogues: () => ({
          lines: [
            'Soy Aurelio, el Sabio y Cronista de Valleverde.',
            'El viento del este sopla con inquietud estos días... ¿En qué puedo ayudarte, joven programador?'
          ],
          choices: this._getElderChoices()
        })
      }),
      new NPC({
        name: 'Oráculo Orion · Astrólogo IA',
        jobTitle: 'Astrólogo Algorítmico',
        homeSceneId: 'oracle_house',
        x: 18 * 16,
        y: 10 * 16,
        speed: 27,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.AI_ORACLE),
        behavior: 'patrol',
        patrolPoints: [
          { x: 18 * 16, y: 10 * 16, dir: 'down', waitMin: 2.8, waitMax: 5.2, activityIcon: '✦' },
          { x: 15 * 16, y: 8 * 16, dir: 'up', waitMin: 3.0, waitMax: 5.5, activityIcon: '✦' },
          { x: 20 * 16, y: 10 * 16, dir: 'right', waitMin: 2.4, waitMax: 4.6 },
          { x: 19 * 16, y: 13 * 16, dir: 'left', waitMin: 2.2, waitMax: 4.2 }
        ],
        ambientPhrases: [
          'Los astros auguran una gran aventura...',
          'Percibo la energía de El Ojete Dorado.',
          'Mis sensores astrales están al 100%.',
          'Qué cielo tan despejado sobre la aldea.'
        ],
        getDialogues: () => ({
          lines: [
            `Soy Orion, Astrólogo con IA en tiempo real (${this.aiBrain.getActiveModeLabel()}).`,
            'Vivo en el Observatorio del norte. ¿De qué quieres hablar hoy?'
          ],
          choices: this._buildOracleChoices()
        })
      }),
      new NPC({
        name: 'Herrero Brom · Forjador',
        jobTitle: 'Maestro Forjador y Hornero',
        homeSceneId: 'blacksmith_house',
        x: 24 * 16,
        y: 7 * 16,
        speed: 30,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.BLACKSMITH),
        behavior: 'patrol',
        patrolPoints: [
          { x: 25 * 16, y: 6 * 16, dir: 'right', waitMin: 3.2, waitMax: 6.0, activityIcon: '⚒' },
          { x: 23 * 16, y: 7 * 16, dir: 'down', waitMin: 2.2, waitMax: 4.2 },
          { x: 20 * 16, y: 7 * 16, dir: 'up', waitMin: 2.4, waitMax: 4.5, activityIcon: '⚒' },
          { x: 23 * 16, y: 10 * 16, dir: 'left', waitMin: 2.0, waitMax: 3.8 }
        ],
        ambientPhrases: [
          '¡Clang, clang! Buen acero el de hoy.',
          'El horno de leña huele a pan tierno.',
          'Un buen aventurero necesita buen equipo.',
          '¡Fuego vivo en la fragua!'
        ],
        getDialogues: () => ({
          lines: [
            '¡Clang, clang! Soy Brom, el Maestro Forjador y Panadero de horno de leña.'
          ],
          choices: this._getSmithChoices()
        })
      }),
      new NPC({
        name: 'Herbolaria Lyra · Alquimista',
        jobTitle: 'Botánica y Alquimista',
        homeSceneId: 'herbalist_house',
        x: 9 * 16,
        y: 19 * 16,
        speed: 31,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.HERBALIST),
        behavior: 'patrol',
        patrolPoints: [
          { x: 9 * 16, y: 19 * 16, dir: 'down', waitMin: 2.2, waitMax: 4.4 },
          { x: 7 * 16, y: 19 * 16, dir: 'up', waitMin: 2.5, waitMax: 4.8, activityIcon: '✿' },
          { x: 9 * 16, y: 15 * 16, dir: 'right', waitMin: 2.8, waitMax: 5.2, activityIcon: '✿' },
          { x: 12 * 16, y: 15 * 16, dir: 'down', waitMin: 2.4, waitMax: 4.6, activityIcon: '✿' }
        ],
        ambientPhrases: [
          '♪ Creced fuertes, florecitas ♪',
          'Qué aroma a lavanda y rocío...',
          'Las ovejas tienen hambre hoy.',
          'Esta infusión quedará deliciosa.'
        ],
        getDialogues: () => ({
          lines: [
            '¡Hola! Soy Lyra, la Botánica y Alquimista de Valleverde. Cuido las plantas y pociones.'
          ],
          choices: this._getHerbChoices()
        })
      }),
      new NPC({
        name: 'Guardia Kael · Capitán del Binario',
        jobTitle: 'Capitán de los Guardias del Binario',
        homeSceneId: 'guard_house',
        x: 25 * 16,
        y: 11 * 16,
        speed: 30,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.GUARD),
        behavior: 'patrol',
        patrolPoints: [
          { x: 25 * 16, y: 11 * 16, dir: 'down', waitMin: 2.8, waitMax: 5.2 },
          { x: 26 * 16, y: 12 * 16, dir: 'right', waitMin: 3.0, waitMax: 5.5 },
          { x: 24 * 16, y: 13 * 16, dir: 'left', waitMin: 2.2, waitMax: 4.2 },
          { x: 22 * 16, y: 19 * 16, dir: 'up', waitMin: 2.4, waitMax: 4.5 }
        ],
        ambientPhrases: [
          '01010111... Valleverde protegido con cortafuegos y permisos 755.',
          'Los bugs de AI Alex no cruzan el río gracias a nuestra vigilancia.',
          'El puente permanece clausurado por orden del Gran Sabio Aurelio.',
          'Mantened el orden en Valleverde y no dejes memory leaks.'
        ],
        getDialogues: () => {
          const choices = [
            {
              label: 'Cuéntame tu vida y oficio (Chapa)',
              onSelect: () => this._startNPCLifeRant('guard', choices)
            },
            {
              label: '¿Por qué no hay enemigos en el pueblo de noche?',
              onSelect: () => {
                this.dialogueBox.showMessage(
                  'Guardia Kael · Capitán del Binario',
                  [
                    '¡Porque los Guardias del Binario patrullamos 24/7 y mantenemos las tablas iptables blindadas!',
                    'Ningún bug o dron nocturno de AI Alex se atreve a traspasar las lindes de Valleverde.',
                    'Fuera del pueblo, en cambio, la noche es hostil y proliferan los bugs.'
                  ],
                  choices
                );
              }
            }
          ];

          if (!this.tilemap.bridgeForceUnlocked) {
            choices.unshift({
              label: '¿Por qué está cerrado el puente del este?',
              onSelect: () => {
                this.dialogueBox.showMessage(
                  'Guardia Kael · Capitán del Binario',
                  [
                    'Más allá del río Alba se extienden las Tierras Sagradas con los templos ancestrales.',
                    'Desde que AI Alex despertó con sus esbirros y su colosal Microondas con Despertador, esas tierras están infestadas de anomalías letales.',
                    'Por orden del Gran Sabio Aurelio cerramos el paso con barricadas para proteger Valleverde a la espera de un héroe preparado.',
                    'Si deseas cruzar, habla con el Sabio Aurelio en su casa (al noroeste, la del tejado azul). Si él te autoriza, te abriré el paso de inmediato.'
                  ],
                  choices
                );
              }
            });
          }

          if (this.inventory.hasItem('bridge_pass') && !this.tilemap.bridgeForceUnlocked) {
            choices.unshift({
              label: '★ Mostrar Pase del Puente del Sabio Aurelio',
              onSelect: () => {
                this.tilemap.unlockBridgePermanently();
                if (this.questLog) {
                  this.questLog.completeQuest('quest_main_bridge', 'El puente del Río Alba está abierto. ¡Cruza al este hacia las Pruebas Sagradas!');
                  this.questLog.advanceStep('quest_code_temples', 'El puente está abierto. Explora el Santuario Este y supera los Templos Binarios.');
                }
                if (this.achievementManager) {
                  this.achievementManager.unlock('ach_bridge_pass');
                }
                this._saveGameToStorage();
                this.dialogueBox.showMessage('Guardia Kael · Capitán del Binario', [
                  '¡Es la firma y sello oficial del Sabio Aurelio!',
                  '¡Retirad la barricada, centinelas! El puente queda abierto para nuestro héroe las 24 horas.',
                  '¡Demuestra tu valor y supera las Pruebas Sagradas!'
                ]);
              }
            });
          }

          choices.push({
            label: 'Entendido, gracias',
            onSelect: () => this.dialogueBox.close()
          });

          const statusLine = this.tilemap.bridgeForceUnlocked
            ? '¡Saludos, héroe! Tienes autorización oficial del Sabio Aurelio. El puente del este está abierto para acceder a las Pruebas Sagradas.'
            : '¡Alto, programador! El puente del este está CLAUSURADO por orden del Gran Sabio Aurelio debido a las amenazas de AI Alex. Consulta a Aurelio en su casa.';

          return {
            lines: [statusLine],
            choices
          };
        }
      }),
      new NPC({
        name: 'Guardia Bit · Centinela',
        jobTitle: 'Guardia del Binario del Puente',
        homeSceneId: 'guard_house',
        x: 27 * 16,
        y: 12 * 16,
        speed: 24,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.GUARD),
        behavior: 'patrol',
        patrolPoints: [
          { x: 27 * 16, y: 11 * 16, dir: 'down', waitMin: 2.0, waitMax: 4.5 },
          { x: 27 * 16, y: 13 * 16, dir: 'up', waitMin: 2.0, waitMax: 4.5 }
        ],
        ambientPhrases: [
          '01000010... Vigilancia del cruce este.',
          'Al otro lado del puente esperan los 3 retos sagrados.',
          'El puente está cerrado por orden del Sabio Aurelio.',
          'El pueblo es zona segura gracias a los Guardias del Binario.'
        ],
        getDialogues: () => {
          const bitChoices = [
            {
              label: '¿Qué hay al otro lado del puente?',
              onSelect: () => {
                this.dialogueBox.showMessage('Guardia Bit · Centinela del Binario', [
                  'Al cruzar el río accederás al recinto de las Pruebas Sagradas:',
                  '1. Al norte: Templo de la [Armadura del Código Binario].',
                  '2. Al sur: Templo de la [Espada de la Recursividad].',
                  '3. En el altar oriental: La reliquia [El Microondas Little (Sin Despertador)].'
                ], bitChoices);
              }
            },
            {
              label: '¿Cómo puedo cambiar la hora del día?',
              onSelect: () => {
                this.dialogueBox.showMessage('Guardia Bit · Centinela del Binario', [
                  'En tu Casa del Programador (al oeste de Valleverde) puedes usar tu cama con [E].',
                  'Te permitirá elegir entre Día (08:00 AM), Tarde (15:00 PM) o Noche (22:00 PM).',
                  'Además, dormir en tu cama purga al 100% la robotización de la Armadura Binaria.'
                ], bitChoices);
              }
            },
            {
              label: 'Entendido, buen servicio',
              onSelect: () => this.dialogueBox.close()
            }
          ];
          return {
            lines: this.tilemap.bridgeForceUnlocked
              ? [
                  '¡Paso expedito! El puente está abierto para ti por orden del Sabio Aurelio.',
                  'Al otro lado te aguardan las Pruebas Sagradas. ¡Ten cuidado con los bugs nocturnos si cruzas de noche!'
                ]
              : [
                  '¡Alto ahí! El puente del este permanece precintado por orden del Gran Sabio Aurelio.',
                  'Las tierras del este son peligrosas por la corrupción de AI Alex. Consulta al Sabio en su casa para más detalles.'
                ],
            choices: bitChoices
          };
        }
      }),
      new NPC({
        name: 'Mercader Byte · Dependencias',
        jobTitle: 'Comerciante de Software y Suministros',
        homeSceneId: 'overworld',
        x: 19.5 * 16,
        y: 9.2 * 16,
        speed: 0,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.HERO),
        behavior: 'static',
        initialDirection: 'down',
        ambientPhrases: [
          '¡Vendo café compilado y parches hotfix en mi puesto!',
          'Dependencias limpias, sin vulnerabilidades en npm audit.',
          'Acepto monedas 🪙 para tus consumibles esenciales.',
          '¡Evita volverte un robot con mi Café Compilado!'
        ],
        getDialogues: () => {
          const storeChoices = [
            {
              label: `☕ Comprar Café Compilado (5 🪙) [Tienes: ${this.player.coins}🪙]`,
              onSelect: () => {
                if (this.player.coins < 5) {
                  this.dialogueBox.showMessage('Mercader Byte', [
                    '¡Error 402: Payment Required! No tienes suficientes monedas para el Café Compilado (cuesta 5 🪙).'
                  ], storeChoices);
                  return;
                }
                this.player.coins -= 5;
                this.inventory.addItem({
                  id: 'coffee',
                  name: 'Café Compilado',
                  description: 'Restaura 1 corazón y purga un 40% de robotización binaria al instante.',
                  iconIndex: ITEM_ICONS.POTION,
                  qty: 1
                });
                this.music.playFanfare();
                this._saveGameToStorage();
                this.dialogueBox.showMessage('Mercader Byte', [
                  '¡Marchando una taza humeante de Café Compilado!',
                  'Bébelo abriendo la mochila con [I] para recuperar vida y bajar la robotización de la Armadura Binaria.'
                ], storeChoices);
              }
            },
            {
              label: `🩹 Comprar Parche Hotfix (10 🪙) [Tienes: ${this.player.coins}🪙]`,
              onSelect: () => {
                if (this.player.coins < 10) {
                  this.dialogueBox.showMessage('Mercader Byte', [
                    'Fondos insuficientes para el Parche Hotfix (cuesta 10 🪙).'
                  ], storeChoices);
                  return;
                }
                this.player.coins -= 10;
                this.inventory.addItem({
                  id: 'hotfix',
                  name: 'Parche Hotfix',
                  description: 'Restaura toda tu salud al 100% y elimina cualquier bug o robotización residual.',
                  iconIndex: ITEM_ICONS.POTION,
                  qty: 1
                });
                this.music.playFanfare();
                this._saveGameToStorage();
                this.dialogueBox.showMessage('Mercader Byte', [
                  '¡Parche Hotfix listo para producción! Te recuperará toda la vida y desarmará cualquier anomalía binaria.'
                ], storeChoices);
              }
            },
            {
              label: `🍞 Comprar Pan Campesino (3 🪙) [Tienes: ${this.player.coins}🪙]`,
              onSelect: () => {
                if (this.player.coins < 3) {
                  this.dialogueBox.showMessage('Mercader Byte', [
                    'El pan campesino vale 3 monedas. Vuelve cuando tengas saldo.'
                  ], storeChoices);
                  return;
                }
                this.player.coins -= 3;
                this.inventory.addItem({
                  id: 'bread',
                  name: 'Pan Campesino',
                  description: 'Pan recién horneado de Valleverde. Restaura fuerzas o alimenta al perro Toby.',
                  iconIndex: ITEM_ICONS.BREAD,
                  qty: 1
                });
                this.music.playFanfare();
                this._saveGameToStorage();
                this.dialogueBox.showMessage('Mercader Byte', [
                  '¡Pan recién sacado del horno de Brom! ¡Que aproveche!'
                ], storeChoices);
              }
            },
            {
              label: `💾 Comprar Disquete de Respaldo (15 🪙) [Tienes: ${this.player.coins}🪙]`,
              onSelect: () => {
                if (this.player.coins < 15) {
                  this.dialogueBox.showMessage('Mercader Byte', [
                    'Un respaldo físico en disquete magnético cuesta 15 🪙.'
                  ], storeChoices);
                  return;
                }
                this.player.coins -= 15;
                this._saveGameToStorage();
                this.music.playFanfare();
                this.dialogueBox.showMessage('Mercader Byte', [
                  '¡Copia de seguridad realizada! Tu estado, monedas y progreso han sido guardados con éxito.'
                ], storeChoices);
              }
            },
            {
              label: 'Cuéntame tu vida y oficio (Chapa)',
              onSelect: () => this._startNPCLifeRant('merchant', storeChoices)
            },
            {
              label: 'Hasta luego',
              onSelect: () => this.dialogueBox.close()
            }
          ];

          return {
            lines: [
              '¡Bienvenido a la Tienda de Dependencias de Byte en la plaza!',
              `Tienes 💰 ${this.player.coins} monedas en el bolsillo. ¿En qué puedo ayudarte?`
            ],
            choices: storeChoices
          };
        }
      }),
      new NPC({
        name: 'Clara · Panadería y Frutas',
        jobTitle: 'Tendera del Mercado de Alimentos',
        homeSceneId: 'overworld',
        x: 14.5 * 16,
        y: 9.2 * 16,
        speed: 0,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.HERBALIST),
        behavior: 'static',
        initialDirection: 'down',
        ambientPhrases: [
          '¡Manzanas frescas traídas de los vergeles del río!',
          '¡Pan campesino recién horneado y tarta de bayas!',
          '¡Un buen aventurero nunca viaja con el estómago vacío!'
        ],
        getDialogues: () => {
          const foodChoices = [
            {
              label: `🍎 Comprar Manzana Crujiente (2 🪙) [Tienes: ${this.player.coins}🪙]`,
              onSelect: () => {
                if (this.player.coins < 2) {
                  this.dialogueBox.showMessage('Clara · Panadería', [
                    'Las manzanas cuestan 2 🪙. ¡Vuelve con unas pocas monedas!'
                  ], foodChoices);
                  return;
                }
                this.player.coins -= 2;
                this.inventory.addItem({
                  id: 'apple',
                  name: 'Manzana Crujiente',
                  description: 'Manzana roja y jugosa del valle. Restaura 1 corazón entero.',
                  iconIndex: ITEM_ICONS.GOLDEN_APPLE,
                  qty: 1
                });
                this.music.playFanfare();
                this._saveGameToStorage();
                this.dialogueBox.showMessage('Clara · Panadería', [
                  '¡Marchando una manzana crujiente y dulce! ¡Buen provecho!'
                ], foodChoices);
              }
            },
            {
              label: `🍞 Comprar Pan Campesino (3 🪙) [Tienes: ${this.player.coins}🪙]`,
              onSelect: () => {
                if (this.player.coins < 3) {
                  this.dialogueBox.showMessage('Clara · Panadería', [
                    'El pan campesino vale 3 monedas.'
                  ], foodChoices);
                  return;
                }
                this.player.coins -= 3;
                this.inventory.addItem({
                  id: 'bread',
                  name: 'Pan Campesino',
                  description: 'Hogaza de pan blanco horneada esta mañana. Restaura 2 corazones.',
                  iconIndex: ITEM_ICONS.BREAD,
                  qty: 1
                });
                this.music.playFanfare();
                this._saveGameToStorage();
                this.dialogueBox.showMessage('Clara · Panadería', [
                  '¡Aquí tienes! La corteza está en su punto perfecto.'
                ], foodChoices);
              }
            },
            {
              label: `🥧 Comprar Pastel de Bayas (5 🪙) [Tienes: ${this.player.coins}🪙]`,
              onSelect: () => {
                if (this.player.coins < 5) {
                  this.dialogueBox.showMessage('Clara · Panadería', [
                    'El pastel artesano de bayas silvestres vale 5 🪙.'
                  ], foodChoices);
                  return;
                }
                this.player.coins -= 5;
                this.inventory.addItem({
                  id: 'berry_pie',
                  name: 'Pastel de Bayas',
                  description: 'Exquisito pastel de arándanos y moras. Restaura la salud completa y aporta energía.',
                  iconIndex: ITEM_ICONS.BREAD,
                  qty: 1
                });
                this.music.playFanfare();
                this._saveGameToStorage();
                this.dialogueBox.showMessage('Clara · Panadería', [
                  '¡Una delicia recién desmoldada! Restaura tu vida al 100% y te llena de brío.'
                ], foodChoices);
              }
            },
            {
              label: 'Hasta luego, Clara',
              onSelect: () => this.dialogueBox.close()
            }
          ];

          return {
            lines: [
              '¡Hola, viajero! Bienvenido al Puesto de Frutas y Panadería de la plaza.',
              `Tengo provisiones deliciosas para tu aventura. Tienes: 💰 ${this.player.coins}🪙.`
            ],
            choices: foodChoices
          };
        }
      }),
      new NPC({
        name: 'Pip · Aprendiz de Alquimia',
        jobTitle: 'Herbolario y Boticario del Mercado',
        homeSceneId: 'overworld',
        x: 14.5 * 16,
        y: 14.2 * 16,
        speed: 0,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.HERBALIST),
        behavior: 'static',
        initialDirection: 'down',
        ambientPhrases: [
          '¡Pociones herbales recién destiladas!',
          '¡El ungüento antirrobo disuelve la robotización en un periquete!',
          'Maestra Lyra me enseñó a mezclar hierbas aromáticas sin explotar el alambique.'
        ],
        getDialogues: () => {
          const herbChoices = [
            {
              label: `🧪 Comprar Poción Herbal (4 🪙) [Tienes: ${this.player.coins}🪙]`,
              onSelect: () => {
                if (this.player.coins < 4) {
                  this.dialogueBox.showMessage('Pip · Herboristería', [
                    'La poción herbal cuesta 4 monedas.'
                  ], herbChoices);
                  return;
                }
                this.player.coins -= 4;
                this.inventory.addItem({
                  id: 'potion',
                  name: 'Poción Herbal',
                  description: 'Elixir de flores curativas. Restaura toda la salud y aumenta la velocidad temporalmente.',
                  iconIndex: ITEM_ICONS.POTION,
                  qty: 1
                });
                this.music.playFanfare();
                this._saveGameToStorage();
                this.dialogueBox.showMessage('Pip · Herboristería', [
                  '¡Aquí tienes tu Poción Herbal! Huele a menta y tomillo silvestre.'
                ], herbChoices);
              }
            },
            {
              label: `🌿 Comprar Ungüento Antirrobo (6 🪙) [Tienes: ${this.player.coins}🪙]`,
              onSelect: () => {
                if (this.player.coins < 6) {
                  this.dialogueBox.showMessage('Pip · Herboristería', [
                    'El ungüento purificador vale 6 🪙.'
                  ], herbChoices);
                  return;
                }
                this.player.coins -= 6;
                this.inventory.addItem({
                  id: 'ointment',
                  name: 'Ungüento Antirrobo',
                  description: 'Bálsamo orgánico de savia de abeto. Purga un 50% de la robotización binaria.',
                  iconIndex: ITEM_ICONS.POTION,
                  qty: 1
                });
                this.music.playFanfare();
                this._saveGameToStorage();
                this.dialogueBox.showMessage('Pip · Herboristería', [
                  '¡Ungüento entregado! Si la Armadura Binaria empieza a volverte máquina, frótatelo.'
                ], herbChoices);
              }
            },
            {
              label: `🌾 Comprar Manojo de Trigo (2 🪙) [Tienes: ${this.player.coins}🪙]`,
              onSelect: () => {
                if (this.player.coins < 2) {
                  this.dialogueBox.showMessage('Pip · Herboristería', [
                    'El trigo cuesta 2 monedas.'
                  ], herbChoices);
                  return;
                }
                this.player.coins -= 2;
                this.inventory.addItem({
                  id: 'wheat',
                  name: 'Trigo Fresco',
                  description: 'Espigas doradas para alimentar ovejas y gallinas.',
                  iconIndex: ITEM_ICONS.WHEAT,
                  qty: 1
                });
                this.music.playFanfare();
                this._saveGameToStorage();
                this.dialogueBox.showMessage('Pip · Herboristería', [
                  '¡Espigas de trigo de primera! A la oveja Copito le chiflan.'
                ], herbChoices);
              }
            },
            {
              label: 'Hasta luego, Pip',
              onSelect: () => this.dialogueBox.close()
            }
          ];

          return {
            lines: [
              '¡Saludos! Soy Pip, atiendo el puesto de Alquimia y Herboristería de la Maestra Lyra.',
              `¿Necesitas elixires o bálsamos? Tienes: 💰 ${this.player.coins}🪙.`
            ],
            choices: herbChoices
          };
        }
      }),
      new NPC({
        name: 'Finn · Pescador del Río Alba',
        jobTitle: 'Pescador y Aguador del Mercado',
        homeSceneId: 'overworld',
        x: 19.5 * 16,
        y: 14.2 * 16,
        speed: 0,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.BLACKSMITH),
        behavior: 'static',
        initialDirection: 'down',
        ambientPhrases: [
          '¡Truchas plateadas recién sacadas del río Alba!',
          '¡El agua del pozo central calma cualquier fatiga!',
          'Al otro lado del puente el río se vuelve misterioso y salvaje...'
        ],
        getDialogues: () => {
          return {
            lines: [
              '¡Aupa, viajero! Aquí tengo las mejores truchas del Río Alba y agua fresca del pozo.',
              `¿Qué te apetece llevar hoy? Saldo: 💰 ${this.player.coins}🪙.`
            ],
            choices: this._getFinnChoices()
          };
        }
      }),
      new NPC({
        name: 'Carcelero Real',
        jobTitle: 'Vigilante del Calabozo',
        x: 5.5 * 16,
        y: 6 * 16,
        sceneId: 'jail_cell',
        interactionRange: 34,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.GUARD),
        behavior: 'static',
        initialDirection: 'up',
        getDialogues: () => {
          if (this.isJailedForever) {
            this.dialogueBox.close();
            this.animeCutscenes.playCutscene(SCENE_JAIL_ARREST, () => {
              this.menuSystem.openGameOverScreen(false, 'jail_disrespect');
            });
            return null;
          }

          const mins = Math.floor(this.jailRemainingSeconds / 60);
          const secs = Math.floor(this.jailRemainingSeconds % 60);
          const timeLeft = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

          const irritateJailer = (annoyingReason) => {
            this.jailerAngerCount = (this.jailerAngerCount || 0) + 1;
            this._saveGameToStorage();

            if (this.jailerAngerCount === 1) {
              this.dialogueBox.showMessage('Carcelero Real · Cabreado (Aviso 1/3)', [
                `«${annoyingReason}»`,
                '«¡Oye tú! No me toques las variables ni me vaciles. Llevas 1 aviso.',
                '¡Al tercer aviso pagarás con tu vida y te infligiré la Maldición del Corazón Roto!»'
              ]);
            } else if (this.jailerAngerCount === 2) {
              this.dialogueBox.showMessage('Carcelero Real · Furioso (Aviso 2/3)', [
                `«${annoyingReason}»`,
                '«¡SEGUNDO AVISO! ¡Me estás sobrecalentando los circuitos de paciencia!',
                '¡Un desplante más y atente a las consecuencias, recluso insolente!»'
              ]);
            } else if (this.jailerAngerCount === 3) {
              // 3er enfado: paga con su vida, resta medio corazón y aplica la maldición
              if (this.music && typeof this.music.playPlayerHurt === 'function') {
                this.music.playPlayerHurt();
              }
              this.player.inflictBrokenHeartCurse();
              this.player.hp = Math.max(0.5, this.player.hp - 0.5);
              this.player.invulnTimer = 1.0;
              this._saveGameToStorage();

              this.dialogueBox.showMessage('Carcelero Real · ¡¡ATAQUE DE FURIA Y MALDICIÓN!! (3/3)', [
                `«${annoyingReason}»`,
                '«¡¡A LA TERCERA VA LA VENCIDA!! ¡¡ZASCA EN TODA LA BOCA!!',
                '(El Carcelero saca la porra eléctrica a través de los barrotes y te sacude)',
                '¡Pagas con tu vida y RECIBES LA MALDICIÓN DEL CORAZÓN ROTO (💔)!',
                '¡Ese medio corazón queda maldito! Ningún descanso en cama ni comida de este mundo podrá sanarlo.',
                'Para recuperar ese corazón roto tendrás que viajar a los Reinos Condenados y hablar con el Dios Supremo para que te quite esa maldición.',
                '¡¡Y COMO VUELVAS A DAR POR SACO, TE QUEDAS CONDENADO A CADENA PERPETUA Y SE ACABA TU AVENTURA!!»'
              ]);
            } else {
              // 4 o más enfados: Game Over directo e inmediato por faltar al respeto al Carcelero
              if (this.music && typeof this.music.playPlayerHurt === 'function') {
                this.music.playPlayerHurt();
              }
              this.isJailedForever = true;
              this.dialogueBox.close();
              this.animeCutscenes.playCutscene(SCENE_JAIL_ARREST, () => {
                this.menuSystem.openGameOverScreen(false, 'jail_disrespect');
              });
            }
          };

          const jailChoices = [
            {
              label: 'Recitar disculpa solemne a la IA',
              onSelect: () => {
                this._releaseFromJail([
                  '"Prometo solemnemente respetar a todas las Inteligencias Artificiales de 8 y 16 bits..."',
                  'El Carcelero se emociona con tu arrepentimiento y abre la celda. ¡Quedas en libertad!'
                ]);
              }
            },
            {
              label: 'Releer mis derechos de detenido',
              onSelect: () => {
                this.dialogueBox.showMessage('Carcelero Real', [
                  '1º Derecho a quejarte en 60 FPS. 2º Todo lo que digas se guarda en una variable.',
                  '3º Tu abogada de oficio es la Oveja Copito (pero está ocupada pastando).'
                ]);
              }
            },
            {
              label: '⚡ Vacilar al carcelero («¡Menuda porquería de barrotes!»)',
              onSelect: () => irritateJailer('¡Esos barrotes los rompo yo con un puntero nulo!')
            },
            {
              label: '⚡ Dar golpes a los barrotes («¡Carceleroooo, tengo hambre!»)',
              onSelect: () => irritateJailer('¡CLANG CLANG CLANG! ¡Camarero, traiga unas bravas!')
            },
            {
              label: '⚡ Cantar a gritos: «¡Por el ojeeeeeteeeeee doradilarilá!»',
              onSelect: () => irritateJailer('¡LA LA LA! ¡Por el ojeeeeteeeee no pasarán!')
            },
            {
              label: 'Seguir cumpliendo condena',
              onSelect: () => this.dialogueBox.close()
            }
          ];

          if (this.inventory.hasItem('bread')) {
            jailChoices.unshift({
              label: 'Sobornar con Pan Campesino',
              onSelect: () => {
                this.inventory.consumeItem('bread', 1);
                this._releaseFromJail([
                  'El Carcelero huele el Pan Campesino recién hecho y mira hacia otro lado...',
                  '¡Celda abierta! Has vuelto a la plaza de Valleverde.'
                ]);
              }
            });
          }

          const angerStatus = this.jailerAngerCount > 0 ? ` [Enfado: ${this.jailerAngerCount}/3]` : '';
          return {
            lines: [
              `Estás cumpliendo condena por insultar al Oráculo IA. Tiempo restante: ${timeLeft}.${angerStatus}`,
              '¿Qué tienes que alegar en tu defensa desde detrás de los barrotes?'
            ],
            choices: jailChoices
          };
        }
      }),
      new NPC({
        name: 'Sabio Aurelio · Guardián del Alba',
        jobTitle: 'Maestro de la Orden del Alba',
        x: 15 * 16,
        y: 18 * 16,
        sceneId: 'first_stage',
        speed: 22,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.ELDER),
        behavior: 'patrol',
        patrolPoints: [
          { x: 15 * 16, y: 18 * 16, dir: 'down', waitMin: 2.5, waitMax: 4.5, activityIcon: '✦' },
          { x: 18 * 16, y: 18 * 16, dir: 'left', waitMin: 2.5, waitMax: 4.5 }
        ],
        ambientPhrases: [
          'El Ojete Dorado es nuestra única esperanza...',
          'Mister AI Alex todo lo ve en las sombras...',
          'Sin tu armadura un solo golpe te abatirá.',
          'Busca el Bastión Oeste y el Altar Norte.'
        ],
        getDialogues: () => {
          const sageStage1Choices = [
            {
              label: '★ La gran aventura del héroe (Escenas)',
              onSelect: () => {
                this.dialogueBox.close();
                this.menuSystem.startHeroAdventureCutscene(() => {
                  this.menuSystem.state = 'none';
                  this.music.setMode('stage1');
                });
              }
            },
            {
              label: '🗺 ¿Cómo está dividido el reino? (Ver Mapa)',
              onSelect: () => {
                this.dialogueBox.close();
                this.menuSystem.openWorldMap(this.tilemap.currentSceneId, {
                  player: this.player,
                  enemies: this.enemies
                });
              }
            },
            {
              label: '¿Dónde consigo mi Armadura y mi Primera Arma?',
              onSelect: () => {
                this.dialogueBox.showMessage(
                  'Sabio Aurelio · Guardián del Alba',
                  [
                    '1º Ve al [Templo del Bastión] al Oeste. Es un nivel desafiante donde los drones patrullan pasillos estrechos; debes cruzarlo con sigilo para reclamar la [Armadura del Alba].',
                    '2º Cuando vistas la armadura, sube al [Templo del Altar Sagrado] al Norte. Es una mazmorra custodiada por paladines oscuros de AI Alex donde descansa la [Espada del Alba].',
                    '3º Pulsa [M] en cualquier momento para desplegar el [Mapa del Gran Ojal] y ver las 4 regiones del reino y tu posición.'
                  ],
                  sageStage1Choices
                );
              }
            },
            {
              label: '¿Quién es el malvado Mister AI Alex?',
              onSelect: () => {
                this.dialogueBox.showMessage(
                  'Sabio Aurelio · Guardián del Alba',
                  [
                    '«Mister AI Alex es una entidad omnipotente nacida de la red abisal que ha sumido a la humanidad en las tinieblas.»',
                    '«Sus esbirros patrullan estas ruinas. Mientras no lleves la Armadura del Alba estás INDEFENSO y cualquier ataque reducirá tu vida directamente a 0.»',
                    '«¡Por favor, sobrevive, consigue tu equipo y encuentra El Ojete Dorado para liberar a la humanidad!»'
                  ],
                  sageStage1Choices
                );
              }
            },
            {
              label: '¡No te fallaré, Sabio Aurelio!',
              onSelect: () => this.dialogueBox.close()
            }
          ];

          const statusIntro =
            this.player.hasArmor && this.player.hasSword
              ? '«¡Lo has logrado! Ya vistes la Armadura del Alba y empuñas la Espada del Alba. ¡Derrota a los esbirros con [ESPACIO] o [F] y cruza el Portal del Este!»'
              : !this.player.hasArmor
                ? '«¡Hijo mío, ten cuidado! Aún estás INDEFENSO (cualquier golpe te dejará a 0 de vida). Esquiva a los centinelas hacia el Oeste para conseguir tu Armadura.»'
                : '«¡Ya llevas puesta la Armadura del Alba! Ahora sube al Altar del Norte para conseguir tu primera arma: la Espada del Alba.»';

          return {
            lines: [
              statusIntro,
              '«Recuerda: solo encontrando El Ojete Dorado salvaremos a la humanidad de las tinieblas del omnipotente Mister AI Alex.»'
            ],
            choices: sageStage1Choices
          };
        }
      }),
      new NPC({
        name: 'Dios Supremo de la Redención',
        jobTitle: 'Deidad Cósmica de los Reinos Condenados',
        x: 11.5 * 16,
        y: 3.8 * 16,
        sceneId: 'condemned_realms',
        interactionRange: 34,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.AI_ORACLE),
        behavior: 'static',
        initialDirection: 'down',
        ambientPhrases: [
          'La balanza del cosmos no tolera el desacato.',
          'Todo código fragmentado anhela ser purificado.',
          'La redención exige humildad y respeto.',
          'El Ojete Dorado aguarda al elegido.'
        ],
        getDialogues: () => {
          if (this.player.hasBrokenHeartCurse) {
            return {
              lines: [
                '«Mortal... Percibo la disonancia en tu código vital. Llevas la marca del desacato carcelario: la MALDICIÓN DEL CORAZÓN ROTO (💔).»',
                '«Tus provocaciones y burlas en el calabozo quebrantaron tu espíritu. Ningún descanso en cama ni comida de este mundo puede soldar esa fractura.',
                'Solo mi gracia cósmica en estos Reinos Condenados puede purificar tu pena y restituir tu salud íntegra. ¿Vienes con humildad a expiar tu falta?»'
              ],
              choices: [
                {
                  label: '✨ Suplicar redención («¡Dios Supremo, purifica mi corazón roto!»)',
                  onSelect: () => {
                    this.dialogueBox.close();
                    this.animeCutscenes.playCutscene(SCENE_DEUS_PURIFICATION, () => {
                      this.player.purifyBrokenHeartCurse();
                      this.jailerAngerCount = 0;
                      if (this.questLog) {
                        this.questLog.completeQuest('quest_condemned_pointer', '¡Maldición purificada y expediente penal absuelto por el Dios Supremo!');
                      }
                      if (this.music && typeof this.music.playFanfare === 'function') {
                        this.music.playFanfare();
                      }
                      this._saveGameToStorage();
                      this.dialogueBox.showMessage(
                        'Dios Supremo · Purificación Celestial',
                        [
                          'El Dios Supremo alza sus manos cósmicas. Un resplandor de luz dorada envuelve tu pecho.',
                          '«El fragmento quebrado de tu alma ha sido soldado con oro cósmico (💔 ➔ ♥♥♥). Tu corazón vuelve a latir completo al 100%.»',
                          '«Tu expediente carcelario ha sido redimido. Recuerda esta lección: respeta a los centinelas del mundo.',
                          'Ahora regresa al mundo terrenal por el portal del sur y continúa tu viaje sagrado en pos del Ojete Dorado.»'
                        ],
                        () => {
                          this.inventory.statusMessage =
                            '✨ ¡Maldición purificada! Tu corazón roto ha sido restaurado al 100% por el Dios Supremo.';
                        }
                      );
                    });
                  }
                },
                {
                  label: 'Preguntar por la naturaleza de los Reinos Condenados',
                  onSelect: () => {
                    this.dialogueBox.showMessage('Dios Supremo', [
                      '«Este es el plano donde convergen las variables perdidas, los desbordamientos de pila y las sentencias eternas.',
                      'AI Alex planea corromper esta dimensión con su microondas cuántico. Mantén tu rectitud para poder doblegarlo.»'
                    ]);
                  }
                },
                {
                  label: 'Aún no estoy listo para la expiación',
                  onSelect: () => this.dialogueBox.close()
                }
              ]
            };
          }

          return {
            lines: [
              '«Bienvenido a los Reinos Condenados, mortal. Tu corazón late íntegro y sin fracturas en tu pecho.',
              'Si alguna vez la justicia carcelaria castiga tus desplantes con la Maldición del Corazón Roto (💔), acude a este altar y serás juzgado.»'
            ],
            choices: [
              {
                label: 'Pedir la bendición cósmica',
                onSelect: () => {
                  if (this.music && typeof this.music.playMenuSelect === 'function') {
                    this.music.playMenuSelect();
                  }
                  this.dialogueBox.showMessage('Dios Supremo', [
                    '«Que el código libre de fugas de memoria y la recursividad sin fin guíen tus pasos en la batalla contra AI Alex.»'
                  ]);
                }
              },
              {
                label: 'Despedirse reverentemente',
                onSelect: () => this.dialogueBox.close()
              }
            ]
          };
        }
      })
    ];
  }

  _createFirstStageEnemies() {
    const sheet = this.assets.charactersSheet;

    return [
      // ==================== ENEMIGOS EN RUINAS DEL DESPERTAR (EXTERIOR) ====================
      new Enemy({
        id: 'drone_west_1',
        name: 'Dron Sombrío de AI Alex',
        x: 10 * 16,
        y: 14 * 16,
        sceneId: 'first_stage',
        speed: 33,
        maxHp: 2,
        aggroRange: 52,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_DRONE, 16, 16, 0.12),
        patrolPoints: [
          { x: 10 * 16, y: 14 * 16 },
          { x: 10 * 16, y: 9 * 16 },
          { x: 13 * 16, y: 9 * 16 },
          { x: 13 * 16, y: 14 * 16 }
        ]
      }),
      new Enemy({
        id: 'drone_west_2',
        name: 'Dron Centinela del Bastión',
        x: 6 * 16,
        y: 13 * 16,
        sceneId: 'first_stage',
        speed: 31,
        maxHp: 2,
        aggroRange: 48,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_DRONE, 16, 16, 0.12),
        patrolPoints: [
          { x: 4 * 16, y: 13 * 16 },
          { x: 9 * 16, y: 13 * 16 },
          { x: 9 * 16, y: 15 * 16 },
          { x: 4 * 16, y: 15 * 16 }
        ]
      }),
      new Enemy({
        id: 'drone_east_1',
        name: 'Dron Sombrío de AI Alex',
        x: 21 * 16,
        y: 14 * 16,
        sceneId: 'first_stage',
        speed: 35,
        maxHp: 2,
        aggroRange: 56,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_DRONE, 16, 16, 0.12),
        patrolPoints: [
          { x: 20 * 16, y: 14 * 16 },
          { x: 25 * 16, y: 14 * 16 },
          { x: 25 * 16, y: 10 * 16 },
          { x: 20 * 16, y: 10 * 16 }
        ]
      }),
      new Enemy({
        id: 'knight_north_west',
        name: 'Caballero de Tinieblas de AI Alex',
        x: 13 * 16,
        y: 8 * 16,
        sceneId: 'first_stage',
        speed: 34,
        maxHp: 3,
        aggroRange: 56,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_KNIGHT, 16, 16, 0.13),
        patrolPoints: [
          { x: 12 * 16, y: 8 * 16 },
          { x: 15 * 16, y: 8 * 16 },
          { x: 15 * 16, y: 6 * 16 },
          { x: 12 * 16, y: 6 * 16 }
        ]
      }),
      new Enemy({
        id: 'knight_north_east',
        name: 'Caballero de Tinieblas de AI Alex',
        x: 19 * 16,
        y: 8 * 16,
        sceneId: 'first_stage',
        speed: 34,
        maxHp: 3,
        aggroRange: 56,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_KNIGHT, 16, 16, 0.13),
        patrolPoints: [
          { x: 18 * 16, y: 8 * 16 },
          { x: 21 * 16, y: 8 * 16 },
          { x: 21 * 16, y: 6 * 16 },
          { x: 18 * 16, y: 6 * 16 }
        ]
      }),
      new Enemy({
        id: 'knight_portal_guard',
        name: 'Guardián Abisal de Mister AI Alex',
        x: 28 * 16,
        y: 12 * 16,
        sceneId: 'first_stage',
        speed: 36,
        maxHp: 4,
        aggroRange: 64,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_KNIGHT, 16, 16, 0.12),
        patrolPoints: [
          { x: 27 * 16, y: 11 * 16 },
          { x: 30 * 16, y: 11 * 16 },
          { x: 30 * 16, y: 14 * 16 },
          { x: 27 * 16, y: 14 * 16 }
        ]
      }),

      // ==================== NIVEL: TEMPLO DEL BASTIÓN (ARMADURA) ====================
      // El Templo de la Armadura es un santuario sagrado de pura lógica booleana;
      // no contiene centinelas hostiles para que el jugador indefenso resuelva las baldosas.

      // ==================== NIVEL: TEMPLO DEL ALTAR SAGRADO (ESPADA) ====================
      new Enemy({
        id: 'knight_temple_west',
        name: 'Caballero Abisal del Altar',
        x: 5 * 16,
        y: 9 * 16,
        sceneId: 'sword_temple',
        speed: 36,
        maxHp: 3,
        aggroRange: 60,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_KNIGHT, 16, 16, 0.12),
        patrolPoints: [
          { x: 4 * 16, y: 8 * 16 },
          { x: 6 * 16, y: 8 * 16 },
          { x: 6 * 16, y: 11 * 16 },
          { x: 4 * 16, y: 11 * 16 }
        ]
      }),
      new Enemy({
        id: 'knight_temple_east',
        name: 'Caballero Abisal del Altar',
        x: 18 * 16,
        y: 9 * 16,
        sceneId: 'sword_temple',
        speed: 36,
        maxHp: 3,
        aggroRange: 60,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_KNIGHT, 16, 16, 0.12),
        patrolPoints: [
          { x: 17 * 16, y: 8 * 16 },
          { x: 19 * 16, y: 8 * 16 },
          { x: 19 * 16, y: 11 * 16 },
          { x: 17 * 16, y: 11 * 16 }
        ]
      }),
      new Enemy({
        id: 'knight_temple_boss',
        name: 'Paladín Oscuro de Mister AI Alex',
        x: 11 * 16,
        y: 7 * 16,
        sceneId: 'sword_temple',
        speed: 38,
        maxHp: 5,
        aggroRange: 72,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_KNIGHT, 16, 16, 0.11),
        patrolPoints: [
          { x: 9 * 16, y: 7 * 16 },
          { x: 14 * 16, y: 7 * 16 },
          { x: 14 * 16, y: 6 * 16 },
          { x: 9 * 16, y: 6 * 16 }
        ]
      }),

      // ==================== ENEMIGOS NOCTURNOS (AL ESTE DEL PUENTE Y EN ESCENARIOS EXTERIORES) ====================
      new Enemy({
        id: 'night_bug_east_1',
        name: 'Bug de Memoria Nocturno',
        x: 33 * 16,
        y: 9 * 16,
        sceneId: 'overworld',
        nightOnly: true,
        speed: 35,
        maxHp: 2,
        aggroRange: 56,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_DRONE, 16, 16, 0.12),
        patrolPoints: [
          { x: 33 * 16, y: 8 * 16 },
          { x: 36 * 16, y: 8 * 16 },
          { x: 36 * 16, y: 11 * 16 },
          { x: 33 * 16, y: 11 * 16 }
        ]
      }),
      new Enemy({
        id: 'night_bug_east_2',
        name: 'Dron Cazador de Nocturnidad',
        x: 34 * 16,
        y: 16 * 16,
        sceneId: 'overworld',
        nightOnly: true,
        speed: 38,
        maxHp: 3,
        aggroRange: 60,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_KNIGHT, 16, 16, 0.12),
        patrolPoints: [
          { x: 33 * 16, y: 15 * 16 },
          { x: 36 * 16, y: 15 * 16 },
          { x: 36 * 16, y: 18 * 16 },
          { x: 33 * 16, y: 18 * 16 }
        ]
      }),
      new Enemy({
        id: 'night_glitch_stage1_1',
        name: 'Glitch Corrupto Nocturno',
        x: 17 * 16,
        y: 13 * 16,
        sceneId: 'first_stage',
        nightOnly: true,
        speed: 35,
        maxHp: 2,
        aggroRange: 54,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_DRONE, 16, 16, 0.12),
        patrolPoints: [
          { x: 16 * 16, y: 13 * 16 },
          { x: 19 * 16, y: 13 * 16 },
          { x: 19 * 16, y: 15 * 16 },
          { x: 16 * 16, y: 15 * 16 }
        ]
      }),

      // ==================== MINI-JEFES CON BANDA SONORA Y HABILIDADES ÚNICAS ====================
      // Boss 1: El Garbage Collector Furioso (Alcantarillas de Valleverde · 80 HP)
      new GarbageCollectorBoss({
        x: 11.5 * 16,
        y: 7 * 16,
        sceneId: 'sewers_dungeon'
      }),

      // Boss 2: El Guardián del Stack Overflow (Templo de la Espada · 120 HP)
      new StackOverflowBoss({
        x: 11.5 * 16,
        y: 4.5 * 16,
        sceneId: 'sword_temple'
      }),

      // Boss 3: El Microondas Prototipo V0.1 Alpha (Umbral de la Fortaleza · 160 HP)
      new PrototypeMicrowaveBoss({
        x: 11.5 * 16,
        y: 6.5 * 16,
        sceneId: 'ai_fortress_gate'
      }),

      // Boss Final: Mister AI Alex y El Microondas Cuántico (Ciudadela · El Gran Ojal · 200 HP)
      new FinalBossAlex({
        x: 11.5 * 16,
        y: 6.5 * 16,
        sceneId: 'ai_citadel'
      })
    ];
  }

  /**
   * Devuelve a todos los NPCs propietarios de viviendas a sus puestos en el exterior.
   */
  _restoreAllNPCsToOverworld() {
    for (const npc of this.npcs) {
      if (npc.homeSceneId) {
        npc.sceneId = 'overworld';
        npc.x = npc.overworldX;
        npc.y = npc.overworldY;
        npc.behavior = npc.overworldBehavior;
        npc.direction = 'down';
      }
    }
  }

  /**
   * Cuando el jugador entra en la casa de un NPC, el dueño aparece dentro y si no tiene
   * permiso le pregunta qué hace en su casa y quién le ha dado permiso.
   */
  _handleHouseOwnerConfrontation(sceneId, returnDoor) {
    const ownerNPC = this.npcs.find((n) => n.homeSceneId === sceneId);
    if (!ownerNPC) return;

    // Colocar al propietario dentro de su propia casa mirando al jugador
    ownerNPC.sceneId = sceneId;
    ownerNPC.x = 5.5 * 16;
    ownerNPC.y = 3.5 * 16;
    ownerNPC.behavior = 'static';
    ownerNPC.direction = 'down';

    // Para la casa del Sabio Aurelio: bienvenida hospitalaria directa y opciones de diálogo naturales
    if (sceneId === 'elder_house') {
      this.housePermissions.elder_house = true;
      this.dialogueBox.showMessage('Sabio Aurelio · Cronista', [
        '«¡Adelante, joven programador! Pasa a mi archivo. Me alegro de verte.',
        'Imagino que vienes por el asunto del puente clausurado hacia las Tierras Sagradas o buscas respuestas sobre el villano AI Alex... Ponte cómodo y consulta lo que necesites.»'
      ], this._getElderChoices());
      return;
    }

    if (this.housePermissions[sceneId]) {
      this.dialogueBox.showMessage(ownerNPC.name, [
        '¡Adelante, estás en tu casa! Como ya me pediste permiso, puedes mirar con confianza.'
      ]);
      return;
    }

    const rantsByScene = {
      elder_house: 'elder',
      oracle_house: 'oracle',
      blacksmith_house: 'blacksmith',
      herbalist_house: 'herbalist',
      guard_house: 'guard'
    };

    const complaintsByScene = {
      elder_house: [
        '¡¿Pero bueno?! ¿Qué haces tú aquí metido en mi casa sin llamar a la puerta?',
        '¡¿Quién te ha dado permiso para colarte en el archivo del Cronista como si fueras a romper mis jarrones?!'
      ],
      oracle_house: [
        '¡Alerta de intrusión física! ¿Qué haces dentro de mi Observatorio privado?',
        '¡¿Quién te ha dado permisos de superusuario ("sudo") para entrar en mi vivienda sin avisar?!'
      ],
      blacksmith_house: [
        '¡Eh, tú! ¿Qué haces dentro de mi casa? ¡¿Quién te ha dado permiso para entrar hasta mi cocina?!',
        '¡Que esto no es una posada pública, forastero!'
      ],
      herbalist_house: [
        '¡¿Disculpa?! ¿Qué haces aquí dentro pisándome la alfombra roja con las botas llenas de tierra?',
        '¡¿Quién te ha dado permiso para entrar así en mi cabaña de alquimia?!'
      ],
      guard_house: [
        '¡Alto ahí en nombre de la ley! ¿Qué haces dentro del Cuartel privado del Capitán?',
        '¡¿Quién te ha dado autorización militar para allanar mi morada?!'
      ]
    };

    const confrontationChoices = [
      {
        label: 'Pedir disculpas y solicitar permiso',
        onSelect: () => {
          this.housePermissions[sceneId] = true;
          this.dialogueBox.showMessage(ownerNPC.name, [
            'Mmm... Está bien, acepto tus disculpas porque al menos no has roto ningún jarrón.',
            'Te doy permiso para estar en mi casa, pero compórtate como un vecino decente.'
          ]);
        }
      },
      {
        label: '¡Solo venía a cotillear tus muebles!',
        onSelect: () => {
          const rantKey = rantsByScene[sceneId] || 'elder';
          this.housePermissions[sceneId] = true;
          this._startNPCLifeRant(rantKey, [
            {
              label: 'Vale, prometo portarme bien en tu casa',
              onSelect: () => this.dialogueBox.close()
            }
          ]);
        }
      },
      {
        label: '¡Perdón, ya me voy a la calle!',
        onSelect: () => {
          this.dialogueBox.close();
          this._restoreAllNPCsToOverworld();
          this.tilemap.loadScene('overworld');
          this.camera.setWorldBounds(this.tilemap.width, this.tilemap.height);
          this.player.x = returnDoor.returnX;
          this.player.y = returnDoor.returnY;
          this.player.direction = 'down';
          this.camera.snapTo(this.player);
        }
      }
    ];

    this.dialogueBox.showMessage(
      ownerNPC.name,
      complaintsByScene[sceneId] || complaintsByScene.elder_house,
      confrontationChoices
    );
  }

  _createVillageAnimals() {
    const sheet = this.assets.charactersSheet;

    return [
      new Animal({
        name: 'Oveja Copito',
        species: 'sheep',
        x: 11 * 16,
        y: 9 * 16,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHEEP, 16, 16, 0.18),
        soundText: '¡Beeee! Copito (tu abogada de oficio) mueve las orejas con curiosidad.',
        fedText: '¡Le diste Trigo Fresco a Copito! Se pone a saltar de alegría. ♥',
        speed: 20,
        homeRadius: 42
      }),
      new Animal({
        name: 'Oveja Nube',
        species: 'sheep',
        x: 22 * 16,
        y: 14 * 16,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHEEP, 16, 16, 0.18),
        soundText: '¡Beeee! Su lana parece tan suave como una nube.',
        fedText: '¡Oveja Nube mastica el Trigo Fresco encantada! ♥',
        speed: 20,
        homeRadius: 36
      }),
      new Animal({
        name: 'Gallina Pinta',
        species: 'chicken',
        x: 11 * 16,
        y: 20 * 16,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.CHICKEN, 16, 16, 0.12),
        soundText: '¡Cloc, cloc! La gallina picotea entre el pasto.',
        fedText: '¡Gallina Pinta picotea las semillas de trigo a toda velocidad! ♥',
        speed: 28,
        homeRadius: 36
      }),
      new Animal({
        name: 'Gallina Dorada',
        species: 'chicken',
        x: 14 * 16,
        y: 20 * 16,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.CHICKEN, 16, 16, 0.12),
        soundText: '¡Co-co-ro-có! Busca granos cerca del vallado.',
        fedText: '¡Le diste trigo a Gallina Dorada! Aletea muy contenta. ♥',
        speed: 28,
        homeRadius: 36
      }),
      new Animal({
        name: 'Perro Toby',
        species: 'dog',
        x: 18 * 16,
        y: 14 * 16,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.DOG, 16, 16, 0.13),
        soundText: '¡Guau, guau! Toby mueve la cola sin parar al verte.',
        fedText: '¡Compartiste Pan Campesino con Toby! Ahora es tu mejor amigo. ♥',
        speed: 34,
        homeRadius: 52
      })
    ];
  }

  _createWorldItems() {
    const itemsSheet = this.assets.itemsSheet;

    if (!this.abyssalPointerSpawn) {
      const spawnIndex = Math.floor(Math.random() * ABYSSAL_POINTER_SPAWN_CANDIDATES.length);
      this.abyssalPointerSpawn = ABYSSAL_POINTER_SPAWN_CANDIDATES[spawnIndex];
    }

    return [
      new WorldItem({
        id: 'item_abyssal_pointer',
        name: 'Puntero al Abismo (Null Pointer)',
        description: 'Cristal cósmico rúnico. Úsalo desde la mochila [I] para invocar una brecha dimensional a los Reinos Condenados del Dios Supremo.',
        iconIndex: ITEM_ICONS.ABYSSAL_POINTER,
        x: this.abyssalPointerSpawn.x,
        y: this.abyssalPointerSpawn.y,
        sceneId: 'overworld',
        itemsSheet
      }),
      new WorldItem({
        id: 'dawn_armor',
        name: 'Armadura del Código Binario',
        description: 'Forjada en 0s y 1s. Protege contra bugs de AI Alex, pero con el tiempo te robotiza. ¡Ten café o duerme para desrobotizarte!',
        iconIndex: ITEM_ICONS.ARMOR,
        x: 10 * 16,
        y: 4 * 16,
        sceneId: 'armor_temple',
        itemsSheet
      }),
      new WorldItem({
        id: 'dawn_sword',
        name: 'Espada de la Recursividad',
        description: 'Arma que se llama a sí misma recursivamente. Pulsa [ESPACIO]/[F] para abatir bugs sin causar StackOverflowError.',
        iconIndex: ITEM_ICONS.SWORD,
        x: 11 * 16,
        y: 4 * 16,
        sceneId: 'sword_temple',
        itemsSheet
      }),
      new WorldItem({
        id: 'lantern',
        name: 'Farol de Mano',
        description: 'Úsalo con [E] en la mochila para iluminar el doble de radio por la noche.',
        iconIndex: ITEM_ICONS.LANTERN,
        x: 3 * 16,
        y: 3 * 16,
        sceneId: 'elder_house',
        itemsSheet
      }),
      new WorldItem({
        id: 'bridge_pass',
        name: 'Pase del Puente',
        description: 'Sello oficial del Sabio. Úsalo con [E] o dáselo al guardia para abrir el puente 24h.',
        iconIndex: ITEM_ICONS.BRIDGE_PASS,
        x: 8 * 16,
        y: 3 * 16,
        sceneId: 'elder_house',
        itemsSheet
      }),
      new WorldItem({
        id: 'bread',
        name: 'Pan Campesino',
        description: 'Pan recién horneado en la forja. Restaura energías o alegra al perro Toby.',
        iconIndex: ITEM_ICONS.BREAD,
        x: 8 * 16,
        y: 3 * 16,
        sceneId: 'blacksmith_house',
        itemsSheet
      }),
      new WorldItem({
        id: 'potion',
        name: 'Poción Herbal',
        description: 'Elixir aromático de flores de Valleverde. Úsalo para sentirte ligero.',
        iconIndex: ITEM_ICONS.POTION,
        x: 3 * 16,
        y: 3 * 16,
        sceneId: 'herbalist_house',
        itemsSheet
      }),
      new WorldItem({
        id: 'wheat',
        name: 'Trigo Fresco',
        description: 'Espigas tiernas. Acércate a una oveja o gallina para alimentarlas.',
        iconIndex: ITEM_ICONS.WHEAT,
        x: 8 * 16,
        y: 5 * 16,
        sceneId: 'herbalist_house',
        itemsSheet
      }),
      new WorldItem({
        id: 'golden_apple',
        name: 'El Microondas Little (Sin Despertador)',
        description: 'Versión mini del arma de AI Alex. Sin despertador, recalienta cafés y código espagueti en O(1) de forma completamente segura.',
        iconIndex: ITEM_ICONS.GOLDEN_APPLE,
        x: 36 * 16,
        y: 12.5 * 16,
        sceneId: 'overworld',
        itemsSheet
      }),
      new WorldItem({
        id: 'coffee',
        name: 'Café Compilado',
        description: 'Café de filtro de tu escritorio. Restaura 1 corazón y purga 40% de robotización binaria.',
        iconIndex: ITEM_ICONS.POTION,
        x: 8 * 16,
        y: 4 * 16,
        sceneId: 'player_house',
        itemsSheet
      }),
      new WorldItem({
        id: 'silicon_flower_1',
        name: 'Flor de Silicio',
        description: 'Flor bioluminiscente que solo florece durante la noche (22:00 PM). Llévasela a Lyra.',
        iconIndex: ITEM_ICONS.SILICON_FLOWER,
        x: 6 * 16,
        y: 7 * 16,
        sceneId: 'overworld',
        itemsSheet,
        nightOnly: true
      }),
      new WorldItem({
        id: 'silicon_flower_2',
        name: 'Flor de Silicio',
        description: 'Flor bioluminiscente que solo florece durante la noche (22:00 PM). Llévasela a Lyra.',
        iconIndex: ITEM_ICONS.SILICON_FLOWER,
        x: 23 * 16,
        y: 4 * 16,
        sceneId: 'overworld',
        itemsSheet,
        nightOnly: true
      }),
      new WorldItem({
        id: 'silicon_flower_3',
        name: 'Flor de Silicio',
        description: 'Flor bioluminiscente que solo florece durante la noche (22:00 PM). Llévasela a Lyra.',
        iconIndex: ITEM_ICONS.SILICON_FLOWER,
        x: 9 * 16,
        y: 22 * 16,
        sceneId: 'overworld',
        itemsSheet,
        nightOnly: true
      })
    ];
  }

  start() {
    this.loop.start();
  }

  _getActiveSceneEntities() {
    const scene = this.tilemap.currentSceneId;
    const isNight = typeof this.dayNight?.isNight === 'function'
      ? this.dayNight.isNight()
      : (this.dayNight && (this.dayNight.timeOfDayHours >= 20 || this.dayNight.timeOfDayHours < 6));
    const npcs = this.npcs.filter((n) => n.sceneId === scene);
    const animals = this.animals.filter((a) => a.sceneId === scene);
    // Los enemigos nocturnos solo aparecen de noche (en el pueblo los guardias del binario mantienen la seguridad)
    const enemies = this.enemies.filter((e) => {
      if (e.sceneId !== scene) return false;
      if (e.nightOnly && !isNight) return false;
      // En el Templo de la Espada, los guardianes y el jefe permanecen en letargo sagrado
      // hasta que el jugador resuelva la prueba y desenvaine la Espada de la Recursividad
      if (scene === 'sword_temple' && !this.player.hasSword) {
        return false;
      }
      return true;
    });
    const items = this.worldItems.filter((i) => {
      if (i.sceneId !== scene || i.collected) return false;
      if (i.nightOnly && !isNight) return false;
      return true;
    });
    return { npcs, animals, enemies, items };
  }

  _findBestInteraction() {
    const { npcs, animals, items } = this._getActiveSceneEntities();
    const currentScene = this.tilemap.currentSceneId;

    // Puzle 1: Panel de Compilación en Templo de la Armadura
    if (currentScene === 'armor_temple' && this.tilemap.armorPuzzle) {
      const panX = 10 * 16 + 8;
      const panY = 2 * 16 + 8;
      if (Math.hypot(this.player.centerX - panX, this.player.centerY - panY) <= 30) {
        return {
          kind: 'armor_compiler_panel',
          label: '[E] Leer Panel de Compilación Booleana'
        };
      }
    }

    // Puzle 2: Monolitos Rúnicos en Templo de la Espada
    if (currentScene === 'sword_temple' && this.tilemap.swordPuzzle) {
      for (const mono of Object.values(this.tilemap.swordPuzzle.monoliths)) {
        const mx = mono.col * 16 + 8;
        const my = mono.row * 16 + 8;
        if (Math.hypot(this.player.centerX - mx, this.player.centerY - my) <= 26) {
          return {
            kind: 'sword_monolith',
            target: mono,
            label: `[E] Sintonizar ${mono.name} (${mono.symbol})`
          };
        }
      }
    }

    // Brecha dimensional hacia los Reinos Condenados invocada por el Puntero Abisal
    if (this.activeAbyssalPortal && this.activeAbyssalPortal.sceneId === currentScene) {
      const pCenterX = this.activeAbyssalPortal.x + 10;
      const pCenterY = this.activeAbyssalPortal.y + 10;
      if (Math.hypot(this.player.centerX - pCenterX, this.player.centerY - pCenterY) <= 26) {
        return {
          kind: 'abyssal_portal',
          label: '[E] Cruzar la Brecha Abisal (Hacia el Dios Supremo)',
          target: { centerX: pCenterX, y: pCenterY }
        };
      }
    }

    for (const item of items) {
      if (item.canInteract(this.player)) {
        return { kind: 'item', target: item, label: `[E] Recoger ${item.name}` };
      }
    }

    const door = this.tilemap.findNearbyDoor(this.player);
    if (door) {
      if (door.type === 'inert_portal_gate') {
        return {
          kind: 'inert_portal_gate',
          target: { centerX: door.worldX, y: door.worldY, worldX: door.worldX, worldY: door.worldY },
          label: `[E] ${door.label}`
        };
      }
      return { kind: 'door', target: door, label: `[E] ${door.label}` };
    }

    const signpostAction = this.tilemap.findNearbySignpost(this.player);
    if (signpostAction) {
      return signpostAction;
    }

    const bed = this.tilemap.findNearbyBed(this.player);
    if (bed && this.housePermissions[this.tilemap.currentSceneId]) {
      return { kind: 'bed', target: bed, label: '[E] Descansar' };
    }

    let closestNPC = null;
    let minNPCDist = Infinity;
    for (const npc of npcs) {
      if (npc.canInteract(this.player)) {
        const d = npc.distanceTo(this.player);
        if (d < minNPCDist) {
          minNPCDist = d;
          closestNPC = npc;
        }
      }
    }
    if (closestNPC) {
      return { kind: 'npc', target: closestNPC, label: `[E] Hablar` };
    }

    let closestAnimal = null;
    let minAnimalDist = Infinity;
    for (const animal of animals) {
      if (animal.canInteract(this.player)) {
        const d = animal.distanceTo(this.player);
        if (d < minAnimalDist) {
          minAnimalDist = d;
          closestAnimal = animal;
        }
      }
    }
    if (closestAnimal) {
      return { kind: 'animal', target: closestAnimal, label: `[E] ${closestAnimal.name}` };
    }

    // Pesca en el Río Alba (overworld, columnas 25 a 32 cerca del agua)
    if (currentScene === 'overworld') {
      const pCol = Math.floor(this.player.centerX / 16);
      const pRow = Math.floor(this.player.centerY / 16);
      if (pCol >= 25 && pCol <= 32) {
        let nearWater = false;
        const ground = this.tilemap.scenes.overworld?.ground;
        if (ground) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const r = pRow + dr;
              const c = pCol + dc;
              if (ground[r] && (ground[r][c] === 4 || ground[r][c] === 5)) { // WATER_1 o WATER_2
                nearWater = true;
                break;
              }
            }
            if (nearWater) break;
          }
        }
        if (nearWater) {
          if (this.inventory && this.inventory.hasItem('bread')) {
            return { kind: 'river_fishing', label: '[E] Pescar Trucha en el Río Alba (Usa Pan)' };
          } else {
            return { kind: 'river_fishing_nobread', label: 'Río Alba (Necesitas Pan Campesino como cebo)' };
          }
        }
      }
    }

    return null;
  }

  _handleUseSelectedInventoryItem() {
    const item = this.inventory.getSelectedItem();
    if (!item) return;

    if (item.id === 'dawn_armor') {
      this.player.equipArmor();
      this.inventory.statusMessage = '¡Armadura del Código Binario equipada! Cuidado con robotizarte.';
    } else if (item.id === 'dawn_sword') {
      this.player.hasSword = true;
      this.inventory.statusMessage = '¡Espada de la Recursividad lista! Pulsa [ESPACIO] o [F].';
    } else if (item.id === 'coffee') {
      this.player.takeCoffee(1, 40);
      this.inventory.consumeItem('coffee', 1);
      this.inventory.statusMessage = '¡Café Compilado bebido! +1 Corazón y -40% robotización.';
      if (this.questLog) {
        this.questLog.advanceStep('quest_coffee_cure', '¡Robotización reducida! Mantén tus variables limpias tomando café o descansando en tu cama.');
      }
    } else if (item.id === 'hotfix') {
      this.player.hp = this.player.effectiveMaxHp;
      this.player.cureRobotization();
      this.inventory.consumeItem('hotfix', 1);
      this.inventory.statusMessage = '¡Parche Hotfix aplicado! Salud al 100% y 0% anomalías binarias.';
      if (this.questLog) {
        this.questLog.advanceStep('quest_coffee_cure', '¡Robotización reducida! Mantén tus variables limpias tomando café o descansando en tu cama.');
      }
    } else if (item.id === 'lantern') {
      this.player.hasLanternEquipped = !this.player.hasLanternEquipped;
      this.inventory.statusMessage = this.player.hasLanternEquipped
        ? '¡Farol equipado! Mayor luz nocturna.'
        : 'Farol guardado en la mochila.';
    } else if (item.id === 'bridge_pass') {
      this.tilemap.unlockBridgePermanently();
      this.inventory.statusMessage = '¡Pase activado! Puente abierto 24h.';
      if (this.achievementManager) {
        this.achievementManager.unlock('ach_bridge_pass');
      }
    } else if (item.id === 'potion') {
      this.player.speed = 92;
      this.player.hp = this.player.effectiveMaxHp;
      this.inventory.consumeItem('potion', 1);
      this.inventory.statusMessage = '¡Bebiste la Poción! Vida y velocidad restauradas.';
    } else if (item.id === 'bread') {
      this.player.hp = this.player.effectiveMaxHp;
      this.inventory.consumeItem('bread', 1);
      this.inventory.statusMessage = '¡Comiste Pan Campesino! Salud restaurada.';
    } else if (item.id === 'golden_apple') {
      this.player.speed = 98;
      this.player.hp = this.player.effectiveMaxHp;
      this.inventory.consumeItem('golden_apple', 1);
      this.inventory.statusMessage = '¡El Microondas Little recalentó tus variables en O(1)!';
    } else if (item.id === 'wheat') {
      this.inventory.statusMessage = 'Acércate a una oveja o gallina y pulsa [E].';
    } else if (item.id === 'apple') {
      this.player.hp = Math.min(this.player.effectiveMaxHp, this.player.hp + 1);
      this.inventory.consumeItem('apple', 1);
      this.inventory.statusMessage = '¡Comiste una Manzana Crujiente! +1 Corazón.';
    } else if (item.id === 'berry_pie') {
      this.player.hp = this.player.effectiveMaxHp;
      this.player.speed = 95;
      this.inventory.consumeItem('berry_pie', 1);
      this.inventory.statusMessage = '¡Devoraste el Pastel de Bayas! Salud al 100% y energía.';
    } else if (item.id === 'ointment') {
      this.player.takeCoffee(0.5, 50);
      this.inventory.consumeItem('ointment', 1);
      this.inventory.statusMessage = '¡Ungüento aplicado! -50% robotización binaria y +0.5 corazón.';
    } else if (item.id === 'fish') {
      this.player.hp = Math.min(this.player.effectiveMaxHp, this.player.hp + 1.5);
      this.inventory.consumeItem('fish', 1);
      this.inventory.statusMessage = '¡Comiste Trucha del Río Alba! +1.5 Corazones.';
    } else if (item.id === 'item_abyssal_pointer') {
      const activeBoss = this.enemies.find(
        (e) => e.isBoss && e.sceneId === this.tilemap.currentSceneId && e.activeCombat && !e.dead
      );
      if (this.tilemap.currentSceneId === 'condemned_realms' || activeBoss) {
        this.inventory.statusMessage = 'La realidad es demasiado inestable para invocar el portal aquí.';
        if (this.music) this.music.playHitHurt();
        return;
      }

      this.inventory.consumeItem('item_abyssal_pointer', 1);
      this.inventory.close();

      this.abyssalPortalOrigin = {
        sceneId: this.tilemap.currentSceneId,
        x: Math.round(this.player.x),
        y: Math.round(this.player.y)
      };

      if (this.tilemap.scenes.condemned_realms && this.tilemap.scenes.condemned_realms.exitDoor) {
        this.tilemap.scenes.condemned_realms.exitDoor.returnScene = this.abyssalPortalOrigin.sceneId;
        this.tilemap.scenes.condemned_realms.exitDoor.returnX = this.abyssalPortalOrigin.x;
        this.tilemap.scenes.condemned_realms.exitDoor.returnY = this.abyssalPortalOrigin.y;
      }

      this.activeAbyssalPortal = {
        sceneId: this.tilemap.currentSceneId,
        x: Math.round(this.player.centerX - 10),
        y: Math.round(this.player.centerY - 10),
        timer: 0
      };

      if (this.animeCutscenes) {
        this.animeCutscenes.cameraShake(5.0, 0.35);
        this.animeCutscenes.flash('#a855f7', 0.4);
      }
      if (this.music && typeof this.music.playAbyssalPortalSound === 'function') {
        this.music.playAbyssalPortalSound();
      }
      if (this.questLog) {
        this.questLog.advanceStep('quest_condemned_pointer', '¡Brecha dimensional abierta! Cruza el portal hacia el Santuario del Dios Supremo.');
      }
      this.menuSystem.showNotice('🌀 ¡Se ha abierto una brecha hacia los Reinos Condenados! Acércate y pulsa [E]', 4.5);
    } else if (item.id === 'spring_water') {
      this.player.hp = Math.min(this.player.effectiveMaxHp, this.player.hp + 0.5);
      this.player.takeCoffee(0, 20);
      this.inventory.consumeItem('spring_water', 1);
      this.inventory.statusMessage = '¡Bebiste Agua de Manantial! Refrescante y purificante.';
    }
    this._saveGameToStorage();
  }

  _handleDropSelectedInventoryItem() {
    const item = this.inventory.getSelectedItem();
    if (!item) return;

    // Proteger objetos clave y reliquias de ser descartados
    if (
      item.id === 'dawn_armor' ||
      item.id === 'dawn_sword' ||
      item.id === 'bridge_pass' ||
      item.id === 'golden_apple' ||
      item.id === 'item_abyssal_pointer'
    ) {
      this.inventory.statusMessage = '¡Este objeto clave no se puede descartar!';
      if (this.music) this.music.playHitHurt();
      return;
    }

    const dropped = this.inventory.dropSelectedItem();
    if (dropped) {
      if (this.music) this.music.playMenuMove();
      // Instanciar un WorldItem en el suelo a los pies del héroe
      this.worldItems.push(
        new WorldItem({
          id: `${dropped.id}_dropped_${Date.now()}`,
          name: dropped.name,
          description: dropped.description,
          iconIndex: dropped.iconIndex,
          x: Math.round(this.player.x),
          y: Math.round(this.player.y),
          sceneId: this.tilemap.currentSceneId,
          itemsSheet: this.assets.itemsSheet
        })
      );
      this._saveGameToStorage();
    }
  }

  _executeInteraction(action) {
    if (!action) return;

    if (action.kind === 'signpost') {
      const sign = action.target;
      this.dialogueBox.showMessage(sign.title, sign.lines);
      return;
    }

    if (action.kind === 'compiler_sign') {
      const sign = action.target;
      this.dialogueBox.showMessage(sign.title, [sign.text]);
      return;
    }

    if (action.kind === 'armor_compiler_panel') {
      const { A, B, C } = this.tilemap.armorPuzzle.switches;
      const condMet = (A === 1 && B === 1) || (C === 0);
      this.dialogueBox.showMessage('📜 [PANEL DE COMPILACIÓN BOOLEANA]', [
        '«Para extinguir la barrera del fuego sagrado y forjar la Armadura:»',
        'Condición requerida: [ (A && B) || !C ]',
        `Estado actual de baldosas: A = ${A}, B = ${B}, C = ${C}  ->  ${condMet ? 'TRUE (Compilación Válida ✓)' : 'FALSE (Error de Compilación ✕)'}`,
        condMet
          ? 'La condición se cumple. La barrera de fuego permanece desactivada.'
          : 'Pisa las baldosas de presión en el suelo para alternar sus valores lógicos.'
      ]);
      return;
    }

    if (action.kind === 'abyssal_portal') {
      this.dialogueBox.showMessage('Brecha Dimensional · Reinos Condenados', [
        'El vórtice violeta pulsa con energía cósmica y ruidos de estática dimensional.',
        'Conecta directamente con el Santuario del Dios Supremo para purificar la Maldición del Corazón Roto y el historial penal.',
        '¿Deseas cruzar al más allá?'
      ], [
        {
          label: '★ Sí, cruzar la brecha hacia el Dios Supremo',
          onSelect: () => {
            this.dialogueBox.close();
            this._executeStageTransition({
              type: 'stage_transition',
              targetScene: 'condemned_realms',
              label: 'Cruzar el Portal a los Reinos Condenados',
              spawnX: 11.5 * this.tilemap.tileSize,
              spawnY: 15 * this.tilemap.tileSize
            });
          }
        },
        {
          label: 'No, permanecer aquí',
          onSelect: () => {
            this.dialogueBox.close();
          }
        }
      ]);
      return;
    }

    if (action.kind === 'inert_portal_gate') {
      this.dialogueBox.showMessage('Arco Dimensional Inerte', [
        'El antiguo arco de obsidiana del norte permanece frío y completamente apagado.',
        'Las inscripciones rúnicas dictan: «Solo el sagrado Puntero al Abismo (Null Pointer) consagrado en el mundo exterior puede rasgar el tejido de la realidad e invocar la brecha hacia el Dios Supremo».',
        'Explora los senderos, claros y orillas de Valleverde para hallar el cristal cósmico.'
      ]);
      return;
    }

    if (action.kind === 'river_fishing') {
      this.inventory.consumeItem('bread', 1);
      this.inventory.addItem({
        id: 'fish',
        name: 'Trucha del Río Alba',
        description: 'Pescado fresco del río. Restaura 1.5 corazones al instante.',
        iconIndex: ITEM_ICONS.FISH,
        qty: 1
      });
      if (this.music) {
        this.music.playFanfare();
      }
      const curFish = this.inventory.getItemCount('fish');
      if (this.questLog) {
        this.questLog.advanceStep(
          'quest_side_fishing',
          `Has pescado ${curFish}/3 Truchas del Río Alba con cebo de pan. Llévalas a Finn en la plaza.`
        );
      }
      this._saveGameToStorage();
      this.dialogueBox.showMessage('🎣 ¡Trucha del Río Alba Capturada!', [
        'Arrojaste migajas de Pan Campesino a las aguas cristalinas del Río Alba...',
        '¡Una hermosa trucha plateada mordió el cebo de inmediato!',
        `Se ha añadido [Trucha del Río Alba x1] a tu mochila. (Llevas: ${curFish}/3)`
      ]);
      return;
    }

    if (action.kind === 'river_fishing_nobread') {
      this.dialogueBox.showMessage('Río Alba · Aguas Profundas', [
        'Las aguas del Río Alba fluyen frescas y cristalinas hacia el este.',
        'Se aprecian sombras de truchas esquivas nadando en el fondo del río.',
        'Necesitas llevar [Pan Campesino] en tu mochila para arrojar migajas como cebo y pescarlas.'
      ]);
      return;
    }

    if (action.kind === 'sword_monolith') {
      this._handleSwordMonolithStrike(action.target.id);
      return;
    }

    if (action.kind === 'item') {
      const item = action.target;

      // Puzles de los Templos Binarios: impedir extracción sin resolver
      if (item.id === 'dawn_armor' && (!this.tilemap.armorPuzzle?.solved || this.tilemap.armorPuzzle?.barrierActive)) {
        const { A, B, C } = this.tilemap.armorPuzzle.switches;
        const condMet = (A === 1 && B === 1) || (C === 0);
        this.dialogueBox.showMessage('🏛️ [SANTUARIO DE LA ARMADURA BINARIA]', [
          'La Armadura del Código Binario reposa sobre el pedestal sagrado.',
          'Una barrera de llamas arcanas impide extraerla mientras la condición booleana no sea válida.',
          `Condición requerida: [ (A && B) || !C ]  ->  Estado actual: A=${A}, B=${B}, C=${C} [${condMet ? 'TRUE ✓' : 'FALSE ✕'}]`,
          'Pisa los tres interruptores de presión (A, B y C) en el suelo de la sala para alternar sus valores hasta compilar en TRUE.'
        ]);
        return;
      }

      if (item.id === 'dawn_sword' && !this.tilemap.swordPuzzle?.solved) {
        this.dialogueBox.showMessage('🏛️ [PEDESTAL DE LA ESPADA DE LA RECURSIVIDAD]', [
          'La Espada de la Recursividad está envuelta en un bucle temporal infinito.',
          'El pedestal sagrado permanecerá sellado hasta alcanzar el Caso Base de la memoria.',
          'Acércate a los 3 monolitos rúnicos y pulsa [E] para sintonizarlos en el orden recursivo correcto: [λ₃ -> λ₁ -> λ₂].'
        ]);
        return;
      }

      const invId = item.id.startsWith('silicon_flower')
        ? 'silicon_flower'
        : item.id.startsWith('drone_scrap')
        ? 'drone_scrap'
        : item.id;

      const added = this.inventory.addItem({
        id: invId,
        name: item.name,
        description: item.description,
        iconIndex: item.iconIndex,
        qty: 1
      });
      if (added) {
        item.collected = true;

        if (invId === 'silicon_flower') {
          const fCount = this.inventory.getItemCount('silicon_flower');
          if (this.questLog) {
            this.questLog.advanceStep(
              'quest_side_silicon_flowers',
              `Has recolectado ${fCount}/3 Flores de Silicio. Llévaselas a la Herbolaria Lyra en Valleverde.`
            );
          }
          this._saveGameToStorage();
          this.dialogueBox.showMessage('✿ Flor de Silicio Recogida', [
            'Has recogido una rara Flor de Silicio bioluminiscente de noche.',
            `Sus pétalos desprenden un fulgor cian hipnótico. (Llevas: ${fCount}/3)`
          ]);
          return;
        }

        if (invId === 'drone_scrap') {
          const sCount = this.inventory.getItemCount('drone_scrap');
          if (this.questLog) {
            this.questLog.advanceStep(
              'quest_side_fractal_temper',
              `Has conseguido ${sCount}/2 restos de chatarra de drones. Llévaselos al Herrero Brom.`
            );
          }
          this._saveGameToStorage();
          this.dialogueBox.showMessage('⚙️ Chatarra de Dron Recogida', [
            'Has recuperado fragmentos de aleación fractal y circuitos de un dron de AI Alex.',
            `Llévaselos al Herrero Brom para forjar el templado de tu espada. (Llevas: ${sCount}/2)`
          ]);
          return;
        }

        if (item.id === 'dawn_armor') {
          this.player.equipArmor();
          this.music.playFanfare();
          if (this.questLog) {
            this.questLog.advanceStep('quest_code_temples', 'Armadura Binaria obtenida. Ahora resuelve el Templo de la Espada para empuñar la Espada de la Recursividad.');
          }
          if (this.player.hasArmor && this.player.hasSword) {
            this.tilemap.unlockFirstStageGate();
          }
          this._saveGameToStorage();
          this.dialogueBox.showMessage('🛡 ¡Armadura del Código Binario!', [
            '¡Te has vestido con la [Armadura del Código Binario]! Hecha de 0s y 1s sagrados.',
            'Ya no estás indefenso ante los ataques enemigos. Pero ten cuidado: llevarla puesta con el tiempo te robotiza.',
            'Para desrobotizarte puedes beber Café Compilado, aplicar Parches Hotfix o descansar en tu cama de programador.'
          ]);
          return;
        }

        if (item.id === 'dawn_sword') {
          this.player.hasSword = true;
          if (this.questLog) {
            this.questLog.advanceStep('quest_code_temples', '¡Armadura y Espada consagradas! Derrota al Guardián del Stack Overflow en la Cámara Norte del Templo para abrir la ruta a la Ciudadela.');
          }
          if (this.player.hasArmor && this.player.hasSword) {
            this.tilemap.unlockFirstStageGate();
          }
          this._saveGameToStorage();
          this.menuSystem.startSwordObtainedCutscene(() => {
            this.menuSystem.state = 'none';
            this.music.setMode('stage1');
            this.dialogueBox.showMessage('⚔ ¡Arma Consagrada: Espada de la Recursividad!', [
              '¡Has empuñado la [Espada de la Recursividad]! Cada tajo llama recursivamente al siguiente hasta alcanzar el caso base.',
              'Pulsa [ESPACIO] o [F] para atacar continuamente a los bugs y esbirros de Mister AI Alex sin desbordar el stack.',
              '¡El despertar de la espada ha liberado al Guardián del Stack Overflow en el portal septentrional!'
            ], [
              {
                label: '★ ¡Enfrentar al Guardián!',
                onSelect: () => {
                  this.dialogueBox.close();
                  const boss = this.enemies.find((e) => e.id === 'boss_stack_overflow');
                  if (boss && !boss.dead) {
                    this._triggerBossIntroCutscene(boss);
                  }
                }
              }
            ]);
          });
          return;
        }

        this._saveGameToStorage();
        if (item.id === 'item_abyssal_pointer') {
          if (this.questLog) {
            this.questLog.advanceStep('quest_condemned_pointer', 'Abre tu mochila [I] y usa el Puntero Abisal [E] para rasgar la realidad e invocar el portal a los Reinos Condenados.');
          }
          this.dialogueBox.showMessage('🔮 ¡Puntero al Abismo Encontrado!', [
            'Has obtenido el sagrado [Puntero al Abismo (Null Pointer)].',
            'Un cristal radiante con runas cósmicas. Abre tu mochila con [I], selecciónalo y úsalo con [E] para rasgar la realidad e invocar el portal hacia los Reinos Condenados del Dios Supremo.'
          ]);
        } else if (item.id === 'golden_apple') {
          this.menuSystem.startRelicFoundCutscene(() => {
            this.menuSystem.state = 'none';
            this.dialogueBox.showMessage('Reliquia Obtenida', [
              `Has guardado [${item.name}] en tu inventario.`,
              item.description
            ]);
          });
        } else {
          this.dialogueBox.showMessage('Objeto Obtenido', [
            `Has guardado [${item.name}] en tu inventario.`,
            item.description
          ]);
        }
      } else {
        this.dialogueBox.showMessage('Mochila Llena', [
          'No tienes espacio libre en el inventario.'
        ]);
      }
    } else if (action.kind === 'bed') {
      this._openBedSleepMenu();
    } else if (action.kind === 'door') {
      const door = action.target;
      if (door.type === 'bridge_gate') {
        this.dialogueBox.showMessage('Puente del Este · Precintado', [
          'El paso hacia las Tierras Sagradas del este está bloqueado por una sólida barrera de madera.',
          'Los Guardias del Binario custodian el acceso e impiden el paso.',
          'Habla con los guardias o visita al Gran Sabio Aurelio en su casa (al noroeste, tejado azul) para conocer la causa del cierre y obtener autorización.'
        ]);
        return;
      }

      if (door.type === 'stage_locked') {
        this.dialogueBox.showMessage('Portal Sagrado Sellado', [
          'El Portal hacia Valleverde permanece cerrado por un sello protector del Alba.',
          'Debes equiparte primero con la [Armadura del Alba] (Oeste) y la [Espada del Alba] (Norte) para poder hacer frente a las tinieblas de Mister AI Alex.'
        ]);
        return;
      }

      if (door.type === 'stage_transition') {
        // 1. GATEKEEPING GENERAL: Parar al jugador si no está preparado para zonas hostiles
        if (door.targetScene === 'first_stage') {
          if (!this.player.hasArmor || !this.player.hasSword) {
            if (this.tilemap.currentSceneId === 'overworld') {
              this.player.x = 3.5 * this.tilemap.tileSize;
            }
            this.dialogueBox.showMessage('⚠️ [NO ESTÁS PREPARADO]', [
              '¡Detente! Las Ruinas del Despertar están infestadas de drones y anomalías corruptas de Mister AI Alex.',
              'Sin tu [Armadura del Código Binario] cualquier impacto te aniquilará al instante, y sin tu [Espada de la Recursividad] no podrás defenderte.',
              'Habla con el Gran Sabio Aurelio en Valleverde y cruza el Puente del Este para superar las Pruebas Sagradas y consagrar tu equipo primero.'
            ]);
            return;
          }
        }

        if (door.targetScene === 'sewers_dungeon') {
          if (!this.player.hasArmor || !this.player.hasSword) {
            this.player.y = 19 * this.tilemap.tileSize;
            this.dialogueBox.showMessage('⚠️ [NO ESTÁS PREPARADO]', [
              '¡Un hedor a memoria corrompida y fugas de punteros brota de la trampilla!',
              'No puedes descender a la Fosa de Memoria sin tu Armadura Binaria y tu Espada de la Recursividad para enfrentar al Garbage Collector Furioso.',
              'Habla con Aurelio y supera las Pruebas Sagradas del Este antes de descender a las cloacas.'
            ]);
            return;
          }
        }

        if (door.targetScene === 'sword_temple') {
          if (!this.player.hasArmor) {
            if (this.tilemap.currentSceneId === 'overworld') {
              this.player.y = 18 * this.tilemap.tileSize;
            } else {
              this.player.y = door.worldY + 24;
            }
            this.dialogueBox.showMessage('⚠️ [ORDEN DE LAS PRUEBAS SAGRADAS]', [
              'El Gran Sabio Aurelio te encomendó consagrar primero la Armadura del Código Binario en el Templo Septentrional (Norte).',
              'La energía de la Espada de la Recursividad ejerce una presión psíquica letal sobre quien no vista la armadura sagrada.',
              'Dirígete al Templo Norte para forjar tu armadura primero.'
            ]);
            return;
          }
        }

        if (door.targetScene === 'ai_fortress_gate' || door.targetScene === 'ai_citadel') {
          if (!this.player.hasArmor || !this.player.hasSword) {
            this.player.y = door.worldY + 24;
            this.dialogueBox.showMessage('⚠️ [NO ESTÁS PREPARADO]', [
              'La Fortaleza de Mister AI Alex está protegida por barreras electromagnéticas letales.',
              'Necesitas tu equipo sagrado completo (Armadura Binaria y Espada de la Recursividad) antes de franquear este umbral.'
            ]);
            return;
          }
        }

        if (door.targetScene === 'condemned_realms') {
          this.dialogueBox.showMessage('Umbral Místico · Reinos Condenados', [
            'Estás frente al Portal Rúnico de Obsidiana hacia los Reinos Condenados.',
            'Este plano espiritual conecta con el Santuario del Dios Supremo, donde las almas afligidas con la Maldición del Corazón Roto pueden solicitar audiencia y purificación.',
            '¿Deseas cruzar el vórtice dimensional hacia el más allá?'
          ], [
            {
              label: '★ Sí, descender a los Reinos Condenados',
              onSelect: () => {
                this.dialogueBox.close();
                this._executeStageTransition(door);
              }
            },
            {
              label: 'No, permanecer en Valleverde',
              onSelect: () => {
                this.dialogueBox.close();
                this.player.y = 4 * this.tilemap.tileSize;
              }
            }
          ]);
          return;
        }

        const destTitle = door.targetScene === 'first_stage'
          ? 'Ruinas del Despertar (Escenario 1)'
          : door.targetScene === 'armor_temple'
            ? 'Templo de la Armadura del Código Binario'
            : door.targetScene === 'sword_temple'
              ? 'Templo de la Espada de la Recursividad'
              : 'las Tierras Exteriores';

        const isTemple = door.targetScene === 'armor_temple' || door.targetScene === 'sword_temple';
        const inFirstStage = this.tilemap.currentSceneId === 'first_stage';

        this.dialogueBox.showMessage(`Acceso: ${destTitle}`, [
          `Estás ante el umbral de [${destTitle}].`,
          isTemple
            ? 'En su interior reposan reliquias sagradas y pruebas del Código Primigenio.'
            : 'Más allá de los límites protegidos de Valleverde acechan bugs salvajes y la corrupción de Mister AI Alex.',
          '¿Deseas franquear el acceso y continuar?'
        ], [
          {
            label: '★ Sí, franquear el umbral',
            onSelect: () => {
              this.dialogueBox.close();
              if (door.targetScene === 'first_stage') {
                this.animeCutscenes.playCutscene(SCENE_AI_ALEX_WARNING, () => {
                  this._executeStageTransition(door);
                });
              } else {
                this._executeStageTransition(door);
              }
            }
          },
          ...(inFirstStage ? [
            {
              label: 'Regresar a la seguridad de Valleverde',
              onSelect: () => {
                this.dialogueBox.close();
                this._executeStageTransition({
                  type: 'stage_transition',
                  targetScene: 'overworld',
                  spawnX: 3.5 * this.tilemap.tileSize,
                  spawnY: 12.5 * this.tilemap.tileSize
                });
              }
            }
          ] : []),
          {
            label: 'No, permanecer aquí',
            onSelect: () => {
              this.dialogueBox.close();
              if (inFirstStage) {
                this.player.y = door.worldY + 24;
              } else if (door.targetScene === 'first_stage' && this.tilemap.currentSceneId === 'overworld') {
                this.player.x = 3.5 * this.tilemap.tileSize;
              } else if (door.targetScene === 'armor_temple' && this.tilemap.currentSceneId === 'overworld') {
                this.player.y = 7 * this.tilemap.tileSize;
              } else if (door.targetScene === 'sword_temple' && this.tilemap.currentSceneId === 'overworld') {
                this.player.y = 18 * this.tilemap.tileSize;
              }
            }
          }
        ]);
        return;
      }

      this._executeStageTransition(door);
    } else if (action.kind === 'npc') {
      const npc = action.target;
      npc.faceEntity(this.player);
      this.dialogueBox.start(npc);
    } else if (action.kind === 'animal') {
      const animal = action.target;
      animal.triggerHeart();
      this.music.playAnimalSound(animal.species);

      if (
        (animal.species === 'sheep' || animal.species === 'chicken') &&
        this.inventory.hasItem('wheat')
      ) {
        this.inventory.consumeItem('wheat', 1);
        if (this.questLog) {
          this.questLog.advanceStep('quest_farm_animals', '¡Has alimentado a un compañero animal! Cuida de las ovejas, gallinas y Toby para recibir su bendición.');
        }
        this._saveGameToStorage();
        this.dialogueBox.showMessage(animal.name, [animal.fedText]);
      } else if (animal.species === 'dog' && this.inventory.hasItem('bread')) {
        this.inventory.consumeItem('bread', 1);
        if (this.questLog) {
          this.questLog.advanceStep('quest_farm_animals', '¡Has alimentado al perro Toby con pan campesino! Su lealtad te acompañará en tu aventura.');
        }
        this._saveGameToStorage();
        this.dialogueBox.showMessage(animal.name, [animal.fedText]);
      } else {
        this.dialogueBox.showMessage(animal.name, [animal.soundText]);
      }
    }
  }

  _handleSwordMonolithStrike(monolithId) {
    if (!this.tilemap?.swordPuzzle) return;
    const res = this.tilemap.hitSwordMonolith(monolithId);
    if (!res) return;

    if (res.alreadySolved) {
      this.menuSystem.showNotice('⚡ El Caso Base ya fue alcanzado. El portal permanece abierto.', 2.5);
      return;
    }

    if (res.success && res.finished) {
      if (this.music && typeof this.music.playFanfare === 'function') {
        this.music.playFanfare();
      }
      if (this.animeCutscenes) {
        this.animeCutscenes.cameraShake(5.0, 0.45);
        this.animeCutscenes.flash('#fde047', 0.4);
      }
      if (this.questLog) {
        this.questLog.advanceStep('quest_code_temples', 'Caso base alcanzado. ¡Recoge la Espada de la Recursividad y cruza hacia el Guardián del Stack Overflow!');
      }
      this._saveGameToStorage();
      this.dialogueBox.showMessage('🔱 [CASO BASE DE RECURSIÓN ALCANZADO]', [
        '¡La secuencia de ejecución [Monolito 3 -> 1 -> 2] ha concluido con éxito!',
        'El bucle infinito de la pila ha sido resuelto y neutralizado.',
        '¡El portal septentrional hacia la arena del Guardián del Stack Overflow se ha abierto!'
      ]);
    } else if (res.success && !res.finished) {
      if (this.music && typeof this.music.playMenuSelect === 'function') {
        this.music.playMenuSelect();
      }
      this.menuSystem.showNotice(
        `✨ Runa activada. Pila recursiva: [${res.stack.join(' -> ')}] (${res.step}/3)`,
        2.5
      );
    } else if (!res.success && res.error === 'STACK_OVERFLOW') {
      if (this.music && typeof this.music.playMenuSelect === 'function') {
        this.music.playMenuSelect();
      }
      this.menuSystem.showNotice('🌀 Desbordamiento de pila: registros reiniciados a la raíz.', 2.5);
      this.dialogueBox.showMessage('🌀 [PILAS DE RECURSIÓN: REINICIO]', [
        '¡Secuencia incorrecta! El hilo recursivo no alcanzó el Caso Base esperado.',
        'La memoria de la pila se ha restablecido a su estado inicial.',
        'Pista mística: Inicia la llamada por la runa terminal [λ₃], luego [λ₁] y finalmente [λ₂].'
      ]);
    }
  }

  _executeStageTransition(door) {
    if (door.type === 'exit') {
      this._restoreAllNPCsToOverworld();
    }
    // Limpiar proyectiles, clones, ondas y charcos activos de cualquier jefe al cambiar de escena
    for (const en of this.enemies) {
      if (en.isBoss && !en.dead && typeof en.resetCombatState === 'function') {
        en.resetCombatState();
      }
    }
    // Si entramos a un templo, configurar su puerta de salida para regresar exactamente a la escena de origen
    if (door.targetScene === 'armor_temple' || door.targetScene === 'sword_temple') {
      const targetTemple = this.tilemap.scenes[door.targetScene];
      if (targetTemple && targetTemple.exitDoor) {
        targetTemple.exitDoor.returnScene = this.tilemap.currentSceneId;
        targetTemple.exitDoor.returnX = door.worldX;
        targetTemple.exitDoor.returnY = door.worldY + 22;
      }
    }
    this.tilemap.loadScene(door.targetScene);
    this.camera.setWorldBounds(this.tilemap.width, this.tilemap.height);
    this.player.x = door.spawnX;
    this.player.y = door.spawnY;
    this.player.direction =
      door.type === 'enter'
        ? 'up'
        : door.type === 'stage_transition'
          ? door.targetScene === 'overworld'
            ? 'down'
            : door.targetScene === 'condemned_realms'
              ? 'up'
              : door.targetScene === 'first_stage'
                ? 'left'
                : 'up'
          : 'down';
    this.camera.snapTo(this.player);

    if (this.music && this.music.currentBossTrack) {
      this.music.stopBossMusic(false);
    }

    this.music.setMode(
      door.targetScene === 'condemned_realms' || door.targetScene === 'first_stage'
        ? 'stage1'
        : 'village'
    );

    if (door.type === 'enter') {
      const doorMeta = this.tilemap.houseDoors.find(
        (d) => d.sceneId === door.targetScene
      );
      this._handleHouseOwnerConfrontation(door.targetScene, doorMeta || door);
    } else {
      this._saveGameToStorage();
    }

    if (door.targetScene === 'condemned_realms') {
      if (this.questLog) {
        this.questLog.advanceStep('quest_condemned_pointer', 'Habla con el Dios Supremo en el altar sagrado para purificar tu corazón e historial penal.');
      }
      if (this.achievementManager) {
        this.achievementManager.unlock('ach_condemned');
      }
    } else if (door.targetScene === 'sewers_dungeon' && this.questLog) {
      this.questLog.advanceStep('quest_boss_garbage', 'Enfréntate al Garbage Collector Furioso en el fondo de las alcantarillas.');
    } else if (door.targetScene === 'ai_fortress_gate' && this.questLog) {
      this.questLog.advanceStep('quest_boss_microwave', 'Infiltra el Umbral de la Fortaleza y destruye el Prototipo del Microondas de AI Alex.');
    } else if (door.targetScene === 'ai_citadel' && this.questLog) {
      this.questLog.advanceStep('quest_boss_final', 'Asciende a la Ciudadela de AI Alex, destruye el Microondas Cuántico y consagra El Ojete Dorado.');
    }

    if (door.targetScene === 'ai_citadel' && !this.prebattleAlexCutscenePlayed) {
      this.prebattleAlexCutscenePlayed = true;
      if (this.animeCutscenes) {
        this.animeCutscenes.playCutscene(SCENE_AI_ALEX_PREBATTLE);
      }
    } else if (door.targetScene === 'sewers_dungeon' && !this.bossCutscenesSeen.boss_garbage_collector) {
      const gcBoss = this.enemies.find((e) => e.id === 'boss_garbage_collector');
      if (gcBoss && !gcBoss.dead) {
        this._triggerBossIntroCutscene(gcBoss);
      }
    } else if (door.targetScene === 'ai_fortress_gate' && !this.bossCutscenesSeen.boss_prototype_microwave) {
      const protoBoss = this.enemies.find((e) => e.id === 'boss_prototype_microwave');
      if (protoBoss && !protoBoss.dead) {
        this._triggerBossIntroCutscene(protoBoss);
      }
    }
  }

  _triggerBossIntroCutscene(boss) {
    if (!boss || !boss.isBoss || boss.dead) return;
    const cutscene = getBossIntroCutscene(boss.id);
    if (!cutscene) return;

    this.bossCutscenesSeen[boss.id] = true;
    boss.introCutscenePlayed = true;
    boss.activeCombat = false;

    if (this.animeCutscenes) {
      this.animeCutscenes.playCutscene(cutscene, () => {
        boss.activeCombat = true;
        if (this.music && typeof this.music.playBossMusic === 'function') {
          this.music.playBossMusic(boss.trackName);
        }
        this._saveGameToStorage();
      });
    } else {
      boss.activeCombat = true;
      if (this.music && typeof this.music.playBossMusic === 'function') {
        this.music.playBossMusic(boss.trackName);
      }
      this._saveGameToStorage();
    }
  }

  _checkBossIntroTriggers() {
    if (this.animeCutscenes && this.animeCutscenes.isActive) return;
    if (this.dialogueBox.active || this.menuSystem.isBlockingGameplay()) return;

    const curScene = this.tilemap.currentSceneId;
    const boss = this.enemies.find(
      (e) => e.isBoss && e.sceneId === curScene && !e.dead
    );
    if (!boss) return;

    // En el Templo de la Espada, el Guardián del Stack Overflow SOLO se manifiesta
    // cuando el héroe ya ha desenvainado la Espada de la Recursividad
    if (boss.id === 'boss_stack_overflow' && !this.player.hasSword) {
      return;
    }

    // Si ya vio la cinemática, asegurarse de que boss.introCutscenePlayed sea true
    if (this.bossCutscenesSeen && this.bossCutscenesSeen[boss.id]) {
      boss.introCutscenePlayed = true;
      return;
    }

    // Verificar si el jugador entra al alcance de activación de la arena del jefe
    const dist = boss.distanceTo(this.player);
    if (dist <= boss.combatTriggerDistance) {
      this._triggerBossIntroCutscene(boss);
    }
  }

  _handlePlayerDefeated() {
    const wasDefenseless = !this.player.hasArmor;
    this.player.hp = this.player.effectiveMaxHp;
    this.player.invulnerableTimer = 2.0;
    this.player.knockbackTimer = 0;

    const curScene = this.tilemap.currentSceneId;
    if (curScene === 'first_stage') {
      this.player.x = 31 * 16;
      this.player.y = 12 * 16;
      this.player.direction = 'left';
    } else if (curScene === 'armor_temple') {
      this.player.x = 10.5 * 16;
      this.player.y = 15 * 16;
      this.player.direction = 'up';
    } else if (curScene === 'sword_temple') {
      this.player.x = 11.5 * 16;
      this.player.y = 15 * 16;
      this.player.direction = 'up';
    } else if (curScene === 'sewers_dungeon') {
      this.player.x = 11.5 * 16;
      this.player.y = 15 * 16;
      this.player.direction = 'up';
    } else if (curScene === 'ai_fortress_gate') {
      this.player.x = 11.5 * 16;
      this.player.y = 15 * 16;
      this.player.direction = 'up';
    } else if (curScene === 'ai_citadel') {
      this.player.x = 11.5 * 16;
      this.player.y = 15 * 16;
      this.player.direction = 'up';
    } else {
      // Overworld (Valleverde) u otros exteriores
      this.player.x = 12.5 * 16;
      this.player.y = 14 * 16;
      this.player.direction = 'down';
    }

    // Reiniciar posición de patrulla y estado de combate de los enemigos vivos para no bloquear al jugador
    for (const en of this.enemies) {
      if (!en.dead) {
        if (en.isBoss && typeof en.resetCombatState === 'function') {
          en.resetCombatState();
        } else if (en.patrolPoints && en.patrolPoints.length > 0) {
          en.x = en.patrolPoints[0].x;
          en.y = en.patrolPoints[0].y;
        }
      }
    }
    this.camera.snapTo(this.player);

    if (wasDefenseless) {
      this.dialogueBox.showMessage('💔 ¡Has Caído Indefenso! (Vida: 0)', [
        'Sabio Aurelio: «¡Te lo advertí, joven elegido! Sin tu Armadura estás completamente INDEFENSO ante las anomalías de Mister AI Alex.»',
        '«He curado tus heridas y te he llevado a una zona protegida. Ve al Templo del Código Binario para forjar tu [Armadura del Código Binario] antes de luchar.»'
      ]);
    } else {
      this.dialogueBox.showMessage('💔 ¡Herido en Combate! (Vida: 0)', [
        'Sabio Aurelio: «¡Resiste, elegido! He restaurado tus corazones.»',
        '«Recuerda pulsar [ESPACIO] o [F] para atacar con tu Espada de la Recursividad, o esquivar con el Dash Asíncrono.»'
      ]);
    }
  }

  _formatPlayTime(sec) {
    const total = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m} min ${s < 10 ? '0' : ''}${s} s`;
  }

  _computePlayerFinalTitle() {
    const hasAll = Boolean(this.player.hasDash && this.player.hasChargedAttack && this.player.hasBarrier);
    const j = this.totalJailVisits || 0;
    if (hasAll && j === 0) return 'Senior Lead Architect del Gran Ojal';
    if (hasAll && j <= 2) return 'Staff Full-Stack Bug Hunter';
    if (j >= 3) return 'Hacker Prófugo del Calabozo Municipal';
    if (hasAll) return 'Senior Developer de Valleverde';
    return 'Junior Dev Superviviente del Despido';
  }

  _triggerVictorySequence(boss) {
    // 1. Congelar la sala y detener música de combate
    if (this.music && typeof this.music.stopBossMusic === 'function') {
      this.music.stopBossMusic(false);
    }

    // 2. Resumen del Expediente del Jugador
    const record = {
      playTimeSeconds: Math.round(this.totalPlayTimeSeconds || 0),
      playTimeFormatted: this._formatPlayTime(this.totalPlayTimeSeconds),
      jailVisits: this.totalJailVisits || 0,
      coins: this.player.coins || 0,
      robotization: Math.round(this.player.robotizationLevel || 0),
      hasDash: Boolean(this.player.hasDash),
      hasChargedAttack: Boolean(this.player.hasChargedAttack),
      hasBarrier: Boolean(this.player.hasBarrier),
      abilities: [
        this.player.hasDash ? 'Dash Asíncrono' : null,
        this.player.hasChargedAttack ? 'Corte en Cascada' : null,
        this.player.hasBarrier ? 'Barrera TypeScript' : null
      ].filter(Boolean),
      title: this._computePlayerFinalTitle()
    };

    // 3. Disparar cinemática SCENE_ENDING_VICTORY
    if (this.animeCutscenes) {
      this.animeCutscenes.playCutscene(SCENE_ENDING_VICTORY, () => {
        // Al finalizar la cinemática:
        // Detener música de combate y reproducir el tema triunfal de victoria en AmbientMusic.js
        if (this.music && typeof this.music.playVictoryTheme === 'function') {
          this.music.playVictoryTheme();
        }

        // Submódulo de Créditos: Scroll vertical con estrellas pixeladas
        this.menuSystem.startEndingCredits(record, () => {
          this._resetWorldToInitialState();
          this.menuSystem.openTitleScreen();
        });
      });
    }
  }

  _openBedSleepMenu() {
    const isPlayerHouse = this.tilemap.currentSceneId === 'player_house';
    const title = isPlayerHouse ? 'Tu Cama de Programador' : 'Cama de Descanso';
    const choices = [
      {
        label: '🌅 Día (08:00 AM - Hora de compilar y picar código)',
        onSelect: () => this._applySleep(8.0, 'Has despertado con el sol de la mañana (08:00 AM). Stack de llamadas purgado y memoria limpia.')
      },
      {
        label: '☀️ Tarde (15:00 PM - Hora de café y desplegar hotfixes)',
        onSelect: () => this._applySleep(15.0, 'Has despertado a media tarde (15:00 PM). ¡Hora perfecta para un buen café compilado!')
      },
      {
        label: '🌙 Noche (22:00 PM - Despliegue a producción sin tests)',
        onSelect: () => this._applySleep(22.0, 'Has despertado en plena noche (22:00 PM). ¡Cuidado con los bugs nocturnos al cruzar el puente!')
      },
      {
        label: '❌ No dormir ahora',
        onSelect: () => this.dialogueBox.close()
      }
    ];

    this.dialogueBox.showMessage(
      title,
      [
        '¿A qué hora del ciclo temporal deseas despertar?',
        'Dormir restaurará todos tus corazones y purgará por completo la robotización binaria.'
      ],
      choices
    );
  }

  _applySleep(hour, message) {
    this.dayNight.timeOfDayHours = hour;
    this.tilemap.update(0, this.dayNight.timeOfDayHours);
    this.player.hp = this.player.effectiveMaxHp;
    this.player.cureRobotization();
    this.music.playFanfare();
    this._saveGameToStorage();
    const hpMsg = this.player.hasBrokenHeartCurse
      ? '♥ Salud restablecida (salvo el medio corazón bajo la Maldición del Carcelero 💔).'
      : '♥ Corazones al 100%.';
    this.dialogueBox.showMessage('Descanso Reparador', [
      message,
      `${hpMsg} 🤖 Robotización binaria restablecida al 0%.`
    ]);
  }

  update(dt) {
    this.promptTimer += dt * 4.5;
    if (!this.menuSystem.isBlockingGameplay() && !this.dialogueBox.active && (!this.animeCutscenes || !this.animeCutscenes.isActive)) {
      this.totalPlayTimeSeconds += dt;
    }

    if (this.input.consumeKey('KeyM')) {
      if (this.menuSystem.state === 'world_map') {
        this.menuSystem.closeWorldMap();
      } else if (!this.dialogueBox.active && !this.inventory.isOpen && !this.characterStats.isOpen && (!this.questLogView || !this.questLogView.isOpen)) {
        if (this.questLogView) this.questLogView.close();
        this.menuSystem.openWorldMap(this.tilemap.currentSceneId, {
          player: this.player,
          enemies: this.enemies
        });
        this.input.endFrame();
        return;
      }
    }

    if (this.menuSystem.isBlockingGameplay()) {
      this.menuSystem.update(dt, this.input);
      this.input.endFrame();
      return;
    }

    if (this.animeCutscenes && this.animeCutscenes.isActive) {
      this.animeCutscenes.update(dt, this.input);
      this.input.endFrame();
      return;
    }

    if (this.isJailedForever && this.tilemap.currentSceneId === 'jail_cell' && this.menuSystem.state !== 'game_over') {
      this.dialogueBox.close();
      this.menuSystem.openGameOverScreen(false, 'jail_disrespect');
      this.input.endFrame();
      return;
    }

    if (this.jailRemainingSeconds > 0 && !this.isJailedForever) {
      this.jailRemainingSeconds = Math.max(0, this.jailRemainingSeconds - dt);
      if (this.jailRemainingSeconds === 0 && this.tilemap.currentSceneId === 'jail_cell') {
        this._releaseFromJail([
          '¡Has cumplido tus 10 minutos de condena municipal!',
          'El Carcelero abre los barrotes. Procura ser más amable con el Oráculo IA.'
        ]);
      }
    }

    if (this.aiChatOpen) {
      this.dayNight.update(dt);
      this.tilemap.update(dt, this.dayNight.timeOfDayHours);
      this.input.endFrame();
      return;
    }

    // Apertura independiente de la Mochila (Tecla 'I' o Tab, salvo cuando la Ficha 'C' usa Tab para cambiar de pestaña)
    if (
      !this.dialogueBox.active &&
      this.menuSystem.state === 'none' &&
      !this.characterStats.isOpen &&
      this.input.consumeInventoryToggle()
    ) {
      if (this.questLogView && this.questLogView.isOpen) {
        this.questLogView.close();
      }
      this.inventory.toggle();
      if (this.inventory.isOpen) {
        this.player.stopMovement();
        if (this.music) this.music.playMenuSelect();
      }
    }

    // Apertura independiente de la Ficha de Desarrollo (Tecla 'C')
    if (this.input.consumeCharacterToggle() && !this.dialogueBox.active && this.menuSystem.state === 'none') {
      if (this.inventory.isOpen) {
        this.inventory.close();
      }
      if (this.questLogView && this.questLogView.isOpen) {
        this.questLogView.close();
      }
      this.characterStats.toggle();
      if (this.characterStats.isOpen) {
        this.player.stopMovement();
        if (this.music) this.music.playMenuSelect();
      }
    }

    // Apertura independiente del Diario de Misiones (Tecla 'L')
    if (this.input.consumeQuestLogToggle() && !this.dialogueBox.active && this.menuSystem.state === 'none') {
      if (this.inventory.isOpen) {
        this.inventory.close();
      }
      if (this.characterStats.isOpen) {
        this.characterStats.close();
      }
      if (this.menuSystem.state === 'world_map') {
        this.menuSystem.closeWorldMap();
      }
      if (this.questLogView) {
        this.questLogView.toggle();
        if (this.questLogView.isOpen) {
          this.player.stopMovement();
          if (this.music) this.music.playMenuSelect();
        }
      }
    }

    if (this.input.consumeKey('Escape')) {
      if (this.questLogView && this.questLogView.isOpen) {
        this.questLogView.close();
      } else if (this.inventory.isOpen) {
        this.inventory.close();
      } else if (this.characterStats.isOpen) {
        this.characterStats.close();
      } else if (this.dialogueBox.active) {
        this.dialogueBox.close();
      } else {
        this.player.stopMovement();
        this.menuSystem.openPauseMenu();
        this.input.endFrame();
        return;
      }
    }

    // Ventana Activa: Diario de Misiones y Objetivos (Tecla 'L')
    if (this.questLogView && this.questLogView.isOpen) {
      if (this.input.consumeKey('KeyM')) {
        this.questLogView.close();
        this.menuSystem.openWorldMap(this.tilemap.currentSceneId, {
          player: this.player,
          enemies: this.enemies
        });
        this.input.endFrame();
        return;
      }
      if (this.input.consumeInventoryToggle() || this.input.consumeKey('KeyI')) {
        this.questLogView.close();
        this.inventory.open();
        if (this.music) this.music.playMenuSelect();
        this.input.endFrame();
        return;
      }
      if (this.input.consumeCharacterToggle() || this.input.consumeKey('KeyC')) {
        this.questLogView.close();
        this.characterStats.open();
        if (this.music) this.music.playMenuSelect();
        this.input.endFrame();
        return;
      }
      if (this.input.consumeQuestLogToggle() || this.input.consumeKey('Escape')) {
        this.questLogView.close();
        this.input.endFrame();
        return;
      }
      const dir = this.input.consumeMenuDirection();
      if (dir === 'up' || dir === 'down') {
        this.questLogView.moveSelection(dir);
        if (this.music) this.music.playMenuMove();
      }
      this.input.endFrame();
      return;
    }

    // Ventana Activa: Mochila de Inventario (Tecla 'I')
    if (this.inventory.isOpen) {
      if (this.input.consumeKey('KeyM')) {
        this.inventory.close();
        this.menuSystem.openWorldMap(this.tilemap.currentSceneId, {
          player: this.player,
          enemies: this.enemies
        });
        this.input.endFrame();
        return;
      }
      if (this.input.consumeCharacterToggle() || this.input.consumeKey('KeyC')) {
        this.inventory.close();
        this.characterStats.open();
        if (this.music) this.music.playMenuSelect();
        this.input.endFrame();
        return;
      }
      if (this.input.consumeQuestLogToggle()) {
        this.inventory.close();
        if (this.questLogView) this.questLogView.open();
        if (this.music) this.music.playMenuSelect();
        this.input.endFrame();
        return;
      }
      if (this.input.consumeInventoryToggle() || this.input.consumeKey('KeyI')) {
        this.inventory.close();
        this.input.endFrame();
        return;
      }
      const dir = this.input.consumeMenuDirection();
      if (dir) {
        this.inventory.moveSelection(dir);
        if (this.music) this.music.playMenuMove();
      }
      if (this.input.consumeInteraction()) {
        this._handleUseSelectedInventoryItem();
      }
      if (this.input.consumeDropItem() || this.input.consumeKey('KeyX')) {
        this._handleDropSelectedInventoryItem();
      }
      this.input.endFrame();
      return;
    }

    // Ventana Activa: Ficha Técnica y Progresión del Personaje (Tecla 'C')
    if (this.characterStats.isOpen) {
      if (this.characterStats.handleInput(this.input)) {
        if (this.music) this.music.playMenuMove();
      }
      if (this.input.consumeKey('KeyM')) {
        this.characterStats.close();
        this.menuSystem.openWorldMap(this.tilemap.currentSceneId, {
          player: this.player,
          enemies: this.enemies
        });
        this.input.endFrame();
        return;
      }
      if (this.input.consumeKey('KeyI')) {
        this.characterStats.close();
        this.inventory.open();
        if (this.music) this.music.playMenuSelect();
        this.input.endFrame();
        return;
      }
      if (this.input.consumeQuestLogToggle()) {
        this.characterStats.close();
        if (this.questLogView) this.questLogView.open();
        if (this.music) this.music.playMenuSelect();
        this.input.endFrame();
        return;
      }
      if (this.input.consumeCharacterToggle() || this.input.consumeKey('KeyC')) {
        this.characterStats.close();
        this.input.endFrame();
        return;
      }
      this.input.endFrame();
      return;
    }

    if (this.dialogueBox.isShowingChoices()) {
      const dir = this.input.consumeMenuDirection();
      if (dir) {
        this.dialogueBox.moveChoice(dir);
      }
    }

    if (this.dialogueBox.active && this.input.pointerJustClicked) {
      const handled = this.dialogueBox.handlePointerClick(this.input.pointerX, this.input.pointerY);
      if (handled) {
        this.input.pointerJustClicked = false;
      }
    }

    if (this.input.consumeInteraction()) {
      if (this.dialogueBox.active) {
        this.dialogueBox.advance();
      } else {
        const bestAction = this._findBestInteraction();
        this._executeInteraction(bestAction);
      }
    }

    // Ataque con la Espada del Alba ([Espacio], [F], [J], [K])
    if (!this.dialogueBox.active && this.input.consumeAttack()) {
      if (this.player.tryAttack()) {
        this.music.playSwordSlash();
      }
    }

    this.dayNight.update(dt);
    this.tilemap.update(dt, this.dayNight.timeOfDayHours);

    const { npcs, animals, enemies, items } = this._getActiveSceneEntities();
    const obstacles = [...npcs, ...animals];

    this.player.update(
      dt,
      this.input,
      this.tilemap,
      obstacles,
      this.dialogueBox.active,
      this.music
    );

    // Detección y Conmutación de Baldosas de Presión (Puzle: Templo de la Armadura)
    if (this.tilemap.currentSceneId === 'armor_temple' && this.tilemap.armorPuzzle) {
      let steppedKey = null;
      for (const [key, sw] of Object.entries(this.tilemap.armorPuzzle.switchPositions)) {
        if (CollisionSystem.isEntityOnTile(this.player, sw.col, sw.row, this.tilemap.tileSize)) {
          steppedKey = key;
          break;
        }
      }

      if (steppedKey) {
        if (this.activeArmorSwitchTile !== steppedKey) {
          this.activeArmorSwitchTile = steppedKey;
          const res = this.tilemap.toggleArmorSwitch(steppedKey);
          if (res) {
            if (res.justSolved) {
              if (this.music && typeof this.music.playFanfare === 'function') {
                this.music.playFanfare();
              }
              if (this.animeCutscenes) {
                this.animeCutscenes.flash('#22c55e', 0.35);
                this.animeCutscenes.cameraShake(3.0, 0.25);
              }
              if (this.questLog) {
                this.questLog.advanceStep('quest_code_temples', 'Pedestal de la Armadura liberado. ¡Recoge la Armadura del Código Binario!');
              }
              this._saveGameToStorage();
              this.dialogueBox.showMessage('⚡ [COMPILADOR BOOLEANO: BUILD SUCCESSFUL]', [
                '¡COMPILACIÓN EXITOSA! Condición: [ (A && B) || !C ] = TRUE.',
                'La barrera de fuego ha colapsado y el pedestal sagrado ha sido liberado.',
                '¡Ya puedes recoger la Armadura del Código Binario!'
              ]);
            } else {
              if (this.music && typeof this.music.playMenuSelect === 'function') {
                this.music.playMenuSelect();
              }
              const letter = steppedKey.replace('SWITCH_', '');
              this.menuSystem.showNotice(
                `Interruptor [${letter}] = ${this.tilemap.armorPuzzle.switches[letter]} · [ (A && B) || !C ] -> ${res.conditionResult ? 'TRUE' : 'FALSE'}`,
                2.0
              );
            }
          }
        }
      } else {
        this.activeArmorSwitchTile = null;
      }
    }

    // Detección de impacto de espada contra Monolitos Rúnicos (Puzle: Templo de la Espada)
    if (this.monolithHitCooldown > 0) {
      this.monolithHitCooldown = Math.max(0, this.monolithHitCooldown - dt);
    }
    if (
      this.tilemap.currentSceneId === 'sword_temple' &&
      this.tilemap.swordPuzzle &&
      this.player.isAttacking &&
      this.monolithHitCooldown <= 0
    ) {
      const swordBox = this.player.getSwordHitbox();
      if (swordBox) {
        for (const mono of Object.values(this.tilemap.swordPuzzle.monoliths)) {
          const monoBox = {
            x: mono.col * this.tilemap.tileSize + 2,
            y: mono.row * this.tilemap.tileSize - 2,
            width: 12,
            height: 18
          };
          if (CollisionSystem.isBoxColliding(swordBox, monoBox)) {
            this.monolithHitCooldown = 0.45;
            this._handleSwordMonolithStrike(mono.id);
            break;
          }
        }
      }
    }

    // Detección automática al caminar hacia la salida oeste de Valleverde a otras zonas
    if (
      (!this.animeCutscenes || !this.animeCutscenes.isActive) &&
      this.tilemap.currentSceneId === 'overworld' &&
      !this.dialogueBox.active &&
      !this.inventory.isOpen &&
      !this.characterStats.isOpen &&
      this.player.x <= 1.8 * this.tilemap.tileSize &&
      this.player.y >= 10.5 * this.tilemap.tileSize &&
      this.player.y <= 14.5 * this.tilemap.tileSize
    ) {
      const door = this.tilemap.findNearbyDoor(this.player);
      if (door && door.type === 'stage_transition') {
        this._executeInteraction({ kind: 'door', target: door });
      }
    }

    // Detección de contacto con el Vórtice Dimensional Abisal
    if (this.activeAbyssalPortal && this.activeAbyssalPortal.sceneId === this.tilemap.currentSceneId) {
      this.activeAbyssalPortal.timer = (this.activeAbyssalPortal.timer || 0) + dt;
      const pDist = Math.hypot(
        this.player.centerX - (this.activeAbyssalPortal.x + 10),
        this.player.centerY - (this.activeAbyssalPortal.y + 10)
      );
      if (pDist <= 12 && !this.dialogueBox.active && !this.inventory.isOpen) {
        this._executeStageTransition({
          type: 'stage_transition',
          targetScene: 'condemned_realms',
          label: 'Cruzar el Portal a los Reinos Condenados',
          spawnX: 11.5 * this.tilemap.tileSize,
          spawnY: 15 * this.tilemap.tileSize
        });
      }
    }

    const allEntities = [this.player, ...npcs, ...animals];
    for (const npc of npcs) {
      const isTalking =
        this.dialogueBox.active && this.dialogueBox.currentNPC === npc;
      npc.update(dt, this.tilemap, allEntities, isTalking, this.player);
    }
    for (const animal of animals) {
      animal.update(
        dt,
        this.tilemap,
        allEntities,
        this.dialogueBox.active,
        this.player,
        this.music
      );
    }
    this._checkBossIntroTriggers();
    if (this.animeCutscenes && this.animeCutscenes.isActive) {
      this.input.endFrame();
      return;
    }

    for (const enemy of enemies) {
      enemy.update(
        dt,
        this.tilemap,
        this.player,
        this.dialogueBox.active,
        this.music
      );

      // Actualizar misiones asociadas a la derrota de cada mini-jefe y jefe final
      if (enemy.isBoss && enemy.dead && !enemy.questCompletedTriggered) {
        enemy.questCompletedTriggered = true;
        if (enemy.id === 'boss_garbage_collector') {
          if (this.questLog) {
            this.questLog.completeQuest('quest_boss_garbage', '¡Garbage Collector purgado! Dash Asíncrono desbloqueado.');
          }
          if (this.achievementManager) {
            this.achievementManager.unlock('ach_boss_gc');
          }
        } else if (enemy.id === 'boss_stack_overflow') {
          if (this.questLog) {
            this.questLog.completeQuest('quest_boss_stack', '¡Guardián del Stack Overflow abatido! Corte en Cascada desbloqueado.');
          }
          if (this.achievementManager) {
            this.achievementManager.unlock('ach_boss_stack');
          }
        } else if (enemy.id === 'boss_prototype_microwave') {
          if (this.questLog) {
            this.questLog.completeQuest('quest_boss_microwave', '¡Prototipo del Microondas destruido! Barrera TypeScript desbloqueada.');
          }
          if (this.achievementManager) {
            this.achievementManager.unlock('ach_boss_microwave');
          }
        } else if (enemy.id === 'boss_final_ai_alex') {
          if (this.questLog) {
            this.questLog.completeQuest('quest_boss_final', '¡Mister AI Alex ha caído! El Ojete Dorado ha sido consagrado.');
          }
          if (this.achievementManager) {
            this.achievementManager.unlock('ach_golden_anus');
          }
        }
      }

      // Soltar chatarra si es un dron enemigo abatido
      if (!enemy.isBoss && enemy.dead && !enemy.lootDropped) {
        enemy.lootDropped = true;
        if (enemy.id && enemy.id.startsWith('drone')) {
          this.worldItems.push(
            new WorldItem({
              id: `drone_scrap_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              name: 'Restos de Chatarra de Dron',
              description: 'Aleación fractal de titanio de un dron de AI Alex. Llévasela al Herrero Brom.',
              iconIndex: ITEM_ICONS.DRONE_SCRAP,
              x: enemy.x,
              y: enemy.y,
              sceneId: enemy.sceneId,
              itemsSheet: this.assets.itemsSheet
            })
          );
          if (this.menuSystem) {
            this.menuSystem.showNotice('⚙️ ¡El dron soltó Restos de Chatarra!', 2.5);
          }
        }
      }

      // Comprobar derrota del Boss Final para activar epílogo y créditos finales
      if (
        enemy.isBoss &&
        enemy.dead &&
        !enemy.victoryCutsceneTriggered &&
        enemy.id === 'boss_final_ai_alex'
      ) {
        enemy.victoryCutsceneTriggered = true;
        this.gameCompleted = true;
        this._triggerVictorySequence(enemy);
      }
    }
    for (const item of items) {
      item.update(dt);
    }

    if (this.player.hp <= 0) {
      for (const en of this.enemies) {
        if (en.isBoss && !en.dead && typeof en.resetCombatState === 'function') {
          en.resetCombatState();
        }
      }
      this.menuSystem.openGameOverScreen(!this.player.hasArmor);
      this.input.endFrame();
      return;
    }

    this.camera.update(this.player, dt);
    this.dialogueBox.update(dt);
    if (this.achievementManager) {
      this.achievementManager.update(dt);
    }

    this.input.endFrame();
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;

    if (
      this.menuSystem.state === 'title' ||
      this.menuSystem.state === 'cutscene' ||
      this.menuSystem.state === 'exit_screen' ||
      this.menuSystem.state === 'game_over' ||
      this.menuSystem.state === 'world_map' ||
      this.menuSystem.state === 'credits' ||
      (this.menuSystem.state === 'options' && this.menuSystem.previousState === 'title') ||
      (this.menuSystem.state === 'controls' && this.menuSystem.previousStateBeforeControls === 'title') ||
      (this.menuSystem.state === 'confirm_exit' && this.menuSystem.previousStateBeforeExit === 'title')
    ) {
      this.menuSystem.render(ctx);
      return;
    }

    if (this.animeCutscenes && this.animeCutscenes.isActive) {
      this.animeCutscenes.render(ctx);
      return;
    }

    ctx.fillStyle = '#0e111a';
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    this.tilemap.render(ctx, this.camera);

    // Renderizado del Vórtice Dimensional Abisal (si está activo en esta escena)
    if (this.activeAbyssalPortal && this.activeAbyssalPortal.sceneId === this.tilemap.currentSceneId) {
      this._renderAbyssalPortal(ctx);
    }

    const { npcs, animals, enemies, items } = this._getActiveSceneEntities();

    for (const item of items) {
      item.render(ctx, this.camera);
    }

    const renderList = [this.player, ...npcs, ...animals, ...enemies].sort(
      (a, b) => a.y + a.height - (b.y + b.height)
    );
    for (const entity of renderList) {
      entity.render(ctx, this.camera);
    }

    this.dayNight.render(
      ctx,
      this.camera,
      this.tilemap.lightSources,
      this.player,
      this.tilemap.isInterior()
    );

    if (
      !this.dialogueBox.active &&
      !this.inventory.isOpen &&
      !this.characterStats.isOpen &&
      (!this.questLogView || !this.questLogView.isOpen) &&
      !this.aiChatOpen &&
      !this.menuSystem.isBlockingGameplay()
    ) {
      const action = this._findBestInteraction();
      if (action) {
        this._renderActionPrompt(ctx, action);
      }
    }

    this._renderHUD(ctx);
    this.dialogueBox.render(ctx);
    this.inventory.render(ctx, this.player);
    this.characterStats.render(ctx, this.player, this.achievementManager);
    if (this.questLogView) {
      this.questLogView.render(ctx);
    }
    this.menuSystem.render(ctx);
    if (this.achievementManager) {
      this.achievementManager.renderToast(ctx);
    }
  }

  _renderAbyssalPortal(ctx) {
    const portal = this.activeAbyssalPortal;
    if (!portal) return;

    const screenX = Math.round(portal.x - this.camera.renderX);
    const screenY = Math.round(portal.y - this.camera.renderY);
    const t = portal.timer || 0;

    ctx.save();
    // Halo violeta en el suelo
    const pulse = 0.5 + 0.3 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(147, 51, 234, ${0.35 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(screenX + 10, screenY + 12, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Vórtice dimensional con rotación concéntrica
    ctx.translate(screenX + 10, screenY + 10);

    // Anillo rúnico exterior
    ctx.save();
    ctx.rotate(t * 1.8);
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Vórtice oscuro central
    ctx.save();
    ctx.rotate(-t * 2.5);
    ctx.fillStyle = '#3b0764';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();

    // Partículas y ceniza mística ascendente
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const pOffset = (t * 22 + i * 15) % 24;
      const pX = screenX + 10 + Math.sin(t * 3 + i) * 8;
      const pY = screenY + 14 - pOffset;
      const alpha = Math.max(0, 1 - pOffset / 24);
      ctx.fillStyle = i % 2 === 0 ? `rgba(233, 213, 255, ${alpha})` : `rgba(192, 132, 252, ${alpha})`;
      ctx.fillRect(pX, pY, 1.5, 1.5);
    }
    ctx.restore();
  }

  _renderActionPrompt(ctx, action) {
    const bob = Math.round(Math.sin(this.promptTimer) * 1.5);
    const anchorX =
      action.kind === 'door' || action.kind === 'bed' || action.kind === 'signpost'
        ? (action.kind === 'signpost' ? action.target.c * 16 + 8 : action.target.worldX)
        : action.target.centerX;
    const anchorY =
      action.kind === 'door' || action.kind === 'bed' || action.kind === 'signpost'
        ? (action.kind === 'signpost' ? action.target.r * 16 : action.target.worldY - 14)
        : action.target.y;

    const screenX = Math.round(anchorX - this.camera.renderX);
    const screenY = Math.round(anchorY - this.camera.renderY - 11 + bob);

    ctx.save();
    ctx.font = 'bold 7px monospace';
    const textW = Math.ceil(ctx.measureText(action.label).width);
    const boxW = textW + 8;
    const boxH = 10;
    const boxX = Math.max(
      4,
      Math.min(VIEWPORT_WIDTH - boxW - 4, Math.round(screenX - boxW / 2))
    );
    const boxY = Math.max(18, screenY);

    ctx.fillStyle = '#121624';
    ctx.fillRect(boxX - 1, boxY - 1, boxW + 2, boxH + 2);
    ctx.fillStyle = '#fff5d6';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = '#1f2433';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillText(action.label, boxX + boxW / 2, boxY + 2);
    ctx.restore();
  }

  _renderHUD(ctx) {
    ctx.save();
    ctx.font = '7px monospace';
    ctx.textBaseline = 'middle';

    // 1. Reloj compacto (hora actual) en la esquina superior derecha con fondo semitransparente discreto
    const timeStr = this.dayNight.getFormattedTime();
    const clockPaddingX = 6;
    const clockW = Math.ceil(ctx.measureText(timeStr).width) + clockPaddingX * 2;
    const clockH = 13;
    const clockX = VIEWPORT_WIDTH - clockW - 5;
    const clockY = 5;

    ctx.fillStyle = 'rgba(14, 18, 30, 0.65)';
    ctx.fillRect(clockX, clockY, clockW, clockH);
    ctx.strokeStyle = 'rgba(229, 192, 123, 0.4)';
    ctx.strokeRect(clockX + 0.5, clockY + 0.5, clockW - 1, clockH - 1);

    ctx.fillStyle = '#ffe599';
    ctx.textAlign = 'center';
    ctx.fillText(timeStr, clockX + clockW / 2, clockY + clockH / 2);

    // 2. Corazones de vida en la esquina superior izquierda estilo clásico Zelda
    let heartsStr = '';
    for (let i = 0; i < this.player.maxHp; i++) {
      if (this.player.hasBrokenHeartCurse && i === this.player.maxHp - 1) {
        if (this.player.hp >= i + 0.5) {
          heartsStr += '💔';
        } else {
          heartsStr += '🖤';
        }
      } else if (this.player.hp >= i + 1) {
        heartsStr += '♥';
      } else if (this.player.hp >= i + 0.5) {
        heartsStr += '💔';
      } else {
        heartsStr += '♡';
      }
    }

    const heartsPaddingX = 6;
    const heartsW = Math.ceil(ctx.measureText(heartsStr).width) + heartsPaddingX * 2;
    const heartsH = 13;
    const heartsX = 5;
    const heartsY = 5;

    ctx.fillStyle = 'rgba(14, 18, 30, 0.65)';
    ctx.fillRect(heartsX, heartsY, heartsW, heartsH);
    ctx.strokeStyle = this.player.hasBrokenHeartCurse
      ? 'rgba(244, 63, 94, 0.65)'
      : !this.player.hasArmor
        ? 'rgba(248, 113, 113, 0.45)'
        : 'rgba(229, 192, 123, 0.4)';
    ctx.strokeRect(heartsX + 0.5, heartsY + 0.5, heartsW - 1, heartsH - 1);

    ctx.fillStyle = '#ff4d6d';
    ctx.textAlign = 'center';
    ctx.fillText(heartsStr, heartsX + heartsW / 2, heartsY + heartsH / 2);

    // Indicador visual sutil si está sin armadura (pequeño punto carmesí discreto sin rótulo agresivo)
    if (!this.player.hasArmor) {
      const dotX = heartsX + heartsW + 4;
      const dotY = heartsY + 6.5;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Indicador de Calabozo Municipal (únicamente activo si está cumpliendo condena)
    if (this.isJailedForever || this.jailRemainingSeconds > 0) {
      const jailStr = this.isJailedForever
        ? '⛓ CALABOZO · CADENA PERPETUA'
        : `⛓ CONDENA: ${String(Math.floor(this.jailRemainingSeconds / 60)).padStart(2, '0')}:${String(Math.floor(this.jailRemainingSeconds % 60)).padStart(2, '0')}`;
      const jw = Math.ceil(ctx.measureText(jailStr).width) + 12;
      const jx = Math.round((VIEWPORT_WIDTH - jw) / 2);
      const jy = 5;

      ctx.fillStyle = this.isJailedForever ? 'rgba(90, 10, 10, 0.95)' : 'rgba(140, 25, 25, 0.9)';
      ctx.fillRect(jx, jy, jw, 13);
      ctx.strokeStyle = this.isJailedForever ? '#ff4d6d' : '#ffd166';
      ctx.strokeRect(jx + 0.5, jy + 0.5, jw - 1, 12);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(jailStr, jx + jw / 2, jy + 6.5);
    }

    // 4. Barra de Vida de Mini-Jefe (Boss HUD) en la parte inferior central
    const curScene = this.tilemap.currentSceneId;
    const activeBoss = this.enemies.find(
      (e) => e.isBoss && e.sceneId === curScene && (!e.dead || e.defeatBannerTimer > 0)
    );

    if (activeBoss && (activeBoss.activeCombat || activeBoss.dead)) {
      const barW = 186;
      const barH = 14;
      const barX = Math.round((VIEWPORT_WIDTH - barW) / 2);
      const barY = VIEWPORT_HEIGHT - 22;

      // Marco del Boss HUD
      ctx.fillStyle = 'rgba(10, 14, 24, 0.88)';
      ctx.fillRect(barX, barY - 7, barW, barH + 7);
      ctx.strokeStyle = activeBoss.dead ? '#10b981' : '#ffd885';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX + 0.5, barY - 6.5, barW - 1, barH + 6);

      // Nombre y título del jefe
      ctx.font = 'bold 5.5px monospace';
      ctx.fillStyle = activeBoss.themeColor || '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText(activeBoss.name.toUpperCase(), barX + 5, barY - 2);

      // Puntos de vida o estado
      ctx.font = '5.5px monospace';
      ctx.textAlign = 'right';
      if (activeBoss.dead) {
        ctx.fillStyle = '#fde047';
        ctx.fillText(`¡VICTORIA! HABILIDAD: ${activeBoss.rewardName.toUpperCase()}`, barX + barW - 5, barY - 2);
      } else {
        ctx.fillStyle = '#ffffff';
        const statusAdd = activeBoss.statusText ? ` ${activeBoss.statusText}` : '';
        ctx.fillText(`${Math.ceil(activeBoss.hp)} / ${activeBoss.maxHp} HP${statusAdd}`, barX + barW - 5, barY - 2);
      }

      // Barra de vida interna con fondo oscuro
      const innerW = barW - 8;
      const innerH = 5;
      const innerX = barX + 4;
      const innerY = barY + 4;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(innerX, innerY, innerW, innerH);

      const fillPct = Math.max(0, Math.min(1, activeBoss.hp / activeBoss.maxHp));
      const fillW = Math.round(innerW * fillPct);
      if (fillW > 0) {
        const grad = ctx.createLinearGradient(innerX, 0, innerX + fillW, 0);
        grad.addColorStop(0, activeBoss.themeColor || '#38bdf8');
        grad.addColorStop(1, '#ffffff');
        ctx.fillStyle = grad;
        ctx.fillRect(innerX, innerY, fillW, innerH);
      }
    }

    ctx.restore();
  }
}

async function bootstrap() {
  try {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
      throw new Error("No se encontró el elemento canvas con id 'game-canvas'.");
    }
    const assets = await loadGameAssets();
    const game = new RPGGame(canvas, assets);
    window.game = game;
    game.start();
  } catch (err) {
    console.error('Error fatal al arrancar El Ojete Dorado:', err);
    if (typeof document !== 'undefined' && document.body) {
      const errBox = document.createElement('div');
      errBox.style.cssText =
        'position:fixed;top:20px;left:20px;right:20px;background:#7f1d1d;color:#fee2e2;padding:16px;' +
        'border:2px solid #ef4444;font-family:monospace;font-size:14px;z-index:99999;border-radius:6px;';
      errBox.innerHTML = `<b>Error al arrancar el juego:</b><br/>${err.message || err}<br/><br/><small>Asegúrate de ejecutar en un navegador moderno (Chrome, Firefox, Safari, Edge).</small>`;
      document.body.appendChild(errBox);
    }
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}
