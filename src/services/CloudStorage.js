/**
 * CloudStorage.js · Servicio de Persistencia Híbrida (Vercel KV Redis + LocalStorage 0ms)
 *
 * Garantiza:
 * 1. Escritura síncrona inmediata (0 ms) en localStorage para no bloquear jamás los 60 FPS.
 * 2. Sincronización en paralelo y en segundo plano contra `/api/save` y `/api/leaderboard`.
 * 3. Sanitización integral (`sanitizeSaveData`) para evitar valores `undefined` al cargar
 *    partidas de versiones anteriores o remotas (incluyendo `shieldHP`, `armorPoints`,
 *    `hasPermission_*`, `housePermissions`, `robotizationLevel`, etc.).
 */

import {
  SAVE_STORAGE_KEY,
  CLOUD_SAVE_CODE_KEY,
  LOCAL_LEADERBOARD_KEY,
  getLocalSaveContainer,
  saveLocalFallback,
  markLocalFallbackSynced,
  uploadGameToCloud,
  downloadGameFromCloud,
  syncPendingSaveToCloud,
  getSavedCloudCode,
  setSavedCloudCode,
  fetchGlobalLeaderboard,
  submitGlobalScore,
  calculateGameScore,
  formatPlayTime
} from '../core/ScoreSystem.js?v=7';

export class CloudStorage {
  static _syncStatus = 'synced'; // 'synced' | 'syncing' | 'pending' | 'offline'
  static _lastSyncTime = 0;
  static _lastCloudCode = null;
  static _lastError = null;
  static _inFlightSave = false;

  /**
   * Sanitiza y normaliza cualquier payload de partida (local o remoto)
   * asegurando que todas las propiedades nuevas (v3.5+) tengan valores seguros.
   */
  static sanitizeSaveData(raw) {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    // Si viene envuelto en un contenedor { savePayload: {...} }, extraerlo
    const src = (raw.savePayload && typeof raw.savePayload === 'object')
      ? raw.savePayload
      : raw;

    const playerHasArmor = Boolean(src.playerHasArmor);
    const playerHasSword = Boolean(src.playerHasSword);

    const rawArmorPts = src.shieldHP ?? src.armorPoints;
    const defaultArmorPts = playerHasArmor ? 3 : 0;
    const armorPoints = Number.isFinite(Number(rawArmorPts))
      ? Math.max(0, Math.min(3, Math.floor(Number(rawArmorPts))))
      : defaultArmorPts;

    const rawPerms = (src.housePermissions && typeof src.housePermissions === 'object')
      ? src.housePermissions
      : {};

    const hasPermission_elder = Boolean(src.hasPermission_elder ?? rawPerms.elder ?? false);
    const hasPermission_blacksmith = Boolean(src.hasPermission_blacksmith ?? rawPerms.blacksmith ?? false);
    const hasPermission_herbalist = Boolean(src.hasPermission_herbalist ?? rawPerms.herbalist ?? false);
    const hasPermission_guard = Boolean(src.hasPermission_guard ?? rawPerms.guard ?? false);
    const hasPermission_oracle = Boolean(src.hasPermission_oracle ?? rawPerms.oracle ?? false);

    const housePermissions = {
      elder: hasPermission_elder,
      blacksmith: hasPermission_blacksmith,
      herbalist: hasPermission_herbalist,
      guard: hasPermission_guard,
      oracle: hasPermission_oracle
    };

    const maxHealth = Number.isFinite(Number(src.maxHealth)) && Number(src.maxHealth) > 0
      ? Number(src.maxHealth)
      : 6;
    const health = Number.isFinite(Number(src.health))
      ? Math.max(1, Math.min(maxHealth, Number(src.health)))
      : maxHealth;

    const coins = Number.isFinite(Number(src.coins ?? src.bytes))
      ? Math.max(0, Math.floor(Number(src.coins ?? src.bytes)))
      : 0;

    const robotizationLevel = Number.isFinite(Number(src.robotizationLevel))
      ? Math.max(0, Math.min(100, Number(src.robotizationLevel)))
      : 10;

    const playTimeSeconds = Number.isFinite(Number(src.playTimeSeconds))
      ? Math.max(0, Number(src.playTimeSeconds))
      : 0;

    const totalDeaths = Number.isFinite(Number(src.totalDeaths))
      ? Math.max(0, Math.floor(Number(src.totalDeaths)))
      : 0;

    const swordLevel = Number.isFinite(Number(src.swordLevel))
      ? Math.max(1, Math.min(3, Math.floor(Number(src.swordLevel))))
      : (playerHasSword ? 1 : 1);
    const armorLevel = Number.isFinite(Number(src.armorLevel))
      ? Math.max(1, Math.min(2, Math.floor(Number(src.armorLevel))))
      : (playerHasArmor ? 1 : 1);

    const rawCores = (src.dungeonCores && typeof src.dungeonCores === 'object') ? src.dungeonCores : {};
    const dungeonCores = {
      gc: Boolean(src.dungeonCore_gc ?? rawCores.gc ?? false),
      stack: Boolean(src.dungeonCore_stack ?? rawCores.stack ?? false),
      microwave: Boolean(src.dungeonCore_microwave ?? rawCores.microwave ?? false)
    };
    const defaultGates = Number(dungeonCores.gc) + Number(dungeonCores.stack) + Number(dungeonCores.microwave);
    const gatesUnlocked = Number.isFinite(Number(src.gatesUnlocked))
      ? Math.max(0, Math.min(3, Math.floor(Number(src.gatesUnlocked))))
      : defaultGates;

    return {
      ...src,
      version: src.version || '3.6',
      sceneId: typeof src.sceneId === 'string' && src.sceneId ? src.sceneId : 'village',
      playerX: Number.isFinite(Number(src.playerX)) ? Number(src.playerX) : 144,
      playerY: Number.isFinite(Number(src.playerY)) ? Number(src.playerY) : 108,
      health,
      maxHealth,
      coins,
      bytes: coins,
      robotizationLevel,
      playerHasSword,
      playerHasArmor,
      swordLevel,
      armorLevel,
      dungeonCores,
      gatesUnlocked,
      dungeonCore_gc: dungeonCores.gc,
      dungeonCore_stack: dungeonCores.stack,
      dungeonCore_microwave: dungeonCores.microwave,
      shieldHP: armorPoints,
      armorPoints,
      maxArmorPoints: Number.isFinite(Number(src.maxArmorPoints)) ? Number(src.maxArmorPoints) : 3,
      hasPermission_elder,
      hasPermission_blacksmith,
      hasPermission_herbalist,
      hasPermission_guard,
      hasPermission_oracle,
      housePermissions,
      armorTempleSolved: Boolean(src.armorTempleSolved),
      swordTempleSolved: Boolean(src.swordTempleSolved),
      abyssPortalUnlocked: Boolean(src.abyssPortalUnlocked),
      playTimeSeconds,
      totalDeaths,
      gameTimeMinutes: Number.isFinite(Number(src.gameTimeMinutes)) ? Number(src.gameTimeMinutes) : 8 * 60,
      inventoryItems: Array.isArray(src.inventoryItems) ? src.inventoryItems : [],
      unlockedRegions: Array.isArray(src.unlockedRegions) ? src.unlockedRegions : ['village'],
      savedAt: Number.isFinite(Number(src.savedAt)) ? Number(src.savedAt) : Date.now()
    };
  }

