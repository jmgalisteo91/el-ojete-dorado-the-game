import { pushBackPlayer } from './DoorGatekeeper.js?v=8';
import { SCENE_AI_ALEX_PREBATTLE, SCENE_ALEX_FINAL } from '../ui/AnimeCutsceneManager.js?v=8';
import { registerExpansionMusic } from '../audio/AudioManager.js?v=8';
import { BASE_BOSS_FLEE_TAUNTS } from '../data/EnemyData.js?v=8';

const STAGE_TRANSITION_SCENE_IDS = new Set([
  'first_stage',
  'north_peaks',
  'south_swamp',
  'west_wastes'
]);

const EXPANSION_ALLOWED_TARGET_SCENES = new Set([
  'valleverde_corp',
  'vertedero_digital',
  'vertedero_piso_1',
  'vertedero_piso_2',
  'vertedero_piso_3',
  'vertedero_piso_4',
  'vertedero_piso_5',
  'oficina_tony',
  'inakito_office',
  'rosa_bar',
  'kernel_arena',
  'ai_nucleus_core'
]);

const TEMPORAL_WALL_MESSAGE = 'Alex ha bloqueado la línea temporal.';

/**
 * SceneTransitionController: aísla spawn, puertas, triggers de jefes y bordes.
 * El estado del mundo sigue viviendo en RPGGame; este controlador solo orquesta.
 */
export class SceneTransitionController {
  constructor(game) {
    this.game = game;
  }

  compassFromDirection(direction) {
    return { right: 'east', left: 'west', down: 'south', up: 'north' }[direction] || null;
  }

  _inferExitDirectionFromDoor(door = {}, width = 0, height = 0) {
    if (!Number.isFinite(door.worldX) || !Number.isFinite(door.worldY) || !width || !height) {
      return null;
    }
    const distWest = door.worldX;
    const distEast = Math.max(0, width - door.worldX);
    const distNorth = door.worldY;
    const distSouth = Math.max(0, height - door.worldY);
    const min = Math.min(distWest, distEast, distNorth, distSouth);
    if (min === distEast) return 'east';
    if (min === distWest) return 'west';
    if (min === distSouth) return 'south';
    return 'north';
  }

  _facingFromExitDirection(exitDirection) {
    return { east: 'right', west: 'left', south: 'down', north: 'up' }[exitDirection] || 'down';
  }

  resolveSpawn(door = {}) {
    const g = this.game;
    const tileSize = g.tilemap?.tileSize || 16;
    const margin = 2 * tileSize; // 32 px hacia el interior para evitar bucles de ping-pong
    const width = g.tilemap.width;
    const height = g.tilemap.height;
    // Ignorar por completo player.direction: usar estrictamente exitDirection (o inferir del borde de la puerta).
    const exitDirection =
      door.exitDirection ||
      this._inferExitDirectionFromDoor(door, width, height) ||
      'east';
    const entryX = Number.isFinite(door.spawnX) ? door.spawnX : width / 2;
    const entryY = Number.isFinite(door.spawnY) ? door.spawnY : height / 2;
    const hasExplicitCoords =
      Number.isFinite(door.spawnX) && Number.isFinite(door.spawnY);
    const isExplicitDoorType =
      door.type === 'door' ||
      door.type === 'enter' ||
      door.type === 'exit' ||
      door.type === 'abyssal_portal' ||
      door.type === 'abyssal_portal_exit' ||
      door.kind === 'abyssal_portal' ||
      door.kind === 'abyssal_portal_exit';
    const curScene = g.tilemap?.currentSceneId;
    const isEdgeStageTransition =
      door.type === 'stage_transition' &&
      (
        !door.targetScene ||
        (curScene === 'overworld' && STAGE_TRANSITION_SCENE_IDS.has(door.targetScene)) ||
        (STAGE_TRANSITION_SCENE_IDS.has(curScene) && door.targetScene === 'overworld')
      );

    // Spawns fijos y puertas/portales con coordenadas explícitas: no usar cálculo de borde.
    if (
      door.spawnMode === 'fixed' ||
      door.fixedSpawn === true ||
      (hasExplicitCoords && (isExplicitDoorType || (door.type === 'stage_transition' && !isEdgeStageTransition)))
    ) {
      return {
        x: entryX,
        y: entryY,
        facing: door.entryFacing || door.forceDirection || this._facingFromExitDirection(exitDirection),
        exitDirection: door.exitDirection || null
      };
    }

    // Cálculo por exitDirection y margin (32 px) reservado únicamente para transiciones de borde.
    if (door.type && door.type !== 'stage_transition') {
      return {
        x: entryX,
        y: entryY,
        facing: door.entryFacing || door.forceDirection || this._facingFromExitDirection(exitDirection),
        exitDirection: door.exitDirection || null
      };
    }

    let x = entryX;
    let y = entryY;
    let facing = this._facingFromExitDirection(exitDirection);

    if (exitDirection === 'east') {
      x = margin;
      y = entryY;
      facing = 'right';
    } else if (exitDirection === 'west') {
      x = width - margin;
      y = entryY;
      facing = 'left';
    } else if (exitDirection === 'south') {
      y = margin;
      x = entryX;
      facing = 'down';
    } else if (exitDirection === 'north') {
      y = height - margin;
      x = entryX;
      facing = 'up';
    }

    return { x, y, facing, exitDirection };
  }

