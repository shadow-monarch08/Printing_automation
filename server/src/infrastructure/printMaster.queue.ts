import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export interface PrintJobData {
  id: string;              // UUID
  filename: string;        // Original filename
  filePath: string;        // Absolute path to uploaded file
  owner: string;           // "Guest" for kiosk
  pages: number;
  copies: number;
  colorMode: 'color' | 'grayscale';
  duplex: 'single' | 'double';
  orientation: 'portrait' | 'landscape';
  targetPrinter?: string;
  cost: number;
  attemptedPrinters: string[];  // Failover blacklist
  submittedAt: string;
  cupsJobId?: string; // Phase 3: track CUPS job ID
}

export const printMasterQueue = new Queue<PrintJobData>("print-master", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // 1 initial try + 2 failover retries
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export async function removePrinterFromAttemptedJobs(printerName: string): Promise<void> {
  try {
    const jobs = await printMasterQueue.getJobs(["waiting", "active", "delayed", "paused"]);
    for (const job of jobs) {
      if (job.data && job.data.attemptedPrinters && job.data.attemptedPrinters.includes(printerName)) {
        const attemptedPrinters = job.data.attemptedPrinters.filter((name: string) => name !== printerName);
        await job.updateData({
          ...job.data,
          attemptedPrinters,
        });
        console.log(`[Queue] Removed ${printerName} from attemptedPrinters for job ${job.id}`);
      }
    }
  } catch (err) {
    console.error(`[Queue] Failed to remove ${printerName} from attempted jobs:`, err);
  }
}