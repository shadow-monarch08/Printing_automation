import { Request, Response } from "express";
import * as printerService from "../services/printer.service";
import * as suppliesService from "../services/supplies.service";
import { printMasterQueue, removePrinterFromAttemptedJobs } from "../../infrastructure/printMaster.queue";
import { cupsCommands } from "../../commands/cups.commands";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";
import { PrinterFactory } from "../../factories/printer.factory";
import { getSystemConfig } from "../services/config.db.service";
import { eventBus } from "../utils/eventBus";
import { ValidationError, NotFoundError } from "../utils/errors";

export async function getPrinters(_req: Request, res: Response) {
  const printers = await printerService.listPrinters();
  res.json({ success: true, printers });
}

export async function getDefaultPrinter(_req: Request, res: Response) {
  const defaultPrinter = await printerService.getDefaultPrinter();
  res.json({ success: true, defaultPrinter });
}

export async function setDefaultPrinter(req: Request, res: Response) {
  const { printerName } = req.body;
  if (!printerName) {
    throw new ValidationError("VALIDATION_PRINTER_NAME_REQUIRED", "printerName is required.");
  }

  await printerService.setDefaultPrinter(printerName);
  res.json({
    success: true,
    message: `Default printer set to ${printerName}`,
  });
}

export async function updateAlias(req: Request, res: Response) {
  const name = req.params.name as string;
  const { alias } = req.body;
  if (!alias) {
    throw new ValidationError("VALIDATION_ALIAS_REQUIRED", "alias is required.");
  }

  await printerService.updateAlias(name, alias);
  res.json({ success: true, message: `Alias for ${name} updated to ${alias}` });
}

export async function detectPrinters(_req: Request, res: Response) {
  const devices = await printerService.detectPrinters();
  res.json({ success: true, devices });
}

export async function getSupplies(req: Request, res: Response) {
  const name = req.params.name as string;
  const supplies = await suppliesService.getSupplies(name);
  res.json({ success: true, supplies });
}

export async function forceRefreshPrinter(req: Request, res: Response) {
  const name = req.params.name as string;
  const healthKey = REDIS_KEYS.printerHealth(name);

  await redisConnection.del(healthKey);

  const adapter = await PrinterFactory.getAdapter(name);
  if (!adapter) {
    await redisConnection.set(healthKey, "flagged");
    throw new NotFoundError("PRINTER_ADAPTER_NOT_FOUND", `Adapter not found for ${name}`);
  }

  const isHealthy = await adapter.healthCheck();

  if (isHealthy) {
    await redisConnection.set(healthKey, "healthy");
    await redisConnection.set(REDIS_KEYS.printerStrikes(name), "0");
    await redisConnection.set(REDIS_KEYS.printerState(name), "idle");

    await removePrinterFromAttemptedJobs(name);

    const supplies = await adapter.getSupplies();
    await redisConnection.setex(REDIS_KEYS.supplies(name), REDIS_TTLS.SUPPLIES, JSON.stringify(supplies));

    const isPaused = await printMasterQueue.isPaused();
    if (isPaused) {
      await printMasterQueue.resume();
      eventBus.emit("system:queue:resumed", { message: `Queue resumed. Printer ${name} is back online.` });
      eventBus.emit("admin:queue:sync", { action: "RESUME", isQueuePaused: false });
    }

    res.json({ success: true, status: "healthy", message: `Printer ${name} is healthy and refreshed.` });
  } else {
    await redisConnection.set(healthKey, "flagged");
    res.json({ success: true, status: "flagged", message: `Printer ${name} failed health check and is flagged.` });
  }
}

export async function getUnconfiguredPrinters(_req: Request, res: Response) {
  const devices = await printerService.getUnconfiguredPrinters();
  res.json({ success: true, devices });
}

export const detectLegacyPrinters = getUnconfiguredPrinters;

