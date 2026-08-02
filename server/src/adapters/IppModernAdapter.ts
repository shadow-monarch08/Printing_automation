import { IPrinterAdapter, PrintDispatchResult, JobPollStatus } from "./IPrinterAdapter";
import { PrinterSupplyStatus } from "../app/types";
import { cupsCommands } from "../commands/cups.commands";
import * as printerService from "../app/services/printer.service";
import ipp from "ipp";

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
        paper: paperEmpty ? "empty" : "ready",
        supplies: { black, color },
      };
    } catch (err) {
      console.error(`[IppModernAdapter] Failed to get supplies for ${this.uri}:`, err);
      return {
        paper: "unknown",
        supplies: { black: null, color: null },
      };
    }
  }

  async configure(name: string): Promise<void> {
    await cupsCommands.addIppPrinter(name, this.uri);
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
    const ippEndpoint = metadata?.ippUri || this.uri;

    // Direct binary IPP socket query using Get-Job-Attributes
    if (ippEndpoint && ippEndpoint.startsWith("ipp://")) {
      try {
        const rawJobId = parseInt(jobId.split("-").pop() || jobId, 10);
        const printer = new (ipp as any).Printer(ippEndpoint);
        const msg = {
          "operation-attributes-tag": {
            "attributes-charset": "utf-8",
            "attributes-natural-language": "en",
            "printer-uri": ippEndpoint,
            "job-id": isNaN(rawJobId) ? jobId : rawJobId,
          }
        };

        const res: any = await new Promise((resolve, reject) => {
          printer.execute("Get-Job-Attributes", msg, (err: any, res: any) => {
            if (err) return reject(err);
            resolve(res);
          });
        });

        const attrs = res?.["job-attributes-tag"];
        if (attrs) {
          const state = attrs["job-state"];
          const reasons = String(attrs["job-state-reasons"] || "");

          // IPP Job States: 3=pending, 4=pending-held, 5=processing, 6=stopped, 7=canceled, 8=aborted, 9=completed
          if (state === 9 || state === "completed") {
            return "completed";
          }
          if (state === 7 || state === 8 || state === 6 || 
              reasons.includes("offline-report") || 
              reasons.includes("media-empty") || 
              reasons.includes("media-jam")) {
            return "held_or_stopped";
          }
          if (state === 3 || state === 5) {
            return "printing";
          }
        }
      } catch (e) {
        console.warn(`[IppModernAdapter] Binary IPP query failed for ${ippEndpoint}, falling back to CUPS:`, e);
      }
    }

    // Fallback to CUPS status parsing
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
