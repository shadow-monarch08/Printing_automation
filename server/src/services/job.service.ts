import { printMasterQueue } from "../queues/printMaster.queue";
import { execCommand } from "../utils/exec";

export async function getAllJobs() {
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
      pages: job.data.pages,
      copies: job.data.copies,
      colorMode: job.data.colorMode,
      duplex: job.data.duplex,
      orientation: job.data.orientation,
      targetPrinter: job.data.targetPrinter || 'Auto',
      status: status,
      cost: job.data.cost,
      submittedAt: job.data.submittedAt,
      completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      error: job.failedReason || null
    };
  };

  return [
    ...active.map(j => mapJob(j, "printing")),
    ...waiting.map(j => mapJob(j, "queued")),
    ...delayed.map(j => mapJob(j, "spooling")),
    ...completed.map(j => mapJob(j, "done")),
    ...failed.map(j => mapJob(j, "failed")),
  ];
}

export async function deleteJob(jobId: string) {
  const job = await printMasterQueue.getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const isActive = await job.isActive();
  
  if (isActive && job.returnvalue?.cupsJobId) {
    // If it's already sent to CUPS, try to cancel it
    try {
      await execCommand(`cancel ${job.returnvalue.cupsJobId}`);
    } catch (e) {
      console.error(`Failed to cancel CUPS job ${job.returnvalue.cupsJobId}`, e);
    }
  }

  await job.remove();
  return true;
}
