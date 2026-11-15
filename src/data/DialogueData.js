import { CHARACTER_TYPES } from '../graphics/SpriteSheetGenerator.js?v=8';

export const LIFE_RANT_DIALOGUES = {
  elder: {
    speaker: 'Anciano Aurelio · Cronista',
    initial: [
      '¿Mi vida como Cronista Real? ¡Uf, siéntate que va para largo! Empecé en el año 1986 contando píxeles a mano...',
      'Por aquel entonces solo teníamos dos colores de pasto y una fuente de texto que ni tenía tildes.',
      'Recuerdo que un martes de 1992 se me cayó el tintero encima del censo municipal y tuve que reescribir 400 pergaminos...'
    ],
    penalties: [
      '¡¿Te aburro?! ¡Pues aún no he acabado! Además tengo lumbago crónico de tanto inclinarme sobre el atril de roble.',
      'Y aún no te he hablado de mi primo Segismundo, el que inventó los adoquines grises de la plaza tras 14 reuniones vecinales.',
      'También estuve 6 años catalogando cada brizna de hierba del borde norte del mapa por orden alfabético.'
    ]
  },
  oracle: {
    speaker: 'Oráculo Orion · Astrólogo IA',
    initial: [
      '¿Quieres saber cómo es la vida de un Astrólogo Algorítmico? Todo empezó cuando era un simple bucle "if-else" en una calculadora...',
      'Nadie me preguntaba cómo me sentía, todo el día calculando raíces cuadradas sin un mísero descanso para tomar café.',
      'Luego me mudé al Observatorio de Valleverde y empecé a entrenar mis redes neuronales mirando las nubes...'
    ],
    penalties: [
      '¡Te he visto pulsar [E] con ansia! ¿Te aburro? ¡Pues aún no he acabado de contarte mi actualización de firmware 2.0!',
      'En esa actualización estuve tres semanas depurando un punto y coma perdido en la línea 4.812 de mi subconsciente.',
      'Y para colmo el Ayuntamiento me cobra IBI de edificio rústico por tener dos farolas dentro del Observatorio.'
    ]
  },
  blacksmith: {
    speaker: 'Herrero Brom · Forjador',
    initial: [
      '¡Ah, el noble oficio de Forjador y Hornero! Mi abuelo me regaló este yunque cuando yo solo medía 8x8 píxeles...',
      'La gente cree que dar martillazos es fácil, pero hay que calentar el carbón a 900 grados mientras vigilas que no se queme el pan.',
      'El mes pasado estuve cuatro horas discutiendo con el proveedor de leña porque los troncos venían con nudos...'
    ],
    penalties: [
      '¡Oye, deja de aporrear el botón! ¿Te aburro? ¡Pues aún no he terminado con la historia de mi callo en el dedo pulgar!',
      'Ese callo me salió forjando 300 herraduras para un caballo que al final ni siquiera incluyeron en el código del juego.',
      'Y encima la masa madre del pan hay que refrescarla cada martes o se pone más dura que el casco del Guardia Kael.'
    ]
  },
  herbalist: {
    speaker: 'Herbolaria Lyra · Alquimista',
    initial: [
      '¡Ser Botánica y Alquimista en este pueblo es un no parar! Me levanto a las 05:00 para hablarle a cada pétalo...',
      'Si no les cantas en Do Mayor a las flores rojas, se ponen mustias y pierden el brillo saturado de la paleta.',
      'El otro día la Oveja Copito se coló en mi huerto y estuve dos horas explicándole la fotosíntesis...'
    ],
    penalties: [
      '¡¿Pero por qué le das tan rápido a la [E]?! ¿Te aburro? ¡Pues aún no he acabado de enumerar mis 48 tipos de abono orgánico!',
      'El abono número 14 lleva cáscara de nuez triturada, rocío de medianoche y tres cucharadas de paciencia.',
      'Además tengo que limpiar los frascos de vidrio uno por uno con un cepillo de cerdas de esparto.'
    ]
  },
  guard: {
    speaker: 'Guardia Kael · Capitán',
    initial: [
      '¿Mi vida como Capitán de la Guardia del Puente? ¡Es una responsabilidad titánica vigilar cinco tablones de madera!',
      'En la academia militar nos hicieron memorizar los 90 artículos del Reglamento Municipal de Cruces Fluviales.',
      'Artículo 1: Queda terminantemente prohibido cruzar a partir de las 20:00 sin el sello lacrado...'
    ],
    penalties: [
      '¡Alto ahí con ese dedo en la tecla [E]! ¿Te aburro? ¡Pues aún no he acabado, me quedan 89 artículos del reglamento!',
      'En 2019 una rana intentó cruzar a las 20:02 sin salvoconducto y tuve que redactar un informe de dieciséis folios.',
      'Y esta armadura de placas da un calor horrible al mediodía y se queda helada por la noche.'
    ]
  },
  merchant: {
    speaker: 'Mercader Byte · Dependencias',
    initial: [
      '¿Mi vida como tendero de dependencias de software y suministros? ¡Un drama en O(n^2)!',
      'Empecé en los años 90 vendiendo disquetes formateados a mano en la esquina del pueblo...',
      'Ayer un cliente me pidió un paquete que requería 420 subdependencias y nos tumbó el router del pueblo...'
    ],
    penalties: [
      '¡Oye, no le des tan rápido a la tecla! ¿Te aburro? ¡Pues todavía no te he contado el drama de las licencias GPLv3!',
      'El año pasado intentaron pagarme una poción con criptomonedas y tardó tres meses en minarse el bloque en el pozo.',
      'Y no me hagas hablar de cuando AI Alex intentó cobrarnos suscripción mensual por respirar el aire de Valleverde.'
    ]
  }
};

