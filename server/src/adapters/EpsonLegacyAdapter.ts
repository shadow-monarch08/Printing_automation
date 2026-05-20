import { IPrinterAdapter } from "./IPrinterAdapter";
import { PrinterSupplyStatus } from "../app/services/supplies.service";
import { systemCommands } from "../commands/system.commands";

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
        status: "online",
        paper: "unknown",
        supplies: {
          black,
          color: colorLevels.length > 0 ? Math.min(...colorLevels) : null,
        },
      };
    } catch (err) {
      console.error(`[EpsonLegacyAdapter] Failed to get supplies for ${this.printerName}:`, err);
      return {
        status: "offline",
        paper: "unknown",
        supplies: { black: null, color: null },
      };
    }
  }

  async configure(name: string): Promise<void> {
    throw new Error("Configuration not implemented for generic Epson USB yet.");
  }
}
