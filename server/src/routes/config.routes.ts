import { Router } from "express";
import * as configController from "../controllers/config.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/pricing", configController.getPricingConfig);
router.put("/pricing", requireAuth, configController.updatePricingConfig);
router.post("/pricing/reset", requireAuth, configController.resetPricingConfig);

export default router;