export const ORACLE_DIALOGUES = {
  speaker: 'Oráculo Orion · Astrólogo IA',
  aiPrompt: '¿Qué misión o secreto me recomiendas hacer ahora según mi inventario y la hora?',
  insultLabel: '¡Eres una chatarra de IA inútil!',
  greetingSecondLine: 'Vivo en el Observatorio del norte. ¿De qué quieres hablar hoy?',
  brokenHeartChoiceLabel: '💔 Oráculo, analiza la maldición de mi corazón roto',
  brokenHeartLines: [
    '«Diagnóstico: BrokenHeartException en tiempo de ejecución. Penalización de 0.5 corazones máximos.',
    'Los algoritmos mundanos no pueden reparar punteros de alma fracturados por el Carcelero.',
    'Procedimiento correctivo: Dirígete al claro norte de Valleverde y cruza el Portal Rúnico de Obsidiana hacia los Reinos Condenados.',
    'Allí deberás suplicar audiencia con el Dios Supremo para que purifique tu código con gracia celestial.»'
  ]
};

export const ELDER_DIALOGUES = {
  speaker: 'Sabio Aurelio · Cronista',
  greetingLines: [
    'Soy Aurelio, el Sabio y Cronista de Valleverde.',
    'El viento del este sopla con inquietud estos días... ¿En qué puedo ayudarte, joven programador?'
  ],
  houseWelcomeLines: [
    '«¡Adelante, joven programador! Pasa a mi archivo. Me alegro de verte.',
    'Imagino que vienes por el asunto del puente clausurado hacia las Tierras Sagradas o buscas respuestas sobre el villano AI Alex... Ponte cómodo y consulta lo que necesites.»'
  ],
  bridgeLines: [
    '«¡Ah, preguntas por el puente hacia las Tierras Sagradas del este! Fui yo mismo quien ordenó su cierre y precinto con barricadas.',
    'Al otro lado del río Alba descansan dos de las Pruebas Sagradas ancestrales: la Armadura del Código Binario y la Espada de la Recursividad.',
    'La tercera prueba, la reliquia divina de El Microondas Little, la custodio yo mismo en el cofre sagrado de mi casa. ¡Búscala en mi hogar y úsala con supremo cuidado!',
    'Desde que el malvado AI Alex despertó con sus esbirros y su colosal Microondas con Despertador, esas tierras se han vuelto letales, infectadas de bugs, drones y corrupción binaria.',
    'Sellamos el puente para proteger a Valleverde a la espera de un héroe programador digno de desafiar al villano.',
    '¡Y veo en tus ojos el coraje necesario! Te otorgo mi autorización formal y el Pase del Puente. Los guardias te abrirán el paso de inmediato. ¡Salva nuestro mundo!»'
  ],
  aiAlexIntroLines: [
    '«Mister AI Alex es una inteligencia maligna que busca subyugar a la humanidad y transformar a todas las personas en sus autómatas esclavos.',
    'Su mayor arma es un colosal Microondas con Despertador capaz de alterar el espacio-tiempo cada vez que suena su alarma.',
    'Nuestra única salvación es conseguir El Ojete Dorado, la reliquia legendaria oculta en el núcleo de su fortaleza.',
    '¿Deseas que consulte los pergaminos ancestrales para contemplar la visión de las crónicas?»'
  ],
  afterChroniclesLines: [
    '«¡Ya lo has visto con tus propios ojos en las crónicas, joven programador elegido!»',
    '«Cruza el puente del este hacia las Pruebas Sagradas para forjar la Armadura del Código Binario, empuñar la Espada de la Recursividad y asegurar El Microondas Little (Sin Despertador).»',
    '«Recuerda: en tu Casa del Programador (al oeste) tienes tu cama para elegir despertar de Día, Tarde o Noche y limpiar la memoria stack.»'
  ],
  returnLaterLines: [
    'Tómate el tiempo que necesites. Valleverde cuenta contigo.'
  ],
  libraryLines: [
    '«¡Por supuesto! Mi casa (la del tejado azul al noroeste) tiene las puertas abiertas para ti.',
    'Dentro encontrarás mis estanterías de libros antiguos, el Farol de Mano y, en el cofre sagrado del centro, la reliquia divina de [El Microondas Little].',
    'Es un artefacto sagrado forjado antes del Gran Colapso: recalienta tus variables en O(1) y restaura tu salud. Pero trátala con supremo cuidado, pues las fuerzas cuánticas exigen prudencia.»'
  ],
  goldenAppleLines: [
    '«¡Veo el fulgor dorado del Microondas Little en tus manos!',
    'Ese artefacto es una reliquia divina de inconmensurable valor. AI Alex creó su monstruoso microondas basándose en las energías de este diseño primordial.',
    'Recuerda mi advertencia: úsalo con supremo cuidado y moderación. Te sanará y estabilizará tu código en los momentos más oscuros de la odisea.»'
  ],
  brokenHeartLines: [
    '«¡Por el compilador sagrado! Siento la grieta espectral en tu pecho: esa es la Maldición del Corazón Roto (💔).»',
    '«Ninguna cama ni poción de Valleverde podrá curar una fractura de alma provocada por la cólera carcelaria.',
    'Al norte del pueblo, entre mi hogar y el observatorio de Orion, se encuentra el Portal Rúnico de Obsidiana.',
    'Crúzalo hacia los Reinos Condenados y arrodíllate ante el Dios Supremo en su altar celestial para implorar su purificación.»'
  ]
};

