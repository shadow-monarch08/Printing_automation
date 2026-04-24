// src/stores/useAdminStore.ts
import { create } from 'zustand';
import { api } from '../services/api';
import type { Printer, QueueJob, DashboardMetrics, PricingConfig } from '../data/mockData';

interface AdminState {
  isAuthenticated: boolean;
  authenticate: (pin: string) => boolean;
  logout: () => void;

  printers: Printer[];
  loadPrinters: () => Promise<void>;
  setDefaultPrinter: (name: string) => Promise<boolean>;

  queue: QueueJob[];
  loadQueue: () => Promise<void>;
  cancelJob: (id: string) => Promise<boolean>;
  pauseJob: (id: string) => Promise<boolean>;
  prioritizeJob: (id: string) => Promise<boolean>;

  metrics: DashboardMetrics | null;
  loadMetrics: () => Promise<void>;

  isDetecting: boolean;
  detectedUri: string | null;
  detectLegacyPrinter: () => Promise<string | null>;

  pricingConfig: PricingConfig | null;
  loadPricingConfig: () => Promise<void>;
  updatePricingConfig: (config: Partial<PricingConfig>) => Promise<boolean>;
}

export const useAdminStore = create<AdminState>((set) => ({
  isAuthenticated: false,
  authenticate: (pin: string) => {
    if (pin === '1234') {
      set({ isAuthenticated: true });
      return true;
    }
    return false;
  },
  logout: () => set({ isAuthenticated: false }),

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
  detectedUri: null,
  detectLegacyPrinter: async () => {
    set({ isDetecting: true, detectedUri: null });
    try {
      const res = await api.detectLegacyPrinter();
      set({ isDetecting: false, detectedUri: res.uri });
      return res.uri;
    } catch(e) {
      set({ isDetecting: false });
      return null;
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
  }
}));
