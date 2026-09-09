import express from 'express';
import Activity from '../models/Activity.js';

const router = express.Router();

// POST /api/activities - Create activity
router.post('/', (req, res) => {
  try {
    const { day_id, title, description, start_time, duration_minutes, location_name, latitude, longitude, url } = req.body;

    if (!day_id || !title) {
      return res.status(400).json({
        success: false,
        error: 'day_id and title are required'
      });
    }

    // Check for time conflicts
    if (start_time && duration_minutes) {
      const hasConflict = Activity.checkTimeConflict(day_id, start_time, duration_minutes);
      if (hasConflict) {
        return res.status(400).json({
          success: false,
          error: 'Time conflict: activity overlaps with existing activities',
          warning: true
        });
      }
    }

    const activity = Activity.create({
      day_id,
      title,
      description,
      start_time,
      duration_minutes,
      location_name,
      latitude,
      longitude,
      url
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
router.get('/:id', (req, res) => {
  try {
    const activity = Activity.findById(req.params.id);
    
    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    // Get associated POIs
    const pois = Activity.getAssociatedPois(activity.id);

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
router.put('/:id', (req, res) => {
  try {
    const activity = Activity.findById(req.params.id);
    
    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    // Check for time conflicts if time/duration changed
    if (req.body.start_time && req.body.duration_minutes) {
      const hasConflict = Activity.checkTimeConflict(
        activity.day_id,
        req.body.start_time,
        req.body.duration_minutes
      );
      if (hasConflict) {
        return res.status(400).json({
          success: false,
          error: 'Time conflict: activity overlaps with existing activities',
          warning: true
        });
      }
    }

    const updated = Activity.update(req.params.id, req.body);
    
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
router.delete('/:id', (req, res) => {
  try {
    const activity = Activity.findById(req.params.id);
    
    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    Activity.delete(req.params.id, true); // soft delete

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

export default router;
