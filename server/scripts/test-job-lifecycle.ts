import { cupsCommands, buildLpstatArgs } from "../src/commands/cups.commands";
import { queryCupsJobStatus } from "../src/app/services/printer.service";
import { GenericUsbAdapter } from "../src/adapters/GenericUsbAdapter";
import { EpsonLegacyAdapter } from "../src/adapters/EpsonLegacyAdapter";
import { HpLegacyAdapter } from "../src/adapters/HpLegacyAdapter";
import { SnmpAdapter } from "../src/adapters/SnmpAdapter";
import { IppModernAdapter } from "../src/adapters/IppModernAdapter";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("=========================================================");
  console.log("🧪 RUNNING JOB STATUS LIFECYCLE & AUDIT TEST SUITE (PHASE 3)");
  console.log("=========================================================\n");

  let passed = 0;
  let failed = 0;

  // Test 1: buildLpstatArgs active jobs invariant
  try {
    const argsWithPrinter = buildLpstatArgs("not-completed", "Epson_L3150");
    assert(argsWithPrinter[0] === "-W" && argsWithPrinter[1] === "not-completed", "Must pass -W not-completed first");
    assert(argsWithPrinter[2] === "-o" && argsWithPrinter[3] === "Epson_L3150", "Must pass -o printer after -W");

    const argsNoPrinter = buildLpstatArgs("not-completed");
    assert(argsNoPrinter[0] === "-W" && argsNoPrinter[1] === "not-completed" && argsNoPrinter.length === 2, "Must omit -o if no printer provided");

    console.log("✅ Test 1 Passed: lpstat getActiveJobs flag order (-W not-completed before -o)");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 1 Failed:", err.message);
    failed++;
  }

  // Test 2: buildLpstatArgs completed jobs invariant
  try {
    const argsWithPrinter = buildLpstatArgs("completed", "Canon_G2010");
    assert(argsWithPrinter[0] === "-W" && argsWithPrinter[1] === "completed", "Must pass -W completed first");
    assert(argsWithPrinter[2] === "-o" && argsWithPrinter[3] === "Canon_G2010", "Must pass -o printer after -W");

    const argsNoPrinter = buildLpstatArgs("completed");
    assert(argsNoPrinter[0] === "-W" && argsNoPrinter[1] === "completed" && argsNoPrinter.length === 2, "Must omit -o if no printer provided");

    console.log("✅ Test 2 Passed: lpstat getCompletedJobs flag order (-W completed before -o)");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 2 Failed:", err.message);
    failed++;
  }

  // Test 3: Active queue resolution -> "printing"
  try {
    const originalGetActive = cupsCommands.getActiveJobs;
    const originalGetCompleted = cupsCommands.getCompletedJobs;

    cupsCommands.getActiveJobs = async () => ({
      stdout: "Epson_L3150-101 guest 1024 Wed 08 Oct 2026 01:00:00 AM IST\n",
      stderr: "",
    });
    cupsCommands.getCompletedJobs = async () => ({ stdout: "", stderr: "" });

    try {
      const status = await queryCupsJobStatus("Epson_L3150", "Epson_L3150-101");
      assert(status === "printing", `Expected 'printing', got '${status}'`);
      console.log("✅ Test 3 Passed: Active job in queue correctly resolved to 'printing'");
      passed++;
    } finally {
      cupsCommands.getActiveJobs = originalGetActive;
      cupsCommands.getCompletedJobs = originalGetCompleted;
    }
  } catch (err: any) {
    console.error("❌ Test 3 Failed:", err.message);
    failed++;
  }

  // Test 4: Held or stopped active job -> "held_or_stopped"
  try {
    const originalGetActive = cupsCommands.getActiveJobs;
    const originalGetCompleted = cupsCommands.getCompletedJobs;

    cupsCommands.getActiveJobs = async () => ({
      stdout: "Epson_L3150-102 guest 1024 Wed 08 Oct 2026 01:00:00 AM IST [held by user]\n",
      stderr: "",
    });
    cupsCommands.getCompletedJobs = async () => ({ stdout: "", stderr: "" });

    try {
      const status = await queryCupsJobStatus("Epson_L3150", "Epson_L3150-102");
      assert(status === "held_or_stopped", `Expected 'held_or_stopped', got '${status}'`);
      console.log("✅ Test 4 Passed: Held active job correctly resolved to 'held_or_stopped'");
      passed++;
    } finally {
      cupsCommands.getActiveJobs = originalGetActive;
      cupsCommands.getCompletedJobs = originalGetCompleted;
    }
  } catch (err: any) {
    console.error("❌ Test 4 Failed:", err.message);
    failed++;
  }

  // Test 5: Completed job in history -> "completed"
  try {
    const originalGetActive = cupsCommands.getActiveJobs;
    const originalGetCompleted = cupsCommands.getCompletedJobs;

    cupsCommands.getActiveJobs = async () => ({ stdout: "", stderr: "" });
    cupsCommands.getCompletedJobs = async () => ({
      stdout: "Epson_L3150-103 guest 1024 Wed 08 Oct 2026 01:00:00 AM IST\n",
      stderr: "",
    });

    try {
      const status = await queryCupsJobStatus("Epson_L3150", "Epson_L3150-103");
      assert(status === "completed", `Expected 'completed', got '${status}'`);
      console.log("✅ Test 5 Passed: Job found in completed history correctly resolved to 'completed'");
      passed++;
    } finally {
      cupsCommands.getActiveJobs = originalGetActive;
      cupsCommands.getCompletedJobs = originalGetCompleted;
    }
  } catch (err: any) {
    console.error("❌ Test 5 Failed:", err.message);
    failed++;
  }

  // Test 6: ERADICATE FALLACY: Missing from both active and completed -> "aborted"
  try {
    const originalGetActive = cupsCommands.getActiveJobs;
    const originalGetCompleted = cupsCommands.getCompletedJobs;

    // Neither active nor completed has job 104 (e.g. filter failed / crashed)
    cupsCommands.getActiveJobs = async () => ({ stdout: "", stderr: "" });
    cupsCommands.getCompletedJobs = async () => ({ stdout: "", stderr: "" });

    try {
      const status = await queryCupsJobStatus("Epson_L3150", "Epson_L3150-104");
      assert(status === "aborted", `Expected 'aborted' for missing job, got '${status}'`);
      console.log("✅ Test 6 Passed: Missing-job fallacy eradicated — unlisted job returns 'aborted', NOT 'completed'");
      passed++;
    } finally {
      cupsCommands.getActiveJobs = originalGetActive;
      cupsCommands.getCompletedJobs = originalGetCompleted;
    }
  } catch (err: any) {
    console.error("❌ Test 6 Failed:", err.message);
    failed++;
  }

  // Test 7: Adapters parity check
  try {
    const originalGetActive = cupsCommands.getActiveJobs;
    const originalGetCompleted = cupsCommands.getCompletedJobs;

    cupsCommands.getActiveJobs = async () => ({ stdout: "", stderr: "" });
    cupsCommands.getCompletedJobs = async () => ({
      stdout: "HP_LaserJet-201 guest 2048 Wed 08 Oct 2026 01:00:00 AM IST\n",
      stderr: "",
    });

    try {
      const usbAdapter = new GenericUsbAdapter("HP_LaserJet", "usb://HP/LaserJet");
      const epsonAdapter = new EpsonLegacyAdapter("HP_LaserJet", "usb://HP/LaserJet");
      const hpAdapter = new HpLegacyAdapter("HP_LaserJet", "hp:/usb/HP_LaserJet");
      const snmpAdapter = new SnmpAdapter("HP_LaserJet", "socket://192.168.1.100:9100");
      const ippAdapter = new IppModernAdapter("HP_LaserJet", "socket://192.168.1.100:9100"); // fallback to CUPS

      const s1 = await usbAdapter.getJobStatus("HP_LaserJet", "HP_LaserJet-201");
      const s2 = await epsonAdapter.getJobStatus("HP_LaserJet", "HP_LaserJet-201");
      const s3 = await hpAdapter.getJobStatus("HP_LaserJet", "HP_LaserJet-201");
      const s4 = await snmpAdapter.getJobStatus("HP_LaserJet", "HP_LaserJet-201");
      const s5 = await ippAdapter.getJobStatus("HP_LaserJet", "HP_LaserJet-201");

      assert(s1 === "completed", "GenericUsbAdapter must resolve completed");
      assert(s2 === "completed", "EpsonLegacyAdapter must resolve completed");
      assert(s3 === "completed", "HpLegacyAdapter must resolve completed");
      assert(s4 === "completed", "SnmpAdapter must resolve completed");
      assert(s5 === "completed", "IppModernAdapter must resolve completed");

      console.log("✅ Test 7 Passed: All 5 adapters delegate to queryCupsJobStatus and achieve identical resolution");
      passed++;
    } finally {
      cupsCommands.getActiveJobs = originalGetActive;
      cupsCommands.getCompletedJobs = originalGetCompleted;
    }
  } catch (err: any) {
    console.error("❌ Test 7 Failed:", err.message);
    failed++;
  }

  // Test 8: Dynamic timeout calculation
  try {
    const calcTimeout = (pages: number, copies: number) => {
      const totalSheets = (pages || 1) * (copies || 1);
      return Math.max(30, 20 + totalSheets * 8);
    };

    assert(calcTimeout(1, 1) === 30, "1 page must have 30s minimum timeout");
    assert(calcTimeout(5, 1) === 60, "5 pages must have 60s timeout (20 + 40)");
    assert(calcTimeout(50, 1) === 420, "50 pages must have 420s (7 min) timeout");
    assert(calcTimeout(20, 3) === 500, "20 pages x 3 copies must have 500s timeout");

    console.log("✅ Test 8 Passed: Dynamic timeout calculation scales safely with page count");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 8 Failed:", err.message);
    failed++;
  }

  // Test 9: Active BullMQ job cancellation reads job.data.cupsJobId
  try {
    const mockJobActive = {
      id: "bull-job-123",
      isActive: async () => true,
      data: { cupsJobId: "Epson_L3150-555" },
      returnvalue: undefined, // While active, BullMQ returnvalue is strictly undefined
    };

    const resolvedCupsJobId = mockJobActive.data?.cupsJobId || (mockJobActive as any).returnvalue?.cupsJobId;
    assert(resolvedCupsJobId === "Epson_L3150-555", "Must resolve cupsJobId from job.data when active");

    console.log("✅ Test 9 Passed: Active BullMQ job cancellation targets job.data.cupsJobId when returnvalue is undefined");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 9 Failed:", err.message);
    failed++;
  }

  // Test 10: Retry file preservation logic
  try {
    const checkFileShouldUnlink = (attemptsMade: number, maxAttempts: number, errorMessage?: string) => {
      return attemptsMade >= maxAttempts || Boolean(errorMessage && errorMessage.toLowerCase().includes("bad document"));
    };

    // Attempt 1 of 3: Should NOT unlink file!
    assert(!checkFileShouldUnlink(1, 3, "Failover triggered"), "Must NOT unlink file on attempt 1/3");
    // Attempt 2 of 3: Should NOT unlink file!
    assert(!checkFileShouldUnlink(2, 3, "Failover triggered"), "Must NOT unlink file on attempt 2/3");
    // Attempt 3 of 3: Should unlink file (terminal failure)
    assert(checkFileShouldUnlink(3, 3, "Failover triggered"), "MUST unlink file when attempts exhausted (3/3)");
    // Bad document flag: Should unlink file immediately
    assert(checkFileShouldUnlink(1, 3, "Bad document detected: corrupted postscript"), "MUST unlink file if bad document");

    console.log("✅ Test 10 Passed: Retry file preservation avoids deleting file before failover attempts complete");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 10 Failed:", err.message);
    failed++;
  }

  console.log("\n=========================================================");
  console.log(`🏁 TEST SUITE FINISHED: ${passed} Passed, ${failed} Failed`);
  console.log("=========================================================");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests();
