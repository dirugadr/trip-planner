import express from 'express';
import { serverError } from '../lib/http.js';
import { anthropicConfigError } from '../config/index.js';
import Day from '../models/Day.js';
import { parseHM, findScheduleConflicts } from '../models/Activity.js';
import ActivityPoi from '../models/ActivityPoi.js';
import { dbBatch } from '../db/database.js';
import { walkTimeMatrix, fetchRouteGeometry } from '../lib/routing.js';
import { proposeDayRoute } from '../lib/smartRoute.js';

const router = express.Router();

/**
 * Day activities that have at least one associated POI, each reduced to its
 * first POI (the smart route reorders activities, so one location per activity).
 */
async function activitiesWithPrimaryPoi(dayId) {
  const activities = await Day.getActivities(dayId);
  const poisByActivity = await ActivityPoi.listForActivities(activities.map((a) => a.id));
  return activities
    .map((a) => ({ activity: a, poi: (poisByActivity.get(a.id) || [])[0] || null }))
    .filter((x) => x.poi);
}

// PUT /api/days/:id - Update a day's title / notes
router.put('/:id', async (req, res) => {
  try {
    const day = await Day.findById(req.params.id);

    if (!day) {
      return res.status(404).json({ success: false, error: 'Day not found' });
    }

    // Only title and notes are editable; date and day_number are managed by the trip.
    const patch = {};
    if ('title' in req.body) patch.title = req.body.title?.trim() || null;
    if ('notes' in req.body) patch.notes = req.body.notes?.trim() || null;

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, error: 'Nothing to update' });
    }

    const updated = await Day.update(req.params.id, patch);

    res.json({ success: true, data: updated });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/days/:dayId/smart-route — suggest an order + times (read-only, no DB writes)
