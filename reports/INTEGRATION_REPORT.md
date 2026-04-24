# Modern Press — Frontend ↔ Backend Integration Report

> **Generated:** 2026-04-18  
> **Status:** Frontend complete (mock services). Backend integration pending.  
> **Purpose:** Exhaustive gap analysis. Every frontend feature is documented with the exact backend endpoint it requires.

---

## 1. Current Architecture Overview

```
Printing_automation/
├── admin-ui/          ← React + Vite frontend (PORT 5173 dev / served via Express in prod)
│   └── src/
│       ├── pages/user/        ← 4-step User Kiosk flow
│       ├── pages/admin/       ← 4-page Admin Control Room
│       ├── services/api.ts    ← MOCK service layer (ALL calls go here)
│       ├── stores/            ← Zustand state management
│       └── data/mockData.ts   ← Static mock data (to be replaced by API responses)
│
└── server/            ← Express + Node.js backend (PORT 3000)
    └── src/
        ├── routes/            ← print.routes.ts, printer.routes.ts (only 4 endpoints exist)
        ├── controllers/       ← print.controller.ts, printer.controller.ts
        └── services/          ← printer.service.ts (CUPS via lpstat/lp commands)
```

### How They Connect
- In **development**: Frontend (5173) calls backend (3000) via proxy or direct fetch.
- In **production**: Express serves the built `admin/` folder as static files AND handles API routes on the same port (3000). React Router catch-all sends `index.html` for all non-API paths.

---

## 2. User Kiosk — Pages & Features

### Step 1: Drop Zone (`/`)
**Route:** `src/pages/user/DropZone.tsx`

| Feature | Current State | Backend Required |
|---|---|---|
| Drag-and-drop file upload | ✅ Implemented (local File API) | Upload endpoint needed |
| File type validation (PDF, DOCX, JPEG) | ✅ Client-side only | Server-side MIME validation |
| 50MB size limit enforcement | ✅ Client-side only | Enforced by multer (already done) |
| Page count estimation | ⚠️ Mock (file size ÷ 50KB = pages) | Real page-count parser needed |

---

### Step 2: Config Console (`/` — step 2)
**Route:** `src/pages/user/ConfigConsole.tsx`

| Feature | Current State | Backend Required |
|---|---|---|
| Color mode selection (B&W / Color) | ✅ Frontend state only | Passed as job params |
| Duplex selection | ✅ Frontend state only | Passed as job params |
| Orientation selection | ✅ Frontend state only | Passed as CUPS `-o orientation-requested` option |
| Copies count | ✅ Frontend state only | Passed as `-n <copies>` to CUPS |
| Generate Quote button | ✅ Calls mock `calculateQuote()` | **Requires endpoint** |

---

### Step 3: Quote Receipt (`/` — step 3)
**Route:** `src/pages/user/QuoteReceipt.tsx`

| Feature | Current State | Backend Required |
|---|---|---|
| Dynamic cost calculation | ⚠️ Fully client-side mock | **Requires endpoint** |
| ETA estimation | ⚠️ `totalPages × 2 / 60` mins mock | **Backend queue-aware** ETA |
| Authorize & submit print job | ⚠️ Calls mock `submitPrintJob()` | **Requires endpoint** |
| Ticket/Job ID generation | ⚠️ `JOB-${random}` in mock | Server must generate real CUPS job ID |

---

### Step 4: Job Tracker (`/` — step 4)
**Route:** `src/pages/user/JobTracker.tsx`

| Feature | Current State | Backend Required |
|---|---|---|
| Real-time job status display | ⚠️ Fake `setTimeout` transitions every 4s | **Requires polling endpoint or WebSocket** |
| Status stages: Queued → Spooling → Printing → Done | ⚠️ Hardcoded timer sequence | Real CUPS job status (`lpstat -o`) |
| Jobs ahead counter | ⚠️ `Math.random() * 3` | Real queue position from server |
| Error/Failed state | ⚠️ Hardcoded | Real CUPS error propagation |
| "Start New Job" resets flow | ✅ Clears Zustand store | No backend needed |

