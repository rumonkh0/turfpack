import express from 'express';
import { getTournaments, createTournament, updateTournament } from '../controllers/tournamentController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(getTournaments)
  .post(protect, authorize('admin'), createTournament);

router.route('/:id')
  .put(protect, authorize('admin'), updateTournament);

export default router;
