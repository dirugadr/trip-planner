import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Repo-root .env for local dev; on Vercel/Turso the vars come from the platform.
dotenv.config({
  path: path.join(__dirname, '../../../.env'),
  override: false
});

// App-specific vars are namespaced with a _TP suffix (shared Vercel account).
// Platform standards (NODE_ENV, PORT, HOST) keep their conventional names.
const env = process.env.NODE_ENV || 'development';
const DEFAULT_JWT_SECRET = 'change-me-in-production';

// JWT secret: required in production, ephemeral-with-warning in dev.
let jwtSecret = process.env.JWT_SECRET_TP || '';
let jwtInsecure = false;
if (!jwtSecret || jwtSecret === DEFAULT_JWT_SECRET) {
  if (env === 'production') {
    jwtInsecure = true; // auth endpoints will 503 until a real secret is set
  } else {
    jwtSecret = crypto.randomBytes(32).toString('hex');
    console.warn('⚠ JWT_SECRET_TP no configurado — usando un secreto efímero (solo dev).');
  }
}

const allowedEmails = (process.env.ALLOWED_EMAILS_TP || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const config = {
  env,
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || 'localhost',

  db: {
    path: process.env.DB_PATH_TP || path.join(__dirname, '../../trip-planner.db')
  },

  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN_TP || '7d',
    insecure: jwtInsecure
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID_TP || ''
  },

  auth: {
    allowedEmails
  },

  cors: {
    origin: process.env.CORS_ORIGIN_TP || 'http://localhost:5173',
    credentials: true
  },

  logging: {
    level: process.env.LOG_LEVEL_TP || 'debug'
  }
};

/**
 * Returns a user-facing message when auth can't operate safely, else null.
 * Used to fail closed (503) instead of running an insecure gate.
 */
export function authConfigError() {
  if (config.jwt.insecure) return 'Auth mal configurada: falta JWT_SECRET_TP en el servidor.';
  if (!config.google.clientId) return 'Auth mal configurada: falta GOOGLE_CLIENT_ID_TP en el servidor.';
  return null;
}

export default config;
