// src/stores/useAdminStore.ts
import { create } from 'zustand';
import { api } from '../services/api';
import { apiClient } from '../services/apiClient';
import type { BackendPrinter, BackendJob, BackendMetrics, PricingConfig, MetricSnapshot } from '../types';
import { adminEventBus } from '../services/realtime/eventEmitter';
import { toast } from '../context/ToastContext';

export interface AdminState {
  isAuthenticated: boolean;
  authenticate: (pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  
  provisioningState: 'FIRST_BOOT' | 'RECOVERY' | 'READY';
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

  handleWebSocketEvent?: (event: any) => void;
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
  
  provisioningState: 'FIRST_BOOT',
  isOnboarded: false,
  shopName: 'Modern Press',
  checkSetupMode: async () => {
    try {
      const res = await api.getSetupStatus();
      const shopName = res.shopName || 'Modern Press';
      const provisioningState = res.provisioningState || (res.isOnboarded ? 'READY' : 'FIRST_BOOT');
      set({ provisioningState, isOnboarded: res.isOnboarded, shopName });
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

/**
 * -------------------------------------------------------------
 * Centralized Admin Realtime Event Subscriptions
 * Decoupled from transport; enforces Layer 1/2/3 deduplication
 * and multi-device synchronization.
 * -------------------------------------------------------------
 */

// 1. Connection / Reconnection: Reconcile all state with SQLite
adminEventBus.on('connected', () => {
  const store = useAdminStore.getState();
  store.loadPrinters();
  store.loadQueue();
  store.loadMetrics();
  store.checkQueueStatus();
});

// 2. Customer Job Queued (Mirrored to Live Queue Table)
adminEventBus.on('customer:job:queued', (payload) => {
  const formattedJob: BackendJob = {
    id: payload.id,
    cupsJobId: null,
    filename: payload.filename,
    owner: payload.owner || 'Customer',
    pages: payload.pageCount || 1,
    copies: payload.copies || 1,
    colorMode: payload.colorMode === 'color' ? 'color' : 'grayscale',
    duplex: payload.duplex ? 'double' : 'single',
    orientation: 'portrait',
    targetPrinter: payload.targetPrinter || payload.printer || 'Thermal POS Printer',
    status: 'queued',
    cost: payload.cost || 0,
    submittedAt: payload.createdAt || new Date().toISOString(),
    completedAt: null,
    error: null,
  };

  useAdminStore.setState((state) => {
    const exists = state.queue.some((q) => q.id === formattedJob.id);
    const updatedQueue = exists
      ? state.queue.map((q) => (q.id === formattedJob.id ? { ...q, ...formattedJob } : q))
      : [formattedJob, ...state.queue];

    const currentMetrics = state.metrics;
    let newMetrics = currentMetrics;
    if (currentMetrics) {
      newMetrics = {
        ...currentMetrics,
        waiting: exists ? currentMetrics.waiting : (currentMetrics.waiting || 0) + 1,
        totalJobsToday: exists ? currentMetrics.totalJobsToday : (currentMetrics.totalJobsToday || 0) + 1,
        revenue: exists ? currentMetrics.revenue : (currentMetrics.revenue || 0) + (formattedJob.cost || 0),
      };
    }
    return { queue: updatedQueue, metrics: newMetrics };
  });
});

// 3. Customer Job Active (Mirrored to Live Queue Table)
adminEventBus.on('customer:job:active', (payload) => {
  const activeStatus = payload.data?.status === 'printing' ? 'printing' : 'spooling';

  useAdminStore.setState((state) => {
    const updatedQueue = state.queue.map((job) =>
      job.id === payload.id
        ? {
            ...job,
            status: activeStatus as BackendJob['status'],
            targetPrinter: payload.data?.executedByPrinter || job.targetPrinter,
          }
        : job
    );

    let newMetrics = state.metrics;
    if (state.metrics) {
      const activeCount = updatedQueue.filter((j) => j.status === 'printing').length;
      const waitingCount = updatedQueue.filter((j) => j.status === 'queued' || j.status === 'spooling').length;
      newMetrics = {
        ...state.metrics,
        active: activeCount,
        waiting: waitingCount,
      };
    }

    return { queue: updatedQueue, metrics: newMetrics };
  });
});

// 4. Customer Job Completed (Mirrored to Live Queue Table)
adminEventBus.on('customer:job:completed', (payload) => {
  useAdminStore.setState((state) => {
    const updatedQueue = state.queue.map((job) =>
      job.id === payload.id
        ? {
            ...job,
            status: 'done' as BackendJob['status'],
            completedAt: payload.data?.completedAt || new Date().toISOString(),
          }
        : job
    );

    let newMetrics = state.metrics;
    if (state.metrics) {
      const activeCount = updatedQueue.filter((j) => j.status === 'printing').length;
      const completedCount = updatedQueue.filter((j) => j.status === 'done').length;
      newMetrics = {
        ...state.metrics,
        active: activeCount,
        completed: completedCount,
      };
    }

    return { queue: updatedQueue, metrics: newMetrics };
  });
});

// 5. Customer Job Failed (Mirrored to Live Queue Table)
adminEventBus.on('customer:job:failed', (payload) => {
  useAdminStore.setState((state) => {
    const updatedQueue = state.queue.map((job) =>
      job.id === payload.id
        ? {
            ...job,
            status: 'failed' as BackendJob['status'],
            error: payload.reason || null,
          }
        : job
    );

    let newMetrics = state.metrics;
    if (state.metrics) {
      const failedCount = updatedQueue.filter((j) => j.status === 'failed').length;
      newMetrics = {
        ...state.metrics,
        failed: failedCount,
      };
    }

    return { queue: updatedQueue, metrics: newMetrics };
  });

  // Layer 3 Keyed Toast
  toast.error('Print Job Failed', `Job "${payload.id.substring(0, 8)}" failed: ${payload.reason}`, {
    id: `admin_job_failed_${payload.id}`,
  });
});

// 6. Admin Fleet State
adminEventBus.on('admin:fleet:state', (payload) => {
  useAdminStore.setState((state) => ({
    printers: state.printers.map((p) =>
      p.name === payload.printer
        ? {
            ...p,
            status: payload.state === 'error' || payload.state === 'quarantined' ? 'error' : payload.state,
          }
        : p
    ),
  }));
});

// 7. Admin Printer Quarantined
adminEventBus.on('admin:printer:quarantined', (payload) => {
  useAdminStore.setState((state) => ({
    printers: state.printers.map((p) =>
      p.name === payload.printer
        ? {
            ...p,
            status: 'error',
            description: payload.reason || p.description,
          }
        : p
    ),
  }));

  toast.error('Printer Quarantined', `Printer "${payload.printer}" quarantined: ${payload.reason}`, {
    id: `admin_quarantine_${payload.printer}`,
  });
});

// 8. Admin Queue Sync (Multi-Device Live Sync)
adminEventBus.on('admin:queue:sync', (payload) => {
  const store = useAdminStore.getState();
  store.loadQueue();
  store.checkQueueStatus();
  toast.info('Queue Synchronized', `Queue updated by operator (${payload.action})`, {
    id: 'admin_queue_sync',
  });
});

// 9. Admin Hardware Discovery
adminEventBus.on('admin:hardware:discovery', (payload) => {
  useAdminStore.getState().loadPrinters();
  toast.info('Hardware Discovery', `New device detected: ${payload.id || payload.deviceType || 'USB Printer'}`, {
    id: `admin_hw_${payload.id || 'new'}`,
  });
});

// 10. Admin Metrics Critical
adminEventBus.on('admin:metrics:critical', (payload) => {
  useAdminStore.getState().loadMetrics();
  toast.warning('System Resource Alert', payload.message || 'Critical threshold exceeded.', {
    id: 'admin_metric_alert',
  });
});

// 11. System Queue Paused
adminEventBus.on('system:queue:paused', (payload) => {
  useAdminStore.setState({ isQueuePaused: true });
  toast.warning('Queue Paused', payload.message || 'Global print queue paused.', {
    id: 'sys_queue_paused',
  });
});

// 12. System Queue Resumed
adminEventBus.on('system:queue:resumed', () => {
  useAdminStore.setState({ isQueuePaused: false });
  toast.success('Queue Resumed', 'Global print queue resumed.', {
    id: 'sys_queue_resumed',
  });
});

// 13. System Broadcast Alert
adminEventBus.on('system:broadcast:alert', (payload) => {
  if (payload.level === 'CRITICAL') {
    toast.error(payload.title || 'System Alert', payload.message);
  } else if (payload.level === 'WARN') {
    toast.warning(payload.title || 'Notice', payload.message);
  } else {
    toast.info(payload.title || 'Notice', payload.message);
  }
});
