import { systemCommands } from "../../commands/system.commands";
import { runSecureCommand } from "../utils/exec";
import { WiFiNetwork } from "../types";
import { ValidationError, HardwareError } from "../utils/errors";
import { suspendRecoveryMonitoring, resumeRecoveryMonitoring } from "./networkRecovery.service";
import { getActiveConnectionProfile, verifyInternetReadiness, settleWifiRadio } from "../utils/network.utils";
import { eventBus } from "../utils/eventBus";
import { stopQuickTunnel, waitForTunnelPromise } from "./tunnel.service";
import { updateSystemConfig, getSystemConfig } from "./config.db.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS } from "../../infrastructure/redisKeys";
import db from "../../infrastructure/database";

export async function scanNetworks(): Promise<WiFiNetwork[]> {
  try {
    // 1. Trigger Wi-Fi frequency rescan (catch throttling gracefully)
    try {
      await systemCommands.rescanWifi();
    } catch (rescanError: any) {
      console.warn("[WiFi Service] Rescan throttled or non-fatal warning:", rescanError.message || rescanError);
    }

    // 2. Fetch live scan results (with security flags)
    const { stdout } = await systemCommands.getWifiStatus();

    // 3. Fetch saved networks list with UUIDs and true 802-11-wireless.ssid
    const savedProfilesMap = new Map<string, { name: string; uuid: string }>();
    try {
      const savedRes = await systemCommands.getSavedNetworks();
      const rawLines = savedRes.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
      const wirelessProfiles: Array<{ name: string; uuid: string }> = [];

      for (const line of rawLines) {
        const parts = line.split(":");
        if (parts.length >= 3) {
          const name = parts[0];
          const uuid = parts[1];
          const type = parts[2];
          if (type === "802-11-wireless" && name !== "Kiosk-Hotspot") {
            wirelessProfiles.push({ name, uuid });
          }
        }
      }

      // Query true SSIDs in parallel
      await Promise.all(
        wirelessProfiles.map(async (prof) => {
          try {
            const { stdout: ssidOut } = await systemCommands.getConnectionSsid(prof.uuid);
            const actualSsid = ssidOut.trim();
            if (actualSsid) {
              savedProfilesMap.set(actualSsid, prof);
            }
          } catch {
            const fallbackSsid = prof.name.replace(/^netplan-wlan0-/, "");
            savedProfilesMap.set(fallbackSsid, prof);
          }
        })
      );
    } catch (err) {
      console.warn("[WiFi Service] Failed to get saved networks:", err);
    }

    const lines = stdout.split("\n");
    const networksMap = new Map<string, WiFiNetwork>();

    for (const line of lines) {
      if (!line.trim()) continue;

      // In NetworkManager terse mode (-t), colons are escaped as "\:". Split only on unescaped colons.
      const parts = line.split(/(?<!\\):/);
      if (parts.length < 5) continue;

      const inUse = parts[0].trim();
      const rawSsid = parts[1].replace(/\\:/g, ":").trim();
      const signal = parseInt(parts[3].trim(), 10) || 0;
      const rawSecurity = parts[4].replace(/\\:/g, ":").trim();

      if (!rawSsid || rawSsid === "--") continue;

      const isActive = inUse === "*";
      const isSecured = Boolean(rawSecurity && rawSecurity !== "--");
      const securityType = isSecured ? rawSecurity : "OPEN";

      const savedMatch = savedProfilesMap.get(rawSsid);
      const isSaved = !!savedMatch;
      const profileName = savedMatch?.name || undefined;
      const uuid = savedMatch?.uuid || undefined;

      const existing = networksMap.get(rawSsid);
      if (!existing) {
        networksMap.set(rawSsid, {
          ssid: rawSsid,
          signal,
          isActive,
          isSaved,
          profileName,
          uuid,
          isSecured,
          securityType,
        });
      } else {
        // Keep highest signal for duplicate BSSIDs (e.g. mesh or dual-band APs)
        if (signal > existing.signal) {
          existing.signal = signal;
        }
        if (isActive) {
          existing.isActive = true;
        }
        if (isSaved) {
          existing.isSaved = true;
          existing.profileName = profileName;
          existing.uuid = uuid;
        }
      }
    }

    const result = Array.from(networksMap.values());

    return result.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      if (a.isSaved && !b.isSaved) return -1;
      if (!a.isSaved && b.isSaved) return 1;
      return b.signal - a.signal;
    });
  } catch (error) {
    console.error("[WiFi Service] Scan failed:", error);
    return [];
  }
}