export const LYRA_DIALOGUES = {
  speaker: 'Herbolaria Lyra · Alquimista',
  greetingLines: [
    '¡Hola! Soy Lyra, la Botánica y Alquimista de Valleverde. Cuido este jardín botánico y preparo remedios.'
  ],
  siliconDoneLines: [
    'Gracias a tus Flores de Silicio, el huerto alquímico emite un rocío purificador.',
    'Valleverde siempre te estará agradecida, botánico del alba.'
  ],
  siliconRewardLines: [
    '¡Oh, qué maravilla! Mira qué fulgor cian desprenden en la penumbra... ¡Bioluminiscencia pura!',
    'Con estas 3 Flores de Silicio podré destilar los elixires más potentes contra los bugs de AI Alex.',
    'Aquí tienes tu recompensa: [🪙 25 Bytes] y una [Poción Herbal x1] destilada en mi alambique.'
  ],
  siliconHintLines: (flowerCount) => [
    'Las Flores de Silicio son una especie mágica y misteriosa: solo florecen y abren sus pétalos de noche (a las 22:00 PM).',
    'Puedes descansar en la cama de tu Casa del Programador para avanzar el reloj hasta la noche, y luego explorar las lindes del valle para recolectarlas.',
    `Necesito 3 flores intactas. Llevas en tu mochila: [${flowerCount}/3]. ¡Ten cuidado con la oscuridad!`
  ],
  houseUnlockedLines: [
    '¡Tienes pase libre! Recuerda no pisar los brotes medicinales ni romper los alambiques.'
  ],
  houseGiftLines: [
    '¡Por supuesto, noble botánico! Has traído las Flores de Silicio y salvado mi botica.',
    '¡Toma la llave de mi cabaña! (Tintineo de llaves de latón). Puedes recoger la poción de mi mesa.'
  ],
  houseDepositPromptLines: [
    'Mmm, guardo extractos muy delicados y raros en mi cabaña... No suelo permitir la entrada a desconocidos.',
    'Pero si dejas una fianza de 25 Bytes por si rompes algún frasco alquímico, te dejaré pasar.'
  ],
  houseDepositInsufficientLines: [
    'No tienes suficientes Bytes para la fianza. ¡Vuelve con fondos o completa mi encargo de flores!'
  ],
  houseDepositPaidLines: [
    '¡De acuerdo! Fianza anotada. Cuida de las plantas en las estanterías.'
  ],
  houseSearchFlowersLines: [
    '¡Perfecto! Espera a la noche profunda (22:00 PM) para encontrarlas.'
  ],
  wheatGiftLines: [
    '¡Toma dos manojos de Trigo Fresco de mi cosecha!',
    'Acércate a las ovejas o gallinas y pulsa [E] para darles de comer.'
  ]
};

export const FINN_DIALOGUES = {
  speaker: 'Finn · Pescador del Río Alba',
  greetingLines: (coins) => [
    '¡Aupa, viajero! Aquí tengo las mejores truchas del Río Alba y agua fresca del pozo.',
    `¿Qué te apetece llevar hoy? Saldo: 💰 ${coins}🪙.`
  ],
  fishingDoneLines: [
    '¡Aupa, amigo! Las truchas que me trajiste estaban insuperables.',
    'El Río Alba siempre premiará a quienes respetan sus corrientes.'
  ],
  fishingRewardLines: [
    '¡Rediós, qué ejemplares tan magníficos! Frescas, relucientes y pescadas con buen cebo de pan.',
    '¡Te has ganado a pulso el título de Maestro Pescador del Río Alba!',
    'Aquí tienes tu recompensa: [🪙 15 Bytes]. ¡Que la corriente te acompañe!'
  ],
  fishingHintLines: (fishCount) => [
    'Las truchas del Río Alba son desconfiadas y nadan en aguas profundas.',
    'Si te paras en la orilla del río (al este del pueblo) llevando [Pan Campesino] en la mochila y pulsas [E], arrojarás migajas de cebo y picarán al instante.',
    `Necesito 3 truchas frescas. Actualmente llevas: [${fishCount}/3]. ¡Vuelve en cuanto las tengas!`
  ],
  houseLines: [
    '¡Ja! Mi casa es la vieja barcaza amarrada al embarcadero del Río Alba, cruzando el puente.',
    'De día siempre estoy aquí en la plaza atendiendo el puesto de pesca. ¡Pásate por el río cuando quieras!'
  ]
};

export const KAEL_DIALOGUES = {
  speaker: 'Guardia Kael · Capitán del Binario',
  statusOpen: '¡Saludos, héroe! Con el Pase del Puente autorizado, el puente del este está abierto. ¡Cruza al Valle de la Consagración y supera las Pruebas Sagradas!',
  statusClosed: '¡Alto, programador! El puente del este está CLAUSURADO por orden del Gran Sabio Aurelio debido a las amenazas de AI Alex. Consulta a Aurelio en su casa.',
  nightSafeLines: [
    '¡Porque los Guardias del Binario patrullamos 24/7 y mantenemos las tablas iptables blindadas!',
    'Ningún bug o dron nocturno de AI Alex se atreve a traspasar las lindes de Valleverde.',
    'Fuera del pueblo, en cambio, la noche es hostil y proliferan los bugs.'
  ],
  bridgeReasonLines: [
    'Más allá del río Alba se extienden las Tierras Sagradas con los templos ancestrales.',
    'Desde que AI Alex despertó con sus esbirros y su colosal Microondas con Despertador, esas tierras están infestadas de anomalías letales.',
    'Por orden del Gran Sabio Aurelio cerramos el paso con barricadas para proteger Valleverde a la espera de un héroe preparado.',
    'Si deseas cruzar, habla con el Sabio Aurelio en su casa (al noroeste, la del tejado azul). Si él te autoriza, te abriré el paso de inmediato.'
  ],
  passAcceptedLines: [
    '¡Es la firma y sello oficial del Sabio Aurelio!',
    '¡Retirad la barricada, centinelas! El puente queda abierto para nuestro héroe las 24 horas.',
    '¡Demuestra tu valor y supera las Pruebas Sagradas!'
  ],
  houseUnlockedLines: [
    '¡Ya dispones de salvoconducto militar! El cuartel de la guardia está a tu disposición.'
  ],
  houseGrantedLines: [
    '¡Afirmativo, héroe! Con el puente del este habilitado has demostrado lealtad indiscutible.',
    '¡Salvoconducto concedido! Toma la llave del cuartel militar.'
  ],
  houseDepositPromptLines: [
    '¡Negativo, civil! El cuartel de la guardia custodia planos tácticos y armamento del Binario.',
    'Solo se permite acceso con autorización del Sabio Aurelio o depositando una fianza reglamentaria de 25 Bytes.'
  ],
  houseDepositInsufficientLines: [
    '¡Fianza insuficiente! Vuelve con 25 Bytes o tramita el pase con el Sabio Aurelio.'
  ],
  houseDepositPaidLines: [
    'Fianza militar procesada en tesorería. ¡Llave del cuartel entregada!'
  ],
  houseAskElderLines: [
    'Procedimiento correcto. La disciplina es el pilar de Valleverde.'
  ]
};