  updateDoorGate() {
    const g = this.game;
    if (!g.doorGate) return;
    const dx = g.player.centerX - g.doorGate.worldX;
    const dy = g.player.centerY - g.doorGate.worldY;
    if (Math.hypot(dx, dy) > 64) {
      g.doorGate = null;
    }
  
  }

  handleBlockedDoor(door, title, lines) {
    const g = this.game;
    if (g.dialogueBox.active) return;
    const gateKey = `${door.targetScene}|${door.label || door.type || ''}`;
    const now = performance.now();
    if (g.doorGate && g.doorGate.key === gateKey && now < g.doorGate.until) {
      return;
    }

    if (g.music && typeof g.music.playDoorLockedSound === 'function') {
      g.music.playDoorLockedSound();
    }
    const { npcs = [] } = g._getActiveSceneEntities ? g._getActiveSceneEntities() : {};
    const obstacles = [...npcs, ...(g.animals || [])];
    // (REFACTOR 2) Vector puerta→jugador + colisión, 2 tiles.
    pushBackPlayer(g.player, door, 2, g.tilemap, obstacles);
    const gateDoor = {
      key: gateKey,
      targetScene: door.targetScene,
      worldX: door.worldX,
      worldY: door.worldY,
      until: 0
    };
    g.doorGate = gateDoor;
    g.dialogueBox.showMessage(title, lines, () => {
      g.doorGate = { ...gateDoor, until: performance.now() + 1500 };
    });
  
  }

  checkBossIntroTriggers() {
    const g = this.game;
    if (g.animeCutscenes && g.animeCutscenes.isActive) return;
    if (g.dialogueBox.active || g.menuSystem.isBlockingGameplay()) return;

    const curScene = g.tilemap.currentSceneId;
    const boss = g.enemies.find(
      (e) => e.isBoss && e.sceneId === curScene && !e.dead
    );
    if (!boss) return;

    // (FIX H1) El Guardián del Stack Overflow SOLO se manifiesta cuando el héroe ya
    // desenvainó la Espada y además resolvió el puzle de las Minas (Nivel 4)
    if (
      boss.id === 'boss_stack_overflow' &&
      (!g.player.hasSword || Boolean(g.tilemap?.minesPuzzle?.solved) !== true)
    ) {
      return;
    }

    // Si ya vio la cinemática, asegurarse de que boss.introCutscenePlayed sea true
    if (g.bossCutscenesSeen && g.bossCutscenesSeen[boss.id]) {
      boss.introCutscenePlayed = true;
      return;
    }

    // Verificar si el jugador entra al alcance de activación de la arena del jefe
    const dist = boss.distanceTo(g.player);
    if (dist <= boss.combatTriggerDistance) {
      g._triggerBossIntroCutscene(boss);
    }
  
  }

