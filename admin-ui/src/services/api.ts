// src/services/api.ts
import { apiClient } from './apiClient';
import type { BackendPrinter, BackendJob, BackendMetrics, PricingConfig, WifiNetwork, ConnectPayload } from '../types';

export const api = {
  fetchPrinters: async () => {
    const data = await apiClient.get<{ success: boolean; printers: BackendPrinter[] }>('/printers');
    return data.printers;
  },

  fetchKioskStatus: async () => {
    const data = await apiClient.get<{ isAcceptingJobs: boolean; fleetCapabilities: { color: boolean; duplex: boolean } }>('/fleet/kiosk-status');
    return data;
  },

  updateAlias: async (printerName: string, alias: string) => {
    return apiClient.put<{ success: boolean; message: string }>(`/printers/${encodeURIComponent(printerName)}/alias`, { alias });
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
    if (config.sessionId) {
      formData.append('sessionId', config.sessionId);
    }

    const res = await apiClient.post<{ success: boolean; jobId: string; message: string }>('/print', formData, true);
    return { jobId: res.jobId, eta: '~2 minutes' };
  },

  fetchDashboardMetrics: async () => {
    const res = await apiClient.get<{ success: boolean; metrics: BackendMetrics }>('/metrics');
    return res.metrics;
  },

  fetchMetricsHistory: async () => {
    const res = await apiClient.get<{ success: boolean; history: any[] }>('/metrics/history');
    return res.history;
  },

  fetchPrintQueue: async (sessionId?: string) => {
    const url = sessionId ? `/jobs?sessionId=${sessionId}` : '/jobs';
    const res = await apiClient.get<{ success: boolean; jobs: BackendJob[] }>(url);
    // Map targetPrinter to printer to match expected frontend interface structure
    return res.jobs.map(j => ({ ...j, printer: j.targetPrinter }));
  },

  cancelJob: async (id: string) => {
    return apiClient.delete<{ success: boolean; message: string }>(`/jobs/${id}`);
  },

  pauseJob: async (id: string) => {
    return apiClient.post<{ success: boolean; message: string }>(`/jobs/${id}/pause`);
  },

  resumeJob: async (id: string) => {
    return apiClient.post<{ success: boolean; message: string }>(`/jobs/${id}/resume`);
  },

  prioritizeJob: async (id: string) => {
    return apiClient.post<{ success: boolean; message: string }>(`/jobs/${id}/priority`, { priority: 1 });
  },

  pauseGlobalQueue: async () => {
    return apiClient.post<{ success: boolean; message: string }>('/jobs/queue/pause');
  },

  resumeGlobalQueue: async () => {
    return apiClient.post<{ success: boolean; message: string }>('/jobs/queue/resume');
  },

  getQueueStatus: async () => {
    return apiClient.get<{ success: boolean; isPaused: boolean }>('/jobs/queue/status');
  },

  emergencyStop: async () => {
    return apiClient.post<{ success: boolean; message: string }>('/jobs/queue/emergency-stop');
  },

  detectLegacyPrinter: async () => {
    const res = await apiClient.get<{ success: boolean; devices: { uri: string; rawModel: string }[] }>('/printers/detect-legacy');
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

  configurePrinter: async (uri: string, rawModel: string) => {
    return apiClient.post<{ success: boolean; queueName?: string; error?: string }>('/printers/configure', { uri, rawModel });
  },

  updateCapabilities: async (printerName: string, capabilities: string[], type?: string) => {
    return apiClient.put<{ success: boolean; message: string }>(`/printers/${encodeURIComponent(printerName)}/capabilities`, { capabilities, type });
  },

  resetPricingConfig: async () => {
    const res = await apiClient.post<{ success: boolean; config: PricingConfig }>('/config/pricing/reset');
    return res.config;
  },

  forceRefreshPrinter: async (printerName: string) => {
    return apiClient.post<{ success: boolean; status?: string; message?: string }>(`/printers/${encodeURIComponent(printerName)}/refresh`);
  },

  deletePrinter: async (printerName: string) => {
    return apiClient.delete<{ success: boolean; message: string }>(`/printers/${encodeURIComponent(printerName)}`);
  },

  deleteAllPrinters: async () => {
    return apiClient.delete<{ success: boolean; message: string }>('/printers');
  },

  scanWifiNetworks: async () => {
    return apiClient.get<WifiNetwork[]>('/wifi/scan');
  },

  connectToWifi: async (payload: ConnectPayload) => {
    return apiClient.post<{ success: boolean; message: string }>('/wifi/connect', payload);
  },

  getWifiConnectionStatus: async () => {
    return apiClient.get<{ status: 'idle' | 'connecting' | 'success' | 'failed'; error?: string; timestamp: number }>('/wifi/connection-status');
  },

  provisionSetup: async (payload: { adminPin: string; shopName: string; wifiSsid?: string; wifiPassword?: string; skipWifi?: boolean }) => {
    return apiClient.post<{ success: boolean; cloudflareUrl?: string }>('/setup/provision', payload);
  },

  skipWifiSetup: async (payload: { adminPin?: string; shopName?: string }) => {
    return apiClient.post<{ success: boolean; message: string; skipped: boolean }>('/wifi/skip', payload);
  },

  // Analytics API
  fetchFinancialSummary: async (startDate: string, endDate: string) => {
    const res = await apiClient.get<{ success: boolean; totalRevenue: number; totalJobs: number; completedJobs: number; failedJobs: number; avgCostPerJob: number }>(`/analytics/financial/summary?startDate=${startDate}&endDate=${endDate}`);
    return res;
  },
  fetchRevenueTrend: async (startDate: string, endDate: string) => {
    const res = await apiClient.get<{ success: boolean; trend: any[] }>(`/analytics/financial/trend?startDate=${startDate}&endDate=${endDate}`);
    return res.trend;
  },
  fetchColorSplit: async (startDate: string, endDate: string) => {
    const res = await apiClient.get<{ success: boolean; colorRevenue: number; colorJobs: number; bwRevenue: number; bwJobs: number }>(`/analytics/financial/color-split?startDate=${startDate}&endDate=${endDate}`);
    return res;
  },
  fetchFleetTelemetry: async (startDate: string, endDate: string) => {
    const res = await apiClient.get<{ success: boolean; telemetry: any[] }>(`/analytics/fleet?startDate=${startDate}&endDate=${endDate}`);
    return res.telemetry;
  },
  fetchJobArchive: async (params: { startDate: string; endDate: string; status?: string; printer?: string; page: number; limit: number; }) => {
    const query = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate, page: params.page.toString(), limit: params.limit.toString() });
    if (params.status) query.set('status', params.status);
    if (params.printer) query.set('printer', params.printer);
    const res = await apiClient.get<{ success: boolean; jobs: any[]; total: number; page: number; limit: number; totalPages: number; }>(`/analytics/jobs?${query.toString()}`);
    return res;
  },
  exportJobsCSV: (startDate: string, endDate: string, status?: string, printer?: string) => {
    const params = new URLSearchParams({ startDate, endDate });
    if (status) params.set('status', status);
    if (printer) params.set('printer', printer);
    const token = localStorage.getItem('auth_token');
    if (token) params.set('token', token);
    const baseUrl = import.meta.env.VITE_API_URL || '';
    return `${baseUrl}/analytics/jobs/export?${params.toString()}`;
  }
};
