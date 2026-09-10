import { randomUUID } from 'crypto';
import { insertOne, updateOne, deleteOne, findById, dbGet, dbRun, dbAll } from '../db/database.js';

const TABLE = 'activities';
const ORDER = 'ORDER BY sort_order ASC, start_time ASC';

// Columns a caller may set via update(). `day_id` is included because the
// accommodation sync moves check-in/out activities between days. Server-managed
// columns (id, timestamps, version, deleted_at, accommodation_id) are excluded.
const EDITABLE = [
  'day_id', 'title', 'description', 'start_time', 'duration_minutes',
  'location_name', 'latitude', 'longitude', 'url', 'completed', 'tentative',
  'sort_order', 'accommodation_role',
];

export class Activity {
  static async create(data) {
    const maxRow = await dbGet(
      `SELECT MAX(sort_order) AS m FROM ${TABLE} WHERE day_id = ?`,
      [data.day_id]
    );

    const activity = {
      id: randomUUID(),
      day_id: data.day_id,
      title: data.title,
      description: data.description || null,
      start_time: data.start_time || null,
      duration_minutes: data.duration_minutes || null,
      location_name: data.location_name || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      url: data.url || null,
      completed: data.completed ? 1 : 0,
      tentative: data.tentative ? 1 : 0,
      sort_order: data.sort_order ?? (maxRow?.m ?? 0) + 1,
      accommodation_id: data.accommodation_id || null,
      accommodation_role: data.accommodation_role || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      version: 1
    };

    await insertOne(TABLE, activity);
    return activity;
  }

  /** The check-in / check-out activity linked to an accommodation, if any. */
  static async findLinked(accommodationId, role) {
    const rows = await dbAll(
      `SELECT * FROM ${TABLE}
       WHERE accommodation_id = ? AND accommodation_role = ? AND deleted_at IS NULL
       LIMIT 1`,
      [accommodationId, role]
    );
    return rows[0] || null;
  }

  static async deleteByAccommodationId(accommodationId) {
    await dbRun(
      `UPDATE ${TABLE} SET deleted_at = datetime('now') WHERE accommodation_id = ? AND deleted_at IS NULL`,
      [accommodationId]
    );
  }

  static findById(id) {
    return findById(TABLE, id);
  }

  /** The trip an activity belongs to (via its day), or null. */
  static async tripIdOf(id) {
    const row = await dbGet(
      `SELECT d.trip_id FROM days d JOIN ${TABLE} a ON a.day_id = d.id WHERE a.id = ?`,
      [id]
    );
    return row?.trip_id || null;
  }

  static findByDayId(dayId) {
    return dbAll(`SELECT * FROM ${TABLE} WHERE day_id = ? AND deleted_at IS NULL ${ORDER}`, [dayId]);
  }

  static async update(id, data) {
    const updates = { updated_at: new Date().toISOString(), version: (data.version || 0) + 1 };
    for (const key of EDITABLE) {
      if (key in data) updates[key] = data[key];
    }

    const success = await updateOne(TABLE, id, updates);
    if (success) {
      return Activity.findById(id);
    }
    return null;
  }

  static delete(id, soft = true) {
    return deleteOne(TABLE, id, soft);
  }

  /**
   * Swap an activity with its neighbour in the day's ordered list.
   * `direction` is 'up' or 'down'. No-op at the edges.
   */
  static async move(id, direction) {
    const activity = await findById(TABLE, id);
    if (!activity) return null;

    const siblings = await dbAll(
      `SELECT id, sort_order FROM ${TABLE} WHERE day_id = ? AND deleted_at IS NULL ${ORDER}`,
      [activity.day_id]
    );

    const idx = siblings.findIndex((s) => s.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return activity;

    const a = siblings[idx];
    const b = siblings[swapIdx];
    const stamp = new Date().toISOString();
    await dbRun(`UPDATE ${TABLE} SET sort_order = ?, updated_at = ? WHERE id = ?`, [b.sort_order, stamp, a.id]);
    await dbRun(`UPDATE ${TABLE} SET sort_order = ?, updated_at = ? WHERE id = ?`, [a.sort_order, stamp, b.id]);

    return findById(TABLE, id);
  }

  static async checkTimeConflict(dayId, startTime, durationMinutes, excludeId = null) {
    if (!startTime || !durationMinutes) return false;

    // Parse time to minutes
    const [startHour, startMin] = startTime.split(':').map(Number);
    const activityStart = startHour * 60 + startMin;
    const activityEnd = activityStart + durationMinutes;

    // Check for overlaps, ignoring the activity being edited and tentative plans
    const conflicts = await dbAll(
      `SELECT * FROM ${TABLE}
       WHERE day_id = ?
       AND deleted_at IS NULL
       AND tentative = 0
       AND start_time IS NOT NULL
       AND duration_minutes IS NOT NULL
       ${excludeId ? 'AND id != ?' : ''}`,
      excludeId ? [dayId, excludeId] : [dayId]
    );

    return conflicts.some((activity) => {
      const [h, m] = activity.start_time.split(':').map(Number);
      const otherStart = h * 60 + m;
      const otherEnd = otherStart + activity.duration_minutes;

      // Check overlap: activity starts before other ends AND activity ends after other starts
      return activityStart < otherEnd && activityEnd > otherStart;
    });
  }

}

export default Activity;
