import { Worker, Job, DelayedError } from "bullmq";
import { redisConnection } from "./redis";
import { REDIS_KEYS } from "./redisKeys";
import { PrintJobData, printMasterQueue } from "./printMaster.queue";
import * as printerService from "../app/services/printer.service";
import * as matchmakerService from "../app/services/matchmaker.service";
import { eventBus } from "../app/utils/eventBus";

export const printMasterWorker = new Worker<PrintJobData>(
  "print-master",
  async (job: Job<PrintJobData>) => {
    console.log(`[Worker] Processing job ${job.id} for file ${job.data.filename}`);

    // Matchmaking logic
    const matchedPrinter = await matchmakerService.findPrinter(job.data);

    if (!matchedPrinter) {
      console.log(`[Worker] No idle/capable printer found for job ${job.id}. Delaying 15s...`);
      await job.moveToDelayed(Date.now() + 15000, job.token!);
      throw new DelayedError();
    }
    
    try {
      // Step 2.2: Add Optimistic Lock in Worker (Pre-Dispatch)
      await redisConnection.set(REDIS_KEYS.printerState(matchedPrinter), "busy");
      eventBus.emit("printer_state_changed", { printer: matchedPrinter, state: "busy" });

      const cupsJobId = await printerService.printFile(
        job.data.filePath, 
        matchedPrinter,
        job.data.copies,
        job.data.duplex
      );
      console.log(`[Worker] Successfully dispatched job ${job.id} -> CUPS ID: ${cupsJobId} on ${matchedPrinter}`);
      
      await job.updateData({ ...job.data, cupsJobId, executedByPrinter: matchedPrinter });

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

          // Step 3.1: Increment Strike Counter on Failure
          const strikeKey = REDIS_KEYS.printerStrikes(matchedPrinter);
          const newStrikes = await redisConnection.incr(strikeKey);
          console.log(`[Worker] Printer ${matchedPrinter} strike count: ${newStrikes}`);

          // Step 3.3: Quarantine at 3 Strikes
          if (newStrikes >= 3) {
            await redisConnection.set(REDIS_KEYS.printerHealth(matchedPrinter), "flagged");
            eventBus.emit("printer_quarantined", {
              printer: matchedPrinter,
              message: `Printer ${matchedPrinter} quarantined after ${newStrikes} consecutive failures.`
            });
            console.warn(`[Worker] QUARANTINE: ${matchedPrinter} flagged after ${newStrikes} strikes.`);

            // Step 3.5: Absolute Circuit Breaker (Global Queue Pause)
            const allPrinterNames = await redisConnection.smembers(REDIS_KEYS.FLEET_PRINTERS);
            let hasHealthyPrinter = false;
            for (const name of allPrinterNames) {
              const health = await redisConnection.get(REDIS_KEYS.printerHealth(name));
              if (health === "healthy") {
                hasHealthyPrinter = true;
                break;
              }
            }

            if (!hasHealthyPrinter) {
              await printMasterQueue.pause();
              eventBus.emit("queue_paused", {
                message: "EMERGENCY: All printers quarantined. Queue paused. Admin intervention required."
              });
            }
          }

          const attempts = job.data.attemptedPrinters || [];
          attempts.push(matchedPrinter);

          await job.updateData({ ...job.data, attemptedPrinters: attempts, executedByPrinter: matchedPrinter });

          // Step 3.4: Bad Document Isolation
          if (attempts.length >= 2) {
            eventBus.emit("job_failed", {
              id: job.id,
              reason: `Bad document detected: Job failed on ${attempts.length} different printers. Discarding.`,
              isBadDocument: true
            });
            throw new Error(`Job ${job.id} flagged as bad document — failed on ${attempts.join(", ")}.`);
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
  
  // Step 2.3 & 3.2: Release lock and reset strikes
  const printer = job.returnvalue?.printer;
  if (printer) {
    await redisConnection.set(REDIS_KEYS.printerState(printer), "idle");
    await redisConnection.set(REDIS_KEYS.printerStrikes(printer), "0");
    eventBus.emit("printer_state_changed", { printer, state: "idle" });
  }

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
  
  // Step 2.3: Release lock for the printer that was being used
  const printer = job?.data?.attemptedPrinters?.[job.data.attemptedPrinters.length - 1] || job?.data?.targetPrinter;
  if (printer) {
    await redisConnection.set(REDIS_KEYS.printerState(printer), "idle");
    eventBus.emit("printer_state_changed", { printer, state: "idle" });
  }

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