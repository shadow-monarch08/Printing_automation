import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.service";
import db from "../../infrastructure/database";

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
  const sessionId = req.headers["x-session-id"];

  if (!sessionId) {
    return res.status(401).json({ success: false, code: "SESSION_MISSING", message: "Unauthorized: Missing session ID" });
  }

  const session = db.prepare("SELECT * FROM kiosk_sessions WHERE session_id = ?").get(sessionId);
  if (!session) {
    return res.status(401).json({ success: false, code: "SESSION_INVALID", message: "Unauthorized: Invalid or expired session ID" });
  }
  
  // Attach session id to request
  (req as any).session = { id: sessionId };

  next();
}
