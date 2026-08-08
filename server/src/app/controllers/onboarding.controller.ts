import { Request, Response } from "express";
import * as onboardingService from "../services/onboarding.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS } from "../../infrastructure/redisKeys";

export async function getSetupStatus(req: Request, res: Response) {
  try {
    const status = onboardingService.getSetupStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get setup status" });
  }
}

export async function provisionSetup(req: Request, res: Response) {
  const { adminPin, shopName, wifiSsid, wifiPassword, skipWifi } = req.body;

  // Immediate response so client can start polling status while background execution runs
  res.json({
    message: "Provisioning request received. Applying setup configuration & verifying Cloudflare Tunnel...",
    rebooting: true,
  });

  // Execute provisioning in background
  setTimeout(async () => {
    try {
      await onboardingService.provisionOnboarding({
        adminPin,
        shopName,
        wifiSsid,
        wifiPassword,
        skipWifi,
      });
    } catch (err: any) {
      console.error("[Onboarding Controller] Background provisioning failed:", err.message || err);
    }
  }, 500);
}

export async function skipWifiSetup(req: Request, res: Response) {
  const { adminPin, shopName } = req.body;

  // Immediate response
  res.json({
    message: "Skip Wi-Fi setup request received. Verifying Cloudflare Tunnel...",
    rebooting: true,
  });

  // Execute provisioning in background
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
  }, 500);
}

export async function getProvisionStatus(req: Request, res: Response) {
  try {
    const raw = await redisConnection.get(REDIS_KEYS.wifiConnectionStatus);
    if (!raw) {
      return res.json({ status: "idle", timestamp: Date.now() });
    }
    res.json(JSON.parse(raw));
  } catch (error) {
    res.json({ status: "idle", timestamp: Date.now() });
  }
}
