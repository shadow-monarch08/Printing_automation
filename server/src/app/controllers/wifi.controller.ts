import { Request, Response } from "express";
import * as wifiService from "../services/wifi.service";

export async function scanWifiNetworks(req: Request, res: Response) {
  try {
    const networks = await wifiService.scanNetworks();
    res.json(networks);
  } catch (error) {
    res.status(500).json({ error: "Failed to scan networks" });
  }
}

import { getSystemConfig } from "../services/config.db.service";

export async function getWifiSetupMode(req: Request, res: Response) {
  res.json({ 
    isSetupMode: process.env.SETUP_MODE === "true",
    isOnboarded: true
  });
}

export async function connectWifiNetwork(req: Request, res: Response) {
  const { ssid, profileName, password } = req.body;
  
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
      await wifiService.connectToWifi({ ssid, profileName, password });
    } catch (err) {
      console.error("[WiFi Controller] Connection background task failed:", err);
    }
  }, 1000);
}
