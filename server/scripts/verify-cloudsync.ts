import { ensureEnrolled, sendTelemetryHeartbeat, sendEmergencyAlert, reconcileDailyAudit } from "../src/app/services/cloudSync.service";
import { getSystemConfig } from "../src/app/services/config.db.service";

async function runTest() {
  console.log("==================================================");
  console.log("🧪 TESTING EDGE PI CLOUDSYNC INTEGRATION");
  console.log("==================================================");

  // 1. Enrollment
  console.log("\n[TEST 1] Testing Auto-Enrollment (Channel 0)...");
  const creds = await ensureEnrolled();
  console.log("Result:", creds);

  if (!creds) {
    console.error("Enrollment failed. Aborting remaining tests.");
    process.exit(1);
  }

  // 2. Telemetry Heartbeat
  console.log("\n[TEST 2] Testing Telemetry Heartbeat (Channel 1)...");
  await sendTelemetryHeartbeat();
  console.log("Telemetry heartbeat dispatched.");

  // 3. Emergency Alert
  console.log("\n[TEST 3] Testing Emergency Alert Dispatch (Channel 2)...");
  await sendEmergencyAlert(
    "STORAGE_CRITICAL_HALT",
    "EMERGENCY",
    "Storage reached 96%. Emergency test pause triggered.",
    { diskPercent: 96, testRun: true }
  );
  console.log("Emergency alert dispatched.");

  // 4. Daily Reconciliation Audit
  console.log("\n[TEST 4] Testing Daily Audit Reconciliation (Channel 3)...");
  await reconcileDailyAudit();
  console.log("Daily audit reconciled.");

  console.log("\n[VERIFICATION] Checking SQLite Database Config State...");
  const config = getSystemConfig();
  console.log("Config stored in Pi SQLite:", {
    shopName: config?.shopName,
    nmsDeviceId: config?.nmsDeviceId,
    nmsDeviceSecret: config?.nmsDeviceSecret ? `${config.nmsDeviceSecret.substring(0, 8)}...` : null
  });

  console.log("\n==================================================");
  console.log("🎉 ALL EDGE PI CLOUDSYNC TESTS COMPLETED!");
  console.log("==================================================");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
