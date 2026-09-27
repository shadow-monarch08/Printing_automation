import { Request, Response } from "express";
import * as onboardingService from "../services/onboarding.service";
import * as hotspotService from "../services/hotspot.service";
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
  const { adminPin, shopName, wifiSsid, wifiPassword, profileName, isSaved, skipWifi, mode, source } = req.body;
  const effectiveShopName = shopName?.trim() || "Modern Press";
  const targetNetwork = wifiSsid || profileName || "Selected Network";
  const effectiveMode = (mode || (source === "mobile" ? "MOBILE" : undefined)) as ("MOBILE" | "SCREEN" | undefined);

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
    onboardingMode: effectiveMode,
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
        mode: effectiveMode,
        source,
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
  const isHotspot = await hotspotService.isHotspotActive();
  const onboardingMode = await hotspotService.getOnboardingMode();

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
    nmsDeviceId: config?.nmsDeviceId || null,
    hotspotSsid: hotspotService.HOTSPOT_CONFIG.SSID,
    setupUrl: `http://192.168.4.1:${port}/setup`,
    localAccessUrl: config?.localAccessUrl || "http://piprint.local:3000/",
    cloudflareUrl: config?.cloudflareUrl || null,
    internetOnline: isOnline,
    activeProfile,
    hotspotActive: isHotspot || recoveryStatus.hotspotActive,
    onboardingMode,
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
  const port = parseInt(process.env.PORT || "3000", 10);
  const isHotspot = await hotspotService.isHotspotActive();

  res.json({
    internetOnline: isOnline,
    recoveryState: recoveryStatus.state,
    hotspotActive: isHotspot || recoveryStatus.hotspotActive,
    activeProfile,
    cloudflareUrl: config?.cloudflareUrl || null,
    localAccessUrl: config?.localAccessUrl || "http://piprint.local:3000/",
  });
}

export async function startHotspot(_req: Request, res: Response) {
  await hotspotService.activateHotspot();
  res.json({
    success: true,
    message: "Hotspot activated successfully",
    ssid: hotspotService.HOTSPOT_CONFIG.SSID,
    ip: hotspotService.HOTSPOT_CONFIG.IP,
  });
}

export async function stopHotspot(_req: Request, res: Response) {
  await hotspotService.deactivateHotspot();
  await hotspotService.setOnboardingMode("SCREEN");
  res.json({
    success: true,
    message: "Hotspot deactivated successfully",
  });
}

export async function getHotspotStatus(_req: Request, res: Response) {
  const status = await hotspotService.getHotspotStatus();
  res.json(status);
}

export async function setOnboardingMode(req: Request, res: Response) {
  const { mode } = req.body;
  if (mode !== "SCREEN" && mode !== "MOBILE" && mode !== "NONE") {
    res.status(400).json({ error: "Invalid mode. Must be 'SCREEN', 'MOBILE', or 'NONE'." });
    return;
  }
  await hotspotService.setOnboardingMode(mode);
  res.json({ success: true, mode });
}