  checkEdgeTransitions() {
    const g = this.game;
    // Detección automática al caminar hacia los límites de escena y caminos cardinales (estilo Zelda)
    if (
      (!g.animeCutscenes || !g.animeCutscenes.isActive) &&
      !g.dialogueBox.active &&
      !g.inventory.isOpen &&
      !g.characterStats.isOpen &&
      g.transitionCooldown <= 0
    ) {
      if (g.tilemap.currentSceneId === 'overworld') {
        const atWest = g.player.x <= 1.5 * g.tilemap.tileSize && g.player.y >= 10.5 * g.tilemap.tileSize && g.player.y <= 14.5 * g.tilemap.tileSize;
        const atEast = g.player.x >= 32.5 * g.tilemap.tileSize && g.player.y >= 11 * g.tilemap.tileSize && g.player.y <= 14 * g.tilemap.tileSize;
        const atNorth = g.player.y <= 1.2 * g.tilemap.tileSize && g.player.x >= 15.5 * g.tilemap.tileSize && g.player.x <= 19.5 * g.tilemap.tileSize;
        const atSouth = g.player.y >= 22.5 * g.tilemap.tileSize && g.player.x >= 15.5 * g.tilemap.tileSize && g.player.x <= 19.5 * g.tilemap.tileSize;

        if (atWest || atEast || atNorth || atSouth) {
          const door = g.tilemap.findNearbyDoor(g.player);
          if (door && door.type === 'stage_transition') {
            g._executeInteraction({ kind: 'door', target: door });
          }
        }
      } else if (['first_stage', 'north_peaks', 'south_swamp', 'west_wastes'].includes(g.tilemap.currentSceneId)) {
        const door = g.tilemap.findNearbyDoor(g.player);
        if (door && door.type === 'stage_transition' && door.targetScene === 'overworld') {
          const dist = Math.hypot(g.player.centerX - door.worldX, g.player.centerY - door.worldY);
          if (dist <= 20) {
            g._executeInteraction({ kind: 'door', target: door });
          }
        }
      }
    }
  }

  _blockBaseTransitionIfExpansionActive(door) {
    const g = this.game;
    if (!g || (!g.isExpansionActive && !g.isExpansionMode)) return false;
    const targetScene = door?.targetScene;
    if (!targetScene || EXPANSION_ALLOWED_TARGET_SCENES.has(targetScene)) {
      return false;
    }

    g.transitionCooldown = 0.5;
    if (g.player && typeof pushBackPlayer === 'function') {
      pushBackPlayer(g.player, 8, g.tilemap);
    }
    if (g.music) {
      if (typeof g.music.playCaughtSkipSound === 'function') {
        g.music.playCaughtSkipSound();
      } else if (typeof g.music.playDoorLockedSound === 'function') {
        g.music.playDoorLockedSound();
      }
    }
    g.menuSystem?.showNotice?.(TEMPORAL_WALL_MESSAGE, 3.0);
    if (Array.isArray(g.floatingTexts) && g.player) {
      g.floatingTexts.push({
        text: TEMPORAL_WALL_MESSAGE,
        x: g.player.x,
        y: Math.max(8, g.player.y - 12),
        life: 1.6,
        color: '#ff9b71'
      });
    }
    return true;
  }

  executeStageTransition(door, options = {}) {
    if (this._blockBaseTransitionIfExpansionActive(door)) {
      return false;
    }
    const g = this.game;
    if (typeof g._loadScene === 'function' && !options.immediate) {
      g._loadScene(door?.targetScene, () => this._performStageTransitionSwap(door), options);
      return true;
    }
    this._performStageTransitionSwap(door);
    return true;
  }

  _findFleeingBoss(prevSceneId, nextSceneId) {
    const g = this.game;
    if (!g || !prevSceneId || !nextSceneId || prevSceneId === nextSceneId || g.bossRushActive) {
      return null;
    }
    const enemies = Array.isArray(g.enemies) ? g.enemies : [];
    const boss = enemies.find(
      (e) => e && e.isBoss && !e.dead && !e.dormant && e.sceneId === prevSceneId
    );
    if (!boss) return null;
    if (
      boss.id === 'boss_stack_overflow' &&
      (!g.player?.hasSword || Boolean(g.tilemap?.minesPuzzle?.solved) !== true)
    ) {
      return null;
    }
    const taunts = {
      ...BASE_BOSS_FLEE_TAUNTS,
      ...(g.expansionBossFleeTaunts || {})
    };
    const taunt = taunts[boss.id] || boss.fleeTaunt || null;
    return taunt ? { boss, taunt } : null;
  }

