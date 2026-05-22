import express from "express";
import {
  register,
  login,
  getMe,
  desktopAutoLogin,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/desktop-auto-login", desktopAutoLogin);
router.get("/me", protect, getMe);

export default router;
