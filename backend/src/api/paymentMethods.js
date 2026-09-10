import express from 'express';
import { serverError } from '../lib/http.js';
import PaymentMethod from '../models/PaymentMethod.js';

const router = express.Router();

// GET /api/payment-methods - List the available payment methods
router.get('/', async (req, res) => {
  try {
    const methods = await PaymentMethod.findAll();
    res.json({ success: true, data: methods });
  } catch (error) {
    serverError(res, error);
  }
});

export default router;
