import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.service";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized: Missing token" });
  }

  const token = authHeader.split(" ")[1];
  const isValid = await verifyToken(token);

  if (!isValid) {
    return res.status(401).json({ success: false, message: "Unauthorized: Invalid or expired token" });
  }

  next();
}
