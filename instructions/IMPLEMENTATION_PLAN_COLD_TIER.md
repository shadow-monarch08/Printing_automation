# Implementation Plan — Cold Tier SQLite Upgrade
### Phase 1 Architecture Upgrade · Print Spooler System
**Date:** 2026-06-01 · **Status:** Awaiting Approval

---

## Preamble: Key Decisions from Gap Analysis → Instruction 18 Delta

The following decisions were made on top of the original gap analysis (`reports/gap_analysis_report_2.md`), as codified in `instructions/instruction_18.md`:

| Gap Analysis Recommendation | Instruction 18 Override | Impact |
|---|---|---|
| Build payment gateway (Razorpay/Stripe) with full webhook flow | **Deferred.** Build only the "seam" — SQLite INSERT with `status: 'queued'` before BullMQ enqueue. No gateway SDK. | Steps 6–8 from the gap analysis are **removed**. `payment.service.ts`, `POST /print/confirm`, `POST /print/webhook` routes are NOT built in this phase. |
| `print_jobs.status` includes `pending_payment` | **Changed to `queued`** as the initial state. No `pending_payment` status in this phase. | Simplifies the write path — no two-step controller split. |
| Frontend uses `react-day-picker` + `date-fns` | **Changed to `dayjs`** with a fully custom DateRangePicker. No `react-day-picker` dependency. | Lighter footprint, no third-party calendar UI. |
| Frontend uses `<input type="date">` for custom date ranges | **Prohibited.** Custom calendar component using `dayjs` is mandatory. | Requires building month-grid calendar from scratch. |
| Analytics uses nested React Router routes (`/admin/analytics/financial`, etc.) | **Changed to a single `/admin/analytics` route** with local state tab switching. | All three views live inside one page component. No new route entries except one. |
| CSS approach: Vanilla CSS (existing codebase) | Instruction says "Tailwind CSS" but the **entire codebase uses Vanilla CSS** with CSS custom properties. | **Reconciliation:** We will style the DateRangePicker and Analytics page using the existing vanilla CSS design system (`theme.css`, `components.css`). We will NOT introduce Tailwind CSS as it would create a style-system schism with the existing 8 CSS files. If Tailwind is desired, it should be a separate migration covering the entire admin-ui. |
| `payments` table | **Still created** (schema only, unpopulated). The table exists as a placeholder for the future payment gateway integration. |
| Service Layer Isolation | **New constraint** — controllers must never write raw SQL. All DB operations go through service files. | Adds a `db.service.ts` or similar abstraction layer. |

---

## Strict Development Constraints (from instruction_18.md)

> [!CAUTION]
> These are hard blockers. Violating any of these is a plan rejection.

1. **No Razorpay/Stripe code.** Build only the payment table schema and the SQLite INSERT seam.
2. **`executedByPrinter`** must be written on **both** `completed` AND `failed` QueueEvents.
3. **Single `/admin/analytics` route.** Three views via local state tabs. No nested routes.
4. **No `<input type="date">`.** Custom calendar component with `dayjs`.
5. **No `@tanstack/react-table`.** Raw HTML `<table>` with server-side pagination.
6. **Service layer isolation.** Controllers never write raw SQL.

---

## Phase 1: SQLite Infrastructure & Initialization

### Step 1.1 — Install Server Dependencies

```bash
cd server
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

**Files Changed:** `server/package.json`, `server/package-lock.json`

---

### Step 1.2 — Create Database Singleton

**[NEW] `server/src/infrastructure/database.ts`**

This file is the single source of truth for the SQLite schema. It will:

1. Import `better-sqlite3`.
2. Resolve the database file path to `server/data/print_spooler.db` (auto-creating the `data/` directory via `fs.mkdirSync` with `{ recursive: true }`).
3. Instantiate the `Database` singleton.
4. Enable WAL mode via `db.pragma('journal_mode = WAL')`.
5. Enable foreign keys via `db.pragma('foreign_keys = ON')`.
6. Execute five `CREATE TABLE IF NOT EXISTS` statements inside a single `db.exec()` call:

**`kiosk_sessions` table (replaces the former `users` table):**
```sql
CREATE TABLE IF NOT EXISTS kiosk_sessions (
  session_id TEXT PRIMARY KEY,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);
