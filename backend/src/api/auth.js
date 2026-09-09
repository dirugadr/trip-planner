import express from 'express';
import { authConfigError } from '../config/index.js';
import {
  verifyGoogleToken,
  isEmailAllowed,
  signSessionToken,
  verifySessionToken,
  bearerToken
} from '../lib/auth.js';

const router = express.Router();

// POST /api/auth/login - exchange a Google ID token for a session token
router.post('/login', async (req, res) => {
  const configErr = authConfigError();
  if (configErr) {
    return res.status(503).json({ success: false, error: configErr });
  }

  const { credential } = req.body || {};
  if (!credential) {
    return res.status(400).json({ success: false, error: 'Falta el token de Google (credential)' });
  }

  let gUser;
  try {
    gUser = await verifyGoogleToken(credential);
  } catch {
    return res.status(401).json({ success: false, error: 'Token de Google inválido' });
  }

  if (!gUser.email || !gUser.email_verified) {
    return res.status(403).json({ success: false, error: 'La cuenta de Google no tiene un email verificado' });
  }

  if (!isEmailAllowed(gUser.email)) {
    return res.status(403).json({
      success: false,
      error: 'Tu cuenta no está habilitada para usar esta app'
    });
  }

  const user = { email: gUser.email, name: gUser.name, picture: gUser.picture };
  const token = await signSessionToken(user);

  res.json({ success: true, data: { token, user } });
});

// GET /api/auth/me - validate a session token and return the user (for session restore)
router.get('/me', async (req, res) => {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }
  try {
    const user = await verifySessionToken(token);
    res.json({ success: true, data: { user } });
  } catch {
    res.status(401).json({ success: false, error: 'Sesión inválida o expirada' });
  }
});

export default router;
