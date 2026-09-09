import express from 'express';
import Activity from '../models/Activity.js';

const router = express.Router();

// POST /api/activities - Create activity
router.post('/', async (req, res) => {
  try {
    const { day_id, title, description, start_time, duration_minutes, location_name, latitude, longitude, url, tentative } = req.body;

    if (!day_id || !title) {
      return res.status(400).json({
        success: false,
        error: 'day_id and title are required'
      });
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
    res.status(500).json({
      success: false,
      error: error.message
    });
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

    // Get associated POIs
    const pois = await Activity.getAssociatedPois(activity.id);

    res.json({
      success: true,
      data: {
        ...activity,
        pois
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
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
    res.status(500).json({
      success: false,
      error: error.message
    });
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

    await Activity.delete(req.params.id, true); // soft delete

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
