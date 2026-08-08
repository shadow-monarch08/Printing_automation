import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import { systemCommands } from "../../commands/system.commands";
import { runSecureCommand } from "../utils/exec";
import { ConnectPayload, WiFiNetwork } from "../types";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";
import { updateSystemConfig, getSystemConfig } from "./config.db.service";

export async function scanNetworks(): Promise<WiFiNetwork[]> {
  try {
    try {
      await systemCommands.rescanWifi();
    } catch (rescanError: any) {
      console.warn('[WiFi Service] Rescan failed/throttled:', rescanError.message || rescanError);
    }
    
    // Fetch live scan results
    const { stdout } = await systemCommands.getWifiStatus();
    
    // Fetch saved networks list
    let savedNetworks = new Set<string>();
    try {
      const savedRes = await systemCommands.getSavedNetworks();
      savedRes.stdout.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed) savedNetworks.add(trimmed);
      });
    } catch (err) {
      console.warn('[WiFi Service] Failed to get saved networks:', err);
    }
    
    const lines = stdout.split('\n');
    const networksMap = new Map<string, WiFiNetwork>();

    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.split(':');
      if (parts.length < 3) continue;
      
      const inUse = parts[0];
      const signal = parseInt(parts[parts.length - 1], 10);
      const ssid = parts.slice(1, parts.length - 1).join(':');
      
      if (!ssid || ssid === '--') continue;

      const isActive = inUse === '*';
      const savedProfiles = Array.from(savedNetworks);
      const matchedProfile = savedProfiles.find(profile => 
          profile === ssid || profile === `netplan-wlan0-${ssid}`
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
    console.error('[WiFi Service] Scan failed:', error);
    return [];
  }
}

import { startQuickTunnel } from "./tunnel.service";

function formatCleanWifiError(rawMsg: string, targetName?: string): string {
  if (!rawMsg) return `Wi-Fi connection to "${targetName || 'network'}" failed.`;
  const clean = rawMsg.replace(/^Command failed:\s*sudo\s*nmcli\s*/i, '').trim();
  if (clean.includes('Secrets were required') || clean.includes('no-secrets')) {
    return `Invalid Wi-Fi Passphrase for "${targetName || 'network'}". Please verify security key.`;
  }
  if (clean.includes('No network with SSID') || clean.includes('not found')) {
    return `Network "${targetName || 'network'}" is out of range or no longer broadcasting.`;
  }
  if (clean.includes('connection up')) {
    return `Failed to activate saved Wi-Fi profile "${targetName || 'network'}". Please re-enter passphrase.`;
  }
  return clean;
}

export async function connectToWifiRaw(ssid?: string, password?: string, profileName?: string): Promise<void> {
  if (profileName) {
    console.log(`[WiFi Service] Connecting to saved profile "${profileName}"...`);
    try {
      await runSecureCommand('sudo', ['nmcli', 'connection', 'up', profileName]);
      return;
    } catch (err: any) {
      console.warn(`[WiFi Service] Saved profile "${profileName}" failed to activate directly. Falling back to SSID connection...`, err?.message || err);
    }
  }

  const targetSsid = ssid || profileName;
  if (!targetSsid) throw new Error("Wi-Fi SSID is required");

  console.log(`[WiFi Service] Connecting to network "${targetSsid}"...`);
  try {
    await runSecureCommand('sudo', ['nmcli', 'connection', 'delete', targetSsid]);
  } catch (e) { /* ignored */ }

  if (password) {
    await runSecureCommand('sudo', [
      'nmcli', 'connection', 'add', 
      'type', 'wifi', 
      'ifname', 'wlan0', 
      'con-name', targetSsid, 
      'ssid', targetSsid, 
      'wifi-sec.key-mgmt', 'wpa-psk', 
      'wifi-sec.psk', password
    ]);
  } else {
    await runSecureCommand('sudo', [
      'nmcli', 'connection', 'add', 
      'type', 'wifi', 
      'ifname', 'wlan0', 
      'con-name', targetSsid, 
      'ssid', targetSsid
    ]);
  }

  await runSecureCommand('sudo', ['nmcli', 'connection', 'up', targetSsid]);
}

export async function connectToWifi(payload: ConnectPayload & { adminPin?: string; shopName?: string }): Promise<boolean> {
  const { ssid, profileName, password, adminPin, shopName } = payload;

  await redisConnection.set(
    REDIS_KEYS.wifiConnectionStatus,
    JSON.stringify({ status: "connecting", timestamp: Date.now() }),
    "EX",
    REDIS_TTLS.WIFI_STATUS
  );

  const persistSuccessState = async () => {
    try {
      const currentConfig = getSystemConfig();
      const updates: any = { isOnboarded: true };

      if (adminPin) {
        updates.adminPinHash = bcrypt.hashSync(adminPin, 10);
      }
      if (shopName) {
        updates.shopName = shopName;
      } else if (!currentConfig?.isOnboarded) {
        updates.shopName = "Modern Press";
      }

      updateSystemConfig(updates);

      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(dataDir, "cloudflare_url.txt"),
        "https://dash.cloudflare.com/\n# Kiosk Quick Tunnel Initializing"
      );

      // Launch Quick Cloudflare Tunnel asynchronously
      startQuickTunnel(parseInt(process.env.PORT || "3000", 10));
    } catch (e) {
      console.warn("[WiFi Service] Failed to persist onboarding state to SQLite/disk:", e);
    }
  };

  if (payload.skipWifi) {
    console.log('[WiFi Service] User opted to skip Wi-Fi re-configuration. Proceeding with active network...');
    await persistSuccessState();
    await redisConnection.set(
      REDIS_KEYS.wifiConnectionStatus,
      JSON.stringify({ status: "success", skipped: true, timestamp: Date.now() }),
      "EX",
      REDIS_TTLS.WIFI_STATUS
    );
    return true;
  }

  try {
    await connectToWifiRaw(ssid, password, profileName);
    await persistSuccessState();
    await redisConnection.set(
      REDIS_KEYS.wifiConnectionStatus,
      JSON.stringify({ status: "success", timestamp: Date.now() }),
      "EX",
      REDIS_TTLS.WIFI_STATUS
    );
    return true;
  } catch (error: any) {
    const rawError = error.message || error;
    console.error(`[WiFi Service] Connection to "${ssid || profileName}" failed:`, rawError);

    try {
      await runSecureCommand('sudo', ['nmcli', 'connection', 'up', 'Kiosk-Hotspot']);
    } catch (e) { /* ignored */ }

    const userFriendlyError = formatCleanWifiError(String(rawError), ssid || profileName);

    await redisConnection.set(
      REDIS_KEYS.wifiConnectionStatus,
      JSON.stringify({
        status: "failed",
        error: userFriendlyError,
        timestamp: Date.now()
      }),
      "EX",
      REDIS_TTLS.WIFI_STATUS
    );
    return false;
  }
}
