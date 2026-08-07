import http from "http";
import "./infrastructure/database";
import app from "./app";
import { initWebSocketServer } from "./app/controllers/events.controller";
import { getSystemConfig, updateSystemConfig } from "./app/services/config.db.service";
import { startMetricsPolling } from "./app/services/metrics.service";
import { startQuickTunnel } from "./app/services/tunnel.service";
import { hydrateSystem } from "./infrastructure/boot";

const PORT = parseInt(process.env.PORT || "3000", 10);

const server = http.createServer(app);

// Initialize WebSocket server
initWebSocketServer(server);

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

    // Launch Quick Cloudflare Tunnel (guarded by security gate: isOnboarded && !isSetupMode)
    startQuickTunnel(PORT);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
