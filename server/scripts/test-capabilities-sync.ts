import {
  probePrinterCapabilities,
  upsertPrinterToDB,
  getPrinterFromDB,
  getAllPrintersFromDB,
  deletePrinterFromDB,
  getCapabilitiesConfig,
  updateCapabilitiesConfig,
} from "../src/app/services/printer.service";
import db from "../src/infrastructure/database";
import { findPrinter } from "../src/app/services/matchmaker.service";
import { redisConnection } from "../src/infrastructure/redis";
import { REDIS_KEYS } from "../src/infrastructure/redisKeys";
import { cupsCommands } from "../src/commands/cups.commands";

// Silence connection errors and provide in-memory Redis mock for local development isolation
redisConnection.removeAllListeners("error");
redisConnection.on("error", () => {}); // silence connection refused in tests

const inMemoryRedis = new Map<string, string>();
const inMemorySets = new Map<string, Set<string>>();

redisConnection.get = (async (key: string) => inMemoryRedis.get(key) || null) as any;
redisConnection.set = (async (key: string, val: string) => { inMemoryRedis.set(key, String(val)); return "OK"; }) as any;
redisConnection.del = (async (...keys: string[]) => { for (const k of keys) inMemoryRedis.delete(k); return 1; }) as any;
redisConnection.sadd = (async (key: string, ...members: string[]) => {
  if (!inMemorySets.has(key)) inMemorySets.set(key, new Set());
  const set = inMemorySets.get(key)!;
  for (const m of members) set.add(m);
  return members.length;
}) as any;
redisConnection.smembers = (async (key: string) => {
  return Array.from(inMemorySets.get(key) || []);
}) as any;
redisConnection.srem = (async (key: string, ...members: string[]) => {
  const set = inMemorySets.get(key);
  if (set) {
    for (const m of members) set.delete(m);
  }
  return 1;
}) as any;

