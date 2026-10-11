import { IPrinterAdapter, PrintDispatchResult, JobPollStatus } from "./IPrinterAdapter";
import { PrinterSupplyStatus } from "../app/types";
import { systemCommands } from "../commands/system.commands";
import { cupsCommands, PrintFileOptions } from "../commands/cups.commands";
import * as printerService from "../app/services/printer.service";
import { pingTcpPort, extractHostAndPort } from "../app/utils/network";

/**
 * Strategy Adapter for Heavy-Duty Commercial Copiers & Network Printers:
 * Canon imageRUNNER, Ricoh Aficio, Konica Minolta bizhub over socket://:9100 or lpd://.
 */
export class SnmpNetworkAdapter implements IPrinterAdapter {
  constructor(private printerName: string, private uri: string) {}

  private extractIp(uri: string): string | null {
    const target = extractHostAndPort(uri);
    return target ? target.host : null;
  }

  /**
   * Two-tier network health check:
   * Tier 1: Fast TCP socket probe on Port 9100/515 (1.5s timeout) - works even if SNMP is disabled.
   * Tier 2: Fallback SNMP walk on standard sysDescr OID.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const target = extractHostAndPort(this.uri, 9100);
      if (!target) return false;

      // Tier 1: Fast TCP Socket Ping
      const isPortAlive = await pingTcpPort(target.host, target.port, 1500);
      if (isPortAlive) {
        return true;
      }

      // Tier 2: SNMP sysDescr walk fallback
      try {
        await systemCommands.snmpWalk(target.host, "1.3.6.1.2.1.1.1.0");
        return true;
      } catch {
        return false;
      }
    } catch (error) {
      console.error(`[SnmpNetworkAdapter] Health check failed for ${this.uri}:`, error);
      return false;
    }
  }

  async getSupplies(): Promise<PrinterSupplyStatus> {
    const ip = this.extractIp(this.uri);
    if (!ip) {
      return { paper: "unknown", supplies: { black: null, color: null } };
    }

    try {
      const { stdout: levelOut } = await systemCommands.snmpWalk(ip, "1.3.6.1.2.1.43.11.1.1.9");
      const { stdout: maxOut } = await systemCommands.snmpWalk(ip, "1.3.6.1.2.1.43.11.1.1.8");

      const parseValues = (stdout: string) => [...stdout.matchAll(/INTEGER:\s*(-?\d+)/g)].map(m => parseInt(m[1], 10));

      const levels = parseValues(levelOut);
      const maxes = parseValues(maxOut);

      const percentages = levels.map((level, index) => {
        const max = maxes[index] || 100;
        if (level === -3) return 100;
        if (level < 0 || max <= 0) return null;
        return Math.min(100, Math.round((level / max) * 100));
      });

      const black = percentages[0] ?? null;
      const colorLevels = percentages.slice(1).filter(p => p !== null);
      const color = colorLevels.length > 0 ? Math.min(...colorLevels) : null;

      return {
        paper: "unknown",
        supplies: { black, color },
      };
    } catch (err) {
      console.error(`[SnmpNetworkAdapter] Failed to get supplies for ${ip}:`, err);
      return {
        paper: "unknown",
        supplies: { black: null, color: null },
      };
    }
  }

  /**
   * Configures network copiers in CUPS using generic PCL6 driver (sample.drv/generpcl.ppd).
   */
  async configure(name: string): Promise<void> {
    await cupsCommands.addGenericPclPrinter(name, this.uri);
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

/**
 * Backward-compatible alias for SnmpNetworkAdapter.
 */
export const SnmpAdapter = SnmpNetworkAdapter;
export type SnmpAdapter = SnmpNetworkAdapter;
