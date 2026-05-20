import { Request, Response } from "express";
import * as printerService from "../services/printer.service";

/**
 * GET /printers
 */
export async function getPrinters(req: Request, res: Response) {
  try {
    const printers = await printerService.listPrinters();
    const printersWithSupplies = await Promise.all(printers.map(async (p) => {
      const supplies = await suppliesService.getSupplies(p.name);
      return {
        ...p,
        status: supplies.status === 'offline' ? 'offline' : p.status,
        paper: supplies.paper || 'unknown',
        supplyBlack: supplies.supplies?.black ?? null,
        supplyColor: supplies.supplies?.color ?? null,
      };
    }));
    res.json({ success: true, printers: printersWithSupplies });
  } catch (err: any) {
    console.error("[getPrinters] Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to list printers",
      error: err?.error?.message || String(err),
      stderr: err?.stderr || "",
    });
  }
}

/**
 * GET /printers/default
 */
export async function getDefaultPrinter(req: Request, res: Response) {
  try {
    const defaultPrinter = await printerService.getDefaultPrinter();
    res.json({ success: true, defaultPrinter });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to get default printer",
      error: err?.error?.message || String(err),
    });
  }
}

/**
 * POST /printers/default  { printerName: string }
 */
export async function setDefaultPrinter(req: Request, res: Response) {
  const { printerName } = req.body;
  if (!printerName) {
    return res
      .status(400)
      .json({ success: false, message: "printerName is required" });
  }

  try {
    await printerService.setDefaultPrinter(printerName);
    res.json({
      success: true,
      message: `Default printer set to ${printerName}`,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to set default printer",
      error: err?.error?.message || String(err),
    });
  }
}

