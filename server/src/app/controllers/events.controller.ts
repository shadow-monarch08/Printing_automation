import { Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { eventBus } from "../utils/eventBus";
import { printMasterQueue } from "../../infrastructure/printMaster.queue";
import { listPrinters } from "../services/printer.service";
import os from "os";
import { getDiskUsagePercent } from "../services/metrics.service";

import db from "../../infrastructure/database";

export function initWebSocketServer(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: any, socket: any, head: any) => {
    const pathname = request.url ? request.url.split("?")[0] : "";
    if (pathname === "/events" || pathname === "/api/events") {
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

    // Fetch today's persistent KPI metrics directly from SQLite database
    const dbMetrics = db.prepare(`
      SELECT 
        COUNT(*) as totalJobsToday,
        COALESCE(SUM(cost), 0) as totalRevenueToday
      FROM print_jobs
      WHERE date(submitted_at) = date('now')
    `).get() as any;

    const totalJobsToday = dbMetrics?.totalJobsToday || 0;
    const revenue = dbMetrics?.totalRevenueToday || 0;

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
         totalJobsToday,
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
