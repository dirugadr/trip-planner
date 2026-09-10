import { dbAll, dbBatch } from '../db/database.js';

const TABLE = 'poi_walk_times';

export class PoiWalkTime {
  /**
   * Look up cached walking times for the given directed pairs.
   * @param {{from:string,to:string}[]} pairs
   * @returns {Promise<Map<string, {minutes:number, source:string}>>} keyed "from|to"
   */
  static async getMany(pairs) {
    const map = new Map();
    if (pairs.length === 0) return map;

    const ids = [...new Set(pairs.flatMap((p) => [p.from, p.to]))];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = await dbAll(
      `SELECT from_poi_id, to_poi_id, minutes, source FROM ${TABLE}
        WHERE from_poi_id IN (${placeholders}) AND to_poi_id IN (${placeholders})`,
      [...ids, ...ids]
    );
    for (const r of rows) {
      map.set(`${r.from_poi_id}|${r.to_poi_id}`, { minutes: r.minutes, source: r.source });
    }
    return map;
  }

  /** Upsert a batch of computed times. @param {{from,to,minutes,source}[]} rows */
  static saveMany(rows) {
    if (rows.length === 0) return Promise.resolve();
    return dbBatch(
      rows.map((r) => ({
        sql: `INSERT INTO ${TABLE} (from_poi_id, to_poi_id, minutes, source, computed_at)
              VALUES (?, ?, ?, ?, datetime('now'))
              ON CONFLICT(from_poi_id, to_poi_id)
              DO UPDATE SET minutes = excluded.minutes, source = excluded.source, computed_at = excluded.computed_at`,
        args: [r.from, r.to, r.minutes, r.source],
      }))
    );
  }
}

export default PoiWalkTime;
