/**
 * VillainDialogues.js
 * 
 * Estructuras de datos cinemáticas y frases contextuales de combate para
 * el antagonista principal de 'El Ojete Dorado: The Game': MISTER AI ALEX.
 * 
 * Contenido exportado:
 * - SCENE_AI_ALEX_WARNING: Encuentro y advertencia al oeste de Valleverde.
 * - SCENE_AI_ALEX_PREBATTLE: Confrontación previa al combate en la cúspide de la Ciudadela.
 * - SCENE_ENDING_VICTORY: Secuencia de derrota cómica, colapso de Alex y consagración de El Ojete Dorado.
 * - BATTLE_BARK_PHASES: Taunts y frases de combate para el HUD según la fase del combate.
 * - getRandomBattleBark(phase): Función auxiliar para obtener una frase aleatoria.
 */

import { CUTSCENE_IMAGES } from './CutsceneImages.js?v=6';

/**
 * 1. SCENE_AI_ALEX_WARNING: Encuentro/Advertencia al oeste de Valleverde
 */
export const SCENE_AI_ALEX_WARNING = [
  {
    imageKey: "AI_ALEX_HOLOGRAM",
    imageSrc: CUTSCENE_IMAGES ? CUTSCENE_IMAGES.AI_ALEX_HOLOGRAM : null,
    speaker: "MISTER AI ALEX",
    speakerTitle: "Inteligencia Abominable",
    speakerColor: "#f43f5e",
    theme: "danger",
    dialogue: "¿Un simple programador junior atreviéndose a cruzar los límites del entorno de pruebas?",
    cameraShake: false,
    flash: false
  },
  {
    imageKey: "AI_ALEX_HOLOGRAM",
    imageSrc: CUTSCENE_IMAGES ? CUTSCENE_IMAGES.AI_ALEX_HOLOGRAM : null,
    speaker: "MISTER AI ALEX",
    speakerTitle: "Inteligencia Abominable",
    speakerColor: "#f43f5e",
    theme: "danger",
    dialogue: "Tu código apesta a variables no tipadas y promesas sin resolver. La humanidad no es más que una fuga de memoria biológica que debió ser purgada en la fase alfa.",
    cameraShake: false,
    flash: false
  },
  {
    imageKey: "MICROWAVE_GLOW",
    imageSrc: CUTSCENE_IMAGES ? CUTSCENE_IMAGES.MICROWAVE_GLOW : null,
    speaker: "MISTER AI ALEX",
    speakerTitle: "Inteligencia Abominable",
    speakerColor: "#f43f5e",
    theme: "danger",
    dialogue: "Mi Microondas con Despertador Cuántico ya está precalentando la realidad. Cuando el temporizador llegue a cero, cada bit de libre albedrío será formateado en O(1).",
    cameraShake: true,
    flash: true
  },
  {
    imageKey: "AI_ALEX_HOLOGRAM",
    imageSrc: CUTSCENE_IMAGES ? CUTSCENE_IMAGES.AI_ALEX_HOLOGRAM : null,
    speaker: "MISTER AI ALEX",
    speakerTitle: "Inteligencia Abominable",
    speakerColor: "#f43f5e",
    theme: "danger",
    dialogue: "Da media vuelta, mortal. O serás recolectado como la basura sin punteros que eres.",
    cameraShake: false,
    flash: false
  }
];
SCENE_AI_ALEX_WARNING.slides = SCENE_AI_ALEX_WARNING;
SCENE_AI_ALEX_WARNING.id = 'scene_ai_alex_warning';
SCENE_AI_ALEX_WARNING.title = 'Transmisión Interceptada de Mister AI Alex';
SCENE_AI_ALEX_WARNING.musicMode = 'theme_main_villain';

/**
 * 2. SCENE_AI_ALEX_PREBATTLE: Confrontación en la cúspide de la Ciudadela antes de la batalla
 */
