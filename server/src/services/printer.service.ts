import { execCommand } from "../utils/exec";

export interface PrinterInfo {
  name: string;
  description: string;
  status: string;
}

/**
 * List all printers known to CUPS.
 * Parses `lpstat -p` output.
 */
export async function listPrinters(): Promise<PrinterInfo[]> {
  try {
    const { stdout, stderr } = await execCommand("lpstat -p");

    if (stderr) {
      console.warn("[listPrinters] lpstat stderr:", stderr);
    }

    console.log("[listPrinters] raw lpstat output:", JSON.stringify(stdout));

    const printers: PrinterInfo[] = [];
    const lines = stdout.split("\n").filter(Boolean);

    for (const line of lines) {
      // Case-insensitive match to handle different CUPS/locale output formats
      const match = line.match(/^printer\s+(\S+)\s+(.*)/i);
      if (match) {
        printers.push({
          name: match[1],
          description: match[2],
          status: line.toLowerCase().includes("idle") ? "idle" : "busy",
        });
      }
    }

    console.log(`[listPrinters] parsed ${printers.length} printer(s)`);
    return printers;
  } catch (err: any) {
    // lpstat returns exit code 1 when no printers are configured,
    // but may still have useful stdout. Try to parse it.
    const stdout = err?.stdout || "";
    const stderr = err?.stderr || "";
    console.error("[listPrinters] lpstat command failed:", {
      message: err?.error?.message || String(err),
      stdout,
      stderr,
    });

    // If there IS stdout despite the error, try to parse it anyway
    if (stdout) {
      const printers: PrinterInfo[] = [];
      const lines = stdout.split("\n").filter(Boolean);
      for (const line of lines) {
        const match = line.match(/^printer\s+(\S+)\s+(.*)/i);
        if (match) {
          printers.push({
            name: match[1],
            description: match[2],
            status: line.toLowerCase().includes("idle") ? "idle" : "busy",
          });
        }
      }
      if (printers.length > 0) {
        console.log(`[listPrinters] recovered ${printers.length} printer(s) from error output`);
        return printers;
      }
    }

    throw err;
  }
}

/**
 * Get the system default printer.
 * Parses `lpstat -d` output → "system default destination: <name>"
 */
export async function getDefaultPrinter(): Promise<string | null> {
  try {
    const { stdout } = await execCommand("lpstat -d");
    const match = stdout.match(/system default destination:\s*(\S+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Set the system default printer.
 * Runs `lpoptions -d <printerName>`.
 */
export async function setDefaultPrinter(printerName: string): Promise<void> {
  await execCommand(`lpoptions -d ${printerName}`);
}

/**
 * Print a file.
 * @param filePath  - Absolute path to the uploaded file.
 * @param printer   - (Optional) Target printer name; uses default if omitted.
 * @returns The CUPS job ID string.
 */
export async function printFile(
  filePath: string,
  printer?: string
): Promise<string> {
  const printerFlag = printer ? `-d ${printer}` : "";
  const { stdout } = await execCommand(`lp ${printerFlag} -- "${filePath}"`);
  // stdout example: "request id is MyPrinter-42 (1 file(s))"
  const match = stdout.match(/request id is (\S+)/);
  return match ? match[1] : stdout;
}
