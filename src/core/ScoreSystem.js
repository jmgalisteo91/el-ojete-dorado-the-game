/**
 * ScoreSystem.js · Sistema de Puntuación, Rangos y Salón de la Fama (Leaderboard)
 * 
 * Evalúa el desempeño final del jugador en función del tiempo de compilación (playTimeSeconds)
 * y el número de bugs fatales (muertes totales), asignando una puntuación arcade y un rango de S a C:
 * 
 * - Rango S: < 12 minutos (720s) y 0 muertes (Deathless Speedrun). Score >= 85.000 pts.
 * - Rango A: < 20 minutos (1200s) y <= 2 muertes. Score >= 65.000 pts.
 * - Rango B: < 35 minutos (2100s) y <= 6 muertes. Score >= 40.000 pts.
 * - Rango C: Más de 35 minutos o más de 6 muertes. Score < 40.000 pts.
 */

export const LOCAL_LEADERBOARD_KEY = 'el_ojete_dorado_leaderboard_v1';

export const DEFAULT_LEADERBOARD = [
  {
    username: 'AURELIO_DEV',
    playTimeSeconds: 672,
    playTimeFormatted: '11:12',
    deaths: 0,
    score: 93280,
    rank: 'S',
    title: 'Arquitecto Supremo del Gran Ojal',
    date: '2026-11-01'
  },
  {
    username: 'ORION_AI',
    playTimeSeconds: 835,
    playTimeFormatted: '13:55',
    deaths: 1,
    score: 86650,
    rank: 'A',
    title: 'Senior Lead de Valleverde',
    date: '2026-11-02'
  },
  {
    username: 'BYTE_SLAYER',
    playTimeSeconds: 1080,
    playTimeFormatted: '18:00',
    deaths: 2,
    score: 79200,
    rank: 'A',
    title: 'Senior Lead de Valleverde',
    date: '2026-11-03'
  },
  {
    username: 'BUG_HUNTER',
    playTimeSeconds: 1420,
    playTimeFormatted: '23:40',
    deaths: 3,
    score: 70800,
    rank: 'A',
    title: 'Senior Lead de Valleverde',
    date: '2026-11-03'
  },
  {
    username: 'JUNIOR_REDO',
    playTimeSeconds: 1850,
    playTimeFormatted: '30:50',
    deaths: 5,
    score: 56500,
    rank: 'B',
    title: 'Programador Competente',
    date: '2026-11-04'
  }
];

/**
 * Formatea segundos a MM:SS o HH:MM:SS
 */
