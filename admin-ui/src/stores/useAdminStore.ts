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

  printers: BackendPrinter[];
  loadPrinters: () => Promise<void>;
  setDefaultPrinter: (name: string) => Promise<boolean>;

  queue: BackendJob[];
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

  printers: [],
  loadPrinters: async () => {
    try {
      const printers = await api.fetchPrinters();
      set({ printers });
    } catch(e) { console.error(e) }
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
  loadQueue: async () => {
    try {
      const queue = await api.fetchPrintQueue();
      set({ queue });
    } catch(e) { console.error(e) }
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
  loadPricingConfig: async () => {
    try {
      const config = await api.fetchPricingConfig();
      set({ pricingConfig: config });
    } catch(e) { console.error(e) }
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
