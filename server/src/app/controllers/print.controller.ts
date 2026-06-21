import { Request, Response } from "express";
import * as pricingService from "../services/pricing.service";
import { insertJob } from "../services/printJob.db.service";
import { printMasterQueue } from "../../infrastructure/printMaster.queue";
import { systemCommands } from "../../commands/system.commands";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { eventBus } from "../utils/eventBus";

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
  const sessionId = (req as any).session?.id || req.body.sessionId || null;

  try {
    const { cost } = await pricingService.calculateQuote(pages, copies, colorMode as any, duplex as any);

    const jobId = uuidv4();
    const jobData = {
      id: jobId,
      filename: req.file.originalname,
      filePath,
      owner,
      sessionId,
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

    // === COLD TIER SEAM ===
    // Future: This INSERT will use status 'pending_payment' and the BullMQ
    // enqueue below will move to a POST /print/confirm webhook handler.
    insertJob({
      id: jobId,
      sessionId: sessionId ?? 'anonymous',
      filename: req.file.originalname,
      pages,
      copies,
      colorMode,
      duplex,
      cost,
      submittedAt: new Date().toISOString(),
    });
    // === END COLD TIER SEAM ===

    // Enqueue job via BullMQ
    await printMasterQueue.add("print", jobData as any, { jobId });

    eventBus.emit("job_queued", jobData);

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
    res.json({ success: true, ...quote });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Quote calculation failed", error: String(err) });
  }
}

export async function getPageCount(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const filePath = path.resolve(req.file.path);
  const mimeType = req.file.mimetype;

  try {
    let pages = 1;

    // 1. If it's an image, it's always 1 page
    if (mimeType.startsWith('image/')) {
      pages = 1;
    }
    // 2. Only run pdfinfo if it's actually a PDF
    else if (mimeType === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
      try {
        const { stdout } = await systemCommands.getPdfInfo(filePath);
        const match = stdout.match(/^Pages:\s+(\d+)/m);
        pages = match ? parseInt(match[1], 10) : 1;
      } catch (pdfErr) {
        console.warn("[getPageCount] pdfinfo failed, falling back to 1 page.", pdfErr);
        pages = 1;
      }
    }
    // 3. For Word docs or other types, we fallback to 1 (or you can add more logic here)
    else {
      pages = 1;
    }

    // Clean up temporary file
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true, pages });
  } catch (err: any) {
    console.error("getPageCount Critical Error:", err);

    // Clean up temporary file
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true, pages: 1, estimated: true, error: String(err) });
  }
}
