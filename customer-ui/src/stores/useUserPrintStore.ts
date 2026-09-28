import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '../services/api';
import { customerEventBus } from '../services/realtime/eventEmitter';
import { realtimeClient } from '../services/realtime/realtimeClient';
import { toast } from '../context/ToastContext';
import { soundFx } from '../utils/sound';
import type { BackendJob } from '../types';

interface FilePreview {
  name: string;
  size: number;
  type: string;
  pages: number;
}

interface Quote {
  totalPages: number;
  costPerPage: number;
  totalCost: number;
  eta: string;
}

interface UserPrintState {
  sessionId: string;
  currentStep: 1 | 2 | 3 | 4;

  file: File | null;
  filePreview: FilePreview | null;

  copies: number;
  colorMode: 'color' | 'grayscale';
  duplex: 'single' | 'double';
  orientation: 'portrait' | 'landscape';

  quote: Quote | null;

  jobId: string | null;
  jobStatus: 'queued' | 'spooling' | 'printing' | 'done' | 'failed' | null;
  jobsAhead: number;
  jobs: BackendJob[];

  isAcceptingJobs: boolean | null;
  fleetCapabilities: { color: boolean; duplex: boolean } | null;

  initSession: () => Promise<string>;
  setFile: (file: File) => Promise<void>;
  updateConfig: (partial: Partial<Pick<UserPrintState, 'copies' | 'colorMode' | 'duplex' | 'orientation'>>) => void;
  generateQuote: () => Promise<void>;
  submitJob: () => Promise<void>;
  goToStep: (step: 1 | 2 | 3 | 4) => void;
  reset: () => void;
  fetchKioskStatus: () => Promise<void>;
  fetchJobs: () => Promise<void>;
}

let inactivityTimer: number | null = null;

export const useUserPrintStore = create<UserPrintState>()(
  persist(
    (set, get) => ({
      sessionId: '',
      currentStep: 1,

      file: null,
      filePreview: null,

      copies: 1,
      colorMode: 'grayscale',
      duplex: 'single',
      orientation: 'portrait',

      quote: null,

      jobId: null,
      jobStatus: null,
      jobsAhead: 0,
      jobs: [],

      isAcceptingJobs: null,
      fleetCapabilities: null,

      initSession: async () => {
        try {
          const res = await api.initSession();
          if (res?.sessionId) {
            set({ sessionId: res.sessionId });
            // Dynamic subscription to ensure socket is bound to this session
            realtimeClient.subscribeSession(res.sessionId);
            return res.sessionId;
          }
        } catch (e) {
          console.error('[Session] Failed to initialize server session:', e);
        }
        return get().sessionId;
      },

      fetchKioskStatus: async () => {
        try {
          const status = await api.fetchKioskStatus();
          set({
            isAcceptingJobs: status.isAcceptingJobs,
            fleetCapabilities: status.fleetCapabilities,
          });
        } catch (e) {
          console.error('Failed to fetch kiosk status', e);
          set({ isAcceptingJobs: false, fleetCapabilities: null });
        }
      },

      fetchJobs: async () => {
        const state = get();
        try {
          const fetchedJobs = await api.fetchPrintQueue(state.sessionId);
          set({ jobs: fetchedJobs });
        } catch (e) {
          console.error('[Jobs] Failed to fetch print queue:', e);
        }
      },

      setFile: async (file) => {
        try {
          const pages = await api.getPageCount(file);
          set({
            file,
            filePreview: {
              name: file.name,
              size: file.size,
              type: file.type || 'unknown',
              pages: pages,
            },
            currentStep: 2,
          });
        } catch (e) {
          console.error('Failed to get page count, fallback to 1:', e);
          set({
            file,
            filePreview: {
              name: file.name,
              size: file.size,
              type: file.type || 'unknown',
              pages: 1,
            },
            currentStep: 2,
          });
        }
      },

      updateConfig: (partial) => {
        set((state) => ({ ...state, ...partial, quote: null }));
      },

      generateQuote: async () => {
        const state = get();
        if (!state.filePreview) return;

        try {
          const quoteDetails = await api.calculateQuote({
            pages: state.filePreview.pages,
            copies: state.copies,
            colorMode: state.colorMode,
            duplex: state.duplex,
          });
          set({ quote: quoteDetails, currentStep: 3 });
        } catch (e) {
          console.error('Failed to calculate quote:', e);
        }
      },

      submitJob: async () => {
        let state = get();
        if (!state.sessionId) {
          await get().initSession();
          state = get();
        }
        try {
          const result = await api.submitPrintJob({
            file: state.file,
            quote: state.quote,
            sessionId: state.sessionId,
            pages: state.filePreview?.pages || state.quote?.totalPages || 1,
            copies: state.copies,
            colorMode: state.colorMode,
            duplex: state.duplex,
            orientation: state.orientation,
          });

          const jobId = result.jobId || `JOB_${Date.now()}`;
          const newJobPayload = {
            id: jobId,
            filename: state.filePreview?.name || 'Document.pdf',
            owner: 'Guest User',
            targetPrinter: 'Thermal POS Printer',
            printer: 'Thermal POS Printer',
            pages: state.filePreview?.pages || 1,
            copies: state.copies,
            colorMode: state.colorMode,
            duplex: state.duplex,
            status: 'queued',
            cost: state.quote?.totalCost || 0,
            createdAt: new Date().toISOString(),
            progress: 0,
            sessionId: state.sessionId || undefined,
          };

          set((s) => ({
            jobId: jobId,
            jobStatus: 'queued',
            jobsAhead: 0,
            currentStep: 4,
            jobs: [newJobPayload as any, ...s.jobs.filter((j) => j.id !== jobId)],
          }));

          get().fetchJobs();
        } catch (e) {
          console.error('Failed to submit print job:', e);
        }
      },

      goToStep: (step) => set({ currentStep: step }),

      reset: () => {
        if (inactivityTimer) window.clearTimeout(inactivityTimer);
        inactivityTimer = null;
        set({
          currentStep: 1,
          file: null,
          filePreview: null,
          copies: 1,
          colorMode: 'grayscale',
          duplex: 'single',
          orientation: 'portrait',
          quote: null,
          jobId: null,
          jobStatus: null,
          jobs: [],
        });
        // Mint a pristine server session for the next customer cycle
        get().initSession();
      },
    }),
    {
      name: 'user-print-session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        jobId: state.jobId,
        jobStatus: state.jobStatus,
        currentStep: state.currentStep,
        filePreview: state.filePreview,
        quote: state.quote,
        copies: state.copies,
        colorMode: state.colorMode,
        duplex: state.duplex,
        orientation: state.orientation,
      }),
    }
  )
);

