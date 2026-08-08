import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";

function sanitizeErrorMessage(rawMsg: string): string {
  if (!rawMsg) return "An unexpected error occurred.";
  
  let clean = rawMsg.replace(/^Command failed:\s*sudo\s*nmcli\s*/i, "").trim();
  clean = clean.replace(/^Error:\s*/i, "").trim();

  if (clean.includes("Secrets were required") || clean.includes("no-secrets")) {
    return "Invalid Wi-Fi Passphrase. Please verify security key.";
  }
  if (clean.includes("No network with SSID") || clean.includes("not found")) {
    return "Network is out of range or no longer broadcasting.";
  }
  if (clean.includes("connection up")) {
    return "Failed to activate saved Wi-Fi profile. Please re-enter passphrase.";
  }

  // Length guard: truncate unmapped raw system strings to 120 chars
  if (clean.length > 120) {
    clean = clean.substring(0, 117) + "...";
  }

  return clean;
}

export function globalErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  let statusCode = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected server error occurred.";
  let details: any = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details || null;
  } else if (err && typeof err === "object") {
    statusCode = err.statusCode || err.status || 500;
    code = err.code || "INTERNAL_SERVER_ERROR";
    message = err.message || String(err);
  } else if (typeof err === "string") {
    message = err;
  }

  message = sanitizeErrorMessage(message);

  console.error(`[Global Error Handler] [${code}] (${statusCode}):`, err);

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: Date.now(),
  });
}
