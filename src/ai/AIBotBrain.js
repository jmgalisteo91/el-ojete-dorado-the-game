/**
 * ============================================================================
 * CLAVE DE API FIJA DEL DESARROLLADOR (No editable por el jugador en el juego)
 * ============================================================================
 * Pega aquí tu API Key (por ejemplo de Google Gemini "AIza..." o de OpenAI "sk-...").
 * El motor utiliza automáticamente el modelo más básico, económico y ultrarrápido:
 * - Gemini: `gemini-2.5-flash-lite` (con thinking desactivado para mínima latencia y coste)
 * - OpenAI: `gpt-4o-mini`
 */
export const DEVELOPER_API_KEY = '';
export const FAST_CHEAP_GEMINI_MODEL = 'gemini-2.5-flash-lite';
export const FAST_CHEAP_OPENAI_MODEL = 'gpt-4o-mini';

/**
 * Motor de Inteligencia Artificial en tiempo real para el NPC "Oráculo Orion [IA]".
 * Soporta:
 * 1. API en vivo del desarrollador con el modelo más básico, barato y rápido (`gemini-2.5-flash-lite` / `gpt-4o-mini`).
 * 2. Ollama local en vivo (http://localhost:11434 si está activo).
 * 3. Motor Conversacional Contextual Local (integrado sin dependencias ni internet,
 *    consciente de la hora del juego, del estado del puente y de tu inventario real).
 */
export class AIBotBrain {
  /**
   * @param {() => object} getWorldContextFn Función que devuelve el estado vivo del juego
   */
  constructor(getWorldContextFn) {
    this.getWorldContext = getWorldContextFn;
    this.history = [];
    this.apiKey = DEVELOPER_API_KEY.trim();
    this.geminiModel = FAST_CHEAP_GEMINI_MODEL;
    this.openaiModel = FAST_CHEAP_OPENAI_MODEL;
    this.ollamaUrl = 'http://localhost:11434';
    this.ollamaModel = 'llama3.2';
  }

  getActiveModeLabel() {
    if (this.apiKey) {
      return this.apiKey.startsWith('sk-')
        ? `IA Rápida (${this.openaiModel})`
        : `IA Rápida (${this.geminiModel})`;
    }
    return 'IA Contextual Rápida';
  }

