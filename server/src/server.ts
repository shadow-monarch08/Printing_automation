import http from "http";
import "./infrastructure/database";
import "./infrastructure/printMaster.queue";
import "./infrastructure/printMaster.worker";
import "./infrastructure/printMaster.events";
import app from "./app";
import { initWebSocketServer } from "./app/controllers/events.controller";
import { getSystemConfig, updateSystemConfig } from "./app/services/config.db.service";

import { startHeartbeatLoop } from "./app/services/printer.service";

import { startMetricsPolling } from "./app/services/metrics.service";

const PORT = parseInt(process.env.PORT || "3000", 10);

const server = http.createServer(app);

// Initialize WebSocket server
initWebSocketServer(server);

server.listen(PORT, "0.0.0.0", async () => {
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

  // Phase 1: Heartbeat loop
  await startHeartbeatLoop();

  // Phase 8.1 & 8.2: Start system metrics telemetry
  startMetricsPolling();
});
