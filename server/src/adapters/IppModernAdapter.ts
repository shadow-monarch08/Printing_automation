import { IPrinterAdapter } from "./IPrinterAdapter";
import { PrinterSupplyStatus } from "../app/services/supplies.service";
import { cupsCommands } from "../commands/cups.commands";

export class IppModernAdapter implements IPrinterAdapter {
  constructor(private printerName: string, private uri: string) {}

  async healthCheck(): Promise<boolean> {
    try {
      await cupsCommands.probeIppPrinter(this.uri);
      return true;
    } catch (error) {
      console.error(`[IppModernAdapter] Health check failed for ${this.uri}:`, error);
      return false;
    }
  }

  async getSupplies(): Promise<PrinterSupplyStatus> {
    try {
      const { stdout } = await cupsCommands.probeIppPrinter(this.uri);

      const levelMatches = [...stdout.matchAll(/marker-levels[^:]*:\s*([\d,\s]+)/g)];
      const levels: number[] = levelMatches.flatMap(m =>
        m[1].split(",").map((v: any) => parseInt(v.trim(), 10)).filter((n: any) => !isNaN(n))
      );

      const black = levels[0] ?? null;
      const color = levels.length > 1 ? Math.min(...levels.slice(1)) : null;

      const paperEmpty = /media-empty[^:]*:\s*true/i.test(stdout);

      return {
        status: "online",
        paper: paperEmpty ? "empty" : "ready",
        supplies: { black, color },
      };
    } catch (err) {
      console.error(`[IppModernAdapter] Failed to get supplies for ${this.uri}:`, err);
      return {
        status: "offline",
        paper: "unknown",
        supplies: { black: null, color: null },
      };
    }
  }

  async configure(name: string): Promise<void> {
    await cupsCommands.addIppPrinter(name, this.uri);
  }
}
