import os from "os";
import crypto from "crypto";
import db from "../../infrastructure/database";
import { getSystemConfig, updateSystemConfig } from "./config.db.service";
import { getDiskUsagePercent } from "./metrics.service";
import { listPrintersFromCUPS } from "./printer.service";
import { getActiveTunnelUrl } from "./tunnel.service";
import { getLocalIpAddress } from "../utils/network.utils";
import { getHardwareIdentifier, getPrimaryMacAddress } from "../utils/hardware.utils";
import { sendSignedNmsRequest } from "../utils/nmsSigner.utils";
import { eventBus } from "../utils/eventBus";

const NMS_BASE_URL = process.env.NMS_BASE_URL || "http://127.0.0.1:8787";
const FLEET_PROVISION_KEY = process.env.FLEET_PROVISION_KEY || "flt_dev_pilot_secret_9942";
const TELEMETRY_INTERVAL_MS = parseInt(process.env.NMS_TELEMETRY_INTERVAL_MS || "60000", 10);

let telemetryTimer: NodeJS.Timeout | null = null;
let auditTimer: NodeJS.Timeout | null = null;
let retryEnrollTimer: NodeJS.Timeout | null = null;
let isSyncRunning = false;

// Alert latch cache: map alertCode -> lastSentTimestamp (ms)
const recentAlerts = new Map<string, number>();
const ALERT_LATCH_MS = 5 * 60 * 1000; // 5-minute debounce per alert type

export interface EnrolledCredentials {
  deviceId: string;
  deviceSecret: string;
}

/**
 * Checks local database for existing NMS credentials or attempts zero-touch enrollment.
 */
export async function ensureEnrolled(): Promise<EnrolledCredentials | null> {
  const config = getSystemConfig();
  if (config?.nmsDeviceId && config?.nmsDeviceSecret) {
    return {
      deviceId: config.nmsDeviceId,
      deviceSecret: config.nmsDeviceSecret
    };
  }

  const hardwareId = getHardwareIdentifier();
  const macAddress = getPrimaryMacAddress() || undefined;
  const tunnelUrl = getActiveTunnelUrl() || undefined;
  const localIp = getLocalIpAddress() || undefined;
  const shopName = config?.shopName || "Modern Press Kiosk";

  console.log(`[NMS CloudSync] 🔐 Enrolling device with Central NMS (${NMS_BASE_URL})...`);
  console.log(`[NMS CloudSync] Hardware ID: ${hardwareId}, MAC: ${macAddress || "n/a"}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${NMS_BASE_URL.replace(/\/+$/, "")}/api/v1/devices/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-fleet-key": FLEET_PROVISION_KEY
      },
      body: JSON.stringify({
        shopName,
        hardwareId,
        macAddress,
        localIp,
        tunnelUrl,
        appVersion: "1.0.0"
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data: any = await res.json().catch(() => ({}));

    if (res.status === 201 || res.status === 200) {
      const { deviceId, deviceSecret } = data;
      if (deviceId && deviceSecret) {
        updateSystemConfig({
          nmsDeviceId: deviceId,
          nmsDeviceSecret: deviceSecret
        });
        console.log(`[NMS CloudSync] ✅ Successfully enrolled with NMS. Node ID: ${deviceId}`);
        return { deviceId, deviceSecret };
      }
    } else if (res.status === 409) {
      console.warn(
        `[NMS CloudSync] 🔒 Device hardware is already claimed on Central NMS. (${data.message || "ALREADY_CLAIMED"}). To re-enroll, unlock this node on Central NMS Dashboard.`
      );
    } else {
      console.warn(`[NMS CloudSync] ⚠️ Registration rejected (HTTP ${res.status}):`, data.message || data);
    }
  } catch (err: any) {
    console.warn(`[NMS CloudSync] ⚠️ Could not reach Central NMS during enrollment: ${err.message}`);
  }

  return null;
}

/**
 * Collects and sends one telemetry heartbeat to Central NMS (Channel 1).
 */
export async function sendTelemetryHeartbeat(): Promise<void> {
  const credentials = await ensureEnrolled();
  if (!credentials) {
    return;
  }

  try {
    // 1. Gather System Vitals
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

    const cpus = os.cpus().length || 1;
    const cpuLoad = os.loadavg()[0];
    const cpuPercent = Math.min(Math.round((cpuLoad / cpus) * 100), 100);

    const diskPercent = await getDiskUsagePercent();
    const uptimeSeconds = Math.floor(process.uptime());

    // 2. Gather Network Details
    const localIp = getLocalIpAddress() || "127.0.0.1";
    const tunnelUrl = getActiveTunnelUrl() || undefined;

    // 3. Gather Printers
    let cupsPrinters: any[] = [];
    try {
      cupsPrinters = await listPrintersFromCUPS();
    } catch {
      // CUPS not ready or offline
    }

    const printers = cupsPrinters.map((p, idx) => ({
      name: p.name,
      status: p.status === "idle" ? ("idle" as const) : ("printing" as const),
      isDefault: idx === 0,
      activeJobsCount: p.status === "busy" ? 1 : 0
    }));

    // If no CUPS printer was found, provide a fallback virtual entry
    if (printers.length === 0) {
      printers.push({
        name: "PRIMARY_PRINTER",
        status: "idle",
        isDefault: true,
        activeJobsCount: 0
      });
    }

    const payload = {
      nodeId: credentials.deviceId,
      timestamp: new Date().toISOString(),
      vitals: {
        cpuPercent,
        memoryPercent: memPercent,
        diskPercent,
        uptimeSeconds
      },
      network: {
        localIp,
        tunnelUrl
      },
      printers
    };

    const response = await sendSignedNmsRequest({
      baseUrl: NMS_BASE_URL,
      path: "/api/v1/telemetry",
      method: "POST",
      body: payload,
      deviceId: credentials.deviceId,
      deviceSecret: credentials.deviceSecret,
      timeoutMs: 8000
    });

    if (response.ok) {
      // Quiet success in production
    } else {
      console.warn(`[NMS CloudSync] Telemetry rejected by NMS (HTTP ${response.status}):`, response.data);
    }
  } catch (err: any) {
    // Non-blocking catch: WAN drops should never affect local printing
    console.debug?.(`[NMS CloudSync] Telemetry send failed: ${err.message}`);
  }
}

/**
 * Sends an immediate emergency or critical alert to Central NMS (Channel 2).
 */
export async function sendEmergencyAlert(
  code: "PAID_JOB_ABORTED" | "TOTAL_FLEET_BLACKOUT" | "STORAGE_CRITICAL_HALT",
  severity: "CRITICAL" | "EMERGENCY",
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  // Check alert latch to prevent duplicate alert storms within 5 minutes
  const now = Date.now();
  const lastSent = recentAlerts.get(code);
  if (lastSent && now - lastSent < ALERT_LATCH_MS) {
    return;
  }

  const credentials = await ensureEnrolled();
  if (!credentials) return;

  try {
    const alertId = `alt_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = {
      nodeId: credentials.deviceId,
      alertId,
      code,
      severity,
      message,
      metadata: metadata || {},
      timestamp: new Date().toISOString()
    };

    const res = await sendSignedNmsRequest({
      baseUrl: NMS_BASE_URL,
      path: "/api/v1/alerts",
      method: "POST",
      body: payload,
      deviceId: credentials.deviceId,
      deviceSecret: credentials.deviceSecret,
      timeoutMs: 8000
    });

    if (res.ok) {
      recentAlerts.set(code, now);
      console.log(`[NMS CloudSync] 🚨 Dispatched ${severity} alert to NMS: [${code}] ${message}`);
    }
  } catch (err: any) {
    console.warn(`[NMS CloudSync] Failed to dispatch emergency alert: ${err.message}`);
  }
}

