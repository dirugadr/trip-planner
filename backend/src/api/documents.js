import express from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import { blobConfigError } from '../config/index.js';
import Trip from '../models/Trip.js';
import Activity from '../models/Activity.js';
import Document from '../models/Document.js';
import { uploadBlob, streamBlob, deleteBlob } from '../lib/blob.js';
import { checkFile, MAX_FILE_BYTES } from '../lib/fileTypes.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

// Wrap multer so its errors (notably LIMIT_FILE_SIZE) become clean 400s.
function uploadSingle(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo supera el límite de 5 MB.'
          : 'No se pudo procesar el archivo.';
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

// POST /api/trips/:tripId/documents — upload a document (multipart/form-data)
router.post('/trips/:tripId/documents', guardBlob, uploadSingle, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'Falta el archivo' });

    const fileError = checkFile(file.mimetype, file.buffer, file.size);
    if (fileError) return res.status(400).json({ success: false, error: fileError });

    let activityId = (req.body.activity_id || '').trim() || null;
    if (activityId) {
      const tripOfActivity = await Activity.tripIdOf(activityId);
      if (tripOfActivity !== trip.id) {
        return res.status(400).json({ success: false, error: 'La actividad no pertenece a este viaje' });
      }
    }

    const title = (req.body.title || '').trim() || file.originalname;

    const stored = await uploadBlob(
      `trips/${trip.id}/${file.originalname}`,
      file.buffer,
      file.mimetype
    );

    const doc = await Document.create({
      trip_id: trip.id,
      activity_id: activityId,
      title,
      file_name: file.originalname,
      file_path: stored.url,
      file_type: file.mimetype,
      file_size_bytes: file.size,
    });

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/trips/:tripId/documents — list documents of a trip
router.get('/trips/:tripId/documents', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });
    res.json({ success: true, data: await Document.findByTripId(trip.id) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/documents/:id/download — stream the private blob through our auth gate
router.get('/documents/:id/download', guardBlob, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Document not found' });

    const result = await streamBlob(doc.file_path);
    if (!result) return res.status(404).json({ success: false, error: 'Archivo no encontrado en el storage' });

    res.setHeader('Content-Type', doc.file_type || 'application/octet-stream');
    if (doc.file_size_bytes) res.setHeader('Content-Length', doc.file_size_bytes);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`
    );
    Readable.fromWeb(result.stream).pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/documents/:id — remove the row AND the blob (hard delete)
router.delete('/documents/:id', guardBlob, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Document not found' });

    await deleteBlob(doc.file_path);
    await Document.hardDelete(doc.id);

    res.json({ success: true, message: 'Documento eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
