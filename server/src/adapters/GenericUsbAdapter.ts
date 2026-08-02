import { IPrinterAdapter, PrintDispatchResult, JobPollStatus } from "./IPrinterAdapter";
import { PrinterSupplyStatus } from "../app/types";
import { systemCommands } from "../commands/system.commands";
import { cupsCommands } from "../commands/cups.commands";
import * as printerService from "../app/services/printer.service";

export class GenericUsbAdapter implements IPrinterAdapter {
  constructor(private printerName: string, private uri: string) {}

  async healthCheck(): Promise<boolean> {
    try {
      const { stdout } = await systemCommands.checkUsbDevices();
      return stdout.trim().length > 0;
    } catch (error) {
      console.error(`[GenericUsbAdapter] Health check failed for ${this.printerName}:`, error);
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
      console.error(`[GenericUsbAdapter] Failed to get supplies for ${this.printerName}:`, err);
      return {
        paper: "unknown",
        supplies: { black: null, color: null },
      };
    }
  }

  async configure(name: string): Promise<void> {
    await cupsCommands.addUsbPrinter(name, this.uri);
  }

  async printFile(printerName: string, filePath: string, options?: Record<string, any>): Promise<PrintDispatchResult> {
    const cupsJobId = await printerService.printFile(
      filePath,
      printerName,
      options?.copies || 1,
      options?.duplex || 'single'
    );
    return {
      cupsJobId,
      dispatchedAt: Date.now()
    };
  }

  async getJobStatus(printerName: string, jobId: string, metadata?: Record<string, any>): Promise<JobPollStatus> {
    try {
      const { stdout } = await cupsCommands.getJobStatus(printerName);
      const lines = stdout.split("\n");
      const jobLine = lines.find((line: string) => line.includes(jobId));

      if (!jobLine) {
        return "completed";
      }

      const lower = jobLine.toLowerCase();
      if (lower.includes("held") || lower.includes("stopped")) {
        return "held_or_stopped";
      }

      return "printing";
    } catch (err) {
      console.error(`[GenericUsbAdapter] Error checking status for ${jobId}:`, err);
      return "unreachable";
    }
  }

  async cancelJob(printerName: string, jobId: string): Promise<boolean> {
    try {
      await printerService.cancelJob(jobId);
      return true;
    } catch (e) {
      console.error(`[GenericUsbAdapter] Failed to cancel CUPS job ${jobId}`, e);
      return false;
    }
  }
}