```

**`system_config` table (NEW — single-row hardware/shop config):**
```sql
CREATE TABLE IF NOT EXISTS system_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_onboarded BOOLEAN NOT NULL DEFAULT 0,
  cloudflare_url TEXT,
  shop_name TEXT DEFAULT 'Modern Press',
  admin_pin_hash TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**`printers` table (updated with quarantine fields):**
```sql
CREATE TABLE IF NOT EXISTS printers (
  id TEXT PRIMARY KEY,
  alias TEXT,
  capabilities TEXT DEFAULT '[]',
  is_quarantined BOOLEAN NOT NULL DEFAULT 0,
  strike_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**`print_jobs` table (updated FK: `user_id` → `session_id`):**
```sql
CREATE TABLE IF NOT EXISTS print_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  pages INTEGER NOT NULL DEFAULT 1,
  copies INTEGER NOT NULL DEFAULT 1,
  color_mode TEXT NOT NULL DEFAULT 'grayscale',
  duplex TEXT NOT NULL DEFAULT 'single',
  cost INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  executed_by_printer TEXT,
  error_message TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (session_id) REFERENCES kiosk_sessions(session_id),
  FOREIGN KEY (executed_by_printer) REFERENCES printers(id)
);
```

**`payments` table (created now, populated later):**
```sql
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  print_job_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'initiated',
  gateway TEXT,
  gateway_reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (print_job_id) REFERENCES print_jobs(id)
);
```

6. Create indexes for query performance:
```sql
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_submitted_at ON print_jobs(submitted_at);
CREATE INDEX IF NOT EXISTS idx_print_jobs_printer ON print_jobs(executed_by_printer);
CREATE INDEX IF NOT EXISTS idx_print_jobs_color ON print_jobs(color_mode);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON kiosk_sessions(expires_at);
```

7. Export the `db` singleton for use across the codebase.
8. Log `🗄️ SQLite Cold Tier initialized (WAL mode)` on successful setup.

**Design Rationale:**
- `TEXT` for timestamps (ISO 8601 strings) — SQLite's `datetime()` functions work natively with ISO strings.
- `INTEGER` for `cost`/`amount` — avoids floating-point precision issues; values are in the minimum currency unit (paise/cents).
- FK constraints declared but FK enforcement enabled via pragma — allows the seam to work without requiring printers to be pre-registered in SQLite.

---

### Step 1.3 — Import in Server Entry Point

**[MODIFY] `server/src/server.ts`**

Add as the **first import** (before queue/worker imports):
```typescript
import "./infrastructure/database";
```

Current import order after modification:
```
import "./infrastructure/database";        // ← NEW (must be first)
import "./infrastructure/printMaster.queue";
import "./infrastructure/printMaster.worker";
import app from "./app";
...
```

**Why first?** The database must be initialized before any service or controller that might reference it. Queue/worker imports follow because they depend on Redis, not SQLite.

---

### Step 1.4 — Add `data/` to `.gitignore`

**[MODIFY] `.gitignore`**

Append:
```
server/data/
```

The `.db`, `.db-wal`, and `.db-shm` files should never be committed to version control.

---

### ✅ Verification Checkpoint — Phase 1

After completing Steps 1.1–1.4:
1. Run `npm run dev` in `server/`.
2. Confirm console output includes `🗄️ SQLite Cold Tier initialized (WAL mode)`.
3. Confirm `server/data/print_spooler.db` file exists on disk.
4. Inspect schema: `sqlite3 server/data/print_spooler.db ".schema"` — all 4 tables and indexes should be present.

---

## Phase 2: Modular Event Syncing

### Step 2.1 — Add `executedByPrinter` to PrintJobData Interface

**[MODIFY] `server/src/infrastructure/printMaster.queue.ts`**

Add the new field to the `PrintJobData` interface (after `cupsJobId`):
```typescript
executedByPrinter?: string;  // Populated by worker on dispatch
```

No other changes to this file.

---

### Step 2.2 — Write `matchedPrinter` Back to Job Data in Worker

**[MODIFY] `server/src/infrastructure/printMaster.worker.ts`**

At line 35, modify the existing `updateData` call:
```typescript
// BEFORE:
await job.updateData({ ...job.data, cupsJobId });

