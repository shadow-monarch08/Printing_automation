import { PrinterFactory } from "../../factories/printer.factory";
import { redisConnection } from "../../infrastructure/redis";

// ── Canonical return type ────────────────────────────────────────────────────
export interface PrinterSupplyStatus {
  status: "online" | "offline";
  paper: "ready" | "empty" | "unknown";
  supplies: {
    black: number | null;
    color: number | null;
  };
}

export const EMPTY_RESULT: PrinterSupplyStatus = {
  status: "offline",
  paper: "unknown",
  supplies: { black: null, color: null },
};

// ── Public entry point ───────────────────────────────────────────────────────
export async function getSupplies(printerName: string): Promise<PrinterSupplyStatus> {
  const cacheKey = `supplies:${printerName}`;

  // 1. Redis cache check (5-minute TTL)
  const cached = await redisConnection.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as PrinterSupplyStatus;
  }

  // 2. Resolve adapter
  const adapter = await PrinterFactory.getAdapter(printerName);
  let result: PrinterSupplyStatus = { ...EMPTY_RESULT };

  if (adapter) {
    result = await adapter.getSupplies();
  }

  // 3. Cache result for 1 minute
  await redisConnection.setex(cacheKey, 60, JSON.stringify(result));

  return result;
}