/**
 * Aggregates local daily stats from SQLite and submits EOD reconciliation (Channel 3).
 */
export async function reconcileDailyAudit(targetDate?: string): Promise<void> {
  const credentials = await ensureEnrolled();
  if (!credentials) return;

  const dateStr = targetDate || new Date().toISOString().split("T")[0];
  const startOfDay = `${dateStr} 00:00:00`;
  const endOfDay = `${dateStr} 23:59:59`;

  try {
    const summaryRow = db.prepare(`
      SELECT 
        COUNT(*) as totalJobs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedJobs,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedJobs,
        SUM(CASE WHEN status = 'completed' THEN cost ELSE 0 END) as totalRevenue,
        SUM(CASE WHEN status = 'completed' THEN pages * copies ELSE 0 END) as totalPages,
        SUM(CASE WHEN status = 'completed' AND color_mode = 'color' THEN pages * copies ELSE 0 END) as colorPages,
        SUM(CASE WHEN status = 'completed' AND color_mode != 'color' THEN pages * copies ELSE 0 END) as bwPages
      FROM print_jobs
      WHERE submitted_at BETWEEN ? AND ?
    `).get(startOfDay, endOfDay) as any;

    const totalJobs = summaryRow?.totalJobs || 0;
    const completedJobs = summaryRow?.completedJobs || 0;
    const failedJobs = summaryRow?.failedJobs || 0;
    const totalPages = summaryRow?.totalPages || 0;
    const colorPages = summaryRow?.colorPages || 0;
    const bwPages = summaryRow?.bwPages || 0;
    const totalRevenue = summaryRow?.totalRevenue || 0;

    // Cryptographic signature over audit summary to ensure ledger immutability
    const auditFingerprint = `${credentials.deviceId}:${dateStr}:${totalJobs}:${completedJobs}:${totalRevenue}`;
    const auditSig = crypto.createHmac("sha256", credentials.deviceSecret).update(auditFingerprint).digest("hex");

    const payload = {
      nodeId: credentials.deviceId,
      auditDate: dateStr,
      summary: {
        totalJobs,
        completedJobs,
        failedJobs,
        totalPages,
        colorPages,
        bwPages,
        totalRevenue
      },
      incidentsRollup: {
        totalPaperJams: 0,
        quarantineEvents: 0,
        storageFailsafeTriggered: false
      },
      signature: auditSig
    };

    const res = await sendSignedNmsRequest({
      baseUrl: NMS_BASE_URL,
      path: "/api/v1/audit/reconcile",
      method: "POST",
      body: payload,
      deviceId: credentials.deviceId,
      deviceSecret: credentials.deviceSecret,
      timeoutMs: 10000
    });

    if (res.ok) {
      console.log(`[NMS CloudSync] 📑 EOD Audit Reconciled successfully for ${dateStr}. Jobs: ${totalJobs}, Rev: ₹${totalRevenue / 100}`);
    }
  } catch (err: any) {
    console.warn(`[NMS CloudSync] Failed to reconcile daily audit for ${dateStr}: ${err.message}`);
  }
}

