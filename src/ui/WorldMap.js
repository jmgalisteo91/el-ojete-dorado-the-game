/**
 * WorldMap.js - Cartografía Dinámica y Progresión estilo The Legend of Zelda
 * Reino del Gran Ojal · Mapa de las 5 Tierras Cardinales:
 * 
 * • CENTRO: Aldea de Valleverde (Pueblo pacífico, mercado, casas, refugio).
 * • ESTE: Valle de la Consagración (Templo de la Armadura y Templo de la Espada).
 * • NORTE: Cumbres de la Recursión (Picos de silicio, Minas de la Recursión · Stack Overflow).
 * • SUR: Marismas del Hardware Legacy (Cloacas del Garbage Collector & La Forja del Microondas).
 * • OESTE: Páramo Corrupto de Mister AI Alex (Gran Puerta del Núcleo Cuántico & Ciudadela Final).
 * 
 * Proporciona:
 * - Delineación clara de las 5 zonas interconectadas con caminos y puentes.
 * - Resalte dinámico estilo Zelda de la zona activa en la que se encuentra el héroe.
 * - Marcador de posición "★ TÚ" animado y preciso según la sala o interior actual.
 * - Panel inferior con zócalos de los 3 Núcleos de Mazmorra (Verde, Cian, Carmesí),
 *   nivel de Armadura y Espada, y objetivo actual de la aventura.
 */

import { UILayout, UI_COLORS, UI_FONT, LOGICAL_WIDTH, LOGICAL_HEIGHT } from './UILayout.js?v=8';

export class WorldMap {
  constructor(menuSystem = null) {
    this.menuSystem = menuSystem;
    this._lastLocationName = 'Aldea de Valleverde';
    this._lastZoneId = 'center';

    // (FIX M3.3) Vista navegable: pan + zoom + pinch
    this.isTouchDevice = false;
    this.view = { zoom: 1, panX: 0, panY: 0 };
    this.minZoom = 0.9;
    this.maxZoom = 2.2;
    this._buttons = [];
    this._touchWasDown = false;
    this._dragStart = null;
    this._pinchDist = null;
    this._closeRequested = false;
    // (BLOQUE 5) Región bajo el cursor y seleccionada con teclado.
    this._hoverRegion = null;
    this._selectedRegion = null;
  }

  setTouchMode(isTouch) {
    this.isTouchDevice = Boolean(isTouch);
  }

  _mapRect() {
    return { x: 6, y: 16, w: LOGICAL_WIDTH - 12, h: 136 };
  }

  _clampView() {
    const rect = this._mapRect();
    const maxX = (rect.w * (this.view.zoom - 1)) / 2 + 8;
    const maxY = (rect.h * (this.view.zoom - 1)) / 2 + 8;
    this.view.panX = Math.max(-maxX, Math.min(maxX, this.view.panX));
    this.view.panY = Math.max(-maxY, Math.min(maxY, this.view.panY));
  }

  _setZoom(zoom) {
    this.view.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    this._clampView();
  }

  resetView() {
    this.view.zoom = 1;
    this.view.panX = 0;
    this.view.panY = 0;
  }

  consumeCloseRequest() {
    const requested = this._closeRequested;
    this._closeRequested = false;
    return requested;
  }

  _handleButton(id) {
    if (id === 'close') {
      this._closeRequested = true;
    } else if (id === 'in') {
      this._setZoom(this.view.zoom * 1.25);
    } else if (id === 'out') {
      this._setZoom(this.view.zoom / 1.25);
    } else if (id === 'reset') {
      this.resetView();
    }
  }

  /**
   * (FIX M3.3) Pan con un dedo, zoom con pinch y botones de navegación.
   * Se llama cada frame mientras el mapa está abierto.
   */
  updateInput(input) {
    if (!input) return;
    const px = input.pointerX;
    const py = input.pointerY;
    const down = Boolean(input.isPointerDown);

    // (BLOQUE 5.B) Hover / clic de región + selección por teclado.
    const mapRect = this._mapRect();
    if (px >= mapRect.x && px <= mapRect.x + mapRect.w && py >= mapRect.y && py <= mapRect.y + mapRect.h) {
      const hit = this._regionAt(px, py);
      this._hoverRegion = hit ? hit.id : null;
      if (input.pointerJustClicked && hit) this._selectedRegion = hit.id;
    } else {
      this._hoverRegion = null;
    }
    if (typeof input.consumeMenuDirection === 'function') {
      const dir = input.consumeMenuDirection();
      if (dir) this._cycleSelection(dir);
    }

    // Botones de pantalla (sin transformar)
    if (input.pointerJustClicked && this.isTouchDevice) {
      for (const b of this._buttons) {
        if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
          this._handleButton(b.id);
          return;
        }
      }
    }

    const pointers = input.activePointers ? Array.from(input.activePointers.values()) : [];

    // Pinch de dos dedos
    if (pointers.length >= 2) {
      const d = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
      if (this._pinchDist != null && this._pinchDist > 0) {
        this._setZoom(this.view.zoom * (d / this._pinchDist));
      }
      this._pinchDist = d;
      this._dragStart = null;
      return;
    }
    this._pinchDist = null;

