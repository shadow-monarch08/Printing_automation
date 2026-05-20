import { Router } from "express";
import * as jobsController from "../controllers/jobs.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// We might want to protect these with requireAuth if needed, but for now
// we'll follow the general pattern where admin UI has access
router.get("/queue/status", jobsController.getQueueStatus);
router.post("/queue/pause", requireAuth, jobsController.pauseGlobalQueue);
router.post("/queue/resume", requireAuth, jobsController.resumeGlobalQueue);
router.post("/queue/emergency-stop", requireAuth, jobsController.emergencyStop);

router.get("/", jobsController.getJobs);
router.delete("/:jobId", requireAuth, jobsController.cancelJob);
router.post("/:jobId/pause", requireAuth, jobsController.pauseJob);
router.post("/:jobId/resume", requireAuth, jobsController.resumeJob);
router.post("/:jobId/priority", requireAuth, jobsController.changePriority);

export default router;
