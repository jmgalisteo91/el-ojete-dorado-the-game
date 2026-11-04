/**
 * WorldMap.js - Pantalla de Cartografía y Progresión de 'El Ojete Dorado: The Game'
 * 
 * Representa la geografía sagrada del Reino del Gran Ojal con sus 4 nodos de progresión lógica:
 * 1. Villa de Valleverde (Centro / Refugio) + Sub-nodo Alcantarillas (Garbage Collector Furioso).
 * 2. Santuario de las Pruebas (Este, cruzando el río) + Templo de la Espada (Guardián del Stack Overflow).
 * 3. Ruinas Exteriores / Tierras Hostiles (Oeste) + Puesto Lab Alpha (Microondas Prototipo).
 * 4. Ciudadela de AI Alex (Norte) + Núcleo del Gran Ojal (Microondas Cuántico Final).
 * 
 * Soporta estados activos/despejados de los jefes, marcador de posición '★ TÚ' y estética retro pixel art.
 */

export class WorldMap {
  constructor(menuSystem = null) {
    this.menuSystem = menuSystem;
  }

  /**
   * Renderiza el mapa completo sobre el canvas lógico (320x180).
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} currentSceneId - ID de la escena actual del jugador
   * @param {object|null} player - Instancia del jugador para leer habilidades obtenidas
   * @param {Array|null} enemies - Lista de enemigos/jefes del mundo
   */
  render(ctx, currentSceneId = 'overworld', player = null, enemies = null) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const cx = W / 2;
    const t = performance.now() * 0.001;

    // Lienzo interior del mapa (marco de 308x148)
    const mapX = 6;
    const mapY = 16;
    const mapW = W - 12; // 308
    const mapH = 148;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 1. Marco pergamino exterior
    this._drawParchmentBorder(ctx, W, H);

    // 2. Fondo oceánico y rejilla cartográfica náutica
    this._drawOceanAndGrid(ctx, mapX, mapY, mapW, mapH);

    // 3. Masas continentales y costas
    this._drawCoastlines(ctx, mapX, mapY);

    // 4. Senderos y ruta de progresión lógica entre los 4 nodos
    this._drawProgressionPathways(ctx, mapX, mapY, t);

