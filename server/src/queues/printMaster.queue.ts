import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

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
}

export const printMasterQueue = new Queue<PrintJobData>("print-master", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
