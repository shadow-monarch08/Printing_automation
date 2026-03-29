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
  const { stdout } = await execCommand("lpstat -p");
  const printers: PrinterInfo[] = [];
  const lines = stdout.split("\n").filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^printer\s+(\S+)\s+(.*)/);
    if (match) {
      printers.push({
        name: match[1],
        description: match[2],
        status: line.includes("idle") ? "idle" : "busy",
      });
    }
  }
  return printers;
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