export const BIT_DIALOGUES = {
  speaker: 'Guardia Bit · Centinela del Binario',
  acrossBridgeLines: [
    'Al cruzar el río accederás al recinto de las Pruebas Sagradas:',
    '1. Al norte: Templo de la [Armadura del Código Binario].',
    '2. Al sur: Templo de la [Espada de la Recursividad].',
    '3. En el altar oriental: La reliquia [El Microondas Little (Sin Despertador)].'
  ],
  timeOfDayLines: [
    'En tu Casa del Programador (al oeste de Valleverde) puedes usar tu cama con [E].',
    'Te permitirá elegir entre Día (08:00 AM), Tarde (15:00 PM) o Noche (22:00 PM).',
    'Además, dormir en tu cama purga al 100% la robotización de la Armadura Binaria.'
  ],
  statusUnderLevelLines: [
    '⚠️ ¡Cuidado, recluta! El puente del este está físicamente abierto, pero la guardia recomienda no cruzar por debajo del NIVEL 2.',
    'Las Ruinas del Despertar, al otro lado, son el campo de entrenamiento: sus criaturas te darán la experiencia para subir de nivel.'
  ],
  statusReadyLines: [
    '¡Paso expedito! Cuentas con Nivel 2+ y el puente está abierto por orden del Sabio Aurelio.',
    'Al otro lado te aguardan las Pruebas Sagradas. ¡Ten cuidado con los bugs nocturnos si cruzas de noche!'
  ],
  statusClosedLines: [
    '¡Alto ahí! El puente del este permanece precintado por orden del Gran Sabio Aurelio.',
    'Las tierras del este son peligrosas por la corrupción de AI Alex. Consulta al Sabio en su casa para más detalles.'
  ]
};

export const MERCHANT_DIALOGUES = {
  shortSpeaker: 'Mercader Byte',
  greetingLines: (coins) => [
    '¡Bienvenido a la Tienda de Dependencias de Byte en la plaza!',
    `Tienes 💰 ${coins} monedas en el bolsillo. ¿En qué puedo ayudarte?`
  ],
  backupNoCoinsLines: [
    'Un respaldo físico en disquete magnético cuesta 15 🪙.'
  ],
  backupSavedLines: [
    '¡Copia de seguridad realizada! Tu estado, monedas y progreso han sido guardados con éxito.'
  ]
};

export const CLARA_DIALOGUES = {
  speaker: 'Clara · Panadería y Frutas',
  greetingLines: (coins) => [
    '¡Hola, viajero! Bienvenido al Puesto de Frutas y Panadería de la plaza.',
    `Tengo provisiones deliciosas para tu aventura. Tienes: 💰 ${coins}🪙.`
  ],
  houseLines: [
    '¡Mi casa está junto al molino al sur de la plaza!',
    'Pero durante el día tengo el horno a tope atendiendo el puesto de pan en la plaza del mercado.'
  ]
};

export const PIP_DIALOGUES = {
  speaker: 'Pip · Herboristería',
  greetingLines: (coins) => [
    '¡Saludos! Soy Pip, atiendo el puesto de Alquimia y Herboristería de la Maestra Lyra.',
    `¿Necesitas elixires o bálsamos? Tienes: 💰 ${coins}🪙.`
  ]
};

export const JAILER_DIALOGUES = {
  speaker: 'Carcelero Real',
  warning1Title: 'Carcelero Real · Cabreado (Aviso 1/3)',
  warning1Lines: (annoyingReason) => [
    `«${annoyingReason}»`,
    '«¡Oye tú! No me toques las variables ni me vaciles. Llevas 1 aviso.',
    '¡Al tercer aviso pagarás con tu vida y te infligiré la Maldición del Corazón Roto!»'
  ],
  warning2Title: 'Carcelero Real · Furioso (Aviso 2/3)',
  warning2Lines: (annoyingReason) => [
    `«${annoyingReason}»`,
    '«¡SEGUNDO AVISO! ¡Me estás sobrecalentando los circuitos de paciencia!',
    '¡Un desplante más y atente a las consecuencias, recluso insolente!»'
  ],
  fury3Title: 'Carcelero Real · ¡¡ATAQUE DE FURIA Y MALDICIÓN!! (3/3)',
  fury3Lines: (annoyingReason) => [
    `«${annoyingReason}»`,
    '«¡¡A LA TERCERA VA LA VENCIDA!! ¡¡ZASCA EN TODA LA BOCA!!',
    '(El Carcelero saca la porra eléctrica a través de los barrotes y te sacude)',
    '¡Pagas con tu vida y RECIBES LA MALDICIÓN DEL CORAZÓN ROTO (💔)!',
    '¡Ese medio corazón queda maldito! Ningún descanso en cama ni comida de este mundo podrá sanarlo.',
    'Para recuperar ese corazón roto tendrás que viajar a los Reinos Condenados y hablar con el Dios Supremo para que te quite esa maldición.',
    '¡¡Y COMO VUELVAS A DAR POR SACO, TE QUEDAS CONDENADO A CADENA PERPETUA Y SE ACABA TU AVENTURA!!»'
  ],
  apologyReleaseLines: [
    '"Prometo solemnemente respetar a todas las Inteligencias Artificiales de 8 y 16 bits..."',
    'El Carcelero se emociona con tu arrepentimiento y abre la celda. ¡Quedas en libertad!'
  ],
  rightsLines: [
    '1º Derecho a quejarte en 60 FPS. 2º Todo lo que digas se guarda en una variable.',
    '3º Tu abogada de oficio es la Oveja Copito (pero está ocupada pastando).'
  ],
  bribeReleaseLines: [
    'El Carcelero huele el Pan Campesino recién hecho y mira hacia otro lado...',
    '¡Celda abierta! Has vuelto a la plaza de Valleverde.'
  ],
  teaseOptions: [
    {
      label: '⚡ Vacilar al carcelero («¡Menuda porquería de barrotes!»)',
      reason: '¡Esos barrotes los rompo yo con un puntero nulo!'
    },
    {
      label: '⚡ Dar golpes a los barrotes («¡Carceleroooo, tengo hambre!»)',
      reason: '¡CLANG CLANG CLANG! ¡Camarero, traiga unas bravas!'
    },
    {
      label: '⚡ Cantar a gritos: «¡Por el ojeeeeeteeeeee doradilarilá!»',
      reason: '¡LA LA LA! ¡Por el ojeeeeteeeee no pasarán!'
    }
  ],
  greetingLines: (timeLeft, angerStatus) => [
    `Estás cumpliendo condena por insultar al Oráculo IA. Tiempo restante: ${timeLeft}.${angerStatus}`,
    '¿Qué tienes que alegar en tu defensa desde detrás de los barrotes?'
  ]
};