  /**
   * Devuelve el estado actual de sincronización para el micro-indicador del HUD (☁️)
   */
  static getSyncState() {
    const container = getLocalSaveContainer();
    const code = CloudStorage._lastCloudCode || container?.cloudCode || getSavedCloudCode() || null;
    if (CloudStorage._inFlightSave) {
      return {
        status: 'syncing',
        code,
        pending: true,
        lastSyncTime: CloudStorage._lastSyncTime
      };
    }
    if (container && container.pendingCloudSync) {
      return {
        status: CloudStorage._syncStatus === 'offline' ? 'offline' : 'pending',
        code,
        pending: true,
        lastSyncTime: CloudStorage._lastSyncTime
      };
    }
    return {
      status: CloudStorage._syncStatus || 'synced',
      code,
      pending: false,
      lastSyncTime: CloudStorage._lastSyncTime || container?.cloudSyncedAt || 0
    };
  }

  /**
   * Guarda primero en localStorage en 0 ms y lanza la subida a `/api/save` en background
   * sin bloquear jamás el hilo de renderizado.
   */
  static saveGameAsync(rawPayload, nickname = 'HERO', onComplete = null) {
    const cleanPayload = CloudStorage.sanitizeSaveData(rawPayload);
    if (!cleanPayload) {
      if (typeof onComplete === 'function') {
        onComplete({ ok: false, error: 'INVALID_PAYLOAD' });
      }
      return { ok: false, localSaved: false };
    }

    const existingCode = CloudStorage._lastCloudCode || getSavedCloudCode() || null;

    // 1. Prioridad 0ms en localStorage (síncrono e instantáneo)
    const localSaved = saveLocalFallback(cleanPayload, existingCode, true);
    CloudStorage._syncStatus = 'syncing';
    CloudStorage._inFlightSave = true;

    // 2. Sincronización en paralelo no bloqueante hacia Vercel KV
    Promise.resolve().then(async () => {
      try {
        const res = await uploadGameToCloud(cleanPayload, nickname, existingCode);
        CloudStorage._inFlightSave = false;

        if (res && res.ok && res.code) {
          CloudStorage._lastCloudCode = res.code;
          CloudStorage._lastSyncTime = res.savedAt || Date.now();
          CloudStorage._syncStatus = 'synced';
          CloudStorage._lastError = null;
          setSavedCloudCode(res.code);
          markLocalFallbackSynced(res.code, CloudStorage._lastSyncTime);
          if (typeof onComplete === 'function') {
            onComplete({
              ok: true,
              synced: true,
              code: res.code,
              savedAt: CloudStorage._lastSyncTime,
              saveData: cleanPayload
            });
          }
        } else {
          CloudStorage._syncStatus = res?.error === 'MODO_OFFLINE' ? 'offline' : 'pending';
          CloudStorage._lastError = res?.message || 'Error de sincronización cloud';
          if (typeof onComplete === 'function') {
            onComplete({
              ok: false,
              synced: false,
              localSaved,
              code: existingCode,
              error: res?.error || 'CLOUD_SYNC_ERROR',
              message: res?.message || 'Guardado en fallback local; pendiente de nube.'
            });
          }
        }
      } catch (err) {
        CloudStorage._inFlightSave = false;
        CloudStorage._syncStatus = 'offline';
        CloudStorage._lastError = err?.message || 'Offline';
        if (typeof onComplete === 'function') {
          onComplete({
            ok: false,
            synced: false,
            localSaved,
            code: existingCode,
            error: 'NETWORK_EXCEPTION',
            message: err?.message || 'Sin conexión a la nube.'
          });
        }
      }
    });

    return {
      ok: true,
      localSaved,
      code: existingCode,
      saveData: cleanPayload
    };
  }

