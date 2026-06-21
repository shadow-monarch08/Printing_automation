import { PrinterFactory } from "../../factories/printer.factory";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS } from "../../infrastructure/redisKeys";
import { PrinterSupplyStatus } from "../types";

export const EMPTY_RESULT: PrinterSupplyStatus = {
  paper: "unknown",
  supplies: { black: null, color: null },
};

// ── Public entry point ───────────────────────────────────────────────────────
export async function getSupplies(printerName: string): Promise<PrinterSupplyStatus> {
  const cacheKey = REDIS_KEYS.supplies(printerName);

  // 1. Redis cache check ONLY - no hardware fallback
  const cached = await redisConnection.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as PrinterSupplyStatus;
  }

  // Cache miss -> return empty (heartbeat will populate on next sweep)
  return { ...EMPTY_RESULT };
}

