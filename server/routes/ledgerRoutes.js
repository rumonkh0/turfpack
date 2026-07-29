import express from "express";
import { getJournalEntries, getJournalEntry } from "../controllers/ledgerController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.use(authorize("admin"));

router.route("/")
  .get(getJournalEntries);

router.route("/:id")
  .get(getJournalEntry);

export default router;
