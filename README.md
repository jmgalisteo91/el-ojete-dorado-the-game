# 🍑 El Ojete Dorado: The Game

> *"Un RPG de acción 2D donde el universo es código legacy, los CEOs son villanos y las ovejas tienen un Dios vengador."*

![Estado](https://img.shields.io/badge/Estado-Expansi%C3%B3n%20en%20desarrollo-brightgreen)
![Tech](https://img.shields.io/badge/Stack-JavaScript%20Vanilla-yellow)
![Motor](https://img.shields.io/badge/Motor-Canvas%202D%20%2B%20Web%20Audio-blue)
![AI Orchestration](https://img.shields.io/badge/Desarrollo-AI%20Assisted-purple)

## 📖 Descripción General

**El Ojete Dorado** es un RPG de acción y aventura desarrollado íntegramente en **JavaScript Vanilla** (sin frameworks ni motores externos como Unity o Godot). Combina la estética del pixel art clásico (16-bit) con técnicas modernas de renderizado 2.5D, iluminación dinámica y un sistema de audio híbrido.

El proyecto nació como un reto personal de **Game Direction** y **AI Orchestration**: liderar a modelos de lenguaje avanzados (Gemini, DeepSeek) para construir desde cero un motor de juego completo, un sistema de combate con *juice*, y una narrativa con múltiples finales.

## 🎮 Características Principales

### ⚔️ Combate y Game Feel
*   **Sistema de Parry y Dash:** Combate táctico que castiga el *spam* de botones.
*   **Hitstop, Screen Shake y Partículas:** Feedback visual y sonoro en cada impacto.
*   **Armas y Equipamiento:** Desde puños y espadas básicas hasta armas legendarias (como el Destructor del Destino).
*   **Progresión RPG:** Sistema de niveles (1-15 en la expansión), habilidades activas y pasivas.

### 🗺️ Mundo y Narrativa
*   **Valleverde y sus Mazmorras:** Explora un mundo interconectado con puzles lógicos (paridad binaria, monolitos recursivos).
*   **Sistema de Karma y Consecuencias:** 
    *   Atacar a un NPC hará que te insulten, y si insistes, el **Carcelero** te encerrará 10 minutos reales.
    *   Atacar a un animal invocará al **Demonio Vengador** (El Señor de las Ovejas), que te matará de un golpe.
*   **Ciclo Día/Noche:** Afecta a los enemigos que aparecen, a la iluminación y a los horarios de los NPCs.
*   **3 Finales Alternativos:** Decisiones que afectan el destino de Valleverde.

### 🏢 Expansión: "El Resurgir de Mister Alex IA" (v2.0)
*   **Valleverde 2.0:** Un futuro distópico corporativo lleno de neones y falsa felicidad.
*   **Rogue-lite "El Vertedero Digital":** Mazmorra de 5 pisos con muerte persistente y moneda de progresión (Currículum).
*   **Nuevos Personajes:** Tony Randazzo (NPC con doble personalidad: sevillano/argentino), Iñakito (el becario), El Kernel, y el regreso grotesco de Alex.
*   **Jefa Secreta:** "La Deuda Técnica".

### 🎨 Motor Gráfico y Técnico (Custom Engine)
*   **Render Pipeline 2.5D:** Y-sorting, tejados con perspectiva, oclusión y capas.
*   **Iluminación Dinámica:** Canvas offscreen con `destination-out` para recortar luces de antorchas y farolas.
*   **Bloom Barato:** Post-procesado de resplandor a 1/4 de resolución sin pérdida de FPS.
*   **Audio Híbrido:** Música en MP3 con *crossfade* y *ducking* (baja al recibir daño), mezclado con SFX procedurales de Web Audio API.
*   **UI Moderna (Glassmorphism):** Menús, mapa y hotbar (1-5) con animaciones fluidas y cursores dinámicos (espada/puño/guante).

## 🧠 Metodología de Desarrollo (AI Orchestration)

Este proyecto no se ha construido tecleando líneas de código de forma tradicional, sino mediante un flujo de trabajo de **Dirección Técnica Asistida por IA**:

1.  **Game Direction (Humano):** Definición de la visión, el *game feel*, los sistemas de karma, la economía del Rogue-lite y la estructura narrativa.
2.  **Auditoría Técnica (Gemini Argon):** Utilizado como *Lead QA* y arquitecto para detectar cuellos de botella, acoplamientos peligrosos en el código y simular partidas completas (Playthrough Analysis).
3.  **Ejecución y Refactorización (DeepSeek Hydrogen):** Utilizado como equipo de ingeniería para implementar los briefs técnicos, refactorizar el motor y arreglar bugs bajo las directrices del Director.

## 🚀 Cómo Ejecutar el Juego

El juego es 100% *client-side*. No requiere instalación de dependencias (salvo un servidor local básico para evitar problemas de CORS con los módulos ES6 y archivos MP3).

1. Clona el repositorio.
2. Inicia un servidor local (puedes usar Python o Live Server):
   ```bash
   python3 -m http.server 8080