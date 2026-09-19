import express from 'express';
import { serverError } from '../lib/http.js';
import Trip from '../models/Trip.js';
import Day from '../models/Day.js';
import Budget from '../models/Budget.js';
import Accommodation from '../models/Accommodation.js';
import { loadActivityDetails } from '../lib/activityDetails.js';

const router = express.Router();

// GET /api/trips - List all trips
router.get('/', async (req, res) => {
  try {
    const trips = await Trip.findAll();
    res.json({
      success: true,
      data: trips
    });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/trips - Create a new trip
router.post('/', async (req, res) => {
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

    const trip = await Trip.create({
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

      await Day.create({
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
    serverError(res, error);
  }
});

// GET /api/trips/:id - Get trip details with days and activities
router.get('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    // Accommodations -> per-day city label (HU-8.4)
    const accommodations = await Accommodation.findByTripId(trip.id);
    const citiesForDay = (date) => {
      const cities = [];
      for (const a of accommodations) {
        if (a.check_in.slice(0, 10) <= date && date <= a.check_out.slice(0, 10)) {
          if (!cities.includes(a.city)) cities.push(a.city);
        }
      }
      return cities;
    };

    // Get days and activities
    const tripDays = await Day.findByTripId(trip.id);
    let days = await Promise.all(
      tripDays.map(async (day) => ({
        ...day,
        activities: await Day.getActivities(day.id),
        totalDuration: await Day.getTotalDuration(day.id),
        cities: citiesForDay(day.date)
      }))
    );

    // Attach each activity's associated POIs (HU-2.3), linked document
    // (HU-6.4) and linked expense (HU-3.3/3.4) in one query each — the
    // itinerary card (v2 UI) shows all three without per-activity requests.
    const activityIds = days.flatMap((d) => d.activities.map((a) => a.id));
    const withDetails = await loadActivityDetails(activityIds);
    days = days.map((day) => ({
      ...day,
      activities: day.activities.map(withDetails)
    }));

    // Get stats
    const stats = await Trip.getStats(trip.id);

    res.json({
      success: true,
      data: {
        ...trip,
        days,
        stats
      }
    });
  } catch (error) {
    serverError(res, error);
  }
});

// PUT /api/trips/:id - Update trip
router.put('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    const nextStart = req.body.start_date || trip.start_date;
    const nextEnd = req.body.end_date || trip.end_date;
    if (new Date(nextEnd) <= new Date(nextStart)) {
      return res.status(400).json({
        success: false,
        error: 'end_date must be after start_date'
      });
    }

    const updated = await Trip.update(req.params.id, req.body);

    if (!updated) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update trip'
      });
    }

    // Keep the days in sync when the date range changed (HU-1.12)
    const datesChanged =
      nextStart !== trip.start_date || nextEnd !== trip.end_date;
    if (datesChanged) {
      await Day.syncToRange(updated.id, updated.start_date, updated.end_date);
    }

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    serverError(res, error);
  }
});

// DELETE /api/trips/:id - Delete trip (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    await Trip.delete(req.params.id, true); // soft delete

    res.json({
      success: true,
      message: 'Trip deleted successfully'
    });
  } catch (error) {
    serverError(res, error);
  }
});

// PUT /api/trips/:tripId/last-viewed-day - Remember which day the traveler was
// looking at in Itinerario, so re-entering the tab (any device) lands there.
router.put('/:tripId/last-viewed-day', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const { day_id } = req.body;
    if (!day_id) return res.status(400).json({ success: false, error: 'day_id es obligatorio' });

    const day = await Day.findById(day_id);
    if (!day || day.trip_id !== trip.id) {
      return res.status(400).json({ success: false, error: 'El día no pertenece a este viaje' });
    }

    const updated = await Trip.update(trip.id, { last_viewed_day_id: day_id });
    res.json({ success: true, data: updated });
  } catch (error) {
    serverError(res, error);
  }
});

// GET /api/trips/:id/budget - Budget summary: categories with allocated vs spent, plus totals
router.get('/:id/budget', async (req, res) => {
  try {
    const summary = await Budget.getSummary(req.params.id);
    if (!summary) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }
    res.json({ success: true, data: summary });
  } catch (error) {
    serverError(res, error);
  }
});

export default router;
