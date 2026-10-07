import {
  buildLpArguments,
  parseCupsJobId,
  CupsDispatchError,
  PrintFileOptions,
} from "../src/commands/cups.commands";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("====================================================");
  console.log("🧪 RUNNING CUPS DISPATCH & OPTIONS TEST SUITE (PHASE 2)");
  console.log("====================================================\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Monochrome single-sided portrait
  try {
    const opts: PrintFileOptions = {
      colorMode: "grayscale",
      duplex: "single",
      orientation: "portrait",
    };
    const args = buildLpArguments("Epson_L3150", "/tmp/doc.pdf", opts);
    assert(args.includes("-d") && args[args.indexOf("-d") + 1] === "Epson_L3150", "Must set printer destination");
    assert(args.includes("-o") && args.includes("print-color-mode=monochrome"), "Must set IPP monochrome");
    assert(args.includes("ColorModel=Gray"), "Must set PPD Gray");
    assert(args.includes("sides=one-sided"), "Must set one-sided duplex");
    assert(args.includes("orientation-requested=3"), "Must set portrait orientation");
    assert(args.includes("fit-to-page"), "Must include fit-to-page");
    assert(args[args.length - 1] === "/tmp/doc.pdf", "File path must be last argument after --");
    console.log("✅ Test 1 Passed: Grayscale single-sided portrait option compilation");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 1 Failed:", err.message);
    failed++;
  }

  // Test 2: Color double-sided landscape
  try {
    const opts: PrintFileOptions = {
      colorMode: "color",
      duplex: "double",
      orientation: "landscape",
    };
    const args = buildLpArguments("Canon_G2010", "/tmp/chart.pdf", opts);
    assert(args.includes("print-color-mode=color"), "Must set IPP color");
    assert(args.includes("ColorModel=RGB"), "Must set PPD RGB");
    assert(args.includes("sides=two-sided-short-edge"), "Must use short-edge tumble for landscape duplex");
    assert(args.includes("orientation-requested=4"), "Must set landscape orientation");
    console.log("✅ Test 2 Passed: Color double-sided landscape (short-edge duplex) option compilation");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 2 Failed:", err.message);
    failed++;
  }

  // Test 3: Multiple copies, custom media (A4/Legal), page ranges, jobTitle
  try {
    const opts: PrintFileOptions = {
      copies: 3,
      media: "A4",
      pageRanges: "1-5,8",
      jobTitle: "Customer_Contract.pdf",
    };
    const args = buildLpArguments("HP_LaserJet", "/tmp/contract.pdf", opts);
    assert(args.includes("-n") && args[args.indexOf("-n") + 1] === "3", "Must specify copies");
    assert(args.includes("-t") && args[args.indexOf("-t") + 1] === "Customer_Contract.pdf", "Must specify job title");
    assert(args.includes("media=A4"), "Must specify media=A4");
    assert(args.includes("page-ranges=1-5,8"), "Must specify page ranges");
    console.log("✅ Test 3 Passed: Multi-copy, custom media, page-ranges, and jobTitle compilation");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 3 Failed:", err.message);
    failed++;
  }

  // Test 4: Raw mode bypass
  try {
    const opts: PrintFileOptions = {
      raw: true,
      copies: 1,
    };
    const args = buildLpArguments("Thermal_Receipt", "/tmp/receipt.bin", opts);
    assert(args.includes("raw"), "Must include raw flag");
    assert(!args.includes("fit-to-page"), "Raw mode must NOT include fit-to-page");
    assert(!args.includes("ColorModel=Gray"), "Raw mode must NOT include ColorModel");
    console.log("✅ Test 4 Passed: Raw mode bypass correctly suppresses raster filters");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 4 Failed:", err.message);
    failed++;
  }

  // Test 5: Explicit fitToPage=false
  try {
    const opts: PrintFileOptions = {
      fitToPage: false,
    };
    const args = buildLpArguments("Plotter", "/tmp/blueprint.pdf", opts);
    assert(!args.includes("fit-to-page"), "Must NOT include fit-to-page when explicitly false");
    console.log("✅ Test 5 Passed: fitToPage=false respected");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 5 Failed:", err.message);
    failed++;
  }

  // Test 6: Standard CUPS Job ID regex parsing
  try {
    const stdout = "request id is EPSON_L3150-42 (1 file(s))";
    const jobId = parseCupsJobId(stdout, "EPSON_L3150");
    assert(jobId === "EPSON_L3150-42", `Expected EPSON_L3150-42, got ${jobId}`);
    console.log("✅ Test 6 Passed: Standard request id parsing");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 6 Failed:", err.message);
    failed++;
  }

  // Test 7: Output with preceding notices/warnings
  try {
    const stdout = "lp: notice - job queued for remote daemon\nrequest id is HP_LaserJet_1020-888 (1 file(s))\n";
    const jobId = parseCupsJobId(stdout, "HP_LaserJet_1020");
    assert(jobId === "HP_LaserJet_1020-888", `Expected HP_LaserJet_1020-888, got ${jobId}`);
    console.log("✅ Test 7 Passed: Request id parsing with multi-line warnings");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 7 Failed:", err.message);
    failed++;
  }

  // Test 8: Numeric Job ID
  try {
    const stdout = "request id is 1042 (1 file(s))";
    const jobId = parseCupsJobId(stdout);
    assert(jobId === "1042", `Expected 1042, got ${jobId}`);
    console.log("✅ Test 8 Passed: Numeric request id parsing");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 8 Failed:", err.message);
    failed++;
  }

  // Test 9: Name matching fallback when "request id is" phrase is missing
  try {
    const stdout = "Job spooled to destination: Brother_HL-55\nStatus: accepted";
    const jobId = parseCupsJobId(stdout, "Brother_HL");
    assert(jobId === "Brother_HL-55", `Expected Brother_HL-55, got ${jobId}`);
    console.log("✅ Test 9 Passed: Fallback queue ID parsing using printerName match");
    passed++;
  } catch (err: any) {
    console.error("❌ Test 9 Failed:", err.message);
    failed++;
  }

  // Test 10: Fail-fast CupsDispatchError on garbage output
  try {
    const stdout = "lp: error - unknown error in filter\nNo destinations found.";
    parseCupsJobId(stdout, "Invalid_Queue");
    console.error("❌ Test 10 Failed: Expected CupsDispatchError to be thrown");
    failed++;
  } catch (err: any) {
    if (err instanceof CupsDispatchError) {
      console.log("✅ Test 10 Passed: CupsDispatchError thrown cleanly on corrupted/failed stdout");
      passed++;
    } else {
      console.error("❌ Test 10 Failed: Wrong error type thrown:", err);
      failed++;
    }
  }

  console.log("\n====================================================");
  console.log(`📊 PHASE 2 RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("====================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
