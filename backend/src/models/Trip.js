import { randomUUID } from 'crypto';
import { insertOne, updateOne, deleteOne, findById, findAll, dbGet } from '../db/database.js';

const TABLE = 'trips';

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

  static findAll() {
    return findAll(TABLE);
  }

  static async update(id, data) {
    const updates = {
      ...data,
      updated_at: new Date().toISOString(),
      version: (data.version || 0) + 1
    };

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
