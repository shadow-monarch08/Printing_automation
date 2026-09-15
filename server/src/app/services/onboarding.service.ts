import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import { getSystemConfig, updateSystemConfig } from "./config.db.service";
import * as wifiService from "./wifi.service";
import { waitForTunnelPromise } from "./tunnel.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS, ProvisioningTelemetryPayload } from "../../infrastructure/redisKeys";
import db from "../../infrastructure/database";
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

export async function emitProvisioningStatus(payload: ProvisioningTelemetryPayload): Promise<void> {
  await redisConnection.set(
    REDIS_KEYS.wifiConnectionStatus,
    JSON.stringify(payload),
    "EX",
    REDIS_TTLS.WIFI_STATUS
  );
  try {
    await redisConnection.publish("channel:provisioning:telemetry", JSON.stringify(payload));
  } catch (err) {
    /* pubsub warning ignored */
  }
}

async function executeProvisioningPipeline(
  payload: ProvisionOnboardingPayload,
  provisioningState: string
) {
  const { adminPin, shopName, wifiSsid, wifiPassword, profileName, isSaved, skipWifi } = payload;
  const port = parseInt(process.env.PORT || "3000", 10);
  const effectiveShopName = shopName?.trim() || "Modern Press";
  const targetNetwork = wifiSsid || profileName || "Active Gateway";

  // 1. Capture previous active profile in RECOVERY mode for rollback if new connection fails
  let previousActiveProfile: string | null = null;
  if (provisioningState !== "FIRST_BOOT" && !skipWifi) {
    try {
      previousActiveProfile = await getActiveConnectionProfile();
    } catch {
      previousActiveProfile = null;
    }
  }

  // Publish Phase 1 (01/04): Radio Association
  await emitProvisioningStatus({
    status: "connecting",
    phase: "CYCLING_RADIO_HARDWARE",
    step: 1,
    totalSteps: 4,
    progressPercent: 25,
    message: `Cycling wireless radio hardware to associate with [${targetNetwork}]...`,
    ssid: targetNetwork,
    shopName: effectiveShopName,
    timestamp: Date.now(),
  });

  // 2. Handle Wi-Fi Connection
  if (!skipWifi) {
    if (!wifiSsid && !profileName) {
      throw new ValidationError("VALIDATION_SSID_REQUIRED", "Wi-Fi SSID is required.");
    }
    console.log(`[Onboarding Service] Phase 1: Connecting to Wi-Fi "${targetNetwork}" (Saved: ${Boolean(isSaved)})...`);
    await wifiService.connectToWifi(wifiSsid, wifiPassword, profileName, isSaved);
    console.log(`[Onboarding Service] Phase 1 complete: Wi-Fi radio association successful.`);
  } else {
    console.log(`[Onboarding Service] Phase 1: Skipping Wi-Fi radio reconfiguration. Using active network...`);
  }

  // Publish Phase 2 (02/04): Negotiating WAN DHCP & DNS Lease
  await emitProvisioningStatus({
    status: "verifying_internet",
    phase: "NEGOTIATING_WAN_DHCP_LEASE",
    step: 2,
    totalSteps: 4,
    progressPercent: 50,
    message: "Validating WAN IP address lease, gateway negotiation & DNS resolution...",
    ssid: targetNetwork,
    shopName: effectiveShopName,
    timestamp: Date.now(),
  });

  // 3. Verify Internet Readiness (Poll DNS + HTTP Trace up to 20s)
  console.log(`[Onboarding Service] Phase 2: Verifying WAN / Internet connectivity...`);
  await verifyInternetReadiness(10, 2000);
  console.log(`[Onboarding Service] Phase 2 complete: Internet access confirmed.`);

  // Publish Phase 3 (03/04): Spawning Cloudflare Quick Tunnel
  await emitProvisioningStatus({
    status: "starting_tunnel",
    phase: "SPAWNING_CLOUDFLARE_EDGE_TUNNEL",
    step: 3,
    totalSteps: 4,
    progressPercent: 75,
    message: "Provisioning encrypted Cloudflare Quick Tunnel edge endpoint...",
    ssid: targetNetwork,
    shopName: effectiveShopName,
    timestamp: Date.now(),
  });

  // 4. Cloudflare Quick Tunnel Provisioning & Verification
  console.log(`[Onboarding Service] Phase 3: Spawning and verifying Cloudflare Quick Tunnel...`);
  const liveTunnelUrl = await waitForTunnelPromise(port, 25000);
  console.log(`[Onboarding Service] Phase 3 complete: Live Cloudflare URL: ${liveTunnelUrl}`);

  // Publish Phase 4 (04/04): Verifying CUPS Daemons & Committing State
  let printerCount = 0;
  try {
    const printerRow = db.prepare("SELECT COUNT(*) as count FROM printers").get() as { count: number } | undefined;
    printerCount = printerRow?.count || 0;
  } catch {
    printerCount = 0;
  }

  await emitProvisioningStatus({
    status: "verifying_daemons",
    phase: "VERIFYING_DAEMON_READINESS",
    step: 4,
    totalSteps: 4,
    progressPercent: 90,
    message: "Verifying CUPS printing engines and committing hardware state...",
    ssid: targetNetwork,
    shopName: effectiveShopName,
    cloudflareUrl: liveTunnelUrl,
    printerCount,
    timestamp: Date.now(),
  });

  // 5. Persist State in SQLite
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

  // 6. Publish Final Success Status to Redis
  const localIp = getLocalIpAddress();
  const localAccessUrl = localIp ? `http://${localIp}:${port}` : null;

  await emitProvisioningStatus({
    status: "success",
    phase: "SUCCESS",
    step: 4,
    totalSteps: 4,
    progressPercent: 100,
    message: "Hardware provisioning and edge tunnel initialization complete.",
    ssid: targetNetwork,
    shopName: effectiveShopName,
    cloudflareUrl: liveTunnelUrl,
    localAccessUrl,
    printerCount,
    timestamp: Date.now(),
  });

  return {
    success: true,
    message: "Onboarding completed successfully with verified Cloudflare Quick Tunnel.",
    cloudflareUrl: liveTunnelUrl,
    localAccessUrl,
    printerCount,
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

    // 1. Immediately publish Failure Status to Redis so 127.0.0.1 displays red hazard alert without waiting on rollback
    await emitProvisioningStatus({
      status: "failed",
      phase: "FAILED",
      step: 1,
      totalSteps: 4,
      progressPercent: 0,
      code,
      error: errorMsg,
      message: `Provisioning failed: ${errorMsg}`,
      rollbackActive: true,
      timestamp: Date.now(),
    });

    // 2. Differentiated Mode Recovery
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

    throw error instanceof AppError ? error : new HardwareError(code, errorMsg);
  }
}

