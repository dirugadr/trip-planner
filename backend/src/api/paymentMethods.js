import express from 'express';
import PaymentMethod from '../models/PaymentMethod.js';

const router = express.Router();

// GET /api/payment-methods - List the available payment methods
router.get('/', async (req, res) => {
  try {
    const methods = await PaymentMethod.findAll();
    res.json({ success: true, data: methods });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