---

## 3. Admin Control Room — Pages & Features

### Auth Gate (PIN Screen)
**Route:** `src/layouts/AdminLayout.tsx`

| Feature | Current State | Backend Required |
|---|---|---|
| PIN authentication (`1234`) | ⚠️ Hardcoded string comparison in Zustand | **Requires endpoint** — PIN must be stored/validated server-side |
| Session persistence | ⚠️ Zustand only (lost on refresh) | JWT/cookie session or `localStorage` token validation |
| Logout | ✅ Clears in-memory state | Server should invalidate session token |

---

### Admin Dashboard (`/admin`)
**Route:** `src/pages/admin/Dashboard.tsx`

| Feature | Current State | Backend Required |
|---|---|---|
| Active printers count | ⚠️ Mock static number | **Requires endpoint** |
| Queue length | ⚠️ Counted from mock queue array | **Requires endpoint** (live queue count) |
| Total jobs today | ⚠️ Hardcoded `47` | **Requires endpoint** — needs job history log |
| Gross revenue today | ⚠️ Hardcoded `1284` | **Requires endpoint** — sum of completed job costs |
| CPU load % | ⚠️ Hardcoded `23%` | **Requires endpoint** — `os.loadavg()` |
| Storage used / total | ⚠️ Hardcoded `6.3 / 8.0 GB` | **Requires endpoint** — `df` command or `fs.statSync` |
| Server uptime | ⚠️ Hardcoded `14h 23m` | **Requires endpoint** — `process.uptime()` |
| Real-time graph | ⚠️ Placeholder only | **Requires endpoint** — job throughput time series |

---

### Hardware Fleet (`/admin/fleet`)
**Route:** `src/pages/admin/Fleet.tsx`

| Feature | Current State | Backend Required |
|---|---|---|
| List all printers with status | ⚠️ Mock `MOCK_PRINTERS` array | **Endpoint exists** but needs enrichment |
| Printer model / connection type | ⚠️ Hardcoded mock data | `lpstat -p -l` extended output parsing |
| Paper tray level | ⚠️ Hardcoded `%` value | **Requires SNMP** or **IPP** query per printer |
| Ink / toner levels (C/M/Y/K bars) | ⚠️ Hardcoded values | **Requires SNMP or IPP** query per printer |
| Set as Default printer | ✅ Calls mock → existing backend route | **Endpoint exists:** `POST /printers/default` |
| Detect Legacy Hardware (USB scan) | ⚠️ Mock 3.5s delay + fake URI | **Requires endpoint** — scan via `lpinfo -v` |
| Printer Aliasing/Renaming | ❌ Missing | **Requires endpoint** — Map hardware ID to friendly name |
| Real-time printer status badge | ⚠️ Static from mock data | Poll `GET /printers` periodically |

---

### Master Queue (`/admin/queue`)
**Route:** `src/pages/admin/Queue.tsx`

| Feature | Current State | Backend Required |
|---|---|---|
| List all queued print jobs | ⚠️ Mock `MOCK_QUEUE` array | **Requires endpoint** — `lpstat -o` parsed |
| Cancel a job | ⚠️ Filters local mock array | **Requires endpoint** — `cancel <jobId>` CUPS command |
| Pause a job | ⚠️ Mock no-op returns `{ success: true }` | **Requires endpoint** — `lp -i <jobId> -H hold` |
| Prioritize (move to front) | ⚠️ Reorders local mock array | **Requires endpoint** — CUPS priority reorder |
| Auto-refresh every 10 seconds | ✅ `setInterval` in `useEffect` | Backend polling endpoint needed |
| Job owner, filename, pages, cost | ⚠️ Mock data only | Server must store & return these on job submit |

---

### Pricing & Settings (`/admin/settings`)
**Route:** `src/pages/admin/Settings.tsx`

