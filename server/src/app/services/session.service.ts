import { randomUUID } from "crypto";
import { upsertSession } from "./printJob.db.service";

export function initSession(userAgent?: string, ipAddress?: string): string {
  const sessionId = randomUUID();
  
  upsertSession(sessionId, userAgent, ipAddress);

  return sessionId;
}
