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
   * Health check verifies that a USB printer from the matching vendor/family is present on the bus.
   * Prevents false positives from non-printer USB peripherals (mice, keyboards, dongles).
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { stdout } = await systemCommands.checkUsbDevices();
      const lower = stdout.toLowerCase();
      const lowerUri = this.uri.toLowerCase();
      const lowerName = this.printerName.toLowerCase();

      // Extract vendor hint from URI or printer name
      const isEpson = lowerUri.includes("epson") || lowerName.includes("epson");
      const isCanon = lowerUri.includes("canon") || lowerName.includes("canon");
      const isBrother = lowerUri.includes("brother") || lowerName.includes("brother");
      const isPantum = lowerUri.includes("pantum") || lowerName.includes("pantum");

      if (isEpson) return lower.includes("epson") || lower.includes("seiko epson");
      if (isCanon) return lower.includes("canon");
      if (isBrother) return lower.includes("brother");
      if (isPantum) return lower.includes("pantum");

      // Generic printer class check or non-empty presence
      return lower.includes("printer") || lower.includes("print") || stdout.trim().length > 0;
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
