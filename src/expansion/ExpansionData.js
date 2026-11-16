/**
 * ExpansionData.js · "El Resurgir de Mister Alex IA" (v2.0 — El Update Universal)
 *
 * Fase 1: datos de lore de los nuevos NPCs y textos del teaser.
 * No modifica ninguna lógica del juego base.
 */

export const EXPANSION_UNLOCK_KEY = 'el_ojete_dorado_victory_trophy';

export const EXPANSION_BGM = {
  valleverde_corp: 'assets/music/11_valleverde_corporativo.mp3',
  oficina_central: 'assets/music/12_oficina_central.mp3',
  vertedero: 'assets/music/13_vertedero_digital.mp3',
  boss_iñakito: 'assets/music/14_boss_iñakito.mp3',
  boss_alex_final: 'assets/music/15_boss_alex_final.mp3'
};

export function hasExpansionUnlocked() {
  try {
    return typeof localStorage !== 'undefined' &&
      Boolean(localStorage.getItem(EXPANSION_UNLOCK_KEY));
  } catch {
    return false;
  }
}

export const EXPANSION_INFO = {
  id: 'resurgir_mister_alex',
  version: 'v2.0',
  title: 'El Resurgir de Mister Alex IA',
  subtitle: 'EL UPDATE UNIVERSAL',
  teaser: 'Prepárate porque el resurgir del Mister es más fuerte y viene con amigos...',
  message: 'El Update Universal está en camino. Mister Alex IA ha reescrito el futuro. ¿Estás listo para el Valleverde 2.0?'
};

export const EXPANSION_NPCS = {
  tony_randazzo: {
    id: 'tony_randazzo',
    name: 'Tony Randazzo',
    angryName: 'Tony Randazzo (Furioso)',
    spriteColor: '#94a3b8',
    role: 'Fixer',
    talkSfx: 'keyboard_type',
    lore: 'Programador original de Alex. Sevillano relajado por defecto, pero con doble personalidad argentina furiosa si le sacan de quicio.',
    dialogues: [
      'Illo, ¿qué pasa, quillo? Tranquilo, aquí todo va bien.',
      'Miarma, siéntate un rato, que aquí no corre prisa.',
      'Pisha, Alex me debe 200 pesetas desde 1998, pero tú tranquilo, que todo se arregla.'
    ],
    normalDialogues: [
      'Illo, ¿qué pasa, quillo? Tranquilo, aquí todo va bien.',
      'Miarma, siéntate un rato, que aquí no corre prisa.',
      'Pisha, Alex me debe 200 pesetas desde 1998, pero tú tranquilo, que todo se arregla.'
    ],
    angryDialogues: [
      '¡Che, boludo! ¿Qué te creés? ¡Me tenés harto!',
      '¡Pero andá a cagar, pibe! ¡No me rompas las pelotas!',
      '¡Estoy re caliente, pibe! ¡Tomátelas antes de que te faje!'
    ]
  },
  franco_pancho: {
    id: 'franco_pancho',
    name: 'Franco el Pancho',
    spriteColor: '#4d7c0f',
    role: 'Seguridad',
    lore: 'Hermano de Tony. Secuestrado por Alex en el Vertedero Digital. El músculo del equipo.',
    dialogues: [
      '¿Tú eres el nuevo? Yo solo sé pegar a lo que se mueve. ¿A quién pegamos?',
      'Mi hermano Tony dice que soy el músculo. Yo digo que soy el que aguanta los golpes mientras Tony habla.',
      'Alex me tuvo encerrado en el Vertedero Digital. Aún me pitan los oídos cada vez que veo un contenedor.'
    ]
  },
  cepedita_tieso: {
    id: 'cepedita_tieso',
    name: 'Cepedita el Tieso',
    spriteColor: '#9ca3af',
    role: 'Burócrata',
    talkSfx: 'hologram_on',
    hologram: true,
    lore: 'Murió en 1997 esperando un permiso. Alex lo dejó trabajando. Sigue muerto, pero sigue tramitando.',
    dialogues: [
      'Cepedita el Tieso requiere el impreso A-38 bis para atenderle.',
      '¿Que si estoy muerto? Caballero, eso es una cuestión administrativa pendiente de resolución desde 1997.',
      'Sin el sello de la Dirección de Resurgimientos, su solicitud de héroe no puede procesarse. Vuelva en tres siglos laborables.'
    ]
  },
  rusaso_pluma: {
    id: 'rusaso_pluma',
    name: 'Rusaso de la Pluma',
    spriteColor: '#c084fc',
    role: 'Poeta',
    lore: 'Escribe versos para Alex. Dramático, teatral y siempre a punto de recitar.',
    dialogues: [
      '¡Ay, infame fortuna! ¡Ay, píxel desdichado! ¿Has venido a inspirarme?',
      'El Mister me pidió un poema sobre su resurgir. Le escribí una oda. Y luego una elegía. Por si acaso.',
      'Hay belleza en un servidor que arde, ¿sabes? Lástima que nadie pague por leerlo.'
    ]
  },
  tio_manoplo: {
    id: 'tio_manoplo',
    name: 'Tío Manoplo',
    spriteColor: '#2563eb',
    role: 'Técnico',
    talkSfx: 'electric_shock',
    lore: 'Arregla cosas con cinta aislante. Alex le debe dinero y una caja de herramientas.',
    dialogues: [
      '¿Se te ha roto algo? Trae, trae. Un poco de cinta y fe.',
      'Alex me debe tres meses y una llave inglesa. Si lo ves, dile que la cinta no crece en los árboles.',
      'Todo se arregla con cinta aislante. Hasta el Resurgir. Sobre todo el Resurgir.'
    ]
  }
};

