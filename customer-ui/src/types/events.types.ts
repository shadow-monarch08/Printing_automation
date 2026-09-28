// customer-ui/src/types/events.types.ts

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

export interface CustomerQuoteOverridePayload {
  sessionId: string;
  quoteId: string;
  adjustedCost: number;
  reason?: string;
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
 * Strict mapping of customer events to payload types
 */
export interface CustomerEventMap {
  'connected': ConnectedPayload;
  'customer:job:queued': CustomerJobQueuedPayload;
  'customer:job:active': CustomerJobActivePayload;
  'customer:job:completed': CustomerJobCompletedPayload;
  'customer:job:failed': CustomerJobFailedPayload;
  'customer:quote:override': CustomerQuoteOverridePayload;
  'system:queue:paused': SystemQueuePausedPayload;
  'system:queue:resumed': SystemQueueResumedPayload;
  'system:broadcast:alert': SystemBroadcastAlertPayload;
}

export type CustomerEventType = keyof CustomerEventMap;
