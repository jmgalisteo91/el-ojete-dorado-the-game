import { getDoorBlock, getDoorDestinationInfo, pushBackPlayer } from './core/DoorGatekeeper.js?v=8';
import { SceneTransitionController } from './core/SceneTransitionController.js?v=8';
import { GameLoop } from './core/GameLoop.js?v=8';
import { CombatManager } from './core/CombatManager.js?v=8';
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
import { ExpansionManager } from './expansion/ExpansionManager.js?v=8';
import { DemonVengador } from './expansion/entities/DemonVengador.js?v=8';
import { Animal } from './entities/Animal.js?v=8';
import { Enemy, setParticleScale } from './entities/Enemy.js?v=8';
import { GarbageCollectorBoss } from './entities/bosses/GarbageCollectorBoss.js?v=8';
import { StackOverflowBoss } from './entities/bosses/StackOverflowBoss.js?v=8';
import { PrototypeMicrowaveBoss } from './entities/bosses/PrototypeMicrowaveBoss.js?v=8';
import { FinalBossAlex } from './entities/bosses/FinalBossAlex.js?v=8';
import { WorldItem } from './entities/WorldItem.js?v=8';
import { DialogueBox } from './ui/DialogueBox.js?v=8';
import { Inventory, normalizeItemId } from './ui/Inventory.js?v=8';
import { CharacterStats } from './ui/CharacterStats.js?v=8';
import { ShopUI } from './ui/ShopUI.js?v=8';
import {
  SHOP_ITEMS,
  SELL_CATALOG,
  SHOP_CATALOG,
  CORE_CHEST_GUARDIANS,
  ABYSSAL_POINTER_SPAWN_CANDIDATES,
  WORLD_ITEMS_DATA
} from './data/ItemData.js?v=8';
import {
  REGIONAL_PATROL_CONFIGS,
  DUNGEON_ROOM_ENEMY_SPAWNS,
  FIRST_STAGE_ENEMY_SPAWNS,
  BOSS_SPAWNS
} from './data/EnemyData.js?v=8';
import {
  LIFE_RANT_DIALOGUES,
  VILLAGE_NPC_PROFILES,
  VILLAGE_DIALOGUES
} from './data/DialogueData.js?v=8';

export { ABYSSAL_POINTER_SPAWN_CANDIDATES };
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
import { CinematicDirector, PROLOGUE_ALEX } from './ui/CinematicDirector.js?v=8';
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
import { HUD } from './ui/HUD.js?v=8';
import { TouchControls } from './ui/TouchControls.js?v=8';

const VIEWPORT_WIDTH = 320;
const VIEWPORT_HEIGHT = 180;
const BASE_RENDER_SCALE = 4; // Desktop: 1280x720 (4x sobre la base lógica 320x180)
const EXPANSION_SAVE_KEY = 'el_ojete_dorado_expansion_save';
const EXPANSION_SLOT_SAVE_KEY = 'el_ojete_dorado_expansion_save_v1';
const VERTEDERO_BASE_ROOMS = [
  'vertedero_digital',
  'sewers_dungeon',
  'mines_entry',
  'forge_entry',
  'forge_puzzle'
];

/**
 * (FIX M2.1) Escala del canvas según el dispositivo.
 *  - Desktop: 4x → 1280x720 (sin cambios).
 *  - Táctil: devicePixelRatio capado a 2 → 2x → 640x360. En un móvil 3x no se
 *    dispara el backing store y el coste de relleno baja ~4x.
 * Si en el futuro se sube el cap, la fórmula ya devuelve 3x (960x540), etc.
 */
function computeRenderScale() {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return BASE_RENDER_SCALE;
    }
    if (!window.matchMedia('(pointer: coarse)').matches) return BASE_RENDER_SCALE;
    const dpr = Math.min(Number(window.devicePixelRatio) || 1, 2);
    return Math.max(2, Math.round(dpr));
  } catch (_) {
    return BASE_RENDER_SCALE;
  }
}

/**
 * (FIX 1.7) Escenas hostiles: suenan con la música de escenario ('stage1') en lugar de
 * la del pueblo. Única fuente de verdad, usada al cargar partida y al cruzar una puerta.
 * Todo lo que no esté aquí (pueblo, casas, calabozo) mantiene su propio modo musical.
 */
const STAGE_SCENE_IDS = new Set([
  'first_stage',
  'north_peaks',
  'south_swamp',
  'west_wastes',
  'sewers_entry',
  'sewers_puzzle',
  'sewers_dungeon',
  'armor_temple',
  'sword_temple',
  'mines_entry',
  'mines_puzzle',
  'mines_boss_arena',
  'forge_entry',
  'forge_puzzle',
  'quantum_gate',
  'ai_fortress_gate',
  'ai_citadel',
  'condemned_realms'
]);

export class RPGGame {
  constructor(canvas, assets) {
    this.canvas = canvas;

    // (FIX M2.1) El canvas se dimensiona en JS; el HTML queda como valor por defecto.
    this.renderScale = computeRenderScale();
    canvas.width = VIEWPORT_WIDTH * this.renderScale;
    canvas.height = VIEWPORT_HEIGHT * this.renderScale;

    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.assets = assets;

    // (FIX M2.6) Perfil de rendimiento: 'low' | 'normal' | 'high'
    this.performanceProfile = this._detectPerformanceProfile();
    this.music = new AmbientMusic();
    this.input = new InputHandler(() => {
      this.music.unlockAndStart();
      if (this.achievementManager && this.music.ctx) {
        this.achievementManager.setAudioContext(this.music.ctx);
      }
    }, canvas);

    // (FIX M1.2-M1.8) Controles táctiles. Se construyen aquí y se enganchan al input;
    // los callbacks son perezosos (menuSystem/inventory se crean más abajo).
    this.touchControls = new TouchControls(canvas, this.input, {
      // (FIX M1.8) Bloqueo duro: modales DOM, pausa y diálogo. Los paneles de canvas
      // (inventario/ficha/diario) se gestionan aparte para poder cerrarlos con 🎒.
      isBlocked: () =>
        this.input.isDOMBlocked() ||
        this.menuSystem.isBlockingGameplay() ||
        this.dialogueBox.active,
      isPanelOpen: () =>
        Boolean(
          this.inventory.isOpen ||
          this.characterStats.isOpen ||
          (this.questLogView && this.questLogView.isOpen)
        ),
      onMenu: () => {
        if (this.menuSystem.state !== 'none' || this.dialogueBox.active) return;
        this.player.stopMovement();
        this.menuSystem.openPauseMenu();
      },
      onBag: () => {
        if (this.menuSystem.state !== 'none' || this.dialogueBox.active) return;
        if (this.inventory.isOpen) {
          this.inventory.close();
          return;
        }
        if (this.characterStats.isOpen) {
          this.characterStats.close();
          return;
        }
        if (this.questLogView && this.questLogView.isOpen) {
          this.questLogView.close();
          return;
        }
        this.inventory.open();
        if (this.music) this.music.playMenuSelect();
      },
      isInteractionAvailable: () => {
        try {
          return Boolean(this._findBestInteraction());
        } catch (_) {
          return false;
        }
      },
      // (FIX M3.5) Acciones táctiles para teclas huérfanas
      isLogAvailable: () => Boolean(this.player && this.player.skills && this.player.skills.log),
      onLog: () => {
        if (this.player && this.player.skills && this.player.skills.log) {
          this.player.throwLog(this.music);
        }
      },
      getQuickSlots: () => {
        const defs = [
          { id: 'potion_armor', icon: '🛡' },
          { id: 'potion', icon: '🧪' },
          { id: 'coffee', icon: '☕' }
        ];
        return defs.map((def) => {
          const item = this.inventory.items.find((it) => it.id === def.id && (it.qty || 1) > 0);
          return item ? { icon: def.icon, qty: item.qty } : null;
        });
      },
      onQuickSlot: (index) => {
        const key = ['Digit1', 'Digit2', 'Digit3'][index];
        if (key) this._useQuickSlotConsumable(key);
      }
    });
    this.input.attachTouchControls(this.touchControls);

    this.tilemap = new Tilemap(assets.tilesetSheet, assets.tileSize);
    this.camera = new Camera2D(
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      this.tilemap.width,
      this.tilemap.height
    );

    this.dialogueBox = new DialogueBox(VIEWPORT_WIDTH, VIEWPORT_HEIGHT, this.music);
    this.inventory = new Inventory(assets.itemsSheet, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, this);
    this.characterStats = new CharacterStats(VIEWPORT_WIDTH, VIEWPORT_HEIGHT, this);
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

    // (FIX M3.1/M3.2/M3.4) Paneles en modo táctil
    this.dialogueBox.isTouchDevice = this.input.isTouchDevice;
    this.inventory.setTouchMode(this.input.isTouchDevice);
    this.characterStats.setTouchMode(this.input.isTouchDevice);
    this.questLogView.setTouchMode(this.input.isTouchDevice);
    this.dayNight = new DayNightCycle(VIEWPORT_WIDTH, VIEWPORT_HEIGHT, 720);
    this.renderPipeline = new RenderPipeline(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    // (FIX M2.6) Modo degradado: sin niebla, sin viñeta y con menos partículas
    this.renderPipeline.setQuality(this.performanceProfile);
    setParticleScale(this.performanceProfile === 'low' ? 0.45 : 1);

    // (FIX M2.3) Pausa automática al perder el foco (móvil y desktop)
    this._installAutoPause();

    this.jailRemainingSeconds = 0;
    this.jailerAngerCount = 0;
    this.isJailedForever = false;
    this.jailReason = null;
    this.arrestFadeAlpha = 0;
    this.activeDemon = null;
    this.demonBannerTimer = 0;

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
    this.gameState = 'base';
    this.isExpansionMode = false;
    this.isExpansionActive = false;
    this.expansionEquipment = null;
    this.expansionManager = new ExpansionManager(this);
    this._initExpansionState();

    this.player = new Player({
      x: 17 * 16,
      y: 19 * 16,
      animator: new SpriteAnimator(assets.charactersSheet, CHARACTER_TYPES.HERO),
      armoredAnimator: new SpriteAnimator(assets.charactersSheet, CHARACTER_TYPES.HERO_ARMORED),
      game: this
    });

    // (BLOQUE 1) Director de cinemáticas in-engine.
    this.cinematicDirector = new CinematicDirector(this);

    // (FIX SHOP) Modal Canvas 2D de compra/venta por cantidad
    this.shopUI = new ShopUI(this);
    this.rosaShop = null;
    this.kernelHackActive = false;
    this.kernelHudFlicker = false;
    this.bsodOverlayTimer = 0;
    this.debtGlitchTimer = 0;

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
    this.dialogueBox.npcRegistry = this.npcs;
    this.animals = this._createVillageAnimals();
    this.enemies = this._createFirstStageEnemies();
    this.worldItems = this._createWorldItems();

    this.promptTimer = 0;

    this.animeCutscenes = new AnimeCutsceneManager(
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      this.music,
      this.cinematicDirector
    );

    // Registro de estadísticas del jugador para el Expediente de Compilación Final
    this.totalPlayTimeSeconds = 0;
    this.totalDeaths = 0;
    this.totalJailVisits = 0;
    this.gameCompleted = false;
    this.bossCutscenesSeen = {
      boss_garbage_collector: false,
      boss_stack_overflow: false,
      boss_prototype_microwave: false,
      boss_inakito: false
    };

    // Estado del Puntero al Abismo y Portal dinámico a los Reinos Condenados
    this.abyssalPointerSpawn = null;
    this.abyssalPortalOrigin = null;
    this.activeAbyssalPortal = null;
    this.transitionCooldown = 0;
    this.doorGate = null;
    this.sceneTransitions = new SceneTransitionController(this);
    // (FIX 2.4) Origen de la última entrada a un templo (para que su salida vuelva a esa sala)
    this.templeReturn = null;
    // (FIX NPC.6) Cambio de rutina pospuesto porque el NPC estaba hablando
    this._npcsSchedulePending = false;
    // (FIX NPC.8) Brom solo regala una hogaza de pan por partida
    this.bromBreadGift = false;

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
        game: this,
        onNewGame: () => this._startNewGame(),
        onLoadGame: () => this._loadGameFromStorage(),
        onStartExpansion: () => this.expansionManager.init(this),
        onSaveGame: (opts) => this._saveGameToStorage(opts || { manual: true }),
        // (FIX EXIT) Fallback real cuando el navegador bloquea window.close()
        onExit: () => {
          try { this.loop.stop(); } catch {}
          try { this.music.setMode('silent'); } catch {}
          try { if (this.canvas) this.canvas.style.visibility = 'hidden'; } catch {}
        },
        onOpenCloudSave: () => this._openCloudSaveModal(),
        onOpenCloudLoad: () => this._openCloudLoadModal(),
        getSaveSummary: () => this._getSaveSummary(),
        // (FIX B2) Código de nube real para el menú (antes el menú inventaba 'SLOT-1')
        getCloudCode: () => {
          try {
            return getSavedCloudCode() || null;
          } catch {
            return null;
          }
        },
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
    // (FIX M3.6) Guía y tutorial táctil dentro del sistema de menús
    this.menuSystem.isTouchDevice = this.input.isTouchDevice;
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

    this.hud = new HUD(this);
    this.combatManager = new CombatManager(this);

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

    // (BLOQUES 1/2/3) Efectos visuales configurables desde Opciones.
    const effectsOn = opts.visualEffects !== false;
    if (this.renderPipeline && typeof this.renderPipeline.setEffects === 'function') {
      this.renderPipeline.setEffects({
        bloom: effectsOn,
        scanlines: effectsOn,
        particles: effectsOn,
        parallax: effectsOn
      });
    }
    if (this.animeCutscenes) {
      this.animeCutscenes.effectsEnabled = effectsOn && this.performanceProfile !== 'low';
    }
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
    this.jailReason = null;
    this.arrestFadeAlpha = 0;
    this.activeDemon = null;
    this.demonBannerTimer = 0;
    this.player.hasBrokenHeartCurse = false;
    this.player.killedByDemon = false;
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
    this.gameState = 'base';
    this.isExpansionMode = false;
    this.isExpansionActive = false;
    this.expansionEquipment = null;
    this.rosaShop = null;
    this._initExpansionState();
    // (FIX 2.4) Los templos vuelven a su salida de diseño al reiniciar la partida
    this.templeReturn = null;
    this.tilemap.resetSceneExitReturn('armor_temple');
    this.tilemap.resetSceneExitReturn('sword_temple');

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

    // (FIX 2.3) Reiniciar los puzles de mazmorra (Cloacas · Minas · Forja)
    this.tilemap.resetDungeonPuzzles();

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
    this.player.speed = 86;
    this.player.direction = 'up';
    this.player.hasLanternEquipped = false;
    this.player.unequipAllForNewGame();

    if (Array.isArray(this.npcs)) {
      this.npcs = this.npcs.filter((n) => !n?.expansionId);
      if (this.dialogueBox) this.dialogueBox.npcRegistry = this.npcs;
    }
    this._restoreAllNPCsToOverworld();
    this.enemies = this._createFirstStageEnemies();
    this.worldItems = this._createWorldItems();

    // (FIX NPC.8) El regalo de pan vuelve a estar disponible en una partida nueva
    this.bromBreadGift = false;

    // (FIX NPC.1) Los animales vuelven a su sitio: antes conservaban posición y estado
    // de la partida anterior al empezar una nueva.
    if (Array.isArray(this.animals)) {
      for (const animal of this.animals) {
        if (typeof animal.reset === 'function') animal.reset();
      }
    }

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
      boss_prototype_microwave: false,
      boss_inakito: false
    };

    if (this.music && this.music.currentBossTrack) {
      this.music.stopBossMusic(false);
    }

    // Estado del Puntero al Abismo y Portal dinámico a los Reinos Condenados
    this.abyssalPointerSpawn = null;
    this.abyssalPortalOrigin = null;
    this.activeAbyssalPortal = null;
    this.transitionCooldown = 0;
    this.doorGate = null;

    this.camera.snapTo(this.player);
  }

