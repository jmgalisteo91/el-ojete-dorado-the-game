# ⚔️ El Ojete Dorado: The Game

> **Retro-Action RPG Metroidvania en JavaScript Vanilla (ES Modules) & Canvas 2D.**  
> Un homenaje técnico y cómico a los clásicos de 16-bits (*The Legend of Zelda*, *Secret of Mana*) aderezado con humor de desarrollo de software, depuración existencial, sintetizador chiptune nativo y una arquitectura de empaquetado monoarchivo ultraligera.

[![Versión](https://img.shields.io/badge/versión-v3.8.1-gold.svg)](#)
[![Licencia](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencias-0%20runtime-success.svg)](#)
[![Tests](https://img.shields.io/badge/tests-73%20passing-brightgreen.svg)](#)
[![Resolución](https://img.shields.io/badge/viewport-320%C3%97180%20px%20(16%3A9)-orange.svg)](#)

---

## 🕹️ Demo en Vivo & Despliegue

- **Versión Actual:** `v3.8.1` (Física Suave de NPCs anti-bloqueos, Deslizamiento en Esquinas y Bocadillos Anclados al Mundo).
- **Despliegue Web:** Preparado para despliegue directo en [Vercel](https://vercel.com) con funciones Serverless para Cloud Save y Leaderboard.
- **Build Portable Autónomo:** Ejecutable monoarchivo en [`el-ojete-dorado-the-game.html`](./el-ojete-dorado-the-game.html) (~1.2 MB, 100% offline, reproducible en cualquier navegador moderno sin servidor ni descargas adicionales).

---

## 🎮 Controles de Juego

El juego soporta control híbrido fluido mediante **Teclado** y **Ratón**:

| Acción | Teclado | Ratón |
|---|---|---|
| **Mover al Héroe** | `[W]` `[A]` `[S]` `[D]` o Flechas | — |
| **Tajo de Espada (Combo 3 Golpes)** | `[Espacio]` o `[F]` | `[Clic Izquierdo]` |
| **Ataque Cargado Giratorio** | Mantener `[Espacio]` / `[F]` (0.6s) | Mantener `[Clic Izquierdo]` |
| **Dash / Embestida Evasiva** | `[Shift]` o Doble toque direccional | `[Clic Derecho]` |
| **Bloqueo / Parry Escudo** | `[Q]` | — |
| **Interactuar / Hablar / Pescar** | `[E]` o `[Enter]` | Clic sobre indicador `[E]` |
| **Lanzar `console.log()` Aturdidor** | `[R]` (consume 1 Byte) | — |
| **Mapa del Reino (Estilo Zelda)** | `[M]` | Botón del HUD |
| **Diario de Misiones** | `[L]` | Botón del HUD |
| **Inventario (Rejilla 2×4)** | `[I]` | Botón del HUD |
| **Ficha de Personaje & Árbol de Skills**| `[C]` | Botón del HUD |
| **Menú de Pausa / Opciones** | `[Esc]` | Botón superior `[Pausa]` |
| **Overlay de Depuración (FPS / Hitboxes)** | `[F3]` | — |

---

## 📐 Arquitectura del Motor

El juego ha sido construido artesanalmente sin motores de terceros (Phaser, PixiJS, Godot) ni dependencias npm en cliente:

```
  [ InputHandler (Keys + Mouse) ] ──> [ GameLoop (Fixed dt = 1/60s) ]
                                             │
      ┌──────────────────────────────────────┴──────────────────────────────────────┐
      ▼                                      ▼                                      ▼
[ CollisionSystem & A* ]             [ Player & Entities ]                  [ Audio Engine ]
(Spatial Grid + Hitboxes)             (State Machine + FSM)             (AudioManager: 3 Buses)
      │                                      │                                      │
      └──────────────────────────────────────┬──────────────────────────────────────┘
                                             ▼
                             [ RenderPipeline 2.5D (HD-2D) ]
                        Capa 0: Suelo y Decals de Suelo
                        Sombras: Elipses proyectadas por reloj solar
                        Capa 1: Y-Sorted (Props + Entidades móviles)
                        Capa 2: Estructuras elevadas (Tejados/Copas)
                        Capa 3: Iluminación dinámica (Multiply) + Niebla
                        Capa 4: WORLD_HUD_OVERLAY (Bocadillos y Prompts [E])
                                             ▼
                                  [ Canvas 2D 320×180 px ]
```

### 1. Viewport Nativo y Escalado Pixel-Perfect
- Canvas interno estricto de **320 × 180 px** (relación panorámica 16:9).
- Reescalado automático por entero a pantalla completa con `image-rendering: pixelated` para mantener el pixel art nítido a 60 FPS estables.

### 2. Pipeline Gráfico 2.5D (`RenderPipeline.js`)
- **Y-Sorting Dinámico:** Cada prop y entidad móvil (jugador, NPCs, animales, enemigos y monolitos) se ordena por `y + height` en cada fotograma.
- **Sombras Proyectadas:** Elipses traslúcidas que varían su longitud y ángulo dinámicamente según la posición del sol calculada en [`DayNightCycle.js`](./src/world/DayNightCycle.js).
- **Capa `WORLD_HUD_OVERLAY`:** Se dibuja por encima de estructuras altas y máscaras de noche para asegurar que bocadillos de NPCs y avisos `[E]` permanezcan siempre brillantes y 100% legibles.

### 3. Motor de Audio Polifónico Chiptune (`AudioManager.js` & `AmbientMusic.js`)
- **Arquitectura de 3 Buses de Ganancia:**
  ```text
  [musicGainNode] ──┐
                    ├──> [masterGainNode] ──> [AudioContext.destination]
  [sfxGainNode]   ──┘
  ```
- **Secuenciador Nativo de 4 Canales:**
  - **Canal 1 (Melodía):** Onda cuadrada (`square`) con envolvente ADSR suave.
  - **Canal 2 (Armonía / Contrapunto):** Onda triangular (`triangle`) para acordes envolventes.
  - **Canal 3 (Bajo):** Onda triangular profunda filtrada con filtro paso bajo a 420 Hz.
  - **Canal 4 (Percusión):** Bombo con pitch drop y caja/charles sintetizados con buffer procedural de ruido blanco.
- **Crossfade Fluido de 1.5s:** Transición suave de pistas musicales al cruzar de zona o entrar a mazmorras.
- **Calibrador y Submenú de Sonido:** Ajuste en tiempo real de volumen Master, Música y SFX mediante flechas/ratón con pitido de prueba (`playTestBeep()`) y persistencia en `localStorage` (`ojete_audio_settings`).

### 4. Persistencia Cloud-First con Fallback Síncrono (`CloudStorage.js`)
- **Latencia Cero:** Escritura síncrona inmediata en `localStorage` (`ojete_savegame_v3`).
- **Sincronización Serverless:** Conexión en segundo plano con endpoints Vercel (`/api/save` y `/api/leaderboard`) respaldados por **Vercel KV (Redis)**.
- **Tolerancia a Fallos:** Dirty flags automáticos (`pendingCloudSync`) que suben los progresos pendientes tan pronto se restablece la conexión de red.

---

## 🗺️ Geografía Metroidvania (Estructura Cardinal)

El mundo se organiza como un Metroidvania abierto con la aldea pacífica de **Valleverde** como epicentro seguro (sin monstruos ni jefes invasores):

```text
                          [ NORTE: Cumbres de la Recursión ]
                                (Nivel 4 · Guardia Boreas)
                                            │
                                            │
 [ OESTE: Páramo de Mister Alex ] ──── [ VALLEVERDE ] ──── [ ESTE: Valle Consagración ]
   (Nivel 8 · Comandante Vael)        (Epicentro / Hub)       (Nivel 2 · Guardia Kael)
                │                           │
                ▼                           │
     [ CIUDADELA CUÁNTICA ]                 │
   (Nivel 10 + 3 Núcleos Bosses)            │
                                            ▼
                          [ SUR: Marismas del Hardware Legacy ]
                               (Nivel 6 · Guardia Vulcano)
```

### Regiones y Mazmorras Escalonadas

| Punto Cardinal | Región / Escena | Nivel | Centinela Custodio | Mazmorras y Contenido Clave |
|---|---|---|---|---|
| **Centro** | `overworld` (Valleverde) | 1 | Guardia Bit / Aldeanos | Aldea pacífica, Herrería de Brom, Almacén de Byte, Casa de Clara, Descanso en Cama. |
| **Este** | `first_stage` (Valle Consagración) | **2** | Guardia Kael | **Templo de la Armadura** (Puzle de paridad A/B/C/D)<br>**Templo de la Espada** (Secuencia recursiva $\lambda$). |
| **Norte** | `north_plateau` / `mines_entry` | **4** | Guardia Boreas | **Minas de la Recursión** (`mines_dungeon`): Caverna de silicio con abismos que exigen Dash. Custodia al *Stack Overflow Boss*. |
| **Sur** | `south_swamp` / `sewers_entry` | **6** | Guardia Vulcano | **Cloacas del Legacy** (`sewers_dungeon`): Tuberías de fango verde y fugas de memoria. Custodia al *Garbage Collector Boss*. |
| **Oeste** | `west_wasteland` / `forge_entry` | **8** | Comandante Vael | **La Forja del Prototipo** (`forge_dungeon`): Salas de calor extremo. Custodia al *Microondas Prototipo Boss*. |
| **Zona Final**| `quantum_gate` / `ai_citadel` | **10** | Centinela del Núcleo | **La Ciudadela Cuántica de Mister AI Alex**: Tileset exclusivo de Mainframe y Servidores. Requiere los 3 Núcleos de Energía. |

---

## ⚔️ Progresión, Forja y Combate

### 1. Sistema de Niveles y Experiencia (Nivel 1 al 10)
- Derrotar enemigos otorga Bytes y EXP.
- Subir de nivel incrementa la vida máxima, la estamina y la capacidad de absorber impactos.
- Los Centinelas de la guardia real custodian las entradas a cada región cardinal y explican con *lore* las amenazas de cada zona antes de permitir el paso al alcanzar el nivel requerido.

### 2. Forja del Herrero Brom
El herrero Brom en Valleverde forja y actualiza tu equipo utilizando Bytes y materiales recolectados:
- **Espada de la Recursividad:**
  - *Nivel 1 (Base):* Espada de hierro estándar (1.0× daño).
  - *Nivel 2 (Espada de Silicio):* +50% de daño (1.5×) y capacidad de romper barreras de cristal en las Minas (requiere 100 Bytes + 1 Silicio).
  - *Nivel 3 (Espada Overclockeada):* +100% de daño (2.0×) y disparo de ondas de choque de plasma si la salud está al 100% (requiere 150 Bytes + Magnetrón).
- **Armadura Binaria:**
  - *Nivel 1 (Base):* Escudo de 3 impactos blindados que absorbe daño antes de tocar los corazones.
  - *Nivel 2 (Blindaje Térmico):* Inmunidad total al daño ambiental por calor en las salas de calderas de la Forja (requiere 75 Bytes + 2 Chatarra).

### 3. Mecánica de Robotización
- El uso excesivo de implantes cibernéticos incrementa la robotización del protagonista:
  - $\mathbf{> 50\%}$: El daño de la espada disminuye un 30% por rigidez motora.
  - $\mathbf{> 80\%}$: Un corazón de salud queda bloqueado por sobretensión en los circuitos.
- El Sabio Aurelio y los brebajes desfragmentadores permiten purgar la robotización y recuperar la humanidad.

---

## 👾 Los Grandes Jefes de la Amenaza Tecnológica

1. **Garbage Collector Boss (Nivel 6 · Cloacas del Legacy):**
   - Invoca hilos recolectores de basura, barre la arena con escobas de memoria no utilizada y lanza proyectiles de desbordamiento.
2. **Stack Overflow Boss (Nivel 8 · Minas de la Recursión):**
   - Salta sobre el jugador mediante recursión descontrolada, divide sus llamadas en clones subordinados y colapsa la arena con llamadas anidadas.
3. **Prototype Microwave Boss (Nivel 9 · La Forja del Prototipo):**
   - Dispara microondas de calor radiante en $O(1)$, hace sonar una alarma aturdidora a las 00:00 y expulsa vapor letal en tres fases.
4. **Mister AI Alex (Nivel 10 · Ciudadela Cuántica):**
   - La inteligencia artificial suprema. Dispara haces cuánticos matriciales, teletransporta terminales de defensa y requiere que el héroe utilice todas sus habilidades aprendidas.

---

## 🏆 Salón de la Fama y Sistema de Puntuación

Al completar el juego, [`ScoreSystem.js`](./src/core/ScoreSystem.js) calcula la puntuación final considerando tiempo de juego, muertes, nivel alcanzado y misiones cumplidas:
- **Rango S (Gran Maestro del Silicio):** Menos de 12 minutos y 0 muertes.
- **Rango A (Arquitecto Senior):** Menos de 20 minutos y $\le 2$ muertes.
- **Rango B (Programador Junior):** Completar la historia principal.
- **Rango C (Depurador Novato):** Final estándar.

Las mejores puntuaciones se registran en el Salón de la Fama local y se envían a la tabla global serverless en Vercel KV con validación anti-trampas en el servidor.

---

## 🛠️ Instalación y Desarrollo Local

### Requisitos Previos
- [Node.js](https://nodejs.org) (v18 o superior).
- Cualquier navegador web moderno con soporte para Canvas 2D y Web Audio API.

### 1. Clonar el Repositorio
```bash
git clone https://github.com/tu-usuario/el-ojete-dorado-the-game.git
cd "El ojete dorado - the game"
```

### 2. Ejecutar Servidor Local
Dado que el proyecto utiliza ES Modules nativos (`import`/`export`), debe servirse mediante un servidor HTTP local:
```bash
# Opción A: Python
python3 server.py
# (Abre http://localhost:8000 en tu navegador)

# Opción B: npx serve / live-server
npx serve .
```

### 3. Ejecutar la Suite de Pruebas Automatizadas
Batería completa de 69 pruebas unitarias y de integración sin necesidad de emulador de DOM:
```bash
node tests/regression.mjs
# o mediante npm:
npm test
```

### 4. Compilar el Bundle Monoarchivo Portable
Para generar la versión portable autónoma lista para jugar sin servidor local ni internet:
```bash
npm run build:portable
# o bien:
node build-portable.mjs
```
Esto genera [`el-ojete-dorado-the-game.html`](./el-ojete-dorado-the-game.html) (~1.2 MB), con todos los módulos, estilos CSS, favicon y sintetizadores incrustados en un único archivo.

---

## 📁 Estructura del Proyecto

```text
├── api/                        # Funciones Serverless (Vercel KV / Redis)
│   ├── leaderboard.js          # Récords globales y anti-trampas
│   └── save.js                 # Guardado y carga en la nube
├── src/
│   ├── ai/                     # Algoritmos de IA (A* Pathfinding, FSM de enemigos)
│   ├── assets/                 # Guiones narrativos y cinemáticas Pixel Art
│   ├── audio/                  # Motor de audio Web Audio API
│   │   ├── AudioManager.js     # Secuenciador chiptune 4 canales, 3 buses y sliders
│   │   └── AmbientMusic.js     # Módulo de compatibilidad y temas ambientales
│   ├── core/                   # Bucle de juego, Input, Gatekeeper, Logros y Scores
│   ├── entities/               # Jugador, NPCs, Animales, Enemigos y Jefes
│   │   └── bosses/             # Garbage Collector, Stack Overflow, Microwave, Alex
│   ├── graphics/               # RenderPipeline 2.5D, Sprites y Animaciones
│   ├── physics/                # Sistema de colisiones por cajas AABB y grid
│   ├── services/               # Persistencia híbrida (CloudStorage con Vercel KV)
│   ├── ui/                     # Menú de Pausa, Mapa Zelda, Diálogos, Inventario
│   └── world/                  # Tilemap procedural, Mazmorras y Ciclo Día/Noche
├── tests/
│   └── regression.mjs          # Arnés de pruebas automatizadas (69 tests)
├── build-portable.mjs          # Compilador monoarchivo HTML
├── ESTADO_DEL_JUEGO.md         # Documento vivo de arquitectura y backlog
├── package.json
└── README.md
```

---

## 📜 Licencia

Distribuido bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más detalles.

*¡Que el resplandor sagrado de El Ojete Dorado guíe tu código en O(1)!*
