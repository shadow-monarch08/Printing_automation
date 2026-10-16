import { cupsCommands, PrintFileOptions } from "../../commands/cups.commands";
import { systemCommands } from "../../commands/system.commands";
import * as networkUtils from "../utils/network";
import { ValidationError } from "../utils/errors";
import ipp from "ipp";
import { JobPollStatus } from "../../adapters/IPrinterAdapter";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";
import { eventBus } from "../utils/eventBus";
import { PrinterFactory } from "../../factories/printer.factory";
import { removePrinterFromAttemptedJobs, printMasterQueue, wakeUpDelayedJobs } from "../../infrastructure/printMaster.queue";
import db from "../../infrastructure/database";
import { PrinterInfo, PrinterSupplyStatus } from "../types";

export interface PrinterRecord {
  id: string;
  alias: string | null;
  capabilities: string[];
  ipp_uri: string | null;
  type: string;
  capabilities_source: "auto" | "manual";
  added_at: string;
}

export function getPrinterFromDB(id: string): PrinterRecord | null {
  try {
    const row = db.prepare(`SELECT * FROM printers WHERE id = ?`).get(id) as any;
    if (!row) return null;
    let capabilities: string[] = [];
    try {
      if (row.capabilities) {
        capabilities = JSON.parse(row.capabilities);
      }
    } catch {
      capabilities = [];
    }
    return {
      id: row.id,
      alias: row.alias || null,
      capabilities: Array.isArray(capabilities) ? capabilities : [],
      ipp_uri: row.ipp_uri || null,
      type: row.type || "unknown",
      capabilities_source: row.capabilities_source === "manual" ? "manual" : "auto",
      added_at: row.added_at,
    };
  } catch (err) {
    console.error(`[getPrinterFromDB] Failed to query printer ${id}:`, err);
    return null;
  }
}

export function getAllPrintersFromDB(): PrinterRecord[] {
  try {
    const rows = db.prepare(`SELECT * FROM printers`).all() as any[];
    return rows.map((row) => {
      let capabilities: string[] = [];
      try {
        if (row.capabilities) {
          capabilities = JSON.parse(row.capabilities);
        }
      } catch {
        capabilities = [];
      }
      return {
        id: row.id,
        alias: row.alias || null,
        capabilities: Array.isArray(capabilities) ? capabilities : [],
        ipp_uri: row.ipp_uri || null,
        type: row.type || "unknown",
        capabilities_source: row.capabilities_source === "manual" ? "manual" : "auto",
        added_at: row.added_at,
      };
    });
  } catch (err) {
    console.error(`[getAllPrintersFromDB] Failed to query printers:`, err);
    return [];
  }
}

export function deletePrinterFromDB(id: string): void {
  try {
    db.prepare(`DELETE FROM printers WHERE id = ?`).run(id);
  } catch (err) {
    console.error(`[deletePrinterFromDB] Failed to delete printer ${id}:`, err);
  }
}

export function upsertPrinterToDB(
  id: string,
  alias?: string | null,
  capabilities?: string[] | null,
  ippUri?: string | null,
  type?: string | null,
  capabilitiesSource?: "auto" | "manual" | null
): void {
  const existing = getPrinterFromDB(id);

  // Admin Manual Override Immunity:
  // If the existing record is 'manual' and this caller did not explicitly specify 'manual',
  // preserve existing manual capabilities and manual source!
  let finalCapabilities = capabilities;
  let finalSource = capabilitiesSource;

  if (existing && existing.capabilities_source === "manual" && capabilitiesSource !== "manual") {
    finalCapabilities = existing.capabilities;
    finalSource = "manual";
  }

  const stmt = db.prepare(`
    INSERT INTO printers (id, alias, capabilities, ipp_uri, type, capabilities_source, added_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      alias = COALESCE(?, alias),
      capabilities = COALESCE(?, capabilities),
      ipp_uri = COALESCE(?, ipp_uri),
      type = COALESCE(?, type),
      capabilities_source = COALESCE(?, capabilities_source)
  `);

  const capsJson = finalCapabilities ? JSON.stringify(finalCapabilities) : null;
  const safeSource = finalSource || null;
  const safeType = type || null;
  const safeAlias = alias || null;
  const safeUri = ippUri || null;

  stmt.run(
    id,
    safeAlias,
    capsJson,
    safeUri,
    safeType || "unknown",
    safeSource || "auto",
    // Conflict updates:
    safeAlias,
    capsJson,
    safeUri,
    safeType,
    safeSource
  );
}

export async function getCapabilitiesConfig(): Promise<any> {
  const records = getAllPrintersFromDB();
  const config: Record<string, { capabilities: string[]; type: string; alias?: string; capabilities_source: string }> = {};
  for (const r of records) {
    config[r.id] = {
      capabilities: r.capabilities,
      type: r.type,
      alias: r.alias || undefined,
      capabilities_source: r.capabilities_source,
    };
  }
  return config;
}

export async function updateCapabilitiesConfig(newConfig: any): Promise<void> {
  if (!newConfig || typeof newConfig !== "object") return;
  for (const [id, val] of Object.entries(newConfig) as [string, any][]) {
    upsertPrinterToDB(
      id,
      val.alias,
      val.capabilities,
      undefined,
      val.type,
      val.capabilities_source
    );
  }
}

