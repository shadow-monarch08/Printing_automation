// src/stores/useUserPrintStore.ts
import { create } from 'zustand';
import { api } from '../services/api';
import type { SSEEvent } from '../types';

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

  setFile: (file: File) => Promise<void>;
  updateConfig: (partial: Partial<Pick<UserPrintState, 'copies' | 'colorMode' | 'duplex' | 'orientation'>>) => void;
  generateQuote: () => Promise<void>;
  submitJob: () => Promise<void>;
  goToStep: (step: 1 | 2 | 3 | 4) => void;
  handleSSEEvent: (event: SSEEvent) => void;
  reset: () => void;
}

export const useUserPrintStore = create<UserPrintState>((set, get) => ({
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
        quote: state.quote
      });
      
      set({
        jobId: result.jobId,
        jobStatus: 'queued',
        jobsAhead: 0, // In full integration, the backend could send this in the queue payload
        currentStep: 4
      });
      // SSE will handle further status transitions automatically
    } catch (e) {
      console.error(e);
    }
  },

  goToStep: (step) => set({ currentStep: step }),

  handleSSEEvent: (event) => {
     const { jobId } = get();
     if (!jobId) return;

     if (event.type === 'JOB_STATUS' && event.jobId === jobId) {
        set({ jobStatus: event.status as any });
     } else if (event.type === 'JOB_FAILED' && event.jobId === jobId) {
        set({ jobStatus: 'failed' });
     }
  },

  reset: () => {
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
}));