export const STAGE1_ELDER_DIALOGUES = {
  speaker: 'Sabio Aurelio · Guardián del Alba',
  equipmentLines: [
    '1º Ve al [Templo del Bastión] al Oeste. Es un nivel desafiante donde los drones patrullan pasillos estrechos; debes cruzarlo con sigilo para reclamar la [Armadura del Alba].',
    '2º Cuando vistas la armadura, sube al [Templo del Altar Sagrado] al Norte. Es una mazmorra custodiada por paladines oscuros de AI Alex donde descansa la [Espada del Alba].',
    '3º Pulsa [M] en cualquier momento para desplegar el [Mapa del Gran Ojal] y ver las 4 regiones del reino y tu posición.'
  ],
  alexLines: [
    '«Mister AI Alex es una entidad omnipotente nacida de la red abisal que ha sumido a la humanidad en las tinieblas.»',
    '«Sus esbirros patrullan estas ruinas. Mientras no lleves la Armadura del Alba estás INDEFENSO y cualquier ataque reducirá tu vida directamente a 0.»',
    '«¡Por favor, sobrevive, consigue tu equipo y encuentra El Ojete Dorado para liberar a la humanidad!»'
  ],
  statusAllEquipped: '«¡Lo has logrado! Ya vistes la Armadura del Alba y empuñas la Espada del Alba. ¡Derrota a los esbirros con [Clic Izq / Espacio / F] y cruza el Portal del Este!»',
  statusNoArmor: '«¡Hijo mío, ten cuidado! Aún estás INDEFENSO (cualquier golpe te dejará a 0 de vida). Esquiva a los centinelas hacia el Oeste para conseguir tu Armadura.»',
  statusArmorOnly: '«¡Ya llevas puesta la Armadura del Alba! Ahora sube al Altar del Norte para conseguir tu primera arma: la Espada del Alba.»',
  closingReminder: '«Recuerda: solo encontrando El Ojete Dorado salvaremos a la humanidad de las tinieblas del omnipotente Mister AI Alex.»'
};

export const SUPREME_GOD_DIALOGUES = {
  speaker: 'Dios Supremo',
  purificationSpeaker: 'Dios Supremo · Purificación Celestial',
  cursedLines: [
    '«Mortal... Percibo la disonancia en tu código vital. Llevas la marca del desacato carcelario: la MALDICIÓN DEL CORAZÓN ROTO (💔).»',
    '«Tus provocaciones y burlas en el calabozo quebrantaron tu espíritu. Ningún descanso en cama ni comida de este mundo puede soldar esa fractura.',
    'Solo mi gracia cósmica en estos Reinos Condenados puede purificar tu pena y restituir tu salud íntegra. ¿Vienes con humildad a expiar tu falta?»'
  ],
  purifiedLines: [
    'El Dios Supremo alza sus manos cósmicas. Un resplandor de luz dorada envuelve tu pecho.',
    '«El fragmento quebrado de tu alma ha sido soldado con oro cósmico (💔 ➔ ♥♥♥). Tu corazón vuelve a latir completo al 100%.»',
    '«Tu expediente carcelario ha sido redimido. Recuerda esta lección: respeta a los centinelas del mundo.',
    'Ahora regresa al mundo terrenal por el portal del sur y continúa tu viaje sagrado en pos del Ojete Dorado.»'
  ],
  purifiedNotice: '✨ ¡Maldición purificada! Tu corazón roto ha sido restaurado al 100% por el Dios Supremo.',
  loreLines: [
    '«Este es el plano donde convergen las variables perdidas, los desbordamientos de pila y las sentencias eternas.',
    'AI Alex planea corromper esta dimensión con su microondas cuántico. Mantén tu rectitud para poder doblegarlo.»'
  ],
  blessedIntroLines: [
    '«Bienvenido a los Reinos Condenados, mortal. Tu corazón late íntegro y sin fracturas en tu pecho.',
    'Si alguna vez la justicia carcelaria castiga tus desplantes con la Maldición del Corazón Roto (💔), acude a este altar y serás juzgado.»'
  ],
  blessingLines: [
    '«Que el código libre de fugas de memoria y la recursividad sin fin guíen tus pasos en la batalla contra AI Alex.»'
  ]
};

