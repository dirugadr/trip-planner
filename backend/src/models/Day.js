import { v4 as uuidv4 } from 'uuid';
import { getDatabase, insertOne, updateOne, deleteOne, findById } from '../db/database.js';

const TABLE = 'days';

export class Day {
  static create(data) {
    const day = {
      id: uuidv4(),
      trip_id: data.trip_id,
      day_number: data.day_number,
      date: data.date,
      title: data.title || null,
      notes: data.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      version: 1
    };

    insertOne(TABLE, day);
    return day;
  }

  static findById(id) {
    return findById(TABLE, id);
  }

  static findByTripId(tripId) {
    const db = getDatabase();
    const sql = `SELECT * FROM ${TABLE} WHERE trip_id = ? AND deleted_at IS NULL ORDER BY day_number ASC`;
    const stmt = db.prepare(sql);
    return stmt.all(tripId);
  }

  static update(id, data) {
    const updates = {
      ...data,
      updated_at: new Date().toISOString(),
      version: (data.version || 0) + 1
    };

    const success = updateOne(TABLE, id, updates);
    if (success) {
      return Day.findById(id);
    }
    return null;
  }

  static delete(id, soft = true) {
    return deleteOne(TABLE, id, soft);
  }

  static getActivities(dayId) {
    const db = getDatabase();
    const sql = `SELECT * FROM activities WHERE day_id = ? AND deleted_at IS NULL ORDER BY start_time ASC`;
    const stmt = db.prepare(sql);
    return stmt.all(dayId);
  }

  static getTotalDuration(dayId) {
    const db = getDatabase();
    const result = db.prepare(
      `SELECT SUM(duration_minutes) as total FROM activities 
       WHERE day_id = ? AND deleted_at IS NULL`
    ).get(dayId);
    return result?.total || 0;
  }
}

export default Day;
