import { getDoorBlock, getDoorDestinationInfo, pushBackPlayer } from './core/DoorGatekeeper.js?v=8';
import { GameLoop } from './core/GameLoop.js?v=8';
import { InputHandler } from './core/InputHandler.js?v=8';
import { Camera2D } from './core/Camera2D.js?v=8';
import {
  loadGameAssets,
  CHARACTER_TYPES,
  ITEM_ICONS,
  TILES
} from './graphics/SpriteSheetGenerator.js?v=8';
import { SpriteAnimator } from './graphics/Animator.js?v=8';
import { Tilemap } from './world/Tilemap.js?v=8';
import { CollisionSystem } from './physics/CollisionSystem.js?v=8';
import { Player } from './entities/Player.js?v=8';
import { NPC, getBromForgeChoices } from './entities/NPC.js?v=8';
import { Animal } from './entities/Animal.js?v=8';
import { Enemy } from './entities/Enemy.js?v=8';
import { GarbageCollectorBoss } from './entities/bosses/GarbageCollectorBoss.js?v=8';
import { StackOverflowBoss } from './entities/bosses/StackOverflowBoss.js?v=8';
import { PrototypeMicrowaveBoss } from './entities/bosses/PrototypeMicrowaveBoss.js?v=8';
import { FinalBossAlex } from './entities/bosses/FinalBossAlex.js?v=8';
import { WorldItem } from './entities/WorldItem.js?v=8';
import { DialogueBox } from './ui/DialogueBox.js?v=8';
import { Inventory, normalizeItemId } from './ui/Inventory.js?v=8';
import { CharacterStats } from './ui/CharacterStats.js?v=8';
import { QuestLog } from './core/QuestLog.js?v=8';
import { AchievementManager } from './core/AchievementManager.js?v=8';
import { QuestLogView } from './ui/QuestLogView.js?v=8';
import { MainMenuAndScenes } from './ui/MainMenuAndScenes.js?v=8';
import {
  calculateGameScore,
  submitGlobalScore,
  uploadGameToCloud,
  downloadGameFromCloud,
  getLocalSaveContainer,
  saveLocalFallback,
  markLocalFallbackSynced,
  getSavedCloudCode,
  setSavedCloudCode
} from './core/ScoreSystem.js?v=8';
import {
  AnimeCutsceneManager,
  SCENE_JAIL_ARREST,
  SCENE_AI_ALEX_WARNING,
  SCENE_AI_ALEX_PREBATTLE,
  SCENE_DEUS_PURIFICATION,
  SCENE_ENDING_VICTORY,
  getBossIntroCutscene
} from './ui/AnimeCutsceneManager.js?v=8';
import { DayNightCycle } from './world/DayNightCycle.js?v=8';
import { RenderPipeline } from './graphics/RenderPipeline.js?v=8';
import { UILayout, UI_FONT } from './ui/UILayout.js?v=8';
import { CloudStorage } from './services/CloudStorage.js?v=8';
import { AIBotBrain } from './ai/AIBotBrain.js?v=8';
import { AmbientMusic } from './audio/AmbientMusic.js?v=8';
import { SpeechBubble } from './ui/SpeechBubble.js?v=8';

const VIEWPORT_WIDTH = 320;
const VIEWPORT_HEIGHT = 180;
const RENDER_SCALE = 4; // Renderizado nativo HD 1280x720 (4x sobre base lógica 320x180)

const CORE_CHEST_GUARDIANS = {
  chest_nucleo_stack: 'boss_stack_overflow',
  chest_nucleo_gc: 'boss_garbage_collector',
  chest_nucleo_microwave: 'boss_prototype_microwave'
};

