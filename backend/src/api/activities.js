import express from 'express';
import { serverError } from '../lib/http.js';
import Activity from '../models/Activity.js';
import ActivityPoi from '../models/ActivityPoi.js';
import Poi from '../models/Poi.js';
import { validatePoiPayload } from './pois.js';
import { dbBatch } from '../db/database.js';
import { sanitizeHttpUrl } from '../lib/url.js';

const router = express.Router();

// POST /api/activities - Create activity
router.post('/', async (req, res) => {
  try {
    const { day_id, title, description, start_time, duration_minutes, location_name, latitude, longitude, tentative } = req.body;

    if (!day_id || !title) {
      return res.status(400).json({
        success: false,
        error: 'day_id and title are required'
      });
    }

    const url = 'url' in req.body ? sanitizeHttpUrl(req.body.url) : undefined;
    if (req.body.url && !url) {
      return res.status(400).json({ success: false, error: 'El enlace debe empezar con http:// o https://' });
    }

    // Tentative plans don't need to be conflict-free
    if (!tentative && start_time && duration_minutes) {
      const hasConflict = await Activity.checkTimeConflict(day_id, start_time, duration_minutes);
      if (hasConflict) {
        return res.status(400).json({
          success: false,
          error: 'Time conflict: activity overlaps with existing activities',
          warning: true
        });
      }
    }

    const activity = await Activity.create({
      day_id,
      title,
      description,
      start_time,
      duration_minutes,
      location_name,
      latitude,
      longitude,
      url,
      tentative
    });

    res.status(201).json({
      success: true,
      data: activity
    });
  } catch (error) {
    serverError(res, error);
  }
});

// GET /api/activities/:id - Get activity details
router.get('/:id', async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    const pois = await ActivityPoi.list(activity.id);

    res.json({
      success: true,
      data: {
        ...activity,
        pois
      }
    });
  } catch (error) {
    serverError(res, error);
  }
});

// PUT /api/activities/:id - Update activity
router.put('/:id', async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    if ('tentative' in req.body) req.body.tentative = req.body.tentative ? 1 : 0;
    const isTentative = 'tentative' in req.body ? req.body.tentative : activity.tentative;

    if ('url' in req.body) {
      const clean = sanitizeHttpUrl(req.body.url);
      if (req.body.url && !clean) {
        return res.status(400).json({ success: false, error: 'El enlace debe empezar con http:// o https://' });
      }
      req.body.url = clean;
    }

    // Tentative plans don't need to be conflict-free
    if (!isTentative && req.body.start_time && req.body.duration_minutes) {
      const hasConflict = await Activity.checkTimeConflict(
        activity.day_id,
        req.body.start_time,
        req.body.duration_minutes,
        activity.id
      );
      if (hasConflict) {
        return res.status(400).json({
          success: false,
          error: 'Time conflict: activity overlaps with existing activities',
          warning: true
        });
      }
    }

    const updated = await Activity.update(req.params.id, req.body);

    if (!updated) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update activity'
      });
    }

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    serverError(res, error);
  }
});

// DELETE /api/activities/:id - Delete activity
router.delete('/:id', async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    await ActivityPoi.deleteByActivityId(req.params.id); // drop POI associations (HU-2.3)
    await Activity.delete(req.params.id, true); // soft delete

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/activities/:id/move - Reorder within the day ({ direction: 'up' | 'down' })
router.post('/:id/move', async (req, res) => {
  try {
    const { direction } = req.body;
    if (direction !== 'up' && direction !== 'down') {
      return res.status(400).json({ success: false, error: "direction must be 'up' or 'down'" });
    }

    const moved = await Activity.move(req.params.id, direction);
    if (!moved) {
      return res.status(404).json({ success: false, error: 'Activity not found' });
    }

    res.json({ success: true, data: moved });
  } catch (error) {
    serverError(res, error);
  }
});

// ============================================
// Associated POIs (HU-2.3)
// ============================================

// GET /api/activities/:activityId/pois - list associated POIs, ordered
router.get('/:activityId/pois', async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.activityId);
    if (!activity) return res.status(404).json({ success: false, error: 'Activity not found' });
    res.json({ success: true, data: await ActivityPoi.list(activity.id) });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/activities/:activityId/pois - associate an existing POI ({ poi_id })
router.post('/:activityId/pois', async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.activityId);
    if (!activity) return res.status(404).json({ success: false, error: 'Activity not found' });

    const { poi_id } = req.body;
    if (!poi_id) return res.status(400).json({ success: false, error: 'poi_id es obligatorio' });

    const poi = await Poi.findById(poi_id);
    if (!poi) return res.status(404).json({ success: false, error: 'POI not found' });

    const tripId = await Activity.tripIdOf(activity.id);
    if (poi.trip_id !== tripId) {
      return res.status(400).json({ success: false, error: 'El lugar no pertenece a este viaje' });
    }

    if (await ActivityPoi.exists(activity.id, poi_id)) {
      return res.status(409).json({ success: false, error: 'Ese lugar ya está asociado a la actividad' });
    }

    await ActivityPoi.associate(activity.id, poi_id);
    res.status(201).json({ success: true, data: await ActivityPoi.list(activity.id) });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/activities/:activityId/pois/new - create a POI and associate it, atomically
router.post('/:activityId/pois/new', async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.activityId);
    if (!activity) return res.status(404).json({ success: false, error: 'Activity not found' });

    const tripId = await Activity.tripIdOf(activity.id);
    if (!tripId) return res.status(404).json({ success: false, error: 'Trip not found' });

    const { errors, out } = await validatePoiPayload(req.body);
    if (!('latitude' in out)) errors.push('Falta la ubicación');
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('. ') });

    // One transaction: create the POI + its association. If either fails, neither lands.
    const row = Poi.rowFor({ trip_id: tripId, ...out });
    await dbBatch([
      Poi.insertStmt(row),
      ActivityPoi.insertStmt(activity.id, row.id, await ActivityPoi.nextSequence(activity.id)),
    ]);

    res.status(201).json({ success: true, data: await ActivityPoi.list(activity.id) });
  } catch (error) {
    serverError(res, error);
  }
});

// PUT /api/activities/:activityId/pois/reorder - set order from { poi_ids: [...] }
router.put('/:activityId/pois/reorder', async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.activityId);
    if (!activity) return res.status(404).json({ success: false, error: 'Activity not found' });

    const { poi_ids } = req.body;
    if (!Array.isArray(poi_ids) || poi_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'poi_ids debe ser una lista' });
    }

    const current = await ActivityPoi.list(activity.id);
    const currentIds = new Set(current.map((p) => p.id));
    if (poi_ids.length !== currentIds.size || poi_ids.some((id) => !currentIds.has(id))) {
      return res.status(400).json({ success: false, error: 'La lista no coincide con los lugares asociados' });
    }

    await ActivityPoi.reorder(activity.id, poi_ids);
    res.json({ success: true, data: await ActivityPoi.list(activity.id) });
  } catch (error) {
    serverError(res, error);
  }
});

// DELETE /api/activities/:activityId/pois/:poiId - dissociate (keeps the POI)
router.delete('/:activityId/pois/:poiId', async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.activityId);
    if (!activity) return res.status(404).json({ success: false, error: 'Activity not found' });

    await ActivityPoi.dissociate(activity.id, req.params.poiId);
    res.json({ success: true, data: await ActivityPoi.list(activity.id) });
  } catch (error) {
    serverError(res, error);
  }
});

export default router;
