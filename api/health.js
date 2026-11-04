/**
 * api/health.js · Verificación del estado de servicios en la nube
 */
import { isStorageConfigured, redisCommand } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache');

  if (!isStorageConfigured()) {
    return res.status(200).json({
      status: 'local_mode',
      storage: 'unconfigured',
      message: 'Vercel KV / Upstash no vinculado. Operando en modo local (localStorage).',
      timestamp: Date.now()
    });
  }

  try {
    const { result, error } = await redisCommand(['PING']);
    if (error) {
      return res.status(200).json({
        status: 'storage_error',
        storage: 'disconnected',
        error,
        timestamp: Date.now()
      });
    }

    return res.status(200).json({
      status: 'ok',
      storage: 'connected',
      ping: result,
      timestamp: Date.now()
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      storage: 'error',
      error: err.message,
      timestamp: Date.now()
    });
  }
}

