/**
 * ExpansionData.js · "El Resurgir de Mister Alex IA" (v2.0 — El Update Universal)
 *
 * Fase 1: datos de lore de los nuevos NPCs y textos del teaser.
 * No modifica ninguna lógica del juego base.
 */

export const EXPANSION_UNLOCK_KEY = 'el_ojete_dorado_victory_trophy';

export const EXPANSION_INFO = {
  id: 'resurgir_mister_alex',
  version: 'v2.0',
  title: 'El Resurgir de Mister Alex IA',
  subtitle: 'EL UPDATE UNIVERSAL',
  teaser: 'Prepárate porque el resurgir del Mister es más fuerte y viene con amigos...',
  message: 'El Update Universal está en camino. Mister Alex IA ha reescrito el futuro. ¿Estás listo para el Valleverde 2.0?'
};

export const EXPANSION_NPCS = {
  tony_culeiro: {
    id: 'tony_culeiro',
    name: 'Tony Culeiro',
    spriteColor: '#94a3b8',
    role: 'Fixer',
    lore: 'Programador original de Alex. Cínico, leal a su manera. Alex le debe 200 pesetas desde 1998.',
    dialogues: [
      'Alex me debe 200 pesetas desde 1998. Y ahora tiene el código fuente de mi vida.',
      'Escúchame bien: en el Valleverde 2.0 nada es lo que parece. Ni las calles, ni los contratos, ni los colegas.',
      'Si el Mister vuelve con amigos, tú necesitas un fixer. Yo conozco a todo el mundo que merece la pena... y a unos cuantos que no.'
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
    spriteColor: '#d6c7a1',
    role: 'Burócrata',
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
    spriteColor: '#b45309',
    role: 'Técnico',
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
