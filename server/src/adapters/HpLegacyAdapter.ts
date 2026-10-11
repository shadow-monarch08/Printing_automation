import { IPrinterAdapter, PrintDispatchResult, JobPollStatus } from "./IPrinterAdapter";
import { PrinterSupplyStatus } from "../app/types";
import { hpCommands } from "../commands/hp.commands";
import { systemCommands } from "../commands/system.commands";
import { cupsCommands, PrintFileOptions } from "../commands/cups.commands";
import * as printerService from "../app/services/printer.service";

export class HpLegacyAdapter implements IPrinterAdapter {
  constructor(private printerName: string, private uri: string) {}

  /**
   * Health check for HP legacy laser/inkjet printers:
   * 1. Inspects CUPS status for disconnect ('unplugged or turned off').
   * 2. Checks active presence in lpinfo -v for hp:/ or matching URI.
   * 3. Checks lsusb for HP vendor (03f0 or Hewlett-Packard / HP, Inc) while rejecting mice/keyboards/webcams.
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 1. CUPS status check
      const statusRes = await cupsCommands.getPrinterStatusByName(this.printerName).catch(() => ({ stdout: "" }));
      const lowerStatus = statusRes.stdout.toLowerCase();
      if (lowerStatus.includes("unplugged or turned off")) {
        return false;
      }

      // 2. Physical device check via lpinfo -v
      const devRes = await cupsCommands.listDevices().catch(() => ({ stdout: "" }));
      const lowerDevices = devRes.stdout.toLowerCase();
      if (this.uri && lowerDevices.includes(this.uri.toLowerCase())) {
        return true;
      }
      if (lowerDevices.includes("hp:/") || lowerDevices.includes("usb://hp/")) {
        return true;
      }

      // 3. Fallback: lsusb with peripheral filtering
      const { stdout } = await systemCommands.checkUsbDevices();
      const lines = stdout.split("\n");
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes("mouse") || lower.includes("keyboard") || lower.includes("webcam") || lower.includes("root hub")) {
          continue;
        }
        if (lower.includes("03f0:") || lower.includes("hewlett-packard") || lower.includes("hp, inc") || lower.includes("laserjet")) {
          return true;
        }
      }

      return false;
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

  async printFile(printerName: string, filePath: string, options?: PrintFileOptions): Promise<PrintDispatchResult> {
    const cupsJobId = await printerService.printFile(filePath, printerName, options);
    return { cupsJobId, dispatchedAt: Date.now() };
  }

  async getJobStatus(printerName: string, jobId: string, metadata?: Record<string, any>): Promise<JobPollStatus> {
    return printerService.queryCupsJobStatus(printerName, jobId);
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
