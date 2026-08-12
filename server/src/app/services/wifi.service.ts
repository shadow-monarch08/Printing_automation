import { systemCommands } from "../../commands/system.commands";
import { runSecureCommand } from "../utils/exec";
import { WiFiNetwork } from "../types";
import { ValidationError, HardwareError } from "../utils/errors";

export async function scanNetworks(): Promise<WiFiNetwork[]> {
  try {
    try {
      await systemCommands.rescanWifi();
    } catch (rescanError: any) {
      console.warn("[WiFi Service] Rescan failed/throttled:", rescanError.message || rescanError);
    }

    // Fetch live scan results
    const { stdout } = await systemCommands.getWifiStatus();

    // Fetch saved networks list
    let savedNetworks = new Set<string>();
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

      const parts = line.split(":");
      if (parts.length < 3) continue;

      const inUse = parts[0];
      const signal = parseInt(parts[parts.length - 1], 10);
      const ssid = parts.slice(1, parts.length - 1).join(":");

      if (!ssid || ssid === "--") continue;

      const isActive = inUse === "*";
      const savedProfiles = Array.from(savedNetworks);
      const matchedProfile = savedProfiles.find(
        (profile) => profile === ssid || profile === `netplan-wlan0-${ssid}`
      );
      const isSaved = !!matchedProfile;
      const profileName = matchedProfile || undefined;

      const existing = networksMap.get(ssid);
      if (!existing) {
        networksMap.set(ssid, { ssid, signal, isActive, isSaved, profileName });
      } else {
        if (signal > existing.signal) {
          existing.signal = signal;
        }
        if (isActive) {
          existing.isActive = true;
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

export function formatCleanWifiError(rawMsg: string, targetName?: string): string {
  if (!rawMsg) return `Wi-Fi connection to "${targetName || "network"}" failed.`;
  const clean = rawMsg.replace(/^Command failed:\s*sudo\s*nmcli\s*/i, "").trim();
  if (clean.includes("Secrets were required") || clean.includes("no-secrets")) {
    return `Invalid Wi-Fi Passphrase for "${targetName || "network"}". Please verify security key.`;
  }
  if (clean.includes("No network with SSID") || clean.includes("not found")) {
    return `Network "${targetName || "network"}" is out of range or no longer broadcasting.`;
  }
  if (clean.includes("connection up")) {
    return `Failed to activate saved Wi-Fi profile "${targetName || "network"}". Please re-enter passphrase.`;
  }
  return clean;
}

export async function connectToWifi(
  ssid?: string,
  password?: string,
  profileName?: string,
  isSaved?: boolean
): Promise<void> {
  const activeProfileName = profileName || (isSaved && ssid ? ssid : undefined);

  console.log({
    uid: process.getuid?.(),
    user: process.env.USER,
    home: process.env.HOME,
    path: process.env.PATH,
  });

  if (activeProfileName || isSaved) {
    const targetName = activeProfileName || ssid;
    if (targetName) {
      console.log(`[WiFi Service] Attempting connection to saved profile "${targetName}"...`);
      try {
        await runSecureCommand("sudo", ["nmcli", "connection", "up", targetName]);
        console.log(`[WiFi Service] Successfully connected to saved profile "${targetName}".`);
        return;
      } catch (err: any) {
        const rawMsg = err?.message || String(err);
        console.error(
          `[WiFi Service] FAILED to activate saved profile "${targetName}". Detailed Error Output:\n`,
          rawMsg
        );

        // If no new password was provided, do NOT attempt to delete or recreate as an unencrypted network!
        if (!password) {
          let code = "WIFI_CONNECTION_FAILED";
          if (rawMsg.includes("Secrets were required") || rawMsg.includes("no-secrets")) {
            code = "WIFI_AUTH_FAILED";
          } else if (rawMsg.includes("No network with SSID") || rawMsg.includes("not found")) {
            code = "WIFI_NETWORK_NOT_FOUND";
          }
          const cleanMsg = formatCleanWifiError(rawMsg, targetName);
          throw new HardwareError(code, cleanMsg);
        }

        console.warn(`[WiFi Service] New password provided for saved profile "${targetName}". Re-creating connection profile...`);
      }
    }
  }

  const targetSsid = ssid || profileName;
  if (!targetSsid) throw new ValidationError("VALIDATION_SSID_REQUIRED", "Wi-Fi SSID is required.");

  console.log(`[WiFi Service] Connecting to new network "${targetSsid}"...`);
  try {
    await runSecureCommand("sudo", ["nmcli", "connection", "delete", targetSsid]);
  } catch (e) {
    /* ignored */
  }

  try {
    if (password) {
      await runSecureCommand("sudo", [
        "nmcli",
        "connection",
        "add",
        "type",
        "wifi",
        "ifname",
        "wlan0",
        "con-name",
        targetSsid,
        "ssid",
        targetSsid,
        "wifi-sec.key-mgmt",
        "wpa-psk",
        "wifi-sec.psk",
        password,
      ]);
    } else {
      await runSecureCommand("sudo", [
        "nmcli",
        "connection",
        "add",
        "type",
        "wifi",
        "ifname",
        "wlan0",
        "con-name",
        targetSsid,
        "ssid",
        targetSsid,
      ]);
    }

    await runSecureCommand("sudo", ["nmcli", "connection", "up", targetSsid]);
  } catch (rawErr: any) {
    const rawMsg = rawErr?.message || String(rawErr);
    let code = "WIFI_CONNECTION_FAILED";

    if (rawMsg.includes("Secrets were required") || rawMsg.includes("no-secrets")) {
      code = "WIFI_AUTH_FAILED";
    } else if (rawMsg.includes("No network with SSID") || rawMsg.includes("not found")) {
      code = "WIFI_NETWORK_NOT_FOUND";
    }

    const cleanMsg = formatCleanWifiError(rawMsg, targetSsid);
    throw new HardwareError(code, cleanMsg);
  }
}
