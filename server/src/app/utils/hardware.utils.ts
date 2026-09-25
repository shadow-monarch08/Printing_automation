import os from "os";
import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Reads the Raspberry Pi hardware CPU serial from /proc/cpuinfo if available.
 */
function getCpuSerial(): string | null {
  try {
    if (fs.existsSync("/proc/cpuinfo")) {
      const content = fs.readFileSync("/proc/cpuinfo", "utf8");
      const match = content.match(/Serial\s*:\s*([0-9a-fA-F]+)/i);
      if (match && match[1] && match[1] !== "0000000000000000") {
        return match[1].trim();
      }
    }
  } catch {
    // Non-linux or restricted permission
  }
  return null;
}

/**
 * Discovers the primary physical MAC address from network interfaces.
 * Prioritizes eth0, then wlan0, then the first non-internal interface with a valid MAC.
 */
export function getPrimaryMacAddress(): string | null {
  try {
    const interfaces = os.networkInterfaces();

    // Priority 1: eth0
    if (interfaces.eth0) {
      const eth = interfaces.eth0.find((i) => i.mac && i.mac !== "00:00:00:00:00:00" && !i.internal);
      if (eth) return eth.mac.toLowerCase();
    }

    // Priority 2: wlan0
    if (interfaces.wlan0) {
      const wlan = interfaces.wlan0.find((i) => i.mac && i.mac !== "00:00:00:00:00:00" && !i.internal);
      if (wlan) return wlan.mac.toLowerCase();
    }

    // Priority 3: Any non-internal interface
    for (const name of Object.keys(interfaces)) {
      const ifaceList = interfaces[name];
      if (ifaceList) {
        const found = ifaceList.find((i) => i.mac && i.mac !== "00:00:00:00:00:00" && !i.internal);
        if (found) return found.mac.toLowerCase();
      }
    }
  } catch {
    // Fallback
  }
  return null;
}

/**
 * Generates or reads a persistent machine UUID fallback for dev/virtual environments.
 */
function getOrCreatePersistentDevMachineId(): string {
  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const machineIdFile = path.join(dataDir, "dev_machine_id.txt");
    if (fs.existsSync(machineIdFile)) {
      const savedId = fs.readFileSync(machineIdFile, "utf8").trim();
      if (savedId) return savedId;
    }

    const hostSeed = `${os.hostname()}-${os.platform()}-${os.arch()}-${crypto.randomBytes(8).toString("hex")}`;
    const generatedId = `dev-node-${crypto.createHash("sha256").update(hostSeed).digest("hex").substring(0, 16)}`;
    fs.writeFileSync(machineIdFile, generatedId, "utf8");
    return generatedId;
  } catch {
    return `dev-node-${os.hostname()}`;
  }
}

/**
 * Returns a unique hardware identifier string for the kiosk device.
 * Used by the Central NMS to enforce the Hardware Claim Lock.
 */
export function getHardwareIdentifier(): string {
  // 1. Try CPU Serial (genuine Raspberry Pi hardware)
  const cpuSerial = getCpuSerial();
  if (cpuSerial) {
    return `rpi-${cpuSerial}`;
  }

  // 2. Try Primary MAC address
  const mac = getPrimaryMacAddress();
  if (mac) {
    return `mac-${mac.replace(/[: -]/g, "").toLowerCase()}`;
  }

  // 3. Fallback to persistent dev machine ID
  return getOrCreatePersistentDevMachineId();
}
