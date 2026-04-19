import express from 'express';
import { getOrders, createOrder } from '../controllers/orderController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin'), getOrders)
  .post(protect, createOrder);

export default router;
