/**
 * api/save.js · API Serverless para Guardado y Carga de Partidas en la Nube (Cloud Save)
 * Permite a los jugadores sincronizar y reanudar su aventura en cualquier dispositivo mediante un código de 6 caracteres.
 */
import { isStorageConfigured, kvGet, kvSet } from './_db.js';

const SAVE_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 días de retención

function generateSaveCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluye O, 0, 1, I para evitar confusiones
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `OJT-${code}`;
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

  // GET: Cargar partida por código
  if (req.method === 'GET') {
    const { searchParams } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const rawCode = searchParams.get('code') || '';
    const code = rawCode.trim().toUpperCase();

    if (!code || code.length < 4) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_CODE',
        message: 'Debes proporcionar un código de guardado válido (ej: OJT-7K9B).'
      });
    }

    if (!isStorageConfigured()) {
      return res.status(503).json({
        ok: false,
        error: 'STORAGE_UNCONFIGURED',
        message: 'El almacenamiento en la nube no está configurado en este servidor.'
      });
    }

    try {
      const data = await kvGet(`game:cloud_save:${code}`);
      if (!data || !data.savePayload) {
        return res.status(404).json({
          ok: false,
          error: 'SAVE_NOT_FOUND',
          message: `No existe ninguna partida guardada con el código "${code}". Verifica el código e inténtalo de nuevo.`
        });
      }

      return res.status(200).json({
        ok: true,
        code,
        saveData: data.savePayload,
        savedAt: data.savedAt,
        nickname: data.nickname || 'Aventurero'
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: 'CLOUD_READ_FAILED',
        message: err.message
      });
    }
  }

  // POST: Guardar partida en la nube y generar código
  if (req.method === 'POST') {
    const body = await parseBody(req);
    const savePayload = body.saveData || body.savePayload || body;
    const nickname = (body.nickname || 'HERO').toString().slice(0, 16);

    if (!savePayload || typeof savePayload !== 'object' || !savePayload.sceneId) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_SAVE_DATA',
        message: 'El paquete de guardado no contiene los datos obligatorios de la partida.'
      });
    }

    if (!isStorageConfigured()) {
      return res.status(503).json({
        ok: false,
        error: 'STORAGE_UNCONFIGURED',
        message: 'Para activar guardado en la nube permanente, añade Vercel KV / Upstash en las variables de entorno.'
      });
    }

    // Usar código existente si el jugador ya tenía uno, o generar uno nuevo
    let code = (body.code || '').trim().toUpperCase();
    if (!code || !code.startsWith('OJT-')) {
      code = generateSaveCode();
    }

    const record = {
      code,
      nickname,
      savePayload,
      savedAt: Date.now()
    };

    try {
      const { ok, error } = await kvSet(`game:cloud_save:${code}`, record, SAVE_TTL_SECONDS);
      if (!ok) {
        return res.status(500).json({
          ok: false,
          error: 'STORAGE_WRITE_ERROR',
          message: error
        });
      }

      return res.status(200).json({
        ok: true,
        code,
        savedAt: record.savedAt,
        message: `Partida guardada exitosamente en la nube con código: ${code}`
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: 'SAVE_FAILED',
        message: err.message
      });
    }
  }

  return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}
