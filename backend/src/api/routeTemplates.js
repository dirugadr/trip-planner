import express from 'express';
import { serverError } from '../lib/http.js';
import { anthropicConfigError } from '../config/index.js';
import Trip from '../models/Trip.js';
import Day from '../models/Day.js';
import Poi from '../models/Poi.js';
import Activity, { parseHM, findScheduleConflicts } from '../models/Activity.js';
import ActivityPoi from '../models/ActivityPoi.js';
import RouteTemplate, { defaultDurationFor, totalMinutesFor } from '../models/RouteTemplate.js';
import { walkTimeMatrix, estimateWalkMatrix } from '../lib/routing.js';
import { proposePoiOrder, proposeAreaRoute } from '../lib/smartRoute.js';
import { discoverPois, areaKm2, MAX_AREA_KM2 } from '../lib/poiDiscovery.js';
import { dbBatch } from '../db/database.js';

const router = express.Router();

function minutesToHM(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Validates { name, poi_ids }: name required, poi_ids non-empty unique list, all owned by the trip. */
async function validateTemplatePayload(tripId, body) {
  const errors = [];

  const name = (body.name ?? '').toString().trim();
  if (!name) errors.push('Falta el nombre del recorrido');

  const poiIds = Array.isArray(body.poi_ids) ? [...new Set(body.poi_ids)] : [];
  if (poiIds.length === 0) errors.push('El recorrido necesita al menos un lugar');

  if (poiIds.length > 0) {
    const pois = await Poi.findByTripId(tripId);
    const owned = new Set(pois.map((p) => p.id));
    if (poiIds.some((id) => !owned.has(id))) {
      errors.push('Uno de los lugares no pertenece a este viaje');
    }
  }

  return { errors, name, poiIds };
}

// GET /api/trips/:tripId/route-templates
router.get('/trips/:tripId/route-templates', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    res.json({ success: true, data: await RouteTemplate.findByTripId(trip.id) });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/trips/:tripId/route-templates — { name, poi_ids: [...] } (order = sequence)
router.post('/trips/:tripId/route-templates', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const { errors, name, poiIds } = await validateTemplatePayload(trip.id, req.body);
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('. ') });

    const template = await RouteTemplate.create({ trip_id: trip.id, name, poiIds });
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    serverError(res, error);
  }
});

// PUT /api/route-templates/:id — edit name and/or stop sequence
router.put('/route-templates/:id', async (req, res) => {
  try {
    const existing = await RouteTemplate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Route template not found' });

    const { errors, name, poiIds } = await validateTemplatePayload(existing.trip_id, req.body);
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('. ') });

    const updated = await RouteTemplate.update(req.params.id, { name, poiIds });
    res.json({ success: true, data: updated });
  } catch (error) {
    serverError(res, error);
  }
});

