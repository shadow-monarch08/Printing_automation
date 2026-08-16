import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import { getSystemConfig, updateSystemConfig } from "./config.db.service";
import * as wifiService from "./wifi.service";
import { waitForTunnelPromise } from "./tunnel.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";
import { runSecureCommand } from "../utils/exec";
import { ForbiddenError, ValidationError, HardwareError, AppError } from "../utils/errors";
import {
  verifyInternetReadiness,
  getActiveConnectionProfile,
  getLocalIpAddress,
} from "../utils/network.utils";

export interface ProvisionOnboardingPayload {
  adminPin?: string;
  shopName?: string;
  wifiSsid?: string;
  wifiPassword?: string;
  profileName?: string;
  isSaved?: boolean;
  skipWifi?: boolean;
  handoffToken?: string;
}

export function getSetupStatus() {
  const config = getSystemConfig();
  const isOnboarded = config ? Boolean(config.isOnboarded) : false;
  const provisioningState = config?.provisioningState || (isOnboarded ? "READY" : "FIRST_BOOT");
  const shopName = config?.shopName || "Modern Press";

  return {
    provisioningState,
    isOnboarded,
    shopName,
  };
}

async function executeProvisioningPipeline(
  payload: ProvisionOnboardingPayload,
  provisioningState: string
) {
  const { adminPin, shopName, wifiSsid, wifiPassword, profileName, isSaved, skipWifi, handoffToken } = payload;
  const port = parseInt(process.env.PORT || "3000", 10);

  // 1. Capture previous active profile in RECOVERY mode for rollback if new connection fails
  let previousActiveProfile: string | null = null;
  if (provisioningState !== "FIRST_BOOT" && !skipWifi) {
    try {
      previousActiveProfile = await getActiveConnectionProfile();
    } catch {
      previousActiveProfile = null;
    }
  }

  // Publish Phase 1: Connecting
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

  // 2. Handle Wi-Fi Connection
  if (!skipWifi) {
    if (!wifiSsid && !profileName) {
      throw new ValidationError("VALIDATION_SSID_REQUIRED", "Wi-Fi SSID is required.");
    }
    console.log(`[Onboarding Service] Phase 1: Connecting to Wi-Fi "${wifiSsid || profileName}" (Saved: ${Boolean(isSaved)})...`);
    await wifiService.connectToWifi(wifiSsid, wifiPassword, profileName, isSaved);
    console.log(`[Onboarding Service] Phase 1 complete: Wi-Fi radio association successful.`);
  } else {
    console.log(`[Onboarding Service] Phase 1: Skipping Wi-Fi radio reconfiguration. Using active network...`);
  }

  // Publish Phase 2: Verifying Internet
  await redisConnection.set(
    REDIS_KEYS.wifiConnectionStatus,
    JSON.stringify({
      status: "verifying_internet",
      phase: "VERIFYING_INTERNET",
      timestamp: Date.now(),
    }),
    "EX",
    REDIS_TTLS.WIFI_STATUS
  );

  // 3. Verify Internet Readiness (Poll DNS + HTTP Trace up to 20s)
  console.log(`[Onboarding Service] Phase 2: Verifying WAN / Internet connectivity...`);
  await verifyInternetReadiness(10, 2000);
  console.log(`[Onboarding Service] Phase 2 complete: Internet access confirmed.`);

  // Publish Phase 3: Cloudflare Tunnel Startup
  await redisConnection.set(
    REDIS_KEYS.wifiConnectionStatus,
    JSON.stringify({
      status: "starting_tunnel",
      phase: "STARTING_TUNNEL",
      timestamp: Date.now(),
    }),
    "EX",
    REDIS_TTLS.WIFI_STATUS
  );

  // 4. Cloudflare Quick Tunnel Provisioning & Verification
  console.log(`[Onboarding Service] Phase 3: Spawning and verifying Cloudflare Quick Tunnel...`);
  const liveTunnelUrl = await waitForTunnelPromise(port, 25000);
  console.log(`[Onboarding Service] Phase 3 complete: Live Cloudflare URL: ${liveTunnelUrl}`);

  // 5. Persist State in SQLite
  const effectiveShopName = shopName?.trim() || "Modern Press";
  const updates: any = {
    isOnboarded: true,
    provisioningState: "READY",
    shopName: effectiveShopName,
    cloudflareUrl: liveTunnelUrl,
  };
  if (adminPin) {
    updates.adminPinHash = bcrypt.hashSync(adminPin, 10);
  }
  updateSystemConfig(updates);

  // Persist URL file for local headless display read
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(dataDir, "cloudflare_url.txt"),
    `${liveTunnelUrl}\n# Kiosk Quick Tunnel Online`
  );

  // 6. Generate One-Time Handoff Ticket in Redis
  const localIp = getLocalIpAddress();
  if (handoffToken) {
    const handoffData = JSON.stringify({
      type: "onboarding_complete",
      shopName: effectiveShopName,
      tunnelUrl: liveTunnelUrl,
      localAccessUrl: localIp ? `http://${localIp}:${port}` : null,
      createdAt: Date.now(),
    });
    await redisConnection.set(
      REDIS_KEYS.onboardingHandoff(handoffToken),
      handoffData,
      "EX",
      REDIS_TTLS.ONBOARDING_HANDOFF
    );
    console.log(`[Onboarding Service] 🎟️ One-time handoff ticket created for token [${handoffToken.slice(0, 8)}...]`);
  }

  // 7. Publish Success Status to Redis
  await redisConnection.set(
    REDIS_KEYS.wifiConnectionStatus,
    JSON.stringify({
      status: "success",
      phase: "SUCCESS",
      skipped: !!skipWifi,
      timestamp: Date.now(),
    }),
    "EX",
    REDIS_TTLS.WIFI_STATUS
  );

  return {
    success: true,
    message: "Onboarding completed successfully with verified Cloudflare Quick Tunnel.",
    cloudflareUrl: liveTunnelUrl,
  };
}

