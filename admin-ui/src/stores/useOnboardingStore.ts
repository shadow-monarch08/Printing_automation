// src/stores/useOnboardingStore.ts
import { create } from 'zustand';
import { api } from '../services/api';
import type { WifiNetwork } from '../types';

export interface OnboardingState {
  currentStep: 1 | 2 | 3;
  shopName: string;
  adminPin: string;

  // Wi-Fi Discovery State
  networks: WifiNetwork[];
  isScanning: boolean;

  // Active Provisioning Transaction
  selectedNetwork: WifiNetwork | null;
  isSubmitting: boolean;
  submissionError: string | null;

  // Actions
  setStep: (step: 1 | 2 | 3) => void;
  setShopDetails: (shopName: string, adminPin: string) => void;
  scanNetworks: () => Promise<void>;
  setSelectedNetwork: (network: WifiNetwork | null) => void;
  clearSubmissionError: () => void;
  submitWifiProvision: (params: {
    password?: string;
    isSaved?: boolean;
    profileName?: string;
    uuid?: string;
  }) => Promise<boolean>;
  skipWifiProvision: () => Promise<boolean>;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  currentStep: 1,
  shopName: 'Modern Press',
  adminPin: '',

  networks: [],
  isScanning: false,

  selectedNetwork: null,
  isSubmitting: false,
  submissionError: null,

  setStep: (step: 1 | 2 | 3) => set({ currentStep: step }),

  setShopDetails: (shopName: string, adminPin: string) =>
    set({ shopName, adminPin }),

  scanNetworks: async () => {
    set({ isScanning: true });
    try {
      const data = await api.scanWifiNetworks();
      set({ networks: data || [] });
    } catch (err) {
      console.error('[OnboardingStore] Failed to scan Wi-Fi networks:', err);
    } finally {
      set({ isScanning: false });
    }
  },

  setSelectedNetwork: (network: WifiNetwork | null) =>
    set({ selectedNetwork: network }),

  clearSubmissionError: () => set({ submissionError: null }),

  submitWifiProvision: async ({ password, isSaved, profileName, uuid }) => {
    const { shopName, adminPin, selectedNetwork } = get();
    if (!selectedNetwork) {
      set({ submissionError: 'No target network selected.' });
      return false;
    }

    set({ isSubmitting: true, submissionError: null });

    try {
      await api.provisionSetup({
        wifiSsid: selectedNetwork.ssid,
        wifiPassword: password,
        profileName,
        uuid,
        isSaved,
        adminPin,
        shopName,
        mode: 'MOBILE',
        source: 'mobile',
      });

      set({ isSubmitting: false, currentStep: 3, selectedNetwork: null });
      return true;
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err.message ||
        'Failed to dispatch configuration to kiosk terminal.';
      set({ isSubmitting: false, submissionError: errorMsg });
      return false;
    }
  },

  skipWifiProvision: async () => {
    const { shopName, adminPin } = get();
    set({ isSubmitting: true, submissionError: null });

    try {
      await api.skipWifiSetup({ adminPin, shopName });
      set({ isSubmitting: false, currentStep: 3 });
      return true;
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err.message ||
        'Failed to proceed with active network.';
      set({ isSubmitting: false, submissionError: errorMsg });
      return false;
    }
  },

  reset: () => {
    set({
      currentStep: 1,
      shopName: 'Modern Press',
      adminPin: '',
      networks: [],
      isScanning: false,
      selectedNetwork: null,
      isSubmitting: false,
      submissionError: null,
    });
  },
}));
