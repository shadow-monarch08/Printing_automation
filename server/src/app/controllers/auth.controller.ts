import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { ValidationError, UnauthorizedError } from "../utils/errors";

export async function login(req: Request, res: Response) {
  const { pin } = req.body;
  if (!pin) {
    throw new ValidationError("VALIDATION_PIN_REQUIRED", "PIN is required.");
  }

  const token = await authService.login(pin);
  if (!token) {
    throw new UnauthorizedError("AUTH_LOGIN_FAILED", "Invalid PIN.");
  }

  res.json({ success: true, token });
}

export async function logout(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ValidationError("VALIDATION_TOKEN_REQUIRED", "No Bearer token provided.");
  }

  const token = authHeader.split(" ")[1];
  await authService.logout(token);
  res.json({ success: true, message: "Logged out successfully" });
}

export async function verify(_req: Request, res: Response) {
  res.json({ success: true, message: "Token is valid" });
}
