import { Router } from "express";
import * as analyticsController from "../controllers/analytics.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/financial/summary", asyncHandler(requireAuth), asyncHandler(analyticsController.getFinancialSummary));
router.get("/financial/trend", asyncHandler(requireAuth), asyncHandler(analyticsController.getRevenueTrend));
router.get("/financial/color-split", asyncHandler(requireAuth), asyncHandler(analyticsController.getColorSplit));
router.get("/fleet", asyncHandler(requireAuth), asyncHandler(analyticsController.getFleetTelemetry));
router.get("/jobs", asyncHandler(requireAuth), asyncHandler(analyticsController.getJobArchive));
router.get("/jobs/export", asyncHandler(requireAuth), asyncHandler(analyticsController.exportJobsCSV));

export default router;