/**
 * Attaches real-time listeners to internal eventBus to feed Channel 2 alerts.
 */
function setupEventBusSubscribers(): void {
  // 1. SD card storage failsafe (>95% disk)
  eventBus.on("system_critical", (data: any) => {
    sendEmergencyAlert(
      "STORAGE_CRITICAL_HALT",
      "EMERGENCY",
      data?.message || "Storage usage exceeded 95%. Queue paused to prevent filesystem corruption.",
      data
    );
  });

  // 2. Paid print job failures
  eventBus.on("job_failed", (data: any) => {
    const cost = data?.cost || 0;
    if (cost > 0) {
      sendEmergencyAlert(
        "PAID_JOB_ABORTED",
        "CRITICAL",
        `Paid customer print job ${data.jobId || ""} failed after payment received.`,
        data
      );
    }
  });

  // 3. Printer hardware quarantined / total fleet blackout
  eventBus.on("printer_state_changed", async (data: any) => {
    if (data?.state === "flagged") {
      try {
        const printers = await listPrintersFromCUPS();
        const allFlagged = printers.length > 0 && printers.every(p => p.status === "busy" || p.status === "offline");
        if (allFlagged) {
          sendEmergencyAlert(
            "TOTAL_FLEET_BLACKOUT",
            "EMERGENCY",
            `Total Printer Fleet Blackout: All ${printers.length} connected printers are stopped or in error state.`,
            { printers: printers.map(p => p.name) }
          );
        }
      } catch {
        /* ignored */
      }
    }
  });
}

/**
 * Schedules daily midnight EOD audit run (at 23:59:00).
 */
function scheduleNightlyAudit(): void {
  const checkAuditTick = () => {
    const now = new Date();
    if (now.getHours() === 23 && now.getMinutes() === 59) {
      reconcileDailyAudit();
    }
  };

  auditTimer = setInterval(checkAuditTick, 60000); // Check once per minute
}

/**
 * Main Service Entry Point: Initializes CloudSync background tasks.
 */
export async function startCloudSync(): Promise<void> {
  if (isSyncRunning) return;
  isSyncRunning = true;

  console.log(`[NMS CloudSync] 🚀 Starting Central NMS CloudSync Daemon (Target: ${NMS_BASE_URL})`);

  // 1. Initial Enrollment check
  const creds = await ensureEnrolled();
  if (!creds) {
    console.log("[NMS CloudSync] ⏳ System not yet enrolled. A background retry loop is active.");
    retryEnrollTimer = setInterval(async () => {
      const retryCreds = await ensureEnrolled();
      if (retryCreds && retryEnrollTimer) {
        clearInterval(retryEnrollTimer);
        retryEnrollTimer = null;
        sendTelemetryHeartbeat();
      }
    }, 30000);
  }

  // 2. Setup Event Watchers (Channel 2)
  setupEventBusSubscribers();

  // 3. Start Telemetry Polling (Channel 1)
  // Run first heartbeat after 5 seconds to let network/services hydrate
  setTimeout(sendTelemetryHeartbeat, 5000);
  telemetryTimer = setInterval(sendTelemetryHeartbeat, TELEMETRY_INTERVAL_MS);

  // 4. Start Nightly EOD Audit Scheduler (Channel 3)
  scheduleNightlyAudit();
}

/**
 * Stops all CloudSync timers gracefully.
 */
export function stopCloudSync(): void {
  if (telemetryTimer) clearInterval(telemetryTimer);
  if (auditTimer) clearInterval(auditTimer);
  if (retryEnrollTimer) clearInterval(retryEnrollTimer);
  isSyncRunning = false;
  console.log("[NMS CloudSync] Daemon stopped.");
}
