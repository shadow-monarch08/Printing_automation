import { Router } from "express";
import * as onboardingController from "../controllers/onboarding.controller";
import { requireNonSetupModeForSkip } from "../middlewares/onboarding.middleware";

const router = Router();

router.get("/status", onboardingController.getSetupStatus);
router.get("/provision-status", onboardingController.getProvisionStatus);
router.post("/provision", requireNonSetupModeForSkip, onboardingController.provisionSetup);
router.post("/skip", requireNonSetupModeForSkip, onboardingController.skipWifiSetup);

export default router;
