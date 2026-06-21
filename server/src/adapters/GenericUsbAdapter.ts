import { IPrinterAdapter } from "./IPrinterAdapter";
import { PrinterSupplyStatus } from "../app/types";
import { systemCommands } from "../commands/system.commands";
import { cupsCommands } from "../commands/cups.commands";

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
}