// AFTER:
await job.updateData({ ...job.data, cupsJobId, executedByPrinter: matchedPrinter });
```

This ensures that when QueueEvents fires `completed` or `failed`, the `job.data.executedByPrinter` field is already populated and can be read by the events listener without needing to parse `job.returnvalue`.

**Why both completed and failed?** On failure (line 93), the `attemptedPrinters` array is updated but the `executedByPrinter` is NOT set because the failure path jumps before line 35 runs. We need to also write it on the failure path.

At line 93 (inside the failure/failover block), modify:
```typescript
// BEFORE:
await job.updateData({ ...job.data, attemptedPrinters: attempts });

// AFTER:
await job.updateData({ ...job.data, attemptedPrinters: attempts, executedByPrinter: matchedPrinter });
```

---

### Step 2.3 — Create Print Job Database Service

**[NEW] `server/src/app/services/printJob.db.service.ts`**

This service encapsulates all SQLite `print_jobs` table operations. Controllers and event listeners call these functions — they never write raw SQL.

**Exported Functions:**

```typescript
insertJob(job: {
  id: string;
  sessionId: string;
  filename: string;
  pages: number;
  copies: number;
  colorMode: string;
  duplex: string;
  cost: number;
  submittedAt: string;
}): void
```
- Executes: `INSERT INTO print_jobs (id, session_id, filename, pages, copies, color_mode, duplex, cost, status, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`
- Uses a **prepared statement** (`.prepare().run()`) for performance.

```typescript
markCompleted(jobId: string, printer: string, completedAt: string): void
```
- Executes: `UPDATE print_jobs SET status = 'completed', executed_by_printer = ?, completed_at = ? WHERE id = ?`

```typescript
markFailed(jobId: string, printer: string | null, errorMessage: string, completedAt: string): void
```
- Executes: `UPDATE print_jobs SET status = 'failed', executed_by_printer = ?, error_message = ?, completed_at = ? WHERE id = ?`

```typescript
upsertSession(sessionId: string, userAgent?: string, ipAddress?: string): void
```
- Executes: `INSERT INTO kiosk_sessions (session_id, user_agent, ip_address) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`
- Idempotent — safe to call on every request; a repeat `session_id` is silently ignored.
- This is the anonymous kiosk session model — no passwords, no auth changes needed.

---

### Step 2.4 — Create QueueEvents Listener

**[NEW] `server/src/infrastructure/printMaster.events.ts`**

This is the **write-behind sync** module — decoupled from the worker, listening to BullMQ's Redis streams.

1. Import `QueueEvents` from `bullmq`.
2. Import `redisConnection` from `./redis`.
3. Import `printMasterQueue` from `./printMaster.queue` (needed to fetch full job data).
4. Import `{ markCompleted, markFailed }` from `../app/services/printJob.db.service`.

5. Instantiate:
```typescript
const printMasterEvents = new QueueEvents("print-master", {
  connection: redisConnection,
});
```

6. Attach `completed` handler:
```typescript
printMasterEvents.on("completed", async ({ jobId, returnvalue }) => {
  try {
    const job = await printMasterQueue.getJob(jobId);
    if (!job) return;

    const printer = job.data.executedByPrinter || returnvalue?.printer || null;
    const completedAt = job.finishedOn
      ? new Date(job.finishedOn).toISOString()
      : new Date().toISOString();

    markCompleted(jobId, printer, completedAt);
    console.log(`[ColdTier] Job ${jobId} → completed on ${printer}`);
  } catch (err) {
    console.error(`[ColdTier] Failed to sync completed job ${jobId}`, err);
  }
});
```

7. Attach `failed` handler:
```typescript
printMasterEvents.on("failed", async ({ jobId, failedReason }) => {
  try {
    const job = await printMasterQueue.getJob(jobId);
    if (!job) return;

    const printer = job.data.executedByPrinter
      || job.data.attemptedPrinters?.[job.data.attemptedPrinters.length - 1]
      || null;
    const completedAt = job.finishedOn
      ? new Date(job.finishedOn).toISOString()
      : new Date().toISOString();

    markFailed(jobId, printer, failedReason || "Unknown error", completedAt);
    console.log(`[ColdTier] Job ${jobId} → failed on ${printer}`);
  } catch (err) {
    console.error(`[ColdTier] Failed to sync failed job ${jobId}`, err);
  }
});
```

8. Log ready state:
```typescript
printMasterEvents.on("ready", () => {
  console.log("📡 ColdTier QueueEvents listener active");
});
```

**Why `QueueEvents` and not worker-local `.on()`?**
- QueueEvents listens to BullMQ's Redis stream (a separate Redis connection), making it process-agnostic. If we ever scale to multiple worker processes, this listener still works.
- Worker-local `.on("completed")` is already handling printer lock release and file cleanup — those concerns remain there. The SQLite write is a separate cross-cutting concern.

---

### Step 2.5 — Import QueueEvents in Server Entry Point

**[MODIFY] `server/src/server.ts`**

Add the import after the existing worker import:
```typescript
import "./infrastructure/database";
import "./infrastructure/printMaster.queue";
import "./infrastructure/printMaster.worker";
import "./infrastructure/printMaster.events";   // ← NEW
import app from "./app";
```

---

### Step 2.6 — Insert SQLite Record at Job Birth (The "Seam")

**[MODIFY] `server/src/app/controllers/print.controller.ts`**

In the `printFile` function, insert a SQLite record **immediately before** the BullMQ enqueue (line 52). This is the payment gateway seam — in the future, `status: 'queued'` becomes `status: 'pending_payment'`, and the BullMQ enqueue moves to a webhook handler.

Add imports at the top:
```typescript
import { insertJob, upsertSession } from "../services/printJob.db.service";
```

Insert between line 49 (end of `jobData` construction) and line 52 (`printMasterQueue.add`):
```typescript
// === COLD TIER SEAM ===
// Future: This INSERT will use status 'pending_payment' and the BullMQ
// enqueue below will move to a POST /print/confirm webhook handler.
if (sessionId) upsertSession(sessionId, req.headers['user-agent'], req.ip);
insertJob({
  id: jobId,
  sessionId: sessionId ?? 'anonymous',
  filename: req.file.originalname,
  pages,
  copies,
  colorMode,
  duplex,
  cost,
  submittedAt: new Date().toISOString(),
});
// === END COLD TIER SEAM ===

// Enqueue job via BullMQ (Hot Tier)
await printMasterQueue.add("print", jobData as any, { jobId });
```

**Why synchronous SQLite before async BullMQ?** `better-sqlite3` is synchronous — the INSERT completes in microseconds. If it throws (e.g., duplicate ID), the job never reaches BullMQ, which is the correct behavior. If BullMQ enqueue fails, we have a dangling SQLite record with `status: 'queued'` but no matching Redis job — this is acceptable and can be cleaned up by a future reconciliation sweep.

---

### ✅ Verification Checkpoint — Phase 2

After completing Steps 2.1–2.6:
1. Start the server.
2. Submit a print job via the kiosk frontend.
3. Query SQLite: `SELECT * FROM print_jobs;` — a row should appear with `status = 'queued'`, `executed_by_printer = NULL`.
4. After the job completes (or fails), query again — `status` should be `completed`/`failed`, `executed_by_printer` should contain the printer queue name, `completed_at` should be populated.
5. Query `SELECT * FROM users;` — if a `sessionId` was sent, a user row should exist.

---

## Phase 3: Analytics API Layer

### Step 3.1 — Create Analytics Service

**[NEW] `server/src/app/services/analytics.service.ts`**

This service contains all SQL query logic for the analytics endpoints. Every function accepts `startDate` and `endDate` as ISO date strings and uses parameterized queries.

**Financial Aggregations:**

```typescript
getFinancialSummary(startDate: string, endDate: string): {
  totalRevenue: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgCostPerJob: number;
}
```
- SQL: `SELECT COUNT(*) as totalJobs, SUM(CASE WHEN status='completed' THEN cost ELSE 0 END) as totalRevenue, ... FROM print_jobs WHERE submitted_at BETWEEN ? AND ?`

```typescript
getRevenueTrend(startDate: string, endDate: string): Array<{
  date: string;
  revenue: number;
  jobCount: number;
}>
```
- SQL: `SELECT date(submitted_at) as date, SUM(cost) as revenue, COUNT(*) as jobCount FROM print_jobs WHERE status = 'completed' AND submitted_at BETWEEN ? AND ? GROUP BY date(submitted_at) ORDER BY date ASC`

```typescript
getColorSplit(startDate: string, endDate: string): {
  colorRevenue: number;
  colorJobs: number;
  bwRevenue: number;
  bwJobs: number;
}
```
- SQL: `SELECT color_mode, SUM(cost) as revenue, COUNT(*) as jobs FROM print_jobs WHERE status = 'completed' AND submitted_at BETWEEN ? AND ? GROUP BY color_mode`

**Fleet Telemetry:**

```typescript
getFleetTelemetry(startDate: string, endDate: string): Array<{
  printer: string;
  totalPages: number;
  completedJobs: number;
  failedJobs: number;
  errorRate: number;
}>
```
- SQL (two queries merged in code):
  - Completed: `SELECT executed_by_printer, SUM(pages * copies) as totalPages, COUNT(*) as completedJobs FROM print_jobs WHERE status = 'completed' AND executed_by_printer IS NOT NULL AND submitted_at BETWEEN ? AND ? GROUP BY executed_by_printer`
  - Failed: `SELECT executed_by_printer, COUNT(*) as failedJobs FROM print_jobs WHERE status = 'failed' AND executed_by_printer IS NOT NULL AND submitted_at BETWEEN ? AND ? GROUP BY executed_by_printer`
  - Merge both result sets in JavaScript, calculate `errorRate = failedJobs / (completedJobs + failedJobs) * 100`.

**Job Archive (paginated):**

```typescript
getJobArchive(filters: {
  startDate: string;
  endDate: string;
  status?: string;
  printer?: string;
  page: number;
  limit: number;
}): { jobs: Array<...>; total: number; page: number; limit: number; totalPages: number; }
```
- Build a dynamic WHERE clause based on which filters are provided.
- Count query: `SELECT COUNT(*) as total FROM print_jobs WHERE ...`
- Data query: `SELECT * FROM print_jobs WHERE ... ORDER BY submitted_at DESC LIMIT ? OFFSET ?`
- `OFFSET = (page - 1) * limit`

```typescript
getJobArchiveCSV(filters: { startDate, endDate, status?, printer? }): string
```
- Same WHERE clause as above, but no LIMIT/OFFSET.
- Maps rows to CSV string: header row + data rows joined by newlines.
- Returns raw string — the controller sets `Content-Type: text/csv`.

---

### Step 3.2 — Create Analytics Controller

**[NEW] `server/src/app/controllers/analytics.controller.ts`**

Five handler functions, each parsing query parameters and delegating to `analytics.service.ts`:

| Handler | Endpoint | Service Call |
|---|---|---|
| `getFinancialSummary` | `GET /analytics/financial/summary` | `analytics.getFinancialSummary(start, end)` |
| `getRevenueTrend` | `GET /analytics/financial/trend` | `analytics.getRevenueTrend(start, end)` |
| `getColorSplit` | `GET /analytics/financial/color-split` | `analytics.getColorSplit(start, end)` |
| `getFleetTelemetry` | `GET /analytics/fleet` | `analytics.getFleetTelemetry(start, end)` |
| `getJobArchive` | `GET /analytics/jobs` | `analytics.getJobArchive(filters)` |
| `exportJobsCSV` | `GET /analytics/jobs/export` | `analytics.getJobArchiveCSV(filters)` |

**Date validation:** All handlers validate that `startDate` and `endDate` query params exist and are valid ISO date strings. Default: `startDate = today - 30 days`, `endDate = today` (using plain `Date` constructor on the server — no `dayjs` needed server-side).

---

### Step 3.3 — Create Analytics Routes

**[NEW] `server/src/app/routes/analytics.routes.ts`**

```typescript
import { Router } from "express";
import * as analyticsController from "../controllers/analytics.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/financial/summary", requireAuth, analyticsController.getFinancialSummary);
router.get("/financial/trend", requireAuth, analyticsController.getRevenueTrend);
router.get("/financial/color-split", requireAuth, analyticsController.getColorSplit);
router.get("/fleet", requireAuth, analyticsController.getFleetTelemetry);
router.get("/jobs", requireAuth, analyticsController.getJobArchive);
router.get("/jobs/export", requireAuth, analyticsController.exportJobsCSV);

