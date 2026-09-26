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

export type WebSocketEvent =
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
  profileName?: string | null;
  isSecured?: boolean;
  securityType?: string;
}

export interface ConnectPayload {
  ssid?: string;
  profileName?: string;
  password?: string;
  adminPin?: string;
  shopName?: string;
  skipWifi?: boolean;
  isSaved?: boolean;
}

export interface HandoffData {
  type: string;
  shopName: string;
  tunnelUrl: string;
  localAccessUrl: string | null;
  printerCount?: number;
  createdAt: number;
}

export interface NetworkStatus {
  internetOnline: boolean;
  recoveryState: 'ONLINE' | 'CONNECTIVITY_FAILURE' | 'GRACE_PERIOD' | 'HOTSPOT_ACTIVATING' | 'HOTSPOT_ACTIVE' | 'RECOVERING';
  hotspotActive: boolean;
  activeProfile: string | null;
  cloudflareUrl: string | null;
  localAccessUrl: string | null;
}



export interface ProvisioningTelemetry {
  status: 'idle' | 'connecting' | 'verifying_internet' | 'starting_tunnel' | 'verifying_daemons' | 'success' | 'failed';
  phase: 'IDLE' | 'CYCLING_RADIO_HARDWARE' | 'NEGOTIATING_WAN_DHCP_LEASE' | 'SPAWNING_CLOUDFLARE_EDGE_TUNNEL' | 'VERIFYING_DAEMON_READINESS' | 'SUCCESS' | 'FAILED';
  step: number;
  totalSteps: number;
  progressPercent: number;
  message: string;
  ssid?: string;
  shopName?: string;
  cloudflareUrl?: string | null;
  localAccessUrl?: string | null;
  printerCount?: number;
  code?: string;
  error?: string;
  rollbackActive?: boolean;
  onboardingMode?: 'MOBILE' | 'SCREEN';
  retryMode?: 'MOBILE' | 'SCREEN';
  timestamp: number;
}

export interface KioskSummaryData {
  isOnboarded: boolean;
  provisioningState: 'FIRST_BOOT' | 'RECOVERY' | 'READY';
  shopName: string;
  hotspotSsid: string;
  setupUrl: string;
  localAccessUrl: string | null;
  cloudflareUrl: string | null;
  internetOnline: boolean;
  activeProfile: string | null;
  hotspotActive: boolean;
  onboardingMode?: 'MOBILE' | 'SCREEN' | 'NONE';
  printerCount: number;
  provisioning: ProvisioningTelemetry | null;
  timestamp: number;
}
