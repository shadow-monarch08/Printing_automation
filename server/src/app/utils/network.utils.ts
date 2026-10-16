import os from "os";
import { runSecureCommand } from "./exec";
import { HardwareError } from "./errors";

/**
 * Returns the currently active NetworkManager connection profile name for wlan0 (or primary wireless interface).
 * Returns null if no active Wi-Fi connection is detected.
 */
export async function getActiveConnectionProfile(): Promise<string | null> {
  try {
    const { stdout } = await runSecureCommand("sudo", ["nmcli", "-t", "-f", "NAME,DEVICE,TYPE", "connection", "show", "--active"]);
    const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
    
    // First priority: active Wi-Fi profile (excluding Kiosk-Hotspot)
    for (const line of lines) {
      const [name, device, type] = line.split(":");
      if (name === "Kiosk-Hotspot" || name === "lo") continue;
      if (type === "802-11-wireless" || type === "wifi" || (device && (device === "wlan0" || device.startsWith("wl")))) {
        return name || null;
      }
    }

    // Second priority: active Ethernet profile
    for (const line of lines) {
      const [name, device, type] = line.split(":");
      if (name === "Kiosk-Hotspot" || name === "lo") continue;
      if (type === "802-3-ethernet" || type === "ethernet" || (device && (device.startsWith("eth") || device.startsWith("en")))) {
        return name || null;
      }
    }

    // Fallback: any active profile that isn't Kiosk-Hotspot or loopback
    for (const line of lines) {
      const [name] = line.split(":");
      if (name && name !== "Kiosk-Hotspot" && name !== "lo") {
        return name;
      }
    }

    return null;
  } catch (err) {
    console.warn("[Network Utils] Could not query active NetworkManager profile:", err);
    return null;
  }
}

/**
 * Checks lightweight internet readiness using HTTP trace check.
 */
export async function checkInternetConnectivity(): Promise<boolean> {
  try {
    const { stdout } = await runSecureCommand("curl", [
      "-s",
      "--max-time",
      "4",
      "-o",
      "/dev/null",
      "-w",
      "%{http_code}",
      "https://cloudflare.com/cdn-cgi/trace",
    ]);
    return stdout === "200";
  } catch {
    return false;
  }
}

/**
 * Robust Internet readiness verifier. Polls up to maxAttempts with intervalMs.
 * Throws HardwareError('INTERNET_FAILED') if Internet cannot be verified.
 */
export async function verifyInternetReadiness(maxAttempts = 10, intervalMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isOnline = await checkInternetConnectivity();
    if (isOnline) {
      console.log(`[Network Utils] 🌐 Internet connectivity verified on attempt ${attempt}/${maxAttempts}`);
      return;
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new HardwareError(
    "INTERNET_FAILED",
    "Internet connectivity could not be verified after Wi-Fi association."
  );
}

/**
 * Resolves local IP address from wlan0 or active non-internal IPv4 interface.
 */
export function getLocalIpAddress(): string | null {
  try {
    const interfaces = os.networkInterfaces();
    if (interfaces.wlan0) {
      const wlan = interfaces.wlan0.find((iface) => iface.family === "IPv4" && !iface.internal);
      if (wlan) return wlan.address;
    }
    for (const name of Object.keys(interfaces)) {
      const ifaces = interfaces[name];
      if (ifaces) {
        const found = ifaces.find((iface) => iface.family === "IPv4" && !iface.internal);
        if (found) return found.address;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns the state and type of a physical/virtual network device from NetworkManager.
 */
export async function getDeviceState(
  deviceName: string = "wlan0"
): Promise<{ device: string; state: string; type: string } | null> {
  try {
    const { stdout } = await runSecureCommand("nmcli", ["-t", "-f", "DEVICE,STATE,TYPE", "device"]);
    const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const parts = line.split(":");
      if (parts[0] === deviceName) {
        return {
          device: parts[0],
          state: parts[1] || "unknown",
          type: parts[2] || "unknown",
        };
      }
    }
    return null;
  } catch (err) {
    console.warn(`[Network Utils] Could not query device state for "${deviceName}":`, err);
    return null;
  }
}

/**
 * Polls device state until it enters one of the acceptableStates, or times out.
 */
export async function waitForDeviceState(
  deviceName: string = "wlan0",
  acceptableStates: string[] = ["disconnected"],
  timeoutMs: number = 4000,
  pollIntervalMs: number = 200
): Promise<{ state: string; settled: boolean }> {
  const startTime = Date.now();
  let lastState = "unknown";

  while (Date.now() - startTime < timeoutMs) {
    const dev = await getDeviceState(deviceName);
    if (dev) {
      lastState = dev.state;
      if (acceptableStates.includes(dev.state)) {
        console.log(`[Network Utils] 🎯 Device "${deviceName}" reached target state "${dev.state}" after ${Date.now() - startTime}ms`);
        return { state: dev.state, settled: true };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  console.warn(`[Network Utils] ⚠️ Device "${deviceName}" timed out waiting for states [${acceptableStates.join(", ")}]. Last state: "${lastState}"`);
  return { state: lastState, settled: false };
}

/**
 * Ensures the Wi-Fi radio interface (e.g., wlan0) has physically settled out of
 * transient states ('deactivating', 'unavailable', or mid-firmware-reset) before
 * attempting association or AP mode changes.
 */
export async function settleWifiRadio(
  deviceName: string = "wlan0",
  timeoutMs: number = 4000
): Promise<boolean> {
  console.log(`[Network Utils] ⏳ Ensuring Wi-Fi radio "${deviceName}" is physically settled...`);
  
  // Acceptable settled states: 'disconnected' (ready for association) or 'connected'
  const result = await waitForDeviceState(deviceName, ["disconnected", "connected"], timeoutMs, 200);

  // Broadcom driver quiet period: brief 300ms buffer to allow kernel tasklets & wpa_supplicant state flush
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  return result.settled;
}