export default router;
```

---

### Step 3.4 — Register Analytics Routes in App

**[MODIFY] `server/src/app.ts`**

Add import:
```typescript
import analyticsRoutes from "./app/routes/analytics.routes";
```

Add route registration (before the catch-all):
```typescript
app.use("/analytics", analyticsRoutes);
```

---

### ✅ Verification Checkpoint — Phase 3

After completing Steps 3.1–3.4:
1. Start the server.
2. Submit several test print jobs (varying color modes, printers) and let them complete/fail.
3. Test: `curl -H "Authorization: Bearer <token>" "http://localhost:3000/analytics/financial/summary?startDate=2026-01-01&endDate=2026-12-31"`
4. Test: `curl -H "Authorization: Bearer <token>" "http://localhost:3000/analytics/jobs?page=1&limit=10"`
5. Test CSV export: `curl -H "Authorization: Bearer <token>" "http://localhost:3000/analytics/jobs/export?startDate=2026-01-01&endDate=2026-12-31" -o export.csv`

---

## Phase 4: Frontend Implementation

### Step 4.1 — Install Frontend Dependencies

```bash
cd admin-ui
npm install dayjs
```

**Only `dayjs` is installed.** No `react-day-picker`, no `date-fns`, no `@tanstack/react-table`. `recharts` is already installed and will be used for all charts.

---

### Step 4.2 — Add Analytics API Methods

**[MODIFY] `admin-ui/src/services/api.ts`**

Add new methods to the `api` object:

```typescript
// Analytics API
fetchFinancialSummary: async (startDate: string, endDate: string) => { ... },
fetchRevenueTrend: async (startDate: string, endDate: string) => { ... },
fetchColorSplit: async (startDate: string, endDate: string) => { ... },
fetchFleetTelemetry: async (startDate: string, endDate: string) => { ... },
fetchJobArchive: async (params: { startDate, endDate, status?, printer?, page, limit }) => { ... },
exportJobsCSV: (startDate: string, endDate: string, status?: string, printer?: string) => {
  // Returns a URL string for direct download (window.open or <a> tag)
  const params = new URLSearchParams({ startDate, endDate });
  if (status) params.set('status', status);
  if (printer) params.set('printer', printer);
  return `/analytics/jobs/export?${params.toString()}`;
},
```

---

### Step 4.3 — Build Custom DateRangePicker Component

**[NEW] `admin-ui/src/components/shared/DateRangePicker.tsx`**

A self-contained, fully custom date range picker using `dayjs`. **No `<input type="date">` tags anywhere.**

**Component Structure:**
```
DateRangePicker
├── Preset Buttons Bar
│   ├── "Today" button
│   ├── "Last 7 Days" button
│   ├── "Last 30 Days" button
│   └── "Custom" toggle button
├── Custom Range Panel (shown when "Custom" is active)
│   ├── MonthCalendar (left: startDate month)
│   │   ├── Month/Year header with ◀/▶ navigation
│   │   ├── Weekday labels row (Su Mo Tu We Th Fr Sa)
│   │   └── Day grid (6 rows × 7 cols)
│   │       └── Each day cell: clickable, highlights range
│   └── MonthCalendar (right: endDate month)
│       └── (same as above)
└── "Apply" button to confirm custom range
```

**Props Interface:**
```typescript
interface DateRangePickerProps {
  startDate: string;  // ISO date string YYYY-MM-DD
  endDate: string;
  onChange: (start: string, end: string) => void;
}
```

**Internal State:**
- `isCustomOpen: boolean` — toggles the calendar panel.
- `viewMonth: Dayjs` — the currently displayed month in the left calendar.
- `selectionStart: Dayjs | null` — first click in range selection.
- `hoverDate: Dayjs | null` — for hover-preview highlighting.

**Styling:** Uses the existing CSS custom property system (`var(--bg-surface)`, `var(--accent-primary)`, `var(--text-primary)`, etc.). New CSS classes added to a new file `admin-ui/src/styles/analytics.css`:
- `.date-picker-presets` — flex row of preset buttons.
- `.date-picker-calendar` — the calendar grid container.
- `.date-picker-day` — individual day cells.
- `.date-picker-day.in-range` — highlighted range background.
- `.date-picker-day.selected` — start/end day accent color.
- `.date-picker-day.today` — subtle border for today's date.

---

### Step 4.4 — Build the Single Analytics Page with Tabbed Views

**[NEW] `admin-ui/src/pages/admin/Analytics.tsx`**

This is a single page component. No nested routes. Tab state is managed via `useState<'financial' | 'telemetry' | 'archive'>`.

**Component Structure:**
```
Analytics (page)
├── Page Header ("Analytics & Reporting")
├── DateRangePicker (shared across all tabs)
│   └── State: startDate, endDate (local useState)
├── Tab Bar
│   ├── "Financial Ledger" tab
│   ├── "Fleet Telemetry" tab
│   └── "Job Archive" tab
├── {activeTab === 'financial' && <FinancialView />}
├── {activeTab === 'telemetry' && <TelemetryView />}
└── {activeTab === 'archive' && <ArchiveView />}
```

**Date state lives at the top level** and is passed down to each view as props. When the date range changes, all views re-fetch their data.

---

### Step 4.5 — Financial Ledger View

**[NEW] `admin-ui/src/pages/admin/analytics/FinancialView.tsx`**

Receives `startDate` and `endDate` as props. Fetches data from three endpoints on mount and when dates change.

**Layout:**
```
FinancialView
├── Summary Cards Row (4 cards)
│   ├── Total Revenue (₹)
│   ├── Total Jobs
│   ├── Completed Jobs
│   └── Avg Cost / Job
├── Revenue Trend Chart
│   └── <AreaChart> from recharts (x=date, y=revenue, area fill)
└── Color vs B&W Split
    ├── <BarChart> — grouped bars showing color vs grayscale revenue
    └── Summary text: "Color: ₹X (N jobs) · B&W: ₹Y (M jobs)"
