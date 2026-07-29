import express from "express";
import { getAccounts, createAccount, updateAccount } from "../controllers/accountController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.use(authorize("admin"));

router.route("/")
  .get(getAccounts)
  .post(createAccount);

router.route("/:id")
  .put(updateAccount);

export default router;
