import express from 'express';
import { getBookings, getBooking, createBooking, updateBooking, deleteBooking } from '../controllers/bookingController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getBookings)
  .post(protect, createBooking);

router.route('/:id')
  .get(protect, getBooking)
  .put(protect, updateBooking)
  .delete(protect, authorize('admin'), deleteBooking);

export default router;
