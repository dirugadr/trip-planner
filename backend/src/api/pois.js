import express from 'express';
import { serverError } from '../lib/http.js';
import multer from 'multer';
import { Readable } from 'stream';
import Trip from '../models/Trip.js';
import Poi from '../models/Poi.js';
import PoiCategory from '../models/PoiCategory.js';
import ActivityPoi from '../models/ActivityPoi.js';
import { sanitizeHttpUrl } from '../lib/url.js';
import { lookupPhotoNear } from '../lib/photoLookup.js';
import { blobConfigError, anthropicConfigError } from '../config/index.js';
import { uploadBlob, streamBlob } from '../lib/blob.js';
import { checkImageFile, MAX_FILE_BYTES } from '../lib/fileTypes.js';
import { discoverPois, dropNearSaved } from '../lib/poiDiscovery.js';
import { classifyDiscoveredPois } from '../lib/smartRoute.js';

const router = express.Router();
// Routes that must NOT sit behind requireAuth — mounted separately, earlier,
// in app.js. See the GET /pois/:id/photo handler below for why.
export const publicPoisRouter = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } });

function uploadSingle(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera el límite de 5 MB.' : 'No se pudo procesar la imagen.';
      return res.status(400).json({ success: false, error: msg });
    }
    next();
  });
}

function guardBlob(req, res, next) {
  const err = blobConfigError();
  if (err) return res.status(503).json({ success: false, error: err });
  next();
}

/**
 * Validate the POI payload. The frontend geocodes the address (Nominatim) and
 * sends resolved coordinates + address; the backend never calls Nominatim, it
 * only checks and persists what it gets.
 */
export async function validatePoiPayload(body, { partial = false } = {}) {
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

  for (const key of ['address', 'city', 'notes', 'description']) {
    if (key in body) out[key] = (body[key] ?? '').toString().trim() || null;
  }
  if ('url' in body) {
    const raw = (body.url ?? '').toString().trim();
    if (raw && !sanitizeHttpUrl(raw)) errors.push('El enlace debe empezar con http:// o https://');
    else out.url = sanitizeHttpUrl(raw);
  }

  if ('estimated_duration_minutes' in body) {
    const raw = body.estimated_duration_minutes;
    if (raw === '' || raw == null) {
      out.estimated_duration_minutes = null;
    } else {
      const minutes = Number(raw);
      if (!Number.isInteger(minutes) || minutes <= 0) {
        errors.push('La duración estimada debe ser un número entero de minutos mayor a 0');
      } else {
        out.estimated_duration_minutes = minutes;
      }
    }
  }

  return { errors, out };
}

// GET /api/poi-categories — the 7 predefined categories
router.get('/poi-categories', async (req, res) => {
  try {
    res.json({ success: true, data: await PoiCategory.findAll() });
  } catch (error) {
    serverError(res, error);
  }
});

// GET /api/trips/:tripId/pois — POIs of a trip (not deleted)
router.get('/trips/:tripId/pois', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });
    res.json({ success: true, data: await Poi.findByTripId(trip.id) });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/trips/:tripId/pois — create a POI
router.post('/trips/:tripId/pois', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const { errors, out } = await validatePoiPayload(req.body);
    if (!('latitude' in out)) errors.push('Falta la ubicación');
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('. ') });

    let poi = await Poi.create({ trip_id: trip.id, ...out });

    // Foto por lugar: best-effort, never blocks creating the POI.
    const photo = await lookupPhotoNear(poi.latitude, poi.longitude);
    if (photo) poi = (await Poi.setPhoto(poi.id, photo)) || poi;

    res.status(201).json({ success: true, data: poi });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/trips/:tripId/pois/discover — { bounds: {south,west,north,east} } -> candidate
