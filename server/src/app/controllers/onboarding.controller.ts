import { Request, Response } from "express";
import * as onboardingService from "../services/onboarding.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS } from "../../infrastructure/redisKeys";

export async function getSetupStatus(_req: Request, res: Response) {
  const status = onboardingService.getSetupStatus();
  res.json(status);
}

export async function provisionSetup(req: Request, res: Response) {
  const { adminPin, shopName, wifiSsid, wifiPassword, skipWifi } = req.body;

  res.json({
    message: "Provisioning request received. Applying setup configuration & verifying Cloudflare Tunnel...",
    rebooting: true,
  });

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

  res.json({
    message: "Skip Wi-Fi setup request received. Verifying Cloudflare Tunnel...",
    rebooting: true,
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
  }, 500);
}

export async function getProvisionStatus(_req: Request, res: Response) {
  const raw = await redisConnection.get(REDIS_KEYS.wifiConnectionStatus);
  if (!raw) {
    return res.json({ status: "idle", timestamp: Date.now() });
  }
  res.json(JSON.parse(raw));
}
