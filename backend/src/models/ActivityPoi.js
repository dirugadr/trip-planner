import { randomUUID } from 'crypto';
import { dbAll, dbGet, dbRun, dbBatch } from '../db/database.js';

const TABLE = 'activity_pois';

export class ActivityPoi {
  /** POIs associated with an activity, in sequence order, with category info. */
  static list(activityId) {
    return dbAll(
      `SELECT ps.*, ap.sequence_order,
              c.name AS category_name, c.icon AS category_icon, c.color AS category_color
         FROM ${TABLE} ap
         JOIN pois_saved ps ON ps.id = ap.poi_id AND ps.deleted_at IS NULL
         JOIN poi_categories c ON c.id = ps.category_id
        WHERE ap.activity_id = ?
        ORDER BY ap.sequence_order ASC, ap.created_at ASC`,
      [activityId]
    );
  }

  /** Same as list() but for many activities at once; returns a Map(activityId → poi[]). */
  static async listForActivities(activityIds) {
    const map = new Map(activityIds.map((id) => [id, []]));
    if (activityIds.length === 0) return map;

    const placeholders = activityIds.map(() => '?').join(', ');
    const rows = await dbAll(
      `SELECT ap.activity_id, ap.sequence_order, ps.*,
              c.name AS category_name, c.icon AS category_icon, c.color AS category_color
         FROM ${TABLE} ap
         JOIN pois_saved ps ON ps.id = ap.poi_id AND ps.deleted_at IS NULL
         JOIN poi_categories c ON c.id = ps.category_id
        WHERE ap.activity_id IN (${placeholders})
        ORDER BY ap.sequence_order ASC, ap.created_at ASC`,
      activityIds
    );
    for (const row of rows) {
      const { activity_id, ...poi } = row;
      if (map.has(activity_id)) map.get(activity_id).push(poi);
    }
    return map;
  }

  static exists(activityId, poiId) {
    return dbGet(`SELECT id FROM ${TABLE} WHERE activity_id = ? AND poi_id = ?`, [activityId, poiId]);
  }

  static async nextSequence(activityId) {
    const row = await dbGet(
      `SELECT MAX(sequence_order) AS m FROM ${TABLE} WHERE activity_id = ?`,
      [activityId]
    );
    return (row?.m ?? 0) + 1;
  }

  /** Statement objects for creating an association (used standalone or in a batch). */
  static insertStmt(activityId, poiId, sequenceOrder) {
    return {
      sql: `INSERT INTO ${TABLE} (id, activity_id, poi_id, sequence_order, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))`,
      args: [randomUUID(), activityId, poiId, sequenceOrder],
    };
  }

  static async associate(activityId, poiId, sequenceOrder) {
    const seq = sequenceOrder ?? (await ActivityPoi.nextSequence(activityId));
    const stmt = ActivityPoi.insertStmt(activityId, poiId, seq);
    await dbRun(stmt.sql, stmt.args);
  }

  static dissociate(activityId, poiId) {
    return dbRun(`DELETE FROM ${TABLE} WHERE activity_id = ? AND poi_id = ?`, [activityId, poiId]);
  }

  /** Rewrite sequence_order to match the given poi id order. */
  static reorder(activityId, poiIds) {
    const stmts = poiIds.map((poiId, i) => ({
      sql: `UPDATE ${TABLE} SET sequence_order = ? WHERE activity_id = ? AND poi_id = ?`,
      args: [i + 1, activityId, poiId],
    }));
    return dbBatch(stmts);
  }

  static deleteByActivityId(activityId) {
    return dbRun(`DELETE FROM ${TABLE} WHERE activity_id = ?`, [activityId]);
  }

  static deleteByPoiId(poiId) {
    return dbRun(`DELETE FROM ${TABLE} WHERE poi_id = ?`, [poiId]);
  }

  static deleteByAccommodationId(accommodationId) {
    return dbRun(
      `DELETE FROM ${TABLE}
        WHERE poi_id IN (SELECT id FROM pois_saved WHERE accommodation_id = ?)`,
      [accommodationId]
    );
  }
}

export default ActivityPoi;
