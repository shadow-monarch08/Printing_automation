import { Request, Response } from "express";
import * as printerService from "../services/printer.service";
import * as suppliesService from "../services/supplies.service";
import { printMasterQueue, removePrinterFromAttemptedJobs } from "../../infrastructure/printMaster.queue";
import { cupsCommands } from "../../commands/cups.commands";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";
import { PrinterFactory } from "../../factories/printer.factory";
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
      eventBus.emit("queue_resumed", { message: `Queue resumed. Printer ${name} is back online.` });
    }

    res.json({ success: true, status: "healthy", message: `Printer ${name} is healthy and refreshed.` });
  } else {
    await redisConnection.set(healthKey, "flagged");
    res.json({ success: true, status: "flagged", message: `Printer ${name} failed health check and is flagged.` });
  }
}

export async function detectLegacyPrinters(_req: Request, res: Response) {
  const devices = await printerService.getUnconfiguredPrinters();
  res.json({ success: true, devices });
}

export async function configurePrinter(req: Request, res: Response) {
  const { uri, rawModel } = req.body;
  if (!uri || !rawModel) {
    throw new ValidationError("VALIDATION_URI_REQUIRED", "Missing uri or rawModel.");
  }

  let queueName = rawModel.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
  const adapter = PrinterFactory.getAdapterByUri(queueName, uri);
  if (!adapter) {
    throw new ValidationError("PRINTER_UNSUPPORTED_URI", `Unsupported printer type or invalid URI: ${uri}`);
  }
  await adapter.configure(queueName);

  const capabilities = await printerService.probePrinterCapabilities(queueName);
  const config = await printerService.getCapabilitiesConfig();
  const printerType = uri.includes("ipp://") ? "ipp" : uri.startsWith("hp:/") ? "usb" : "usb";

  if (!config[queueName]) {
    config[queueName] = { capabilities: capabilities, type: printerType, alias: rawModel };
  } else {
    config[queueName].capabilities = capabilities;
  }

  await printerService.updateCapabilitiesConfig(config);
  printerService.upsertPrinterToDB(queueName, rawModel, capabilities);

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

  eventBus.emit("printer_discovery", { timestamp: new Date().toISOString() });

  res.json({ success: true, message: "Printer configured successfully", queueName });
}

export async function updateCapabilities(req: Request, res: Response) {
  const name = req.params.name as string;
  const { capabilities, type, alias } = req.body;

  if (!Array.isArray(capabilities)) {
    throw new ValidationError("VALIDATION_CAPABILITIES_FORMAT", "capabilities must be an array.");
  }

  const config = await printerService.getCapabilitiesConfig();
  if (!config[name]) {
    config[name] = { capabilities: [], type: "unknown" };
  }

  config[name].capabilities = capabilities;
  if (type !== undefined) config[name].type = type;
  if (alias !== undefined) config[name].alias = alias;

  await printerService.updateCapabilitiesConfig(config);
  printerService.upsertPrinterToDB(name, alias, capabilities);

  eventBus.emit("printer_discovery", { timestamp: new Date().toISOString() });

  res.json({ success: true, message: `Capabilities updated for ${name}` });
}

export async function getKioskStatus(_req: Request, res: Response) {
  try {
    const printers = await printerService.listPrinters();
    const isAcceptingJobs = printers.some((p) => p.status === "idle" || p.status === "busy");
    const availablePrinters = printers.filter((p) => p.status === "idle" || p.status === "busy");

    let color = false;
    let duplex = false;

    for (const p of availablePrinters) {
      if (p.capabilities?.includes("color")) color = true;
      if (p.capabilities?.includes("duplex")) duplex = true;
    }

    res.json({
      isAcceptingJobs,
      fleetCapabilities: { color, duplex },
    });
  } catch (err: any) {
    res.json({
      isAcceptingJobs: false,
      fleetCapabilities: { color: false, duplex: false },
    });
  }
}

export async function deletePrinter(req: Request, res: Response) {
  const name = req.params.name as string;

  await cupsCommands.deletePrinter(name);

  await redisConnection.srem(REDIS_KEYS.FLEET_PRINTERS, name);
  await redisConnection.del(
    REDIS_KEYS.printerHealth(name),
    REDIS_KEYS.printerState(name),
    REDIS_KEYS.printerStrikes(name),
    REDIS_KEYS.printerInfo(name),
    REDIS_KEYS.supplies(name)
  );

  eventBus.emit("printer_discovery", { timestamp: new Date().toISOString() });

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

    await redisConnection.srem(REDIS_KEYS.FLEET_PRINTERS, name);
    await redisConnection.del(
      REDIS_KEYS.printerHealth(name),
      REDIS_KEYS.printerState(name),
      REDIS_KEYS.printerStrikes(name),
      REDIS_KEYS.printerInfo(name),
      REDIS_KEYS.supplies(name)
    );
  }

  eventBus.emit("printer_discovery", { timestamp: new Date().toISOString() });

  res.json({ success: true, message: `Deleted ${printerNames.length} printers.` });
}
