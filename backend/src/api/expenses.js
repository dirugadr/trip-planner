import express from 'express';
import { serverError } from '../lib/http.js';
import Expense from '../models/Expense.js';
import BudgetCategory from '../models/BudgetCategory.js';
import { validateExpensePayload, createExpense } from '../lib/mutations.js';

const router = express.Router();

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

// POST /api/expenses - Record an expense (logic shared with the MCP tools: lib/mutations.js)
router.post('/', async (req, res) => {
  try {
    const result = await createExpense(req.body);
    if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
    res.status(201).json({ success: true, data: result.expense });
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

    const { errors, out } = await validateExpensePayload(req.body, { partial: true });
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
