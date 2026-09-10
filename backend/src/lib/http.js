import config from '../config/index.js';

/**
 * Send a 500 response without leaking internals in production.
 *
 * Route handlers used to do `res.status(500).json({ error: error.message })`,
 * which exposed DB / library error text to clients. This centralises that:
 * the real error always goes to the server log; the client only sees the raw
 * message outside production (where it's useful for debugging).
 */
export function serverError(res, error) {
  console.error('Unhandled route error:', error);
  const message =
    config.env === 'production' ? 'Error interno del servidor' : error?.message || 'Error';
  res.status(500).json({ success: false, error: message });
}

export default serverError;