export async function updateAlias(printerName: string, alias: string): Promise<void> {
  const existing = getPrinterFromDB(printerName);
  upsertPrinterToDB(
    printerName,
    alias,
    existing?.capabilities || [],
    existing?.ipp_uri,
    existing?.type,
    existing?.capabilities_source
  );
  const infoRaw = (await redisConnection.get(REDIS_KEYS.printerInfo(printerName))) || "{}";
  let info: any = {};
  try { info = JSON.parse(infoRaw); } catch {}
  info.alias = alias;
  await redisConnection.set(REDIS_KEYS.printerInfo(printerName), JSON.stringify(info));
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
    const dbPrinters = getAllPrintersFromDB();
    const dbMap = new Map(dbPrinters.map(p => [p.id, p]));

    for (const line of lines) {
      // Case-insensitive match to handle different CUPS/locale output formats
      const match = line.match(/^printer\s+(\S+)\s+(.*)/i);
      if (match) {
        const name = match[1];
        const record = dbMap.get(name);
        printers.push({
          name,
          description: match[2],
          status: line.toLowerCase().includes("idle") ? "idle" : "busy",
          alias: record?.alias || undefined,
          capabilities: record?.capabilities || [],
          type: record?.type || "unknown",
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
      const dbPrinters = getAllPrintersFromDB();
      const dbMap = new Map(dbPrinters.map(p => [p.id, p]));
      for (const line of lines) {
        const match = line.match(/^printer\s+(\S+)\s+(.*)/i);
        if (match) {
          const name = match[1];
          const record = dbMap.get(name);
          printers.push({
            name,
            description: match[2],
            status: line.toLowerCase().includes("idle") ? "idle" : "busy",
            alias: record?.alias || undefined,
            capabilities: record?.capabilities || [],
            type: record?.type || "unknown",
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
    const printerNames = await redisConnection.smembers(REDIS_KEYS.FLEET_PRINTERS);
    const printers: PrinterInfo[] = [];

    for (const name of printerNames) {
      const [health, state, infoRaw, suppliesRaw] = await Promise.all([
        redisConnection.get(REDIS_KEYS.printerHealth(name)),
        redisConnection.get(REDIS_KEYS.printerState(name)),
        redisConnection.get(REDIS_KEYS.printerInfo(name)),
        redisConnection.get(REDIS_KEYS.supplies(name))
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

      // If capabilities missing in Redis, fall back to SQLite
      let caps: string[] = info.capabilities || [];
      if (!caps || caps.length === 0) {
        const dbRecord = getPrinterFromDB(name);
        if (dbRecord && dbRecord.capabilities.length > 0) {
          caps = dbRecord.capabilities;
        }
      }

      printers.push({
        name,
        description: info.description || name,
        status,
        alias: info.alias,
        capabilities: caps,
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
  optionsOrCopies: PrintFileOptions | number = {},
  legacyDuplex?: "single" | "double"
): Promise<string> {
  let options: PrintFileOptions;

  if (typeof optionsOrCopies === "number") {
    options = {
      copies: optionsOrCopies,
      duplex: legacyDuplex || "single",
    };
  } else {
    options = optionsOrCopies;
  }

  const { cupsJobId } = await cupsCommands.printFile(printer || null, filePath, options);
  return cupsJobId;
}

/**
 * Truthful, two-tier CUPS job status resolution engine:
 * Tier 1: High-precision native IPP query to http://localhost:631 (RFC 8011)
 * Tier 2: POSIX lpstat -W not-completed vs lpstat -W completed history fallback
 */
export async function queryCupsJobStatus(printerName: string, cupsJobId: string): Promise<JobPollStatus> {
  const numericJobId = parseInt(cupsJobId.split("-").pop() || cupsJobId, 10);

  // --- TIER 1: Native Localhost CUPS IPP Query (RFC 8011) ---
  if (!isNaN(numericJobId)) {
    try {
      const printer = new (ipp as any).Printer("http://localhost:631/jobs");
      const msg = {
        "operation-attributes-tag": {
          "attributes-charset": "utf-8",
          "attributes-natural-language": "en",
          "job-uri": `ipp://localhost:631/jobs/${numericJobId}`,
        },
      };

      const res: any = await new Promise((resolve, reject) => {
        printer.execute("Get-Job-Attributes", msg, (err: any, res: any) => {
          if (err) return reject(err);
          resolve(res);
        });
      });

      const attrs = res?.["job-attributes-tag"];
      if (attrs) {
        const state = attrs["job-state"];
        // IPP RFC 8011 Job States:
        // 3: pending, 4: pending-held, 5: processing, 6: processing-stopped, 7: canceled, 8: aborted, 9: completed
        if (state === 9 || state === "completed") return "completed";
        if (state === 7 || state === 8 || state === "canceled" || state === "aborted") return "aborted";
        if (state === 4 || state === 6 || state === "pending-held" || state === "processing-stopped") return "held_or_stopped";
        if (state === 3 || state === 5 || state === "pending" || state === "processing") return "printing";
      }
    } catch {
      // Local IPP socket / HTTP query failed; smoothly fall through to Tier 2 CLI verification
    }
  }

  // --- TIER 2: CLI Invariant Verification (lpstat -W) ---
  try {
    // 2a. Check active queue (lpstat -W not-completed -o [printerName])
    const { stdout: activeOut } = await cupsCommands.getActiveJobs(printerName);
    const activeLine = activeOut
      .split("\n")
      .find((line: string) => line.includes(cupsJobId) || (numericJobId && line.includes(String(numericJobId))));

    if (activeLine) {
      const lower = activeLine.toLowerCase();
      if (lower.includes("held") || lower.includes("stopped")) {
        return "held_or_stopped";
      }
      return "printing";
    }

    // 2b. If not active, check completed history (lpstat -W completed -o [printerName])
    const { stdout: completedOut } = await cupsCommands.getCompletedJobs(printerName);
    const completedLine = completedOut
      .split("\n")
      .find((line: string) => line.includes(cupsJobId) || (numericJobId && line.includes(String(numericJobId))));

    if (completedLine) {
      return "completed";
    }

    // 2c. If missing from both active queue AND completed history -> Aborted / Filter Failed
    return "aborted";
  } catch (cliErr) {
    console.error(`[queryCupsJobStatus] CLI check failed for ${cupsJobId} on ${printerName}:`, cliErr);
    return "unreachable";
  }
}

/**
 * Gets the status of a specific CUPS job.
 */
export async function getJobStatus(printerName: string, cupsJobId: string): Promise<string> {
  return queryCupsJobStatus(printerName, cupsJobId);
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

export interface DiscoveredDevice {
  uri: string;
  rawModel: string;
  type: "usb" | "network" | "ipp";
}

/**
 * Parses a single line from CUPS `lpinfo -v` into a normalized discovered device.
 * Universal support across USB (Epson, Canon, Brother, HP), Network Copiers (socket://, lpd://), and IPP/AirPrint.
 */
export function parseLpinfoDeviceLine(line: string): DiscoveredDevice | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Split on whitespace: [class, uri, ...] (e.g. "direct usb://..." or "network socket://...")
  const parts = trimmed.split(/\s+/);
  const uri = parts[1];

  if (!uri) return null;
  const lowerUri = uri.toLowerCase();

  // 1. USB Devices (usb://, hp:/usb/)
  if (lowerUri.startsWith("usb://") || lowerUri.startsWith("hp:/usb/")) {
    let rawModel = "USB Printer";

    if (lowerUri.startsWith("usb://")) {
      // Format: usb://<VENDOR>/<MODEL_WITH_ENCODING>?serial=...
      const pathPart = uri.substring("usb://".length).split("?")[0];
      const segments = pathPart.split("/").filter(Boolean);
      if (segments.length >= 2) {
        const vendor = decodeURIComponent(segments[0]);
        const model = decodeURIComponent(segments[1]);
        rawModel = `${vendor} ${model}`.trim();
      } else if (segments.length === 1) {
        rawModel = decodeURIComponent(segments[0]);
      }
    } else if (lowerUri.startsWith("hp:/usb/")) {
      // Format: hp:/usb/HP_LaserJet_1020?serial=...
      const pathPart = uri.substring("hp:/usb/".length).split("?")[0];
      const model = decodeURIComponent(pathPart).replace(/_/g, " ");
      rawModel = model || "HP USB Printer";
    }

    return { uri, rawModel, type: "usb" };
  }

  // 2. Heavy-Duty Network Copiers / Raw sockets (socket://, lpd://)
  if (lowerUri.startsWith("socket://") || lowerUri.startsWith("lpd://")) {
    const hostPort = uri.replace(/^(socket|lpd):\/\//i, "").split("/")[0];
    const host = hostPort.split(":")[0];
    return {
      uri,
      rawModel: `Network Copier (${host})`,
      type: "network",
    };
  }

  // 3. Modern IPP / IPPS / AirPrint / mDNS
  if (
    lowerUri.startsWith("ipp://") ||
    lowerUri.startsWith("ipps://") ||
    lowerUri.startsWith("dnssd://") ||
    lowerUri.startsWith("mdns://")
  ) {
    let rawModel = "Network IPP Printer";
    if (lowerUri.startsWith("dnssd://")) {
      // Format: dnssd://Canon%20G3010%20series._ipp._tcp.local/?uuid=...
      const hostPart = uri.replace(/^dnssd:\/\//i, "").split("._")[0];
      rawModel = `${decodeURIComponent(hostPart)} (AirPrint)`;
    } else {
      const host = uri.replace(/^(ipp|ipps):\/\//i, "").split("/")[0].split(":")[0];
      rawModel = `Network Printer (${host})`;
    }
    return { uri, rawModel, type: "ipp" };
  }

  return null;
}

/**
 * Normalizes device URIs for collision detection, orphan diffing, and hardware deduplication.
 * Strips volatile parameters (&interface=...) and standardizes scheme and case.
 */
export function normalizePrinterUri(uri: string): string {
  if (!uri) return "";
  const trimmed = uri.trim();
  
  // Extract base scheme + path and canonical serial number
  const [base, query] = trimmed.split("?");
  const normalizedBase = base.toLowerCase().replace(/\/+$/, "");

  if (!query) {
    return normalizedBase;
  }

  // Extract serial if present, ignoring volatile parameters like &interface=1
  const serialMatch = /(?:^|[?&])serial=([^&]+)/i.exec(query);
  if (serialMatch) {
    return `${normalizedBase}?serial=${serialMatch[1].toLowerCase()}`;
  }

  return normalizedBase;
}

/**
 * Generates a unique, collision-safe CUPS queue name.
 * Prevents identical printer models (e.g. multiple Epson L3150s or HP 1020s) from overwriting existing configured queues.
 */
export async function generateUniqueQueueName(baseModel: string, uri: string): Promise<string> {
  let cleanName = baseModel.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (!cleanName) cleanName = "Printer";

  // Check existing printers in SQLite and CUPS
  const existingRecords = getAllPrintersFromDB();
  const cupsOutput = await cupsCommands.getPrinterStatus().then(r => r.stdout).catch(() => "");

  // Helper: check if a candidate queue name is taken by a DIFFERENT printer (different URI)
  const isNameTaken = (name: string): boolean => {
    // 1. Check SQLite
    const dbRecord = existingRecords.find(p => p.id.toLowerCase() === name.toLowerCase());
    if (dbRecord) {
      if (dbRecord.ipp_uri && dbRecord.ipp_uri.toLowerCase() !== uri.toLowerCase()) {
        return true;
      }
    }
    // 2. Check CUPS
    const cupsMatch = new RegExp(`device for ${name}:\\s*(.+)`, "i").exec(cupsOutput);
    if (cupsMatch) {
      const configuredUri = cupsMatch[1].trim().toLowerCase();
      if (configuredUri !== uri.toLowerCase()) {
        return true;
      }
    }
    return false;
  };

  if (!isNameTaken(cleanName)) {
    return cleanName;
  }

  // Strategy 1: Append USB serial number fragment if present in URI (e.g. ?serial=123456)
  const serialMatch = /(?:^|[?&])serial=([^&]+)/i.exec(uri);
  if (serialMatch && serialMatch[1]) {
    const serialClean = serialMatch[1].replace(/[^a-zA-Z0-9]/g, "");
    if (serialClean.length > 0) {
      const serialSuffix = serialClean.slice(-6); // last 6 characters
      const candidateWithSerial = `${cleanName}_${serialSuffix}`;
      if (!isNameTaken(candidateWithSerial)) {
        return candidateWithSerial;
      }
    }
  }

  // Strategy 2: Sequential numbering: _2, _3, _4...
  let index = 2;
  while (isNameTaken(`${cleanName}_${index}`)) {
    index++;
  }
  return `${cleanName}_${index}`;
}

/**
 * Universal Discovery: Scans CUPS hardware for all unconfigured printers across USB, Network, and IPP.
 * Includes hardware deduplication for HP dual backends (hp:/ and usb://) and normalized URI diffing.
 */
export async function getUnconfiguredPrinters(): Promise<DiscoveredDevice[]> {
  try {
    // 1. Get all physical devices
    const lpinfoRes = await cupsCommands.listDevices();
    const physicalDevices = lpinfoRes.stdout.split("\n").filter(Boolean);

    let rawDevices = physicalDevices
      .map(parseLpinfoDeviceLine)
      .filter((d): d is DiscoveredDevice => d !== null);

    // 2. Hardware Deduplication (HP Conflict Fix):
    // If an HP device appears as both hp:/usb/ and usb://HP/, collapse and prefer hp:/usb/
    const hpUsbDevices = rawDevices.filter(d => d.uri.toLowerCase().startsWith("hp:/usb/"));
    if (hpUsbDevices.length > 0) {
      rawDevices = rawDevices.filter(d => {
        const lower = d.uri.toLowerCase();
        if (lower.startsWith("usb://") && (lower.includes("hp") || lower.includes("hewlett-packard"))) {
          // If there's an hp:/usb/ device matching the model or serial, drop the generic usb://HP/ entry
          const serialMatch = /(?:^|[?&])serial=([^&]+)/i.exec(d.uri);
          const hasHpMatch = hpUsbDevices.some(hp => {
            if (serialMatch && hp.uri.toLowerCase().includes(serialMatch[1].toLowerCase())) return true;
            const modelPart = d.rawModel.toLowerCase().replace(/[^a-z0-9]/g, "");
            const hpModelPart = hp.rawModel.toLowerCase().replace(/[^a-z0-9]/g, "");
            return modelPart && hpModelPart && (modelPart.includes(hpModelPart) || hpModelPart.includes(modelPart));
          });
          return !hasHpMatch;
        }
        return true;
      });
    }

    // 3. Get currently configured URIs
    const lpstatRes = await cupsCommands.getPrinterStatus().catch(() => ({ stdout: "" }));
    const configuredUris = lpstatRes.stdout.split("\n")
      .map((line: string) => {
        const match = line.match(/device for [^:]+:\s*(.+)/);
        return match ? match[1].trim() : null;
      })
      .filter(Boolean) as string[];

    const normalizedConfigured = configuredUris.map(normalizePrinterUri);

    // 4. Diff: Any device whose normalized URI does not match a configured URI is unconfigured
    const orphaned = rawDevices.filter((dev) => {
      const normDev = normalizePrinterUri(dev.uri);
      return !normalizedConfigured.some(cUri => cUri === normDev || normDev.startsWith(cUri) || cUri.startsWith(normDev));
    });

    return orphaned;
  } catch (err) {
    console.error("[getUnconfiguredPrinters] Discovery failed:", err);
    return [];
  }
}

/**
 * Probes a targeted commercial network copier by IP address using TCP socket ping and SNMP Printer-MIB.
 * Standard ports: 9100 (AppSocket/JetDirect), 631 (IPP), 515 (LPD).
 */
export async function probeCopierByIp(ip: string): Promise<DiscoveredDevice> {
  const cleanIp = ip.trim();
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(cleanIp)) {
    throw new ValidationError("INVALID_IP_FORMAT", `Invalid IPv4 address format: '${cleanIp}'`);
  }

  // 1. Probe printer ports (9100, 631, 515)
  const isPort9100 = await networkUtils.pingTcpPort(cleanIp, 9100, 2000);
  const isPort631 = !isPort9100 ? await networkUtils.pingTcpPort(cleanIp, 631, 2000) : false;
  const isPort515 = !isPort9100 && !isPort631 ? await networkUtils.pingTcpPort(cleanIp, 515, 2000) : false;

  if (!isPort9100 && !isPort631 && !isPort515) {
    throw new ValidationError(
      "COPIER_UNREACHABLE",
      `No stationary printing ports (9100 AppSocket, 631 IPP, 515 LPD) are accessible at ${cleanIp}. Verify copier is powered on and network cable connected.`
    );
  }

  // 2. Query SNMP sysDescr to detect manufacturer and model
  let rawModel = `Network Copier (${cleanIp})`;
  try {
    const { stdout } = await systemCommands.snmpWalk(cleanIp, "1.3.6.1.2.1.1.1.0");
    const match = /STRING:\s*"?([^"\r\n]+)"?/i.exec(stdout);
    if (match && match[1]) {
      const desc = match[1].trim();
      const firstChunk = desc.split(/[,;]/)[0].trim();
      if (firstChunk.length > 3) {
        rawModel = firstChunk;
      }
    }
  } catch (err) {
    console.warn(`[probeCopierByIp] SNMP walk on ${cleanIp} failed or timed out, using fallback label:`, err);
  }

  // Determine preferred URI and type
  let uri = `socket://${cleanIp}:9100`;
  let type: "network" | "ipp" = "network";

  if (isPort9100) {
    uri = `socket://${cleanIp}:9100`;
    type = "network";
  } else if (isPort631) {
    uri = `ipp://${cleanIp}:631/ipp/print`;
    type = "ipp";
  } else if (isPort515) {
    uri = `lpd://${cleanIp}/lp`;
    type = "network";
  }

  return {
    uri,
    rawModel,
    type,
  };
}



/**
 * 5-Tier Fallback Cascade for Capability Discovery:
 * Tier 1: Native IPP (RFC 8011) query to http://localhost:631/printers/<name>
 * Tier 2: Universal Vendor PPD Parser (lpoptions -p <name> -l)
 * Tier 3: Physical Marker Telemetry Cross-Validation (queryCupsPrinterMarkers)
 * Tier 4: Hardware Model & URI Pattern Heuristics
 * Tier 5: Safe Baseline Fallback (['grayscale', 'a4'])
 */
export async function probePrinterCapabilities(
  queueName: string,
  modelHint?: string,
  uriHint?: string
): Promise<string[]> {
  const capabilities = new Set<string>();

  let colorDetermined = false;
  let duplexDetermined = false;
  let duplexUnitInstalled: boolean | null = null; // null = unspecified, true = installed, false = absent

  // --- TIER 1: Native Local IPP (RFC 8011) Query ---
  try {
    const encodedName = encodeURIComponent(queueName);
    const printer = new (ipp as any).Printer(`http://localhost:631/printers/${encodedName}`);
    const msg = {
      "operation-attributes-tag": {
        "attributes-charset": "utf-8",
        "attributes-natural-language": "en",
        "printer-uri": `ipp://localhost:631/printers/${encodedName}`,
        "requested-attributes": [
          "color-supported",
          "print-color-mode-supported",
          "sides-supported",
          "media-supported",
          "media-default",
        ],
      },
    };

    const res: any = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("IPP capability query timeout")), 2500);
      printer.execute("Get-Printer-Attributes", msg, (err: any, data: any) => {
        clearTimeout(timer);
        if (err) return reject(err);
        resolve(data);
      });
    });

    const attrs = res?.["printer-attributes-tag"];
    if (attrs) {
      // Color support: IPP RFC 8011 color-supported is the primary authority
      const colorSupported = attrs["color-supported"];
      const colorModes = Array.isArray(attrs["print-color-mode-supported"])
        ? attrs["print-color-mode-supported"]
        : (attrs["print-color-mode-supported"] ? [attrs["print-color-mode-supported"]] : []);

      if (colorSupported === false || colorSupported === 0) {
        capabilities.add("grayscale");
        colorDetermined = true;
      } else if (colorSupported === true || colorSupported === 1) {
        capabilities.add("color");
        colorDetermined = true;
      } else if (colorModes.length > 0) {
        // Only if color-supported is omitted: If only monochrome modes exist, mark grayscale
        if (colorModes.every((m: string) => /monochrome|gray/i.test(String(m)))) {
          capabilities.add("grayscale");
          colorDetermined = true;
        } else if (colorModes.every((m: string) => /color|rgb/i.test(String(m)))) {
          capabilities.add("color");
          colorDetermined = true;
        }
      }

      // Duplex support: sides-supported
      const sides = Array.isArray(attrs["sides-supported"])
        ? attrs["sides-supported"]
        : (attrs["sides-supported"] ? [attrs["sides-supported"]] : []);

      if (sides.length > 0) {
        if (sides.every((s: string) => /one-sided/i.test(String(s)))) {
          duplexDetermined = true; // strictly simplex
        } else if (sides.some((s: string) => /two-sided/i.test(String(s)))) {
          capabilities.add("duplex");
          duplexDetermined = true;
        }
      }
    }
  } catch {
    // Local IPP query unavailable, fall through to Tier 2
  }

  // --- TIER 2: Universal Vendor PPD Parser (lpoptions -p <name> -l) ---
  if (!colorDetermined || !duplexDetermined) {
    try {
      const { stdout } = await cupsCommands.getPrinterOptions(queueName);
      if (stdout && stdout.trim().length > 0) {
        const lines = stdout.split("\n");

        for (const line of lines) {
          const colonIdx = line.indexOf(":");
          if (colonIdx === -1) continue;
          const optKey = line.substring(0, colonIdx).trim().toLowerCase();
          const optValues = line.substring(colonIdx + 1).trim();

          // Extract active selection marked with an asterisk '*' (PPD / CUPS standard RFC/Adobe 4.3)
          const activeMatch = optValues.match(/\*([^\s]+)/);
          const activeChoice = activeMatch ? activeMatch[1].toLowerCase() : "";
          const choices = optValues.split(/\s+/).map(c => c.replace(/^\*/, "").toLowerCase());

          // 1. Check for physical installable duplex accessory options (RFC / Adobe PPD 4.3 Section 5.17)
          // e.g. OptionDuplex/Duplex Unit: *False True, InstalledDuplex/Duplexer: *False Installed
          if (
            optKey.startsWith("optionduplex") ||
            optKey.startsWith("installedduplex") ||
            optKey.startsWith("duplexunit") ||
            optKey.startsWith("jclduplexunit")
          ) {
            if (/(?:false|none|notinstalled|no\b)/i.test(activeChoice)) {
              duplexUnitInstalled = false;
              capabilities.delete("duplex");
              duplexDetermined = true;
            } else if (/(?:true|installed|yes\b)/i.test(activeChoice)) {
              duplexUnitInstalled = true;
              capabilities.add("duplex");
              duplexDetermined = true;
            }
          }

          // 2. Color detection across vendor PPD specifications
          if (!colorDetermined) {
            const isColorOption = (
              optKey.startsWith("colormodel") ||
              optKey.startsWith("print-color-mode") ||
              optKey.startsWith("brcolor") ||
              optKey.startsWith("cncolormode") ||
              optKey.startsWith("hpcolormode")
            );

            if (isColorOption) {
              if (activeChoice) {
                if (/(?:gray|grayscale|mono|monochrome|black\b)/i.test(activeChoice)) {
                  capabilities.add("grayscale");
                  colorDetermined = true;
                } else if (/(?:rgb|cmyk|\bcolor\b)/i.test(activeChoice)) {
                  capabilities.add("color");
                  colorDetermined = true;
                }
              } else {
                // No asterisk marked: inspect overall choices
                if (choices.every(c => /(?:gray|grayscale|mono|monochrome|black)/i.test(c))) {
                  capabilities.add("grayscale");
                  colorDetermined = true;
                } else if (choices.some(c => /(?:rgb|cmyk|\bcolor\b)/i.test(c))) {
                  capabilities.add("color");
                  colorDetermined = true;
                }
              }
            }
          }

          // 3. Duplex modes (Duplex, sides, BRDuplex, CNDuplex, JCLDuplex)
          if (!duplexDetermined && duplexUnitInstalled !== false) {
            const isDuplexOption = (
              optKey.startsWith("duplex") ||
              optKey.startsWith("sides") ||
              optKey.startsWith("brduplex") ||
              optKey.startsWith("cnduplex") ||
              optKey.startsWith("jclduplex")
            );

            if (isDuplexOption) {
              if (activeChoice && /(?:duplexnotumble|duplextumble|two-sided-long-edge|two-sided-short-edge|\bduplex\b)/i.test(activeChoice)) {
                capabilities.add("duplex");
                duplexDetermined = true;
              } else if (activeChoice && /(?:none|one-sided|\bsimplex\b)/i.test(activeChoice)) {
                // If active choice is None, check if duplex choices exist and duplex unit is explicitly confirmed installed
                const hasDuplexChoice = choices.some(c => /(?:duplexnotumble|duplextumble|two-sided)/i.test(c));
                if (hasDuplexChoice && duplexUnitInstalled === true) {
                  capabilities.add("duplex");
                  duplexDetermined = true;
                }
              }
            }
          }
        }
      }
    } catch {
      // lpoptions unavailable
    }
  }

  // --- TIER 3: Physical Marker Telemetry Cross-Validation (Dynamic Hardware Reality) ---
  // Queries local CUPS markers / supplies. If the physical printer only has a black cartridge
  // and zero color cartridges, hardware physics dictates it cannot print in color!
  try {
    const markers = await queryCupsPrinterMarkers(queueName);
    if (markers && markers.supplies) {
      if (markers.supplies.color !== null && markers.supplies.color !== undefined) {
        capabilities.delete("grayscale");
        capabilities.add("color");
        colorDetermined = true;
      } else if (markers.supplies.black !== null && markers.supplies.black !== undefined && markers.supplies.color === null) {
        // Physical engine only contains black cartridge!
        capabilities.delete("color");
        capabilities.add("grayscale");
        colorDetermined = true;
      }
    }
  } catch {
    // Marker telemetry unavailable
  }

  // --- TIER 4: Hardware Model & URI Pattern Heuristics ---
  const combinedContext = `${queueName} ${modelHint || ""} ${uriHint || ""}`.toLowerCase();

  if (!colorDetermined) {
    const isKnownColorFamily = /ecotank|megatank|smart tank|deskjet|inkjet|pixma|color laser|colorlaser|l3150|l3250|g2010|g3010/i.test(combinedContext);
    const isKnownMonochromeFamily = /laserjet|laser|p1102|1020|m1005|hl-1210|hl-l23|dcp-l|mfc-l|hl-l|mono/i.test(combinedContext);

    if (isKnownColorFamily) {
      capabilities.add("color");
      colorDetermined = true;
    } else if (isKnownMonochromeFamily) {
      capabilities.add("grayscale");
      colorDetermined = true;
    }
  }

  if (!duplexDetermined && duplexUnitInstalled !== false) {
    // Model suffix indicating auto-duplex:
    // Suffixes: -d, -dn, -dw, or digit followed by d/dn/dw (e.g. 2540dn, 404dw, 2520d), or keywords duplex, two-sided
    const isKnownDuplexModel = /(?:[-_\s]d[wn]?\b|\d+d[wn]?\b|duplex|two-sided)/i.test(combinedContext) ||
      /m402d[nw]|m404d[nw]|l2540d[nw]|l2520d|l2350d[nw]|c3000d[nw]/i.test(combinedContext);

    if (isKnownDuplexModel) {
      capabilities.add("duplex");
      duplexDetermined = true;
    }
  }

  // --- TIER 5: Safe Baseline Fallback ---
  // Standard kiosk document format is A4
  capabilities.add("a4");

  // If neither color nor grayscale was determined, safe default to grayscale
  if (!capabilities.has("color") && !capabilities.has("grayscale")) {
    capabilities.add("grayscale");
  }

  const result = Array.from(capabilities);
  console.log(`[probePrinterCapabilities] Probed ${queueName} (${result.join(", ")}): colorDetermined=${colorDetermined}, duplexDetermined=${duplexDetermined}`);
  return result;
}

/**
 * Universal Supply & Marker Telemetry:
 * Directly queries local CUPS (http://localhost:631/printers/<name>) via IPP RFC 8011
 * to retrieve marker-levels, marker-names, and printer-state-reasons.
 */
export async function queryCupsPrinterMarkers(printerName: string): Promise<PrinterSupplyStatus | null> {
  try {
    const encodedName = encodeURIComponent(printerName);
    const printer = new (ipp as any).Printer(`http://localhost:631/printers/${encodedName}`);
    const msg = {
      "operation-attributes-tag": {
        "attributes-charset": "utf-8",
        "attributes-natural-language": "en",
        "printer-uri": `ipp://localhost:631/printers/${encodedName}`,
        "requested-attributes": [
          "marker-names",
          "marker-levels",
          "marker-colors",
          "marker-types",
          "printer-state-reasons",
          "printer-state"
        ]
      }
    };

    const res: any = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Local IPP marker query timeout")), 3000);
      printer.execute("Get-Printer-Attributes", msg, (err: any, data: any) => {
        clearTimeout(timer);
        if (err) return reject(err);
        resolve(data);
      });
    });

    const attrs = res?.["printer-attributes-tag"];
    if (!attrs) return null;

    const names: string[] = Array.isArray(attrs["marker-names"])
      ? attrs["marker-names"]
      : (attrs["marker-names"] ? [attrs["marker-names"]] : []);
    const rawLevels: any = attrs["marker-levels"];
    const levels: number[] = Array.isArray(rawLevels)
      ? rawLevels.map((l: any) => typeof l === "number" ? l : parseInt(l, 10))
      : (typeof rawLevels === "number" ? [rawLevels] : []);

    let black: number | null = null;
    const colorLevels: number[] = [];

    for (let i = 0; i < levels.length; i++) {
      const lvl = levels[i];
      if (lvl < 0 || isNaN(lvl)) continue;
      const name = (names[i] || "").toLowerCase();
      if (name.includes("black") || name.includes("k") || (!name && i === 0)) {
        black = lvl;
      } else {
        colorLevels.push(lvl);
      }
    }

    const color = colorLevels.length > 0 ? Math.min(...colorLevels) : null;
    const reasons = String(attrs["printer-state-reasons"] || "");
    const paperEmpty = reasons.includes("media-empty") || reasons.includes("paper-empty");

    if (black !== null || color !== null || paperEmpty) {
      return {
        paper: paperEmpty ? "empty" : "ready",
        supplies: { black, color }
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Industrial-Grade Health Check & Self-Healing Engine:
 * 1. Probes physical hardware/protocol adapter.
 * 2. Self-heals quarantined printers (strikes >= 3 or health === "flagged") when device recovers.
 * 3. Lock-guarded concurrency protection against overwriting active 'busy' jobs.
 * 4. Hierarchical supplies telemetry with native CUPS marker fallback.
 */
export async function runComprehensiveHealthCheck(name: string): Promise<void> {
  try {
    const strikesStr = await redisConnection.get(REDIS_KEYS.printerStrikes(name));
    const strikes = parseInt(strikesStr || "0", 10);
    const prevHealth = await redisConnection.get(REDIS_KEYS.printerHealth(name));

    const adapter = await PrinterFactory.getAdapter(name);
    if (!adapter) {
      console.warn(`[HealthCheck] No adapter found for ${name}`);
      await redisConnection.set(REDIS_KEYS.printerHealth(name), "flagged");
      return;
    }

    // 1. Digital Hardware Probe via Protocol Adapter
    const isHealthy = await adapter.healthCheck();
    if (!isHealthy) {
      await redisConnection.set(REDIS_KEYS.printerHealth(name), "flagged");
      return;
    }

    // 2. Hardware is healthy! Attempt queue reactivation if previously quarantined or disabled
    if (strikes >= 3 || prevHealth === "flagged") {
      try {
        await cupsCommands.enablePrinter(name);
        await cupsCommands.acceptJobs(name);
      } catch (err) {
        console.warn(`[HealthCheck] Unable to re-enable CUPS queue for ${name}:`, err);
      }
    }

    // 3. Inspect CUPS Queue Status
    const { stdout } = await cupsCommands.getPrinterStatusByName(name);
    const lowerStatus = stdout.toLowerCase();
    if (lowerStatus.includes("stopped") || lowerStatus.includes("rejecting") || lowerStatus.includes("unplugged")) {
      await redisConnection.set(REDIS_KEYS.printerHealth(name), "flagged");
      return;
    }

    // 4. Concurrency & Lock Protection
    const { stdout: activeJobsOut } = await cupsCommands.getActiveJobs(name).catch(() => ({ stdout: "" }));
    const hasActiveJobs = activeJobsOut.trim().length > 0;

    if (hasActiveJobs || lowerStatus.includes("printing")) {
      await redisConnection.set(REDIS_KEYS.printerState(name), "busy");
    } else if (lowerStatus.includes("idle")) {
      // Guarded: Never overwrite busy to idle if active spooler jobs exist
      if (!hasActiveJobs) {
        await redisConnection.set(REDIS_KEYS.printerState(name), "idle");
      }
    }

    // 5. Hierarchical Supplies Check
    try {
      let supplies = await adapter.getSupplies();
      // If adapter supplies returned null values, attempt native CUPS marker fallback
      if (supplies.supplies.black === null && supplies.supplies.color === null) {
        const cupsSupplies = await queryCupsPrinterMarkers(name);
        if (cupsSupplies) {
          supplies = cupsSupplies;
        }
      }
      await redisConnection.setex(REDIS_KEYS.supplies(name), REDIS_TTLS.SUPPLIES, JSON.stringify(supplies));
    } catch (suppliesErr) {
      console.warn(`[HealthCheck] Failed to get supplies for ${name}:`, suppliesErr);
    }

    // 6. State & Quarantine Restoration (Self-Healing)
    await redisConnection.set(REDIS_KEYS.printerHealth(name), "healthy");

    if (strikes > 0 || prevHealth !== "healthy") {
      console.log(`[HealthCheck] Self-healing printer ${name}: resetting ${strikes} strikes.`);
      await redisConnection.set(REDIS_KEYS.printerStrikes(name), "0");
      await removePrinterFromAttemptedJobs(name);

      eventBus.emit("admin:printer:healed", {
        printer: name,
        message: `Printer ${name} successfully self-healed and returned to healthy status.`
      });

      // Circuit Breaker Recovery: If queue was paused because all printers were quarantined, auto-resume!
      const isPaused = await printMasterQueue.isPaused();
      if (isPaused) {
        console.log(`[HealthCheck] Circuit breaker reset: Resuming global queue as ${name} is now healthy.`);
        await printMasterQueue.resume();
        eventBus.emit("system:queue:resumed", {
          message: `Circuit breaker reset: Global queue resumed by healed printer ${name}.`,
          printer: name
        });
        await wakeUpDelayedJobs();
      }
    }

    // 7. Sync printer metadata config
    const infoStr = (await redisConnection.get(REDIS_KEYS.printerInfo(name))) || "{}";
    let info: any = {};
    try { info = JSON.parse(infoStr); } catch {}

    const dbRecord = getPrinterFromDB(name);
    const newInfo = {
      ...info,
      name,
      alias: dbRecord?.alias || info.alias,
      capabilities: dbRecord?.capabilities && dbRecord.capabilities.length > 0 ? dbRecord.capabilities : (info.capabilities || []),
      type: dbRecord?.type || info.type || "unknown"
    };
    await redisConnection.set(REDIS_KEYS.printerInfo(name), JSON.stringify(newInfo));

  } catch (err) {
    console.error(`[HealthCheck] Failed for ${name}:`, err);
    await redisConnection.set(REDIS_KEYS.printerHealth(name), "flagged");
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
        await redisConnection.sadd(REDIS_KEYS.FLEET_PRINTERS, ...printerNames);
      }

      for (const p of printers) {
        // Read existing record from SQLite
        const dbRecord = getPrinterFromDB(p.name);
        let currentCapabilities = dbRecord?.capabilities || p.capabilities || [];
        const isManual = dbRecord?.capabilities_source === "manual";

        // If unprofiled or empty AND not manually configured, probe hardware!
        if ((!currentCapabilities || currentCapabilities.length === 0) && !isManual) {
          const deviceUri = await PrinterFactory.getDeviceUri(p.name);
          currentCapabilities = await probePrinterCapabilities(p.name, p.description, deviceUri || undefined);
        }

        // Save description and metadata to Redis
        const infoStr = (await redisConnection.get(REDIS_KEYS.printerInfo(p.name))) || "{}";
        let info: any = {};
        try { info = JSON.parse(infoStr); } catch {}
        info.name = p.name;
        info.description = p.description || info.description || p.name;
        info.alias = dbRecord?.alias || p.alias || info.alias;
        info.type = dbRecord?.type || p.type || info.type || "unknown";
        info.capabilities = currentCapabilities;
        await redisConnection.set(REDIS_KEYS.printerInfo(p.name), JSON.stringify(info));

        // Sync with SQLite Database (preserving manual source if set)
        upsertPrinterToDB(
          p.name,
          info.alias,
          currentCapabilities,
          dbRecord?.ipp_uri,
          info.type,
          isManual ? "manual" : "auto"
        );

        // Track previous health and state
        const prevHealth = await redisConnection.get(REDIS_KEYS.printerHealth(p.name));
        const prevState = await redisConnection.get(REDIS_KEYS.printerState(p.name));

        await runComprehensiveHealthCheck(p.name);

        const newHealth = await redisConnection.get(REDIS_KEYS.printerHealth(p.name));
        const newState = await redisConnection.get(REDIS_KEYS.printerState(p.name));

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
