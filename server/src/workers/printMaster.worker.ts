import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { PrintJobData } from "../queues/printMaster.queue";
import * as printerService from "../services/printer.service";

export const printMasterWorker = new Worker<PrintJobData>(
  "print-master",
  async (job: Job<PrintJobData>) => {
    console.log(`[Worker] Processing job ${job.id} for file ${job.data.filename}`);

    // In Phase 1, we just call printerService directly.
    // Matchmaking logic will be added in Phase 2.
    const targetPrinter = job.data.targetPrinter || undefined;
    
    try {
      const cupsJobId = await printerService.printFile(job.data.filePath, targetPrinter);
      console.log(`[Worker] Successfully dispatched job ${job.id} -> CUPS ID: ${cupsJobId}`);
      
      // We can return data to be stored in the completed job
      return { cupsJobId, status: "completed" };
    } catch (error: any) {
      console.error(`[Worker] Failed to print job ${job.id}`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Drip-feed constraint
  }
);

printMasterWorker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} has completed!`);
});

printMasterWorker.on("failed", (job, err) => {
  console.log(`[Worker] Job ${job?.id} has failed with ${err.message}`);
});
