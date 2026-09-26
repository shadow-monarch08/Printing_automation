export interface ProvisioningTelemetryPayload {
  status: "idle" | "connecting" | "verifying_internet" | "starting_tunnel" | "verifying_daemons" | "success" | "failed";
  phase: "IDLE" | "CYCLING_RADIO_HARDWARE" | "NEGOTIATING_WAN_DHCP_LEASE" | "SPAWNING_CLOUDFLARE_EDGE_TUNNEL" | "VERIFYING_DAEMON_READINESS" | "SUCCESS" | "FAILED";
  step: number;             // 1 to 4
  totalSteps: number;       // 4
  progressPercent: number;  // 0, 25, 50, 75, 90, 100
  message: string;
  ssid?: string;
  shopName?: string;
  cloudflareUrl?: string | null;
  localAccessUrl?: string | null;
  printerCount?: number;
  nmsDeviceId?: string | null;
  code?: string;
  error?: string;
  rollbackActive?: boolean;
  onboardingMode?: "MOBILE" | "SCREEN";
  retryMode?: "MOBILE" | "SCREEN";
  timestamp: number;
}

export const REDIS_KEYS = {
  FLEET_PRINTERS: "fleet:printers",
  printerState: (name: string) => `printer:${name}:state`,
  printerHealth: (name: string) => `printer:${name}:health`,
  printerStrikes: (name: string) => `printer:${name}:strikes`,
  printerInfo: (name: string) => `printer:${name}:info`,
  supplies: (name: string) => `supplies:${name}`,
  session: (id: string) => `session:${id}`,
  blacklist: (token: string) => `blacklist:${token}`,
  wifiConnectionStatus: "wifi:connection:status",
  networkRecoveryState: "network:recovery:state",
  onboardingMode: "onboarding:mode",
} as const;

export const REDIS_TTLS = {
  SUPPLIES: 300,        // 5 minutes in seconds
  SESSION: 43200,       // 12 hours in seconds
  WIFI_STATUS: 300,      // 5 minutes provisioning status TTL
  NETWORK_RECOVERY: 3600,  // 1 hour network recovery state TTL
} as const;

