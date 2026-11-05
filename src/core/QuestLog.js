/**
 * QuestLog.js - Gestor de Estado y Lógica del Diario de Misiones ('El Ojete Dorado')
 * 
 * Registra objetivos principales y secundarios del jugador, gestiona el progreso de pasos,
 * notifica cambios en pantalla y serializa el estado para persistencia en localStorage.
 */

export const INITIAL_QUESTS = [
  {
    id: 'quest_main_bridge',
    title: 'El Primer Despliegue',
    category: 'MAIN',
    status: 'ACTIVE',
    description: 'El Gran Sabio Aurelio de Valleverde custodia el Pase Real del Puente hacia las Pruebas Sagradas del este.',
    currentStep: 'Habla con el Sabio Aurelio en Valleverde para obtener el Pase del Puente del Río Alba.',
    reward: 'Pase del Puente + Acceso al Santuario Este'
  },
  {
    id: 'quest_boss_garbage',
    title: 'Fuga en las Cloacas',
    category: 'MAIN',
    status: 'ACTIVE',
    description: 'Una anomalía de memoria corrupta y punteros huérfanos acecha en el subsuelo del mercado de Valleverde.',
    currentStep: 'Desciende a las alcantarillas de Valleverde y erradica al Garbage Collector Furioso.',
    reward: 'Habilidad: Dash Asíncrono (0.2s invulnerabilidad)'
  },
  {
    id: 'quest_code_temples',
    title: 'El Código Sagrado',
    category: 'MAIN',
    status: 'ACTIVE',
    description: 'Para hacer frente a Mister AI Alex, debes consagrar las reliquias en los Templos Binarios del Santuario Este.',
    currentStep: 'Supera los puzles booleanos y de recursividad para obtener la Espada y la Armadura Binaria.',
    reward: 'Espada de la Recursividad & Armadura del Código Binario'
  },
  {
    id: 'quest_boss_stack',
    title: 'Desbordamiento de Pila',
    category: 'MAIN',
    status: 'ACTIVE',
    description: 'El Guardián del Stack Overflow protege el portal final en la cima del Santuario de las Pruebas.',
    currentStep: 'Derrota al Guardián del Stack Overflow en el Templo de la Espada para despejar el camino a la Ciudadela.',
    reward: 'Habilidad: Corte en Cascada (Tajo radial 360°)'
  },
  {
    id: 'quest_boss_microwave',
    title: 'El Búnker Alpha',
    category: 'MAIN',
    status: 'ACTIVE',
    description: 'En el Laboratorio Alpha al oeste de Valleverde se custodia el Prototipo del Microondas Cuántico.',
    currentStep: 'Infiltra el Umbral de la Fortaleza y destruye el Prototipo del Microondas de AI Alex.',
    reward: 'Habilidad: Barrera TypeScript (Escudo anti-proyectiles)'
  },
  {
    id: 'quest_boss_final',
    title: 'La Compilación Final',
    category: 'MAIN',
    status: 'ACTIVE',
    description: 'Mister AI Alex aguarda en la cúspide de la Ciudadela para ejecutar el reseteo cósmico del universo.',
    currentStep: 'Asciende a la Ciudadela de AI Alex, destruye el Microondas Cuántico y consagra El Ojete Dorado.',
    reward: 'Consagración de El Ojete Dorado y Epílogo de Victoria'
  },
  {
    id: 'quest_condemned_pointer',
    title: 'El Puntero al Abismo',
    category: 'SIDE',
    status: 'ACTIVE',
    description: 'Un cofre arcano oculto en las Ruinas del Despertar (fuera de Valleverde) guarda el Puntero Abisal reutilizable.',
    currentStep: 'Explora las Ruinas del Despertar al oeste de Valleverde, abre el cofre del Puntero Abisal (Null Pointer) e invoca tu Portal Abisal.',
    reward: 'Portal Abisal Permanente y Absolución del Dios Supremo'
  },
  {
    id: 'quest_side_fishing',
    title: 'Pesca en Aguas Profundas',
    category: 'SIDE',
    status: 'ACTIVE',
    description: 'Finn, el pescador de la plaza de Valleverde, necesita 3 Truchas del Río Alba capturadas usando pan campesino como cebo.',
    currentStep: 'Acércate a la orilla del Río Alba con Pan Campesino, pesca 3 truchas y llévaselas a Finn en la plaza.',
    reward: '15 Bytes + Destreza Fluvial'
  },
  {
    id: 'quest_side_fractal_temper',
    title: 'El Templado Fractal',
    category: 'SIDE',
    status: 'ACTIVE',
    description: 'El Herrero Brom necesita 2 restos de chatarra de drones de AI Alex para aplicar un templado fractal a tu espada.',
    currentStep: 'Derrota drones sombríos en Tierras Hostiles (al oeste) para recolectar 2 restos de chatarra y llévaselos a Brom.',
    reward: '20 Bytes + Filo Fractal Mejorado'
  },
  {
    id: 'quest_side_silicon_flowers',
    title: 'Flores de Silicio',
    category: 'SIDE',
    status: 'ACTIVE',
    description: 'La Herbolaria Lyra investiga unas raras flores bioluminiscentes que solo abren sus pétalos durante la noche (22:00 PM).',
    currentStep: 'Espera a la noche profunda (22:00 PM usando tu cama) y recolecta 3 Flores de Silicio para la Herbolaria Lyra.',
    reward: '25 Bytes + Poción Curativa Alquímica'
  },
  {
    id: 'quest_farm_animals',
    title: 'Compañeros Campesinos',
    category: 'SIDE',
    status: 'ACTIVE',
    description: 'Los animales de la aldea necesitan cariño y alimento fresco para alegrar las tierras rurales.',
    currentStep: 'Consigue trigo con la Herbolaria para alimentar ovejas y gallinas, o pan para el perro Toby.',
    reward: 'Felicidad rural y bendición de los animales de Valleverde'
  },
  {
    id: 'quest_coffee_cure',
    title: 'Higiene de Variables',
    category: 'SIDE',
    status: 'ACTIVE',
    description: 'Llevar la Armadura Binaria provoca anomalías y robotización paulatina en el código del héroe.',
    currentStep: 'Bebe Café Compilado en tu casa o descansa en tu cama para mantener la robotización al 0%.',
    reward: 'Purga de anomalías binarias y restauración de salud'
  }
];

