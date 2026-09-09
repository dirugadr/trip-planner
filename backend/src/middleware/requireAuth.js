import { authConfigError } from '../config/index.js';
import { bearerToken, verifySessionToken } from '../lib/auth.js';

/**
 * Gate for protected API routes: requires a valid session token.
 * Fails closed (503) if the server isn't configured for auth.
 */
export async function requireAuth(req, res, next) {
  const configErr = authConfigError();
  if (configErr) {
    return res.status(503).json({ success: false, error: configErr });
  }

  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }

  try {
    req.user = await verifySessionToken(token);
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Sesión inválida o expirada' });
  }
}

export default requireAuth;
