// src/types/events.types.ts

export interface KioskOnboardingStatusPayload {
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

export interface KioskOnboardingErrorPayload {
  code: string;
  error: string;
  message: string;
  rollbackActive?: boolean;
  onboardingMode?: 'MOBILE' | 'SCREEN';
  retryMode?: 'MOBILE' | 'SCREEN';
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
  type?: 'PAPER_JAM' | 'DOOR_OPEN' | 'MEDIA_EMPTY' | 'OFFLINE';
  alert?: string;
  printer?: string;
  message: string;
  timestamp: number;
}

export interface AdminFleetStatePayload {
  printers: Array<{
    name: string;
    description?: string;
    status: 'idle' | 'busy' | 'error' | 'offline';
    type?: 'usb' | 'network' | 'unknown';
    isDefault?: boolean;
    alias?: string;
    paper?: 'ready' | 'empty' | 'unknown';
    supplyBlack?: number | null;
    supplyColor?: number | null;
  }>;
  totalPrinters: number;
  activePrinters: number;
  timestamp: string;
}

export interface SystemQueueStatePayload {
  isPaused: boolean;
  message?: string;
  timestamp: string;
}

export interface SystemBroadcastAlertPayload {
  level: 'INFO' | 'WARN' | 'CRITICAL';
  title?: string;
  message: string;
  timestamp: string;
}

export type KioskDomainEventMap = {
  'kiosk:onboarding:status': KioskOnboardingStatusPayload;
  'kiosk:onboarding:error': KioskOnboardingErrorPayload;
  'kiosk:onboarding:done': KioskOnboardingDonePayload;
  'kiosk:chassis:alert': KioskChassisAlertPayload;
  'admin:fleet:state': AdminFleetStatePayload;
  'system:queue:paused': { isPaused: true; message?: string; timestamp: string };
  'system:queue:resumed': { isPaused: false; timestamp: string };
  'system:broadcast:alert': SystemBroadcastAlertPayload;
};

export type KioskEventName = keyof KioskDomainEventMap;