    // 5. Detectar estado de progreso y jefes regionales derrotados
    const garbageCollectorDefeated = Boolean(
      player?.hasDash ||
      (enemies && enemies.some((e) => (e.id === 'boss_garbage_collector' || e.rewardSkill === 'hasDash') && e.dead)) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('ojete_hero_dash_unlocked') === 'true')
    );

    const stackOverflowDefeated = Boolean(
      player?.hasChargedAttack ||
      (enemies && enemies.some((e) => (e.id === 'boss_stack_overflow' || e.rewardSkill === 'hasChargedAttack') && e.dead)) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('ojete_hero_charged_attack_unlocked') === 'true')
    );

    const microwaveDefeated = Boolean(
      player?.hasBarrier ||
      (enemies && enemies.some((e) => (e.id === 'boss_prototype_microwave' || e.rewardSkill === 'hasBarrier') && e.dead)) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('ojete_hero_barrier_unlocked') === 'true')
    );

    const armorObtained = Boolean(
      player?.hasArmor ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('ojete_armor_obtained') === 'true')
    );

    const finalDefeated = Boolean(
      (player?.hasRelic && player?.hasSword) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('ojete_game_won') === 'true')
    );

    // 6. Renderizado de los 4 Nodos Principales
    // Nodo 1: Villa de Valleverde (Centro / Refugio) + Alcantarillas (Garbage Collector)
    this._drawValleverdeNode(ctx, mapX, mapY, garbageCollectorDefeated, t);

    // Nodo 2: Santuario de las Pruebas (Este, cruzando el río) + Templo de la Espada (Guardián del Stack Overflow)
    this._drawSantuarioNode(ctx, mapX, mapY, stackOverflowDefeated, armorObtained, t);

    // Nodo 3: Ruinas Exteriores / Tierras Hostiles (Oeste) + Puesto Lab Alpha (Microondas Prototipo)
    this._drawRuinasNode(ctx, mapX, mapY, microwaveDefeated, t);

    // Nodo 4: Ciudadela de AI Alex (Norte) + Núcleo del Gran Ojal
    this._drawCiudadelaNode(ctx, mapX, mapY, finalDefeated, t);

    // 7. Decoraciones de ambiente (Rosa de los vientos, velero, montes)
    this._drawCompassRose(ctx, mapX + 32, mapY + 138);
    this._drawSailingShip(ctx, mapX + 96, mapY + 140);

    // 8. Marcador de posición animado "★ TÚ"
    this._drawPlayerLocation(ctx, mapX, mapY, currentSceneId, t);

    // 9. Encabezado superior y leyenda inferior limpia
    this._drawHeaderAndFooter(ctx, W, H, currentSceneId);

    ctx.restore();
  }

  /**
   * Dibuja el marco de pergamino antiguo con esquinas doradas.
   */
  _drawParchmentBorder(ctx, W, H) {
    ctx.fillStyle = '#1c150e';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#2c2217';
    ctx.fillRect(2, 2, W - 4, H - 4);

    ctx.strokeStyle = '#8d7042';
    ctx.lineWidth = 1;
    ctx.strokeRect(3.5, 3.5, W - 7, H - 7);

    ctx.strokeStyle = '#c5a059';
    ctx.strokeRect(5.5, 5.5, W - 11, H - 11);

    // Cantoneras doradas
    const cSize = 7;
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(4, 4, cSize, 2);
    ctx.fillRect(4, 4, 2, cSize);
    ctx.fillRect(W - 4 - cSize, 4, cSize, 2);
    ctx.fillRect(W - 6, 4, 2, cSize);
    ctx.fillRect(4, H - 6, cSize, 2);
    ctx.fillRect(4, H - 4 - cSize, 2, cSize);
    ctx.fillRect(W - 4 - cSize, H - 6, cSize, 2);
    ctx.fillRect(W - 6, H - 4 - cSize, 2, cSize);
  }

  /**
   * Dibuja el mar antiguo con ondas sutiles y rejilla náutica.
   */
  _drawOceanAndGrid(ctx, mapX, mapY, mapW, mapH) {
    // Fondo de Océano Antiguo
    ctx.fillStyle = '#20394f';
    ctx.fillRect(mapX, mapY, mapW, mapH);

    // Textura y olas en el mar
    ctx.fillStyle = '#2a4861';
    for (let wy = mapY + 6; wy < mapY + mapH - 6; wy += 12) {
      for (let wx = mapX + 8; wx < mapX + mapW - 12; wx += 24) {
        const waveShift = (wx * 3 + wy * 5) % 9;
        ctx.fillRect(wx + waveShift, wy, 6, 1);
        ctx.fillRect(wx + waveShift + 1, wy + 1, 3, 1);
      }
    }

    // Cuadrícula cartográfica sutil
    ctx.strokeStyle = 'rgba(125, 175, 205, 0.12)';
    ctx.lineWidth = 0.5;
    for (let x = mapX + 28; x < mapX + mapW; x += 38) {
      ctx.beginPath();
      ctx.moveTo(x, mapY);
      ctx.lineTo(x, mapY + mapH);
      ctx.stroke();
    }
    for (let y = mapY + 20; y < mapY + mapH; y += 28) {
      ctx.beginPath();
      ctx.moveTo(mapX, y);
      ctx.lineTo(mapX + mapW, y);
      ctx.stroke();
    }
  }

  /**
   * Dibuja los arrecifes y siluetas costeras poco profundas.
   */
  _drawCoastlines(ctx, mapX, mapY) {
    ctx.fillStyle = '#2d5366';

    // Costa Oeste: Ruinas Exteriores
    ctx.beginPath();
    ctx.ellipse(mapX + 70, mapY + 98, 60, 36, -0.05, 0, Math.PI * 2);
    ctx.fill();

    // Costa Centro: Valleverde
    ctx.beginPath();
    ctx.ellipse(mapX + 155, mapY + 100, 56, 38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Costa Este: Santuario de las Pruebas
    ctx.beginPath();
    ctx.ellipse(mapX + 248, mapY + 98, 48, 38, 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Costa Norte: Ciudadela de AI Alex
    ctx.beginPath();
    ctx.ellipse(mapX + 190, mapY + 38, 62, 28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Traza los senderos y la ruta de progresión lógica del juego:
   * ① Valleverde -> ② Santuario de Pruebas -> ③ Tierras Hostiles -> ④ Ciudadela de AI Alex.
   */
  _drawProgressionPathways(ctx, mapX, mapY, t) {
    ctx.save();

    // 1. Camino de tierra firme entre Valleverde y Ruinas Oeste (forestal)
    ctx.fillStyle = '#457a3b';
    ctx.fillRect(mapX + 96, mapY + 94, 38, 14);
    ctx.fillStyle = '#8a7448';
    ctx.fillRect(mapX + 75, mapY + 100, 75, 3);

    // 2. Líneas de progresión mística punteadas con pulsación
    const pulseAlpha = 0.45 + Math.sin(t * 3) * 0.2;
    ctx.strokeStyle = `rgba(255, 215, 0, ${pulseAlpha})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.lineDashOffset = -t * 8;

    // Tramo 1: Valleverde (Centro) -> Santuario de las Pruebas (Este)
    ctx.beginPath();
    ctx.moveTo(mapX + 165, mapY + 96);
    ctx.lineTo(mapX + 185, mapY + 104);
    ctx.lineTo(mapX + 225, mapY + 96);
    ctx.stroke();

    // Tramo 2: Santuario de las Pruebas (Este) -> Tierras Hostiles / Ruinas (Oeste)
    ctx.beginPath();
    ctx.moveTo(mapX + 225, mapY + 96);
    ctx.bezierCurveTo(mapX + 180, mapY + 84, mapX + 130, mapY + 84, mapX + 78, mapY + 96);
    ctx.stroke();

    // Tramo 3: Tierras Hostiles (Oeste) -> Ciudadela de AI Alex (Norte)
    ctx.beginPath();
    ctx.moveTo(mapX + 68, mapY + 76);
    ctx.bezierCurveTo(mapX + 72, mapY + 48, mapX + 120, mapY + 36, mapX + 175, mapY + 36);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * NODO 1: Villa de Valleverde (Centro / Refugio)
   * Incluye la plaza central, casas, Río del Alba, puente y el sub-nodo de Alcantarillas (Garbage Collector).
   */
  _drawValleverdeNode(ctx, mapX, mapY, garbageCollectorDefeated, t) {
    // Tierra verde viva
    ctx.fillStyle = '#4c8541';
    ctx.beginPath();
    ctx.ellipse(mapX + 155, mapY + 100, 50, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b5224';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pinos de Valleverde
    this._drawPineTree(ctx, mapX + 118, mapY + 86);
    this._drawPineTree(ctx, mapX + 126, mapY + 82);
    this._drawPineTree(ctx, mapX + 134, mapY + 88);
    this._drawPineTree(ctx, mapX + 122, mapY + 106);
    this._drawPineTree(ctx, mapX + 132, mapY + 120);

    // Plaza de adoquines
    const baseX = mapX + 152;
    const baseY = mapY + 92;
    ctx.fillStyle = '#827566';
    ctx.fillRect(baseX - 4, baseY - 2, 22, 18);
    ctx.fillStyle = '#a89885';
    ctx.fillRect(baseX - 3, baseY - 1, 20, 16);

    // Casa Sabio Aurelio (Tejado azul)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(baseX - 2, baseY + 1, 7, 5);
    ctx.fillStyle = '#2f60a3';
    ctx.fillRect(baseX - 3, baseY - 2, 9, 3);
    ctx.fillRect(baseX - 2, baseY - 4, 7, 2);

    // Casa Programador (Tejado rojo)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(baseX + 7, baseY + 6, 7, 5);
    ctx.fillStyle = '#b3392b';
    ctx.fillRect(baseX + 6, baseY + 4, 9, 3);
    ctx.fillRect(baseX + 7, baseY + 2, 7, 2);

    // Capilla con cruz dorada
    ctx.fillStyle = '#d5c8b5';
    ctx.fillRect(baseX + 8, baseY - 6, 5, 10);
    ctx.fillStyle = '#8a4b38';
    ctx.fillRect(baseX + 7, baseY - 8, 7, 2);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(baseX + 10, baseY - 12, 1, 3);
    ctx.fillRect(baseX + 9, baseY - 11, 3, 1);

    // Pozo
    ctx.fillStyle = '#596573';
    ctx.fillRect(baseX + 1, baseY + 8, 4, 4);
    ctx.fillStyle = '#4da3d4';
    ctx.fillRect(baseX + 2, baseY + 9, 2, 2);

    // Río del Alba
    ctx.strokeStyle = '#4ea1c7';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(mapX + 165, mapY + 44);
    ctx.bezierCurveTo(mapX + 168, mapY + 65, mapX + 182, mapY + 82, mapX + 182, mapY + 98);
    ctx.bezierCurveTo(mapX + 182, mapY + 112, mapX + 188, mapY + 125, mapX + 205, mapY + 138);
    ctx.stroke();

    // Reflejos
    ctx.strokeStyle = '#c5efff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mapX + 167, mapY + 50);
    ctx.lineTo(mapX + 180, mapY + 88);
    ctx.moveTo(mapX + 183, mapY + 115);
    ctx.lineTo(mapX + 195, mapY + 132);
    ctx.stroke();

    // Puente de Valleverde
    ctx.fillStyle = '#543216';
    ctx.fillRect(mapX + 178, mapY + 104, 11, 6);
    ctx.fillStyle = '#945c2f';
    ctx.fillRect(mapX + 177, mapY + 103, 11, 4);
    ctx.fillStyle = '#d49857';
    ctx.fillRect(mapX + 177, mapY + 102, 11, 1);
    ctx.fillRect(mapX + 177, mapY + 107, 11, 1);

    // ==============================================================
    // SUB-NODO: ALCANTARILLAS / SÓTANO (Garbage Collector Furioso)
    // ==============================================================
    const sewerX = mapX + 146;
    const sewerY = mapY + 118;

    // Trampilla / Entrada de rejas metálicas
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(sewerX - 5, sewerY - 4, 10, 8);
    ctx.strokeStyle = '#5a626a';
    ctx.lineWidth = 1;
    ctx.strokeRect(sewerX - 4.5, sewerY - 3.5, 9, 7);

    // Barrotes de hierro de la alcantarilla
    ctx.fillStyle = '#8392a5';
    ctx.fillRect(sewerX - 3, sewerY - 3, 1, 6);
    ctx.fillRect(sewerX - 1, sewerY - 3, 1, 6);
    ctx.fillRect(sewerX + 1, sewerY - 3, 1, 6);
    ctx.fillRect(sewerX + 3, sewerY - 3, 1, 6);

    // Efluvio de ácido / fuga de memoria si no está derrotado
    if (!garbageCollectorDefeated) {
      const bubbleY = sewerY + Math.sin(t * 7) * 2;
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(sewerX - 2, bubbleY - 1, 2, 2);
      ctx.fillRect(sewerX + 2, bubbleY, 2, 2);
    }

    // Indicador sutil de Jefe / Estado (Calavera o Check)
    const b1IconX = sewerX + 8;
    const b1IconY = sewerY;
    if (garbageCollectorDefeated) {
      this._drawPixelCheck(ctx, b1IconX, b1IconY);
    } else {
      this._drawPixelSkull(ctx, b1IconX, b1IconY, '#ef4444', t);
    }

    // Rótulo limpio del Nodo 1
    this._drawNodeLabel(
      ctx,
      mapX + 152,
      mapY + 132,
      '1. VALLEVERDE',
      garbageCollectorDefeated ? 'Alcantarillas [✓]' : 'Alcantarillas [☠ Garbage]'
    );
  }

  /**
   * NODO 2: Santuario de las Pruebas (Este, cruzando el río)
   * Incluye el Templo de la Armadura Binaria y el Templo de la Espada (Guardián del Stack Overflow).
   */
  _drawSantuarioNode(ctx, mapX, mapY, stackOverflowDefeated, armorObtained, t) {
    // Acantilados dorados de la meseta
    ctx.fillStyle = '#9e8048';
    ctx.beginPath();
    ctx.ellipse(mapX + 248, mapY + 98, 44, 35, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c451e';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Superficie de césped
    ctx.fillStyle = '#4c783c';
    ctx.beginPath();
    ctx.ellipse(mapX + 248, mapY + 98, 38, 29, 0.05, 0, Math.PI * 2);
    ctx.fill();

    // 1. Templo Norte: Armadura del Código Binario
    const temple1X = mapX + 234;
    const temple1Y = mapY + 80;
    ctx.fillStyle = '#4d5d6e';
    ctx.fillRect(temple1X - 6, temple1Y - 4, 13, 9);
    ctx.fillStyle = '#2f60a3';
    ctx.fillRect(temple1X - 7, temple1Y - 6, 3, 11);
    ctx.fillRect(temple1X + 5, temple1Y - 6, 3, 11);
    ctx.fillStyle = '#dbe5f0';
    ctx.fillRect(temple1X - 8, temple1Y - 7, 17, 2);
    ctx.fillStyle = armorObtained ? '#10b981' : '#00e5ff';
    ctx.fillRect(temple1X - 1, temple1Y - 1, 3, 2);

    if (armorObtained) {
      this._drawPixelCheck(ctx, temple1X + 10, temple1Y - 2);
    }

    // 2. Templo Sur: Espada de la Recursividad (Cámara del Guardián del Stack Overflow)
    const temple2X = mapX + 234;
    const temple2Y = mapY + 115;
    ctx.fillStyle = '#7a3e30';
    ctx.fillRect(temple2X - 8, temple2Y - 2, 17, 8);
    ctx.fillRect(temple2X - 6, temple2Y - 5, 13, 4);
    ctx.fillRect(temple2X - 4, temple2Y - 7, 9, 3);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(temple2X - 1, temple2Y - 9, 3, 3);
    ctx.fillStyle = '#ff3366';
    ctx.fillRect(temple2X, temple2Y - 8, 1, 4);

    // Indicador: Guardián del Stack Overflow
    const b2IconX = temple2X + 11;
    const b2IconY = temple2Y - 3;
    if (stackOverflowDefeated) {
      this._drawPixelCheck(ctx, b2IconX, b2IconY);
    } else {
      this._drawPixelSkull(ctx, b2IconX, b2IconY, '#a855f7', t);
    }

    // 3. Altar Oriental: Reliquia Microondas Little
    const relicX = mapX + 276;
    const relicY = mapY + 98;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(relicX - 5, relicY);
    ctx.lineTo(relicX + 7, relicY);
    ctx.moveTo(relicX + 1, relicY - 6);
    ctx.lineTo(relicX + 1, relicY + 6);
    ctx.stroke();

    ctx.fillStyle = '#e6b800';
    ctx.fillRect(relicX - 3, relicY - 3, 8, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(relicX - 1, relicY - 2, 4, 4);

    // Rótulo del Nodo 2
    this._drawNodeLabel(
      ctx,
      mapX + 248,
      mapY + 130,
      '2. SANTUARIO PRUEBAS',
      stackOverflowDefeated ? 'Templos [✓ Despejado]' : 'Templo Espada [☠ Stack]'
    );
  }

  /**
   * NODO 3: Ruinas Exteriores / Tierras Hostiles (Oeste)
   * Incluye las columnas derruidas y el Puesto de Control / Lab Alpha (Microondas Prototipo).
   */
  _drawRuinasNode(ctx, mapX, mapY, microwaveDefeated, t) {
    // Suelo verde musgo y piedra agrietada
    ctx.fillStyle = '#3c5a3d';
    ctx.beginPath();
    ctx.ellipse(mapX + 68, mapY + 98, 54, 32, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#233924';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Columnas derruidas y círculo ritual
    ctx.fillStyle = '#7a8594';
    ctx.fillRect(mapX + 44, mapY + 92, 3, 8);
    ctx.fillRect(mapX + 52, mapY + 95, 3, 5);
    ctx.fillRect(mapX + 60, mapY + 90, 3, 10);
    ctx.fillRect(mapX + 76, mapY + 91, 3, 9);
    ctx.fillRect(mapX + 84, mapY + 96, 3, 6);

    ctx.strokeStyle = '#9ca6b5';
    ctx.strokeRect(mapX + 56, mapY + 94, 16, 12);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(mapX + 63, mapY + 99, 2, 2);

    // ==============================================================
    // PUESTO DE CONTROL: LABORATORIO ALPHA (Microondas Prototipo)
    // ==============================================================
    const labX = mapX + 68;
    const labY = mapY + 70;

    // Búnker / Compuerta tecnológica blindada
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(labX - 7, labY - 5, 14, 10);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(labX - 6.5, labY - 4.5, 13, 9);

    // Compuerta de acceso con franjas de advertencia
    ctx.fillStyle = '#334155';
    ctx.fillRect(labX - 4, labY - 2, 8, 7);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(labX - 3, labY - 2, 2, 1);
    ctx.fillRect(labX + 1, labY - 2, 2, 1);

    // Antena parabólica emisora de ondas térmicas
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(labX, labY - 5);
    ctx.lineTo(labX, labY - 9);
    ctx.stroke();
    ctx.fillStyle = microwaveDefeated ? '#10b981' : '#f97316';
    ctx.fillRect(labX - 2, labY - 10, 5, 2);

    // Indicador: Microondas Prototipo (V0.1 Alpha)
    const b3IconX = labX + 11;
    const b3IconY = labY - 1;
    if (microwaveDefeated) {
      this._drawPixelCheck(ctx, b3IconX, b3IconY);
    } else {
      this._drawPixelSkull(ctx, b3IconX, b3IconY, '#f97316', t);
    }

    // Rótulo del Nodo 3
    this._drawNodeLabel(
      ctx,
      mapX + 68,
      mapY + 114,
      '3. TIERRAS HOSTILES',
      microwaveDefeated ? 'Lab Alpha [✓ Despejado]' : 'Lab Alpha [☠ Microondas]'
    );
  }

  /**
   * NODO 4: Ciudadela de AI Alex (Norte)
   * Incluye las montañas, monolito del Gran Ojal, ríos de cibermagma y antena final.
   */
  _drawCiudadelaNode(ctx, mapX, mapY, finalDefeated, t) {
    // Cordillera central-norte (Montes de la Recursividad)
    this._drawMountain(ctx, mapX + 75, mapY + 54, 28, 22);
    this._drawMountain(ctx, mapX + 102, mapY + 50, 32, 26);
    this._drawMountain(ctx, mapX + 130, mapY + 46, 36, 30);
    this._drawMountain(ctx, mapX + 158, mapY + 44, 34, 28);
    this._drawMountain(ctx, mapX + 220, mapY + 52, 28, 22);

    // Meseta volcánica de la Ciudadela
    ctx.fillStyle = '#2c121e';
    ctx.beginPath();
    ctx.ellipse(mapX + 192, mapY + 36, 54, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#18070f';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Ríos de ciber-lava / magma eléctrico
    ctx.strokeStyle = '#ff5722';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mapX + 172, mapY + 40);
    ctx.lineTo(mapX + 185, mapY + 44);
    ctx.lineTo(mapX + 200, mapY + 40);
    ctx.lineTo(mapX + 214, mapY + 46);
    ctx.stroke();

    // Pilones eléctricos
    ctx.fillStyle = '#18070f';
    ctx.fillRect(mapX + 174, mapY + 22, 4, 14);
    ctx.fillRect(mapX + 210, mapY + 22, 4, 14);

    const sparkY = mapY + 24 + Math.sin(t * 8) * 2;
    ctx.strokeStyle = '#d65bf5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mapX + 176, sparkY);
    ctx.lineTo(mapX + 192, sparkY + 2);
    ctx.lineTo(mapX + 212, sparkY);
    ctx.stroke();

    // Monolito central de EL GRAN OJAL
    const citadelX = mapX + 192;
    const citadelY = mapY + 22;
    ctx.fillStyle = '#0f050b';
    ctx.fillRect(citadelX - 6, citadelY - 6, 13, 18);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(citadelX - 7, citadelY - 8, 15, 2);

    // Antena del Microondas Cuántico
    ctx.strokeStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(citadelX, citadelY - 8);
    ctx.lineTo(citadelX, citadelY - 14);
    ctx.stroke();
    ctx.fillStyle = '#ff2a55';
    ctx.fillRect(citadelX - 2, citadelY - 15, 5, 2);

    // Ojo cibernético pulsante
    const eyePulse = 1.5 + Math.sin(t * 6) * 0.8;
    ctx.fillStyle = finalDefeated ? '#10b981' : '#ff0044';
    ctx.beginPath();
    ctx.arc(citadelX, citadelY, eyePulse, 0, Math.PI * 2);
    ctx.fill();

    // Indicador final
    const finalIconX = citadelX + 11;
    const finalIconY = citadelY - 6;
    if (finalDefeated) {
      this._drawPixelCheck(ctx, finalIconX, finalIconY);
    } else {
      this._drawPixelSkull(ctx, finalIconX, finalIconY, '#e11d48', t, true);
    }

    // Rótulo del Nodo 4
    this._drawNodeLabel(
      ctx,
      mapX + 192,
      mapY + 8,
      '4. CIUDADELA DE AI ALEX',
      finalDefeated ? 'El Gran Ojal [✓ Despejado]' : 'El Gran Ojal [Microondas Final]'
    );
  }

  /**
   * Rótulo compacto y limpio con estilo pergamino oscuro.
   */
  _drawNodeLabel(ctx, rx, ry, title, sub) {
    ctx.font = 'bold 5.5px monospace';
    const tw = Math.max(ctx.measureText(title).width, ctx.measureText(sub).width);
    const bx = Math.round(rx - tw / 2 - 4);
    const by = ry - 2;

    ctx.fillStyle = 'rgba(18, 14, 10, 0.82)';
    ctx.fillRect(bx, by, tw + 8, 13);
    ctx.strokeStyle = 'rgba(214, 169, 88, 0.65)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bx + 0.5, by + 0.5, tw + 7, 12);

    ctx.fillStyle = '#fff2bf';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, rx, by + 1.5);

    const isCleared = sub.includes('[✓');
    ctx.fillStyle = isCleared ? '#34d399' : '#cfbda0';
    ctx.font = '5px monospace';
    ctx.fillText(sub, rx, by + 7);
  }

  /**
   * Calavera pixel art de 7x7 px con iluminación de advertencia.
   */
  _drawPixelSkull(ctx, x, y, accentColor = '#ef4444', t = 0, hasCrown = false) {
    const pulse = 0.8 + Math.sin(t * 6) * 0.2;
    ctx.save();
    ctx.globalAlpha = pulse;

    // Halo de advertencia
    ctx.fillStyle = accentColor;
    ctx.fillRect(x - 4, y - 5, 9, 8);

    // Base craneal blanca
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - 3, y - 4, 7, 4);
    ctx.fillRect(x - 2, y, 5, 2);

    // Cuencas oculares
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 2, y - 3, 2, 2);
    ctx.fillRect(x + 1, y - 3, 2, 2);

    // Dientes / hendidura
    ctx.fillStyle = '#334155';
    ctx.fillRect(x - 1, y + 1, 1, 1);
    ctx.fillRect(x + 1, y + 1, 1, 1);

    // Corona opcional para jefe final
    if (hasCrown) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x - 3, y - 6, 7, 1);
      ctx.fillRect(x - 3, y - 7, 1, 1);
      ctx.fillRect(x, y - 7, 1, 1);
      ctx.fillRect(x + 3, y - 7, 1, 1);
    }

    ctx.restore();
  }

  /**
   * Check verde pixel art para indicar zona/jefe despejado.
   */
  _drawPixelCheck(ctx, x, y) {
    ctx.save();
    // Base circular esmeralda
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 3.5, y - 3.5, 7, 7);

    // Marca de verificación blanca/verde lima
    ctx.fillStyle = '#6ee7b7';
    ctx.fillRect(x - 2, y, 1, 2);
    ctx.fillRect(x - 1, y + 1, 1, 2);
    ctx.fillRect(x, y + 2, 1, 1);
    ctx.fillRect(x + 1, y, 1, 2);
    ctx.fillRect(x + 2, y - 2, 1, 2);
    ctx.restore();
  }

  /**
   * Dibuja un pino retro pixel art con sombreado.
   */
  _drawPineTree(ctx, px, py) {
    ctx.fillStyle = '#193016';
    ctx.fillRect(px + 1, py + 6, 4, 2);
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(px + 2, py + 4, 2, 3);
    ctx.fillStyle = '#225220';
    ctx.fillRect(px, py + 1, 6, 4);
    ctx.fillRect(px + 1, py - 2, 4, 3);
    ctx.fillRect(px + 2, py - 4, 2, 2);
    ctx.fillStyle = '#428a38';
    ctx.fillRect(px + 2, py - 2, 2, 2);
  }

  /**
   * Dibuja montañas con laderas de sol/sombra y pico nevado.
   */
  _drawMountain(ctx, mx, my, mw, mh) {
    // Sombra derecha
    ctx.fillStyle = '#373d47';
    ctx.beginPath();
    ctx.moveTo(mx, my - mh);
    ctx.lineTo(mx + mw / 2, my);
    ctx.lineTo(mx, my);
    ctx.closePath();
    ctx.fill();

    // Iluminación izquierda
    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    ctx.moveTo(mx, my - mh);
    ctx.lineTo(mx - mw / 2, my);
    ctx.lineTo(mx, my);
    ctx.closePath();
    ctx.fill();

    // Cima nevada
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(mx, my - mh);
    ctx.lineTo(mx - mw / 5, my - mh + mh * 0.35);
    ctx.lineTo(mx, my - mh + mh * 0.28);
    ctx.lineTo(mx + mw / 5, my - mh + mh * 0.35);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Rosa de los Vientos estilizada en el mar.
   */
  _drawCompassRose(ctx, compassX, compassY) {
    const cr = 10;
    ctx.strokeStyle = 'rgba(214, 169, 88, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(compassX, compassY, cr + 1, 0, Math.PI * 2);
    ctx.stroke();

    // Norte
    ctx.fillStyle = '#ff2a55';
    ctx.beginPath();
    ctx.moveTo(compassX, compassY);
    ctx.lineTo(compassX, compassY - cr - 3);
    ctx.lineTo(compassX - 2.5, compassY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(compassX, compassY);
    ctx.lineTo(compassX, compassY - cr - 3);
    ctx.lineTo(compassX + 2.5, compassY);
    ctx.closePath();
    ctx.fill();

    // Sur / Este / Oeste
    ctx.fillStyle = '#cca055';
    ctx.beginPath();
    ctx.moveTo(compassX, compassY);
    ctx.lineTo(compassX, compassY + cr + 1);
    ctx.lineTo(compassX + 2, compassY);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(compassX, compassY);
    ctx.lineTo(compassX + cr + 1, compassY);
    ctx.lineTo(compassX, compassY + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#a67d3b';
    ctx.beginPath();
    ctx.moveTo(compassX, compassY);
    ctx.lineTo(compassX - cr - 1, compassY);
    ctx.lineTo(compassX, compassY + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffea9f';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('N', compassX, compassY - cr - 4);
  }

  /**
   * Barco de vela en el mar del sur.
   */
  _drawSailingShip(ctx, shipX, shipY) {
    ctx.fillStyle = '#5c3818';
    ctx.beginPath();
    ctx.moveTo(shipX - 6, shipY + 2);
    ctx.lineTo(shipX + 8, shipY + 2);
    ctx.lineTo(shipX + 5, shipY + 5);
    ctx.lineTo(shipX - 4, shipY + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(shipX - 1, shipY + 2);
    ctx.lineTo(shipX + 2, shipY - 5);
    ctx.lineTo(shipX + 5, shipY + 2);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Dibuja el marcador animado de ubicación actual "★ TÚ".
   */
  _drawPlayerLocation(ctx, mapX, mapY, currentSceneId, t) {
    let playerMapX = mapX + 152;
    let playerMapY = mapY + 92;
    let locationName = 'Aldea de Valleverde';

    if (currentSceneId === 'first_stage') {
      playerMapX = mapX + 68;
      playerMapY = mapY + 98;
      locationName = 'Ruinas Exteriores (Tierras Hostiles)';
    } else if (currentSceneId === 'armor_temple') {
      playerMapX = mapX + 234;
      playerMapY = mapY + 80;
      locationName = 'Templo de la Armadura Binaria';
    } else if (currentSceneId === 'sword_temple') {
      playerMapX = mapX + 234;
      playerMapY = mapY + 115;
      locationName = 'Templo de la Espada (Stack Overflow)';
    } else if (currentSceneId === 'sewers_dungeon') {
      playerMapX = mapX + 146;
      playerMapY = mapY + 118;
      locationName = 'Alcantarillas de Valleverde (Garbage Collector)';
    } else if (currentSceneId === 'ai_fortress_gate') {
      playerMapX = mapX + 68;
      playerMapY = mapY + 70;
      locationName = 'Laboratorio Alpha (Microondas Prototipo)';
    } else if (currentSceneId === 'citadel' || currentSceneId === 'ai_citadel') {
      playerMapX = mapX + 192;
      playerMapY = mapY + 22;
      locationName = 'Ciudadela de AI Alex · El Gran Ojal';
    } else if (currentSceneId === 'jail_cell') {
      playerMapX = mapX + 160;
      playerMapY = mapY + 104;
      locationName = 'Calabozo Municipal de Valleverde';
    }

    // Halo pulsante
    const haloRadius = 6 + Math.sin(t * 6) * 2;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(playerMapX, playerMapY, haloRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Pin de posición
    const bobPin = Math.sin(t * 6) * 2;
    ctx.fillStyle = '#ff2a55';
    ctx.beginPath();
    ctx.arc(playerMapX, playerMapY - 5 + bobPin, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(playerMapX, playerMapY - 5 + bobPin, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Cartel flotante "★ TÚ"
    ctx.fillStyle = '#18120c';
    ctx.fillRect(playerMapX - 12, playerMapY - 17 + bobPin, 24, 9);
    ctx.strokeStyle = '#ffd166';
    ctx.strokeRect(playerMapX - 11.5, playerMapY - 16.5 + bobPin, 23, 8);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('★ TÚ', playerMapX, playerMapY - 15 + bobPin);

    this._lastLocationName = locationName;
  }

  /**
   * Dibuja el encabezado superior y la barra inferior con leyenda y controles.
   */
  _drawHeaderAndFooter(ctx, W, H, currentSceneId) {
    const cx = W / 2;
    const locationName = this._lastLocationName || 'Aldea de Valleverde';

    // 1. Encabezado superior
    ctx.fillStyle = '#ffd885';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('🗺 REINO DEL GRAN OJAL · RUTA DE PROGRESIÓN 🗺', cx, 6);

    ctx.font = '6px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText('[Esc] Cerrar', W - 10, 6);

    // 2. Barra inferior con leyenda limpia y controles
    const footerW = W - 24;
    const footerH = 12;
    const footerX = 12;
    const footerY = H - 15;

    ctx.fillStyle = 'rgba(18, 14, 10, 0.92)';
    ctx.fillRect(footerX, footerY, footerW, footerH);
    ctx.strokeStyle = 'rgba(214, 169, 88, 0.8)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(footerX + 0.5, footerY + 0.5, footerW - 1, footerH - 1);

    // Lado izquierdo: Ubicación
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 5.5px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`UBICACIÓN: ${locationName}`, footerX + 5, footerY + footerH / 2);

    // Centro: Leyenda limpia
    ctx.fillStyle = '#ef4444';
    ctx.fillText('☠', footerX + 172, footerY + footerH / 2);
    ctx.fillStyle = '#cfbda0';
    ctx.fillText('Boss', footerX + 178, footerY + footerH / 2);

    ctx.fillStyle = '#10b981';
    ctx.fillText('✓', footerX + 198, footerY + footerH / 2);
    ctx.fillStyle = '#cfbda0';
    ctx.fillText('Despejado', footerX + 204, footerY + footerH / 2);

    // Lado derecho: Atajo de salida
    ctx.fillStyle = '#e8dcc4';
    ctx.textAlign = 'right';
    ctx.fillText('[Esc] Cerrar', footerX + footerW - 5, footerY + footerH / 2);
  }
}