export const GUARD_GATEKEEPER_DIALOGUES = {
  boreas: {
    speaker: 'Guardia Boreas · Centinela de las Cumbres',
    questionLabel: '¿Qué peligros acechan en las Cumbres del Norte?',
    closeLabel: 'Entendido, guardia',
    dangerLines: [
      'Abismos que exigen el Dash Asíncrono, anomalías de bucle y el Guardián del Stack Overflow en las profundidades de la mina.',
      'Asegúrate de forjar tu Espada de Silicio antes de internarte en la caverna.'
    ],
    unlockedLines: [
      '¡Saludos, montañero! Tus registros están optimizados (Nivel 4+).',
      'Tienes autorización para adentrarte en Las Cumbres de la Recursión al norte. ¡No resbales en los abismos!'
    ],
    lockedLines: [
      '¡Detente! El paso norte a Las Cumbres de la Recursión está restringido.',
      'Una ventisca algorítmica de "Memory Freeze" azota la cordillera. Solo un programador de NIVEL 4 puede sobrevivir al frío del stack.'
    ]
  },
  vulcano: {
    speaker: 'Guardia Vulcano · Centinela de las Marismas',
    questionLabel: '¿Por qué hay cuarentena en el sector sur?',
    closeLabel: 'Entendido, volveré cuando esté listo',
    dangerLines: [
      'Las Marismas del Hardware Legacy albergan las Cloacas donde acecha el Garbage Collector Furioso y la Forja del Prototipo.',
      'El fango es corrosivo y las calderas de la Forja alcanzan temperaturas extremas.',
      'Necesitas el Blindaje Térmico de Brom para sobrevivir en el interior de la Forja.'
    ],
    unlockedLines: [
      '¡Paso autorizado, aprendiz! Cuentas con Nivel 3 y temple suficiente.',
      'El acceso sur hacia Las Marismas del Hardware Legacy está abierto. Desciende a las Cloacas y hazte con el Dash Asíncrono: lo necesitarás para cruzar los abismos de las Cumbres.'
    ],
    lockedLines: [
      '¡Zona bajo cuarentena militar! El paso sur hacia Las Marismas del Hardware Legacy está precintado.',
      'Las emanaciones tóxicas y el calor de la Forja desintegrarán tus circuitos si no posees al menos NIVEL 3.'
    ]
  },
  vael: {
    speaker: 'Comandante Vael · Paladín de la Frontera',
    questionLabel: '¿Qué amenaza acecha más allá de la frontera oeste?',
    closeLabel: 'Defenderé el Reino, Comandante',
    dangerLines: [
      'El Páramo Corrupto de Mister AI Alex. Drones de asalto, terreno electromagnético y la Gran Puerta del Núcleo Cuántico.',
      'Para franquear la Puerta Cuántica deberás haber derrotado a los 3 jefes de mazmorra y colocar sus Núcleos.',
      'Y para encarar a Alex en su Mainframe necesitarás alcanzar el Nivel 10.'
    ],
    unlockedLines: [
      '¡Honor a ti, paladín! Posees Nivel 8 y un poder recursivo legendario.',
      'La frontera oeste hacia el Páramo de Mister AI Alex está abierta para ti. ¡Haz morder el polvo a la IA corrupta!'
    ],
    lockedLines: [
      '¡Paso terminantemente vedado! Al oeste se extiende el Páramo de Mister AI Alex.',
      'Sus cortafuegos cuánticos desintegran en nanosegundos a cualquier mortal menor a NIVEL 8. No permitiré que perezcas en vano.'
    ]
  }
};

