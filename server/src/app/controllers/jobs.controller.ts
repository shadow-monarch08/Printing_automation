import { Request, Response } from "express";
import * as jobService from "../services/job.service";
import { verifyToken } from "../services/auth.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";
import db from "../../infrastructure/database";

export async function getJobs(req: Request, res: Response) {
  try {
    // 1. Check for Admin JWT Authorization Header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const isValid = await verifyToken(token);
      if (isValid) {
        // Authenticated Admin: return ALL global jobs (unfiltered)
        const jobs = await jobService.getAllJobs();
        return res.json({ success: true, jobs });
      }
    }

    // 2. Customer Kiosk Session Validation
    const sessionId = (req as any).session?.id || (req.headers["x-session-id"] as string) || (req.query.sessionId as string | undefined);
    if (!sessionId) {
      return res.status(401).json({ success: false, code: "SESSION_MISSING", message: "Unauthorized: Missing session ID or Admin token" });
    }

    // Validate Kiosk Session against Redis / SQLite
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
      return res.status(401).json({ success: false, code: "SESSION_INVALID", message: "Unauthorized: Invalid or expired session ID" });
    }

    const jobs = await jobService.getAllJobs(sessionId);
    return res.json({ success: true, jobs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to get jobs", error: String(err) });
  }
}

export async function cancelJob(req: Request, res: Response) {
  try {
    const jobId = req.params.jobId as string;
    await jobService.deleteJob(jobId);
    res.json({ success: true, message: `Job ${jobId} cancelled` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to cancel job", error: String(err) });
  }
}

export async function pauseJob(req: Request, res: Response) {
  try {
    const jobId = req.params.jobId as string;
    await jobService.pauseJob(jobId);
    res.json({ success: true, message: `Job ${jobId} paused` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to pause job", error: String(err) });
  }
}

export async function resumeJob(req: Request, res: Response) {
  try {
    const jobId = req.params.jobId as string;
    await jobService.resumeJob(jobId);
    res.json({ success: true, message: `Job ${jobId} resumed` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to resume job", error: String(err) });
  }
}

export async function changePriority(req: Request, res: Response) {
  try {
    const jobId = req.params.jobId as string;
    const { priority } = req.body;
    if (priority === undefined) return res.status(400).json({ success: false, message: "priority is required" });
    
    await jobService.changePriority(jobId, priority);
    res.json({ success: true, message: `Job ${jobId} priority changed to ${priority}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to change job priority", error: String(err) });
  }
}

export async function pauseGlobalQueue(req: Request, res: Response) {
  try {
    await jobService.pauseQueue();
    res.json({ success: true, message: "Global queue paused" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function resumeGlobalQueue(req: Request, res: Response) {
  try {
    await jobService.resumeQueue();
    res.json({ success: true, message: "Global queue resumed" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getQueueStatus(req: Request, res: Response) {
  try {
    const status = await jobService.getQueueStatus();
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function emergencyStop(req: Request, res: Response) {
  try {
    await jobService.emergencyStop();
    res.json({ success: true, message: "Emergency stop executed. All jobs wiped." });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
