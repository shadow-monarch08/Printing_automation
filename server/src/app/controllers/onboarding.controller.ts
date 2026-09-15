import { Request, Response } from "express";
import * as onboardingService from "../services/onboarding.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, ProvisioningTelemetryPayload } from "../../infrastructure/redisKeys";
import db from "../../infrastructure/database";
import { getRecoveryStatus } from "../services/networkRecovery.service";
import { getActiveConnectionProfile, getLocalIpAddress, checkInternetConnectivity } from "../utils/network.utils";
import { getSystemConfig } from "../services/config.db.service";

export async function getSetupStatus(_req: Request, res: Response) {
  const status = onboardingService.getSetupStatus();
  res.json(status);
}

export async function provisionSetup(req: Request, res: Response) {
  const { adminPin, shopName, wifiSsid, wifiPassword, profileName, isSaved, skipWifi } = req.body;
  const effectiveShopName = shopName?.trim() || "Modern Press";
  const targetNetwork = wifiSsid || profileName || "Selected Network";

  // Synchronously initialize Stage 1 Redis status so loopback 127.0.0.1 immediately switches to hazard overlay
  await onboardingService.emitProvisioningStatus({
    status: "connecting",
    phase: "CYCLING_RADIO_HARDWARE",
    step: 1,
    totalSteps: 4,
    progressPercent: 15,
    message: `Initializing hardware radio association with [${targetNetwork}]...`,
    ssid: targetNetwork,
    shopName: effectiveShopName,
    timestamp: Date.now(),
  });

  res.json({
    message: "Provisioning pipeline initiated. Please monitor terminal display for live telemetry.",
    dispatched: true,
  });

  setTimeout(async () => {
    try {
      await onboardingService.provisionOnboarding({
        adminPin,
        shopName,
        wifiSsid,
        wifiPassword,
        profileName,
        isSaved,
        skipWifi,
      });
    } catch (err: any) {
      console.error("[Onboarding Controller] Background provisioning failed:", err.message || err);
    }
  }, 50);
}

export async function skipWifiSetup(req: Request, res: Response) {
  const { adminPin, shopName } = req.body;
  const effectiveShopName = shopName?.trim() || "Modern Press";

  // Synchronously initialize Stage 2 Redis status so loopback 127.0.0.1 immediately switches to hazard overlay
  await onboardingService.emitProvisioningStatus({
    status: "verifying_internet",
    phase: "NEGOTIATING_WAN_DHCP_LEASE",
    step: 2,
    totalSteps: 4,
    progressPercent: 30,
    message: "Validating existing network gateway and verifying WAN connectivity...",
    shopName: effectiveShopName,
    timestamp: Date.now(),
  });

  res.json({
    message: "Skip Wi-Fi setup initiated. Verifying WAN Gateway & Cloudflare Tunnel...",
    dispatched: true,
  });

  setTimeout(async () => {
    try {
      await onboardingService.provisionOnboarding({
        adminPin,
        shopName,
        skipWifi: true,
      });
    } catch (err: any) {
      console.error("[Onboarding Controller] Background skip provisioning failed:", err.message || err);
    }
  }, 50);
}

export async function getProvisionStatus(_req: Request, res: Response) {
  const raw = await redisConnection.get(REDIS_KEYS.wifiConnectionStatus);
  if (!raw) {
    const idlePayload: ProvisioningTelemetryPayload = {
      status: "idle",
      phase: "IDLE",
      step: 0,
      totalSteps: 4,
      progressPercent: 0,
      message: "System idle. Awaiting configuration command.",
      timestamp: Date.now(),
    };
    return res.json(idlePayload);
  }
  res.json(JSON.parse(raw));
}

/**
 * Server-Sent Events (SSE) stream for zero-latency telemetry push to loopback 127.0.0.1:3000
 */
export async function streamProvisionStatus(req: Request, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  // Send initial state immediately
  const raw = await redisConnection.get(REDIS_KEYS.wifiConnectionStatus);
  let lastData = raw || JSON.stringify({
    status: "idle",
    phase: "IDLE",
    step: 0,
    totalSteps: 4,
    progressPercent: 0,
    message: "System idle. Awaiting configuration command.",
    timestamp: Date.now(),
  });
  res.write(`data: ${lastData}\n\n`);

  // Stream updates on 750ms interval or heartbeat
  const intervalId = setInterval(async () => {
    try {
      const currentRaw = await redisConnection.get(REDIS_KEYS.wifiConnectionStatus);
      if (currentRaw && currentRaw !== lastData) {
        lastData = currentRaw;
        res.write(`data: ${currentRaw}\n\n`);
      } else {
        res.write(": heartbeat\n\n");
      }
    } catch {
      /* ignore poll errors */
    }
  }, 750);

  req.on("close", () => {
    clearInterval(intervalId);
    res.end();
  });
}

/**
 * Unified Kiosk chassis status endpoint for the 5-inch screen
 */
export async function getKioskSummary(_req: Request, res: Response) {
  const config = getSystemConfig();
  const recoveryStatus = getRecoveryStatus();
  const activeProfile = await getActiveConnectionProfile();
  const isOnline = await checkInternetConnectivity();
  const localIp = getLocalIpAddress();
  const port = parseInt(process.env.PORT || "3000", 10);

  let printerCount = 0;
  try {
    const printerRow = db.prepare("SELECT COUNT(*) as count FROM printers WHERE is_quarantined = 0").get() as { count: number } | undefined;
    printerCount = printerRow?.count || 0;
  } catch {
    printerCount = 0;
  }

  const rawProvisioning = await redisConnection.get(REDIS_KEYS.wifiConnectionStatus);
  const provisioning = rawProvisioning ? JSON.parse(rawProvisioning) : null;

  res.json({
    isOnboarded: Boolean(config?.isOnboarded),
    provisioningState: config?.provisioningState || (config?.isOnboarded ? "READY" : "FIRST_BOOT"),
    shopName: config?.shopName || "Modern Press",
    hotspotSsid: "Kiosk-Hotspot",
    setupUrl: `http://192.168.4.1:${port}/setup`,
    localAccessUrl: localIp ? `http://${localIp}:${port}` : null,
    cloudflareUrl: config?.cloudflareUrl || null,
    internetOnline: isOnline,
    activeProfile,
    hotspotActive: recoveryStatus.hotspotActive,
    printerCount,
    provisioning,
    timestamp: Date.now(),
  });
}

export async function getNetworkStatus(_req: Request, res: Response) {
  const config = getSystemConfig();
  const recoveryStatus = getRecoveryStatus();
  const activeProfile = await getActiveConnectionProfile();
  const isOnline = await checkInternetConnectivity();
  const localIp = getLocalIpAddress();
  const port = parseInt(process.env.PORT || "3000", 10);

  res.json({
    internetOnline: isOnline,
    recoveryState: recoveryStatus.state,
    hotspotActive: recoveryStatus.hotspotActive,
    activeProfile,
    cloudflareUrl: config?.cloudflareUrl || null,
    localAccessUrl: localIp ? `http://${localIp}:${port}` : null,
  });
}


