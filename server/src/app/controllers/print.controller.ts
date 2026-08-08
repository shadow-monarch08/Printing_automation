import { Request, Response } from "express";
import * as pricingService from "../services/pricing.service";
import { insertJob } from "../services/printJob.db.service";
import { printMasterQueue } from "../../infrastructure/printMaster.queue";
import { systemCommands } from "../../commands/system.commands";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { eventBus } from "../utils/eventBus";
import { ValidationError } from "../utils/errors";

export async function printFile(req: Request, res: Response) {
  if (!req.file) {
    throw new ValidationError("VALIDATION_FILE_REQUIRED", "No file uploaded.");
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
    submittedAt: new Date().toISOString(),
  };

  insertJob({
    id: jobId,
    sessionId: sessionId ?? "anonymous",
    filename: req.file.originalname,
    pages,
    copies,
    colorMode,
    duplex,
    cost,
    submittedAt: new Date().toISOString(),
  });

  await printMasterQueue.add("print", jobData as any, { jobId });

  eventBus.emit("job_queued", jobData);

  res.json({
    success: true,
    message: "Print job queued",
    jobId,
    file: req.file.originalname,
  });
}

export async function calculateQuote(req: Request, res: Response) {
  const { pages, copies, colorMode, duplex } = req.body;
  if (!pages || !copies) {
    throw new ValidationError("VALIDATION_MISSING_FIELDS", "Missing required fields: pages and copies.");
  }

  const quote = await pricingService.calculateQuote(pages, copies, colorMode, duplex);
  res.json({ success: true, ...quote });
}

export async function getPageCount(req: Request, res: Response) {
  if (!req.file) {
    throw new ValidationError("VALIDATION_FILE_REQUIRED", "No file uploaded.");
  }

  const filePath = path.resolve(req.file.path);
  const mimeType = req.file.mimetype;

  try {
    let pages = 1;

    if (mimeType.startsWith("image/")) {
      pages = 1;
    } else if (mimeType === "application/pdf" || req.file.originalname.toLowerCase().endsWith(".pdf")) {
      try {
        const { stdout } = await systemCommands.getPdfInfo(filePath);
        const match = stdout.match(/^Pages:\s+(\d+)/m);
        pages = match ? parseInt(match[1], 10) : 1;
      } catch (pdfErr) {
        console.warn("[getPageCount] pdfinfo failed, falling back to 1 page.", pdfErr);
        pages = 1;
      }
    } else {
      pages = 1;
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true, pages });
  } catch (err: any) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw err;
  }
}
