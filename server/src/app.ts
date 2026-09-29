import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import printerRoutes from "./app/routes/printer.routes";
import printRoutes from "./app/routes/print.routes";
import jobsRoutes from "./app/routes/jobs.routes";
import configRoutes from "./app/routes/config.routes";
import authRoutes from "./app/routes/auth.routes";
import utilsRoutes from "./app/routes/utils.routes";
import eventsRoutes from "./app/routes/events.routes";
import wifiRoutes from "./app/routes/wifi.routes";
import fleetRoutes from "./app/routes/fleet.routes";
import sessionRoutes from "./app/routes/session.routes";
import analyticsRoutes from "./app/routes/analytics.routes";
import onboardingRoutes from "./app/routes/onboarding.routes";
import { requireLoopbackOnly } from "./app/middlewares/onboarding.middleware";
import { globalErrorHandler } from "./app/middlewares/errorHandler.middleware";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Resolve paths for the decoupled frontends with resilient fallbacks
const resolveUIPath = (...candidates: string[]): string => {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
};

const CUSTOMER_PATH = resolveUIPath(
  path.join(__dirname, "../../customer-ui/dist"),
  path.join(__dirname, "../public/customer"),
  path.join(__dirname, "../public")
);

const ADMIN_PATH = resolveUIPath(
  path.join(__dirname, "../../admin-ui/dist"),
  path.join(__dirname, "../public/admin"),
  path.join(__dirname, "../../admin")
);

const KIOSK_PATH = resolveUIPath(
  path.join(__dirname, "../../kiosk-ui/dist"),
  path.join(__dirname, "../public/terminal")
);

// Static assets per domain
app.use("/terminal", requireLoopbackOnly, express.static(KIOSK_PATH));
app.use("/admin", express.static(ADMIN_PATH));
app.use(express.static(CUSTOMER_PATH));

// API routes
app.use("/setup", onboardingRoutes);
app.use("/printers", printerRoutes);
app.use("/print", printRoutes);
app.use("/jobs", jobsRoutes);
app.use("/config", configRoutes);
app.use("/auth", authRoutes);
app.use("/utils", utilsRoutes);
app.use("/wifi", wifiRoutes);
app.use("/fleet", fleetRoutes);
app.use("/session", sessionRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/", eventsRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Dedicated Physical Kiosk Terminal Route (Restricted strictly to 127.0.0.1 / loopback)
app.get(/^\/terminal(\/.*)?$/, requireLoopbackOnly, (_req, res) => {
  res.sendFile(path.join(KIOSK_PATH, "index.html"));
});

// Admin Control Room SPA route
app.get(/^\/admin(\/.*)?$/, (_req, res) => {
  res.sendFile(path.join(ADMIN_PATH, "index.html"));
});

// Customer Flow SPA Catch-all
app.get(/.*/, (req, res) => {
  if (req.path.startsWith("/terminal")) {
    return res.redirect("/");
  }
  res.sendFile(path.join(CUSTOMER_PATH, "index.html"));
});

// Global Error Handler
app.use(globalErrorHandler);

export default app;
