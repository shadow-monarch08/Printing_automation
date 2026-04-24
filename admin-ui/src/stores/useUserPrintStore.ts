// src/stores/useUserPrintStore.ts
import { create } from 'zustand';
import { api } from '../services/api';

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

  setFile: (file: File) => void;
  updateConfig: (partial: Partial<Pick<UserPrintState, 'copies' | 'colorMode' | 'duplex' | 'orientation'>>) => void;
  generateQuote: () => Promise<void>;
  submitJob: () => Promise<void>;
  goToStep: (step: 1 | 2 | 3 | 4) => void;
  startTracking: () => void;
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

  setFile: (file) => {
    // mock page count based on size
    const mockPages = Math.max(1, Math.floor(file.size / (1024 * 50)));
    set({
      file,
      filePreview: {
        name: file.name,
        size: file.size,
        type: file.type || 'unknown',
        pages: mockPages,
      },
      currentStep: 2
    });
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
        file: state.filePreview,
        quote: state.quote
      });
      
      set({
        jobId: result.jobId,
        jobStatus: 'queued',
        jobsAhead: Math.floor(Math.random() * 3) + 1, // mock 1-3 jobs ahead
        currentStep: 4
      });
      
      get().startTracking();
      
    } catch (e) {
      console.error(e);
    }
  },

  goToStep: (step) => set({ currentStep: step }),

  startTracking: () => {
     let progress = 0;
     const interval = setInterval(() => {
         progress++;
         const currentStatus = get().jobStatus;
         if (currentStatus === 'done' || currentStatus === 'failed') {
             clearInterval(interval);
             return;
         }

         if (progress === 1) set({ jobStatus: 'spooling', jobsAhead: Math.max(0, get().jobsAhead - 1) });
         if (progress === 2) set({ jobStatus: 'printing', jobsAhead: 0 });
         if (progress === 3) {
             set({ jobStatus: 'done' });
             clearInterval(interval);
         }
     }, 4000); // Transition every 4 secs
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
