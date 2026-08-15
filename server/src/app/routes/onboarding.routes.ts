import { Router } from "express";
import * as onboardingController from "../controllers/onboarding.controller";
import { requireNonSetupModeForSkip } from "../middlewares/onboarding.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/status", asyncHandler(onboardingController.getSetupStatus));
router.get("/provision-status", asyncHandler(onboardingController.getProvisionStatus));
router.get("/network-status", asyncHandler(onboardingController.getNetworkStatus));
router.post("/provision", asyncHandler(requireNonSetupModeForSkip), asyncHandler(onboardingController.provisionSetup));
router.post("/skip", asyncHandler(requireNonSetupModeForSkip), asyncHandler(onboardingController.skipWifiSetup));
router.post("/handoff", asyncHandler(onboardingController.consumeHandoff));

export default router;
