import { spawn, ChildProcess } from "child_process";
import { runSecureCommand } from "../utils/exec";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";
import {
  checkInternetConnectivity,
  getActiveConnectionProfile,
  getLocalIpAddress,
  getDeviceState,
  settleWifiRadio,
} from "../utils/network.utils";
import { getSystemConfig } from "./config.db.service";
import { eventBus } from "../utils/eventBus";
import { autoReconnectKnownWifi } from "./wifi.service";
import { activateHotspot, deactivateHotspot } from "./hotspot.service";
import { ensureTunnelOnline } from "./tunnel.service";

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
let hotspotIdleCycles = 0;
let isSuspended = false;
let monitorIntervalId: NodeJS.Timeout | null = null;
let isCheckInProgress = false;
let nmMonitorProcess: ChildProcess | null = null;
let lastLinkDropHandledAt = 0;

const CHECK_INTERVAL_MS = 10000;    // 10 seconds defensive watchdog
const FAILURE_THRESHOLD = 2;        // 2 consecutive L7 WAN failures (20s) -> CONNECTIVITY_FAILURE
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

export async function setRecoveryOnlineImmediately(): Promise<void> {
  console.log("[Network Recovery] ⚡ Setting recovery state synchronously to ONLINE.");
  currentState = "ONLINE";
  consecutiveFailures = 0;
  consecutiveSuccesses = 1;
  isSuspended = false;
  await syncStateWithRedis();
  await emitNetworkStateChanged();
}

