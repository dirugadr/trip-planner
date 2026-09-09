import express from 'express';
import Trip from '../models/Trip.js';
import Accommodation from '../models/Accommodation.js';
import Expense from '../models/Expense.js';
import BudgetCategory from '../models/BudgetCategory.js';

const router = express.Router();

const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function validateFields(body, { partial = false } = {}) {
  const errors = [];
  const out = {};
  const required = {
    name: 'nombre',
    check_in: 'fecha de entrada',
    check_out: 'fecha de salida',
    address: 'dirección',
    city: 'ciudad'
  };

  for (const [key, label] of Object.entries(required)) {
    if (!partial || key in body) {
      const val = (body[key] ?? '').toString().trim();
      if (!val) errors.push(`Falta ${label}`);
      else out[key] = val;
    }
  }

  for (const key of ['check_in', 'check_out']) {
    if (out[key] && !DATETIME_RE.test(out[key])) {
      errors.push(`${key === 'check_in' ? 'La entrada' : 'La salida'} debe ser fecha y hora válidas`);
    }
  }
  if (out.check_in && out.check_out && out.check_out <= out.check_in) {
    errors.push('La salida debe ser posterior a la entrada');
  }

  for (const key of ['phone', 'email', 'booking_url']) {
    if (key in body) out[key] = (body[key] ?? '').toString().trim() || null;
  }

  return { errors, out };
}

/**
 * Create / update / soft-delete the expense linked to an accommodation so it
 * mirrors the form's optional "payment" section.
 */
async function syncExpense(accommodation, payment, trip) {
  const existing = await Expense.findByAccommodationId(accommodation.id);
  const amount = payment ? Number(payment.amount) : NaN;
  const hasPayment = payment && payment.amount !== '' && payment.amount != null && amount > 0;

  if (!hasPayment) {
    if (existing) await Expense.delete(existing.id, true);
    return;
  }

  if (!payment.category_id) {
    const err = new Error('El pago necesita una categoría de presupuesto');
    err.status = 400;
    throw err;
  }
  const category = await BudgetCategory.findById(payment.category_id);
  if (!category || category.trip_id !== trip.id) {
    const err = new Error('La categoría no pertenece a este viaje');
    err.status = 400;
    throw err;
  }

  const fields = {
    category_id: payment.category_id,
    payment_method_id: payment.payment_method_id || null,
    amount,
    currency_code: trip.currency_code || 'USD',
    expense_date: accommodation.check_in.slice(0, 10),
    description: `Alojamiento: ${accommodation.name}`
  };

  if (existing) {
    await Expense.update(existing.id, fields);
  } else {
    await Expense.create({ trip_id: trip.id, accommodation_id: accommodation.id, ...fields });
  }
}

// GET /api/accommodations?trip_id=...
router.get('/', async (req, res) => {
  try {
    const { trip_id } = req.query;
    if (!trip_id) return res.status(400).json({ success: false, error: 'trip_id is required' });
    res.json({ success: true, data: await Accommodation.findByTripId(trip_id) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/accommodations
router.post('/', async (req, res) => {
  try {
    const { trip_id, payment } = req.body;
    if (!trip_id) return res.status(400).json({ success: false, error: 'trip_id es obligatorio' });

    const trip = await Trip.findById(trip_id);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const { errors, out } = validateFields(req.body);
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('. ') });

    const accommodation = await Accommodation.create({ trip_id, ...out });

    try {
      await syncExpense(accommodation, payment, trip);
    } catch (e) {
      return res.status(e.status || 500).json({ success: false, error: e.message });
    }

    res.status(201).json({ success: true, data: accommodation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/accommodations/:id
router.put('/:id', async (req, res) => {
  try {
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) return res.status(404).json({ success: false, error: 'Accommodation not found' });

    const merged = { ...req.body };
    const { errors, out } = validateFields(
      { ...accommodation, ...merged },
      { partial: false }
    );
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('. ') });

    const updated = await Accommodation.update(req.params.id, out);
    const trip = await Trip.findById(accommodation.trip_id);

    try {
      await syncExpense(updated, req.body.payment, trip);
    } catch (e) {
      return res.status(e.status || 500).json({ success: false, error: e.message });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/accommodations/:id - soft delete accommodation + its linked expense
router.delete('/:id', async (req, res) => {
  try {
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) return res.status(404).json({ success: false, error: 'Accommodation not found' });

    const expense = await Expense.findByAccommodationId(req.params.id);
    if (expense) await Expense.delete(expense.id, true);
    await Accommodation.delete(req.params.id, true);

    res.json({ success: true, message: 'Alojamiento eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
