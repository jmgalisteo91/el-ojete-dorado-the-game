import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODULE_ORDER = [
  'src/core/GameLoop.js',
  'src/core/InputHandler.js',
  'src/core/Camera2D.js',
  'src/core/QuestLog.js',
  'src/core/AchievementManager.js',
  'src/graphics/SpriteSheetGenerator.js',
  'src/graphics/Animator.js',
  'src/world/Tilemap.js',
  'src/physics/CollisionSystem.js',
  'src/entities/Entity.js',
  'src/entities/Player.js',
  'src/entities/NPC.js',
  'src/entities/Animal.js',
  'src/entities/Enemy.js',
  'src/entities/bosses/Boss.js',
  'src/entities/bosses/GarbageCollectorBoss.js',
  'src/entities/bosses/StackOverflowBoss.js',
  'src/entities/bosses/PrototypeMicrowaveBoss.js',
  'src/entities/bosses/FinalBossAlex.js',
  'src/entities/WorldItem.js',
  'src/ui/DialogueBox.js',
  'src/ui/Inventory.js',
  'src/ui/CharacterStats.js',
  'src/ui/WorldMap.js',
  'src/ui/QuestLogView.js',
  'src/ui/EndingCredits.js',
  'src/ui/MainMenuAndScenes.js',
  'src/assets/CutsceneImages.js',
  'src/assets/VillainDialogues.js',
  'src/assets/BossCutscenes.js',
  'src/ui/AnimeCutsceneManager.js',
  'src/world/DayNightCycle.js',
  'src/ai/AIBotBrain.js',
  'src/audio/AmbientMusic.js',
  'src/main.js'
];

function stripImportsAndExports(code) {
  let res = code;
  // 1. Eliminar re-exportaciones ancladas a inicio de línea: export { ... } from '...';
  res = res.replace(/^\s*export\s*\{[^{}]*?\}\s*from\s*['"][^'"]+['"];?/gm, '');
  // 2. Eliminar exportaciones agrupadas ancladas a inicio de línea: export { ... };
  res = res.replace(/^\s*export\s*\{[^{}]*?\};?/gm, '');
  // 3. Eliminar importaciones con origen ancladas a inicio de línea: import ... from '...';
  res = res.replace(/^\s*import\s*\{[^{}]*?\}\s*from\s*['"][^'"]+['"];?/gm, '');
  res = res.replace(/^\s*import\s*[\w*\s{},]+from\s*['"][^'"]+['"];?/gm, '');
  // 4. Eliminar importaciones desnudas ancladas a inicio de línea: import '...';
  res = res.replace(/^\s*import\s*['"][^'"]+['"];?/gm, '');
  // 5. Eliminar export default anclado a inicio de línea
  res = res.replace(/^\s*export\s+default\s+/gm, '');
  // 6. Transformar declaraciones export a declaraciones locales ancladas a inicio de línea
  res = res.replace(/^(\s*)export\s+(async\s+function|function|class|const|let|var)\b/gm, '$1$2');
  return res;
}

function validateEsmCrossModuleReferences() {
  const exportedClasses = new Map();
  for (const relPath of MODULE_ORDER) {
    const raw = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
    const classMatches = raw.matchAll(/^\s*export\s+class\s+(\w+)/gm);
    for (const m of classMatches) {
      exportedClasses.set(m[1], relPath);
    }
  }

  for (const relPath of MODULE_ORDER) {
    const raw = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
    for (const [className, ownerPath] of exportedClasses.entries()) {
      if (ownerPath === relPath) continue;
      const usageRegex = new RegExp(`\\b${className}\\s*\\.\\s*\\w+|\\bnew\\s+${className}\\b`);
      if (usageRegex.test(raw)) {
        const importRegex = new RegExp(`import\\s*\\{[^}]*\\b${className}\\b[^}]*\\}\\s*from`);
        if (!importRegex.test(raw)) {
          throw new Error(
            `❌ Error de integridad ESM: '${relPath}' utiliza '${className}' (de '${ownerPath}') sin importarlo explícitamente.`
          );
        }
      }
    }
  }
  console.log('✓ Verificación de referencias cruzadas ESM: todos los módulos importan sus dependencias.');
}

