import { Request, Response } from "express";
import * as jobService from "../services/job.service";
import { verifyToken } from "../services/auth.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";
import db from "../../infrastructure/database";
import { UnauthorizedError, ValidationError } from "../utils/errors";

export async function getJobs(req: Request, res: Response) {
  // 1. Check for Admin JWT Authorization Header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const isValid = await verifyToken(token);
    if (isValid) {
      const jobs = await jobService.getAllJobs();
      return res.json({ success: true, jobs });
    }
  }

  // 2. Customer Kiosk Session Validation
  const sessionId =
    (req as any).session?.id ||
    (req.headers["x-session-id"] as string) ||
    (req.query.sessionId as string | undefined);
  if (!sessionId) {
    throw new UnauthorizedError("SESSION_MISSING", "Unauthorized: Missing session ID or Admin token.");
  }

  const key = REDIS_KEYS.session(sessionId);
  const cachedSession = await redisConnection.get(key);
  let isSessionValid = !!cachedSession;

  if (!isSessionValid) {
    const session = db.prepare("SELECT session_id FROM kiosk_sessions WHERE session_id = ?").get(sessionId);
    if (session) {
      isSessionValid = true;
      await redisConnection.setex(key, REDIS_TTLS.SESSION, JSON.stringify({ active: true }));
    }
  }

  if (!isSessionValid) {
    throw new UnauthorizedError("SESSION_INVALID", "Unauthorized: Invalid or expired session ID.");
  }

  const jobs = await jobService.getAllJobs(sessionId);
  return res.json({ success: true, jobs });
}

export async function cancelJob(req: Request, res: Response) {
  const jobId = req.params.jobId as string;
  await jobService.deleteJob(jobId);
  res.json({ success: true, message: `Job ${jobId} cancelled` });
}

export async function pauseJob(req: Request, res: Response) {
  const jobId = req.params.jobId as string;
  await jobService.pauseJob(jobId);
  res.json({ success: true, message: `Job ${jobId} paused` });
}

export async function resumeJob(req: Request, res: Response) {
  const jobId = req.params.jobId as string;
  await jobService.resumeJob(jobId);
  res.json({ success: true, message: `Job ${jobId} resumed` });
}

export async function changePriority(req: Request, res: Response) {
  const jobId = req.params.jobId as string;
  const { priority } = req.body;
  if (priority === undefined) {
    throw new ValidationError("VALIDATION_PRIORITY_REQUIRED", "priority is required.");
  }

  await jobService.changePriority(jobId, priority);
  res.json({ success: true, message: `Job ${jobId} priority changed to ${priority}` });
}

export async function pauseGlobalQueue(_req: Request, res: Response) {
  await jobService.pauseQueue();
  res.json({ success: true, message: "Global queue paused" });
}

export async function resumeGlobalQueue(_req: Request, res: Response) {
  await jobService.resumeQueue();
  res.json({ success: true, message: "Global queue resumed" });
}

export async function getQueueStatus(_req: Request, res: Response) {
  const status = await jobService.getQueueStatus();
  res.json({ success: true, ...status });
}

export async function emergencyStop(_req: Request, res: Response) {
  await jobService.emergencyStop();
  res.json({ success: true, message: "Emergency stop executed. All jobs wiped." });
}
