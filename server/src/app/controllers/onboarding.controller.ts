import { Request, Response } from "express";
import { randomUUID } from "crypto";
import * as onboardingService from "../services/onboarding.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";
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
  const handoffToken = req.body?.handoffToken || randomUUID();

  // Synchronously initialize Redis status so first polling request receives active state
  await redisConnection.set(
    REDIS_KEYS.wifiConnectionStatus,
    JSON.stringify({
      status: "connecting",
      phase: "CONNECTING_WIFI",
      timestamp: Date.now(),
    }),
    "EX",
    REDIS_TTLS.WIFI_STATUS
  );

  res.json({
    message: "Provisioning request received. Applying setup configuration & verifying Cloudflare Tunnel...",
    rebooting: true,
    handoffToken,
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
        handoffToken,
      });
    } catch (err: any) {
      console.error("[Onboarding Controller] Background provisioning failed:", err.message || err);
    }
  }, 100);
}

export async function skipWifiSetup(req: Request, res: Response) {
  const { adminPin, shopName } = req.body;
  const handoffToken = req.body?.handoffToken || randomUUID();

  // Synchronously initialize Redis status so first polling request receives active state
  await redisConnection.set(
    REDIS_KEYS.wifiConnectionStatus,
    JSON.stringify({
      status: "connecting",
      phase: "VERIFYING_INTERNET",
      timestamp: Date.now(),
    }),
    "EX",
    REDIS_TTLS.WIFI_STATUS
  );

  res.json({
    message: "Skip Wi-Fi setup request received. Verifying Cloudflare Tunnel...",
    rebooting: true,
    handoffToken,
  });

  setTimeout(async () => {
    try {
      await onboardingService.provisionOnboarding({
        adminPin,
        shopName,
        skipWifi: true,
        handoffToken,
      });
    } catch (err: any) {
      console.error("[Onboarding Controller] Background skip provisioning failed:", err.message || err);
    }
  }, 100);
}

export async function getProvisionStatus(_req: Request, res: Response) {
  const raw = await redisConnection.get(REDIS_KEYS.wifiConnectionStatus);
  if (!raw) {
    return res.json({ status: "idle", timestamp: Date.now() });
  }
  res.json(JSON.parse(raw));
}

export async function consumeHandoff(req: Request, res: Response) {
  const { token } = req.body;
  if (!token || typeof token !== "string") {
    return res.json({ handoff: null });
  }

  try {
    let raw: string | null = null;
    try {
      raw = await (redisConnection as any).getdel(REDIS_KEYS.onboardingHandoff(token));
    } catch {
      raw = await redisConnection.get(REDIS_KEYS.onboardingHandoff(token));
      if (raw) {
        await redisConnection.del(REDIS_KEYS.onboardingHandoff(token));
      }
    }

    if (!raw) {
      return res.json({ handoff: null });
    }

    const handoffData = JSON.parse(raw);

    // Enrich with printer count
    try {
      const printerRow = db.prepare("SELECT COUNT(*) as count FROM printers").get() as { count: number } | undefined;
      handoffData.printerCount = printerRow?.count || 0;
    } catch {
      handoffData.printerCount = 0;
    }

    return res.json({ handoff: handoffData });
  } catch (err) {
    console.error("[Onboarding Controller] Error consuming handoff ticket:", err);
    return res.json({ handoff: null });
  }
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


