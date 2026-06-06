import { systemCommands } from "../../commands/system.commands";
import { runSecureCommand } from "../utils/exec";

export interface ConnectPayload {
  ssid: string;
  profileName?: string;
  password?: string;
}

export interface WiFiNetwork {
  ssid: string;
  signal: number;
  isActive?: boolean;
  isSaved?: boolean;
  profileName?: string;
}

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
      if (parts.length < 3) continue; // Need at least IN-USE, SSID, SIGNAL
      
      const inUse = parts[0];
      const signal = parseInt(parts[parts.length - 1], 10);
      const ssid = parts.slice(1, parts.length - 1).join(':'); // Handle SSIDs containing colons
      
      // Remove hidden/empty SSIDs
      if (!ssid || ssid === '--') continue;

      const isActive = inUse === '*';
      const savedProfiles = Array.from(savedNetworks);
      const matchedProfile = savedProfiles.find(profile => 
          profile === ssid || profile === `netplan-wlan0-${ssid}`
      );
      const isSaved = !!matchedProfile;
      const profileName = matchedProfile || undefined;

      // Deduplicate: keep the one with stronger signal, but preserve isActive if one of them is active
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

    // Sort by: Active first, then saved, then by signal strength descending
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

export async function connectToWifi(payload: ConnectPayload): Promise<boolean> {
  const { ssid, profileName, password } = payload;
  
  try {
    // FLOW A: Saved Network
    if (profileName) {
      console.log(`[WiFi Service] Connecting to saved profile "${profileName}"...`);
      await runSecureCommand('sudo', ['nmcli', 'connection', 'up', profileName]);
      return true;
    }

    // FLOW B: New Network
    if (!password) throw new Error("Password is required for new networks");

    console.log(`[WiFi Service] Connecting to new network "${ssid}"...`);
    try {
      // Attempt cleanup of ghost profiles, ignore if it fails
      await runSecureCommand('sudo', ['nmcli', 'connection', 'delete', ssid]);
    } catch (e) { /* ignored */ }

    await runSecureCommand('sudo', [
      'nmcli', 'connection', 'add', 
      'type', 'wifi', 
      'ifname', 'wlan0', 
      'con-name', ssid, 
      'ssid', ssid, 
      'wifi-sec.key-mgmt', 'wpa-psk', 
      'wifi-sec.psk', password
    ]);

    await runSecureCommand('sudo', ['nmcli', 'connection', 'up', ssid]);
    return true;
  } catch (error: any) {
    console.error(`[WiFi Service] Connection to "${ssid}" failed:`, error.message || error);
    return false;
  }
}

