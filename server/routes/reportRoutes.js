import express from "express";
import {
  profitLoss, cashPosition, receivables,
  partnerShares, revenueBreakdown, expenseBreakdown, dashboard,
} from "../controllers/reportController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.use(authorize("admin", "partner"));

router.get("/profit-loss", profitLoss);
router.get("/cash-position", authorize("admin"), cashPosition);
router.get("/receivables", authorize("admin"), receivables);
router.get("/partner-shares", partnerShares);
router.get("/revenue-breakdown", revenueBreakdown);
router.get("/expense-breakdown", expenseBreakdown);
router.get("/dashboard", dashboard);

export default router;
