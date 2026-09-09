import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import '../config/index.js'; // loads backend/.env into process.env

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Connection config.
 * - Production (Vercel): TURSO_DATABASE_URL + TURSO_AUTH_TOKEN point at Turso.
 * - Local dev: no env vars -> a plain SQLite file in the repo root.
 */
function resolveConfig() {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    return { url, authToken: process.env.TURSO_AUTH_TOKEN };
  }
  const localPath = path.join(__dirname, '../../../trip-planner.db');
  return { url: `file:${localPath}` };
}

let client = null;

export function getClient() {
  if (!client) {
    client = createClient(resolveConfig());
  }
  return client;
}

// Legacy alias — some code still calls getDatabase()
export const getDatabase = getClient;

export async function initDatabase() {
  // libSQL connects lazily; instantiating here surfaces config errors early.
  getClient();
}

export async function closeDatabase() {
  if (client) {
    client.close();
    client = null;
    console.log('✓ Database connection closed');
  }
}

export async function runMigrations() {
  const c = getClient();

  const schemaSql = fs.readFileSync(path.join(__dirname, '001_initial_schema.sql'), 'utf-8');
  await c.executeMultiple(schemaSql);
  console.log('✓ Schema migration executed');

  const seedSql = fs.readFileSync(path.join(__dirname, '002_seed_data.sql'), 'utf-8');
  await c.executeMultiple(seedSql);
  console.log('✓ Seed data loaded');
}

// ============================================
// Low-level query helpers
// ============================================

function rowToObject(row, columns) {
  const obj = {};
  for (const col of columns) obj[col] = row[col];
  return obj;
}

export async function dbRun(sql, params = []) {
  const rs = await getClient().execute({ sql, args: params });
  return {
    lastID: rs.lastInsertRowid != null ? Number(rs.lastInsertRowid) : undefined,
    changes: rs.rowsAffected,
  };
}

export async function dbGet(sql, params = []) {
  const rs = await getClient().execute({ sql, args: params });
  return rs.rows.length ? rowToObject(rs.rows[0], rs.columns) : undefined;
}

export async function dbAll(sql, params = []) {
  const rs = await getClient().execute({ sql, args: params });
  return rs.rows.map((row) => rowToObject(row, rs.columns));
}

// ============================================
// Common CRUD helpers
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

export default { initDatabase, getClient, getDatabase, closeDatabase, runMigrations };
