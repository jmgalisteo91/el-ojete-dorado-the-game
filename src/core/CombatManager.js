import { CollisionSystem } from '../physics/CollisionSystem.js?v=8';
import { TILES, ITEM_ICONS } from '../graphics/SpriteSheetGenerator.js?v=8';
import { WorldItem } from '../entities/WorldItem.js?v=8';

const VIEWPORT_WIDTH = 320;
const VIEWPORT_HEIGHT = 180;

/**
 * Gestiona las colisiones de combate del jugador (espada, puños, ataque giratorio
 * y proyectiles), reacciones de NPCs/animales, barreras de cristal, monolitos,
 * actualización de enemigos/jefes, recompensas y overlays de combate.
 */
export class CombatManager {
  constructor(game) {
    this.game = game;
  }

  /**
   * Comprueba si algún ataque activo del jugador (espada, puño, giro o proyectil) colisiona con `targetBox`.
   * Consume automáticamente el proyectil si impacta.
   */
  didPlayerAttackHitBox(targetBox) {
    const g = this.game;
    if (!g?.player || !targetBox) return false;

    const swordBox = g.player.isAttacking ? g.player.getSwordHitbox() : null;
    if (swordBox && CollisionSystem.isBoxColliding(swordBox, targetBox)) {
      return true;
    }

    const spinCircle = g.player.getSpinHitbox();
    if (spinCircle) {
      const nearestX = Math.max(targetBox.x, Math.min(spinCircle.centerX, targetBox.x + targetBox.width));
      const nearestY = Math.max(targetBox.y, Math.min(spinCircle.centerY, targetBox.y + targetBox.height));
      if (Math.hypot(spinCircle.centerX - nearestX, spinCircle.centerY - nearestY) <= spinCircle.radius) {
        return true;
      }
    }

    const slashes =
      g.player.hasSword && Array.isArray(g.player.energySlashes) ? g.player.energySlashes : [];
    for (let i = slashes.length - 1; i >= 0; i--) {
      const s = slashes[i];
      if (!s || s.active === false) continue;
      const sw = s.width || 12;
      const sh = s.height || 12;
      const sBox = { x: s.x - sw / 2, y: s.y - sh / 2, width: sw, height: sh };
      if (CollisionSystem.isBoxColliding(sBox, targetBox)) {
        slashes.splice(i, 1);
        return true;
      }
    }

    const logs = Array.isArray(g.player.thrownLogs) ? g.player.thrownLogs : [];
    for (let i = logs.length - 1; i >= 0; i--) {
      const l = logs[i];
      if (!l) continue;
      const lBox = { x: l.x - 4, y: l.y - 4, width: 8, height: 8 };
      if (CollisionSystem.isBoxColliding(lBox, targetBox)) {
        logs.splice(i, 1);
        return true;
      }
    }

    return false;
  }

  /**
   * Comprueba si el ataque activo del jugador golpea a un NPC y dispara su reacción.
   */
  handlePlayerAttackOnNPCs(npcs) {
    const g = this.game;
    if (!g?.player || !Array.isArray(npcs) || npcs.length === 0) return;

    for (const npc of npcs) {
      if (!npc || npc.dead || npc.isEnemy || typeof npc.onPlayerAttack !== 'function') continue;
      if (npc.hitCooldown > 0) continue;

      const npcBox = npc.worldBoundingBox || npc.getBoundingBoxAt?.(npc.x, npc.y);
      if (!this.didPlayerAttackHitBox(npcBox)) continue;

      const reacted = npc.onPlayerAttack(g);
      if (!reacted) continue;

      if (g.music) {
        if (typeof g.music.playSFX === 'function') {
          g.music.playSFX('hit_flesh');
        } else if (typeof g.music.playHitHurt === 'function') {
          g.music.playHitHurt();
        }
      }
      g._shakeCamera(2.5, 0.2);

      if (g.tilemap.currentSceneId === 'jail_cell') {
        return;
      }
    }
  }

