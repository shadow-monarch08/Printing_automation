import { runSecureCommand } from "../app/utils/exec";

export class CupsDispatchError extends Error {
  constructor(
    public readonly reason: string,
    public readonly rawOutput: string,
    public readonly printerName: string | null
  ) {
    super(
      `Failed to dispatch print job on printer '${printerName || "default"}': ${reason}\nOutput: ${rawOutput}`
    );
    this.name = "CupsDispatchError";
  }
}

export interface PrintFileOptions {
  copies?: number;
  colorMode?: "color" | "grayscale";
  duplex?: "single" | "double";
  orientation?: "portrait" | "landscape";
  media?: string;        // e.g. "A4", "Letter", "Legal"
  pageRanges?: string;   // e.g. "1-5,8"
  fitToPage?: boolean;   // default: true
  jobTitle?: string;     // Friendly title in spooler
  raw?: boolean;         // For raw passthrough (ESC/POS)
}

/**
 * Compiles high-level print options into standardized POSIX CUPS command arguments.
 */
export function buildLpArguments(
  printerName: string | null,
  filePath: string,
  options: PrintFileOptions = {}
): string[] {
  const args: string[] = [];

  if (printerName) {
    args.push("-d", printerName);
  }

  // 1. Copies
  const copies = options.copies ?? 1;
  if (copies > 1) {
    args.push("-n", String(copies));
  }

  // 2. Job Title in spooler
  if (options.jobTitle) {
    args.push("-t", options.jobTitle);
  }

  // 3. Raw mode bypass (e.g. for ESC/POS receipt streams)
  if (options.raw) {
    args.push("-o", "raw");
    args.push("--", filePath);
    return args;
  }

  // 4. Color vs Grayscale (Dual IPP Everywhere + Legacy PPD mapping)
  if (options.colorMode === "grayscale") {
    args.push("-o", "print-color-mode=monochrome");
    args.push("-o", "ColorModel=Gray");
  } else if (options.colorMode === "color") {
    args.push("-o", "print-color-mode=color");
    args.push("-o", "ColorModel=RGB");
  }

  // 5. Duplex (Two-sided printing)
  if (options.duplex === "double") {
    if (options.orientation === "landscape") {
      args.push("-o", "sides=two-sided-short-edge");
    } else {
      args.push("-o", "sides=two-sided-long-edge");
    }
  } else if (options.duplex === "single") {
    args.push("-o", "sides=one-sided");
  }

  // 6. Orientation (IPP standard: 3=portrait, 4=landscape)
  if (options.orientation === "landscape") {
    args.push("-o", "orientation-requested=4");
  } else if (options.orientation === "portrait") {
    args.push("-o", "orientation-requested=3");
  }

  // 7. Page Scaling / Fit-to-page (defaults to true for PDF edge margin protection)
  const fitToPage = options.fitToPage ?? true;
  if (fitToPage) {
    args.push("-o", "fit-to-page");
  }

  // 8. Media / Paper Size (e.g., A4, Legal, Letter)
  if (options.media) {
    args.push("-o", `media=${options.media}`);
  }

  // 9. Page ranges (e.g. 1-5, 8)
  if (options.pageRanges) {
    args.push("-o", `page-ranges=${options.pageRanges}`);
  }

  args.push("--", filePath);
  return args;
}

/**
 * Robustly parses the unique CUPS Job ID from `lp` stdout.
 * Fails fast with CupsDispatchError if the ID cannot be determined.
 */
