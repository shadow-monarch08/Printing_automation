// src/stores/useKioskStore.ts
import { create } from 'zustand';
import { api } from '../services/api';
import type { WifiNetwork, ProvisioningTelemetry, KioskSummaryData } from '../types';

export type KioskStep = 'CHOICE' | 'IDENTITY' | 'WIFI_SCAN' | 'MOBILE_HANDOFF' | 'PROVISIONING' | 'OPERATIONAL';

export interface KeyboardConfig {
  isOpen: boolean;
  mode: 'alpha' | 'pin';
  label: string;
  initialValue: string;
  isPassword?: boolean;
  maxLength?: number;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
}

export interface KioskStoreState {
  step: KioskStep;
  onboardingMode: 'SCREEN' | 'MOBILE' | 'NONE';
  isHotspotStarting: boolean;
  shopName: string;
  adminPin: string;
  selectedNetwork: WifiNetwork | null;
  wifiPassword: string;
  
  // Wi-Fi Scanning
  networks: WifiNetwork[];
  isScanning: boolean;
  
  // Provisioning & Summary
  isSubmitting: boolean;
  provisioningTelemetry: ProvisioningTelemetry | null;
  kioskSummary: KioskSummaryData | null;
  errorMessage: string | null;
  errorCode: string | null;

  // Docked Touch Keyboard Modal State
  keyboard: KeyboardConfig;

  // Actions
  setStep: (step: KioskStep) => void;
  setOnboardingMode: (mode: 'SCREEN' | 'MOBILE' | 'NONE') => void;
  setShopName: (name: string) => void;
  setAdminPin: (pin: string) => void;
  setSelectedNetwork: (network: WifiNetwork | null) => void;
  setWifiPassword: (pwd: string) => void;
  setErrorMessage: (msg: string | null, code?: string | null) => void;
  setTelemetry: (telemetry: ProvisioningTelemetry | null) => void;
  setKioskSummary: (summary: KioskSummaryData | null) => void;

  openKeyboard: (config: Omit<KeyboardConfig, 'isOpen'>) => void;
  closeKeyboard: () => void;

  startMobileMode: () => Promise<void>;
  cancelMobileMode: () => Promise<void>;
  startScreenMode: () => Promise<void>;
  resetToChoice: () => void;

  scanNetworks: () => Promise<void>;
  submitProvisioning: (options?: { isSaved?: boolean; password?: string }) => Promise<void>;
  skipWifiAndProvision: () => Promise<void>;
  resetToIdentity: () => void;
  fetchSummary: () => Promise<void>;
  kioskTheme: 'dark' | 'light';
  toggleKioskTheme: () => void;
}

const DEFAULT_KEYBOARD: KeyboardConfig = {
  isOpen: false,
  mode: 'alpha',
  label: '',
  initialValue: '',
  isPassword: false,
  maxLength: 64,
  onSubmit: () => {},
  onCancel: () => {},
};