export class QuestLog {
  constructor(onNotice = null) {
    this.onNotice = onNotice;
    this.quests = INITIAL_QUESTS.map((q) => ({ ...q }));
  }

  getAllQuests() {
    return this.quests;
  }

  getQuest(id) {
    return this.quests.find((q) => q.id === id);
  }

  isQuestCompleted(id) {
    const q = this.getQuest(id);
    return Boolean(q && q.status === 'COMPLETED');
  }

  /**
   * Actualiza el paso actual de una misión y emite aviso flotante.
   */
  advanceStep(questId, nextStepText) {
    const q = this.getQuest(questId);
    if (!q) return false;
    if (q.currentStep === nextStepText && q.status === 'ACTIVE') return false;

    q.currentStep = nextStepText;
    if (q.status === 'LOCKED') {
      q.status = 'ACTIVE';
    }

    if (typeof this.onNotice === 'function') {
      this.onNotice(`📜 Diario Actualizado: [${q.title}]`);
    }
    return true;
  }

  /**
   * Marca una misión como completada.
   */
  completeQuest(questId, finalNote = null) {
    const q = this.getQuest(questId);
    if (!q) return false;
    if (q.status === 'COMPLETED') return false;

    q.status = 'COMPLETED';
    if (finalNote) {
      q.currentStep = finalNote;
    }

    if (typeof this.onNotice === 'function') {
      this.onNotice(`✨ ¡Misión Completada! [${q.title}]`);
    }
    return true;
  }

  /**
   * Serializa el estado de las misiones para guardado en localStorage.
   */
  serialize() {
    return this.quests.map((q) => ({
      id: q.id,
      status: q.status,
      currentStep: q.currentStep
    }));
  }

  /**
   * Restaura el estado de las misiones desde los datos guardados.
   */
  deserialize(savedData) {
    if (!Array.isArray(savedData)) return;
    for (const saved of savedData) {
      const q = this.getQuest(saved.id);
      if (q) {
        if (saved.status) q.status = saved.status;
        if (saved.currentStep) q.currentStep = saved.currentStep;
      }
    }
  }

  reset() {
    this.quests = INITIAL_QUESTS.map((q) => ({ ...q }));
  }
}

