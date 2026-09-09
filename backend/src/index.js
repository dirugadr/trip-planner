import express from 'express';
import cors from 'cors';
import { initDatabase, runMigrations } from './db/database.js';
import config from './config/index.js';
import tripsRouter from './api/trips.js';
import activitiesRouter from './api/activities.js';

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
    environment: config.env
  });
});

// ============================================
// API Routes
// ============================================
app.use('/api/trips', tripsRouter);
app.use('/api/activities', activitiesRouter);

// ============================================
// 404 Handler
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`
  });
});

// ============================================
// Error Handler
// ============================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: config.env === 'production' ? 'Internal server error' : err.message
  });
});

// ============================================
// Start Server
// ============================================
async function start() {
  try {
    console.log('\n🚀 Starting Trip Planner Backend...\n');

    // Initialize database
    console.log('📦 Initializing database...');
    await initDatabase();
    await runMigrations();

    // Start server
    const server = app.listen(config.port, config.host, () => {
      console.log(`\n✅ Server running at http://${config.host}:${config.port}`);
      console.log(`📍 Health check: http://${config.host}:${config.port}/health`);
      console.log(`📚 API Docs:\n`);
      console.log(`   GET    /api/trips          - List all trips`);
      console.log(`   POST   /api/trips          - Create new trip`);
      console.log(`   GET    /api/trips/:id      - Get trip with days and activities`);
      console.log(`   PUT    /api/trips/:id      - Update trip`);
      console.log(`   DELETE /api/trips/:id      - Delete trip`);
      console.log(`\n   POST   /api/activities     - Create activity`);
      console.log(`   GET    /api/activities/:id - Get activity details`);
      console.log(`   PUT    /api/activities/:id - Update activity`);
      console.log(`   DELETE /api/activities/:id - Delete activity\n`);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Shutting down gracefully...');
      server.close(() => {
        console.log('✓ Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:');
    console.error(error);
    process.exit(1);
  }
}

start();

export default app;