export function parseCupsJobId(stdout: string, printerName: string | null = null): string {
  // Typical output: "request id is EPSON_L3150-42 (1 file(s))"
  const standardMatch = stdout.match(/request id is\s+([^\s()]+)/i);
  if (standardMatch && standardMatch[1]) {
    return standardMatch[1].trim();
  }

  // Fallback: look for <printerName>-<digits>
  if (printerName) {
    const escapedPrinter = printerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameMatch = new RegExp(`\\b(${escapedPrinter}-\\d+)\\b`, "i").exec(stdout);
    if (nameMatch && nameMatch[1]) {
      return nameMatch[1].trim();
    }
  }

  // General queue ID fallback: any sequence of <word>-<digits> or standalone digits
  const genericMatch = stdout.match(/\b([a-zA-Z0-9_.-]+-\d+)\b/);
  if (genericMatch && genericMatch[1]) {
    return genericMatch[1].trim();
  }

  throw new CupsDispatchError(
    "Could not extract a valid CUPS Job ID from lp output. Spooling may have failed or produced unexpected text.",
    stdout,
    printerName
  );
}

/**
 * Compiles lpstat command arguments.
 * CRITICAL POSIX CUPS INVARIANT: The '-W which-jobs' flag MUST precede '-o printer'.
 * Placing '-W' after '-o' causes CUPS lpstat to silently ignore '-W' and default to active jobs only.
 */
export function buildLpstatArgs(which: "completed" | "not-completed", printerName?: string): string[] {
  const args = ["-W", which];
  if (printerName) {
    args.push("-o", printerName);
  }
  return args;
}

export const cupsCommands = {
  listPrinters: async () => {
    return runSecureCommand("lpstat", ["-p"]);
  },

  listDevices: async () => {
    return runSecureCommand("lpinfo", ["-v"]);
  },

  getDefaultPrinter: async () => {
    return runSecureCommand("lpstat", ["-d"]);
  },

  setDefaultPrinter: async (printerName: string) => {
    return runSecureCommand("lpoptions", ["-d", printerName]);
  },

  printFile: async (
    printerName: string | null,
    filePath: string,
    options: PrintFileOptions = {}
  ): Promise<{ cupsJobId: string; stdout: string }> => {
    const args = buildLpArguments(printerName, filePath, options);
    const { stdout } = await runSecureCommand("lp", args);
    const cupsJobId = parseCupsJobId(stdout, printerName);
    return { cupsJobId, stdout };
  },

  getJobStatus: async (printerName: string) => {
    return runSecureCommand("lpstat", ["-o", printerName]);
  },

  getCompletedJobs: async (printerName?: string) => {
    return runSecureCommand("lpstat", buildLpstatArgs("completed", printerName));
  },

  getActiveJobs: async (printerName?: string) => {
    return runSecureCommand("lpstat", buildLpstatArgs("not-completed", printerName));
  },

  cancelJob: async (cupsJobId: string | number) => {
    return runSecureCommand("cancel", [String(cupsJobId)]);
  },

  cancelAllJobs: async () => {
    return runSecureCommand("cancel", ["-a"]);
  },

  holdJob: async (cupsJobId: string | number) => {
    return runSecureCommand("lp", ["-i", String(cupsJobId), "-H", "hold"]);
  },

  resumeJob: async (cupsJobId: string | number) => {
    return runSecureCommand("lp", ["-i", String(cupsJobId), "-H", "resume"]);
  },

  getPrinterStatus: async () => {
    return runSecureCommand("lpstat", ["-v"]);
  },
  
  getPrinterStatusByName: async (printerName: string) => {
    return runSecureCommand("lpstat", ["-p", printerName]);
  },
  
  getPrinterOptions: async (printerName: string) => {
    return runSecureCommand("lpoptions", ["-p", printerName, "-l"]);
  },
  
  addIppPrinter: async (name: string, uri: string) => {
    return runSecureCommand("sudo", ["lpadmin", "-p", name, "-E", "-v", uri, "-m", "everywhere"]);
  },
  
  addUsbPrinter: async (name: string, uri: string) => {
    return runSecureCommand("sudo", ["lpadmin", "-p", name, "-E", "-v", uri, "-m", "everywhere"]);
  },
  
  probeIppPrinter: async (uri: string) => {
    return runSecureCommand("ipptool", ["-tv", uri, "get-printer-attributes.test"]);
  },

  deletePrinter: async (name: string) => {
    return runSecureCommand("sudo", ["lpadmin", "-x", name]);
  }
};
