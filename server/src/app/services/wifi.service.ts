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

export async function connectToWifiRaw(ssid?: string, password?: string, profileName?: string): Promise<void> {
  if (profileName) {
    console.log(`[WiFi Service] Connecting to saved profile "${profileName}"...`);
    await runSecureCommand('sudo', ['nmcli', 'connection', 'up', profileName]);
    return;
  }

  if (!ssid) throw new Error("Wi-Fi SSID is required");

  console.log(`[WiFi Service] Connecting to network "${ssid}"...`);
  try {
    await runSecureCommand('sudo', ['nmcli', 'connection', 'delete', ssid]);
  } catch (e) { /* ignored */ }

  if (password) {
    await runSecureCommand('sudo', [
      'nmcli', 'connection', 'add', 
      'type', 'wifi', 
      'ifname', 'wlan0', 
      'con-name', ssid, 
      'ssid', ssid, 
      'wifi-sec.key-mgmt', 'wpa-psk', 
      'wifi-sec.psk', password
    ]);
  } else {
    await runSecureCommand('sudo', [
      'nmcli', 'connection', 'add', 
      'type', 'wifi', 
      'ifname', 'wlan0', 
      'con-name', ssid, 
      'ssid', ssid
    ]);
  }

  await runSecureCommand('sudo', ['nmcli', 'connection', 'up', ssid]);
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
    console.error(`[WiFi Service] Connection to "${ssid}" failed:`, error.message || error);

    try {
      await runSecureCommand('sudo', ['nmcli', 'connection', 'up', 'Kiosk-Hotspot']);
    } catch (e) { /* ignored */ }

    await redisConnection.set(
      REDIS_KEYS.wifiConnectionStatus,
      JSON.stringify({
        status: "failed",
        error: error.message || "Invalid Wi-Fi Passphrase",
        timestamp: Date.now()
      }),
      "EX",
      REDIS_TTLS.WIFI_STATUS
    );
    return false;
  }
}