export const ABYSSAL_POINTER_SPAWN_CANDIDATES = [
  { x: 29 * 16, y: 19 * 16, sceneId: 'first_stage', desc: 'Ruinas del Despertar (Claro Sureste)' },
  { x: 5 * 16, y: 19 * 16, sceneId: 'first_stage', desc: 'Ruinas del Despertar (Rincón Suroeste)' },
  { x: 25 * 16, y: 5 * 16, sceneId: 'first_stage', desc: 'Ruinas del Despertar (Sendero Noreste)' },
  { x: 9 * 16, y: 4 * 16, sceneId: 'first_stage', desc: 'Ruinas del Despertar (Antiguo Bastión Noroeste)' }
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
    this.renderPipeline = new RenderPipeline(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    this.jailRemainingSeconds = 0;
    this.jailerAngerCount = 0;
    this.isJailedForever = false;

    // Registro de permisos de entrada a las viviendas del pueblo
    this.housePermissions = {
      player_house: true,
      elder_house: false,
      oracle_house: false,
      blacksmith_house: false,
      herbalist_house: false,
      guard_house: false
    };

    this.droppedCoins = [];

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
    this.totalDeaths = 0;
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
    this.transitionCooldown = 0;

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
        onSaveGame: (opts) => this._saveGameToStorage(opts || { manual: true }),
        onOpenCloudSave: () => this._openCloudSaveModal(),
        onOpenCloudLoad: () => this._openCloudLoadModal(),
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

    // Sistema de Sincronización Cloud-First con Fallback Local
    this.cloudSaveCode = getSavedCloudCode() || null;
    this.hasPendingCloudSync = false;
    this.cloudSyncStatus = 'idle';
    this._isSyncingPending = false;
    this.lastCloudSyncTime = null;

    const initialContainer = getLocalSaveContainer();
    if (initialContainer && initialContainer.pendingCloudSync) {
      this.hasPendingCloudSync = true;
      this.cloudSyncStatus = 'pending';
    }

    this._setupCloudSyncListeners();

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
    this.droppedCoins = [];

    // Reiniciar Puzle 1: Templo de la Armadura (4 Terminales)
    if (this.tilemap.armorPuzzle) {
      this.tilemap.armorPuzzle.switches = { A: 0, B: 0, C: 0, D: 0 };
      this.tilemap.armorPuzzle.solved = false;
      this.tilemap.armorPuzzle.barrierActive = true;
      this.tilemap.setArmorBarrier(true);
    }

    // Reiniciar Puzle 2: Templo de la Espada
    if (this.tilemap.swordPuzzle) {
      this.tilemap.swordPuzzle.stack = [];
      this.tilemap.swordPuzzle.solved = false;
      this.tilemap.swordPuzzle.portalOpen = false;
      this.tilemap.setSwordPortal(false);
    }

    // Reiniciar Puzle 3: La Gran Puerta del Núcleo Cuántico
    if (this.tilemap.quantumGate) {
      this.tilemap.quantumGate.coresPlaced = { gc: false, stack: false, microwave: false };
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
    this.totalPlayTimeSeconds = 0;
    this.totalDeaths = 0;
    this.totalJailVisits = 0;
    this.deathsByScene = {};
    this.sceneSurvivalTimer = 0;
    this._deathRegistered = false;
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
    this.transitionCooldown = 0;

    this.camera.snapTo(this.player);
  }

  _startNewGame() {
    this._resetWorldToInitialState();
    this.music.setMode('village');
    this._saveGameToStorage();
    // Inicio natural sin diálogos forzados: libertad total de movimiento y exploración
    this.menuSystem.showNotice('🌿 Valleverde · Plaza Central · Explora la aldea libremente', 4.0);
  }

  _buildSavePayload() {
    return {
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
      playerHasArmor: this.player.hasArmor,
      hasSword: this.player.hasSword,
      playerHasSword: this.player.hasSword,
      swordLevel: this.player.swordLevel || 1,
      armorLevel: this.player.armorLevel || 1,
      level: this.player.level || 1,
      xp: this.player.xp || 0,
      dungeonCores: {
        gc: !!(this.player.dungeonCores && this.player.dungeonCores.gc),
        stack: !!(this.player.dungeonCores && this.player.dungeonCores.stack),
        microwave: !!(this.player.dungeonCores && this.player.dungeonCores.microwave)
      },
      gatesUnlocked: this.player.gatesUnlocked || 0,
      quantumGate: this.tilemap?.quantumGate ? {
        coresPlaced: { ...this.tilemap.quantumGate.coresPlaced }
      } : null,
      shieldHP: this.player.armorPoints ?? 0,
      armorPoints: this.player.armorPoints ?? 0,
      maxArmorPoints: this.player.maxArmorPoints || 3,
      hasPermission_elder: Boolean(this.housePermissions.elder_house),
      hasPermission_blacksmith: Boolean(this.housePermissions.blacksmith_house),
      hasPermission_herbalist: Boolean(this.housePermissions.herbalist_house),
      hasPermission_guard: Boolean(this.housePermissions.guard_house),
      hasPermission_oracle: Boolean(this.housePermissions.oracle_house),
      hasDash: !!this.player.hasDash,
      hasChargedAttack: !!this.player.hasChargedAttack,
      hasBarrier: !!this.player.hasBarrier,
      skillPoints: this.player.skillPoints || 0,
      killCount: this.player.killCount || 0,
      skills: { ...this.player.skills },
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
      totalDeaths: this.totalDeaths || 0,
      totalJailVisits: this.totalJailVisits || 0,
      housePermissions: { ...this.housePermissions },
      inventoryItems: this.inventory.items.map((it) => ({ ...it })),
      bossCutscenesSeen: { ...this.bossCutscenesSeen },
      prebattleAlexCutscenePlayed: Boolean(this.prebattleAlexCutscenePlayed),
      gameCompleted: Boolean(this.gameCompleted),
      abyssalPointerSpawn: this.abyssalPointerSpawn ? { ...this.abyssalPointerSpawn } : null,
      abyssalPortalOrigin: this.abyssalPortalOrigin ? { ...this.abyssalPortalOrigin } : null,
      activeAbyssalPortal: this.activeAbyssalPortal ? { ...this.activeAbyssalPortal } : null,
      questLogData: this.questLog ? this.questLog.serialize() : null,
      achievementsData: this.achievementManager ? this.achievementManager.serialize() : null,
      collectedItemIds: this.worldItems.filter((w) => w.collected).map((w) => w.id),
      defeatedEnemyIds: this.enemies.filter((e) => e.dead && !e.respawnOnEnter).map((e) => e.id)
    };
  }

  _getPlayerNickname() {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('el_ojete_last_nickname') || 'HERO';
      }
    } catch (_) {}
    return 'HERO';
  }

  /**
   * Persistencia primaria en la Nube con respaldo local (fallback) offline.
   * Guarda de forma inmediata en localStorage como caché de contingencia (dirty flag),
   * y envía asíncronamente el estado a la base de datos en la nube.
   * Si no hay conexión o el servicio no responde, conserva el guardado local marcado como pendiente
   * y reintenta la subida automáticamente en cuanto regrese la conectividad.
   *
   * @param {Object} [options]
   * @param {boolean} [options.manual=false]
   * @param {Function} [options.onComplete]
   */
  _saveGameToStorage(options = {}) {
    try {
      const savePayload = this._buildSavePayload();
      const code = this.cloudSaveCode || getSavedCloudCode() || null;
      const nickname = this._getPlayerNickname();

      // 1. Guardar de inmediato en localStorage como fallback de contingencia
      saveLocalFallback(savePayload, code, true);
      this.hasPendingCloudSync = true;
      this.cloudSyncStatus = 'pending';

      const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
      const isLocalFile = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';

      if (!isOnline || isLocalFile) {
        this.cloudSyncStatus = 'offline_pending';
        if (options.manual && this.menuSystem) {
          this.menuSystem.showNotice('⚠ Guardado local offline. Se sincronizará con la nube al reconectar.', 4.0);
        }
        if (options.onComplete) options.onComplete({ ok: true, source: 'local_fallback', pending: true });
        return true;
      }

      this.cloudSyncStatus = 'syncing';
      uploadGameToCloud(savePayload, nickname, code)
        .then((res) => {
          if (res && res.ok && res.code) {
            this.cloudSaveCode = res.code;
            setSavedCloudCode(res.code);
            markLocalFallbackSynced(res.code, res.savedAt || Date.now());
            this.hasPendingCloudSync = false;
            this.cloudSyncStatus = 'synced';
            this.lastCloudSyncTime = Date.now();

            if (options.manual && this.menuSystem) {
              this.menuSystem.showNotice(`✓ Partida guardada y sincronizada en la nube [${res.code}]`, 4.0);
            }
            if (options.onComplete) options.onComplete({ ok: true, source: 'cloud', code: res.code });
          } else {
            this.cloudSyncStatus = 'pending';
            if (options.manual && this.menuSystem) {
              const msg = res?.message || 'Servicio de nube no disponible.';
              this.menuSystem.showNotice(`⚠ Guardado local offline (${msg}).`, 4.0);
            }
            if (options.onComplete) options.onComplete({ ok: true, source: 'local_fallback', pending: true, error: res?.error });
          }
        })
        .catch((err) => {
          this.cloudSyncStatus = 'pending';
          if (options.manual && this.menuSystem) {
            this.menuSystem.showNotice(`⚠ Guardado local offline (Red: ${err.message}).`, 4.0);
          }
          if (options.onComplete) options.onComplete({ ok: true, source: 'local_fallback', pending: true, error: err.message });
        });

      return true;
    } catch (err) {
      console.warn('Error en _saveGameToStorage:', err);
      return false;
    }
  }

  /**
   * Intenta sincronizar cualquier partida pendiente de guardado local hacia la nube.
   * Se ejecuta automáticamente cuando se restaura la conexión ('online'), se enfoca la ventana
   * o periódicamente si hay estado pendiente.
   */
  _syncPendingSaveToCloud(options = {}) {
    if (this._isSyncingPending) return;
    const container = getLocalSaveContainer();
    if (!container || !container.savePayload || !container.pendingCloudSync) {
      this.hasPendingCloudSync = false;
      return;
    }

    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const isLocalFile = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
    if (!isOnline || isLocalFile) return;

    this._isSyncingPending = true;
    this.cloudSyncStatus = 'syncing';

    const nickname = this._getPlayerNickname();
    const code = container.cloudCode || this.cloudSaveCode || getSavedCloudCode() || null;

    uploadGameToCloud(container.savePayload, nickname, code)
      .then((res) => {
        this._isSyncingPending = false;
        if (res && res.ok && res.code) {
          this.cloudSaveCode = res.code;
          setSavedCloudCode(res.code);
          markLocalFallbackSynced(res.code, res.savedAt || Date.now());
          this.hasPendingCloudSync = false;
          this.cloudSyncStatus = 'synced';
          this.lastCloudSyncTime = Date.now();

          if (this.menuSystem) {
            this.menuSystem.showNotice(`☁ ¡Partida sincronizada automáticamente con la nube! [${res.code}]`, 4.0);
          }
        } else {
          this.cloudSyncStatus = 'pending';
        }
      })
      .catch(() => {
        this._isSyncingPending = false;
        this.cloudSyncStatus = 'pending';
      });
  }

  _setupCloudSyncListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.log('📡 Conexión a Internet detectada: sincronizando partida pendiente con la nube...');
      this._syncPendingSaveToCloud({ showNotice: true });
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.hasPendingCloudSync) {
          this._syncPendingSaveToCloud();
        }
      });
    }

    window.addEventListener('focus', () => {
      if (this.hasPendingCloudSync) {
        this._syncPendingSaveToCloud();
      }
    });

    setInterval(() => {
      if (this.hasPendingCloudSync) {
        this._syncPendingSaveToCloud();
      }
    }, 25000);
  }

  _openCloudSaveModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('cloud-save-modal');
    if (!modal) return;

    const codeDisplay = document.getElementById('cloud-save-code-display');
    const statusText = document.getElementById('cloud-save-status');
    const copyBtn = document.getElementById('cloud-save-copy-btn');
    const closeBtn = document.getElementById('cloud-save-close-btn');

    const activeCode = this.cloudSaveCode || getSavedCloudCode();
    if (codeDisplay) codeDisplay.textContent = activeCode || 'SUBIENDO...';
    if (statusText) {
      statusText.textContent = 'Sincronizando estado con Vercel Serverless...';
      statusText.className = 'cloud-status-text';
    }
    if (copyBtn) copyBtn.textContent = '📋 Copiar';

    modal.classList.remove('hidden');

    const payload = this._buildSavePayload();
    let currentCode = activeCode || '';

    uploadGameToCloud(payload, this._getPlayerNickname(), activeCode).then((res) => {
      if (res && res.ok && res.code) {
        currentCode = res.code;
        this.cloudSaveCode = res.code;
        setSavedCloudCode(res.code);
        markLocalFallbackSynced(res.code, res.savedAt || Date.now());
        this.hasPendingCloudSync = false;
        this.cloudSyncStatus = 'synced';
        this.lastCloudSyncTime = Date.now();

        if (codeDisplay) codeDisplay.textContent = res.code;
        if (statusText) {
          statusText.textContent = `✓ ¡Partida guardada en la nube! Código activo durante 90 días.`;
          statusText.className = 'cloud-status-text success';
        }
      } else {
        if (codeDisplay) codeDisplay.textContent = activeCode || 'MODO LOCAL';
        if (statusText) {
          statusText.textContent = (res && res.message) || 'La persistencia en la nube requiere conexión o activar Vercel KV.';
          statusText.className = 'cloud-status-text error';
        }
      }
    }).catch((err) => {
      if (codeDisplay) codeDisplay.textContent = activeCode || 'ERROR';
      if (statusText) {
        statusText.textContent = `Error de red: ${err.message}`;
        statusText.className = 'cloud-status-text error';
      }
    });

    if (copyBtn) {
      copyBtn.onclick = () => {
        if (currentCode && typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(currentCode).then(() => {
            copyBtn.textContent = '✓ ¡Copiado!';
            setTimeout(() => { copyBtn.textContent = '📋 Copiar'; }, 2500);
          }).catch(() => {});
        }
      };
    }

    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.classList.add('hidden');
      };
    }
  }

  _openCloudLoadModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('cloud-load-modal');
    if (!modal) return;

    const input = document.getElementById('cloud-load-code-input');
    const statusText = document.getElementById('cloud-load-status');
    const form = document.getElementById('cloud-load-form');
    const cancelBtn = document.getElementById('cloud-load-cancel-btn');

    if (input) input.value = '';
    if (statusText) {
      statusText.textContent = '';
      statusText.className = 'cloud-status-text';
    }

    modal.classList.remove('hidden');
    if (input) {
      setTimeout(() => {
        try { input.focus(); } catch (_) {}
      }, 60);
    }

    let cancelled = false;
    const cleanup = () => {
      modal.classList.add('hidden');
      if (form) form.onsubmit = null;
      if (cancelBtn) cancelBtn.onclick = null;
    };

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        cancelled = true;
        cleanup();
      };
    }

    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const code = (input ? input.value : '').trim().toUpperCase();
        if (!code) return;

        if (statusText) {
          statusText.textContent = 'Buscando partida en Vercel Cloud...';
          statusText.className = 'cloud-status-text';
        }

        downloadGameFromCloud(code).then((res) => {
          if (cancelled) return;
          if (res && res.ok && res.saveData) {
            const ok = this._loadGameData(res.saveData);
            if (ok) {
              this.cloudSaveCode = code;
              setSavedCloudCode(code);
              saveLocalFallback(res.saveData, code, false);
              this.hasPendingCloudSync = false;
              this.cloudSyncStatus = 'synced';
              this.lastCloudSyncTime = Date.now();
              if (this.menuSystem) {
                this.menuSystem.state = 'none';
                this.menuSystem.showNotice(`✓ Partida [${code}] cargada exitosamente de la nube.`, 4.0);
              }
              cleanup();
            } else {
              if (statusText) {
                statusText.textContent = 'Los datos de la partida no se pudieron aplicar.';
                statusText.className = 'cloud-status-text error';
              }
            }
          } else {
            if (statusText) {
              statusText.textContent = (res && res.message) || 'Código no encontrado o no disponible.';
              statusText.className = 'cloud-status-text error';
            }
          }
        }).catch((err) => {
          if (statusText) {
            statusText.textContent = `Error de red: ${err.message}`;
            statusText.className = 'cloud-status-text error';
          }
        });
      };
    }
  }

  _getSaveSummary() {
    try {
      const container = getLocalSaveContainer();
      if (!container || !container.savePayload) return null;
      const data = container.savePayload;
      if (!data || typeof data.timeOfDayHours !== 'number') return null;
      const stageLabel = data.sceneId === 'first_stage' ? 'Escenario 1' : 'Valleverde';
      const count = Array.isArray(data.inventoryItems)
        ? data.inventoryItems.reduce((acc, it) => acc + (it.qty || 1), 0)
        : 0;

      const code = container.cloudCode || getSavedCloudCode();
      const statusLabel = container.pendingCloudSync
        ? '⚠ Offline'
        : (code ? `☁ ${code}` : 'Local');

      return `${stageLabel} · ${count} obj. · ${statusLabel}`;
    } catch {
      return null;
    }
  }

  _loadGameFromStorage() {
    try {
      const container = getLocalSaveContainer();
      if (!container || !container.savePayload) return false;

      this.cloudSaveCode = container.cloudCode || getSavedCloudCode() || null;
      this.hasPendingCloudSync = Boolean(container.pendingCloudSync);

      const ok = this._loadGameData(container.savePayload);
      if (ok && this.hasPendingCloudSync) {
        setTimeout(() => this._syncPendingSaveToCloud(), 1200);
      }
      return ok;
    } catch {
      return false;
    }
  }

  _loadGameData(rawInput) {
    if (!rawInput) return false;
    const raw = rawInput.savePayload || rawInput;
    const sanitized = CloudStorage.sanitizeSaveData(raw) || {};
    // Los valores saneados prevalecen sobre los originales (clamps de nivel, núcleos, blindaje...)
    const data = { ...raw, ...sanitized };
    try {
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
          ...data.housePermissions,
          elder_house: Boolean(data.housePermissions.elder_house ?? data.hasPermission_elder),
          blacksmith_house: Boolean(data.housePermissions.blacksmith_house ?? data.hasPermission_blacksmith),
          herbalist_house: Boolean(data.housePermissions.herbalist_house ?? data.hasPermission_herbalist),
          guard_house: Boolean(data.housePermissions.guard_house ?? data.hasPermission_guard),
          oracle_house: Boolean(data.housePermissions.oracle_house ?? data.hasPermission_oracle)
        };
      }

      this.jailRemainingSeconds = data.jailRemainingSeconds || 0;
      this.jailerAngerCount = Math.min(3, data.jailerAngerCount || 0);
      this.totalPlayTimeSeconds = typeof data.totalPlayTimeSeconds === 'number' ? data.totalPlayTimeSeconds : 0;
      this.totalDeaths = typeof data.totalDeaths === 'number' ? data.totalDeaths : Object.values(data.deathsByScene || {}).reduce((a, b) => a + b, 0);
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
          this.tilemap.setArmorBarrier(false);
        }
      } else if (data.binaryPuzzles?.armorSolved && this.tilemap?.armorPuzzle) {
        this.tilemap.armorPuzzle.solved = true;
        this.tilemap.armorPuzzle.barrierActive = false;
        this.tilemap.setArmorBarrier(false);
      }

      // Carga y sincronización del Puzle 2 (Templo de la Espada)
      if (data.swordPuzzle && this.tilemap?.swordPuzzle) {
        if (data.swordPuzzle.solved) {
          this.tilemap.swordPuzzle.solved = true;
          this.tilemap.swordPuzzle.portalOpen = true;
          this.tilemap.setSwordPortal(true);
        }
        if (Array.isArray(data.swordPuzzle.stack)) {
          this.tilemap.swordPuzzle.stack = [...data.swordPuzzle.stack];
        }
      } else if (data.binaryPuzzles?.swordSolved && this.tilemap?.swordPuzzle) {
        this.tilemap.swordPuzzle.solved = true;
        this.tilemap.swordPuzzle.portalOpen = true;
        this.tilemap.setSwordPortal(true);
      }

      const hasValidScene = typeof data.sceneId === 'string' && Boolean(this.tilemap.scenes[data.sceneId]);
      const targetScene = hasValidScene ? data.sceneId : 'overworld';
      this.tilemap.loadScene(targetScene);
      this.camera.setWorldBounds(this.tilemap.width, this.tilemap.height);

      const hasValidPos = hasValidScene && Number.isFinite(data.playerX) && Number.isFinite(data.playerY);
      this.player.x = hasValidPos ? data.playerX : 14 * 16;
      this.player.y = hasValidPos ? data.playerY : 12 * 16;
      this.player.direction = data.playerDir || 'down';
      this.player.speed = data.playerSpeed || 76;
      this.player.hasLanternEquipped = Boolean(data.hasLanternEquipped);

      // Si es un guardado antiguo en overworld (v1), dotar de armadura y espada por compatibilidad
      const isLegacyOverworld = !data.version || data.version < 2;
      if (data.hasArmor || data.playerHasArmor || (isLegacyOverworld && targetScene !== 'first_stage')) {
        this.player.equipArmor();
        const savedShield = data.shieldHP ?? data.armorPoints;
        if (Number.isFinite(Number(savedShield))) {
          this.player.armorPoints = Math.max(0, Math.min(3, Math.floor(Number(savedShield))));
        }
      }
      this.player.hasSword = Boolean(
        data.hasSword || data.playerHasSword || (isLegacyOverworld && targetScene !== 'first_stage')
      );
      this.player.swordLevel = Math.max(1, Math.min(3, Number(data.swordLevel) || 1));
      this.player.armorLevel = Math.max(1, Math.min(2, Number(data.armorLevel) || 1));
      this.player.level = Math.max(1, Math.min(10, Math.floor(Number(data.level) || 1)));
      this.player.xp = Math.max(0, Math.floor(Number(data.xp) || 0));
      if (data.dungeonCores && typeof data.dungeonCores === 'object') {
        this.player.dungeonCores = {
          gc: Boolean(data.dungeonCores.gc),
          stack: Boolean(data.dungeonCores.stack),
          microwave: Boolean(data.dungeonCores.microwave)
        };
      }
      this.player.gatesUnlocked = Math.max(0, Math.min(3, Number(data.gatesUnlocked) || 0));
      if (data.quantumGate && this.tilemap.quantumGate && data.quantumGate.coresPlaced) {
        const savedPlaced = data.quantumGate.coresPlaced;
        this.tilemap.quantumGate.coresPlaced = {
          gc: Boolean(savedPlaced.gc),
          stack: Boolean(savedPlaced.stack),
          microwave: Boolean(savedPlaced.microwave)
        };
      }
      this._syncGatesUnlocked();
      this.player.hasDash = Boolean(data.hasDash);
      this.player.hasChargedAttack = Boolean(data.hasChargedAttack);
      this.player.hasBarrier = Boolean(data.hasBarrier);
      this.player.skillPoints = Number.isFinite(data.skillPoints) ? data.skillPoints : 0;
      this.player.killCount = Number.isFinite(data.killCount) ? data.killCount : 0;
      const savedSkills = data.skills && typeof data.skills === 'object' ? data.skills : {};
      this.player.skills = {
        vigor: Boolean(savedSkills.vigor),
        filo: Boolean(savedSkills.filo),
        reflejo: Boolean(savedSkills.reflejo),
        log: Boolean(savedSkills.log)
      };
      this.player.stamina = this.player.effectiveMaxStamina;
      if (typeof data.robotizationLevel === 'number') {
        this.player.robotizationLevel = Math.max(0, Math.min(100, data.robotizationLevel));
      }
      if (typeof data.playerHp === 'number' && data.playerHp > 0) {
        this.player.hp = Math.min(this.player.effectiveMaxHp, data.playerHp);
      } else {
        this.player.hp = this.player.effectiveMaxHp;
      }
      if (typeof data.playerCoins === 'number' && Number.isFinite(data.playerCoins)) {
        this.player.coins = Math.max(0, Math.floor(data.playerCoins));
      }
      this.player.invulnerableTimer = 1.0;
      this.player.knockbackTimer = 0;

      if (Array.isArray(data.inventoryItems)) {
        this.inventory.setItems(data.inventoryItems);
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

      if (data.abyssalPointerSpawn && data.abyssalPointerSpawn.sceneId === 'first_stage') {
        this.abyssalPointerSpawn = { ...data.abyssalPointerSpawn };
      } else {
        this.abyssalPointerSpawn = { ...ABYSSAL_POINTER_SPAWN_CANDIDATES[0] };
      }
      const pointerItem = this.worldItems.find((w) => w.id === 'item_abyssal_pointer');
      if (pointerItem && this.abyssalPointerSpawn) {
        pointerItem.x = this.abyssalPointerSpawn.x;
        pointerItem.y = this.abyssalPointerSpawn.y;
        pointerItem.sceneId = this.abyssalPointerSpawn.sceneId || 'first_stage';
      }

      if (data.abyssalPortalOrigin) {
        this.abyssalPortalOrigin = { ...data.abyssalPortalOrigin };
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

      const hasDefeatedList = Array.isArray(data.defeatedEnemyIds);
      const defeatedSet = new Set(hasDefeatedList ? data.defeatedEnemyIds : []);
      // Solo las partidas antiguas sin lista de derrotas infieren los jefes vencidos a partir de las habilidades
      if (!hasDefeatedList) {
        if (this.player.hasDash) defeatedSet.add('boss_garbage_collector');
        if (this.player.hasChargedAttack) defeatedSet.add('boss_stack_overflow');
        if (this.player.hasBarrier) defeatedSet.add('boss_prototype_microwave');
      }

      for (const en of this.enemies) {
        if (defeatedSet.has(en.id) && !en.respawnOnEnter) {
          en.dead = true;
          en.defeated = true;
          en.hp = 0;
          en.activeCombat = false;
          en.defeatBannerTimer = 0;
          en.questCompletedTriggered = true;
          en.victoryCutsceneTriggered = true;
          // Sus recompensas ya se concedieron antes de guardar: no volver a otorgarlas
          en.xpGranted = true;
          en.coinsDropped = true;
          en.lootDropped = true;
          if (typeof en.resetCombatState === 'function') {
            en.resetCombatState();
          }
        }
      }

      this.prebattleAlexCutscenePlayed = Boolean(data.prebattleAlexCutscenePlayed);
      this.gameCompleted = Boolean(data.gameCompleted);

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

  _getSellChoices(npcName, returnChoices) {
    const sellCatalog = [
      { id: 'drone_scrap', name: 'Restos de Chatarra', price: 10 },
      { id: 'silicon_flower', name: 'Flor de Silicio', price: 8 },
      { id: 'fish', name: 'Trucha del Río Alba', price: 5 },
      { id: 'bread', name: 'Pan Campesino', price: 2 },
      { id: 'wheat', name: 'Trigo Fresco', price: 1 },
      { id: 'apple', name: 'Manzana Crujiente', price: 2 },
      { id: 'potion', name: 'Poción Herbal', price: 2 },
      { id: 'potion_armor', name: 'Poción de Blindaje', price: 6 },
      { id: 'ointment', name: 'Ungüento Antirrobo', price: 3 },
      { id: 'coffee', name: 'Café Compilado', price: 4 },
      { id: 'spring_water', name: 'Agua de Manantial', price: 2 }
    ];

    const choices = [];
    for (const entry of sellCatalog) {
      const count = this.inventory ? this.inventory.getItemCount(entry.id) : 0;
      if (count > 0) {
        choices.push({
          label: `💰 Vender ${entry.name} (+${entry.price} 🪙) [Tienes: ${count}]`,
          onSelect: () => {
            this.inventory.consumeItem(entry.id, 1);
            this.player.coins += entry.price;
            if (this.music) this.music.playMenuSelect();
            this._saveGameToStorage();
            this.dialogueBox.showMessage(npcName, [
              `¡Trato cerrado! Te compro 1x [${entry.name}] por [${entry.price} 🪙].`,
              `Saldo actual: 💰 ${this.player.coins} Bytes.`
            ], this._getSellChoices(npcName, returnChoices));
          }
        });
      }
    }

    if (choices.length === 0) {
      choices.push({
        label: '(No tienes materiales ni consumibles para vender)',
        onSelect: () => {
          this.dialogueBox.showMessage(npcName, [
            'No llevas chatarra, flores ni víveres para vender en este momento.'
          ], returnChoices);
        }
      });
    }

    choices.push({
      label: '↩ Volver',
      onSelect: () => {
        this.dialogueBox.showMessage(npcName, [
          `¿En qué más te puedo ayudar? Saldo: 💰 ${this.player.coins} 🪙.`
        ], returnChoices);
      }
    });

    return choices;
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
              'Al otro lado del río Alba descansan dos de las Pruebas Sagradas ancestrales: la Armadura del Código Binario y la Espada de la Recursividad.',
              'La tercera prueba, la reliquia divina de El Microondas Little, la custodio yo mismo en el cofre sagrado de mi casa. ¡Búscala en mi hogar y úsala con supremo cuidado!',
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
              'Dentro encontrarás mis estanterías de libros antiguos, el Farol de Mano y, en el cofre sagrado del centro, la reliquia divina de [El Microondas Little].',
              'Es un artefacto sagrado forjado antes del Gran Colapso: recalienta tus variables en O(1) y restaura tu salud. Pero trátala con supremo cuidado, pues las fuerzas cuánticas exigen prudencia.»'
            ],
            elderChoices
          );
        }
      },
      ...(this.inventory && this.inventory.hasItem('golden_apple')
        ? [
            {
              label: '⚡ Sabio Aurelio, he consagrado la Reliquia Divina de tu cofre',
              onSelect: () => {
                this.dialogueBox.showMessage(
                  'Sabio Aurelio · Cronista',
                  [
                    '«¡Veo el fulgor dorado del Microondas Little en tus manos!',
                    'Ese artefacto es una reliquia divina de inconmensurable valor. AI Alex creó su monstruoso microondas basándose en las energías de este diseño primordial.',
                    'Recuerda mi advertencia: úsalo con supremo cuidado y moderación. Te sanará y estabilizará tu código en los momentos más oscuros de la odisea.»'
                  ],
                  elderChoices
                );
              }
            }
          ]
        : []),
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
    return getBromForgeChoices(this);
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
        label: '¿Puedo pasar a tu casa?',
        onSelect: () => {
          if (this.housePermissions.herbalist_house) {
            this.dialogueBox.showMessage('Herbolaria Lyra · Alquimista', [
              '¡Tienes pase libre! Recuerda no pisar los brotes medicinales ni romper los alambiques.'
            ], this._getHerbChoices());
            return;
          }

          if (isSiliconDone) {
            this.housePermissions.herbalist_house = true;
            if (this.music) this.music.playFanfare();
            this._saveGameToStorage();
            this.dialogueBox.showMessage('Herbolaria Lyra · Alquimista', [
              '¡Por supuesto, noble botánico! Has traído las Flores de Silicio y salvado mi botica.',
              '¡Toma la llave de mi cabaña! (Tintineo de llaves de latón). Puedes recoger la poción de mi mesa.'
            ], this._getHerbChoices());
            return;
          }

          this.dialogueBox.showMessage('Herbolaria Lyra · Alquimista', [
            'Mmm, guardo extractos muy delicados y raros en mi cabaña... No suelo permitir la entrada a desconocidos.',
            'Pero si dejas una fianza de 25 Bytes por si rompes algún frasco alquímico, te dejaré pasar.'
          ], [
            {
              label: `🪙 Pagar fianza de 25 Bytes [Tienes: ${this.player.coins}🪙]`,
              onSelect: () => {
                if (this.player.coins < 25) {
                  this.dialogueBox.showMessage('Herbolaria Lyra · Alquimista', [
                    'No tienes suficientes Bytes para la fianza. ¡Vuelve con fondos o completa mi encargo de flores!'
                  ], this._getHerbChoices());
                  return;
                }
                this.player.coins -= 25;
                this.housePermissions.herbalist_house = true;
                if (this.music) this.music.playFanfare();
                this._saveGameToStorage();
                this.dialogueBox.showMessage('Herbolaria Lyra · Alquimista', [
                  '¡De acuerdo! Fianza anotada. Cuida de las plantas en las estanterías.'
                ], this._getHerbChoices());
              }
            },
            {
              label: 'Buscaré las Flores de Silicio primero',
              onSelect: () => {
                this.dialogueBox.showMessage('Herbolaria Lyra · Alquimista', [
                  '¡Perfecto! Espera a la noche profunda (22:00 PM) para encontrarlas.'
                ], this._getHerbChoices());
              }
            }
          ]);
        }
      },
      {
        label: '💰 Vender plantas / materiales',
        onSelect: () => {
          this.dialogueBox.showMessage('Herbolaria Lyra · Alquimista', [
            'Compro flores de silicio, bayas, truchas y elixires para mis preparados botánicos.'
          ], this._getSellChoices('Herbolaria Lyra · Alquimista', this._getHerbChoices()));
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
        label: '💰 Vender pescado / materiales',
        onSelect: () => {
          this.dialogueBox.showMessage('Finn · Pescador del Río Alba', [
            'Compro truchas, agua de manantial, pan y restos que hayas pescado en tus viajes.'
          ], this._getSellChoices('Finn · Pescador del Río Alba', this._getFinnChoices()));
        }
      },
      {
        label: '¿Puedo pasar a tu casa?',
        onSelect: () => {
          this.dialogueBox.showMessage('Finn · Pescador del Río Alba', [
            '¡Ja! Mi casa es la vieja barcaza amarrada al embarcadero del Río Alba, cruzando el puente.',
            'De día siempre estoy aquí en la plaza atendiendo el puesto de pesca. ¡Pásate por el río cuando quieras!'
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
        x: 25 * 16,
        y: 6 * 16,
        speed: 0,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.BLACKSMITH),
        behavior: 'static',
        initialDirection: 'right',
        patrolPoints: [
          { x: 25 * 16, y: 6 * 16, dir: 'right', waitMin: 4.0, waitMax: 8.0, activityIcon: '⚒' }
        ],
        ambientPhrases: [
          '¡Clang, clang! Buen acero en el yunque hoy.',
          'El horno de forja arde a pleno rendimiento.',
          'Un buen aventurero necesita buen equipo forjado.',
          '¡Golpea el silicio mientras esté candente!'
        ],
        getDialogues: () => ({
          lines: [
            '¡Clang, clang! Soy Brom, el Maestro Forjador de Valleverde. Aquí en mi yunque exterior mejoro tu equipo y armas.'
          ],
          choices: this._getSmithChoices()
        })
      }),
      new NPC({
        name: 'Herbolaria Lyra · Alquimista',
        jobTitle: 'Botánica y Alquimista',
        homeSceneId: 'herbalist_house',
        x: 8 * 16,
        y: 17 * 16,
        speed: 0,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.HERBALIST),
        behavior: 'static',
        initialDirection: 'down',
        patrolPoints: [
          { x: 8 * 16, y: 17 * 16, dir: 'down', waitMin: 4.0, waitMax: 8.0, activityIcon: '✿' }
        ],
        ambientPhrases: [
          '♪ Creced fuertes, flores del alba ♪',
          'El huerto alquímico destila rocío purificador.',
          'Las Flores de Silicio nocturnas son la clave contra la corrupción.',
          'Esta infusión de hierbas silvestres quedará perfecta.'
        ],
        getDialogues: () => ({
          lines: [
            '¡Hola! Soy Lyra, la Botánica y Alquimista de Valleverde. Cuido este jardín botánico y preparo remedios.'
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
            },
            {
              label: '¿Puedo pasar a tu casa?',
              onSelect: () => {
                if (this.housePermissions.guard_house) {
                  this.dialogueBox.showMessage('Guardia Kael · Capitán del Binario', [
                    '¡Ya dispones de salvoconducto militar! El cuartel de la guardia está a tu disposición.'
                  ], choices);
                  return;
                }

                if (this.tilemap.bridgeForceUnlocked) {
                  this.housePermissions.guard_house = true;
                  if (this.music) this.music.playFanfare();
                  this._saveGameToStorage();
                  this.dialogueBox.showMessage('Guardia Kael · Capitán del Binario', [
                    '¡Afirmativo, héroe! Con el puente del este habilitado has demostrado lealtad indiscutible.',
                    '¡Salvoconducto concedido! Toma la llave del cuartel militar.'
                  ], choices);
                  return;
                }

                this.dialogueBox.showMessage('Guardia Kael · Capitán del Binario', [
                  '¡Negativo, civil! El cuartel de la guardia custodia planos tácticos y armamento del Binario.',
                  'Solo se permite acceso con autorización del Sabio Aurelio o depositando una fianza reglamentaria de 25 Bytes.'
                ], [
                  {
                    label: `🪙 Pagar fianza de 25 Bytes [Tienes: ${this.player.coins}🪙]`,
                    onSelect: () => {
                      if (this.player.coins < 25) {
                        this.dialogueBox.showMessage('Guardia Kael · Capitán del Binario', [
                          '¡Fianza insuficiente! Vuelve con 25 Bytes o tramita el pase con el Sabio Aurelio.'
                        ], choices);
                        return;
                      }
                      this.player.coins -= 25;
                      this.housePermissions.guard_house = true;
                      if (this.music) this.music.playFanfare();
                      this._saveGameToStorage();
                      this.dialogueBox.showMessage('Guardia Kael · Capitán del Binario', [
                        'Fianza militar procesada en tesorería. ¡Llave del cuartel entregada!'
                      ], choices);
                    }
                  },
                  {
                    label: 'Hablaré con el Sabio Aurelio primero',
                    onSelect: () => {
                      this.dialogueBox.showMessage('Guardia Kael · Capitán del Binario', [
                        'Procedimiento correcto. La disciplina es el pilar de Valleverde.'
                      ], choices);
                    }
                  }
                ]);
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
            },
            {
              label: '¿Puedo pasar a tu casa?',
              onSelect: () => {
                if (this.housePermissions.guard_house) {
                  this.dialogueBox.showMessage('Guardia Kael · Capitán del Binario', [
                    '¡Ya dispones de salvoconducto militar! El cuartel de la guardia está a tu disposición.'
                  ], choices);
                  return;
                }

                if (this.tilemap.bridgeForceUnlocked) {
                  this.housePermissions.guard_house = true;
                  if (this.music) this.music.playFanfare();
                  this._saveGameToStorage();
                  this.dialogueBox.showMessage('Guardia Kael · Capitán del Binario', [
                    '¡Afirmativo, héroe! Con el puente del este habilitado has demostrado lealtad indiscutible.',
                    '¡Salvoconducto concedido! Toma la llave del cuartel militar.'
                  ], choices);
                  return;
                }

                this.dialogueBox.showMessage('Guardia Kael · Capitán del Binario', [
                  '¡Negativo, civil! El cuartel de la guardia custodia planos tácticos y armamento del Binario.',
                  'Solo se permite acceso con autorización del Sabio Aurelio o depositando una fianza reglamentaria de 25 Bytes.'
                ], [
                  {
                    label: `🪙 Pagar fianza de 25 Bytes [Tienes: ${this.player.coins}🪙]`,
                    onSelect: () => {
                      if (this.player.coins < 25) {
                        this.dialogueBox.showMessage('Guardia Kael · Capitán del Binario', [
                          '¡Fianza insuficiente! Vuelve con 25 Bytes o tramita el pase con el Sabio Aurelio.'
                        ], choices);
                        return;
                      }
                      this.player.coins -= 25;
                      this.housePermissions.guard_house = true;
                      if (this.music) this.music.playFanfare();
                      this._saveGameToStorage();
                      this.dialogueBox.showMessage('Guardia Kael · Capitán del Binario', [
                        'Fianza militar procesada en tesorería. ¡Llave del cuartel entregada!'
                      ], choices);
                    }
                  },
                  {
                    label: 'Hablaré con el Sabio Aurelio primero',
                    onSelect: () => {
                      this.dialogueBox.showMessage('Guardia Kael · Capitán del Binario', [
                        'Procedimiento correcto. La disciplina es el pilar de Valleverde.'
                      ], choices);
                    }
                  }
                ]);
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
            ? '¡Saludos, héroe! Con el Pase del Puente autorizado, el puente del este está abierto. ¡Cruza al Valle de la Consagración y supera las Pruebas Sagradas!'
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
              ? ((this.player.level || 1) < 2
                  ? [
                      '⚠️ ¡Cuidado, recluta! El puente del este está físicamente abierto, pero la guardia tiene orden de no dejar pasar a nadie por debajo del NIVEL 2.',
                      '¡Derrota algunos bugs menores en Valleverde para subir al Nivel 2 y cruzar con garantías!'
                    ]
                  : [
                      '¡Paso expedito! Cuentas con Nivel 2+ y el puente está abierto por orden del Sabio Aurelio.',
                      'Al otro lado te aguardan las Pruebas Sagradas. ¡Ten cuidado con los bugs nocturnos si cruzas de noche!'
                    ])
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
              label: '💰 Vender materiales / consumibles',
              onSelect: () => {
                this.dialogueBox.showMessage('Mercader Byte', [
                  'Compro chatarra, elixires, pescado y vituallas. ¿Qué me ofreces?'
                ], this._getSellChoices('Mercader Byte', storeChoices));
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
              label: '💰 Vender provisiones / cosechas',
              onSelect: () => {
                this.dialogueBox.showMessage('Clara · Panadería y Frutas', [
                  'Compro manzanas, trigo, pan, pescado y bayas cosechadas. ¿Qué vendes?'
                ], this._getSellChoices('Clara · Panadería y Frutas', foodChoices));
              }
            },
            {
              label: '¿Puedo pasar a tu casa?',
              onSelect: () => {
                this.dialogueBox.showMessage('Clara · Panadería y Frutas', [
                  '¡Mi casa está junto al molino al sur de la plaza!',
                  'Pero durante el día tengo el horno a tope atendiendo el puesto de pan en la plaza del mercado.'
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
              label: `🛡️ Comprar Poción de Blindaje (12 🪙) [Tienes: ${this.player.coins}🪙]`,
              onSelect: () => {
                if (this.player.coins < 12) {
                  this.dialogueBox.showMessage('Pip · Herboristería', [
                    'La Poción de Blindaje cuesta 12 monedas.'
                  ], herbChoices);
                  return;
                }
                this.player.coins -= 12;
                this.inventory.addItem({
                  id: 'potion_armor',
                  name: 'Poción de Blindaje',
                  description: 'Elixir de aleación resplandeciente. Reconstituye los 3 corazones blindados de la Armadura Binaria.',
                  iconIndex: ITEM_ICONS.POTION_ARMOR,
                  qty: 1
                });
                this.music.playFanfare();
                this._saveGameToStorage();
                this.dialogueBox.showMessage('Pip · Herboristería', [
                  '¡Aquí tienes tu Poción de Blindaje! Destilada con minerales fractales para reconstituir tu coraza protectora.'
                ], herbChoices);
              }
            },
            {
              label: '💰 Vender hierbas / elixires',
              onSelect: () => {
                this.dialogueBox.showMessage('Pip · Herboristería', [
                  'Compro flores de silicio, pociones, ungüentos y materiales de alquimia. ¿Qué vendes?'
                ], this._getSellChoices('Pip · Herboristería', herbChoices));
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
              ? '«¡Lo has logrado! Ya vistes la Armadura del Alba y empuñas la Espada del Alba. ¡Derrota a los esbirros con [Clic Izq / Espacio / F] y cruza el Portal del Este!»'
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
      }),
      new NPC({
        name: 'Guardia Boreas · Centinela de las Cumbres',
        jobTitle: 'Centinela Septentrional',
        homeSceneId: 'overworld',
        x: 16 * 16,
        y: 2 * 16,
        speed: 24,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.GUARD),
        behavior: 'patrol',
        patrolPoints: [
          { x: 16 * 16, y: 2 * 16, dir: 'down', waitMin: 2.5, waitMax: 4.5 },
          { x: 19 * 16, y: 2 * 16, dir: 'left', waitMin: 2.5, waitMax: 4.5 }
        ],
        ambientPhrases: [
          'El viento del norte congela los bucles...',
          'Las Cumbres de la Recursión exigen agilidad y nivel.',
          'Cuidado con la caída en los abismos de silicio.'
        ],
        getDialogues: () => {
          const boreasChoices = [
            {
              label: '¿Qué peligros acechan en las Cumbres del Norte?',
              onSelect: () => {
                this.dialogueBox.showMessage('Guardia Boreas · Centinela de las Cumbres', [
                  'Abismos que exigen el Dash Asíncrono, anomalías de bucle y el Guardián del Stack Overflow en las profundidades de la mina.',
                  'Asegúrate de forjar tu Espada de Silicio antes de internarte en la caverna.'
                ], boreasChoices);
              }
            },
            {
              label: 'Entendido, guardia',
              onSelect: () => this.dialogueBox.close()
            }
          ];
          const hasLevel = (this.player.level || 1) >= 4;
          return {
            lines: hasLevel
              ? [
                  '¡Saludos, montañero! Tus registros están optimizados (Nivel 4+).',
                  'Tienes autorización para adentrarte en Las Cumbres de la Recursión al norte. ¡No resbales en los abismos!'
                ]
              : [
                  '¡Detente! El paso norte a Las Cumbres de la Recursión está restringido.',
                  'Una ventisca algorítmica de "Memory Freeze" azota la cordillera. Solo un programador de NIVEL 4 puede sobrevivir al frío del stack.'
                ],
            choices: boreasChoices
          };
        }
      }),
      new NPC({
        name: 'Guardia Vulcano · Centinela de las Marismas',
        jobTitle: 'Centinela Meridional',
        homeSceneId: 'overworld',
        x: 16 * 16,
        y: 21 * 16,
        speed: 24,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.GUARD),
        behavior: 'patrol',
        patrolPoints: [
          { x: 16 * 16, y: 21 * 16, dir: 'up', waitMin: 2.5, waitMax: 4.5 },
          { x: 19 * 16, y: 21 * 16, dir: 'right', waitMin: 2.5, waitMax: 4.5 }
        ],
        ambientPhrases: [
          'El fango de las cloacas hierve con leaks de memoria...',
          'El calor de la Forja llega hasta este sector.',
          'Cuarentena militar activa en el paso sur.'
        ],
        getDialogues: () => {
          const vulcanoChoices = [
            {
              label: '¿Por qué hay cuarentena en el sector sur?',
              onSelect: () => {
                this.dialogueBox.showMessage('Guardia Vulcano · Centinela de las Marismas', [
                  'Las Marismas del Hardware Legacy albergan las Cloacas donde acecha el Garbage Collector Furioso y la Forja del Prototipo.',
                  'El fango es corrosivo y las calderas de la Forja alcanzan temperaturas extremas.',
                  'Necesitas el Blindaje Térmico de Brom para sobrevivir en el interior de la Forja.'
                ], vulcanoChoices);
              }
            },
            {
              label: 'Entendido, volveré cuando esté listo',
              onSelect: () => this.dialogueBox.close()
            }
          ];
          const hasLevel = (this.player.level || 1) >= 6;
          return {
            lines: hasLevel
              ? [
                  '¡Paso autorizado, veterano! Cuentas con Nivel 6 y temple contrastado.',
                  'El acceso sur hacia Las Marismas del Hardware Legacy está abierto. ¡Cuidado con el ácido y el vapor ardiente!'
                ]
              : [
                  '¡Zona bajo cuarentena militar! El paso sur hacia Las Marismas del Hardware Legacy está precintado.',
                  'Las emanaciones tóxicas y el calor de la Forja desintegrarán tus circuitos si no posees al menos NIVEL 6.'
                ],
            choices: vulcanoChoices
          };
        }
      }),
      new NPC({
        name: 'Comandante Vael · Paladín de la Frontera',
        jobTitle: 'Paladín y Custodio de la Frontera Occidental',
        homeSceneId: 'overworld',
        x: 3 * 16,
        y: 11 * 16,
        speed: 24,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.GUARD),
        behavior: 'patrol',
        patrolPoints: [
          { x: 3 * 16, y: 11 * 16, dir: 'down', waitMin: 2.5, waitMax: 4.5 },
          { x: 3 * 16, y: 14 * 16, dir: 'up', waitMin: 2.5, waitMax: 4.5 }
        ],
        ambientPhrases: [
          'Las anomalías de Alex se concentran al oeste...',
          'No cederemos la frontera de Valleverde.',
          'Solo los más veteranos pueden encarar el Páramo.'
        ],
        getDialogues: () => {
          const vaelChoices = [
            {
              label: '¿Qué amenaza acecha más allá de la frontera oeste?',
              onSelect: () => {
                this.dialogueBox.showMessage('Comandante Vael · Paladín de la Frontera', [
                  'El Páramo Corrupto de Mister AI Alex. Drones de asalto, terreno electromagnético y la Gran Puerta del Núcleo Cuántico.',
                  'Para franquear la Puerta Cuántica deberás haber derrotado a los 3 jefes de mazmorra y colocar sus Núcleos.',
                  'Y para encarar a Alex en su Mainframe necesitarás alcanzar el Nivel 10.'
                ], vaelChoices);
              }
            },
            {
              label: 'Defenderé el Reino, Comandante',
              onSelect: () => this.dialogueBox.close()
            }
          ];
          const hasLevel = (this.player.level || 1) >= 8;
          return {
            lines: hasLevel
              ? [
                  '¡Honor a ti, paladín! Posees Nivel 8 y un poder recursivo legendario.',
                  'La frontera oeste hacia el Páramo de Mister AI Alex está abierta para ti. ¡Haz morder el polvo a la IA corrupta!'
                ]
              : [
                  '¡Paso terminantemente vedado! Al oeste se extiende el Páramo de Mister AI Alex.',
                  'Sus cortafuegos cuánticos desintegran en nanosegundos a cualquier mortal menor a NIVEL 8. No permitiré que perezcas en vano.'
                ],
            choices: vaelChoices
          };
        }
      })
    ];
  }

  _createRegionalPatrols(sheet) {
    const regions = [
      { prefix: 'peaks', sceneId: 'north_peaks', label: 'de las Cumbres', xp: 40, droneHp: 3, knightHp: 4, speed: 36,
        spots: [[6, 9, 'drone'], [25, 9, 'drone'], [8, 16, 'knight'], [24, 16, 'knight']] },
      { prefix: 'swamp', sceneId: 'south_swamp', label: 'de las Marismas', xp: 50, droneHp: 3, knightHp: 5, speed: 38,
        spots: [[8, 4, 'drone'], [24, 4, 'drone'], [12, 18, 'knight'], [21, 18, 'knight']] },
      { prefix: 'wastes', sceneId: 'west_wastes', label: 'del Páramo', xp: 60, droneHp: 4, knightHp: 6, speed: 40,
        spots: [[8, 4, 'drone'], [25, 4, 'drone'], [12, 18, 'knight'], [25, 18, 'knight']] }
    ];
    const patrols = [];
    for (const region of regions) {
      region.spots.forEach(([col, row, kind], i) => {
        const isDrone = kind === 'drone';
        patrols.push(new Enemy({
          id: `${kind}_${region.prefix}_${i + 1}`,
          name: isDrone ? `Dron Corrupto ${region.label}` : `Caballero Corrupto ${region.label}`,
          x: col * 16,
          y: row * 16,
          sceneId: region.sceneId,
          speed: region.speed,
          maxHp: isDrone ? region.droneHp : region.knightHp,
          aggroRange: 60,
          xpReward: region.xp,
          respawnOnEnter: true,
          animator: new SpriteAnimator(sheet, isDrone ? CHARACTER_TYPES.SHADOW_DRONE : CHARACTER_TYPES.SHADOW_KNIGHT, 16, 16, 0.12),
          patrolPoints: [
            { x: col * 16, y: row * 16 },
            { x: (col + 3) * 16, y: row * 16 },
            { x: (col + 3) * 16, y: (row + 1) * 16 },
            { x: col * 16, y: (row + 1) * 16 }
          ]
        }));
      });
    }
    return patrols;
  }

  _createFirstStageEnemies() {
    const sheet = this.assets.charactersSheet;

    return [
      // ==================== CAMPO DE ENTRENAMIENTO DE VALLEVERDE (SPARRING Y XP) ====================
      new Enemy({
        id: 'drone_training_1',
        name: 'Dron de Entrenamiento del Binario',
        x: 23 * 16,
        y: 20 * 16,
        sceneId: 'overworld',
        speed: 22,
        maxHp: 2,
        aggroRange: 38,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_DRONE, 16, 16, 0.12),
        patrolPoints: [
          { x: 23 * 16, y: 20 * 16 },
          { x: 25 * 16, y: 20 * 16 },
          { x: 25 * 16, y: 21 * 16 },
          { x: 23 * 16, y: 21 * 16 }
        ]
      }),
      new Enemy({
        id: 'drone_training_2',
        name: 'Bug de Práctica de Valleverde',
        x: 24 * 16,
        y: 21 * 16,
        sceneId: 'overworld',
        speed: 20,
        maxHp: 2,
        aggroRange: 36,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_DRONE, 16, 16, 0.12),
        patrolPoints: [
          { x: 24 * 16, y: 21 * 16 },
          { x: 23 * 16, y: 21 * 16 },
          { x: 23 * 16, y: 20 * 16 }
        ]
      }),

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

      // ==================== ENEMIGOS NOCTURNOS (EN EL VALLE DE LOS TEMPLOS) ====================
      new Enemy({
        id: 'night_bug_east_1',
        name: 'Bug de Memoria Nocturno',
        x: 23 * 16,
        y: 11 * 16,
        sceneId: 'first_stage',
        nightOnly: true,
        speed: 35,
        maxHp: 2,
        aggroRange: 56,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_DRONE, 16, 16, 0.12),
        patrolPoints: [
          { x: 21 * 16, y: 11 * 16 },
          { x: 25 * 16, y: 11 * 16 },
          { x: 25 * 16, y: 13 * 16 },
          { x: 21 * 16, y: 13 * 16 }
        ]
      }),
      new Enemy({
        id: 'night_bug_east_2',
        name: 'Dron Cazador de Nocturnidad',
        x: 18 * 16,
        y: 8 * 16,
        sceneId: 'first_stage',
        nightOnly: true,
        speed: 38,
        maxHp: 3,
        aggroRange: 60,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.SHADOW_KNIGHT, 16, 16, 0.12),
        patrolPoints: [
          { x: 17 * 16, y: 8 * 16 },
          { x: 20 * 16, y: 8 * 16 },
          { x: 20 * 16, y: 10 * 16 },
          { x: 17 * 16, y: 10 * 16 }
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

      // ==================== PATRULLAS REGIONALES (REAPARECEN AL VOLVER A ENTRAR EN LA REGIÓN) ====================
      // Fuente de experiencia escalada por zona para alcanzar los niveles exigidos por los centinelas
      ...this._createRegionalPatrols(sheet),

      // ==================== JEFES REGIONALES CON BANDA SONORA Y HABILIDADES ÚNICAS ====================
      // Jefe Regional: El Garbage Collector Furioso (Alcantarillas de Valleverde · 24 HP)
      new GarbageCollectorBoss({
        x: 11.5 * 16,
        y: 7 * 16,
        sceneId: 'sewers_dungeon'
      }),

      // Jefe Regional: El Guardián del Stack Overflow (Templo de la Espada · 32 HP)
      new StackOverflowBoss({
        x: 11.5 * 16,
        y: 4.5 * 16,
        sceneId: 'sword_temple'
      }),

      // Jefe Regional: El Microondas Prototipo V0.1 Alpha (Umbral de la Fortaleza · 42 HP)
      new PrototypeMicrowaveBoss({
        x: 11.5 * 16,
        y: 6.5 * 16,
        sceneId: 'ai_fortress_gate'
      }),

      // Batalla Definitiva: Mister AI Alex y El Microondas Cuántico (Ciudadela · El Gran Ojal · 55 HP)
      new FinalBossAlex({
        x: 11.5 * 16,
        y: 6.5 * 16,
        sceneId: 'ai_citadel'
      })
    ];
  }

  /**
   * Sincroniza la presencia de los NPCs con el ciclo Día/Noche:
   * A las 22:00 PM se recogen los puestos y duermen en sus camas.
   * A las 06:00 AM despiertan y regresan a sus oficios y puestos en la plaza.
   */
  _updateNPCSchedules() {
    const isNight = this.dayNight.timeOfDayHours >= 22 || this.dayNight.timeOfDayHours < 6;
    for (const npc of this.npcs) {
      if (!npc.homeSceneId || npc.homeSceneId === 'overworld') continue;

      if (isNight) {
        npc.sceneId = npc.homeSceneId;
        npc.x = 9.5 * 16;
        npc.y = 2.2 * 16;
        npc.isSleeping = true;
      } else {
        npc.isSleeping = false;
        if (npc.homeSceneId !== 'elder_house') {
          npc.sceneId = 'overworld';
          npc.x = npc.overworldX;
          npc.y = npc.overworldY;
          npc.behavior = npc.overworldBehavior;
        }
      }
    }
  }

  /**
   * Devuelve a los NPCs a su ubicación coherente según el ciclo de horario.
   */
  _restoreAllNPCsToOverworld() {
    this._updateNPCSchedules();
  }

  /**
   * Cuando el jugador entra en la casa de un NPC, el dueño aparece dentro y si no tiene
   * permiso le pregunta qué hace en su casa y quién le ha dado permiso.
   */
  _handleHouseOwnerConfrontation(sceneId) {
    const isDay = this.dayNight.timeOfDayHours >= 6 && this.dayNight.timeOfDayHours < 22;
    const ownerNPC = this.npcs.find((n) => n.homeSceneId === sceneId);
    if (!ownerNPC) return;

    // Si es de día y no es la casa de Aurelio, el tendero sigue en la plaza y la vivienda está vacía (sin duplicación)
    if (isDay && sceneId !== 'elder_house') {
      return;
    }

    // Para la casa del Sabio Aurelio: bienvenida hospitalaria directa y opciones de diálogo naturales
    if (sceneId === 'elder_house') {
      this.housePermissions.elder_house = true;
      ownerNPC.sceneId = sceneId;
      ownerNPC.x = 5.5 * 16;
      ownerNPC.y = 3.5 * 16;
      ownerNPC.behavior = 'static';
      ownerNPC.direction = 'down';
      ownerNPC.isSleeping = false;
      this.dialogueBox.showMessage('Sabio Aurelio · Cronista', [
        '«¡Adelante, joven programador! Pasa a mi archivo. Me alegro de verte.',
        'Imagino que vienes por el asunto del puente clausurado hacia las Tierras Sagradas o buscas respuestas sobre el villano AI Alex... Ponte cómodo y consulta lo que necesites.»'
      ], this._getElderChoices());
      return;
    }

    // De noche (22:00 PM a 06:00 AM): el propietario descansa plácidamente en su cama
    ownerNPC.sceneId = sceneId;
    ownerNPC.x = 9.5 * 16;
    ownerNPC.y = 2.2 * 16;
    ownerNPC.isSleeping = true;
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
        x: 8 * 16,
        y: 20 * 16,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.CHICKEN, 16, 16, 0.12),
        soundText: '¡Cloc, cloc! La gallina picotea entre el pasto.',
        fedText: '¡Gallina Pinta picotea las semillas de trigo a toda velocidad! ♥',
        speed: 28,
        homeRadius: 28
      }),
      new Animal({
        name: 'Gallina Dorada',
        species: 'chicken',
        x: 9 * 16,
        y: 21 * 16,
        animator: new SpriteAnimator(sheet, CHARACTER_TYPES.CHICKEN, 16, 16, 0.12),
        soundText: '¡Co-co-ro-có! Busca granos cerca del vallado.',
        fedText: '¡Le diste trigo a Gallina Dorada! Aletea muy contenta. ♥',
        speed: 28,
        homeRadius: 28
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
    const tilesetSheet = this.assets.tilesetSheet;

    if (!this.abyssalPointerSpawn || this.abyssalPointerSpawn.sceneId !== 'first_stage') {
      const spawnIndex = Math.floor(Math.random() * ABYSSAL_POINTER_SPAWN_CANDIDATES.length);
      this.abyssalPointerSpawn = { ...ABYSSAL_POINTER_SPAWN_CANDIDATES[spawnIndex] };
    }

    return [
      new WorldItem({
        id: 'item_abyssal_pointer',
        name: 'Puntero al Abismo (Null Pointer)',
        description: 'Reliquia cósmica reutilizable. Úsala desde la mochila [I] cuantas veces quieras para abrir tu Portal Abisal (estilo Diablo) hacia los Reinos Condenados y regresar por él.',
        iconIndex: ITEM_ICONS.ABYSSAL_POINTER,
        x: this.abyssalPointerSpawn.x,
        y: this.abyssalPointerSpawn.y,
        sceneId: this.abyssalPointerSpawn.sceneId || 'first_stage',
        itemsSheet,
        tilesetSheet,
        isChest: true
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
        itemsSheet,
        tilesetSheet,
        isChest: true
      }),
      new WorldItem({
        id: 'golden_apple',
        name: 'El Microondas Little (Reliquia Divina)',
        description: 'Reliquia divina ancestral custodiada por Aurelio. Sin despertador, recalienta código y variables en O(1), restaura toda tu salud y purga anomalías. ¡Úsala con cuidado!',
        iconIndex: ITEM_ICONS.GOLDEN_APPLE,
        x: 6 * 16,
        y: 3 * 16,
        sceneId: 'elder_house',
        itemsSheet,
        tilesetSheet,
        isChest: true
      }),
      new WorldItem({
        id: 'bridge_pass',
        name: 'Pase del Puente',
        description: 'Sello oficial del Sabio. Úsalo con [E] o dáselo al guardia para abrir el puente 24h.',
        iconIndex: ITEM_ICONS.BRIDGE_PASS,
        x: 8 * 16,
        y: 3 * 16,
        sceneId: 'elder_house',
        itemsSheet,
        tilesetSheet,
        isChest: true
      }),
      new WorldItem({
        id: 'bread',
        name: 'Pan Campesino',
        description: 'Pan recién horneado en la forja. Restaura energías o alegra al perro Toby.',
        iconIndex: ITEM_ICONS.BREAD,
        x: 8 * 16,
        y: 3 * 16,
        sceneId: 'blacksmith_house',
        itemsSheet,
        tilesetSheet,
        isChest: true
      }),
      new WorldItem({
        id: 'potion',
        name: 'Poción Herbal',
        description: 'Elixir aromático de flores de Valleverde. Úsalo para sentirte ligero.',
        iconIndex: ITEM_ICONS.POTION,
        x: 3 * 16,
        y: 3 * 16,
        sceneId: 'herbalist_house',
        itemsSheet,
        tilesetSheet,
        isChest: true
      }),
      new WorldItem({
        id: 'wheat',
        name: 'Trigo Fresco',
        description: 'Espigas tiernas. Acércate a una oveja o gallina para alimentarlas.',
        iconIndex: ITEM_ICONS.WHEAT,
        x: 8 * 16,
        y: 5 * 16,
        sceneId: 'herbalist_house',
        itemsSheet,
        tilesetSheet,
        isChest: true
      }),
      new WorldItem({
        id: 'coffee',
        name: 'Café Compilado',
        description: 'Café de filtro de tu escritorio. Restaura 1 corazón y purga 40% de robotización binaria.',
        iconIndex: ITEM_ICONS.POTION,
        x: 8 * 16,
        y: 4 * 16,
        sceneId: 'player_house',
        itemsSheet,
        tilesetSheet,
        isChest: true
      }),
      // ==================== COFRES DE MAZMORRA - RECOMPENSAS FINALES ====================
      // Estos cofres se encuentran al final de cada mazmorra y otorgan los Núcleos
      // de Mazmorra necesarios para la Puerta Cuántica, además de habilidades y materiales.

      new WorldItem({
        id: 'chest_nucleo_stack',
        name: 'Cofre del Núcleo Stack Overflow',
        description: 'Cofre del Guardián del Stack Overflow. Contiene el Núcleo Stack y desbloquea la habilidad Corte en Cascada.',
        iconIndex: ITEM_ICONS.DUNGEON_CORE_STACK,
        x: 11 * 16,
        y: 4 * 16,
        sceneId: 'sword_temple',
        itemsSheet,
        tilesetSheet,
        isChest: true
      }),
      new WorldItem({
        id: 'chest_nucleo_gc',
        name: 'Cofre del Núcleo Garbage Collector',
        description: 'Cofre del Garbage Collector Furioso. Contiene el Núcleo GC y desbloquea la habilidad Dash Asíncrono.',
        iconIndex: ITEM_ICONS.DUNGEON_CORE_GC,
        x: 8 * 16,
        y: 14 * 16,
        sceneId: 'sewers_dungeon',
        itemsSheet,
        tilesetSheet,
        isChest: true
      }),
      new WorldItem({
        id: 'chest_nucleo_microwave',
        name: 'Cofre del Núcleo Microondas Prototipo',
        description: 'Cofre del Microondas Prototipo. Contiene el Núcleo Microondas y desbloquea la habilidad Barrera TypeScript.',
        iconIndex: ITEM_ICONS.DUNGEON_CORE_MICROWAVE,
        x: 12 * 16,
        y: 8 * 16,
        sceneId: 'ai_fortress_gate',
        itemsSheet,
        tilesetSheet,
        isChest: true
      }),
      new WorldItem({
        id: 'chest_magnetron',
        name: 'Cofre del Magnetrón Cuántico',
        description: 'Cofre oculto en La Forja. Contiene el Magnetrón necesario para forjar la Espada Overclockeada (Nivel 3) con Brom.',
        iconIndex: ITEM_ICONS.MICROWAVE_MAGNETRON,
        x: 20 * 16,
        y: 8 * 16,
        sceneId: 'forge_entry',
        itemsSheet,
        tilesetSheet,
        isChest: true
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

  _isNightTime() {
    return typeof this.dayNight?.isNight === 'function'
      ? this.dayNight.isNight()
      : Boolean(this.dayNight && (this.dayNight.timeOfDayHours >= 20 || this.dayNight.timeOfDayHours < 6));
  }

  _getActiveSceneEntities() {
    const scene = this.tilemap.currentSceneId;
    const isNight = this._isNightTime();
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
      if (i.sceneId !== scene) return false;
      if (i.collected && !i.isChest) return false;
      if (i.nightOnly && !isNight) return false;
      return true;
    });
    return { npcs, animals, enemies, items };
  }

  _findBestInteraction() {
    const { npcs, animals, items } = this._getActiveSceneEntities();
    const currentScene = this.tilemap.currentSceneId;
    const isNight = this._isNightTime();

    // Puzle 1: Monolitos Crípticos en Templo de la Armadura
    if (currentScene === 'armor_temple' && this.tilemap.armorPuzzle?.monoliths) {
      for (const mono of Object.values(this.tilemap.armorPuzzle.monoliths)) {
        const mx = mono.col * 16 + 8;
        const my = mono.row * 16 + 8;
        if (Math.hypot(this.player.centerX - mx, this.player.centerY - my) <= 26) {
          return {
            kind: 'armor_monolith',
            target: { ...mono, centerX: mx, y: my },
            label: `[E] Inspeccionar ${mono.name} (${mono.symbol})`
          };
        }
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
            target: { ...mono, centerX: mx, y: my },
            label: `[E] Sintonizar ${mono.name} (${mono.symbol})`
          };
        }
      }
    }

    // Puzle 3: Zócalos de Núcleos Cuánticos en La Gran Puerta del Núcleo
    if (currentScene === 'quantum_gate') {
      const pedestals = [
        { id: 'gc', col: 8, row: 7, name: 'Zócalo Verde (Garbage Collector)', coreItem: 'dungeon_core_gc' },
        { id: 'stack', col: 11, row: 6, name: 'Zócalo Cian (Stack Overflow)', coreItem: 'dungeon_core_stack' },
        { id: 'microwave', col: 14, row: 7, name: 'Zócalo Carmesí (Microondas)', coreItem: 'dungeon_core_microwave' }
      ];
      for (const ped of pedestals) {
        const px = ped.col * 16 + 8;
        const py = ped.row * 16 + 8;
        if (Math.hypot(this.player.centerX - px, this.player.centerY - py) <= 26) {
          const isPlaced = Boolean(this.tilemap.quantumGate?.coresPlaced?.[ped.id]);
          return {
            kind: 'quantum_pedestal',
            target: { ...ped, isPlaced, centerX: px, y: py },
            label: isPlaced
              ? `[E] ${ped.name} [Engarzado]`
              : `[E] Colocar Núcleo en ${ped.name}`
          };
        }
      }
    }

    // Portal Abisal de retorno dentro de los Reinos Condenados (estilo Diablo)
    if (currentScene === 'condemned_realms') {
      const exitCenterX = 11.5 * 16;
      const exitCenterY = 15.2 * 16;
      if (Math.hypot(this.player.centerX - exitCenterX, this.player.centerY - exitCenterY) <= 26) {
        return {
          kind: 'abyssal_portal_exit',
          label: '[E] Cruzar Portal Abisal (Regresar)',
          target: { centerX: exitCenterX, y: exitCenterY }
        };
      }
    }

    // Portal Abisal hacia los Reinos Condenados invocado por el jugador (permanece abierto estilo Diablo)
    if (this.activeAbyssalPortal && this.activeAbyssalPortal.sceneId === currentScene) {
      const pCenterX = this.activeAbyssalPortal.x + 10;
      const pCenterY = this.activeAbyssalPortal.y + 10;
      if (Math.hypot(this.player.centerX - pCenterX, this.player.centerY - pCenterY) <= 26) {
        return {
          kind: 'abyssal_portal',
          label: '[E] Entrar al Portal Abisal (Reinos Condenados)',
          target: { centerX: pCenterX, y: pCenterY }
        };
      }
    }

    for (const item of items) {
      if (item.canInteract(this.player, isNight)) {
        const label = item.isChest
          ? `[E] Abrir Cofre: ${item.name}`
          : `[E] Recoger ${item.name}`;
        return { kind: 'item', target: item, label };
      }
    }

    const door = this.tilemap.findNearbyDoor(this.player);
    if (door) {
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
        const ground = this.tilemap.scenes.overworld?.layers?.ground;
        if (ground) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const r = pRow + dr;
              const c = pCol + dc;
              if (ground[r] && (ground[r][c] === TILES.WATER_1 || ground[r][c] === TILES.WATER_2)) {
                nearWater = true;
                break;
              }
            }
            if (nearWater) break;
          }
        }
        if (nearWater) {
          const fishAnchor = { centerX: pCol * 16 + 8, y: pRow * 16 };
          if (this.inventory && this.inventory.hasItem('bread')) {
            return {
              kind: 'river_fishing',
              target: fishAnchor,
              label: '[E] Pescar Trucha en el Río Alba (Usa Pan)'
            };
          } else {
            return {
              kind: 'river_fishing_nobread',
              target: fishAnchor,
              label: 'Río Alba (Necesitas Pan Campesino como cebo)'
            };
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
      const now = Date.now();
      if (this._lastMicroRelicUse && now - this._lastMicroRelicUse < 12000) {
        const waitSec = Math.ceil((12000 - (now - this._lastMicroRelicUse)) / 1000);
        this.inventory.statusMessage = `La Reliquia Divina se está enfriando (${waitSec}s). ¡Úsala con cuidado!`;
        if (this.music) this.music.playDoorLockedSound();
        return;
      }
      this._lastMicroRelicUse = now;
      this.player.speed = 98;
      this.player.hp = this.player.effectiveMaxHp;
      this.player.cureRobotization();
      if (this.music && typeof this.music.playHealSound === 'function') {
        this.music.playHealSound();
      }
      this.inventory.statusMessage = '¡Reliquia Divina activada! Variables en O(1), salud al 100% y anomalías purgadas.';
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
      if (activeBoss || this.tilemap.currentSceneId === 'jail_cell') {
        this.inventory.statusMessage = 'La realidad está bloqueada durante el combate o en el calabozo.';
        if (this.music) this.music.playDoorLockedSound();
        return;
      }

      // El Puntero Abisal NO se consume: se puede utilizar todas las veces que se quiera
      this.inventory.close();

      // Si ya estamos dentro de los Reinos Condenados, usarlo nos devuelve directamente por el portal
      if (this.tilemap.currentSceneId === 'condemned_realms') {
        const retScene = this.abyssalPortalOrigin?.sceneId || 'overworld';
        const retX = typeof this.abyssalPortalOrigin?.x === 'number' ? this.abyssalPortalOrigin.x : 14 * 16;
        const retY = typeof this.abyssalPortalOrigin?.y === 'number' ? this.abyssalPortalOrigin.y : 12 * 16;
        if (this.music && typeof this.music.playAbyssalPortalSound === 'function') {
          this.music.playAbyssalPortalSound();
        }
        this._executeStageTransition({
          type: 'stage_transition',
          targetScene: retScene,
          label: 'Regresar por el Portal Abisal',
          spawnX: retX,
          spawnY: retY
        });
        return;
      }

      // Abrir o reubicar el Portal Abisal permanente justo frente al jugador (estilo Town Portal de Diablo)
      const portalX = Math.max(24, Math.min(this.tilemap.width - 44, Math.round(this.player.centerX - 10)));
      const portalY = Math.max(24, Math.min(this.tilemap.height - 44, Math.round(this.player.centerY - 22)));

      this.abyssalPortalOrigin = {
        sceneId: this.tilemap.currentSceneId,
        x: Math.round(this.player.x),
        y: Math.round(this.player.y)
      };

      this.activeAbyssalPortal = {
        sceneId: this.tilemap.currentSceneId,
        x: portalX,
        y: portalY,
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
        this.questLog.advanceStep('quest_condemned_pointer', '¡Portal Abisal permanente abierto! Acércate y pulsa [E] para entrar y salir cuando quieras.');
      }
      this.menuSystem.showNotice('🌀 ¡Portal Abisal abierto! Quedará activo aquí para entrar y salir con [E]', 4.5);
    } else if (item.id === 'potion_armor') {
      if (!this.player.hasArmor) {
        this.inventory.statusMessage = '¡Necesitas equipar la Armadura Binaria primero!';
        if (this.music) this.music.playDoorLockedSound();
        return;
      }
      this.player.applyArmorPotion();
      this.inventory.consumeItem('potion_armor', 1);
      if (this.music && typeof this.music.playFanfare === 'function') {
        this.music.playFanfare();
      }
      this.inventory.statusMessage = '¡Poción de Blindaje aplicada! 3 corazones acorazados reconstituidos.';
    } else if (item.id === 'spring_water') {
      this.player.hp = Math.min(this.player.effectiveMaxHp, this.player.hp + 0.5);
      this.player.takeCoffee(0, 20);
      this.inventory.consumeItem('spring_water', 1);
      this.inventory.statusMessage = '¡Bebiste Agua de Manantial! Refrescante y purificante.';
    }
    this._saveGameToStorage();
  }

  _getQuickSlotConsumable(quickKey = 'KeyR') {
    if (!this.inventory || !Array.isArray(this.inventory.items)) return null;
    
    // Mapear tecla a índice de consumible rápido (R=0, 1=1, 2=2, 3=3, 4=4, 5=5)
    const keyToIndex = {
      'KeyR': 0,
      'Digit1': 0,
      'Digit2': 1,
      'Digit3': 2,
      'Digit4': 3,
      'Digit5': 4
    };
    
    const index = typeof quickKey === 'string' && keyToIndex[quickKey] !== undefined ? keyToIndex[quickKey] : 0;
    
    // Ítems de consumible rápido en orden: [0]=poción armor, [1]=poción, [2]=café, [3]=pan, [4]=trucha
    const quickSlotIds = ['potion_armor', 'potion', 'coffee', 'bread', 'fish'];
    const id = quickSlotIds[index];
    
    // Buscar el ítem en el inventario por ID y verificar que tenga cantidad
    const item = this.inventory.items.find((it) => it && it.id === id && (it.qty || 1) > 0);
    return item || null;
  }

  _useQuickSlotConsumable(quickKey = 'KeyR') {
    const item = this._getQuickSlotConsumable(quickKey);
    if (!item) {
      this.menuSystem.showNotice('🎒 Sin consumibles rápidos en la mochila', 2.0);
      return;
    }

    if (item.id === 'potion_armor') {
      if (!this.player.hasArmor) {
        this.menuSystem.showNotice('🛡️ ¡Equipa la Armadura Binaria primero!', 2.0);
        if (this.music) this.music.playDoorLockedSound();
        return;
      }
      this.player.applyArmorPotion();
      this.inventory.consumeItem('potion_armor', 1);
      if (this.music && typeof this.music.playFanfare === 'function') {
        this.music.playFanfare();
      }
      this.menuSystem.showNotice('🛡️ Poción de Blindaje (+3 Coraza Blindada)', 2.5);
    } else if (item.id === 'coffee') {
      this.player.takeCoffee(1, 40);
      this.inventory.consumeItem('coffee', 1);
      if (this.music && typeof this.music.playHealSound === 'function') this.music.playHealSound();
      this.menuSystem.showNotice('☕ Café Compilado (+1 HP, -40% Robotización)', 2.5);
    } else if (item.id === 'hotfix') {
      this.player.hp = this.player.effectiveMaxHp;
      this.player.cureRobotization();
      this.inventory.consumeItem('hotfix', 1);
      if (this.music && typeof this.music.playHealSound === 'function') this.music.playHealSound();
      this.menuSystem.showNotice('💾 Hotfix aplicado (100% HP, 0% Robotización)', 2.5);
    } else if (item.id === 'potion') {
      this.player.speed = 92;
      this.player.hp = this.player.effectiveMaxHp;
      this.inventory.consumeItem('potion', 1);
      if (this.music && typeof this.music.playHealSound === 'function') this.music.playHealSound();
      this.menuSystem.showNotice('🧪 Poción consumida (Salud al 100%)', 2.5);
    } else if (item.id === 'bread') {
      this.player.hp = this.player.effectiveMaxHp;
      this.inventory.consumeItem('bread', 1);
      if (this.music && typeof this.music.playHealSound === 'function') this.music.playHealSound();
      this.menuSystem.showNotice('🍞 Pan Campesino consumido (Salud restaurada)', 2.5);
    } else if (item.id === 'fish') {
      this.player.hp = Math.min(this.player.effectiveMaxHp, this.player.hp + 1.5);
      this.inventory.consumeItem('fish', 1);
      if (this.music && typeof this.music.playHealSound === 'function') this.music.playHealSound();
      this.menuSystem.showNotice('🐟 Trucha consumida (+1.5 HP)', 2.5);
    } else if (item.id === 'apple') {
      this.player.hp = Math.min(this.player.effectiveMaxHp, this.player.hp + 1);
      this.inventory.consumeItem('apple', 1);
      if (this.music && typeof this.music.playHealSound === 'function') this.music.playHealSound();
      this.menuSystem.showNotice('🍎 Manzana consumida (+1 HP)', 2.5);
    } else if (item.id === 'berry_pie') {
      this.player.hp = this.player.effectiveMaxHp;
      this.player.speed = 95;
      this.inventory.consumeItem('berry_pie', 1);
      if (this.music && typeof this.music.playHealSound === 'function') this.music.playHealSound();
      this.menuSystem.showNotice('🥧 Pastel de Bayas consumido (Salud al 100%)', 2.5);
    } else if (item.id === 'ointment') {
      this.player.takeCoffee(0.5, 50);
      this.inventory.consumeItem('ointment', 1);
      if (this.music && typeof this.music.playHealSound === 'function') this.music.playHealSound();
      this.menuSystem.showNotice('🌿 Ungüento aplicado (-50% Robotización, +0.5 HP)', 2.5);
    } else if (item.id === 'spring_water') {
      this.player.hp = Math.min(this.player.effectiveMaxHp, this.player.hp + 0.5);
      this.player.takeCoffee(0, 20);
      this.inventory.consumeItem('spring_water', 1);
      if (this.music && typeof this.music.playHealSound === 'function') this.music.playHealSound();
      this.menuSystem.showNotice('💧 Agua de Manantial (+0.5 HP)', 2.5);
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

    if (action.kind === 'armor_monolith') {
      const mono = action.target;
      if (this.music && typeof this.music.playMenuSelect === 'function') {
        this.music.playMenuSelect();
      }
      this.dialogueBox.showMessage(`🏛️ [${mono.name.toUpperCase()}]`, [
        `Inscripción rúnica: [ ${mono.symbol} ]`,
        mono.clue,
        'Las cuatro baldosas de presión (A, B, C, D) deben equilibrar la paridad del sistema. Un error liberará una violenta descarga de estática (-0.5 corazón).'
      ]);
      return;
    }

    if (action.kind === 'quantum_pedestal') {
      const ped = action.target;
      if (ped.isPlaced || (this.tilemap.quantumGate && this.tilemap.quantumGate.coresPlaced[ped.id])) {
        if (this.music && typeof this.music.playMenuSelect === 'function') {
          this.music.playMenuSelect();
        }
        this.dialogueBox.showMessage(`🏛️ [${ped.name.toUpperCase()}]`, [
          'El Núcleo Cuántico ya se encuentra perfectamente engarzado en el zócalo ceremonial.',
          'Emite pulsaciones armónicas de frecuencia superconductora alimentando el portal a la Ciudadela.'
        ]);
        return;
      }

      const hasCoreFlag = Boolean(this.player.dungeonCores && this.player.dungeonCores[ped.id]);
      const hasCoreInInventory = Boolean(this.inventory && this.inventory.hasItem(ped.coreItem));

      if (hasCoreFlag || hasCoreInInventory) {
        if (this.inventory && this.inventory.hasItem(ped.coreItem)) {
          this.inventory.consumeItem(ped.coreItem, 1);
        }
        if (this.player.dungeonCores) {
          this.player.dungeonCores[ped.id] = true;
        }
        if (this.tilemap.quantumGate) {
          this.tilemap.quantumGate.coresPlaced[ped.id] = true;
        }
        this._syncGatesUnlocked();

        if (this.music && typeof this.music.playFanfare === 'function') {
          this.music.playFanfare();
        }
        if (this.animeCutscenes) {
          this.animeCutscenes.flash(ped.id === 'gc' ? '#10b981' : (ped.id === 'stack' ? '#38bdf8' : '#ef4444'), 0.35);
          this.animeCutscenes.cameraShake(4.0, 0.3);
        }
        this._saveGameToStorage();

        const placedCount = this.player.gatesUnlocked;
        if (placedCount >= 3) {
          this.dialogueBox.showMessage('⚡ ¡PUERTA DEL NÚCLEO DESBLOQUEADA!', [
            `¡Has engarzado el último núcleo en el [${ped.name}]!`,
            'Los 3 zócalos resuenan en sincronía perfecta (Verde · Cian · Carmesí).',
            '¡El cortafuegos hiperdimensional ha colapsado por completo!',
            'El portal norte conduce ahora directamente a la Ciudadela Cuántica de Mister AI Alex.'
          ]);
        } else {
          this.dialogueBox.showMessage('🏛️ [ZÓCALO ACTIVADO]', [
            `¡Has engarzado con éxito el Núcleo en el [${ped.name}]!`,
            `Progreso de la Puerta del Núcleo: [${placedCount}/3] sellos abiertos.`,
            'Consigue los núcleos restantes en las demás mazmorras para desbloquear el acceso a la Ciudadela.'
          ]);
        }
      } else {
        if (this.music && typeof this.music.playMenuSelect === 'function') {
          this.music.playMenuSelect();
        }
        this.dialogueBox.showMessage(`🏛️ [${ped.name.toUpperCase()}]`, [
          'El zócalo superconductor está apagado y frío.',
          `Necesitas recuperar el Núcleo de Mazmorra correspondiente derrotando al custodio de su recinto.`
        ]);
      }
      return;
    }

    if (action.kind === 'abyssal_portal') {
      if (this.music && typeof this.music.playAbyssalPortalSound === 'function') {
        this.music.playAbyssalPortalSound();
      }
      // Guardar posición exacta de retorno junto al portal abierto
      this.abyssalPortalOrigin = {
        sceneId: this.tilemap.currentSceneId,
        x: Math.round(this.player.x),
        y: Math.round(this.player.y)
      };
      this._executeStageTransition({
        type: 'stage_transition',
        targetScene: 'condemned_realms',
        label: 'Cruzar el Portal a los Reinos Condenados',
        spawnX: 11.5 * this.tilemap.tileSize,
        spawnY: 13.5 * this.tilemap.tileSize
      });
      return;
    }

    if (action.kind === 'abyssal_portal_exit') {
      if (this.music && typeof this.music.playAbyssalPortalSound === 'function') {
        this.music.playAbyssalPortalSound();
      }
      const retScene = this.abyssalPortalOrigin?.sceneId || this.activeAbyssalPortal?.sceneId || 'overworld';
      const retX = typeof this.abyssalPortalOrigin?.x === 'number'
        ? this.abyssalPortalOrigin.x
        : (this.activeAbyssalPortal ? this.activeAbyssalPortal.x : 14 * 16);
      const retY = typeof this.abyssalPortalOrigin?.y === 'number'
        ? this.abyssalPortalOrigin.y
        : (this.activeAbyssalPortal ? this.activeAbyssalPortal.y + 18 : 12 * 16);
      this._executeStageTransition({
        type: 'stage_transition',
        targetScene: retScene,
        label: 'Regresar por el Portal Abisal',
        spawnX: retX,
        spawnY: retY
      });
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
      if (action.target?.id) {
        this._handleSwordMonolithStrike(action.target.id);
      }
      return;
    }

    if (action.kind === 'item') {
      const item = action.target;

      // Puzles de los Templos Binarios: impedir extracción sin resolver
      if (item.id === 'dawn_armor' && (!this.tilemap.armorPuzzle?.solved || this.tilemap.armorPuzzle?.barrierActive)) {
        if (this.music) this.music.playDoorLockedSound();
        this.dialogueBox.showMessage('🏛️ [SANTUARIO DE LA ARMADURA BINARIA]', [
          'La Armadura del Código Binario reposa sobre el pedestal sagrado.',
          'Una barrera de llamas arcanas impide extraerla mientras el circuito de paridad no esté balanceado.',
          'Consulta las pistas abstractas en los 3 monolitos crípticos (Alfa, Beta, Gamma) y ajusta las 4 terminales (A, B, C, D) en el suelo.',
          '¡Ten cuidado! Cualquier combinación errónea liberará un arco de estática (-0.5 corazón).'
        ]);
        return;
      }

      if (item.id === 'dawn_sword' && !this.tilemap.swordPuzzle?.solved) {
        if (this.music) this.music.playDoorLockedSound();
        this.dialogueBox.showMessage('🏛️ [PEDESTAL DE LA ESPADA DE LA RECURSIVIDAD]', [
          'La Espada de la Recursividad está envuelta en un bucle temporal infinito.',
          'El pedestal sagrado permanecerá sellado hasta alcanzar el Caso Base de la memoria.',
          'Descifra las runas recursivas grabadas en los monolitos y sincronízalas en el orden computacional correcto.',
          'Un error desbordará la pila causando un violento Stack Overflow (-0.5 corazón).'
        ]);
        return;
      }

      const guardianBossId = CORE_CHEST_GUARDIANS[item.id];
      const guardianBoss = guardianBossId ? this.enemies.find((e) => e.id === guardianBossId) : null;
      if (guardianBoss && !guardianBoss.dead) {
        if (this.music) this.music.playDoorLockedSound();
        this.dialogueBox.showMessage('🔒 [COFRE SELLADO]', [
          `El cofre está sellado por la energía de ${guardianBoss.name}.`,
          'Derrota al guardián de esta sala para romper el sello y reclamar su núcleo.'
        ]);
        return;
      }

      // Los cofres de mazmorra entregan su contenido en su propio handler: el cofre no ocupa ranura
      const isContainerChest = item.isChest && item.id.startsWith('chest_');
      const invId = normalizeItemId(item.id);

      const added = isContainerChest || this.inventory.addItem({
        id: invId,
        name: item.name,
        description: item.description,
        iconIndex: item.iconIndex,
        qty: 1
      });
      if (added) {
        item.collected = true;
        if (this.music) {
          if (item.isChest) {
            this.music.playChestOpenSound();
          } else if (item.id !== 'dawn_armor' && item.id !== 'dawn_sword' && item.id !== 'golden_apple') {
            this.music.playItemPickupSound();
          }
        }

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
            this.questLog.advanceStep('quest_condemned_pointer', 'Abre tu mochila [I] y usa el Puntero Abisal [E] (no se gasta) para abrir tu Portal Abisal hacia los Reinos Condenados.');
          }
          this.dialogueBox.showMessage('🔮 ¡Cofre Arcano: Puntero al Abismo!', [
            '¡Has abierto el Cofre Arcano y obtenido el [Puntero al Abismo (Null Pointer)]!',
            'Esta reliquia NO se gasta: abre tu mochila con [I] y úsala con [E] cuantas veces quieras para abrir un Portal Abisal permanente (estilo Diablo) y entrar o salir de los Reinos Condenados.'
          ]);
        } else if (item.id === 'golden_apple') {
          this.menuSystem.startRelicFoundCutscene(() => {
            this.menuSystem.state = 'none';
            this.dialogueBox.showMessage('⚡ ¡Reliquia Divina Consagrada!', [
              '¡Has abierto el cofre ancestral en casa del Sabio Aurelio y obtenido [El Microondas Little (Reliquia Divina)]!',
              'El Sabio Aurelio te contempla con solemne devoción y te advierte:',
              '«¡Por el compilador sagrado! Estás ante una auténtica RELIQUIA DIVINA forjada antes del Gran Colapso del Código.',
              'Esta versión mini no posee despertador cósmico, pero es capaz de recalentar tu salud al 100% y estabilizar tus variables en O(1).',
              '¡Empúñala y úsala con supremo cuidado! Las fuerzas cuánticas son inmensas y exigen la máxima templanza en tu misión hacia El Ojete Dorado.»'
            ]);
          });
        } else if (item.id === 'chest_nucleo_stack') {
          // ==================== COFRE: NÚCLEO STACK ====================
          this._openCoreChest({
            coreKey: 'stack',
            abilityKey: 'hasChargedAttack',
            abilityName: 'Corte en Cascada (Caso Base)',
            itemId: 'dungeon_core_stack',
            itemName: 'Núcleo Stack Overflow',
            description: 'Núcleo de energía del Guardián del Stack Overflow. Requerido para la Puerta Cuántica.',
            iconIndex: ITEM_ICONS.DUNGEON_CORE_STACK,
            title: '📦 ¡Cofre Abierto! · Núcleo Stack'
          });
        } else if (item.id === 'chest_nucleo_gc') {
          // ==================== COFRE: NÚCLEO GC ====================
          this._openCoreChest({
            coreKey: 'gc',
            abilityKey: 'hasDash',
            abilityName: 'Dash Asíncrono',
            itemId: 'dungeon_core_gc',
            itemName: 'Núcleo Garbage Collector',
            description: 'Núcleo de energía del Garbage Collector Furioso. Requerido para la Puerta Cuántica.',
            iconIndex: ITEM_ICONS.DUNGEON_CORE_GC,
            title: '📦 ¡Cofre Abierto! · Núcleo GC'
          });
        } else if (item.id === 'chest_nucleo_microwave') {
          // ==================== COFRE: NÚCLEO MICROWAVE ====================
          this._openCoreChest({
            coreKey: 'microwave',
            abilityKey: 'hasBarrier',
            abilityName: 'Barrera TypeScript',
            itemId: 'dungeon_core_microwave',
            itemName: 'Núcleo Microondas Prototipo',
            description: 'Núcleo de energía del Microondas Prototipo. Requerido para la Puerta Cuántica.',
            iconIndex: ITEM_ICONS.DUNGEON_CORE_MICROWAVE,
            title: '📦 ¡Cofre Abierto! · Núcleo Microondas'
          });
        } else if (item.id === 'chest_magnetron') {
          // ==================== COFRE: MAGNETRÓN ====================
          this.inventory.addItem({
            id: 'microwave_magnetron',
            name: 'Magnetrón Cuántico',
            description: 'Componente para forjar la Espada Overclockeada (Nivel 3). Entregárselo al Herrero Brom.',
            iconIndex: ITEM_ICONS.MICROWAVE_MAGNETRON,
            qty: 1
          }, { ignoreSlotLimit: true });
          this._saveGameToStorage();
          this.dialogueBox.showMessage('📦 ¡Cofre Abierto! · Magnetrón', [
            'Has abierto el cofre y encontrado el [Magnetrón Cuántico].',
            '• Componente esencial para la Espada Tier 3 (Overclockeada).',
            '• Llévaselo al Herrero Brom en Valleverde para forjar tu espada al nivel máximo.',
            '• Con el Magnetrón y suficiente silicio, Brom podrá mejorar tu espada.'
          ]);
        } else {
          this.dialogueBox.showMessage(item.isChest ? '📦 ¡Cofre Abierto!' : 'Objeto Obtenido', [
            item.isChest
              ? `Has abierto el cofre y encontrado [${item.name}].`
              : `Has guardado [${item.name}] en tu inventario.`,
            item.description
          ]);
        }
      } else {
        if (this.music) this.music.playDoorLockedSound();
        this.dialogueBox.showMessage('Mochila Llena', [
          'No tienes espacio libre en el inventario.'
        ]);
      }
    } else if (action.kind === 'bed') {
      this._openBedSleepMenu();
    } else if (action.kind === 'door') {
      const door = action.target;
      this.player.stopMovement();

      if (door.type === 'enter') {
        const isDay = this.dayNight.timeOfDayHours >= 6 && this.dayNight.timeOfDayHours < 22;
        if (door.targetScene !== 'player_house') {
          const hasPerm = Boolean(this.housePermissions[door.targetScene]);
          if (!hasPerm) {
            if (this.music && typeof this.music.playDoorLockedSound === 'function') {
              this.music.playDoorLockedSound();
            }
            if (isDay) {
              this.dialogueBox.showMessage('Cerrado con Cerrojo', [
                'Cerrado. Su dueño está atendiendo su puesto en la plaza.',
                'Habla con su propietario en el pueblo si necesitas autorización para acceder.'
              ]);
            } else {
              this.dialogueBox.showMessage('Cerrado con Cerrojo', [
                'La puerta está cerrada por dentro con pestillo nocturno.',
                'Necesitas autorización expresa de su dueño para entrar.'
              ]);
            }
            return;
          }
        }
      }

      if (door.type === 'bridge_gate') {
        if (this.music) this.music.playDoorLockedSound();
        this.dialogueBox.showMessage('Puente del Este · Precintado', [
          'El paso hacia las Tierras Sagradas del este está bloqueado por una sólida barrera de madera.',
          'Los Guardias del Binario custodian el acceso e impiden el paso.',
          'Habla con los guardias o visita al Gran Sabio Aurelio en su casa (al noroeste, tejado azul) para conocer la causa del cierre y obtener autorización.'
        ]);
        return;
      }

      if (door.type === 'stage_locked') {
        if (this.music) this.music.playDoorLockedSound();
        this.dialogueBox.showMessage('Portal Sagrado Sellado', [
          'El Portal hacia Valleverde permanece cerrado por un sello protector del Alba.',
          'Debes equiparte primero con la [Armadura del Alba] (Oeste) y la [Espada del Alba] (Norte) para poder hacer frente a las tinieblas de Mister AI Alex.'
        ]);
        return;
      }

      if (door.type === 'stage_transition') {
        // 1. GATEKEEPING: las reglas viven en DoorGatekeeper
        const block = getDoorBlock(door.targetScene, this.player);
        if (block) {
          if (this.music) this.music.playDoorLockedSound();
          // Empujar al jugador exactamente 1 tile hacia atrás (opuesto al intento de cruce)
          pushBackPlayer(this.player, this.player.direction || 'down');
          this.dialogueBox.showMessage(block.title, block.lines);
          return;
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
              }
            }
          ]);
          return;
        }

        // Transición directa y fluida estilo Zelda: sin modales de confirmación redundantes
        this.dialogueBox.close();
        if (door.targetScene === 'first_stage' && !this.seenAIWarning) {
          this.seenAIWarning = true;
          this.animeCutscenes.playCutscene(SCENE_AI_ALEX_WARNING, () => {
            this._executeStageTransition(door);
          });
        } else {
          this._executeStageTransition(door);
        }
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
        '¡La pila de recursión ha alcanzado el Caso Base y resuelto todas las llamadas!',
        'El bucle infinito de la pila ha sido neutralizado con éxito.',
        '¡El portal septentrional hacia la arena del Guardián del Stack Overflow se ha abierto!'
      ]);
    } else if (res.success && !res.finished) {
      if (this.music && typeof this.music.playMenuSelect === 'function') {
        this.music.playMenuSelect();
      }
      this.menuSystem.showNotice(
        `✨ Runa activada: paso recursivo (${res.step}/3)`,
        2.5
      );
    } else if (!res.success && res.error === 'STACK_OVERFLOW') {
      if (this.music && typeof this.music.playPlayerHurt === 'function') {
        this.music.playPlayerHurt();
      }
      if (this.animeCutscenes) {
        this.animeCutscenes.cameraShake(6.5, 0.45);
        this.animeCutscenes.flash('#ef4444', 0.4);
      }
      this.player.takeDamage(1, this.music);
      this.menuSystem.showNotice('🌀 Stack Overflow: ¡Desbordamiento de pila! (-0.5 corazón)', 2.5);
      this.dialogueBox.showMessage('🌀 [STACK OVERFLOW: DESBORDAMIENTO]', [
        '¡Desbordamiento de pila crítico en la memoria!',
        'La llamada recursiva violó el orden computacional hacia el caso base.',
        'El choque desestabilizó tu energía vital (-0.5 corazón) y la memoria se ha restablecido a la raíz.',
        'Consulta las inscripciones en las runas para deducir el orden del flujo recursivo.'
      ]);
    }
  }

  _checkCrystalBarrierCollisions() {
    const scene = this.tilemap?.scenes?.[this.tilemap.currentSceneId];
    if (!scene || !scene.layers || !scene.layers.decoration) return;
    const deco = scene.layers.decoration;
    const colGrid = scene.layers.collision;
    const tileSize = this.tilemap.tileSize;

    const attackBoxes = [];
    if (this.player.isAttacking) {
      const swordBox = this.player.getSwordHitbox();
      if (swordBox) attackBoxes.push({ box: swordBox, fromSlash: false });
    }
    if (this.player.energySlashes && this.player.energySlashes.length > 0) {
      for (const slash of this.player.energySlashes) {
        if (!slash.active) continue;
        attackBoxes.push({
          box: {
            x: slash.x - slash.width / 2,
            y: slash.y - slash.height / 2,
            width: slash.width,
            height: slash.height
          },
          slashRef: slash,
          fromSlash: true
        });
      }
    }

    if (attackBoxes.length === 0) return;

    for (const atk of attackBoxes) {
      const minCol = Math.max(0, Math.floor(atk.box.x / tileSize));
      const maxCol = Math.min(scene.cols - 1, Math.floor((atk.box.x + atk.box.width) / tileSize));
      const minRow = Math.max(0, Math.floor(atk.box.y / tileSize));
      const maxRow = Math.min(scene.rows - 1, Math.floor((atk.box.y + atk.box.height) / tileSize));

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          if (deco[r] && deco[r][c] === TILES.CRYSTAL_BARRIER) {
            if (this.player.swordLevel >= 2) {
              deco[r][c] = -1;
              if (colGrid && colGrid[r]) colGrid[r][c] = 0;
              if (atk.slashRef) atk.slashRef.active = false;

              if (this.music && typeof this.music.playHitSound === 'function') {
                this.music.playHitSound();
              }
              if (this.animeCutscenes) {
                this.animeCutscenes.flash('#a855f7', 0.2);
                this.animeCutscenes.cameraShake(3.0, 0.2);
              }
              this.worldItems.push(
                new WorldItem({
                  id: `silicon_ore_crystal_${c}_${r}_${Date.now()}`,
                  name: 'Mineral de Silicio',
                  description: 'Veta pura de silicio extraída al quebrar el cristal de la mina.',
                  iconIndex: ITEM_ICONS.SILICON_ORE,
                  x: c * tileSize + 2,
                  y: r * tileSize + 2,
                  sceneId: this.tilemap.currentSceneId,
                  itemsSheet: this.assets.itemsSheet
                })
              );
              if (this.menuSystem) {
                this.menuSystem.showNotice('💎 ¡Barrera de cristal quebrada! +1 Mineral de Silicio', 2.5);
              }
            } else {
              if (atk.slashRef) atk.slashRef.active = false;
              if (this.menuSystem && (!this._lastBarrierNotice || Date.now() - this._lastBarrierNotice > 2500)) {
                this._lastBarrierNotice = Date.now();
                this.menuSystem.showNotice('🛡️ El cristal resiste tu golpe. Se requiere la [Espada de Silicio (Nivel 2)] de Brom.', 2.5);
                if (this.music && typeof this.music.playMenuSelect === 'function') {
                  this.music.playMenuSelect();
                }
              }
            }
          }
        }
      }
    }
  }

  _checkEnvironmentalHazards(dt) {
    const sceneId = this.tilemap?.currentSceneId;
    if (sceneId === 'forge_entry' || sceneId === 'forge_puzzle') {
      if (this.player.armorLevel < 2) {
        this.forgeHeatTimer = (this.forgeHeatTimer || 0) + dt;
        if (this.forgeHeatTimer >= 3.0) {
          this.forgeHeatTimer = 0;
          if (this.player.invulnTimer <= 0 && this.player.hp > 0) {
            this.player.takeDamage(1, this.music);
            if (this.animeCutscenes) {
              this.animeCutscenes.flash('#f97316', 0.25);
              this.animeCutscenes.cameraShake(2.5, 0.2);
            }
            if (this.menuSystem && (!this._lastHeatNotice || Date.now() - this._lastHeatNotice > 3500)) {
              this._lastHeatNotice = Date.now();
              this.menuSystem.showNotice('🔥 ¡CALOR EXTREMO! Radiación térmica (-0.5❤). ¡Necesitas Blindaje Térmico (Nivel 2)!', 3.0);
            }
          }
        }
      } else {
        this.forgeHeatTimer = 0;
      }
    } else {
      this.forgeHeatTimer = 0;
    }
  }

  _executeStageTransition(door) {
    this.transitionCooldown = 0.5;
    if (this.music) {
      if (door.targetScene === 'condemned_realms' || this.tilemap.currentSceneId === 'condemned_realms') {
        if (typeof this.music.playAbyssalPortalSound === 'function') {
          this.music.playAbyssalPortalSound();
        }
      } else if (typeof this.music.playDoorOpenSound === 'function') {
        this.music.playDoorOpenSound();
      }
    }
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
    for (const en of this.enemies) {
      if (en.respawnOnEnter && en.dead && en.sceneId === door.targetScene) {
        en.reset();
      }
    }
    this.camera.setWorldBounds(this.tilemap.width, this.tilemap.height);
    this.player.x = door.spawnX;
    this.player.y = door.spawnY;
    // PRESERVAR DIRECCIÓN DE ENTRADA: si el jugador entra por la derecha, sigue mirando a la derecha.
    // Solo se sobrescribe la dirección si la puerta especifica una dirección de entrada forzada
    // (por ejemplo, al entrar en una casa por una puerta, se mira hacia adentro).
    if (door.forceDirection) {
      this.player.direction = door.forceDirection;
    }
    // Si no hay forceDirection, se mantiene la dirección actual del jugador (no se sobrescribe).
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
      this._handleHouseOwnerConfrontation(door.targetScene);
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

  _computePlayerFinalTitle() {
    const hasAll = Boolean(this.player.hasDash && this.player.hasChargedAttack && this.player.hasBarrier);
    const j = this.totalJailVisits || 0;
    if (hasAll && j === 0) return 'Senior Lead Architect del Gran Ojal';
    if (hasAll && j <= 2) return 'Staff Full-Stack Bug Hunter';
    if (j >= 3) return 'Hacker Prófugo del Calabozo Municipal';
    if (hasAll) return 'Senior Developer de Valleverde';
    return 'Junior Dev Superviviente del Despido';
  }

  _triggerVictorySequence() {
    // 1. Congelar la sala y detener música de combate
    if (this.music && typeof this.music.stopBossMusic === 'function') {
      this.music.stopBossMusic(false);
    }

    // 2. Resumen del Expediente del Jugador y Cálculo de Puntuación
    const scoreResult = calculateGameScore(this.totalPlayTimeSeconds, this.totalDeaths);
    const record = {
      playTimeSeconds: Math.round(this.totalPlayTimeSeconds || 0),
      playTimeFormatted: scoreResult.timeFormatted,
      deaths: this.totalDeaths || 0,
      score: scoreResult.score,
      rank: scoreResult.rank,
      breakdown: scoreResult.breakdown,
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
          this._openScoreSubmissionModal(record, () => {
            this._resetWorldToInitialState();
            this.menuSystem.openLeaderboardScreen('title');
          });
        });
      });
    }
  }

  _openScoreSubmissionModal(record, onDone) {
    if (typeof document === 'undefined') {
      if (typeof onDone === 'function') onDone();
      return;
    }

    const modal = document.getElementById('score-submission-modal');
    if (!modal) {
      if (typeof onDone === 'function') onDone();
      return;
    }

    const badgeEl = document.getElementById('score-modal-rank-badge');
    const titleEl = document.getElementById('score-modal-title');
    const timeEl = document.getElementById('score-modal-time');
    const deathsEl = document.getElementById('score-modal-deaths');
    const scoreEl = document.getElementById('score-modal-score');
    const formEl = document.getElementById('score-form');
    const inputEl = document.getElementById('score-nickname-input');
    const skipBtn = document.getElementById('score-skip-btn');

    const rank = record && record.rank ? record.rank : 'C';
    if (badgeEl) {
      badgeEl.textContent = `★ RANGO ${rank} ★`;
      badgeEl.className = `score-rank-badge rank-${rank.toLowerCase()}`;
    }
    if (titleEl) {
      titleEl.textContent = (record && record.title) || 'Campeón de Valleverde';
    }
    if (timeEl) {
      timeEl.textContent = (record && record.playTimeFormatted) || '00:00';
    }
    if (deathsEl) {
      deathsEl.textContent = String((record && record.deaths) || 0);
    }
    if (scoreEl) {
      const scoreVal = (record && typeof record.score === 'number') ? record.score : 0;
      scoreEl.textContent = `${scoreVal.toLocaleString('es-ES')} PTS`;
    }

    let defaultNick = 'HERO';
    try {
      defaultNick = localStorage.getItem('el_ojete_last_nickname') || 'HERO';
    } catch (_) {}

    if (inputEl) {
      inputEl.value = defaultNick;
    }

    modal.classList.remove('hidden');
    if (inputEl) {
      setTimeout(() => {
        try { inputEl.focus(); inputEl.select(); } catch (_) {}
      }, 60);
    }

    const cleanup = () => {
      modal.classList.add('hidden');
      if (formEl) formEl.onsubmit = null;
      if (skipBtn) skipBtn.onclick = null;
    };

    // Enviar y omitir pueden coincidir mientras la petición está en vuelo: cerrar una sola vez
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      cleanup();
      if (typeof onDone === 'function') onDone();
    };

    if (formEl) {
      formEl.onsubmit = (e) => {
        e.preventDefault();
        formEl.onsubmit = (ev) => ev.preventDefault();
        const raw = inputEl ? inputEl.value : '';
        const sanitized = raw.trim().toUpperCase().replace(/[^A-Z0-9_\-\.]/g, '').slice(0, 12) || 'ANÓNIMO';
        try {
          localStorage.setItem('el_ojete_last_nickname', sanitized);
        } catch (_) {}

        submitGlobalScore({
          name: sanitized,
          rank: rank,
          score: record && record.score != null ? record.score : 0,
          playTimeSeconds: (record && record.playTimeSeconds) || 0,
          timeFormatted: (record && record.playTimeFormatted) || '00:00',
          deaths: (record && record.deaths) || 0,
          coins: (record && record.coins) || 0
        }).finally(finish);
      };
    }

    if (skipBtn) {
      skipBtn.onclick = finish;
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
    this._updateNPCSchedules();
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
      const canToggleMap = this.menuSystem.state === 'none' || this.menuSystem.state === 'pause';
      if (this.menuSystem.state === 'world_map') {
        this.menuSystem.closeWorldMap();
      } else if (canToggleMap && !this.dialogueBox.active && !this.inventory.isOpen && !this.characterStats.isOpen && (!this.questLogView || !this.questLogView.isOpen)) {
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
    this.menuSystem.updateNotice(dt);

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

    // Ranura Rápida de Consumibles [1-5] (y [R] mientras no se haya aprendido el console.log arrojadizo)
    const quickSlotReady =
      !this.dialogueBox.active &&
      this.menuSystem.state === 'none' &&
      !this.inventory.isOpen &&
      !this.characterStats.isOpen &&
      (!this.questLogView || !this.questLogView.isOpen);
    if (quickSlotReady) {
      const quickKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
      if (!this.player.skills?.log) quickKeys.unshift('KeyR');
      const quickKey = quickKeys.find((k) => this.input.consumeKey(k));
      if (quickKey) {
        this._useQuickSlotConsumable(quickKey);
      }
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
      if (this.characterStats.handleInput(this.input, this.player)) {
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
        if ('pointerAttackJustPressed' in this.input) {
          this.input.pointerAttackJustPressed = false;
        }
      }
    }

    // [E]/[Enter] siempre interactúan; [Espacio] solo si hay diálogo o algo con lo que interactuar (si no, ataca)
    const interactPressed = this.input.consumeInteraction({ includeSpace: false });
    if (this.dialogueBox.active) {
      if (interactPressed || this.input.consumeKey('Space')) {
        this.dialogueBox.advance();
      }
    } else if (interactPressed) {
      this._executeInteraction(this._findBestInteraction());
    } else if (this.input.isKeyJustPressed('Space')) {
      const bestAction = this._findBestInteraction();
      if (bestAction) {
        this.input.consumeKey('Space');
        this._executeInteraction(bestAction);
      }
    }

    // Ataque con la Espada del Alba ([Clic Izquierdo], [Espacio], [F], [J], [K])
    if (!this.dialogueBox.active && this.input.consumeAttack()) {
      if (
        this.input.lastAttackSource === 'pointer' &&
        this.camera &&
        this.input.pointerX >= 0 &&
        this.input.pointerY >= 0
      ) {
        const screenPx = this.player.centerX - this.camera.renderX;
        const screenPy = this.player.centerY - this.camera.renderY;
        const dx = this.input.pointerX - screenPx;
        const dy = this.input.pointerY - screenPy;
        if (Math.hypot(dx, dy) >= 4) {
          if (Math.abs(dx) > Math.abs(dy)) {
            this.player.direction = dx > 0 ? 'right' : 'left';
          } else {
            this.player.direction = dy > 0 ? 'down' : 'up';
          }
        }
      }
      if (this.player.tryAttack()) {
        this.music.playSwordSlash();
      }
    }

    if (this.input.consumeKey('F3')) {
      this.debugMode = !this.debugMode;
    }
    this.sceneSurvivalTimer = (this.sceneSurvivalTimer || 0) + dt;
    if (this.sceneSurvivalTimer > 90 && this.deathsByScene && this.deathsByScene[this.tilemap.currentSceneId]) {
      this.deathsByScene[this.tilemap.currentSceneId] = 0;
    }

    const prevHour = this.dayNight.timeOfDayHours;
    this.dayNight.update(dt);
    this.tilemap.update(dt, this.dayNight.timeOfDayHours);
    if (this.renderPipeline) {
      this.renderPipeline.update(dt);
    }
    if (Math.floor(prevHour) !== Math.floor(this.dayNight.timeOfDayHours)) {
      this._updateNPCSchedules();
    }

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
            if (res.shock) {
              if (this.music && typeof this.music.playPlayerHurt === 'function') {
                this.music.playPlayerHurt();
              }
              if (this.animeCutscenes) {
                this.animeCutscenes.flash('#38bdf8', 0.35);
                this.animeCutscenes.cameraShake(5.5, 0.35);
              }
              this.player.takeDamage(1, this.music);
              this.menuSystem.showNotice(res.message || '⚡ ¡Cortocircuito de Paridad! (-0.5 corazón)', 2.5);
            } else if (res.justSolved) {
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
              this.dialogueBox.showMessage('⚡ [CIRCUITO DE PARIDAD ESTABILIZADO]', [
                '¡PARIDAD ARMÓNICA ALCANZADA! Las compuertas resuenan en perfecta sintonía.',
                'La barrera de fuego ha colapsado y el pedestal sagrado ha sido liberado.',
                '¡Ya puedes recoger la Armadura del Código Binario!'
              ]);
            } else {
              if (this.music && typeof this.music.playMenuSelect === 'function') {
                this.music.playMenuSelect();
              }
              const letter = steppedKey.replace('SWITCH_', '');
              const activeCount = Object.values(this.tilemap.armorPuzzle.switches).reduce((acc, v) => acc + (v || 0), 0);
              this.menuSystem.showNotice(
                `Terminal [${letter}] = ${this.tilemap.armorPuzzle.switches[letter]} · Compuertas activas: ${activeCount}/2`,
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

    // Detección de impacto de ataques y tajos de energía contra Barreras de Cristal
    this._checkCrystalBarrierCollisions();

    // Daño ambiental por calor extremo en la Forja si falta el Blindaje Térmico
    this._checkEnvironmentalHazards(dt);

    if (this.transitionCooldown > 0) {
      this.transitionCooldown -= dt;
    }

    // Detección automática al caminar hacia los límites de escena y caminos cardinales (estilo Zelda)
    if (
      (!this.animeCutscenes || !this.animeCutscenes.isActive) &&
      !this.dialogueBox.active &&
      !this.inventory.isOpen &&
      !this.characterStats.isOpen &&
      this.transitionCooldown <= 0
    ) {
      if (this.tilemap.currentSceneId === 'overworld') {
        const atWest = this.player.x <= 1.5 * this.tilemap.tileSize && this.player.y >= 10.5 * this.tilemap.tileSize && this.player.y <= 14.5 * this.tilemap.tileSize;
        const atEast = this.player.x >= 32.5 * this.tilemap.tileSize && this.player.y >= 11 * this.tilemap.tileSize && this.player.y <= 14 * this.tilemap.tileSize;
        const atNorth = this.player.y <= 1.2 * this.tilemap.tileSize && this.player.x >= 15.5 * this.tilemap.tileSize && this.player.x <= 19.5 * this.tilemap.tileSize;
        const atSouth = this.player.y >= 22.5 * this.tilemap.tileSize && this.player.x >= 15.5 * this.tilemap.tileSize && this.player.x <= 19.5 * this.tilemap.tileSize;

        if (atWest || atEast || atNorth || atSouth) {
          const door = this.tilemap.findNearbyDoor(this.player);
          if (door && door.type === 'stage_transition') {
            this._executeInteraction({ kind: 'door', target: door });
          }
        }
      } else if (['first_stage', 'north_peaks', 'south_swamp', 'west_wastes'].includes(this.tilemap.currentSceneId)) {
        const door = this.tilemap.findNearbyDoor(this.player);
        if (door && door.type === 'stage_transition' && door.targetScene === 'overworld') {
          const dist = Math.hypot(this.player.centerX - door.worldX, this.player.centerY - door.worldY);
          if (dist <= 20) {
            this._executeInteraction({ kind: 'door', target: door });
          }
        }
      }
    }

    // Animación continua del Portal Abisal (se activa pulsando [E], sin bucle de auto-absorción)
    this.condemnedPortalTimer = (this.condemnedPortalTimer || 0) + dt;
    if (this.activeAbyssalPortal) {
      this.activeAbyssalPortal.timer = (this.activeAbyssalPortal.timer || 0) + dt;
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

    // Contexto de IA compartido: lista de aliados (alarmas) y turnos de ataque simultáneos
    if (this.player.hp > 0) this._deathRegistered = false;
    const aiContext = { enemies, attackers: new Set() };
    const difficultyScale = this._getDifficultyScale();

    for (const enemy of enemies) {
      enemy.speedScale = enemy.isBoss ? 1 : difficultyScale;
      enemy.update(
        dt,
        this.tilemap,
        this.player,
        this.dialogueBox.active,
        this.music,
        aiContext
      );

      // Puntos de habilidad y experiencia por enemigos derrotados
      if (enemy.dead && !enemy.xpGranted) {
        enemy.xpGranted = true;
        const prevLevel = this.player.level;
        const gained = this.player.awardKill(Boolean(enemy.isBoss), enemy.xpReward);
        if (this.player.level > prevLevel) {
          if (this.music && typeof this.music.playFanfare === 'function') {
            this.music.playFanfare();
          }
          if (this.menuSystem) {
            this.menuSystem.showNotice(`🎉 ¡SUBIDA DE NIVEL! ★ NIVEL ${this.player.level} ★ (Salud y Energía al 100%)`, 4.0);
          }
        } else if (gained > 0 && this.menuSystem) {
          this.menuSystem.showNotice(`⭐ +${gained} punto${gained > 1 ? 's' : ''} de habilidad [C → Habilidades]`, 3);
        }
      }

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
          if (this.player.dungeonCores) {
            this.player.dungeonCores.gc = true;
          }
          this._grantBossLoot([
            {
              id: 'dungeon_core_gc',
              name: 'Núcleo del Colector',
              description: 'Núcleo cuántico purgado de las Cloacas del Legacy. Clave para la Puerta del Núcleo.',
              iconIndex: ITEM_ICONS.DUNGEON_CORE_GC,
              qty: 1
            }
          ]);
          if (this.menuSystem) {
            this.menuSystem.showNotice('⚡ ¡Has obtenido el [Núcleo del Colector]!', 3.5);
          }
        } else if (enemy.id === 'boss_stack_overflow') {
          if (this.questLog) {
            this.questLog.completeQuest('quest_boss_stack', '¡Guardián del Stack Overflow abatido! Corte en Cascada desbloqueado.');
          }
          if (this.achievementManager) {
            this.achievementManager.unlock('ach_boss_stack');
          }
          if (this.player.dungeonCores) {
            this.player.dungeonCores.stack = true;
          }
          this._grantBossLoot([
            {
              id: 'dungeon_core_stack',
              name: 'Núcleo del Stack',
              description: 'Núcleo cuántico de las Minas de la Recursión. Clave para la Puerta del Núcleo.',
              iconIndex: ITEM_ICONS.DUNGEON_CORE_STACK,
              qty: 1
            },
            {
              id: 'silicon_ore',
              name: 'Mineral de Silicio',
              description: 'Veta pura de silicio cristalino. Llévasela a Brom para forjar la Espada de Silicio (Nivel 2).',
              iconIndex: ITEM_ICONS.SILICON_ORE,
              qty: 3
            }
          ]);
          if (this.menuSystem) {
            this.menuSystem.showNotice('💎 ¡Has obtenido el [Núcleo del Stack] y 3x [Mineral de Silicio]!', 3.5);
          }
        } else if (enemy.id === 'boss_prototype_microwave') {
          if (this.questLog) {
            this.questLog.completeQuest('quest_boss_microwave', '¡Prototipo del Microondas destruido! Barrera TypeScript desbloqueada.');
          }
          if (this.achievementManager) {
            this.achievementManager.unlock('ach_boss_microwave');
          }
          if (this.player.dungeonCores) {
            this.player.dungeonCores.microwave = true;
          }
          this._grantBossLoot([
            {
              id: 'dungeon_core_microwave',
              name: 'Núcleo del Microondas',
              description: 'Núcleo cuántico de la Forja del Prototipo. Clave para la Puerta del Núcleo.',
              iconIndex: ITEM_ICONS.DUNGEON_CORE_MICROWAVE,
              qty: 1
            },
            {
              id: 'microwave_magnetron',
              name: 'Magnetrón Cuántico',
              description: 'Emisor de microondas de alta frecuencia. Llévaselo a Brom para overclockear la Espada (Nivel 3).',
              iconIndex: ITEM_ICONS.MICROWAVE_MAGNETRON,
              qty: 1
            }
          ]);
          if (this.menuSystem) {
            this.menuSystem.showNotice('🔥 ¡Has obtenido el [Núcleo del Microondas] y el [Magnetrón Cuántico]!', 3.5);
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

      // Soltar 2 a 5 Bytes con dispersión física al morir esbirros y drones
      if (!enemy.isBoss && enemy.dead && !enemy.coinsDropped) {
        enemy.coinsDropped = true;
        const count = Math.floor(Math.random() * 4) + 2;
        for (let i = 0; i < count; i++) {
          this.droppedCoins.push({
            x: enemy.centerX,
            y: enemy.centerY,
            vx: (Math.random() - 0.5) * 60,
            vy: -40 - Math.random() * 30,
            groundY: enemy.centerY + (Math.random() - 0.5) * 10,
            sceneId: enemy.sceneId,
            life: 25,
            value: 1
          });
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

      // Reaparición automática periódica de los muñecos de práctica en el Campo de Entrenamiento de Valleverde
      if (enemy.dead && enemy.id && enemy.id.startsWith('drone_training')) {
        enemy.trainingRespawnTimer = (enemy.trainingRespawnTimer || 0) + dt;
        if (enemy.trainingRespawnTimer >= 8.0) {
          enemy.dead = false;
          enemy.hp = enemy.maxHp;
          enemy.xpGranted = false;
          enemy.lootDropped = false;
          enemy.coinsDropped = false;
          enemy.trainingRespawnTimer = 0;
          const orig = enemy.patrolPoints?.[0];
          enemy.x = orig ? orig.x : 23 * 16;
          enemy.y = orig ? orig.y : 20 * 16;
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
        this._triggerVictorySequence();
      }
    }
    for (const item of items) {
      item.update(dt);
    }

    // Actualizar física y recogida de Bytes soltados
    for (let i = this.droppedCoins.length - 1; i >= 0; i--) {
      const coin = this.droppedCoins[i];
      if (coin.sceneId !== this.tilemap.currentSceneId) continue;
      coin.life -= dt;
      if (coin.life <= 0) {
        this.droppedCoins.splice(i, 1);
        continue;
      }
      coin.vy += 160 * dt;
      coin.x += coin.vx * dt;
      coin.y += coin.vy * dt;
      if (coin.y >= coin.groundY) {
        coin.y = coin.groundY;
        coin.vy = -coin.vy * 0.55;
        coin.vx *= 0.7;
        if (Math.abs(coin.vy) < 5) coin.vy = 0;
      }

      const dist = Math.hypot(this.player.centerX - coin.x, this.player.centerY - coin.y);
      if (dist <= 14) {
        this.player.coins += coin.value;
        if (this.music && typeof this.music.playMenuSelect === 'function') {
          this.music.playMenuSelect();
        }
        if (this.menuSystem) {
          this.menuSystem.showNotice(`🪙 +${coin.value} Byte (${this.player.coins} 🪙)`, 1.5);
        }
        this.droppedCoins.splice(i, 1);
      }
    }

    if (this.player.hp <= 0) {
      for (const en of this.enemies) {
        if (en.isBoss && !en.dead && typeof en.resetCombatState === 'function') {
          en.resetCombatState();
        }
      }
      this._registerPlayerDeath();
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

  /**
   * Dificultad adaptativa: cada muerte seguida en la misma zona reduce un 8% la velocidad
   * de los enemigos normales (mínimo 72%). Se restablece al sobrevivir 90 s en la zona.
   */
  _getDifficultyScale() {
    const deaths = (this.deathsByScene && this.deathsByScene[this.tilemap.currentSceneId]) || 0;
    return Math.max(0.72, 1 - 0.08 * deaths);
  }

  _registerPlayerDeath() {
    if (this._deathRegistered) return;
    this._deathRegistered = true;
    if (!this.deathsByScene) this.deathsByScene = {};
    const sceneId = this.tilemap.currentSceneId;
    this.deathsByScene[sceneId] = (this.deathsByScene[sceneId] || 0) + 1;
    this.totalDeaths = (this.totalDeaths || 0) + 1;
    this.sceneSurvivalTimer = 0;
  }

  /** Entrega el botín de un jefe directamente a la mochila y guarda para que no se pierda al recargar. */
  _grantBossLoot(items) {
    for (const item of items) {
      this.inventory.addItem(item, { ignoreSlotLimit: true });
    }
    this._saveGameToStorage();
  }

  /** Única fuente de verdad del acceso a la Ciudadela: los núcleos realmente engarzados en la Puerta. */
  _countPlacedCores() {
    const placed = this.tilemap.quantumGate?.coresPlaced || {};
    return ['gc', 'stack', 'microwave'].filter((k) => Boolean(placed[k])).length;
  }

  _syncGatesUnlocked() {
    this.player.gatesUnlocked = this._countPlacedCores();
  }

  _openCoreChest({ coreKey, abilityKey, abilityName, itemId, itemName, description, iconIndex, title }) {
    this.player.dungeonCores[coreKey] = true;
    this.player[abilityKey] = true;
    const alreadyPlaced = Boolean(this.tilemap.quantumGate?.coresPlaced?.[coreKey]);
    if (!alreadyPlaced && !this.inventory.hasItem(itemId)) {
      this.inventory.addItem({ id: itemId, name: itemName, description, iconIndex, qty: 1 }, { ignoreSlotLimit: true });
    }
    this._saveGameToStorage();
    this.dialogueBox.showMessage(title, [
      `Has abierto el cofre del guardián: [${itemName}].`,
      `• Habilidad consagrada: [${abilityName}]`,
      '• Engarza el núcleo en su zócalo de la Puerta Cuántica (Páramo Oeste).',
      `• Núcleos colocados: ${this._countPlacedCores()}/3`
    ]);
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

    const { npcs, animals, enemies, items } = this._getActiveSceneEntities();

    this.renderPipeline.render(ctx, {
      tilemap: this.tilemap,
      camera: this.camera,
      dayNight: this.dayNight,
      player: this.player,
      npcs,
      animals,
      enemies,
      onGround: (gctx) => {
        // Portal Abisal en el suelo (Capa 0)
        if (this.activeAbyssalPortal && this.activeAbyssalPortal.sceneId === this.tilemap.currentSceneId) {
          this._renderAbyssalPortal(gctx, this.activeAbyssalPortal);
        } else if (this.tilemap.currentSceneId === 'condemned_realms') {
          this._renderAbyssalPortal(gctx, {
            x: Math.round(11.5 * 16 - 10),
            y: Math.round(15.2 * 16 - 10),
            timer: this.condemnedPortalTimer || 0
          });
        }

        // Objetos recolectables y cofres
        const isNight = this._isNightTime();
        for (const item of items) {
          item.render(gctx, this.camera, isNight);
        }

        // Bytes (monedas físicas con brillo) en el suelo
        for (const coin of this.droppedCoins) {
          if (coin.sceneId !== this.tilemap.currentSceneId) continue;
          const cx = Math.round(coin.x - this.camera.renderX);
          const cy = Math.round(coin.y - this.camera.renderY);
          gctx.fillStyle = '#fde047';
          gctx.fillRect(cx - 2, cy - 2, 4, 4);
          gctx.fillStyle = '#f59e0b';
          gctx.fillRect(cx - 1, cy - 1, 2, 2);
          gctx.fillStyle = '#ffffff';
          gctx.fillRect(cx - 1, cy - 2, 1, 1);
        }
      },
      onWorldHudOverlay: (overlayCtx) => {
        // Capa 4: WORLD_HUD_OVERLAY
        // Bocadillos de NPCs, globos flotantes y prompts de interacción [E]
        // Se dibujan por encima de tejados, árboles y la máscara de iluminación
        for (const n of npcs) {
          if (n && typeof n.renderSpeechBubble === 'function') {
            n.renderSpeechBubble(overlayCtx, this.camera);
          }
        }

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
            this._renderActionPrompt(overlayCtx, action);
          }
        }
      }
    });

    this._renderHUD(ctx);
    if (this.debugMode) {
      this._renderDebugOverlay(ctx);
    }
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

  _renderAbyssalPortal(ctx, portalObj = null) {
    const portal = portalObj || this.activeAbyssalPortal;
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
    try {
      SpeechBubble.renderActionPromptBubble(
        ctx,
        action,
        this.camera,
        this.promptTimer,
        this.player
      );
    } catch (err) {
      console.warn('Advertencia no crítica al renderizar bocadillo de acción:', err);
    }
  }

  /**
   * Overlay de depuración [F3]: hitboxes, estado de IA, ruta de A* y datos del jugador.
   */
  _renderDebugOverlay(ctx) {
    const { enemies } = this._getActiveSceneEntities();
    const camX = this.camera.renderX;
    const camY = this.camera.renderY;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.font = '5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const pb = this.player.worldBoundingBox;
    ctx.strokeStyle = '#22c55e';
    ctx.strokeRect(Math.round(pb.x - camX) + 0.5, Math.round(pb.y - camY) + 0.5, pb.width, pb.height);

    for (const e of enemies) {
      if (e.dead) continue;
      const b = e.worldBoundingBox;
      ctx.strokeStyle = e.isBoss ? '#a855f7' : '#ef4444';
      ctx.strokeRect(Math.round(b.x - camX) + 0.5, Math.round(b.y - camY) + 0.5, b.width, b.height);

      if (e.brain && !e.isBoss) {
        const path = e.brain.path;
        if (path && path.length > 0) {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.8)';
          ctx.beginPath();
          ctx.moveTo(e.centerX - camX, e.centerY - camY);
          for (const wp of path) ctx.lineTo(wp.x - camX, wp.y - camY);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.beginPath();
        ctx.arc(e.centerX - camX, e.centerY - camY, e.aggroRange, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.fillText(`${e.archetype}:${e.aiState}${e.brain.action !== 'none' ? '/' + e.brain.action : ''}`, e.centerX - camX, e.y - camY - 10);
      }
    }

    const p = this.player;
    const lines = [
      `DEBUG [F3]  escena=${this.tilemap.currentSceneId}  x=${Math.round(p.x)} y=${Math.round(p.y)}`,
      `hp=${p.hp}/${p.maxHp}  stamina=${Math.round(p.stamina)}/${p.maxStamina}  combo=${p.comboStep}  parry=${p.parryTimer.toFixed(2)}`,
      `pts=${p.skillPoints} kills=${p.killCount}  dificultad=x${this._getDifficultyScale().toFixed(2)}  enemigos=${enemies.filter((e) => !e.dead).length}`
    ];
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
    ctx.fillRect(2, VIEWPORT_HEIGHT - 26, 230, 24);
    ctx.fillStyle = '#4ade80';
    lines.forEach((l, i) => ctx.fillText(l, 5, VIEWPORT_HEIGHT - 24 + i * 7));
    ctx.restore();
  }

  _renderHUD(ctx) {
    ctx.save();
    ctx.textBaseline = 'middle';

    // =========================================================================
    // 1. SUPERIOR DERECHA: Cápsula translúcida con reloj digital, icono solar/lunar y micro-indicador cloud (☁️)
    // =========================================================================
    const timeStr = this.dayNight.getFormattedTime();
    const hour = this.dayNight.timeOfDayHours;
    const isNightHour = hour >= 20 || hour < 6;
    const sunMoonIcon = isNightHour ? '🌙' : '☀️';

    const capsuleW = 62;
    const capsuleH = 14;
    const capsuleX = VIEWPORT_WIDTH - capsuleW - 6;
    const capsuleY = 6;

    ctx.fillStyle = 'rgba(13, 17, 23, 0.82)';
    ctx.fillRect(capsuleX, capsuleY, capsuleW, capsuleH);
    ctx.strokeStyle = 'rgba(229, 192, 123, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(capsuleX + 0.5, capsuleY + 0.5, capsuleW - 1, capsuleH - 1);

    // Icono solar/lunar
    ctx.font = `6px ${UI_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(sunMoonIcon, capsuleX + 4, capsuleY + 7.5);

    // Hora digital
    ctx.font = `bold 5.5px ${UI_FONT}`;
    ctx.fillStyle = '#ffe599';
    ctx.fillText(timeStr, capsuleX + 16, capsuleY + 7.5);

    // Micro-indicador de guardado en la nube (☁️)
    const syncColor = this.cloudSyncStatus === 'syncing'
      ? '#38bdf8'
      : (this.hasPendingCloudSync ? '#f59e0b' : '#4ade80');
    ctx.font = `6px ${UI_FONT}`;
    ctx.fillStyle = syncColor;
    ctx.textAlign = 'right';
    ctx.fillText('☁', capsuleX + capsuleW - 4, capsuleY + 7.5);

    // =========================================================================
    // 2. SUPERIOR IZQUIERDA: Corazones (rojos o blindados metálicos) + icono 🤖% SOLO si supera el 50%
    // =========================================================================
    const heartSlotW = 12;
    const heartsW = this.player.maxHp * heartSlotW + 8;
    const heartsH = 15;
    const heartsX = 6;
    const heartsY = 6;

    ctx.fillStyle = 'rgba(13, 17, 23, 0.82)';
    ctx.fillRect(heartsX, heartsY, heartsW, heartsH);
    ctx.strokeStyle = this.player.hasBrokenHeartCurse
      ? 'rgba(244, 63, 94, 0.65)'
      : !this.player.hasArmor
        ? 'rgba(248, 113, 113, 0.45)'
        : this.player.armorPoints > 0
          ? 'rgba(56, 189, 248, 0.85)'
          : 'rgba(229, 192, 123, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(heartsX + 0.5, heartsY + 0.5, heartsW - 1, heartsH - 1);

    for (let i = 0; i < this.player.maxHp; i++) {
      const hx = heartsX + 4 + i * heartSlotW;
      const hy = heartsY + 2;

      // Penalización >80% robotización: corazón derecho bloqueado en estática/error
      if (i === this.player.maxHp - 1 && this.player.robotizationLevel > 80) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.fillRect(hx, hy, 11, 11);
        ctx.strokeStyle = '#ef4444';
        ctx.strokeRect(hx + 0.5, hy + 0.5, 10, 10);
        ctx.font = 'bold 5.5px monospace';
        ctx.fillStyle = (performance.now() % 400 < 200) ? '#ef4444' : '#fca5a5';
        ctx.textAlign = 'center';
        ctx.fillText('ERR', hx + 5.5, hy + 6);
        continue;
      }

      // Corazones blindados: reborde metálico azul/plata brillante
      const isArmored = this.player.hasArmor && i < this.player.armorPoints;
      if (isArmored) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(hx + 0.5, hy + 0.5, 10, 10);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(hx + 1, hy + 1, 2, 1);
        ctx.fillRect(hx + 8, hy + 1, 2, 1);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(hx + 1, hy + 9, 2, 1);
        ctx.fillRect(hx + 8, hy + 9, 2, 1);
      }

      let char = '♥';
      let color = isArmored ? '#38bdf8' : '#ff4d6d';

      if (this.player.hasBrokenHeartCurse && i === this.player.maxHp - 1) {
        if (this.player.hp >= i + 0.5) {
          char = '💔';
          color = '#f43f5e';
        } else {
          char = '🖤';
          color = '#64748b';
        }
      } else if (this.player.hp >= i + 1) {
        char = '♥';
      } else if (this.player.hp >= i + 0.5) {
        char = '💔';
      } else {
        char = '♡';
        color = '#64748b';
      }

      ctx.font = '7.5px monospace';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(char, hx + 5.5, hy + 6);
    }

    // Icono 🤖% junto a los corazones ÚNICAMENTE si la robotización supera el 50%
    if (this.player.robotizationLevel > 50) {
      const robVal = Math.round(this.player.robotizationLevel);
      const robBadgeX = heartsX + heartsW + 4;
      const robBadgeY = heartsY;
      const robBadgeW = 34;
      const robBadgeH = 15;
      const isCrit = robVal > 80;

      ctx.fillStyle = 'rgba(13, 17, 23, 0.86)';
      ctx.fillRect(robBadgeX, robBadgeY, robBadgeW, robBadgeH);
      ctx.strokeStyle = isCrit ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(robBadgeX + 0.5, robBadgeY + 0.5, robBadgeW - 1, robBadgeH - 1);

      ctx.font = `bold 5px ${UI_FONT}`;
      ctx.fillStyle = isCrit ? '#f87171' : '#fde047';
      ctx.textAlign = 'center';
      ctx.fillText(`🤖${robVal}%`, robBadgeX + robBadgeW / 2, robBadgeY + 7.5);
    }

    // Barra de stamina bajo los corazones (solo visible si hay espada y no está llena)
    if (this.player.hasSword && (this.player.stamina < this.player.maxStamina - 0.5 || this.player.comboStep > 0)) {
      const sw = heartsW;
      const sy = heartsY + heartsH + 2;
      ctx.fillStyle = 'rgba(14, 18, 30, 0.75)';
      ctx.fillRect(heartsX, sy, sw, 4);
      const pct = Math.max(0, Math.min(1, this.player.stamina / this.player.maxStamina));
      ctx.fillStyle = pct < 0.25 ? '#ef4444' : '#38bdf8';
      ctx.fillRect(heartsX + 0.5, sy + 0.5, (sw - 1) * pct, 3);
      if (this.player.comboStep > 0) {
// =========================================================================
    // 2. SUPERIOR DERECHA: Indicador de Monedas / Bytes
    // =========================================================================
    const coinX = heartsX + heartsW + 4;
    const coinY = heartsY;
    const coinW = 50;
    const coinH = 15;
    ctx.fillStyle = 'rgba(13, 17, 23, 0.82)';
    ctx.fillRect(coinX, coinY, coinW, coinH);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(coinX + 0.5, coinY + 0.5, coinW - 1, coinH - 1);
    ctx.font = 'bold 5px monospace';
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.fillText(`💰 ${this.player.coins}`, coinX + coinW / 2, coinY + 7.5);
    // =========================================================================
    // Barra de stamina bajo los corazones (solo visible si hay espada y no está llena)
        ctx.fillStyle = '#fde047';
        for (let i = 0; i < this.player.comboStep; i++) {
          ctx.fillRect(heartsX + i * 5, sy + 5, 4, 2);
        }
      }
    }
    if (this.player.parryFlashTimer > 0) {
      SpeechBubble.renderCombatBanner(ctx, '¡PARRY PERFECTO!', VIEWPORT_WIDTH / 2, 28);
    }

    // 3. Indicador de Calabozo Municipal (únicamente activo si está cumpliendo condena)
    if (this.isJailedForever || this.jailRemainingSeconds > 0) {
      const jailStr = this.isJailedForever
        ? '⛓ CALABOZO · CADENA PERPETUA'
        : `⛓ CONDENA: ${String(Math.floor(this.jailRemainingSeconds / 60)).padStart(2, '0')}:${String(Math.floor(this.jailRemainingSeconds % 60)).padStart(2, '0')}`;
      const jw = Math.ceil(ctx.measureText(jailStr).width) + 12;
      const jx = Math.round((VIEWPORT_WIDTH - jw) / 2);
      const jy = 6;

      ctx.fillStyle = this.isJailedForever ? 'rgba(90, 10, 10, 0.95)' : 'rgba(140, 25, 25, 0.9)';
      ctx.fillRect(jx, jy, jw, 13);
      ctx.strokeStyle = this.isJailedForever ? '#ff4d6d' : '#ffd166';
      ctx.strokeRect(jx + 0.5, jy + 0.5, jw - 1, 12);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(jailStr, jx + jw / 2, jy + 6.5);
    }

    // 4. Barra de Vida de Amenaza Principal en la parte inferior central
    const curScene = this.tilemap.currentSceneId;
    const activeBoss = this.enemies.find(
      (e) => e.isBoss && e.sceneId === curScene && (!e.dead || e.defeatBannerTimer > 0)
    );

    if (activeBoss && (activeBoss.activeCombat || activeBoss.dead)) {
      const barW = 186;
      const barH = 14;
      const barX = Math.round((VIEWPORT_WIDTH - barW) / 2);
      const barY = VIEWPORT_HEIGHT - 22;

      ctx.fillStyle = 'rgba(10, 14, 24, 0.88)';
      ctx.fillRect(barX, barY - 7, barW, barH + 7);
      ctx.strokeStyle = activeBoss.dead ? '#10b981' : '#ffd885';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX + 0.5, barY - 6.5, barW - 1, barH + 6);

      ctx.font = 'bold 5.5px monospace';
      ctx.fillStyle = activeBoss.themeColor || '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText(activeBoss.name.toUpperCase(), barX + 5, barY - 2);

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

    // =========================================================================
    // 5. INFERIOR IZQUIERDA: Ranura rápida de consumible ([R] / [1]) de 16×16 px con contador flotante
    // =========================================================================
    const quickItem = this._getQuickSlotConsumable();
    // [R] lanza el console.log una vez aprendido; la ranura queda en [1]
    const quickLabel = this.player.skills?.log ? '[1]' : '[R]';
    const qsX = 6;
    const qsY = VIEWPORT_HEIGHT - 22;
    const qsW = 16;
    const qsH = 16;

    ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
    ctx.fillRect(qsX, qsY, qsW, qsH);
    ctx.strokeStyle = quickItem ? '#38bdf8' : 'rgba(229, 192, 123, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(qsX + 0.5, qsY + 0.5, qsW - 1, qsH - 1);

    if (quickItem) {
      if (this.inventory && this.inventory.itemsSheet) {
        UILayout.drawItemIcon(ctx, this.inventory.itemsSheet, quickItem.iconIndex, qsX + 2, qsY + 2, 12);
      } else {
        ctx.font = 'bold 6px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText('+', qsX + 8, qsY + 8);
      }

      // Contador flotante de unidades y etiqueta [R]
      const qtyStr = `x${quickItem.qty || 1}`;
      ctx.font = `bold 4.5px ${UI_FONT}`;
      ctx.fillStyle = 'rgba(10, 14, 23, 0.9)';
      ctx.fillRect(qsX + qsW + 2, qsY + 3, 24, 10);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.strokeRect(qsX + qsW + 2.5, qsY + 3.5, 23, 9);

      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'left';
      ctx.fillText(`${quickLabel}${qtyStr}`, qsX + qsW + 4, qsY + 8);
    } else {
      ctx.font = `bold 4.5px ${UI_FONT}`;
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText(quickLabel, qsX + 8, qsY + 8);
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