  _startNewGame() {
    this._resetWorldToInitialState();
    this.music.setMode('village');
    this._saveGameToStorage();
    // (FIX FLUJO) El menú NO debe quedarse en 'title' durante el prólogo.
    this.menuSystem.state = 'none';
    this.menuSystem.fadeAlpha = 0;
    this.player.stopMovement();
    this.camera.resetCinematic();
    this.camera.snapTo(this.player);
    // Inicio natural sin diálogos forzados: libertad total de movimiento y exploración
    this.menuSystem.showNotice('🌿 Valleverde · Plaza Central · Explora la aldea libremente', 4.0);
    // (BLOQUE 4) Prólogo de Alex al empezar una partida nueva.
    if (this.cinematicDirector) {
      this.cinematicDirector.play(PROLOGUE_ALEX, () => {
        // Al terminar/saltar: gameplay, nunca menú principal.
        this.menuSystem.state = 'none';
        this.menuSystem.fadeAlpha = 0;
        this.player.stopMovement();
        // (REFACTOR 1) Posición inicial canónica del Capítulo 1.
        this.player.x = 224;
        this.player.y = 192;
        this.player.direction = 'down';
        this.camera.resetCinematic();
        this.camera.snapTo(this.player);
        this.menuSystem.showNotice('🌿 Valleverde · Plaza Central · Explora la aldea libremente', 4.0);
      });
    }
  }

  _shakeCamera(intensity = 4, duration = 0.3) {
    if (this.camera && typeof this.camera.shake === 'function') {
      this.camera.shake(intensity, duration);
    }
  }

  _flashScreen(color = '#ffffff', alpha = 0.35, duration = 0.15) {
    this.screenFlash = { color, alpha, time: duration, duration };
  }

  _handleBlockedDoor(door, title, lines) {
    return this.sceneTransitions.handleBlockedDoor(door, title, lines);
  }

  _updateDoorGate() {
    this.sceneTransitions.updateDoorGate();
  }

  _compassFromDirection(direction) {
    return this.sceneTransitions.compassFromDirection(direction);
  }

  _resolveStageSpawn(door = {}) {
    if (!this.sceneTransitions) this.sceneTransitions = new SceneTransitionController(this);
    return this.sceneTransitions.resolveSpawn(door);
  }

  _executeStageTransition(door) {
    return this.sceneTransitions.executeStageTransition(door);
  }

