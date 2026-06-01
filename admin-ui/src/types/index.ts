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
  status: 'queued' | 'spooling' | 'printing' | 'done' | 'failed' | 'paused';
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
  memoryUsed?: number;
  memoryTotal?: number;
  diskPercent?: number;
  uptime?: string;
  uptimeSeconds?: number;
  totalJobsToday?: number;
  revenue?: number;
  activePrinters?: number;
  totalPrinters?: number;
}

export interface MetricSnapshot {
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
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
  | { type: 'connected'; timestamp: string }
  | { type: 'job_queued'; id: string; filename: string; owner: string; sessionId?: string; [key: string]: any }
  | { type: 'job_active'; id: string; data: { id: string; filename: string; sessionId?: string; [key: string]: any } }
  | { type: 'job_completed'; id: string; data: { id: string; filename: string; sessionId?: string; [key: string]: any } }
  | { type: 'job_failed'; id: string; reason: string; isBadDocument?: boolean }
  | { type: 'printer_discovery'; timestamp: string }
  | { type: 'system_critical'; message: string }
  | { type: 'printer_state_changed'; printer: string; state: 'idle' | 'busy' | 'flagged' }
  | { type: 'printer_quarantined'; printer: string; message: string }
  | { type: 'queue_paused'; message: string }
  | { type: 'queue_resumed'; message: string };

export interface PricingConfig {
  bwPerPage: number;
  colorPerPage: number;
  currency: string;
  duplexDiscount: number;
  bulkThreshold: number;
  bulkDiscount: number;
}

export interface WifiNetwork {
  ssid: string;
  signal: number;
  isActive?: boolean;
  isSaved?: boolean;
}
