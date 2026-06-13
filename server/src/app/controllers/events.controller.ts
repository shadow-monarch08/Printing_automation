import { Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { eventBus } from "../utils/eventBus";
import { printMasterQueue } from "../../infrastructure/printMaster.queue";
import { listPrinters } from "../services/printer.service";
import os from "os";
import { getDiskUsagePercent } from "../services/metrics.service";

export function initWebSocketServer(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: any, socket: any, head: any) => {
    if (request.url === "/events") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    // Send initial connected event
    ws.send(JSON.stringify({ event: "connected", data: { timestamp: new Date().toISOString() } }));

    // Event listener function
    const onEvent = (eventName: string, data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: eventName, data }));
      }
    };

    // Bind to all known events.
    const eventsToListen = [
      "job_queued", "job_active", "job_completed", "job_failed",
      "printer_discovery", "system_critical",
      "printer_state_changed", "printer_quarantined",
      "queue_paused", "queue_resumed"
    ];
    
    // Create bound listeners so we can remove them later
    const listeners: Record<string, (data: any) => void> = {};

    eventsToListen.forEach((eventName) => {
      listeners[eventName] = (data: any) => onEvent(eventName, data);
      eventBus.on(eventName, listeners[eventName]);
    });

    // Cleanup on client disconnect
    ws.on("close", () => {
      eventsToListen.forEach((eventName) => {
        if (listeners[eventName]) {
          eventBus.removeListener(eventName, listeners[eventName]);
        }
      });
    });
  });
}

export async function getMetrics(req: Request, res: Response) {
  try {
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

    // Get today's start timestamp
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTime = todayStart.getTime();

    // Fetch all completed jobs (we need to get the actual jobs, not just count, to sum revenue)
    // In a real app with many jobs, we'd query a database, but for BullMQ we can just fetch all completed jobs
    // and filter by timestamp.
    const completedJobs = await printMasterQueue.getCompleted();
    
    let revenue = 0;
    let completedToday = 0;
    
    for (const job of completedJobs) {
       if (job.finishedOn && job.finishedOn >= todayStartTime) {
          completedToday++;
          revenue += (job.data.cost || 0);
       }
    }

    // formatting uptime
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
         totalJobsToday: completedToday + failed,
         revenue,
         activePrinters,
         totalPrinters
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to get metrics", error: String(err) });
  }
}

import { getMetricsHistory as fetchMetricsHistory } from "../services/metrics.service";

export async function getMetricsHistory(req: Request, res: Response) {
  try {
    const history = fetchMetricsHistory();
    res.json({ success: true, history });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to get metrics history", error: String(err) });
  }
}
