import { randomUUID } from "crypto";
import { upsertSession } from "./printJob.db.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";
import db from "../../infrastructure/database";
import { getSystemConfig } from "./config.db.service";
import { getPricingConfig } from "./pricing.service";
import * as printerService from "./printer.service";
import { printMasterQueue } from "../../infrastructure/printMaster.queue";

export interface ShopBootstrapManifest {
  name: string;
  isAcceptingJobs: boolean;
  fleetCapabilities: {
    color: boolean;
    duplex: boolean;
  };
  pricing: any;
}

export interface SessionBootstrapResult {
  sessionId: string;
  shop: ShopBootstrapManifest;
}

export async function initSession(userAgent?: string, ipAddress?: string): Promise<string> {
  const sessionId = randomUUID();
  upsertSession(sessionId, userAgent, ipAddress);
  await redisConnection.setex(
    REDIS_KEYS.session(sessionId),
    REDIS_TTLS.SESSION,
    JSON.stringify({ active: true })
  );
  return sessionId;
}

/**
 * Iron-clad 1-RTT session bootstrap for customer clients.
 * Validates any existing session from localStorage (or creates a new one),
 * and aggregates shop identity, live fleet readiness, and pricing into a single payload.
 */
export async function bootstrapSession(
  existingSessionId?: string,
  userAgent?: string,
  ipAddress?: string
): Promise<SessionBootstrapResult> {
  let activeSessionId: string | null = null;

  // 1. Session Validation / Creation
  if (existingSessionId && existingSessionId.trim().length > 0) {
    const key = REDIS_KEYS.session(existingSessionId);
    const cached = await redisConnection.get(key);
    if (cached) {
      await redisConnection.expire(key, REDIS_TTLS.SESSION);
      activeSessionId = existingSessionId;
    } else {
      const dbRow = db
        .prepare("SELECT session_id FROM kiosk_sessions WHERE session_id = ?")
        .get(existingSessionId);
      if (dbRow) {
        await redisConnection.setex(
          key,
          REDIS_TTLS.SESSION,
          JSON.stringify({ active: true })
        );
        activeSessionId = existingSessionId;
      }
    }
  }

  if (!activeSessionId) {
    activeSessionId = await initSession(userAgent, ipAddress);
  }

  // 2. Resolve Shop Identity
  const sysConfig = getSystemConfig();
  const shopName = sysConfig?.shopName || "Modern Press";

  // 3. Resolve Fleet Capabilities & Operational Readiness
  let isAcceptingJobs = false;
  let color = false;
  let duplex = false;

  try {
    const isPaused = await printMasterQueue.isPaused();
    if (!isPaused) {
      const printers = await printerService.listPrinters();
      const availablePrinters = printers.filter(
        (p) => p.status === "idle" || p.status === "busy"
      );
      if (availablePrinters.length > 0) {
        isAcceptingJobs = true;
        for (const p of availablePrinters) {
          if (p.capabilities?.includes("color")) color = true;
          if (p.capabilities?.includes("duplex")) duplex = true;
        }
      }
    }
  } catch (err) {
    console.warn("[Session Service] Failed to inspect queue/printer readiness:", err);
  }

  // 4. Resolve Pricing Configuration
  let pricing: any = null;
  try {
    pricing = await getPricingConfig();
  } catch (err) {
    console.warn("[Session Service] Failed to retrieve pricing config:", err);
  }

  return {
    sessionId: activeSessionId,
    shop: {
      name: shopName,
      isAcceptingJobs,
      fleetCapabilities: { color, duplex },
      pricing,
    },
  };
}
