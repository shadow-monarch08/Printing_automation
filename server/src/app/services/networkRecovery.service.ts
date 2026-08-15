import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";
import { runSecureCommand } from "../utils/exec";
import { checkInternetConnectivity, getActiveConnectionProfile } from "../utils/network.utils";
import { getSystemConfig } from "./config.db.service";

export type RecoveryState =
  | "ONLINE"
  | "CONNECTIVITY_FAILURE"
  | "GRACE_PERIOD"
  | "HOTSPOT_ACTIVATING"
  | "HOTSPOT_ACTIVE"
  | "RECOVERING";

interface NetworkRecoveryStatus {
  state: RecoveryState;
  hotspotActive: boolean;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastCheckTimestamp: number;
  isSuspended: boolean;
}

let currentState: RecoveryState = "ONLINE";
let consecutiveFailures = 0;
let consecutiveSuccesses = 0;
let isSuspended = false;
let monitorIntervalId: NodeJS.Timeout | null = null;
let isCheckInProgress = false;

const CHECK_INTERVAL_MS = 15000; // 15 seconds
const FAILURE_THRESHOLD = 3;     // 3 consecutive failures -> GRACE_PERIOD
const STABLE_SUCCESS_THRESHOLD = 2; // 2 consecutive successes to disable hotspot

export function isRecoverySuspended(): boolean {
  return isSuspended;
}

export function suspendRecoveryMonitoring(): void {
  console.log("[Network Recovery] ⏸️ Monitoring suspended for deliberate Wi-Fi reconfiguration.");
  isSuspended = true;
}

export function resumeRecoveryMonitoring(): void {
  console.log("[Network Recovery] ▶️ Monitoring resumed after Wi-Fi reconfiguration.");
  isSuspended = false;
  consecutiveFailures = 0;
}

export function getRecoveryStatus(): NetworkRecoveryStatus {
  return {
    state: currentState,
    hotspotActive: currentState === "HOTSPOT_ACTIVE" || currentState === "RECOVERING",
    consecutiveFailures,
    consecutiveSuccesses,
    lastCheckTimestamp: Date.now(),
    isSuspended,
  };
}

async function syncStateWithRedis(): Promise<void> {
  try {
    const status = getRecoveryStatus();
    await redisConnection.set(
      REDIS_KEYS.networkRecoveryState,
      JSON.stringify(status),
      "EX",
      REDIS_TTLS.NETWORK_RECOVERY
    );
  } catch (err) {
    console.warn("[Network Recovery] Failed to sync recovery state to Redis:", err);
  }
}

async function reconcilePhysicalState(): Promise<void> {
  try {
    const activeProfile = await getActiveConnectionProfile();
    const isHotspotPhysicallyActive = activeProfile === "Kiosk-Hotspot";

    if (isHotspotPhysicallyActive && currentState !== "HOTSPOT_ACTIVE" && currentState !== "RECOVERING") {
      console.log("[Network Recovery] ⚠️ Physical Kiosk-Hotspot detected on boot. Reconciling state to HOTSPOT_ACTIVE.");
      currentState = "HOTSPOT_ACTIVE";
    } else if (!isHotspotPhysicallyActive && (currentState === "HOTSPOT_ACTIVE" || currentState === "RECOVERING")) {
      console.log("[Network Recovery] 🔄 Kiosk-Hotspot not physically active. Reconciling state to ONLINE.");
      currentState = "ONLINE";
    }
  } catch (err) {
    console.warn("[Network Recovery] Could not reconcile physical NetworkManager state:", err);
  }
}

