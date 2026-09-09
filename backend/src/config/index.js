import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Repo-root .env for local dev; on Vercel/Turso the vars come from the platform.
dotenv.config({
  path: path.join(__dirname, '../../../.env'),
  override: false
});

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || 'localhost',
  
  db: {
    path: process.env.DB_PATH || path.join(__dirname, '../../trip-planner.db')
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'debug'
  }
};

export default config;
