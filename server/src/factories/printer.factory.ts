import { IPrinterAdapter } from "../adapters/IPrinterAdapter";
import { HpLegacyAdapter } from "../adapters/HpLegacyAdapter";
import { IppModernAdapter } from "../adapters/IppModernAdapter";
import { EpsonLegacyAdapter } from "../adapters/EpsonLegacyAdapter";
import { SnmpAdapter } from "../adapters/SnmpAdapter";
import { GenericUsbAdapter } from "../adapters/GenericUsbAdapter";
import { cupsCommands } from "../commands/cups.commands";

export class PrinterFactory {
  /**
   * Resolves the device URI for a given printer name from CUPS.
   */
  static async getDeviceUri(printerName: string): Promise<string | null> {
    try {
      const { stdout } = await cupsCommands.getPrinterStatus();
      // Look for the specific printer in lpstat -v output
      const match = new RegExp(`device for ${printerName}:\\s*(.+)`).exec(stdout);
      return match ? match[1].trim() : null;
    } catch (err) {
      console.error(`[PrinterFactory] Failed to get URI for ${printerName}:`, err);
      return null;
    }
  }

  /**
   * Returns the appropriate adapter based on the URI.
   */
  static getAdapterByUri(printerName: string, uri: string): IPrinterAdapter | null {
    const lowerUri = uri.toLowerCase();

    if (lowerUri.startsWith("ipp://")) {
      return new IppModernAdapter(printerName, uri);
    } else if (lowerUri.startsWith("socket://") || lowerUri.startsWith("lpd://")) {
      return new SnmpAdapter(printerName, uri);
    } else if (lowerUri.includes("usb://hp") || lowerUri.startsWith("hp:/usb/")) {
      return new HpLegacyAdapter(printerName, uri);
    } else if (lowerUri.includes("usb://epson")) {
      return new EpsonLegacyAdapter(printerName, uri);
    } else if (lowerUri.startsWith("usb://")) {
      return new GenericUsbAdapter(printerName, uri);
    }

    return null;
  }
  /**
   * Helper to resolve a printer by name to its adapter.
   */
  static async getAdapter(printerName: string): Promise<IPrinterAdapter | null> {
    const uri = await this.getDeviceUri(printerName);
    if (!uri) return null;
    return this.getAdapterByUri(printerName, uri);
  }
}
