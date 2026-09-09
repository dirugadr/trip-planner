import { randomUUID } from 'crypto';
import { insertOne, updateOne, deleteOne, findById, dbAll } from '../db/database.js';

const TABLE = 'accommodations';
const FIELDS = ['name', 'check_in', 'check_out', 'address', 'city', 'phone', 'email', 'booking_url'];

export class Accommodation {
  static async create(data) {
    const now = new Date().toISOString();
    const row = {
      id: randomUUID(),
      trip_id: data.trip_id,
      name: data.name,
      check_in: data.check_in,
      check_out: data.check_out,
      address: data.address,
      city: data.city,
      phone: data.phone || null,
      email: data.email || null,
      booking_url: data.booking_url || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1
    };
    await insertOne(TABLE, row);
    return row;
  }

  static findById(id) {
    return findById(TABLE, id);
  }

  static findByTripId(tripId) {
    return dbAll(
      `SELECT * FROM ${TABLE} WHERE trip_id = ? AND deleted_at IS NULL ORDER BY check_in ASC`,
      [tripId]
    );
  }

  static async update(id, data) {
    const patch = { updated_at: new Date().toISOString() };
    for (const key of FIELDS) {
      if (key in data) patch[key] = data[key];
    }
    const ok = await updateOne(TABLE, id, patch);
    return ok ? Accommodation.findById(id) : null;
  }

  static delete(id, soft = true) {
    return deleteOne(TABLE, id, soft);
  }
}

export default Accommodation;
