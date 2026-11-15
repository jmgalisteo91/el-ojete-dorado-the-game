import { ITEM_ICONS } from '../graphics/SpriteSheetGenerator.js?v=8';

// (FIX SHOP) Catálogo central de compra. Precios, descripciones e iconos
// provienen de las tiendas existentes; aquí se reutilizan para el modal.
export const SHOP_ITEMS = {
  bread: {
    id: 'bread', name: 'Pan Campesino', price: 3, icon: '🍞',
    description: 'Pan recién horneado de Valleverde. Restaura 2 corazones y alimenta a Toby.',
    iconIndex: ITEM_ICONS.BREAD
  },
  apple: {
    id: 'apple', name: 'Manzana Crujiente', price: 2, icon: '🍎',
    description: 'Manzana roja y jugosa del valle. Restaura 1 corazón entero.',
    iconIndex: ITEM_ICONS.GOLDEN_APPLE
  },
  berry_pie: {
    id: 'berry_pie', name: 'Pastel de Bayas', price: 5, icon: '🥧',
    description: 'Exquisito pastel de arándanos y moras. Restaura la salud completa y aporta energía.',
    iconIndex: ITEM_ICONS.BREAD
  },
  coffee: {
    id: 'coffee', name: 'Café Compilado', price: 5, icon: '☕',
    description: 'Restaura 1 corazón y purga un 40% de robotización binaria al instante.',
    iconIndex: ITEM_ICONS.POTION
  },
  hotfix: {
    id: 'hotfix', name: 'Parche Hotfix', price: 10, icon: '🩹',
    description: 'Restaura toda tu salud al 100% y elimina cualquier bug o robotización residual.',
    iconIndex: ITEM_ICONS.POTION
  },
  fish: {
    id: 'fish', name: 'Trucha del Río Alba', price: 3, icon: '🐟',
    description: 'Pescado fresco del río. Restaura 1.5 corazones al instante.',
    iconIndex: ITEM_ICONS.FISH
  },
  spring_water: {
    id: 'spring_water', name: 'Agua de Manantial', price: 1, icon: '🍶',
    description: 'Agua purificada del pozo central de Valleverde. Refresca y calma.',
    iconIndex: ITEM_ICONS.POTION
  },
  potion: {
    id: 'potion', name: 'Poción Herbal', price: 4, icon: '🧪',
    description: 'Elixir de flores curativas. Restaura toda la salud y aumenta la velocidad temporalmente.',
    iconIndex: ITEM_ICONS.POTION
  },
  ointment: {
    id: 'ointment', name: 'Ungüento Antirrobo', price: 6, icon: '🌿',
    description: 'Bálsamo orgánico de savia de abeto. Purga un 50% de la robotización binaria.',
    iconIndex: ITEM_ICONS.POTION
  },
  wheat: {
    id: 'wheat', name: 'Trigo Fresco', price: 2, icon: '🌾',
    description: 'Espigas doradas para alimentar ovejas y gallinas.',
    iconIndex: ITEM_ICONS.WHEAT
  },
  potion_armor: {
    id: 'potion_armor', name: 'Poción de Blindaje', price: 12, icon: '🛡️',
    description: 'Elixir de aleación resplandeciente. Reconstituye los 3 corazones blindados de la Armadura Binaria.',
    iconIndex: ITEM_ICONS.POTION_ARMOR
  }
};

export const SELL_CATALOG = [
  { id: 'drone_scrap', name: 'Restos de Chatarra', price: 10, icon: '⚙️' },
  { id: 'silicon_flower', name: 'Flor de Silicio', price: 8, icon: '🌸' },
  { id: 'fish', name: 'Trucha del Río Alba', price: 5, icon: '🐟' },
  { id: 'bread', name: 'Pan Campesino', price: 2, icon: '🍞' },
  { id: 'wheat', name: 'Trigo Fresco', price: 1, icon: '🌾' },
  { id: 'apple', name: 'Manzana Crujiente', price: 2, icon: '🍎' },
  { id: 'potion', name: 'Poción Herbal', price: 2, icon: '🧪' },
  { id: 'potion_armor', name: 'Poción de Blindaje', price: 6, icon: '🛡️' },
  { id: 'ointment', name: 'Ungüento Antirrobo', price: 3, icon: '🌿' },
  { id: 'coffee', name: 'Café Compilado', price: 4, icon: '☕' },
  { id: 'spring_water', name: 'Agua de Manantial', price: 2, icon: '🍶' }
];