export function formatPlayTime(seconds = 0) {
  const totalSec = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Calcula la puntuación numérica y asigna el rango de S a C
 * Acepta argumentos posicionales (playTimeSeconds, deaths) o un objeto ({ playTimeSeconds, deaths })
 */
export function calculateGameScore(arg1 = 0, arg2 = 0) {
  let playTimeSeconds = 0;
  let deaths = 0;

  if (typeof arg1 === 'object' && arg1 !== null) {
    playTimeSeconds = arg1.playTimeSeconds ?? arg1.time ?? 0;
    deaths = arg1.deaths ?? arg1.totalDeaths ?? 0;
  } else {
    playTimeSeconds = typeof arg1 === 'number' ? arg1 : 0;
    deaths = typeof arg2 === 'number' ? arg2 : 0;
  }

  const t = Math.max(0, Math.round(playTimeSeconds));
  const m = Math.max(0, Math.floor(deaths));

  const baseScore = 100000;
  const timePenalty = t * 10;
  const deathPenalty = m * 5000;
  const finalScore = Math.max(0, baseScore - timePenalty - deathPenalty);

  let rank = 'C';
  let title = 'Junior Superviviente del Despido';
  let color = '#f87171'; // Coral / Rojo suave

  // Rango S: <= 12 minutos (720s) y 0 muertes (Score >= 85.000)
  if (t <= 720 && m === 0) {
    rank = 'S';
    title = 'Arquitecto Supremo del Gran Ojal';
    color = '#fde047'; // Oro brillante
  } else if (finalScore >= 65000 && m <= 2 && t <= 1200) {
    // Rango A: >= 65k, <= 2 muertes, <= 20 min
    rank = 'A';
    title = 'Senior Lead de Valleverde';
    color = '#38bdf8'; // Cyan
  } else if (finalScore >= 40000 && m <= 6 && t <= 2100) {
    // Rango B: >= 40k, <= 6 muertes, <= 35 min
    rank = 'B';
    title = 'Programador Competente';
    color = '#4ade80'; // Verde
  } else {
    // Rango C
    rank = 'C';
    title = 'Junior Superviviente del Despido';
    color = '#f87171';
  }

  const formatted = formatPlayTime(t);

  return {
    score: finalScore,
    rank,
    title,
    color,
    playTimeSeconds: t,
    playTimeFormatted: formatted,
    timeFormatted: formatted,
    deaths: m,
    breakdown: {
      baseScore,
      timePenalty,
      deathPenalty
    }
  };
}

/**
 * Obtiene la lista local de récords guardados en localStorage
 */
export function getLocalLeaderboard() {
  if (typeof localStorage === 'undefined') {
    return [...DEFAULT_LEADERBOARD];
  }
  try {
    const raw = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(DEFAULT_LEADERBOARD));
      return [...DEFAULT_LEADERBOARD];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(DEFAULT_LEADERBOARD));
      return [...DEFAULT_LEADERBOARD];
    }
    // Ordenar por score descendente, y tiempo ascendente en desempate
    return parsed.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.playTimeSeconds - b.playTimeSeconds;
    });
  } catch (err) {
    console.warn('Error al leer Leaderboard local:', err);
    return [...DEFAULT_LEADERBOARD];
  }
}

/**
 * Guarda una nueva puntuación en el Leaderboard local
 */
export function saveLocalScore(data = {}) {
  const username = data.username || data.name || 'HERO';
  let cleanName = (username || '').trim().toUpperCase().replace(/[^A-Z0-9_\-\.]/g, '');
  if (cleanName.length < 3) {
    cleanName = cleanName.length > 0 ? cleanName.padEnd(3, '_') : 'HERO';
  }
  if (cleanName.length > 12) {
    cleanName = cleanName.slice(0, 12);
  }

  const playTimeSeconds = data.playTimeSeconds ?? 0;
  const deaths = data.deaths ?? 0;

  // Si ya viene precalculado con rank y score, usarlo; si no, calcularlo
  const result = (data.score != null && data.rank != null)
    ? {
        playTimeSeconds,
        playTimeFormatted: data.playTimeFormatted || data.timeFormatted || formatPlayTime(playTimeSeconds),
        deaths,
        score: data.score,
        rank: data.rank,
        title: data.title || (calculateGameScore(playTimeSeconds, deaths).title)
      }
    : calculateGameScore({ playTimeSeconds, deaths });

  const entry = {
    username: cleanName,
    playTimeSeconds: result.playTimeSeconds,
    playTimeFormatted: result.playTimeFormatted,
    deaths: result.deaths,
    score: result.score,
    rank: result.rank,
    title: result.title,
    date: (data.date || new Date().toISOString()).split('T')[0]
  };

  const currentList = getLocalLeaderboard();
  currentList.push(entry);

  // Ordenar y recortar al Top 15
  currentList.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.playTimeSeconds - b.playTimeSeconds;
  });

  const topList = currentList.slice(0, 15);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(topList));
    } catch (err) {
      console.warn('Error al guardar Leaderboard local:', err);
    }
  }

  const rankPosition = topList.findIndex(
    (e) => e.username === entry.username && e.score === entry.score && e.playTimeSeconds === entry.playTimeSeconds
  ) + 1;

  return {
    entry,
    position: rankPosition > 0 ? rankPosition : topList.length + 1,
    leaderboard: topList
  };
}

/**
 * Consulta la tabla del Salón de la Fama Global desde la API de Vercel
 */
