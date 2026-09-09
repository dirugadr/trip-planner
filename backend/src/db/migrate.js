#!/usr/bin/env node
/**
 * Migration runner for Trip Planner database
 * Usage: npm run migrate
 */

import { initDatabase, runMigrations, closeDatabase } from './database.js';

async function main() {
  try {
    console.log('🚀 Starting database migration...\n');

    // Initialize database connection
    initDatabase();

    // Run migrations
    runMigrations();

    console.log('\n✅ Database migration completed successfully!');
    console.log('\nNext steps:');
    console.log('  npm run dev       - Start development server');
    console.log('  npm run seed      - Load sample data (optional)');

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();
