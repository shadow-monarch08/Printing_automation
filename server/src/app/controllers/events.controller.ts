// server/src/app/controllers/events.controller.ts
import { Request, Response } from "express";
import os from "os";
import db from "../../infrastructure/database";
import { printMasterQueue } from "../../infrastructure/printMaster.queue";
import { listPrinters } from "../services/printer.service";
import { getDiskUsagePercent, getMetricsHistory as fetchMetricsHistory } from "../services/metrics.service";

// Re-export Realtime Gateway initialization for backward compatibility
export { initRealtimeGateway, initWebSocketServer } from "../services/realtimeGateway.service";

export async function getMetrics(_req: Request, res: Response) {
  const [waiting, active, delayed, completedCount, failed] = await Promise.all([
    printMasterQueue.getWaitingCount(),
    printMasterQueue.getActiveCount(),
    printMasterQueue.getDelayedCount(),
    printMasterQueue.getCompletedCount(),
    printMasterQueue.getFailedCount(),
  ]);

  const printers = await listPrinters();
  const activePrinters = printers.filter(p => p.status !== 'error').length;
  const totalPrinters = printers.length;

  const dbMetrics = db.prepare(`
    SELECT 
      COUNT(*) as totalJobsToday,
      COALESCE(SUM(cost), 0) as totalRevenueToday
    FROM print_jobs
    WHERE date(submitted_at) = date('now')
  `).get() as any;

  const totalJobsToday = dbMetrics?.totalJobsToday || 0;
  const revenue = dbMetrics?.totalRevenueToday || 0;

  const ut = process.uptime();
  const h = Math.floor(ut / 3600);
  const m = Math.floor((ut % 3600) / 60);
  const s = Math.floor(ut % 60);
  const uptimeStr = `${h}h ${m}m ${s}s`;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const diskPercent = await getDiskUsagePercent();

  res.json({
    success: true,
    metrics: { 
       waiting, 
       active, 
       delayed, 
       completed: completedCount, 
       failed,
       cpuLoad: os.loadavg()[0],
       memoryUsed: usedMem,
       memoryTotal: totalMem,
       diskPercent: diskPercent,
       uptime: uptimeStr,
       uptimeSeconds: ut,
       totalJobsToday,
       revenue,
       activePrinters,
       totalPrinters
    }
  });
}

export async function getMetricsHistory(_req: Request, res: Response) {
  const history = fetchMetricsHistory();
  res.json({ success: true, history });
}
