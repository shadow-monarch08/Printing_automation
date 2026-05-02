import { Request, Response } from "express";
import * as printerService from "../services/printer.service";

/**
 * GET /printers
 */
export async function getPrinters(req: Request, res: Response) {
  try {
    const printers = await printerService.listPrinters();
    res.json({ success: true, printers });
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

import { eventBus } from "../utils/eventBus";

export async function detectLegacyPrinters(req: Request, res: Response) {
  try {
    const devices = await printerService.getUnconfiguredHpPrinters();
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
    await printerService.configureHpPrinter(uri, rawModel);
    
    // Attempt to parse out the new queue name from lpstat -v to initialize its capabilities.
    // hp-setup usually names it based on the rawModel.
    // For now, we will just fetch the latest printers and ensure capabilities are synced.
    const allPrinters = await printerService.listPrinters();
    const config = await printerService.getCapabilitiesConfig();
    
    let isUpdated = false;
    for (const p of allPrinters) {
      if (!config[p.name]) {
        config[p.name] = { capabilities: [], type: uri.includes("HP") ? "usb" : "unknown" };
        isUpdated = true;
      }
    }
    
    if (isUpdated) {
      await printerService.updateCapabilitiesConfig(config);
    }

    // Emit SSE event to force frontend reload
    eventBus.emit("printer_discovery", { timestamp: new Date().toISOString() });

    res.json({ success: true, message: "Printer configured successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to configure printer", error: String(err) });
  }
}

