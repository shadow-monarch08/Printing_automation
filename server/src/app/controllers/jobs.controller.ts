import { Request, Response } from "express";
import * as jobService from "../services/job.service";

export async function getJobs(req: Request, res: Response) {
  try {
    const jobs = await jobService.getAllJobs();
    res.json({ success: true, jobs });
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
