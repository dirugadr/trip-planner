import { randomUUID } from 'crypto';
import { insertOne, updateOne, deleteOne, dbGet, dbAll, dbRun } from '../db/database.js';

const TABLE = 'budget_categories';

export class BudgetCategory {
  static async create(data) {
    const category = {
      id: randomUUID(),
      trip_id: data.trip_id,
      name: data.name,
      allocated_budget: data.allocated_budget ?? null,
      created_at: new Date().toISOString()
    };

    await insertOne(TABLE, category);
    return category;
  }

  static findById(id) {
    // No soft-delete column on this table.
    return dbGet(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
  }

  static findByTripId(tripId) {
    return dbAll(`SELECT * FROM ${TABLE} WHERE trip_id = ? ORDER BY name ASC`, [tripId]);
  }

  static async update(id, data) {
    const patch = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.allocated_budget !== undefined) patch.allocated_budget = data.allocated_budget;

    if (Object.keys(patch).length > 0) {
      await updateOne(TABLE, id, patch);
    }
    return BudgetCategory.findById(id);
  }

  static async expenseCount(id) {
    const row = await dbGet(
      `SELECT COUNT(*) AS n FROM expenses WHERE category_id = ? AND deleted_at IS NULL`,
      [id]
    );
    return row?.n || 0;
  }

  static async delete(id) {
    // The table has no deleted_at, so this is a hard delete. Callers guarantee no
    // *live* expenses reference it; purge already-soft-deleted ones first so the
    // FK from expenses.category_id doesn't block the delete.
    await dbRun(`DELETE FROM expenses WHERE category_id = ? AND deleted_at IS NOT NULL`, [id]);
    return deleteOne(TABLE, id, false);
  }
}

export default BudgetCategory;
