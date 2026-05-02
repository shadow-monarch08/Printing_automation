import { Router } from "express";
import * as wifiService from "../services/wifi.service";

const router = Router();

router.get("/scan", async (_req, res) => {
  try {
    const networks = await wifiService.scanNetworks();
    res.json(networks);
  } catch (error) {
    res.status(500).json({ error: "Failed to scan networks" });
  }
});

router.get("/setup-mode", async (_req, res) => {
  res.json({ isSetupMode: process.env.SETUP_MODE === "true" }); 
});

router.post("/connect", async (req, res) => {
  const { ssid, password } = req.body;
  
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
      await wifiService.connectToNetwork(ssid, password);
    } catch (err) {
      console.error("[WiFi Route] Connection background task failed:", err);
    }
  }, 1000);
});

export default router;
