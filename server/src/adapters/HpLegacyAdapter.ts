import { IPrinterAdapter } from "./IPrinterAdapter";
import { PrinterSupplyStatus } from "../app/services/supplies.service";
import { hpCommands } from "../commands/hp.commands";
import { systemCommands } from "../commands/system.commands";

export class HpLegacyAdapter implements IPrinterAdapter {
  constructor(private printerName: string, private uri: string) {}

  async healthCheck(): Promise<boolean> {
    try {
      const { stdout } = await systemCommands.checkUsbDevices();
      // A simplistic digital probe for HP printers
      // In a real system, you'd match the vendor/product ID from the URI
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
}