router.post('/:dayId/smart-route', async (req, res) => {
  try {
    const day = await Day.findById(req.params.dayId);
    if (!day) return res.status(404).json({ success: false, error: 'Day not found' });

    const items = await activitiesWithPrimaryPoi(day.id);
    if (items.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Necesitás al menos 2 actividades con un lugar asociado en este día para sugerir un recorrido',
      });
    }

    const configErr = anthropicConfigError();
    if (configErr) return res.status(503).json({ success: false, error: configErr });

    const pois = items.map((x) => ({
      id: x.poi.id,
      lat: Number(x.poi.latitude),
      lng: Number(x.poi.longitude),
    }));
    const walking = await walkTimeMatrix(pois);
    const poiIdToActivityId = new Map(items.map((x) => [x.poi.id, x.activity.id]));

    const input = {
      day_date: day.date,
      activities: items.map((x) => ({
        activity_id: x.activity.id,
        current_start_time: x.activity.start_time || null,
        current_end_time:
          x.activity.start_time && x.activity.duration_minutes
            ? minutesToHM(parseHM(x.activity.start_time) + x.activity.duration_minutes)
            : null,
        poi: {
          name: x.poi.name,
          category: x.poi.category_name || null,
          lat: Number(x.poi.latitude),
          lng: Number(x.poi.longitude),
        },
        notes: x.activity.description || null,
      })),
      walking_times_minutes: walking.map((w) => ({
        from: poiIdToActivityId.get(w.from),
        to: poiIdToActivityId.get(w.to),
        minutes: w.minutes,
        source: w.source,
      })),
    };

    const proposal = await proposeDayRoute(input).catch((e) => {
      res.status(e.status || 502).json({ success: false, error: e.message });
      return null;
    });
    if (!proposal) return undefined;

    const byActivity = new Map(items.map((x) => [x.activity.id, x]));
    const estimated = new Set(
      walking.filter((w) => w.source !== 'osrm').flatMap((w) => [w.from, w.to])
    );

    return res.json({
      success: true,
      data: {
        summary: proposal.summary,
        has_estimated_walk_times: estimated.size > 0,
        stops: proposal.suggested_order.map((s) => {
          const x = byActivity.get(s.activity_id);
          return {
            activity_id: s.activity_id,
            activity_title: x?.activity.title || '',
            poi_name: x?.poi.name || '',
            suggested_start_time: s.suggested_start_time,
            suggested_end_time: s.suggested_end_time,
            reason: s.reason,
          };
        }),
      },
    });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/days/:dayId/smart-route/apply — apply the (possibly edited) proposal
router.post('/:dayId/smart-route/apply', async (req, res) => {
  try {
    const day = await Day.findById(req.params.dayId);
    if (!day) return res.status(404).json({ success: false, error: 'Day not found' });

    const order = Array.isArray(req.body.order) ? req.body.order : null;
    if (!order || order.length === 0) {
      return res.status(400).json({ success: false, error: 'Falta la lista de paradas (order)' });
    }

    const dayActivities = await Day.getActivities(day.id);
    const byId = new Map(dayActivities.map((a) => [a.id, a]));

    const seen = new Set();
    for (const stop of order) {
      if (!byId.has(stop.activity_id)) {
        return res.status(400).json({ success: false, error: 'Una parada no corresponde a este día' });
      }
      if (seen.has(stop.activity_id)) {
        return res.status(400).json({ success: false, error: 'Hay una actividad repetida en la propuesta' });
      }
      seen.add(stop.activity_id);
      if (parseHM(stop.suggested_start_time) == null || parseHM(stop.suggested_end_time) == null) {
        return res.status(400).json({ success: false, error: 'Los horarios deben tener formato HH:MM' });
      }
      if (parseHM(stop.suggested_end_time) <= parseHM(stop.suggested_start_time)) {
        return res.status(400).json({ success: false, error: 'El fin de una parada debe ser posterior a su inicio' });
      }
    }

    // Proposed schedule = reordered stops with new times + the day's other
    // activities keeping their current times. Conflict check runs over the whole
    // day, reusing the shared HU-1.8 primitive.
    const proposed = [
      ...order.map((s) => ({
        id: s.activity_id,
        title: byId.get(s.activity_id).title,
        start_time: s.suggested_start_time,
        duration_minutes: parseHM(s.suggested_end_time) - parseHM(s.suggested_start_time),
        tentative: byId.get(s.activity_id).tentative,
      })),
      ...dayActivities
        .filter((a) => !seen.has(a.id))
        .map((a) => ({ id: a.id, title: a.title, start_time: a.start_time, duration_minutes: a.duration_minutes, tentative: a.tentative })),
    ];

    const conflicts = findScheduleConflicts(proposed);
    if (conflicts.length > 0) {
      const pairs = conflicts.map((c) => `"${c.a.title}" y "${c.b.title}"`).join('; ');
      return res.status(400).json({
        success: false,
        warning: true,
        error: `Aplicar esta propuesta generaría solapamientos de horario: ${pairs}. Ajustá los horarios y probá de nuevo.`,
      });
    }

    await dbBatch(
      order.map((s, i) => ({
        sql: `UPDATE activities SET sort_order = ?, start_time = ?, duration_minutes = ?, updated_at = datetime('now') WHERE id = ?`,
        args: [
          i + 1,
          s.suggested_start_time,
          parseHM(s.suggested_end_time) - parseHM(s.suggested_start_time),
          s.activity_id,
        ],
      }))
    );

    res.json({ success: true, message: 'Recorrido aplicado' });
  } catch (error) {
    serverError(res, error);
  }
});

// GET /api/days/:dayId/route-view — read-only walking route for the day's map
// view (Épica 11): stops in schedule order + real walking geometry between
// consecutive stops. Writes nothing.
router.get('/:dayId/route-view', async (req, res) => {
  try {
    const day = await Day.findById(req.params.dayId);
    if (!day) return res.status(404).json({ success: false, error: 'Day not found' });

    const allActivities = await Day.getActivities(day.id);
    const items = await activitiesWithPrimaryPoi(day.id);

    // Schedule order, not sort_order/creation order — activities without a
    // start_time (edge case) sort last, stable otherwise.
    const ordered = [...items].sort((a, b) => {
      const ta = parseHM(a.activity.start_time);
      const tb = parseHM(b.activity.start_time);
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1;
      if (tb == null) return -1;
      return ta - tb;
    });

    const stops = ordered.map((x, i) => ({
      sequence_number: i + 1,
      activity_id: x.activity.id,
      activity_name: x.activity.title,
      poi_name: x.poi.name,
      lat: Number(x.poi.latitude),
      lng: Number(x.poi.longitude),
    }));

    const segments = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const geometry = await fetchRouteGeometry(stops[i], stops[i + 1]);
      segments.push({ from: stops[i].sequence_number, to: stops[i + 1].sequence_number, ...geometry });
    }

    res.json({
      success: true,
      data: {
        stops,
        segments,
        activities_without_poi_count: allActivities.length - items.length,
      },
    });
  } catch (error) {
    serverError(res, error);
  }
});

function minutesToHM(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export default router;
