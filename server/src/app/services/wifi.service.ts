import { systemCommands } from "../../commands/system.commands";
import { runSecureCommand } from "../utils/exec";
import { WiFiNetwork } from "../types";
import { ValidationError, HardwareError } from "../utils/errors";
import { suspendRecoveryMonitoring, resumeRecoveryMonitoring } from "./networkRecovery.service";
import { getActiveConnectionProfile } from "../utils/network.utils";

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

    // 3. Fetch saved networks list
    const savedNetworks = new Set<string>();
    try {
      const savedRes = await systemCommands.getSavedNetworks();
      savedRes.stdout.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) savedNetworks.add(trimmed);
      });
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

      const savedProfiles = Array.from(savedNetworks);
      const matchedProfile = savedProfiles.find(
        (profile) => profile === rawSsid || profile === `netplan-wlan0-${rawSsid}`
      );
      const isSaved = !!matchedProfile;
      const profileName = matchedProfile || undefined;

      const existing = networksMap.get(rawSsid);
      if (!existing) {
        networksMap.set(rawSsid, {
          ssid: rawSsid,
          signal,
          isActive,
          isSaved,
          profileName,
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

export function parseDetailedWifiError(rawMsg: string, targetName: string): { code: string; message: string } {
  if (!rawMsg) {
    return {
      code: "WIFI_CONNECTION_FAILED",
      message: `Wi-Fi connection to "${targetName}" failed.`,
    };
  }

  const clean = rawMsg.replace(/^Command failed:\s*sudo\s*nmcli\s*/i, "").trim();

  // 1. Password / Authentication Failure
  if (
    clean.includes("Secrets were required") ||
    clean.includes("no-secrets") ||
    clean.includes("802-11-wireless-security.psk: invalid") ||
    clean.includes("not authorized") ||
    clean.includes("authentication failed")
  ) {
    return {
      code: "WIFI_AUTH_FAILED",
      message: `Invalid Wi-Fi Passphrase for "${targetName}". Please verify security key.`,
    };
  }

  // 2. Network Not Found / Out of Range
  if (
    clean.includes("No network with SSID") ||
    clean.includes("not found") ||
    clean.includes("ssid-not-found") ||
    clean.includes("could not be found")
  ) {
    return {
      code: "WIFI_NETWORK_NOT_FOUND",
      message: `Network "${targetName}" is out of range or not broadcasting.`,
    };
  }

  // 3. Association / Handshake Timeout
  if (
    clean.includes("Association took too long") ||
    clean.includes("association took too long") ||
    clean.includes("supplicant-timeout") ||
    clean.includes("timed out") ||
    clean.includes("Command timed out")
  ) {
    return {
      code: "WIFI_TIMEOUT",
      message: `Connection to "${targetName}" timed out. Signal may be weak or router unresponsive.`,
    };
  }

  // 4. DHCP Lease Acquisition Failure
  if (
    clean.includes("no lease") ||
    clean.includes("IP configuration could not be reserved") ||
    clean.includes("dhcp")
  ) {
    return {
      code: "WIFI_DHCP_FAILED",
      message: `Connected to "${targetName}", but failed to acquire an IP address from router DHCP.`,
    };
  }

  // 5. Fallback clean error
  return {
    code: "WIFI_CONNECTION_FAILED",
    message: clean || `Wi-Fi connection to "${targetName}" failed.`,
  };
}

export function formatCleanWifiError(rawMsg: string, targetName?: string): string {
  return parseDetailedWifiError(rawMsg, targetName || "network").message;
}

export async function connectToWifi(
  ssid?: string,
  password?: string,
  profileName?: string,
  isSaved?: boolean
): Promise<void> {
  suspendRecoveryMonitoring();

  try {
    const targetSsid = ssid || profileName;
    if (!targetSsid) {
      throw new ValidationError("VALIDATION_SSID_REQUIRED", "Wi-Fi SSID is required.");
    }

    // 1. Ensure Wi-Fi radio is physically powered on
    try {
      await runSecureCommand("sudo", ["nmcli", "radio", "wifi", "on"], { timeout: 5000 });
    } catch {
      /* non-fatal */
    }

    // 2. If connecting to a SAVED profile without a new password:
    if ((isSaved || profileName) && !password) {
      const connName = profileName || targetSsid;
      console.log(`[WiFi Service] Activating existing saved profile "${connName}"...`);
      try {
        await runSecureCommand("sudo", ["nmcli", "connection", "up", connName], { timeout: 60000 });
        console.log(`[WiFi Service] Successfully connected to saved profile "${connName}".`);
        return;
      } catch (err: any) {
        const rawMsg = err?.message || String(err);
        console.error(`[WiFi Service] Failed to activate saved profile "${connName}":`, rawMsg);
        const { code, message } = parseDetailedWifiError(rawMsg, connName);
        throw new HardwareError(code, message);
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
    console.log(`[WiFi Service] Associating with "${targetSsid}" via atomic device wifi connect...`);
    const connectArgs = ["nmcli", "device", "wifi", "connect", targetSsid];
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

    const { code, message } = parseDetailedWifiError(rawMsg, ssid || profileName || "network");
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

    // 2. Fetch saved Wi-Fi connection profiles from NetworkManager
    const { stdout } = await runSecureCommand("nmcli", ["-t", "-f", "NAME,TYPE", "connection", "show"]);
    const savedWifiProfiles = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && (l.includes(":802-11-wireless") || l.includes(":wifi")))
      .map((l) => l.split(":")[0])
      .filter((name) => name && name !== "Kiosk-Hotspot");

    console.log(`[WiFi Service] Found ${savedWifiProfiles.length} saved Wi-Fi profile(s):`, savedWifiProfiles);

    // 3. Ask NetworkManager to connect wlan0 device immediately
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

    // 4. Fallback: explicitly bring up saved profiles sequentially
    for (const profile of savedWifiProfiles) {
      try {
        console.log(`[WiFi Service] Bringing up known connection profile "${profile}"...`);
        await runSecureCommand("sudo", ["nmcli", "connection", "up", profile], { timeout: 15000 });
        console.log(`[WiFi Service] ✅ Successfully reconnected to saved network "${profile}"!`);
        return profile;
      } catch (profErr: any) {
        console.warn(`[WiFi Service] Connection attempt to "${profile}" failed:`, profErr?.message || profErr);
      }
    }
  } catch (err) {
    console.error("[WiFi Service] Error during auto-reconnect sweep:", err);
  }
  return null;
}
