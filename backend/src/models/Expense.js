import { v4 as uuidv4 } from 'uuid';
import { insertOne, updateOne, deleteOne, findById, dbAll } from '../db/database.js';

const TABLE = 'expenses';

export class Expense {
  static async create(data) {
    const expense = {
      id: uuidv4(),
      trip_id: data.trip_id,
      category_id: data.category_id,
      activity_id: data.activity_id || null,
      accommodation_id: data.accommodation_id || null,
      payment_method_id: data.payment_method_id || null,
      amount: data.amount,
      currency_code: data.currency_code,
      description: data.description || null,
      expense_date: data.expense_date,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      version: 1
    };

    await insertOne(TABLE, expense);
    return expense;
  }

  static findById(id) {
    return findById(TABLE, id);
  }

  static findByTripId(tripId) {
    return dbAll(
      `SELECT * FROM ${TABLE}
       WHERE trip_id = ? AND deleted_at IS NULL
       ORDER BY expense_date DESC, created_at DESC`,
      [tripId]
    );
  }

  static async findByAccommodationId(accommodationId) {
    const rows = await dbAll(
      `SELECT * FROM ${TABLE} WHERE accommodation_id = ? AND deleted_at IS NULL LIMIT 1`,
      [accommodationId]
    );
    return rows[0] || null;
  }

  static async update(id, data) {
    const allowed = [
      'category_id',
      'activity_id',
      'accommodation_id',
      'payment_method_id',
      'amount',
      'currency_code',
      'description',
      'expense_date'
    ];
    const patch = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in data) patch[key] = data[key];
    }

    const ok = await updateOne(TABLE, id, patch);
    return ok ? Expense.findById(id) : null;
  }

  static delete(id, soft = true) {
    return deleteOne(TABLE, id, soft);
  }
}

export default Expense;
