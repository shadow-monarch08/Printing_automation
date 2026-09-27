import { runSecureCommand } from "../utils/exec";
import { suspendRecoveryMonitoring, resumeRecoveryMonitoring } from "./networkRecovery.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS } from "../../infrastructure/redisKeys";
import { autoReconnectKnownWifi } from "./wifi.service";

export type OnboardingMode = "SCREEN" | "MOBILE" | "NONE";

export const HOTSPOT_CONFIG = {
  PROFILE_NAME: "Kiosk-Hotspot",
  SSID: "Kiosk-Hotspot",
  IP: "192.168.4.1",
  SUBNET: "192.168.4.1/24",
  INTERFACE: "wlan0",
} as const;

let currentOnboardingMode: OnboardingMode = "NONE";

/**
 * Get the current active onboarding mode ('SCREEN' | 'MOBILE' | 'NONE').
 * Checks memory first, falls back to Redis.
 */
export async function getOnboardingMode(): Promise<OnboardingMode> {
  if (currentOnboardingMode !== "NONE") {
    return currentOnboardingMode;
  }
  try {
    const cached = await redisConnection.get(REDIS_KEYS.onboardingMode);
    if (cached === "SCREEN" || cached === "MOBILE" || cached === "NONE") {
      currentOnboardingMode = cached;
      return cached;
    }
  } catch (err) {
    /* ignore redis read error */
  }
  return currentOnboardingMode;
}

/**
 * Set the current onboarding mode and persist to Redis.
 */
export async function setOnboardingMode(mode: OnboardingMode): Promise<void> {
  currentOnboardingMode = mode;
  try {
    await redisConnection.set(REDIS_KEYS.onboardingMode, mode);
  } catch (err) {
    console.warn("[Hotspot Service] Warning: Could not persist onboarding mode to Redis:", err);
  }
  console.log(`[Hotspot Service] 🎯 Onboarding mode set to: ${mode}`);

  // Automatically reconnect to any known Wi-Fi network when returning to selection
  if (mode === "NONE") {
    setTimeout(async () => {
      try {
        const active = await isHotspotActive();
        if (active) {
          await deactivateHotspot();
        } else {
          await autoReconnectKnownWifi();
        }
      } catch (err) {
        console.warn("[Hotspot Service] Auto-reconnect sweep on mode reset warning:", err);
      }
    }, 200);
  }
}

/**
 * Checks if the "Kiosk-Hotspot" connection profile exists in NetworkManager.
 * If not, creates and configures it idempotently.
 */
export async function ensureHotspotProfile(): Promise<void> {
  try {
    const { stdout } = await runSecureCommand("nmcli", ["-t", "-f", "NAME", "connection", "show"]);
    const profiles = stdout.split("\n").map((p) => p.trim());

    if (!profiles.includes(HOTSPOT_CONFIG.PROFILE_NAME)) {
      console.log(`[Hotspot Service] Creating ${HOTSPOT_CONFIG.PROFILE_NAME} NetworkManager AP profile...`);
      await runSecureCommand("sudo", [
        "nmcli",
        "connection",
        "add",
        "type",
        "wifi",
        "ifname",
        HOTSPOT_CONFIG.INTERFACE,
        "con-name",
        HOTSPOT_CONFIG.PROFILE_NAME,
        "autoconnect",
        "no",
        "ssid",
        HOTSPOT_CONFIG.SSID,
      ]);

      await runSecureCommand("sudo", [
        "nmcli",
        "connection",
        "modify",
        HOTSPOT_CONFIG.PROFILE_NAME,
        "802-11-wireless.mode",
        "ap",
        "802-11-wireless.band",
        "bg",
        "ipv4.addresses",
        HOTSPOT_CONFIG.SUBNET,
        "ipv4.method",
        "shared",
      ]);
      console.log(`[Hotspot Service] ✅ ${HOTSPOT_CONFIG.PROFILE_NAME} profile created and configured.`);
    }
  } catch (err: any) {
    console.error("[Hotspot Service] Error ensuring hotspot profile:", err.message || err);
    throw err;
  }
}

/**
 * Checks if Kiosk-Hotspot is currently active on the system.
 */
export async function isHotspotActive(): Promise<boolean> {
  try {
    const { stdout } = await runSecureCommand("sudo", ["nmcli", "-t", "-f", "NAME", "connection", "show", "--active"]);
    const activeProfiles = stdout.split("\n").map((p) => p.trim());
    return activeProfiles.includes(HOTSPOT_CONFIG.PROFILE_NAME);
  } catch (err) {
    console.warn("[Hotspot Service] Warning: Failed to query active connections:", err);
    return false;
  }
}

