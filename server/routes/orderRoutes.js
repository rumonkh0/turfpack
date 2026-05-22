import express from 'express';
import { getOrders, createOrder, updateOrder } from '../controllers/orderController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin'), getOrders)
  .post(protect, createOrder);

router.route('/:id')
  .put(protect, authorize('admin'), updateOrder);

export default router;
