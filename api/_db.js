/**
 * api/_db.js · Conector ligero a Vercel KV / Upstash Redis
 * 
 * Sin dependencias npm externas: utiliza el fetch() nativo de Node.js 18+ en Vercel.
 * Lee automáticamente `KV_REST_API_URL` o `UPSTASH_REDIS_REST_URL`.
 */

export function getStorageConfig() {
  const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  return { url, token, isConfigured: Boolean(url && token) };
}

export function isStorageConfigured() {
  return getStorageConfig().isConfigured;
}

/**
 * Ejecuta un comando Redis a través de la API REST de Upstash / Vercel KV
 * @param {Array<string|number>} command ej: ['GET', 'key'] o ['SET', 'key', 'val']
 */
export async function redisCommand(command) {
  const { url, token, isConfigured } = getStorageConfig();
  if (!isConfigured) {
    return { result: null, error: 'STORAGE_NOT_CONFIGURED' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(command)
    });

    if (!res.ok) {
      const errText = await res.text();
      return { result: null, error: `REDIS_HTTP_${res.status}: ${errText}` };
    }

    const data = await res.json();
    return { result: data.result, error: null };
  } catch (err) {
    return { result: null, error: err.message };
  }
}

/**
 * Obtiene el valor parseado de una clave
 */
export async function kvGet(key) {
  const { result, error } = await redisCommand(['GET', key]);
  if (error || result === null || result === undefined) return null;
  if (typeof result === 'string') {
    try {
      return JSON.parse(result);
    } catch (_) {
      return result;
    }
  }
  return result;
}

/**
 * Guarda un valor en Redis (con TTL opcional en segundos)
 */
export async function kvSet(key, value, exSeconds = null) {
  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const cmd = exSeconds ? ['SET', key, serialized, 'EX', exSeconds] : ['SET', key, serialized];
  const { result, error } = await redisCommand(cmd);
  return { ok: !error, result, error };
}