/**
 * -------------------------------------------------------------
 * Centralized Realtime Event Bus Subscriptions
 * Decoupled from transport; enforces Layer 2 shallow guards
 * and Layer 3 keyed toast deduplication.
 * -------------------------------------------------------------
 */

// 1. Connection / Reconnection: Reconcile state with SQLite
customerEventBus.on('connected', () => {
  const store = useUserPrintStore.getState();
  store.fetchJobs();
  store.fetchKioskStatus();
  if (store.sessionId) {
    realtimeClient.subscribeSession(store.sessionId);
  }
});

// 2. Job Queued: Silent delta insertion
customerEventBus.on('customer:job:queued', (payload) => {
  const formattedJob: BackendJob = {
    id: payload.id,
    cupsJobId: null,
    filename: payload.filename,
    owner: 'Customer',
    pages: payload.pageCount || 1,
    copies: payload.copies || 1,
    colorMode: payload.colorMode === 'color' ? 'color' : 'grayscale',
    duplex: payload.duplex ? 'double' : 'single',
    orientation: 'portrait',
    targetPrinter: 'Thermal POS Printer',
    status: 'queued',
    cost: payload.cost || 0,
    submittedAt: payload.createdAt || new Date().toISOString(),
    completedAt: null,
    error: null,
  };

  useUserPrintStore.setState((state) => {
    const exists = state.jobs.some((j) => j.id === formattedJob.id);
    return {
      jobs: exists
        ? state.jobs.map((j) => (j.id === formattedJob.id ? { ...j, ...formattedJob } : j))
        : [formattedJob, ...state.jobs],
      jobStatus: state.jobId === payload.id ? 'queued' : state.jobStatus,
    };
  });
});

