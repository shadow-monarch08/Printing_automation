// src/stores/useAdminStore.ts
import { create } from 'zustand';
import { api } from '../services/api';
import { apiClient } from '../services/apiClient';
import type { BackendPrinter, BackendJob, BackendMetrics, PricingConfig, WebSocketEvent, MetricSnapshot } from '../types';

export interface AdminState {
  isAuthenticated: boolean;
  authenticate: (pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  
  isSetupMode: boolean;
  isOnboarded: boolean;
  shopName: string;
  checkSetupMode: () => Promise<void>;
  updateShopName: (name: string) => Promise<boolean>;

  printers: BackendPrinter[];
  isLoadingPrinters: boolean;
  loadPrinters: () => Promise<void>;
  setDefaultPrinter: (name: string) => Promise<boolean>;
  updatePrinterAlias: (name: string, alias: string) => Promise<boolean>;
  updatePrinterCapabilities: (name: string, capabilities: string[], type?: string) => Promise<boolean>;
  deletePrinter: (name: string) => Promise<boolean>;
  deleteAllPrinters: () => Promise<boolean>;

  queue: BackendJob[];
  isLoadingQueue: boolean;
  isQueuePaused: boolean;
  loadQueue: () => Promise<void>;
  checkQueueStatus: () => Promise<void>;
  cancelJob: (id: string) => Promise<boolean>;
  pauseJob: (id: string) => Promise<boolean>;
  resumeJob: (id: string) => Promise<boolean>;
  prioritizeJob: (id: string) => Promise<boolean>;
  pauseGlobalQueue: () => Promise<boolean>;
  resumeGlobalQueue: () => Promise<boolean>;
  emergencyStop: () => Promise<boolean>;

  metrics: BackendMetrics | null;
  metricsHistory: MetricSnapshot[];
  loadMetrics: () => Promise<void>;
  loadMetricsHistory: () => Promise<void>;

  isDetecting: boolean;
  detectedDevices: { uri: string; rawModel: string }[];
  detectLegacyPrinter: () => Promise<void>;

  pricingConfig: PricingConfig | null;
  isLoadingPricing: boolean;
  loadPricingConfig: () => Promise<void>;
  updatePricingConfig: (config: Partial<PricingConfig>) => Promise<boolean>;

  handleWebSocketEvent: (event: WebSocketEvent) => void;
  forceRefreshPrinter: (printerName: string) => Promise<boolean>;
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
  isOnboarded: true,
  shopName: 'Modern Press',
  checkSetupMode: async () => {
    try {
      const res = await api.getSetupStatus();
      const shopName = res.shopName || 'Modern Press';
      set({ isSetupMode: res.isSetupMode, isOnboarded: res.isOnboarded, shopName });
      document.title = `${shopName} — Kiosk Terminal`;
    } catch (e) {
      console.error('Failed to check setup mode:', e);
    }
  },
  updateShopName: async (name: string) => {
    try {
      const res = await apiClient.post<{ success: boolean; config: any }>('/config/system', { shopName: name });
      if (res.success && res.config?.shopName) {
        const shopName = res.config.shopName;
        set({ shopName });
        document.title = `${shopName} — Kiosk Terminal`;
        return true;
      }
    } catch (e) {
      console.error('Failed to update shop name:', e);
    }
    return false;
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
        set((state) => ({
          printers: state.printers.map(p => ({ ...p, isDefault: p.name === name }))
        }));
        return true;
      }
      return false;
    } catch(e) {
      console.error(e);
      throw e;
    }
  },
  updatePrinterAlias: async (name: string, alias: string) => {
    try {
      const res = await api.updateAlias(name, alias);
      if (res.success) {
        get().loadPrinters(); // Refresh the printer list to show the new alias
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updatePrinterCapabilities: async (name: string, capabilities: string[], type?: string) => {
    try {
      const res = await api.updateCapabilities(name, capabilities, type);
      if (res.success) {
        get().loadPrinters(); // Refresh the printer list
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  deletePrinter: async (name: string) => {
    try {
      const res = await api.deletePrinter(name);
      if (res.success) {
        get().loadPrinters();
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  deleteAllPrinters: async () => {
    try {
      const res = await api.deleteAllPrinters();
      if (res.success) {
        get().loadPrinters();
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  queue: [],
  isLoadingQueue: false,
  isQueuePaused: false,
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
  checkQueueStatus: async () => {
    try {
      const res = await api.getQueueStatus();
      if (res.success) {
        set({ isQueuePaused: res.isPaused });
      }
    } catch (e) {
      console.error(e);
    }
  },
  cancelJob: async (id: string) => {
    try {
      const res = await api.cancelJob(id);
      if (res.success) {
        set((state) => ({ queue: state.queue.filter(q => q.id !== id) }));
        return true;
      }
    } catch(e) { 
      console.error(e); 
      throw e; 
    }
    return false;
  },
  pauseJob: async (id: string) => {
    try {
        const res = await api.pauseJob(id);
        return res.success;
    } catch(e) { 
      console.error(e); 
      throw e; 
    }
    return false;
  },
  resumeJob: async (id: string) => {
    try {
        const res = await api.resumeJob(id);
        return res.success;
    } catch(e) { 
      console.error(e); 
      throw e; 
    }
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
    } catch(e) { 
      console.error(e); 
      throw e; 
    }
    return false;
  },
  pauseGlobalQueue: async () => {
    try {
      const res = await api.pauseGlobalQueue();
      if (res.success) {
        set({ isQueuePaused: true });
        return true;
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
    return false;
  },
  resumeGlobalQueue: async () => {
    try {
      const res = await api.resumeGlobalQueue();
      if (res.success) {
        set({ isQueuePaused: false });
        return true;
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
    return false;
  },
  emergencyStop: async () => {
    try {
      const res = await api.emergencyStop();
      if (res.success) {
        get().loadQueue();
        return true;
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
    return false;
  },

  metrics: null,
  metricsHistory: [],
  loadMetrics: async () => {
    try {
      const metrics = await api.fetchDashboardMetrics();
      set({ metrics });
    } catch(e) { console.error(e) }
  },
  loadMetricsHistory: async () => {
    try {
      const history = await api.fetchMetricsHistory();
      set({ metricsHistory: history });
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
    } catch(e) { 
      console.error(e); 
      throw e; 
    }
    return false;
  },

  handleWebSocketEvent: (event) => {
    const state = get();
    switch (event.type) {
      // --- Phase 1: Silent Delta Merging ---
      case 'job_queued':
        set((state) => {
          const { type, ...jobData } = event as any;
          const formattedJob: BackendJob = {
            id: jobData.id || `JOB_${Date.now()}`,
            cupsJobId: jobData.cupsJobId || null,
            filename: jobData.filename || 'Document.pdf',
            owner: jobData.owner || 'Guest User',
            pages: jobData.pages || 1,
            copies: jobData.copies || 1,
            colorMode: jobData.colorMode === 'color' ? 'color' : 'grayscale',
            duplex: jobData.duplex === 'double' ? 'double' : 'single',
            orientation: jobData.orientation === 'landscape' ? 'landscape' : 'portrait',
            targetPrinter: jobData.targetPrinter || jobData.printer || 'Thermal POS Printer',
            status: (jobData.status as any) || 'queued',
            cost: jobData.cost || 0,
            submittedAt: jobData.submittedAt || jobData.createdAt || new Date().toISOString(),
            completedAt: jobData.completedAt || null,
            error: jobData.error || null
          };
          const exists = state.queue.some(q => q.id === formattedJob.id);
          const updatedQueue: BackendJob[] = exists 
            ? state.queue.map(q => q.id === formattedJob.id ? { ...q, ...formattedJob } : q)
            : [formattedJob, ...state.queue];

          const currentMetrics = state.metrics || {
            waiting: 0,
            active: 0,
            delayed: 0,
            completed: 0,
            failed: 0,
            cpuLoad: 12,
            memoryUsed: 2048,
            memoryTotal: 8192,
            diskPercent: 25,
            uptime: '1h 0m 0s',
            uptimeSeconds: 3600,
            totalJobsToday: 0,
            revenue: 0,
            activePrinters: 1,
            totalPrinters: 1
          };

          const waitingVal = currentMetrics.waiting ?? 0;
          const totalTodayVal = currentMetrics.totalJobsToday ?? 0;
          const revenueVal = currentMetrics.revenue ?? 0;

          const newMetrics = {
            ...currentMetrics,
            waiting: exists ? waitingVal : waitingVal + 1,
            totalJobsToday: exists ? totalTodayVal : totalTodayVal + 1,
            revenue: exists ? revenueVal : revenueVal + (formattedJob.cost || 0)
          };

          return { queue: updatedQueue, metrics: newMetrics };
        });
        break;
      case 'job_active':
      case 'job_completed':
        set((state) => {
          const updatedQueue: BackendJob[] = state.queue.map(job => 
            job.id === event.id 
              ? { 
                  ...job, 
                  ...((event as any).data || {}), 
                  status: (event.type === 'job_active' ? 'printing' : 'done') as BackendJob['status'] 
                } 
              : job
          );
          let newMetrics = state.metrics;
          if (state.metrics) {
            const activeCount = updatedQueue.filter(j => j.status === 'printing').length;
            const waitingCount = updatedQueue.filter(j => j.status === 'queued' || j.status === 'spooling').length;
            const completedCount = updatedQueue.filter(j => j.status === 'done').length;
            newMetrics = {
              ...state.metrics,
              active: activeCount,
              waiting: waitingCount,
              completed: completedCount
            };
          }
          return { queue: updatedQueue, metrics: newMetrics };
        });
        break;
      case 'job_failed':
        set((state) => {
          const updatedQueue: BackendJob[] = state.queue.map(job => 
            job.id === event.id 
              ? { ...job, status: 'failed' as BackendJob['status'], error: (event as any).reason || null } 
              : job
          );
          let newMetrics = state.metrics;
          if (state.metrics) {
            const failedCount = updatedQueue.filter(j => j.status === 'failed').length;
            const waitingCount = updatedQueue.filter(j => j.status === 'queued' || j.status === 'spooling').length;
            newMetrics = {
              ...state.metrics,
              failed: failedCount,
              waiting: waitingCount
            };
          }
          return { queue: updatedQueue, metrics: newMetrics };
        });
        break;
      case 'printer_state_changed':
        set((state) => ({
          printers: state.printers.map(p => 
            p.name === (event as any).printer 
              ? { ...p, status: (event as any).state === 'flagged' ? 'error' : (event as any).state } 
              : p
          )
        }));
        break;
      case 'printer_quarantined':
        set((state) => ({
          printers: state.printers.map(p => 
            p.name === (event as any).printer 
              ? { ...p, status: 'error', description: (event as any).message || p.description } 
              : p
          )
        }));
        break;
      case 'queue_paused':
        set({ isQueuePaused: true });
        break;
      case 'queue_resumed':
        set({ isQueuePaused: false });
        break;

      // --- Phase 2: Full HTTP Reloads ---
      case 'printer_discovery':
        state.loadPrinters();
        break;
      case 'system_critical':
        state.checkQueueStatus();
        state.loadMetrics();
        state.loadQueue();
        break;
      case 'connected':
        state.loadPrinters();
        state.loadQueue();
        state.loadMetrics();
        break;
    }
  },

  forceRefreshPrinter: async (printerName: string) => {
    try {
      const res = await api.forceRefreshPrinter(printerName);
      if (res.success) {
        get().loadPrinters(); // Refresh the list
        return true;
      }
    } catch(e) {
      console.error(e);
      throw e;
    }
    return false;
  }
}));
