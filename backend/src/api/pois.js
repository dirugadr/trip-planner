import express from 'express';
import Trip from '../models/Trip.js';
import Poi from '../models/Poi.js';
import PoiCategory from '../models/PoiCategory.js';

const router = express.Router();

/**
 * Validate the POI payload. The frontend geocodes the address (Nominatim) and
 * sends resolved coordinates + address; the backend never calls Nominatim, it
 * only checks and persists what it gets.
 */
async function validatePayload(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || 'name' in body) {
    const name = (body.name ?? '').toString().trim();
    if (!name) errors.push('Falta el nombre');
    else out.name = name;
  }

  if (!partial || 'category_id' in body) {
    const categoryId = (body.category_id ?? '').toString().trim();
    if (!categoryId) {
      errors.push('Falta la categoría');
    } else {
      const category = await PoiCategory.findById(categoryId);
      if (!category) errors.push('La categoría no es válida');
      else out.category_id = categoryId;
    }
  }

  // lat/lng travel together — if either is present, both must be valid.
  const hasLat = 'latitude' in body || 'longitude' in body;
  if (!partial || hasLat) {
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      errors.push('La latitud no es válida');
    } else if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      errors.push('La longitud no es válida');
    } else {
      out.latitude = lat;
      out.longitude = lng;
    }
  }

  for (const key of ['address', 'url', 'notes', 'description']) {
    if (key in body) out[key] = (body[key] ?? '').toString().trim() || null;
  }

  return { errors, out };
}

// GET /api/poi-categories — the 7 predefined categories
router.get('/poi-categories', async (req, res) => {
  try {
    res.json({ success: true, data: await PoiCategory.findAll() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/trips/:tripId/pois — POIs of a trip (not deleted)
router.get('/trips/:tripId/pois', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });
    res.json({ success: true, data: await Poi.findByTripId(trip.id) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/trips/:tripId/pois — create a POI
router.post('/trips/:tripId/pois', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const { errors, out } = await validatePayload(req.body);
    if (!('latitude' in out)) errors.push('Falta la ubicación');
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('. ') });

    const poi = await Poi.create({ trip_id: trip.id, ...out });
    res.status(201).json({ success: true, data: poi });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/pois/:id — edit a POI
router.put('/pois/:id', async (req, res) => {
  try {
    const poi = await Poi.findById(req.params.id);
    if (!poi) return res.status(404).json({ success: false, error: 'POI not found' });

    const { errors, out } = await validatePayload(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('. ') });

    const updated = await Poi.update(req.params.id, out);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/pois/:id — soft delete (keeps activity_pois associations, HU-2.3)
router.delete('/pois/:id', async (req, res) => {
  try {
    const poi = await Poi.findById(req.params.id);
    if (!poi) return res.status(404).json({ success: false, error: 'POI not found' });
    await Poi.delete(req.params.id, true);
    res.json({ success: true, message: 'Lugar eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
