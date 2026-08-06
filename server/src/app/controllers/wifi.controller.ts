import { Request, Response } from "express";
import * as wifiService from "../services/wifi.service";
import { getSystemConfig } from "../services/config.db.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS } from "../../infrastructure/redisKeys";

export async function scanWifiNetworks(req: Request, res: Response) {
  try {
    const networks = await wifiService.scanNetworks();
    res.json(networks);
  } catch (error) {
    res.status(500).json({ error: "Failed to scan networks" });
  }
}

export async function getWifiSetupMode(req: Request, res: Response) {
  const config = getSystemConfig();
  const isOnboarded = config ? Boolean(config.isOnboarded) : false;
  const isSetupMode = process.env.SETUP_MODE === "true";

  res.json({ 
    isSetupMode,
    isOnboarded
  });
}

export async function connectWifiNetwork(req: Request, res: Response) {
  const { ssid, profileName, password, skipWifi, adminPin, shopName } = req.body;
  
  if (skipWifi) {
    await wifiService.connectToWifi({ skipWifi: true, adminPin, shopName });
    return res.json({ 
      message: "Wi-Fi setup skipped. Onboarding completed with active network connection.",
      skipped: true 
    });
  }

  if (!ssid) {
    return res.status(400).json({ error: "SSID is required" });
  }

  // CRITICAL: Return response immediately because the hotspot will drop
  res.json({ 
    message: "Connection request received. Applying credentials...",
    rebooting: true 
  });

  // Execute connection after a short delay to allow the response to be sent
  setTimeout(async () => {
    try {
      await wifiService.connectToWifi({ ssid, profileName, password, adminPin, shopName });
    } catch (err) {
      console.error("[WiFi Controller] Connection background task failed:", err);
    }
  }, 1000);
}

export async function skipWifiSetup(req: Request, res: Response) {
  const { adminPin, shopName } = req.body;
  await wifiService.connectToWifi({ skipWifi: true, adminPin, shopName });
  return res.json({
    message: "Wi-Fi setup skipped. Onboarding completed with active network connection.",
    skipped: true,
  });
}

export async function getWifiConnectionStatus(req: Request, res: Response) {
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