| Feature | Current State | Backend Required |
|---|---|---|
| Load current pricing config | ⚠️ Mock `MOCK_PRICING` object | **Requires endpoint** — read from config file / DB |
| Update pricing (B&W, Color, Duplex %, Bulk %) | ⚠️ Mutates in-memory mock object | **Requires endpoint** — persist to config file or DB |
| Factory reset to defaults | ⚠️ Resets to `MOCK_PRICING` constant | **Requires endpoint** — clears config back to defaults |
| Real-time preview calculation | ✅ Pure JS, no backend needed | No backend needed |

---

## 4. Complete Backend Endpoint Gap Analysis

Below is the exhaustive list of all backend endpoints required. ✅ = already exists. ❌ = missing.

### Printer Management
| # | Method | Endpoint | Description | Status |
|---|---|---|---|---|
| 1 | `GET` | `/printers` | List all CUPS printers (name, model, status) | ✅ Exists |
| 2 | `GET` | `/printers/default` | Get default printer name | ✅ Exists |
| 3 | `POST` | `/printers/default` | Set default printer `{ printerName }` | ✅ Exists |
| 4 | `GET` | `/printers/:name/status` | Get live status of a specific printer (idle/printing/error) | ❌ Missing |
| 5 | `GET` | `/printers/:name/supplies` | Get ink/toner/paper levels (via SNMP or IPP) | ❌ Missing |
| 6 | `POST` | `/printers/detect` | Scan for USB/network printers via `lpinfo -v` | ❌ Missing |

---

### Print Job Submission
| # | Method | Endpoint | Description | Status |
|---|---|---|---|---|
| 7 | `POST` | `/print` | Submit file for printing with all config options | ✅ Exists (basic) |
| — | — | — | **Must be extended** to accept: `colorMode`, `duplex`, `copies`, `orientation`, `targetPrinter` as multipart fields | ⚠️ Partial |
| 8 | `POST` | `/print/quote` | Calculate print cost without submitting. Body: `{ pages, copies, colorMode, duplex }` | ❌ Missing |

---

### Job Queue Management
| # | Method | Endpoint | Description | Status |
|---|---|---|---|---|
| 9 | `GET` | `/jobs` | List all active/recent jobs (`lpstat -o` enriched with cost/owner) | ❌ Missing |
| 10 | `GET` | `/jobs/:jobId/status` | Poll status of a specific job | ❌ Missing |
| 11 | `DELETE` | `/jobs/:jobId` | Cancel a job (`cancel <jobId>`) | ❌ Missing |
| 12 | `POST` | `/jobs/:jobId/pause` | Pause job (`lp -i <jobId> -H hold`) | ❌ Missing |
| 13 | `POST` | `/jobs/:jobId/resume` | Resume a paused job (`lp -i <jobId> -H resume`) | ❌ Missing |
| 14 | `POST` | `/jobs/:jobId/priority` | Move job to front of queue | ❌ Missing |

---

### System Metrics / Dashboard
| # | Method | Endpoint | Description | Status |
|---|---|---|---|---|
| 15 | `GET` | `/metrics` | Returns: CPU load, uptime, storage, active printers, queue length, jobs today, revenue | ❌ Missing |

---

### Pricing Configuration
| # | Method | Endpoint | Description | Status |
|---|---|---|---|---|
| 16 | `GET` | `/config/pricing` | Return current pricing config JSON | ❌ Missing |
| 17 | `PUT` | `/config/pricing` | Update pricing config. Body: `PricingConfig` object | ❌ Missing |
| 18 | `POST` | `/config/pricing/reset` | Reset pricing to factory defaults | ❌ Missing |

---

### Authentication
| # | Method | Endpoint | Description | Status |
|---|---|---|---|---|
| 19 | `POST` | `/auth/login` | Validate admin PIN. Body: `{ pin }`. Returns JWT token | ❌ Missing |
| 20 | `POST` | `/auth/logout` | Invalidate current session token | ❌ Missing |
| 21 | `GET` | `/auth/verify` | Check if current token is still valid (used on page refresh) | ❌ Missing |

