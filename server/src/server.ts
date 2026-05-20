import "./infrastructure/printMaster.queue";
import "./infrastructure/printMaster.worker";
import app from "./app";

import { digitalStartupHealthSweep } from "./app/services/printer.service";

import { startMetricsPolling } from "./app/services/metrics.service";

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🖨️  Print server running at http://0.0.0.0:${PORT}`);
  
  // Phase 3.2: Digital Startup Health Sweep
  await digitalStartupHealthSweep();

  // Phase 8.1 & 8.2: Start system metrics telemetry
  startMetricsPolling();
});