/**
 * Activates the Kiosk-Hotspot AP.
 * Idempotent: if already active, sets mode to MOBILE and returns.
 */
export async function activateHotspot(): Promise<void> {
  suspendRecoveryMonitoring();
  await setOnboardingMode("MOBILE");

  const alreadyActive = await isHotspotActive();
  if (alreadyActive) {
    console.log(`[Hotspot Service] ℹ️ ${HOTSPOT_CONFIG.PROFILE_NAME} is already active.`);
    return;
  }

  console.log(`[Hotspot Service] 🚀 Activating ${HOTSPOT_CONFIG.PROFILE_NAME} AP...`);
  await ensureHotspotProfile();

  // Cleanly disconnect any ongoing station connection before bringing up AP
  try {
    await runSecureCommand("sudo", ["nmcli", "device", "disconnect", HOTSPOT_CONFIG.INTERFACE], { timeout: 10000 });
  } catch {
    /* non-fatal if already disconnected */
  }

  // Brief pause for driver settle
  await new Promise((resolve) => setTimeout(resolve, 500));

  await runSecureCommand("sudo", ["nmcli", "connection", "up", HOTSPOT_CONFIG.PROFILE_NAME], { timeout: 30000 });
  console.log(`[Hotspot Service] 📶 ${HOTSPOT_CONFIG.PROFILE_NAME} successfully activated at ${HOTSPOT_CONFIG.IP}`);
}

/**
 * Deactivates the Kiosk-Hotspot AP.
 */
export async function deactivateHotspot(): Promise<void> {
  const active = await isHotspotActive();
  if (!active) {
    console.log(`[Hotspot Service] ℹ️ ${HOTSPOT_CONFIG.PROFILE_NAME} is already inactive.`);
    return;
  }

  console.log(`[Hotspot Service] 🛑 Deactivating ${HOTSPOT_CONFIG.PROFILE_NAME}...`);
  try {
    await runSecureCommand("sudo", ["nmcli", "connection", "down", HOTSPOT_CONFIG.PROFILE_NAME], { timeout: 15000 });
    console.log(`[Hotspot Service] ✅ ${HOTSPOT_CONFIG.PROFILE_NAME} deactivated.`);
  } catch (err: any) {
    console.warn("[Hotspot Service] Warning deactivating hotspot:", err.message || err);
  }

  // Resume recovery monitoring after leaving hotspot
  resumeRecoveryMonitoring();

  // Immediately reconnect to known network in background without waiting for slow NM polling
  setTimeout(() => {
    autoReconnectKnownWifi().catch((e) => console.warn("[Hotspot Service] Auto-reconnect failed:", e));
  }, 300);
}

/**
 * Restores the Hotspot after a provisioning failure during mobile setup.
 * Cleanly resets the wireless interface and brings the AP back up.
 */
export async function restoreHotspotAfterFailure(): Promise<void> {
  console.log("[Hotspot Service] 🔄 Provisioning failed in MOBILE mode. Restoring hotspot AP...");
  suspendRecoveryMonitoring();

  try {
    // Step 1: Force disconnect any hung or failed station attempt
    console.log(`[Hotspot Service] Disconnecting interface ${HOTSPOT_CONFIG.INTERFACE}...`);
    await runSecureCommand("sudo", ["nmcli", "device", "disconnect", HOTSPOT_CONFIG.INTERFACE], { timeout: 10000 });
  } catch (err: any) {
    console.warn("[Hotspot Service] Interface disconnect warning (proceeding):", err.message || err);
  }

  // Step 2: 1-second pause to let the kernel / driver state settle
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Step 3: Bring up the hotspot
  try {
    await runSecureCommand("sudo", ["nmcli", "connection", "up", HOTSPOT_CONFIG.PROFILE_NAME], { timeout: 30000 });
    console.log(`[Hotspot Service] 📶 Hotspot successfully restored after error. Ready for mobile client reconnection.`);
    await setOnboardingMode("MOBILE");
  } catch (err: any) {
    console.error("[Hotspot Service] ❌ Failed to restore hotspot after provisioning error:", err.message || err);
  }
}

/**
 * Returns overall hotspot status.
 */
export async function getHotspotStatus(): Promise<{
  active: boolean;
  ssid: string;
  ip: string;
  mode: OnboardingMode;
}> {
  const active = await isHotspotActive();
  const mode = await getOnboardingMode();
  return {
    active,
    ssid: HOTSPOT_CONFIG.SSID,
    ip: HOTSPOT_CONFIG.IP,
    mode,
  };
}