```

**Data fetching:** Uses `useEffect` with `[startDate, endDate]` dependency array. Three parallel `api.fetchFinancialSummary()`, `api.fetchRevenueTrend()`, `api.fetchColorSplit()` calls.

---

### Step 4.6 — Fleet Telemetry View

**[NEW] `admin-ui/src/pages/admin/analytics/TelemetryView.tsx`**

Receives `startDate` and `endDate` as props. Single API call to `api.fetchFleetTelemetry()`.

**Layout:**
```
TelemetryView
├── Volume Leaderboard
│   └── <BarChart horizontal> — total pages per printer, sorted descending
├── Error Rate Chart
│   └── <BarChart grouped> — completed vs failed per printer
└── Printer Summary Cards
    └── For each printer: card with totalPages, completed, failed, errorRate%
```

---

### Step 4.7 — Job Archive View

**[NEW] `admin-ui/src/pages/admin/analytics/ArchiveView.tsx`**

Receives `startDate` and `endDate` as props. Manages its own pagination and filter state locally.

**Local State:**
- `page: number` (default 1)
- `limit: number` (default 25, options: 10, 25, 50)
- `statusFilter: string | ''` (empty = all)
- `printerFilter: string | ''` (empty = all)

**Layout:**
```
ArchiveView
├── Filter Bar
│   ├── Status <select> (All, Queued, Completed, Failed, Canceled)
│   ├── Printer <select> (All, ...dynamic printer names from data)
│   ├── Page Size <select> (10, 25, 50)
│   └── "Export CSV" <Button> → opens download URL
├── Results Summary ("Showing 1–25 of 142 records")
├── <table> (raw HTML, styled with existing CSS classes)
│   ├── <thead> — Job ID, File, Pages, Color, Duplex, Printer, Cost, Status, Submitted, Completed
│   └── <tbody> — mapped from API response
└── Pagination Controls
    ├── "← Previous" button (disabled if page === 1)
    ├── Page indicator ("Page 1 of 6")
    └── "Next →" button (disabled if page === totalPages)
