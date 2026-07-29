import express from "express";
import { getIncomes, getIncome, createIncome, deleteIncome } from "../controllers/incomeController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.use(authorize("admin"));

router.route("/")
  .get(getIncomes)
  .post(createIncome);

router.route("/:id")
  .get(getIncome)
  .delete(deleteIncome);

export default router;
