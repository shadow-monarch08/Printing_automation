import { Router } from "express";
import * as eventsController from "../controllers/events.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// Endpoint for aggregated metrics
router.get("/metrics", eventsController.getMetrics);
router.get("/metrics/history", eventsController.getMetricsHistory);

export default router;
