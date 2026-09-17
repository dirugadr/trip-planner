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

/**
 * Message for a `.catch()` on an AI-suggestion call, which — unlike a plain
 * try/catch into serverError() — needs to keep a custom status code (502,
 * 503) instead of always 500. Our own thrown errors there always carry
 * `.status` and an already-safe Spanish message; anything else is
 * unexpected and, like serverError(), gets logged but not shown to the
 * client in production.
 */
export function safeErrorMessage(error) {
  if (error?.status) return error.message;
  console.error('Unhandled async error:', error);
  return config.env === 'production' ? 'Error interno del servidor' : error?.message || 'Error';
}

export default serverError;
