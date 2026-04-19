import express from 'express';
import { getTurfs, getTurf, createTurf, updateTurf, deleteTurf } from '../controllers/turfController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(getTurfs)
  .post(protect, authorize('admin'), createTurf);

router.route('/:id')
  .get(getTurf)
  .put(protect, authorize('admin'), updateTurf)
  .delete(protect, authorize('admin'), deleteTurf);

export default router;
