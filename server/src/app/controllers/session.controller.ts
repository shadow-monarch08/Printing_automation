import { Request, Response } from "express";
import * as sessionService from "../services/session.service";

export async function initKioskSession(req: Request, res: Response) {
  const userAgent = (req.headers["user-agent"] as string) || "Unknown";
  const ipAddress = req.ip || "Unknown";
  const incomingSessionId =
    (req.headers["x-session-id"] as string) ||
    (req.body?.sessionId as string) ||
    (req.query?.sessionId as string);

  const result = await sessionService.bootstrapSession(
    incomingSessionId,
    userAgent,
    ipAddress
  );

  res.json({
    success: true,
    sessionId: result.sessionId,
    shop: result.shop,
  });
}
