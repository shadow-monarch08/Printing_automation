import { PrinterSupplyStatus } from "../app/services/supplies.service";

export interface IPrinterAdapter {
  /**
   * Performs a health check / digital probe.
   */
  healthCheck(): Promise<boolean>;

  /**
   * Retrieves current supplies (ink/paper).
   */
  getSupplies(): Promise<PrinterSupplyStatus>;

  /**
   * Configures the printer in CUPS.
   */
  configure(name: string): Promise<void>;
}