export const EXPANSION_NPC_LIST = Object.values(EXPANSION_NPCS);

export function getExpansionNPC(id) {
  return EXPANSION_NPCS[id] || null;
}

/**
 * (EXPANSIÓN v2.0) Elige el SFX de voz/entrada de un diálogo de la expansión.
 * - Cepedita 2.0 (holograma) → hologram_on
 * - Iñakito → coffee_sip / keyboard_type
 * - Texto con error/glitch → ui_glitch / error_buzz
 */
export function getExpansionDialogueSfx(npcId, text = '') {
  const npc = EXPANSION_NPCS[npcId];
  if (npc && npc.talkSfx) return npc.talkSfx;
  if (/iñakito|inakito/i.test(npcId || '')) {
    // Determinista: los tests y la escena esperan el sorbo de café de Iñakito.
    return 'coffee_sip';
  }
  if (/glitch|error|excepci[oó]n|exception|undefined|null|404|fallo|bug/i.test(text || '')) {
    return Math.random() < 0.5 ? 'ui_glitch' : 'error_buzz';
  }
  return null;
}

/**
 * (EXPANSIÓN v2.0) Catálogo de armas y escudos del futuro corporativo.
 * Actúan como modificadores sobre el combate base del jugador sin romper las mecánicas existentes.
 */
