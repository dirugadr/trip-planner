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
  const url = process.env.TURSO_DATABASE_URL_TP;
  if (url) {
    return { url, authToken: process.env.TURSO_AUTH_TOKEN_TP };
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

  await c.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  );

  const files = fs
    .readdirSync(__dirname)
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort();

  const applied = new Set(
    (await c.execute('SELECT name FROM _migrations')).rows.map((r) => r.name)
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf-8');
    await c.executeMultiple(sql);
    await c.execute({ sql: 'INSERT INTO _migrations (name) VALUES (?)', args: [file] });
    console.log(`✓ Migration applied: ${file}`);
  }
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

/** Run several writes in one round-trip / transaction. `stmts`: [{ sql, args }]. */
export async function dbBatch(stmts) {
  if (stmts.length === 0) return;
  await getClient().batch(stmts, 'write');
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
