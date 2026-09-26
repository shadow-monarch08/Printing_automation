// src/stores/useKioskStore.ts
import { create } from 'zustand';
import { api } from '../services/api';
import type { WifiNetwork, ProvisioningTelemetry, KioskSummaryData } from '../types';

export type KioskStep = 'IDENTITY' | 'WIFI_SCAN' | 'PROVISIONING' | 'OPERATIONAL';

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
  setShopName: (name: string) => void;
  setAdminPin: (pin: string) => void;
  setSelectedNetwork: (network: WifiNetwork | null) => void;
  setWifiPassword: (pwd: string) => void;
  setErrorMessage: (msg: string | null, code?: string | null) => void;
  setTelemetry: (telemetry: ProvisioningTelemetry | null) => void;
  setKioskSummary: (summary: KioskSummaryData | null) => void;

  openKeyboard: (config: Omit<KeyboardConfig, 'isOpen'>) => void;
  closeKeyboard: () => void;

  scanNetworks: () => Promise<void>;
  submitProvisioning: (options?: { isSaved?: boolean; password?: string }) => Promise<void>;
  skipWifiAndProvision: () => Promise<void>;
  resetToIdentity: () => void;
  fetchSummary: () => Promise<void>;
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
  step: 'IDENTITY',
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
      }
    } catch (err) {
      console.warn('[KioskStore] Error fetching summary:', err);
    }
  },
}));
