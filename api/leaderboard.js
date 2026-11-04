/**
 * api/leaderboard.js · API Serverless del Salón de la Fama Global
 * Compatible con Node.js en Vercel Serverless Functions.
 */
import { isStorageConfigured, kvGet, kvSet } from './_db.js';

const LEADERBOARD_KEY = 'game:global_leaderboard:v1';

const DEFAULT_LEADERBOARD = [
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

function formatPlayTime(seconds = 0) {
  const totalSec = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); } catch (_) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Obtener récords globales
  if (req.method === 'GET') {
    if (!isStorageConfigured()) {
      return res.status(200).json({
        ok: true,
        source: 'local_fallback',
        configured: false,
        message: 'Base de datos en la nube no configurada en Vercel. Mostrando tabla predeterminada.',
        leaderboard: DEFAULT_LEADERBOARD
      });
    }

    try {
      const stored = await kvGet(LEADERBOARD_KEY);
      const list = Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_LEADERBOARD;
      // Ordenar por score desc, tiempo asc
      list.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.playTimeSeconds - b.playTimeSeconds;
      });

      return res.status(200).json({
        ok: true,
        source: 'cloud',
        configured: true,
        leaderboard: list.slice(0, 20)
      });
    } catch (err) {
      return res.status(200).json({
        ok: true,
        source: 'local_fallback',
        configured: true,
        error: err.message,
        leaderboard: DEFAULT_LEADERBOARD
      });
    }
  }

  // POST: Registrar nueva puntuación con validación anti-cheat en el servidor
  if (req.method === 'POST') {
    const body = await parseBody(req);
    const rawName = String(body.username || body.name || 'HERO');
    let cleanName = rawName.trim().toUpperCase().replace(/[^A-Z0-9_\-\.]/g, '');
    if (cleanName.length < 3) cleanName = cleanName.padEnd(3, '_');
    if (cleanName.length > 12) cleanName = cleanName.slice(0, 12);

    const playTimeSeconds = Math.max(10, Math.round(Number(body.playTimeSeconds) || 0));
    const deaths = Math.max(0, Math.floor(Number(body.deaths) || 0));

    // Recalcular puntuación real en el servidor (anti-trampas)
    const baseScore = 100000;
    const timePenalty = playTimeSeconds * 10;
    const deathPenalty = deaths * 5000;
    const finalScore = Math.max(0, baseScore - timePenalty - deathPenalty);

    let rank = 'C';
    let title = 'Junior Superviviente del Despido';
    if (playTimeSeconds <= 720 && deaths === 0) {
      rank = 'S';
      title = 'Arquitecto Supremo del Gran Ojal';
    } else if (finalScore >= 65000 && deaths <= 2 && playTimeSeconds <= 1200) {
      rank = 'A';
      title = 'Senior Lead de Valleverde';
    } else if (finalScore >= 40000 && deaths <= 6 && playTimeSeconds <= 2100) {
      rank = 'B';
      title = 'Programador Competente';
    }

    const entry = {
      username: cleanName,
      playTimeSeconds,
      playTimeFormatted: formatPlayTime(playTimeSeconds),
      deaths,
      score: finalScore,
      rank,
      title,
      date: new Date().toISOString().split('T')[0]
    };

    if (!isStorageConfigured()) {
      return res.status(200).json({
        ok: true,
        source: 'local_only',
        configured: false,
        position: 1,
        entry,
        message: 'Puntuación validada. Para ranking mundial persistente, conecta Vercel KV en el Dashboard.'
      });
    }

    try {
      const stored = await kvGet(LEADERBOARD_KEY);
      let list = Array.isArray(stored) && stored.length > 0 ? stored : [...DEFAULT_LEADERBOARD];
      list.push(entry);

      list.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.playTimeSeconds - b.playTimeSeconds;
      });

      // Guardar Top 50
      const top50 = list.slice(0, 50);
      await kvSet(LEADERBOARD_KEY, top50);

      const position = top50.findIndex(
        e => e.username === entry.username && e.score === entry.score && e.playTimeSeconds === entry.playTimeSeconds
      ) + 1;

      return res.status(200).json({
        ok: true,
        source: 'cloud',
        configured: true,
        position: position > 0 ? position : top50.length + 1,
        entry,
        leaderboard: top50.slice(0, 20)
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: 'DATABASE_SAVE_FAILED',
        message: err.message
      });
    }
  }

  return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

