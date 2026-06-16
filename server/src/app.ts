import express from "express";
import cors from "cors";
import path from "path";
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

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the admin UI (static files) from the public directory
app.use(express.static(path.join(__dirname, "../public")));

// API routes
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

// React Catch-all
app.get(/.*/, (_, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

export default app;