// DELETE /api/route-templates/:id
router.delete('/route-templates/:id', async (req, res) => {
  try {
    const existing = await RouteTemplate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Route template not found' });

    await RouteTemplate.delete(req.params.id);
    res.json({ success: true, message: 'Recorrido eliminado' });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/trips/:tripId/route-templates/preview — { poi_ids } -> live total duration
// while a route is still being assembled (not yet saved).
router.post('/trips/:tripId/route-templates/preview', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const poiIds = Array.isArray(req.body.poi_ids) ? req.body.poi_ids : [];
    if (poiIds.length === 0) return res.json({ success: true, data: { total_minutes: 0 } });

    const pois = await Poi.findByTripId(trip.id);
    const byId = new Map(pois.map((p) => [p.id, p]));
    if (poiIds.some((id) => !byId.has(id))) {
      return res.status(400).json({ success: false, error: 'Uno de los lugares no pertenece a este viaje' });
    }

    const stops = poiIds.map((id) => byId.get(id));
    res.json({ success: true, data: { total_minutes: await totalMinutesFor(stops) } });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/trips/:tripId/route-templates/smart-order — { poi_ids } -> suggested walking
// order + reasons. Read-only: nothing is persisted here.
router.post('/trips/:tripId/route-templates/smart-order', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const poiIds = Array.isArray(req.body.poi_ids) ? [...new Set(req.body.poi_ids)] : [];
    if (poiIds.length < 3) {
      return res.status(400).json({ success: false, error: 'Necesitás al menos 3 lugares para sugerir un orden' });
    }

    const pois = await Poi.findByTripId(trip.id);
    const byId = new Map(pois.map((p) => [p.id, p]));
    if (poiIds.some((id) => !byId.has(id))) {
      return res.status(400).json({ success: false, error: 'Uno de los lugares no pertenece a este viaje' });
    }

    const configErr = anthropicConfigError();
    if (configErr) return res.status(503).json({ success: false, error: configErr });

    const selected = poiIds.map((id) => byId.get(id));
    const walking = await walkTimeMatrix(
      selected.map((p) => ({ id: p.id, lat: Number(p.latitude), lng: Number(p.longitude) }))
    );

    const proposal = await proposePoiOrder({
      pois: selected.map((p) => ({ poi_id: p.id, name: p.name, category: p.category_name })),
      walking_times_minutes: walking,
    }).catch((e) => {
      res.status(e.status || 502).json({ success: false, error: e.message });
      return null;
    });
    if (!proposal) return undefined;

    const reasonByPoi = new Map((proposal.reasons || []).map((r) => [r.poi_id, r.reason]));
    res.json({
      success: true,
      data: {
        ordered_poi_ids: proposal.ordered_poi_ids,
        reasons: proposal.ordered_poi_ids.map((id) => ({ poi_id: id, reason: reasonByPoi.get(id) || '' })),
      },
    });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/trips/:tripId/smart-route/discover — { bounds: {south,west,north,east} } ->
// a 4-6 stop proposal mixing already-saved POIs in view with new Overpass discoveries.
// Read-only: no POI or route template is persisted here (HU-2.6b).
router.post('/trips/:tripId/smart-route/discover', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const b = req.body.bounds || {};
    const bounds = {
      south: Number(b.south),
      west: Number(b.west),
      north: Number(b.north),
      east: Number(b.east),
    };
    if (!Object.values(bounds).every(Number.isFinite)) {
      return res.status(400).json({ success: false, error: 'Faltan los límites del área visible del mapa' });
    }
    if (areaKm2(bounds) > MAX_AREA_KM2) {
      return res.status(400).json({
        success: false,
        error: `El área visible es demasiado grande para sugerir un recorrido a pie (máx. ${MAX_AREA_KM2} km²). Acercá el zoom del mapa e intentá de nuevo.`,
      });
    }

    const configErr = anthropicConfigError();
    if (configErr) return res.status(503).json({ success: false, error: configErr });

    const allPois = await Poi.findByTripId(trip.id);
    const savedInBounds = allPois.filter(
      (p) =>
        Number(p.latitude) >= bounds.south &&
        Number(p.latitude) <= bounds.north &&
        Number(p.longitude) >= bounds.west &&
        Number(p.longitude) <= bounds.east
    );

    // Overpass is best-effort — if it's down/slow, we still try with just the
    // already-saved POIs in view rather than failing the whole suggestion.
    const discovered = await discoverPois(bounds);
    const savedNames = new Set(savedInBounds.map((p) => p.name.trim().toLowerCase()));
    const newOnly = discovered.filter((d) => !savedNames.has(d.name.trim().toLowerCase()));

    const candidates = [
      ...savedInBounds.map((p) => ({
        candidate_id: `saved:${p.id}`,
        name: p.name,
        category_id: p.category_id,
        category_name: p.category_name,
        is_new: false,
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        estimated_duration_minutes: p.estimated_duration_minutes ?? defaultDurationFor(p.category_id),
      })),
      ...newOnly.map((d, i) => ({
        candidate_id: `new:${i}`,
        name: d.name,
        category_id: d.category_id,
        category_name: null,
        is_new: true,
        latitude: d.latitude,
        longitude: d.longitude,
        estimated_duration_minutes: defaultDurationFor(d.category_id),
      })),
    ];

    if (candidates.length < 4) {
      return res.status(400).json({
        success: false,
        error: `No se encontraron suficientes lugares en esta zona para armar un recorrido (encontrados: ${candidates.length}, mínimo 4). Probá con un área más grande o agregá algunos lugares primero.`,
      });
    }

    const { minutes: walkMatrix, source: walkSource } = await estimateWalkMatrix(
      candidates.map((c) => ({ lat: c.latitude, lng: c.longitude }))
    );

    const proposal = await proposeAreaRoute({
      candidates: candidates.map((c) => ({
        candidate_id: c.candidate_id,
        name: c.name,
        category: c.category_name || c.category_id,
        is_new: c.is_new,
        estimated_duration_minutes: c.estimated_duration_minutes,
      })),
      walking_times_minutes: walkMatrix,
    }).catch((e) => {
      res.status(e.status || 502).json({ success: false, error: e.message });
      return null;
    });
    if (!proposal) return undefined;

    const byId = new Map(candidates.map((c, i) => [c.candidate_id, { ...c, index: i }]));
    const reasonById = new Map(proposal.selected.map((s) => [s.candidate_id, s.reason]));
    const orderedIds = proposal.selected.map((s) => s.candidate_id);

    const stops = orderedIds.map((id, i) => {
      const c = byId.get(id);
      const next = i < orderedIds.length - 1 ? byId.get(orderedIds[i + 1]) : null;
      return {
        candidate_id: id,
        name: c.name,
        category_id: c.category_id,
        is_new: c.is_new,
        latitude: c.latitude,
        longitude: c.longitude,
        estimated_duration_minutes: c.estimated_duration_minutes,
        reason: reasonById.get(id) || '',
        walk_minutes_to_next: next ? walkMatrix[c.index][next.index] : null,
      };
    });

    const totalMinutes =
      stops.reduce((sum, s) => sum + s.estimated_duration_minutes, 0) +
      stops.reduce((sum, s) => sum + (s.walk_minutes_to_next || 0), 0);

    res.json({
      success: true,
      data: {
        summary: proposal.summary,
        stops,
        total_minutes: totalMinutes,
        has_estimated_walk_times: walkSource !== 'osrm',
        candidates_found: candidates.length,
      },
    });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/route-templates/:id/apply — { day_id, start_time } -> creates one activity
// per stop, sequenced from start_time. All-or-nothing against schedule conflicts (HU-1.8).
router.post('/route-templates/:id/apply', async (req, res) => {
  try {
    const template = await RouteTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'Route template not found' });

    const day = await Day.findById(req.body.day_id);
    if (!day) return res.status(404).json({ success: false, error: 'Day not found' });
    if (day.trip_id !== template.trip_id) {
      return res.status(400).json({ success: false, error: 'El día no pertenece al viaje de este recorrido' });
    }

    const startMinutes = parseHM(req.body.start_time);
    if (startMinutes == null) {
      return res.status(400).json({ success: false, error: 'La hora de inicio debe tener formato HH:MM' });
    }

    const stops = template.stops;
    if (stops.length === 0) {
      return res.status(400).json({ success: false, error: 'El recorrido no tiene paradas' });
    }

    const walking = await walkTimeMatrix(
      stops.map((s) => ({ id: s.id, lat: Number(s.latitude), lng: Number(s.longitude) }))
    );
    const walkMinutes = new Map(walking.map((w) => [`${w.from}|${w.to}`, w.minutes]));

    let cursor = startMinutes;
    const scheduled = stops.map((stop, i) => {
      const duration = stop.estimated_duration_minutes ?? defaultDurationFor(stop.category_id);
      const start = cursor;
      cursor += duration;
      if (i < stops.length - 1) {
        cursor += walkMinutes.get(`${stop.id}|${stops[i + 1].id}`) || 0;
      }
      return { poi: stop, start_time: minutesToHM(start), duration_minutes: duration };
    });

    const dayActivities = await Day.getActivities(day.id);
    const proposed = [
      ...scheduled.map((s, i) => ({
        id: `new-${i}`,
        title: s.poi.name,
        start_time: s.start_time,
        duration_minutes: s.duration_minutes,
        tentative: false,
      })),
      ...dayActivities.map((a) => ({
        id: a.id,
        title: a.title,
        start_time: a.start_time,
        duration_minutes: a.duration_minutes,
        tentative: a.tentative,
      })),
    ];

    const conflicts = findScheduleConflicts(proposed);
    if (conflicts.length > 0) {
      const pairs = conflicts.map((c) => `"${c.a.title}" y "${c.b.title}"`).join('; ');
      return res.status(400).json({
        success: false,
        warning: true,
        error: `Aplicar este recorrido generaría solapamientos de horario: ${pairs}. Ajustá el horario de inicio y probá de nuevo.`,
      });
    }

    let sortOrder = await Activity.nextSortOrder(day.id);
    const rows = scheduled.map((s) =>
      Activity.rowFor(
        { day_id: day.id, title: s.poi.name, start_time: s.start_time, duration_minutes: s.duration_minutes },
        sortOrder++
      )
    );

    const stmts = [];
    rows.forEach((row, i) => {
      stmts.push(Activity.insertStmt(row));
      stmts.push(ActivityPoi.insertStmt(row.id, scheduled[i].poi.id, 1));
    });
    await dbBatch(stmts);

    res.status(201).json({
      success: true,
      data: rows.map((row, i) => ({ ...row, poi_name: scheduled[i].poi.name })),
    });
  } catch (error) {
    serverError(res, error);
  }
});

export default router;
