import { randomUUID } from 'crypto';
import { insertOne, updateOne, deleteOne, findById, dbAll, dbRun } from '../db/database.js';

const TABLE = 'pois_saved';
const FIELDS = ['name', 'category_id', 'latitude', 'longitude', 'address', 'city', 'url', 'notes', 'estimated_duration_minutes'];

export class Poi {
  /** Build a full pois_saved row from user data (no DB write). */
  static rowFor(data) {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      trip_id: data.trip_id,
      name: data.name,
      category_id: data.category_id,
      description: data.description ?? null,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address ?? null,
      city: data.city ?? null,
      url: data.url ?? null,
      notes: data.notes ?? null,
      estimated_duration_minutes: data.estimated_duration_minutes ?? null,
      accommodation_id: data.accommodation_id ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    };
  }

  /** INSERT statement for a row from rowFor() — for use inside a dbBatch. */
  static insertStmt(row) {
    const cols = Object.keys(row);
    return {
      sql: `INSERT INTO ${TABLE} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      args: Object.values(row),
    };
  }

  static async create(data) {
    const row = Poi.rowFor(data);
    await insertOne(TABLE, row);
    return row;
  }

  static findById(id) {
    return findById(TABLE, id);
  }

  static findByTripId(tripId) {
    return dbAll(
      `SELECT p.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
         FROM ${TABLE} p
         JOIN poi_categories c ON c.id = p.category_id
        WHERE p.trip_id = ? AND p.deleted_at IS NULL
        ORDER BY p.created_at ASC`,
      [tripId]
    );
  }

  /** The POI auto-generated from an accommodation (HU-8.6), if any. */
  static async findLinkedByAccommodation(accommodationId) {
    const rows = await dbAll(
      `SELECT * FROM ${TABLE}
        WHERE accommodation_id = ? AND deleted_at IS NULL
        LIMIT 1`,
      [accommodationId]
    );
    return rows[0] || null;
  }

  static async deleteByAccommodationId(accommodationId) {
    await dbRun(
      `UPDATE ${TABLE} SET deleted_at = datetime('now')
        WHERE accommodation_id = ? AND deleted_at IS NULL`,
      [accommodationId]
    );
  }

  static async update(id, data) {
    const patch = { updated_at: new Date().toISOString() };
    for (const key of FIELDS) {
      if (key in data) patch[key] = data[key];
    }
    const ok = await updateOne(TABLE, id, patch);
    return ok ? Poi.findById(id) : null;
  }

  static delete(id, soft = true) {
    return deleteOne(TABLE, id, soft);
  }
}

export default Poi;
