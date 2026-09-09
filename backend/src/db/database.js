import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db = null;

export function initDatabase() {
  if (db) {
    return db;
  }

  const dbPath = config.db.path;
  const dbDir = path.dirname(dbPath);

  // Ensure directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Set journal mode for better concurrency
  db.pragma('journal_mode = WAL');

  console.log(`✓ Database initialized at: ${dbPath}`);
  
  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('✓ Database connection closed');
  }
}

export function runMigrations() {
  const db = getDatabase();
  
  // Read and execute schema migration
  const schemaPath = path.join(__dirname, '001_initial_schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  
  db.exec(schemaSql);
  console.log('✓ Schema migration executed');

  // Read and execute seed data
  const seedPath = path.join(__dirname, '002_seed_data.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf-8');
  
  db.exec(seedSql);
  console.log('✓ Seed data loaded');
}

// Helper functions for common operations
export function insertOne(table, data) {
  const db = getDatabase();
  const columns = Object.keys(data);
  const placeholders = columns.map(() => '?').join(', ');
  const values = Object.values(data);

  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...values);
    return result.lastInsertRowid;
  } catch (error) {
    console.error(`Error inserting into ${table}:`, error.message);
    throw error;
  }
}

export function updateOne(table, id, data) {
  const db = getDatabase();
  const columns = Object.keys(data);
  const updates = columns.map(col => `${col} = ?`).join(', ');
  const values = [...Object.values(data), id];

  const sql = `UPDATE ${table} SET ${updates} WHERE id = ?`;
  
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...values);
    return result.changes > 0;
  } catch (error) {
    console.error(`Error updating ${table}:`, error.message);
    throw error;
  }
}

export function deleteOne(table, id, soft = false) {
  const db = getDatabase();
  
  if (soft) {
    const sql = `UPDATE ${table} SET deleted_at = datetime('now') WHERE id = ?`;
    const stmt = db.prepare(sql);
    const result = stmt.run(id);
    return result.changes > 0;
  } else {
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    const stmt = db.prepare(sql);
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

export function findById(table, id) {
  const db = getDatabase();
  const sql = `SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`;
  const stmt = db.prepare(sql);
  return stmt.get(id);
}

export function findAll(table, filter = {}) {
  const db = getDatabase();
  
  let sql = `SELECT * FROM ${table} WHERE deleted_at IS NULL`;
  const values = [];

  Object.entries(filter).forEach(([key, value]) => {
    sql += ` AND ${key} = ?`;
    values.push(value);
  });

  sql += ' ORDER BY created_at DESC';
  const stmt = db.prepare(sql);
  return stmt.all(...values);
}

export default {
  initDatabase,
  getDatabase,
  closeDatabase,
  runMigrations,
  insertOne,
  updateOne,
  deleteOne,
  findById,
  findAll
};