---

### Page Count Utility
| # | Method | Endpoint | Description | Status |
|---|---|---|---|---|
| 22 | `POST` | `/utils/pagecount` | Upload file, return actual page count. Uses `pdfinfo` (for PDF) or LibreOffice headless | ❌ Missing |
| 23 | `PUT` | `/printers/:name/alias` | Update/Set display name for a printer hardware ID | ❌ Missing |

---

## 5. Data Models Required on Backend

### Job Record (to be stored in memory or SQLite)
```typescript
interface JobRecord {
  id: string;            // CUPS job ID e.g. "Main-Office-42"
  cupsJobId: string;     // Raw CUPS ID
  filename: string;      // Original uploaded filename
  owner: string;         // "Guest" in kiosk mode
  pages: number;         // Page count
  copies: number;
  colorMode: 'color' | 'grayscale';
  duplex: 'single' | 'double';
  orientation: 'portrait' | 'landscape';
  targetPrinter: string;
  status: 'queued' | 'spooling' | 'printing' | 'done' | 'failed';
  cost: number;          // Calculated cost in ₹
  submittedAt: string;   // ISO timestamp
  completedAt?: string;
}
```

### Pricing Config (persist to `config/pricing.json`)
```typescript
interface PricingConfig {
  bwPerPage: number;       // default: 2
  colorPerPage: number;    // default: 10
  currency: string;        // default: '₹'
  duplexDiscount: number;  // default: 10 (%)
  bulkThreshold: number;   // default: 50 (pages)
  bulkDiscount: number;    // default: 15 (%)
}
```

---

## 6. Integration Migration Plan

When connecting `api.ts` to the real backend, replace mock functions one-by-one:

```typescript
// BEFORE (mock):
fetchPrinters: () => delay(MOCK_PRINTERS),

// AFTER (real):
fetchPrinters: () => fetch('http://localhost:3000/printers').then(r => r.json()).then(r => r.printers),
```

The frontend Zustand stores do NOT need to change — only `src/services/api.ts` needs to be updated, method by method. This is the clean decoupling already in place.

---

## 7. CUPS Commands Reference

All backend endpoints ultimately call these system commands:

| Command | Purpose |
|---|---|
| `lpstat -p` | List printers |
| `lpstat -d` | Get default printer |
| `lpstat -o` | List active jobs |
| `lpstat -W completed` | List completed jobs |
| `lp -d <printer> -n <copies> -o sides=<duplex> -o media=<size> -- <file>` | Submit job |
| `cancel <jobId>` | Cancel job |
| `lp -i <jobId> -H hold` | Pause job |
| `lp -i <jobId> -H resume` | Resume job |
| `lpoptions -d <printer>` | Set default |
| `lpinfo -v` | Discover printers/URIs |
| `pdfinfo <file>` | Get PDF page count |

---

## 8. Priority Order for Backend Implementation

1. **`POST /print/quote`** — Blocks the user from completing Step 3 (Quote Receipt)
2. **`POST /print` (extended)** — Must accept color/duplex/copies params 
3. **`GET /jobs/:jobId/status`** — Required to make Job Tracker real
4. **`GET /jobs`** — Required for Admin Queue page
5. **`DELETE /jobs/:jobId`** — Required for Admin Queue cancel action
6. **`POST /auth/login`** — Required to replace hardcoded PIN `1234`
7. **`GET /metrics`** — Required for Admin Dashboard
8. **`GET/PUT /config/pricing`** — Required for Settings page persistence
9. **`POST /printers/detect`** — Required for Fleet hardware scan
10. **`POST /utils/pagecount`** — Improves quote accuracy

---

*This document serves as the single source of truth for backend-frontend integration. Update it as endpoints are implemented.*
