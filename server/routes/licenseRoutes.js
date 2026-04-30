import express from "express";
import {
  getLicenseStatus,
  activateLicense,
} from "../controllers/licenseController.js";

const router = express.Router();

router.get("/status", getLicenseStatus);
router.post("/activate", activateLicense);

export default router;
