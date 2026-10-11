import { IPrinterAdapter, PrintDispatchResult, JobPollStatus } from "./IPrinterAdapter";
import { PrinterSupplyStatus } from "../app/types";
import { systemCommands } from "../commands/system.commands";
import { cupsCommands, PrintFileOptions } from "../commands/cups.commands";
import * as printerService from "../app/services/printer.service";

/**
 * Universal USB Raster Strategy Adapter for standard desktop USB inkjets and lasers:
 * Epson EcoTank (L3150, L3110, L805), Canon MegaTank (G2010, G3010), Brother HL/DCP, Pantum.
 */
export class CupsUsbRasterAdapter implements IPrinterAdapter {
  constructor(private printerName: string, private uri: string) {}

  /**
   * Multi-tier hardware health check:
   * 1. Inspects CUPS queue status for hardware disconnect flags ('unplugged or turned off').
   * 2. Checks active device presence in lpinfo -v for matching URI.
   * 3. Probes lsusb filtering out mice, keyboards, and non-printer USB peripherals.
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 1. Check CUPS queue status
      const statusRes = await cupsCommands.getPrinterStatusByName(this.printerName).catch(() => ({ stdout: "" }));
      const lowerStatus = statusRes.stdout.toLowerCase();
      if (lowerStatus.includes("unplugged or turned off")) {
        return false;
      }

      // 2. Check CUPS physical device presence via lpinfo -v
      const devRes = await cupsCommands.listDevices().catch(() => ({ stdout: "" }));
      if (this.uri && devRes.stdout.toLowerCase().includes(this.uri.toLowerCase())) {
        return true;
      }

      // 3. Fallback: Check physical USB bus presence via lsusb, filtering out non-printer peripherals
      const { stdout } = await systemCommands.checkUsbDevices();
      const lines = stdout.split("\n");
      const lowerUri = this.uri.toLowerCase();
      const lowerName = this.printerName.toLowerCase();

      const isEpson = lowerUri.includes("epson") || lowerName.includes("epson");
      const isCanon = lowerUri.includes("canon") || lowerName.includes("canon");
      const isBrother = lowerUri.includes("brother") || lowerName.includes("brother");
      const isPantum = lowerUri.includes("pantum") || lowerName.includes("pantum");

      for (const line of lines) {
        const lower = line.toLowerCase();
        // Ignore non-printer peripherals (mice, keyboards, webcams, hubs)
        if (lower.includes("mouse") || lower.includes("keyboard") || lower.includes("webcam") || lower.includes("root hub")) {
          continue;
        }

        if (isEpson && (lower.includes("epson") || lower.includes("04b8:"))) return true;
        if (isCanon && (lower.includes("canon") || lower.includes("04a9:"))) return true;
        if (isBrother && (lower.includes("brother") || lower.includes("04f9:"))) return true;
        if (isPantum && (lower.includes("pantum") || lower.includes("232b:"))) return true;

        if (!isEpson && !isCanon && !isBrother && !isPantum) {
          if (lower.includes("printer") || lower.includes("print") || lower.includes("class 07") || lower.includes("ieee-1284")) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error(`[CupsUsbRasterAdapter] Health check failed for ${this.printerName}:`, error);
      return false;
    }
  }

  async getSupplies(): Promise<PrinterSupplyStatus> {
    try {
      const { stdout } = await systemCommands.genericUsbInkLevel();

      const numbers = [...stdout.matchAll(/(\d+)%/g)].map(m => parseInt(m[1], 10));
      const black = numbers[0] ?? null;
      const color = numbers.length > 1 ? Math.min(...numbers.slice(1)) : null;

      return {
        paper: "unknown",
        supplies: { black, color },
      };
    } catch (err) {
      return {
        paper: "unknown",
        supplies: { black: null, color: null },
      };
    }
  }

  async configure(name: string): Promise<void> {
    // Pass printerName as modelHint to search lpinfo -m for best matching PPD
    await cupsCommands.addUsbPrinter(name, this.uri, this.printerName);
  }

  async printFile(printerName: string, filePath: string, options?: PrintFileOptions): Promise<PrintDispatchResult> {
    const cupsJobId = await printerService.printFile(filePath, printerName, options);
    return {
      cupsJobId,
      dispatchedAt: Date.now()
    };
  }

  async getJobStatus(printerName: string, jobId: string, metadata?: Record<string, any>): Promise<JobPollStatus> {
    return printerService.queryCupsJobStatus(printerName, jobId);
  }

  async cancelJob(printerName: string, jobId: string): Promise<boolean> {
    try {
      await printerService.cancelJob(jobId);
      return true;
    } catch (e) {
      console.error(`[CupsUsbRasterAdapter] Failed to cancel CUPS job ${jobId}`, e);
      return false;
    }
  }
}
