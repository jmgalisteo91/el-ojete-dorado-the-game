import { pushBackPlayer } from './DoorGatekeeper.js?v=8';

const STAGE_TRANSITION_SCENE_IDS = new Set([
  'first_stage',
  'north_peaks',
  'south_swamp',
  'west_wastes'
]);

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

  resolveSpawn(door = {}) {
    const g = this.game;
    const margin = 2 * g.tilemap.tileSize;
    const width = g.tilemap.width;
    const height = g.tilemap.height;
    const exitDirection =
      door.exitDirection ||
      g._compassFromDirection(g.player.direction) ||
      'east';
    const entryX = Number.isFinite(door.spawnX) ? door.spawnX : width / 2;
    const entryY = Number.isFinite(door.spawnY) ? door.spawnY : height / 2;

    // (FIX TEMPLOS) Puertas interiores: spawn exacto en su vano, no en un borde genérico.
    if (door.spawnMode === 'fixed' || door.fixedSpawn === true) {
      return {
        x: entryX,
        y: entryY,
        facing: door.entryFacing || door.forceDirection || g.player.direction,
        exitDirection: door.exitDirection || null
      };
    }

    let x = entryX;
    let y = entryY;
    let facing = g.player.direction;

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
    const obstacles = [...(g.npcs || []), ...(g.animals || [])];
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

    // Animación continua del Portal Abisal (se activa pulsando [E], sin bucle de auto-absorción)
    g.condemnedPortalTimer = (g.condemnedPortalTimer || 0) + dt;
    if (g.activeAbyssalPortal) {
      g.activeAbyssalPortal.timer = (g.activeAbyssalPortal.timer || 0) + dt;
    }

    const allEntities = [g.player, ...npcs, ...animals];
    for (const npc of npcs) {
      const isTalking =
        g.dialogueBox.active && g.dialogueBox.currentNPC === npc;
      const threat = isTalking ? null : g._findNPCThreat(npc, enemies);
      npc.update(dt, g.tilemap, allEntities, isTalking, g.player, threat);
    }
    for (const animal of animals) {
      animal.update(
        dt,
        g.tilemap,
        allEntities,
        g.dialogueBox.active,
        g.player,
        g.music
      );
    }
  }

  executeStageTransition(door) {
    const g = this.game;
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
    g.tilemap.loadScene(door.targetScene);
    // (FIX 3) Sincronizar la puerta norte de la arena con el estado real del Núcleo
    if (door.targetScene === 'mines_boss_arena') {
      g._syncMinesBossArenaGate();
    }
    for (const en of g.enemies) {
      if (en.respawnOnEnter && en.dead && en.sceneId === door.targetScene) {
        en.reset();
      }
    }
    g.camera.setWorldBounds(g.tilemap.width, g.tilemap.height);
    // (FIX ESPACIAL) Entrada por el borde OPUESTO a la salida, con margen de 2 tiles.
    const spawn = g._resolveStageSpawn(door);
    g.player.x = spawn.x;
    g.player.y = spawn.y;
    g.player.direction = door.forceDirection || spawn.facing;
    g.camera.snapTo(g.player);

    if (g.music && g.music.currentBossTrack) {
      g.music.stopBossMusic(false);
    }

    g.music.setMode(
      STAGE_TRANSITION_SCENE_IDS.has(door.targetScene) ? 'stage1' : 'village'
    );

    if (door.type === 'enter') {
      g._handleHouseOwnerConfrontation(door.targetScene);
    } else {
      g._saveGameToStorage();
    }

    if (door.targetScene === 'condemned_realms') {
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
    }
  
  }
}