  /**
   * Carga y sanitiza el contenedor local (0 ms)
   */
  static loadLocalSave() {
    const container = getLocalSaveContainer();
    if (!container || !container.savePayload) return null;
    const sanitized = CloudStorage.sanitizeSaveData(container.savePayload);
    return {
      ...container,
      savePayload: sanitized
    };
  }

  /**
   * Descarga una partida desde `/api/save?code=...` y la sanitiza antes de inyectarla al juego.
   */
  static async loadFromCloudCode(code) {
    CloudStorage._inFlightSave = true;
    CloudStorage._syncStatus = 'syncing';
    try {
      const res = await downloadGameFromCloud(code);
      CloudStorage._inFlightSave = false;
      if (res && res.ok && res.saveData) {
        const sanitized = CloudStorage.sanitizeSaveData(res.saveData);
        CloudStorage._lastCloudCode = res.code;
        CloudStorage._lastSyncTime = res.savedAt || Date.now();
        CloudStorage._syncStatus = 'synced';
        setSavedCloudCode(res.code);
        saveLocalFallback(sanitized, res.code, false);
        return {
          ok: true,
          code: res.code,
          nickname: res.nickname || 'HERO',
          savedAt: res.savedAt,
          saveData: sanitized
        };
      }
      CloudStorage._syncStatus = 'pending';
      return {
        ok: false,
        error: res?.error || 'LOAD_FAILED',
        message: res?.message || 'No se pudo recuperar la partida desde la nube.'
      };
    } catch (err) {
      CloudStorage._inFlightSave = false;
      CloudStorage._syncStatus = 'offline';
      return {
        ok: false,
        error: 'NETWORK_ERROR',
        message: err?.message || 'Error de red al descargar partida.'
      };
    }
  }

  /**
   * Intenta sincronizar en segundo plano cualquier guardado local pendiente.
   */
  static async syncPendingInBackground(nickname = 'HERO') {
    const res = await syncPendingSaveToCloud(nickname);
    if (res && res.ok && res.synced) {
      CloudStorage._syncStatus = 'synced';
      CloudStorage._lastCloudCode = res.code || CloudStorage._lastCloudCode;
      CloudStorage._lastSyncTime = Date.now();
    }
    return res;
  }

  /**
   * Consulta el Top 10 del Salón de la Fama con sanitización de filas
   */
  static async fetchTopLeaderboard(limit = 10) {
    const res = await fetchGlobalLeaderboard();
    const rawList = Array.isArray(res?.leaderboard) ? res.leaderboard : [];
    const normalized = rawList.slice(0, limit).map((item, idx) => {
      const secs = Math.max(0, Math.floor(Number(item?.playTimeSeconds) || 0));
      const deaths = Math.max(0, Math.floor(Number(item?.deaths) || 0));
      const calc = calculateGameScore(secs, deaths);
      return {
        position: idx + 1,
        username: String(item?.username || 'HERO').slice(0, 12).toUpperCase(),
        playTimeSeconds: secs,
        playTimeFormatted: item?.playTimeFormatted || formatPlayTime(secs),
        deaths,
        bytes: Math.max(0, Math.floor(Number(item?.bytes ?? item?.coins) || 0)),
        score: Number.isFinite(Number(item?.score)) ? Number(item.score) : calc.score,
        rank: item?.rank || calc.rank,
        title: item?.title || calc.title
      };
    });

    return {
      ok: Boolean(res?.ok),
      source: res?.source || 'local',
      configured: res?.configured !== false,
      error: res?.error || null,
      leaderboard: normalized
    };
  }

  /**
   * Publica la puntuación en localStorage (0ms) y en `/api/leaderboard` en paralelo
   */
  static async submitRunScore(data = {}) {
    return submitGlobalScore(data);
  }
}

export {
  SAVE_STORAGE_KEY,
  CLOUD_SAVE_CODE_KEY,
  LOCAL_LEADERBOARD_KEY
};