  _performStageTransitionSwap(door) {
    if (this._blockBaseTransitionIfExpansionActive(door)) {
      return false;
    }
    const g = this.game;
    const prevSceneId = g.tilemap?.currentSceneId;
    g.transitionCooldown = 0.5;
    if (g.music) {
      if (door.targetScene === 'condemned_realms' || g.tilemap.currentSceneId === 'condemned_realms') {
        if (typeof g.music.playAbyssalPortalSound === 'function') {
          g.music.playAbyssalPortalSound();
        }
      } else if (typeof g.music.playDoorOpenSound === 'function') {
        g.music.playDoorOpenSound();
      }
    }
    if (door.type === 'exit') {
      g._restoreAllNPCsToOverworld();
    }
    // Limpiar proyectiles, clones, ondas y charcos activos de cualquier jefe al cambiar de escena
    for (const en of g.enemies) {
      if (en.isBoss && !en.dead && typeof en.resetCombatState === 'function') {
        en.resetCombatState();
      }
    }
    // (FIX H3) Nada de proyectiles del jugador ni de enemigos viaja entre escenas
    g.player.thrownLogs = [];
    g.player.energySlashes = [];
    for (const e of g.enemies) {
      if (e.shots) e.shots = [];
    }
    // Si entramos a un templo, configurar su puerta de salida para regresar exactamente a la escena de origen
    // (FIX 2.4) El Templo de la Espada se alcanza desde first_stage y desde mines_puzzle: la salida
    // debe devolver a la sala de la que se viene, y ese origen se persiste en la partida.
    if (door.targetScene === 'armor_temple' || door.targetScene === 'sword_temple') {
      const entryScene = g.tilemap.currentSceneId;
      const returnX = door.worldX;
      const returnY = door.worldY + 22;
      if (g.tilemap.setSceneExitReturn(door.targetScene, { returnScene: entryScene, returnX, returnY })) {
        g.templeReturn = {
          scene: door.targetScene,
          returnScene: entryScene,
          returnX,
          returnY
        };
      }
    }
    let activeDoor = door;
    if (activeDoor.targetScene === 'vertedero_digital') {
      if (typeof g._startVertederoRun === 'function') {
        g._startVertederoRun();
      }
      activeDoor = { ...activeDoor, targetScene: 'vertedero_piso_1' };
    }

    const fleeingBossInfo = this._findFleeingBoss(prevSceneId, activeDoor.targetScene);

    g.tilemap.loadScene(activeDoor.targetScene);
    // (FIX 3) Sincronizar la puerta norte de la arena con el estado real del Núcleo
    if (activeDoor.targetScene === 'mines_boss_arena') {
      g._syncMinesBossArenaGate();
    }
    for (const en of g.enemies) {
      if (en.respawnOnEnter && en.dead && en.sceneId === activeDoor.targetScene) {
        en.reset();
      }
    }
    g.camera.setWorldBounds(g.tilemap.width, g.tilemap.height);
    // (FIX ESPACIAL) Entrada por el borde OPUESTO a la salida, con margen de 2 tiles.
    const spawn = g._resolveStageSpawn(activeDoor);
    g.player.x = spawn.x;
    g.player.y = spawn.y;
    g.player.direction = activeDoor.forceDirection || spawn.facing;
    g.camera.snapTo(g.player);

    if (typeof g._syncFrancoCompanionOnTransition === 'function') {
      g._syncFrancoCompanionOnTransition(activeDoor.targetScene);
    }

    if (g.music && g.music.currentBossTrack) {
      g.music.stopBossMusic(false);
    }

    if (activeDoor.targetScene !== 'kernel_arena') {
      g.kernelHackActive = false;
      g.kernelHudFlicker = false;
      g.bsodOverlayTimer = 0;
    }

    if (activeDoor.targetScene === 'valleverde_corp' || activeDoor.targetScene === 'rosa_bar') {
      registerExpansionMusic();
      g.music.setMode('valleverde_corp');
    } else if (activeDoor.targetScene === 'ai_nucleus_core') {
      registerExpansionMusic();
      g.music.setMode('boss_alex_final');
    } else if (activeDoor.targetScene === 'kernel_arena') {
      registerExpansionMusic();
      const kernelBoss = g.enemies.find((e) => e.id === 'boss_kernel');
      if (kernelBoss && !kernelBoss.dead) {
        if (typeof kernelBoss.startSecurityProtocol === 'function') {
          kernelBoss.startSecurityProtocol(g.music);
        }
        g.kernelHackActive = Boolean(kernelBoss.hudHackActive);
        g.kernelHudFlicker = Boolean(kernelBoss.hudFlicker);
        g.music.playBossMusic('boss_final');
        if (g.menuSystem) {
          g.menuSystem.showNotice('⚠️ KERNEL: "Identificación no reconocida. Iniciando purga."', 3.2);
        }
      } else {
        g.music.setMode('vertedero');
      }
    } else if (activeDoor.targetScene.startsWith('vertedero_')) {
      registerExpansionMusic();
      g.music.setMode('vertedero');
    } else if (activeDoor.targetScene === 'inakito_office') {
      registerExpansionMusic();
      const inakitoBoss = g.enemies.find((e) => e.id === 'boss_inakito');
      if (g.tilemap && typeof g.tilemap.setInakitoOfficeGate === 'function') {
        g.tilemap.setInakitoOfficeGate(Boolean(inakitoBoss && inakitoBoss.dead));
      }
      if (inakitoBoss && !inakitoBoss.dead) {
        g.music.playBossMusic('boss_iñakito');
      } else {
        g.music.setMode('valleverde_corp');
      }
    } else {
      g.music.setMode(
        STAGE_TRANSITION_SCENE_IDS.has(activeDoor.targetScene) ? 'stage1' : 'village'
      );
    }

    if (activeDoor.type === 'enter') {
      g._handleHouseOwnerConfrontation(activeDoor.targetScene);
    } else {
      g._saveGameToStorage();
    }

    if (activeDoor.targetScene === 'condemned_realms') {
      if (g.questLog) {
        g.questLog.advanceStep('quest_condemned_pointer', 'Habla con el Dios Supremo en el altar sagrado para purificar tu corazón e historial penal.');
      }
      if (g.achievementManager) {
        g.achievementManager.unlock('ach_condemned');
      }
    } else if (door.targetScene === 'sewers_dungeon' && g.questLog) {
      g.questLog.advanceStep('quest_boss_garbage', 'Enfréntate al Garbage Collector Furioso en el fondo de las alcantarillas.');
    } else if (door.targetScene === 'ai_fortress_gate' && g.questLog) {
      g.questLog.advanceStep('quest_boss_microwave', 'Infiltra el Umbral de la Fortaleza y destruye el Prototipo del Microondas de AI Alex.');
    } else if (door.targetScene === 'ai_citadel' && g.questLog) {
      g.questLog.advanceStep('quest_boss_final', 'Asciende a la Ciudadela de AI Alex, destruye el Microondas Cuántico y consagra El Ojete Dorado.');
    }

    if (door.targetScene === 'ai_citadel' && !g.prebattleAlexCutscenePlayed) {
      g.prebattleAlexCutscenePlayed = true;
      if (g.animeCutscenes) {
        g.animeCutscenes.playCutscene(SCENE_AI_ALEX_PREBATTLE);
      }
    } else if (
      activeDoor.targetScene === 'ai_nucleus_core' &&
      (g.isExpansionActive || g.isExpansionMode) &&
      !g.alexFinalCutscenePlayed
    ) {
      g.alexFinalCutscenePlayed = true;
      if (g.animeCutscenes) {
        g.animeCutscenes.playCutscene(SCENE_ALEX_FINAL);
      }
    } else if (door.targetScene === 'sewers_dungeon' && !g.bossCutscenesSeen.boss_garbage_collector) {
      const gcBoss = g.enemies.find((e) => e.id === 'boss_garbage_collector');
      if (gcBoss && !gcBoss.dead) {
        g._triggerBossIntroCutscene(gcBoss);
      }
    } else if (door.targetScene === 'ai_fortress_gate' && !g.bossCutscenesSeen.boss_prototype_microwave) {
      const protoBoss = g.enemies.find((e) => e.id === 'boss_prototype_microwave');
      if (protoBoss && !protoBoss.dead) {
        g._triggerBossIntroCutscene(protoBoss);
      }
    } else if (door.targetScene === 'inakito_office' && !g.bossCutscenesSeen.boss_inakito) {
      const inakitoBoss = g.enemies.find((e) => e.id === 'boss_inakito');
      if (inakitoBoss && !inakitoBoss.dead && typeof g._triggerInakitoOfficeIntro === 'function') {
        g._triggerInakitoOfficeIntro(inakitoBoss);
      }
    }

    if (
      !(g.animeCutscenes && g.animeCutscenes.isActive) &&
      !(g.cinematicDirector && g.cinematicDirector.isActive) &&
      typeof g.maybeStartDungeonIntroPan === 'function'
    ) {
      g.maybeStartDungeonIntroPan(activeDoor.targetScene);
    }

    if (
      fleeingBossInfo &&
      g.dialogueBox &&
      !g.dialogueBox.active &&
      !(g.animeCutscenes && g.animeCutscenes.isActive) &&
      !(g.cinematicDirector && g.cinematicDirector.isActive)
    ) {
      g.dialogueBox.showMessage(
        fleeingBossInfo.boss.name || 'Jefe',
        [fleeingBossInfo.taunt]
      );
      g.dialogueBox.scheduleAutoClose?.(3.0);
    }
  }
}
