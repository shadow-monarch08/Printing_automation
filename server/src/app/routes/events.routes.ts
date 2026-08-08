import { Router } from "express";
import * as eventsController from "../controllers/events.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/metrics", asyncHandler(eventsController.getMetrics));
router.get("/metrics/history", asyncHandler(eventsController.getMetricsHistory));

export default router;
