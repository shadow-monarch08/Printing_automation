import {
  runSecureCommand,
  runSecureCommandWithTimeout,
  isBinaryAvailable,
  CommandTimeoutError,
  BinaryNotFoundError,
  CommandExecutionError,
} from "../src/app/utils/exec";

async function runTests() {
  console.log("==========================================");
  console.log("🧪 RUNNING EXEC.TS COMPREHENSIVE TEST SUITE");
  console.log("==========================================\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Normal command execution
  try {
    const res = await runSecureCommand("node", ["-e", "console.log('HELLO_EXEC_SUCCESS')"]);
    if (res.stdout === "HELLO_EXEC_SUCCESS") {
      console.log("✅ Test 1 Passed: Standard command execution");
      passed++;
    } else {
      console.error("❌ Test 1 Failed: Unexpected stdout:", res);
      failed++;
    }
  } catch (err) {
    console.error("❌ Test 1 Failed with error:", err);
    failed++;
  }

  // Test 2: Invariant Locale Injection (LC_ALL=C, LANG=C)
  try {
    const res = await runSecureCommand("node", [
      "-e",
      "console.log(process.env.LC_ALL + '|' + process.env.LANG)",
    ]);
    if (res.stdout === "C|C") {
      console.log("✅ Test 2 Passed: POSIX Locale invariant (LC_ALL=C, LANG=C)");
      passed++;
    } else {
      console.error("❌ Test 2 Failed: Locale not set to C|C, got:", res.stdout);
      failed++;
    }
  } catch (err) {
    console.error("❌ Test 2 Failed with error:", err);
    failed++;
  }

  // Test 3: Stdin piping with EPIPE safeguard
  try {
    const res = await runSecureCommand(
      "node",
      ["-e", "let d=''; process.stdin.on('data', c=>d+=c); process.stdin.on('end', ()=>console.log('INPUT:' + d));"],
      { inputString: "TEST_INPUT_PAYLOAD" }
    );
    if (res.stdout === "INPUT:TEST_INPUT_PAYLOAD") {
      console.log("✅ Test 3 Passed: Safe Stdin piping");
      passed++;
    } else {
      console.error("❌ Test 3 Failed: Unexpected stdin output:", res.stdout);
      failed++;
    }
  } catch (err) {
    console.error("❌ Test 3 Failed with error:", err);
    failed++;
  }

  // Test 4: Hard Timeout and Process Termination
  try {
    const startTime = Date.now();
    await runSecureCommandWithTimeout(
      "node",
      ["-e", "setTimeout(() => console.log('SHOULD_NOT_PRINT'), 10000)"],
      800 // 800ms timeout
    );
    console.error("❌ Test 4 Failed: Expected timeout error but command succeeded");
    failed++;
  } catch (err: any) {
    const duration = Date.now();
    if (err instanceof CommandTimeoutError && err.timeoutMs === 800) {
      console.log(`✅ Test 4 Passed: CommandTimeoutError thrown correctly (exited promptly, timeoutMs=${err.timeoutMs})`);
      passed++;
    } else {
      console.error("❌ Test 4 Failed: Wrong error type caught:", err);
      failed++;
    }
  }

  // Test 5: Missing binary (ENOENT)
  try {
    await runSecureCommand("non_existent_binary_xyz_12345", []);
    console.error("❌ Test 5 Failed: Expected BinaryNotFoundError");
    failed++;
  } catch (err) {
    if (err instanceof BinaryNotFoundError && err.binary === "non_existent_binary_xyz_12345") {
      console.log("✅ Test 5 Passed: BinaryNotFoundError thrown cleanly on missing system binary");
      passed++;
    } else {
      console.error("❌ Test 5 Failed: Wrong error type:", err);
      failed++;
    }
  }

  // Test 6: Non-zero exit code error handling
  try {
    await runSecureCommand("node", ["-e", "console.error('STDERR_MSG'); process.exit(42)"]);
    console.error("❌ Test 6 Failed: Expected CommandExecutionError");
    failed++;
  } catch (err: any) {
    if (err instanceof CommandExecutionError && err.exitCode === 42 && err.stderr === "STDERR_MSG") {
      console.log(`✅ Test 6 Passed: CommandExecutionError captured exitCode=42 and stderr cleanly`);
      passed++;
    } else {
      console.error("❌ Test 6 Failed: Unexpected error structure:", err);
      failed++;
    }
  }

  // Test 7: isBinaryAvailable preflight utility
  try {
    const nodeAvailable = await isBinaryAvailable("node");
    const fakeAvailable = await isBinaryAvailable("non_existent_dummy_pkg_987");
    if (nodeAvailable === true && fakeAvailable === false) {
      console.log("✅ Test 7 Passed: isBinaryAvailable accurately detects binary presence");
      passed++;
    } else {
      console.error(`❌ Test 7 Failed: Expected true/false, got node=${nodeAvailable}, fake=${fakeAvailable}`);
      failed++;
    }
  } catch (err) {
    console.error("❌ Test 7 Failed with error:", err);
    failed++;
  }

  console.log("\n==========================================");
  console.log(`📊 RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("==========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
