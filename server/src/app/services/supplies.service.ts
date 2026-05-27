import { PrinterFactory } from "../../factories/printer.factory";
import { redisConnection } from "../../infrastructure/redis";

// ── Canonical return type ────────────────────────────────────────────────────
export interface PrinterSupplyStatus {
  paper: "ready" | "empty" | "unknown";
  supplies: {
    black: number | null;
    color: number | null;
  };
}

export const EMPTY_RESULT: PrinterSupplyStatus = {
  paper: "unknown",
  supplies: { black: null, color: null },
};

// ── Public entry point ───────────────────────────────────────────────────────
export async function getSupplies(printerName: string): Promise<PrinterSupplyStatus> {
  const cacheKey = `supplies:${printerName}`;

  // 1. Redis cache check ONLY - no hardware fallback
  const cached = await redisConnection.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as PrinterSupplyStatus;
  }

  // Cache miss -> return empty (heartbeat will populate on next sweep)
  return { ...EMPTY_RESULT };
}

