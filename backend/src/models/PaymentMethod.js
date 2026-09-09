import { dbAll } from '../db/database.js';

const TABLE = 'payment_methods';

export class PaymentMethod {
  static findAll() {
    return dbAll(`SELECT * FROM ${TABLE} ORDER BY rowid ASC`);
  }
}

export default PaymentMethod;
