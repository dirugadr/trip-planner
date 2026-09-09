import { v4 as uuidv4 } from 'uuid';
import { insertOne, updateOne, deleteOne, findById, dbGet, dbAll, dbBatch } from '../db/database.js';

const TABLE = 'days';

export class Day {
  static async create(data) {
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

    await insertOne(TABLE, day);
    return day;
  }

  static findById(id) {
    return findById(TABLE, id);
  }

  static findByTripId(tripId) {
    const sql = `SELECT * FROM ${TABLE} WHERE trip_id = ? AND deleted_at IS NULL ORDER BY day_number ASC`;
    return dbAll(sql, [tripId]);
  }

  static async update(id, data) {
    const updates = {
      ...data,
      updated_at: new Date().toISOString(),
      version: (data.version || 0) + 1
    };

    const success = await updateOne(TABLE, id, updates);
    if (success) {
      return Day.findById(id);
    }
    return null;
  }

  static delete(id, soft = true) {
    return deleteOne(TABLE, id, soft);
  }

  static getActivities(dayId) {
    const sql = `SELECT * FROM activities WHERE day_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, start_time ASC`;
    return dbAll(sql, [dayId]);
  }

  static async getTotalDuration(dayId) {
    const result = await dbGet(
      `SELECT SUM(duration_minutes) as total FROM activities
       WHERE day_id = ? AND deleted_at IS NULL`,
      [dayId]
    );
    return result?.total || 0;
  }

  /**
   * Make the trip's days cover exactly [startDate, endDate]:
   * create days for any missing date, then renumber all days by date.
   * Days that fall outside the new range are kept (they may hold activities).
   */
  static async syncToRange(tripId, startDate, endDate) {
    const existing = await dbAll(
      `SELECT date FROM ${TABLE} WHERE trip_id = ? AND deleted_at IS NULL`,
      [tripId]
    );
    const have = new Set(existing.map((d) => d.date));

    const inRange = new Set();
    const missing = [];
    for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().split('T')[0];
      inRange.add(date);
      if (!have.has(date)) missing.push(date);
    }

    // Days that fell out of the new range are dropped only if empty — a day with
    // activities is kept so the user doesn't lose work.
    const emptyDays = await dbAll(
      `SELECT d.id, d.date FROM ${TABLE} d
       WHERE d.trip_id = ? AND d.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM activities a WHERE a.day_id = d.id AND a.deleted_at IS NULL
       )`,
      [tripId]
    );
    const toDrop = emptyDays.filter((d) => !inRange.has(d.date));

    if (missing.length === 0 && toDrop.length === 0) {
      await Day.renumber(tripId);
      return;
    }

    const stamp = new Date().toISOString();
    const writes = [];

    // Negative placeholder day_numbers so new rows never collide with existing
    // ones (or with the offsets renumber() uses).
    missing.forEach((date, i) => {
      writes.push({
        sql: `INSERT INTO ${TABLE}
              (id, trip_id, day_number, date, title, notes, created_at, updated_at, deleted_at, version)
              VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, NULL, 1)`,
        args: [uuidv4(), tripId, -1 - i, date, stamp, stamp],
      });
    });

    // Soft-delete AND vacate the day_number slot — UNIQUE(trip_id, day_number)
    // still applies to soft-deleted rows, so renumber() would collide otherwise.
    toDrop.forEach((day) => {
      writes.push({
        sql: `UPDATE ${TABLE} SET deleted_at = ?, day_number = -2000000 - ABS(day_number) WHERE id = ?`,
        args: [stamp, day.id],
      });
    });

    await dbBatch(writes);
    await Day.renumber(tripId);
  }

  /** Renumber the trip's days 1..N in date order (one batched transaction). */
  static async renumber(tripId) {
    const days = await dbAll(
      `SELECT id FROM ${TABLE} WHERE trip_id = ? AND deleted_at IS NULL ORDER BY date ASC`,
      [tripId]
    );
    if (days.length === 0) return;

    const stamp = new Date().toISOString();
    await dbBatch([
      // Map every row to a distinct negative value first (linear => injective),
      // so the final 1..N assignments never trip UNIQUE(trip_id, day_number).
      {
        sql: `UPDATE ${TABLE} SET day_number = day_number * -1 - 1000000 WHERE trip_id = ? AND deleted_at IS NULL`,
        args: [tripId],
      },
      ...days.map((d, i) => ({
        sql: `UPDATE ${TABLE} SET day_number = ?, updated_at = ? WHERE id = ?`,
        args: [i + 1, stamp, d.id],
      })),
    ]);
  }
}

export default Day;
