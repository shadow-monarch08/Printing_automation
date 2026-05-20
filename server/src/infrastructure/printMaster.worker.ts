import { Worker, Job } from "bullmq";
import { redisConnection } from "./redis";
import { PrintJobData, printMasterQueue } from "./printMaster.queue";
import * as printerService from "../app/services/printer.service";
import * as matchmakerService from "../app/services/matchmaker.service";

export const printMasterWorker = new Worker<PrintJobData>(
  "print-master",
  async (job: Job<PrintJobData>) => {
    console.log(`[Worker] Processing job ${job.id} for file ${job.data.filename}`);

    // Matchmaking logic
    const matchedPrinter = await matchmakerService.findPrinter(job.data);

    if (!matchedPrinter) {
      console.log(`[Worker] No idle/capable printer found for job ${job.id}. Delaying 15s...`);
      await job.moveToDelayed(Date.now() + 15000, job.token!);
      return;
    }
    
    try {
      const cupsJobId = await printerService.printFile(
        job.data.filePath, 
        matchedPrinter,
        job.data.copies,
        job.data.duplex
      );
      console.log(`[Worker] Successfully dispatched job ${job.id} -> CUPS ID: ${cupsJobId} on ${matchedPrinter}`);
      
      await job.updateData({ ...job.data, cupsJobId });

      let staleCounter = 0;
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        staleCounter += 3;

        const status = await printerService.getJobStatus(matchedPrinter, cupsJobId);
        
        if (status === "completed_or_missing") {
          return { cupsJobId, status: "completed", printer: matchedPrinter };
        }

        if (status === "held" || status === "stopped" || staleCounter >= 30) {
          console.warn(`[Worker] Job ${job.id} failed on ${matchedPrinter} (status: ${status}, time: ${staleCounter}s). Triggering failover.`);
          
          try {
            await printerService.cancelJob(cupsJobId);
          } catch (e) {
            console.error(`[Worker] Failed to cancel jammed CUPS job ${cupsJobId}`, e);
          }

          const attempts = job.data.attemptedPrinters || [];
          attempts.push(matchedPrinter);

          await job.updateData({ ...job.data, attemptedPrinters: attempts });

          if (attempts.length >= 2) {
            throw new Error(`Job ${job.id} failed after 2 failover attempts.`);
          }

          // Change priority to 1 and throw to trigger BullMQ retry
          await job.changePriority({ priority: 1 });
          throw new Error(`Failover triggered due to printer jam/stall on ${matchedPrinter}`);
        }
      }
    } catch (error: any) {
      if (error.message.includes("Failover triggered") || error.message.includes("after 2 failover attempts")) {
        throw error;
      }
      console.error(`[Worker] Failed to print job ${job.id} on ${matchedPrinter}`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Drip-feed constraint
  }
);

import { eventBus } from "../app/utils/eventBus";

// --- WAKE UP FUNCTION ---
const wakeUpDelayedJobs = async () => {
  try {
    // Grab all jobs sitting in the 15-second penalty box
    const delayedJobs = await printMasterQueue.getDelayed();
    
    for (const delayedJob of delayedJobs) {
      console.log(`[Queue] Printer freed! Promoting delayed job ${delayedJob.id} back to active.`);
      // This instantly moves the job from 'delayed' back to 'waiting'
      await delayedJob.promote(); 
    }
  } catch (error) {
    console.error("[Queue] Failed to promote delayed jobs", error);
  }
};

// --- EVENT LISTENERS ---

printMasterWorker.on("active", (job) => {
  eventBus.emit("job_active", { id: job.id, data: job.data });
});

printMasterWorker.on("completed", async (job) => {
  console.log(`[Worker] Job ${job.id} has completed! Printer is now free.`);
  eventBus.emit("job_completed", { id: job.id, data: job.data });
  
  // Clean up the printed file
  const fs = require('fs');
  if (job.data.filePath && fs.existsSync(job.data.filePath)) {
    try { fs.unlinkSync(job.data.filePath); } catch(e) { console.error('Cleanup error:', e); }
  }

  // A printer just became idle. Instantly wake up waiting jobs!
  await wakeUpDelayedJobs(); 
});

printMasterWorker.on("failed", async (job, err) => {
  console.log(`[Worker] Job ${job?.id} has failed with ${err.message}`);
  eventBus.emit("job_failed", { id: job?.id, reason: err.message });
  
  // Clean up the printed file
  if (job) {
    const fs = require('fs');
    if (job.data.filePath && fs.existsSync(job.data.filePath)) {
      try { fs.unlinkSync(job.data.filePath); } catch(e) { console.error('Cleanup error:', e); }
    }
  }

  // Even if a job fails (e.g., gets cancelled), that printer is now free. Wake up the queue!
  if (job) await wakeUpDelayedJobs();
});

printMasterWorker.on("ready", () => {
  console.log(`🚀 Print Master worker ready`);
});