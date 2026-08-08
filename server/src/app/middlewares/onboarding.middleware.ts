import { Request, Response, NextFunction } from "express";

export function requireNonSetupModeForSkip(req: Request, res: Response, next: NextFunction) {
  const isSetupMode = process.env.SETUP_MODE === "true";
  const isSkipRequested = req.body?.skipWifi === true || req.path === "/skip";

  if (isSetupMode && isSkipRequested) {
    return res.status(403).json({
      error: "Skipping Wi-Fi reconfiguration is strictly forbidden in Maintenance/Setup Mode."
    });
  }

  next();
}
