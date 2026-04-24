import { Router } from "express";
import * as jobsController from "../controllers/jobs.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// We might want to protect these with requireAuth if needed, but for now
// we'll follow the general pattern where admin UI has access
router.get("/", jobsController.getJobs);
router.delete("/:jobId", requireAuth, jobsController.cancelJob);

export default router;