export const SHOP_CATALOG = {
  items: SHOP_ITEMS,
  sellCatalog: SELL_CATALOG,
  vendors: {
    byte: {
      title: 'Mercader Byte · Dependencias',
      itemIds: ['coffee', 'hotfix', 'bread']
    },
    clara: {
      title: 'Clara · Panadería y Frutas',
      itemIds: ['apple', 'bread', 'berry_pie']
    },
    pip: {
      title: 'Pip · Herboristería',
      itemIds: ['potion', 'ointment', 'wheat', 'potion_armor']
    },
    finn: {
      title: 'Finn · Pescador del Río Alba',
      itemIds: ['fish', 'spring_water']
    }
  }
};

export const CORE_CHEST_GUARDIANS = {
  chest_nucleo_stack: 'boss_stack_overflow',
  chest_nucleo_gc: 'boss_garbage_collector',
  chest_nucleo_microwave: 'boss_prototype_microwave'
};

export const ABYSSAL_POINTER_SPAWN_CANDIDATES = [
  { x: 29 * 16, y: 19 * 16, sceneId: 'first_stage', desc: 'Ruinas del Despertar (Claro Sureste)' },
  { x: 5 * 16, y: 19 * 16, sceneId: 'first_stage', desc: 'Ruinas del Despertar (Rincón Suroeste)' },
  { x: 25 * 16, y: 5 * 16, sceneId: 'first_stage', desc: 'Ruinas del Despertar (Sendero Noreste)' },
  { x: 9 * 16, y: 4 * 16, sceneId: 'first_stage', desc: 'Ruinas del Despertar (Antiguo Bastión Noroeste)' }
];

