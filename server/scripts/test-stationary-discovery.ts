import assert from "assert";
import {
  normalizePrinterUri,
  generateUniqueQueueName,
  getUnconfiguredPrinters,
  probeCopierByIp,
  upsertPrinterToDB,
  deletePrinterFromDB,
  getAllPrintersFromDB
} from "../src/app/services/printer.service";
import { cupsCommands, CupsDispatchError } from "../src/commands/cups.commands";
import { systemCommands } from "../src/commands/system.commands";
import * as networkUtils from "../src/app/utils/network";
import { redisConnection } from "../src/infrastructure/redis";

// Silence Redis connection errors for isolated local testing
redisConnection.removeAllListeners("error");
redisConnection.on("error", () => {});

async function runTests() {
  console.log("================================================================================");
  console.log("   STATIONARY PRINTER DISCOVERY & COLLISION-SAFE PROVISIONING TEST SUITE        ");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => Promise<void> | void) {
    total++;
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            console.log(`  [PASS] Test ${total}: ${name}`);
            passed++;
          })
          .catch((err) => {
            console.error(`  [FAIL] Test ${total}: ${name}`);
            console.error(`         ${err.message}`);
          });
      } else {
        console.log(`  [PASS] Test ${total}: ${name}`);
        passed++;
      }
    } catch (err: any) {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      console.error(`         ${err.message}`);
    }
  }

  // ==========================================
  // Section 1: URI Normalization
  // ==========================================
  console.log("--- Section 1: Device URI Normalization ---");

  test("Normalizes simple USB URIs and lowercases schemes", () => {
    const raw = "USB://EPSON/L3150%20Series";
    const norm = normalizePrinterUri(raw);
    assert.strictEqual(norm, "usb://epson/l3150%20series");
  });

  test("Strips volatile parameters (&interface=1) while preserving serial", () => {
    const raw1 = "usb://EPSON/L3150%20Series?serial=58444A593035313835&interface=1";
    const raw2 = "usb://epson/l3150%20series?interface=1&serial=58444A593035313835";
    const norm1 = normalizePrinterUri(raw1);
    const norm2 = normalizePrinterUri(raw2);
    assert.strictEqual(norm1, "usb://epson/l3150%20series?serial=58444a593035313835");
    assert.strictEqual(norm2, "usb://epson/l3150%20series?serial=58444a593035313835");
    assert.strictEqual(norm1, norm2, "Both URIs with different parameter orders must normalize identically");
  });

  test("Normalizes network socket and IPP URIs", () => {
    const raw = "SOCKET://192.168.1.50:9100/";
    const norm = normalizePrinterUri(raw);
    assert.strictEqual(norm, "socket://192.168.1.50:9100");
  });

  // ==========================================
  // Section 2: Deterministic Queue Naming & Collision Avoidance
  // ==========================================
  console.log("\n--- Section 2: Collision-Safe Queue Naming ---");

  await test("Generates clean base queue name when no conflict exists", async () => {
    deletePrinterFromDB("Epson_L3150_Unique");
    const queueName = await generateUniqueQueueName("Epson L3150 Series", "usb://EPSON/L3150?serial=111");
    assert.strictEqual(queueName, "Epson_L3150_Series");
  });

  await test("Detects conflict and appends serial suffix for identical model", async () => {
    const testId = "Epson_L3250_Collision_Test";
    // Simulate printer 1 already configured in DB
    upsertPrinterToDB(testId, "Epson L3250", ["color"], "usb://EPSON/L3250?serial=AAA111", "usb", "auto");

    // Try to configure printer 2 with the same model name but different URI and serial
    const queueName = await generateUniqueQueueName(testId, "usb://EPSON/L3250?serial=BBB999");
    
    // Must NOT overwrite testId! Must append serial suffix
    assert.notStrictEqual(queueName, testId);
    assert.ok(queueName.includes("BBB999") || queueName.includes("_2"), `Queue name ${queueName} should avoid collision`);

    deletePrinterFromDB(testId);
  });

  await test("Re-configuring the same printer (matching URI) preserves queue name without suffix", async () => {
    const testId = "Epson_L3250_Reconfig_Test";
    const uri = "usb://EPSON/L3250?serial=SAME_URI_123";
    upsertPrinterToDB(testId, "Epson L3250", ["color"], uri, "usb", "auto");

    // Same printer re-configured
    const queueName = await generateUniqueQueueName(testId, uri);
    assert.strictEqual(queueName, testId, "Re-configuring the same device must not alter the queue name");

    deletePrinterFromDB(testId);
  });

  await test("Sequential numbering fallback when serial is missing", async () => {
    const testId = "HP_LaserJet_1020_NoSerial";
    upsertPrinterToDB(testId, "HP LaserJet 1020", [], "hp:/usb/HP_LaserJet_1020", "usb", "auto");

    // Another printer with same model but different URI (no serial)
    const queueName = await generateUniqueQueueName(testId, "usb://HP/LaserJet%201020");
    assert.strictEqual(queueName, `${testId}_2`);

    deletePrinterFromDB(testId);
  });

  // ==========================================
  // Section 3: Hardware-Level URI Deduplication
  // ==========================================
  console.log("\n--- Section 3: Hardware Deduplication (HP Dual-Backend Fix) ---");

  await test("Collapses dual hp:/usb/ and usb://HP/ devices preferring hp:/", async () => {
    // Mock listDevices output with dual HP device entries
    const origListDevices = cupsCommands.listDevices;
    const origGetPrinterStatus = cupsCommands.getPrinterStatus;

    cupsCommands.listDevices = async () => ({
      stdout: [
        'direct hp:/usb/HP_LaserJet_M1005?serial=VNB3L12345 "HP" "HP LaserJet M1005" "MFG:HP;MDL:LaserJet M1005;"',
        'direct usb://HP/LaserJet%20M1005?serial=VNB3L12345 "HP" "HP LaserJet M1005" "MFG:HP;MDL:LaserJet M1005;"',
        'direct usb://EPSON/L3150%20Series?serial=58444 "EPSON" "EPSON L3150" "MFG:EPSON;"'
      ].join("\n"),
      stderr: ""
    });

    cupsCommands.getPrinterStatus = async () => ({
      stdout: "", // No printers configured
      stderr: ""
    });

    try {
      const unconfigured = await getUnconfiguredPrinters();
      
      // Should have 2 devices total: 1 HP (hp:/usb/) and 1 Epson (usb://EPSON/)
      assert.strictEqual(unconfigured.length, 2, "Duplicate usb://HP/ entry must be collapsed");
      
      const hpDevice = unconfigured.find(d => d.uri.includes("HP_LaserJet_M1005"));
      assert.ok(hpDevice, "HP device must exist");
      assert.ok(hpDevice.uri.startsWith("hp:/usb/"), `HP device URI must start with hp:/usb/, got: ${hpDevice.uri}`);
      
      const epsonDevice = unconfigured.find(d => d.uri.includes("L3150"));
      assert.ok(epsonDevice, "Epson device must remain intact");
    } finally {
      cupsCommands.listDevices = origListDevices;
      cupsCommands.getPrinterStatus = origGetPrinterStatus;
    }
  });

  // ==========================================
  // Section 4: Inkjet Generic PCL Safety Guard
  // ==========================================
  console.log("\n--- Section 4: Inkjet Generic PCL Safety Guard ---");

  await test("Refuses to configure Epson inkjet with Generic PCL when no driver is found", async () => {
    const origListDrivers = cupsCommands.listDrivers;
    // Simulate empty/missing driver database in CUPS
    cupsCommands.listDrivers = async () => ({ stdout: "", stderr: "" });

    try {
      let threwExpectedError = false;
      try {
        await cupsCommands.addUsbPrinter("Test_Epson_L3150", "usb://EPSON/L3150", "EPSON L3150 Series");
      } catch (err: any) {
        if (err instanceof CupsDispatchError && err.message.includes("Refused to configure inkjet printer")) {
          threwExpectedError = true;
        } else {
          throw err;
        }
      }
      assert.ok(threwExpectedError, "Must throw CupsDispatchError refusing Generic PCL for Epson inkjet");
    } finally {
      cupsCommands.listDrivers = origListDrivers;
    }
  });

  await test("Refuses to configure Canon inkjet with Generic PCL when no driver is found", async () => {
    const origListDrivers = cupsCommands.listDrivers;
    cupsCommands.listDrivers = async () => ({ stdout: "", stderr: "" });

    try {
      let threwExpectedError = false;
      try {
        await cupsCommands.addUsbPrinter("Test_Canon_G2010", "usb://Canon/G2010", "Canon G2010 series");
      } catch (err: any) {
        if (err instanceof CupsDispatchError && err.message.includes("Refused to configure inkjet printer")) {
          threwExpectedError = true;
        } else {
          throw err;
        }
      }
      assert.ok(threwExpectedError, "Must throw CupsDispatchError refusing Generic PCL for Canon inkjet");
    } finally {
      cupsCommands.listDrivers = origListDrivers;
    }
  });

  // ==========================================
  // Section 5: Targeted Copier IP Discovery
  // ==========================================
  console.log("\n--- Section 5: Targeted Commercial Copier IP Discovery ---");

  await test("Rejects invalid IP address strings", async () => {
    let threw = false;
    try {
      await probeCopierByIp("999.999.999.999.999");
    } catch (err: any) {
      if (err.code === "INVALID_IP_FORMAT") threw = true;
    }
    assert.ok(threw, "Must reject malformed IP");
  });

  await test("Probes copier with open port 9100 and parses SNMP sysDescr", async () => {
    const origPingTcpPort = networkUtils.pingTcpPort;
    const origSnmpWalk = systemCommands.snmpWalk;

    // Mock open port 9100
    (networkUtils as any).pingTcpPort = async (_host: string, port: number) => port === 9100;
    // Mock SNMP response from Sharp commercial copier
    systemCommands.snmpWalk = async () => ({
      stdout: 'iso.3.6.1.2.1.1.1.0 = STRING: "SHARP MX-3071 Multifunction System, SC1.00"',
      stderr: ""
    });

    try {
      const device = await probeCopierByIp("192.168.1.150");
      assert.strictEqual(device.uri, "socket://192.168.1.150:9100");
      assert.strictEqual(device.rawModel, "SHARP MX-3071 Multifunction System");
      assert.strictEqual(device.type, "network");
    } finally {
      (networkUtils as any).pingTcpPort = origPingTcpPort;
      systemCommands.snmpWalk = origSnmpWalk;
    }
  });

  await test("Handles SNMP failure gracefully with fallback model name", async () => {
    const origPingTcpPort = networkUtils.pingTcpPort;
    const origSnmpWalk = systemCommands.snmpWalk;

    (networkUtils as any).pingTcpPort = async (_host: string, port: number) => port === 9100;
    systemCommands.snmpWalk = async () => { throw new Error("SNMP timeout"); };

    try {
      const device = await probeCopierByIp("192.168.1.151");
      assert.strictEqual(device.uri, "socket://192.168.1.151:9100");
      assert.strictEqual(device.rawModel, "Network Copier (192.168.1.151)");
      assert.strictEqual(device.type, "network");
    } finally {
      (networkUtils as any).pingTcpPort = origPingTcpPort;
      systemCommands.snmpWalk = origSnmpWalk;
    }
  });

  console.log("\n================================================================================");
  console.log(`   TEST RESULTS: ${passed}/${total} PASSED`);
  console.log("================================================================================");

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("FATAL TEST HARNESS ERROR:", err);
  process.exit(1);
});
