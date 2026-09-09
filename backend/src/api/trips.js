import express from 'express';
import Trip from '../models/Trip.js';
import Day from '../models/Day.js';

const router = express.Router();

// GET /api/trips - List all trips
router.get('/', (req, res) => {
  try {
    const trips = Trip.findAll();
    res.json({
      success: true,
      data: trips
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/trips - Create a new trip
router.post('/', (req, res) => {
  try {
    const { name, description, start_date, end_date, currency_code, total_budget, timezone } = req.body;

    // Validation
    if (!name || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'name, start_date, and end_date are required'
      });
    }

    if (new Date(end_date) <= new Date(start_date)) {
      return res.status(400).json({
        success: false,
        error: 'end_date must be after start_date'
      });
    }

    const trip = Trip.create({
      name,
      description,
      start_date,
      end_date,
      currency_code,
      total_budget,
      timezone
    });

    // Create days for the trip
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const numDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    for (let i = 0; i < numDays; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + i);
      
      Day.create({
        trip_id: trip.id,
        day_number: i + 1,
        date: dayDate.toISOString().split('T')[0]
      });
    }

    res.status(201).json({
      success: true,
      data: trip
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/trips/:id - Get trip details with days and activities
router.get('/:id', (req, res) => {
  try {
    const trip = Trip.findById(req.params.id);
    
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    // Get days and activities
    const days = Day.findByTripId(trip.id).map(day => ({
      ...day,
      activities: Day.getActivities(day.id),
      totalDuration: Day.getTotalDuration(day.id)
    }));

    // Get stats
    const stats = Trip.getStats(trip.id);

    res.json({
      success: true,
      data: {
        ...trip,
        days,
        stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/trips/:id - Update trip
router.put('/:id', (req, res) => {
  try {
    const trip = Trip.findById(req.params.id);
    
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    const updated = Trip.update(req.params.id, req.body);
    
    if (!updated) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update trip'
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

// DELETE /api/trips/:id - Delete trip (soft delete)
router.delete('/:id', (req, res) => {
  try {
    const trip = Trip.findById(req.params.id);
    
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    Trip.delete(req.params.id, true); // soft delete

    res.json({
      success: true,
      message: 'Trip deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
