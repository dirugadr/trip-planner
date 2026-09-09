import app from './app.js';
import config from './config/index.js';
import { initDatabase, runMigrations } from './db/database.js';

// Local / long-running server entry point.
// On Vercel the app is served by api/index.js and this file is not used.
async function start() {
  try {
    console.log('\n🚀 Starting Trip Planner Backend...\n');

    console.log('📦 Initializing database...');
    await initDatabase();
    await runMigrations();

    const server = app.listen(config.port, config.host, () => {
      console.log(`\n✅ Server running at http://${config.host}:${config.port}`);
      console.log(`📍 Health check: http://${config.host}:${config.port}/health\n`);
      console.log('   GET    /api/trips          - List all trips');
      console.log('   POST   /api/trips          - Create new trip');
      console.log('   GET    /api/trips/:id      - Get trip with days and activities');
      console.log('   PUT    /api/trips/:id      - Update trip');
      console.log('   DELETE /api/trips/:id      - Delete trip\n');
      console.log('   POST   /api/activities     - Create activity');
      console.log('   GET    /api/activities/:id - Get activity details');
      console.log('   PUT    /api/activities/:id - Update activity');
      console.log('   DELETE /api/activities/:id - Delete activity\n');
    });

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