// places for "Buscar POIs en la zona" (HU-2.8): Overpass raw results within the visible
// map area, classified by Claude into the 3 categories this search covers (Atracción
// turística/Naturaleza/Cultura), minus anything within ~50m of an already-saved POI.
// Nothing is persisted here — POST /trips/:tripId/pois above does that when the traveler
// confirms one via "Agregar a Lugares". No area size limit (unlike the old HU-2.6b
// prototype this replaces): no route/walk-time matrix is computed, so it's cheap either way.
router.post('/trips/:tripId/pois/discover', async (req, res) => {
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

    const configErr = anthropicConfigError();
    if (configErr) return res.status(503).json({ success: false, error: configErr });

    const raw = await discoverPois(bounds);
    if (raw.length === 0) return res.json({ success: true, data: [] });

    const savedPois = await Poi.findByTripId(trip.id);
    const unseen = dropNearSaved(raw, savedPois);
    if (unseen.length === 0) return res.json({ success: true, data: [] });

    const withIds = unseen.map((c, i) => ({ ...c, candidate_id: `osm:${i}` }));
    const classified = await classifyDiscoveredPois({
      candidates: withIds.map((c) => ({ candidate_id: c.candidate_id, name: c.name, hint: c.hint })),
    }).catch((e) => {
      res.status(e.status || 502).json({ success: false, error: e.message });
      return null;
    });
    if (!classified) return undefined;

    const categories = await PoiCategory.findAll();
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const byId = new Map(withIds.map((c) => [c.candidate_id, c]));

    const data = classified
      .map(({ candidate_id, category_id }) => {
        const c = byId.get(candidate_id);
        const cat = categoryById.get(category_id);
        if (!c || !cat) return null;
        return {
          candidate_id,
          name: c.name,
          latitude: c.latitude,
          longitude: c.longitude,
          address: c.address,
          category_id,
          category_name: cat.name,
          category_icon: cat.icon,
          category_color: cat.color,
        };
      })
      .filter(Boolean);

    res.json({ success: true, data });
  } catch (error) {
    serverError(res, error);
  }
});

// PUT /api/pois/:id — edit a POI
router.put('/pois/:id', async (req, res) => {
  try {
    const poi = await Poi.findById(req.params.id);
    if (!poi) return res.status(404).json({ success: false, error: 'POI not found' });

    const { errors, out } = await validatePoiPayload(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('. ') });

    let updated = await Poi.update(req.params.id, out);

    // Only re-run the automatic lookup when the location actually moved, and
    // never overwrite a photo the traveler chose themselves.
    const locationChanged =
      'latitude' in out && (out.latitude !== poi.latitude || out.longitude !== poi.longitude);
    if (updated && locationChanged && poi.photo_source !== 'manual') {
      const photo = await lookupPhotoNear(updated.latitude, updated.longitude);
      if (photo) updated = (await Poi.setPhoto(updated.id, photo)) || updated;
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/pois/:id/photo — upload a manual photo (multipart/form-data), replaces any existing one
router.post('/pois/:id/photo', guardBlob, uploadSingle, async (req, res) => {
  try {
    const poi = await Poi.findById(req.params.id);
    if (!poi) return res.status(404).json({ success: false, error: 'POI not found' });

    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'Falta la imagen' });

    const fileError = checkImageFile(file.mimetype, file.buffer, file.size);
    if (fileError) return res.status(400).json({ success: false, error: fileError });

    // The Blob store backing this project is private-only (confirmed live —
    // `access: 'public'` on an upload is rejected by Vercel Blob when the
    // store itself is private), so a manual photo can't be hotlinked from
    // its raw blob URL. Store that URL server-side only (photo_blob_url) and
    // expose our own streaming route below as the client-facing photo_url.
    const stored = await uploadBlob(`pois/${poi.id}/${file.originalname}`, file.buffer, file.mimetype);
    const updated = await Poi.setPhoto(poi.id, {
      url: `/api/pois/${poi.id}/photo`,
      source: 'manual',
      blobUrl: stored.url,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    serverError(res, error);
  }
});

// GET /api/pois/:id/photo — streams a manually-uploaded photo from the
// private Blob store. Deliberately NOT behind requireAuth (mounted before it
// in app.js) — it's rendered as a plain <img src>, which can't carry an
// Authorization header, and a tourist-attraction/restaurant photo is
// low-sensitivity content (unlike Documents, which stay fully authenticated).
publicPoisRouter.get('/pois/:id/photo', guardBlob, async (req, res) => {
  try {
    const poi = await Poi.findById(req.params.id);
    if (!poi?.photo_blob_url) return res.status(404).json({ success: false, error: 'Photo not found' });

    const result = await streamBlob(poi.photo_blob_url);
    if (!result) return res.status(404).json({ success: false, error: 'Photo not found in storage' });

    res.setHeader('Content-Type', /\.png$/i.test(poi.photo_blob_url) ? 'image/png' : 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    Readable.fromWeb(result.stream).pipe(res);
  } catch (error) {
    serverError(res, error);
  }
});

// DELETE /api/pois/:id — soft delete the POI, drop its activity associations (HU-2.3)
router.delete('/pois/:id', async (req, res) => {
  try {
    const poi = await Poi.findById(req.params.id);
    if (!poi) return res.status(404).json({ success: false, error: 'POI not found' });
    await ActivityPoi.deleteByPoiId(req.params.id);
    await Poi.delete(req.params.id, true);
    res.json({ success: true, message: 'Lugar eliminado' });
  } catch (error) {
    serverError(res, error);
  }
});

export default router;
