import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";
import { runSecureCommand } from "../utils/exec";
import { checkInternetConnectivity, getActiveConnectionProfile } from "../utils/network.utils";
import { getSystemConfig } from "./config.db.service";
import { eventBus } from "../utils/eventBus";
import { autoReconnectKnownWifi } from "./wifi.service";

export type RecoveryState =
  | "ONLINE"
  | "CONNECTIVITY_FAILURE"
  | "ATTEMPTING_SAVED_NETWORKS"
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
const FAILURE_THRESHOLD = 3;     // 3 consecutive failures (45s) -> ATTEMPTING_SAVED_NETWORKS
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
    hotspotActive: currentState === "HOTSPOT_ACTIVE" || currentState === "RECOVERING" || currentState === "HOTSPOT_ACTIVATING",
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

async function emitNetworkStateChanged(): Promise<void> {
  try {
    const config = getSystemConfig();
    const activeProfile = await getActiveConnectionProfile();
    const isHotspot = currentState === "HOTSPOT_ACTIVE" || currentState === "RECOVERING" || currentState === "HOTSPOT_ACTIVATING";
    const internetOnline = currentState === "ONLINE";

    eventBus.emit("kiosk:network:state_changed", {
      state: currentState,
      internetOnline,
      hotspotActive: isHotspot,
      activeProfile: activeProfile || null,
      cloudflareUrl: config?.cloudflareUrl || null,
      localAccessUrl: config?.localAccessUrl || "http://piprint.local:3000/",
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn("[Network Recovery] Failed to emit network state changed event:", err);
  }
}

async function transitionState(nextState: RecoveryState): Promise<void> {
  if (currentState !== nextState) {
    console.log(`[Network Recovery] State transition: ${currentState} -> ${nextState}`);
    currentState = nextState;
    await syncStateWithRedis();
    await emitNetworkStateChanged();
  }
}

async function reconcilePhysicalState(): Promise<void> {
  try {
    const activeProfile = await getActiveConnectionProfile();
    const isHotspotPhysicallyActive = activeProfile === "Kiosk-Hotspot";

    if (isHotspotPhysicallyActive && currentState !== "HOTSPOT_ACTIVE" && currentState !== "RECOVERING") {
      console.log("[Network Recovery] ⚠️ Physical Kiosk-Hotspot detected on boot. Reconciling state to HOTSPOT_ACTIVE.");
      await transitionState("HOTSPOT_ACTIVE");
    } else if (!isHotspotPhysicallyActive && (currentState === "HOTSPOT_ACTIVE" || currentState === "RECOVERING")) {
      console.log("[Network Recovery] 🔄 Kiosk-Hotspot not physically active. Reconciling state to ONLINE.");
      await transitionState("ONLINE");
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
        await transitionState("RECOVERING");

        if (consecutiveSuccesses >= STABLE_SUCCESS_THRESHOLD) {
          console.log(`[Network Recovery] 🌐 Stable Internet restored (${consecutiveSuccesses} consecutive checks). Safely deactivating recovery hotspot...`);
          try {
            const activeProfile = await getActiveConnectionProfile();
            if (activeProfile === "Kiosk-Hotspot") {
              await runSecureCommand("sudo", ["nmcli", "connection", "down", "Kiosk-Hotspot"]);
            }
          } catch (downErr) {
            console.warn("[Network Recovery] Hotspot deactivation warning:", downErr);
          }

          consecutiveSuccesses = 0;
          await transitionState("ONLINE");
          console.log("[Network Recovery] ✅ Recovery hotspot deactivated. System returned to ONLINE.");
        }
      } else {
        await transitionState("ONLINE");
      }
    } else {
      // Offline
      consecutiveSuccesses = 0;
      consecutiveFailures++;

      if (currentState === "ONLINE") {
        if (consecutiveFailures >= FAILURE_THRESHOLD) {
          console.log(`[Network Recovery] ⚠️ Internet check failures (${consecutiveFailures}/${FAILURE_THRESHOLD}). Entering ATTEMPTING_SAVED_NETWORKS.`);
          await transitionState("ATTEMPTING_SAVED_NETWORKS");

          let reconnectedProfile: string | null = null;
          try {
            reconnectedProfile = await autoReconnectKnownWifi();
          } catch (autoErr) {
            console.warn("[Network Recovery] autoReconnectKnownWifi warning:", autoErr);
          }

          if (reconnectedProfile) {
            console.log(`[Network Recovery] 📡 Reconnected to saved network "${reconnectedProfile}". Verifying Internet...`);
            const verified = await checkInternetConnectivity();
            if (verified) {
              console.log(`[Network Recovery] ✅ Internet verified on saved network "${reconnectedProfile}". Returning to ONLINE.`);
              consecutiveFailures = 0;
              await transitionState("ONLINE");
              return;
            }
            console.warn(`[Network Recovery] ⚠️ Associated with "${reconnectedProfile}", but WAN check failed.`);
          } else {
            console.log("[Network Recovery] ℹ️ No connectable saved Wi-Fi networks found.");
          }

          // No saved network succeeded -> Activate Emergency Hotspot
          console.log("[Network Recovery] 🚨 Saved network recovery unsuccessful. Activating Emergency Kiosk-Hotspot...");
          await transitionState("HOTSPOT_ACTIVATING");
          try {
            const activeProfile = await getActiveConnectionProfile();
            if (activeProfile !== "Kiosk-Hotspot") {
              await runSecureCommand("sudo", ["nmcli", "connection", "up", "Kiosk-Hotspot"], { timeout: 30000 });
              console.log("[Network Recovery] 📶 Emergency Kiosk-Hotspot successfully activated.");
            }
            await transitionState("HOTSPOT_ACTIVE");
          } catch (hotspotErr) {
            console.error("[Network Recovery] ❌ Failed to activate emergency hotspot:", hotspotErr);
            // Revert to ATTEMPTING_SAVED_NETWORKS so next interval can retry without hard failing
            await transitionState("ATTEMPTING_SAVED_NETWORKS");
          }
        } else {
          await transitionState("CONNECTIVITY_FAILURE");
        }
      } else if (currentState === "ATTEMPTING_SAVED_NETWORKS") {
        await transitionState("HOTSPOT_ACTIVATING");
        try {
          const activeProfile = await getActiveConnectionProfile();
          if (activeProfile !== "Kiosk-Hotspot") {
            await runSecureCommand("sudo", ["nmcli", "connection", "up", "Kiosk-Hotspot"], { timeout: 30000 });
          }
          await transitionState("HOTSPOT_ACTIVE");
        } catch (hotspotErr) {
          console.error("[Network Recovery] ❌ Failed to activate emergency hotspot:", hotspotErr);
        }
      } else if (currentState === "HOTSPOT_ACTIVE") {
        // Hotspot is active. Simple & robust: no disruptive background frequency scanning.
        // Waiting for admin Wi-Fi onboarding or Ethernet attachment.
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