export function parseDetailedWifiError(
  rawMsg: string,
  targetName: string,
  isSaved?: boolean
): { code: string; message: string; aliasCode?: string } {
  if (!rawMsg) {
    return {
      code: "WIFI_CONNECTION_FAILED",
      message: `Wi-Fi connection to "${targetName}" failed.`,
    };
  }

  const clean = rawMsg.replace(/^Command failed:\s*sudo\s*nmcli\s*/i, "").trim();

  // 1. Saved Profile Credentials Expired or Inaccessible
  if (
    isSaved &&
    (clean.includes("Secrets were required") ||
      clean.includes("no-secrets") ||
      clean.includes("bad-secrets"))
  ) {
    return {
      code: "WIFI_SAVED_PROFILE_EXPIRED",
      aliasCode: "WIFI_AUTH_FAILED",
      message: `Saved Wi-Fi credentials for "${targetName}" have expired or changed. Please re-enter the password.`,
    };
  }

  // 2. Password / Authentication / Key Handshake Failure
  if (
    clean.includes("Secrets were required") ||
    clean.includes("no-secrets") ||
    clean.includes("bad-secrets") ||
    clean.includes("802-11-wireless-security.psk: invalid") ||
    clean.includes("802-11-wireless-security.psk: property is invalid") ||
    clean.includes("not authorized") ||
    clean.includes("authentication failed") ||
    clean.includes("wrong-password") ||
    clean.includes("4-Way Handshake failed") ||
    clean.includes("pre-shared key may be incorrect") ||
    clean.includes("password is invalid") ||
    clean.includes("pre-shared key is invalid")
  ) {
    return {
      code: "WIFI_AUTH_FAILED",
      message: `Invalid Wi-Fi Passphrase for "${targetName}". Please verify security key.`,
    };
  }

  // 3. Network Not Found / Out of Range
  if (
    clean.includes("No network with SSID") ||
    clean.includes("No Wi-Fi network found") ||
    clean.includes("not found") ||
    clean.includes("ssid-not-found") ||
    clean.includes("could not be found") ||
    clean.includes("device not found for connection")
  ) {
    return {
      code: "WIFI_NETWORK_NOT_FOUND",
      aliasCode: "SSID_NOT_FOUND",
      message: `Network "${targetName}" is out of range or not broadcasting.`,
    };
  }

  // 4. Radio Hardware Disabled / Blocked
  if (
    clean.includes("Networking is disabled") ||
    clean.includes("Wi-Fi is disabled") ||
    clean.includes("wireless is disabled") ||
    clean.includes("device is not available") ||
    clean.includes("radio is turned off") ||
    clean.includes("soft blocked") ||
    clean.includes("hard blocked") ||
    clean.includes("device not managed")
  ) {
    return {
      code: "WIFI_RADIO_BLOCKED",
      message: `Wi-Fi wireless radio is disabled or blocked on device.`,
    };
  }

  // 5. Radio Transition / Base Connection Interrupted
  if (
    clean.includes("The base network connection was interrupted") ||
    clean.includes("connection-interrupted") ||
    clean.includes("device was disconnected")
  ) {
    return {
      code: "WIFI_INTERRUPTED",
      message: `Wireless radio was interrupted during mode transition. Please retry association.`,
    };
  }

  // 6. DHCP Lease Acquisition Failure
  if (
    clean.includes("no lease") ||
    clean.includes("IP configuration could not be reserved") ||
    clean.includes("ip-config-unavailable") ||
    clean.includes("dhcp") ||
    clean.includes("dhcp4")
  ) {
    return {
      code: "WIFI_DHCP_FAILED",
      aliasCode: "DHCP_TIMEOUT",
      message: `Connected to "${targetName}", but failed to acquire an IP address from router DHCP.`,
    };
  }

  // 7. Association / Handshake / Supplicant Timeout
  if (
    clean.includes("Association took too long") ||
    clean.includes("association took too long") ||
    clean.includes("supplicant-timeout") ||
    clean.includes("supplicant failed to connect") ||
    clean.includes("timed out") ||
    clean.includes("Command timed out") ||
    clean.includes("Activation timed out")
  ) {
    return {
      code: "WIFI_TIMEOUT",
      message: `Connection to "${targetName}" timed out. Signal may be weak or router unresponsive.`,
    };
  }

  // 8. Fallback clean error
  return {
    code: "WIFI_CONNECTION_FAILED",
    message: clean || `Wi-Fi connection to "${targetName}" failed.`,
  };
}