  /**
   * Comprueba si el jugador ataca a un animal del pueblo e invoca al Demonio Vengador.
   */
  handlePlayerAttackOnAnimals(animals) {
    const g = this.game;
    if (!g?.player || !Array.isArray(animals) || animals.length === 0) return;

    for (const animal of animals) {
      if (!animal || animal.hitCooldown > 0 || typeof animal.onPlayerAttack !== 'function') continue;
      const animalBox = animal.worldBoundingBox || animal.getBoundingBoxAt?.(animal.x, animal.y);
      if (!this.didPlayerAttackHitBox(animalBox)) continue;

      animal.onPlayerAttack(g);
      g.sheepAttacks = (g.sheepAttacks || 0) + 1;
      return;
    }
  }

  handleMonolithCollisions(dt) {
    const g = this.game;
    if (g.monolithHitCooldown > 0) {
      g.monolithHitCooldown = Math.max(0, g.monolithHitCooldown - dt);
    }
    if (!g.player.isAttacking || g.monolithHitCooldown > 0) return;

    const swordBox = g.player.getSwordHitbox();
    if (!swordBox) return;

    const monolithTargets = [];
    if (g.tilemap.currentSceneId === 'sword_temple' && g.tilemap.swordPuzzle) {
      monolithTargets.push({
        set: g.tilemap.swordPuzzle,
        hit: (id) => g._handleSwordMonolithStrike(id)
      });
    }
    if (g.tilemap.currentSceneId === 'mines_puzzle' && g.tilemap.minesPuzzle) {
      monolithTargets.push({
        set: g.tilemap.minesPuzzle,
        hit: (id) => g._handleMinesMonolithStrike(id)
      });
    }
    for (const target of monolithTargets) {
      let struck = false;
      for (const mono of Object.values(target.set.monoliths)) {
        const monoBox = {
          x: mono.col * g.tilemap.tileSize + 2,
          y: mono.row * g.tilemap.tileSize - 2,
          width: 12,
          height: 18
        };
        if (CollisionSystem.isBoxColliding(swordBox, monoBox)) {
          g.monolithHitCooldown = 0.45;
          target.hit(mono.id);
          struck = true;
          break;
        }
      }
      if (struck) break;
    }
  }

