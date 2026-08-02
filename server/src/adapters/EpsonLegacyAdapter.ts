import { IPrinterAdapter, PrintDispatchResult, JobPollStatus } from "./IPrinterAdapter";
import { PrinterSupplyStatus } from "../app/types";
import { systemCommands } from "../commands/system.commands";
import { cupsCommands } from "../commands/cups.commands";
import * as printerService from "../app/services/printer.service";

export class EpsonLegacyAdapter implements IPrinterAdapter {
  constructor(private printerName: string, private uri: string) {}

  async healthCheck(): Promise<boolean> {
    try {
      const { stdout } = await systemCommands.checkUsbDevices();
      return stdout.toLowerCase().includes("epson");
    } catch (error) {
      console.error(`[EpsonLegacyAdapter] Health check failed for ${this.printerName}:`, error);
      return false;
    }
  }

  async getSupplies(): Promise<PrinterSupplyStatus> {
    try {
      const { stdout } = await systemCommands.escputilInkLevel();

      const lines = stdout.split("\n");
      let reading = false;
      let black: number | null = null;
      const colorLevels: number[] = [];

      for (const line of lines) {
        if (line.toLowerCase().includes("ink color")) { reading = true; continue; }
        if (!reading || !line.trim()) continue;

        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const level = parseInt(parts[parts.length - 1], 10);
          const colorName = parts.slice(0, parts.length - 1).join(" ").toLowerCase();
          if (!isNaN(level)) {
            if (colorName === "black") black = level;
            else colorLevels.push(level);
          }
        }
      }

      return {
        paper: "unknown",
        supplies: {
          black,
          color: colorLevels.length > 0 ? Math.min(...colorLevels) : null,
        },
      };
    } catch (err) {
      console.error(`[EpsonLegacyAdapter] Failed to get supplies for ${this.printerName}:`, err);
      return {
        paper: "unknown",
        supplies: { black: null, color: null },
      };
    }
  }

  async configure(name: string): Promise<void> {
    await cupsCommands.addUsbPrinter(name, this.uri);
  }

  async printFile(printerName: string, filePath: string, options?: Record<string, any>): Promise<any> {
    const cupsJobId = await printerService.printFile(
      filePath,
      printerName,
      options?.copies || 1,
      options?.duplex || 'single'
    );
    return { cupsJobId, dispatchedAt: Date.now() };
  }

  async getJobStatus(printerName: string, jobId: string, metadata?: Record<string, any>): Promise<any> {
    try {
      const { stdout } = await cupsCommands.getJobStatus(printerName);
      const lines = stdout.split("\n");
      const jobLine = lines.find((line: string) => line.includes(jobId));

      if (!jobLine) return "completed";
      const lower = jobLine.toLowerCase();
      if (lower.includes("held") || lower.includes("stopped")) return "held_or_stopped";
      return "printing";
    } catch (err) {
      return "unreachable";
    }
  }

  async cancelJob(printerName: string, jobId: string): Promise<boolean> {
    try {
      await printerService.cancelJob(jobId);
      return true;
    } catch (e) {
      return false;
    }
  }
}
