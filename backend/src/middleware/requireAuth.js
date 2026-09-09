import { authConfigError } from '../config/index.js';
import { bearerToken, verifySessionToken, isEmailAllowed } from '../lib/auth.js';

/**
 * Gate for protected API routes: requires a valid session token whose email is
 * still on the allowlist. Fails closed (503) if the server isn't configured
 * for auth.
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
  } catch {
    return res.status(401).json({ success: false, error: 'Sesión inválida o expirada' });
  }

  // Re-check the allowlist on every request so removing an email revokes access
  // without waiting for the token to expire.
  if (!isEmailAllowed(req.user.email)) {
    return res.status(401).json({ success: false, error: 'Acceso revocado' });
  }

  next();
}

export default requireAuth;