export function formatCleanWifiError(rawMsg: string, targetName?: string, isSaved?: boolean): string {
  return parseDetailedWifiError(rawMsg, targetName || "network", isSaved).message;
}

export async function connectToWifi(
  ssid?: string,
  password?: string,
  profileName?: string,
  isSaved?: boolean,
  uuid?: string
): Promise<void> {
  suspendRecoveryMonitoring();

  try {
    const targetSsid = ssid || profileName;
    if (!targetSsid && !uuid) {
      throw new ValidationError("VALIDATION_SSID_REQUIRED", "Wi-Fi SSID or UUID is required.");
    }

    // 1. Ensure Wi-Fi radio is physically powered on and settled
    try {
      await runSecureCommand("sudo", ["nmcli", "radio", "wifi", "on"], { timeout: 5000 });
    } catch {
      /* non-fatal */
    }
    await settleWifiRadio("wlan0", 3000);

    // 2. If connecting to a SAVED profile without a new password:
    if ((uuid || isSaved || profileName) && !password) {
      const targetArgs = uuid ? ["uuid", uuid] : [profileName || targetSsid!];
      const displayName = profileName || targetSsid || uuid || "saved-profile";
      console.log(`[WiFi Service] Activating existing saved profile "${displayName}" (Target: ${uuid ? `uuid ${uuid}` : displayName})...`);
      try {
        await runSecureCommand("sudo", ["nmcli", "connection", "up", ...targetArgs], { timeout: 60000 });
        console.log(`[WiFi Service] Successfully connected to saved profile "${displayName}".`);
        return;
      } catch (firstErr: any) {
        console.warn(`[WiFi Service] First activation attempt for "${displayName}" failed. Settling radio and retrying...`);
        await settleWifiRadio("wlan0", 3000);
        try {
          await runSecureCommand("sudo", ["nmcli", "connection", "up", ...targetArgs], { timeout: 60000 });
          console.log(`[WiFi Service] Successfully connected to saved profile "${displayName}" on retry.`);
          return;
        } catch (retryErr: any) {
          const rawMsg = retryErr?.message || String(retryErr);
          console.error(`[WiFi Service] Failed to activate saved profile "${displayName}" after retry:`, rawMsg);
          const { code, message } = parseDetailedWifiError(rawMsg, displayName, true);
          throw new HardwareError(code, message);
        }
      }
    }

    // 3. Clean up any stale or duplicate profiles for this SSID to prevent conflict
    try {
      const { stdout } = await runSecureCommand("nmcli", ["-t", "-f", "NAME,UUID", "connection", "show"], { timeout: 10000 });
      const lines = stdout.split("\n").filter(Boolean);
      for (const line of lines) {
        const [cName, cUuid] = line.split(":");
        if ((cName === targetSsid || cName === `netplan-wlan0-${targetSsid}`) && cUuid) {
          console.log(`[WiFi Service] Deleting stale profile "${cName}" (${cUuid})...`);
          await runSecureCommand("sudo", ["nmcli", "connection", "delete", "uuid", cUuid], { timeout: 10000 });
        }
      }
    } catch (e) {
      /* non-fatal cleanup error */
    }

    // 4. Atomic association using NetworkManager native `nmcli device wifi connect`
    // Auto-negotiates WPA2-PSK, WPA3-SAE, or Open security and writes a clean system connection profile.
    if (!targetSsid) {
      throw new ValidationError("VALIDATION_SSID_REQUIRED", "Wi-Fi SSID is required for device association.");
    }
    console.log(`[WiFi Service] Associating with "${targetSsid}" via atomic device wifi connect...`);
    const connectArgs: string[] = ["nmcli", "device", "wifi", "connect", targetSsid];
    if (password && password.trim().length > 0) {
      connectArgs.push("password", password.trim());
    }

    // Explicit 60s timeout for scanning, handshake, and DHCP lease
    await runSecureCommand("sudo", connectArgs, { timeout: 60000 });
    console.log(`[WiFi Service] Successfully associated with "${targetSsid}".`);

  } catch (rawErr: any) {
    if (rawErr instanceof ValidationError || rawErr instanceof HardwareError) {
      throw rawErr;
    }
    const rawMsg = rawErr?.message || String(rawErr);
    console.error(`[WiFi Service] Connection attempt to "${ssid || profileName}" failed:`, rawMsg);

    const { code, message } = parseDetailedWifiError(rawMsg, ssid || profileName || "network", Boolean(isSaved || uuid));
    throw new HardwareError(code, message);
  } finally {
    resumeRecoveryMonitoring();
  }
}

