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
