// src/stores/useUserPrintStore.ts
import { create } from 'zustand';
import { api } from '../services/api';
import type { SSEEvent, BackendJob } from '../types';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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

  setFile: (file: File) => Promise<void>;
  updateConfig: (partial: Partial<Pick<UserPrintState, 'copies' | 'colorMode' | 'duplex' | 'orientation'>>) => void;
  generateQuote: () => Promise<void>;
  submitJob: () => Promise<void>;
  goToStep: (step: 1 | 2 | 3 | 4) => void;
  handleSSEEvent: (event: SSEEvent) => void;
  reset: () => void;
  fetchKioskStatus: () => Promise<void>;
  fetchJobs: () => Promise<void>;
}

import { persist, createJSONStorage } from 'zustand/middleware';

let inactivityTimer: number | null = null;

export const useUserPrintStore = create<UserPrintState>()(
  persist(
    (set, get) => ({
      sessionId: generateUUID(),
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

      fetchKioskStatus: async () => {
        try {
          const status = await api.fetchKioskStatus();
          set({
            isAcceptingJobs: status.isAcceptingJobs,
            fleetCapabilities: status.fleetCapabilities
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
          console.error(e);
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
            currentStep: 2
          });
        } catch (e) {
          console.error('Failed to get page count', e);
          // Fallback
          set({
            file,
            filePreview: {
              name: file.name,
              size: file.size,
              type: file.type || 'unknown',
              pages: 1,
            },
            currentStep: 2
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
            duplex: state.duplex
          });
          set({ quote: quoteDetails, currentStep: 3 });
        } catch (e) {
          console.error(e);
        }
      },

      submitJob: async () => {
        const state = get();
        try {
          const result = await api.submitPrintJob({
            file: state.file,
            quote: state.quote,
            sessionId: state.sessionId
          });
          
          set({
            jobId: result.jobId,
            jobStatus: 'queued',
            jobsAhead: 0, // In full integration, the backend could send this in the queue payload
            currentStep: 4
          });
          get().fetchJobs();
          // SSE will handle further status transitions automatically
        } catch (e) {
          console.error(e);
        }
      },

      goToStep: (step) => set({ currentStep: step }),

      handleSSEEvent: (event) => {
        const { jobId, reset, fetchJobs } = get();
        
        // --- Phase 1: Silent Delta Merging ---
        if (event.type === 'job_queued') {
          set((state) => {
            const { type, ...jobData } = event as any;
            return { jobs: [jobData, ...state.jobs] };
          });
        } else if (event.type === 'job_active' || event.type === 'job_completed') {
          set((state) => ({
            jobs: state.jobs.map(job => 
              job.id === event.id 
                ? { ...job, ...((event as any).data || {}), status: event.type === 'job_active' ? 'printing' : 'done' } 
                : job
            )
          }));
        } else if (event.type === 'job_failed') {
          set((state) => ({
            jobs: state.jobs.map(job => 
              job.id === event.id 
                ? { ...job, status: 'failed', error: (event as any).reason || null } 
                : job
            )
          }));
        }
        
        if (event.type === 'queue_paused') {
          set({ isAcceptingJobs: false });
        } else if (event.type === 'queue_resumed') {
          get().fetchKioskStatus();
        }

        // --- Phase 2: Full HTTP Reloads ---
        if (event.type === 'connected') {
          fetchJobs();
          get().fetchKioskStatus();
        }

        if (!jobId) return;
        
        // Backend event shapes (from events.controller.ts + printMaster.worker.ts):
        //   job_active:    { type: "job_active",    id: "...", data: { ... } }
        //   job_completed: { type: "job_completed", id: "...", data: { ... } }
        //   job_failed:    { type: "job_failed",    id: "...", reason: "..." }
        
        if (event.type === 'job_active' && event.id === jobId) {
          set({ jobStatus: 'printing' });
        } else if (event.type === 'job_completed' && event.id === jobId) {
          set({ jobStatus: 'done' });
          if (inactivityTimer) window.clearTimeout(inactivityTimer);
          inactivityTimer = window.setTimeout(reset, 60000);
        } else if (event.type === 'job_failed' && event.id === jobId) {
          set({ jobStatus: 'failed' });
          if (inactivityTimer) window.clearTimeout(inactivityTimer);
          inactivityTimer = window.setTimeout(reset, 60000);
        }
      },

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
        });
      }
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
