import { randomUUID } from 'crypto';
import { insertOne, dbAll } from '../db/database.js';

const TABLE = 'tags';

/**
 * Tags are scoped per trip and reused across links. Names are normalized to
 * lowercase + trimmed at write time so "Comida" and "comida" resolve to the
 * same tag within a trip (UNIQUE(trip_id, name) enforces it at the DB level
 * too, for concurrent requests).
 */
export class Tag {
  static normalize(name) {
    return (name ?? '').toString().trim().toLowerCase();
  }

  static findByTripId(tripId) {
    return dbAll(`SELECT id, name FROM ${TABLE} WHERE trip_id = ? ORDER BY name ASC`, [tripId]);
  }

  /** Find-or-create each name for the trip; returns the resolved tag rows (dedup'd). */
  static async resolveMany(tripId, names) {
    const clean = [...new Set((names || []).map(Tag.normalize).filter(Boolean))];
    if (clean.length === 0) return [];

    const placeholders = clean.map(() => '?').join(', ');
    const existing = await dbAll(
      `SELECT id, name FROM ${TABLE} WHERE trip_id = ? AND name IN (${placeholders})`,
      [tripId, ...clean]
    );
    const existingNames = new Set(existing.map((t) => t.name));
    const toCreate = clean.filter((n) => !existingNames.has(n));

    const created = [];
    for (const name of toCreate) {
      try {
        const row = { id: randomUUID(), trip_id: tripId, name, created_at: new Date().toISOString() };
        await insertOne(TABLE, row);
        created.push(row);
      } catch {
        // Lost a race with a concurrent request creating the same tag — reuse it.
        const row = await dbAll(`SELECT id, name FROM ${TABLE} WHERE trip_id = ? AND name = ?`, [tripId, name]);
        if (row[0]) created.push(row[0]);
      }
    }
    return [...existing, ...created];
  }
}

export default Tag;
