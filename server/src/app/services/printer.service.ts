import { cupsCommands } from "../../commands/cups.commands";
import { hpCommands } from "../../commands/hp.commands";
import fs from "fs/promises";
import path from "path";
import { redisConnection } from "../../infrastructure/redis";
import { eventBus } from "../utils/eventBus";
import { PrinterFactory } from "../../factories/printer.factory";
import { PrinterSupplyStatus } from "./supplies.service";
import { removePrinterFromAttemptedJobs } from "../../infrastructure/printMaster.queue";

const capabilitiesPath = path.resolve(__dirname, "../../config/capabilities.json");

export interface PrinterInfo {
  name: string;
  description: string;
  status: string;
  alias?: string;
  capabilities?: string[];
  type?: string;
  paper?: string;
  supplyBlack?: number | null;
  supplyColor?: number | null;
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
    const { stdout } = await cupsCommands.listDevices();
    return stdout.split("\n").filter(Boolean);
  } catch (err) {
    console.error("[detectPrinters] lpinfo failed", err);
    return [];
  }
}

/**
 * Internal: List all printers known to CUPS.
 * Parses `lpstat -p` output. Used by the heartbeat.
 */
export async function listPrintersFromCUPS(): Promise<PrinterInfo[]> {
  try {
    const { stdout, stderr } = await cupsCommands.listPrinters();

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
 * List all printers from the Redis cache.
 * This is the primary function used by user-facing routes.
 */
export async function listPrinters(): Promise<PrinterInfo[]> {
  try {
    const printerNames = await redisConnection.smembers("fleet:printers");
    const printers: PrinterInfo[] = [];

    for (const name of printerNames) {
      const [health, state, infoRaw, suppliesRaw] = await Promise.all([
        redisConnection.get(`printer:${name}:health`),
        redisConnection.get(`printer:${name}:state`),
        redisConnection.get(`printer:${name}:info`),
        redisConnection.get(`supplies:${name}`)
      ]);

      let info: any = {};
      let supplies: PrinterSupplyStatus | null = null;
      try {
        if (infoRaw) info = JSON.parse(infoRaw);
        if (suppliesRaw) supplies = JSON.parse(suppliesRaw);
      } catch { }

      // Combine standard status based on state and health
      let status = "idle";
      if (health === "flagged") status = "error";
      else if (state === "busy") status = "busy";

      printers.push({
        name,
        description: info.description || name,
        status,
        alias: info.alias,
        capabilities: info.capabilities || [],
        type: info.type || "unknown",
        paper: supplies?.paper || 'unknown',
        supplyBlack: supplies?.supplies?.black ?? null,
        supplyColor: supplies?.supplies?.color ?? null,
      });
    }

    return printers;
  } catch (err) {
    console.error("[listPrinters] Cache read failed", err);
    return [];
  }
}

/**
 * Get the system default printer.
 * Parses `lpstat -d` output → "system default destination: <name>"
 */
export async function getDefaultPrinter(): Promise<string | null> {
  try {
    const { stdout } = await cupsCommands.getDefaultPrinter();
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
  await cupsCommands.setDefaultPrinter(printerName);
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
  const sides = duplex === "double" ? "two-sided-long-edge" : "one-sided";

  const { stdout } = await cupsCommands.printFile(printer || null, filePath, { copies, sides });
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
    const { stdout } = await cupsCommands.getJobStatus(printerName);
    const lines = stdout.split("\n");
    const jobLine = lines.find((line: string) => line.includes(cupsJobId));

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
  await cupsCommands.cancelJob(cupsJobId);
}

/**
 * Pauses a CUPS job.
 */
export async function pauseCupsJob(cupsJobId: string): Promise<void> {
  await cupsCommands.holdJob(cupsJobId);
}

/**
 * Resumes a CUPS job.
 */
export async function resumeCupsJob(cupsJobId: string): Promise<void> {
  await cupsCommands.resumeJob(cupsJobId);
}

/**
 * Phase 6: Discover unconfigured legacy HP printers (USB) and modern IPP printers.
 */
export async function getUnconfiguredPrinters(): Promise<Array<{ uri: string, rawModel: string, type: string }>> {
  try {
    // 1. Get all physical devices
    const lpinfoRes = await cupsCommands.listDevices();
    const physicalDevices = lpinfoRes.stdout.split("\n").filter(Boolean);

    const devices = physicalDevices
      .map((line: string) => {
        // Check for HP USB
        const hpMatch = line.match(/((usb:\/\/HP|hp:\/usb)\/[^ ]+)/i);
        if (hpMatch) {
          const uri = hpMatch[1];
          const rawModel = decodeURIComponent(uri.split('?')[0].split('/').pop() || "Unknown_HP_Device");
          return { uri, rawModel, type: "usb" };
        }
        // Check for IPP
        const ippMatch = line.match(/(ipp:\/\/[^ ]+)/i);
        if (ippMatch) {
          const uri = ippMatch[1];
          const rawModel = "Network Printer (" + decodeURIComponent(uri.split('//')[1].split('/')[0] || "Unknown_IPP_Device") + ")";
          return { uri, rawModel, type: "ipp" };
        }
        return null;
      })
      .filter(Boolean) as Array<{ uri: string, rawModel: string, type: string }>;

    // 2. Get currently configured URIs
    const lpstatRes = await cupsCommands.getPrinterStatus().catch(() => ({ stdout: "" }));
    const configuredUris = lpstatRes.stdout.split("\n")
      .map((line: string) => {
        const match = line.match(/device for [^:]+:\s*(.+)/);
        return match ? match[1].trim() : null;
      })
      .filter(Boolean) as string[];

    // 3. Diff: Any device NOT in configuredUris is orphaned
    const orphaned = devices.filter((dev: { uri: string }) => {
      return !configuredUris.some(cUri => cUri.includes(dev.uri) || dev.uri.includes(cUri));
    });

    return orphaned;
  } catch (err) {
    console.error("[getUnconfiguredPrinters] Discovery failed:", err);
    return [];
  }
}

/**
 * Phase 6: Auto-configure an HP printer via hp-setup.
 */
export async function configureHpPrinter(uri: string, rawModel: string): Promise<void> {
  // Sanitize model to be a valid CUPS queue name (alphanumeric and underscores)
  const safeName = rawModel.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");

  console.log(`[configureHpPrinter] Auto-configuring HP device: ${uri}`);

  // NOTE: This requires passwordless sudo for hp-setup
  try {
    await hpCommands.setupPrinter(uri);
  } catch (err: any) {
    console.warn(`[configureHpPrinter] hp-setup had warnings/errors: ${err}`);
  }
}

/**
 * Phase 6: Auto-configure an IPP printer via lpadmin.
 */
export async function configureIppPrinter(queueName: string, uri: string): Promise<void> {
  console.log(`[configureIppPrinter] Auto-configuring IPP device: ${uri} as ${queueName}`);
  try {
    await cupsCommands.addIppPrinter(queueName, uri);
  } catch (err: any) {
    console.warn(`[configureIppPrinter] lpadmin had warnings/errors: ${err}`);
    throw err;
  }
}

/**
 * Phase 6: Auto-configure a generic USB printer via lpadmin.
 */
export async function configureGenericUsbPrinter(queueName: string, uri: string): Promise<void> {
  console.log(`[configureGenericUsbPrinter] Configuring USB device: ${uri} as ${queueName}`);
  await cupsCommands.addUsbPrinter(queueName, uri);
}

/**
 * Phase 6: Probe printer capabilities using lpoptions -l.
 */
export async function probePrinterCapabilities(queueName: string): Promise<string[]> {
  const capabilities: string[] = [];
  try {
    const { stdout } = await cupsCommands.getPrinterOptions(queueName);

    // Look for keywords in lpoptions -l output
    // Example: "ColorModel/Color Mode: *Gray RGB" -> has color if RGB is present
    // "Duplex/Two-Sided Printing: None *DuplexNoTumble DuplexTumble" -> has duplex

    if (stdout.match(/ColorModel.*RGB/i) || stdout.match(/ColorModel.*CMYK/i) || stdout.match(/ColorModel.*Color/i)) {
      capabilities.push("color");
    } else if (stdout.match(/ColorModel/i)) {
      capabilities.push("grayscale");
    }

    if (stdout.match(/Duplex/i)) {
      capabilities.push("duplex");
    }

    console.log(`[probePrinterCapabilities] Probed ${queueName}:`, capabilities);
  } catch (err) {
    console.warn(`[probePrinterCapabilities] Failed to probe ${queueName}:`, err);
  }
  return capabilities;
}

/**
 * Phase 1: Comprehensive Health Check
 */
export async function runComprehensiveHealthCheck(name: string): Promise<void> {
  try {
    const strikes = await redisConnection.get(`printer:${name}:strikes`);
    if (parseInt(strikes || "0") >= 3) {
      console.log(`[HealthCheck] Skipping ${name} — quarantined (${strikes} strikes)`);
      return;
    }

    const adapter = await PrinterFactory.getAdapter(name);
    if (!adapter) {
      console.warn(`[HealthCheck] No adapter found for ${name}`);
      await redisConnection.set(`printer:${name}:health`, "flagged");
      return;
    }

    // 1. Digital Probe
    const isHealthy = await adapter.healthCheck();
    if (!isHealthy) {
      await redisConnection.set(`printer:${name}:health`, "flagged");
      return;
    }

    // 2. CUPS Status Check
    const { stdout } = await cupsCommands.getPrinterStatusByName(name);
    if (stdout.toLowerCase().includes("stopped") || stdout.toLowerCase().includes("rejecting")) {
      await redisConnection.set(`printer:${name}:health`, "flagged");
      return;
    }

    const currentState = await redisConnection.get(`printer:${name}:state`);
    if (stdout.toLowerCase().includes("idle") && currentState === "busy") {
      await redisConnection.set(`printer:${name}:state`, "idle");
    } else if (stdout.toLowerCase().includes("printing")) {
      await redisConnection.set(`printer:${name}:state`, "busy");
    }

    // 3. Supplies Check
    try {
      const supplies = await adapter.getSupplies();
      await redisConnection.setex(`supplies:${name}`, 300, JSON.stringify(supplies));
    } catch (suppliesErr) {
      console.warn(`[HealthCheck] Failed to get supplies for ${name}:`, suppliesErr);
    }

    // 4. Finalize
    const prevHealth = await redisConnection.get(`printer:${name}:health`);
    await redisConnection.set(`printer:${name}:health`, "healthy");

    if (prevHealth !== "healthy") {
      await removePrinterFromAttemptedJobs(name);
    }

    const infoStr = await redisConnection.get(`printer:${name}:info`) || "{}";
    const info = JSON.parse(infoStr);

    const capabilities = await getCapabilitiesConfig();
    const caps = capabilities[name] || {};

    const newInfo = {
      ...info,
      name,
      alias: caps.alias,
      capabilities: caps.capabilities || [],
      type: caps.type || "unknown"
    };
    await redisConnection.set(`printer:${name}:info`, JSON.stringify(newInfo));

  } catch (err) {
    console.error(`[HealthCheck] Failed for ${name}:`, err);
    await redisConnection.set(`printer:${name}:health`, "flagged");
  }
}

let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Phase 1: Heartbeat Loop
 */
export async function startHeartbeatLoop(): Promise<void> {
  console.log("[Heartbeat] Starting heartbeat loop...");

  const sweep = async () => {
    try {
      const printers = await listPrintersFromCUPS();
      const printerNames = printers.map(p => p.name);

      if (printerNames.length > 0) {
        await redisConnection.sadd("fleet:printers", ...printerNames);
      }

      for (const p of printers) {
        // Save description
        const infoStr = await redisConnection.get(`printer:${p.name}:info`) || "{}";
        const info = JSON.parse(infoStr);
        info.description = p.description;
        await redisConnection.set(`printer:${p.name}:info`, JSON.stringify(info));

        // Track previous health and state
        const prevHealth = await redisConnection.get(`printer:${p.name}:health`);
        const prevState = await redisConnection.get(`printer:${p.name}:state`);

        await runComprehensiveHealthCheck(p.name);

        const newHealth = await redisConnection.get(`printer:${p.name}:health`);
        const newState = await redisConnection.get(`printer:${p.name}:state`);

        if (prevHealth !== newHealth || prevState !== newState) {
          eventBus.emit("printer_state_changed", {
            printer: p.name,
            state: newHealth === "flagged" ? "flagged" : (newState || "idle")
          });
        }
      }
      console.log("[Heartbeat] Sweep completed.");
    } catch (err) {
      console.error("[Heartbeat] Sweep failed:", err);
    }
  };

  // Run immediately
  await sweep();

  // Schedule every 5 mins
  if (!heartbeatInterval) {
    heartbeatInterval = setInterval(sweep, 300000);
  }
}
