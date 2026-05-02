import { execCommand } from "../utils/exec";

export interface WiFiNetwork {
  ssid: string;
  signal: number;
}

export async function scanNetworks(): Promise<WiFiNetwork[]> {
  try {
    // nmcli -t -f ssid,signal dev wifi
    // -t: terse output (suitable for parsing)
    // -f: fields to display
    const { stdout } = await execCommand('nmcli -t -f ssid,signal dev wifi');
    
    const lines = stdout.split('\n');
    const networksMap = new Map<string, number>();

    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.split(':');
      if (parts.length < 2) continue;
      
      const ssid = parts.slice(0, parts.length - 1).join(':'); // Handle SSIDs containing colons
      const signal = parseInt(parts[parts.length - 1], 10);
      
      // Remove hidden/empty SSIDs
      if (!ssid || ssid === '--') continue;

      // Deduplicate: keep the one with stronger signal
      const existingSignal = networksMap.get(ssid);
      if (existingSignal === undefined || signal > existingSignal) {
        networksMap.set(ssid, signal);
      }
    }

    const result = Array.from(networksMap.entries()).map(([ssid, signal]) => ({
      ssid,
      signal
    }));

    // Sort by signal strength descending
    return result.sort((a, b) => b.signal - a.signal);
  } catch (error) {
    console.error('[WiFi Service] Scan failed:', error);
    return [];
  }
}

export async function connectToNetwork(ssid: string, password?: string): Promise<boolean> {
  try {
    console.log(`[WiFi Service] Attempting connection to "${ssid}"...`);
    
    // sudo nmcli device wifi connect "<ssid>" password "<password>"
    const cmd = password 
      ? `sudo nmcli device wifi connect "${ssid}" password "${password}"`
      : `sudo nmcli device wifi connect "${ssid}"`;
    
    await execCommand(cmd);
    return true;
  } catch (error) {
    console.error(`[WiFi Service] Connection to "${ssid}" failed:`, error);
    return false;
  }
}
