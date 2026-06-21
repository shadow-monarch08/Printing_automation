import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.service";
import db from "../../infrastructure/database";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS, REDIS_TTLS } from "../../infrastructure/redisKeys";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized: Missing token" });
  }
  const isValid = await verifyToken(token);

  if (!isValid) {
    return res.status(401).json({ success: false, message: "Unauthorized: Invalid or expired token" });
  }

  next();
}

export async function requireValidSession(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.headers["x-session-id"] as string;

    if (!sessionId) {
      return res.status(401).json({ success: false, code: "SESSION_MISSING", message: "Unauthorized: Missing session ID" });
    }

    const key = REDIS_KEYS.session(sessionId);
    const cachedSession = await redisConnection.get(key);

    if (cachedSession) {
      await redisConnection.expire(key, REDIS_TTLS.SESSION);
      (req as any).session = { id: sessionId };
      return next();
    }

    const session = db.prepare("SELECT session_id FROM kiosk_sessions WHERE session_id = ?").get(sessionId);
    if (!session) {
      return res.status(401).json({ success: false, code: "SESSION_INVALID", message: "Unauthorized: Invalid or expired session ID" });
    }
    
    await redisConnection.setex(key, REDIS_TTLS.SESSION, JSON.stringify({ active: true }));
    (req as any).session = { id: sessionId };

    next();
  } catch (err) {
    console.error("[requireValidSession] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during session validation" });
  }
}