  checkCrystalBarrierCollisions() {
    const g = this.game;
    const scene = g.tilemap?.scenes?.[g.tilemap.currentSceneId];
    if (!scene || !scene.layers || !scene.layers.decoration) return;
    const deco = scene.layers.decoration;
    const colGrid = scene.layers.collision;
    const tileSize = g.tilemap.tileSize;

    const attackBoxes = [];
    if (g.player.isAttacking) {
      const swordBox = g.player.getSwordHitbox();
      if (swordBox) attackBoxes.push({ box: swordBox, fromSlash: false });
    }
    if (g.player.hasSword && g.player.energySlashes && g.player.energySlashes.length > 0) {
      for (const slash of g.player.energySlashes) {
        if (!slash.active) continue;
        const slashW = slash.width || 16;
        const slashH = slash.height || 16;
        attackBoxes.push({
          box: {
            x: slash.x - slashW / 2,
            y: slash.y - slashH / 2,
            width: slashW,
            height: slashH
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
            if (g.player.swordLevel >= 2) {
              deco[r][c] = -1;
              if (colGrid && colGrid[r]) colGrid[r][c] = 0;
              if (atk.slashRef) atk.slashRef.active = false;

              if (g.music && typeof g.music.playHitSound === 'function') {
                g.music.playHitSound();
              }
              if (g.animeCutscenes) {
                g._flashScreen('#a855f7', 0.2);
                g._shakeCamera(3.0, 0.2);
              }
              g.worldItems.push(
                new WorldItem({
                  id: `silicon_ore_crystal_${c}_${r}_${Date.now()}`,
                  name: 'Mineral de Silicio',
                  description: 'Veta pura de silicio extraída al quebrar el cristal de la mina.',
                  iconIndex: ITEM_ICONS.SILICON_ORE,
                  x: c * tileSize + 2,
                  y: r * tileSize + 2,
                  sceneId: g.tilemap.currentSceneId,
                  itemsSheet: g.assets.itemsSheet
                })
              );
              if (g.menuSystem) {
                g.menuSystem.showNotice('💎 ¡Barrera de cristal quebrada! +1 Mineral de Silicio', 2.5);
              }
            } else {
              if (atk.slashRef) atk.slashRef.active = false;
              if (g.menuSystem && (!g._lastBarrierNotice || Date.now() - g._lastBarrierNotice > 2500)) {
                g._lastBarrierNotice = Date.now();
                g.menuSystem.showNotice('🛡️ El cristal resiste tu golpe. Se requiere la [Espada de Silicio (Nivel 2)] de Brom.', 2.5);
                if (g.music && typeof g.music.playMenuSelect === 'function') {
                  g.music.playMenuSelect();
                }
              }
            }
          }
        }
      }
    }
  }

  _handleBossDefeat(enemy) {
    const g = this.game;
    if (
      enemy.id === 'boss_inakito' ||
      enemy.id === 'boss_kernel' ||
      enemy.id === 'boss_alex_update' ||
      enemy.id === 'boss_technical_debt'
    ) {
      g.expansionBossDefeated = true;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('el_ojete_expansion_boss_killed', 'true');
        }
      } catch (_) {}
    }
    if (g.bossRushActive) {
      if (typeof g._onBossRushBossDefeated === 'function') {
        g._onBossRushBossDefeated(enemy);
      }
      return;
    }
    if (enemy.id === 'boss_garbage_collector') {
      if (g.questLog) {
        g.questLog.completeQuest('quest_boss_garbage', '¡Garbage Collector purgado! Dash Asíncrono desbloqueado.');
      }
      if (g.achievementManager) g.achievementManager.unlock('ach_boss_gc');
      if (g.player.dungeonCores) g.player.dungeonCores.gc = true;
      g._grantBossLoot([
        {
          id: 'dungeon_core_gc',
          name: 'Núcleo del Colector',
          description: 'Núcleo cuántico purgado de las Cloacas del Legacy. Clave para la Puerta del Núcleo.',
          iconIndex: ITEM_ICONS.DUNGEON_CORE_GC,
          qty: 1
        }
      ]);
      if (g.menuSystem) g.menuSystem.showNotice('⚡ ¡Has obtenido el [Núcleo del Colector]!', 3.5);
    } else if (enemy.id === 'boss_stack_overflow') {
      if (g.questLog) {
        g.questLog.completeQuest('quest_boss_stack', '¡Guardián del Stack Overflow abatido! Corte en Cascada desbloqueado.');
      }
      if (g.achievementManager) g.achievementManager.unlock('ach_boss_stack');
      if (g.player.dungeonCores) g.player.dungeonCores.stack = true;
      if (g.tilemap && typeof g.tilemap.setMinesBossArenaGate === 'function') {
        g.tilemap.setMinesBossArenaGate(true);
      }
      g._grantBossLoot([
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
      if (g.menuSystem) g.menuSystem.showNotice('💎 ¡Has obtenido el [Núcleo del Stack] y 3x [Mineral de Silicio]!', 3.5);
    } else if (enemy.id === 'boss_prototype_microwave') {
      if (g.questLog) {
        g.questLog.completeQuest('quest_boss_microwave', '¡Prototipo del Microondas destruido! Barrera TypeScript desbloqueada.');
      }
      if (g.achievementManager) g.achievementManager.unlock('ach_boss_microwave');
      if (g.player.dungeonCores) g.player.dungeonCores.microwave = true;
      g._grantBossLoot([
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
      if (g.menuSystem) g.menuSystem.showNotice('🔥 ¡Has obtenido el [Núcleo del Microondas] y el [Magnetrón Cuántico]!', 3.5);
    } else if (enemy.id === 'boss_inakito') {
      if (g.tilemap && typeof g.tilemap.setInakitoOfficeGate === 'function') {
        g.tilemap.setInakitoOfficeGate(true);
      }
      g._grantBossLoot([
        {
          id: 'key_vertedero',
          name: 'Llave de Acceso al Vertedero',
          description: 'Tarjeta corporativa confiscada a Iñakito 2.0. Abre el ascensor al Vertedero Digital.',
          iconIndex: ITEM_ICONS.BRIDGE_PASS,
          qty: 1
        }
      ]);
      if (g.dialogueBox) {
        g.dialogueBox.showMessage('Iñakito 2.0 · El Becario Eterno', [
          '¿Esto significa que no me van a renovar?'
        ]);
      }
      if (g.menuSystem) {
        g.menuSystem.showNotice('🔑 ¡Has obtenido la [Llave de Acceso al Vertedero]! Barrera norte abierta.', 4.0);
      }
    } else if (enemy.id === 'boss_kernel') {
      g.kernelHackActive = false;
      g.kernelHudFlicker = false;
      g.bsodOverlayTimer = 0;
      if (g.tilemap && typeof g.tilemap.setAlexCoreUnlocked === 'function') {
        g.tilemap.setAlexCoreUnlocked(true);
      }
      g._grantBossLoot([
        {
          id: 'key_nucleo',
          name: 'Llave de Acceso al Núcleo',
          description: 'Credencial raíz arrancada a El Kernel. Desbloquea el acceso al Núcleo de Mister Alex IA.',
          iconIndex: ITEM_ICONS.BRIDGE_PASS,
          qty: 1
        }
      ]);
      g._saveExpansionProgress();
      if (g.dialogueBox) {
        g.dialogueBox.showMessage('El Kernel', [
          'Esto... no... era... mi... trabajo...'
        ], [
          {
            label: 'Acceder al Núcleo de Alex',
            onSelect: () => {
              g.dialogueBox.close();
              g._enterAlexCoreFromKernel();
            }
          },
          {
            label: 'Explorar un momento',
            onSelect: () => g.dialogueBox.close()
          }
        ]);
      }
      if (g.menuSystem) {
        g.menuSystem.showNotice('🔑 ¡Has obtenido la [Llave de Acceso al Núcleo]! Paso al Núcleo desbloqueado.', 4.5);
      }
    } else if (enemy.id === 'boss_alex_update') {
      g._openAlexUpdateEndingDialogue();
    } else if (enemy.id === 'boss_technical_debt') {
      g.debtGlitchTimer = 0;
      if (g.achievementManager) g.achievementManager.unlock('ach_completionist');
      if (g.menuSystem) g.menuSystem.showNotice('🏆 ¡Trofeo desbloqueado: [Completionista]!', 5.0);
      const debtQuote = enemy.dialogueLine || 'Esto... no... era... un... bug...';
      if (g.dialogueBox) {
        g.dialogueBox.showMessage('La Deuda Técnica', [debtQuote], [
          {
            label: 'Finalizar Partida',
            onSelect: () => {
              g.dialogueBox.close();
              const rec = g._buildBaseVictoryRecord();
              rec.endingHeadline = '★ COMPLETIONISTA · DEUDA TÉCNICA LIQUIDADA ★';
              rec.endingDescription = debtQuote;
              g._openScoreSubmissionModal(rec, () => {
                g._resetWorldToInitialState();
                g.menuSystem.openLeaderboardScreen('title');
              });
            }
          }
        ]);
      }
    } else if (enemy.id === 'boss_final_ai_alex') {
      if (g.questLog) {
        g.questLog.completeQuest('quest_boss_final', '¡Mister AI Alex ha caído! El Ojete Dorado ha sido consagrado.');
      }
      if (g.achievementManager) g.achievementManager.unlock('ach_golden_anus');
    }
  }

  _spawnEnemyDrops(enemy) {
    const g = this.game;
    const expansionActive = Boolean(g.isExpansionActive || g.isExpansionMode);
    if (!enemy.isBoss && enemy.dead && !enemy.coinsDropped) {
      enemy.coinsDropped = true;
      const isVertederoDrop = expansionActive && Boolean(enemy.sceneId && enemy.sceneId.startsWith('vertedero_'));
      const count = isVertederoDrop
        ? Math.floor(Math.random() * 2) + 1
        : Math.floor(Math.random() * 4) + 2;
      for (let i = 0; i < count; i++) {
        g.droppedCoins.push({
          x: enemy.centerX,
          y: enemy.centerY,
          vx: (Math.random() - 0.5) * 60,
          vy: -40 - Math.random() * 30,
          groundY: enemy.centerY + (Math.random() - 0.5) * 10,
          sceneId: enemy.sceneId,
          life: 25,
          value: 1,
          kind: isVertederoDrop ? 'curriculum' : 'byte'
        });
      }
      if (expansionActive && !isVertederoDrop && g.player.lastKillCurriculumDrop) {
        g.droppedCoins.push({
          x: enemy.centerX,
          y: enemy.centerY,
          vx: (Math.random() - 0.5) * 55,
          vy: -48,
          groundY: enemy.centerY + 4,
          sceneId: enemy.sceneId,
          life: 25,
          value: 1,
          kind: 'curriculum'
        });
      }
    }

    if (enemy.isBoss && enemy.dead && !enemy.reciclajeChecked) {
      enemy.reciclajeChecked = true;
      const inVertedero = Boolean(enemy.sceneId && enemy.sceneId.startsWith('vertedero_'));
      if (expansionActive && !inVertedero && g.player.lastKillCurriculumDrop) {
        g.droppedCoins.push({
          x: enemy.centerX,
          y: enemy.centerY,
          vx: (Math.random() - 0.5) * 45,
          vy: -50,
          groundY: enemy.centerY + 4,
          sceneId: enemy.sceneId,
          life: 25,
          value: 1,
          kind: 'curriculum'
        });
      }
    }

    if (!enemy.isBoss && enemy.dead && !enemy.lootDropped) {
      enemy.lootDropped = true;
      if (enemy.id && enemy.id.startsWith('drone')) {
        g.worldItems.push(
          new WorldItem({
            id: `drone_scrap_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name: 'Restos de Chatarra de Dron',
            description: 'Aleación fractal de titanio de un dron de AI Alex. Llévasela al Herrero Brom.',
            iconIndex: ITEM_ICONS.DRONE_SCRAP,
            x: enemy.x,
            y: enemy.y,
            sceneId: enemy.sceneId,
            itemsSheet: g.assets.itemsSheet
          })
        );
        if (g.menuSystem) {
          g.menuSystem.showNotice('⚙️ ¡El dron soltó Restos de Chatarra!', 2.5);
        }
      }
    }
  }

  /**
   * Actualiza todas las colisiones de ataque, combate con enemigos/jefes,
   * Demonio Vengador y recompensas por muerte en la escena activa.
   */
  update(dt, context = null) {
    const g = this.game;
    if (!g || !g.player) return;
    if (!g.player.game) g.player.game = g;

    const sceneEntities = context || g._getActiveSceneEntities();
    const { enemies = [], npcs = [], animals = [] } = sceneEntities;

    if (g.player.hp > 0) g._deathRegistered = false;
    const aiContext = {
      enemies,
      attackers: new Set(),
      npcs,
      obstacles: [...enemies.filter((e) => !e.dead), ...npcs, g.player]
    };
    const difficultyScale = typeof g._getDifficultyScale === 'function' ? g._getDifficultyScale() : 1;

    this.handlePlayerAttackOnNPCs(npcs);
    this.handlePlayerAttackOnAnimals(animals);

    if (g.demonBannerTimer > 0) {
      g.demonBannerTimer = Math.max(0, g.demonBannerTimer - dt);
    }
    if (g.activeDemon) {
      if (g.activeDemon.sceneId !== g.tilemap.currentSceneId) {
        g.activeDemon = null;
        g.demonBannerTimer = 0;
      } else {
        if (this.didPlayerAttackHitBox(g.activeDemon.worldBoundingBox)) {
          g.activeDemon.takeSwordHit(g.player, g.music);
        }
        g.activeDemon.update(dt, g.tilemap, g.player, g.dialogueBox.active, g.music);
      }
    }

    const damageTakenBefore = g.player.damageTakenCount || 0;
    const parryCountBefore = g.player.lastParryCount || 0;
    g.player.currentSceneId = g.tilemap?.currentSceneId || 'overworld';
    g.player.applyFilo2AoE?.(enemies, g.music);
    g.player.applyLogExplosionDamage?.(enemies, g.music);

    for (const enemy of enemies) {
      enemy.speedScale = enemy.isBoss ? 1 : difficultyScale;
      const wasDead = enemy.dead;
      enemy.update(
        dt,
        g.tilemap,
        g.player,
        g.dialogueBox.active,
        g.music,
        aiContext
      );

      if (!wasDead && enemy.dead) {
        g._shakeCamera(2, 0.3);
      }

      if (enemy.dead && !enemy.xpGranted) {
        enemy.xpGranted = true;
        const prevLevel = g.player.level;
        const gained = g.player.awardKill(Boolean(enemy.isBoss), enemy.xpReward);
        if (g.player.level > prevLevel) {
          if (g.music && typeof g.music.playFanfare === 'function') {
            g.music.playFanfare();
          }
          if (g.menuSystem) {
            const rewards = Array.isArray(g.player.lastLevelRewards) ? g.player.lastLevelRewards : [];
            const rewardSuffix = rewards.length > 0 ? rewards.join(' · ') : 'Salud y Energía al 100%';
            g.menuSystem.showNotice(
              `🎉 ¡SUBIDA DE NIVEL! ★ NIVEL ${g.player.level} ★ (${rewardSuffix})`,
              4.2
            );
          }
        } else if (gained > 0 && g.menuSystem) {
          g.menuSystem.showNotice(`⭐ +${gained} punto${gained > 1 ? 's' : ''} de habilidad [C → Habilidades]`, 3);
        }
      }

      if (enemy.isBoss && enemy.dead && !enemy.questCompletedTriggered) {
        enemy.questCompletedTriggered = true;
        this._handleBossDefeat(enemy);
      }

      this._spawnEnemyDrops(enemy);

      if (
        enemy.isBoss &&
        enemy.dead &&
        !enemy.victoryCutsceneTriggered &&
        enemy.id === 'boss_final_ai_alex'
      ) {
        enemy.victoryCutsceneTriggered = true;
        g.gameCompleted = true;
        g._triggerVictorySequence();
      }
    }

    if ((g.player.damageTakenCount || 0) > damageTakenBefore) {
      g._shakeCamera(1.5, 0.2);
    }
    if ((g.player.lastParryCount || 0) > parryCountBefore) {
      g._shakeCamera(1, 0.15);
    }
  }

  /**
   * Renderiza efectos visuales ligados al combate sobre el mundo y bajo el HUD
   * (filtro glitch de Fase 2/3 de Mister AI Alex).
   */
  render(ctx) {
    const g = this.game;
    if (!g || !Array.isArray(g.enemies) || !g.tilemap) return;

    const glitchBoss = g.enemies.find(
      (e) => e.id === 'boss_final_ai_alex' && e.sceneId === g.tilemap.currentSceneId
    );
    if (!glitchBoss || glitchBoss.dead || glitchBoss.phase < 2) return;

    const t = performance.now();
    ctx.save();
    ctx.globalAlpha = glitchBoss.phase === 3 ? 0.16 : 0.10;
    ctx.fillStyle = (Math.floor(t / 120) % 2 === 0) ? '#ef4444' : '#38bdf8';
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 7; i++) {
      const y = (t * 0.05 + i * 29) % VIEWPORT_HEIGHT;
      ctx.fillStyle = i % 2 === 0 ? '#22d3ee' : '#f43f5e';
      ctx.fillRect(0, Math.floor(y), VIEWPORT_WIDTH, 1);
    }

    ctx.globalAlpha = 0.10;
    for (let i = 0; i < 4; i++) {
      const x = (t * 0.04 + i * 83) % VIEWPORT_WIDTH;
      ctx.fillStyle = '#fde047';
      ctx.fillRect(Math.floor(x), 0, 1, VIEWPORT_HEIGHT);
    }
    ctx.restore();
  }
}
