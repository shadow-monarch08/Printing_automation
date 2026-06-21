import { randomUUID } from "crypto";
import { upsertSession } from "./printJob.db.service";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";

export async function initSession(userAgent?: string, ipAddress?: string): Promise<string> {
  const sessionId = randomUUID();
  
  upsertSession(sessionId, userAgent, ipAddress);
  await redisConnection.setex(REDIS_KEYS.session(sessionId), REDIS_TTLS.SESSION, JSON.stringify({ active: true }));

  return sessionId;
}
