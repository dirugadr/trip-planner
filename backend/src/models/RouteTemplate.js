import { randomUUID } from 'crypto';
import { findById, dbAll, dbBatch, deleteOne } from '../db/database.js';
import { walkTimeMatrix } from '../lib/routing.js';

const TABLE = 'route_templates';
const STOPS = 'route_template_stops';

// Fallback visit duration (minutes) by category, used when a stop's POI has
// no estimated_duration_minutes loaded. Keyed by the fixed seed category ids
// (backend/src/db/002_seed_data.sql), not by display name.
const DEFAULT_DURATION_BY_CATEGORY = {
  cat_culture: 90,
  cat_food: 60,
  cat_nature: 60,
  cat_attraction: 60,
  cat_station: 15,
  cat_accommodation: 0,
  cat_other: 30,
};

export function defaultDurationFor(categoryId) {
  return DEFAULT_DURATION_BY_CATEGORY[categoryId] ?? 30;
}

/** Ordered stops of a template, each carrying its POI's fields + category info. */
function stopsOf(templateId) {
  return dbAll(
    `SELECT rts.id AS stop_id, rts.sequence_order, ps.*,
            c.name AS category_name, c.icon AS category_icon, c.color AS category_color
       FROM ${STOPS} rts
       JOIN pois_saved ps ON ps.id = rts.poi_id AND ps.deleted_at IS NULL
       JOIN poi_categories c ON c.id = ps.category_id
      WHERE rts.route_template_id = ?
      ORDER BY rts.sequence_order ASC`,
    [templateId]
  );
}

/** Sum of each stop's visit duration + walking time to the next stop. */
export async function totalMinutesFor(stops) {
  if (stops.length === 0) return 0;
  let total = stops.reduce(
    (sum, s) => sum + (s.estimated_duration_minutes ?? defaultDurationFor(s.category_id)),
    0
  );
  if (stops.length > 1) {
    const walking = await walkTimeMatrix(
      stops.map((s) => ({ id: s.id, lat: Number(s.latitude), lng: Number(s.longitude) }))
    );
    const byPair = new Map(walking.map((w) => [`${w.from}|${w.to}`, w.minutes]));
    for (let i = 0; i < stops.length - 1; i++) {
      total += byPair.get(`${stops[i].id}|${stops[i + 1].id}`) || 0;
    }
  }
  return total;
}

async function attachStopsAndDuration(templates) {
  const out = [];
  for (const t of templates) {
    const stops = await stopsOf(t.id);
    out.push({ ...t, stops, total_minutes: await totalMinutesFor(stops) });
  }
  return out;
}

export class RouteTemplate {
  /** poiIds: ordered array of POI ids (order = sequence). */
  static async create({ trip_id, name, poiIds }) {
    const now = new Date().toISOString();
    const id = randomUUID();

    await dbBatch([
      {
        sql: `INSERT INTO ${TABLE} (id, trip_id, name, created_at, updated_at, deleted_at)
              VALUES (?, ?, ?, ?, ?, NULL)`,
        args: [id, trip_id, name, now, now],
      },
      ...poiIds.map((poiId, i) => ({
        sql: `INSERT INTO ${STOPS} (id, route_template_id, poi_id, sequence_order, created_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [randomUUID(), id, poiId, i + 1, now],
      })),
    ]);

    return RouteTemplate.findById(id);
  }

  static async findById(id) {
    const template = await findById(TABLE, id);
    if (!template) return null;
    const [withStops] = await attachStopsAndDuration([template]);
    return withStops;
  }

  static async findByTripId(tripId) {
    const templates = await dbAll(
      `SELECT * FROM ${TABLE} WHERE trip_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [tripId]
    );
    return attachStopsAndDuration(templates);
  }

  static async update(id, { name, poiIds }) {
    const template = await findById(TABLE, id);
    if (!template) return null;

    const now = new Date().toISOString();
    await dbBatch([
      { sql: `UPDATE ${TABLE} SET name = ?, updated_at = ? WHERE id = ?`, args: [name, now, id] },
      { sql: `DELETE FROM ${STOPS} WHERE route_template_id = ?`, args: [id] },
      ...poiIds.map((poiId, i) => ({
        sql: `INSERT INTO ${STOPS} (id, route_template_id, poi_id, sequence_order, created_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [randomUUID(), id, poiId, i + 1, now],
      })),
    ]);

    return RouteTemplate.findById(id);
  }

  static delete(id) {
    return deleteOne(TABLE, id, true);
  }
}

export default RouteTemplate;