/**
 * Immediately reconnects to any available saved Wi-Fi network without
 * waiting for NetworkManager's slow periodic background scan.
 */
export async function autoReconnectKnownWifi(): Promise<string | null> {
  console.log("[WiFi Service] 🔄 Triggering immediate auto-reconnect to known Wi-Fi network...");
  try {
    // 1. Ensure radio is powered on
    try {
      await runSecureCommand("sudo", ["nmcli", "radio", "wifi", "on"], { timeout: 5000 });
    } catch {}

    // 2. Fetch saved Wi-Fi connection profiles from NetworkManager with UUID
    const { stdout: connsOut } = await runSecureCommand("nmcli", ["-t", "-f", "NAME,UUID,TYPE", "connection", "show"]);
    const savedProfiles = connsOut
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && (l.includes(":802-11-wireless") || l.includes(":wifi")))
      .map((l) => {
        const [name, uuid] = l.split(":");
        return { name, uuid };
      })
      .filter((p) => p.name && p.name !== "Kiosk-Hotspot");

    if (savedProfiles.length === 0) {
      console.log("[WiFi Service] ℹ️ Zero saved Wi-Fi profiles found. No networks to auto-reconnect.");
      return null;
    }

    // 3. Fast visible beacon scan: check which SSIDs are broadcasting in the air right now
    let visibleSsids = new Set<string>();
    try {
      const { stdout: scanOut } = await runSecureCommand("nmcli", ["-t", "-f", "SSID", "device", "wifi", "list"], { timeout: 8000 });
      visibleSsids = new Set(scanOut.split("\n").map((s) => s.trim()).filter(Boolean));
    } catch {
      /* non-fatal: if scan fails, fall back to checking device connect */
    }

    // 4. Resolve the real SSIDs for saved profiles and match only against visible beacons
    const candidateProfiles: { name: string; uuid: string; ssid: string }[] = [];
    for (const prof of savedProfiles) {
      try {
        const { stdout: ssidOut } = await runSecureCommand("nmcli", ["-g", "802-11-wireless.ssid", "connection", "show", prof.uuid], { timeout: 3000 });
        const realSsid = ssidOut.trim() || prof.name.replace(/^netplan-wlan0-/, "");
        // If visible scan returned results, only consider profiles that are actually visible in the air!
        if (visibleSsids.size === 0 || visibleSsids.has(realSsid)) {
          candidateProfiles.push({ name: prof.name, uuid: prof.uuid, ssid: realSsid });
        }
      } catch {
        candidateProfiles.push({ name: prof.name, uuid: prof.uuid, ssid: prof.name });
      }
    }

    if (visibleSsids.size > 0 && candidateProfiles.length === 0) {
      console.log(`[WiFi Service] ℹ️ None of the ${savedProfiles.length} saved profiles are broadcasting in the air. Bypassing ghost connection loop.`);
      return null;
    }

    console.log(`[WiFi Service] Found ${candidateProfiles.length} connectable saved profile(s) in range:`, candidateProfiles.map((c) => c.ssid));

    // 5. Try immediate device connection on wlan0 first
    try {
      console.log("[WiFi Service] Triggering immediate device connection on wlan0...");
      await runSecureCommand("sudo", ["nmcli", "device", "connect", "wlan0"], { timeout: 15000 });
      const active = await getActiveConnectionProfile();
      if (active && active !== "Kiosk-Hotspot") {
        console.log(`[WiFi Service] ✅ Immediate device connection successful: "${active}"`);
        return active;
      }
    } catch (devErr) {
      console.warn("[WiFi Service] Immediate device connect attempt warning:", devErr);
    }

    // 6. Connect to visible candidate profiles targeting UUID
    for (const cand of candidateProfiles) {
      try {
        console.log(`[WiFi Service] Activating in-range saved profile "${cand.ssid}" (UUID: ${cand.uuid})...`);
        await runSecureCommand("sudo", ["nmcli", "connection", "up", "uuid", cand.uuid], { timeout: 20000 });
        console.log(`[WiFi Service] ✅ Successfully reconnected to saved network "${cand.ssid}"!`);
        return cand.ssid;
      } catch (profErr: any) {
        console.warn(`[WiFi Service] Connection attempt to "${cand.ssid}" failed:`, profErr?.message || profErr);
      }
    }
  } catch (err) {
    console.error("[WiFi Service] Error during auto-reconnect sweep:", err);
  }
  return null;
}

