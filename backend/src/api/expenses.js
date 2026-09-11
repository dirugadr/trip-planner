import express from 'express';
import { serverError } from '../lib/http.js';
import Trip from '../models/Trip.js';
import Expense from '../models/Expense.js';
import BudgetCategory from '../models/BudgetCategory.js';

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function validatePayload(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || 'amount' in body) {
    const amount = Number(body.amount);
    if (Number.isNaN(amount) || amount <= 0) errors.push('amount debe ser un número mayor a 0');
    else out.amount = amount;
  }
  if (!partial || 'expense_date' in body) {
    if (!DATE_RE.test(body.expense_date || '')) errors.push('expense_date debe tener formato YYYY-MM-DD');
    else out.expense_date = body.expense_date;
  }
  if (!partial || 'category_id' in body) {
    if (!body.category_id) errors.push('category_id es obligatorio');
    else out.category_id = body.category_id;
  }
  if ('description' in body) out.description = body.description?.trim() || null;
  if ('payment_method_id' in body) out.payment_method_id = body.payment_method_id || null;
  if ('activity_id' in body) out.activity_id = body.activity_id || null;
  if ('currency_code' in body && body.currency_code) out.currency_code = body.currency_code;
  if ('is_paid' in body) out.is_paid = body.is_paid ? 1 : 0;

  return { errors, out };
}

// GET /api/expenses?trip_id=... - List a trip's expenses
router.get('/', async (req, res) => {
  try {
    const { trip_id } = req.query;
    if (!trip_id) {
      return res.status(400).json({ success: false, error: 'trip_id is required' });
    }
    const expenses = await Expense.findByTripId(trip_id);
    res.json({ success: true, data: expenses });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/expenses - Record an expense
router.post('/', async (req, res) => {
  try {
    const { trip_id } = req.body;
    if (!trip_id) {
      return res.status(400).json({ success: false, error: 'trip_id es obligatorio' });
    }

    const trip = await Trip.findById(trip_id);
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const { errors, out } = await validatePayload(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, error: errors.join('. ') });
    }

    const category = await BudgetCategory.findById(out.category_id);
    if (!category || category.trip_id !== trip_id) {
      return res.status(400).json({ success: false, error: 'La categoría no pertenece a este viaje' });
    }

    const expense = await Expense.create({
      trip_id,
      ...out,
      currency_code: out.currency_code || trip.currency_code || 'USD'
    });

    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    serverError(res, error);
  }
});

// PUT /api/expenses/:id
router.put('/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }

    const { errors, out } = await validatePayload(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ success: false, error: errors.join('. ') });
    }

    if (out.category_id) {
      const category = await BudgetCategory.findById(out.category_id);
      if (!category || category.trip_id !== expense.trip_id) {
        return res.status(400).json({ success: false, error: 'La categoría no pertenece a este viaje' });
      }
    }

    const updated = await Expense.update(req.params.id, out);
    res.json({ success: true, data: updated });
  } catch (error) {
    serverError(res, error);
  }
});

// DELETE /api/expenses/:id - Soft delete
router.delete('/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    await Expense.delete(req.params.id, true);
    res.json({ success: true, message: 'Gasto eliminado' });
  } catch (error) {
    serverError(res, error);
  }
});

export default router;
