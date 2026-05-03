// src/types/index.ts

export interface BackendPrinter {
  name: string;
  description: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  type: 'usb' | 'network' | 'unknown';
  isDefault?: boolean;
  alias?: string;
  capabilities?: string[];
  paper: 'ready' | 'empty' | 'unknown';
  supplyBlack: number | null;
  supplyColor: number | null;
}

export interface BackendJob {
  id: string;
  cupsJobId: string | null;
  filename: string;
  owner: string;
  pages: number;
  copies: number;
  colorMode: 'color' | 'grayscale';
  duplex: 'single' | 'double';
  orientation: 'portrait' | 'landscape';
  targetPrinter: string;
  status: 'queued' | 'spooling' | 'printing' | 'done' | 'failed';
  cost: number;
  submittedAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface BackendMetrics {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  // Extended fields for phase 7:
  cpuLoad?: number;
  uptime?: string;
  uptimeSeconds?: number;
  totalJobsToday?: number;
  revenue?: number;
  activePrinters?: number;
  totalPrinters?: number;
}

export interface BackendSupplies {
  status: 'online' | 'offline';
  paper: 'ready' | 'empty' | 'unknown';
  supplies: {
    black: number | null;
    color: number | null;
  };
}

export type SSEEvent =
  | { type: 'JOB_STATUS'; jobId: string; status: string; printer?: string }
  | { type: 'JOB_CREATED'; jobId: string; filename: string; owner: string }
  | { type: 'JOB_FAILED'; jobId: string; error: string }
  | { type: 'PRINTER_STATUS'; printerName: string; status: 'idle' | 'printing' | 'error' }
  | { type: 'PRINTER_DISCOVERED'; printerName: string; uri: string }
  | { type: 'QUEUE_UPDATE'; queueLength: number }
  | { type: 'METRICS_UPDATE'; metrics: BackendMetrics };

export interface PricingConfig {
  bwPerPage: number;
  colorPerPage: number;
  currency: string;
  duplexDiscount: number;
  bulkThreshold: number;
  bulkDiscount: number;
}
