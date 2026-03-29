import { Request, Response } from "express";
import * as printerService from "../services/printer.service";
import path from "path";

/**
 * POST /print
 * Expects multipart form-data with a `file` field.
 * Optional body field: `printer` (target printer name).
 */
export async function printFile(req: Request, res: Response) {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }

  const filePath = path.resolve(req.file.path);
  const targetPrinter = req.body.printer || undefined;

  try {
    const jobId = await printerService.printFile(filePath, targetPrinter);
    res.json({
      success: true,
      message: "Print job submitted",
      jobId,
      file: req.file.originalname,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Print job failed",
      error: err?.error?.message || String(err),
    });
  }
}
