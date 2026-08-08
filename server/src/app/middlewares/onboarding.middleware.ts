import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../utils/errors";

export function requireNonSetupModeForSkip(req: Request, _res: Response, next: NextFunction) {
  const isSetupMode = process.env.SETUP_MODE === "true";
  const isSkipRequested = req.body?.skipWifi === true || req.path === "/skip";

  if (isSetupMode && isSkipRequested) {
    throw new ForbiddenError(
      "SETUP_SKIP_FORBIDDEN",
      "Skipping Wi-Fi reconfiguration is strictly forbidden in Maintenance/Setup Mode."
    );
  }

  next();
}
