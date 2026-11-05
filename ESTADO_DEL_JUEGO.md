# 📜 ESTADO DEL JUEGO · EL OJETE DORADO: THE GAME
> **Documento Vivo de Estado, Arquitectura, Progresión y Hoja de Ruta Futura**  
> **Versión Actual:** v3.7 (Metroidvania Cardinal, Sistema de Niveles 1-10, Centinelas con Lore y Cartografía Zelda)  
> **Última Actualización:** 5 de Noviembre de 2026  

---

## 1. Ficha Técnica del Proyecto

* **Motor:** JavaScript Vanilla (ES Modules estándar, sin frameworks externos ni dependencias npm en cliente).
* **Renderizado:** HTML5 Canvas 2D nativo a resolución interna fija de **320 × 180 px** (relación 16:9 con reescalado `image-rendering: pixelated`).
* **Gráficos 2.5D:** [`RenderPipeline.js`](file:///Users/jose.peralta/Documents/El%20ojete%20dorado%20-%20the%20game/src/graphics/RenderPipeline.js) con ordenación Y-Sorted por plano `y + height`, props de profundidad y sombras pseudo-3D dinámicas proyectadas según la posición del sol ([`DayNightCycle.js`](file:///Users/jose.peralta/Documents/El%20ojete%20dorado%20-%20the%20game/src/world/DayNightCycle.js)).
* **Audio:** Sintetizador chiptune procedural con Web Audio API pura ([`AmbientMusic.js`](file:///Users/jose.peralta/Documents/El%20ojete%20dorado%20-%20the%20game/src/audio/AmbientMusic.js)), sin archivos `.mp3`/`.wav` externos.
* **Persistencia:** Arquitectura híbrida síncrona en `localStorage` (0 ms de latencia) + sincronización en segundo plano con **Vercel KV Serverless** ([`CloudStorage.js`](file:///Users/jose.peralta/Documents/El%20ojete%20dorado%20-%20the%20game/src/services/CloudStorage.js)).
* **Empaquetado y Distribución:** [`build-portable.mjs`](file:///Users/jose.peralta/Documents/El%20ojete%20dorado%20-%20the%20game/build-portable.mjs) genera un único archivo HTML autocontenido [`el-ojete-dorado-the-game.html`](file:///Users/jose.peralta/Documents/El%20ojete%20dorado%20-%20the%20game/el-ojete-dorado-the-game.html) (1.2 MB, 100% offline y ejecutable en cualquier navegador).
* **Batería de Pruebas:** 68 pruebas automatizadas sin entorno DOM vía `node tests/regression.mjs`.

---

## 2. Estructura Geográfica Cardinal (Mundo Abierto Metroidvania)

El mundo ha sido reorganizado geométricamente tomando como epicentro la aldea pacífica de **Valleverde**. No hay jefes ni mazmorras hostiles dentro del pueblo, sirviendo de refugio seguro, mercado y nexo de los 4 puntos cardinales:

```
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

### Detalle de Regiones y Mazmorras

| Región Cardinal | Escena (`sceneId`) | Nivel Requerido | Centinela Custodio | Contenido y Mazmorras |
|---|---|---|---|---|
| **Centro** | `overworld` | Nivel 1 | Guardia Bit / Vecinos | Pueblo pacífico de Valleverde, Tiendas (Brom, Byte, Clara), Casa del Programador (cama para descansar), Cuartel y Observatorio de Orion. |
| **Este** | `first_stage` | **Nivel 2** | Guardia Kael y Bit | **Valle de la Consagración**: Pruebas de equipo sagrado.<br>• `armor_temple`: Templo de la Armadura Binaria.<br>• `sword_temple`: Templo de la Espada de la Recursividad. |
| **Norte** | `north_peaks` | **Nivel 4** | Guardia Boreas | **Cumbres de la Recursión**: Picos helados de silicio.<br>• `mines_entry` / `mines_puzzle`: Minas de la Recursión.<br>• **Jefe:** *Guardián del Stack Overflow* (otorga Núcleo Stack + Corte en Cascada). |
| **Sur** | `south_swamp` | **Nivel 6** | Guardia Vulcano | **Marismas del Hardware Legacy**: Ciénaga tóxica y calderas.<br>• `sewers_entry` / `sewers_dungeon`: Cloacas (**Jefe:** *Garbage Collector Furioso* · otorga Dash Asíncrono).<br>• `forge_entry` / `ai_fortress_gate`: La Forja (**Jefe:** *Microondas Prototipo* · otorga Escudo TS). |
| **Oeste** | `west_wastes` | **Nivel 8** | Comandante Vael | **Páramo Corrupto de Alex**: Terreno yermo de alta tensión.<br>• `quantum_gate`: Gran Puerta del Núcleo Cuántico (altar para incrustar los 3 cristales de mazmorra). |
| **Cúspide Final** | `ai_citadel` | **Nivel 10** + 3 Núcleos | Sistema Autónomo | **Ciudadela Cuántica de Alex**: Mainframe exclusivo de rejillas oscuras y cables de neón.<br>• **Jefe Final:** *Mister AI Alex* en dos fases de combate. |

---

## 3. Sistema de Progresión y Niveles (1 al 10)

El personaje sube de nivel acumulando Experiencia (XP) al vencer amenazas en el mundo:

* **Enemigos Comunes (Drones, Centinelas, Caballeros):** Otorgan **+25 XP**.
* **Jefes Regionales (Garbage Collector, Stack Overflow, Microondas):** Otorgan **+200 XP** y 2 puntos de habilidad.
* **Bonificación de Nivel:** Al subir de nivel, el jugador **recupera el 100% de su Salud y Stamina**, suena una fanfarria y se proyecta un banner festivo en pantalla.
* **Gating Orgánico por Centinelas:** Si el jugador intenta cruzar hacia una zona superior a su nivel:
  1. El centinela fronterizo lo detiene con un sonido de bloqueo y diálogo de advertencia contextual.
  2. El héroe es repelido 1 casilla hacia atrás para no quedar atrapado en el trigger de colisión.
  3. Al alcanzar el nivel adecuado, el paso es **completamente fluido e instantáneo** (estilo Zelda clásico, sin ventanas de confirmación redundantes).

---

## 4. Equipo, Forja y Habilidades Especiales

### Espada de la Recursividad ([`Player.js`](file:///Users/jose.peralta/Documents/El%20ojete%20dorado%20-%20the%20game/src/entities/Player.js) & Herrero Brom)
* **Nivel 1 (Espada Base):** Tajo cuerpo a cuerpo estándar (daño 1.0).
* **Nivel 2 (Espada de Silicio):** Daño aumentado un +50% (daño 1.5). Capacidad de resquebrajar barreras de cristal en las Minas de la Recursión. Forja con Brom por 100 Bytes + chatarra de silicio.
* **Nivel 3 (Espada Overclockeada):** Daño aumentado un +100% (daño 2.0). Emite un **Tajo de Energía proyectil** a distancia cuando la salud del héroe está al 100%. Forja con Brom con el Magnetrón del Microondas.

### Armadura del Código Binario
* **Nivel 1 (Armadura Binaria Base):** Proporciona 3 puntos de blindaje absorbente (corazones de coraza cian) antes de recibir daño a los corazones vitales. Si el héroe no porta armadura, está en estado **Indefenso** (cae de 1 solo golpe).
* **Nivel 2 (Blindaje Térmico):** Inmunidad pasiva a la radiación térmica extrema de las calderas de La Forja (evita sufrir -0.5 corazones cada 3 segundos).

### Habilidades de Mini-Jefes
1. 💨 **Dash Asíncrono (`Shift` + Dirección):** Impulso rápido con 0.2s de invulnerabilidad (obtenido al derrotar a Garbage Collector).
2. 🌀 **Corte en Cascada (`Espacio`/Clic sostenido 1s):** Ataque circular 360° con triple daño (obtenido al derrotar a Stack Overflow).
3. 🛡️ **Barrera de Tipado Estricto TypeScript (`Q`):** Escudo esférico de 3 segundos que neutraliza proyectiles enemigos (obtenido al derrotar a Microondas Prototipo).

### Mecánica de Robotización IA
* Al vestir equipo cibernético avanzado o recibir ataques corruptos, el nivel de robotización sube lentamente.
* **Penalización > 50%:** Rigidez de articulaciones (-30% al daño de espada).
* **Penalización > 80%:** Corazón derecho bloqueado en estática (salud máxima limitada a 2.0).
* **Cura:** Dormir en la cama de la Casa del Programador o consumir Café Compilado en la tienda de Byte.

---

## 5. Controles Integrados (Teclado y Ratón)

| Acción | Entrada Primaria | Entrada Secundaria / Ratón |
|---|---|---|
| **Movimiento** | `W`, `A`, `S`, `D` / Flechas | — |
| **Atacar con Espada** | `Clic Izquierdo` del Ratón | `Espacio` / `F` / `J` |
| **Ataque Cargado (Giro 360°)** | Mantener `Clic Izquierdo` (1s) | Mantener `Espacio` / `F` (1s) |
| **Dash Asíncrono** | `Shift` + Dirección | — |
| **Barrera TypeScript** | `Q` | — |
| **Interactuar / Hablar / Examinar** | `E` | `Enter` / Clic sobre bocadillo |
| **Mapa del Reino estilo Zelda** | `M` | Botón en menú de pausa |
| **Ficha Técnica Dev y Atributos** | `C` | — |
| **Mochila de Inventario** | `I` | `Tab` |
| **Diario de Misiones** | `L` | Botón en menú de pausa |
| **Pausa del Juego** | `Escape` | — |

---

## 6. Cartografía Dinámica y UI Zelda ([`WorldMap.js`](file:///Users/jose.peralta/Documents/El%20ojete%20dorado%20-%20the%20game/src/ui/WorldMap.js))

* **Parchment Map (`[M]`):** Muestra el reino sobre un pergamino dorado medieval-digital con caminos interconectados.
* **Pin de Posición Preciso:** El héroe se representa con el sprite Link animado y el rótulo `★ TÚ`, calculando la posición exacta dentro de la zona actual.
* **Indicadores HUD Inferiores:**
  * Estado de los 3 cristales de mazmorra (`🟢 GC`, `🔷 STACK`, `🔴 FORJA`).
  * Nivel actual de la Espada y Armadura.
  * Localización actual y objetivo de misión principal dinámico.
* **Sin Badges Intrusivos:** Se eliminaron los textos flotantes gigantescos en el overworld (`renderBossAndDungeonIndicators` neutralizado).

---

## 7. Pruebas Automatizadas y Calidad

El proyecto dispone de un arnés de regresión completo sin dependencias:
```bash
# Ejecutar suite de pruebas:
node tests/regression.mjs
# Estado actual: 68 pruebas OK, 0 fallos

# Compilar ejecutable autónomo para distribución:
node build-portable.mjs
# Genera: el-ojete-dorado-the-game.html (1.22 MB, sintaxis 100% limpia)
```

---

## 8. Hoja de Ruta y Próximas Mejoras (Backlog de Ideas)

Ideas y expansiones sugeridas para futuras iteraciones:

### 🎮 Gameplay y Combate
- [ ] **Efectos de Terreno y Superficies:**
  - Reducción ligera de velocidad en el fango de las marismas.
  - Resbalamiento sutil sobre el hielo/cristal en las Cumbres de la Recursión.
- [ ] **Minijuego de Hacking de Terminales:**
  - Puzle interactivo de descifrado binario en la entrada de la Ciudadela Cuántica para bypass de defensas.
- [ ] **Consumibles Avanzados y Crafteo:**
  - Posibilidad de combinar hierbas de Lyra con chatarra de Brom para forjar granadas aturdidoras (`console.warn`) o pociones de sobretensión.

### 🗺️ Contenido y Exploración
- [ ] **Cueva Secreta de Easter Eggs:**
  - Gruta oculta tras una cascada en el Río Alba accesible rompiendo una grieta con la Espada de Silicio.
- [ ] **Expansión del Sistema de Pesca:**
  - Especies de peces raros en los lagos del norte y del sur con bonificaciones temporales de velocidad o suerte.

### 🎨 Audio, Efectos Visuales e Inmersión
- [ ] **Sonidos de Pasos por Material:**
  - Audio sintetizado diferenciado para pisadas en madera, hierba, piedra y fango.
- [ ] **Partículas Meteorológicas Dinámicas:**
  - Copos de silicio/nieve en las Cumbres del Norte.
  - Gotas de lluvia ácida y vapor en las Marismas del Sur.
  - Chispas cuánticas flotantes en la Ciudadela de Alex.