```

**CSV Export:** Constructs the download URL using `api.exportJobsCSV()` and opens it via `window.open()` (the browser handles the download via `Content-Disposition: attachment`). The auth token is passed as a query parameter since `window.open` can't set headers.

---

### Step 4.8 — Add Analytics Styles

**[NEW] `admin-ui/src/styles/analytics.css`**

Contains all analytics-specific CSS classes:
- Tab bar styling (`.analytics-tabs`, `.analytics-tab`, `.analytics-tab.active`)
- Date picker calendar grid (`.date-picker-*` classes from Step 4.3)
- Summary card grid for analytics (reuses existing `.card` class)
- Table enhancements for archive view (reuses existing `.table` class from `components.css`)
- Filter bar layout

This file is imported in `Analytics.tsx`.

---

### Step 4.9 — Register Route and Sidebar Navigation

**[MODIFY] `admin-ui/src/App.tsx`**

Add import:
```typescript
import { Analytics } from './pages/admin/Analytics';
```

Add single route (after the Settings route, before the catch-all):
```typescript
<Route path="/admin/analytics" element={<AdminLayout><Analytics /></AdminLayout>} />
```

**[MODIFY] `admin-ui/src/layouts/AdminLayout.tsx`**

Add a new `NavLink` in the sidebar navigation (after "Pricing & Settings"):
```typescript
<NavLink to="/admin/analytics" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
  <BarChart3 size={20} /> Analytics