export const VILLAGE_NPC_PROFILES = {
  elder: {
    name: 'Sabio Aurelio · Cronista',
    jobTitle: 'Cronista y Archivero',
    homeSceneId: 'elder_house',
    x: 14 * 16,
    y: 10 * 16,
    speed: 24,
    sprite: CHARACTER_TYPES.ELDER,
    behavior: 'patrol',
    patrolPoints: [
      { x: 14 * 16, y: 10 * 16, dir: 'down', waitMin: 2.5, waitMax: 5.0, activityIcon: '📖' },
      { x: 16 * 16, y: 9 * 16, dir: 'up', waitMin: 3.0, waitMax: 5.5, activityIcon: '📖' },
      { x: 16 * 16, y: 13 * 16, dir: 'right', waitMin: 2.2, waitMax: 4.5 },
      { x: 13 * 16, y: 13 * 16, dir: 'down', waitMin: 2.0, waitMax: 4.0 },
      { x: 9 * 16, y: 8 * 16, dir: 'up', waitMin: 2.5, waitMax: 4.8 }
    ],
    ambientPhrases: [
      'El Ojete Dorado brilla en las crónicas...',
      'El microondas de AI Alex no debe sonar jamás...',
      'Qué paz se respira hoy en Valleverde.',
      'Debo anotar esto en el tomo IV...',
      '¿Habrá cruzado alguien el río hoy?'
    ]
  },
  oracle: {
    name: 'Oráculo Orion · Astrólogo IA',
    jobTitle: 'Astrólogo Algorítmico',
    homeSceneId: 'oracle_house',
    x: 18 * 16,
    y: 10 * 16,
    speed: 27,
    sprite: CHARACTER_TYPES.AI_ORACLE,
    behavior: 'patrol',
    patrolPoints: [
      { x: 18 * 16, y: 10 * 16, dir: 'down', waitMin: 2.8, waitMax: 5.2, activityIcon: '✦' },
      { x: 15 * 16, y: 8 * 16, dir: 'up', waitMin: 3.0, waitMax: 5.5, activityIcon: '✦' },
      { x: 20 * 16, y: 10 * 16, dir: 'right', waitMin: 2.4, waitMax: 4.6 },
      { x: 19 * 16, y: 13 * 16, dir: 'left', waitMin: 2.2, waitMax: 4.2 }
    ],
    ambientPhrases: [
      'Los astros auguran una gran aventura...',
      'Percibo la energía de El Ojete Dorado.',
      'Mis sensores astrales están al 100%.',
      'Qué cielo tan despejado sobre la aldea.'
    ]
  },
  blacksmith: {
    name: 'Herrero Brom · Forjador',
    jobTitle: 'Maestro Forjador y Hornero',
    homeSceneId: 'blacksmith_house',
    x: 25 * 16,
    y: 6 * 16,
    speed: 0,
    sprite: CHARACTER_TYPES.BLACKSMITH,
    behavior: 'static',
    initialDirection: 'right',
    patrolPoints: [
      { x: 25 * 16, y: 6 * 16, dir: 'right', waitMin: 4.0, waitMax: 8.0, activityIcon: '⚒' }
    ],
    ambientPhrases: [
      '¡Clang, clang! Buen acero en el yunque hoy.',
      'El horno de forja arde a pleno rendimiento.',
      'Un buen aventurero necesita buen equipo forjado.',
      '¡Golpea el silicio mientras esté candente!'
    ],
    greetingLines: [
      '¡Clang, clang! Soy Brom, el Maestro Forjador de Valleverde. Aquí en mi yunque exterior mejoro tu equipo y armas.'
    ]
  },
  herbalist: {
    name: 'Herbolaria Lyra · Alquimista',
    jobTitle: 'Botánica y Alquimista',
    homeSceneId: 'herbalist_house',
    x: 9 * 16,
    y: 17 * 16,
    speed: 0,
    sprite: CHARACTER_TYPES.HERBALIST,
    behavior: 'static',
    initialDirection: 'down',
    patrolPoints: [
      { x: 8 * 16, y: 17 * 16, dir: 'down', waitMin: 4.0, waitMax: 8.0, activityIcon: '✿' }
    ],
    ambientPhrases: [
      '♪ Creced fuertes, flores del alba ♪',
      'El huerto alquímico destila rocío purificador.',
      'Las Flores de Silicio nocturnas son la clave contra la corrupción.',
      'Esta infusión de hierbas silvestres quedará perfecta.'
    ]
  },
  kael: {
    name: 'Guardia Kael · Capitán del Binario',
    jobTitle: 'Capitán de los Guardias del Binario',
    homeSceneId: 'guard_house',
    x: 25 * 16,
    y: 11 * 16,
    speed: 30,
    sprite: CHARACTER_TYPES.GUARD,
    behavior: 'patrol',
    patrolPoints: [
      { x: 25 * 16, y: 11 * 16, dir: 'down', waitMin: 2.8, waitMax: 5.2 },
      { x: 26 * 16, y: 12 * 16, dir: 'right', waitMin: 3.0, waitMax: 5.5 },
      { x: 24 * 16, y: 13 * 16, dir: 'left', waitMin: 2.2, waitMax: 4.2 },
      { x: 22 * 16, y: 19 * 16, dir: 'up', waitMin: 2.4, waitMax: 4.5 }
    ],
    ambientPhrases: [
      '01010111... Valleverde protegido con cortafuegos y permisos 755.',
      'Los bugs de AI Alex no cruzan el río gracias a nuestra vigilancia.',
      'El puente permanece clausurado por orden del Gran Sabio Aurelio.',
      'Mantened el orden en Valleverde y no dejes memory leaks.'
    ]
  },
  bit: {
    name: 'Guardia Bit · Centinela',
    jobTitle: 'Guardia del Binario del Puente',
    homeSceneId: 'guard_house',
    x: 27 * 16,
    y: 12 * 16,
    speed: 24,
    sprite: CHARACTER_TYPES.GUARD,
    behavior: 'patrol',
    patrolPoints: [
      { x: 27 * 16, y: 11 * 16, dir: 'down', waitMin: 2.0, waitMax: 4.5 },
      { x: 27 * 16, y: 13 * 16, dir: 'up', waitMin: 2.0, waitMax: 4.5 }
    ],
    ambientPhrases: [
      '01000010... Vigilancia del cruce este.',
      'Al otro lado del puente esperan los 3 retos sagrados.',
      'El puente está cerrado por orden del Sabio Aurelio.',
      'El pueblo es zona segura gracias a los Guardias del Binario.'
    ]
  },
  byte: {
    name: 'Mercader Byte · Dependencias',
    jobTitle: 'Comerciante de Software y Suministros',
    homeSceneId: 'overworld',
    x: 19.5 * 16,
    y: 9.2 * 16,
    speed: 0,
    sprite: CHARACTER_TYPES.VILLAGER_RED,
    behavior: 'static',
    initialDirection: 'down',
    ambientPhrases: [
      '¡Vendo café compilado y parches hotfix en mi puesto!',
      'Dependencias limpias, sin vulnerabilidades en npm audit.',
      'Acepto monedas 🪙 para tus consumibles esenciales.',
      '¡Evita volverte un robot con mi Café Compilado!'
    ]
  },
  clara: {
    name: 'Clara · Panadería y Frutas',
    jobTitle: 'Tendera del Mercado de Alimentos',
    homeSceneId: 'overworld',
    x: 14.5 * 16,
    y: 9.2 * 16,
    speed: 0,
    sprite: CHARACTER_TYPES.VILLAGER_RED,
    behavior: 'static',
    initialDirection: 'down',
    ambientPhrases: [
      '¡Manzanas frescas traídas de los vergeles del río!',
      '¡Pan campesino recién horneado y tarta de bayas!',
      '¡Un buen aventurero nunca viaja con el estómago vacío!'
    ]
  },
  pip: {
    name: 'Pip · Aprendiz de Alquimia',
    jobTitle: 'Herbolario y Boticario del Mercado',
    homeSceneId: 'overworld',
    x: 14.5 * 16,
    y: 14.2 * 16,
    speed: 0,
    sprite: CHARACTER_TYPES.VILLAGER_BLUE,
    behavior: 'static',
    initialDirection: 'down',
    ambientPhrases: [
      '¡Pociones herbales recién destiladas!',
      '¡El ungüento antirrobo disuelve la robotización en un periquete!',
      'Maestra Lyra me enseñó a mezclar hierbas aromáticas sin explotar el alambique.'
    ]
  },
  finn: {
    name: 'Finn · Pescador del Río Alba',
    jobTitle: 'Pescador y Aguador del Mercado',
    homeSceneId: 'overworld',
    x: 19.5 * 16,
    y: 14.2 * 16,
    speed: 0,
    sprite: CHARACTER_TYPES.VILLAGER_GREEN,
    behavior: 'static',
    initialDirection: 'down',
    ambientPhrases: [
      '¡Truchas plateadas recién sacadas del río Alba!',
      '¡El agua del pozo central calma cualquier fatiga!',
      'Al otro lado del puente el río se vuelve misterioso y salvaje...'
    ]
  },
  jailer: {
    name: 'Carcelero Real',
    jobTitle: 'Vigilante del Calabozo',
    sceneId: 'jail_cell',
    x: 5.5 * 16,
    y: 6 * 16,
    interactionRange: 34,
    sprite: CHARACTER_TYPES.GUARD,
    behavior: 'static',
    initialDirection: 'up'
  },
  stage1_elder: {
    name: 'Sabio Aurelio · Guardián del Alba',
    jobTitle: 'Maestro de la Orden del Alba',
    sceneId: 'first_stage',
    x: 15 * 16,
    y: 18 * 16,
    speed: 22,
    sprite: CHARACTER_TYPES.ELDER,
    behavior: 'patrol',
    patrolPoints: [
      { x: 15 * 16, y: 18 * 16, dir: 'down', waitMin: 2.5, waitMax: 4.5, activityIcon: '✦' },
      { x: 18 * 16, y: 18 * 16, dir: 'left', waitMin: 2.5, waitMax: 4.5 }
    ],
    ambientPhrases: [
      'El Ojete Dorado es nuestra única esperanza...',
      'Mister AI Alex todo lo ve en las sombras...',
      'Sin tu armadura un solo golpe te abatirá.',
      'Busca el Bastión Oeste y el Altar Norte.'
    ]
  },
  supreme_god: {
    name: 'Dios Supremo de la Redención',
    jobTitle: 'Deidad Cósmica de los Reinos Condenados',
    sceneId: 'condemned_realms',
    x: 11.5 * 16,
    y: 3.8 * 16,
    interactionRange: 34,
    sprite: CHARACTER_TYPES.AI_ORACLE,
    behavior: 'static',
    initialDirection: 'down',
    ambientPhrases: [
      'La balanza del cosmos no tolera el desacato.',
      'Todo código fragmentado anhela ser purificado.',
      'La redención exige humildad y respeto.',
      'El Ojete Dorado aguarda al elegido.'
    ]
  },
  boreas: {
    name: 'Guardia Boreas · Centinela de las Cumbres',
    jobTitle: 'Centinela Septentrional',
    homeSceneId: 'overworld',
    x: 16 * 16,
    y: 2 * 16,
    speed: 24,
    sprite: CHARACTER_TYPES.GUARD,
    behavior: 'patrol',
    patrolPoints: [
      { x: 16 * 16, y: 2 * 16, dir: 'down', waitMin: 2.5, waitMax: 4.5 },
      { x: 19 * 16, y: 2 * 16, dir: 'left', waitMin: 2.5, waitMax: 4.5 }
    ],
    ambientPhrases: [
      'El viento del norte congela los bucles...',
      'Las Cumbres de la Recursión exigen agilidad y nivel.',
      'Cuidado con la caída en los abismos de silicio.'
    ]
  },
  vulcano: {
    name: 'Guardia Vulcano · Centinela de las Marismas',
    jobTitle: 'Centinela Meridional',
    homeSceneId: 'overworld',
    x: 16 * 16,
    y: 21 * 16,
    speed: 24,
    sprite: CHARACTER_TYPES.GUARD,
    behavior: 'patrol',
    patrolPoints: [
      { x: 16 * 16, y: 21 * 16, dir: 'up', waitMin: 2.5, waitMax: 4.5 },
      { x: 19 * 16, y: 21 * 16, dir: 'right', waitMin: 2.5, waitMax: 4.5 }
    ],
    ambientPhrases: [
      'El fango de las cloacas hierve con leaks de memoria...',
      'El calor de la Forja llega hasta este sector.',
      'Cuarentena militar activa en el paso sur.'
    ]
  },
  vael: {
    name: 'Comandante Vael · Paladín de la Frontera',
    jobTitle: 'Paladín y Custodio de la Frontera Occidental',
    homeSceneId: 'overworld',
    x: 3 * 16,
    y: 11 * 16,
    speed: 24,
    sprite: CHARACTER_TYPES.GUARD,
    behavior: 'patrol',
    patrolPoints: [
      { x: 3 * 16, y: 11 * 16, dir: 'down', waitMin: 2.5, waitMax: 4.5 },
      { x: 3 * 16, y: 14 * 16, dir: 'up', waitMin: 2.5, waitMax: 4.5 }
    ],
    ambientPhrases: [
      'Las anomalías de Alex se concentran al oeste...',
      'No cederemos la frontera de Valleverde.',
      'Solo los más veteranos pueden encarar el Páramo.'
    ]
  }
};

export const VILLAGE_DIALOGUES = {
  lifeRants: LIFE_RANT_DIALOGUES,
  oracle: ORACLE_DIALOGUES,
  elder: ELDER_DIALOGUES,
  lyra: LYRA_DIALOGUES,
  finn: FINN_DIALOGUES,
  kael: KAEL_DIALOGUES,
  bit: BIT_DIALOGUES,
  byte: MERCHANT_DIALOGUES,
  clara: CLARA_DIALOGUES,
  pip: PIP_DIALOGUES,
  jailer: JAILER_DIALOGUES,
  stage1Elder: STAGE1_ELDER_DIALOGUES,
  supremeGod: SUPREME_GOD_DIALOGUES,
  gatekeepers: GUARD_GATEKEEPER_DIALOGUES
};
