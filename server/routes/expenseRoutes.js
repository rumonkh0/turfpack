import express from "express";
import { getExpenses, getExpense, createExpense, deleteExpense } from "../controllers/expenseController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.use(authorize("admin"));

router.route("/")
  .get(getExpenses)
  .post(createExpense);

router.route("/:id")
  .get(getExpense)
  .delete(deleteExpense);

export default router;
