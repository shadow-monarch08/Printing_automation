// admin-ui/src/types/events.types.ts

export interface CustomerJobQueuedPayload {
  sessionId?: string;
  id: string;
  filename: string;
  pageCount?: number;
  copies?: number;
  colorMode?: string;
  duplex?: boolean;
  cost?: number;
  status: 'queued';
  createdAt?: string;
  targetPrinter?: string;
  printer?: string;
  owner?: string;
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
    status: 'spooling' | 'printing';
    executedByPrinter?: string;
    progress?: number;
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

export interface AdminFleetStatePayload {
  printer: string;
  state: 'idle' | 'busy' | 'offline' | 'error' | 'quarantined';
  details?: string;
  timestamp?: string;
}

export interface AdminPrinterQuarantinedPayload {
  printer: string;
  reason: string;
  timestamp?: string;
}

export interface AdminQueueSyncPayload {
  action: 'PAUSE' | 'RESUME' | 'REORDER' | 'DELETE' | 'PRIORITIZE';
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
  level: 'INFO' | 'WARN' | 'CRITICAL';
  message: string;
  title?: string;
  timestamp?: string;
}

export interface ConnectedPayload {
  role: string;
  sessionId?: string | null;
  timestamp: string;
}

/**
 * Strict mapping of admin control room events to payload types
 */
export interface AdminEventMap {
  'connected': ConnectedPayload;
  'customer:job:queued': CustomerJobQueuedPayload;
  'customer:job:active': CustomerJobActivePayload;
  'customer:job:completed': CustomerJobCompletedPayload;
  'customer:job:failed': CustomerJobFailedPayload;
  'admin:fleet:state': AdminFleetStatePayload;
  'admin:printer:quarantined': AdminPrinterQuarantinedPayload;
  'admin:queue:sync': AdminQueueSyncPayload;
  'admin:metrics:critical': AdminMetricsCriticalPayload;
  'admin:hardware:discovery': AdminHardwareDiscoveryPayload;
  'system:queue:paused': SystemQueuePausedPayload;
  'system:queue:resumed': SystemQueueResumedPayload;
  'system:broadcast:alert': SystemBroadcastAlertPayload;
}

export type AdminEventType = keyof AdminEventMap;
