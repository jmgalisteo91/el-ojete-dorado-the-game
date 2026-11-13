/**
 * Service Worker · El Ojete Dorado
 *
 * Estrategias:
 *  - Shell: network-first (para que un deploy nuevo se vea al instante) con fallback
 *    al index.html cacheado (offline).
 *  - Módulos, CSS e iconos: cache-first. Las URLs se cachean EXACTAS, con su `?v=N`,
 *    para que un bump de versión no sirva módulos viejos desde el cache.
 *  - /api/*: network-first, sin cachear respuestas dinámicas.
 *  - Fuentes de Google: stale-while-revalidate en cache de runtime.
 *
 * RELEASE: subir CACHE_VERSION y ASSET_VERSION (este último debe coincidir con el `?v=`
 * de index.html y de los imports de los módulos).
 */

const CACHE_VERSION = 'v43';
const ASSET_VERSION = '8';
const CACHE_NAME = `ojete-dorado-${CACHE_VERSION}`;

const SHELL_URLS = [
  './',
  './index.html',
  `./style.css?v=${ASSET_VERSION}`,
  './manifest.json',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png'
];

/** Módulos ES del juego (se cachean con la misma query que usan los imports). */
const MODULE_PATHS = [
  'src/ai/AIBotBrain.js',
  'src/ai/EnemyBrain.js',
  'src/ai/Pathfinding.js',
  'src/assets/BossCutscenes.js',
  'src/assets/CutsceneImages.js',
  'src/assets/VillainDialogues.js',
  'src/audio/AmbientMusic.js',
  'src/audio/AudioManager.js',
  'src/core/AchievementManager.js',
  'src/core/Camera2D.js',
  'src/core/DoorGatekeeper.js',
  'src/core/GameLoop.js',
  'src/core/InputHandler.js',
  'src/core/QuestLog.js',
  'src/core/ScoreSystem.js',
  'src/core/SkillCatalog.js',
  'src/entities/Animal.js',
  'src/entities/Enemy.js',
  'src/entities/Entity.js',
  'src/entities/NPC.js',
  'src/entities/Player.js',
  'src/entities/WorldItem.js',
  'src/entities/bosses/Boss.js',
  'src/entities/bosses/FinalBossAlex.js',
  'src/entities/bosses/GarbageCollectorBoss.js',
  'src/entities/bosses/PrototypeMicrowaveBoss.js',
  'src/entities/bosses/StackOverflowBoss.js',
  'src/graphics/Animator.js',
  'src/graphics/RenderPipeline.js',
  'src/graphics/SpriteSheetGenerator.js',
  'src/main.js',
  'src/physics/CollisionSystem.js',
  'src/services/CloudStorage.js',
  'src/ui/AnimeCutsceneManager.js',
  'src/ui/CharacterStats.js',
  'src/ui/DialogueBox.js',
  'src/ui/EndingCredits.js',
  'src/ui/Inventory.js',
  'src/ui/LeaderboardView.js',
  'src/ui/MainMenuAndScenes.js',
  'src/ui/QuestLogView.js',
  'src/ui/SpeechBubble.js',
  'src/ui/TouchControls.js',
  'src/ui/UILayout.js',
  'src/ui/WorldMap.js',
  'src/world/DayNightCycle.js',
  'src/world/Tilemap.js'
];

const PRECACHE_URLS = [
  ...SHELL_URLS,
  ...MODULE_PATHS.map((path) => `./${path}?v=${ASSET_VERSION}`)
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Las URLs llevan `?v=N`, así que se puede aprovechar el HTTP cache: la primera
      // carga ya descargó los módulos y el precache no los vuelve a bajar.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const absolute = new URL(url, self.registration.scope).href;
            await cache.add(absolute);
          } catch (err) {
            // Un asset que falte no debe impedir que el SW se instale.
            console.warn('[SW] No se pudo precachear', url, err && err.message ? err.message : err);
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('ojete-dorado-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/** Cache-first con relleno de runtime (URLs exactas). */
async function cacheFirst(request, fallbackUrl = null) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

/** Red primero (APIs); si falla, intenta el cache. */
async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (err) {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

/**
 * Navegación: red primero para que el HTML nuevo llegue en el siguiente arranque.
 * Si no hay red, sirve el shell cacheado (modo offline / PWA instalada).
 */
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached =
      (await caches.match(request)) ||
      (await caches.match('./index.html')) ||
      (await caches.match('./'));
    return cached || Response.error();
  }
}

/** Sirve lo cacheado y actualiza en segundo plano (fuentes, assets externos). */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!request || request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }

  const sameOrigin = url.origin === self.location.origin;

  // API dinámica: nunca se cachea
  if (sameOrigin && url.pathname.includes('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Tipografías de Google: cache de runtime
  if (/\.googleapis\.com$|\.gstatic\.com$/.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Otros orígenes: que los maneje el navegador
  if (!sameOrigin) return;

  // Navegación: red primero + fallback offline al shell
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Estáticos: cache-first con relleno de runtime
  event.respondWith(cacheFirst(request));
});
