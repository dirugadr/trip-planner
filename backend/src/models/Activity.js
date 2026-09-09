import { v4 as uuidv4 } from 'uuid';
import { getDatabase, insertOne, updateOne, deleteOne, findById } from '../db/database.js';

const TABLE = 'activities';

export class Activity {
  static create(data) {
    const activity = {
      id: uuidv4(),
      day_id: data.day_id,
      title: data.title,
      description: data.description || null,
      start_time: data.start_time || null,
      duration_minutes: data.duration_minutes || null,
      location_name: data.location_name || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      url: data.url || null,
      completed: data.completed || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      version: 1
    };

    insertOne(TABLE, activity);
    return activity;
  }

  static findById(id) {
    return findById(TABLE, id);
  }

  static findByDayId(dayId) {
    const db = getDatabase();
    const sql = `SELECT * FROM ${TABLE} WHERE day_id = ? AND deleted_at IS NULL ORDER BY start_time ASC`;
    const stmt = db.prepare(sql);
    return stmt.all(dayId);
  }

  static update(id, data) {
    const updates = {
      ...data,
      updated_at: new Date().toISOString(),
      version: (data.version || 0) + 1
    };

    const success = updateOne(TABLE, id, updates);
    if (success) {
      return Activity.findById(id);
    }
    return null;
  }

  static delete(id, soft = true) {
    return deleteOne(TABLE, id, soft);
  }

  static checkTimeConflict(dayId, startTime, durationMinutes) {
    if (!startTime || !durationMinutes) return false;

    const db = getDatabase();
    
    // Parse time to minutes
    const [startHour, startMin] = startTime.split(':').map(Number);
    const activityStart = startHour * 60 + startMin;
    const activityEnd = activityStart + durationMinutes;

    // Check for overlaps
    const conflicts = db.prepare(`
      SELECT * FROM ${TABLE}
      WHERE day_id = ? 
      AND deleted_at IS NULL
      AND start_time IS NOT NULL
      AND duration_minutes IS NOT NULL
    `).all(dayId);

    return conflicts.some(activity => {
      const [h, m] = activity.start_time.split(':').map(Number);
      const otherStart = h * 60 + m;
      const otherEnd = otherStart + activity.duration_minutes;

      // Check overlap: activity starts before other ends AND activity ends after other starts
      return activityStart < otherEnd && activityEnd > otherStart;
    });
  }

  static getAssociatedPois(activityId) {
    const db = getDatabase();
    const sql = `
      SELECT ps.* FROM pois_saved ps
      JOIN activity_pois ap ON ps.id = ap.poi_id
      WHERE ap.activity_id = ?
      ORDER BY ap.sequence_order ASC
    `;
    const stmt = db.prepare(sql);
    return stmt.all(activityId);
  }
}

export default Activity;
