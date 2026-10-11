import net from "net";
import { extractHostAndPort, pingTcpPort } from "../src/app/utils/network";
import { CupsUsbRasterAdapter } from "../src/adapters/CupsUsbRasterAdapter";
import { HpLegacyAdapter } from "../src/adapters/HpLegacyAdapter";
import { SnmpNetworkAdapter } from "../src/adapters/SnmpAdapter";
import { IppModernAdapter } from "../src/adapters/IppModernAdapter";
import { systemCommands } from "../src/commands/system.commands";
import { cupsCommands } from "../src/commands/cups.commands";
import { runComprehensiveHealthCheck, queryCupsPrinterMarkers } from "../src/app/services/printer.service";
import { redisConnection } from "../src/infrastructure/redis";
import { REDIS_KEYS } from "../src/infrastructure/redisKeys";
import { printMasterQueue } from "../src/infrastructure/printMaster.queue";
import { eventBus } from "../src/app/utils/eventBus";
import ipp from "ipp";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// In-memory Redis and BullMQ mocks to keep unit test isolated from offline daemon
redisConnection.removeAllListeners("error");
redisConnection.on("error", () => {}); // silence connection refused in tests

const inMemoryRedis = new Map<string, string>();
redisConnection.get = (async (key: string) => inMemoryRedis.get(key) || null) as any;
redisConnection.set = (async (key: string, val: string) => { inMemoryRedis.set(key, String(val)); return "OK"; }) as any;
redisConnection.setex = (async (key: string, _ttl: number, val: string) => { inMemoryRedis.set(key, String(val)); return "OK"; }) as any;
redisConnection.smembers = (async () => []) as any;
redisConnection.sadd = (async () => 1) as any;

let isQueueMockPaused = false;
printMasterQueue.pause = (async () => { isQueueMockPaused = true; }) as any;
printMasterQueue.resume = (async () => { isQueueMockPaused = false; }) as any;
printMasterQueue.isPaused = (async () => isQueueMockPaused) as any;
printMasterQueue.getDelayed = (async () => []) as any;
printMasterQueue.getJobs = (async () => []) as any;

