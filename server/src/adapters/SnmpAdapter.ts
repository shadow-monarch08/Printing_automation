import { IPrinterAdapter, PrintDispatchResult, JobPollStatus } from "./IPrinterAdapter";
import { PrinterSupplyStatus } from "../app/types";
import { systemCommands } from "../commands/system.commands";
import { cupsCommands } from "../commands/cups.commands";
import * as printerService from "../app/services/printer.service";

export class SnmpAdapter implements IPrinterAdapter {
  constructor(private printerName: string, private uri: string) {}

  private extractIp(uri: string): string | null {
    const match = uri.match(/(?:socket|lpd|ipp):\/\/([^/:]+)/);
    return match ? match[1] : null;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const ip = this.extractIp(this.uri);
      if (!ip) return false;
      await systemCommands.snmpWalk(ip, "1.3.6.1.2.1.1.1.0");
      return true;
    } catch (error) {
      console.error(`[SnmpAdapter] Health check failed for ${this.uri}:`, error);
      return false;
    }
  }

  async getSupplies(): Promise<PrinterSupplyStatus> {
    const ip = this.extractIp(this.uri);
    if (!ip) {
      return { paper: "unknown", supplies: { black: null, color: null } };
    }

    try {
      const { stdout: levelOut } = await systemCommands.snmpWalk(ip, "1.3.6.1.2.1.43.11.1.1.9");
      const { stdout: maxOut } = await systemCommands.snmpWalk(ip, "1.3.6.1.2.1.43.11.1.1.8");

      const parseValues = (stdout: string) => [...stdout.matchAll(/INTEGER:\s*(-?\d+)/g)].map(m => parseInt(m[1], 10));

      const levels = parseValues(levelOut);
      const maxes = parseValues(maxOut);

      const percentages = levels.map((level, index) => {
        const max = maxes[index] || 100;
        if (level === -3) return 100;
        if (level < 0 || max <= 0) return null;
        return Math.min(100, Math.round((level / max) * 100));
      });

      const black = percentages[0] ?? null;
      const colorLevels = percentages.slice(1).filter(p => p !== null);
      const color = colorLevels.length > 0 ? Math.min(...colorLevels) : null;

      return {
        paper: "unknown",
        supplies: { black, color },
      };
    } catch (err) {
      console.error(`[SnmpAdapter] Failed to get supplies for ${ip}:`, err);
      return {
        paper: "unknown",
        supplies: { black: null, color: null },
      };
    }
  }

  async configure(name: string): Promise<void> {
    throw new Error("Configuration not implemented for generic SNMP yet.");
  }

  async printFile(printerName: string, filePath: string, options?: Record<string, any>): Promise<PrintDispatchResult> {
    const cupsJobId = await printerService.printFile(
      filePath,
      printerName,
      options?.copies || 1,
      options?.duplex || 'single'
    );
    return { cupsJobId, dispatchedAt: Date.now() };
  }

  async getJobStatus(printerName: string, jobId: string, metadata?: Record<string, any>): Promise<JobPollStatus> {
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
