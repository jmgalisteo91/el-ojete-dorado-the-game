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

import { UILayout, UI_COLORS, UI_FONT } from './UILayout.js?v=7';

export class WorldMap {
  constructor(menuSystem = null) {
    this.menuSystem = menuSystem;
    this._lastLocationName = 'Aldea de Valleverde';
    this._lastZoneId = 'center';
  }

  /**
   * Renderiza el mapa completo sobre el canvas lógico (320x180).
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} currentSceneId
   * @param {object|null} player
   * @param {Array|null} enemies
   */
  render(ctx, currentSceneId = 'overworld', player = null, enemies = null) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const t = performance.now() * 0.001;

    // Lienzo interior del mapa (marco de 308x156)
    const mapX = 6;
    const mapY = 16;
    const mapW = W - 12; // 308
    const mapH = 140;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 1. Marco pergamino exterior estilo Zelda clásico
    this._drawZeldaFrame(ctx, W, H);

    // 2. Fondo oceánico y cuadrícula topográfica
    this._drawTopographyBackground(ctx, mapX, mapY, mapW, mapH);

    // 3. Senderos y conexiones viales entre provincias
    this._drawInterconnectingRoads(ctx);

    // 4. Determinar estado de progreso (Núcleos, Reliquias y Bosses)
    const status = this._computeProgressStatus(player, enemies);

    // 5. Determinar la zona y posición del jugador
    const locInfo = this._resolvePlayerLocation(currentSceneId);
    this._lastLocationName = locInfo.title;
    this._lastZoneId = locInfo.zone;

    // 6. Dibujar las 5 Provincias Cardinales
    this._drawNorthPeaksRegion(ctx, locInfo.zone === 'north', status, t);
    this._drawWestWastesRegion(ctx, locInfo.zone === 'west', status, t);
    this._drawCenterVillageRegion(ctx, locInfo.zone === 'center', status, t);
    this._drawEastSanctuaryRegion(ctx, locInfo.zone === 'east', status, t);
    this._drawSouthSwampRegion(ctx, locInfo.zone === 'south', status, t);

    // 7. Decoraciones cartográficas (Rosa de los Vientos)
    this._drawCompassRose(ctx, 22, 140);

    // 8. Marcador de Posición del Héroe "★ TÚ"
    this._drawHeroLocationMarker(ctx, locInfo, t);

    // 9. Encabezado superior y Barra HUD inferior estilo Zelda
    this._drawZeldaHeader(ctx, W);
    this._drawZeldaHUD(ctx, W, H, locInfo, status, player);

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
      return { zone: 'north', x: 172, y: 24, title: 'Minas de la Recursión (Sala de Runas)', detail: 'Cámara del Guardián Stack Overflow' };
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

