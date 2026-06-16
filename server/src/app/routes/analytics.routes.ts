import { Router } from "express";
import * as analyticsController from "../controllers/analytics.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/financial/summary", requireAuth, analyticsController.getFinancialSummary);
router.get("/financial/trend", requireAuth, analyticsController.getRevenueTrend);
router.get("/financial/color-split", requireAuth, analyticsController.getColorSplit);
router.get("/fleet", requireAuth, analyticsController.getFleetTelemetry);
router.get("/jobs", requireAuth, analyticsController.getJobArchive);
router.get("/jobs/export", requireAuth, analyticsController.exportJobsCSV);

export default router;
