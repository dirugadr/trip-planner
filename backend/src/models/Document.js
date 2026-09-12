import { randomUUID } from 'crypto';
import { insertOne, dbAll, dbGet, dbRun } from '../db/database.js';

const TABLE = 'documents';

export class Document {
  static async create(data) {
    const now = new Date().toISOString();
    const row = {
      id: randomUUID(),
      trip_id: data.trip_id,
      activity_id: data.activity_id ?? null,
      title: data.title,
      file_name: data.file_name,
      file_path: data.file_path, // Vercel Blob URL
      file_type: data.file_type,
      file_size_bytes: data.file_size_bytes ?? null,
      uploaded_at: now,
      created_at: now,
      deleted_at: null,
    };
    await insertOne(TABLE, row);
    return row;
  }

  static findById(id) {
    return dbGet(`SELECT * FROM ${TABLE} WHERE id = ? AND deleted_at IS NULL`, [id]);
  }

  /** Trip's documents, newest first, with the linked activity's title if any. */
  static findByTripId(tripId) {
    return dbAll(
      `SELECT d.*, a.title AS activity_title
         FROM ${TABLE} d
         LEFT JOIN activities a ON a.id = d.activity_id AND a.deleted_at IS NULL
        WHERE d.trip_id = ? AND d.deleted_at IS NULL
        ORDER BY d.uploaded_at DESC`,
      [tripId]
    );
  }

  /** Same as findByTripId's per-activity shape, but for many activities at
   * once; returns a Map(activityId → document[]). Used by GET /api/trips/:id
   * to show a "documento adjunto" indicator on the itinerary (v2 UI). */
  static async listForActivities(activityIds) {
    const map = new Map(activityIds.map((id) => [id, []]));
    if (activityIds.length === 0) return map;

    const placeholders = activityIds.map(() => '?').join(', ');
    const rows = await dbAll(
      `SELECT id, activity_id, title, file_name, file_type
         FROM ${TABLE}
        WHERE activity_id IN (${placeholders}) AND deleted_at IS NULL
        ORDER BY uploaded_at DESC`,
      activityIds
    );
    for (const row of rows) {
      const { activity_id, ...doc } = row;
      if (map.has(activity_id)) map.get(activity_id).push(doc);
    }
    return map;
  }

  /** Hard delete — the blob is removed too, no point keeping an orphan row. */
  static hardDelete(id) {
    return dbRun(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  }
}

export default Document;
