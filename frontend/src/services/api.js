import axios from 'axios';

/**
 * Shared axios instance. Vite proxies /api -> http://localhost:3000 in dev
 * (see vite.config.js). In production set VITE_API_URL to the backend origin.
 */
const client = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
  headers: { 'Content-Type': 'application/json' },
});

/**
 * The backend wraps every response as { success, data, error, message }.
 * Unwrap it here so callers work with plain data and thrown Errors.
 */
function unwrap(response) {
  const body = response.data;
  if (body && body.success === false) {
    const err = new Error(body.error || 'Request failed');
    err.warning = body.warning || false;
    throw err;
  }
  return body?.data ?? body;
}

function toError(error) {
  if (error.response?.data?.error) {
    const err = new Error(error.response.data.error);
    err.status = error.response.status;
    err.warning = error.response.data.warning || false;
    return err;
  }
  if (error.request && !error.response) {
    return new Error('No se pudo conectar con el servidor');
  }
  return error;
}

export async function apiGet(path) {
  try {
    return unwrap(await client.get(path));
  } catch (e) {
    throw toError(e);
  }
}

export async function apiPost(path, payload) {
  try {
    return unwrap(await client.post(path, payload));
  } catch (e) {
    throw toError(e);
  }
}

export async function apiPut(path, payload) {
  try {
    return unwrap(await client.put(path, payload));
  } catch (e) {
    throw toError(e);
  }
}

export async function apiDelete(path) {
  try {
    return unwrap(await client.delete(path));
  } catch (e) {
    throw toError(e);
  }
}

export default client;