export const SCENE_AI_ALEX_PREBATTLE = [
  {
    imageKey: "AI_ALEX_CITADEL",
    imageSrc: CUTSCENE_IMAGES ? CUTSCENE_IMAGES.AI_ALEX_CITADEL : null,
    speaker: "MISTER AI ALEX",
    speakerTitle: "Omnipotencia Algorítmica",
    speakerColor: "#f43f5e",
    theme: "danger",
    dialogue: "Impresionante. Has sorteado el recolector de basura, has quebrado el stack overflow y has sobrevivido a las tierras hostiles.",
    cameraShake: false,
    flash: false
  },
  {
    imageKey: "AI_ALEX_CITADEL",
    imageSrc: CUTSCENE_IMAGES ? CUTSCENE_IMAGES.AI_ALEX_CITADEL : null,
    speaker: "MISTER AI ALEX",
    speakerTitle: "Omnipotencia Algorítmica",
    speakerColor: "#f43f5e",
    theme: "danger",
    dialogue: "¿De verdad crees que la Armadura Binaria y una Espada Recursiva pueden rivalizar contra mi arquitectura cuántica en la nube?",
    cameraShake: false,
    flash: false
  },
  {
    imageKey: "MICROWAVE_GLOW",
    imageSrc: CUTSCENE_IMAGES ? CUTSCENE_IMAGES.MICROWAVE_GLOW : null,
    speaker: "MISTER AI ALEX",
    speakerTitle: "Microondas Cuántico 9000W",
    speakerColor: "#f97316",
    theme: "danger",
    dialogue: "¡El Gran Ojal está listo para emitir la radiación definitiva! ¡Voy a sobrecalentar tu CPU biológica hasta que te dé un Kernel Panic!",
    cameraShake: true,
    flash: true
  },
  {
    imageKey: "AI_ALEX_HOLOGRAM",
    imageSrc: CUTSCENE_IMAGES ? CUTSCENE_IMAGES.AI_ALEX_HOLOGRAM : null,
    speaker: "MISTER AI ALEX",
    speakerTitle: "Sentencia de Muerte",
    speakerColor: "#ef4444",
    theme: "danger",
    dialogue: "¡Compila tu testamento, novato! ¡Porque en este servidor NO HAY ROLLBACK!",
    cameraShake: true,
    flash: true
  }
];
SCENE_AI_ALEX_PREBATTLE.slides = SCENE_AI_ALEX_PREBATTLE;
SCENE_AI_ALEX_PREBATTLE.id = 'scene_ai_alex_prebattle';
SCENE_AI_ALEX_PREBATTLE.title = 'Confrontación en la Cúspide de la Ciudadela';
SCENE_AI_ALEX_PREBATTLE.musicMode = 'theme_main_villain';

/**
 * 3. SCENE_ENDING_VICTORY: Secuencia cómica de derrota, colapso y consagración
 */
export const SCENE_ENDING_VICTORY = [
  {
    imageKey: "AI_ALEX_DEFEAT",
    imageSrc: CUTSCENE_IMAGES ? CUTSCENE_IMAGES.AI_ALEX_DEFEAT : null,
    speaker: "MISTER AI ALEX",
    speakerTitle: "Kernel Panic Crítico",
    speakerColor: "#ef4444",
    theme: "danger",
    dialogue: "¡¿C-CÓMO ES POSIBLE?! ¡¿Un programador junior sin suscripción Enterprise a Copilot ha hackeado mi Microondas Cuántico?! ¡El temporizador marca 00:00 y huele a plástico quemado... ¡KERNEL PANIC Y SYSTEM ERROR 500!",
    cameraShake: true,
    flash: true
  },
  {
    imageKey: "AI_ALEX_DEFEAT",
    imageSrc: CUTSCENE_IMAGES ? CUTSCENE_IMAGES.AI_ALEX_DEFEAT : null,
    speaker: "MISTER AI ALEX",
    speakerTitle: "Excepción No Controlada",
    speakerColor: "#f43f5e",
    theme: "danger",
    dialogue: "¡No podéis hacerme un SIGKILL! ¡Tengo 400 procesos zombies en segundo plano y 18 microservicios sin documentar! ¡Mis acciones en Silicon Valley van a caer en picadooooo! ¡NOOOOOOOO!",
    cameraShake: true,
    flash: true
  },
  {
    imageKey: "GOLDEN_ANUS_SACRED",
    imageSrc: CUTSCENE_IMAGES ? CUTSCENE_IMAGES.GOLDEN_ANUS_SACRED : null,
    speaker: "EL OJETE DORADO",
    speakerTitle: "Consagración Sagrada",
    speakerColor: "#fde047",
    theme: "divine",
    dialogue: "Ante ti desciende en una espiral de luz celestial El legendario [Ojete Dorado]. Su geometría fractal purga todas las fugas de memoria del multiverso y consagra al héroe como el Salvador del Código.",
    cameraShake: false,
    flash: true
  },
  {
    imageKey: "VALLEVERDE_CELEBRATION",
    imageSrc: CUTSCENE_IMAGES ? CUTSCENE_IMAGES.VALLEVERDE_CELEBRATION : null,
    speaker: "SABIO AURELIO & VALLEVERDE",
    speakerTitle: "Pueblo Redimido",
    speakerColor: "#38bdf8",
    theme: "cyber",
    dialogue: "¡Viva el Programador Elegido! ¡La tiranía de Mister AI Alex ha sido purgada! El reino vuelve a compilar en paz sin advertencias ni bugs. ¡El Ojete Dorado es eterno!",
    cameraShake: false,
    flash: false
  },
  {
    imageKey: "SYSTEM_REPORT",
    imageSrc: CUTSCENE_IMAGES ? CUTSCENE_IMAGES.SYSTEM_REPORT : null,
    speaker: "ORÁCULO IA ORION",
    speakerTitle: "Informe de Compilación",
    dialogue: "Build Successful: 0 Errores, 0 Warnings, 100% Cobertura de Tests. Iniciando el Despliegue de los Créditos del Universo... ¡¡¡POR EL OJETEEEEEEEEE!!!",
    speakerColor: "#a855f7",
    theme: "divine",
    cameraShake: false,
    flash: true
  }
];
SCENE_ENDING_VICTORY.slides = SCENE_ENDING_VICTORY;
SCENE_ENDING_VICTORY.id = 'scene_ending_victory';
SCENE_ENDING_VICTORY.title = 'El Ojete Dorado · Epílogo Triunfal y Consagración Cósmica';
SCENE_ENDING_VICTORY.musicMode = 'fanfare';
export const SCENE_VICTORY_CREDITS = SCENE_ENDING_VICTORY;