    // Pan con un dedo
    if (down && !this._touchWasDown) {
      this._touchWasDown = true;
      const rect = this._mapRect();
      if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) {
        this._dragStart = { x: px, y: py, panX: this.view.panX, panY: this.view.panY };
      }
    } else if (down && this._dragStart) {
      this.view.panX = this._dragStart.panX + (px - this._dragStart.x);
      this.view.panY = this._dragStart.panY + (py - this._dragStart.y);
      this._clampView();
    } else if (!down) {
      this._touchWasDown = false;
      this._dragStart = null;
    }
  }

  _drawMapButtons(ctx, W, H) {
    this._buttons = [];
    if (!this.isTouchDevice) return;
    const r = 8.5;
    const defs = [
      { id: 'close', x: W - 14, y: 26, r, icon: '✕', color: '#f87171' },
      { id: 'in', x: W - 14, y: 48, r, icon: '+', color: '#38bdf8' },
      { id: 'out', x: W - 14, y: 68, r, icon: '−', color: '#38bdf8' },
      { id: 'reset', x: 14, y: 26, r, icon: '⌂', color: '#e5c07b' }
    ];
    for (const b of defs) {
      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 14, 24, 0.85)';
      ctx.fill();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.icon, b.x, b.y + 0.5);
      ctx.restore();
      this._buttons.push({ id: b.id, x: b.x - b.r - 2, y: b.y - b.r - 2, w: (b.r + 2) * 2, h: (b.r + 2) * 2 });
    }
  }

  /** (BLOQUE 5.B) Definición cartográfica de las cinco regiones. */
  _getRegionDefs() {
    return [
      { id: 'north', name: 'Cumbres de la Recursión', short: 'CUMBRES', cx: 160, cy: 35, rx: 46, ry: 17, color: '#94a3b8', icon: 'mountain', desc: 'Minas y Guardián del Stack' },
      { id: 'west', name: 'Dominio de AI Alex', short: 'DOMINIO ALEX', cx: 55, cy: 85, rx: 37, ry: 28, color: '#a855f7', icon: 'eye', desc: 'Ciudadela y Puerta Cuántica' },
      { id: 'center', name: 'Aldea de Valleverde', short: 'VALLEVERDE', cx: 160, cy: 85, rx: 48, ry: 23, color: '#4ade80', icon: 'valley', desc: 'Refugio, mercado y herrería' },
      { id: 'east', name: 'Valle de la Consagración', short: 'VALLE SAGRADO', cx: 265, cy: 85, rx: 37, ry: 28, color: '#fbbf24', icon: 'temple', desc: 'Templos de Espada y Armadura' },
      { id: 'south', name: 'Marismas del Legacy', short: 'MARISMAS', cx: 160, cy: 134, rx: 46, ry: 16, color: '#22c55e', icon: 'skull', desc: 'Cloacas y Forja del Microondas' }
    ];
  }

  /** Región bajo un punto de pantalla, compensando pan/zoom. */
  _regionAt(px, py) {
    const rect = this._mapRect();
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const localX = (px - (cx + this.view.panX)) / this.view.zoom + cx;
    const localY = (py - (cy + this.view.panY)) / this.view.zoom + cy;
    for (const def of this._getRegionDefs()) {
      const dx = (localX - def.cx) / def.rx;
      const dy = (localY - def.cy) / def.ry;
      if (dx * dx + dy * dy <= 1.2) return def;
    }
    return null;
  }

  _cycleSelection(direction) {
    const defs = this._getRegionDefs();
    if (defs.length === 0) return;
    let idx = defs.findIndex((d) => d.id === (this._selectedRegion || this._lastZoneId));
    if (idx < 0) idx = 0;
    const delta = direction === 'up' || direction === 'left' ? -1 : 1;
    this._selectedRegion = defs[(idx + delta + defs.length) % defs.length].id;
  }

  _getExploredZones(currentZone, status) {
    const visited = new Set(['center', currentZone]);
    if (status.hasDash || status.gcDefeated) visited.add('south');
    if (status.hasChargedAttack || status.stackDefeated) visited.add('north');
    if (status.hasBarrier || status.microwaveDefeated) visited.add('south');
    if (status.hasArmor || status.hasSword) visited.add('east');
    if (status.placedCount > 0 || status.alexDefeated) visited.add('west');
    return visited;
  }

  _getQuestZone(status) {
    if (!status.hasArmor || !status.hasSword) return 'east';
    if (!status.gcDefeated) return 'south';
    if (!status.stackDefeated) return 'north';
    if (!status.microwaveDefeated) return 'south';
    if (!status.alexDefeated) return 'west';
    return null;
  }

  _drawRegions(ctx, defs, currentZone, explored, questZone, status, t) {
    for (const def of defs) {
      const active = def.id === currentZone;
      const hover = this._hoverRegion === def.id || this._selectedRegion === def.id;
      this._drawRegionIsland(ctx, def, active, hover, explored.has(def.id), questZone === def.id, t);
    }
  }

  _drawRegionIsland(ctx, def, active, hover, explored, hasQuest, t) {
    ctx.save();
    const makePath = () => {
      const pts = [];
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const wob = 1 + Math.sin(a * 3 + def.cx * 0.05) * 0.06 + Math.sin(a * 5 + def.cy * 0.07) * 0.04;
        pts.push([def.cx + Math.cos(a) * def.rx * wob, def.cy + Math.sin(a) * def.ry * wob]);
      }
      ctx.beginPath();
      const last = pts[pts.length - 1];
      ctx.moveTo((last[0] + pts[0][0]) / 2, (last[1] + pts[0][1]) / 2);
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const next = pts[(i + 1) % n];
        ctx.quadraticCurveTo(p[0], p[1], (p[0] + next[0]) / 2, (p[1] + next[1]) / 2);
      }
      ctx.closePath();
    };

    // (BLOQUE 5.B) Relleno tenue + borde brillante.
    ctx.fillStyle = def.color;
    ctx.globalAlpha = active ? 0.30 : (hover ? 0.28 : (explored ? 0.20 : 0.12));
    makePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    if (active || hover) {
      ctx.strokeStyle = `rgba(253, 224, 71, ${active ? 0.22 : 0.14})`;
      ctx.lineWidth = 4;
      makePath();
      ctx.stroke();
    }
    ctx.strokeStyle = active ? '#ffd700' : (hover ? '#fef08a' : (explored ? def.color : 'rgba(100, 116, 139, 0.65)'));
    ctx.lineWidth = active ? 2 : (hover ? 1.8 : 1.2);
    makePath();
    ctx.stroke();

    // Icono representativo centrado.
    UILayout.drawIcon(ctx, def.icon, def.cx, def.cy - 2, 16, active ? '#ffd700' : def.color);
    UILayout.drawText(ctx, def.short, def.cx, def.cy + 11, {
      font: 'bold 4.2px monospace',
      color: active ? '#ffd700' : '#e2e8f0',
      align: 'center',
      baseline: 'middle',
      shadow: true,
      maxWidth: def.rx * 1.7
    });

    // (BLOQUE 5.E) "!" dorado si la misión principal está en esta región.
    if (hasQuest) {
      const bob = Math.sin(t * 5) * 1.5;
      const qx = def.cx + def.rx * 0.65;
      const qy = def.cy - def.ry * 0.8 + bob;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.arc(qx + 1, qy + 1, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(qx, qy, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#151006';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', qx, qy + 0.5);
    }
    ctx.restore();
  }

  _drawRegionTooltip(ctx, def, locInfo, explored, questZone) {
    const W = LOGICAL_WIDTH;
    const H = LOGICAL_HEIGHT;
    const rect = this._mapRect();
    const mapCX = rect.x + rect.w / 2;
    const mapCY = rect.y + rect.h / 2;
    const sx = (def.cx - mapCX) * this.view.zoom + mapCX + this.view.panX;
    const sy = (def.cy - mapCY) * this.view.zoom + mapCY + this.view.panY;
    const boxW = 104;
    const boxH = 28;
    const x = Math.max(8, Math.min(W - boxW - 8, sx - boxW / 2));
    const y = sy > H * 0.55 ? sy - boxH - 14 : sy + 14;
    const statusText = def.id === locInfo.zone
      ? 'ZONA ACTUAL'
      : (questZone === def.id ? 'MISIÓN PRINCIPAL' : (explored.has(def.id) ? 'EXPLORADA' : 'SIN EXPLORAR'));

    UILayout.drawShadow(ctx, x, y, boxW, boxH, 0.42);
    const g = ctx.createLinearGradient(0, y, 0, y + boxH);
    g.addColorStop(0, 'rgba(15, 23, 42, 0.96)');
    g.addColorStop(1, 'rgba(8, 13, 24, 0.96)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = '#e5c07b';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1);

    UILayout.drawIcon(ctx, def.icon, x + 10, y + 9, 10, def.color);
    UILayout.drawText(ctx, def.name, x + 19, y + 7, {
      font: 'bold 4.6px monospace',
      color: '#ffd700',
      baseline: 'middle',
      maxWidth: boxW - 23
    });
    UILayout.drawText(ctx, statusText, x + 6, y + 17, {
      font: 'bold 3.8px monospace',
      color: questZone === def.id ? '#fde047' : '#94a3b8',
      baseline: 'middle'
    });
    UILayout.drawText(ctx, def.desc, x + 6, y + 23, {
      font: '3.6px monospace',
      color: '#cbd5e1',
      baseline: 'middle',
      maxWidth: boxW - 12
    });
  }

  /**
   * Renderiza el mapa completo sobre el canvas lógico (320x180).
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} currentSceneId
   * @param {object|null} player
   * @param {Array|null} enemies
   */
  render(ctx, currentSceneId = 'overworld', player = null, enemies = null) {
    const W = LOGICAL_WIDTH;
    const H = LOGICAL_HEIGHT;
    const t = performance.now() * 0.001;
    const mapX = 6;
    const mapY = 16;
    const mapW = W - 12;
    const mapH = 136;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // (BLOQUE 5.A) Marco glass premium.
    this._drawZeldaFrame(ctx, W, H);

    const mapCX = mapX + mapW / 2;
    const mapCY = mapY + mapH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapW, mapH);
    ctx.clip();
    ctx.translate(mapCX + this.view.panX, mapCY + this.view.panY);
    ctx.scale(this.view.zoom, this.view.zoom);
    ctx.translate(-mapCX, -mapCY);

    this._drawTopographyBackground(ctx, mapX, mapY, mapW, mapH, t);

    const status = this._computeProgressStatus(player, enemies);
    const locInfo = this._resolvePlayerLocation(currentSceneId);
    this._lastLocationName = locInfo.title;
    this._lastZoneId = locInfo.zone;
    const defs = this._getRegionDefs();
    const explored = this._getExploredZones(locInfo.zone, status);
    const questZone = this._getQuestZone(status);

    // Caminos primero, islas encima.
    this._drawInterconnectingRoads(ctx, defs, explored, locInfo.zone, t);
    this._drawRegions(ctx, defs, locInfo.zone, explored, questZone, status, t);
    this._drawCompassRose(ctx, 22, 140);
    this._drawHeroLocationMarker(ctx, locInfo, t);
    ctx.restore();

    this._drawZeldaHeader(ctx, W);
    this._drawZeldaHUD(ctx, W, H, locInfo, status, player);
    this._drawMapButtons(ctx, W, H);

    const tooltipDef = defs.find((d) => d.id === (this._selectedRegion || this._hoverRegion));
    if (tooltipDef) this._drawRegionTooltip(ctx, tooltipDef, locInfo, explored, questZone);

    ctx.restore();
  }

  /**
   * Resuelve la provincia y coordenadas cartográficas del jugador según la escena.
   */
  _resolvePlayerLocation(sceneId) {
    // CENTRO: Valleverde
    if (sceneId === 'overworld') {
      return { zone: 'center', x: 160, y: 84, title: 'Aldea de Valleverde (Plaza Central)', detail: 'Refugio de la Aldea' };
    }
    if (sceneId === 'player_house') {
      return { zone: 'center', x: 136, y: 76, title: 'Casa del Programador (Tu Hogar)', detail: 'Interior en Valleverde' };
    }
    if (sceneId === 'elder_house') {
      return { zone: 'center', x: 148, y: 70, title: 'Casa del Sabio Aurelio', detail: 'Interior en Valleverde' };
    }
    if (sceneId === 'blacksmith_house') {
      return { zone: 'center', x: 178, y: 70, title: 'Herrería de Brom', detail: 'Taller de Forja' };
    }
    if (sceneId === 'herbalist_house' || sceneId === 'guard_house' || sceneId === 'oracle_house') {
      return { zone: 'center', x: 160, y: 92, title: 'Viviendas de Valleverde', detail: 'Interior en Valleverde' };
    }
    if (sceneId === 'jail_cell') {
      return { zone: 'center', x: 184, y: 92, title: 'Calabozo Municipal de Valleverde', detail: 'Arresto por Falta Leve' };
    }

    // ESTE: Valle de la Consagración
    if (sceneId === 'first_stage') {
      return { zone: 'east', x: 265, y: 84, title: 'Valle de la Consagración (Santuarios)', detail: 'Tierras Sagradas del Este' };
    }
    if (sceneId === 'armor_temple') {
      return { zone: 'east', x: 236, y: 76, title: 'Templo de la Armadura Binaria', detail: 'Prueba de Paridad Lógica' };
    }
    if (sceneId === 'sword_temple') {
      return { zone: 'east', x: 278, y: 70, title: 'Templo de la Espada de la Recursividad', detail: 'Altar de la Recursión' };
    }

    // NORTE: Cumbres de la Recursión
    if (sceneId === 'north_peaks') {
      return { zone: 'north', x: 160, y: 38, title: 'Cumbres de la Recursión (Picos de Silicio)', detail: 'Sendero Montañoso Norte' };
    }
    if (sceneId === 'mines_entry') {
      return { zone: 'north', x: 160, y: 26, title: 'Minas de la Recursión (Piso 1 · Caverna)', detail: 'Entrada del Gran Abismo' };
    }
    if (sceneId === 'mines_puzzle') {
      return { zone: 'north', x: 172, y: 24, title: 'Minas de la Recursión (Sala de Runas)', detail: 'Portal a la Arena del Stack Overflow' };
    }
    if (sceneId === 'mines_boss_arena') {
      return { zone: 'north', x: 180, y: 22, title: 'Minas de la Recursión · Cámara del Stack Overflow', detail: 'Arena del Guardián' };
    }

    // SUR: Marismas del Hardware Legacy
    if (sceneId === 'south_swamp') {
      return { zone: 'south', x: 160, y: 130, title: 'Marismas del Hardware Legacy', detail: 'Ciénaga Tóxica del Sur' };
    }
    if (sceneId === 'sewers_entry' || sceneId === 'sewers_puzzle') {
      return { zone: 'south', x: 132, y: 136, title: 'Cloacas del Legacy (Válvulas y Desagüe)', detail: 'Subterráneo Residual' };
    }
    if (sceneId === 'sewers_dungeon') {
      return { zone: 'south', x: 128, y: 142, title: 'Cloacas: Fosa de Memoria (Garbage Collector)', detail: 'Arena del Mini-Boss' };
    }
    if (sceneId === 'forge_entry' || sceneId === 'forge_puzzle') {
      return { zone: 'south', x: 190, y: 136, title: 'La Forja del Prototipo (Calderas)', detail: 'Galería Térmica' };
    }
    if (sceneId === 'ai_fortress_gate') {
      return { zone: 'south', x: 196, y: 142, title: 'La Forja: Cámara del Microondas Prototipo', detail: 'Arena del Mini-Boss' };
    }

    // OESTE: Páramo de Mister AI Alex
    if (sceneId === 'west_wastes') {
      return { zone: 'west', x: 74, y: 84, title: 'Páramo Corrupto de Mister AI Alex', detail: 'Frontera Occidental Desolada' };
    }
    if (sceneId === 'quantum_gate') {
      return { zone: 'west', x: 44, y: 84, title: 'La Gran Puerta del Núcleo Cuántico', detail: 'Antesala de la Ciudadela' };
    }
    if (sceneId === 'ai_citadel') {
      return { zone: 'west', x: 26, y: 76, title: 'Ciudadela Cuántica de AI Alex · El Gran Ojal', detail: 'Mainframe · Batalla Final' };
    }

    return { zone: 'center', x: 160, y: 84, title: 'Reino del Gran Ojal', detail: 'Tierras Conocidas' };
  }

  /**
   * Determina qué jefes han sido purgados y qué equipo/núcleos posee el jugador.
   */
  _computeProgressStatus(player, enemies) {
    const isEnemyDead = (id) => {
      if (enemies && enemies.some((e) => e.id === id && e.dead)) return true;
      return false;
    };

    // (FIX B7) Solo estado vivo del juego: las claves `ojete_*` de localStorage nunca
    // las escribió nadie (restos del formato v3.4), así que eran ramas muertas.
    const gcDefeated = Boolean(
      player?.dungeonCores?.gc ||
      player?.hasDash ||
      isEnemyDead('boss_garbage_collector')
    );

    const stackDefeated = Boolean(
      player?.dungeonCores?.stack ||
      player?.hasChargedAttack ||
      isEnemyDead('boss_stack_overflow')
    );

    const microwaveDefeated = Boolean(
      player?.dungeonCores?.microwave ||
      player?.hasBarrier ||
      isEnemyDead('boss_prototype_microwave')
    );

    const alexDefeated = isEnemyDead('boss_final_ai_alex');

    const hasArmor = Boolean(player?.hasArmor);
    const hasSword = Boolean(player?.hasSword);

    const swordLevel = player?.swordLevel || (hasSword ? 1 : 0);
    const armorLevel = player?.armorLevel || (hasArmor ? 1 : 0);

    const coresCount = (gcDefeated ? 1 : 0) + (stackDefeated ? 1 : 0) + (microwaveDefeated ? 1 : 0);
    const placedCount = Math.max(0, Math.min(3, Number(player?.gatesUnlocked) || 0));

    return {
      gcDefeated,
      stackDefeated,
      microwaveDefeated,
      alexDefeated,
      hasArmor,
      hasSword,
      swordLevel,
      armorLevel,
      coresCount,
      placedCount
    };
  }

  /**
   * Marco antiguo de doble ribete dorado estilo Zelda (A Link to the Past).
   */
  _drawZeldaFrame(ctx, W, H) {
    // (BLOQUE 5.A) Fondo glass + borde dorado 2 px + brillo cian interior.
    ctx.fillStyle = '#03060c';
    ctx.fillRect(0, 0, W, H);
    const glass = ctx.createLinearGradient(0, 0, 0, H);
    glass.addColorStop(0, 'rgba(17, 29, 48, 0.94)');
    glass.addColorStop(1, 'rgba(4, 8, 15, 0.97)');
    ctx.fillStyle = glass;
    ctx.fillRect(2, 2, W - 4, H - 4);
    ctx.strokeStyle = '#e5c07b';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(6.5, 6.5, W - 13, H - 13);
    ctx.fillStyle = '#ffd700';
    for (const [cx, cy] of [[4, 4], [W - 6, 4], [4, H - 6], [W - 6, H - 6]]) {
      ctx.fillRect(cx, cy, 2, 2);
    }
  }

  /**
   * Fondo cartográfico: mar antiguo y cuadrícula náutica tenue.
   */
  _drawTopographyBackground(ctx, mapX, mapY, mapW, mapH, t = 0) {
    // (BLOQUE 5.A) Gradiente radial azul noche → negro + retícula cian + estrellas.
    const cx = mapX + mapW / 2;
    const cy = mapY + mapH / 2;
    const radial = ctx.createRadialGradient(cx, cy, 8, cx, cy, Math.max(mapW, mapH) * 0.68);
    radial.addColorStop(0, '#142947');
    radial.addColorStop(0.45, '#0a1729');
    radial.addColorStop(1, '#02050b');
    ctx.fillStyle = radial;
    ctx.fillRect(mapX, mapY, mapW, mapH);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
    ctx.lineWidth = 0.5;
    for (let x = mapX + 16; x < mapX + mapW; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, mapY); ctx.lineTo(x, mapY + mapH); ctx.stroke();
    }
    for (let y = mapY + 12; y < mapY + mapH; y += 24) {
      ctx.beginPath(); ctx.moveTo(mapX, y); ctx.lineTo(mapX + mapW, y); ctx.stroke();
    }
    for (let i = 0; i < 44; i++) {
      const sx = mapX + ((i * 73 + 17) % mapW);
      const sy = mapY + ((i * 47 + 11) % mapH);
      const twinkle = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2 + i));
      ctx.fillStyle = `rgba(186, 230, 253, ${twinkle.toFixed(2)})`;
      ctx.fillRect(sx, sy, i % 7 === 0 ? 2 : 1, 1);
    }
    const vignette = ctx.createRadialGradient(cx, cy, mapH * 0.3, cx, cy, mapW * 0.62);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(mapX, mapY, mapW, mapH);
  }

  /**
   * Traza los caminos adoquinados y puentes que comunican Valleverde con las 4 direcciones.
   */
  _drawInterconnectingRoads(ctx, defs, explored, currentZone, t) {
    // (BLOQUE 5.C) Caminos curvos discontinuos: oro si explorados, gris si no.
    const center = defs.find((d) => d.id === 'center');
    if (!center) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const def of defs) {
      if (def.id === 'center') continue;
      const visited = explored.has(def.id);
      ctx.strokeStyle = visited ? 'rgba(253, 224, 71, 0.92)' : 'rgba(100, 116, 139, 0.32)';
      ctx.lineWidth = visited ? 1.5 : 1;
      ctx.setLineDash(visited ? [4, 3] : [2, 4]);
      ctx.lineDashOffset = -(t * 14) % 7;
      const midX = (center.cx + def.cx) / 2;
      const midY = (center.cy + def.cy) / 2;
      const dx = def.cx - center.cx;
      const dy = def.cy - center.cy;
      const len = Math.hypot(dx, dy) || 1;
      const curve = def.id === 'north' || def.id === 'south' ? 10 : 7;
      ctx.beginPath();
      ctx.moveTo(center.cx, center.cy);
      ctx.quadraticCurveTo(midX + (-dy / len) * curve, midY + (dx / len) * curve, def.cx, def.cy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * CENTRO: Aldea de Valleverde (Pueblo Pacífico / Refugio del Jugador).
   */
  _drawCenterVillageRegion(ctx, isActive, status, t) {
    const rx = 108;
    const ry = 60;
    const rw = 104;
    const rh = 46;

    this._drawRegionCard(ctx, rx, ry, rw, rh, isActive, '#2e6b28', '#4c9644', 'CENTRO · ALDEA DE VALLEVERDE', t);

    // Río Alba que cruza el este de la aldea
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(rx + 90, ry + 4, 6, rh - 8);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(rx + 92, ry + 4, 2, rh - 8);

    // Plaza de adoquines central
    ctx.fillStyle = '#a89885';
    ctx.fillRect(rx + 36, ry + 12, 32, 22);
    ctx.strokeStyle = '#6e5f4f';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(rx + 36.5, ry + 12.5, 31, 21);

    // Pozo de agua en el centro de la plaza
    ctx.fillStyle = '#334155';
    ctx.fillRect(rx + 50, ry + 20, 5, 5);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(rx + 51, ry + 21, 3, 3);

    // Casas con tejados rojos y azules
    // Casa Programador (Oeste)
    this._drawTinyHouse(ctx, rx + 16, ry + 14, '#b91c1c', '#f87171');
    // Casa Sabio Aurelio (Norte)
    this._drawTinyHouse(ctx, rx + 44, ry + 6, '#1d4ed8', '#60a5fa');
    // Herrería de Brom (Noreste)
    this._drawTinyHouse(ctx, rx + 74, ry + 6, '#9a3412', '#f97316');
    // Cuartel de la Guardia / Calabozo (Sur)
    this._drawTinyHouse(ctx, rx + 70, ry + 26, '#374151', '#9ca3af');

    // Arboledas verdes
    this._drawTinyTree(ctx, rx + 8, ry + 8);
    this._drawTinyTree(ctx, rx + 8, ry + 30);
    this._drawTinyTree(ctx, rx + 24, ry + 32);

    // Etiqueta de la zona
    this._drawRegionBadge(ctx, rx + rw / 2, ry + rh - 6, 'Pueblo Pacífico (Refugio & Tiendas)', '#a7f3d0');
  }

  /**
   * ESTE: Valle de la Consagración (Templos de Armadura y Espada).
   */
  _drawEastSanctuaryRegion(ctx, isActive, status, t) {
    const rx = 218;
    const ry = 52;
    const rw = 94;
    const rh = 62;

    this._drawRegionCard(ctx, rx, ry, rw, rh, isActive, '#1e293b', '#334155', 'ESTE · VALLE CONSAGRACIÓN', t);

    // Senderos sagrados
    ctx.fillStyle = '#64748b';
    ctx.fillRect(rx + 4, ry + 31, 86, 3);
    ctx.fillRect(rx + 22, ry + 16, 3, 16);
    ctx.fillRect(rx + 62, ry + 16, 3, 16);

    // 1. Templo de la Armadura Binaria (Noroeste del Valle)
    const armorX = rx + 22;
    const armorY = ry + 12;
    this._drawTempleShrine(ctx, armorX, armorY, '#38bdf8', '🛡️');
    if (status.hasArmor) {
      this._drawMiniCheck(ctx, armorX + 8, armorY - 4);
    }

    // 2. Templo de la Espada de la Recursividad (Noreste del Valle)
    const swordX = rx + 62;
    const swordY = ry + 12;
    this._drawTempleShrine(ctx, swordX, swordY, '#f59e0b', '⚔️');
    if (status.hasSword) {
      this._drawMiniCheck(ctx, swordX + 8, swordY - 4);
    }

    // Altar de reliquias en el centro-sur
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(rx + 36, ry + 36, 22, 12);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(rx + 36.5, ry + 36.5, 21, 11);

    ctx.font = 'bold 4.5px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('ALTAR SACRO', rx + 47, ry + 43);

    // Badge de estado de equipo y del Guardián del Stack Overflow (vive en el Templo de la Espada)
    const isEquipped = status.hasArmor && status.hasSword;
    let equipLabel = 'Pruebas del Héroe';
    let equipColor = '#fde047';
    if (isEquipped) {
      equipLabel = status.stackDefeated ? '✓ Equipo y Stack Purgado' : 'Templo Espada: Stack Overflow';
      equipColor = status.stackDefeated ? '#6ee7b7' : '#7dd3fc';
    }
    this._drawRegionBadge(ctx, rx + rw / 2, ry + rh - 6, equipLabel, equipColor);
  }

  /**
   * NORTE: Las Cumbres de la Recursión (Picos de Silicio, Nieve & Minas).
   */
  _drawNorthPeaksRegion(ctx, isActive, status, t) {
    const rx = 108;
    const ry = 16;
    const rw = 104;
    const rh = 40;

    this._drawRegionCard(ctx, rx, ry, rw, rh, isActive, '#1e293b', '#475569', 'NORTE · CUMBRES RECURSIÓN', t);

    // Picos nevados
    this._drawSnowMountain(ctx, rx + 16, ry + 24, 20, 16);
    this._drawSnowMountain(ctx, rx + 86, ry + 24, 20, 16);
    this._drawSnowMountain(ctx, rx + 32, ry + 20, 16, 12);
    this._drawSnowMountain(ctx, rx + 72, ry + 20, 16, 12);

    // Entrada a las Minas de la Recursión (Cueva central)
    const caveX = rx + rw / 2;
    const caveY = ry + 16;

    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(caveX, caveY + 4, 7, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Cristales de silicio brillantes
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(caveX - 14, caveY + 2, 2, 5);
    ctx.fillRect(caveX + 12, caveY + 2, 2, 5);

    // Indicador Mini-Boss / Núcleo Cian
    if (status.stackDefeated) {
      this._drawMiniCheck(ctx, caveX + 10, caveY - 6);
    } else {
      this._drawMiniSkull(ctx, caveX + 10, caveY - 6, '#06b6d4', t);
    }

    const bossText = status.stackDefeated ? '✓ Minas [Stack Overflow Purgado]' : 'Minas: Abismo (requiere Dash)';
    this._drawRegionBadge(ctx, caveX, ry + rh - 6, bossText, status.stackDefeated ? '#6ee7b7' : '#7dd3fc');
  }

  /**
   * SUR: Las Marismas del Hardware Legacy (Cloacas y La Forja del Prototipo).
   */
  _drawSouthSwampRegion(ctx, isActive, status, t) {
    const rx = 108;
    const ry = 112;
    const rw = 104;
    const rh = 42;

    this._drawRegionCard(ctx, rx, ry, rw, rh, isActive, '#192618', '#2e3d2c', 'SUR · MARISMAS DEL LEGACY', t);

    // Charcas de fango y líquido tóxico
    ctx.fillStyle = '#14532d';
    ctx.fillRect(rx + 10, ry + 12, 18, 10);
    ctx.fillRect(rx + 76, ry + 12, 18, 10);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(rx + 14, ry + 15, 10, 4);

    // 1. Cloacas del Legacy (Suroeste · Garbage Collector)
    const sewersX = rx + 24;
    const sewersY = ry + 18;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(sewersX - 6, sewersY - 4, 12, 9);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.strokeRect(sewersX - 5.5, sewersY - 3.5, 11, 8);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(sewersX - 2, sewersY - 1, 4, 3);

    if (status.gcDefeated) {
      this._drawMiniCheck(ctx, sewersX + 8, sewersY - 8);
    } else {
      this._drawMiniSkull(ctx, sewersX + 8, sewersY - 8, '#22c55e', t);
    }

    // 2. La Forja del Prototipo (Sureste · Microondas)
    const forgeX = rx + 80;
    const forgeY = ry + 18;
    ctx.fillStyle = '#431407';
    ctx.fillRect(forgeX - 6, forgeY - 4, 12, 9);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1;
    ctx.strokeRect(forgeX - 5.5, forgeY - 3.5, 11, 8);
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(forgeX - 2, forgeY - 1, 4, 3);

    if (status.microwaveDefeated) {
      this._drawMiniCheck(ctx, forgeX + 8, forgeY - 8);
    } else {
      this._drawMiniSkull(ctx, forgeX + 8, forgeY - 8, '#f97316', t);
    }

    const swampText = status.gcDefeated && status.microwaveDefeated ? '✓ Mazmorras del Sur Purgadas' : 'Cloacas [GC] · Forja [Horno]';
    this._drawRegionBadge(ctx, rx + rw / 2, ry + rh - 6, swampText, status.gcDefeated && status.microwaveDefeated ? '#6ee7b7' : '#fdba74');
  }

  /**
   * OESTE: El Páramo Corrupto de Mister AI Alex (Gran Puerta del Núcleo & Ciudadela Final).
   */
  _drawWestWastesRegion(ctx, isActive, status, t) {
    const rx = 8;
    const ry = 52;
    const rw = 94;
    const rh = 62;

    this._drawRegionCard(ctx, rx, ry, rw, rh, isActive, '#1c0d1c', '#2e122b', 'OESTE · DOMINIO DE AI ALEX', t);

    // Líneas de pulso cibernético
    const pulseAlpha = 0.4 + Math.sin(t * 5) * 0.25;
    ctx.strokeStyle = `rgba(168, 85, 247, ${pulseAlpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + 86, ry + 32);
    ctx.lineTo(rx + 56, ry + 32);
    ctx.lineTo(rx + 32, ry + 24);
    ctx.stroke();

    // 1. La Gran Puerta del Núcleo Cuántico
    const gateX = rx + 56;
    const gateY = ry + 32;
    ctx.fillStyle = '#0f0511';
    ctx.fillRect(gateX - 6, gateY - 8, 12, 16);
    ctx.strokeStyle = status.placedCount >= 3 ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 1;
    ctx.strokeRect(gateX - 5.5, gateY - 7.5, 11, 15);

    // Zócalos de los 3 núcleos en la puerta
    ctx.fillStyle = status.gcDefeated ? '#22c55e' : '#334155';
    ctx.fillRect(gateX - 3, gateY - 5, 2, 2);
    ctx.fillStyle = status.stackDefeated ? '#06b6d4' : '#334155';
    ctx.fillRect(gateX + 1, gateY - 5, 2, 2);
    ctx.fillStyle = status.microwaveDefeated ? '#ef4444' : '#334155';
    ctx.fillRect(gateX - 1, gateY - 1, 2, 2);

    // 2. Ciudadela Cuántica de Alex (Fortaleza Final)
    const citadelX = rx + 24;
    const citadelY = ry + 22;
    ctx.fillStyle = '#09030b';
    ctx.fillRect(citadelX - 8, citadelY - 8, 16, 18);
    ctx.strokeStyle = '#d946ef';
    ctx.lineWidth = 1;
    ctx.strokeRect(citadelX - 7.5, citadelY - 7.5, 15, 17);

    // Antena y Ojo Rojo de Mister AI Alex
    ctx.strokeStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(citadelX, citadelY - 8);
    ctx.lineTo(citadelX, citadelY - 14);
    ctx.stroke();

    const eyePulse = 1.5 + Math.sin(t * 6) * 0.8;
    ctx.fillStyle = status.alexDefeated ? '#10b981' : '#ff0055';
    ctx.beginPath();
    ctx.arc(citadelX, citadelY, eyePulse, 0, Math.PI * 2);
    ctx.fill();

    // Calavera del jefe final
    if (status.alexDefeated) {
      this._drawMiniCheck(ctx, citadelX + 11, citadelY - 6);
    } else {
      this._drawMiniSkull(ctx, citadelX + 11, citadelY - 6, '#ef4444', t, true);
    }

    const citadelText = status.alexDefeated ? '✓ AI Alex Derrotado' : (status.placedCount >= 3 ? '¡Puerta Abierta! Entra' : 'Ciudadela: Mister AI Alex');
    this._drawRegionBadge(ctx, rx + rw / 2, ry + rh - 6, citadelText, status.alexDefeated ? '#6ee7b7' : (status.placedCount >= 3 ? '#fde047' : '#fca5a5'));
  }

  /**
   * Tarjeta base de provincia con borde iluminado si es la zona activa.
   */
  _drawRegionCard(ctx, x, y, w, h, isActive, bgColor, borderColor, title, t) {
    ctx.save();
    // (BLOQUE 3.2) Silueta orgánica tipo isla en lugar de rectángulo.
    const cx = x + w / 2;
    const cy = y + h / 2;
    const blob = () => {
      ctx.beginPath();
      for (let i = 0; i <= 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const wob = 1 + Math.sin(a * 3 + x * 0.04) * 0.055 + Math.sin(a * 5 + y * 0.05) * 0.035;
        const px = cx + Math.cos(a) * (w / 2) * wob;
        const py = cy + Math.sin(a) * (h / 2) * wob;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    ctx.fillStyle = bgColor;
    blob();
    ctx.fill();

    if (isActive) {
      const pulse = 0.65 + Math.sin(t * 6) * 0.35;
      ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
      ctx.lineWidth = 1.8;
      blob();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 230, 100, 0.08)';
      blob();
      ctx.fill();

      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x + w / 2 - 24, y - 4, 48, 7);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 4.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('► ZONA ACTUAL ◄', x + w / 2, y + 1.2);
    } else {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      blob();
      ctx.stroke();
    }

    // Título con sombra negra.
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillText(title, x + w / 2 + 1, y + 7);
    ctx.fillStyle = isActive ? '#fffbeb' : '#cbd5e1';
    ctx.fillText(title, x + w / 2, y + 6);

    ctx.restore();
  }

  /**
   * Rótulo inferior de sub-área / estado de provincia.
   */
  _drawRegionBadge(ctx, cx, cy, text, color) {
    ctx.font = 'bold 4.5px monospace';
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(10, 8, 6, 0.85)';
    ctx.fillRect(cx - tw / 2 - 3, cy - 3.5, tw + 6, 7);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cx - tw / 2 - 2.5, cy - 3, tw + 5, 6);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx + 1, cy + 1.5);
    ctx.fillStyle = color;
    ctx.fillText(text, cx, cy + 0.5);
  }

  /**
   * Marcador de posición animado "★ TÚ" del Héroe estilo Zelda.
   */
  _drawHeroLocationMarker(ctx, locInfo, t) {
    const px = locInfo.x;
    const py = locInfo.y;
    const pulse = 1 + Math.sin(t * 5) * 0.15;
    const rotation = Math.sin(t * 0.7) * 0.3;
    ctx.save();
    const glow = ctx.createRadialGradient(px, py, 1, px, py, 18 * pulse);
    glow.addColorStop(0, 'rgba(253, 224, 71, 0.5)');
    glow.addColorStop(0.55, 'rgba(253, 224, 71, 0.16)');
    glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - 19, py - 19, 38, 38);
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, py, 7 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.translate(px, py);
    ctx.rotate(rotation);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 4;
      const r = i % 2 === 0 ? 7 : 2.2;
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath(); ctx.arc(0, 0, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    UILayout.drawText(ctx, '★ TÚ', px, py - 13, {
      font: 'bold 5px monospace', color: '#ffd700', align: 'center', baseline: 'middle', shadow: true
    });
  }

  /**
   * Encabezado superior del mapa estilo pergamino Zelda.
   */
  _drawZeldaHeader(ctx, W) {
    // (BLOQUE 5.A) Cabecera glass con subrayado luminoso.
    UILayout.drawShadow(ctx, 6, 4, W - 12, 11, 0.4);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.fillRect(6, 4, W - 12, 11);
    ctx.strokeStyle = '#e5c07b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(6.75, 4.75, W - 13.5, 9.5);
    UILayout.drawIcon(ctx, 'map', 13, 9.5, 8, '#e5c07b');
    UILayout.drawText(ctx, 'MAPA DEL REINO DEL GRAN OJAL · CARTOGRAFÍA SAGRADA', 20, 9.5, {
      font: 'bold 5px monospace', color: '#ffd700', shadow: true
    });
    UILayout.drawText(ctx, '[Esc / M] Cerrar', W - 12, 9.5, {
      font: 'bold 4.5px monospace', color: '#e2e8f0', align: 'right', shadow: true
    });
  }

  /**
   * Barra inferior HUD estilo Zelda (Zócalos de Cristales/Núcleos, Equipo del Héroe y Misión).
   */
  _drawZeldaHUD(ctx, W, H, locInfo, status, player) {
    // (BLOQUE 5.E) Panel inferior glass: Zona Actual · Progreso · Núcleos.
    const barX = 6;
    const barY = H - 24;
    const barW = W - 12;
    const barH = 21;

    ctx.save();
    UILayout.drawShadow(ctx, barX, barY, barW, barH, 0.42);
    const glass = ctx.createLinearGradient(0, barY, 0, barY + barH);
    glass.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
    glass.addColorStop(1, 'rgba(7, 12, 22, 0.96)');
    ctx.fillStyle = glass;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#e5c07b';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX + 1, barY + 1, barW - 2, barH - 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 4.5, barY + 4.5, barW - 9, barH - 9);

    // Columna 1: Zona actual.
    UILayout.drawIcon(ctx, 'compass', barX + 12, barY + 8, 8, '#38bdf8');
    UILayout.drawText(ctx, 'ZONA ACTUAL', barX + 21, barY + 5.5, {
      font: 'bold 3.8px monospace', color: '#38bdf8', shadow: true
    });
    // Nombre de zona sin el paréntesis de sub-área para que respire.
    const zoneName = locInfo.title.split(' (')[0];
    UILayout.drawText(ctx, UILayout.fitText(ctx, zoneName, 112), barX + 8, barY + 15.5, {
      font: 'bold 4.6px monospace', color: '#f8fafc', shadow: true, maxWidth: 112
    });

    ctx.strokeStyle = 'rgba(229, 192, 123, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(barX + 137, barY + 4); ctx.lineTo(barX + 137, barY + barH - 4); ctx.stroke();

    // Columna 2: Progreso de misiones.
    const questLog = this.menuSystem?.worldMapContext?.questLog;
    let done = 0;
    let total = 0;
    if (questLog && typeof questLog.getAllQuests === 'function') {
      const all = questLog.getAllQuests();
      total = all.length;
      done = all.filter((q) => q.status === 'COMPLETED').length;
    }
    if (total === 0) {
      total = 6;
      done = [
        status.hasArmor, status.hasSword, status.gcDefeated,
        status.stackDefeated, status.microwaveDefeated, status.alexDefeated
      ].filter(Boolean).length;
    }
    UILayout.drawIcon(ctx, 'scroll', barX + 147, barY + 8, 8, '#fde047');
    UILayout.drawText(ctx, 'PROGRESO', barX + 156, barY + 5.5, {
      font: 'bold 3.8px monospace', color: '#fde047', shadow: true
    });
    UILayout.drawText(ctx, `${done}/${total} MISIONES`, barX + 143, barY + 15.5, {
      font: 'bold 4.6px monospace', color: '#f8fafc', shadow: true
    });

    ctx.beginPath(); ctx.moveTo(barX + 222, barY + 4); ctx.lineTo(barX + 222, barY + barH - 4); ctx.stroke();

    // Columna 3: Núcleos.
    UILayout.drawText(ctx, 'NÚCLEOS', barX + 230, barY + 5.5, {
      font: 'bold 3.8px monospace', color: '#a7f3d0', shadow: true
    });
    this._drawCrystalGem(ctx, barX + 238, barY + 12, status.gcDefeated, '#22c55e', 'GC');
    this._drawCrystalGem(ctx, barX + 258, barY + 12, status.stackDefeated, '#06b6d4', 'STACK');
    this._drawCrystalGem(ctx, barX + 283, barY + 12, status.microwaveDefeated, '#ef4444', 'FORJA');
    UILayout.drawText(ctx, `${status.coresCount}/3`, barX + barW - 6, barY + 15.5, {
      font: 'bold 4.4px monospace', color: '#ffd700', align: 'right', shadow: true
    });

    ctx.restore();
  }

  /**
   * Dibuja un gema/cristal sagrado en su zócalo de la barra HUD.
   */
  _drawCrystalGem(ctx, x, y, isCollected, glowColor, label) {
    ctx.save();
    // Zócalo metálico
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.strokeStyle = isCollected ? glowColor : '#475569';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x - 2.5, y - 2.5, 5, 5);

    if (isCollected) {
      ctx.fillStyle = glowColor;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }

    ctx.font = 'bold 4px monospace';
    ctx.fillStyle = isCollected ? glowColor : '#64748b';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 5, y);
    ctx.restore();
  }

  /**
   * Dibuja una casa en miniatura con tejado a dos aguas.
   */
  _drawTinyHouse(ctx, x, y, wallColor, roofColor) {
    ctx.fillStyle = wallColor;
    ctx.fillRect(x, y + 3, 7, 5);
    ctx.fillStyle = roofColor;
    ctx.fillRect(x - 1, y + 1, 9, 2);
    ctx.fillRect(x + 1, y - 1, 5, 2);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 2, y + 5, 3, 3);
  }

  /**
   * Dibuja un árbol verde en miniatura.
   */
  _drawTinyTree(ctx, x, y) {
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(x + 2, y + 4, 2, 3);
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(x + 3, y + 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Dibuja un templo/santuario en miniatura con columnas y frontón.
   */
  _drawTempleShrine(ctx, x, y, accentColor, icon) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 6, y - 3, 12, 10);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 5.5, y - 2.5, 11, 9);

    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y + 2);
  }

  /**
   * Dibuja una montaña con cumbre nevada.
   */
  _drawSnowMountain(ctx, mx, my, mw, mh) {
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(mx, my - mh);
    ctx.lineTo(mx + mw / 2, my);
    ctx.lineTo(mx - mw / 2, my);
    ctx.closePath();
    ctx.fill();

    // Cumbre de nieve blanca
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(mx, my - mh);
    ctx.lineTo(mx + mw / 4, my - mh * 0.55);
    ctx.lineTo(mx, my - mh * 0.65);
    ctx.lineTo(mx - mw / 4, my - mh * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Calavera pixel-art de jefe.
   */
  _drawMiniSkull(ctx, x, y, accentColor = '#ef4444', t = 0, isCrown = false) {
    const pulse = 0.8 + Math.sin(t * 6) * 0.2;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = accentColor;
    ctx.fillRect(x - 3, y - 3, 7, 6);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - 2, y - 2, 5, 3);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 1, y - 1, 1, 1);
    ctx.fillRect(x + 1, y - 1, 1, 1);

    if (isCrown) {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x - 2, y - 4, 5, 1);
    }
    ctx.restore();
  }

  /**
   * Check verde pixel-art para jefes o salas superadas.
   */
  _drawMiniCheck(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x - 2.5, y - 2.5, 5, 5);

    ctx.fillStyle = '#6ee7b7';
    ctx.fillRect(x - 1, y + 1, 1, 1);
    ctx.fillRect(x, y + 2, 1, 1);
    ctx.fillRect(x + 1, y, 1, 2);
    ctx.restore();
  }

  /**
   * Rosa de los vientos náutica retro en la esquina del mar.
   */
  _drawCompassRose(ctx, cx, cy) {
    const r = 8;
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Flecha Norte roja
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - r - 2);
    ctx.lineTo(cx - 2, cy);
    ctx.closePath();
    ctx.fill();

    // Flecha Sur/Este/Oeste doradas
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - r - 2);
    ctx.lineTo(cx + 2, cy);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + r + 1);
    ctx.lineTo(cx + 2, cy);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r + 1, cy);
    ctx.lineTo(cx, cy + 2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - r - 1, cy);
    ctx.lineTo(cx, cy + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('N', cx, cy - r - 3);
  }
}
