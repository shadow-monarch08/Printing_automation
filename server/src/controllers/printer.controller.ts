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
    res.status(500).json({
      success: false,
      message: "Failed to list printers",
      error: err?.error?.message || String(err),
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