export const useKioskStore = create<KioskStoreState>((set, get) => ({
  step: 'CHOICE',
  onboardingMode: 'NONE',
  isHotspotStarting: false,
  shopName: 'Modern Press',
  adminPin: '',
  selectedNetwork: null,
  wifiPassword: '',

  networks: [],
  isScanning: false,

  isSubmitting: false,
  provisioningTelemetry: null,
  kioskSummary: null,
  errorMessage: null,
  errorCode: null,

  keyboard: DEFAULT_KEYBOARD,

  setStep: (step) => set({ step }),
  setOnboardingMode: (onboardingMode) => set({ onboardingMode }),
  setShopName: (shopName) => set({ shopName }),
  setAdminPin: (adminPin) => set({ adminPin }),
  setSelectedNetwork: (selectedNetwork) => set({ selectedNetwork }),
  setWifiPassword: (wifiPassword) => set({ wifiPassword }),
  setErrorMessage: (errorMessage, errorCode = null) => set({ errorMessage, errorCode }),
  setTelemetry: (provisioningTelemetry) => set({ provisioningTelemetry }),
  setKioskSummary: (kioskSummary) => set({ kioskSummary }),

  openKeyboard: (config) =>
    set({
      keyboard: {
        ...config,
        isOpen: true,
      },
    }),

  closeKeyboard: () =>
    set((state) => ({
      keyboard: { ...state.keyboard, isOpen: false },
    })),

  startMobileMode: async () => {
    set({ isHotspotStarting: true, errorMessage: null });
    try {
      await api.startHotspot();
      set({
        step: 'MOBILE_HANDOFF',
        onboardingMode: 'MOBILE',
        isHotspotStarting: false,
      });
    } catch (err: any) {
      console.error('[KioskStore] Failed to activate hotspot:', err);
      set({
        errorMessage: 'Could not activate hotspot AP. Please configure on screen instead.',
        isHotspotStarting: false,
      });
    }
  },

  cancelMobileMode: async () => {
    try {
      await api.stopHotspot();
      await api.setOnboardingMode('NONE');
    } catch (err) {
      console.warn('[KioskStore] Warning stopping hotspot:', err);
    }
    set({
      step: 'CHOICE',
      onboardingMode: 'NONE',
      errorMessage: null,
      errorCode: null,
    });
  },

  startScreenMode: async () => {
    try {
      await api.setOnboardingMode('SCREEN');
    } catch (err) {
      /* non-fatal */
    }
    set({
      step: 'IDENTITY',
      onboardingMode: 'SCREEN',
      errorMessage: null,
      errorCode: null,
    });
  },

  resetToChoice: async () => {
    try {
      await api.setOnboardingMode('NONE');
    } catch (err) {
      /* non-fatal */
    }
    set({
      step: 'CHOICE',
      onboardingMode: 'NONE',
      errorMessage: null,
      errorCode: null,
      isSubmitting: false,
      provisioningTelemetry: null,
    });
  },

  scanNetworks: async () => {
    set({ isScanning: true, errorMessage: null });
    try {
      const data = await api.scanWifiNetworks();
      set({ networks: data || [] });
    } catch (err: any) {
      console.error('[KioskStore] Wi-Fi Scan failed:', err);
      set({ errorMessage: 'Wi-Fi frequency scan timed out. Tap Re-Scan to retry.' });
    } finally {
      set({ isScanning: false });
    }
  },

  submitProvisioning: async (options?: { isSaved?: boolean; password?: string }) => {
    const { shopName, adminPin, selectedNetwork } = get();
    const finalPassword = options?.password !== undefined ? options.password : get().wifiPassword;
    const finalIsSaved = options?.isSaved !== undefined ? options.isSaved : selectedNetwork?.isSaved;

    set({ isSubmitting: true, step: 'PROVISIONING', errorMessage: null, errorCode: null });

    try {
      await api.provisionSetup({
        shopName,
        adminPin,
        wifiSsid: selectedNetwork?.ssid,
        wifiPassword: finalPassword || undefined,
        isSaved: finalIsSaved,
        profileName: selectedNetwork?.profileName || undefined,
        mode: get().onboardingMode === 'MOBILE' ? 'MOBILE' : 'SCREEN',
        source: get().onboardingMode === 'MOBILE' ? 'mobile' : 'kiosk',
      });
      // Provisioning dispatched successfully. Telemetry updates will arrive via SSE / polling
    } catch (err: any) {
      console.error('[KioskStore] Provisioning dispatch failed:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to dispatch provisioning pipeline.';
      const code = err.response?.data?.code || 'DISPATCH_ERROR';
      set({
        errorMessage: msg,
        errorCode: code,
        isSubmitting: false,
      });
    }
  },

  skipWifiAndProvision: async () => {
    const { shopName, adminPin } = get();
    set({ isSubmitting: true, step: 'PROVISIONING', errorMessage: null, errorCode: null });

    try {
      await api.skipWifiSetup({ shopName, adminPin });
    } catch (err: any) {
      console.error('[KioskStore] Skip Wi-Fi failed:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to proceed with wired ethernet.';
      const code = err.response?.data?.code || 'DISPATCH_ERROR';
      set({
        errorMessage: msg,
        errorCode: code,
        isSubmitting: false,
      });
    }
  },

  resetToIdentity: () => {
    set({
      step: 'IDENTITY',
      errorMessage: null,
      errorCode: null,
      isSubmitting: false,
      provisioningTelemetry: null,
    });
  },

  fetchSummary: async () => {
    try {
      const summary = await api.getKioskSummary();
      set({ kioskSummary: summary });
      if (summary.isOnboarded) {
        set({ step: 'OPERATIONAL' });
      } else if (summary.provisioning && summary.provisioning.status !== 'idle') {
        set({
          step: 'PROVISIONING',
          provisioningTelemetry: summary.provisioning,
        });
      } else if (summary.hotspotActive || summary.onboardingMode === 'MOBILE') {
        if (get().step !== 'PROVISIONING' && get().step !== 'OPERATIONAL') {
          set({ step: 'MOBILE_HANDOFF', onboardingMode: 'MOBILE' });
        }
      }
    } catch (err) {
      console.warn('[KioskStore] Error fetching summary:', err);
    }
  },

  kioskTheme: (localStorage.getItem('kiosk_display_theme') as 'dark' | 'light') || 'dark',
  toggleKioskTheme: () => {
    const current = get().kioskTheme;
    const next = current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('kiosk_display_theme', next);
    } catch {
      /* ignore storage errors */
    }
    set({ kioskTheme: next });
  },
}));
