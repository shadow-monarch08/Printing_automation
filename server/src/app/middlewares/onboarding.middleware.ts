import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../utils/errors";
import { getSystemConfig } from "../services/config.db.service";

export function requireNonSetupModeForSkip(req: Request, _res: Response, next: NextFunction) {
  const config = getSystemConfig();
  const isFirstBoot = config?.provisioningState === "FIRST_BOOT";
  const isSkipRequested = req.body?.skipWifi === true || req.path === "/skip";

  if (isFirstBoot && isSkipRequested) {
    throw new ForbiddenError(
      "SETUP_SKIP_FORBIDDEN",
      "Skipping Wi-Fi configuration is not permitted during Initial First Boot Provisioning."
    );
  }

  next();
}

