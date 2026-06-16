import { QueueEvents } from "bullmq";
import { redisConnection } from "./redis";
import { printMasterQueue } from "./printMaster.queue";
import { markCompleted, markFailed } from "../app/services/printJob.db.service";

const printMasterEvents = new QueueEvents("print-master", {
  connection: redisConnection,
});

printMasterEvents.on("completed", async ({ jobId, returnvalue }) => {
  try {
    const job = await printMasterQueue.getJob(jobId);
    if (!job) return;

    let parsedReturn: any = returnvalue;
    if (typeof returnvalue === 'string') {
      try { parsedReturn = JSON.parse(returnvalue); } catch (e) {}
    }

    const printer = job.data.executedByPrinter || parsedReturn?.printer || null;
    const completedAt = job.finishedOn
      ? new Date(job.finishedOn).toISOString()
      : new Date().toISOString();

    markCompleted(jobId, printer, completedAt);
    console.log(`[ColdTier] Job ${jobId} → completed on ${printer}`);
  } catch (err) {
    console.error(`[ColdTier] Failed to sync completed job ${jobId}`, err);
  }
});

printMasterEvents.on("failed", async ({ jobId, failedReason }) => {
  try {
    const job = await printMasterQueue.getJob(jobId);
    if (!job) return;

    const printer = job.data.executedByPrinter
      || job.data.attemptedPrinters?.[job.data.attemptedPrinters.length - 1]
      || null;
    const completedAt = job.finishedOn
      ? new Date(job.finishedOn).toISOString()
      : new Date().toISOString();

    markFailed(jobId, printer, failedReason || "Unknown error", completedAt);
    console.log(`[ColdTier] Job ${jobId} → failed on ${printer}`);
  } catch (err) {
    console.error(`[ColdTier] Failed to sync failed job ${jobId}`, err);
  }
});
