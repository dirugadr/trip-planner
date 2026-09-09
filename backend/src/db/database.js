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
    const schemaPath = path.join(__dirname, '001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    db.exec(schemaSql, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('✓ Schema migration executed');

        // Read and execute seed data
        const seedPath = path.join(__dirname, '002_seed_data.sql');
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

// ============================================
// Promisified low-level helpers
// ============================================

export function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().run(sql, params, function (err) {
      if (err) reject(err);
      // `this` carries lastID / changes for INSERT/UPDATE/DELETE
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ============================================
// Helper functions for common operations
// ============================================

export async function insertOne(table, data) {
  const columns = Object.keys(data);
  const placeholders = columns.map(() => '?').join(', ');
  const values = Object.values(data);

  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

  try {
    const result = await dbRun(sql, values);
    return result.lastID;
  } catch (error) {
    console.error(`Error inserting into ${table}:`, error.message);
    throw error;
  }
}

export async function updateOne(table, id, data) {
  const columns = Object.keys(data);
  const updates = columns.map((col) => `${col} = ?`).join(', ');
  const values = [...Object.values(data), id];

  const sql = `UPDATE ${table} SET ${updates} WHERE id = ?`;

  try {
    const result = await dbRun(sql, values);
    return result.changes > 0;
  } catch (error) {
    console.error(`Error updating ${table}:`, error.message);
    throw error;
  }
}

export async function deleteOne(table, id, soft = false) {
  const sql = soft
    ? `UPDATE ${table} SET deleted_at = datetime('now') WHERE id = ?`
    : `DELETE FROM ${table} WHERE id = ?`;

  const result = await dbRun(sql, [id]);
  return result.changes > 0;
}

export async function findById(table, id) {
  const sql = `SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`;
  return dbGet(sql, [id]);
}

export async function findAll(table, filter = {}) {
  let sql = `SELECT * FROM ${table} WHERE deleted_at IS NULL`;
  const values = [];

  Object.entries(filter).forEach(([key, value]) => {
    sql += ` AND ${key} = ?`;
    values.push(value);
  });

  return dbAll(sql, values);
}

export default { initDatabase, getDatabase, closeDatabase, runMigrations };