export async function updateAlias(req: Request, res: Response) {
  const name = req.params.name as string;
  const { alias } = req.body;
  if (!alias) {
    return res.status(400).json({ success: false, message: "alias is required" });
  }

  try {
    await printerService.updateAlias(name, alias);
    res.json({ success: true, message: `Alias for ${name} updated to ${alias}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to update alias", error: String(err) });
  }
}

export async function detectPrinters(req: Request, res: Response) {
  try {
    const devices = await printerService.detectPrinters();
    res.json({ success: true, devices });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to detect printers", error: String(err) });
  }
}

import * as suppliesService from "../services/supplies.service";

export async function getSupplies(req: Request, res: Response) {
  const name = req.params.name as string;
  try {
    const supplies = await suppliesService.getSupplies(name);
    res.json({ success: true, supplies });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to get supplies", error: String(err) });
  }
}

import { redisConnection } from "../../infrastructure/redis";
import { PrinterFactory } from "../../factories/printer.factory";

export async function forceRefreshPrinter(req: Request, res: Response) {
  const name = req.params.name as string;
  const healthKey = `printer:${name}:health`;
  
  try {
    // 1. Delete Redis cache for this printer
    await redisConnection.del(healthKey);
    // Also delete any supplies cache if suppliesService is using one
    
    // 2. Run digital probe
    const adapter = await PrinterFactory.getAdapter(name);
    if (!adapter) {
      await redisConnection.set(healthKey, "flagged");
      return res.status(404).json({ success: false, message: `Adapter not found for ${name}` });
    }
    
    const isHealthy = await adapter.healthCheck();
    
    // 3. Update Health
    if (isHealthy) {
       await redisConnection.set(healthKey, "healthy");
       // Pre-fetch supplies to update cache
       await adapter.getSupplies(); 
       res.json({ success: true, status: "healthy", message: `Printer ${name} is healthy and refreshed.` });
    } else {
       await redisConnection.set(healthKey, "flagged");
       res.json({ success: true, status: "flagged", message: `Printer ${name} failed health check and is flagged.` });
    }
  } catch (err: any) {
    console.error("[forceRefreshPrinter] Error:", err);
    res.status(500).json({ success: false, message: "Failed to force refresh printer", error: String(err) });
  }
}

import { eventBus } from "../utils/eventBus";

export async function detectLegacyPrinters(req: Request, res: Response) {
  try {
    const devices = await printerService.getUnconfiguredPrinters();
    res.json({ success: true, devices });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to detect legacy printers", error: String(err) });
  }
}

export async function configurePrinter(req: Request, res: Response) {
  const { uri, rawModel } = req.body;
  if (!uri || !rawModel) {
    return res.status(400).json({ success: false, message: "Missing uri or rawModel" });
  }

  try {
    let queueName = rawModel.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
    if (uri.includes("ipp://")) {
      await printerService.configureIppPrinter(queueName, uri);
    } else {
      await printerService.configureHpPrinter(uri, rawModel);
    }
    
    // Probe capabilities using lpoptions
    const capabilities = await printerService.probePrinterCapabilities(queueName);
    
    const config = await printerService.getCapabilitiesConfig();
    if (!config[queueName]) {
      config[queueName] = { capabilities: capabilities, type: uri.includes("ipp://") ? "ipp" : "usb", alias: rawModel };
    } else {
      config[queueName].capabilities = capabilities;
    }
    
    await printerService.updateCapabilitiesConfig(config);

    // Emit SSE event to force frontend reload
    eventBus.emit("printer_discovery", { timestamp: new Date().toISOString() });

    res.json({ success: true, message: "Printer configured successfully", queueName });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to configure printer", error: String(err) });
  }
}

export async function updateCapabilities(req: Request, res: Response) {
  const name = req.params.name as string;
  const { capabilities, type, alias } = req.body;
  
  if (!Array.isArray(capabilities)) {
    return res.status(400).json({ success: false, message: "capabilities must be an array" });
  }

  try {
    const config = await printerService.getCapabilitiesConfig();
    if (!config[name]) {
      config[name] = { capabilities: [], type: "unknown" };
    }
    
    config[name].capabilities = capabilities;
    if (type !== undefined) config[name].type = type;
    if (alias !== undefined) config[name].alias = alias;
    
    await printerService.updateCapabilitiesConfig(config);
    
    // Emit SSE event to trigger fleet update in UI
    eventBus.emit("printer_discovery", { timestamp: new Date().toISOString() });
    
    res.json({ success: true, message: `Capabilities updated for ${name}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to update capabilities", error: String(err) });
  }
}

export async function getKioskStatus(req: Request, res: Response) {
  try {
    const printers = await printerService.listPrinters();
    
    // 1. Check if any printer is online (idle or busy)
    // Note: status is from lpstat, 'idle' or 'busy' means it's accepting jobs.
    // However, if the hardware is completely offline, lpstat might say 'stopped' or we should check supplies.
    // The instructions say: `isAcceptingJobs` = `true` if ≥1 printer is `idle` or `busy`.
    const isAcceptingJobs = printers.some(p => p.status === 'idle' || p.status === 'busy');

    // 2. Aggregate capabilities
    // We only aggregate for available printers. 
    // Assuming 'color' and 'duplex' are in the capabilities array of PrinterInfo.
    // e.g. capabilities: ["color", "duplex"]
    const availablePrinters = printers.filter(p => p.status === 'idle' || p.status === 'busy');
    
    let color = false;
    let duplex = false;

    for (const p of availablePrinters) {
      if (p.capabilities?.includes('color')) {
        color = true;
      }
      if (p.capabilities?.includes('duplex')) {
        duplex = true;
      }
    }

    res.json({
      isAcceptingJobs,
      fleetCapabilities: { color, duplex }
    });
  } catch (err: any) {
    console.error("[getKioskStatus] Error:", err);
    // On error, default to offline
    res.status(500).json({
      isAcceptingJobs: false,
      fleetCapabilities: { color: false, duplex: false },
      error: String(err)
    });
  }
}
