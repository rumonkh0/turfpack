import express from 'express';
import { getPayments, createPayment } from '../controllers/paymentController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin'), getPayments)
  .post(protect, createPayment);

export default router;
