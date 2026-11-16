import { UILayout, hudFontSize } from './UILayout.js?v=8';
import { SpeechBubble } from './SpeechBubble.js?v=8';

const VIEWPORT_WIDTH = 320;
const VIEWPORT_HEIGHT = 180;

/**
 * Renderizado del HUD principal (corazones, equipo, stamina, monedas, XP/nivel,
 * jefe activo, hotbar 1-5), overlay de depuración [F3], prompt [E] y Portal Abisal.
 */
export class HUD {
  constructor(game) {
    this.game = game;
  }

  render(ctx) {
    const g = this.game;
    if (!g || g.kernelHackActive) return;
    if (g.kernelHudFlicker && Math.floor(performance.now() / 75) % 4 === 0) return;

    ctx.save();
    ctx.textBaseline = 'middle';

    // (FIX M1.5) HUD móvil: tipografía 1.35x y menos información secundaria
    const isTouchHud = Boolean(g.touchControls && g.touchControls.isTouchEnabled());
    const hudFont = (size, bold = false) => hudFontSize(size, isTouchHud, bold);
    const hudShadow = (x, y, w, h) => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(x + 1, y + 1, w, h);
    };

    const topY = 3;
    const barRowH = 12;

    // 1. SUPERIOR DERECHA (en fila única compacta): Reloj + Nivel/XP + Monedas
    const timeStr = g.dayNight.getFormattedTime();
    const hour = g.dayNight.timeOfDayHours;
    const isNightHour = hour >= 20 || hour < 6;
    const sunMoonIcon = isNightHour ? '🌙' : '☀️';

    const capsuleW = 46;
    const capsuleH = barRowH;
    const capsuleX = VIEWPORT_WIDTH - capsuleW - 4;
    const capsuleY = topY;

    ctx.fillStyle = 'rgba(10, 14, 24, 0.74)';
    ctx.fillRect(capsuleX, capsuleY, capsuleW, capsuleH);
    ctx.strokeStyle = 'rgba(229, 192, 123, 0.40)';
    ctx.lineWidth = 1;
    ctx.strokeRect(capsuleX + 0.5, capsuleY + 0.5, capsuleW - 1, capsuleH - 1);

    ctx.font = hudFont(5);
    ctx.textAlign = 'left';
    ctx.fillText(sunMoonIcon, capsuleX + 3, capsuleY + 6.2);

    ctx.font = hudFont(4.8, true);
    ctx.fillStyle = '#ffe599';
    ctx.fillText(timeStr, capsuleX + 12, capsuleY + 6.2);

    const syncColor = g.cloudSyncStatus === 'syncing'
      ? '#38bdf8'
      : (g.hasPendingCloudSync ? '#f59e0b' : '#4ade80');
    ctx.font = hudFont(5);
    ctx.fillStyle = syncColor;
    ctx.textAlign = 'right';
    ctx.fillText('☁', capsuleX + capsuleW - 3, capsuleY + 6.2);

    // Cápsula compacta de Nivel y XP siempre alineada en la fila superior
    const lvlW = 46;
    const lvlH = barRowH;
    const lvlX = capsuleX - lvlW - 3;
    const lvlY = topY;

    ctx.fillStyle = 'rgba(10, 14, 24, 0.74)';
    ctx.fillRect(lvlX, lvlY, lvlW, lvlH);
    ctx.strokeStyle = g.player.isMaxLevel ? '#fbbf24' : 'rgba(250, 204, 21, 0.48)';
    ctx.lineWidth = 1;
    ctx.strokeRect(lvlX + 0.5, lvlY + 0.5, lvlW - 1, lvlH - 1);

