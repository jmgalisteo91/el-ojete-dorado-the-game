import { NPC } from './NPC.js?v=7';

export { NPC };

/**
 * Genera el menú completo e interactivo de diálogo y forja con el Herrero Brom:
 * - Espada de Recursividad:
 *   * Nivel 1: Madera/Hierro base.
 *   * Nivel 2: Espada de Silicio (100 Bytes + 1 Silicio). Daño +50% y quiebra barreras de cristal en las Minas.
 *   * Nivel 3: Espada Overclockeada (150 Bytes + Magnetrón del Microondas). Daño +100% y tajos de plasma a salud máxima.
 * - Armadura Binaria:
 *   * Nivel 1: Armadura base (3 corazones blindados).
 *   * Nivel 2: Blindaje Térmico (75 Bytes + 2 Chatarra). Inmunidad al calor ambiental de la Forja del Prototipo.
 * - Misiones secundarias, venta de chatarra y pan de leña.
 */
export function getBromForgeChoices(game) {
  const player = game.player;
  const inventory = game.inventory;
  const dialogueBox = game.dialogueBox;

  const choices = [];

  // ==================== 1. MEJORAS DE LA ESPADA DE LA RECURSIVIDAD ====================
  if (!player.hasSword) {
    choices.push({
      label: '⚔️ [Forja] "No posees una espada para forjar"',
      onSelect: () => {
        dialogueBox.showMessage('Herrero Brom · Forjador', [
          '¡Clang! Primero necesitas consagrar la legendaria Espada de la Recursividad en el Templo Sagrado.',
          'Tráemela aquí y encenderé las ascuas de la fragua para desatar su potencial de compilación.'
        ], getBromForgeChoices(game));
      }
    });
  } else if (player.swordLevel === 1) {
    const siliconCount = inventory ? inventory.getItemCount('silicon_ore') : 0;
    const canAfford = player.coins >= 100 && siliconCount >= 1;
    choices.push({
      label: `⚔️ [Mejora] Espada de Silicio (Nivel 2) [100 Bytes + 1 Silicio] (Llevas: ${siliconCount}/1)`,
      onSelect: () => {
        if (canAfford) {
          player.coins -= 100;
          if (inventory) inventory.consumeItem('silicon_ore', 1);
          player.swordLevel = 2;
          if (game.music && typeof game.music.playFanfare === 'function') {
            game.music.playFanfare();
          }
          if (typeof game._saveGameToStorage === 'function') {
            game._saveGameToStorage();
          }
          dialogueBox.showMessage('Herrero Brom · Forjador', [
            '¡POR LA FRAGUA CELESTIAL! (El yunque despide un destello violeta y chispas de cristal puro).',
            '¡CLANG! ¡CLANG! ¡CLANG! Las vetas de silicio puro se han fusionado con el filo de la recursión.',
            '¡Tu espada ha alcanzado el [Nivel 2: Espada de Silicio]!',
            '• Daño aumentado en un +50%.',
            '• Ahora tu hoja puede quebrar las barreras de cristal en las Minas de la Recursión.'
          ], getBromForgeChoices(game));
        } else {
          dialogueBox.showMessage('Herrero Brom · Forjador', [
            'Para forjar la Espada de Silicio necesito 100 Bytes para el carbón cuántico y [1 Mineral de Silicio].',
            'El silicio se extrae de las profundidades de las Minas de la Recursión, al noroeste de Valleverde.',
            `Actualmente dispones de: [🪙 ${player.coins}/100 Bytes] y [💎 ${siliconCount}/1 Silicio].`
          ], getBromForgeChoices(game));
        }
      }
    });
  } else if (player.swordLevel === 2) {
    const hasMagnetron = inventory ? inventory.hasItem('microwave_magnetron') : false;
    const canAfford = player.coins >= 150 && hasMagnetron;
    choices.push({
      label: `⚔️ [Mejora] Espada Overclockeada (Nivel 3) [150 Bytes + Magnetrón] (${hasMagnetron ? 'Listo' : 'Falta Magnetrón'})`,
      onSelect: () => {
        if (canAfford) {
          player.coins -= 150;
          if (inventory) inventory.consumeItem('microwave_magnetron', 1);
          player.swordLevel = 3;
          if (game.music && typeof game.music.playFanfare === 'function') {
            game.music.playFanfare();
          }
          if (typeof game._saveGameToStorage === 'function') {
            game._saveGameToStorage();
          }
          dialogueBox.showMessage('Herrero Brom · Forjador', [
            '¡DIOSES DEL COMPILADOR! (Una llamarada dorada y radiación electromagnética envuelve el taller).',
            '¡BZZZT! ¡CLANG! El magnetrón del Microondas Prototipo late dentro de la empuñadura a 2.4 GHz.',
            '¡Tu espada ha alcanzado el [Nivel 3: Espada Overclockeada]!',
            '• Daño máximo devastador (+100%).',
            '• Si tu salud está al 100%, ¡cada estocada proyecta un tajo de plasma a distancia!'
          ], getBromForgeChoices(game));
        } else {
          dialogueBox.showMessage('Herrero Brom · Forjador', [
            'La Espada Overclockeada requiere la fuente de poder más violenta de este mundo: el Magnetrón del Microondas Prototipo.',
            'Desciende a La Forja del Prototipo, abate al Microondas V0.1 Alpha y tráeme su magnetrón con 150 Bytes.',
            `Estado actual: [🪙 ${player.coins}/150 Bytes] y Magnetrón: [${hasMagnetron ? 'EN TU MOCHILA' : 'PENDIENTE'}].`
          ], getBromForgeChoices(game));
        }
      }
    });
  } else {
    choices.push({
      label: '⚔️ Espada Overclockeada (Nivel Máximo)',
      onSelect: () => {
        dialogueBox.showMessage('Herrero Brom · Forjador', [
          '¡Esa hoja corta el tejido mismo del espacio-tiempo digital!',
          'Ni el mismísimo Mister AI Alex podrá compilar una respuesta ante semejante filo.'
        ], getBromForgeChoices(game));
      }
    });
  }

  // ==================== 2. MEJORAS DE LA ARMADURA BINARIA ====================
  if (!player.hasArmor) {
    choices.push({
      label: '🛡️ [Forja] "No tienes una armadura para reforzar"',
      onSelect: () => {
        dialogueBox.showMessage('Herrero Brom · Forjador', [
          'Sin la Armadura del Código Binario no puedo hacer milagros de forja.',
          'Conságrala en el Templo Septentrional cruzando el río hacia el norte.'
        ], getBromForgeChoices(game));
      }
    });
  } else if (player.armorLevel === 1) {
    const scrapCount = inventory ? inventory.getItemCount('drone_scrap') : 0;
    const canAfford = player.coins >= 75 && scrapCount >= 2;
    choices.push({
      label: `🛡️ [Mejora] Blindaje Térmico (Nivel 2) [75 Bytes + 2 Chatarra Dron] (Llevas: ${scrapCount}/2)`,
      onSelect: () => {
        if (canAfford) {
          player.coins -= 75;
          if (inventory) inventory.consumeItem('drone_scrap', 2);
          player.armorLevel = 2;
          player.armorPoints = 3;
          if (game.music && typeof game.music.playFanfare === 'function') {
            game.music.playFanfare();
          }
          if (typeof game._saveGameToStorage === 'function') {
            game._saveGameToStorage();
          }
          dialogueBox.showMessage('Herrero Brom · Forjador', [
            '¡KLANG! ¡El revestimiento cerámico termo-aislante ha quedado soldado a las placas binarias!',
            '¡Tu armadura ha alcanzado el [Nivel 2: Blindaje Térmico]!',
            '• Inmunidad absoluta al calor abrasador y radiación de La Forja del Prototipo.',
            '• Tus 3 corazones blindados han sido completamente restaurados.'
          ], getBromForgeChoices(game));
        } else {
          dialogueBox.showMessage('Herrero Brom · Forjador', [
            'Para forjar el Blindaje Térmico necesito 75 Bytes y 2 restos de chatarra de drones de AI Alex.',
            'La aleación de titanio de los drones resiste miles de grados sin deformarse.',
            `Llevas: [🪙 ${player.coins}/75 Bytes] y [⚙️ ${scrapCount}/2 Restos de Chatarra].`
          ], getBromForgeChoices(game));
        }
      }
    });
  } else {
    choices.push({
      label: '🛡️ Blindaje Térmico Cerámico (Nivel Máximo)',
      onSelect: () => {
        dialogueBox.showMessage('Herrero Brom · Forjador', [
          'Tu armadura disipa el calor extremo con refrigeración criogénica pasiva.',
          'Puedes caminar dentro de las calderas de la Forja como si pasearas por la plaza del pueblo.'
        ], getBromForgeChoices(game));
      }
    });
  }

  // ==================== 3. ENCARGO FRACTAL Y COMERCIO ====================
  const isFractalDone = game.questLog
    ? (typeof game.questLog.isQuestCompleted === 'function'
      ? game.questLog.isQuestCompleted('quest_side_fractal_temper')
      : Boolean(game.questLog.getQuest?.('quest_side_fractal_temper')?.status === 'COMPLETED'))
    : false;
  const scrapCount = inventory ? inventory.getItemCount('drone_scrap') : 0;
  choices.push({
    label: isFractalDone
      ? '⚒️ [Encargo] "El Templado Fractal" (Completado)'
      : `⚒️ [Encargo] "El Templado Fractal" (Entregar Chatarra: ${scrapCount}/2)`,
    onSelect: () => {
      if (isFractalDone) {
        dialogueBox.showMessage('Herrero Brom · Forjador', [
          '¡Clang, clang! Tu espada mantiene ese zumbido fractal de alta frecuencia.',
          'Corta los bugs como si fueran mantequilla recién horneada.'
        ], getBromForgeChoices(game));
        return;
      }
      if (scrapCount >= 2) {
        if (inventory) inventory.consumeItem('drone_scrap', 2);
        player.coins += 20;
        if (game.music && typeof game.music.playFanfare === 'function') {
          game.music.playFanfare();
        }
        if (game.questLog) {
          game.questLog.completeQuest('quest_side_fractal_temper', '¡El Herrero Brom templó tu espada!');
        }
        if (game.achievementManager) {
          game.achievementManager.unlock('ach_side_fractal');
        }
        if (typeof game._saveGameToStorage === 'function') {
          game._saveGameToStorage();
        }
        dialogueBox.showMessage('Herrero Brom · Forjador', [
          '¡Por el fuego sagrado de la fragua! ¡Esta aleación de titanio fractal es soberbia!',
          '¡CLANG! ¡CLANG! ¡CLANG! (El yunque despide destellos dorados y chispas binarias).',
          '¡Toma [🪙 20 Bytes] por tu valentía abatiendo drones!'
        ], getBromForgeChoices(game));
      } else {
        dialogueBox.showMessage('Herrero Brom · Forjador', [
          'Abate a un par de drones en Tierras Hostiles y tráeme 2 restos de chatarra.',
          `Actualmente llevas: [${scrapCount}/2].`
        ], getBromForgeChoices(game));
      }
    }
  });

  choices.push({
    label: '💰 Vender materiales / chatarra',
    onSelect: () => {
      dialogueBox.showMessage('Herrero Brom · Forjador', [
        'Compro restos de chatarra, minerales y consumibles sobrantes de tus expediciones.'
      ], game._getSellChoices ? game._getSellChoices('Herrero Brom · Forjador', getBromForgeChoices(game)) : []);
    }
  });

  choices.push({
    label: '🍞 ¿Tienes algo de Pan Campesino?',
    onSelect: () => {
      if (inventory && !inventory.hasItem('bread')) {
        inventory.addItem({
          id: 'bread',
          name: 'Pan Campesino',
          description: 'Pan recién horneado. Ideal para comer, dar a Toby o sobornar guardias.',
          iconIndex: 1, // ITEM_ICONS.BREAD
          qty: 1
        });
        if (typeof game._saveGameToStorage === 'function') {
          game._saveGameToStorage();
        }
        dialogueBox.showMessage('Herrero Brom · Forjador', [
          '¡Claro que sí! Toma una hogaza recién salida del horno de leña de mi forja.',
          'Se ha añadido [Pan Campesino x1] a tu mochila.'
        ], getBromForgeChoices(game));
      } else {
        dialogueBox.showMessage('Herrero Brom · Forjador', [
          'Veo que ya llevas Pan Campesino en tu mochila. ¡Dáselo al perro Toby!'
        ], getBromForgeChoices(game));
      }
    }
  });

  choices.push({
    label: 'Cuéntame tu vida y oficio (Chapa)',
    onSelect: () => {
      if (typeof game._startNPCLifeRant === 'function') {
        game._startNPCLifeRant('blacksmith', getBromForgeChoices(game));
      }
    }
  });

  choices.push({
    label: '¿Puedo pasar a tu casa?',
    onSelect: () => {
      if (game.housePermissions && game.housePermissions.blacksmith_house) {
        dialogueBox.showMessage('Herrero Brom · Forjador', [
          '¡Ya tienes la llave de mi forja! Pasa cuando quieras, pero no toques el yunque con las manos sucias.'
        ], getBromForgeChoices(game));
      } else {
        if (game.housePermissions) game.housePermissions.blacksmith_house = true;
        if (typeof game._saveGameToStorage === 'function') {
          game._saveGameToStorage();
        }
        dialogueBox.showMessage('Herrero Brom · Forjador', [
          '¡Por supuesto! Todo héroe de la forja es bienvenido bajo mi techo.',
          'Toma el salvoconducto de la herrería. Puedes descansar junto a mi chimenea.'
        ], getBromForgeChoices(game));
      }
    }
  });

  choices.push({
    label: 'Despedirse',
    onSelect: () => dialogueBox.close()
  });

  return choices;
}