/**
 * Industrial Event-Driven Wi-Fi Reconfiguration Pipeline
 * Orchestrates connection, WAN verification, Cloudflare Quick Tunnel re-spawn,
 * and loopback EventBus status broadcasts to the physical Kiosk display.
 */
export async function reconfigureWifiPipeline(
  ssid?: string,
  password?: string,
  profileName?: string,
  isSaved?: boolean,
  uuid?: string
): Promise<void> {
  const targetNetwork = ssid || profileName || uuid;
  if (!targetNetwork) {
    throw new ValidationError("VALIDATION_SSID_REQUIRED", "Wi-Fi SSID is required.");
  }

  const port = parseInt(process.env.PORT || "3000", 10);
  const config = getSystemConfig();
  const shopName = config?.shopName || "Modern Press";

  // Pause recovery monitoring to prevent race conditions during association
  suspendRecoveryMonitoring();

  try {
    // =========================================================================
    // Phase 1 (01/04): Radio Cycling & Physical Association (25%)
    // =========================================================================
    console.log(`[WiFi Service] Pipeline Phase 1: Associating radio with "${targetNetwork}"...`);
    eventBus.emit("kiosk:onboarding:status", {
      status: "connecting",
      phase: "CYCLING_RADIO_HARDWARE",
      step: 1,
      totalSteps: 4,
      progressPercent: 25,
      message: `Cycling wireless interface to associate with [${targetNetwork}]...`,
      ssid: targetNetwork,
      shopName,
      timestamp: Date.now(),
    });

    await connectToWifi(ssid, password, profileName, isSaved, uuid);
    console.log(`[WiFi Service] Pipeline Phase 1 complete: Associated with "${targetNetwork}".`);

    // =========================================================================
    // Phase 2 (02/04): Negotiating WAN DHCP & Gateway Trace (55%)
    // =========================================================================
    console.log(`[WiFi Service] Pipeline Phase 2: Verifying WAN & DNS readiness...`);
    eventBus.emit("kiosk:onboarding:status", {
      status: "verifying_internet",
      phase: "NEGOTIATING_WAN_DHCP_LEASE",
      step: 2,
      totalSteps: 4,
      progressPercent: 55,
      message: "Validating WAN IP address lease, gateway negotiation & DNS resolution...",
      ssid: targetNetwork,
      shopName,
      timestamp: Date.now(),
    });

    let hasInternet = false;
    try {
      await verifyInternetReadiness(8, 2000);
      hasInternet = true;
      console.log(`[WiFi Service] Pipeline Phase 2 complete: WAN access confirmed.`);
    } catch (netErr) {
      console.warn(`[WiFi Service] WAN verification warning:`, netErr);
      // Non-fatal if local-only LAN, but noted
    }

    // =========================================================================
    // Phase 3 (03/04): Cloudflare Quick Tunnel Re-initiation (85%)
    // =========================================================================
    let liveTunnelUrl: string | null = config?.cloudflareUrl || null;
    if (hasInternet) {
      console.log(`[WiFi Service] Pipeline Phase 3: Spawning Cloudflare Quick Tunnel edge endpoint...`);
      eventBus.emit("kiosk:onboarding:status", {
        status: "starting_tunnel",
        phase: "SPAWNING_CLOUDFLARE_EDGE_TUNNEL",
        step: 3,
        totalSteps: 4,
        progressPercent: 85,
        message: "Provisioning encrypted Cloudflare Quick Tunnel edge endpoint...",
        ssid: targetNetwork,
        shopName,
        timestamp: Date.now(),
      });

      try {
        stopQuickTunnel();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        liveTunnelUrl = await waitForTunnelPromise(port, 25000);
        console.log(`[WiFi Service] Pipeline Phase 3 complete: Live Cloudflare URL: ${liveTunnelUrl}`);
        updateSystemConfig({ cloudflareUrl: liveTunnelUrl });
      } catch (tunnelErr: any) {
        console.warn(`[WiFi Service] Cloudflare Quick Tunnel warning:`, tunnelErr?.message || tunnelErr);
      }
    }

    // =========================================================================
    // Phase 4 (04/04): State Reconciliation & Completion (100%)
    // =========================================================================
    const activeProfile = (await getActiveConnectionProfile()) || targetNetwork;
    let printerCount = 0;
    try {
      const printerRow = db.prepare("SELECT COUNT(*) as count FROM printers WHERE is_quarantined = 0").get() as { count: number } | undefined;
      printerCount = printerRow?.count || 0;
    } catch {
      printerCount = 0;
    }

    // Sync Redis status for any subsequent polling
    await redisConnection.set(
      REDIS_KEYS.wifiConnectionStatus,
      JSON.stringify({ status: "success", ssid: activeProfile, timestamp: Date.now() }),
      "EX",
      120
    );

    // Emit Completion to Kiosk Display (switches to OPERATIONAL)
    eventBus.emit("kiosk:onboarding:done", {
      cloudflareUrl: liveTunnelUrl || "",
      localAccessUrl: config?.localAccessUrl || "http://piprint.local:3000/",
      printerCount,
      nmsDeviceId: config?.nmsDeviceId || null,
      shopName,
      timestamp: Date.now(),
    });

    // Emit live network state changed so HUD activeProfile updates immediately
    eventBus.emit("kiosk:network:state_changed", {
      state: "ONLINE",
      internetOnline: hasInternet,
      hotspotActive: false,
      activeProfile,
      cloudflareUrl: liveTunnelUrl,
      localAccessUrl: config?.localAccessUrl || "http://piprint.local:3000/",
      timestamp: Date.now(),
    });

    // Emit Admin event for remote dashboard
    eventBus.emit("admin:network:status", {
      activeProfile,
      internetOnline: hasInternet,
      timestamp: Date.now(),
    });

    console.log(`[WiFi Service] ✅ Reconfiguration pipeline completed successfully for "${activeProfile}".`);
  } catch (rawErr: any) {
    const rawMsg = rawErr?.message || String(rawErr);
    console.error(`[WiFi Service] ❌ Pipeline failed for "${targetNetwork}":`, rawMsg);

    const { code, message, aliasCode } = parseDetailedWifiError(rawMsg, targetNetwork, Boolean(isSaved || uuid));

    // Write failure to Redis
    await redisConnection.set(
      REDIS_KEYS.wifiConnectionStatus,
      JSON.stringify({ status: "failed", code, aliasCode, error: message, timestamp: Date.now() }),
      "EX",
      120
    );

    // Emit error event to Kiosk Display
    eventBus.emit("kiosk:onboarding:error", {
      code,
      aliasCode,
      error: message,
      message,
      timestamp: Date.now(),
    });

    throw rawErr;
  } finally {
    resumeRecoveryMonitoring();
  }
}
