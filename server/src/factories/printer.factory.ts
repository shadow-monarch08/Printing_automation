import { IPrinterAdapter } from "../adapters/IPrinterAdapter";
import { HpLegacyAdapter } from "../adapters/HpLegacyAdapter";
import { IppModernAdapter } from "../adapters/IppModernAdapter";
import { SnmpNetworkAdapter } from "../adapters/SnmpAdapter";
import { CupsUsbRasterAdapter } from "../adapters/CupsUsbRasterAdapter";
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
   * Returns the appropriate strategy adapter based on the device URI.
   * Universal routing covering all 4 hardware archetypes with zero blind spots:
   * 1. Modern Network IPP / AirPrint / Mopria (ipp://, ipps://, dnssd://, mdns://)
   * 2. Commercial Copiers on Port 9100 / LPR (socket://, lpd://)
   * 3. HP Legacy Firmware-Downloading Lasers (hp:/, usb://HP/, usb://Hewlett-Packard/)
   * 4. Universal USB Desktop Inkjet & Laser (usb://EPSON/, usb://Canon/, usb://Brother/, etc.)
   */
  static getAdapterByUri(printerName: string, uri: string): IPrinterAdapter {
    const lowerUri = uri.toLowerCase();

    // 1. Modern IPP / AirPrint / Mopria (Plain, TLS, or mDNS/Avahi zero-conf)
    if (
      lowerUri.startsWith("ipp://") ||
      lowerUri.startsWith("ipps://") ||
      lowerUri.startsWith("dnssd://") ||
      lowerUri.startsWith("mdns://")
    ) {
      return new IppModernAdapter(printerName, uri);
    }

    // 2. Heavy-Duty Commercial Copiers (Port 9100 AppSocket / LPR)
    if (lowerUri.startsWith("socket://") || lowerUri.startsWith("lpd://")) {
      return new SnmpNetworkAdapter(printerName, uri);
    }

    // 3. HP Legacy Host-Based Lasers (HPLIP URI or HP-branded USB device)
    if (
      lowerUri.startsWith("hp:/") ||
      (lowerUri.startsWith("usb://") && (lowerUri.includes("hp/") || lowerUri.includes("hewlett-packard/")))
    ) {
      return new HpLegacyAdapter(printerName, uri);
    }

    // 4. Universal USB Desktop Inkjet & Laser (Epson EcoTank, Canon MegaTank, Brother, etc.)
    if (lowerUri.startsWith("usb://")) {
      return new CupsUsbRasterAdapter(printerName, uri);
    }

    // Fallback default
    return new CupsUsbRasterAdapter(printerName, uri);
  }

  /**
   * Helper to resolve a printer by name to its adapter.
   */
  static async getAdapter(printerName: string): Promise<IPrinterAdapter> {
    const uri = await this.getDeviceUri(printerName);
    if (!uri) {
      return new CupsUsbRasterAdapter(printerName, `usb://${printerName}`);
    }
    return this.getAdapterByUri(printerName, uri);
  }
}