export async function provisionOnboarding(payload: ProvisionOnboardingPayload) {
  const config = getSystemConfig();
  const provisioningState = config?.provisioningState || (config?.isOnboarded ? "READY" : "FIRST_BOOT");

  if (payload.skipWifi && provisioningState === "FIRST_BOOT") {
    throw new ForbiddenError(
      "SETUP_SKIP_FORBIDDEN",
      "Skipping Wi-Fi setup is not permitted during Initial First Boot Provisioning."
    );
  }

  const OVERALL_DEADLINE_MS = 90000; // 90 seconds overall deadline

  try {
    return await Promise.race([
      executeProvisioningPipeline(payload, provisioningState),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new HardwareError("PROVISION_TIMEOUT", "Onboarding provisioning exceeded 90s deadline.")),
          OVERALL_DEADLINE_MS
        )
      ),
    ]);
  } catch (error: any) {
    const errorMsg = error.message || "Onboarding provisioning failed";
    const code = error.code || "WIFI_CONNECTION_FAILED";

    console.error(`[Onboarding Service] ❌ Provisioning pipeline failed (${code}):`, errorMsg);

    // Differentiated Mode Recovery
    if (provisioningState === "FIRST_BOOT") {
      // First boot: Fallback to Kiosk-Hotspot
      try {
        console.log(`[Onboarding Service] Mode A (FIRST_BOOT): Restoring Kiosk-Hotspot Access Point...`);
        await runSecureCommand("sudo", ["nmcli", "connection", "up", "Kiosk-Hotspot"]);
      } catch (e) {
        console.warn("[Onboarding Service] Hotspot fallback trigger warning:", e);
      }
    } else {
      // Recovery mode: Do NOT enable hotspot. If available, restore previous profile
      if (payload.profileName) {
        try {
          console.log(`[Onboarding Service] Mode B (RECOVERY): Attempting to restore prior profile...`);
          await runSecureCommand("sudo", ["nmcli", "connection", "up", payload.profileName]);
        } catch (restoreErr) {
          console.warn("[Onboarding Service] Mode B prior profile restoration warning:", restoreErr);
        }
      }
    }

    // Publish Failure Status to Redis
    await redisConnection.set(
      REDIS_KEYS.wifiConnectionStatus,
      JSON.stringify({
        status: "failed",
        code,
        error: errorMsg,
        timestamp: Date.now(),
      }),
      "EX",
      REDIS_TTLS.WIFI_STATUS
    );

    throw error instanceof AppError ? error : new HardwareError(code, errorMsg);
  }
}