    ctx.textAlign = 'center';
    if (g.player.isMaxLevel) {
      ctx.font = hudFont(4.0, true);
      ctx.fillStyle = '#fde047';
      ctx.fillText('NIVEL MÁXIMO', lvlX + lvlW / 2, lvlY + 6.2);
    } else {
      const xpPct = Math.max(0, Math.min(1, (g.player.getXpProgressPercent?.() || 0) / 100));
      ctx.font = hudFont(4.2, true);
      ctx.fillStyle = '#fef08a';
      ctx.fillText(`NV. ${g.player.level}/15`, lvlX + lvlW / 2, lvlY + 4.4);

      const xpBarX = lvlX + 3;
      const xpBarY = lvlY + 8.5;
      const xpBarW = lvlW - 6;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(xpBarX, xpBarY, xpBarW, 2);
      if (xpPct > 0) {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(xpBarX, xpBarY, Math.max(1, Math.round(xpBarW * xpPct)), 2);
      }
    }

    // Monedas / Bytes compacto inmediatamente a la izquierda del Nivel
    const coinW = 36;
    const coinH = barRowH;
    const coinX = lvlX - coinW - 3;
    const coinY = topY;
    ctx.fillStyle = 'rgba(10, 14, 24, 0.74)';
    ctx.fillRect(coinX, coinY, coinW, coinH);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(coinX + 0.5, coinY + 0.5, coinW - 1, coinH - 1);
    ctx.font = hudFont(4.6, true);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.fillText(`💰 ${g.player.coins}`, coinX + coinW / 2, coinY + 6.2);

    const expansionActive = Boolean(g.isExpansionActive || g.isExpansionMode);