    const gcDefeated = Boolean(
      player?.dungeonCores?.gc ||
      player?.hasDash ||
      isEnemyDead('boss_garbage_collector') ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('ojete_core_gc') === 'true')
    );

    const stackDefeated = Boolean(
      player?.dungeonCores?.stack ||
      player?.hasChargedAttack ||
      isEnemyDead('boss_stack_overflow') ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('ojete_core_stack') === 'true')
    );

    const microwaveDefeated = Boolean(
      player?.dungeonCores?.microwave ||
      player?.hasBarrier ||
      isEnemyDead('boss_prototype_microwave') ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('ojete_core_microwave') === 'true')
    );

    const alexDefeated = Boolean(
      isEnemyDead('boss_final_ai_alex') ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('ojete_game_won') === 'true')
    );

    const hasArmor = Boolean(player?.hasArmor || (typeof localStorage !== 'undefined' && localStorage.getItem('ojete_armor_obtained') === 'true'));
    const hasSword = Boolean(player?.hasSword || (typeof localStorage !== 'undefined' && localStorage.getItem('ojete_sword_obtained') === 'true'));

    const swordLevel = player?.swordLevel || (hasSword ? 1 : 0);
    const armorLevel = player?.armorLevel || (hasArmor ? 1 : 0);

    const coresCount = (gcDefeated ? 1 : 0) + (stackDefeated ? 1 : 0) + (microwaveDefeated ? 1 : 0);

    return {
      gcDefeated,
      stackDefeated,
      microwaveDefeated,
      alexDefeated,
      hasArmor,
      hasSword,
      swordLevel,
      armorLevel,
      coresCount
    };
  }

  /**
   * Marco antiguo de doble ribete dorado estilo Zelda (A Link to the Past).
   */
  _drawZeldaFrame(ctx, W, H) {
    ctx.fillStyle = '#100b07';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#1c140d';
    ctx.fillRect(2, 2, W - 4, H - 4);

    ctx.strokeStyle = '#7c5f32';
    ctx.lineWidth = 1;
    ctx.strokeRect(3.5, 3.5, W - 7, H - 7);

    ctx.strokeStyle = '#d4af37';
    ctx.strokeRect(5.5, 5.5, W - 11, H - 11);

    // Remaches dorados esquineros
    const corners = [
      [4, 4], [W - 8, 4], [4, H - 8], [W - 8, H - 8]
    ];
    ctx.fillStyle = '#ffd700';
    for (const [cx, cy] of corners) {
      ctx.fillRect(cx, cy, 4, 4);
      ctx.fillStyle = '#996515';
      ctx.fillRect(cx + 1, cy + 1, 2, 2);
      ctx.fillStyle = '#ffd700';
    }
  }

  /**
   * Fondo cartográfico: mar antiguo y cuadrícula náutica tenue.
   */
  _drawTopographyBackground(ctx, mapX, mapY, mapW, mapH) {
    ctx.fillStyle = '#1d3345';
    ctx.fillRect(mapX, mapY, mapW, mapH);

    // Rejilla cartográfica
    ctx.strokeStyle = 'rgba(148, 197, 224, 0.08)';
    ctx.lineWidth = 0.5;
    for (let x = mapX + 20; x < mapX + mapW; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, mapY);
      ctx.lineTo(x, mapY + mapH);
      ctx.stroke();
    }
    for (let y = mapY + 16; y < mapY + mapH; y += 24) {
      ctx.beginPath();
      ctx.moveTo(mapX, y);
      ctx.lineTo(mapX + mapW, y);
      ctx.stroke();
    }
  }

  /**
   * Traza los caminos adoquinados y puentes que comunican Valleverde con las 4 direcciones.
   */
  _drawInterconnectingRoads(ctx) {
    ctx.save();
    // Camino Norte: Valleverde a Cumbres
    ctx.fillStyle = '#8f7b59';
    ctx.fillRect(158, 54, 4, 10);

    // Camino Sur: Valleverde a Marismas
    ctx.fillRect(158, 104, 4, 10);

    // Camino Oeste: Valleverde a Páramo de AI Alex
    ctx.fillRect(98, 82, 14, 4);

    // Camino Este: Valleverde al Valle de la Consagración (Puente de madera)
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(208, 81, 14, 6);
    ctx.fillStyle = '#b38243';
    ctx.fillRect(209, 82, 12, 4);
    for (let bx = 210; bx <= 219; bx += 3) {
      ctx.fillStyle = '#3a2210';
      ctx.fillRect(bx, 81, 1, 6);
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

    // Badge de estado de equipo
    const equipLabel = status.hasArmor && status.hasSword ? '✓ Equipo Consagrado' : 'Pruebas del Héroe';
    this._drawRegionBadge(ctx, rx + rw / 2, ry + rh - 6, equipLabel, status.hasArmor && status.hasSword ? '#6ee7b7' : '#fde047');
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

    const bossText = status.stackDefeated ? '✓ Minas [Stack Overflow Purgado]' : 'Minas: Guardián Stack Overflow';
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
    ctx.strokeStyle = status.coresCount >= 3 ? '#22c55e' : '#ef4444';
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

    const citadelText = status.alexDefeated ? '✓ AI Alex Derrotado' : (status.coresCount >= 3 ? '¡Puerta Abierta! Entra' : 'Ciudadela: Mister AI Alex');
    this._drawRegionBadge(ctx, rx + rw / 2, ry + rh - 6, citadelText, status.alexDefeated ? '#6ee7b7' : (status.coresCount >= 3 ? '#fde047' : '#fca5a5'));
  }

  /**
   * Tarjeta base de provincia con borde iluminado si es la zona activa.
   */
  _drawRegionCard(ctx, x, y, w, h, isActive, bgColor, borderColor, title, t) {
    ctx.save();
    // Fondo de la provincia
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);

    if (isActive) {
      // Halo pulsante Zelda de Zona Activa
      const pulse = 0.65 + Math.sin(t * 6) * 0.35;
      ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
      ctx.lineWidth = 1.8;
      ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);

      // Resplandor interior
      ctx.fillStyle = 'rgba(255, 230, 100, 0.08)';
      ctx.fillRect(x, y, w, h);

      // Pastilla animada superior "► ZONA ACTUAL ◄"
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x + w / 2 - 24, y - 4, 48, 7);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 4.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('► ZONA ACTUAL ◄', x + w / 2, y + 1.2);
    } else {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }

    // Título de la provincia
    ctx.fillStyle = isActive ? '#fffbeb' : '#cbd5e1';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
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

    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy + 0.5);
  }

  /**
   * Marcador de posición animado "★ TÚ" del Héroe estilo Zelda.
   */
  _drawHeroLocationMarker(ctx, locInfo, t) {
    const px = locInfo.x;
    const py = locInfo.y;

    ctx.save();

    // 1. Onda radar concéntrica en expansión
    const ringRadius = 5 + Math.sin(t * 6) * 3;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Icono de Héroe (capucha verde y pluma/espada estilo Link)
    const bob = Math.sin(t * 6) * 1.5;
    const hy = py - 4 + bob;

    // Cabeza / gorro verde
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.moveTo(px, hy - 4);
    ctx.lineTo(px - 3.5, hy + 2);
    ctx.lineTo(px + 3.5, hy + 2);
    ctx.closePath();
    ctx.fill();

    // Cara
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(px - 2, hy + 1, 4, 3);

    // Ojos
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px - 1, hy + 2, 1, 1);
    ctx.fillRect(px + 1, hy + 2, 1, 1);

    // Túnica verde
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(px - 2.5, hy + 4, 5, 3);

    // 3. Cartel "★ TÚ" flotante
    ctx.fillStyle = '#090705';
    ctx.fillRect(px - 10, hy - 13, 20, 8);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(px - 9.5, hy - 12.5, 19, 7);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★ TÚ', px, hy - 8.5);

    ctx.restore();
  }

  /**
   * Encabezado superior del mapa estilo pergamino Zelda.
   */
  _drawZeldaHeader(ctx, W) {
    ctx.fillStyle = 'rgba(15, 11, 7, 0.94)';
    ctx.fillRect(6, 4, W - 12, 11);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(6.5, 4.5, W - 13, 10);

    ctx.fillStyle = '#ffd700';
    ctx.font = `bold 5px ${UI_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🗺️ MAPA DEL REINO DEL GRAN OJAL · CARTOGRAFÍA SAGRADA', 12, 9.5);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = `bold 4.5px ${UI_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('[Esc / M] Cerrar Mapa', W - 12, 9.5);
  }

  /**
   * Barra inferior HUD estilo Zelda (Zócalos de Cristales/Núcleos, Equipo del Héroe y Misión).
   */
  _drawZeldaHUD(ctx, W, H, locInfo, status, player) {
    const barX = 6;
    const barY = H - 22;
    const barW = W - 12;
    const barH = 18;

    ctx.save();
    ctx.fillStyle = 'rgba(12, 9, 6, 0.96)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

    // 1. Zócalos de los 3 Núcleos de Mazmorra (Cristales estilo Zelda Pendants)
    ctx.font = 'bold 4.5px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#ffd700';
    ctx.fillText('NÚCLEOS (3):', barX + 5, barY + 3);

    // Núcleo Verde (Garbage Collector)
    this._drawCrystalGem(ctx, barX + 46, barY + 5, status.gcDefeated, '#22c55e', 'GC');

    // Núcleo Cian (Stack Overflow)
    this._drawCrystalGem(ctx, barX + 72, barY + 5, status.stackDefeated, '#06b6d4', 'STACK');

    // Núcleo Carmesí (Microondas)
    this._drawCrystalGem(ctx, barX + 104, barY + 5, status.microwaveDefeated, '#ef4444', 'FORJA');

    // 2. Reliquias y Nivel de Equipo del Héroe
    const swordLvl = player?.swordLevel || (status.hasSword ? 1 : 0);
    const armorLvl = player?.armorLevel || (status.hasArmor ? 1 : 0);

    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`🛡️Armadura: Nv.${armorLvl}`, barX + 145, barY + 3);
    ctx.fillText(`⚔️Espada: Nv.${swordLvl}`, barX + 210, barY + 3);

    // 3. Línea inferior: Ubicación precisa y Objetivo de la misión
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`📍 ${locInfo.title}`, barX + 5, barY + 11);

    let questText = '';
    if (!status.hasArmor) {
      questText = '🎯 Misión: Consagrar la Armadura Binaria en el Valle del Este.';
    } else if (!status.hasSword) {
      questText = '🎯 Misión: Empuñar la Espada de la Recursividad en el Valle del Este.';
    } else if (status.coresCount < 3) {
      questText = `🎯 Misión: Conseguir los 3 Núcleos de Mazmorra (${status.coresCount}/3) en Norte y Sur.`;
    } else if (!status.alexDefeated) {
      questText = '🎯 ¡FINAL! Abre la Gran Puerta del Núcleo en el Oeste y purga a Mister AI Alex.';
    } else {
      questText = '🏆 ¡VICTORIA! El Reino del Gran Ojal ha sido liberado de Mister AI Alex.';
    }

    ctx.fillStyle = status.coresCount >= 3 ? '#fde047' : '#e2e8f0';
    ctx.textAlign = 'right';
    ctx.fillText(UILayout.fitText(ctx, questText, 180), barX + barW - 6, barY + 11);

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
