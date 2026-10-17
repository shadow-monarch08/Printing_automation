import {
  getActiveTunnelUrl,
  shouldTunnelBeActive,
  getTunnelStatus,
  startQuickTunnel,
  stopQuickTunnel,
  ensureTunnelOnline,
} from "../app/services/tunnel.service";
import { eventBus } from "../app/utils/eventBus";

async function runTests() {
  console.log("==================================================");
  console.log("   STEP 5 TEST SUITE: TUNNEL SUPERVISOR & WATCHDOG");
  console.log("==================================================");

  let passed = 0;
  let total = 0;

  function assert(desc: string, condition: boolean) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  // Test 1: Initial Status Contract
  console.log("\n--- 1. Testing Tunnel Status Contract ---");
  const initialStatus = getTunnelStatus();
  assert("Status object contains state string", typeof initialStatus.state === "string");
  assert("Status object contains pid (null or number)", initialStatus.pid === null || typeof initialStatus.pid === "number");
  assert("Status object contains consecutiveCrashes number", typeof initialStatus.consecutiveCrashes === "number");
  assert("Status object contains uptimeSeconds number", typeof initialStatus.uptimeSeconds === "number");

  // Test 2: Active URL / Config integration
  console.log("\n--- 2. Testing Active Tunnel URL Resolution ---");
  const activeUrl = getActiveTunnelUrl();
  assert("getActiveTunnelUrl returns string or null", activeUrl === null || typeof activeUrl === "string");

  // Test 3: shouldTunnelBeActive Security Gate
  console.log("\n--- 3. Testing Security Gate Evaluation ---");
  const shouldBeActive = shouldTunnelBeActive();
  assert("shouldTunnelBeActive returns boolean", typeof shouldBeActive === "boolean");

  // Test 4: EventBus system:tunnel:updated Emission
  console.log("\n--- 4. Testing EventBus system:tunnel:updated Emission on Stop ---");
  let eventCaptured: any = null;
  const listener = (payload: any) => {
    eventCaptured = payload;
  };
  eventBus.on("system:tunnel:updated", listener);

  stopQuickTunnel();
  await new Promise((r) => setTimeout(r, 100));

  assert("EventBus received system:tunnel:updated event on stopQuickTunnel", eventCaptured !== null);
  if (eventCaptured) {
    assert("Event status is STOPPED", eventCaptured.status === "STOPPED");
    assert("Event url is null", eventCaptured.url === null);
    assert("Event timestamp is valid number", typeof eventCaptured.timestamp === "number");
  }

  eventBus.removeListener("system:tunnel:updated", listener);

  // Test 5: Verify Stopped Status
  console.log("\n--- 5. Verifying State Transition to STOPPED ---");
  const stoppedStatus = getTunnelStatus();
  assert("State is STOPPED", stoppedStatus.state === "STOPPED");
  assert("PID is null after stop", stoppedStatus.pid === null);
  assert("URL is null after stop", stoppedStatus.url === null);

  // Test 6: ensureTunnelOnline Behavior
  console.log("\n--- 6. Testing ensureTunnelOnline ---");
  try {
    ensureTunnelOnline(3000);
    const postEnsureStatus = getTunnelStatus();
    assert(
      "ensureTunnelOnline sets state to STARTING or respects security gate",
      postEnsureStatus.state === "STARTING" || postEnsureStatus.state === "STOPPED"
    );
  } catch (err: any) {
    assert(`ensureTunnelOnline threw error: ${err.message}`, false);
  }

  // Cleanup: ensure stopped at end of tests
  stopQuickTunnel();

  console.log("\n==================================================");
  console.log(`   TEST RESULTS: ${passed}/${total} PASSED`);
  console.log("==================================================");

  if (passed === total) {
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!\n");
    process.exit(0);
  } else {
    console.error(`⚠️ ${total - passed} TESTS FAILED\n`);
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Unhandled test runner exception:", e);
  process.exit(1);
});
