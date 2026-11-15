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
    // (DIRECTRIZ UI) Sombra paralela de los paneles del HUD.
    const hudShadow = (x, y, w, h) => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
      ctx.fillRect(x + 2, y + 2, w, h);
    };

    // 1. SUPERIOR DERECHA: reloj digital, icono solar/lunar y micro-indicador cloud
    const timeStr = g.dayNight.getFormattedTime();
    const hour = g.dayNight.timeOfDayHours;
    const isNightHour = hour >= 20 || hour < 6;
    const sunMoonIcon = isNightHour ? '🌙' : '☀️';

    const capsuleW = 62;
    const capsuleH = 14;
    const capsuleX = VIEWPORT_WIDTH - capsuleW - 6;
    const capsuleY = 6;

    hudShadow(capsuleX, capsuleY, capsuleW, capsuleH);
    ctx.fillStyle = 'rgba(13, 17, 23, 0.82)';
    ctx.fillRect(capsuleX, capsuleY, capsuleW, capsuleH);
    ctx.strokeStyle = 'rgba(229, 192, 123, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(capsuleX + 0.5, capsuleY + 0.5, capsuleW - 1, capsuleH - 1);

    ctx.font = hudFont(6);
    ctx.textAlign = 'left';
    ctx.fillText(sunMoonIcon, capsuleX + 4, capsuleY + 7.5);

    ctx.font = hudFont(5.5, true);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillText(timeStr, capsuleX + 17, capsuleY + 8.5);
    ctx.fillStyle = '#ffe599';
    ctx.fillText(timeStr, capsuleX + 16, capsuleY + 7.5);

    const syncColor = g.cloudSyncStatus === 'syncing'
      ? '#38bdf8'
      : (g.hasPendingCloudSync ? '#f59e0b' : '#4ade80');
    ctx.font = hudFont(6);
    ctx.fillStyle = syncColor;
    ctx.textAlign = 'right';
    ctx.fillText('☁', capsuleX + capsuleW - 4, capsuleY + 7.5);

    const expansionActive = Boolean(g.isExpansionActive || g.isExpansionMode);

    // Medidor falso de Felicidad (98%) en Valleverde 2.0
    if (expansionActive && g.tilemap && g.tilemap.currentSceneId === 'valleverde_corp') {
      const hapW = 72;
      const hapH = 12;
      const hapX = VIEWPORT_WIDTH - hapW - 6;
      const hapY = capsuleY + capsuleH + 4;
      hudShadow(hapX, hapY, hapW, hapH);
      ctx.fillStyle = 'rgba(8, 20, 32, 0.88)';
      ctx.fillRect(hapX, hapY, hapW, hapH);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.75)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hapX + 0.5, hapY + 0.5, hapW - 1, hapH - 1);
      ctx.font = hudFont(5, true);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#22d3ee';
      ctx.fillText('😊 FELICIDAD 98%', hapX + 4, hapY + 6.5);
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
    const heartSlotW = 12;
    const heartsW = g.player.maxHp * heartSlotW + 8;
    const heartsH = 15;
    const heartsX = 6;
    const heartsY = 6;

    hudShadow(heartsX, heartsY, heartsW, heartsH);
    ctx.fillStyle = 'rgba(13, 17, 23, 0.82)';
    ctx.fillRect(heartsX, heartsY, heartsW, heartsH);
    ctx.strokeStyle = g.player.hasBrokenHeartCurse
      ? 'rgba(244, 63, 94, 0.65)'
      : !g.player.hasArmor
        ? 'rgba(248, 113, 113, 0.45)'
        : g.player.armorPoints > 0
          ? 'rgba(56, 189, 248, 0.85)'
          : 'rgba(229, 192, 123, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(heartsX + 0.5, heartsY + 0.5, heartsW - 1, heartsH - 1);

    for (let i = 0; i < g.player.maxHp; i++) {
      const hx = heartsX + 4 + i * heartSlotW;
      const hy = heartsY + 2;

      if (i === g.player.maxHp - 1 && g.player.robotizationLevel > 80) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.fillRect(hx, hy, 11, 11);
        ctx.strokeStyle = '#ef4444';
        ctx.strokeRect(hx + 0.5, hy + 0.5, 10, 10);
        ctx.font = hudFont(5.5, true);
        ctx.fillStyle = (performance.now() % 400 < 200) ? '#ef4444' : '#fca5a5';
        ctx.textAlign = 'center';
        ctx.fillText('ERR', hx + 5.5, hy + 6);
        continue;
      }

      const isArmored = g.player.hasArmor && i < g.player.armorPoints;
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

      ctx.font = hudFont(7.5);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(char, hx + 5.5, hy + 6);
    }

    const corpWeapon = expansionActive && g.player.equippedWeapon && g.player.equippedWeapon !== 'default'
      ? (g.expansionEquipment?.[g.player.equippedWeapon] || g.player.getEquippedWeaponInfo?.())
      : null;
    const corpShield = expansionActive && g.player.equippedShield
      ? (g.expansionEquipment?.[g.player.equippedShield] || g.player.getEquippedShieldInfo?.())
      : null;
    const showWeaponBadge = Boolean(corpWeapon || corpShield || g.player.hasSword);
    const wepBadgeW = showWeaponBadge ? 16 : 0;
    const wepBadgeOffset = showWeaponBadge ? wepBadgeW + 4 : 0;

    if (showWeaponBadge) {
      const wepBadgeX = heartsX + heartsW + 4;
      const wepBadgeY = heartsY;
      const wepGlyphMap = {
        boligrafo: '🖊',
        grapadora: '📎',
        destornillador: '🪛'
      };
      const wepGlyph = corpWeapon ? (wepGlyphMap[corpWeapon.id] || '⚔') : '⚔';
      const wepAccent = corpWeapon?.edgeColor || corpWeapon?.bladeColor || '#fbbf24';

      hudShadow(wepBadgeX, wepBadgeY, wepBadgeW, heartsH);
      ctx.fillStyle = 'rgba(13, 17, 23, 0.86)';
      ctx.fillRect(wepBadgeX, wepBadgeY, wepBadgeW, heartsH);
      ctx.strokeStyle = wepAccent;
      ctx.lineWidth = 1;
      ctx.strokeRect(wepBadgeX + 0.5, wepBadgeY + 0.5, wepBadgeW - 1, heartsH - 1);

      ctx.font = hudFont(6.5, true);
      ctx.fillStyle = wepAccent;
      ctx.textAlign = 'center';
      ctx.fillText(wepGlyph, wepBadgeX + wepBadgeW / 2, wepBadgeY + 7.5);

      if (corpShield) {
        ctx.fillStyle = corpShield.id === 'escudo_becario' ? '#60a5fa' : '#d97706';
        ctx.fillRect(wepBadgeX + wepBadgeW - 4, wepBadgeY + 1, 3, 3);
      }
    }

    const showRobotBadge = !isTouchHud && g.player.robotizationLevel > 50;
    if (showRobotBadge) {
      const robVal = Math.round(g.player.robotizationLevel);
      const robBadgeX = heartsX + heartsW + 4 + wepBadgeOffset;
      const robBadgeY = heartsY;
      const robBadgeW = 34;
      const robBadgeH = 15;
      const isCrit = robVal > 80;

      hudShadow(robBadgeX, robBadgeY, robBadgeW, robBadgeH);
      ctx.fillStyle = 'rgba(13, 17, 23, 0.86)';
      ctx.fillRect(robBadgeX, robBadgeY, robBadgeW, robBadgeH);
      ctx.strokeStyle = isCrit ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(robBadgeX + 0.5, robBadgeY + 0.5, robBadgeW - 1, robBadgeH - 1);

      ctx.font = hudFont(5, true);
      ctx.fillStyle = isCrit ? '#f87171' : '#fde047';
      ctx.textAlign = 'center';
      ctx.fillText(`🤖${robVal}%`, robBadgeX + robBadgeW / 2, robBadgeY + 7.5);
    }

    if (g.player.hasSword && (g.player.stamina < g.player.maxStamina - 0.5 || g.player.comboStep > 0)) {
      const staminaBonusPx = Math.max(0, Math.round((g.player.maxStamina - 100) * 0.45));
      const sw = heartsW + staminaBonusPx;
      const sy = heartsY + heartsH + 2;
      hudShadow(heartsX, sy, sw, 4);
      ctx.fillStyle = 'rgba(14, 18, 30, 0.75)';
      ctx.fillRect(heartsX, sy, sw, 4);
      const pct = Math.max(0, Math.min(1, g.player.stamina / g.player.maxStamina));
      ctx.fillStyle = pct < 0.25 ? '#ef4444' : '#38bdf8';
      ctx.fillRect(heartsX + 0.5, sy + 0.5, (sw - 1) * pct, 3);
      if (g.player.comboStep > 0) {
        ctx.fillStyle = '#fde047';
        for (let i = 0; i < g.player.comboStep; i++) {
          ctx.fillRect(heartsX + i * 5, sy + 5, 4, 2);
        }
      }
    }

    // Sobrescritura del Update Final: tapa corazones/stamina 5 s
    const hiddenBoss = g.enemies.find(
      (e) => e.id === 'boss_final_ai_alex' && e.sceneId === g.tilemap.currentSceneId && !e.dead
    );
    if (hiddenBoss && hiddenBoss.phase === 3 && hiddenBoss._hudHiddenUntil > performance.now()) {
      ctx.fillStyle = 'rgba(3, 5, 10, 0.97)';
      ctx.fillRect(0, 0, heartsX + heartsW + 4, heartsY + heartsH + 16);
      ctx.font = hudFont(5.5, true);
      ctx.fillStyle = (performance.now() % 300 < 150) ? '#ef4444' : '#fca5a5';
      ctx.textAlign = 'left';
      ctx.fillText('SOBRESCRITO', heartsX + 3, heartsY + 9);
    }

    // Indicador de Monedas / Bytes (SIEMPRE visible)
    const coinX = showRobotBadge
      ? heartsX + heartsW + 4 + wepBadgeOffset + 34 + 4
      : heartsX + heartsW + 4 + wepBadgeOffset;
    const coinY = heartsY;
    const coinW = 50;
    const coinH = 15;
    hudShadow(coinX, coinY, coinW, coinH);
    ctx.fillStyle = 'rgba(13, 17, 23, 0.82)';
    ctx.fillRect(coinX, coinY, coinW, coinH);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(coinX + 0.5, coinY + 0.5, coinW - 1, coinH - 1);
    ctx.font = hudFont(5, true);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillText(`💰 ${g.player.coins}`, coinX + coinW / 2 + 1, coinY + 8.5);
    ctx.fillStyle = '#fde047';
    ctx.fillText(`💰 ${g.player.coins}`, coinX + coinW / 2, coinY + 7.5);

    // Cápsula compacta de Nivel y XP
    const lvlW = 54;
    const lvlH = 15;
    const inlineLvlX = coinX + coinW + 4;
    const fitsInline = inlineLvlX + lvlW <= capsuleX - 4;
    const lvlX = fitsInline ? inlineLvlX : coinX;
    const lvlY = fitsInline ? coinY : coinY + coinH + 2;

    hudShadow(lvlX, lvlY, lvlW, lvlH);
    ctx.fillStyle = 'rgba(13, 17, 23, 0.82)';
    ctx.fillRect(lvlX, lvlY, lvlW, lvlH);
    ctx.strokeStyle = g.player.isMaxLevel ? '#fbbf24' : 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(lvlX + 0.5, lvlY + 0.5, lvlW - 1, lvlH - 1);

    ctx.textAlign = 'center';
    if (g.player.isMaxLevel) {
      ctx.font = hudFont(4.4, true);
      ctx.fillStyle = '#fde047';
      ctx.fillText('NIVEL MÁXIMO', lvlX + lvlW / 2, lvlY + 7.5);
    } else {
      const xpPct = Math.max(0, Math.min(1, (g.player.getXpProgressPercent?.() || 0) / 100));
      ctx.font = hudFont(4.6, true);
      ctx.fillStyle = '#fef08a';
      ctx.fillText(`NV. ${g.player.level}/15`, lvlX + lvlW / 2, lvlY + 5.5);

      const xpBarX = lvlX + 4;
      const xpBarY = lvlY + 10;
      const xpBarW = lvlW - 8;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(xpBarX, xpBarY, xpBarW, 2.5);
      if (xpPct > 0) {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(xpBarX, xpBarY, Math.max(1, Math.round(xpBarW * xpPct)), 2.5);
      }
    }

    if (g.player.parryFlashTimer > 0) {
      SpeechBubble.renderCombatBanner(ctx, '¡PARRY PERFECTO!', VIEWPORT_WIDTH / 2, isTouchHud ? 18 : 28);
    }

    // 3. Indicador de Calabozo Municipal
    if (g.isJailedForever || g.jailRemainingSeconds > 0) {
      const jailStr = g.isJailedForever
        ? '⛓ CALABOZO · CADENA PERPETUA'
        : `⛓ CONDENA: ${String(Math.floor(g.jailRemainingSeconds / 60)).padStart(2, '0')}:${String(Math.floor(g.jailRemainingSeconds % 60)).padStart(2, '0')}`;
      const jw = Math.ceil(ctx.measureText(jailStr).width) + 12;
      const jx = Math.round((VIEWPORT_WIDTH - jw) / 2);
      const jy = 6;

      ctx.fillStyle = g.isJailedForever ? 'rgba(90, 10, 10, 0.95)' : 'rgba(140, 25, 25, 0.9)';
      ctx.fillRect(jx, jy, jw, 13);
      ctx.strokeStyle = g.isJailedForever ? '#ff4d6d' : '#ffd166';
      ctx.strokeRect(jx + 0.5, jy + 0.5, jw - 1, 12);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(jailStr, jx + jw / 2, jy + 6.5);
    }

    // 4. Barra de Vida de Amenaza Principal en la parte inferior central
    const curScene = g.tilemap.currentSceneId;
    const activeBoss = g.enemies.find(
      (e) => e.isBoss && e.sceneId === curScene && (!e.dead || e.defeatBannerTimer > 0)
    );

    if (activeBoss && (activeBoss.activeCombat || activeBoss.dead)) {
      const barW = 300;
      const barH = 14;
      const barX = Math.round((VIEWPORT_WIDTH - barW) / 2);
      const barY = isTouchHud ? 30 : VIEWPORT_HEIGHT - 44;

      hudShadow(barX, barY - 7, barW, barH + 7);
      ctx.fillStyle = 'rgba(10, 14, 24, 0.88)';
      ctx.fillRect(barX, barY - 7, barW, barH + 7);
      ctx.strokeStyle = activeBoss.dead ? '#10b981' : '#ffd885';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX + 0.5, barY - 6.5, barW - 1, barH + 6);

      ctx.font = hudFont(5.5, true);
      ctx.fillStyle = activeBoss.themeColor || '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText(activeBoss.name.toUpperCase(), barX + 5, barY - 2);

      ctx.font = hudFont(5.5);
      ctx.textAlign = 'right';
      if (activeBoss.dead) {
        ctx.fillStyle = '#fde047';
        ctx.fillText(`¡VICTORIA! HABILIDAD: ${activeBoss.rewardName.toUpperCase()}`, barX + barW - 5, barY - 2);
      } else {
        ctx.fillStyle = '#ffffff';
        const rawStatus = activeBoss.statusText || '';
        const shortStatus = rawStatus.length > 22 ? `${rawStatus.slice(0, 21)}…` : rawStatus;
        const statusAdd = shortStatus ? ` ${shortStatus}` : '';
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

    // 5. INFERIOR CENTRAL: Hotbar visual de 5 slots [1-5] de 16×16 px
    if (typeof g._renderHotbar === 'function') {
      g._renderHotbar(ctx, hudFont, hudShadow);
    } else {
      this.renderHotbar(ctx, hudFont, hudShadow);
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
    const gap = 3;
    const totalW = 5 * slotSize + 4 * gap;
    const startX = Math.round((VIEWPORT_WIDTH - totalW) / 2);
    const startY = VIEWPORT_HEIGHT - 20;

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

      hudShadow(0, 0, slotSize, slotSize);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(0, 0, slotSize, slotSize);

      if (!item) {
        ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
        ctx.fillRect(2, 2, slotSize - 4, slotSize - 4);
      }

      ctx.strokeStyle = isFlashing ? '#fef08a' : '#fbbf24';
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

      ctx.font = hudFont(3.8, true);
      ctx.textAlign = 'left';
      ctx.fillStyle = isFlashing ? '#ffffff' : '#fde68a';
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
