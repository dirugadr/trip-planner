import { randomUUID } from 'crypto';
import { insertOne, deleteOne, findById, dbGet, dbRun, dbAll } from '../db/database.js';

const TABLE = 'activities';
// Ajuste itinerario: start_time is the primary sort key so the list always
// reflects the actual schedule (a new/edited activity lands at its time slot
// without a manual move). sort_order only breaks ties — same start_time, or
// both unset — which is what the up/down "mover" buttons actually reorder.
const ORDER = 'ORDER BY (start_time IS NULL) ASC, start_time ASC, sort_order ASC';

// Columns a caller may set via update(). `day_id` is included because the
// accommodation sync moves check-in/out activities between days. Server-managed
// columns (id, timestamps, version, deleted_at, accommodation_id) are excluded.
const EDITABLE = [
  'day_id', 'title', 'description', 'start_time', 'duration_minutes',
  'location_name', 'latitude', 'longitude', 'url', 'completed', 'tentative',
  'sort_order', 'accommodation_role', 'is_fixed',
];

export class Activity {
  /** Build a full activities row from data + an explicit sort_order (no DB write). */
  static rowFor(data, sortOrder) {
    return {
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
      is_fixed: data.is_fixed ? 1 : 0,
      sort_order: sortOrder,
      accommodation_id: data.accommodation_id || null,
      accommodation_role: data.accommodation_role || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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

  /** Next free sort_order slot in a day's activity list. */
  static async nextSortOrder(dayId) {
    const maxRow = await dbGet(`SELECT MAX(sort_order) AS m FROM ${TABLE} WHERE day_id = ?`, [dayId]);
    return (maxRow?.m ?? 0) + 1;
  }

  static async create(data) {
    const nextSortOrder = await Activity.nextSortOrder(data.day_id);

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
      is_fixed: data.is_fixed ? 1 : 0,
      sort_order: data.sort_order ?? nextSortOrder,
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

  /** UPDATE statement for update() — for use standalone or inside a dbBatch. */
  static updateStmt(id, data) {
    const updates = { updated_at: new Date().toISOString(), version: (data.version || 0) + 1 };
    for (const key of EDITABLE) {
      if (key in data) updates[key] = data[key];
    }
    const cols = Object.keys(updates);
    return {
      sql: `UPDATE ${TABLE} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      args: [...Object.values(updates), id],
    };
  }

  static async update(id, data) {
    const stmt = Activity.updateStmt(id, data);
    const result = await dbRun(stmt.sql, stmt.args);
    if (result.changes > 0) {
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

  /**
   * HU-1.8 conflict handling for a single manual create/edit — the one place
   * reused by both POST/PUT /api/activities (never duplicate this in
   * HU-2.5/HU-2.6's own "todo o nada" flows, which have their own logic).
   *
   * Tries to resolve an overlap by cascading the day's later activities
   * forward in time, each pushed the minimum needed to clear the one before
   * it. Refuses (same "blocked" outcome as the old plain conflict check) when:
   *   - the overlap is with something that starts BEFORE the target — nothing
   *     to push forward there, and the target's own time is the one the
   *     traveler just typed, not something to move automatically; or
   *   - resolving the chain would require moving an "inamovible" activity.
   *
   * @returns {Promise<{blocked:boolean, shifts:{id:string,title:string,previous_start_time:string,start_time:string}[], reason?:string, blocker?:object}>}
   */
  static async resolveScheduleShift(dayId, { startTime, durationMinutes, excludeId = null }) {
    if (!startTime || !durationMinutes) return { blocked: false, shifts: [] };
    const start = parseHM(startTime);
    if (start == null) return { blocked: false, shifts: [] };
    const end = start + durationMinutes;

    const rows = await dbAll(
      `SELECT id, title, start_time, duration_minutes, is_fixed FROM ${TABLE}
       WHERE day_id = ?
       AND deleted_at IS NULL
       AND tentative = 0
       AND start_time IS NOT NULL
       AND duration_minutes IS NOT NULL
       ${excludeId ? 'AND id != ?' : ''}`,
      excludeId ? [dayId, excludeId] : [dayId]
    );
    const others = rows
      .map((r) => ({ id: r.id, title: r.title, startTime: r.start_time, start: parseHM(r.start_time), duration: r.duration_minutes, isFixed: !!r.is_fixed }))
      .filter((o) => o.start != null);

    // `blocker` names the activity that makes this impossible, so callers that
    // talk to a person (the MCP tools) can explain it instead of guessing.
    const blocker = (o, reason) => ({
      blocked: true,
      shifts: [],
      reason,
      blocker: { id: o.id, title: o.title, start_time: o.startTime, end_time: minutesToHM(o.start + o.duration), is_fixed: o.isFixed },
    });

    const earlier = others.find((o) => o.start < start && rangesOverlap(start, end, o.start, o.start + o.duration));
    if (earlier) return blocker(earlier, 'overlaps_earlier_activity');

    const later = others.filter((o) => o.start >= start).sort((a, b) => a.start - b.start);

    let cursorEnd = end;
    const shifts = [];
    for (const o of later) {
      if (o.start < cursorEnd) {
        if (o.isFixed) return blocker(o, 'would_move_fixed_activity');
        shifts.push({ id: o.id, title: o.title, previous_start_time: o.startTime, start_time: minutesToHM(cursorEnd) });
        cursorEnd += o.duration;
      } else {
        cursorEnd = o.start + o.duration;
      }
    }

    return { blocked: false, shifts };
  }

}

/** "HH:MM" -> minutes since midnight, or null. */
export function parseHM(hm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hm ?? '').toString().trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** minutes since midnight -> "HH:MM", wrapping into a 24h day. */
export function minutesToHM(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Half-open interval overlap: [aStart,aEnd) vs [bStart,bEnd). */
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Conflicts within a proposed schedule (HU-1.8 semantics: tentative plans and
 * items without a time+duration don't count). Used by the smart-route apply
 * step (HU-2.5/2.6 have their own "todo o nada" handling, separate from
 * resolveScheduleShift's automatic cascade for manual create/edit).
 *
 * @param {{id:string,title?:string,start_time:string,duration_minutes:number,tentative?:boolean|number}[]} items
 * @returns {{a:{id,title}, b:{id,title}}[]}
 */
export function findScheduleConflicts(items) {
  const timed = items
    .filter((i) => !i.tentative && i.start_time && i.duration_minutes)
    .map((i) => ({ id: i.id, title: i.title, start: parseHM(i.start_time), dur: i.duration_minutes }))
    .filter((i) => i.start != null);

  const out = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const x = timed[i];
      const y = timed[j];
      if (rangesOverlap(x.start, x.start + x.dur, y.start, y.start + y.dur)) {
        out.push({ a: { id: x.id, title: x.title }, b: { id: y.id, title: y.title } });
      }
    }
  }
  return out;
}

export default Activity;
