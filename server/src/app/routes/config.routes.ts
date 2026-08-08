import { Router } from "express";
import * as configController from "../controllers/config.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/pricing", asyncHandler(configController.getPricingConfig));
router.put("/pricing", asyncHandler(requireAuth), asyncHandler(configController.updatePricingConfig));
router.post("/pricing/reset", asyncHandler(requireAuth), asyncHandler(configController.resetPricingConfig));

router.get("/system", asyncHandler(configController.getSystemConfig));
router.put("/system", asyncHandler(requireAuth), asyncHandler(configController.updateSystemConfig));

export default router;
