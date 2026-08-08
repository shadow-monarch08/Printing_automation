import { printMasterQueue } from "../../infrastructure/printMaster.queue";
import { cupsCommands } from "../../commands/cups.commands";
import { NotFoundError, ConflictError } from "../utils/errors";

export async function getAllJobs(sessionId?: string) {
  const [waiting, active, delayed, completed, failed] = await Promise.all([
    printMasterQueue.getWaiting(),
    printMasterQueue.getActive(),
    printMasterQueue.getDelayed(),
    printMasterQueue.getCompleted(),
    printMasterQueue.getFailed(),
  ]);

  const mapJob = (job: any, status: string) => {
    return {
      id: job.id,
      cupsJobId: job.returnvalue?.cupsJobId || null,
      filename: job.data.filename,
      owner: job.data.owner,
      sessionId: job.data.sessionId,
      pages: job.data.pages,
      copies: job.data.copies,
      colorMode: job.data.colorMode,
      duplex: job.data.duplex,
      orientation: job.data.orientation,
      targetPrinter: job.data.targetPrinter || "Auto",
      status: status,
      cost: job.data.cost,
      submittedAt: job.data.submittedAt,
      completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      error: job.failedReason || null,
    };
  };

  let allJobs = [
    ...active.map((j) => mapJob(j, "printing")),
    ...waiting.map((j) => mapJob(j, "queued")),
    ...delayed.map((j) => mapJob(j, "spooling")),
    ...completed.map((j) => mapJob(j, "done")),
    ...failed.map((j) => mapJob(j, "failed")),
  ];

  if (sessionId) {
    allJobs = allJobs.filter((j) => j.sessionId === sessionId);
  }

  return allJobs;
}

export async function deleteJob(jobId: string) {
  const job = await printMasterQueue.getJob(jobId);
  if (!job) {
    throw new NotFoundError("JOB_NOT_FOUND", `Print job ${jobId} not found in queue.`);
  }

  const isActive = await job.isActive();

  if (isActive && job.returnvalue?.cupsJobId) {
    try {
      await cupsCommands.cancelJob(job.returnvalue.cupsJobId);
    } catch (e) {
      console.error(`Failed to cancel CUPS job ${job.returnvalue.cupsJobId}`, e);
    }
  }

  await job.remove();
  return true;
}

export async function pauseJob(jobId: string) {
  const job = await printMasterQueue.getJob(jobId);
  if (!job) throw new NotFoundError("JOB_NOT_FOUND", `Print job ${jobId} not found in queue.`);

  const cupsJobId = job.data.cupsJobId;
  if (cupsJobId) {
    await cupsCommands.holdJob(cupsJobId);
  } else {
    throw new ConflictError("JOB_NO_CUPS_ID", `Job ${jobId} has no active CUPS process to pause.`);
  }
}

export async function resumeJob(jobId: string) {
  const job = await printMasterQueue.getJob(jobId);
  if (!job) throw new NotFoundError("JOB_NOT_FOUND", `Print job ${jobId} not found in queue.`);

  const cupsJobId = job.data.cupsJobId;
  if (cupsJobId) {
    await cupsCommands.resumeJob(cupsJobId);
  } else {
    throw new ConflictError("JOB_NO_CUPS_ID", `Job ${jobId} has no active CUPS process to resume.`);
  }
}

export async function changePriority(jobId: string, priority: number) {
  const job = await printMasterQueue.getJob(jobId);
  if (!job) throw new NotFoundError("JOB_NOT_FOUND", `Print job ${jobId} not found in queue.`);

  await job.changePriority({ priority });
}

export async function pauseQueue() {
  await printMasterQueue.pause();
}

export async function resumeQueue() {
  await printMasterQueue.resume();
}

export async function getQueueStatus() {
  const isPaused = await printMasterQueue.isPaused();
  return { isPaused };
}

export async function emergencyStop() {
  await printMasterQueue.obliterate({ force: true });
  try {
    await cupsCommands.cancelAllJobs();
  } catch (err) {
    console.error("Failed to cancel CUPS jobs during emergency stop:", err);
  }
}
