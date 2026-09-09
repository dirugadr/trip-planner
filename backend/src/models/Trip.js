import { v4 as uuidv4 } from 'uuid';
import { getDatabase, insertOne, updateOne, deleteOne, findById, findAll } from '../db/database.js';

const TABLE = 'trips';

export class Trip {
  static create(data) {
    const trip = {
      id: uuidv4(),
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

    insertOne(TABLE, trip);
    return trip;
  }

  static findById(id) {
    return findById(TABLE, id);
  }

  static findAll() {
    return findAll(TABLE);
  }

  static update(id, data) {
    const updates = {
      ...data,
      updated_at: new Date().toISOString(),
      version: (data.version || 0) + 1
    };

    const success = updateOne(TABLE, id, updates);
    if (success) {
      return Trip.findById(id);
    }
    return null;
  }

  static delete(id, soft = true) {
    return deleteOne(TABLE, id, soft);
  }

  static getStats(tripId) {
    const db = getDatabase();
    
    // Count activities
    const activitiesCount = db.prepare(
      `SELECT COUNT(*) as count FROM activities 
       WHERE day_id IN (SELECT id FROM days WHERE trip_id = ?) 
       AND deleted_at IS NULL`
    ).get(tripId);

    // Count POIs
    const poisCount = db.prepare(
      `SELECT COUNT(*) as count FROM pois_saved 
       WHERE trip_id = ? AND deleted_at IS NULL`
    ).get(tripId);

    // Sum expenses
    const expensesTotal = db.prepare(
      `SELECT SUM(amount) as total FROM expenses 
       WHERE trip_id = ? AND deleted_at IS NULL`
    ).get(tripId);

    return {
      activities: activitiesCount?.count || 0,
      pois: poisCount?.count || 0,
      totalExpenses: expensesTotal?.total || 0
    };
  }
}

export default Trip;