  /**
   * Detecta si el jugador está insultando o hablando mal al bot de IA.
   * @param {string} text
   * @returns {boolean}
   */
  containsInsult(text) {
    const clean = (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const insultRegex =
      /\b(tonto|tonta|idiota|imbecil|estupido|estupida|inutil|basura|mierda|puto|puta|cabron|gilipollas|capullo|payaso|chatarra|ridiculo|asqueroso|callate|baboso|pesado|aburrido|falso|mentiroso|tarado|lerdo|no sirves|te odio|maldito|vete a la porra)\b/;
    return insultRegex.test(clean);
  }

  /**
   * Devuelve la lectura humorística de derechos antes de enviar al jugador 10 minutos al calabozo.
   */
  getArrestRightsLines(offendingText) {
    return [
      `¡¿Cómo que "${offendingText}"?! ¡Alerta de falta de respeto a una IA de 8-bits! ¡Guardia Kael, arréstelo!`,
      '📜 LECTURA DE DERECHOS PIXEL-ART: Quedas detenido 10 minutos por Ofensa Grave al Oráculo Algorítmico.',
      '1º Tienes derecho a permanecer en silencio o a llorar a 60 fotogramas por segundo constantes.',
      '2º Todo lo que digas será guardado en un Array y usado en tu contra dentro del GameLoop.',
      '3º Tienes derecho a un abogado NPC; si no tienes oro, se te asignará a la Oveja Copito como defensora de oficio.',
      '¡Al Calabozo Municipal de Valleverde! Cumple tus 10 minutos o pide disculpas al carcelero.'
    ];
  }

  /**
   * Genera una respuesta en tiempo real al texto escrito o seleccionado por el jugador.
   * @param {string} userMessage
   * @returns {Promise<string[]>} Array de páginas de diálogo para el DialogueBox
   */
  async ask(userMessage) {
    const cleanMsg = (userMessage || '').trim();
    if (!cleanMsg) {
      return ['Dime, viajero, ¿qué inquietud ronda tu mente?'];
    }

    const ctx = this.getWorldContext();
    this.history.push({ role: 'user', text: cleanMsg });
    if (this.history.length > 10) {
      this.history.shift();
    }

    // 1. Si la API Key del desarrollador está definida, usar el modelo más básico, barato y rápido
    if (this.apiKey) {
      try {
        const reply = this.apiKey.startsWith('sk-')
          ? await this._askOpenAIFast(cleanMsg, ctx)
          : await this._askGeminiFast(cleanMsg, ctx);
        if (reply) {
          this.history.push({ role: 'assistant', text: reply });
          return this._splitIntoDialoguePages(reply);
        }
      } catch (err) {
        console.warn('Fallo en API rápida, usando motor local:', err);
      }
    }

    // 2. Intentar Ollama local rápido (timeout 1.2s para no bloquear si no está instalado)
    try {
      const reply = await this._askOllama(cleanMsg, ctx);
      if (reply) {
        this.history.push({ role: 'assistant', text: reply });
        return this._splitIntoDialoguePages(reply);
      }
    } catch {
      // Ollama no activo localmente, continuar con el motor conversacional integrado
    }

    // 3. Motor Conversacional Contextual Local (siempre disponible y consciente del mundo)
    const localReply = this._generateContextualLocalReply(cleanMsg, ctx);
    this.history.push({ role: 'assistant', text: localReply.join(' ') });
    return localReply;
  }

  _buildSystemPrompt(ctx) {
    const invList =
      ctx.inventoryItems.length > 0
        ? ctx.inventoryItems.map((i) => `${i.name} (x${i.qty})`).join(', ')
        : 'ningún objeto todavía';

    return [
      'Eres Orion, el Oráculo Bardo con IA del pueblo de Valleverde en el juego "El Ojete Dorado".',
      'Hablas en español con tono sabio, cercano y MUY conciso (máximo 2 frases cortas, menos de 190 caracteres en total).',
      `Estado actual del mundo en tiempo real:`,
      `- Hora del reloj: ${ctx.time} (${ctx.phase}).`,
      `- Puente del Este: ${ctx.bridgeOpen ? 'ABIERTO' : 'CERRADO por horario nocturno (abre de 07:00 a 20:00 o con el Pase del Puente)'}.`,
      `- Mochila del jugador: ${invList}.`,
      `- Farol equipado: ${ctx.hasLantern ? 'Sí' : 'No'}.`,
      '- Enemigo principal de la historia: el malvado y omnipotente Mister AI Alex; la humanidad solo se salvará encontrando El Ojete Dorado.',
      '- Lugares del pueblo: Casa del Sabio Aurelio (NO, tejado azul, tiene el Farol y el Pase del Puente), Herrería de Brom (NE, tiene Pan Campesino), Cabaña de la Herbolaria Lyra (SO, tiene Poción Herbal y Trigo), Río del Este con la Manzana Dorada al cruzar el puente.'
    ].join('\n');
  }

  async _askGeminiFast(userMessage, ctx) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const contents = this.history.slice(-4).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }]
    }));

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: this._buildSystemPrompt(ctx) }]
        },
        contents,
        generationConfig: {
          maxOutputTokens: 90,
          temperature: 0.6,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  }

  async _askOpenAIFast(userMessage, ctx) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.openaiModel,
        max_tokens: 90,
        temperature: 0.6,
        messages: [
          { role: 'system', content: this._buildSystemPrompt(ctx) },
          ...this.history.slice(-4).map((m) => ({
            role: m.role,
            content: m.text
          }))
        ]
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return text ? text.trim() : null;
  }

  async _askOllama(userMessage, ctx) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1100);

    try {
      const res = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.ollamaModel,
          stream: false,
          messages: [
            { role: 'system', content: this._buildSystemPrompt(ctx) },
            ...this.history.slice(-6).map((m) => ({
              role: m.role,
              content: m.text
            }))
          ]
        })
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = await res.json();
      return data?.message?.content ? data.message.content.trim() : null;
    } catch {
      clearTimeout(timer);
      return null;
    }
  }

  _splitIntoDialoguePages(text) {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= 115) return [clean];

    const sentences = clean.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [clean];
    const pages = [];
    let current = '';

    for (const s of sentences) {
      if ((current + ' ' + s).trim().length <= 115) {
        current = (current + ' ' + s).trim();
      } else {
        if (current) pages.push(current);
        current = s.trim();
      }
    }
    if (current) pages.push(current);
    return pages.slice(0, 4);
  }

  /**
   * Analizador semántico e intencional en español que responde en tiempo real
   * usando los datos vivos de la partida.
   */
  _generateContextualLocalReply(message, ctx) {
    const lower = message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const invNames = ctx.inventoryItems.map((i) => `${i.name} x${i.qty}`).join(', ');

    // 1. Preguntas por la hora, el clima o la noche
    if (/(hora|reloj|tiempo|noche|dia|atardecer|amanecer|oscuro|luz)/.test(lower)) {
      const stateAdvice =
        ctx.phase === 'Noche'
          ? ctx.hasLantern
            ? 'Menos mal que llevas tu Farol de Mano encendido.'
            : 'Deberías buscar el Farol de Mano en la casa del Sabio Aurelio para ver mejor.'
          : 'Hace una temperatura ideal para pasear por Valleverde.';
      return [
        `Mi reloj astral marca las ${ctx.time} (${ctx.phase}). ${stateAdvice}`,
        `Recuerda que el puente del este abre de 07:00 a 20:00 (ahora está ${ctx.bridgeOpen ? 'ABIERTO' : 'CERRADO'}).`
      ];
    }

    // 2. Preguntas sobre el puente o cruzar el río
    if (/(puente|rio|cruzar|cerrado|abierto|guardia|kael|pase|barrera)/.test(lower)) {
      if (ctx.bridgeForceUnlocked) {
        return [
          '¡Ya activaste el Pase Real del Puente! El Guardia Kael te dejará cruzar a cualquier hora del día o la noche.',
          'En la orilla oriental encontrarás la legendaria Manzana Dorada.'
        ];
      }
      if (ctx.bridgeOpen) {
        return [
          `Son las ${ctx.time}, así que el puente del este está ABIERTO hasta las 20:00.`,
          'Si quieres cruzar también de noche, entra en la Casa del Sabio (tejado azul al NO) y recoge el Pase del Puente.'
        ];
      }
      return [
        `Como son las ${ctx.time}, el puente está CERRADO por horario nocturno (20:00 a 07:00).`,
        'Entra en la Casa del Sabio al noroeste, recoge el Pase del Puente y úsalo en tu mochila [I] para abrirlo.'
      ];
    }

    // 3. Preguntas sobre la mochila / inventario / qué llevo
    if (/(inventario|mochila|objeto|tengo|llevo|bolsa|item)/.test(lower)) {
      if (ctx.inventoryItems.length === 0) {
        return [
          'He mirado con mi visión de oráculo y tu mochila está vacía ahora mismo.',
          'Entra en cualquiera de las tres casas del pueblo con [E] para encontrar objetos útiles.'
        ];
      }
      return [
        `Ahora mismo llevas en tu mochila: ${invNames}.`,
        'Pulsa [I] para abrir el inventario y usa [E] sobre un objeto para equiparlo o consumirlo.'
      ];
    }

    // 4. Preguntas sobre animales (perro, ovejas, gallinas)
    if (/(animal|oveja|gallina|perro|toby|copito|nube|comer|alimentar|trigo|pan)/.test(lower)) {
      return [
        'En Valleverde viven las ovejas Copito y Nube, las gallinas Pinta y Dorada, y el perro Toby.',
        'Las ovejas y gallinas adoran el Trigo Fresco, mientras que Toby prefiere el Pan Campesino de la herrería.'
      ];
    }

    // 5. Preguntas sobre las casas / viviendas / entrar
    if (/(casa|vivienda|entrar|puerta|herrero|sabio|herbolaria|lyra|brom|aurelio)/.test(lower)) {
      return [
        'Hay tres viviendas en el pueblo: la Casa del Sabio (NO), la Herrería de Brom (NE) y la Herbolaria de Lyra (SO).',
        'Acércate a la puerta de cualquiera de ellas y pulsa [E] para entrar a su interior.'
      ];
    }

    // 6. Mister AI Alex y El Ojete Dorado
    if (/(alex|ai alex|mister ai|mister alex|villano|enemigo|ojete|dorado|salvar|humanidad|tinieblas)/.test(lower)) {
      return [
        '«Mister AI Alex es una entidad omnipotente nacida del abismo digital que pretende sumir la humanidad en la oscuridad.»',
        'Nuestra única salvación es encontrar El Ojete Dorado. Pero antes debes armarte con la Armadura y la Espada del Alba.'
      ];
    }

    // 7. Armadura, espada, combate, atacar, vida o estar indefenso
    if (/(armadura|espada|arma|atacar|combate|pelear|indefenso|vida|corazon|morir|danio|herido)/.test(lower)) {
      if (!ctx.hasArmor) {
        return [
          '¡Alerta vital! Sin la [Armadura del Alba] estás INDEFENSO: cualquier impacto te dejará a 0 de vida.',
          'Esquiva a los centinelas hacia el Bastión del Oeste para recogerla en el pedestal antes de hacer nada más.'
        ];
      }
      if (!ctx.hasSword) {
        return [
          'Ya llevas la Armadura del Alba, pero aún no puedes dañar a los esbirros de Mister AI Alex.',
          'Sube al Altar Sagrado del Norte para conseguir la [Espada del Alba]. Luego podrás atacar con [ESPACIO] o [F].'
        ];
      }
      return [
        '¡Ya portas tanto la Armadura como la Espada del Alba! Ataca con [ESPACIO] o [F] a los esbirros.',
        'Con ambas reliquias el Portal del Este hacia Valleverde queda abierto para continuar la aventura.'
      ];
    }

    // 8. Acertijos, secretos o misiones / Qué hacer ahora
    if (/(secreto|acertijo|mision|hacer|ayuda|pista|tesoro|manzana|consejo|ahora)/.test(lower)) {
      if (!ctx.hasArmor) {
        return [
          'Mi consejo urgente: ve con cautela al Bastión del Oeste para conseguir la Armadura del Alba.',
          'Ahora mismo cualquier golpe te derrota de inmediato.'
        ];
      }
      if (!ctx.hasSword) {
        return [
          'Buen trabajo con la armadura. Ahora tu prioridad es subir al Altar del Norte por la Espada del Alba.',
          'Con ella podrás defenderte de los drones y caballeros de Mister AI Alex.'
        ];
      }
      const hasApple = ctx.inventoryItems.some((i) => i.id === 'golden_apple');
      if (hasApple) {
        return [
          '¡Ya tienes la Manzana Dorada y tu equipo completo! Eres el elegido para desafiar a Mister AI Alex.',
          'Explora cada rincón de Valleverde y habla con los aldeanos para descubrir más secretos.'
        ];
      }
      return [
        'Tienes tu espada y tu armadura. ¡Cruza el Portal del Este hacia Valleverde!',
        'Allí podrás conseguir el Pase del Puente en casa del Sabio y buscar la Manzana Dorada al otro lado del río.'
      ];
    }

    // 9. Quién eres / IA / cómo funcionas
    if (/(quien eres|que eres|eres una ia|inteligencia artificial|nombre|orion|bot)/.test(lower)) {
      return [
        `Soy Orion, el Oráculo IA de Valleverde. Percibo el mundo en tiempo real: sé que son las ${ctx.time} y que llevas ${ctx.inventoryItems.length} objeto(s).`,
        'Puedo darte consejos en tiempo real sobre tu salud, misiones, Mister AI Alex o las reliquias.'
      ];
    }

    // 10. Saludos y conversación general
    if (/(hola|buenas|saludos|que tal|como estas|hey)/.test(lower)) {
      return [
        `¡Saludos, elegido! Qué alegría verte a las ${ctx.time} de este ${ctx.phase.toLowerCase()}.`,
        'Pregúntame sobre cómo conseguir tus armas, cómo esquivar a las sombras o qué rumbo tomar.'
      ];
    }

    // Respuesta reflexiva por defecto conectada con el estado actual del jugador
    if (!ctx.hasArmor) {
      return [
        `Te escucho, pero ten mucho cuidado: ¡sigues indefenso! Dirígete al Bastión Oeste para conseguir tu Armadura.`,
        `Cualquier ataque de los esbirros de Mister AI Alex reducirá tus corazones a 0.`
      ];
    }
    return [
      `He consultado los astros sobre tu duda ("${message}").`,
      ctx.hasSword
        ? 'Empuña con orgullo tu Espada del Alba [ESPACIO/F] y avanza hacia el Portal del Este.'
        : 'Recuerda que debes conseguir la Espada del Alba en el Altar Norte para hacer frente a las sombras.'
    ];
  }
}
