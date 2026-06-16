import { Request, Response } from "express";
import * as analyticsService from "../services/analytics.service";

function parseDates(req: Request) {
  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);

  const startDate = (req.query.startDate as string) || defaultStart.toISOString();
  const endDate = (req.query.endDate as string) || defaultEnd.toISOString();
  
  return { startDate, endDate };
}

export async function getFinancialSummary(req: Request, res: Response) {
  try {
    const { startDate, endDate } = parseDates(req);
    const data = analyticsService.getFinancialSummary(startDate, endDate);
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getRevenueTrend(req: Request, res: Response) {
  try {
    const { startDate, endDate } = parseDates(req);
    const trend = analyticsService.getRevenueTrend(startDate, endDate);
    res.json({ success: true, trend });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getColorSplit(req: Request, res: Response) {
  try {
    const { startDate, endDate } = parseDates(req);
    const split = analyticsService.getColorSplit(startDate, endDate);
    res.json({ success: true, ...split });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getFleetTelemetry(req: Request, res: Response) {
  try {
    const { startDate, endDate } = parseDates(req);
    const telemetry = analyticsService.getFleetTelemetry(startDate, endDate);
    res.json({ success: true, telemetry });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getJobArchive(req: Request, res: Response) {
  try {
    const { startDate, endDate } = parseDates(req);
    const status = req.query.status as string | undefined;
    const printer = req.query.printer as string | undefined;
    const page = parseInt(req.query.page as string || "1", 10);
    const limit = parseInt(req.query.limit as string || "25", 10);

    const archive = analyticsService.getJobArchive({ startDate, endDate, status, printer, page, limit });
    res.json({ success: true, ...archive });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function exportJobsCSV(req: Request, res: Response) {
  try {
    const { startDate, endDate } = parseDates(req);
    const status = req.query.status as string | undefined;
    const printer = req.query.printer as string | undefined;

    const csv = analyticsService.getJobArchiveCSV({ startDate, endDate, status, printer });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="jobs-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
