import { IPrinterAdapter, PrintDispatchResult, JobPollStatus } from "./IPrinterAdapter";
import { PrinterSupplyStatus } from "../app/types";
import { hpCommands } from "../commands/hp.commands";
import { systemCommands } from "../commands/system.commands";
import { cupsCommands } from "../commands/cups.commands";
import * as printerService from "../app/services/printer.service";

export class HpLegacyAdapter implements IPrinterAdapter {
  constructor(private printerName: string, private uri: string) {}

  async healthCheck(): Promise<boolean> {
    try {
      const { stdout } = await systemCommands.checkUsbDevices();
      return stdout.toLowerCase().includes("hewlett-packard") || stdout.toLowerCase().includes("hp");
    } catch (error) {
      console.error(`[HpLegacyAdapter] Health check failed for ${this.printerName}:`, error);
      return false;
    }
  }

  async getSupplies(): Promise<PrinterSupplyStatus> {
    try {
      const { stdout } = await hpCommands.getLevels(this.printerName);

      const agents: Record<string, { color: string; level: number }> = {};
      for (const line of stdout.split("\n")) {
        const colorMatch = line.match(/agent(\d+)-color:\s*(\w+)/i);
        const levelMatch = line.match(/agent(\d+)-level:\s*(\d+)/i);
        if (colorMatch) {
          const id = colorMatch[1];
          if (!agents[id]) agents[id] = { color: "", level: -1 };
          agents[id].color = colorMatch[2].toLowerCase();
        }
        if (levelMatch) {
          const id = levelMatch[1];
          if (!agents[id]) agents[id] = { color: "", level: -1 };
          agents[id].level = parseInt(levelMatch[2], 10);
        }
      }

      const levels = Object.values(agents);
      const blackAgent = levels.find(a => a.color === "black");
      const colorAgents = levels.filter(a => a.color !== "black" && a.level >= 0);

      const black = blackAgent?.level ?? null;
      const color = colorAgents.length > 0 ? Math.min(...colorAgents.map(a => a.level)) : null;
      const paperEmpty = /out.of.paper|paper.empty/i.test(stdout);

      return {
        paper: paperEmpty ? "empty" : "ready",
        supplies: { black, color },
      };
    } catch (err) {
      console.error(`[HpLegacyAdapter] Failed to get supplies for ${this.printerName}:`, err);
      return {
        paper: "unknown",
        supplies: { black: null, color: null },
      };
    }
  }

  async configure(name: string): Promise<void> {
    await hpCommands.setupPrinter(this.uri, name);
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
