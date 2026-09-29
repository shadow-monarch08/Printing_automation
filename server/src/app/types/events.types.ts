// server/src/app/types/events.types.ts

/**
 * -------------------------------------------------------------
 * Domain Event Payloads: Customer (Session Scoped)
 * -------------------------------------------------------------
 */
export interface CustomerJobQueuedPayload {
  sessionId?: string;
  id: string;
  filename: string;
  pageCount?: number;
  copies?: number;
  colorMode?: string;
  duplex?: boolean;
  cost?: number;
  status: "queued";
  createdAt?: string;
}

export interface CustomerJobActivePayload {
  sessionId?: string;
  id: string;
  data: {
    filename?: string;
    pageCount?: number;
    copies?: number;
    colorMode?: string;
    duplex?: boolean;
    cost?: number;
    status: "spooling" | "printing";
    executedByPrinter?: string;
    [key: string]: any;
  };
}

export interface CustomerJobCompletedPayload {
  sessionId?: string;
  id: string;
  data: {
    filename?: string;
    executedByPrinter?: string;
    completedAt?: string;
    [key: string]: any;
  };
}

export interface CustomerJobFailedPayload {
  sessionId?: string;
  id: string;
  reason: string;
  failedAt?: string;
  data?: any;
}

export interface CustomerQuoteOverridePayload {
  sessionId: string;
  quoteId: string;
  adjustedCost: number;
  reason?: string;
}

/**
 * -------------------------------------------------------------
 * Domain Event Payloads: Admin (Control Room)
 * -------------------------------------------------------------
 */
export interface AdminFleetStatePayload {
  printer: string;
  state: "idle" | "busy" | "offline" | "error" | "quarantined";
  details?: string;
  timestamp?: string;
}

export interface AdminPrinterQuarantinedPayload {
  printer: string;
  reason: string;
  timestamp?: string;
}

export interface AdminQueueSyncPayload {
  action: "PAUSE" | "RESUME" | "REORDER" | "DELETE" | "PRIORITIZE";
  jobId?: string;
  isQueuePaused?: boolean;
  queueLength?: number;
  timestamp?: string;
}

export interface AdminMetricsCriticalPayload {
  type: string;
  message: string;
  diskUsage?: number;
  cpuLoad?: number;
  memoryUsage?: number;
  timestamp?: string;
}

export interface AdminHardwareDiscoveryPayload {
  deviceType?: string;
  id?: string;
  timestamp: string;
}

/**
 * -------------------------------------------------------------
 * Domain Event Payloads: Kiosk (Physical 800x480 Hardware Loop)
 * -------------------------------------------------------------
 */
export interface KioskOnboardingStatusPayload {
  status: "idle" | "connecting" | "verifying_internet" | "starting_tunnel" | "verifying_daemons" | "success" | "failed";
  phase: string;
  step: number;
  totalSteps: number;
  progressPercent: number;
  message: string;
  ssid?: string;
  shopName?: string;
  onboardingMode?: "SCREEN" | "MOBILE";
  timestamp: number;
}

export interface KioskOnboardingErrorPayload {
  code: string;
  error: string;
  message: string;
  rollbackActive?: boolean;
  onboardingMode?: "SCREEN" | "MOBILE";
  retryMode?: "SCREEN" | "MOBILE";
  timestamp: number;
}

export interface KioskOnboardingDonePayload {
  cloudflareUrl: string;
  localAccessUrl?: string;
  printerCount: number;
  nmsDeviceId?: string | null;
  shopName: string;
  timestamp: number;
}

export interface KioskChassisAlertPayload {
  type: "PAPER_JAM" | "DOOR_OPEN" | "MEDIA_EMPTY" | "OFFLINE";
  printer?: string;
  message: string;
  timestamp: number;
}

export interface KioskNetworkStateChangedPayload {
  state: "ONLINE" | "CONNECTIVITY_FAILURE" | "ATTEMPTING_SAVED_NETWORKS" | "HOTSPOT_ACTIVATING" | "HOTSPOT_ACTIVE" | "RECOVERING";
  internetOnline: boolean;
  hotspotActive: boolean;
  activeProfile: string | null;
  cloudflareUrl?: string | null;
  localAccessUrl?: string;
  timestamp: number;
}

/**
 * -------------------------------------------------------------
 * Domain Event Payloads: System (Common Broadcast)
 * -------------------------------------------------------------
 */
export interface SystemQueuePausedPayload {
  message?: string;
  reason?: string;
  timestamp?: string;
}

export interface SystemQueueResumedPayload {
  message?: string;
  timestamp?: string;
}

export interface SystemBroadcastAlertPayload {
  level: "INFO" | "WARN" | "CRITICAL";
  message: string;
  title?: string;
  timestamp?: string;
}

/**
 * -------------------------------------------------------------
 * Event Bus Type Map
 * -------------------------------------------------------------
 */
export interface EventMap {
  // Customer Domain
  "customer:job:queued": CustomerJobQueuedPayload;
  "customer:job:active": CustomerJobActivePayload;
  "customer:job:completed": CustomerJobCompletedPayload;
  "customer:job:failed": CustomerJobFailedPayload;
  "customer:quote:override": CustomerQuoteOverridePayload;

  // Admin Domain
  "admin:fleet:state": AdminFleetStatePayload;
  "admin:printer:quarantined": AdminPrinterQuarantinedPayload;
  "admin:queue:sync": AdminQueueSyncPayload;
  "admin:metrics:critical": AdminMetricsCriticalPayload;
  "admin:hardware:discovery": AdminHardwareDiscoveryPayload;

  // Kiosk Domain
  "kiosk:onboarding:status": KioskOnboardingStatusPayload;
  "kiosk:onboarding:error": KioskOnboardingErrorPayload;
  "kiosk:onboarding:done": KioskOnboardingDonePayload;
  "kiosk:chassis:alert": KioskChassisAlertPayload;
  "kiosk:network:state_changed": KioskNetworkStateChangedPayload;

  // System Domain
  "system:queue:paused": SystemQueuePausedPayload;
  "system:queue:resumed": SystemQueueResumedPayload;
  "system:broadcast:alert": SystemBroadcastAlertPayload;

  // Backward Compatibility (Legacy aliases)
  "job_queued": any;
  "job_active": any;
  "job_completed": any;
  "job_failed": any;
  "printer_state_changed": any;
  "printer_quarantined": any;
  "queue_paused": any;
  "queue_resumed": any;
  "printer_discovery": any;
  "system_critical": any;
}

export type EventName = keyof EventMap;