function buildPortableHtml() {
  validateEsmCrossModuleReferences();
  const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  const faviconSvg = fs.readFileSync(path.join(__dirname, 'favicon.svg'), 'utf8');
  const faviconDataUri =
    'data:image/svg+xml,' +
    encodeURIComponent(faviconSvg.replace(/\s+/g, ' ').replace(/> </g, '><').trim());

  const bundledModules = MODULE_ORDER.map((relPath) => {
    const fullPath = path.join(__dirname, relPath);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const cleaned = stripImportsAndExports(raw).trim();
    return `  // ==========================================\n  // Módulo: ${relPath}\n  // ==========================================\n${cleaned}`;
  }).join('\n\n');

  const scriptContent = `(() => {\n  'use strict';\n\n${bundledModules}\n})();`;

  // Verificación estricta de sintaxis en tiempo de compilación
  try {
    new Function(scriptContent);
    console.log('✓ Verificación de sintaxis de JS empaquetado: 100% válida y ejecutable.');
  } catch (err) {
    console.error('❌ ERROR FATAL DE SINTAXIS EN EL BUNDLE PORTABLE:', err);
    throw err;
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>El Ojete Dorado · Aventura RPG Pixel Art (Portable)</title>
  <link rel="icon" type="image/svg+xml" href="${faviconDataUri}" />
  <link rel="alternate icon" href="./favicon.svg" />
  <style>
${css.trim()}
  </style>
</head>
<body>
  <main class="viewport-wrapper">
    <canvas id="game-canvas" width="1280" height="720"></canvas>

    <!-- Modal de confirmación para abandonar el juego -->
    <div id="exit-confirm-modal" class="exit-modal-backdrop hidden">
      <div class="exit-confirm-card">
        <div class="exit-modal-header">
          <span>⚔ ¿ABANDONAR LA AVENTURA? ⚔</span>
        </div>
        <h2 class="exit-confirm-title">¿Seguro que quieres salir de El Ojete Dorado?</h2>
        <p class="exit-confirm-body">
          Tu progreso guardado se mantendrá a salvo para tu próxima partida.
        </p>
        <div class="exit-modal-actions">
          <button id="exit-confirm-yes-btn" type="button" class="btn-confirm-yes">✓ Sí, salir del juego</button>
          <button id="exit-confirm-no-btn" type="button" class="btn-confirm-no">✕ No, seguir jugando</button>
        </div>
      </div>
    </div>

    <!-- Modal de agradecimiento y despedida con timeout de 3 segundos -->
    <div id="exit-farewell-modal" class="exit-modal-backdrop hidden">
      <div class="exit-farewell-card">
        <div class="exit-modal-header">
          <span>✨ ¡GRACIAS POR JUGAR! ✨</span>
        </div>
        <h2 class="exit-farewell-title">¡Gracias por jugar y probar el juego!</h2>
        <p class="exit-farewell-body">
          Mantente alerta, que a nuestro personaje le quedan muchas aventuras por superar...
        </p>
        <div class="exit-farewell-slogan">¡¡¡POR EL OJETEEEEEEEEE!!!</div>
        <div class="exit-countdown-container">
          <p id="exit-farewell-countdown-text" class="exit-countdown-text">
            Cerrando ventana en <span id="exit-farewell-countdown-sec">3</span> segundos...
          </p>
        </div>
        <p id="exit-farewell-hint" class="exit-farewell-hint">
          Si tu navegador no permite el cierre automático por seguridad, ya puedes cerrar esta pestaña manualmente.
        </p>
        <div id="exit-farewell-actions" class="exit-modal-actions">
          <button id="exit-farewell-close-btn" type="button" class="btn-confirm-yes">✕ Cerrar Pestaña Ahora</button>
          <button id="exit-farewell-return-btn" type="button" class="btn-confirm-no">↺ Volver al Menú</button>
        </div>
      </div>
    </div>

    <!-- Barra de chat libre en tiempo real para el NPC con IA -->
    <div id="ai-chat-modal" class="ai-chat-modal hidden">
      <div class="ai-chat-card">
        <div class="ai-chat-header">
          <span id="ai-chat-title">Hablar con Oráculo Orion [IA]</span>
          <button id="ai-chat-close" type="button" title="Cerrar (Esc)">✕</button>
        </div>
        <form id="ai-chat-form" autocomplete="off">
          <input
            id="ai-chat-input"
            type="text"
            maxlength="140"
            placeholder="Escribe tu pregunta para Orion y pulsa Enter..."
          />
          <button type="submit">Enviar</button>
        </form>
        <div class="ai-chat-hint">
          Pulsa <b>Enter</b> para enviar o <b>Esc</b> para volver a las opciones rápidas.
        </div>
      </div>
    </div>
  </main>
  <script>
${scriptContent}
  </script>
</body>
</html>
`;

  const outputPath = path.join(__dirname, 'el-ojete-dorado-the-game.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`Generado exitosamente: ${outputPath} (${Buffer.byteLength(html)} bytes)`);
}

buildPortableHtml();