  _checkBossIntroTriggers() {
    this.sceneTransitions.checkBossIntroTriggers();
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
      // (FIX 2.4) Sin esto, recargar dentro de sword_temple reenviaba la salida a first_stage
      templeReturn: this.templeReturn ? { ...this.templeReturn } : null,
      swordPuzzle: this.tilemap?.swordPuzzle ? {
        solved: !!this.tilemap.swordPuzzle.solved,
        portalOpen: !!this.tilemap.swordPuzzle.portalOpen,
        stack: [...this.tilemap.swordPuzzle.stack]
      } : null,
      // (FIX 2.3) Estado de los puzles de mazmorra (Cloacas · Minas · Forja)
      dungeonPuzzles: {
        sewers: {
          solved: !!this.tilemap?.sewersPuzzle?.solved,
          valveTurns: this.tilemap?.sewersPuzzle?.valve?.turns || 0
        },
        mines: {
          solved: !!this.tilemap?.minesPuzzle?.solved,
          stack: [...(this.tilemap?.minesPuzzle?.stack || [])]
        },
        forge: {
          solved: !!this.tilemap?.forgePuzzle?.solved,
          regulators: { ...(this.tilemap?.forgePuzzle?.regulators || { LEFT: 0, RIGHT: 0 }) }
        }
      },
      totalPlayTimeSeconds: Math.round(this.totalPlayTimeSeconds || 0),
      totalDeaths: this.totalDeaths || 0,
      totalJailVisits: this.totalJailVisits || 0,
      housePermissions: { ...this.housePermissions },
      // (FIX NPC.8) Evita farmear pan (y dinero) recargando la partida
      bromBreadGift: Boolean(this.bromBreadGift),
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
      defeatedEnemyIds: this.enemies.filter((e) => e.dead && !e.respawnOnEnter).map((e) => e.id),
      curriculum: Math.max(0, Math.floor(this.curriculum || 0)),
      francoRescued: Boolean(this.francoRescued),
      alexCoreUnlocked: Boolean(this.tilemap && this.tilemap.alexCoreUnlocked),
      rosaUpgrades: {
        maxHp: this.player ? this.player.maxHp : 3,
        damageBonus: this.player ? (this.player.rosaDamageBonus || 0) : 0,
        staminaBonus: this.player ? (this.player.rosaStaminaBonus || 0) : 0,
        extraDashCharges: this.player ? (this.player.extraDashCharges || 0) : 0
      },
      vertederoFloorOrder: Array.isArray(this.vertederoFloorOrder) ? [...this.vertederoFloorOrder] : [...VERTEDERO_BASE_ROOMS]
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
      this.bromBreadGift = Boolean(data.bromBreadGift);

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

      // (FIX 2.3) Restaurar los puzles de mazmorra
      if (data.dungeonPuzzles) {
        this.tilemap.applyDungeonPuzzleState(data.dungeonPuzzles);
      }

      const hasValidScene = typeof data.sceneId === 'string' && Boolean(this.tilemap.scenes[data.sceneId]);
      const targetScene = hasValidScene ? data.sceneId : 'overworld';
      this.tilemap.loadScene(targetScene);
      // (FIX 2.4) Restaurar el origen de entrada del templo guardado en la partida
      if (data.templeReturn && data.templeReturn.scene === targetScene) {
        this.tilemap.setSceneExitReturn(targetScene, data.templeReturn);
        this.templeReturn = { ...data.templeReturn };
      }
      this.camera.setWorldBounds(this.tilemap.width, this.tilemap.height);

      const hasValidPos = hasValidScene && Number.isFinite(data.playerX) && Number.isFinite(data.playerY);
      this.player.x = hasValidPos ? data.playerX : 14 * 16;
      this.player.y = hasValidPos ? data.playerY : 12 * 16;
      // (FIX 2.3) Compatibilidad con guardados anteriores a los puzles: si el jugador quedó
      // al norte de una barrera aún sellada, devolverlo a la entrada de la sala.
      const sealedRooms = {
        sewers_puzzle: this.tilemap.sewersPuzzle,
        mines_puzzle: this.tilemap.minesPuzzle,
        forge_puzzle: this.tilemap.forgePuzzle
      };
      const sealedPuzzle = sealedRooms[targetScene];
      if (sealedPuzzle && !sealedPuzzle.solved) {
        const playerRow = Math.floor(this.player.centerY / this.tilemap.tileSize);
        if (playerRow <= sealedPuzzle.barrierRow) {
          this.player.x = 11.5 * this.tilemap.tileSize;
          this.player.y = 15 * this.tilemap.tileSize;
        }
      }
      this.player.direction = data.playerDir || 'down';
      // (FIX H5) Velocidad base unificada; los saves antiguos se normalizan a 86
      this.player.speed = 86;
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
      const expansionActive = Boolean(this.isExpansionActive || this.isExpansionMode);
      this.player.skills = {
        vigor: Boolean(savedSkills.vigor),
        filo: Boolean(savedSkills.filo),
        reflejo: Boolean(savedSkills.reflejo),
        log: Boolean(savedSkills.log),
        ejecutivo: expansionActive ? Boolean(savedSkills.ejecutivo) : false,
        resiliencia: expansionActive ? Boolean(savedSkills.resiliencia) : false,
        reciclaje: expansionActive ? Boolean(savedSkills.reciclaje) : false,
        vigor_2: expansionActive ? Boolean(savedSkills.vigor_2) : false,
        filo_2: expansionActive ? Boolean(savedSkills.filo_2) : false,
        reflejo_2: expansionActive ? Boolean(savedSkills.reflejo_2) : false,
        log_2: expansionActive ? Boolean(savedSkills.log_2) : false
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
      this.player.invulnTimer = 1.0;
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

      // (FIX 1.7) Mismo conjunto que usa la transición por puerta: las regiones nuevas
      // (Cumbres, Marismas, Páramo) y las entradas de mazmorra ya no suenan como pueblo.
      const stageScenes = STAGE_SCENE_IDS;

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
      this._restoreExpansionSaveData(data);
      const isVertederoScene =
        targetScene.startsWith('vertedero_') || targetScene === 'kernel_arena';
      if (targetScene === 'valleverde_corp' || targetScene === 'rosa_bar' || isVertederoScene || targetScene === 'ai_nucleus_core') {
        this.music?.loadExpansionMusic?.();
      }
      this.music.setMode(
        targetScene === 'ai_nucleus_core'
          ? 'boss_alex_final'
          : targetScene === 'valleverde_corp' || targetScene === 'rosa_bar'
            ? 'valleverde_corp'
            : isVertederoScene
              ? 'vertedero'
              : targetScene === 'jail_cell'
                ? 'jail'
                : stageScenes.has(targetScene)
                  ? 'stage1'
                  : 'village'
      );
      // (FIX 3) Al cargar una partida dentro de la arena, respetar el Núcleo del Stack
      this._syncMinesBossArenaGate();
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

    if (Array.isArray(this.npcs)) {
      this.npcs = this.npcs.filter((n) => !n?.expansionId);
      if (this.dialogueBox) this.dialogueBox.npcRegistry = this.npcs;
    }
    this._restoreAllNPCsToOverworld();
    this.totalJailVisits = (this.totalJailVisits || 0) + 1;
    this.isJailedForever = false;
    // La condena arranca cuando termina la cinemática de 20 s.
    this.jailRemainingSeconds = 0;

    const sendToCell = () => {
      this.jailRemainingSeconds = 10 * 60;
      this.tilemap.loadScene('jail_cell');
      this.camera.setWorldBounds(this.tilemap.width, this.tilemap.height);
      this.player.x = 5.5 * 16;
      this.player.y = 3.5 * 16;
      this.player.direction = 'down';
      this.camera.snapTo(this.player);
      this.music.setMode('jail');
      this.dialogueBox.showMessage('🚨 ARRESTO MUNICIPAL 🚨', rightsLines);
    };

    if (this.animeCutscenes) {
      this.animeCutscenes.playCutscene(SCENE_JAIL_ARREST, sendToCell);
    } else {
      sendToCell();
    }
  }

  /**
   * Resetea el contador de agresiones y el enfriamiento en todos los NPCs (juego base y expansión).
   */
  _resetAllNPCHitCounts() {
    const allNpcs = Array.isArray(this.npcs) ? this.npcs : [];
    for (const npc of allNpcs) {
      if (!npc) continue;
      if (typeof npc.resetAttackReaction === 'function') {
        npc.resetAttackReaction();
      } else {
        npc.hitCount = 0;
        npc.hitResetTimer = 0;
        npc.hitCooldown = 0;
      }
    }
  }

  /**
   * Arresto inmediato por agresión reiterada a un NPC (3 golpes).
   * Detiene al jugador, resetea los contadores de todos los NPCs, inicia transición a negro,
   * teletransporta a `jail_cell` con 600s de condena, reproduce música `jail` y muestra al Carcelero.
   */
  triggerArrest(victimNpc = null) {
    this._resetAllNPCHitCounts();

    if (this.player) {
      if (typeof this.player.stopMovement === 'function') {
        this.player.stopMovement();
      }
      this.player.attackTimer = 0;
      this.player.spinAttackTimer = 0;
    }

    if (!this.isExpansionMode && typeof this._restoreAllNPCsToOverworld === 'function') {
      if (Array.isArray(this.npcs)) {
      this.npcs = this.npcs.filter((n) => !n?.expansionId);
      if (this.dialogueBox) this.dialogueBox.npcRegistry = this.npcs;
    }
    this._restoreAllNPCsToOverworld();
    }

    this.totalJailVisits = (this.totalJailVisits || 0) + 1;
    this.isJailedForever = false;
    this.jailReason = 'assault';
    this.jailRemainingSeconds = 600;
    this.arrestFadeAlpha = 1.0;

    if (this.music) {
      if (typeof this.music.playSFX === 'function') {
        this.music.playSFX('ui_error', { volume: 0.9, playbackRate: 0.85 });
      }
      if (typeof this.music.setMode === 'function') {
        this.music.setMode('jail');
      }
    }
    this._flashScreen('#ef4444', 0.25, 0.45);
    this._shakeCamera(3, 0.3);

    this.tilemap.loadScene('jail_cell');
    this.camera.setWorldBounds(this.tilemap.width, this.tilemap.height);
    if (this.player) {
      this.player.x = 5.5 * 16;
      this.player.y = 3.5 * 16;
      this.player.direction = 'down';
      this.camera.snapTo(this.player);
    }

    const victimLabel = victimNpc?.name ? ` (${victimNpc.name})` : '';
    this.dialogueBox.showMessage(`🚨 CARCELERO MUNICIPAL${victimLabel ? ' · DENUNCIA' : ''} 🚨`, [
      '¡Se acabó la fiesta! Por agredir a un ciudadano, quedas detenido.'
    ]);
  }

  _releaseFromJail(messageLines) {
    this.jailRemainingSeconds = 0;
    this.jailReason = null;
    this._resetAllNPCHitCounts();
    if (this.isExpansionMode) {
      this.tilemap.loadScene('valleverde_corp');
      this.camera.setWorldBounds(this.tilemap.width, this.tilemap.height);
      this.player.x = 12 * 16;
      this.player.y = 10 * 16;
      this.player.direction = 'down';
      this.camera.snapTo(this.player);
      this.music?.setMode?.('valleverde_corp');
    } else {
      if (Array.isArray(this.npcs)) {
      this.npcs = this.npcs.filter((n) => !n?.expansionId);
      if (this.dialogueBox) this.dialogueBox.npcRegistry = this.npcs;
    }
    this._restoreAllNPCsToOverworld();
      this.tilemap.loadScene('overworld');
      this.camera.setWorldBounds(this.tilemap.width, this.tilemap.height);
      this.player.x = 17 * 16;
      this.player.y = 13 * 16;
      this.player.direction = 'down';
      this.camera.snapTo(this.player);
      this.music?.setMode?.('village');
    }

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
    const data = LIFE_RANT_DIALOGUES[npcKey];
    this.dialogueBox.startLifeRant(
      data.speaker,
      data.initial,
      data.penalties,
      returnChoices
    );
  }

  /** (FIX SHOP) Abre el modal de compra por cantidad. */
  _openBuyShop(title, itemIds) {
    if (!this.shopUI || !Array.isArray(itemIds)) return;
    const entries = itemIds.map((id) => SHOP_ITEMS[id]).filter(Boolean);
    if (entries.length === 0) return;
    this.shopUI.open({ title, mode: 'buy', entries });
  }

  /** (FIX SHOP) Abre el modal de venta por cantidad con el stock actual. */
  _openSellShop(title) {
    if (!this.shopUI) return;
    const entries = SELL_CATALOG
      .map((entry) => ({ ...entry, count: this.inventory.getItemCount(entry.id) }))
      .filter((entry) => entry.count > 0);
    if (entries.length === 0) {
      if (this.menuSystem) {
        this.menuSystem.showNotice('🎒 No tienes materiales ni consumibles para vender.', 2.5);
      }
      return;
    }
    this.shopUI.open({ title, mode: 'sell', entries });
  }

  _buildOracleChoices() {
    const dlg = VILLAGE_DIALOGUES.oracle;
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
          const pages = await this.aiBrain.ask(dlg.aiPrompt);
          this.dialogueBox.showMessage(dlg.speaker, pages, this._buildOracleChoices());
        }
      },
      ...(this.player.hasBrokenHeartCurse
        ? [
            {
              label: dlg.brokenHeartChoiceLabel,
              onSelect: () => {
                this.dialogueBox.showMessage(
                  dlg.speaker,
                  dlg.brokenHeartLines,
                  this._buildOracleChoices()
                );
              }
            }
          ]
        : []),
      {
        label: dlg.insultLabel,
        onSelect: () => {
          this._arrestPlayerForInsult(dlg.insultLabel);
        }
      },
      {
        label: 'Despedirse',
        onSelect: () => this.dialogueBox.close()
      }
    ];
  }

  _getElderChoices() {
    const dlg = VILLAGE_DIALOGUES.elder;
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
          this.dialogueBox.showMessage(dlg.speaker, dlg.bridgeLines, elderChoices);
        }
      },
      {
        label: 'Háblame del villano AI Alex y El Ojete Dorado',
        onSelect: () => {
          this.dialogueBox.showMessage(dlg.speaker, dlg.aiAlexIntroLines, [
            {
              label: '★ Contemplar la visión de las crónicas',
              onSelect: () => {
                this.dialogueBox.close();
                this.menuSystem.startHeroAdventureCutscene(() => {
                  this.music.setMode('village');
                  this.dialogueBox.showMessage(dlg.speaker, dlg.afterChroniclesLines, elderChoices);
                });
              }
            },
            {
              label: 'Volver',
              onSelect: () => {
                this.dialogueBox.showMessage(dlg.speaker, dlg.returnLaterLines, elderChoices);
              }
            }
          ]);
        }
      },
      {
        label: '¿Puedo consultar tu archivo y biblioteca?',
        onSelect: () => {
          this.housePermissions.elder_house = true;
          this._saveGameToStorage();
          this.dialogueBox.showMessage(dlg.speaker, dlg.libraryLines, elderChoices);
        }
      },
      ...(this.inventory && this.inventory.hasItem('golden_apple')
        ? [
            {
              label: '⚡ Sabio Aurelio, he consagrado la Reliquia Divina de tu cofre',
              onSelect: () => {
                this.dialogueBox.showMessage(dlg.speaker, dlg.goldenAppleLines, elderChoices);
              }
            }
          ]
        : []),
      ...(this.player.hasBrokenHeartCurse
        ? [
            {
              label: '💔 ¡Sabio, el carcelero me ha roto medio corazón con su maldición!',
              onSelect: () => {
                this.dialogueBox.showMessage(dlg.speaker, dlg.brokenHeartLines, elderChoices);
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
    const dlg = VILLAGE_DIALOGUES.lyra;
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
            this.dialogueBox.showMessage(dlg.speaker, dlg.siliconDoneLines, this._getHerbChoices());
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
            this.dialogueBox.showMessage(dlg.speaker, dlg.siliconRewardLines, this._getHerbChoices());
          } else {
            if (this.questLog) {
              this.questLog.advanceStep(
                'quest_side_silicon_flowers',
                `Espera a la noche profunda (22:00 PM con tu cama) y recolecta 3 Flores de Silicio. Llevas [${flowerCount}/3].`
              );
            }
            this.dialogueBox.showMessage(dlg.speaker, dlg.siliconHintLines(flowerCount), this._getHerbChoices());
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
            this.dialogueBox.showMessage(dlg.speaker, dlg.houseUnlockedLines, this._getHerbChoices());
            return;
          }

          if (isSiliconDone) {
            this.housePermissions.herbalist_house = true;
            if (this.music) this.music.playFanfare();
            this._saveGameToStorage();
            this.dialogueBox.showMessage(dlg.speaker, dlg.houseGiftLines, this._getHerbChoices());
            return;
          }

          this.dialogueBox.showMessage(dlg.speaker, dlg.houseDepositPromptLines, [
            {
              label: `🪙 Pagar fianza de 25 Bytes [Tienes: ${this.player.coins}🪙]`,
              onSelect: () => {
                if (this.player.coins < 25) {
                  this.dialogueBox.showMessage(dlg.speaker, dlg.houseDepositInsufficientLines, this._getHerbChoices());
                  return;
                }
                this.player.coins -= 25;
                this.housePermissions.herbalist_house = true;
                if (this.music) this.music.playFanfare();
                this._saveGameToStorage();
                this.dialogueBox.showMessage(dlg.speaker, dlg.houseDepositPaidLines, this._getHerbChoices());
              }
            },
            {
              label: 'Buscaré las Flores de Silicio primero',
              onSelect: () => {
                this.dialogueBox.showMessage(dlg.speaker, dlg.houseSearchFlowersLines, this._getHerbChoices());
              }
            }
          ]);
        }
      },
      {
        label: '💰 Vender plantas / materiales',
        onSelect: () => this._openSellShop(dlg.speaker)
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
          this.dialogueBox.showMessage(dlg.speaker, dlg.wheatGiftLines, this._getHerbChoices());
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
    const dlg = VILLAGE_DIALOGUES.finn;
    const vendor = SHOP_CATALOG.vendors.finn;
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
            this.dialogueBox.showMessage(dlg.speaker, dlg.fishingDoneLines, this._getFinnChoices());
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
            this.dialogueBox.showMessage(dlg.speaker, dlg.fishingRewardLines, this._getFinnChoices());
          } else {
            if (this.questLog) {
              this.questLog.advanceStep(
                'quest_side_fishing',
                `Acércate a la orilla del Río Alba con Pan Campesino y pulsa [E]. Llevas [${fishCount}/3] truchas.`
              );
            }
            this.dialogueBox.showMessage(dlg.speaker, dlg.fishingHintLines(fishCount), this._getFinnChoices());
          }
        }
      },
      {
        label: '🛒 Comprar pescado y agua (cantidad)',
        onSelect: () => this._openBuyShop(vendor.title, vendor.itemIds)
      },
      {
        label: '💰 Vender pescado / materiales',
        onSelect: () => this._openSellShop(vendor.title)
      },
      {
        label: '¿Puedo pasar a tu casa?',
        onSelect: () => {
          this.dialogueBox.showMessage(dlg.speaker, dlg.houseLines, this._getFinnChoices());
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
    const makeNPC = (profileKey, getDialogues) => {
      const { sprite, ...profile } = VILLAGE_NPC_PROFILES[profileKey];
      return new NPC({
        ...profile,
        animator: new SpriteAnimator(sheet, sprite),
        getDialogues
      });
    };

    const makeGatekeeperDialogues = (key, minLevel) => () => {
      const dlg = VILLAGE_DIALOGUES.gatekeepers[key];
      const choices = [
        {
          label: dlg.questionLabel,
          onSelect: () => {
            this.dialogueBox.showMessage(dlg.speaker, dlg.dangerLines, choices);
          }
        },
        {
          label: dlg.closeLabel,
          onSelect: () => this.dialogueBox.close()
        }
      ];
      return {
        lines: (this.player.level || 1) >= minLevel ? dlg.unlockedLines : dlg.lockedLines,
        choices
      };
    };

    return [
      makeNPC('elder', () => ({
        lines: VILLAGE_DIALOGUES.elder.greetingLines,
        choices: this._getElderChoices()
      })),
      makeNPC('oracle', () => ({
        lines: [
          `Soy Orion, Astrólogo con IA en tiempo real (${this.aiBrain.getActiveModeLabel()}).`,
          VILLAGE_DIALOGUES.oracle.greetingSecondLine
        ],
        choices: this._buildOracleChoices()
      })),
      makeNPC('blacksmith', () => ({
        lines: VILLAGE_NPC_PROFILES.blacksmith.greetingLines,
        choices: this._getSmithChoices()
      })),
      makeNPC('herbalist', () => ({
        lines: VILLAGE_DIALOGUES.lyra.greetingLines,
        choices: this._getHerbChoices()
      })),
      makeNPC('kael', () => {
        const dlg = VILLAGE_DIALOGUES.kael;
        const choices = [
          {
            label: 'Cuéntame tu vida y oficio (Chapa)',
            onSelect: () => this._startNPCLifeRant('guard', choices)
          },
          {
            label: '¿Por qué no hay enemigos en el pueblo de noche?',
            onSelect: () => {
              this.dialogueBox.showMessage(dlg.speaker, dlg.nightSafeLines, choices);
            }
          },
          {
            label: '¿Puedo pasar a tu casa?',
            onSelect: () => {
              if (this.housePermissions.guard_house) {
                this.dialogueBox.showMessage(dlg.speaker, dlg.houseUnlockedLines, choices);
                return;
              }
              if (this.tilemap.bridgeForceUnlocked) {
                this.housePermissions.guard_house = true;
                if (this.music) this.music.playFanfare();
                this._saveGameToStorage();
                this.dialogueBox.showMessage(dlg.speaker, dlg.houseGrantedLines, choices);
                return;
              }
              this.dialogueBox.showMessage(dlg.speaker, dlg.houseDepositPromptLines, [
                {
                  label: `🪙 Pagar fianza de 25 Bytes [Tienes: ${this.player.coins}🪙]`,
                  onSelect: () => {
                    if (this.player.coins < 25) {
                      this.dialogueBox.showMessage(dlg.speaker, dlg.houseDepositInsufficientLines, choices);
                      return;
                    }
                    this.player.coins -= 25;
                    this.housePermissions.guard_house = true;
                    if (this.music) this.music.playFanfare();
                    this._saveGameToStorage();
                    this.dialogueBox.showMessage(dlg.speaker, dlg.houseDepositPaidLines, choices);
                  }
                },
                {
                  label: 'Hablaré con el Sabio Aurelio primero',
                  onSelect: () => {
                    this.dialogueBox.showMessage(dlg.speaker, dlg.houseAskElderLines, choices);
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
              this.dialogueBox.showMessage(dlg.speaker, dlg.bridgeReasonLines, choices);
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
              this.dialogueBox.showMessage(dlg.speaker, dlg.passAcceptedLines);
            }
          });
        }

        choices.push({
          label: 'Entendido, gracias',
          onSelect: () => this.dialogueBox.close()
        });

        return {
          lines: [this.tilemap.bridgeForceUnlocked ? dlg.statusOpen : dlg.statusClosed],
          choices
        };
      }),
      makeNPC('bit', () => {
        const dlg = VILLAGE_DIALOGUES.bit;
        const bitChoices = [
          {
            label: '¿Qué hay al otro lado del puente?',
            onSelect: () => this.dialogueBox.showMessage(dlg.speaker, dlg.acrossBridgeLines, bitChoices)
          },
          {
            label: '¿Cómo puedo cambiar la hora del día?',
            onSelect: () => this.dialogueBox.showMessage(dlg.speaker, dlg.timeOfDayLines, bitChoices)
          },
          {
            label: 'Entendido, buen servicio',
            onSelect: () => this.dialogueBox.close()
          }
        ];
        return {
          lines: this.tilemap.bridgeForceUnlocked
            ? ((this.player.level || 1) < 2 ? dlg.statusUnderLevelLines : dlg.statusReadyLines)
            : dlg.statusClosedLines,
          choices: bitChoices
        };
      }),
      makeNPC('byte', () => {
        const dlg = VILLAGE_DIALOGUES.byte;
        const vendor = SHOP_CATALOG.vendors.byte;
        const storeChoices = [
          {
            label: '🛒 Comprar consumibles (cantidad)',
            onSelect: () => this._openBuyShop(vendor.title, vendor.itemIds)
          },
          {
            label: `💾 Comprar Disquete de Respaldo (15 🪙) [Tienes: ${this.player.coins}🪙]`,
            onSelect: () => {
              if (this.player.coins < 15) {
                this.dialogueBox.showMessage(dlg.shortSpeaker, dlg.backupNoCoinsLines, storeChoices);
                return;
              }
              this.player.coins -= 15;
              this._saveGameToStorage();
              this.music.playFanfare();
              this.dialogueBox.showMessage(dlg.shortSpeaker, dlg.backupSavedLines, storeChoices);
            }
          },
          {
            label: '💰 Vender materiales / consumibles',
            onSelect: () => this._openSellShop(vendor.title)
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
          lines: dlg.greetingLines(this.player.coins),
          choices: storeChoices
        };
      }),
      makeNPC('clara', () => {
        const dlg = VILLAGE_DIALOGUES.clara;
        const vendor = SHOP_CATALOG.vendors.clara;
        const foodChoices = [
          {
            label: '🛒 Comprar panadería (cantidad)',
            onSelect: () => this._openBuyShop(vendor.title, vendor.itemIds)
          },
          {
            label: '💰 Vender provisiones / cosechas',
            onSelect: () => this._openSellShop(vendor.title)
          },
          {
            label: '¿Puedo pasar a tu casa?',
            onSelect: () => this.dialogueBox.showMessage(dlg.speaker, dlg.houseLines, foodChoices)
          },
          {
            label: 'Hasta luego, Clara',
            onSelect: () => this.dialogueBox.close()
          }
        ];

        return {
          lines: dlg.greetingLines(this.player.coins),
          choices: foodChoices
        };
      }),
      makeNPC('pip', () => {
        const dlg = VILLAGE_DIALOGUES.pip;
        const vendor = SHOP_CATALOG.vendors.pip;
        const herbChoices = [
          {
            label: '🛒 Comprar herboristería (cantidad)',
            onSelect: () => this._openBuyShop(vendor.title, vendor.itemIds)
          },
          {
            label: '💰 Vender hierbas / elixires',
            onSelect: () => this._openSellShop(vendor.title)
          },
          {
            label: 'Hasta luego, Pip',
            onSelect: () => this.dialogueBox.close()
          }
        ];

        return {
          lines: dlg.greetingLines(this.player.coins),
          choices: herbChoices
        };
      }),
      makeNPC('finn', () => ({
        lines: VILLAGE_DIALOGUES.finn.greetingLines(this.player.coins),
        choices: this._getFinnChoices()
      })),
      makeNPC('jailer', () => {
        const dlg = VILLAGE_DIALOGUES.jailer;
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
            this.dialogueBox.showMessage(dlg.warning1Title, dlg.warning1Lines(annoyingReason));
          } else if (this.jailerAngerCount === 2) {
            this.dialogueBox.showMessage(dlg.warning2Title, dlg.warning2Lines(annoyingReason));
          } else if (this.jailerAngerCount === 3) {
            if (this.music && typeof this.music.playPlayerHurt === 'function') {
              this.music.playPlayerHurt();
            }
            this.player.inflictBrokenHeartCurse();
            this.player.hp = Math.max(0.5, this.player.hp - 0.5);
            this.player.invulnTimer = 1.0;
            this._saveGameToStorage();
            this.dialogueBox.showMessage(dlg.fury3Title, dlg.fury3Lines(annoyingReason));
          } else {
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
            onSelect: () => this._releaseFromJail(dlg.apologyReleaseLines)
          },
          {
            label: 'Releer mis derechos de detenido',
            onSelect: () => this.dialogueBox.showMessage(dlg.speaker, dlg.rightsLines)
          },
          ...dlg.teaseOptions.map((opt) => ({
            label: opt.label,
            onSelect: () => irritateJailer(opt.reason)
          })),
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
              this._releaseFromJail(dlg.bribeReleaseLines);
            }
          });
        }

        const angerStatus = this.jailerAngerCount > 0 ? ` [Enfado: ${this.jailerAngerCount}/3]` : '';
        return {
          lines: dlg.greetingLines(timeLeft, angerStatus),
          choices: jailChoices
        };
      }),
      makeNPC('stage1_elder', () => {
        const dlg = VILLAGE_DIALOGUES.stage1Elder;
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
            onSelect: () => this.dialogueBox.showMessage(dlg.speaker, dlg.equipmentLines, sageStage1Choices)
          },
          {
            label: '¿Quién es el malvado Mister AI Alex?',
            onSelect: () => this.dialogueBox.showMessage(dlg.speaker, dlg.alexLines, sageStage1Choices)
          },
          {
            label: '¡No te fallaré, Sabio Aurelio!',
            onSelect: () => this.dialogueBox.close()
          }
        ];

        const statusIntro =
          this.player.hasArmor && this.player.hasSword
            ? dlg.statusAllEquipped
            : !this.player.hasArmor
              ? dlg.statusNoArmor
              : dlg.statusArmorOnly;

        return {
          lines: [statusIntro, dlg.closingReminder],
          choices: sageStage1Choices
        };
      }),
      makeNPC('supreme_god', () => {
        const dlg = VILLAGE_DIALOGUES.supremeGod;
        if (this.player.hasBrokenHeartCurse) {
          return {
            lines: dlg.cursedLines,
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
                      dlg.purificationSpeaker,
                      dlg.purifiedLines,
                      () => {
                        this.inventory.statusMessage = dlg.purifiedNotice;
                      }
                    );
                  });
                }
              },
              {
                label: 'Preguntar por la naturaleza de los Reinos Condenados',
                onSelect: () => this.dialogueBox.showMessage(dlg.speaker, dlg.loreLines)
              },
              {
                label: 'Aún no estoy listo para la expiación',
                onSelect: () => this.dialogueBox.close()
              }
            ]
          };
        }

        return {
          lines: dlg.blessedIntroLines,
          choices: [
            {
              label: 'Pedir la bendición cósmica',
              onSelect: () => {
                if (this.music && typeof this.music.playMenuSelect === 'function') {
                  this.music.playMenuSelect();
                }
                this.dialogueBox.showMessage(dlg.speaker, dlg.blessingLines);
              }
            },
            {
              label: 'Despedirse reverentemente',
              onSelect: () => this.dialogueBox.close()
            }
          ]
        };
      }),
      makeNPC('boreas', makeGatekeeperDialogues('boreas', 4)),
      makeNPC('vulcano', makeGatekeeperDialogues('vulcano', 3)),
      makeNPC('vael', makeGatekeeperDialogues('vael', 8)),
    // Los NPCs de la expansión se crean bajo demanda en ExpansionManager.init(game)
    ];
  }

  _createRegionalPatrols(sheet) {
    const patrols = [];
    for (const region of REGIONAL_PATROL_CONFIGS) {
      region.spots.forEach(([col, row, kind], i) => {
        const isDrone = kind === 'drone';
        patrols.push(new Enemy({
          id: `${kind}_${region.prefix}_${i + 1}`,
          name: isDrone ? `Dron Corrupto ${region.label}` : `Caballero Corrupto ${region.label}`,
          x: col * 16,
          y: row * 16,
          sceneId: region.sceneId,
          speed: region.speed,
          archetype: (region.archetypes && region.archetypes[i]) || (isDrone ? 'drone' : 'knight'),
          maxHp: isDrone ? region.droneHp : region.knightHp,
          aggroRange: 150,
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

  /**
   * (FIX 2.2) Pobla las salas de mazmorra que estaban vacías.
   * 3 esbirros por sala con arquetipos variados (sentinel, glitch, knight, drone).
   * `respawnOnEnter` mantiene las salas pobladas al volver a entrar.
   */
  _createDungeonRoomEnemies(sheet) {
    return DUNGEON_ROOM_ENEMY_SPAWNS.map(({ id, name, sceneId, col, row, hp, speed, aggro, xp, archetype, sprite, patrol }) =>
      new Enemy({
        id,
        name,
        x: col * 16,
        y: row * 16,
        sceneId,
        speed,
        maxHp: hp,
        aggroRange: aggro,
        xpReward: xp,
        archetype,
        respawnOnEnter: false,
        animator: new SpriteAnimator(sheet, sprite, 16, 16, 0.12),
        patrolPoints: patrol.map(([c, r]) => ({ x: c * 16, y: r * 16 }))
      })
    );
  }

  _createFirstStageEnemies() {
    const sheet = this.assets.charactersSheet;
    const bossConstructors = {
      GarbageCollectorBoss,
      StackOverflowBoss,
      PrototypeMicrowaveBoss,
      FinalBossAlex
    };

    return [
      ...FIRST_STAGE_ENEMY_SPAWNS.map(({ sprite, frameDuration, ...spawn }) =>
        new Enemy({
          ...spawn,
          animator: new SpriteAnimator(sheet, sprite, 16, 16, frameDuration)
        })
      ),
      ...this._createDungeonRoomEnemies(sheet),
      ...this._createRegionalPatrols(sheet),
      ...BOSS_SPAWNS.map(({ bossType, ...coords }) => new bossConstructors[bossType](coords))
    ];
  }

  _readExpansionStorage() {
    try {
      if (typeof localStorage === 'undefined') return {};
      const slotRaw = localStorage.getItem(EXPANSION_SLOT_SAVE_KEY);
      const legacyRaw = localStorage.getItem(EXPANSION_SAVE_KEY);
      const raw = slotRaw || legacyRaw;
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  _saveExpansionProgress() {
    try {
      if (typeof localStorage === 'undefined') return;
      const payload = {
        curriculum: Math.max(0, Math.floor(this.curriculum || 0)),
        francoRescued: Boolean(this.francoRescued),
        tonyForgiven: Boolean(this.tonyForgiven),
        alexCoreUnlocked: Boolean(this.tilemap && this.tilemap.alexCoreUnlocked),
        endingChosen: this.expansionEndingChosen || null,
        sceneId: this.tilemap ? this.tilemap.currentSceneId : 'valleverde_corp',
        playerX: this.player ? this.player.x : 12 * 16,
        playerY: this.player ? this.player.y : 15 * 16,
        coins: this.player ? (this.player.coins || 0) : 0,
        hp: this.player ? this.player.hp : 3,
        rosaUpgrades: {
          maxHp: this.player ? this.player.maxHp : 3,
          damageBonus: this.player ? (this.player.rosaDamageBonus || 0) : 0,
          staminaBonus: this.player ? (this.player.rosaStaminaBonus || 0) : 0,
          extraDashCharges: this.player ? (this.player.extraDashCharges || 0) : 0
        }
      };
      const serialized = JSON.stringify(payload);
      localStorage.setItem(EXPANSION_SAVE_KEY, serialized);
      localStorage.setItem(EXPANSION_SLOT_SAVE_KEY, serialized);
      if (this.expansionEndingChosen) {
        localStorage.setItem('expansion_ending_chosen', this.expansionEndingChosen);
      }
    } catch {
      // Sin almacenamiento persistente disponible
    }
  }

  /**
   * Inicia o reanuda la expansión "El Resurgir de Mister Alex IA" desde el slot independiente
   * `el_ojete_dorado_expansion_save_v1` y teletransporta al jugador a `valleverde_corp`.
   */
  startExpansion() {
    let savedSlot = null;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(EXPANSION_SLOT_SAVE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') savedSlot = parsed;
        }
      }
    } catch {
      savedSlot = null;
    }

    // Limpiar estado del juego base antes de arrancar o reanudar la expansión
    this._resetWorldToInitialState();
    this.isExpansionActive = true;
    this.isExpansionMode = true;
    this.gameState = 'expansion';

    if (savedSlot) {
      this._restoreExpansionSaveData(savedSlot);
      if (Number.isFinite(Number(savedSlot.coins))) {
        this.player.coins = Math.max(0, Number(savedSlot.coins));
      }
    } else {
      // Nueva partida de expansión
      this.curriculum = 0;
      this.francoRescued = false;
      this.tonyForgiven = false;
      this.expansionEndingChosen = null;
      this.player.hasSword = true;
      this.player.hasArmor = true;
      this.player.hasDash = true;
      this.player.hp = this.player.effectiveMaxHp;
      if (!this.player.equippedWeapon || this.player.equippedWeapon === 'default') {
        this.player.equipExpansionItem?.('boligrafo');
      }
      const boligrafoInfo = this.expansionEquipment?.boligrafo || {
        id: 'boligrafo',
        name: 'Bolígrafo Corporativo',
        description: 'Tinta barata de RRHH. Daño 1, velocidad muy rápida (0.15s).',
        iconIndex: 3
      };
      if (this.inventory && !this.inventory.items.some((it) => it && it.id === 'boligrafo')) {
        this.inventory.addItem({
          id: boligrafoInfo.id,
          name: boligrafoInfo.name,
          description: boligrafoInfo.description,
          iconIndex: boligrafoInfo.iconIndex
        });
      }
      this._syncFrancoNPCState();
    }

    this.expansionManager?.attachCachedEntities?.(this);

    if (this.tilemap) {
      this.tilemap.loadScene('valleverde_corp');
      this.camera?.setWorldBounds?.(this.tilemap.width, this.tilemap.height);
    }
    this.player.x = 12 * 16;
    this.player.y = 15 * 16;
    this.player.direction = 'up';
    this.player.stopMovement?.();
    this.camera?.resetCinematic?.();
    this.camera?.snapTo?.(this.player);

    this.music?.loadExpansionMusic?.();
    this.music?.setMode?.('valleverde_corp');

    if (this.menuSystem) {
      this.menuSystem.state = 'none';
      this.menuSystem.fadeAlpha = 0;
      this.menuSystem.showNotice('3 meses después...', 4.0);
    }
    this._saveExpansionProgress();
  }

  _initExpansionState() {
    this.curriculum = 0;
    this.curriculumFlashTimer = 0;
    this.vertederoRebootTimer = 0;
    this.kernelHackActive = false;
    this.kernelHudFlicker = false;
    this.bsodOverlayTimer = 0;
    this.debtGlitchTimer = 0;
    this.francoRescued = false;
    this.tonyForgiven = false;
    this.expansionEndingChosen = null;
    this.vertederoFloorOrder = [...VERTEDERO_BASE_ROOMS];

    if (!this.isExpansionMode) return;

    const saved = this._readExpansionStorage();
    const storedCurriculums = Number(saved.curriculum);
    this.curriculum = Number.isFinite(storedCurriculums) ? Math.max(0, Math.floor(storedCurriculums)) : 0;
    this.francoRescued = Boolean(saved.francoRescued);
    this.tonyForgiven = Boolean(saved.tonyForgiven);
    this.expansionEndingChosen = saved.endingChosen || null;
    if (this.tilemap && this.tilemap.expansionLoaded && typeof this.tilemap.configureVertederoFloors === 'function') {
      this.tilemap.configureVertederoFloors(this.vertederoFloorOrder);
    }
    if (saved.alexCoreUnlocked && this.tilemap && typeof this.tilemap.setAlexCoreUnlocked === 'function') {
      this.tilemap.setAlexCoreUnlocked(true);
    }
    this._applySavedRosaUpgrades(saved.rosaUpgrades);
    this._syncFrancoNPCState();
  }

  _applySavedRosaUpgrades(upgrades = null) {
    if (!this.player) return;
    const saved = upgrades || this._readExpansionStorage().rosaUpgrades;
    if (!saved || typeof saved !== 'object') return;
    if (Number.isFinite(Number(saved.maxHp)) && Number(saved.maxHp) > this.player.maxHp) {
      this.player.maxHp = Math.floor(Number(saved.maxHp));
      this.player.hp = Math.min(this.player.effectiveMaxHp, Math.max(this.player.hp, this.player.effectiveMaxHp));
    }
    if (Number.isFinite(Number(saved.damageBonus))) {
      this.player.rosaDamageBonus = Math.max(this.player.rosaDamageBonus || 0, Number(saved.damageBonus));
    }
    if (Number.isFinite(Number(saved.staminaBonus))) {
      this.player.rosaStaminaBonus = Math.max(this.player.rosaStaminaBonus || 0, Number(saved.staminaBonus));
      this.player.maxStamina = this.player.effectiveMaxStamina;
      this.player.stamina = this.player.effectiveMaxStamina;
    }
    if (Number.isFinite(Number(saved.extraDashCharges))) {
      this.player.extraDashCharges = Math.max(this.player.extraDashCharges || 0, Math.floor(Number(saved.extraDashCharges)));
      if (this.player.extraDashCharges > 0) {
        this.player.hasDash = true;
        this.player.dashChargesRemaining = this.player.maxDashCharges;
      }
    }
  }

  _restoreExpansionSaveData(data) {
    if (!data || typeof data !== 'object') return;
    const saved = this._readExpansionStorage();
    const stored = Number(saved.curriculum);
    const fromSave = Number(data.curriculum);
    this.curriculum = Math.max(
      Number.isFinite(stored) ? Math.floor(stored) : 0,
      Number.isFinite(fromSave) ? Math.floor(fromSave) : 0,
      0
    );
    this.francoRescued = Boolean(data.francoRescued || saved.francoRescued);
    if (Array.isArray(data.vertederoFloorOrder) && data.vertederoFloorOrder.length === 5) {
      this.vertederoFloorOrder = [...data.vertederoFloorOrder];
    } else {
      this.vertederoFloorOrder = [...VERTEDERO_BASE_ROOMS];
    }
    if (this.tilemap && typeof this.tilemap.configureVertederoFloors === 'function') {
      this.tilemap.configureVertederoFloors(this.vertederoFloorOrder);
    }
    if ((data.alexCoreUnlocked || saved.alexCoreUnlocked) && this.tilemap && typeof this.tilemap.setAlexCoreUnlocked === 'function') {
      this.tilemap.setAlexCoreUnlocked(true);
    }
    this._applySavedRosaUpgrades(data.rosaUpgrades || saved.rosaUpgrades);
    this.tonyForgiven = Boolean(data.tonyForgiven || saved.tonyForgiven);
    this.expansionEndingChosen = data.endingChosen || saved.endingChosen || null;
    this.vertederoRebootTimer = 0;
    this.kernelHackActive = false;
    this.kernelHudFlicker = false;
    this.bsodOverlayTimer = 0;
    this.debtGlitchTimer = 0;
    this._syncFrancoNPCState();
    this._saveExpansionProgress();
  }

  _enterAlexCoreFromKernel() {
    if (!this.tilemap) return;
    const hasCoreScene = Boolean(this.tilemap.scenes && this.tilemap.scenes.ai_nucleus_core);
    const targetScene = hasCoreScene ? 'ai_nucleus_core' : 'valleverde_corp';
    if (this.sceneTransitions && typeof this.sceneTransitions.executeStageTransition === 'function') {
      this.sceneTransitions.executeStageTransition({
        type: 'stage_transition',
        targetScene,
        targetX: (hasCoreScene ? 6.5 : 11.5) * 16,
        targetY: (hasCoreScene ? 9.8 : 2.8) * 16,
        forceDirection: hasCoreScene ? 'up' : 'down'
      });
    }
  }

  _renderKernelBSODOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(29, 78, 216, 0.92)';
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `bold 24px ${UI_FONT}`;
    ctx.fillText(':(', 32, 48);

    ctx.font = `bold 7px ${UI_FONT}`;
    ctx.fillText('KERNEL_SECURITY_CHECK_FAILURE', 32, 76);
    ctx.font = `5.5px ${UI_FONT}`;
    ctx.fillStyle = '#dbeafe';
    ctx.fillText('El proceso del sistema encontró un error inesperado.', 32, 92);
    ctx.fillText('Deteniendo interfaz y purgando acceso...', 32, 104);
    ctx.restore();
  }

  _syncFrancoNPCState() {
    if (!Array.isArray(this.npcs)) return;
    const franco = this.npcs.find((n) => n && n.expansionId === 'franco_pancho');
    if (!franco) return;
    if (this.francoRescued) {
      franco.rescued = true;
      franco.isCompanion = false;
      franco.sceneId = 'valleverde_corp';
      franco.homeSceneId = 'valleverde_corp';
      franco.x = 7 * 16;
      franco.y = 14 * 16;
    } else {
      franco.rescued = false;
      franco.isCompanion = false;
      franco.sceneId = 'vertedero_piso_3';
      franco.x = 3 * 16;
      franco.y = 4 * 16;
    }
  }

  _shuffleVertederoOrder() {
    const order = [...VERTEDERO_BASE_ROOMS];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    return order;
  }

  _resetVertederoEnemiesAndDrops() {
    if (Array.isArray(this.droppedCoins)) {
      this.droppedCoins = this.droppedCoins.filter(
        (c) => !c || typeof c.sceneId !== 'string' || !c.sceneId.startsWith('vertedero_')
      );
    }
    if (Array.isArray(this.enemies)) {
      for (const en of this.enemies) {
        if (en && typeof en.sceneId === 'string' && en.sceneId.startsWith('vertedero_') && typeof en.reset === 'function') {
          en.reset();
        }
      }
    }
  }

  _startVertederoRun() {
    this.vertederoFloorOrder = this._shuffleVertederoOrder();
    if (this.tilemap && typeof this.tilemap.configureVertederoFloors === 'function') {
      this.tilemap.configureVertederoFloors(this.vertederoFloorOrder);
    }
    this._resetVertederoEnemiesAndDrops();
    this._syncFrancoNPCState();
  }

  _syncFrancoCompanionOnTransition(targetScene) {
    if (!Array.isArray(this.npcs)) return;
    const franco = this.npcs.find((n) => n && n.expansionId === 'franco_pancho');
    if (!franco || !franco.rescued) return;

    const insideVertedero =
      typeof targetScene === 'string' && targetScene.startsWith('vertedero_');
    if (insideVertedero && franco.isCompanion) {
      franco.sceneId = targetScene;
      franco.x = Math.max(24, this.player.x - 14);
      franco.y = this.player.y;
      franco.direction = this.player.direction || 'up';
    } else {
      const wasCompanion = franco.isCompanion;
      franco.isCompanion = false;
      franco.sceneId = 'valleverde_corp';
      franco.homeSceneId = 'valleverde_corp';
      franco.x = 7 * 16;
      franco.y = 14 * 16;
      franco.direction = 'down';
      if (wasCompanion && targetScene === 'valleverde_corp' && this.menuSystem) {
        this.menuSystem.showNotice('✅ Franco el Pancho llegó a salvo a Valleverde 2.0.', 2.6);
      }
    }
  }

  _triggerVertederoSoftReset() {
    this.vertederoRebootTimer = 2.0;
    this.player.stopMovement();
    this.player.hp = 0;
    this.player.thrownLogs = [];
    this.player.energySlashes = [];
    if (Array.isArray(this.enemies)) {
      for (const en of this.enemies) {
        if (en && en.shots) en.shots = [];
        if (en && en.isBoss && !en.dead && typeof en.resetCombatState === 'function') {
          en.resetCombatState();
        }
      }
    }
    if (this.music && typeof this.music.playError === 'function') {
      this.music.playError();
    }
    this._saveExpansionProgress();
  }

  _finishVertederoSoftReset() {
    this.vertederoRebootTimer = 0;
    this.vertederoFloorOrder = this._shuffleVertederoOrder();
    if (this.tilemap && typeof this.tilemap.configureVertederoFloors === 'function') {
      this.tilemap.configureVertederoFloors(this.vertederoFloorOrder);
    }
    this.tilemap.loadScene('vertedero_piso_1');
    this.camera.setWorldBounds(this.tilemap.width, this.tilemap.height);

    this.player.hp = this.player.effectiveMaxHp;
    this.player.stamina = this.player.effectiveMaxStamina;
    this.player.invulnTimer = 1.5;
    this.player.knockbackTimer = 0;
    this.player.x = 11.5 * 16;
    this.player.y = 15.2 * 16;
    this.player.direction = 'up';
    this.camera.snapTo(this.player);

    this._resetVertederoEnemiesAndDrops();
    this._syncFrancoNPCState();
    this._saveExpansionProgress();
    this._saveGameToStorage();
    if (this.menuSystem) {
      this.menuSystem.showNotice(
        `♻️ Sistema reiniciado · Piso 1 (${this.curriculum} 📄 conservados)`,
        2.6
      );
    }
  }

  _renderVertederoRebootOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(7, 4, 15, 0.94)';
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    const progress = 1 - Math.max(0, Math.min(1, this.vertederoRebootTimer / 2.0));
    const cx = VIEWPORT_WIDTH / 2;
    const cy = VIEWPORT_HEIGHT / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 10px ${UI_FONT}`;
    ctx.fillStyle = '#f87171';
    ctx.fillText('FALLO CRÍTICO EN VERTEDERO 2.0', cx, cy - 28);

    ctx.font = `bold 9px ${UI_FONT}`;
    ctx.fillStyle = '#c084fc';
    ctx.fillText('REINICIANDO SISTEMA...', cx, cy - 6);

    const barW = 140;
    const barH = 8;
    const bx = Math.round(cx - barW / 2);
    const by = cy + 10;
    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(bx, by, barW, barH);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, barW - 1, barH - 1);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(bx + 2, by + 2, Math.round((barW - 4) * progress), barH - 4);

    ctx.font = `6.5px ${UI_FONT}`;
    ctx.fillStyle = '#e9d5ff';
    ctx.fillText(`Currículums guardados en caché: 📄 ${this.curriculum || 0}`, cx, cy + 32);
    ctx.restore();
  }

  /**
   * Sincroniza la presencia de los NPCs con el ciclo Día/Noche:
   * A las 22:00 PM se recogen los puestos y duermen en sus camas.
   * A las 06:00 AM despiertan y regresan a sus oficios y puestos en la plaza.
   */
  _updateNPCSchedules() {
    const isNight = this.dayNight.timeOfDayHours >= 22 || this.dayNight.timeOfDayHours < 6;
    // (FIX NPC.6) No se manda a la cama a quien está a mitad de una frase: se pospone
    // su cambio de rutina hasta que el diálogo termine.
    const talkingNPC = this.dialogueBox && this.dialogueBox.active ? this.dialogueBox.currentNPC : null;
    for (const npc of this.npcs) {
      if (!npc.homeSceneId || npc.homeSceneId === 'overworld' || npc.homeSceneId === 'valleverde_corp') continue;
      if (npc === talkingNPC) {
        this._npcsSchedulePending = true;
        continue;
      }

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
   * (FIX NPC.4) Amenaza de combate real para un NPC: el enemigo despierto (persiguiendo
   * o alertado) más cercano dentro del radio. No basta con que haya esbirros vivos en la
   * escena: solo cuentan los que están realmente despiertos y persiguiendo.
   */
  _findNPCThreat(npc, enemies, radius = 160) {
    if (!npc || !Array.isArray(enemies) || enemies.length === 0) return null;
    let best = null;
    let bestDist = radius;
    for (const enemy of enemies) {
      if (!enemy || enemy.dead) continue;
      const awake = enemy.isBoss
        ? enemy.activeCombat !== false
        : (enemy.brain && (enemy.brain.state === 'CHASE' || enemy.brain.state === 'ALERT'));
      if (!awake) continue;
      const d = Math.hypot(enemy.centerX - npc.centerX, enemy.centerY - npc.centerY);
      if (d < bestDist) {
        bestDist = d;
        best = enemy;
      }
    }
    return best;
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
      this.dialogueBox.showMessage(
        VILLAGE_DIALOGUES.elder.speaker,
        VILLAGE_DIALOGUES.elder.houseWelcomeLines,
        this._getElderChoices()
      );
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

    return WORLD_ITEMS_DATA.map(({ useAbyssalPointerSpawn, ...itemConfig }) => {
      const coords = useAbyssalPointerSpawn
        ? {
            x: this.abyssalPointerSpawn.x,
            y: this.abyssalPointerSpawn.y,
            sceneId: this.abyssalPointerSpawn.sceneId || 'first_stage'
          }
        : {};
      return new WorldItem({
        ...itemConfig,
        ...coords,
        itemsSheet,
        ...(itemConfig.isChest ? { tilesetSheet } : {})
      });
    });
  }

  start() {
    this.loop.start();
  }

  /** (FIX M2.3) Registra el listener de visibilidad que pausa la partida. */
  _installAutoPause() {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._autoPauseOnHidden();
    });
  }

  /**
   * (FIX M2.3) Pausa solo en partida activa: no en título, pausa, diálogo,
   * inventario, ficha, diario ni cinemáticas.
   */
  _autoPauseOnHidden() {
    if (!this.menuSystem || this.menuSystem.state !== 'none') return;
    if (this.animeCutscenes && this.animeCutscenes.isActive) return;
    // Si ya hay un modal DOM abierto (chat IA, cloud, score), la partida ya está bloqueada
    if (this.input && typeof this.input.isDOMBlocked === 'function' && this.input.isDOMBlocked()) {
      return;
    }
    if (
      (this.dialogueBox && this.dialogueBox.active) ||
      (this.inventory && this.inventory.isOpen) ||
      (this.characterStats && this.characterStats.isOpen) ||
      (this.questLogView && this.questLogView.isOpen)
    ) {
      return;
    }
    if (this.player) this.player.stopMovement();
    this.menuSystem.openPauseMenu();
  }

  /**
   * (FIX M2.6) Heurística de gama baja: pocos núcleos o poca RAM.
   * deviceMemory solo existe en Chromium; si falta no se penaliza.
   * @returns {'low'|'normal'|'high'}
   */
  _detectPerformanceProfile() {
    try {
      if (typeof navigator === 'undefined') return 'normal';
      const cores = Number(navigator.hardwareConcurrency) || 0;
      const memory = Number(navigator.deviceMemory) || 0;
      if ((cores > 0 && cores < 4) || (memory > 0 && memory < 4)) return 'low';
      if (cores >= 8 && (memory === 0 || memory >= 8)) return 'high';
      return 'normal';
    } catch (_) {
      return 'normal';
    }
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
      // (FIX H1) El Guardián del Stack Overflow solo se manifiesta tras resolver el puzle de las Minas
      if (e.id === 'boss_stack_overflow' && Boolean(this.tilemap?.minesPuzzle?.solved) !== true) {
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

    // (FIX 2.3) Cloacas del Legacy: válvula de presión que drena el canal
    if (currentScene === 'sewers_puzzle' && this.tilemap.sewersPuzzle) {
      const valve = this.tilemap.sewersPuzzle.valve;
      const vx = valve.col * 16 + 8;
      const vy = valve.row * 16 + 8;
      if (Math.hypot(this.player.centerX - vx, this.player.centerY - vy) <= 30) {
        return {
          kind: 'sewers_valve',
          target: { col: valve.col, row: valve.row, centerX: vx, y: vy },
          label: this.tilemap.sewersPuzzle.solved
            ? '[E] Válvula de Presión [Canal Drenado]'
            : `[E] Girar Válvula de Presión (${valve.turns}/${valve.turnsRequired})`
        };
      }
    }

    // (FIX 2.3) Minas de la Recursión: runas de bit (se leen con [E], se golpean con la espada)
    if (currentScene === 'mines_puzzle' && this.tilemap.minesPuzzle) {
      for (const mono of Object.values(this.tilemap.minesPuzzle.monoliths)) {
        const mx = mono.col * 16 + 8;
        const my = mono.row * 16 + 8;
        if (Math.hypot(this.player.centerX - mx, this.player.centerY - my) <= 30) {
          return {
            kind: 'mines_monolith',
            target: { ...mono, centerX: mx, y: my },
            label: `[E] Inspeccionar ${mono.name} (${mono.symbol})`
          };
        }
      }
    }

    // (FIX 2.3) La Forja del Prototipo: 2 reguladores térmicos
    if (currentScene === 'forge_puzzle' && this.tilemap.forgePuzzle) {
      for (const reg of Object.values(this.tilemap.forgePuzzle.positions)) {
        const rx = reg.col * 16 + 8;
        const ry = reg.row * 16 + 8;
        if (Math.hypot(this.player.centerX - rx, this.player.centerY - ry) <= 30) {
          const on = this.tilemap.forgePuzzle.regulators[reg.side] === 1;
          return {
            kind: 'forge_regulator',
            target: { ...reg, centerX: rx, y: ry },
            label: `[E] ${on ? 'Desactivar' : 'Activar'} ${reg.name} [P${on ? 1 : 0}]`
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
    const item = this.inventory.getSelectedItem(this.player);
    if (!item) return;

    if (this.isExpansionActive || this.isExpansionMode) {
      const corpEquipped = this.inventory.equipSelectedExpansionItem?.(this.player);
      if (corpEquipped) {
        this.music?.playMenuSelect?.();
        return;
      }
    }

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
      this.player.hp = this.player.effectiveMaxHp;
      this.inventory.consumeItem('potion', 1);
      this.inventory.statusMessage = '¡Bebiste la Poción! Vida restaurada.';
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
        this._shakeCamera(5.0, 0.35);
        this._flashScreen('#a855f7', 0.4);
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

  _ensurePlayerHotbar() {
    if (!this.player) return [null, null, null, null, null];
    if (!Array.isArray(this.player.hotbar) || this.player.hotbar.length !== 5) {
      this.player.hotbar = [null, null, null, null, null];
    }
    if (!Array.isArray(this.player.hotbarFlashTimers) || this.player.hotbarFlashTimers.length !== 5) {
      this.player.hotbarFlashTimers = [0, 0, 0, 0, 0];
    }
    return this.player.hotbar;
  }

  /** Vacía los slots de Hotbar cuyo consumible se haya agotado en el inventario. */
  syncHotbarWithInventory() {
    const hotbar = this._ensurePlayerHotbar();
    if (!this.inventory) return hotbar;
    for (let i = 0; i < 5; i++) {
      const id = hotbar[i];
      if (id && this.inventory.getItemCount(id) <= 0) {
        hotbar[i] = null;
      }
    }
    return hotbar;
  }

  /** Asigna un consumible al índice de Hotbar (0..4, teclas 1..5). */
  assignHotbarSlot(slotIndex = 0, explicitItem = null) {
    const item = explicitItem || (this.inventory ? this.inventory.getSelectedItem() : null);
    if (!item || (this.inventory && !this.inventory.isConsumable(item))) {
      this.menuSystem?.showNotice('Solo puedes asignar ítems consumibles a la Hotbar (1-5).', 2.0);
      return false;
    }
    const hotbar = this._ensurePlayerHotbar();
    const targetIdx = Math.max(0, Math.min(4, Math.floor(slotIndex)));
    for (let i = 0; i < 5; i++) {
      if (hotbar[i] === item.id) hotbar[i] = null;
    }
    hotbar[targetIdx] = item.id;
    this.player.hotbarFlashTimers[targetIdx] = 0.2;
    this.music?.playMenuSelect?.();
    if (this.inventory) {
      this.inventory.statusMessage = `Asignado ${item.name} al slot [${targetIdx + 1}]`;
    }
    this.menuSystem?.showNotice(`🎒 ${item.name} asignado a Hotbar [${targetIdx + 1}]`, 2.0);
    return true;
  }

  _assignSelectedToNextHotbarSlot() {
    const hotbar = this._ensurePlayerHotbar();
    const emptyIdx = hotbar.indexOf(null);
    const selected = this.inventory ? this.inventory.getSelectedItem() : null;
    const currentIdx = selected ? hotbar.indexOf(selected.id) : -1;
    const targetIdx = currentIdx !== -1
      ? (currentIdx + 1) % 5
      : (emptyIdx !== -1 ? emptyIdx : 0);
    return this.assignHotbarSlot(targetIdx, selected);
  }

  _getQuickSlotIndex(quickKey = 'Digit1') {
    const keyToIndex = {
      Digit1: 0,
      Digit2: 1,
      Digit3: 2,
      Digit4: 3,
      Digit5: 4
    };
    return typeof quickKey === 'string' && quickKey in keyToIndex ? keyToIndex[quickKey] : -1;
  }

  _getQuickSlotConsumable(quickKey = 'Digit1') {
    if (!this.inventory || !Array.isArray(this.inventory.items)) return null;
    const index = this._getQuickSlotIndex(quickKey);
    if (index < 0 || index > 4) return null;

    this.syncHotbarWithInventory();
    const hotbar = this._ensurePlayerHotbar();
    const assignedId = hotbar[index];
    if (!assignedId) return null;

    const item = this.inventory.items.find((it) => it && it.id === assignedId && (it.qty || 1) > 0);
    if (!item) {
      hotbar[index] = null;
      return null;
    }
    return item;
  }

  _useQuickSlotConsumable(quickKey = 'Digit1') {
    const slotIndex = this._getQuickSlotIndex(quickKey);
    if (slotIndex >= 0 && slotIndex < 5) {
      this._ensurePlayerHotbar();
      this.player.hotbarFlashTimers[slotIndex] = 0.2;
    }
    const item = this._getQuickSlotConsumable(quickKey);
    if (!item) {
      this.menuSystem.showNotice(`🎒 Slot [${slotIndex + 1}] vacío (asigna un consumible en Mochila [I])`, 2.0);
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
    this.syncHotbarWithInventory();
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
          this._flashScreen(ped.id === 'gc' ? '#10b981' : (ped.id === 'stack' ? '#38bdf8' : '#ef4444'), 0.35);
          this._shakeCamera(4.0, 0.3);
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

    // (FIX 2.3) Puzles de mazmorra
    if (action.kind === 'sewers_valve') {
      this._handleSewersValve();
      return;
    }

    if (action.kind === 'mines_monolith') {
      this._showMinesMonolithClue(action.target);
      return;
    }

    if (action.kind === 'forge_regulator') {
      this._handleForgeRegulator(action.target?.side);
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
            this.questLog.advanceStep('quest_code_temples', '¡Armadura y Espada consagradas! Derrota al Guardián del Stack Overflow en la Arena de las Minas para abrir la ruta a la Ciudadela.');
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
              'El Guardián del Stack Overflow aguarda al otro lado del puzle de las Minas de la Recursión.'
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
            this._handleBlockedDoor(door, 'Cerrado con Cerrojo', isDay ? [
              'Cerrado. Su dueño está atendiendo su puesto en la plaza.',
              'Habla con su propietario en el pueblo si necesitas autorización para acceder.'
            ] : [
              'La puerta está cerrada por dentro con pestillo nocturno.',
              'Necesitas autorización expresa de su dueño para entrar.'
            ]);
            return;
          }
        }
      }

      if (door.blocked) {
        this._handleBlockedDoor(
          door,
          door.blockTitle || 'Acceso Restringido',
          door.blockLines || ['Esta compuerta permanece sellada por la Corporación Alex IA.']
        );
        return;
      }

      if (door.type === 'bridge_gate') {
        this._handleBlockedDoor(door, 'Puente del Este · Precintado', [
          'El paso hacia las Tierras Sagradas del este está bloqueado por una sólida barrera de madera.',
          'Los Guardias del Binario custodian el acceso e impiden el paso.',
          'Habla con los guardias o visita al Gran Sabio Aurelio en su casa (al noroeste, tejado azul) para conocer la causa del cierre y obtener autorización.'
        ]);
        return;
      }

      if (door.type === 'stage_locked') {
        this._handleBlockedDoor(door, 'Portal Sagrado Sellado', [
          'El Portal hacia Valleverde permanece cerrado por un sello protector del Alba.',
          'Debes equiparte primero con la [Armadura del Alba] (Oeste) y la [Espada del Alba] (Norte) para poder hacer frente a las tinieblas de Mister AI Alex.'
        ]);
        return;
      }

      if (door.type === 'stage_transition') {
        // 1. GATEKEEPING: las reglas viven en DoorGatekeeper
        const block = getDoorBlock(door.targetScene, this.player);
        if (block) {
          this._handleBlockedDoor(door, block.title, block.lines);
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

  /**
   * (FIX 2.3) Cloacas del Legacy: gira la válvula de presión. Al tercer giro el canal
   * se drena, cae la barrera y se abre la puerta norte hacia la Fosa de la Memoria.
   */
  _handleSewersValve() {
    const res = this.tilemap?.toggleSewersValve?.();
    if (!res) return;

    if (res.alreadySolved) {
      this.menuSystem.showNotice('🌊 El canal ya está drenado y el paso norte despejado.', 2.5);
      return;
    }

    if (this.music && typeof this.music.playMenuSelect === 'function') {
      this.music.playMenuSelect();
    }

    if (!res.solved) {
      this.menuSystem.showNotice(`🔧 Válvula girada (${res.turns}/${res.turnsRequired})`, 2.0);
      return;
    }

    if (this.music && typeof this.music.playFanfare === 'function') {
      this.music.playFanfare();
    }
    if (this.animeCutscenes) {
      this._flashScreen('#34d399', 0.35);
    }
    this._shakeCamera(3.5, 0.35);
    this.dialogueBox.showMessage('🌊 [CANAL DE MEMORIA DRENADO]', [
      'La válvula de presión libera el caudal residual con un silbido metálico...',
      'El canal fétido se vacía y deja al descubierto el limo del fondo.',
      'La barrera de presión del norte se disipa: el paso a la Fosa de la Memoria queda abierto.'
    ]);
  }

  /** (FIX 2.3) Lee la inscripción de una runa de bit de las Minas de la Recursión. */
  _showMinesMonolithClue(mono) {
    if (!mono) return;
    if (this.music && typeof this.music.playMenuSelect === 'function') {
      this.music.playMenuSelect();
    }
    const struck = this.tilemap?.minesPuzzle?.stack?.includes(mono.id);
    this.dialogueBox.showMessage(`⛏️ [${String(mono.name).toUpperCase()}]`, [
      `Inscripción minera: [ ${mono.symbol} ] — valor ${mono.weight}`,
      mono.clue,
      struck
        ? 'Esta runa ya está apilada en el registro de memoria.'
        : 'Golpea las runas con la espada en orden MSB → LSB. Un golpe fuera de orden desbordará el registro (-0.5 corazón).'
    ]);
  }

  /**
   * (FIX 2.3) Golpea una runa de bit de las Minas. Orden correcto: 4 → 2 → 1.
   * Un error reinicia la pila y provoca un desbordamiento de registro.
   */
  _handleMinesMonolithStrike(monolithId) {
    const res = this.tilemap?.hitMinesMonolith?.(monolithId);
    if (!res) return;

    if (res.alreadySolved) {
      this.menuSystem.showNotice('⛏️ El registro de memoria ya está completo. El paso norte permanece abierto.', 2.5);
      return;
    }

    if (res.success && res.finished) {
      if (this.music && typeof this.music.playFanfare === 'function') {
        this.music.playFanfare();
      }
      if (this.animeCutscenes) {
        this._flashScreen('#38bdf8', 0.4);
      }
      this._shakeCamera(4.5, 0.4);
      this._saveGameToStorage();
      this.dialogueBox.showMessage('⛏️ [REGISTRO DE MEMORIA COMPLETO]', [
        '¡Las tres runas de bit han sido apiladas en el orden correcto (4 → 2 → 1)!',
        'El registro de memoria emite una pulsación cian y la barrera rúnica se desvanece.',
        'El portal septentrional hacia la cámara del Guardián del Stack Overflow permanece abierto.'
      ]);
    } else if (res.success) {
      if (this.music && typeof this.music.playMenuSelect === 'function') {
        this.music.playMenuSelect();
      }
      this.menuSystem.showNotice(`✨ Runa apilada en el registro (${res.step}/${res.total})`, 2.5);
    } else {
      if (this.music && typeof this.music.playPlayerHurt === 'function') {
        this.music.playPlayerHurt();
      }
      if (this.animeCutscenes) {
        this._flashScreen('#ef4444', 0.35);
      }
      this._shakeCamera(4.0, 0.3);
      this.player.takeDamage(1, this.music);
      this.menuSystem.showNotice('🌀 Desbordamiento de registro: orden de bits incorrecto (-0.5 corazón)', 2.5);
      this.dialogueBox.showMessage('🌀 [DESBORDAMIENTO DE REGISTRO]', [
        'La runa golpeada no correspondía al siguiente bit en la secuencia.',
        'El registro de memoria se vacía y la pila de runas vuelve a cero.',
        'Recuerda: el flujo se evalúa del bit de mayor peso al menor (4 → 2 → 1).'
      ]);
    }
  }

  /** (FIX 2.3) Activa o desactiva un regulador térmico de la Forja del Prototipo. */
  _handleForgeRegulator(side) {
    const res = this.tilemap?.toggleForgeRegulator?.(side);
    if (!res) return;

    if (res.alreadySolved) {
      this.menuSystem.showNotice('🔥 Ambos reguladores están activos. La cámara del Microondas permanece abierta.', 2.5);
      return;
    }

    if (this.music && typeof this.music.playMenuSelect === 'function') {
      this.music.playMenuSelect();
    }

    if (!res.justSolved) {
      const left = res.regulators.LEFT === 1 ? '1' : '0';
      const right = res.regulators.RIGHT === 1 ? '1' : '0';
      this.menuSystem.showNotice(`🔥 Reguladores térmicos — Izq: ${left} · Der: ${right}`, 2.0);
      return;
    }

    if (this.music && typeof this.music.playFanfare === 'function') {
      this.music.playFanfare();
    }
    if (this.animeCutscenes) {
      this._flashScreen('#f97316', 0.4);
    }
    this._shakeCamera(4.0, 0.35);
    this._saveGameToStorage();
    this.dialogueBox.showMessage('🔥 [PRESIÓN TÉRMICA ESTABILIZADA]', [
      '¡Ambos reguladores alcanzan presión 1 simultáneamente!',
      'El vapor se redirige a las calderas y la barrera térmica se apaga.',
      'La cámara de contención del Microondas Prototipo V0.1 Alpha está abierta.'
    ]);
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
        this._shakeCamera(5.0, 0.45);
        this._flashScreen('#fde047', 0.4);
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
        this._shakeCamera(6.5, 0.45);
        this._flashScreen('#ef4444', 0.4);
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

  /**
   * Invoca al Demonio Vengador encima del animal atacado, muestra el banner de alerta y ruge.
   */
  spawnAnimalDemon(animal = null) {
    const sceneId = this.tilemap?.currentSceneId || animal?.sceneId || 'overworld';
    const spawnX = (typeof animal?.x === 'number' ? animal.x : this.player?.x || 0) - 4;
    const spawnY = (typeof animal?.y === 'number' ? animal.y : this.player?.y || 0) - 4;

    this.activeDemon = new DemonVengador({
      x: spawnX,
      y: spawnY,
      sceneId
    });
    this.demonBannerTimer = 4.0;

    if (this.music) {
      if (typeof this.music.playSFX === 'function') {
        this.music.playSFX('boss_roar', { volume: 1.0, playbackRate: 0.78 });
      }
    }
    this._shakeCamera(6, 0.55);
    this._flashScreen('#dc2626', 0.5, 0.45);

    if (this.menuSystem && typeof this.menuSystem.showNotice === 'function') {
      this.menuSystem.showNotice('🔥 ¡HAS PROVOCADO AL SEÑOR DE LAS OVEJAS!', 3.8);
    }
    return this.activeDemon;
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
              this._flashScreen('#f97316', 0.25);
              this._shakeCamera(2.5, 0.2);
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

  /** (FIX 3) Sincroniza la puerta norte de mines_boss_arena con el Núcleo del Stack. */
  _syncMinesBossArenaGate() {
    if (
      this.tilemap &&
      this.tilemap.currentSceneId === 'mines_boss_arena' &&
      typeof this.tilemap.setMinesBossArenaGate === 'function'
    ) {
      this.tilemap.setMinesBossArenaGate(Boolean(this.player?.dungeonCores?.stack));
    }
  }

  /**
   * Regla espacial 2D: si sales por el ESTE apareces al OESTE del nuevo mapa,
   * y viceversa. Margen de 2 tiles para no reactivar la puerta de regreso.
   */
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

  /**
   * (EXPANSIÓN v2.0) Cinemática rápida (3s) al entrar por primera vez a inakito_office.
   */
  _triggerInakitoOfficeIntro(boss) {
    if (!boss || !boss.isBoss || boss.dead) return;
    this.bossCutscenesSeen.boss_inakito = true;
    boss.introCutscenePlayed = true;
    boss.activeCombat = false;
    this.music?.loadExpansionMusic?.();

    const startFight = () => {
      boss.activeCombat = true;
      if (this.music && typeof this.music.playBossMusic === 'function') {
        this.music.playBossMusic('boss_iñakito');
      }
      this._saveGameToStorage();
    };

    if (this.animeCutscenes && this.animeCutscenes.director) {
      this.animeCutscenes.director.play({
        id: 'inakito_office_intro',
        title: 'CUBÍCULO DE IÑAKITO 2.0',
        duration: 3.0,
        background: 'office',
        particles: 'steam',
        musicMode: 'boss_iñakito',
        timeline: [
          { time: 0, action: 'fade', to: 0, duration: 0.35 },
          { time: 0, action: 'camera', x: 160, y: 100, zoom: 1.5, duration: 0.01 },
          { time: 0, action: 'spawn', actor: 'player', x: 112, y: 120 },
          { time: 0, action: 'spawn', actor: 'inakito', x: 190, y: 108 },
          { time: 0.2, action: 'sfx', name: 'coffee_sip' },
          {
            time: 0.3,
            action: 'dialogue',
            speaker: 'Iñakito 2.0 · El Becario Eterno',
            text: '¿Vienes a evaluarme? ¡Llevo 7 años esperando el contrato indefinido!',
            duration: 2.4
          },
          { time: 3.0, action: 'end' }
        ]
      }, startFight);
    } else if (this.dialogueBox) {
      this.dialogueBox.showMessage('Iñakito 2.0 · El Becario Eterno', [
        '¿Vienes a evaluarme? ¡Llevo 7 años esperando el contrato indefinido!'
      ], startFight);
    } else {
      startFight();
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

  _buildBaseVictoryRecord() {
    const scoreResult = calculateGameScore(this.totalPlayTimeSeconds, this.totalDeaths);
    return {
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
  }

  _canChooseMergeEnding() {
    const tony = Array.isArray(this.npcs)
      ? this.npcs.find((n) => n.expansionId === 'tony_randazzo')
      : null;
    if (tony && tony.forgiven) {
      this.tonyForgiven = true;
    }
    return Boolean(this.francoRescued && this.tonyForgiven);
  }

  shouldTriggerTechnicalDebt(endingKey = this.expansionEndingChosen) {
    return (this.curriculum || 0) >= 20 && (endingKey === 'B' || endingKey === 'C');
  }

  _openAlexUpdateEndingDialogue() {
    if (!this.dialogueBox) return;
    const endings = {
      A: {
        label: 'Final A · Revertir el Update',
        line: 'El futuro se borró. Pero tú recordarás lo que pasó.'
      },
      B: {
        label: 'Final B · Arreglar el Update',
        line: 'No es perfecto. Pero es nuestro.'
      },
      C: {
        label: 'Final C · Fusionar (Secreto)',
        line: 'Dos mundos. Un solo Ojete Dorado.'
      }
    };
    const choices = [
      {
        label: endings.A.label,
        onSelect: () => {
          this.dialogueBox.close();
          this._playExpansionEnding('A');
        }
      },
      {
        label: endings.B.label,
        onSelect: () => {
          this.dialogueBox.close();
          this._playExpansionEnding('B');
        }
      }
    ];
    if (this._canChooseMergeEnding()) {
      choices.push({
        label: endings.C.label,
        onSelect: () => {
          this.dialogueBox.close();
          this._playExpansionEnding('C');
        }
      });
    }

    this.dialogueBox.showMessage('Mister Alex IA · El Update', [
      'No me has derrotado. Me has... reestructurado.',
      'El Núcleo está abierto ante ti. ¿Qué harás con el servidor del futuro?'
    ], choices);
  }

  _playExpansionEnding(endingKey) {
    const endingMeta = {
      A: {
        label: 'Final A · Revertir el Update',
        line: 'El futuro se borró. Pero tú recordarás lo que pasó.',
        headline: '★ FINAL A · UPDATE REVERTIDO ★',
        description: 'Destruiste el servidor y devolviste Valleverde a su forma clásica.'
      },
      B: {
        label: 'Final B · Arreglar el Update',
        line: 'No es perfecto. Pero es nuestro.',
        headline: '★ FINAL B · FUTURO LIBERADO ★',
        description: 'El futuro de Valleverde 2.0 sobrevive libre de la tiranía del Update.'
      },
      C: {
        label: 'Final C · Fusionar (Secreto)',
        line: 'Dos mundos. Un solo Ojete Dorado.',
        headline: '★ FINAL C · FUSIÓN DEL OJETE DORADO ★',
        description: 'Tony y Franco sellaron la paz entre el pasado de Valleverde y el futuro.'
      }
    };
    const cfg = endingMeta[endingKey] || endingMeta.B;
    this.expansionEndingChosen = endingKey;
    this._saveExpansionProgress();

    // Efecto narrativo sobre el mundo según el final elegido
    if (endingKey === 'A' && this.tilemap) {
      this.tilemap.setAlexCoreUnlocked(false);
    }

    const base = this._buildBaseVictoryRecord();
    const record = {
      ...base,
      endingKey,
      endingHeadline: cfg.headline,
      endingDescription: `${cfg.line} ${cfg.description}`,
      title: `${cfg.label} · ${base.title}`
    };

    const launchCredits = () => {
      if (this.music && typeof this.music.playVictoryTheme === 'function') {
        this.music.playVictoryTheme();
      }
      if (this.menuSystem && typeof this.menuSystem.startEndingCredits === 'function') {
        this.menuSystem.startEndingCredits(record, () => {
          this._onExpansionCreditsFinished(endingKey, record);
        });
      }
    };

    if (this.dialogueBox) {
      this.dialogueBox.showMessage(cfg.label, [cfg.line], [
        {
          label: 'Ver Créditos',
          onSelect: () => {
            this.dialogueBox.close();
            launchCredits();
          }
        }
      ]);
    } else {
      launchCredits();
    }
    return record;
  }

  _onExpansionCreditsFinished(endingKey, record) {
    if (this.shouldTriggerTechnicalDebt(endingKey)) {
      this._triggerTechnicalDebtSecretBattle();
      return;
    }
    this._openScoreSubmissionModal(record, () => {
      this._resetWorldToInitialState();
      this.menuSystem.openLeaderboardScreen('title');
    });
  }

  _triggerTechnicalDebtSecretBattle() {
    const debtBoss = this.enemies.find((e) => e.id === 'boss_technical_debt');
    if (!debtBoss || typeof debtBoss.activateSecretBoss !== 'function') return null;

    if (this.menuSystem) {
      this.menuSystem.state = 'playing';
    }
    if (this.tilemap && this.tilemap.currentSceneId !== 'ai_nucleus_core') {
      this.tilemap.loadScene('ai_nucleus_core');
    }
    this.player.x = 6.5 * 16;
    this.player.y = 9.5 * 16;
    this.player.hp = this.player.effectiveMaxHp;
    this.camera?.snapTo?.(this.player);

    debtBoss.activateSecretBoss();
    this.debtGlitchTimer = 2.0;
    this.soundEngine?.playErrorBuzz?.();
    this.music?.loadExpansionMusic?.();
    this.music?.setMode?.('boss_alex_final');

    if (this.menuSystem) {
      this.menuSystem.showNotice('⚠️ GLITCH CRÍTICO: ¡La Deuda Técnica ha despertado en el Núcleo!', 5.0);
    }
    return debtBoss;
  }

  _finishBaseVictoryCredits(record) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('el_ojete_dorado_victory_trophy', 'true');
      }
    } catch {}
    if (record) {
      submitGlobalScore(record).catch?.(() => {});
    }
    this.soundEngine?.playSFX?.('ui_glitch');
    if (this.menuSystem && typeof this.menuSystem.startFalseEndingGlitch === 'function') {
      this.menuSystem.startFalseEndingGlitch(() => {
        this._resetWorldToInitialState();
        this.menuSystem.openTitleScreen();
      }, 4.0);
    } else if (this.menuSystem) {
      this._resetWorldToInitialState();
      this.menuSystem.openTitleScreen();
    }
  }

  _triggerVictorySequence() {
    // 1. Congelar la sala y detener música de combate
    if (this.music && typeof this.music.stopBossMusic === 'function') {
      this.music.stopBossMusic(false);
    }

    // 2. Resumen del Expediente del Jugador y Cálculo de Puntuación
    const record = this._buildBaseVictoryRecord();

    // 3. Disparar cinemática SCENE_ENDING_VICTORY -> Créditos -> Falso Final con Glitch
    if (this.animeCutscenes) {
      this.animeCutscenes.playCutscene(SCENE_ENDING_VICTORY, () => {
        if (this.music && typeof this.music.playVictoryTheme === 'function') {
          this.music.playVictoryTheme();
        }

        this.menuSystem.startEndingCredits(record, () => {
          this._finishBaseVictoryCredits(record);
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
    if (this.curriculumFlashTimer > 0) {
      this.curriculumFlashTimer = Math.max(0, this.curriculumFlashTimer - dt);
    }

    if (this.vertederoRebootTimer > 0) {
      this.vertederoRebootTimer = Math.max(0, this.vertederoRebootTimer - dt);
      if (this.vertederoRebootTimer === 0) {
        this._finishVertederoSoftReset();
      }
      this.input.endFrame();
      return;
    }

    // (BLOQUE 1) La cinemática in-engine dirige actores, cámara y UI.
    if (this.cinematicDirector && this.cinematicDirector.isActive) {
      this.cinematicDirector.update(dt, this.input);
      this.input.endFrame();
      return;
    }

    // Failsafe post-cinemática: evitar que coordenadas NaN/undefined congelen el RenderPipeline.
    if (this.player && (!Number.isFinite(this.player.x) || !Number.isFinite(this.player.y))) {
      this.player.x = 224;
      this.player.y = 192;
    }
    if (this.camera && (!Number.isFinite(this.camera.x) || !Number.isFinite(this.camera.y))) {
      this.camera.resetCinematic();
      this.camera.snapTo(this.player);
    }

    // (FIX SHOP) El modal de tienda pausa el mundo y captura toda la entrada.
    if (this.shopUI && this.shopUI.isOpen) {
      this.shopUI.update(dt);
      this.input.endFrame();
      return;
    }
    if (this.rosaShop && this.rosaShop.isOpen) {
      this.rosaShop.update(dt);
      this.input.endFrame();
      return;
    }

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
          enemies: this.enemies,
          questLog: this.questLog
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

    // (FIX M3.6) Tutorial táctil la primera vez que se juega en móvil
    if (
      this.input.isTouchDevice &&
      !this._touchTutorialChecked &&
      this.menuSystem.state === 'none' &&
      !this.dialogueBox.active
    ) {
      this._touchTutorialChecked = true;
      let tutorialDone = false;
      try {
        tutorialDone = localStorage.getItem('ojete_touch_tutorial_done') === '1';
      } catch (_) {
        tutorialDone = false;
      }
      if (!tutorialDone) {
        this.menuSystem.startTouchTutorial();
        this.input.endFrame();
        return;
      }
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

    if (this.arrestFadeAlpha > 0) {
      this.arrestFadeAlpha = Math.max(0, this.arrestFadeAlpha - dt * 1.4);
    }

    if (this.jailRemainingSeconds > 0 && !this.isJailedForever) {
      this.jailRemainingSeconds = Math.max(0, this.jailRemainingSeconds - dt);
      if (this.jailRemainingSeconds === 0 && this.tilemap.currentSceneId === 'jail_cell') {
        const releaseWarning =
          this.jailReason === 'assault'
            ? 'El Carcelero abre los barrotes. Procura no ir soltando espadazos a los vecinos.'
            : 'El Carcelero abre los barrotes. Procura ser más amable con el Oráculo IA.';
        this._releaseFromJail([
          '¡Has cumplido tus 10 minutos de condena municipal!',
          releaseWarning
        ]);
      }
    }

    if (this.aiChatOpen) {
      this.dayNight.update(dt);
      this.tilemap.update(dt, this.dayNight.timeOfDayHours);
      this.input.endFrame();
      return;
    }

    // Hotbar de consumibles: ESTRICTAMENTE teclas [1-5].
    const quickSlotReady =
      !this.dialogueBox.active &&
      this.menuSystem.state === 'none' &&
      !this.inventory.isOpen &&
      !this.characterStats.isOpen &&
      (!this.questLogView || !this.questLogView.isOpen);
    if (quickSlotReady) {
      const quickKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
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
      // (FIX M3.4) Toque para seleccionar y arrastre para scroll
      this.questLogView.handleTouchInput(this.input);
      // (BLOQUE 4.C) Clic de ratón en las pestañas Principal / Secundarias.
      if (this.input.pointerJustClicked) {
        this.questLogView.handleClick(this.input.pointerX, this.input.pointerY);
      }
      if (this.input.consumeKey('KeyM')) {
        this.questLogView.close();
        this.menuSystem.openWorldMap(this.tilemap.currentSceneId, {
          player: this.player,
          enemies: this.enemies,
          questLog: this.questLog
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
      // (FIX M3.2) Toque / arrastre / acciones grandes
      const touchInventoryAction = this.inventory.handleTouchInput(this.input);
      if (touchInventoryAction === 'use') {
        this._handleUseSelectedInventoryItem();
      } else if (touchInventoryAction === 'drop') {
        this._handleDropSelectedInventoryItem();
      } else if (touchInventoryAction === 'assign_hotbar') {
        this._assignSelectedToNextHotbarSlot();
      } else if (typeof touchInventoryAction === 'string' && touchInventoryAction.startsWith('hotbar_slot_')) {
        const idx = Number(touchInventoryAction.replace('hotbar_slot_', ''));
        if (Number.isFinite(idx)) this.assignHotbarSlot(idx);
      }
      const hotbarAssignKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
      const pressedHotbarKey = hotbarAssignKeys.find((k) => this.input.consumeKey(k));
      if (pressedHotbarKey) {
        this.assignHotbarSlot(this._getQuickSlotIndex(pressedHotbarKey));
      }
      if (this.input.consumeKey('KeyM')) {
        this.inventory.close();
        this.menuSystem.openWorldMap(this.tilemap.currentSceneId, {
          player: this.player,
          enemies: this.enemies,
          questLog: this.questLog
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
          enemies: this.enemies,
          questLog: this.questLog
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
        if (this.player.hasSword) {
          this.music.playSwordSlash();
        } else if (typeof this.music.playPunch === 'function') {
          this.music.playPunch();
        } else {
          this.music.playSwordSlash();
        }
      }
    }

    // (FIX M3.5) F3 es una tecla de desarrollo: solo en escritorio
    if (!this.input.isTouchDevice && this.input.consumeKey('F3')) {
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
      this.renderPipeline.update(dt, {
        sceneId: this.tilemap.currentSceneId,
        isNight: this._isNightTime(),
        camera: this.camera,
        player: this.player,
        chimneys: this.tilemap.chimneys || [],
        paused: this.menuSystem ? this.menuSystem.isBlockingGameplay() : false
      });
    }
    if (Math.floor(prevHour) !== Math.floor(this.dayNight.timeOfDayHours)) {
      this._updateNPCSchedules();
    } else if (this._npcsSchedulePending && !this.dialogueBox.active) {
      // (FIX NPC.6) El cambio de rutina que se pospuso por el diálogo se aplica ahora
      this._npcsSchedulePending = false;
      this._updateNPCSchedules();
    }

    const { npcs, animals, enemies, items } = this._getActiveSceneEntities();
    if (this.debtGlitchTimer > 0) {
      this.debtGlitchTimer = Math.max(0, this.debtGlitchTimer - dt);
    }
    const tonyNpc = this.npcs.find((n) => n.expansionId === 'tony_randazzo');
    if (tonyNpc && tonyNpc.forgiven && !this.tonyForgiven) {
      this.tonyForgiven = true;
      this._saveExpansionProgress();
    }
    if (this.tilemap.currentSceneId === 'ai_nucleus_core') {
      const debtBoss = enemies.find((e) => e.id === 'boss_technical_debt');
      if (debtBoss && debtBoss.glitchActive) {
        this.debtGlitchTimer = Math.max(this.debtGlitchTimer || 0, 0.15);
      }
    }
    if (this.tilemap.currentSceneId === 'kernel_arena') {
      const kernelBoss = enemies.find((e) => e.id === 'boss_kernel');
      this.kernelHackActive = Boolean(kernelBoss && !kernelBoss.dead && kernelBoss.hudHackActive);
      this.kernelHudFlicker = Boolean(kernelBoss && !kernelBoss.dead && kernelBoss.hudFlicker);
      this.bsodOverlayTimer = kernelBoss && !kernelBoss.dead ? (kernelBoss.bsodOverlayTimer || 0) : 0;
    } else {
      this.kernelHackActive = false;
      this.kernelHudFlicker = false;
      this.bsodOverlayTimer = 0;
    }
    const obstacles = [...npcs, ...animals];

    this.player.update(
      dt,
      this.input,
      this.tilemap,
      obstacles,
      this.dialogueBox.active,
      this.music
    );

    // (BLOQUE 5) Pasos dinámicos: cada 0.3 s según la superficie bajo los pies.
    this.footstepTimer = (this.footstepTimer || 0) + dt;
    if (this.player.isMoving) {
      if (this.footstepTimer >= 0.3) {
        this.footstepTimer = 0;
        if (this.music && typeof this.music.playFootstep === 'function') {
          const ts = this.tilemap.tileSize;
          const footX = Math.floor((this.player.x + this.player.width * 0.5) / ts);
          const footY = Math.floor((this.player.y + this.player.height - 2) / ts);
          const groundRow = this.tilemap.layers && this.tilemap.layers.ground
            ? this.tilemap.layers.ground[footY]
            : null;
          const groundTile = groundRow ? groundRow[footX] : null;
          const stoneScenes = new Set([
            'mines_puzzle', 'mines_boss_arena', 'sword_temple', 'armor_temple',
            'sewers_dungeon', 'forge', 'mainframe', 'citadel', 'jail_cell'
          ]);
          const stoneTiles = new Set([
            TILES.STONE_FLOOR, TILES.MINE_CRYSTAL_FLOOR, TILES.SEWER_SLIME_FLOOR,
            TILES.FORGE_LAVA_FLOOR, TILES.MAINFRAME_FLOOR
          ]);
          const surface = stoneScenes.has(this.tilemap.currentSceneId) || stoneTiles.has(groundTile)
            ? 'stone'
            : 'grass';
          this.music.playFootstep(surface);
        }
      }
    } else {
      this.footstepTimer = 0;
    }

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
                this._flashScreen('#38bdf8', 0.35);
                this._shakeCamera(5.5, 0.35);
              }
              this.player.takeDamage(1, this.music);
              this.menuSystem.showNotice(res.message || '⚡ ¡Cortocircuito de Paridad! (-0.5 corazón)', 2.5);
            } else if (res.justSolved) {
              if (this.music && typeof this.music.playFanfare === 'function') {
                this.music.playFanfare();
              }
              if (this.animeCutscenes) {
                this._flashScreen('#22c55e', 0.35);
                this._shakeCamera(3.0, 0.25);
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

    this.combatManager.handleMonolithCollisions(dt);
    this.combatManager.checkCrystalBarrierCollisions();

    // Daño ambiental por calor extremo en la Forja si falta el Blindaje Térmico
    this._checkEnvironmentalHazards(dt);

    if (this.transitionCooldown > 0) {
      this.transitionCooldown -= dt;
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
      const threat = isTalking ? null : this._findNPCThreat(npc, enemies);
      npc.update(dt, this.tilemap, allEntities, isTalking, this.player, threat, enemies, this.music);
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
    this.sceneTransitions.checkEdgeTransitions();

    this._checkBossIntroTriggers();
    if (this.animeCutscenes && this.animeCutscenes.isActive) {
      this.input.endFrame();
      return;
    }

    this.combatManager.update(dt, { enemies, npcs, animals });

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
        if (coin.kind === 'curriculum') {
          if (!this.isExpansionActive && !this.isExpansionMode) {
            this.droppedCoins.splice(i, 1);
            continue;
          }
          this.curriculum = (this.curriculum || 0) + coin.value;
          this.curriculumFlashTimer = 0.9;
          this._saveExpansionProgress();
          if (this.music && typeof this.music.playKeyboard === 'function') {
            this.music.playKeyboard();
          } else if (this.music && typeof this.music.playSFX === 'function') {
            this.music.playSFX('keyboard_type');
          }
          if (this.menuSystem) {
            this.menuSystem.showNotice(`📄 +${coin.value} Currículum (${this.curriculum} 📄)`, 1.6);
          }
        } else {
          this.player.coins += coin.value;
          if (this.music && typeof this.music.playMenuSelect === 'function') {
            this.music.playMenuSelect();
          }
          if (this.menuSystem) {
            this.menuSystem.showNotice(`🪙 +${coin.value} Byte (${this.player.coins} 🪙)`, 1.5);
          }
        }
        this.droppedCoins.splice(i, 1);
      }
    }

    if (this.player.hp <= 0) {
      if (this.tilemap && typeof this.tilemap.currentSceneId === 'string' && this.tilemap.currentSceneId.startsWith('vertedero_')) {
        this._triggerVertederoSoftReset();
        this.input.endFrame();
        return;
      }
      for (const en of this.enemies) {
        if (en.isBoss && !en.dead && typeof en.resetCombatState === 'function') {
          en.resetCombatState();
        }
      }
      this._registerPlayerDeath();
      const gameOverReason = this.player.killedByDemon ? 'animal_demon' : null;
      this.activeDemon = null;
      this.demonBannerTimer = 0;
      this.menuSystem.openGameOverScreen(!this.player.hasArmor, gameOverReason);
      this.input.endFrame();
      return;
    }

    this.camera.update(this.player, dt);
    this._updateDoorGate();
    if (this.screenFlash) {
      this.screenFlash.time -= dt;
      if (this.screenFlash.time <= 0) this.screenFlash = null;
    }
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
    ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // (BLOQUE 2) La cinemática renderiza la escena in-engine y su UI.
    if (this.cinematicDirector && this.cinematicDirector.isActive) {
      this.cinematicDirector.render(ctx);
      this._renderCustomCursor(ctx);
      return;
    }

    if (
      this.menuSystem.state === 'title' ||
      this.menuSystem.state === 'cutscene' ||
      this.menuSystem.state === 'touch_tutorial' ||
      this.menuSystem.state === 'exit_screen' ||
      this.menuSystem.state === 'game_over' ||
      this.menuSystem.state === 'world_map' ||
      this.menuSystem.state === 'leaderboard' ||
      this.menuSystem.state === 'credits' ||
      (this.menuSystem.state === 'options' && this.menuSystem.previousState === 'title') ||
      (this.menuSystem.state === 'controls' && this.menuSystem.previousStateBeforeControls === 'title') ||
      (this.menuSystem.state === 'confirm_exit' && this.menuSystem.previousStateBeforeExit === 'title')
    ) {
      this.menuSystem.render(ctx);
      this._renderCustomCursor(ctx);
      return;
    }

    if (this.animeCutscenes && this.animeCutscenes.isActive) {
      this.animeCutscenes.render(ctx);
      this._renderCustomCursor(ctx);
      return;
    }

    ctx.fillStyle = '#0e111a';
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    const { npcs, animals, enemies, items } = this._getActiveSceneEntities();

    if (this.screenFlash) {
      const a = Math.max(0, this.screenFlash.time / Math.max(0.001, this.screenFlash.duration)) * this.screenFlash.alpha;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = this.screenFlash.color;
      ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
      ctx.restore();
    }

    const activeDemonInScene =
      this.activeDemon && !this.activeDemon.dead && this.activeDemon.sceneId === this.tilemap.currentSceneId
        ? this.activeDemon
        : null;

    this.renderPipeline.render(ctx, {
      tilemap: this.tilemap,
      camera: this.camera,
      dayNight: this.dayNight,
      player: this.player,
      npcs,
      animals,
      enemies: activeDemonInScene ? [...enemies, activeDemonInScene] : enemies,
      onGround: (gctx) => {
        // Portal Abisal en el suelo (Capa 0)
        if (this.activeAbyssalPortal && this.activeAbyssalPortal.sceneId === this.tilemap.currentSceneId) {
          this.hud.renderAbyssalPortal(gctx, this.activeAbyssalPortal);
        } else if (this.tilemap.currentSceneId === 'condemned_realms') {
          this.hud.renderAbyssalPortal(gctx, {
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

        // Bytes (monedas físicas con brillo) y Currículums morados en el suelo
        for (const coin of this.droppedCoins) {
          if (coin.sceneId !== this.tilemap.currentSceneId) continue;
          const cx = Math.round(coin.x - this.camera.renderX);
          const cy = Math.round(coin.y - this.camera.renderY);
          if (coin.kind === 'curriculum') {
            if (!this.isExpansionActive && !this.isExpansionMode) continue;
            gctx.fillStyle = '#a855f7';
            gctx.fillRect(cx - 2, cy - 3, 5, 6);
            gctx.fillStyle = '#e9d5ff';
            gctx.fillRect(cx - 1, cy - 2, 3, 4);
            gctx.fillStyle = '#7e22ce';
            gctx.fillRect(cx - 1, cy - 1, 2, 1);
            gctx.fillRect(cx - 1, cy + 1, 2, 1);
          } else {
            gctx.fillStyle = '#fde047';
            gctx.fillRect(cx - 2, cy - 2, 4, 4);
            gctx.fillStyle = '#f59e0b';
            gctx.fillRect(cx - 1, cy - 1, 2, 2);
            gctx.fillStyle = '#ffffff';
            gctx.fillRect(cx - 1, cy - 2, 1, 1);
          }
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
            this.hud.renderActionPrompt(overlayCtx, action);
          }
        }
      }
    });

    // (FIX FINAL BOSS) Filtro glitch de Fase 2/3 por encima del mundo y bajo el HUD
    this.combatManager.render(ctx);

    this.hud.render(ctx);
    if (this.debugMode) {
      this.hud.renderDebugOverlay(ctx);
    }
    this.dialogueBox.render(ctx);
    this.inventory.render(ctx, this.player);
    this.characterStats.render(ctx, this.player, this.achievementManager);
    if (this.questLogView) {
      this.questLogView.render(ctx);
    }
    this.menuSystem.render(ctx);
    if (this.shopUI && this.shopUI.isOpen) {
      this.shopUI.render(ctx);
    }
    if (this.rosaShop && this.rosaShop.isOpen) {
      this.rosaShop.render(ctx);
    }
    if (this.achievementManager) {
      this.achievementManager.renderToast(ctx);
    }
    // (FIX M1.6) Controles táctiles al final para quedar por encima del HUD y de los
    // paneles de canvas (así el botón de cerrar del inventario sigue visible).
    if (this.touchControls) this.touchControls.render(ctx);
    if (this.player && this.player.burnoutTimer > 0) {
      this._renderBurnoutOverlay(ctx);
    }
    if (this.bsodOverlayTimer > 0) {
      this._renderKernelBSODOverlay(ctx);
    }
    if (this.debtGlitchTimer > 0) {
      this._renderTechnicalDebtGlitchOverlay(ctx);
    }
    if (this.vertederoRebootTimer > 0) {
      this._renderVertederoRebootOverlay(ctx);
    }
    if (this.screenFlash) {
      const a = Math.max(0, this.screenFlash.time / Math.max(0.001, this.screenFlash.duration)) * this.screenFlash.alpha;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = this.screenFlash.color;
      ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
      ctx.restore();
    }
    if (this.demonBannerTimer > 0) {
      this._renderDemonBannerOverlay(ctx);
    }
    if (this.arrestFadeAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, this.arrestFadeAlpha).toFixed(3)})`;
      ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
      ctx.restore();
    }
    this._renderCustomCursor(ctx);
  }

  _renderDemonBannerOverlay(ctx) {
    const fade = Math.min(1, this.demonBannerTimer / 0.6, (4.0 - Math.max(0, this.demonBannerTimer - 3.6)) * 2.5);
    ctx.save();
    ctx.globalAlpha = Math.max(0.25, fade);
    ctx.fillStyle = 'rgba(127, 29, 29, 0.88)';
    ctx.fillRect(14, 26, VIEWPORT_WIDTH - 28, 22);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(14, 26, VIEWPORT_WIDTH - 28, 22);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 7.5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('¡HAS PROVOCADO AL SEÑOR DE LAS OVEJAS!', VIEWPORT_WIDTH * 0.5, 37);
    ctx.restore();
  }

  _renderBurnoutOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(168, 85, 247, 0.16)';
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    ctx.fillStyle = '#e9d5ff';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`BURNOUT (${this.player.burnoutTimer.toFixed(1)}s)`, VIEWPORT_WIDTH * 0.5, 24);
    ctx.restore();
  }

  _renderTechnicalDebtGlitchOverlay(ctx) {
    ctx.save();
    const bands = 5;
    for (let i = 0; i < bands; i++) {
      const y = ((Math.floor((Date.now() * 0.08) + i * 37)) % VIEWPORT_HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(244, 63, 94, 0.28)' : 'rgba(34, 211, 238, 0.25)';
      ctx.fillRect(0, y, VIEWPORT_WIDTH, 6 + (i % 3) * 4);
    }
    ctx.fillStyle = '#fecdd3';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SEGMENTATION FAULT · DEUDA TÉCNICA ACTIVA', VIEWPORT_WIDTH * 0.5, VIEWPORT_HEIGHT - 12);
    ctx.restore();
  }

  /**
   * Indica si el juego está mostrando algún menú, diálogo, panel o modal de UI.
   */
  _isInUIMode() {
    if (
      this.menuSystem &&
      typeof this.menuSystem.isBlockingGameplay === 'function' &&
      this.menuSystem.isBlockingGameplay()
    ) {
      return true;
    }
    if (this.inventory && this.inventory.isOpen) return true;
    if (this.dialogueBox && this.dialogueBox.active) return true;
    if (this.characterStats && this.characterStats.isOpen) return true;
    if (this.questLogView && this.questLogView.isOpen) return true;
    if (this.shopUI && this.shopUI.isOpen) return true;
    if (this.rosaShop && this.rosaShop.isOpen) return true;
    if (this.aiChatOpen) return true;
    if (this.cinematicDirector && this.cinematicDirector.isActive) return true;
    if (this.animeCutscenes && this.animeCutscenes.isActive) return true;
    return false;
  }

  /**
   * Comprueba si el puntero está sobre algún botón, ranura o elemento interactuable de la UI activa.
   */
  _isPointerOverInteractiveUI(x, y) {
    const inRect = (r) => Boolean(r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);

    if (this.menuSystem && typeof this.menuSystem.isBlockingGameplay === 'function' && this.menuSystem.isBlockingGameplay()) {
      if (this.menuSystem.state === 'world_map') {
        if (this.menuSystem.worldMap?._hoverRegion) return true;
        if (this.menuSystem.worldMap?._buttons?.some(inRect)) return true;
      } else if (
        typeof this.menuSystem._getCurrentMenuItems === 'function' &&
        typeof this.menuSystem._getMenuHitboxes === 'function'
      ) {
        const items = this.menuSystem._getCurrentMenuItems();
        const hitboxes = this.menuSystem._getMenuHitboxes(items.length, items);
        if (Array.isArray(hitboxes) && hitboxes.some(inRect)) return true;
        if (typeof this.menuSystem._getModalCloseButtonBounds === 'function') {
          const isPauseModal =
            this.menuSystem.state === 'pause' ||
            this.menuSystem.state === 'pause_cloud' ||
            this.menuSystem.state === 'options' ||
            this.menuSystem.state === 'pause_sound';
          if (isPauseModal && inRect(this.menuSystem._getModalCloseButtonBounds(true))) {
            return true;
          }
        }
      }
    }

    if (this.inventory && this.inventory.isOpen) {
      if (typeof this.inventory._slotAt === 'function' && this.inventory._slotAt(x, y)) return true;
      if (this.inventory._pageButtons?.some(inRect)) return true;
      if (this.inventory._touchActions?.some(inRect)) return true;
    }

    if (this.questLogView && this.questLogView.isOpen) {
      if (this.questLogView._rowRects?.some(inRect)) return true;
      if (this.questLogView._tabRects?.some(inRect)) return true;
    }

    if (this.characterStats && this.characterStats.isOpen) {
      if (this.characterStats._tabRects?.some(inRect)) return true;
      if (this.characterStats._skillRowRects?.some(inRect)) return true;
    }

    if (this.dialogueBox && this.dialogueBox.active) {
      const mb = this.dialogueBox.lastMenuBounds;
      if (
        typeof this.dialogueBox.isShowingChoices === 'function' &&
        this.dialogueBox.isShowingChoices() &&
        mb &&
        x >= mb.menuX &&
        x <= mb.menuX + mb.menuW &&
        y >= mb.menuY &&
        y <= mb.menuY + mb.menuH
      ) {
        return true;
      }
    }

    if (this.shopUI && this.shopUI.isOpen) {
      if (Array.isArray(this.shopUI.entries) && this.shopUI.entries.length > 0 && x >= 20 && x <= 300 && y >= 36 && y <= 140) {
        return true;
      }
    }

    return false;
  }

  /**
   * Dibuja un cursor pixel art contextual:
   * - Modo UI: Guante de puntero (blanco / dorado al hacer hover) con contorno negro de 1 px.
   * - Modo Gameplay: Espada si `hasSword`, Puño si no.
   */
  _renderCustomCursor(ctx) {
    if (!this.input) return;
    if (typeof this.input.isDOMBlocked === 'function' && this.input.isDOMBlocked()) return;
    if (this.input.lastPointerType === 'touch') return;

    const x = Math.round(this.input.pointerX);
    const y = Math.round(this.input.pointerY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < 0 || y < 0 || x >= VIEWPORT_WIDTH || y >= VIEWPORT_HEIGHT) return;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (this._isInUIMode()) {
      const isHovered = this._isPointerOverInteractiveUI(x, y);
      this._renderPointerGloveCursor(ctx, x, y, isHovered);
      ctx.restore();
      return;
    }

    const hasSword = Boolean(this.player && this.player.hasSword);

    if (hasSword) {
      // Espada pixel art apuntando arriba-izquierda (punta en x, y)
      ctx.fillStyle = '#0b0c10';
      // Contorno de hoja diagonal + guarda + empuñadura
      for (let i = 0; i <= 5; i++) {
        ctx.fillRect(x + i - 1, y + i, 3, 3);
      }
      ctx.fillRect(x + 4, y + 7, 5, 2);
      ctx.fillRect(x + 7, y + 4, 2, 5);
      ctx.fillRect(x + 6, y + 6, 4, 4);

      // Hoja gris acero con filo luminoso
      ctx.fillStyle = '#94a3b8';
      for (let i = 0; i <= 5; i++) {
        ctx.fillRect(x + i, y + i, 2, 2);
      }
      ctx.fillStyle = '#f8fafc';
      for (let i = 0; i <= 4; i++) {
        ctx.fillRect(x + i, y + i, 1, 1);
      }
      // Guarda dorada
      ctx.fillStyle = '#eab308';
      ctx.fillRect(x + 4, y + 6, 4, 1);
      ctx.fillRect(x + 6, y + 4, 1, 4);
      // Mango marrón
      ctx.fillStyle = '#92400e';
      ctx.fillRect(x + 7, y + 7, 2, 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(x + 9, y + 9, 1, 1);
    } else {
      // Puño pixel art (cuadrado piel con nudillos oscuros y contorno de 1 px)
      ctx.fillStyle = '#0b0c10';
      ctx.fillRect(x, y, 9, 8);
      ctx.fillRect(x + 1, y + 8, 7, 1);

      // Cuerpo del puño (piel)
      ctx.fillStyle = '#f1c27d';
      ctx.fillRect(x + 1, y + 1, 7, 6);
      ctx.fillRect(x + 2, y + 7, 5, 1);

      // Nudillos oscuros y separación de dedos
      ctx.fillStyle = '#8d5524';
      ctx.fillRect(x + 2, y + 1, 1, 2);
      ctx.fillRect(x + 4, y + 1, 1, 2);
      ctx.fillRect(x + 6, y + 1, 1, 2);
      // Sombra del pulgar/muñeca
      ctx.fillStyle = '#c68642';
      ctx.fillRect(x + 1, y + 4, 2, 2);
      ctx.fillRect(x + 2, y + 6, 5, 1);
    }

    ctx.restore();
  }

  /**
   * Guante de puntero pixel art para menús e interfaz:
   * la punta del dedo índice queda anclada en (x, y) y se ilumina en dorado sobre botones.
   */
  _renderPointerGloveCursor(ctx, x, y, isHovered = false) {
    // Halo sutil dorado al pasar sobre elementos interactuables
    if (isHovered) {
      ctx.fillStyle = 'rgba(253, 224, 71, 0.32)';
      ctx.fillRect(x - 1, y - 1, 6, 7);
      ctx.fillRect(x - 1, y + 3, 10, 9);
    }

    // Silueta con contorno negro de 1 px
    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(x, y, 4, 6);     // Dedo índice vertical
    ctx.fillRect(x, y + 4, 8, 7); // Palma + puño ancho debajo

    // Relleno principal del guante (blanco elegante o dorado brillante en hover)
    ctx.fillStyle = isHovered ? '#fde047' : '#f8fafc';
    ctx.fillRect(x + 1, y + 1, 2, 5); // Dedo índice
    ctx.fillRect(x + 1, y + 5, 6, 3); // Palma del guante

    // Sombra lateral y nudillos cerrados
    ctx.fillStyle = isHovered ? '#eab308' : '#cbd5e1';
    ctx.fillRect(x + 2, y + 3, 1, 2);
    ctx.fillRect(x + 3, y + 5, 1, 2);
    ctx.fillRect(x + 5, y + 5, 1, 2);
    ctx.fillRect(x + 6, y + 5, 1, 3);

    // Puño inferior en tono cuero / gris oscuro
    ctx.fillStyle = isHovered ? '#b45309' : '#64748b';
    ctx.fillRect(x + 1, y + 8, 6, 2);
    ctx.fillStyle = isHovered ? '#fef08a' : '#94a3b8';
    ctx.fillRect(x + 1, y + 8, 4, 1);

    // Pequeño brillo blanco en la punta del dedo índice
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 1, y + 1, 1, 2);
  }

}

/**
 * (FIX M0.4) Registra el Service Worker de la PWA.
 * Solo en http(s): el HTML portable abierto con file:// no puede registrar SW.
 */
function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (typeof window === 'undefined' || !window.location) return;
  const protocol = window.location.protocol;
  if (protocol !== 'http:' && protocol !== 'https:') return;

  const register = () => {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
      if (reg && typeof reg.update === 'function') {
        reg.update().catch(() => {});
      }
    }).catch((err) => {
      // No es crítico: el juego funciona sin SW, solo se pierde el modo offline.
      console.warn('[PWA] Service Worker no registrado:', err && err.message ? err.message : err);
    });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}

/**
 * (FIX M2.5) Teclado virtual (iOS/Android): cuando un input/textarea recibe el foco,
 * los modales se anclan al viewport visual (`visualViewport`) en vez de al layout,
 * para que el campo y los botones no queden debajo del teclado.
 */
function setupVirtualKeyboardViewport() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const vv = window.visualViewport;
  const root = document.documentElement;
  const isField = (el) => Boolean(el) && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');

  const sync = () => {
    const focused = isField(document.activeElement);
    if (document.body) document.body.classList.toggle('keyboard-open', focused);
    if (vv && root) {
      root.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
      root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
    }
  };

  const onFocusIn = (event) => {
    if (!isField(event.target)) return;
    sync();
    try {
      event.target.scrollIntoView({ block: 'center', inline: 'nearest' });
    } catch (_) {
      /* Sin soporte de scroll: el CSS fixed ya lo coloca */
    }
  };
  const onFocusOut = () => setTimeout(sync, 80);

  if (vv && typeof vv.addEventListener === 'function') {
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
  }
  window.addEventListener('resize', sync);
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
}

async function bootstrap() {
  registerServiceWorker();
  setupVirtualKeyboardViewport();
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
