import { randomUUID } from 'crypto';
import { insertOne, updateOne, deleteOne, findById, dbAll } from '../db/database.js';

const TABLE = 'pois_saved';
const FIELDS = ['name', 'category_id', 'latitude', 'longitude', 'address', 'url', 'notes'];

export class Poi {
  static async create(data) {
    const now = new Date().toISOString();
    const row = {
      id: randomUUID(),
      trip_id: data.trip_id,
      name: data.name,
      category_id: data.category_id,
      description: data.description ?? null,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address ?? null,
      url: data.url ?? null,
      notes: data.notes ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    };
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
