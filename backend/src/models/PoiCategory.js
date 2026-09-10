import { dbAll, dbGet } from '../db/database.js';

const TABLE = 'poi_categories';

export class PoiCategory {
  static findAll() {
    return dbAll(`SELECT id, name, icon, color FROM ${TABLE} ORDER BY created_at ASC`);
  }

  static findById(id) {
    return dbGet(`SELECT id, name, icon, color FROM ${TABLE} WHERE id = ?`, [id]);
  }
}

export default PoiCategory;
