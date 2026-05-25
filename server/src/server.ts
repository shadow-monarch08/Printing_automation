import "./infrastructure/printMaster.queue";
import "./infrastructure/printMaster.worker";
import app from "./app";

import { startHeartbeatLoop } from "./app/services/printer.service";

import { startMetricsPolling } from "./app/services/metrics.service";

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🖨️  Print server running at http://0.0.0.0:${PORT}`);
  
  // Phase 1: Heartbeat loop
  await startHeartbeatLoop();

  // Phase 8.1 & 8.2: Start system metrics telemetry
  startMetricsPolling();
});
