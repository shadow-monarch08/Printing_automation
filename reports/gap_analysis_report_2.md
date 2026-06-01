# Gap Analysis & Implementation Report
### Instruction 17 — SQLite Cold Tier, Payment Gateway & Analytics Dashboard
**Audit Date:** 2026-06-01 | **Auditor:** Antigravity AI

---

## Executive Summary

The system is a **Raspberry Pi-class print kiosk** built with a sophisticated Hot Tier (Redis/BullMQ) for live queue management. The architecture is production-quality for its current scope, but it has **zero infrastructure for the target state**. There is no SQL database, no payment gateway, no historical data retention, and no analytics layer — all reporting currently runs against ephemeral BullMQ state that disappears after 100 completed jobs.

**Overall Readiness: 2/10 for the target state.** The positive news is that the codebase is architecturally clean, making it a well-prepared host for the incoming layers. No major refactoring of existing components is required; new modules can be injected around existing seams cleanly.

---

## Domain 1: Database & Event Infrastructure

### 1.1 — SQL / SQLite Dependency Audit

**Current State:**
- `server/package.json` contains **zero SQL-related dependencies**: no `better-sqlite3`, no `sequelize`, no `drizzle-orm`, no `knex`, no `prisma`. The only persistence layer is ioredis.
- No database initialization file exists anywhere under `server/src/`.
- No migration system, no schema definition, no seed data.
- The `server/src/config/` directory contains only `pricing.json` and `capabilities.json` (flat-file configs).
- The comment `// Ensure Redis is running and configured for AOF persistence` in [`redis.ts`](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/redis.ts#L3) is the only mention of any persistence strategy in the entire backend.

**Target State:**
- `better-sqlite3` singleton module at `server/src/infrastructure/database.ts`.
- WAL mode enabled on initialization.
- Four tables: `users`, `printers`, `print_jobs`, `payments`.

**Gap:** The entire SQLite layer does not exist. It must be created from scratch.

---

### 1.2 — BullMQ QueueEvents Audit

**Current State:**
- Job lifecycle events are handled in **two places**, both using `Worker`-local event listeners:
  - [`printMaster.worker.ts` L143-192](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts#L143): `printMasterWorker.on("completed", ...)`, `printMasterWorker.on("failed", ...)`.
- These worker-local listeners handle: releasing printer locks, resetting strike counts, cleaning up uploaded files, and waking up delayed jobs.
- **No `QueueEvents` class is instantiated anywhere in the codebase.** `QueueEvents` (from BullMQ) is a separate, Redis-native mechanism designed to listen to queue events across multiple worker processes. It is not the same as worker-local `.on()` listeners.

**Why this matters:**
- Worker-local listeners fire only in the same Node.js process and only for jobs that particular worker instance processed. They do **not** produce a stable hook point for writing to a separate database without coupling the SQLite write directly into the worker function itself.
- A `QueueEvents` instance listens to BullMQ's native Redis streams, making it the correct pattern for cross-cutting concerns like audit logging.

**Target Attachment Point:**
```
server/src/infrastructure/printMaster.worker.ts — after line 122 (after the worker is instantiated)
```
A new `QueueEvents` instance should be instantiated in a dedicated file (e.g., `server/src/infrastructure/printMaster.events.ts`) and attach to the `"print-master"` queue using the same `redisConnection`. This file is then imported in `server.ts` so it initializes on startup.

**Gap Summary for Domain 1:**

| Item | Status |
|---|---|
| `better-sqlite3` package installed | ❌ Missing |
| `database.ts` singleton with WAL mode | ❌ Missing |
| `users` table | ❌ Missing |
| `printers` table | ❌ Missing |
| `print_jobs` table | ❌ Missing |
| `payments` table | ❌ Missing |
| `QueueEvents` listener file | ❌ Missing |
| Write-behind sync on job `completed` | ❌ Missing |
| Write-behind sync on job `failed` | ❌ Missing |

---

## Domain 2: Payment Gateway & Submission Flow

### 2.1 — `print.controller.ts` Surgical Audit

The current `printFile` controller ([`print.controller.ts` L14-L69](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/print.controller.ts)) follows a synchronous, single-pass model:

```
L31: cost = calculateQuote(...)          ← PRICING CALCULATION
L33: jobId = uuidv4()
L34-49: jobData = { ...all fields... }
                                         ← *** PAYMENT INJECTION POINT ***
L52: printMasterQueue.add(...)           ← BULLMQ ENQUEUE (must be deferred)
L54: eventBus.emit("job_queued", ...)
L56-61: res.json({ success, jobId })
```

**The exact line that must be restructured:** `L52 — printMasterQueue.add(...)`.

**Current State:** The file upload → price calculation → BullMQ enqueue is a single synchronous function. There is no concept of a "pending payment" state. Kiosk users are anonymous ("Guest"). There is no `sessionId` binding to a user record. There is no `payment` table to write to.

**Target State:** The flow must be split into two phases:

**Phase A — `POST /print` (Initiation):**
1. Validate file upload and parse parameters (unchanged).
2. Calculate `cost` (unchanged, L31).
3. Generate `jobId` (unchanged, L33).
4. **[NEW]** Write a `print_jobs` record to SQLite with `status = 'pending_payment'`.
5. **[NEW]** Call payment gateway SDK (e.g., Razorpay, Stripe) to create a payment order/intent, passing the `cost` and `jobId` as the correlation reference.
6. **[NEW]** Return to the frontend: `{ jobId, paymentOrderId, paymentKey, amount }` — **do NOT enqueue to BullMQ yet**.

**Phase B — `POST /print/confirm` (Webhook/Callback):**
1. Receive the payment gateway's webhook (or a signed confirmation from the client).
2. Verify the payment signature (HMAC validation).
3. Lookup the `print_jobs` record in SQLite by `jobId`.
4. Update `print_jobs.status` to `queued` and write the `payments` record.
5. **[NOW]** Call `printMasterQueue.add(...)`.
6. Emit `job_queued` SSE event.

**Gap: Controller Restructuring Required:**

| File | Change Type | Description |
|---|---|---|
| [`print.controller.ts`](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/print.controller.ts) | MODIFY | Split `printFile` into `initiateJob` and `confirmPayment` handlers |
| `payment.service.ts` | NEW | Encapsulates gateway SDK calls (create order, verify webhook) |
| [`print.routes.ts`](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/routes/print.routes.ts) | MODIFY | Add `POST /print/confirm` and `POST /print/webhook` routes |
| `payment.routes.ts` | NEW (optional) | Dedicated route file if the payment surface grows |

**User Model Gap:**
- Currently `owner` is hardcoded as `"Guest"`. The `users` table in the target schema requires a `session_id` FK.
- The `sessionId` is already passed from the kiosk frontend ([`api.ts` L38](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/services/api.ts#L38)) and stored in the BullMQ payload as `as any`.
- At job initiation, an upsert on the `users` table using `session_id` will create an implicit user record. No authentication changes are needed for kiosk users.

---

## Domain 3: Analytics API Layer

### 3.1 — Existing Reporting & Revenue Logic Audit

**Current State — All reporting is Redis-coupled and ephemeral:**

| Source | What it Calculates | Flaw |
|---|---|---|
| [`events.controller.ts` L75-L85](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/events.controller.ts#L75) | `revenue` for today: iterates `printMasterQueue.getCompleted()`, sums `job.data.cost` for jobs where `finishedOn >= todayStart` | Only covers up to 100 completed jobs retained in Redis (`removeOnComplete: 100`). No date range. No historical data. Revenue figure resets effectively every ~100 jobs. |
| [`events.controller.ts` L55-L61](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/events.controller.ts#L55) | Job counts (waiting, active, delayed, completedCount, failed) | `completedCount` from `getCompletedCount()` is a BullMQ counter that resets when the server restarts. Not persistent. |
| [`metrics.service.ts` L69-L72](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/metrics.service.ts#L69) | CPU/memory/disk history | Stored in process memory as a `history: MetricSnapshot[]` array, capped at 60 entries (~30 minutes). Wiped on every server restart. |

**No revenue-split by color/B&W, no per-printer job volume, no multi-day reporting, no date filtering, and no CSV export exist anywhere in the codebase.**

---

### 3.2 — Required New Analytics API Endpoints

All new analytics routes should live under a new route prefix: `/api/analytics/` (or simply `/analytics/`) and be protected by `requireAuth`.

**Financial Ledger:**
```
GET /analytics/financial?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```
- SQL: Query `print_jobs` JOIN `payments` filtered by `submitted_at BETWEEN ? AND ?`
- Returns: daily revenue totals (array of `{ date, revenue, jobCount }`), color vs. B&W revenue split, total successful payments vs. total quoted cost (to expose unpaid/refunded jobs).
- Heatmap data: `GROUP BY date(submitted_at)`.
- Trendline data: same query but filtered by `color_mode`.

```
GET /analytics/financial/summary?startDate=&endDate=
```
- Returns: aggregate totals (total revenue, total jobs, avg cost per job).

**Fleet Telemetry:**
```
GET /analytics/fleet?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```
- SQL: Query `print_jobs` WHERE `status = 'completed'`, `GROUP BY executed_by_printer`, `SUM(pages * copies)` for volume leaderboard.
- Query `print_jobs` WHERE `status = 'failed'`, `GROUP BY executed_by_printer` for error rates.
- Returns: `[{ printerName, totalPages, completedJobs, failedJobs, errorRate }]`.

**Job Archive (paginated):**
```
GET /analytics/jobs?startDate=&endDate=&status=&printer=&page=1&limit=50
```
- SQL: `SELECT * FROM print_jobs WHERE ... ORDER BY submitted_at DESC LIMIT ? OFFSET ?`
- Separate COUNT query for total pages: `SELECT COUNT(*) FROM print_jobs WHERE ...`
- Returns: `{ jobs: [...], total, page, limit, totalPages }`.

```
GET /analytics/jobs/export?startDate=&endDate=&status=&printer=
```
- Same query without pagination, returns raw CSV via `Content-Type: text/csv` + `Content-Disposition: attachment; filename=jobs_export.csv`.

---

## Domain 4: Frontend Admin Dashboard

### 4.1 — Existing Charting & Library Audit

| Library | Status | Notes |
|---|---|---|
| `recharts` v3.8.1 | ✅ Installed | `AreaChart` already used in [`Dashboard.tsx` L10](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/pages/admin/Dashboard.tsx#L10) for the resource history chart. |
| Date Range Picker | ❌ Missing | No `react-datepicker`, `react-day-picker`, or date utility library installed. |
| Data Table Library | ❌ Missing | No `@tanstack/react-table`, no `react-data-grid`. The Queue page uses a raw HTML `<table>`. |
| Date utility (`date-fns`, `dayjs`) | ❌ Missing | No date formatting library installed. Date formatting is done with raw `Date` constructors (e.g., [`Dashboard.tsx` L51-L55](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/pages/admin/Dashboard.tsx#L51)). |

**Recharts components available (already imported in Dashboard):** `AreaChart`, `Area`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`. Additional Recharts components needed for the analytics dashboard: `BarChart`, `Bar`, `PieChart`, `Pie`, `Cell`, `Legend`.

---

### 4.2 — Existing Routing & Navigation Audit

**Current Admin Routes** (defined in [`App.tsx` L79-L82](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/App.tsx#L79)):
```
/admin          → Dashboard.tsx  (system telemetry, revenue summary)
/admin/fleet    → Fleet.tsx      (printer management)
/admin/queue    → Queue.tsx      (live BullMQ job table)
/admin/settings → Settings.tsx   (pricing config)
```

**Sidebar Navigation** defined in [`AdminLayout.tsx` L95-L108](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/layouts/AdminLayout.tsx#L95): 4 `NavLink` entries matching the routes above.

**Target New Routes:**
```
/admin/analytics             → Analytics landing (date range picker + tab selector)
/admin/analytics/financial   → Financial Ledger view
/admin/analytics/telemetry   → Fleet Telemetry view
/admin/analytics/archive     → Job Archive (paginated table)
```

---

### 4.3 — Required Component Tree for Analytics

**Global Date Range Context** (new, shared across all 3 views):
```
DateRangeContext (React Context)
└── provides: { startDate, endDate, setStartDate, setEndDate, presets }
    └── DateRangePicker component
        ├── Preset buttons (Today, Last 7 Days, Last 30 Days, Custom)
        └── Two <input type="date"> fields for custom range
```

**View 1 — Financial Ledger (`/admin/analytics/financial`):**
```
FinancialLedger (page)
├── DateRangePicker (consumes DateRangeContext)
├── SummaryCards (total revenue, total jobs, avg cost)
├── RevenueTrendChart
│   └── <AreaChart> — daily revenue over time (x=date, y=revenue)
├── RevenueHeatmap
│   └── <BarChart> — grouped bar: Color revenue vs. B&W revenue per day
└── PaymentReconciliation
    └── <PieChart> — Quoted cost vs. Collected payments vs. Refunds
```

**View 2 — Fleet Telemetry (`/admin/analytics/telemetry`):**
```
FleetTelemetry (page)
├── DateRangePicker (consumes DateRangeContext)
├── VolumeLeaderboard
│   └── <BarChart horizontal> — total pages per printer, sorted descending
├── ErrorRateChart
│   └── <BarChart grouped> — completed jobs vs. failed jobs per printer
└── PrinterStatCards
    └── Per-printer: totalPages, completedJobs, failedJobs, errorRate %
```

**View 3 — Job Archive (`/admin/analytics/archive`):**
```
JobArchive (page)
├── DateRangePicker (consumes DateRangeContext)
├── FilterBar
│   ├── <select> Status filter (all, completed, failed, pending_payment, etc.)
│   └── <select> Printer filter (dynamic from fleet)
├── ExportCSVButton → GET /analytics/jobs/export?...
├── ArchiveTable
│   ├── Pagination controls (prev/next page, page size selector)
│   └── HTML <table> with columns: JobID, File, Pages, Color, Printer, Cost, Status, SubmittedAt, CompletedAt
└── TotalCount ("Showing X–Y of Z records")
```

---

## Dependency Updates

### Server (`server/package.json`)

| Package | Version (recommended) | Purpose |
|---|---|---|
| `better-sqlite3` | `^11.x` | SQLite Cold Tier database |
| `@types/better-sqlite3` | `^7.x` | TypeScript types (devDependency) |

**Optional (Payment Gateway — choose one):**
| Package | Purpose |
|---|---|
| `razorpay` | Razorpay SDK (India-primary gateway, matches existing `₹` currency in `pricing.service.ts`) |
| `stripe` | Stripe SDK (international) |

### Admin UI (`admin-ui/package.json`)

| Package | Version (recommended) | Purpose |
|---|---|---|
| `react-day-picker` | `^9.x` | Date Range Picker UI component (headless, lightweight, no peer-dep conflicts) |
| `date-fns` | `^4.x` | Date formatting utilities (peer dep of react-day-picker; also useful standalone) |

> [!NOTE]
> `recharts` is already installed and sufficient for all three analytics view charts. No additional charting library is needed. `@tanstack/react-table` is NOT required — the Archive table can be built with a styled HTML `<table>` and server-side pagination, consistent with the existing `Queue.tsx` pattern.

---

## Phase 1 Execution Plan

> [!IMPORTANT]
> **Do not write code before this plan is approved.** Steps must be executed in strict order, as each step is a dependency for subsequent steps.

---

### Step 1: Install Server Dependencies
```
cd server && npm install better-sqlite3 @types/better-sqlite3
```
Optionally: `npm install razorpay` (or `stripe`) depending on chosen payment gateway.

---

### Step 2: Create `server/src/infrastructure/database.ts`
Initialize `better-sqlite3` as a singleton with WAL mode enabled. Define and run all four `CREATE TABLE IF NOT EXISTS` statements (`users`, `printers`, `print_jobs`, `payments`) in the same file. This file is the single source of truth for the schema. Export a `db` singleton.

---

### Step 3: Import `database.ts` in `server.ts`
Add `import './infrastructure/database'` at the top of `server.ts`. This ensures the database file is created and tables are initialized on every server startup before any routes are registered.

---

### Step 4: Create `server/src/infrastructure/printMaster.events.ts`
Instantiate a `QueueEvents` listener bound to the `"print-master"` queue using `redisConnection`. Attach handlers for `completed` and `failed` events. In the `completed` handler: import `db` from `database.ts` and run SQL to `UPDATE print_jobs SET status='completed', executed_by_printer=?, completed_at=? WHERE id=?`. In the `failed` handler: update `print_jobs SET status='failed', error_message=?`. Import this file in `server.ts`.

---

### Step 5: Add `PrintJobData.executedByPrinter` Field
In [`printMaster.queue.ts`](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.queue.ts#L4), add the field `executedByPrinter?: string` to the `PrintJobData` interface. In [`printMaster.worker.ts` L35](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts#L35), add `matchedPrinter` to the `updateData` call: `await job.updateData({ ...job.data, cupsJobId, executedByPrinter: matchedPrinter })`. The QueueEvents listener in Step 4 can now read `job.data.executedByPrinter` reliably.

---

### Step 6: Create `server/src/app/services/payment.service.ts`
Encapsulate the chosen gateway SDK. This service must expose at minimum: `createOrder(amount, currency, jobId)` and `verifySignature(orderId, paymentId, signature)`. This service has no dependencies on the existing codebase and can be written and unit-tested in isolation.

---

### Step 7: Restructure `print.controller.ts`
Rename the existing `printFile` function to `initiateJob`. The new function ends at the point of payment order creation (after the SQLite `INSERT INTO print_jobs` and the `payment.service.createOrder` call) and returns the checkout payload. Add a new function `confirmPayment` that validates the webhook/signature, updates SQLite, and then calls `printMasterQueue.add(...)`. The `eventBus.emit("job_queued")` call moves here.

---

### Step 8: Update `print.routes.ts`
Add the new route `POST /print/confirm` pointing to `printController.confirmPayment`. The webhook endpoint (`POST /print/webhook`) should **not** use `requireAuth` middleware (webhooks are authenticated via signature, not Bearer tokens). Add `POST /print/webhook` → `printController.handleWebhook`.

---

### Step 9: Create `server/src/app/services/analytics.service.ts`
Implement all SQL query functions used by the analytics API: `getFinancialSummary(startDate, endDate)`, `getRevenueTrend(startDate, endDate)`, `getFleetTelemetry(startDate, endDate)`, `getJobArchive(filters, page, limit)`, `getJobArchiveCount(filters)`. All functions use the `db` singleton from Step 2.

---

### Step 10: Create `server/src/app/controllers/analytics.controller.ts` and `server/src/app/routes/analytics.routes.ts`
Controller wraps each `analytics.service` function with HTTP parsing, date validation, and JSON response. Route file registers all endpoints under `/analytics/`, protected by `requireAuth`. Register the new route in `app.ts`: `app.use('/analytics', analyticsRoutes)`.

---

### Step 11: Install Frontend Dependencies
```
cd admin-ui && npm install react-day-picker date-fns
```

---

### Step 12: Create Frontend Date Range Infrastructure
1. Create `admin-ui/src/context/DateRangeContext.tsx` — provides `startDate`, `endDate`, and setter functions. Include preset shortcuts (Today, 7 days, 30 days).
2. Create `admin-ui/src/components/shared/DateRangePicker.tsx` — consumes the context and renders a compact date range UI.
3. Wrap `AdminLayout` children (or the analytics sub-routes) with `<DateRangeProvider>` in `App.tsx`.

---

### Step 13: Build Analytics Pages and Register Routes
In order:
1. Create `admin-ui/src/pages/admin/Analytics.tsx` (landing/tab router).
2. Create `admin-ui/src/pages/admin/analytics/Financial.tsx`.
3. Create `admin-ui/src/pages/admin/analytics/Telemetry.tsx`.
4. Create `admin-ui/src/pages/admin/analytics/Archive.tsx` (with CSV export button and pagination).
5. Add 4 new `<Route>` entries in `App.tsx` for `/admin/analytics/*`.
6. Add an "Analytics" `NavLink` entry to `AdminLayout.tsx`'s sidebar navigation.
7. Add `useAnalyticsStore` to `admin-ui/src/stores/` (or extend `useAdminStore`) with action functions that call the new `/analytics/*` API endpoints.
8. Add analytics API methods to `admin-ui/src/services/api.ts`.

---

> [!TIP]
> **Verification Checkpoint after Step 3:** Verify the SQLite `.db` file is created on disk in the project root (or a `data/` directory) on server startup with all four tables present. Use `sqlite3 print_spooler.db .schema` to inspect.
>
> **Verification Checkpoint after Step 4:** Submit a test print job and verify the `print_jobs` record appears in SQLite immediately (with `status = 'pending_payment'` if Step 7 is done, or `status = 'queued'` if testing Step 4 in isolation before the payment gateway is wired). After the job completes, verify the `status`, `executed_by_printer`, and `completed_at` fields are populated.
