import { dbAll } from '../db/database.js';
import Trip from './Trip.js';
import BudgetCategory from './BudgetCategory.js';

/**
 * Rolled-up budget view for a trip: per-category allocated vs. spent, plus totals.
 * Single-currency for now (HU-3.5 multi-currency is future) — amounts are summed as-is.
 */
export class Budget {
  static async getSummary(tripId) {
    const trip = await Trip.findById(tripId);
    if (!trip) return null;

    const categories = await BudgetCategory.findByTripId(tripId);

    const spentRows = await dbAll(
      `SELECT category_id, SUM(amount) AS spent, COUNT(*) AS count
       FROM expenses
       WHERE trip_id = ? AND deleted_at IS NULL
       GROUP BY category_id`,
      [tripId]
    );
    const byCat = new Map(spentRows.map((r) => [r.category_id, r]));

    const cats = categories.map((c) => {
      const spent = byCat.get(c.id)?.spent || 0;
      return {
        ...c,
        spent,
        expense_count: byCat.get(c.id)?.count || 0,
        remaining: c.allocated_budget != null ? c.allocated_budget - spent : null,
        over_budget: c.allocated_budget != null && spent > c.allocated_budget
      };
    });

    const totalSpent = spentRows.reduce((s, r) => s + (r.spent || 0), 0);
    const totalAllocated = categories.reduce((s, c) => s + (c.allocated_budget || 0), 0);

    return {
      trip_id: trip.id,
      currency_code: trip.currency_code,
      total_budget: trip.total_budget,
      total_allocated: totalAllocated,
      total_spent: totalSpent,
      remaining: trip.total_budget != null ? trip.total_budget - totalSpent : null,
      over_budget: trip.total_budget != null && totalSpent > trip.total_budget,
      categories: cats
    };
  }
}

export default Budget;