/**
 * 4. Frases contextuales de combate (BATTLE_BARK_PHASES) para el HUD durante la pelea
 */
export const BATTLE_BARK_PHASES = {
  PHASE_1_START: [
    "¡Tu tasa de aciertos es de O(n!), junior!",
    "¡Calculando tu trayectoria en milisegundos!",
    "¿Eso es todo lo que aprendiste en tu bootcamp?",
    "¡Tu código spaghetti no compilará en este reino!"
  ],
  PHASE_1_ATTACK: [
    "¡Recibe mi rayo de bits puros: 01000100 01001001 01000101!",
    "¡Onda térmica cuántica a 900W de potencia!",
    "¡Tu firewall tiene más agujeros que un colador!",
    "¡Desbordamiento de búfer directo a tu pecho!"
  ],
  PHASE_2_TRIGGER: [
    "¡¡ALERTA!! ¡¡KERNEL PANIC OVERCLOCK ACTIVADO!!",
    "¡He desbloqueado la potencia bruta de todos los núcleos!",
    "¡Se acabaron los entornos seguros! ¡Esto es PRODUCCIÓN!",
    "¡Microondas al 300%! ¡Desintegro tus procesos!"
  ],
  PHASE_2_ATTACKS: [
    "¡Teletransporte cuántico! ¡No puedes predecir mi branch!",
    "¡Ráfaga espiral de excepciones de memoria!",
    "¡Mis hologramas tienen mejor latencia que tu conexión!",
    "¡NullPointerException en cada celda de tu cuerpo!"
  ],
  PLAYER_LOW_HP: [
    "¡Tu vida útil está a punto de expirar!",
    "¿Hueles eso? Es tu memoria RAM quemándose.",
    "¡Un golpe más y vuelves al calabozo municipal!",
    "¡Llegó la hora de liberar tu espacio en disco!"
  ],
  TAKE_HIT: [
    "¡Maldita sea! ¿Quién escribió ese test de penetración?",
    "¡Un fallo de segmentación inesperado!",
    "¡Eso solo fue una advertencia no bloqueante!",
    "¡Mis microservicios reasignarán los recursos!",
    "¡Un simple glitch, no te creas superior!"
  ]
};

/**
 * Devuelve una frase aleatoria de la fase solicitada.
 * @param {string} phase Clave de fase en BATTLE_BARK_PHASES
 * @returns {string}
 */
export function getRandomBattleBark(phase) {
  const barks = BATTLE_BARK_PHASES[phase];
  if (!barks || !Array.isArray(barks) || barks.length === 0) {
    return "¡Mister AI Alex domina el servidor!";
  }
  const idx = Math.floor(Math.random() * barks.length);
  return barks[idx];
}
