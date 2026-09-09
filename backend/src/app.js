import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import authRouter from './api/auth.js';
import { requireAuth } from './middleware/requireAuth.js';
import tripsRouter from './api/trips.js';
import daysRouter from './api/days.js';
import activitiesRouter from './api/activities.js';
import budgetCategoriesRouter from './api/budgetCategories.js';
import expensesRouter from './api/expenses.js';
import paymentMethodsRouter from './api/paymentMethods.js';

const app = express();

// ============================================
// Middleware
// ============================================
app.use(cors(config.cors));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
  next();
});

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
