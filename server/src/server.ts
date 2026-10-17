import http from "http";
import "./infrastructure/database";
import app from "./app";
import { initRealtimeGateway } from "./app/services/realtimeGateway.service";
import { getSystemConfig, updateSystemConfig } from "./app/services/config.db.service";
import { startMetricsPolling } from "./app/services/metrics.service";
import { startQuickTunnel } from "./app/services/tunnel.service";
import { startRecoveryMonitoring } from "./app/services/networkRecovery.service";
import { ensureHotspotProfile } from "./app/services/hotspot.service";
import { hydrateSystem } from "./infrastructure/boot";
import { startCloudSync } from "./app/services/cloudSync.service";

const PORT = parseInt(process.env.PORT || "3000", 10);

const server = http.createServer(app);

// Initialize Realtime Multi-Room WebSocket Gateway
initRealtimeGateway(server);

async function startServer() {
  await hydrateSystem();

  await import("./infrastructure/printMaster.queue");
  await import("./infrastructure/printMaster.worker");
  await import("./infrastructure/printMaster.events");

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🖨️  Print server running at http://0.0.0.0:${PORT}`);
    
    // Phase 4 Initialization Seam
    const config = getSystemConfig();
    if (!config) {
      updateSystemConfig({
        isOnboarded: false,
        shopName: 'Modern Press'
      });
      console.log("⚙️ System Config initialized with defaults");
    }

    // Phase 8.1 & 8.2: Start system metrics telemetry
    startMetricsPolling();

    // Launch Quick Cloudflare Tunnel (guarded by security gate: isOnboarded && provisioningState === 'READY')
    startQuickTunnel(PORT);

    // Pre-seed Kiosk-Hotspot profile idempotently in NetworkManager
    ensureHotspotProfile().catch((err) => {
      console.warn("⚠️ [Hotspot Service] Warning pre-seeding Kiosk-Hotspot profile:", err?.message || err);
    });

    // Launch continuous Network Recovery Daemon (operates whenever system is onboarded)
    startRecoveryMonitoring();

    // Launch Central NMS CloudSync Daemon (Channel 1 Telemetry, Channel 2 Alerts, Channel 3 EOD Audit)
    startCloudSync();
  });
}

// Process-level Crash Protection
process.on("uncaughtException", (err) => {
  console.error("💥 [CRITICAL] Uncaught Exception in Node process:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("💥 [CRITICAL] Unhandled Rejection in background task:", reason);
});

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
