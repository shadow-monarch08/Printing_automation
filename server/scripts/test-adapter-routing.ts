import { PrinterFactory } from "../src/factories/printer.factory";
import { IppModernAdapter } from "../src/adapters/IppModernAdapter";
import { SnmpNetworkAdapter, SnmpAdapter } from "../src/adapters/SnmpAdapter";
import { HpLegacyAdapter } from "../src/adapters/HpLegacyAdapter";
import { CupsUsbRasterAdapter } from "../src/adapters/CupsUsbRasterAdapter";
import { GenericUsbAdapter } from "../src/adapters/GenericUsbAdapter";
import { EpsonLegacyAdapter } from "../src/adapters/EpsonLegacyAdapter";
import { parseLpinfoDeviceLine } from "../src/app/services/printer.service";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("==================================================================");
  console.log("🧪 RUNNING MULTI-PRINTER ADAPTER ROUTING & DISCOVERY SUITE (PHASE 4)");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Modern IPP / IPPS / AirPrint / mDNS routing in PrinterFactory
  try {
    const a1 = PrinterFactory.getAdapterByUri("IPP_Test", "ipp://192.168.1.50/ipp/print");
    const a2 = PrinterFactory.getAdapterByUri("IPPS_Test", "ipps://secure.printer.local/ipp/print");
    const a3 = PrinterFactory.getAdapterByUri("AirPrint_Test", "dnssd://Canon%20G3010._ipp._tcp.local/?uuid=123");
    const a4 = PrinterFactory.getAdapterByUri("mDNS_Test", "mdns://HP%20Color.local");

    assert(a1 instanceof IppModernAdapter, "ipp:// must route to IppModernAdapter");
    assert(a2 instanceof IppModernAdapter, "ipps:// must route to IppModernAdapter (NO USB fallback!)");
    assert(a3 instanceof IppModernAdapter, "dnssd:// must route to IppModernAdapter (NO USB fallback!)");
    assert(a4 instanceof IppModernAdapter, "mdns:// must route to IppModernAdapter");

    console.log("✅ Test 1 Passed: IPP, IPPS, AirPrint (dnssd), and mDNS protocol routing");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 1 Failed:", err.message);
    failed++;
  }

  // Test 2: Commercial Copiers / AppSocket / LPD routing in PrinterFactory
  try {
    const a1 = PrinterFactory.getAdapterByUri("Canon_iR2520", "socket://192.168.1.100:9100");
    const a2 = PrinterFactory.getAdapterByUri("Ricoh_Aficio", "lpd://192.168.1.101/queue");

    assert(a1 instanceof SnmpNetworkAdapter, "socket:// must route to SnmpNetworkAdapter");
    assert(a2 instanceof SnmpNetworkAdapter, "lpd:// must route to SnmpNetworkAdapter");
    assert(a1 instanceof SnmpAdapter, "SnmpNetworkAdapter must be backward-compatible with SnmpAdapter");

    console.log("✅ Test 2 Passed: Commercial Copiers (socket:// and lpd://) routing");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 2 Failed:", err.message);
    failed++;
  }

  // Test 3: HP Legacy USB vs Native HPLIP routing (Preventing generic USB misrouting)
  try {
    const a1 = PrinterFactory.getAdapterByUri("HP_1020_HPLIP", "hp:/usb/HP_LaserJet_1020?serial=JL123");
    const a2 = PrinterFactory.getAdapterByUri("HP_1020_CUPS_USB", "usb://HP/LaserJet%201020?serial=JL123");
    const a3 = PrinterFactory.getAdapterByUri("HP_M1005_CUPS", "usb://Hewlett-Packard/LaserJet%20M1005");

    assert(a1 instanceof HpLegacyAdapter, "hp:/usb/ must route to HpLegacyAdapter");
    assert(a2 instanceof HpLegacyAdapter, "usb://HP/... must route to HpLegacyAdapter for firmware loading");
    assert(a3 instanceof HpLegacyAdapter, "usb://Hewlett-Packard/... must route to HpLegacyAdapter");

    console.log("✅ Test 3 Passed: HP Legacy USB routing (usb://HP/ routed to HpLegacyAdapter, not generic USB)");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 3 Failed:", err.message);
    failed++;
  }

  // Test 4: Universal USB Desktop Inkjet & Laser routing (Epson, Canon, Brother)
  try {
    const a1 = PrinterFactory.getAdapterByUri("Epson_L3150", "usb://EPSON/L3150%20Series?serial=5838");
    const a2 = PrinterFactory.getAdapterByUri("Canon_G2010", "usb://Canon/G2010%20series?serial=102A");
    const a3 = PrinterFactory.getAdapterByUri("Brother_HL2321D", "usb://Brother/HL-L2321D%20series");
    const a4 = PrinterFactory.getAdapterByUri("Pantum_P2500W", "usb://Pantum/P2500W");

    assert(a1 instanceof CupsUsbRasterAdapter, "Epson USB must route to CupsUsbRasterAdapter");
    assert(a2 instanceof CupsUsbRasterAdapter, "Canon USB must route to CupsUsbRasterAdapter");
    assert(a3 instanceof CupsUsbRasterAdapter, "Brother USB must route to CupsUsbRasterAdapter");
    assert(a4 instanceof CupsUsbRasterAdapter, "Pantum USB must route to CupsUsbRasterAdapter");

    // Backward-compatible alias checks
    assert(new GenericUsbAdapter("Test", "usb://Test") instanceof CupsUsbRasterAdapter, "GenericUsbAdapter aliases CupsUsbRasterAdapter");
    assert(new EpsonLegacyAdapter("Test", "usb://Test") instanceof CupsUsbRasterAdapter, "EpsonLegacyAdapter aliases CupsUsbRasterAdapter");

    console.log("✅ Test 4 Passed: Universal USB Desktop Raster routing (Epson, Canon, Brother, Pantum)");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 4 Failed:", err.message);
    failed++;
  }

  // Test 5: Universal Discovery lpinfo -v parsing (Epson EcoTank)
  try {
    const line = "direct usb://EPSON/L3150%20Series?serial=583849503031383935";
    const parsed = parseLpinfoDeviceLine(line);

    assert(parsed !== null, "Must parse Epson USB line");
    assert(parsed?.type === "usb", "Must be USB type");
    assert(parsed?.rawModel === "EPSON L3150 Series", `Expected 'EPSON L3150 Series', got '${parsed?.rawModel}'`);
    assert(parsed?.uri === "usb://EPSON/L3150%20Series?serial=583849503031383935", "Must preserve exact URI");

    console.log("✅ Test 5 Passed: Universal Discovery lpinfo parsing for Epson EcoTank USB");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 5 Failed:", err.message);
    failed++;
  }

  // Test 6: Universal Discovery lpinfo -v parsing (Canon MegaTank)
  try {
    const line = "direct usb://Canon/G2010%20series?serial=102A384";
    const parsed = parseLpinfoDeviceLine(line);

    assert(parsed !== null, "Must parse Canon USB line");
    assert(parsed?.type === "usb", "Must be USB type");
    assert(parsed?.rawModel === "Canon G2010 series", `Expected 'Canon G2010 series', got '${parsed?.rawModel}'`);

    console.log("✅ Test 6 Passed: Universal Discovery lpinfo parsing for Canon MegaTank USB");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 6 Failed:", err.message);
    failed++;
  }

  // Test 7: Universal Discovery lpinfo -v parsing (Brother & HP USB)
  try {
    const brotherLine = "direct usb://Brother/HL-L2321D%20series?serial=E7583";
    const hpLine = "direct hp:/usb/HP_LaserJet_1020?serial=JL12345";

    const pBrother = parseLpinfoDeviceLine(brotherLine);
    const pHp = parseLpinfoDeviceLine(hpLine);

    assert(pBrother?.rawModel === "Brother HL-L2321D series", `Expected 'Brother HL-L2321D series', got '${pBrother?.rawModel}'`);
    assert(pHp?.rawModel === "HP LaserJet 1020", `Expected 'HP LaserJet 1020', got '${pHp?.rawModel}'`);

    console.log("✅ Test 7 Passed: Universal Discovery lpinfo parsing for Brother and HP Laser");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 7 Failed:", err.message);
    failed++;
  }

  // Test 8: Universal Discovery lpinfo -v parsing (Network Copier & AirPrint)
  try {
    const copierLine = "network socket://192.168.1.100:9100";
    const airprintLine = "network dnssd://Canon%20G3010%20series._ipp._tcp.local/?uuid=abcdef";

    const pCopier = parseLpinfoDeviceLine(copierLine);
    const pAirPrint = parseLpinfoDeviceLine(airprintLine);

    assert(pCopier?.type === "network", "Copier must have type 'network'");
    assert(pCopier?.rawModel === "Network Copier (192.168.1.100)", `Expected 'Network Copier (192.168.1.100)', got '${pCopier?.rawModel}'`);
    assert(pAirPrint?.type === "ipp", "AirPrint must have type 'ipp'");
    assert(pAirPrint?.rawModel === "Canon G3010 series (AirPrint)", `Expected 'Canon G3010 series (AirPrint)', got '${pAirPrint?.rawModel}'`);

    console.log("✅ Test 8 Passed: Universal Discovery lpinfo parsing for Network Copiers and AirPrint");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 8 Failed:", err.message);
    failed++;
  }

  // Test 9: SnmpNetworkAdapter Automated Provisioning (Generic PCL6)
  try {
    const cupsModule = require("../src/commands/cups.commands");
    const originalGenericPcl = cupsModule.cupsCommands.addGenericPclPrinter;
    let capturedName = "";
    let capturedUri = "";

    cupsModule.cupsCommands.addGenericPclPrinter = async (name: string, uri: string) => {
      capturedName = name;
      capturedUri = uri;
      return { stdout: "", stderr: "" };
    };

    try {
      const adapter = new SnmpNetworkAdapter("Canon_iR2520", "socket://192.168.1.100:9100");
      await adapter.configure("Canon_iR2520");

      assert(capturedName === "Canon_iR2520", "Must pass queue name");
      assert(capturedUri === "socket://192.168.1.100:9100", "Must pass device URI");
      console.log("✅ Test 9 Passed: SnmpNetworkAdapter automated PCL6 provisioning (no unhandled error)");
      passed++;
    } finally {
      cupsModule.cupsCommands.addGenericPclPrinter = originalGenericPcl;
    }
  } catch (err: any) {
    console.error("❌ Test 9 Failed:", err.message);
    failed++;
  }

  // Test 10: CupsUsbRasterAdapter Vendor Health Check Discrimination
  try {
    const sysModule = require("../src/commands/system.commands");
    const originalCheckUsb = sysModule.systemCommands.checkUsbDevices;

    // Simulate lsusb showing a keyboard, mouse, and Epson printer
    sysModule.systemCommands.checkUsbDevices = async () => ({
      stdout: "Bus 001 Device 002: ID 04b8:0005 Seiko Epson Corp. L3150\nBus 001 Device 003: ID 046d:c52f Logitech USB Mouse\n",
      stderr: "",
    });

    try {
      const epsonAdapter = new CupsUsbRasterAdapter("Epson_L3150", "usb://EPSON/L3150%20Series");
      const canonAdapter = new CupsUsbRasterAdapter("Canon_G2010", "usb://Canon/G2010%20series");

      const isEpsonHealthy = await epsonAdapter.healthCheck();
      const isCanonHealthy = await canonAdapter.healthCheck();

      assert(isEpsonHealthy === true, "Epson printer must be recognized as healthy on Epson USB bus");
      assert(isCanonHealthy === false, "Canon printer must NOT report healthy when only Epson is plugged in");

      console.log("✅ Test 10 Passed: USB health check vendor discrimination (no false positives from other devices)");
      passed++;
    } finally {
      sysModule.systemCommands.checkUsbDevices = originalCheckUsb;
    }
  } catch (err: any) {
    console.error("❌ Test 10 Failed:", err.message);
    failed++;
  }

  console.log("\n==================================================================");
  console.log(`🏁 PHASE 4 TEST SUITE FINISHED: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests();