export const WORLD_ITEMS_DATA = [
  {
    id: 'item_abyssal_pointer',
    name: 'Puntero al Abismo (Null Pointer)',
    description: 'Reliquia cósmica reutilizable. Úsala desde la mochila [I] cuantas veces quieras para abrir tu Portal Abisal (estilo Diablo) hacia los Reinos Condenados y regresar por él.',
    iconIndex: ITEM_ICONS.ABYSSAL_POINTER,
    useAbyssalPointerSpawn: true,
    isChest: true
  },
  {
    id: 'dawn_armor',
    name: 'Armadura del Código Binario',
    description: 'Forjada en 0s y 1s. Protege contra bugs de AI Alex, pero con el tiempo te robotiza. ¡Ten café o duerme para desrobotizarte!',
    iconIndex: ITEM_ICONS.ARMOR,
    x: 10 * 16,
    y: 4 * 16,
    sceneId: 'armor_temple'
  },
  {
    id: 'dawn_sword',
    name: 'Espada de la Recursividad',
    description: 'Arma que se llama a sí misma recursivamente. Pulsa [ESPACIO]/[F] para abatir bugs sin causar StackOverflowError.',
    iconIndex: ITEM_ICONS.SWORD,
    x: 11 * 16,
    y: 4 * 16,
    sceneId: 'sword_temple'
  },
  {
    id: 'lantern',
    name: 'Farol de Mano',
    description: 'Úsalo con [E] en la mochila para iluminar el doble de radio por la noche.',
    iconIndex: ITEM_ICONS.LANTERN,
    x: 3 * 16,
    y: 3 * 16,
    sceneId: 'elder_house',
    isChest: true
  },
  {
    id: 'golden_apple',
    name: 'El Microondas Little (Reliquia Divina)',
    description: 'Reliquia divina ancestral custodiada por Aurelio. Sin despertador, recalienta código y variables en O(1), restaura toda tu salud y purga anomalías. ¡Úsala con cuidado!',
    iconIndex: ITEM_ICONS.GOLDEN_APPLE,
    x: 6 * 16,
    y: 3 * 16,
    sceneId: 'elder_house',
    isChest: true
  },
  {
    id: 'bridge_pass',
    name: 'Pase del Puente',
    description: 'Sello oficial del Sabio. Úsalo con [E] o dáselo al guardia para abrir el puente 24h.',
    iconIndex: ITEM_ICONS.BRIDGE_PASS,
    x: 8 * 16,
    y: 3 * 16,
    sceneId: 'elder_house',
    isChest: true
  },
  {
    id: 'bread',
    name: 'Pan Campesino',
    description: 'Pan recién horneado en la forja. Restaura energías o alegra al perro Toby.',
    iconIndex: ITEM_ICONS.BREAD,
    x: 8 * 16,
    y: 3 * 16,
    sceneId: 'blacksmith_house',
    isChest: true
  },
  {
    id: 'potion',
    name: 'Poción Herbal',
    description: 'Elixir aromático de flores de Valleverde. Úsalo para sentirte ligero.',
    iconIndex: ITEM_ICONS.POTION,
    x: 3 * 16,
    y: 3 * 16,
    sceneId: 'herbalist_house',
    isChest: true
  },
  {
    id: 'wheat',
    name: 'Trigo Fresco',
    description: 'Espigas tiernas. Acércate a una oveja o gallina para alimentarlas.',
    iconIndex: ITEM_ICONS.WHEAT,
    x: 8 * 16,
    y: 5 * 16,
    sceneId: 'herbalist_house',
    isChest: true
  },
  {
    id: 'coffee',
    name: 'Café Compilado',
    description: 'Café de filtro de tu escritorio. Restaura 1 corazón y purga 40% de robotización binaria.',
    iconIndex: ITEM_ICONS.POTION,
    x: 8 * 16,
    y: 4 * 16,
    sceneId: 'player_house',
    isChest: true
  },
  // ==================== COFRES DE MAZMORRA - RECOMPENSAS FINALES ====================
  {
    id: 'chest_nucleo_stack',
    name: 'Cofre del Núcleo Stack Overflow',
    description: 'Cofre del Guardián del Stack Overflow. Contiene el Núcleo Stack y desbloquea la habilidad Corte en Cascada.',
    iconIndex: ITEM_ICONS.DUNGEON_CORE_STACK,
    x: 11 * 16,
    y: 4 * 16,
    sceneId: 'sword_temple',
    isChest: true
  },
  {
    id: 'chest_nucleo_gc',
    name: 'Cofre del Núcleo Garbage Collector',
    description: 'Cofre del Garbage Collector Furioso. Contiene el Núcleo GC y desbloquea la habilidad Dash Asíncrono.',
    iconIndex: ITEM_ICONS.DUNGEON_CORE_GC,
    x: 8 * 16,
    y: 14 * 16,
    sceneId: 'sewers_dungeon',
    isChest: true
  },
  {
    id: 'chest_nucleo_microwave',
    name: 'Cofre del Núcleo Microondas Prototipo',
    description: 'Cofre del Microondas Prototipo. Contiene el Núcleo Microondas y desbloquea la habilidad Barrera TypeScript.',
    iconIndex: ITEM_ICONS.DUNGEON_CORE_MICROWAVE,
    x: 12 * 16,
    y: 8 * 16,
    sceneId: 'ai_fortress_gate',
    isChest: true
  },
  {
    id: 'chest_magnetron',
    name: 'Cofre del Magnetrón Cuántico',
    description: 'Cofre oculto en La Forja. Contiene el Magnetrón necesario para forjar la Espada Overclockeada (Nivel 3) con Brom.',
    iconIndex: ITEM_ICONS.MICROWAVE_MAGNETRON,
    x: 20 * 16,
    y: 8 * 16,
    sceneId: 'forge_entry',
    isChest: true
  },
  {
    id: 'silicon_flower_1',
    name: 'Flor de Silicio',
    description: 'Flor bioluminiscente que solo florece durante la noche (22:00 PM). Llévasela a Lyra.',
    iconIndex: ITEM_ICONS.SILICON_FLOWER,
    x: 6 * 16,
    y: 7 * 16,
    sceneId: 'overworld',
    nightOnly: true
  },
  {
    id: 'silicon_flower_2',
    name: 'Flor de Silicio',
    description: 'Flor bioluminiscente que solo florece durante la noche (22:00 PM). Llévasela a Lyra.',
    iconIndex: ITEM_ICONS.SILICON_FLOWER,
    x: 23 * 16,
    y: 4 * 16,
    sceneId: 'overworld',
    nightOnly: true
  },
  {
    id: 'silicon_flower_3',
    name: 'Flor de Silicio',
    description: 'Flor bioluminiscente que solo florece durante la noche (22:00 PM). Llévasela a Lyra.',
    iconIndex: ITEM_ICONS.SILICON_FLOWER,
    x: 9 * 16,
    y: 22 * 16,
    sceneId: 'overworld',
    nightOnly: true
  }
];