async function runTests() {
  console.log("================================================================================");
  console.log("  PHASE 6 VERIFICATION SUITE: CAPABILITY DISCOVERY & PURE SQLITE SYNC");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(name: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}${details ? ` -> ${details}` : ""}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: SQLite Schema & Pure Database Persistence
    // -------------------------------------------------------------------------
    console.log("--- TEST 1: SQLite Persistence & CRUD Operations ---");
    const testPrinterId = "test_printer_phase6_" + Date.now();
    deletePrinterFromDB(testPrinterId);

    // Initial insert with auto
    upsertPrinterToDB(
      testPrinterId,
      "Test Auto Printer",
      ["grayscale", "a4"],
      "usb://Test/Printer?serial=123",
      "usb",
      "auto"
    );

    let record = getPrinterFromDB(testPrinterId);
    assert(
      "SQLite correctly stores and retrieves printer record",
      record !== null &&
        record.id === testPrinterId &&
        record.alias === "Test Auto Printer" &&
        record.type === "usb" &&
        record.capabilities_source === "auto" &&
        record.capabilities.includes("grayscale") &&
        record.capabilities.includes("a4")
    );

    // -------------------------------------------------------------------------
    // TEST 2: Admin Manual Override Immunity
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Admin Manual Override Immunity ---");
    // Admin toggles capabilities manually in Step 2 / Fleet page
    upsertPrinterToDB(
      testPrinterId,
      "Test Manual Printer",
      ["color", "duplex", "a4"],
      undefined,
      "network",
      "manual"
    );

    record = getPrinterFromDB(testPrinterId);
    assert(
      "Admin manual override marks capabilities_source as 'manual'",
      record !== null &&
        record.capabilities_source === "manual" &&
        record.capabilities.includes("color") &&
        record.capabilities.includes("duplex")
    );

    // Now simulate an autonomous heartbeat sweep attempting to upsert with auto capabilities
    upsertPrinterToDB(
      testPrinterId,
      "Heartbeat Detected Name",
      ["grayscale", "a4"], // autonomous sweep thinks it's only grayscale
      undefined,
      "network",
      "auto" // heartbeat runs with auto
    );

    record = getPrinterFromDB(testPrinterId);
    assert(
      "Heartbeat auto-sweep NEVER overwrites admin manual capabilities",
      record !== null &&
        record.capabilities_source === "manual" &&
        record.capabilities.includes("color") &&
        record.capabilities.includes("duplex") &&
        !record.capabilities.includes("grayscale"),
      `Got capabilities: ${JSON.stringify(record?.capabilities)} and source: ${record?.capabilities_source}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Backward-Compatible SQLite Config Wrappers
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: SQLite Config Wrappers (Deprecating capabilities.json) ---");
    const allConfig = await getCapabilitiesConfig();
    assert(
      "getCapabilitiesConfig retrieves data directly from SQLite",
      allConfig[testPrinterId] !== undefined &&
        allConfig[testPrinterId].capabilities.includes("color") &&
        allConfig[testPrinterId].capabilities_source === "manual"
    );

    // Clean up test printer
    deletePrinterFromDB(testPrinterId);
    assert(
      "deletePrinterFromDB properly deletes printer row from SQLite",
      getPrinterFromDB(testPrinterId) === null
    );

    // -------------------------------------------------------------------------
    // TEST 4: Tier 2 Universal Vendor PPD Parser Probing
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Tier 2 Universal Vendor PPD Parser Probing ---");
    const origGetPrinterOptions = cupsCommands.getPrinterOptions;

    // 4a. Standard CUPS PPD (RGB + Duplex)
    cupsCommands.getPrinterOptions = async () => ({
      stdout: `
ColorModel/Color Mode: Gray *RGB CMYK
Duplex/Two-Sided Printing: None *DuplexNoTumble DuplexTumble
PageSize/Media Size: *A4 Letter
      `,
      stderr: "",
    });
    let caps = await probePrinterCapabilities("dummy_queue");
    assert(
      "Standard CUPS PPD: identifies 'color', 'duplex', and 'a4'",
      caps.includes("color") && caps.includes("duplex") && caps.includes("a4")
    );

    // 4a2. Generic PCL PPD with *Gray active (Simplex with *None and OptionDuplex=*False)
    cupsCommands.getPrinterOptions = async () => ({
      stdout: `
ColorModel/Color Mode: *Gray RGB CMYK
Duplex/Two-Sided Printing: *None DuplexNoTumble DuplexTumble
OptionDuplex/Duplex Unit: *False True
PageSize/Media Size: *A4 Letter
      `,
      stderr: "",
    });
    caps = await probePrinterCapabilities("dummy_queue");
    assert(
      "Generic PCL PPD: identifies 'grayscale' and NO duplex when *Gray and OptionDuplex=*False",
      caps.includes("grayscale") && !caps.includes("color") && !caps.includes("duplex") && caps.includes("a4")
    );

    // 4b. Standard CUPS Monochrome PPD (Gray only, No Duplex)
    cupsCommands.getPrinterOptions = async () => ({
      stdout: `
ColorModel/Color Mode: *Gray
Duplex/Two-Sided Printing: *None
      `,
      stderr: "",
    });
    caps = await probePrinterCapabilities("dummy_queue");
    assert(
      "Standard CUPS Monochrome PPD: identifies 'grayscale' and 'a4'",
      caps.includes("grayscale") && !caps.includes("color") && !caps.includes("duplex") && caps.includes("a4")
    );

    // 4c. IPP Everywhere / Driverless PPD
    cupsCommands.getPrinterOptions = async () => ({
      stdout: `
print-color-mode/Color Mode: monochrome *color
sides/Two-Sided: one-sided *two-sided-long-edge two-sided-short-edge
      `,
      stderr: "",
    });
    caps = await probePrinterCapabilities("dummy_queue");
    assert(
      "IPP Everywhere PPD: identifies 'color', 'duplex', and 'a4'",
      caps.includes("color") && caps.includes("duplex") && caps.includes("a4")
    );

    // 4d. Brother Vendor PPD (BRColor & BRDuplex)
    cupsCommands.getPrinterOptions = async () => ({
      stdout: `
BRColor/Color: *Color Mono
BRDuplex/Duplex: *Duplex None
      `,
      stderr: "",
    });
    caps = await probePrinterCapabilities("dummy_queue");
    assert(
      "Brother PPD: identifies 'color', 'duplex', and 'a4'",
      caps.includes("color") && caps.includes("duplex") && caps.includes("a4")
    );

    // 4e. Canon Vendor PPD (CNColorMode & CNDuplex)
    cupsCommands.getPrinterOptions = async () => ({
      stdout: `
CNColorMode/Color Mode: *Color Mono
CNDuplex/Duplex: *Duplex None
      `,
      stderr: "",
    });
    caps = await probePrinterCapabilities("dummy_queue");
    assert(
      "Canon PPD: identifies 'color', 'duplex', and 'a4'",
      caps.includes("color") && caps.includes("duplex") && caps.includes("a4")
    );

    // 4f. HP HPLIP Vendor PPD (HPColorMode & Duplex)
    cupsCommands.getPrinterOptions = async () => ({
      stdout: `
HPColorMode/Color Mode: *Color Grayscale
Duplex/Two-Sided: *DuplexNoTumble None
      `,
      stderr: "",
    });
    caps = await probePrinterCapabilities("dummy_queue");
    assert(
      "HP HPLIP PPD: identifies 'color', 'duplex', and 'a4'",
      caps.includes("color") && caps.includes("duplex") && caps.includes("a4")
    );

    // -------------------------------------------------------------------------
    // TEST 5: Tier 4 Model & URI Pattern Heuristics
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Tier 4 Model & URI Pattern Heuristics ---");
    // Simulate raw queue where lpoptions returns empty stdout
    cupsCommands.getPrinterOptions = async () => ({ stdout: "", stderr: "" });

    // 5a. Epson EcoTank
    caps = await probePrinterCapabilities("EPSON_L3150", "Epson EcoTank L3150 Series", "usb://EPSON/L3150");
    assert(
      "Tier 4 Heuristic: Epson EcoTank L3150 detected as 'color' and 'a4'",
      caps.includes("color") && caps.includes("a4") && !caps.includes("duplex")
    );

    // 5b. HP LaserJet Pro M404dw (Monochrome + Auto-Duplex)
    caps = await probePrinterCapabilities("HP_LaserJet_M404dw", "HP LaserJet Pro M404dw", "socket://192.168.1.50:9100");
    assert(
      "Tier 4 Heuristic: HP LaserJet M404dw detected as 'grayscale', 'duplex', and 'a4'",
      caps.includes("grayscale") && caps.includes("duplex") && caps.includes("a4") && !caps.includes("color")
    );

    // 5c. Brother DCP-L2540DN (Monochrome + Duplex)
    caps = await probePrinterCapabilities("Brother_DCP_L2540DN", "Brother DCP-L2540DN", "socket://192.168.1.60:9100");
    assert(
      "Tier 4 Heuristic: Brother DCP-L2540DN detected as 'grayscale', 'duplex', and 'a4'",
      caps.includes("grayscale") && caps.includes("duplex") && caps.includes("a4") && !caps.includes("color")
    );

    // -------------------------------------------------------------------------
    // TEST 6: Tier 5 Safe Baseline Fallback
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Tier 5 Safe Baseline Fallback ---");
    caps = await probePrinterCapabilities("UnknownGenericPrinter", "Generic Printer 999", "usb://Unknown/Device");
    assert(
      "Tier 5 Baseline: Unknown device defaults to ['grayscale', 'a4'] and is never empty",
      caps.includes("grayscale") && caps.includes("a4") && !caps.includes("color") && !caps.includes("duplex")
    );

    // Restore original cupsCommands
    cupsCommands.getPrinterOptions = origGetPrinterOptions;

    // -------------------------------------------------------------------------
    // TEST 7: Fleet Matchmaker Integration with Real Capabilities
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Fleet Matchmaker Capability Matching ---");
    const epsonColorId = "test_fleet_epson_" + Date.now();
    const hpDuplexId = "test_fleet_hp_" + Date.now();
    const canonAllId = "test_fleet_canon_" + Date.now();

    // Setup Redis fleet state
    await redisConnection.sadd(REDIS_KEYS.FLEET_PRINTERS, epsonColorId, hpDuplexId, canonAllId);

    // Epson: color, a4 (single-sided)
    await redisConnection.set(REDIS_KEYS.printerHealth(epsonColorId), "healthy");
    await redisConnection.set(REDIS_KEYS.printerState(epsonColorId), "idle");
    await redisConnection.set(
      REDIS_KEYS.printerInfo(epsonColorId),
      JSON.stringify({ name: epsonColorId, capabilities: ["color", "a4"], alias: "EcoTank Color" })
    );

    // HP: grayscale, duplex, a4
    await redisConnection.set(REDIS_KEYS.printerHealth(hpDuplexId), "healthy");
    await redisConnection.set(REDIS_KEYS.printerState(hpDuplexId), "idle");
    await redisConnection.set(
      REDIS_KEYS.printerInfo(hpDuplexId),
      JSON.stringify({ name: hpDuplexId, capabilities: ["grayscale", "duplex", "a4"], alias: "LaserJet Duplex" })
    );

    // Canon: color, duplex, a4
    await redisConnection.set(REDIS_KEYS.printerHealth(canonAllId), "healthy");
    await redisConnection.set(REDIS_KEYS.printerState(canonAllId), "idle");
    await redisConnection.set(
      REDIS_KEYS.printerInfo(canonAllId),
      JSON.stringify({ name: canonAllId, capabilities: ["color", "duplex", "a4"], alias: "Commercial Copier" })
    );

    const createMockJob = (overrides: any) => ({
      id: "job_" + Math.random(),
      filename: "test.pdf",
      filePath: "/dummy.pdf",
      owner: "Guest",
      sessionId: "s1",
      pages: 1,
      copies: 1,
      colorMode: "grayscale" as const,
      duplex: "single" as const,
      orientation: "portrait" as const,
      cost: 100,
      attemptedPrinters: [],
      submittedAt: new Date().toISOString(),
      ...overrides,
    });

    // Job 1: Grayscale Single-Sided -> Any printer can take it (epson, hp, canon)
    const match1 = await findPrinter(createMockJob({
      colorMode: "grayscale",
      duplex: "single",
    }));
    assert(
      "Matchmaker matches grayscale single-sided job to available fleet printer",
      match1 !== null
    );

    // Job 2: Color Double-Sided -> ONLY Canon can take it!
    const match2 = await findPrinter(createMockJob({
      colorMode: "color",
      duplex: "double",
    }));
    assert(
      "Matchmaker routes Color + Duplex job exclusively to Canon Copier",
      match2 === canonAllId,
      `Expected ${canonAllId}, got ${match2}`
    );

    // Job 3: Grayscale Double-Sided -> HP or Canon can take it, but NOT Epson!
    const match3 = await findPrinter(createMockJob({
      colorMode: "grayscale",
      duplex: "double",
    }));
    assert(
      "Matchmaker routes Duplex job to duplex-capable printer (HP or Canon), excluding Epson",
      match3 === hpDuplexId || match3 === canonAllId,
      `Got ${match3}`
    );

    // Cleanup Redis fleet state
    await redisConnection.srem(REDIS_KEYS.FLEET_PRINTERS, epsonColorId, hpDuplexId, canonAllId);
    await redisConnection.del(
      REDIS_KEYS.printerHealth(epsonColorId),
      REDIS_KEYS.printerState(epsonColorId),
      REDIS_KEYS.printerInfo(epsonColorId),
      REDIS_KEYS.printerHealth(hpDuplexId),
      REDIS_KEYS.printerState(hpDuplexId),
      REDIS_KEYS.printerInfo(hpDuplexId),
      REDIS_KEYS.printerHealth(canonAllId),
      REDIS_KEYS.printerState(canonAllId),
      REDIS_KEYS.printerInfo(canonAllId)
    );

    console.log("\n================================================================================");
    console.log(`  PHASE 6 TEST RESULTS: ${passed}/${total} TESTS PASSED`);
    console.log("================================================================================");

    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  }
}

runTests();
