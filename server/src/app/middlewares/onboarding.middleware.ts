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

/**
 * Restricts access exclusively to the physical kiosk display loopback interface (127.0.0.1 / localhost).
 * Blocks or redirects any traffic arriving via the Cloudflare edge tunnel or external LAN IPs.
 */
export function requireLoopbackOnly(req: Request, res: Response, next: NextFunction) {
  const isCloudflare = Boolean(req.headers["cf-ray"] || req.headers["cf-connecting-ip"]);
  const remoteIp = req.socket.remoteAddress || req.ip || "";
  const isLoopback = remoteIp === "127.0.0.1" || remoteIp === "::1" || remoteIp === "::ffff:127.0.0.1";

  if (isCloudflare || !isLoopback) {
    console.warn(`[Security Guard] 🔒 Blocked external request to loopback-only route [${req.method} ${req.originalUrl}] from ${remoteIp} (Cloudflare: ${isCloudflare})`);

    // For HTML document navigations (like /terminal in browser), redirect to customer portal root
    if (req.accepts("html") && !req.xhr) {
      return res.redirect("/");
    }

    // For API requests, throw standardized ForbiddenError
    throw new ForbiddenError(
      "LOOPBACK_ACCESS_ONLY",
      "Access to this endpoint is restricted exclusively to the physical kiosk display loopback interface."
    );
  }

  next();
}
