import { Router } from "express";
import * as onboardingController from "../controllers/onboarding.controller";
import { requireNonSetupModeForSkip } from "../middlewares/onboarding.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/status", asyncHandler(onboardingController.getSetupStatus));
router.get("/provision-status", asyncHandler(onboardingController.getProvisionStatus));
router.post("/provision", asyncHandler(requireNonSetupModeForSkip), asyncHandler(onboardingController.provisionSetup));
router.post("/skip", asyncHandler(requireNonSetupModeForSkip), asyncHandler(onboardingController.skipWifiSetup));

export default router;