</NavLink>
```

Import `BarChart3` from `lucide-react` (already installed as a dependency).

---

### ✅ Verification Checkpoint — Phase 4

After completing Steps 4.1–4.9:
1. Run `npm run dev` in `admin-ui/`.
2. Navigate to `/admin` → sidebar should show "Analytics" as a new nav item.
3. Click "Analytics" → should land on the Analytics page with a DateRangePicker and three tabs.
4. Select "Last 30 Days" → all three views should fetch and display data from the backend.
5. Switch tabs → views should render without page navigation.
6. In Job Archive tab: test pagination (Next/Previous), test filters, test CSV export button.
7. In Financial tab: verify the revenue trend chart renders with date-based x-axis.
8. In Telemetry tab: verify the per-printer bar charts render.

---

## Summary: Files Created/Modified

### New Files (9)

| # | File | Purpose |
|---|---|---|
| 1 | `server/src/infrastructure/database.ts` | SQLite singleton + schema |
| 2 | `server/src/infrastructure/printMaster.events.ts` | QueueEvents write-behind sync |
| 3 | `server/src/app/services/printJob.db.service.ts` | Print job SQLite CRUD |
| 4 | `server/src/app/services/analytics.service.ts` | Analytics SQL queries |
| 5 | `server/src/app/controllers/analytics.controller.ts` | Analytics HTTP handlers |
| 6 | `server/src/app/routes/analytics.routes.ts` | Analytics route registration |
| 7 | `admin-ui/src/components/shared/DateRangePicker.tsx` | Custom dayjs calendar picker |
| 8 | `admin-ui/src/pages/admin/Analytics.tsx` | Single analytics page + 3 tab views |
| 9 | `admin-ui/src/styles/analytics.css` | Analytics-specific styles |

### Modified Files (7)

| # | File | Change |
|---|---|---|
| 1 | `server/package.json` | Add `better-sqlite3` dependency |
| 2 | `server/src/server.ts` | Import `database.ts` and `printMaster.events.ts` |
| 3 | `server/src/infrastructure/printMaster.queue.ts` | Add `executedByPrinter` to `PrintJobData` |
| 4 | `server/src/infrastructure/printMaster.worker.ts` | Write `executedByPrinter` into job data |
| 5 | `server/src/app/controllers/print.controller.ts` | SQLite INSERT before BullMQ enqueue |
| 6 | `server/src/app.ts` | Register `/analytics` routes |
| 7 | `.gitignore` | Add `server/data/` |

### Frontend Modified Files (3)

| # | File | Change |
|---|---|---|
| 8 | `admin-ui/package.json` | Add `dayjs` dependency |
| 9 | `admin-ui/src/services/api.ts` | Add analytics API methods |
| 10 | `admin-ui/src/App.tsx` | Add `/admin/analytics` route |
| 11 | `admin-ui/src/layouts/AdminLayout.tsx` | Add Analytics sidebar link |

### New Frontend Component Files (3, nested under Analytics.tsx or separate)

| # | File | Purpose |
|---|---|---|
| 12 | `admin-ui/src/pages/admin/analytics/FinancialView.tsx` | Revenue charts |
| 13 | `admin-ui/src/pages/admin/analytics/TelemetryView.tsx` | Fleet statistics |
| 14 | `admin-ui/src/pages/admin/analytics/ArchiveView.tsx` | Paginated job table |

**Total: 12 new files, 11 modified files.**

---

## Dependency Summary

| Package | Where | Version | Type |
|---|---|---|---|
| `better-sqlite3` | `server/` | `^11.x` | production |
| `@types/better-sqlite3` | `server/` | `^7.x` | devDependency |
| `dayjs` | `admin-ui/` | `^1.x` | production |

No Tailwind CSS. No `react-day-picker`. No `date-fns`. No `@tanstack/react-table`. No payment gateway SDK.