export async function configurePrinter(req: Request, res: Response) {
  const { uri, rawModel } = req.body;
  if (!uri || !rawModel) {
    throw new ValidationError("VALIDATION_URI_REQUIRED", "Missing uri or rawModel.");
  }

  // Generate collision-safe queue name preventing overwrites of identical printer models
  const queueName = await printerService.generateUniqueQueueName(rawModel, uri);
  const adapter = PrinterFactory.getAdapterByUri(queueName, uri);
  if (!adapter) {
    throw new ValidationError("PRINTER_UNSUPPORTED_URI", `Unsupported printer type or invalid URI: ${uri}`);
  }
  await adapter.configure(queueName);

  // Auto-probe capabilities with 5-tier fallback cascade (model and URI hints)
  const capabilities = await printerService.probePrinterCapabilities(queueName, rawModel, uri);

  const lowerUri = uri.toLowerCase();
  let printerType = "usb";
  if (
    lowerUri.startsWith("ipp://") ||
    lowerUri.startsWith("ipps://") ||
    lowerUri.startsWith("dnssd://") ||
    lowerUri.startsWith("mdns://")
  ) {
    printerType = "ipp";
  } else if (lowerUri.startsWith("socket://") || lowerUri.startsWith("lpd://")) {
    printerType = "network";
  }

  // Persist directly to SQLite with capabilities_source = 'auto'
  printerService.upsertPrinterToDB(queueName, rawModel, capabilities, uri, printerType, "auto");

  const printerInfo = {
    name: queueName,
    alias: rawModel,
    capabilities: capabilities,
    type: printerType,
  };

  await redisConnection.sadd(REDIS_KEYS.FLEET_PRINTERS, queueName);
  await redisConnection.set(REDIS_KEYS.printerHealth(queueName), "healthy");
  await redisConnection.set(REDIS_KEYS.printerState(queueName), "idle");
  await redisConnection.set(REDIS_KEYS.printerStrikes(queueName), "0");
  await redisConnection.set(REDIS_KEYS.printerInfo(queueName), JSON.stringify(printerInfo));

  eventBus.emit("admin:hardware:discovery", { deviceType: "PRINTER", id: queueName, timestamp: new Date().toISOString() });

  res.json({ success: true, message: "Printer configured successfully", queueName, capabilities });
}

export async function updateCapabilities(req: Request, res: Response) {
  const name = req.params.name as string;
  const { capabilities, type, alias } = req.body;

  if (!Array.isArray(capabilities)) {
    throw new ValidationError("VALIDATION_CAPABILITIES_FORMAT", "capabilities must be an array.");
  }

  const existing = printerService.getPrinterFromDB(name);
  const finalAlias = alias !== undefined ? alias : (existing?.alias || undefined);
  const finalType = type !== undefined ? type : (existing?.type || "unknown");

  // Admin Manual Override: Persist to SQLite with capabilities_source = 'manual'
  printerService.upsertPrinterToDB(
    name,
    finalAlias,
    capabilities,
    existing?.ipp_uri,
    finalType,
    "manual"
  );

  // Update Redis cache immediately
  const infoStr = (await redisConnection.get(REDIS_KEYS.printerInfo(name))) || "{}";
  let info: any = {};
  try { info = JSON.parse(infoStr); } catch {}
  info.name = name;
  info.alias = finalAlias;
  info.capabilities = capabilities;
  info.type = finalType;
  await redisConnection.set(REDIS_KEYS.printerInfo(name), JSON.stringify(info));

  eventBus.emit("admin:hardware:discovery", { deviceType: "PRINTER", id: name, timestamp: new Date().toISOString() });

  res.json({ success: true, message: `Capabilities updated for ${name}`, capabilities });
}