async function performConnectivityCheck(): Promise<void> {
  if (isCheckInProgress || isSuspended) return;

  const config = getSystemConfig();
  // Recovery service ONLY operates in production READY state
  if (!config?.isOnboarded || config.provisioningState !== "READY") {
    return;
  }

  isCheckInProgress = true;

  try {
    const isOnline = await checkInternetConnectivity();

    if (isOnline) {
      consecutiveFailures = 0;
      consecutiveSuccesses++;

      if (currentState === "HOTSPOT_ACTIVE" || currentState === "RECOVERING") {
        currentState = "RECOVERING";

        if (consecutiveSuccesses >= STABLE_SUCCESS_THRESHOLD) {
          console.log(`[Network Recovery] 🌐 Stable Internet restored (${consecutiveSuccesses} consecutive checks). Safely deactivating recovery hotspot...`);
          try {
            // Re-activate known Wi-Fi profile if available
            const activeProfile = await getActiveConnectionProfile();
            if (activeProfile === "Kiosk-Hotspot") {
              // Deactivate hotspot
              await runSecureCommand("sudo", ["nmcli", "connection", "down", "Kiosk-Hotspot"]);
            }
          } catch (downErr) {
            console.warn("[Network Recovery] Hotspot deactivation warning:", downErr);
          }

          currentState = "ONLINE";
          consecutiveSuccesses = 0;
          console.log("[Network Recovery] ✅ Recovery hotspot deactivated. System returned to ONLINE.");
        }
      } else {
        currentState = "ONLINE";
      }
    } else {
      // Offline
      consecutiveSuccesses = 0;
      consecutiveFailures++;

      if (currentState === "ONLINE") {
        if (consecutiveFailures >= FAILURE_THRESHOLD) {
          currentState = "GRACE_PERIOD";
          console.log(`[Network Recovery] ⚠️ Consecutive Internet check failures (${consecutiveFailures}/${FAILURE_THRESHOLD}). Entering GRACE_PERIOD.`);
        } else {
          currentState = "CONNECTIVITY_FAILURE";
        }
      } else if (currentState === "GRACE_PERIOD") {
        // Grace period expired with ongoing failure -> Activate Hotspot
        console.log("[Network Recovery] 🚨 Grace period elapsed with continued Internet loss. Activating Emergency Kiosk-Hotspot...");
        currentState = "HOTSPOT_ACTIVATING";

        try {
          // Verify actual physical state before activating
          const activeProfile = await getActiveConnectionProfile();
          if (activeProfile !== "Kiosk-Hotspot") {
            await runSecureCommand("sudo", ["nmcli", "connection", "up", "Kiosk-Hotspot"], { timeout: 30000 });
            console.log("[Network Recovery] 📶 Emergency Kiosk-Hotspot successfully activated.");
          }
          currentState = "HOTSPOT_ACTIVE";
        } catch (hotspotErr) {
          console.error("[Network Recovery] ❌ Failed to activate emergency hotspot:", hotspotErr);
          // Stay in GRACE_PERIOD so it retries with backoff instead of crashing
          currentState = "GRACE_PERIOD";
        }
      } else if (currentState === "HOTSPOT_ACTIVE") {
        // IDEMPOTENT: Hotspot is already active. DO NOTHING.
        // Never repeatedly spawn nmcli commands on every interval.
      }
    }

    await syncStateWithRedis();
  } catch (err) {
    console.error("[Network Recovery] Unexpected error during connectivity sweep:", err);
  } finally {
    isCheckInProgress = false;
  }
}

export function startRecoveryMonitoring(): void {
  if (monitorIntervalId) {
    console.log("[Network Recovery] Monitor loop already running.");
    return;
  }

  console.log("[Network Recovery] 🛡️ Starting continuous Network Recovery daemon...");
  
  // Reconcile physical status at startup
  reconcilePhysicalState().catch(() => {});

  // Initial check after 5 seconds
  setTimeout(() => {
    performConnectivityCheck();
  }, 5000);

  // Periodic monitoring loop
  monitorIntervalId = setInterval(() => {
    performConnectivityCheck();
  }, CHECK_INTERVAL_MS);
}

export function stopRecoveryMonitoring(): void {
  if (monitorIntervalId) {
    clearInterval(monitorIntervalId);
    monitorIntervalId = null;
    console.log("[Network Recovery] Monitor loop stopped.");
  }
}
