// src/stores/useAdminStore.ts
import { create } from 'zustand';
import { api } from '../services/api';
import { apiClient } from '../services/apiClient';
import type { BackendPrinter, BackendJob, BackendMetrics, PricingConfig, SSEEvent } from '../types';

interface AdminState {
  isAuthenticated: boolean;
  authenticate: (pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  
  isSetupMode: boolean;
  checkSetupMode: () => Promise<void>;

  printers: BackendPrinter[];
  isLoadingPrinters: boolean;
  loadPrinters: () => Promise<void>;
  setDefaultPrinter: (name: string) => Promise<boolean>;

  queue: BackendJob[];
  isLoadingQueue: boolean;
  loadQueue: () => Promise<void>;
  cancelJob: (id: string) => Promise<boolean>;
  pauseJob: (id: string) => Promise<boolean>;
  prioritizeJob: (id: string) => Promise<boolean>;

  metrics: BackendMetrics | null;
  loadMetrics: () => Promise<void>;

  isDetecting: boolean;
  detectedDevices: { uri: string; makeModel: string }[];
  detectLegacyPrinter: () => Promise<void>;

  pricingConfig: PricingConfig | null;
  isLoadingPricing: boolean;
  loadPricingConfig: () => Promise<void>;
  updatePricingConfig: (config: Partial<PricingConfig>) => Promise<boolean>;

  handleSSEEvent: (event: SSEEvent) => void;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  isAuthenticated: false,
  authenticate: async (pin: string) => {
    try {
      const res = await apiClient.post<{ success: boolean; token: string }>('/auth/login', { pin });
      if (res.success && res.token) {
        localStorage.setItem('auth_token', res.token);
        set({ isAuthenticated: true });
        return true;
      }
    } catch (e) {
      console.error('Authentication failed:', e);
    }
    return false;
  },
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      console.error('Logout request failed:', e);
    } finally {
      localStorage.removeItem('auth_token');
      set({ isAuthenticated: false });
    }
  },
  checkAuth: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      set({ isAuthenticated: false });
      return false;
    }
    try {
      await apiClient.get('/auth/verify');
      set({ isAuthenticated: true });
      return true;
    } catch (e) {
      localStorage.removeItem('auth_token');
      set({ isAuthenticated: false });
      return false;
    }
  },
  
  isSetupMode: false,
  checkSetupMode: async () => {
    try {
      const res = await apiClient.get<{ isSetupMode: boolean }>('/wifi/setup-mode');
      set({ isSetupMode: res.isSetupMode });
    } catch (e) {
      console.error('Failed to check setup mode:', e);
    }
  },

  printers: [],
  isLoadingPrinters: false,
  loadPrinters: async () => {
    set({ isLoadingPrinters: true });
    try {
      const printers = await api.fetchPrinters();
      set({ printers, isLoadingPrinters: false });
    } catch(e) { 
      console.error(e);
      set({ isLoadingPrinters: false });
    }
  },
  setDefaultPrinter: async (name: string) => {
      try {
          const res = await api.setDefaultPrinter(name);
          if (res.success) {
              const printers = await api.fetchPrinters(); // refresh
              set({ printers });
              return true;
          }
      } catch(e) { console.error(e) }
      return false;
  },

  queue: [],
  isLoadingQueue: false,
  loadQueue: async () => {
    set({ isLoadingQueue: true });
    try {
      const queue = await api.fetchPrintQueue();
      set({ queue, isLoadingQueue: false });
    } catch(e) { 
      console.error(e);
      set({ isLoadingQueue: false });
    }
  },
  cancelJob: async (id: string) => {
    try {
      const res = await api.cancelJob(id);
      if (res.success) {
        set((state) => ({ queue: state.queue.filter(q => q.id !== id) }));
        return true;
      }
    } catch(e) { console.error(e) }
    return false;
  },
  pauseJob: async (id: string) => {
    try {
        const res = await api.pauseJob(id);
        return res.success;
    } catch(e) { console.error(e) }
    return false;
  },
  prioritizeJob: async (id: string) => {
    try {
        const res = await api.prioritizeJob(id);
        if (res.success) {
            const queue = await api.fetchPrintQueue();
            set({ queue });
            return true;
        }
    } catch(e) { console.error(e) }
    return false;
  },

  metrics: null,
  loadMetrics: async () => {
    try {
      const metrics = await api.fetchDashboardMetrics();
      set({ metrics });
    } catch(e) { console.error(e) }
  },

  isDetecting: false,
  detectedDevices: [],
  detectLegacyPrinter: async () => {
    set({ isDetecting: true, detectedDevices: [] });
    try {
      const res = await api.detectLegacyPrinter();
      if (res.success && res.devices) {
        set({ isDetecting: false, detectedDevices: res.devices });
      } else {
        set({ isDetecting: false });
      }
    } catch(e) {
      set({ isDetecting: false });
    }
  },

  pricingConfig: null,
  isLoadingPricing: false,
  loadPricingConfig: async () => {
    set({ isLoadingPricing: true });
    try {
      const config = await api.fetchPricingConfig();
      set({ pricingConfig: config, isLoadingPricing: false });
    } catch(e) { 
      console.error(e);
      set({ isLoadingPricing: false });
    }
  },
  updatePricingConfig: async (config: Partial<PricingConfig>) => {
    try {
      const res = await api.updatePricingConfig(config);
      if (res.success) {
          const newConfig = await api.fetchPricingConfig();
          set({ pricingConfig: newConfig });
          return true;
      }
    } catch(e) { console.error(e) }
    return false;
  },

  handleSSEEvent: (event) => {
    const state = get();
    switch (event.type) {
      case 'QUEUE_UPDATE':
      case 'JOB_STATUS':
      case 'JOB_CREATED':
      case 'JOB_FAILED':
        state.loadQueue();
        break;
      case 'PRINTER_DISCOVERED':
      case 'PRINTER_STATUS':
        state.loadPrinters();
        break;
      case 'METRICS_UPDATE':
        if (event.metrics) {
          set({ metrics: event.metrics });
        }
        break;
    }
  }
}));
