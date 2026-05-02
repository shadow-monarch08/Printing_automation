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
    attempts: 4, // 1 initial try + 3 failover retries
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
