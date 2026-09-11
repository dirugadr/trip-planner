import express from 'express';
import { serverError } from '../lib/http.js';
import { sanitizeHttpUrl } from '../lib/url.js';
import Trip from '../models/Trip.js';
import InterestLink from '../models/InterestLink.js';
import Tag from '../models/Tag.js';

const router = express.Router();

function validateLinkPayload(body) {
  const errors = [];
  const out = {};

  const title = (body.title ?? '').toString().trim();
  if (!title) errors.push('Falta el título');
  else out.title = title;

  const rawUrl = (body.url ?? '').toString().trim();
  if (!rawUrl) errors.push('Falta el link');
  else {
    const safe = sanitizeHttpUrl(rawUrl);
    if (!safe) errors.push('El link debe empezar con http:// o https://');
    else out.url = safe;
  }

  const tags = Array.isArray(body.tags) ? body.tags : [];
  out.tagNames = tags.map((t) => (t ?? '').toString().trim()).filter(Boolean);

  return { errors, out };
}

// GET /api/trips/:tripId/links — list links (optional ?tags=a,b,c OR filter)
router.get('/trips/:tripId/links', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const tagFilter = (req.query.tags || '')
      .toString()
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    res.json({ success: true, data: await InterestLink.findByTripId(trip.id, tagFilter) });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/trips/:tripId/links — create a link
router.post('/trips/:tripId/links', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const { errors, out } = validateLinkPayload(req.body);
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('. ') });

    const link = await InterestLink.create({ trip_id: trip.id, ...out });
    res.status(201).json({ success: true, data: link });
  } catch (error) {
    serverError(res, error);
  }
});

// PUT /api/links/:id — edit title, url and tags
router.put('/links/:id', async (req, res) => {
  try {
    const existing = await InterestLink.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Link not found' });

    const { errors, out } = validateLinkPayload(req.body);
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('. ') });

    const updated = await InterestLink.update(req.params.id, out);
    res.json({ success: true, data: updated });
  } catch (error) {
    serverError(res, error);
  }
});

// DELETE /api/links/:id — soft delete (tags persist for reuse)
router.delete('/links/:id', async (req, res) => {
  try {
    const existing = await InterestLink.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Link not found' });

    await InterestLink.delete(req.params.id);
    res.json({ success: true, message: 'Link eliminado' });
  } catch (error) {
    serverError(res, error);
  }
});

// GET /api/trips/:tripId/tags — tags already used in the trip, for autocomplete
router.get('/trips/:tripId/tags', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });
    res.json({ success: true, data: await Tag.findByTripId(trip.id) });
  } catch (error) {
    serverError(res, error);
  }
});

export default router;