export async function refreshCapabilities(req: Request, res: Response) {
  const name = req.params.name as string;
  const dbRecord = printerService.getPrinterFromDB(name);
  const deviceUri = await PrinterFactory.getDeviceUri(name);

  // Force re-probe via 5-tier cascade
  const capabilities = await printerService.probePrinterCapabilities(
    name,
    dbRecord?.alias || undefined,
    deviceUri || dbRecord?.ipp_uri || undefined
  );

  // Reset to auto with freshly probed capabilities
  printerService.upsertPrinterToDB(
    name,
    dbRecord?.alias,
    capabilities,
    deviceUri || dbRecord?.ipp_uri,
    dbRecord?.type,
    "auto"
  );

  // Update Redis
  const infoStr = (await redisConnection.get(REDIS_KEYS.printerInfo(name))) || "{}";
  let info: any = {};
  try { info = JSON.parse(infoStr); } catch {}
  info.name = name;
  info.capabilities = capabilities;
  await redisConnection.set(REDIS_KEYS.printerInfo(name), JSON.stringify(info));

  eventBus.emit("admin:hardware:discovery", { deviceType: "PRINTER", id: name, timestamp: new Date().toISOString() });

  res.json({ success: true, message: `Capabilities refreshed for ${name}`, capabilities });
}

export async function getKioskStatus(_req: Request, res: Response) {
  const config = getSystemConfig();
  const shopName = config?.shopName || "Modern Press";

  try {
    const isPaused = await printMasterQueue.isPaused();
    const printers = await printerService.listPrinters();
    const availablePrinters = printers.filter((p) => p.status === "idle" || p.status === "busy");
    const isAcceptingJobs = !isPaused && availablePrinters.length > 0;

    let color = false;
    let duplex = false;

    for (const p of availablePrinters) {
      if (p.capabilities?.includes("color")) color = true;
      if (p.capabilities?.includes("duplex")) duplex = true;
    }

    res.json({
      shopName,
      isAcceptingJobs,
      fleetCapabilities: { color, duplex },
    });
  } catch (err: any) {
    res.json({
      shopName,
      isAcceptingJobs: false,
      fleetCapabilities: { color: false, duplex: false },
    });
  }
}


export async function deletePrinter(req: Request, res: Response) {
  const name = req.params.name as string;

  await cupsCommands.deletePrinter(name);

  // Delete from SQLite
  printerService.deletePrinterFromDB(name);

  await redisConnection.srem(REDIS_KEYS.FLEET_PRINTERS, name);
  await redisConnection.del(
    REDIS_KEYS.printerHealth(name),
    REDIS_KEYS.printerState(name),
    REDIS_KEYS.printerStrikes(name),
    REDIS_KEYS.printerInfo(name),
    REDIS_KEYS.supplies(name)
  );

  eventBus.emit("admin:hardware:discovery", { deviceType: "PRINTER", id: name, timestamp: new Date().toISOString() });

  res.json({ success: true, message: `Printer ${name} deleted.` });
}

export async function deleteAllPrinters(_req: Request, res: Response) {
  const printerNames = await redisConnection.smembers(REDIS_KEYS.FLEET_PRINTERS);

  if (printerNames.length === 0) {
    return res.json({ success: true, message: "No printers to delete." });
  }

  for (const name of printerNames) {
    try {
      await cupsCommands.deletePrinter(name);
    } catch (e) {
      console.warn(`[deleteAllPrinters] Failed to delete ${name} from CUPS:`, e);
    }

    // Delete from SQLite
    printerService.deletePrinterFromDB(name);

    await redisConnection.srem(REDIS_KEYS.FLEET_PRINTERS, name);
    await redisConnection.del(
      REDIS_KEYS.printerHealth(name),
      REDIS_KEYS.printerState(name),
      REDIS_KEYS.printerStrikes(name),
      REDIS_KEYS.printerInfo(name),
      REDIS_KEYS.supplies(name)
    );
  }

  eventBus.emit("admin:hardware:discovery", { deviceType: "PRINTER", timestamp: new Date().toISOString() });

  res.json({ success: true, message: `Deleted ${printerNames.length} printers.` });
}

export async function probePrinterByIp(req: Request, res: Response) {
  const { ip } = req.body;
  if (!ip || typeof ip !== "string") {
    throw new ValidationError("VALIDATION_IP_REQUIRED", "ip parameter is required and must be an IPv4 string.");
  }

  const device = await printerService.probeCopierByIp(ip.trim());
  res.json({ success: true, device });
}

