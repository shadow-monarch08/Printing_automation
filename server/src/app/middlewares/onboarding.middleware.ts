import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../utils/errors";
import { getSystemConfig, updateSystemConfig } from "../services/config.db.service";
import { getActiveConnectionProfile } from "../utils/network.utils";

export async function requireNonSetupModeForSkip(req: Request, _res: Response, next: NextFunction) {
  const config = getSystemConfig();
  const isSkipRequested = req.body?.skipWifi === true || req.path === "/skip";

  if (isSkipRequested) {
    if (config?.provisioningState === "FIRST_BOOT") {
      // Dynamic verification: If an active profile actually exists, dynamically transition to RECOVERY
      const activeProfile = await getActiveConnectionProfile();
      if (activeProfile && activeProfile !== "Kiosk-Hotspot") {
        console.log(`[Onboarding Middleware] 🔄 Active profile "${activeProfile}" verified on skip request. Setting state to RECOVERY.`);
        updateSystemConfig({ provisioningState: "RECOVERY" });
        return next();
      }

      throw new ForbiddenError(
        "SETUP_SKIP_FORBIDDEN",
        "Skipping Wi-Fi configuration is not permitted during Initial First Boot Provisioning without an active network link."
      );
    }
  }

  next();
}