    // Medidor falso de Felicidad (98%) en Valleverde 2.0
    if (expansionActive && g.tilemap && g.tilemap.currentSceneId === 'valleverde_corp') {
      const hapW = 60;
      const hapH = 10;
      const hapX = VIEWPORT_WIDTH - hapW - 4;
      const hapY = capsuleY + capsuleH + 2;
      ctx.fillStyle = 'rgba(8, 20, 32, 0.80)';
      ctx.fillRect(hapX, hapY, hapW, hapH);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.65)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hapX + 0.5, hapY + 0.5, hapW - 1, hapH - 1);
      ctx.font = hudFont(4.4, true);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#22d3ee';
      ctx.fillText('😊 FELICIDAD 98%', hapX + hapW / 2, hapY + 5.2);
    }

    // Contador de Currículums solo en la expansión (Vertedero Digital o Tienda de Rosa)
    if (expansionActive) {
      UILayout.drawCurriculumHud(ctx, {
        curriculum: g.curriculum || 0,
        sceneId: g.tilemap ? g.tilemap.currentSceneId : '',
        isRosaShopOpen: Boolean(
          (g.rosaShop && g.rosaShop.isOpen) ||
          g.isRosaShopOpen ||
          (g.shopUI && g.shopUI.isOpen && g.shopUI.shopId === 'rosa')
        ),
        flashTimer: g.curriculumFlashTimer || 0,
        isTouch: isTouchHud
      });
    }

    // 2. SUPERIOR IZQUIERDA: Corazones + arma/escudo + robotización + stamina
    const heartSlotW = 9;
    const heartsW = g.player.maxHp * heartSlotW + 5;
    const heartsH = barRowH;
    const heartsX = 4;
    const heartsY = topY;

    ctx.fillStyle = 'rgba(10, 14, 24, 0.74)';
    ctx.fillRect(heartsX, heartsY, heartsW, heartsH);
    ctx.strokeStyle = g.player.hasBrokenHeartCurse
      ? 'rgba(244, 63, 94, 0.65)'
      : !g.player.hasArmor
        ? 'rgba(248, 113, 113, 0.45)'
        : g.player.armorPoints > 0
          ? 'rgba(56, 189, 248, 0.80)'
          : 'rgba(229, 192, 123, 0.38)';
    ctx.lineWidth = 1;
    ctx.strokeRect(heartsX + 0.5, heartsY + 0.5, heartsW - 1, heartsH - 1);

    for (let i = 0; i < g.player.maxHp; i++) {
      const hx = heartsX + 2.5 + i * heartSlotW;
      const hy = heartsY + 1.5;

      if (i === g.player.maxHp - 1 && g.player.robotizationLevel > 80) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.fillRect(hx, hy, 8.5, 9);
        ctx.strokeStyle = '#ef4444';
        ctx.strokeRect(hx + 0.5, hy + 0.5, 7.5, 8);
        ctx.font = hudFont(4.4, true);
        ctx.fillStyle = (performance.now() % 400 < 200) ? '#ef4444' : '#fca5a5';
        ctx.textAlign = 'center';
        ctx.fillText('ERR', hx + 4.2, hy + 4.6);
        continue;
      }

      const isArmored = g.player.hasArmor && i < g.player.armorPoints;
      if (isArmored) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(hx + 0.5, hy + 0.5, 8, 8);
      }

      let char = '♥';
      let color = isArmored ? '#38bdf8' : '#ff4d6d';

      if (g.player.hasBrokenHeartCurse && i === g.player.maxHp - 1) {
        if (g.player.hp >= i + 0.5) {
          char = '💔';
          color = '#f43f5e';
        } else {
          char = '🖤';
          color = '#64748b';
        }
      } else if (g.player.hp >= i + 1) {
        char = '♥';
      } else if (g.player.hp > i) {
        char = '💔';
      } else {
        char = '♡';
        color = '#64748b';
      }

      ctx.font = hudFont(6.5);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(char, hx + 4.5, hy + 4.8);
    }

    const corpWeapon = expansionActive && g.player.equippedWeapon && g.player.equippedWeapon !== 'default'
      ? (g.expansionEquipment?.[g.player.equippedWeapon] || g.player.getEquippedWeaponInfo?.())
      : null;
    const corpShield = expansionActive && g.player.equippedShield
      ? (g.expansionEquipment?.[g.player.equippedShield] || g.player.getEquippedShieldInfo?.())
      : null;
    const showWeaponBadge = Boolean(corpWeapon || corpShield || g.player.hasSword);
    const wepBadgeW = showWeaponBadge ? 13 : 0;
    const wepBadgeOffset = showWeaponBadge ? wepBadgeW + 3 : 0;

    if (showWeaponBadge) {
      const wepBadgeX = heartsX + heartsW + 3;
      const wepBadgeY = heartsY;
      const wepGlyphMap = {
        boligrafo: '🖊',
        grapadora: '📎',
        destornillador: '🪛'
      };
      const wepGlyph = corpWeapon ? (wepGlyphMap[corpWeapon.id] || '⚔') : '⚔';
      const wepAccent = corpWeapon?.edgeColor || corpWeapon?.bladeColor || '#fbbf24';

      ctx.fillStyle = 'rgba(10, 14, 24, 0.78)';
      ctx.fillRect(wepBadgeX, wepBadgeY, wepBadgeW, heartsH);
      ctx.strokeStyle = wepAccent;
      ctx.lineWidth = 1;
      ctx.strokeRect(wepBadgeX + 0.5, wepBadgeY + 0.5, wepBadgeW - 1, heartsH - 1);

      ctx.font = hudFont(5.6, true);
      ctx.fillStyle = wepAccent;
      ctx.textAlign = 'center';
      ctx.fillText(wepGlyph, wepBadgeX + wepBadgeW / 2, wepBadgeY + 6.2);

      if (corpShield) {
        ctx.fillStyle = corpShield.id === 'escudo_becario' ? '#60a5fa' : '#d97706';
        ctx.fillRect(wepBadgeX + wepBadgeW - 3, wepBadgeY + 1, 2, 2);
      }
    }

    const showRobotBadge = !isTouchHud && g.player.robotizationLevel > 50;
    if (showRobotBadge) {
      const robVal = Math.round(g.player.robotizationLevel);
      const robBadgeX = heartsX + heartsW + 3 + wepBadgeOffset;
      const robBadgeY = heartsY;
      const robBadgeW = 28;
      const robBadgeH = heartsH;
      const isCrit = robVal > 80;

      ctx.fillStyle = 'rgba(10, 14, 24, 0.78)';
      ctx.fillRect(robBadgeX, robBadgeY, robBadgeW, robBadgeH);
      ctx.strokeStyle = isCrit ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(robBadgeX + 0.5, robBadgeY + 0.5, robBadgeW - 1, robBadgeH - 1);

      ctx.font = hudFont(4.4, true);
      ctx.fillStyle = isCrit ? '#f87171' : '#fde047';
      ctx.textAlign = 'center';
      ctx.fillText(`🤖${robVal}%`, robBadgeX + robBadgeW / 2, robBadgeY + 6.2);
    }

    if (g.player.hasSword && (g.player.stamina < g.player.maxStamina - 0.5 || g.player.comboStep > 0)) {
      const staminaBonusPx = Math.max(0, Math.round((g.player.maxStamina - 100) * 0.45));
      const sw = heartsW + staminaBonusPx;
      const sy = heartsY + heartsH + 1.5;
      ctx.fillStyle = 'rgba(10, 14, 24, 0.72)';
      ctx.fillRect(heartsX, sy, sw, 3);
      const pct = Math.max(0, Math.min(1, g.player.stamina / g.player.maxStamina));
      ctx.fillStyle = pct < 0.25 ? '#ef4444' : '#38bdf8';
      ctx.fillRect(heartsX + 0.5, sy + 0.5, (sw - 1) * pct, 2);
      if (g.player.comboStep > 0) {
        ctx.fillStyle = '#fde047';
        for (let i = 0; i < g.player.comboStep; i++) {
          ctx.fillRect(heartsX + i * 5, sy + 4, 4, 1.5);
        }
      }
    }

    // Sobrescritura del Update Final: tapa corazones/stamina 5 s
    const hiddenBoss = g.enemies.find(
      (e) => e.id === 'boss_final_ai_alex' && e.sceneId === g.tilemap.currentSceneId && !e.dead
    );
    if (hiddenBoss && hiddenBoss.phase === 3 && hiddenBoss._hudHiddenUntil > performance.now()) {
      ctx.fillStyle = 'rgba(3, 5, 10, 0.97)';
      ctx.fillRect(0, 0, heartsX + heartsW + 4, heartsY + heartsH + 12);
      ctx.font = hudFont(5, true);
      ctx.fillStyle = (performance.now() % 300 < 150) ? '#ef4444' : '#fca5a5';
      ctx.textAlign = 'left';
      ctx.fillText('SOBRESCRITO', heartsX + 3, heartsY + 7);
    }

    if (g.player.parryFlashTimer > 0) {
      SpeechBubble.renderCombatBanner(ctx, '¡PARRY PERFECTO!', VIEWPORT_WIDTH / 2, isTouchHud ? 34 : 33);
    }

    // 3. Indicador de Calabozo Municipal
    if (g.isJailedForever || g.jailRemainingSeconds > 0) {
      const jailStr = g.isJailedForever
        ? '⛓ CALABOZO · CADENA PERPETUA'
        : `⛓ CONDENA: ${String(Math.floor(g.jailRemainingSeconds / 60)).padStart(2, '0')}:${String(Math.floor(g.jailRemainingSeconds % 60)).padStart(2, '0')}`;
      ctx.font = hudFont(4.6, true);
      const jw = Math.ceil(ctx.measureText(jailStr).width) + 10;
      const jx = Math.round((VIEWPORT_WIDTH - jw) / 2);
      const jy = topY + barRowH + 2;

      ctx.fillStyle = g.isJailedForever ? 'rgba(90, 10, 10, 0.92)' : 'rgba(140, 25, 25, 0.88)';
      ctx.fillRect(jx, jy, jw, 11);
      ctx.strokeStyle = g.isJailedForever ? '#ff4d6d' : '#ffd166';
      ctx.strokeRect(jx + 0.5, jy + 0.5, jw - 1, 10);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(jailStr, jx + jw / 2, jy + 5.5);
    }

    // 4. Barra de Jefe estilizada en la parte SUPERIOR CENTRAL (deja toda la arena inferior libre)
    const curScene = g.tilemap.currentSceneId;
    const activeBoss = g.enemies.find(
      (e) => e.isBoss && e.sceneId === curScene && (!e.dead || e.defeatBannerTimer > 0)
    );

    if (activeBoss && (activeBoss.activeCombat || activeBoss.dead)) {
      const barW = isTouchHud ? 196 : 216;
      const barH = 12;
      const barX = Math.round((VIEWPORT_WIDTH - barW) / 2);
      const barY = isTouchHud ? 18 : 17;

      ctx.fillStyle = 'rgba(8, 12, 22, 0.78)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.strokeStyle = activeBoss.dead ? '#10b981' : 'rgba(255, 216, 133, 0.72)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

      ctx.font = hudFont(4.4, true);
      const maxNameW = Math.floor(barW * 0.50);
      const nameShown = UILayout.fitText(ctx, activeBoss.name.toUpperCase(), maxNameW);
      ctx.fillStyle = activeBoss.themeColor || '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText(nameShown, barX + 4, barY + 4);

      ctx.font = hudFont(4.2);
      ctx.textAlign = 'right';
      const rightBudget = barW - maxNameW - 10;
      if (activeBoss.dead) {
        ctx.fillStyle = '#fde047';
        const winTxt = UILayout.fitText(ctx, `¡VICTORIA! ${activeBoss.rewardName.toUpperCase()}`, rightBudget);
        ctx.fillText(winTxt, barX + barW - 4, barY + 4);
      } else {
        ctx.fillStyle = '#f8fafc';
        const hpStr = `${Math.ceil(activeBoss.hp)}/${activeBoss.maxHp} HP`;
        const rawStatus = activeBoss.statusText || '';
        const statusFull = rawStatus ? `${hpStr} · ${rawStatus}` : hpStr;
        const rightShown = UILayout.fitText(ctx, statusFull, rightBudget);
        ctx.fillText(rightShown, barX + barW - 4, barY + 4);
      }

      const innerW = barW - 8;
      const innerH = 3.5;
      const innerX = barX + 4;
      const innerY = barY + 7;

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
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

    // 5. INFERIOR CENTRAL: Hotbar visual de 5 slots [1-5] de 16×16 px
    if (typeof g._renderHotbar === 'function') {
      g._renderHotbar(ctx, hudFont, hudShadow);
    } else {
      this.renderHotbar(ctx, hudFont, hudShadow);
    }

    this.renderFloatingTexts(ctx);
    ctx.restore();
  }

  renderFloatingTexts(ctx) {
    const g = this.game;
    const list = g?.floatingTexts;
    if (!Array.isArray(list) || list.length === 0) return;

    const camX = g.camera ? g.camera.renderX : 0;
    const camY = g.camera ? g.camera.renderY : 0;
    ctx.save();
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const ft of list) {
      if (!ft || ft.life <= 0) continue;
      const sx = Math.round(ft.x - camX);
      const sy = Math.round(ft.y - camY);
      const maxLife = ft.maxLife || 0.8;
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.life / maxLife));
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillText(ft.text, sx + 1, sy + 1);
      ctx.fillStyle = ft.color || '#ffffff';
      ctx.fillText(ft.text, sx, sy);
    }
    ctx.restore();
  }

  renderHotbar(ctx, hudFont, hudShadow) {
    const g = this.game;
    g.syncHotbarWithInventory?.();
    const hotbar = typeof g._ensurePlayerHotbar === 'function'
      ? g._ensurePlayerHotbar()
      : (Array.isArray(g.player?.hotbar) ? g.player.hotbar : [null, null, null, null, null]);
    const flashTimers = Array.isArray(g.player?.hotbarFlashTimers)
      ? g.player.hotbarFlashTimers
      : [0, 0, 0, 0, 0];
    const slotSize = 16;
    const gap = 2;
    const totalW = 5 * slotSize + 4 * gap;
    const startX = Math.round((VIEWPORT_WIDTH - totalW) / 2);
    const startY = VIEWPORT_HEIGHT - 18;

    for (let i = 0; i < 5; i++) {
      const sx = startX + i * (slotSize + gap);
      const sy = startY;
      const flash = Math.max(0, flashTimers[i] || 0);
      const isFlashing = flash > 0;
      const scale = isFlashing ? 1.05 : 1.0;

      const itemId = hotbar[i];
      const item = itemId && g.inventory
        ? g.inventory.items.find((it) => it && it.id === itemId && (it.qty || 1) > 0)
        : null;

      ctx.save();
      ctx.translate(sx + slotSize * 0.5, sy + slotSize * 0.5);
      ctx.scale(scale, scale);
      ctx.translate(-slotSize * 0.5, -slotSize * 0.5);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(0, 0, slotSize, slotSize);

      if (!item) {
        ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
        ctx.fillRect(2, 2, slotSize - 4, slotSize - 4);
      }

      ctx.strokeStyle = isFlashing
        ? '#fef08a'
        : (item ? 'rgba(251, 191, 36, 0.85)' : 'rgba(148, 163, 184, 0.30)');
      ctx.lineWidth = isFlashing ? 1.5 : 1;
      ctx.strokeRect(0.5, 0.5, slotSize - 1, slotSize - 1);

      if (item) {
        if (g.inventory && g.inventory.itemsSheet) {
          UILayout.drawItemIcon(ctx, g.inventory.itemsSheet, item.iconIndex, 2, 2, 12);
        } else {
          ctx.font = hudFont(6, true);
          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText('+', 8, 9);
        }
        const qty = item.qty || 1;
        if (qty > 1) {
          ctx.font = hudFont(3.6, true);
          ctx.fillStyle = '#fef08a';
          ctx.textAlign = 'right';
          ctx.fillText(String(qty), slotSize - 1.5, slotSize - 3);
        }
      }

      ctx.font = hudFont(3.6, true);
      ctx.textAlign = 'left';
      ctx.fillStyle = isFlashing ? '#ffffff' : (item ? '#fde68a' : 'rgba(148, 163, 184, 0.65)');
      ctx.fillText(String(i + 1), 1.5, 3.5);

      ctx.restore();
    }
  }

  /**
   * Overlay de depuración [F3]: hitboxes, estado de IA, ruta de A* y datos del jugador.
   */
  renderDebugOverlay(ctx) {
    const g = this.game;
    const { enemies } = g._getActiveSceneEntities();
    const camX = g.camera.renderX;
    const camY = g.camera.renderY;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.font = '5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const pb = g.player.worldBoundingBox;
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

    const p = g.player;
    const lines = [
      `DEBUG [F3]  escena=${g.tilemap.currentSceneId}  x=${Math.round(p.x)} y=${Math.round(p.y)}`,
      `hp=${p.hp}/${p.maxHp}  stamina=${Math.round(p.stamina)}/${p.maxStamina}  combo=${p.comboStep}  parry=${p.parryTimer.toFixed(2)}`,
      `pts=${p.skillPoints} kills=${p.killCount}  dificultad=x${g._getDifficultyScale().toFixed(2)}  enemigos=${enemies.filter((e) => !e.dead).length}`
    ];
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
    ctx.fillRect(2, VIEWPORT_HEIGHT - 26, 230, 24);
    ctx.fillStyle = '#4ade80';
    lines.forEach((l, i) => ctx.fillText(l, 5, VIEWPORT_HEIGHT - 24 + i * 7));
    ctx.restore();
  }

  renderActionPrompt(ctx, action) {
    const g = this.game;
    try {
      SpeechBubble.renderActionPromptBubble(
        ctx,
        action,
        g.camera,
        g.promptTimer,
        g.player
      );
    } catch (err) {
      console.warn('Advertencia no crítica al renderizar bocadillo de acción:', err);
    }
  }

  renderAbyssalPortal(ctx, portalObj = null) {
    const g = this.game;
    const portal = portalObj || g.activeAbyssalPortal;
    if (!portal) return;

    const screenX = Math.round(portal.x - g.camera.renderX);
    const screenY = Math.round(portal.y - g.camera.renderY);
    const t = portal.timer || 0;

    ctx.save();
    const pulse = 0.5 + 0.3 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(147, 51, 234, ${0.35 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(screenX + 10, screenY + 12, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(screenX + 10, screenY + 10);

    ctx.save();
    ctx.rotate(t * 1.8);
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

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
}
