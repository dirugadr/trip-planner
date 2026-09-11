import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config/index.js';
import authRouter from './api/auth.js';
import { requireAuth } from './middleware/requireAuth.js';
import tripsRouter from './api/trips.js';
import daysRouter from './api/days.js';
import activitiesRouter from './api/activities.js';
import budgetCategoriesRouter from './api/budgetCategories.js';
import expensesRouter from './api/expenses.js';
import paymentMethodsRouter from './api/paymentMethods.js';
import accommodationsRouter from './api/accommodations.js';
import poisRouter from './api/pois.js';
import documentsRouter from './api/documents.js';
import linksRouter from './api/links.js';
import routeTemplatesRouter from './api/routeTemplates.js';

const app = express();

// Behind Vercel's proxy — trust the first hop (for req.ip / rate limiting).
app.set('trust proxy', 1);

// ============================================
// Middleware
// ============================================
app.use(helmet());
app.use(cors(config.cors));
app.use(express.json({ limit: '100kb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
  next();
});

// Rate limiting. In-memory store: best-effort on serverless (resets per cold
// start, not shared across instances) but still blunts bursts from one client.
const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas solicitudes, probá en un minuto' }
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos de acceso, probá más tarde' }
});
app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);

// ============================================
// Health check
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), environment: config.env });
});

// ============================================
// API Routes
// ============================================
// Public: login + session check
app.use('/api/auth', authRouter);

// Everything else under /api requires a valid session
app.use('/api', requireAuth);

app.use('/api/trips', tripsRouter);
app.use('/api/days', daysRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/budget-categories', budgetCategoriesRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/payment-methods', paymentMethodsRouter);
app.use('/api/accommodations', accommodationsRouter);
// POIs (HU-2.1): /api/poi-categories, /api/trips/:tripId/pois, /api/pois/:id
app.use('/api', poisRouter);
// Documentos (Épica 6): /api/trips/:tripId/documents, /api/documents/:id
app.use('/api', documentsRouter);
// Links de interés (Épica 9): /api/trips/:tripId/links, /api/links/:id, /api/trips/:tripId/tags
app.use('/api', linksRouter);
// Recorridos visuales (HU-2.6): /api/trips/:tripId/route-templates, /api/route-templates/:id
app.use('/api', routeTemplatesRouter);

// ============================================
// 404 Handler
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
});

// ============================================
// Error Handler
// ============================================
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: config.env === 'production' ? 'Internal server error' : err.message,
  });
});

export default app;
