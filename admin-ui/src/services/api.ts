// src/services/api.ts
import { MOCK_PRINTERS, MOCK_QUEUE, MOCK_METRICS, MOCK_PRICING } from '../data/mockData';
import type { QueueJob, DashboardMetrics, PricingConfig } from '../data/mockData';

// Helper to simulate network latency
const delay = <T>(data: T, ms = 400): Promise<T> => {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
};

// State held in memory for the mock service
let printers = [...MOCK_PRINTERS];
let queue = [...MOCK_QUEUE];
let pricingContext = { ...MOCK_PRICING };

export const api = {
  fetchPrinters: () => delay(printers),
  
  fetchDefaultPrinter: () => {
    const defaultP = printers.find((p) => p.isDefault);
    return delay(defaultP ? defaultP.name : '');
  },

  setDefaultPrinter: (name: string) => {
    printers = printers.map(p => ({
      ...p,
      isDefault: p.name === name
    }));
    return delay({ success: true });
  },

  submitPrintJob: (config: any) => {
    const newJob: QueueJob = {
      id: `JOB-${Math.floor(Math.random() * 1000) + 5000}`,
      filename: config.file?.name || 'document.pdf',
      owner: 'Guest User',
      pages: config.quote?.totalPages || 1,
      printer: printers.find(p => p.isDefault)?.name || printers[0].name,
      status: 'queued',
      cost: config.quote?.totalCost || 0,
      submittedAt: new Date().toISOString()
    };
    queue = [newJob, ...queue];
    return delay({ jobId: newJob.id, eta: config.quote?.eta || '~2 minutes' }, 1200);
  },

  fetchDashboardMetrics: () => delay<DashboardMetrics>({
    ...MOCK_METRICS,
    queueLength: queue.filter(q => q.status === 'queued' || q.status === 'spooling').length
  }),

  fetchPrintQueue: () => delay(queue),

  cancelJob: (id: string) => {
    queue = queue.filter(q => q.id !== id);
    return delay({ success: true }, 600);
  },

  pauseJob: (_id: string) => {
    // Just mock functionality
    return delay({ success: true }, 400);
  },

  prioritizeJob: (id: string) => {
    const jobIdx = queue.findIndex(q => q.id === id);
    if (jobIdx > -1) {
      const job = queue[jobIdx];
      queue.splice(jobIdx, 1);
      queue.unshift(job);
    }
    return delay({ success: true }, 500);
  },

  detectLegacyPrinter: () => {
    return delay({ uri: 'usb://EPSON/Stylus%20CX3700?serial=L12345' }, 3500); // long delay to simulate hardware discovery
  },

  fetchPricingConfig: () => delay(pricingContext),

  updatePricingConfig: (config: Partial<PricingConfig>) => {
    pricingContext = { ...pricingContext, ...config };
    return delay({ success: true }, 800);
  },

  calculateQuote: (config: {
    pages: number;
    copies: number;
    colorMode: 'color' | 'grayscale';
    duplex: 'single' | 'double';
  }) => {
    const totalPages = config.pages * config.copies;
    let costPerPage = config.colorMode === 'color' ? pricingContext.colorPerPage : pricingContext.bwPerPage;
    
    let totalCost = totalPages * costPerPage;

    if (config.duplex === 'double') {
        const discountMultiplier = (100 - pricingContext.duplexDiscount) / 100;
        totalCost = totalCost * discountMultiplier;
    }

    if (totalPages > pricingContext.bulkThreshold) {
        const bulkMultiplier = (100 - pricingContext.bulkDiscount) / 100;
        totalCost = totalCost * bulkMultiplier;
    }

    // round up cost
    totalCost = Math.ceil(totalCost);

    return delay({
      totalPages,
      costPerPage,
      totalCost,
      eta: `~${Math.ceil((totalPages * 2) / 60)} minutes`
    }, 200);
  }
};
