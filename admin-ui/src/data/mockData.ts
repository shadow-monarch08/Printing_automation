// src/data/mockData.ts

export interface Printer {
  id: string;
  name: string;
  model: string;
  status: 'idle' | 'printing' | 'error';
  type: 'usb' | 'network';
  isDefault: boolean;
  paperLevel: number;
  inkLevels: { c: number; m: number; y: number; k: number };
}

export interface QueueJob {
  id: string;
  filename: string;
  owner: string;
  pages: number;
  printer: string;
  status: 'queued' | 'spooling' | 'printing' | 'done' | 'failed';
  cost: number;
  submittedAt: string;
}

export interface DashboardMetrics {
  totalJobsToday: number;
  activePrinters: number;
  totalPrinters: number;
  queueLength: number;
  revenue: number;
  storageUsed: number;
  storageTotal: number;
  cpuLoad: number;
  uptime: string;
}

export interface PricingConfig {
  bwPerPage: number;
  colorPerPage: number;
  currency: string;
  duplexDiscount: number;
  bulkThreshold: number;
  bulkDiscount: number;
}

export const MOCK_PRICING: PricingConfig = {
  bwPerPage: 2,
  colorPerPage: 10,
  currency: '₹',
  duplexDiscount: 10,
  bulkThreshold: 50,
  bulkDiscount: 15,
};

export const MOCK_PRINTERS: Printer[] = [
  {
    id: 'p1',
    name: 'Main Office Laser',
    model: 'HP LaserJet Pro M404n',
    status: 'idle',
    type: 'network',
    isDefault: true,
    paperLevel: 80,
    inkLevels: { c: 0, m: 0, y: 0, k: 45 }
  },
  {
    id: 'p2',
    name: 'Color Press',
    model: 'EPSON L3250 EcoTank',
    status: 'printing',
    type: 'network',
    isDefault: false,
    paperLevel: 60,
    inkLevels: { c: 75, m: 80, y: 65, k: 90 }
  },
  {
    id: 'p3',
    name: 'Reception Kiosk',
    model: 'Canon PIXMA G3000',
    status: 'error',
    type: 'usb',
    isDefault: false,
    paperLevel: 0,
    inkLevels: { c: 80, m: 80, y: 80, k: 95 }
  },
  {
    id: 'p4',
    name: 'Design Dept Hi-Res',
    model: 'Brother HL-L8360CDW',
    status: 'idle',
    type: 'network',
    isDefault: false,
    paperLevel: 100,
    inkLevels: { c: 100, m: 100, y: 100, k: 100 }
  },
  {
    id: 'p5',
    name: 'Old Backup Printer',
    model: 'Samsung ML-1640',
    status: 'idle',
    type: 'usb',
    isDefault: false,
    paperLevel: 25,
    inkLevels: { c: 0, m: 0, y: 0, k: 15 }
  }
];

export const MOCK_QUEUE: QueueJob[] = [
  { id: 'JOB-4029', filename: 'Annual_Report_2026.pdf', owner: 'Alice Smith', pages: 45, printer: 'Color Press', status: 'printing', cost: 450, submittedAt: new Date(Date.now() - 120000).toISOString() },
  { id: 'JOB-4030', filename: 'meeting_notes.docx', owner: 'Bob Jones', pages: 3, printer: 'Main Office Laser', status: 'spooling', cost: 6, submittedAt: new Date(Date.now() - 60000).toISOString() },
  { id: 'JOB-4031', filename: 'invoice_1042.pdf', owner: 'Charlie Brown', pages: 1, printer: 'Main Office Laser', status: 'queued', cost: 2, submittedAt: new Date(Date.now() - 30000).toISOString() },
  { id: 'JOB-4032', filename: 'design_mockup_v3.png', owner: 'Diana Prince', pages: 1, printer: 'Design Dept Hi-Res', status: 'queued', cost: 10, submittedAt: new Date(Date.now() - 15000).toISOString() },
  { id: 'JOB-4033', filename: 'presentation_deck.pdf', owner: 'Eve Adams', pages: 20, printer: 'Color Press', status: 'queued', cost: 200, submittedAt: new Date(Date.now() - 5000).toISOString() },
  { id: 'JOB-4015', filename: 'tax_return.pdf', owner: 'Frank Castle', pages: 12, printer: 'Reception Kiosk', status: 'failed', cost: 24, submittedAt: new Date(Date.now() - 3600000).toISOString() }
];

export const MOCK_METRICS: DashboardMetrics = {
  totalJobsToday: 47,
  activePrinters: 3,
  totalPrinters: 5,
  queueLength: 4,
  revenue: 1284,
  storageUsed: 6.3,
  storageTotal: 8.0,
  cpuLoad: 23,
  uptime: '14h 23m 07s'
};
