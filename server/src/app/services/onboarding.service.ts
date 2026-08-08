import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import { getSystemConfig, updateSystemConfig } from "./config.db.service";
import * as wifiService from "./wifi.service";
import { waitForTunnelPromise } from "./tunnel.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";
import { runSecureCommand } from "../utils/exec";

export interface ProvisionOnboardingPayload {
  adminPin?: string;
  shopName?: string;
  wifiSsid?: string;
  wifiPassword?: string;
  skipWifi?: boolean;
}

export function getSetupStatus() {
  const config = getSystemConfig();
  const isOnboarded = config ? Boolean(config.isOnboarded) : false;
  const isSetupMode = process.env.SETUP_MODE === "true";
  const shopName = config?.shopName || "Modern Press";

  return {
    isSetupMode,
    isOnboarded,
    shopName,
  };
}

export async function provisionOnboarding(payload: ProvisionOnboardingPayload) {
  const { adminPin, shopName, wifiSsid, wifiPassword, skipWifi } = payload;
  const isSetupMode = process.env.SETUP_MODE === "true";

  if (skipWifi && isSetupMode) {
    throw new Error("Skipping Wi-Fi setup is strictly forbidden in Maintenance/Setup Mode.");
  }

  // Publish connecting status to Redis
  await redisConnection.set(
    REDIS_KEYS.wifiConnectionStatus,
    JSON.stringify({ status: "connecting", timestamp: Date.now() }),
    "EX",
    REDIS_TTLS.WIFI_STATUS
  );

  try {
    // 1. Handle Wi-Fi Connection (if not skipping)
    if (!skipWifi) {
      if (!wifiSsid) throw new Error("Wi-Fi SSID is required.");
      console.log(`[Onboarding Service] Attempting Wi-Fi connection to "${wifiSsid}"...`);
      await wifiService.connectToWifiRaw(wifiSsid, wifiPassword);
    } else {
      console.log(`[Onboarding Service] Skipping Wi-Fi radio changes. Proceeding with active connection...`);
    }

    // 2. MANDATORY Cloudflare Tunnel Verification (Zero Tolerance)
    console.log(`[Onboarding Service] Verifying Cloudflare Quick Tunnel availability (15s timeout)...`);
    const liveTunnelUrl = await waitForTunnelPromise(parseInt(process.env.PORT || "3000", 10), 15000);

    // 3. Persist Success State to SQLite
    const updates: any = { isOnboarded: true };
    if (adminPin) {
      updates.adminPinHash = bcrypt.hashSync(adminPin, 10);
    }
    if (shopName) {
      updates.shopName = shopName;
    } else {
      updates.shopName = "Modern Press";
    }
    updates.cloudflareUrl = liveTunnelUrl;

    updateSystemConfig(updates);

    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(dataDir, "cloudflare_url.txt"),
      `${liveTunnelUrl}\n# Kiosk Quick Tunnel Online`
    );

    // Publish Success Status to Redis
    await redisConnection.set(
      REDIS_KEYS.wifiConnectionStatus,
      JSON.stringify({ status: "success", skipped: !!skipWifi, timestamp: Date.now() }),
      "EX",
      REDIS_TTLS.WIFI_STATUS
    );

    return {
      success: true,
      message: "Onboarding completed successfully with verified Cloudflare Quick Tunnel.",
      cloudflareUrl: liveTunnelUrl,
    };
  } catch (error: any) {
    const errorMsg = error.message || "Onboarding provisioning failed";
    console.error(`[Onboarding Service] Provisioning failed:`, errorMsg);

    // Fallback: Re-enable Kiosk-Hotspot Access Point
    try {
      await runSecureCommand('sudo', ['nmcli', 'connection', 'up', 'Kiosk-Hotspot']);
    } catch (e) {
      console.warn("[Onboarding Service] Hotspot fallback trigger warning:", e);
    }

    // Publish Failure Status to Redis
    await redisConnection.set(
      REDIS_KEYS.wifiConnectionStatus,
      JSON.stringify({
        status: "failed",
        error: errorMsg,
        timestamp: Date.now(),
      }),
      "EX",
      REDIS_TTLS.WIFI_STATUS
    );

    throw new Error(errorMsg);
  }
}
