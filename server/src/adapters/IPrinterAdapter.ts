import { PrinterSupplyStatus } from "../app/types";

export interface PrintDispatchResult {
  cupsJobId: string;
  dispatchedAt: number;
}

export type JobPollStatus = 
  | "printing"          // Active in spooler or physical hardware rasterizing
  | "completed"         // Confirmed finished (lpstat missing or IPP job-state === 9)
  | "held_or_stopped"   // Stalled, jammed, paper empty, or paused
  | "unreachable";      // Socket timeout or connection failure

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

  /**
   * Dispatches the physical document to the target printer.
   */
  printFile(printerName: string, filePath: string, options?: Record<string, any>): Promise<PrintDispatchResult>;

  /**
   * Polls the job status using protocol-specific methods.
   */
  getJobStatus(printerName: string, jobId: string, metadata?: Record<string, any>): Promise<JobPollStatus>;

  /**
   * Cancels an active job on the hardware/spooler.
   */
  cancelJob(printerName: string, jobId: string): Promise<boolean>;
}
