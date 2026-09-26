import { Router } from "express";
import * as onboardingController from "../controllers/onboarding.controller";
import { requireNonSetupModeForSkip, requireLoopbackOnly } from "../middlewares/onboarding.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/status", asyncHandler(onboardingController.getSetupStatus));
router.get("/provision-status", asyncHandler(onboardingController.getProvisionStatus));
router.get("/provision-stream", requireLoopbackOnly, asyncHandler(onboardingController.streamProvisionStatus));
router.get("/kiosk-summary", requireLoopbackOnly, asyncHandler(onboardingController.getKioskSummary));
router.get("/network-status", asyncHandler(onboardingController.getNetworkStatus));
router.post("/provision", asyncHandler(requireNonSetupModeForSkip), asyncHandler(onboardingController.provisionSetup));
router.post("/skip", asyncHandler(requireNonSetupModeForSkip), asyncHandler(onboardingController.skipWifiSetup));

// On-demand Hotspot Management & Dual-Mode Coordination
router.post("/hotspot/start", asyncHandler(onboardingController.startHotspot));
router.post("/hotspot/stop", asyncHandler(onboardingController.stopHotspot));
router.get("/hotspot/status", asyncHandler(onboardingController.getHotspotStatus));
router.post("/mode", asyncHandler(onboardingController.setOnboardingMode));

export default router;
