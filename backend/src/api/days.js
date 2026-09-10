import express from 'express';
import { serverError } from '../lib/http.js';
import Day from '../models/Day.js';

const router = express.Router();

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

export default router;