export function getRecoveryStatus(): NetworkRecoveryStatus {
  return {
    state: currentState,
    hotspotActive:
      currentState === "HOTSPOT_ACTIVE" ||
      currentState === "RECOVERING" ||
      currentState === "HOTSPOT_ACTIVATING",
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
    const isHotspot =
      currentState === "HOTSPOT_ACTIVE" ||
      currentState === "RECOVERING" ||
      currentState === "HOTSPOT_ACTIVATING";
    const internetOnline = currentState === "ONLINE";

    const localIp = getLocalIpAddress();
    const port = parseInt(process.env.PORT || "3000", 10);
    const localAccessUrl = localIp
      ? `http://${localIp}:${port}/`
      : config?.localAccessUrl || "http://piprint.local:3000/";

    eventBus.emit("kiosk:network:state_changed", {
      state: currentState,
      internetOnline,
      hotspotActive: isHotspot,
      activeProfile: activeProfile || null,
      cloudflareUrl: config?.cloudflareUrl || null,
      localAccessUrl,
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
    if (nextState === "ONLINE") {
      ensureTunnelOnline();
    }
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

async function hasActiveHotspotClients(): Promise<boolean> {
  try {
    const { stdout } = await runSecureCommand("iw", ["dev", "wlan0", "station", "dump"]);
    return stdout.includes("Station ");
  } catch {
    return false;
  }
}

/**
 * Fast L2 Physical Link Drop Handler (< 8s total turnaround).
 * Immediately alerts the HUD and probes visible saved networks before bringing up Emergency Hotspot.
 */
async function handlePhysicalLinkDrop(reason: string = "Physical carrier lost"): Promise<void> {
  const now = Date.now();
  if (now - lastLinkDropHandledAt < 3000) {
    return; // Debounce rapid bursts
  }
  lastLinkDropHandledAt = now;

  if (isSuspended || isCheckInProgress) return;
  if (currentState === "HOTSPOT_ACTIVE" || currentState === "HOTSPOT_ACTIVATING") return;

  const config = getSystemConfig();
  if (!config?.isOnboarded) {
    return;
  }

  console.log(`[Network Recovery] 🚨 Immediate physical link loss detected on wlan0 (${reason})!`);
  isCheckInProgress = true;

  try {
    // 1. Immediately notify HUD of link failure so display updates within milliseconds
    await transitionState("CONNECTIVITY_FAILURE");

    // 2. Fast known profile reconnection probe (using passive scan cache to protect Broadcom SDIO bus)
    console.log("[Network Recovery] 🔍 Fast link recovery: Probing in-range saved networks...");
    await transitionState("ATTEMPTING_SAVED_NETWORKS");
    const reconnected = await autoReconnectKnownWifi();

    if (reconnected) {
      console.log(`[Network Recovery] 📡 Reconnected to "${reconnected}". Verifying Internet access...`);
      const verified = await checkInternetConnectivity();
      if (verified) {
        console.log(`[Network Recovery] ✅ Known network "${reconnected}" restored and verified.`);
        consecutiveFailures = 0;
        await transitionState("ONLINE");
        return;
      }
      console.warn(`[Network Recovery] ⚠️ Associated with "${reconnected}", but WAN ping failed.`);
    }

    // 3. Saved networks unavailable -> Activate Emergency Recovery Hotspot
    console.log("[Network Recovery] 🚨 Saved network recovery unsuccessful. Activating Emergency Kiosk-Hotspot...");
    await transitionState("HOTSPOT_ACTIVATING");

    // Enforce clean interface detachment and Broadcom firmware settling window
    try {
      await runSecureCommand("sudo", ["nmcli", "device", "disconnect", "wlan0"], { timeout: 5000 });
    } catch {}
    await settleWifiRadio("wlan0", 2000);

    await activateHotspot();
    console.log("[Network Recovery] 📶 Emergency Kiosk-Hotspot successfully activated.");
    await transitionState("HOTSPOT_ACTIVE");
  } catch (err) {
    console.error("[Network Recovery] Error during fast link drop recovery:", err);
    await transitionState("ATTEMPTING_SAVED_NETWORKS");
  } finally {
    isCheckInProgress = false;
    await syncStateWithRedis();
  }
}

/**
 * Supervised event-driven NetworkManager monitor (D-Bus listener).
 */
function initNetworkManagerMonitor(): void {
  if (process.platform === "win32") {
    return;
  }

  if (nmMonitorProcess) {
    try {
      nmMonitorProcess.kill();
    } catch {}
    nmMonitorProcess = null;
  }

  try {
    console.log("[Network Recovery] 🛰️ Spawning event-driven NetworkManager monitor (nmcli monitor)...");
    const child = spawn("nmcli", ["monitor"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    nmMonitorProcess = child;

    const handleMonitorOutput = (chunk: Buffer) => {
      const output = chunk.toString();
      const lines = output.split("\n").map((l) => l.trim()).filter(Boolean);

      for (const line of lines) {
        if (
          line.includes("wlan0: disconnected") ||
          line.includes("wlan0: unmanaged") ||
          line.includes("wlan0: unavailable") ||
          line.includes("wlan0: failed") ||
          line.includes("wlan0: deactivating") ||
          (line.includes("wlan0:") && line.includes("-> disconnected")) ||
          (line.includes("wlan0:") && line.includes("-> failed")) ||
          (line.includes("wlan0:") && line.includes("deactivated")) ||
          (line.includes("connectivity is now 'none'") && currentState === "ONLINE")
        ) {
          if (currentState !== "HOTSPOT_ACTIVE" && currentState !== "HOTSPOT_ACTIVATING" && !isSuspended) {
            handlePhysicalLinkDrop(line).catch((err) => {
              console.error("[Network Recovery] Error in link drop handler:", err);
            });
          }
        }
      }
    };

    child.stdout?.on("data", handleMonitorOutput);
    child.stderr?.on("data", handleMonitorOutput);

    child.on("exit", (code) => {
      nmMonitorProcess = null;
      console.warn(`[Network Recovery] nmcli monitor exited with code ${code}. Auto-restarting in 5s...`);
      setTimeout(() => {
        if (monitorIntervalId) {
          initNetworkManagerMonitor();
        }
      }, 5000);
    });

    child.on("error", (err) => {
      console.warn("[Network Recovery] nmcli monitor process error:", err.message || err);
    });
  } catch (err: any) {
    console.warn("[Network Recovery] Could not spawn nmcli monitor:", err.message || err);
  }
}

/**
 * Defensive Periodic Watchdog (Runs every 10 seconds).
 */
async function performConnectivityCheck(): Promise<void> {
  if (isCheckInProgress || isSuspended) return;

  const config = getSystemConfig();
  if (!config?.isOnboarded) {
    return;
  }

  isCheckInProgress = true;

  try {
    // 1. Physical Device & Profile Link Check
    const activeProfile = await getActiveConnectionProfile();
    const devState = await getDeviceState("wlan0");
    const isWlanConnected = Boolean(activeProfile && devState?.state === "connected");

    // Fast-path: If in ONLINE state but physical wlan0 is disconnected, trigger link drop immediately!
    if (currentState === "ONLINE" && !isWlanConnected && activeProfile !== "Kiosk-Hotspot") {
      isCheckInProgress = false;
      await handlePhysicalLinkDrop("Watchdog detected disconnected interface");
      return;
    }

    // 2. WAN connectivity probe
    const isOnline = await checkInternetConnectivity();

    if (isOnline) {
      consecutiveFailures = 0;
      consecutiveSuccesses++;

      if (currentState === "HOTSPOT_ACTIVE" || currentState === "RECOVERING") {
        await transitionState("RECOVERING");

        if (consecutiveSuccesses >= STABLE_SUCCESS_THRESHOLD) {
          console.log(`[Network Recovery] 🌐 Stable Internet restored (${consecutiveSuccesses} consecutive checks). Safely deactivating recovery hotspot...`);
          try {
            await deactivateHotspot({ triggerAutoReconnect: false });
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
        // If physical link is already gone, trigger recovery immediately
        if (!isWlanConnected) {
          isCheckInProgress = false;
          await handlePhysicalLinkDrop("Physical link absent during offline check");
          return;
        }

        // L7 WAN outage (interface connected to router, but external ping failing)
        if (consecutiveFailures >= FAILURE_THRESHOLD) {
          console.log(`[Network Recovery] ⚠️ L7 WAN checks failing (${consecutiveFailures}/${FAILURE_THRESHOLD}). Transitioning to CONNECTIVITY_FAILURE.`);
          await transitionState("CONNECTIVITY_FAILURE");
        }
      } else if (currentState === "ATTEMPTING_SAVED_NETWORKS") {
        await transitionState("HOTSPOT_ACTIVATING");
        try {
          await activateHotspot();
          console.log("[Network Recovery] 📶 Emergency Kiosk-Hotspot successfully activated.");
          await transitionState("HOTSPOT_ACTIVE");
        } catch (hotspotErr) {
          console.error("[Network Recovery] ❌ Failed to activate emergency hotspot:", hotspotErr);
        }
      } else if (currentState === "HOTSPOT_ACTIVE") {
        const hasClients = await hasActiveHotspotClients();
        if (hasClients) {
          hotspotIdleCycles = 0;
        } else {
          hotspotIdleCycles++;
          // Probe every 60s (6 checks * 10s) when no clients are using the emergency hotspot
          if (hotspotIdleCycles >= 6) {
            hotspotIdleCycles = 0;
            console.log("[Network Recovery] 🔍 Hotspot idle (no clients connected for 60s). Temporarily pausing hotspot to probe for known saved networks...");
            try {
              // Pause hotspot safely
              await deactivateHotspot({ triggerAutoReconnect: false });
              await settleWifiRadio("wlan0", 3000);

              const reconnectedProfile = await autoReconnectKnownWifi();
              if (reconnectedProfile) {
                const verified = await checkInternetConnectivity();
                if (verified) {
                  console.log(`[Network Recovery] ✅ Known network "${reconnectedProfile}" restored and verified.`);
                  consecutiveFailures = 0;
                  await transitionState("ONLINE");
                  return;
                }
              }
              // Not restored -> immediately restore recovery hotspot
              console.log("[Network Recovery] ⚠️ Known networks unavailable. Restoring emergency recovery hotspot...");
              await activateHotspot();
            } catch (probeErr) {
              console.warn("[Network Recovery] Idle probe warning:", probeErr);
              try {
                await activateHotspot();
              } catch (restoreErr) {
                console.error("[Network Recovery] ❌ Failed to restore hotspot after probe error:", restoreErr);
              }
            }
          }
        }
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

  // 1. Reconcile physical status at startup
  reconcilePhysicalState().catch(() => {});

  // 2. Initialize real-time event-driven link monitor
  initNetworkManagerMonitor();

  // 3. Initial check after 3 seconds
  setTimeout(() => {
    performConnectivityCheck();
  }, 3000);

  // 4. Periodic defensive watchdog
  monitorIntervalId = setInterval(() => {
    performConnectivityCheck();
  }, CHECK_INTERVAL_MS);
}

export function stopRecoveryMonitoring(): void {
  if (monitorIntervalId) {
    clearInterval(monitorIntervalId);
    monitorIntervalId = null;
    console.log("[Network Recovery] Watchdog loop stopped.");
  }
  if (nmMonitorProcess) {
    try {
      nmMonitorProcess.kill();
    } catch {}
    nmMonitorProcess = null;
    console.log("[Network Recovery] nmcli monitor stopped.");
  }
}