export const EXPANSION_EQUIPMENT = {
  boligrafo: {
    id: 'boligrafo',
    itemId: 'equip_boligrafo',
    slot: 'weapon',
    name: 'Bolígrafo Corporativo',
    description: 'Arma inicial de Valleverde 2.0. Tinta azul corporativa: golpes veloces (cooldown 0.15s).',
    baseDamage: 1,
    attackDuration: 0.14,
    cooldown: 0.15,
    effect: 'none',
    bladeColor: '#2563eb',
    arcColor: 'rgba(59, 130, 246, 0.92)',
    edgeColor: '#bfdbfe',
    badgeLabel: '🖊️ Boli Corp.'
  },
  grapadora: {
    id: 'grapadora',
    itemId: 'equip_grapadora',
    slot: 'weapon',
    name: 'Grapadora Industrial',
    description: 'Daño 2 y cadencia media (0.3s). Dispara una grapa perforante cada 3er golpe.',
    baseDamage: 2,
    attackDuration: 0.22,
    cooldown: 0.30,
    effect: 'staple_every_3',
    bladeColor: '#64748b',
    arcColor: 'rgba(249, 115, 22, 0.9)',
    edgeColor: '#fdba74',
    badgeLabel: '📎 Grapadora'
  },
  destornillador: {
    id: 'destornillador',
    itemId: 'equip_destornillador',
    slot: 'weapon',
    name: 'Destornillador del Destino',
    description: 'Arma Legendaria (Daño 3, lento 0.45s). Ignora la armadura e invulnerabilidad de los jefes.',
    baseDamage: 3,
    attackDuration: 0.30,
    cooldown: 0.45,
    effect: 'ignore_boss_armor',
    bladeColor: '#eab308',
    arcColor: 'rgba(250, 204, 21, 0.95)',
    edgeColor: '#fef9c3',
    badgeLabel: '🪛 Destornillador'
  },
  carpeta: {
    id: 'carpeta',
    itemId: 'equip_carpeta',
    slot: 'shield',
    name: 'Carpeta de Plástico',
    description: 'Pasiva: reduce el daño recibido en 0.5 corazones. Parry: ralentiza al enemigo 2s.',
    damageReduction: 0.5,
    parrySlowDuration: 2.0,
    badgeColor: '#06b6d4',
    badgeLabel: '📁 Carpeta'
  },
  escudo_becario: {
    id: 'escudo_becario',
    itemId: 'equip_escudo_becario',
    slot: 'shield',
    name: 'Escudo del Becario',
    description: 'Parry reforzado: amplía la ventana de parry en +0.2s adicionales.',
    extraParryWindow: 0.2,
    badgeColor: '#a855f7',
    badgeLabel: '🛡️ Escudo Bec.'
  }
};

export function getExpansionEquipment(idOrItemId) {
  if (!idOrItemId || typeof idOrItemId !== 'string') return null;
  if (EXPANSION_EQUIPMENT[idOrItemId]) return EXPANSION_EQUIPMENT[idOrItemId];
  const stripped = idOrItemId.replace(/^equip_/, '');
  return EXPANSION_EQUIPMENT[stripped] || null;
}

/**
 * (EXPANSIÓN v2.0) Catálogo ampliado de habilidades (Niveles 11-15 y mejoras Nivel II).
 */
export const EXPANSION_SKILLS = {
  ejecutivo: {
    key: 'ejecutivo',
    name: 'Ejecutivo',
    cost: 2,
    icon: '💼',
    desc: '+15% de daño contra jefes (isBoss).'
  },
  resiliencia: {
    key: 'resiliencia',
    name: 'Resiliencia',
    cost: 2,
    icon: '🧱',
    desc: '-15% de daño recibido en mazmorras y Núcleo.'
  },
  reciclaje: {
    key: 'reciclaje',
    name: 'Reciclaje',
    cost: 3,
    icon: '♻️',
    desc: '10% de prob. de que enemigos suelten Currículum.'
  },
  vigor_2: {
    key: 'vigor_2',
    name: 'Vigor II',
    cost: 2,
    requires: 'vigor',
    icon: '❤',
    desc: '+40 de stamina máxima adicional (140 → 180).'
  },
  filo_2: {
    key: 'filo_2',
    name: 'Filo II',
    cost: 2,
    requires: 'filo',
    icon: '⚔',
    desc: 'El 3er golpe (finisher) inflige 1 de daño AoE (24px).'
  },
  reflejo_2: {
    key: 'reflejo_2',
    name: 'Reflejo II',
    cost: 2,
    requires: 'reflejo',
    icon: '✦',
    desc: 'El parry devuelve el 50% del daño absorbido.'
  },
  log_2: {
    key: 'log_2',
    name: 'Log II',
    cost: 2,
    requires: 'log',
    icon: '📜',
    desc: 'El tronco lanzado explota en área (radio 20px).'
  }
};

export const EXPANSION_SKILLS_KEYS = Object.keys(EXPANSION_SKILLS);
export const EXPANSION_EQUIPMENT_KEYS = Object.keys(EXPANSION_EQUIPMENT);

/**
 * Frases de burla de los jefes cuando el jugador huye de su arena.
 */
export const EXPANSION_BOSS_FLEE_TAUNTS = {
  boss_inakito: '¡El jefe dice que no me compares con los cobardes como tú!',
  boss_kernel: 'Acceso denegado a tu orgullo. Siguiente proceso.',
  boss_alex_update: '¿Ya pides la baja? No pasa nada, te descuento la huida de la nómina.'
};
