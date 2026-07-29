import express from "express";
import {
  getPartners, getPartner, createPartner, updatePartner,
  reallocate, sharesHistory, getPayouts, createPayout,
} from "../controllers/partnerController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.use(authorize("admin"));

router.route("/")
  .get(getPartners)
  .post(createPartner);

router.post("/reallocate", reallocate);
router.get("/shares/history", sharesHistory);

router.route("/payouts")
  .get(getPayouts)
  .post(createPayout);

router.route("/:id")
  .get(getPartner)
  .put(updatePartner);

export default router;
