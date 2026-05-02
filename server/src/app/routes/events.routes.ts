import { Router } from "express";
import * as eventsController from "../controllers/events.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// Endpoint for SSE stream (maybe require auth later depending on requirements, 
// but often SSE is left open or authenticated via token in query string since EventSource doesn't support headers well)
router.get("/events", eventsController.sseEndpoint);

// Endpoint for aggregated metrics
router.get("/metrics", eventsController.getMetrics);

export default router;
