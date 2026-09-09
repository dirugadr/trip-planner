import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../../trip-planner.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = null;

export function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON', (err) => {
          if (err) reject(err);
          else {
            console.log(`✓ Database initialized at: ${dbPath}`);
            resolve(db);
          }
        });
      }
    });
  });
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase() {
  return new Promise((resolve) => {
    if (db) {
      db.close(() => {
        db = null;
        console.log('✓ Database connection closed');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export function runMigrations() {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    // Read and execute schema migration
    const schemaPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    db.exec(schemaSql, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('✓ Schema migration executed');

        // Read and execute seed data
        const seedPath = path.join(__dirname, '../migrations/002_seed_data.sql');
        const seedSql = fs.readFileSync(seedPath, 'utf-8');

        db.exec(seedSql, (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('✓ Seed data loaded');
            resolve();
          }
        });
      }
    });
  });
}

export default { initDatabase, getDatabase, closeDatabase, runMigrations };