import express from 'express';
import { serverError } from '../lib/http.js';
import Trip from '../models/Trip.js';
import BudgetCategory from '../models/BudgetCategory.js';

const router = express.Router();

function parseAllocated(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return NaN;
  return n;
}

// GET /api/budget-categories?trip_id=... - List a trip's budget categories
router.get('/', async (req, res) => {
  try {
    const { trip_id } = req.query;
    if (!trip_id) {
      return res.status(400).json({ success: false, error: 'trip_id is required' });
    }
    const categories = await BudgetCategory.findByTripId(trip_id);
    res.json({ success: true, data: categories });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/budget-categories - Create a category
router.post('/', async (req, res) => {
  try {
    const { trip_id, name, allocated_budget } = req.body;

    if (!trip_id || !name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'trip_id y name son obligatorios' });
    }

    const trip = await Trip.findById(trip_id);
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const allocated = parseAllocated(allocated_budget);
    if (Number.isNaN(allocated)) {
      return res.status(400).json({ success: false, error: 'allocated_budget debe ser un número ≥ 0' });
    }

    const category = await BudgetCategory.create({
      trip_id,
      name: name.trim(),
      allocated_budget: allocated
    });

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    if (/UNIQUE/i.test(error.message)) {
      return res.status(400).json({ success: false, error: 'Ya existe una categoría con ese nombre en el viaje' });
    }
    serverError(res, error);
  }
});

// PUT /api/budget-categories/:id
router.put('/:id', async (req, res) => {
  try {
    const category = await BudgetCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const patch = {};
    if ('name' in req.body) {
      if (!req.body.name || !req.body.name.trim()) {
        return res.status(400).json({ success: false, error: 'name no puede estar vacío' });
      }
      patch.name = req.body.name.trim();
    }
    if ('allocated_budget' in req.body) {
      const allocated = parseAllocated(req.body.allocated_budget);
      if (Number.isNaN(allocated)) {
        return res.status(400).json({ success: false, error: 'allocated_budget debe ser un número ≥ 0' });
      }
      patch.allocated_budget = allocated;
    }

    const updated = await BudgetCategory.update(req.params.id, patch);
    res.json({ success: true, data: updated });
  } catch (error) {
    if (/UNIQUE/i.test(error.message)) {
      return res.status(400).json({ success: false, error: 'Ya existe una categoría con ese nombre en el viaje' });
    }
    serverError(res, error);
  }
});

// DELETE /api/budget-categories/:id
router.delete('/:id', async (req, res) => {
  try {
    const category = await BudgetCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const count = await BudgetCategory.expenseCount(req.params.id);
    if (count > 0) {
      return res.status(400).json({
        success: false,
        error: `No se puede eliminar: la categoría tiene ${count} gasto(s). Reasignálos o eliminálos primero.`
      });
    }

    await BudgetCategory.delete(req.params.id);
    res.json({ success: true, message: 'Categoría eliminada' });
  } catch (error) {
    serverError(res, error);
  }
});

export default router;
