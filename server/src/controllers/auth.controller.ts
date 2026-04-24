import { Request, Response } from "express";
import * as authService from "../services/auth.service";

export async function login(req: Request, res: Response) {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ success: false, message: "PIN is required" });
  }

  try {
    const token = await authService.login(pin);
    if (!token) {
      return res.status(401).json({ success: false, message: "Invalid PIN" });
    }
    res.json({ success: true, token });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Login failed", error: String(err) });
  }
}

export async function logout(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(400).json({ success: false, message: "No token provided" });
  }
  
  const token = authHeader.split(" ")[1];
  try {
    await authService.logout(token);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Logout failed", error: String(err) });
  }
}

export async function verify(req: Request, res: Response) {
  // If we reach this endpoint, the auth.middleware has already verified the token
  res.json({ success: true, message: "Token is valid" });
}
