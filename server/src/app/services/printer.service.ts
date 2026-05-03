import { execCommand } from "../utils/exec";
import fs from "fs/promises";
import path from "path";

const capabilitiesPath = path.resolve(__dirname, "../../config/capabilities.json");

export interface PrinterInfo {
  name: string;
  description: string;
  status: string;
  alias?: string;
  capabilities?: string[];
  type?: string;
}

export async function getCapabilitiesConfig(): Promise<any> {
  try {
    const data = await fs.readFile(capabilitiesPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export async function updateCapabilitiesConfig(newConfig: any): Promise<void> {
  await fs.writeFile(capabilitiesPath, JSON.stringify(newConfig, null, 2), "utf-8");
}

export async function updateAlias(printerName: string, alias: string): Promise<void> {
  const config = await getCapabilitiesConfig();
  if (!config[printerName]) {
    config[printerName] = { capabilities: [], type: "unknown" };
  }
  config[printerName].alias = alias;
  await updateCapabilitiesConfig(config);
}

export async function detectPrinters(): Promise<string[]> {
  try {
    const { stdout } = await execCommand("lpinfo -v");
    return stdout.split("\n").filter(Boolean);
  } catch (err) {
    console.error("[detectPrinters] lpinfo failed", err);
    return [];
  }
}

/**
 * List all printers known to CUPS.
 * Parses `lpstat -p` output.
 */
export async function listPrinters(): Promise<PrinterInfo[]> {
  try {
    const { stdout, stderr } = await execCommand("lpstat -p");

    if (stderr) {
      console.warn("[listPrinters] lpstat stderr:", stderr);
    }

    console.log("[listPrinters] raw lpstat output:", JSON.stringify(stdout));

    const printers: PrinterInfo[] = [];
    const lines = stdout.split("\n").filter(Boolean);
    const capabilities = await getCapabilitiesConfig();

    for (const line of lines) {
      // Case-insensitive match to handle different CUPS/locale output formats
      const match = line.match(/^printer\s+(\S+)\s+(.*)/i);
      if (match) {
        const name = match[1];
        const caps = capabilities[name] || {};
        printers.push({
          name,
          description: match[2],
          status: line.toLowerCase().includes("idle") ? "idle" : "busy",
          alias: caps.alias,
          capabilities: caps.capabilities || [],
          type: caps.type,
        });
      }
    }

    console.log(`[listPrinters] parsed ${printers.length} printer(s)`);
    return printers;
  } catch (err: any) {
    // lpstat returns exit code 1 when no printers are configured,
    // but may still have useful stdout. Try to parse it.
    const stdout = err?.stdout || "";
    const stderr = err?.stderr || "";
    console.error("[listPrinters] lpstat command failed:", {
      message: err?.error?.message || String(err),
      stdout,
      stderr,
    });

    // If there IS stdout despite the error, try to parse it anyway
    if (stdout) {
      const printers: PrinterInfo[] = [];
      const lines = stdout.split("\n").filter(Boolean);
      const capabilities = await getCapabilitiesConfig();
      for (const line of lines) {
        const match = line.match(/^printer\s+(\S+)\s+(.*)/i);
        if (match) {
          const name = match[1];
          const caps = capabilities[name] || {};
          printers.push({
            name,
            description: match[2],
            status: line.toLowerCase().includes("idle") ? "idle" : "busy",
            alias: caps.alias,
            capabilities: caps.capabilities || [],
            type: caps.type,
          });
        }
      }
      if (printers.length > 0) {
        console.log(`[listPrinters] recovered ${printers.length} printer(s) from error output`);
        return printers;
      }
    }

    throw err;
  }
}

/**
 * Get the system default printer.
 * Parses `lpstat -d` output → "system default destination: <name>"
 */
export async function getDefaultPrinter(): Promise<string | null> {
  try {
    const { stdout } = await execCommand("lpstat -d");
    const match = stdout.match(/system default destination:\s*(\S+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Set the system default printer.
 * Runs `lpoptions -d <printerName>`.
 */
export async function setDefaultPrinter(printerName: string): Promise<void> {
  await execCommand(`lpoptions -d ${printerName}`);
}

/**
 * Print a file.
 * @param filePath  - Absolute path to the uploaded file.
 * @param printer   - (Optional) Target printer name; uses default if omitted.
 * @returns The CUPS job ID string.
 */
export async function printFile(
  filePath: string,
  printer?: string,
  copies: number = 1,
  duplex: "single" | "double" = "single"
): Promise<string> {
  const printerFlag = printer ? `-d ${printer}` : "";
  const sidesFlag = duplex === "double" ? "-o sides=two-sided-long-edge" : "-o sides=one-sided";
  const copiesFlag = `-n ${copies}`;
  
  const { stdout } = await execCommand(`lp ${printerFlag} ${copiesFlag} ${sidesFlag} -- "${filePath}"`);
  // stdout example: "request id is MyPrinter-42 (1 file(s))"
  const match = stdout.match(/request id is (\S+)/);
  return match ? match[1] : stdout;
}

/**
 * Gets the status of a specific CUPS job.
 * Runs `lpstat -o <printerName>` and greps for the job ID.
 */
export async function getJobStatus(printerName: string, cupsJobId: string): Promise<string> {
  try {
    const { stdout } = await execCommand(`lpstat -o ${printerName}`);
    const lines = stdout.split("\n");
    const jobLine = lines.find(line => line.includes(cupsJobId));
    
    if (!jobLine) {
      // If job is not in the queue, it might be completed or canceled.
      return "completed_or_missing";
    }
    
    // Simple keyword extraction from the status line
    if (jobLine.toLowerCase().includes("printing")) return "printing";
    if (jobLine.toLowerCase().includes("held")) return "held";
    if (jobLine.toLowerCase().includes("stopped")) return "stopped";
    
    return "pending";
  } catch (err) {
    console.error(`[getJobStatus] Error checking status for ${cupsJobId}:`, err);
    return "unknown";
  }
}

/**
 * Cancels a CUPS job.
 */
export async function cancelJob(cupsJobId: string): Promise<void> {
  await execCommand(`cancel ${cupsJobId}`);
}

/**
 * Pauses a CUPS job.
 */
export async function pauseCupsJob(cupsJobId: string): Promise<void> {
  await execCommand(`lp -i ${cupsJobId} -H hold`);
}

/**
 * Resumes a CUPS job.
 */
export async function resumeCupsJob(cupsJobId: string): Promise<void> {
  await execCommand(`lp -i ${cupsJobId} -H resume`);
}

/**
 * Phase 6: Discover unconfigured legacy HP printers (USB).
 */
export async function getUnconfiguredHpPrinters(): Promise<Array<{ uri: string, rawModel: string }>> {
  try {
    // 1. Get all physical devices
    const lpinfoRes = await execCommand("lpinfo -v");
    const physicalDevices = lpinfoRes.stdout.split("\n").filter(Boolean);
    
    // We only care about HP USB devices
    // e.g. "direct usb://HP/LaserJet%20P1006?serial=..."
    const hpUsbDevices = physicalDevices
      .map(line => {
        const match = line.match(/(usb:\/\/HP\/[^ ]+)/i);
        if (match) {
          const uri = match[1];
          // Try to extract a raw model name from the URI (e.g. HP/LaserJet%20P1006?serial...)
          const uriModelMatch = uri.match(/usb:\/\/HP\/([^?]+)/i);
          const rawModel = uriModelMatch ? decodeURIComponent(uriModelMatch[1]) : "Unknown_HP_Device";
          return { uri, rawModel };
        }
        return null;
      })
      .filter(Boolean) as Array<{ uri: string, rawModel: string }>;

    // 2. Get currently configured URIs
    const lpstatRes = await execCommand("lpstat -v").catch(() => ({ stdout: "" }));
    const configuredUris = lpstatRes.stdout.split("\n")
      .map(line => {
        const match = line.match(/device for [^:]+:\s*(.+)/);
        return match ? match[1].trim() : null;
      })
      .filter(Boolean) as string[];

    // 3. Diff: Any HP USB device NOT in configuredUris is orphaned
    const orphaned = hpUsbDevices.filter(dev => {
      return !configuredUris.some(cUri => cUri.includes(dev.uri) || dev.uri.includes(cUri));
    });

    return orphaned;
  } catch (err) {
    console.error("[getUnconfiguredHpPrinters] Discovery failed:", err);
    return [];
  }
}

/**
 * Phase 6: Auto-configure an HP printer via hp-setup.
 */
export async function configureHpPrinter(uri: string, rawModel: string): Promise<void> {
  // Sanitize model to be a valid CUPS queue name (alphanumeric and underscores)
  const safeName = rawModel.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
  
  // Actually hp-setup handles the queue name automatically most of the time based on the model,
  // but if we wanted to enforce it, we might need a different flag or just let it auto-name.
  // The command specified is `sudo hp-setup -i -a -q "<uri>"`
  console.log(`[configureHpPrinter] Auto-configuring HP device: ${uri}`);
  
  // NOTE: This requires passwordless sudo for hp-setup
  const { stderr } = await execCommand(`sudo hp-setup -i -a -q "${uri}"`);
  
  if (stderr && stderr.toLowerCase().includes("error")) {
    console.warn(`[configureHpPrinter] hp-setup had warnings/errors: ${stderr}`);
  }
}
