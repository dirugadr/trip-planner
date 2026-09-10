import { randomUUID } from 'crypto';
import { insertOne, updateOne, deleteOne, findById, dbGet, dbAll } from '../db/database.js';

const TABLE = 'trips';

// Columns a client may set via PUT /api/trips/:id. Everything else (id,
// timestamps, version, deleted_at) is managed server-side — never mass-assigned.
const EDITABLE = ['name', 'description', 'start_date', 'end_date', 'currency_code', 'total_budget', 'timezone'];

export class Trip {
  static async create(data) {
    const trip = {
      id: randomUUID(),
      name: data.name,
      description: data.description || null,
      start_date: data.start_date,
      end_date: data.end_date,
      currency_code: data.currency_code || 'USD',
      total_budget: data.total_budget || null,
      timezone: data.timezone || 'UTC',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      version: 1
    };

    await insertOne(TABLE, trip);
    return trip;
  }

  static findById(id) {
    return findById(TABLE, id);
  }

  // Soonest trip first (HU-1.2), stable tiebreak on creation order.
  static findAll() {
    return dbAll(
      `SELECT * FROM ${TABLE} WHERE deleted_at IS NULL ORDER BY start_date ASC, created_at ASC`
    );
  }

  static async update(id, data) {
    const updates = { updated_at: new Date().toISOString(), version: (data.version || 0) + 1 };
    for (const key of EDITABLE) {
      if (key in data) updates[key] = data[key];
    }

    const success = await updateOne(TABLE, id, updates);
    if (success) {
      return Trip.findById(id);
    }
    return null;
  }

  static delete(id, soft = true) {
    return deleteOne(TABLE, id, soft);
  }

  static async getStats(tripId) {
    // Count activities
    const activitiesCount = await dbGet(
      `SELECT COUNT(*) as count FROM activities
       WHERE day_id IN (SELECT id FROM days WHERE trip_id = ?)
       AND deleted_at IS NULL`,
      [tripId]
    );

    // Count POIs
    const poisCount = await dbGet(
      `SELECT COUNT(*) as count FROM pois_saved
       WHERE trip_id = ? AND deleted_at IS NULL`,
      [tripId]
    );

    // Sum expenses
    const expensesTotal = await dbGet(
      `SELECT SUM(amount) as total FROM expenses
       WHERE trip_id = ? AND deleted_at IS NULL`,
      [tripId]
    );

    return {
      activities: activitiesCount?.count || 0,
      pois: poisCount?.count || 0,
      totalExpenses: expensesTotal?.total || 0
    };
  }
}

export default Trip;
