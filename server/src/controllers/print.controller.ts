import { Request, Response } from "express";
import * as pricingService from "../services/pricing.service";
import { printMasterQueue } from "../queues/printMaster.queue";
import { execCommand } from "../utils/exec";
import path from "path";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /print
 * Expects multipart form-data with a `file` field.
 * Optional body field: `printer` (target printer name).
 */
export async function printFile(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const filePath = path.resolve(req.file.path);
  const targetPrinter = req.body.printer || undefined;
  
  const pages = parseInt(req.body.pages || "1", 10);
  const copies = parseInt(req.body.copies || "1", 10);
  const colorMode = req.body.colorMode || "grayscale";
  const duplex = req.body.duplex || "single";
  const orientation = req.body.orientation || "portrait";
  const owner = req.body.owner || "Guest";

  try {
    const { cost } = await pricingService.calculateQuote(pages, copies, colorMode as any, duplex as any);
    
    const jobId = uuidv4();
    const jobData = {
      id: jobId,
      filename: req.file.originalname,
      filePath,
      owner,
      pages,
      copies,
      colorMode,
      duplex,
      orientation,
      targetPrinter,
      cost,
      attemptedPrinters: [],
      submittedAt: new Date().toISOString()
    };

    // Enqueue job via BullMQ
    await printMasterQueue.add("print", jobData as any, { jobId });

    res.json({
      success: true,
      message: "Print job queued",
      jobId,
      file: req.file.originalname,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Print job failed to queue",
      error: String(err),
    });
  }
}

export async function calculateQuote(req: Request, res: Response) {
  const { pages, copies, colorMode, duplex } = req.body;
  if (!pages || !copies) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  try {
    const quote = await pricingService.calculateQuote(pages, copies, colorMode, duplex);
    res.json({ success: true, quote });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Quote calculation failed", error: String(err) });
  }
}

export async function getPageCount(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const filePath = path.resolve(req.file.path);
  try {
    // Attempt to use pdfinfo. Note: this requires poppler-utils on the system.
    const { stdout } = await execCommand(`pdfinfo "${filePath}"`);
    const match = stdout.match(/^Pages:\s+(\d+)/m);
    const pages = match ? parseInt(match[1], 10) : 1;
    res.json({ success: true, pages });
  } catch (err: any) {
    console.error("getPageCount Error:", err);
    // Fallback: estimation or 1
    res.json({ success: true, pages: 1, estimated: true, error: String(err) });
  }
}
