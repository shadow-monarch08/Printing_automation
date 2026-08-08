import { Router } from "express";
import * as jobsController from "../controllers/jobs.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/queue/status", asyncHandler(jobsController.getQueueStatus));
router.post("/queue/pause", asyncHandler(requireAuth), asyncHandler(jobsController.pauseGlobalQueue));
router.post("/queue/resume", asyncHandler(requireAuth), asyncHandler(jobsController.resumeGlobalQueue));
router.post("/queue/emergency-stop", asyncHandler(requireAuth), asyncHandler(jobsController.emergencyStop));

router.get("/", asyncHandler(jobsController.getJobs));
router.delete("/:jobId", asyncHandler(requireAuth), asyncHandler(jobsController.cancelJob));
router.post("/:jobId/pause", asyncHandler(requireAuth), asyncHandler(jobsController.pauseJob));
router.post("/:jobId/resume", asyncHandler(requireAuth), asyncHandler(jobsController.resumeJob));
router.post("/:jobId/priority", asyncHandler(requireAuth), asyncHandler(jobsController.changePriority));

export default router;