// 3. Job Active: Silent progress update (No toast spam)
customerEventBus.on('customer:job:active', (payload) => {
  const activeStatus = payload.data?.status === 'printing' ? 'printing' : 'spooling';

  useUserPrintStore.setState((state) => {
    // Layer 2 Shallow Guard: only update if state or details actually changed
    const currentJob = state.jobs.find((j) => j.id === payload.id);
    if (currentJob && currentJob.status === activeStatus && state.jobStatus === activeStatus) {
      return state; // No-op
    }

    return {
      jobs: state.jobs.map((job) =>
        job.id === payload.id
          ? {
              ...job,
              status: activeStatus,
              targetPrinter: payload.data?.executedByPrinter || job.targetPrinter,
            }
          : job
      ),
      jobStatus: state.jobId === payload.id ? 'printing' : state.jobStatus,
    };
  });
});

// 4. Job Completed: Loud projection (Toast + Audio Chime + Reset Timer)
customerEventBus.on('customer:job:completed', (payload) => {
  const store = useUserPrintStore.getState();
  const filename = payload.data?.filename || 'Document';
  const printer = payload.data?.executedByPrinter || 'Printer Tray';

  useUserPrintStore.setState((state) => ({
    jobs: state.jobs.map((job) =>
      job.id === payload.id
        ? {
            ...job,
            status: 'done',
            completedAt: payload.data?.completedAt || new Date().toISOString(),
          }
        : job
    ),
    jobStatus: state.jobId === payload.id ? 'done' : state.jobStatus,
  }));

  if (store.jobId === payload.id) {
    if (inactivityTimer) window.clearTimeout(inactivityTimer);
    inactivityTimer = window.setTimeout(store.reset, 60000);

    // Layer 3 Keyed Toast Deduplication & Sound
    toast.success('Print Job Completed', `Your document "${filename}" has finished printing. Please collect it from ${printer}.`, {
      id: `job_done_${payload.id}`,
    });
    soundFx.playSuccess();
  }
});

// 5. Job Failed: Loud projection (Toast + Error Tone + Reset Timer)
customerEventBus.on('customer:job:failed', (payload) => {
  const store = useUserPrintStore.getState();
  const reason = payload.reason || 'Document could not be printed.';

  useUserPrintStore.setState((state) => ({
    jobs: state.jobs.map((job) =>
      job.id === payload.id
        ? {
            ...job,
            status: 'failed',
            error: reason,
          }
        : job
    ),
    jobStatus: state.jobId === payload.id ? 'failed' : state.jobStatus,
  }));

  if (store.jobId === payload.id) {
    if (inactivityTimer) window.clearTimeout(inactivityTimer);
    inactivityTimer = window.setTimeout(store.reset, 60000);

    // Layer 3 Keyed Toast Deduplication & Error Sound
    toast.error('Print Job Failed', reason, {
      id: `job_failed_${payload.id}`,
    });
    soundFx.playError();
  }
});

// 6. Quote Override: Loud discount toast
customerEventBus.on('customer:quote:override', (payload) => {
  useUserPrintStore.setState((state) => {
    if (state.quote) {
      return {
        quote: {
          ...state.quote,
          totalCost: payload.adjustedCost,
        },
      };
    }
    return state;
  });

  toast.info('Price Adjusted', `Special price applied: ₹${payload.adjustedCost}${payload.reason ? ` (${payload.reason})` : ''}`, {
    id: `quote_override_${payload.quoteId}`,
  });
});

// 7. System Queue Paused: Loud warning toast + Overlay lock
customerEventBus.on('system:queue:paused', (payload) => {
  // Layer 2 Shallow Guard
  if (useUserPrintStore.getState().isAcceptingJobs === false) return;

  useUserPrintStore.setState({ isAcceptingJobs: false });
  toast.warning('Queue Suspended', payload.message || 'Kiosk operations temporarily suspended by operator.', {
    id: 'sys_queue_paused',
  });
});

// 8. System Queue Resumed: Loud info toast + Status refresh
customerEventBus.on('system:queue:resumed', () => {
  useUserPrintStore.getState().fetchKioskStatus();
  toast.info('Queue Ready', 'Kiosk is ready to accept print jobs.', {
    id: 'sys_queue_resumed',
  });
});

// 9. System Broadcast Alert: Shop announcement toast
customerEventBus.on('system:broadcast:alert', (payload) => {
  if (payload.level === 'CRITICAL') {
    toast.error(payload.title || 'System Alert', payload.message);
  } else if (payload.level === 'WARN') {
    toast.warning(payload.title || 'Notice', payload.message);
  } else {
    toast.info(payload.title || 'Notice', payload.message);
  }
});
