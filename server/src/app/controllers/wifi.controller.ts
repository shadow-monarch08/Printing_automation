import { Request, Response } from "express";
import * as wifiService from "../services/wifi.service";
import { cancelActiveProvisioning } from "../services/onboarding.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS } from "../../infrastructure/redisKeys";
import { ValidationError } from "../utils/errors";

export async function scanWifiNetworks(_req: Request, res: Response) {
  const networks = await wifiService.scanNetworks();
  res.json(networks);
}

export async function connectWifiNetwork(req: Request, res: Response) {
  const { ssid, profileName, uuid, password, isSaved } = req.body;

  if (!ssid && !profileName && !uuid) {
    throw new ValidationError("VALIDATION_SSID_REQUIRED", "SSID or UUID is required.");
  }

  const targetNetwork = ssid || profileName || uuid;

  // 1. Immediately flag Redis status as connecting
  await redisConnection.set(
    REDIS_KEYS.wifiConnectionStatus,
    JSON.stringify({ status: "connecting", ssid: targetNetwork, timestamp: Date.now() }),
    "EX",
    120
  );

  // 2. Respond immediately to caller before radio cycles and severs LAN socket
  res.json({
    success: true,
    message: `Reconfiguration initiated for "${targetNetwork}". Live telemetry is streaming to kiosk display.`,
    targetNetwork,
  });

  // 3. Cancel any active onboarding session to eliminate conflicting radio operations
  cancelActiveProvisioning("Admin Wi-Fi reconfiguration initiated");

  // 4. Launch resilient background pipeline with EventBus & Cloudflare re-spawn
  setImmediate(async () => {
    try {
      await wifiService.reconfigureWifiPipeline(ssid, password, profileName, isSaved, uuid);
    } catch (err) {
      console.error("[WiFi Controller] Wi-Fi reconfiguration pipeline failed:", err);
    }
  });
}

export async function getWifiConnectionStatus(_req: Request, res: Response) {
  const raw = await redisConnection.get(REDIS_KEYS.wifiConnectionStatus);
  if (!raw) {
    return res.json({ status: "idle", timestamp: Date.now() });
  }
  res.json(JSON.parse(raw));
}
