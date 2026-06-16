import { Router } from "express";
import * as configController from "../controllers/config.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/pricing", configController.getPricingConfig);
router.put("/pricing", requireAuth, configController.updatePricingConfig);
router.post("/pricing/reset", requireAuth, configController.resetPricingConfig);

router.get("/system", configController.getSystemConfig);
router.put("/system", requireAuth, configController.updateSystemConfig);

export default router;
