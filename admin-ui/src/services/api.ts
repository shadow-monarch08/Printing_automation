// src/services/api.ts
import { apiClient } from './apiClient';
import type { BackendPrinter, BackendJob, BackendMetrics, PricingConfig, BackendSupplies } from '../types';

export const api = {
  fetchPrinters: async () => {
    const data = await apiClient.get<{ success: boolean; printers: BackendPrinter[] }>('/printers');
    // Fetch supplies for each printer in parallel
    const printersWithSupplies = await Promise.all(data.printers.map(async (p) => {
      try {
        const suppliesRes = await apiClient.get<{ success: boolean; data: BackendSupplies }>(`/printers/${encodeURIComponent(p.name)}/supplies`);
        if (suppliesRes.success) {
          return {
            ...p,
            paper: suppliesRes.data.paper,
            supplyBlack: suppliesRes.data.supplies.black,
            supplyColor: suppliesRes.data.supplies.color,
          };
        }
      } catch (err) {
        console.error(`Failed to fetch supplies for ${p.name}`, err);
      }
      return {
        ...p,
        paper: 'unknown' as const,
        supplyBlack: null,
        supplyColor: null,
      };
    }));
    return printersWithSupplies;
  },
  
  fetchDefaultPrinter: async () => {
    const data = await apiClient.get<{ success: boolean; default?: string }>('/printers/default');
    return data.default || '';
  },

  setDefaultPrinter: async (name: string) => {
    return apiClient.post<{ success: boolean; message: string }>('/printers/default', { printerName: name });
  },

  submitPrintJob: async (config: any) => {
    const formData = new FormData();
    formData.append('file', config.file); // actual File object
    formData.append('copies', config.quote?.copies?.toString() || '1');
    formData.append('colorMode', config.quote?.colorMode || 'grayscale');
    formData.append('duplex', config.quote?.duplex || 'single');
    formData.append('orientation', config.quote?.orientation || 'portrait');
    formData.append('owner', 'Guest User');

    const res = await apiClient.post<{ success: boolean; jobId: string; message: string }>('/print', formData, true);
    return { jobId: res.jobId, eta: '~2 minutes' };
  },

  fetchDashboardMetrics: async () => {
    const res = await apiClient.get<{ success: boolean; metrics: BackendMetrics }>('/metrics');
    return res.metrics;
  },

  fetchPrintQueue: async () => {
    const res = await apiClient.get<{ success: boolean; jobs: BackendJob[] }>('/jobs');
    // Map targetPrinter to printer to match expected frontend interface structure
    return res.jobs.map(j => ({ ...j, printer: j.targetPrinter }));
  },

  cancelJob: async (id: string) => {
    return apiClient.delete<{ success: boolean; message: string }>(`/jobs/${id}`);
  },

  pauseJob: async (id: string) => {
    return apiClient.post<{ success: boolean; message: string }>(`/jobs/${id}/pause`);
  },

  prioritizeJob: async (id: string) => {
    return apiClient.post<{ success: boolean; message: string }>(`/jobs/${id}/priority`, { priority: 1 });
  },

  detectLegacyPrinter: async () => {
    const res = await apiClient.get<{ success: boolean; devices: { uri: string; makeModel: string }[] }>('/printers/detect-legacy');
    return res;
  },

  fetchPricingConfig: async () => {
    const res = await apiClient.get<{ success: boolean; config: PricingConfig }>('/config/pricing');
    return res.config;
  },

  updatePricingConfig: async (config: Partial<PricingConfig>) => {
    return apiClient.put<{ success: boolean; config: PricingConfig }>('/config/pricing', config);
  },

  calculateQuote: async (config: {
    pages: number;
    copies: number;
    colorMode: 'color' | 'grayscale';
    duplex: 'single' | 'double';
  }) => {
    const res = await apiClient.post<{ success: boolean; cost: number; breakdown: any }>('/print/quote', config);
    return {
      totalPages: res.breakdown.totalPages,
      costPerPage: res.breakdown.basePricePerSheet,
      totalCost: res.cost,
      eta: `~${Math.ceil((res.breakdown.totalPages * 2) / 60)} minutes`,
      // retain these for submitPrintJob
      copies: config.copies,
      colorMode: config.colorMode,
      duplex: config.duplex,
    };
  },

  getPageCount: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<{ success: boolean; pages: number }>('/utils/pagecount', formData, true);
    return res.pages;
  },

  configurePrinter: async (uri: string, modelName: string) => {
    return apiClient.post<{ success: boolean; queueName?: string; error?: string }>('/printers/configure', { uri, modelName });
  },

  resetPricingConfig: async () => {
    const res = await apiClient.post<{ success: boolean; config: PricingConfig }>('/config/pricing/reset');
    return res.config;
  }
};
