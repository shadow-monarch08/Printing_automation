import { Request, Response } from "express";
import * as wifiService from "../services/wifi.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS } from "../../infrastructure/redisKeys";
import { ValidationError } from "../utils/errors";

export async function scanWifiNetworks(_req: Request, res: Response) {
  const networks = await wifiService.scanNetworks();
  res.json(networks);
}

export async function connectWifiNetwork(req: Request, res: Response) {
  const { ssid, profileName, password, isSaved } = req.body;

  if (!ssid && !profileName) {
    throw new ValidationError("VALIDATION_SSID_REQUIRED", "SSID is required.");
  }

  res.json({
    message: "Connection request received. Applying credentials...",
    rebooting: true,
  });

  setTimeout(async () => {
    try {
      await wifiService.connectToWifi(ssid, password, profileName, isSaved);
    } catch (err) {
      console.error("[WiFi Controller] Connection background task failed:", err);
    }
  }, 1000);
}

export async function getWifiConnectionStatus(_req: Request, res: Response) {
  const raw = await redisConnection.get(REDIS_KEYS.wifiConnectionStatus);
  if (!raw) {
    return res.json({ status: "idle", timestamp: Date.now() });
  }
  res.json(JSON.parse(raw));
}