export async function fetchGlobalLeaderboard() {
  if (typeof fetch === 'undefined' || typeof window === 'undefined') {
    return { ok: true, source: 'local', leaderboard: getLocalLeaderboard() };
  }

  // Si estamos en entorno file:// offline, usar directamente local
  if (window.location && window.location.protocol === 'file:') {
    return { ok: true, source: 'local_file', leaderboard: getLocalLeaderboard() };
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;

  try {
    const res = await fetch('/api/leaderboard', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller ? controller.signal : undefined
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) {
      return { ok: false, source: 'local_fallback', leaderboard: getLocalLeaderboard() };
    }

    const data = await res.json();
    if (data && Array.isArray(data.leaderboard)) {
      return {
        ok: true,
        source: data.source || 'cloud',
        configured: data.configured !== false,
        leaderboard: data.leaderboard
      };
    }
    return { ok: true, source: 'local', leaderboard: getLocalLeaderboard() };
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    return { ok: false, source: 'offline_local', leaderboard: getLocalLeaderboard(), error: err.message };
  }
}

/**
 * Publica una puntuación tanto en el Salón de la Fama Local como en el Global (Vercel API)
 */
export async function submitGlobalScore(data = {}) {
  // 1. Siempre guardar localmente primero para asegurar persistencia
  const localResult = saveLocalScore(data);

  // 2. Si hay conexión y estamos en http/https, enviar a la API serverless
  if (typeof fetch === 'undefined' || typeof window === 'undefined' || (window.location && window.location.protocol === 'file:')) {
    return {
      ok: true,
      mode: 'local_only',
      position: localResult.position,
      entry: localResult.entry,
      leaderboard: localResult.leaderboard
    };
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 4500) : null;

  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        username: localResult.entry.username,
        playTimeSeconds: localResult.entry.playTimeSeconds,
        deaths: localResult.entry.deaths
      }),
      signal: controller ? controller.signal : undefined
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        ok: true,
        mode: 'local_saved_cloud_error',
        position: localResult.position,
        entry: localResult.entry,
        leaderboard: localResult.leaderboard
      };
    }

    const json = await res.json();
    return {
      ok: true,
      mode: json.source || 'cloud',
      position: json.position || localResult.position,
      entry: json.entry || localResult.entry,
      leaderboard: json.leaderboard || localResult.leaderboard
    };
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    return {
      ok: true,
      mode: 'local_saved_offline',
      position: localResult.position,
      entry: localResult.entry,
      leaderboard: localResult.leaderboard,
      networkError: err.message
    };
  }
}

/**
 * Guarda la partida en la nube mediante Vercel Serverless Function (/api/save)
 */
export async function uploadGameToCloud(savePayload, nickname = 'HERO', code = null) {
  if (typeof fetch === 'undefined' || typeof window === 'undefined' || (window.location && window.location.protocol === 'file:')) {
    return { ok: false, error: 'MODO_OFFLINE', message: 'El guardado en la nube requiere conexión y jugar desde la web (no disponible en archivo local).' };
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        saveData: savePayload,
        nickname,
        code
      }),
      signal: controller ? controller.signal : undefined
    });
    if (timeoutId) clearTimeout(timeoutId);

    const json = await res.json();
    return json;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    return { ok: false, error: 'NETWORK_ERROR', message: `Error de conexión con la nube: ${err.message}` };
  }
}

/**
 * Carga una partida remota desde la nube mediante su código
 */
export async function downloadGameFromCloud(code) {
  if (typeof fetch === 'undefined' || typeof window === 'undefined' || (window.location && window.location.protocol === 'file:')) {
    return { ok: false, error: 'MODO_OFFLINE', message: 'La carga desde la nube requiere conexión web.' };
  }

  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) {
    return { ok: false, error: 'CODE_REQUIRED', message: 'Introduce un código de partida válido.' };
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

  try {
    const res = await fetch(`/api/save?code=${encodeURIComponent(cleanCode)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller ? controller.signal : undefined
    });
    if (timeoutId) clearTimeout(timeoutId);

    const json = await res.json();
    return json;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    return { ok: false, error: 'NETWORK_ERROR', message: `Error de conexión: ${err.message}` };
  }
}
