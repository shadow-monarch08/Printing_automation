import { Request, Response } from "express";
import * as sessionService from "../services/session.service";

export async function initKioskSession(req: Request, res: Response) {
  try {
    const userAgent = req.headers["user-agent"] || "Unknown";
    const ipAddress = req.ip || "Unknown";
    const sessionId = await sessionService.initSession(userAgent, ipAddress);
    
    res.json({ success: true, sessionId });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to initialize session", error: String(err) });
  }
}