async function runTests() {
  console.log("==================================================================");
  console.log("🧪 RUNNING HARDWARE HEALTH & TELEMETRY SUITE (PHASE 5)");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  // Test 1: URI Host and Port Extraction
  try {
    const s1 = extractHostAndPort("socket://192.168.1.50");
    assert(s1?.host === "192.168.1.50" && s1.port === 9100, "socket:// should default to port 9100");

    const s2 = extractHostAndPort("socket://192.168.1.50:9101");
    assert(s2?.host === "192.168.1.50" && s2.port === 9101, "socket:// custom port should be parsed");

    const l1 = extractHostAndPort("lpd://copier.office.local");
    assert(l1?.host === "copier.office.local" && l1.port === 515, "lpd:// should default to port 515");

    const i1 = extractHostAndPort("ipp://10.0.0.12/ipp/print");
    assert(i1?.host === "10.0.0.12" && i1.port === 631, "ipp:// should default to port 631");

    const i2 = extractHostAndPort("ipps://secure-printer:8631/printers/color");
    assert(i2?.host === "secure-printer" && i2.port === 8631, "ipps:// custom port parsed correctly");

    console.log("✅ Test 1 Passed: Network host and port extraction across socket, lpd, and ipp");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 1 Failed:", err.message);
    failed++;
  }

  // Test 2: Fast TCP Socket Ping Probe
  try {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as net.AddressInfo).port;

    const isOpen = await pingTcpPort("127.0.0.1", port, 1000);
    assert(isOpen === true, "Active loopback port must return true");

    await new Promise<void>((resolve) => server.close(() => resolve()));

    const isClosed = await pingTcpPort("127.0.0.1", port, 500);
    assert(isClosed === false, "Closed port must return false promptly");

    console.log("✅ Test 2 Passed: Fast TCP socket ping probe accuracy");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 2 Failed:", err.message);
    failed++;
  }

  // Test 3: Deterministic USB Rejection of Non-Printer Peripherals
  try {
    const origCheckUsb = systemCommands.checkUsbDevices;
    const origStatusByName = cupsCommands.getPrinterStatusByName;
    const origListDevices = cupsCommands.listDevices;

    systemCommands.checkUsbDevices = async () => ({
      stdout: [
        "Bus 001 Device 002: ID 03f0:094a HP, Inc Optical Mouse",
        "Bus 001 Device 003: ID 046d:c31c Logitech, Inc. Keyboard",
        "Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub"
      ].join("\n"),
      stderr: ""
    } as any);

    cupsCommands.getPrinterStatusByName = async () => ({
      stdout: "printer HP_LaserJet is idle. enabled since Mon 12 Oct 2026",
      stderr: ""
    } as any);

    cupsCommands.listDevices = async () => ({ stdout: "", stderr: "" } as any);

    const hpAdapter = new HpLegacyAdapter("HP_LaserJet", "usb://HP/LaserJet%20P1102");
    const isHpAlive = await hpAdapter.healthCheck();
    assert(isHpAlive === false, "Must reject HP optical mouse and return false for disconnected HP printer");

    const epsonAdapter = new CupsUsbRasterAdapter("Epson_L3150", "usb://EPSON/L3150%20Series");
    const isEpsonAlive = await epsonAdapter.healthCheck();
    assert(isEpsonAlive === false, "Must return false when Epson printer is not connected");

    systemCommands.checkUsbDevices = origCheckUsb;
    cupsCommands.getPrinterStatusByName = origStatusByName;
    cupsCommands.listDevices = origListDevices;

    console.log("✅ Test 3 Passed: Deterministic USB rejection of mice, keyboards, and non-printer devices");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 3 Failed:", err.message);
    failed++;
  }

  // Test 4: Deterministic USB Recognition of Valid Physical Printers
  try {
    const origCheckUsb = systemCommands.checkUsbDevices;
    const origStatusByName = cupsCommands.getPrinterStatusByName;
    const origListDevices = cupsCommands.listDevices;

    systemCommands.checkUsbDevices = async () => ({
      stdout: [
        "Bus 001 Device 004: ID 04b8:0005 Seiko Epson Corp. L3150 Series Printer",
        "Bus 001 Device 005: ID 03f0:002a HP, Inc LaserJet P1102",
        "Bus 001 Device 002: ID 03f0:094a HP, Inc Optical Mouse"
      ].join("\n"),
      stderr: ""
    } as any);

    cupsCommands.getPrinterStatusByName = async () => ({
      stdout: "printer Epson_L3150 is idle. enabled since Mon 12 Oct 2026",
      stderr: ""
    } as any);

    cupsCommands.listDevices = async () => ({
      stdout: "direct usb://EPSON/L3150%20Series?serial=5838",
      stderr: ""
    } as any);

    const epsonAdapter = new CupsUsbRasterAdapter("Epson_L3150", "usb://EPSON/L3150%20Series");
    const isEpsonAlive = await epsonAdapter.healthCheck();
    assert(isEpsonAlive === true, "Must recognize active Epson printer on USB bus");

    const hpAdapter = new HpLegacyAdapter("HP_LaserJet", "usb://HP/LaserJet%20P1102");
    const isHpAlive = await hpAdapter.healthCheck();
    assert(isHpAlive === true, "Must recognize active HP LaserJet printer on USB bus");

    systemCommands.checkUsbDevices = origCheckUsb;
    cupsCommands.getPrinterStatusByName = origStatusByName;
    cupsCommands.listDevices = origListDevices;

    console.log("✅ Test 4 Passed: Deterministic recognition of valid physical USB printers");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 4 Failed:", err.message);
    failed++;
  }

  // Test 5: Detection of Disconnected / Unplugged State
  try {
    const origStatusByName = cupsCommands.getPrinterStatusByName;
    const origCheckUsb = systemCommands.checkUsbDevices;

    cupsCommands.getPrinterStatusByName = async () => ({
      stdout: "printer HP_LaserJet is disabled since Mon 12 Oct 2026 - Unplugged or turned off",
      stderr: ""
    } as any);

    systemCommands.checkUsbDevices = async () => ({
      stdout: "Bus 001 Device 001: ID 1d6b:0002 Linux Foundation root hub",
      stderr: ""
    } as any);

    const hpAdapter = new HpLegacyAdapter("HP_LaserJet", "usb://HP/LaserJet%20P1102");
    const isAlive = await hpAdapter.healthCheck();
    assert(isAlive === false, "Must detect 'Unplugged or turned off' status and report false");

    cupsCommands.getPrinterStatusByName = origStatusByName;
    systemCommands.checkUsbDevices = origCheckUsb;

    console.log("✅ Test 5 Passed: Detection of 'Unplugged or turned off' CUPS hardware disconnect");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 5 Failed:", err.message);
    failed++;
  }

  // Test 6: SnmpNetworkAdapter Two-Tier Probe (TCP port ping with SNMP fallback)
  try {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as net.AddressInfo).port;

    const origSnmpWalk = systemCommands.snmpWalk;
    let snmpCalled = false;
    systemCommands.snmpWalk = async () => {
      snmpCalled = true;
      throw new Error("SNMP disabled on copier");
    };

    const adapter = new SnmpNetworkAdapter("Office_Copier", `socket://127.0.0.1:${port}`);
    const isHealthy = await adapter.healthCheck();

    assert(isHealthy === true, "Must succeed via Port 9100 TCP connection even if SNMP is disabled");
    assert(snmpCalled === false, "Should not need to call SNMP when TCP port is active");

    await new Promise<void>((resolve) => server.close(() => resolve()));
    systemCommands.snmpWalk = origSnmpWalk;

    console.log("✅ Test 6 Passed: SnmpNetworkAdapter TCP port probing bypassing disabled SNMP");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 6 Failed:", err.message);
    failed++;
  }

  // Test 7: Self-Healing Quarantine Restoration
  try {
    const testPrinter = "Healable_LaserJet";
    const strikeKey = REDIS_KEYS.printerStrikes(testPrinter);
    const healthKey = REDIS_KEYS.printerHealth(testPrinter);

    inMemoryRedis.set(strikeKey, "3");
    inMemoryRedis.set(healthKey, "flagged");

    const origStatusByName = cupsCommands.getPrinterStatusByName;
    const origPrinterStatus = cupsCommands.getPrinterStatus;
    const origCheckUsb = systemCommands.checkUsbDevices;
    const origListDevices = cupsCommands.listDevices;
    const origEnable = cupsCommands.enablePrinter;
    const origAccept = cupsCommands.acceptJobs;
    const origActiveJobs = cupsCommands.getActiveJobs;

    let enabledCalled = false;
    let acceptCalled = false;
    let healedEventReceived = false;

    cupsCommands.getPrinterStatus = async () => ({
      stdout: `device for ${testPrinter}: usb://HP/LaserJet%20P1102?serial=999`,
      stderr: ""
    } as any);
    cupsCommands.enablePrinter = async () => { enabledCalled = true; return { stdout: "", stderr: "" } as any; };
    cupsCommands.acceptJobs = async () => { acceptCalled = true; return { stdout: "", stderr: "" } as any; };
    cupsCommands.getPrinterStatusByName = async () => ({
      stdout: `printer ${testPrinter} is idle. enabled since Mon 12 Oct 2026`,
      stderr: ""
    } as any);
    cupsCommands.listDevices = async () => ({
      stdout: `direct usb://HP/LaserJet%20P1102?serial=999`,
      stderr: ""
    } as any);
    cupsCommands.getActiveJobs = async () => ({ stdout: "", stderr: "" } as any);
    systemCommands.checkUsbDevices = async () => ({
      stdout: "Bus 001 Device 005: ID 03f0:002a HP, Inc LaserJet P1102",
      stderr: ""
    } as any);

    const onHealed = (payload: any) => {
      if (payload.printer === testPrinter) {
        healedEventReceived = true;
      }
    };
    eventBus.on("admin:printer:healed", onHealed);

    await runComprehensiveHealthCheck(testPrinter);

    const postStrikes = inMemoryRedis.get(strikeKey);
    const postHealth = inMemoryRedis.get(healthKey);

    assert(enabledCalled === true, "Must call cupsenable on healed printer");
    assert(acceptCalled === true, "Must call cupsaccept on healed printer");
    assert(postStrikes === "0", "Strikes must be reset to 0 upon healing");
    assert(postHealth === "healthy", "Health must be reset to 'healthy'");
    assert(healedEventReceived === true, "admin:printer:healed event must be emitted");

    eventBus.off("admin:printer:healed", onHealed);
    cupsCommands.getPrinterStatusByName = origStatusByName;
    cupsCommands.getPrinterStatus = origPrinterStatus;
    systemCommands.checkUsbDevices = origCheckUsb;
    cupsCommands.listDevices = origListDevices;
    cupsCommands.enablePrinter = origEnable;
    cupsCommands.acceptJobs = origAccept;
    cupsCommands.getActiveJobs = origActiveJobs;

    console.log("✅ Test 7 Passed: Self-healing quarantine restoration and strike reset");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 7 Failed:", err.message);
    failed++;
  }

  // Test 8: Circuit Breaker Auto-Resumption on Healed Printer
  try {
    const testPrinter = "Circuit_Healer";
    inMemoryRedis.set(REDIS_KEYS.printerStrikes(testPrinter), "3");
    inMemoryRedis.set(REDIS_KEYS.printerHealth(testPrinter), "flagged");

    await printMasterQueue.pause();
    assert(await printMasterQueue.isPaused() === true, "Queue must be initially paused");

    const origStatusByName = cupsCommands.getPrinterStatusByName;
    const origPrinterStatus = cupsCommands.getPrinterStatus;
    const origListDevices = cupsCommands.listDevices;
    const origActiveJobs = cupsCommands.getActiveJobs;

    cupsCommands.getPrinterStatus = async () => ({
      stdout: `device for ${testPrinter}: usb://EPSON/L3150?serial=111`,
      stderr: ""
    } as any);
    cupsCommands.getPrinterStatusByName = async () => ({
      stdout: `printer ${testPrinter} is idle. enabled since Mon 12 Oct 2026`,
      stderr: ""
    } as any);
    cupsCommands.listDevices = async () => ({
      stdout: `direct usb://EPSON/L3150?serial=111`,
      stderr: ""
    } as any);
    cupsCommands.getActiveJobs = async () => ({ stdout: "", stderr: "" } as any);

    let resumeEventReceived = false;
    const onResumed = () => { resumeEventReceived = true; };
    eventBus.on("system:queue:resumed", onResumed);

    await runComprehensiveHealthCheck(testPrinter);

    const isNowPaused = await printMasterQueue.isPaused();
    assert(isNowPaused === false, "Global queue must be automatically resumed when printer heals");
    assert(resumeEventReceived === true, "system:queue:resumed event must be emitted");

    eventBus.off("system:queue:resumed", onResumed);
    cupsCommands.getPrinterStatusByName = origStatusByName;
    cupsCommands.getPrinterStatus = origPrinterStatus;
    cupsCommands.listDevices = origListDevices;
    cupsCommands.getActiveJobs = origActiveJobs;

    console.log("✅ Test 8 Passed: Circuit breaker automatic resumption when printer heals");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 8 Failed:", err.message);
    failed++;
  }

  // Test 9: Lock-Guarded Concurrency State Protection
  try {
    const testPrinter = "Busy_LaserJet";
    const stateKey = REDIS_KEYS.printerState(testPrinter);

    inMemoryRedis.set(stateKey, "busy");

    const origStatusByName = cupsCommands.getPrinterStatusByName;
    const origPrinterStatus = cupsCommands.getPrinterStatus;
    const origActiveJobs = cupsCommands.getActiveJobs;
    const origListDevices = cupsCommands.listDevices;

    cupsCommands.getPrinterStatus = async () => ({
      stdout: `device for ${testPrinter}: usb://HP/LaserJet%20P1102?serial=999`,
      stderr: ""
    } as any);
    cupsCommands.getPrinterStatusByName = async () => ({
      stdout: `printer ${testPrinter} is idle. enabled since Mon 12 Oct 2026`,
      stderr: ""
    } as any);
    cupsCommands.getActiveJobs = async () => ({
      stdout: `${testPrinter}-105 guest 1024 Mon 12 Oct 00:01`,
      stderr: ""
    } as any);
    cupsCommands.listDevices = async () => ({
      stdout: `direct usb://HP/LaserJet%20P1102?serial=999`,
      stderr: ""
    } as any);

    await runComprehensiveHealthCheck(testPrinter);

    const postState = inMemoryRedis.get(stateKey);
    assert(postState === "busy", "Health sweep must NEVER overwrite 'busy' to 'idle' while active jobs exist in spooler");

    cupsCommands.getPrinterStatusByName = origStatusByName;
    cupsCommands.getPrinterStatus = origPrinterStatus;
    cupsCommands.getActiveJobs = origActiveJobs;
    cupsCommands.listDevices = origListDevices;

    console.log("✅ Test 9 Passed: Lock-guarded concurrency state protection (preventing busy clobber)");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 9 Failed:", err.message);
    failed++;
  }

  // Test 10: Hierarchical CUPS Marker & Supply Telemetry Fallback
  try {
    const origPrinter = (ipp as any).Printer;

    (ipp as any).Printer = function(url: string) {
      return {
        execute: (operation: string, msg: any, callback: Function) => {
          callback(null, {
            "printer-attributes-tag": {
              "marker-names": ["Black Cartridge", "Tri-Color Cartridge"],
              "marker-levels": [82, 45],
              "marker-types": ["toner", "toner"],
              "printer-state-reasons": ["none"],
              "printer-state": 3
            }
          });
        }
      };
    };

    const markers = await queryCupsPrinterMarkers("HP_LaserJet");
    assert(markers !== null, "Markers must be parsed from CUPS IPP attributes");
    assert(markers?.supplies.black === 82, "Black marker must equal 82%");
    assert(markers?.supplies.color === 45, "Color marker must equal 45%");
    assert(markers?.paper === "ready", "Paper must be ready");

    (ipp as any).Printer = function(url: string) {
      return {
        execute: (operation: string, msg: any, callback: Function) => {
          callback(null, {
            "printer-attributes-tag": {
              "marker-names": ["Black Toner"],
              "marker-levels": [90],
              "printer-state-reasons": ["media-empty-warning"],
              "printer-state": 4
            }
          });
        }
      };
    };

    const emptyMarkers = await queryCupsPrinterMarkers("HP_LaserJet");
    assert(emptyMarkers?.paper === "empty", "media-empty-warning must set paper to empty");

    (ipp as any).Printer = origPrinter;

    console.log("✅ Test 10 Passed: Hierarchical CUPS marker & supply telemetry fallback");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 10 Failed:", err.message);
    failed++;
  }

  console.log("\n==================================================================");
  console.log(`🏁 PHASE 5 TEST SUITE FINISHED: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
