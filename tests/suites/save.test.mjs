import { calculateGameScore, formatPlayTime, getLocalLeaderboard, saveLocalScore, submitGlobalScore, fetchGlobalLeaderboard, getLocalSaveContainer, saveLocalFallback, markLocalFallbackSynced, syncPendingSaveToCloud, SAVE_STORAGE_KEY } from '../../src/core/ScoreSystem.js';
import handleLeaderboard from '../../api/leaderboard.js';
import handleSave from '../../api/save.js';
import { CloudStorage } from '../../src/services/CloudStorage.js';
import {
  sharedMockStore,
  createMockRes,
} from './mocks.mjs';

export async function run(test, assert) {
  test('calculateGameScore asigna Rango S con <= 12 min y 0 muertes', () => {
    const res = calculateGameScore(600, 0);
    assert.equal(res.rank, 'S');
    assert.equal(res.score, 94000); // 100.000 - 6.000
    assert.equal(res.playTimeFormatted, '10:00');
    assert.equal(res.deaths, 0);

    // Límite exacto de 720s (12m) y 0 muertes
    const resLimit = calculateGameScore({ playTimeSeconds: 720, deaths: 0 });
    assert.equal(resLimit.rank, 'S');
    assert.equal(resLimit.score, 92800);
  });

  test('calculateGameScore degrada a Rango A si hay muertes o excede 12 min', () => {
    // 600s con 1 muerte -> no es S, debe ser A
    const res1 = calculateGameScore(600, 1);
    assert.equal(res1.rank, 'A');
    assert.equal(res1.score, 89000); // 100.000 - 6.000 - 5.000

    // 1100s con 2 muertes -> A
    const res2 = calculateGameScore({ playTimeSeconds: 1100, deaths: 2 });
    assert.equal(res2.rank, 'A');
    assert.equal(res2.score, 79000); // 100.000 - 11.000 - 10.000
  });

  test('calculateGameScore asigna Rango B y Rango C según umbrales', () => {
    // Rango B: 1800s (30m) y 4 muertes
    const resB = calculateGameScore(1800, 4);
    assert.equal(resB.rank, 'B');
    assert.equal(resB.score, 62000); // 100.000 - 18.000 - 20.000

    // Rango C: 2400s (40m) y 8 muertes
    const resC = calculateGameScore(2400, 8);
    assert.equal(resC.rank, 'C');
    assert.equal(resC.score, 36000); // 100.000 - 24.000 - 40.000
    assert.ok(resC.score < 40000);
  });

  test('formatPlayTime formatea MM:SS y HH:MM:SS adecuadamente', () => {
    assert.equal(formatPlayTime(0), '00:00');
    assert.equal(formatPlayTime(65), '01:05');
    assert.equal(formatPlayTime(720), '12:00');
    assert.equal(formatPlayTime(3665), '1:01:05');
  });

  test('saveLocalScore y getLocalLeaderboard ordenan puntuaciones y recortan a Top 15', () => {

    // 1. Obtener lista por defecto
    const initial = getLocalLeaderboard();
    assert.equal(initial.length, 5);
    assert.equal(initial[0].username, 'AURELIO_DEV');

    // 2. Guardar nuevo récord de Speedrun número 1
    const saveResult = saveLocalScore({
      name: 'SPEED_GOD',
      playTimeSeconds: 400,
      deaths: 0
    });

    assert.equal(saveResult.position, 1, 'Debe ocupar el 1er lugar');
    assert.equal(saveResult.entry.rank, 'S');
    assert.equal(saveResult.entry.score, 96000); // 100k - 4k

    const updated = getLocalLeaderboard();
    assert.equal(updated.length, 6);
    assert.equal(updated[0].username, 'SPEED_GOD');

    // 3. Sanitizado de nickname
    const sanitizedSave = saveLocalScore({
      name: '   super_pro!#$   ',
      playTimeSeconds: 900,
      deaths: 1
    });
    assert.equal(sanitizedSave.entry.username, 'SUPER_PRO');
  });

  test('submitGlobalScore guarda localmente de forma síncrona incluso sin conexión', async () => {
    const result = await submitGlobalScore({
      name: 'OFFLINE_HERO',
      playTimeSeconds: 500,
      deaths: 0
    });

    assert.ok(result.ok, 'submitGlobalScore debe retornar ok=true');
    assert.equal(result.entry.username, 'OFFLINE_HERO');
    assert.equal(result.entry.rank, 'S');

    const board = getLocalLeaderboard();
    const found = board.find((e) => e.username === 'OFFLINE_HERO');
    assert.ok(found, 'Debe haberse guardado en el leaderboard local');
  });

  test('fetchGlobalLeaderboard devuelve el leaderboard por defecto sin fallar', async () => {
    const res = await fetchGlobalLeaderboard();
    assert.ok(res.ok);
    assert.ok(Array.isArray(res.leaderboard));
    assert.ok(res.leaderboard.length >= 5);
  });

  test('api/leaderboard responde a GET con estado 200 y lista de récords', async () => {
    const req = { method: 'GET', headers: { host: 'localhost' } };
    const res = createMockRes();
    await handleLeaderboard(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.ok);
    assert.ok(Array.isArray(res.body.leaderboard));
    assert.ok(res.body.leaderboard.length >= 5);
  });

  test('api/leaderboard valida y recalcula el score en POST (anti-trampas serverless)', async () => {
    const req = {
      method: 'POST',
      headers: { host: 'localhost' },
      body: {
        username: 'speed_hacker',
        playTimeSeconds: 600,
        deaths: 0,
        fakeScoreAttempt: 9999999 // Debe ignorarse y recalcularse a 94.000
      }
    };
    const res = createMockRes();
    await handleLeaderboard(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.ok);
    assert.equal(res.body.entry.username, 'SPEED_HACKER');
    assert.equal(res.body.entry.rank, 'S');
    assert.equal(res.body.entry.score, 94000, 'El servidor debe recalcular: 100k - 6k = 94.000');
  });

  test('api/save valida código en GET y contenido mínimo en POST', async () => {
    // 1. GET sin código o código muy corto devuelve 400
    const reqGetInvalid = { method: 'GET', url: '/api/save?code=1', headers: { host: 'localhost' } };
    const resGet = createMockRes();
    await handleSave(reqGetInvalid, resGet);
    assert.equal(resGet.statusCode, 400);
    assert.equal(resGet.body.error, 'INVALID_CODE');

    // 2. POST sin sceneId válido devuelve 400
    const reqPostInvalid = {
      method: 'POST',
      headers: { host: 'localhost' },
      body: { invalidData: true }
    };
    const resPost = createMockRes();
    await handleSave(reqPostInvalid, resPost);
    assert.equal(resPost.statusCode, 400);
    assert.equal(resPost.body.error, 'INVALID_SAVE_DATA');
  });

  test('saveLocalFallback guarda estructura de contingencia con dirty flag pendingCloudSync', () => {
    const payload = { sceneId: 'overworld', playerHp: 3, playerX: 100, playerY: 200 };
    const ok = saveLocalFallback(payload, 'OJT-DEMO1', true);
    assert.equal(ok, true);

    const container = getLocalSaveContainer();
    assert.ok(container);
    assert.equal(container.cloudCode, 'OJT-DEMO1');
    assert.equal(container.pendingCloudSync, true);
    assert.equal(container.syncStatus, 'pending');
    assert.equal(container.savePayload.sceneId, 'overworld');
    assert.equal(container.savePayload.playerHp, 3);
  });

  test('markLocalFallbackSynced limpia pendingCloudSync y actualiza estado a synced', () => {
    const syncedOk = markLocalFallbackSynced('OJT-SYNCED', 1700000000);
    assert.equal(syncedOk, true);

    const container = getLocalSaveContainer();
    assert.equal(container.cloudCode, 'OJT-SYNCED');
    assert.equal(container.pendingCloudSync, false);
    assert.equal(container.syncStatus, 'synced');
    assert.equal(container.cloudSyncedAt, 1700000000);
  });

  test('getLocalSaveContainer es compatible hacia atrás con partidas heredadas en formato plano', () => {
    sharedMockStore[SAVE_STORAGE_KEY] = JSON.stringify({
      sceneId: 'first_stage',
      playerHp: 2,
      savedAt: 1690000000
    });

    const container = getLocalSaveContainer();
    assert.ok(container);
    assert.equal(container.savePayload.sceneId, 'first_stage');
    assert.equal(container.savePayload.playerHp, 2);
    assert.equal(container.pendingCloudSync, false);
  });

  test('syncPendingSaveToCloud sube la partida pendiente a la API en cuanto hay conexión', async () => {
    // Guardar partida marcada como pendiente (offline)
    const pendingPayload = { sceneId: 'blacksmith_house', playerHp: 3, playerX: 50, playerY: 50 };
    saveLocalFallback(pendingPayload, null, true);

    // Simular mock de fetch para la API /api/save
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      if (url === '/api/save' && opts && opts.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            code: 'OJT-AUTOSYNC',
            savedAt: Date.now(),
            message: 'Saved to mock cloud'
          })
        };
      }
      return originalFetch(url, opts);
    };

    try {
      const syncRes = await syncPendingSaveToCloud('TEST_HERO');
      assert.equal(syncRes.ok, true);
      assert.equal(syncRes.synced, true);
      assert.equal(syncRes.code, 'OJT-AUTOSYNC');

      // Comprobar que en el localStorage el fallback quedó limpio (pendingCloudSync: false)
      const afterSyncContainer = getLocalSaveContainer();
      assert.equal(afterSyncContainer.pendingCloudSync, false);
      assert.equal(afterSyncContainer.syncStatus, 'synced');
      assert.equal(afterSyncContainer.cloudCode, 'OJT-AUTOSYNC');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('CloudStorage.sanitizeSaveData protege contra undefined en shieldHP y hasPermission_*', () => {
    const legacyRaw = {
      sceneId: 'overworld',
      playerHasArmor: true
      // Sin shieldHP ni housePermissions definidos
    };
    const clean = CloudStorage.sanitizeSaveData(legacyRaw);
    assert.ok(clean);
    assert.equal(clean.shieldHP, 3, 'Si tiene armadura y no viene shieldHP, debe inicializar en 3');
    assert.equal(clean.armorPoints, 3);
    assert.equal(clean.hasPermission_elder, false);
    assert.equal(clean.hasPermission_blacksmith, false);
    assert.equal(clean.hasPermission_herbalist, false);
    assert.equal(clean.hasPermission_guard, false);
    assert.equal(clean.hasPermission_oracle, false);
    assert.deepEqual(clean.housePermissions, {
      elder: false,
      blacksmith: false,
      herbalist: false,
      guard: false,
      oracle: false
    });
  });

  test('CloudStorage: Saneamiento y persistencia de swordLevel, armorLevel, dungeonCores y gatesUnlocked', () => {
    const rawSave = {
      sceneId: 'quantum_gate',
      playerHasArmor: true,
      playerHasSword: true,
      swordLevel: 3,
      armorLevel: 2,
      dungeonCores: { gc: true, stack: true, microwave: false },
      gatesUnlocked: 2
    };

    const sanitized = CloudStorage.sanitizeSaveData(rawSave);
    assert.equal(sanitized.swordLevel, 3);
    assert.equal(sanitized.armorLevel, 2);
    assert.deepEqual(sanitized.dungeonCores, { gc: true, stack: true, microwave: false });
    assert.equal(sanitized.gatesUnlocked, 2);

    // Valores por defecto y clamp de seguridad
    const invalidRaw = {
      swordLevel: 99,
      armorLevel: -5,
      gatesUnlocked: 'invalido'
    };
    const cleanInvalid = CloudStorage.sanitizeSaveData(invalidRaw);
    assert.equal(cleanInvalid.swordLevel, 3, 'Debe clampear swordLevel al máximo 3');
    assert.equal(cleanInvalid.armorLevel, 1, 'Debe clampear armorLevel al mínimo 1');
    assert.equal(cleanInvalid.gatesUnlocked, 0, 'Debe resetear gatesUnlocked a 0');
    assert.deepEqual(cleanInvalid.dungeonCores, { gc: false, stack: false, microwave: false });
  });
}
