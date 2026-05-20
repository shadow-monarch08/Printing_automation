# 🖨️ Printing Automation — Project Status Report

> **Generated:** 2026-05-07 | **Updated:** 2026-05-12  
> **Scope:** Full codebase audit against `missing_features.txt` requirements (8 categories)  
> **Verdict:** ~30% of the required features are implemented. Core print pipeline works, but critical safety gates, session persistence, robust failure recovery, modular architecture, printer auto-configuration, and admin metrics are missing or incomplete.

---

## Overall Progress Summary

| Category | Status | Completion |
|:---|:---:|:---:|
| 1. Security Gates (Printer Availability) | 🔴 Not Implemented | **~10%** |
| 2. UI ↔ Backend Sync | 🟡 Partially Implemented | **~35%** |
| 3. Robust Printing Logic | 🟡 Partially Implemented | **~50%** |
| 4. Print Admin Special Access | 🟡 Partially Implemented | **~35%** |
| 5. Modular Backend Architecture | 🔴 Not Implemented | **~10%** |
| 6. Printer Configuration | 🔴 Mostly Missing | **~15%** |
| 7. Mobile/PC UI Segregation | 🟡 Partially Implemented | **~65%** |
| 8. Admin System Metrics & Graphs | 🔴 Mostly Missing | **~20%** |

**Overall Project Completion: ~30%**

---

## Requirement 1 — Security Gates (Printer Availability)

> *"Stops user from hitting print in case a specific printer or any printer is not available."*

### 1.1 — Check printer availability when user opens website

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Check if at least one printer is available on page load | 🔴 Missing | No availability check occurs when the user opens the kiosk UI (`DropZone.tsx`). The user can immediately upload a file and proceed regardless of printer fleet status. |
| Block user flow if zero printers are available | 🔴 Missing | No gate exists anywhere in the user flow (`DropZone` → `ConfigConsole` → `QuoteReceipt` → `JobTracker`) that prevents progression when all printers are offline. |
| Check printer availability again before sending print command | 🟡 Partial | The `matchmaker.service.ts` does filter by `idle` status before dispatching, and the worker delays the job if no match is found. However, this is a *backend failsafe*, **not** a pre-print user-facing check. The user is never warned before submission. |

**What exists:**
- `matchmaker.service.ts` → Filters printers by `idle` status and capabilities before dispatching. If no match, the worker delays the job for 15 seconds.
- `printer.service.ts` → `listPrinters()` parses `lpstat -p` output, including idle/busy status.
- `supplies.service.ts` → Multi-protocol supply checking (IPP, SNMP, HP USB, Epson USB, generic USB) with Redis cache.

**What's missing:**
- **Frontend availability gate:** An API call on app startup (e.g., `GET /printers`) that checks if any printer is online/idle. If not, the DropZone should show a blocking state (e.g., "No printers available — please contact staff").
- **Pre-print availability check:** Before the `submitJob()` call in `QuoteReceipt.tsx`, the frontend should verify at least one printer can handle the job.

---

### 1.2 — Show only executable configuration options

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Only show "Color" option if a color printer is available | 🔴 Missing | `ConfigConsole.tsx` always shows both `grayscale` and `color` options unconditionally (lines 71-78). No printer capability data is fetched or used. |
| Only show "Duplex" option if a duplex-capable printer is available | 🔴 Missing | `ConfigConsole.tsx` always shows both `single` and `double` options unconditionally (lines 81-88). No printer capability data is fetched or used. |
| Dynamically filter options based on available printer fleet capabilities | 🔴 Missing | The backend tracks capabilities per printer in `capabilities.json` (with fields like `color`, `duplex`), and `matchmaker.service.ts` filters on them. But this data is **never surfaced to the user kiosk UI**. |

**What exists:**
- `capabilities.json` → Backend config file stores per-printer capabilities (array of strings like `["color", "duplex"]`).
- `matchmaker.service.ts` → Uses capabilities to match jobs to printers at dispatch time.
- `printer.controller.ts` → `getPrinters()` returns capabilities in the API response.

**What's missing:**
- The user kiosk flow does not call `GET /printers` to determine which capabilities are available across the fleet.
- `ConfigConsole.tsx` should dynamically show/hide or enable/disable `color`, `duplex`, and other options based on what the available printer fleet can actually do.

---

## Requirement 2 — UI ↔ Backend Sync

> *"Need to sync the UI for error handling and status updates."*

### 2.1 — UI status updates for job completion

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| UI updates when print job completes | 🟡 Partial | SSE infrastructure exists. Backend emits `job_completed` and `job_failed` events via `eventBus`. Frontend `useSSE.ts` listens and dispatches to stores. However, `handleSSEEvent` in `useUserPrintStore.ts` checks for `JOB_STATUS` and `JOB_FAILED` event types, while the backend emits `job_completed` / `job_active` / `job_failed` — **event type naming mismatch** means the user-facing store likely never processes these events correctly. |
| Real-time status transitions shown in JobTracker | 🟡 Partial | `JobTracker.tsx` renders status icons for `queued`, `spooling`, `printing`, `done`, `failed`. But due to the SSE event type mismatch, status transitions likely stall after `queued`. |

**What exists:**
- Backend `printMaster.worker.ts` → Emits `job_active`, `job_completed`, `job_failed` via `eventBus`.
- Backend `events.controller.ts` → SSE endpoint listens for `job_queued`, `job_active`, `job_completed`, `job_failed`, `printer_discovery`.
- Frontend `useSSE.ts` → Connects to `/events`, dispatches to both `useAdminStore` and `useUserPrintStore`.
- Frontend `useAdminStore.ts` → `handleSSEEvent()` listens for `QUEUE_UPDATE`, `JOB_STATUS`, `JOB_CREATED`, `JOB_FAILED`, triggers queue reload.

**What's broken/missing:**
- **SSE event type mismatch:** Backend emits `{ type: "job_completed", ...data }` (lowercase, snake_case). Frontend `useUserPrintStore.handleSSEEvent()` checks for `event.type === 'JOB_STATUS'` and `event.type === 'JOB_FAILED'` (uppercase). These will never match — the user's `JobTracker` will never transition from `queued` to `done`.
- **No mapping layer:** There is no normalization layer between raw SSE events and the expected frontend `SSEEvent` union type.

---

### 2.2 — Session persistence (sessionId)

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Session ID for user to track jobs across page reloads | 🔴 Missing | No `sessionId` concept exists anywhere in the codebase. The user kiosk store (`useUserPrintStore.ts`) is a Zustand in-memory store — all state is lost on page reload. |
| Persist job tracking state across page refreshes | 🔴 Missing | No `localStorage`/`sessionStorage` persistence for the user's current `jobId`, `jobStatus`, or `currentStep`. If the user reloads during printing, they're sent back to the DropZone (step 1) with no way to recover. |
| "Add new document" button while current job is printing | 🔴 Missing | `JobTracker.tsx` only shows a "Start New Job" button after `done` or `failed`. While a job is actively printing/queued, there's no option to queue an additional document. |

**What exists:**
- `useUserPrintStore.ts` → Tracks `jobId`, `jobStatus`, `jobsAhead`, `currentStep` — but purely in memory.

**What's missing:**
- A session management system (e.g., generate a `sessionId` on first visit, store in `localStorage`, and send with every API call so the backend can associate jobs with sessions).
- Zustand `persist` middleware to save `jobId`, `jobStatus`, `currentStep` to `localStorage` so reload recovers state.
- Backend `GET /jobs?sessionId=xxx` or `GET /jobs?owner=xxx` endpoint to let the user recover their job list.
- "Add Another Document" button in `JobTracker.tsx` that resets the file/config state but retains the active job tracking.

---

### 2.3 — Toast notifications for print job status

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Toast on job submission | ✅ Done | `QuoteReceipt.tsx` line 19: `addToast({ type: 'success', title: 'Job Dispatched', ... })` |
| Toast on job completion | 🔴 Missing | No toast is triggered when a job completes. The SSE event handling doesn't trigger toasts — it only updates internal state (and even that is broken per §2.1). |
| Toast on job failure/error | 🔴 Missing | No toast is triggered when a job fails. |
| Toast when user is NOT on the job tracker page | 🔴 Missing | The requirement specifies toasts should fire when the user navigates away from `JobTracker`. Since the kiosk is a single-page step flow (steps 1-4), once a user starts a new job (step 1), they have no visibility into their prior job. No background toast system for prior job events exists. |

**What exists:**
- Toast infrastructure is solid: `ToastContext.tsx`, `ToastStack.tsx`, `ToastProvider` in `main.tsx`.
- Toasts are used extensively in admin pages (`Fleet.tsx`, `Queue.tsx`, `Settings.tsx`) and for file upload errors in `DropZone.tsx`.

**What's missing:**
- SSE event handlers in the user store should call `addToast()` for `job_completed` and `job_failed`. This requires making the toast context accessible outside React components (e.g., via a global toast emitter or by passing `addToast` into the SSE handler).
- Background notification system that fires toasts even when the user is on a different step.

---

### 2.4 — Comprehensive Job Tracker

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Track ALL document printing jobs for the user | 🔴 Missing | `JobTracker.tsx` only tracks a single job (`jobId`, `jobStatus`). It does not show a list of past/current jobs. |
| Show document name, type, print details for each job | 🟡 Partial | For the single tracked job, it shows `jobId` and `filePreview.name`. Does NOT show type, color mode, duplex, copies, or cost. |
| Show jobs ahead in queue | 🟡 Partial | `jobsAhead` state exists in the store and is rendered in `JobTracker.tsx` for `queued` status, but it's hardcoded to `0` on submission (`submitJob()` line 124: `jobsAhead: 0`). The backend does not send queue position data back. |
| Show cost per job | 🔴 Missing | Cost is not displayed in `JobTracker.tsx`, even though `quote.totalCost` is available in the store. |

**What exists:**
- Single-job tracking with basic status display and icon animations.
- Backend `GET /jobs` returns all jobs with full detail (filename, pages, copies, colorMode, duplex, cost, status, etc.).

**What's missing:**
- A user-facing multi-job list view (or at minimum, a scrollable job history).
- API call from user kiosk to fetch the user's own jobs (filtered by sessionId or owner).
- Display of detailed job info (cost, print config, queue position).
- Real-time `jobsAhead` calculation from the backend.

---

### 2.5 — Graceful handling of missing supply data

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Frontend handles printers not returning supply data | 🟡 Partial | Backend `supplies.service.ts` returns `EMPTY_RESULT` (status: "offline", paper: "unknown", supplies: null/null) when queries fail. The `getPrinters()` controller merges supply data into the printer list. Frontend types (`BackendPrinter`) support `null` values for `supplyBlack`/`supplyColor`. However, the admin UI `Fleet.tsx` may render `null` values without friendly fallback text. |

**What exists:**
- Backend falls back to `EMPTY_RESULT` on any supply query failure.
- Redis cache (5-minute TTL) prevents hammering failing printers.
- Frontend type definitions account for `null` supply values.

**What's missing:**
- Frontend should display "N/A" or "Unknown" for supply levels when data is null, rather than showing blank/missing values.
- No specific UI indicator that a particular printer's supply data is unavailable vs. the printer itself being offline.

---

### 2.6 — SSE events handled globally in Zustand via event bus

> *(New Point) — "The SSE events should be handled globally in the Zustand store using the event bus."*

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| SSE events dispatched to Zustand stores | 🟡 Partial | `useSSE.ts` hook connects to `/events` and dispatches parsed events to both `useAdminStore.handleSSEEvent()` and `useUserPrintStore.handleSSEEvent()`. So the pattern of routing SSE into Zustand exists. |
| Handled via a centralized event bus (not per-component) | 🟡 Partial | The current approach uses a React hook (`useSSE`) mounted in `App.tsx`, which calls `getState()` on Zustand stores. This works but is coupled to the React lifecycle. It is **not** a standalone event bus pattern — if `App` unmounts or re-renders, the SSE connection restarts. |
| Event type normalization | 🔴 Missing | Backend emits snake_case events (`job_completed`, `job_active`). Frontend SSE type union expects UPPER_CASE (`JOB_STATUS`, `JOB_FAILED`). No normalization/mapping layer bridges them. Events silently fall through without matching. |
| Global availability (outside React tree) | 🔴 Missing | The SSE handler only works inside the React tree (via `useSSE` hook). A true global event bus would allow any module (services, utilities) to subscribe — e.g., triggering toasts from the store itself without React context. |

**What exists:**
- `useSSE.ts` → React hook that opens `EventSource`, parses JSON, calls `handleSSEEvent()` on both Zustand stores.
- `useAdminStore.handleSSEEvent()` → Handles `QUEUE_UPDATE`, `JOB_STATUS`, `JOB_CREATED`, `JOB_FAILED`, `PRINTER_DISCOVERED`, `PRINTER_STATUS`, `METRICS_UPDATE`.
- `useUserPrintStore.handleSSEEvent()` → Handles `JOB_STATUS`, `JOB_FAILED`.
- Backend `eventBus.ts` → Node.js `EventEmitter` singleton that the worker and controllers use to emit events.

**What's missing:**
- A **frontend event bus** (e.g., a standalone `EventEmitter` or `mitt` instance) that the SSE connection feeds into, and Zustand stores subscribe to — decoupled from React lifecycle.
- An **event normalization layer** that maps backend event types (`job_completed`) to frontend event types (`JOB_STATUS` with status `done`).
- The ability to attach **side-effect handlers** (toast notifications, sound alerts) to the event bus without needing React context.

---

## Requirement 3 — Robust Printing Logic

> *"Printing logic should not purely depend on checking if printer supply is available."*

### 3.1 — Active failure recovery (not just supply-based)

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Don't rely solely on supply checks | 🟡 Partial | The `matchmaker.service.ts` filters by `idle` status (from `lpstat`), not by supply levels. Supply data is supplementary. However, there's no "test print" or active probe. |
| Try other printer on failure | ✅ Done | `printMaster.worker.ts` implements failover: if a job stalls (held/stopped/30s timeout), it cancels the CUPS job, adds the printer to `attemptedPrinters`, and re-throws to trigger a BullMQ retry on a different printer. |
| Show user that printer is not available if all fail | 🟡 Partial | If all attempts exhaust (3 failover attempts), the job fails and `job_failed` event is emitted. `JobTracker.tsx` shows "Hardware Error — Please contact administrator". But the user is NOT given a choice to wait or retry (see §3.4). |

**What exists:**
- Failover logic in the worker: cancels stuck CUPS jobs, blacklists failed printers, retries on alternates.
- BullMQ configured with `attempts: 4` (1 initial + 3 retries).
- `matchmaker.service.ts` excludes `attemptedPrinters` from candidates.

**What's partially missing:**
- The matchmaker only checks `idle` status — it doesn't do supply-level checks before dispatching. This could be either intentional (per the requirement to not rely on supplies) or a gap.

---

### 3.2 — Startup printer health check

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| On fresh start, check all printers are ready | 🔴 Missing | No startup routine exists. `server.ts` and `app.ts` just start the Express server and BullMQ worker — they do not probe printers. |
| Check by supplies first | 🔴 Missing | No startup supply check. |
| Check by printing a test page on each printer | 🔴 Missing | No test print mechanism exists anywhere in the codebase. |
| Flag failing printers | 🔴 Missing | No printer health flag or status persistence beyond real-time `lpstat` queries. |
| Update service availability based on results | 🔴 Missing | No global "service available/unavailable" flag that would gate the user kiosk. |

**What exists:**
- `listPrinters()` can check `lpstat` status at any time.
- `getSupplies()` can probe supply levels.
- Infrastructure for these checks exists — but no orchestration runs them at startup.

**What's missing:**
- A startup routine (e.g., in `server.ts` or as a separate init service) that:
  1. Lists all printers.
  2. Checks supplies for each.
  3. Optionally sends a small test print.
  4. Flags each printer as `healthy` or `flagged`.
  5. Sets a global `serviceAvailable` flag.
- A `/health/printers` or similar endpoint that reports fleet readiness.

---

### 3.3 — Job retry (max 2 retries per job)

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Retry mechanism for failed jobs | ✅ Done | BullMQ handles retries via `attempts: 4` in queue config. Worker throws errors on failure, triggering BullMQ's built-in retry. |
| Maximum 2 retries only | 🟡 Partial | **BullMQ is configured with `attempts: 4`** (line 24 of `printMaster.queue.ts`), and the worker enforces `attemptedPrinters.length >= 3` as the cap (line 57 of `printMaster.worker.ts`). This means **3 failover retries, not 2 as specified**. The requirement says "only 2 retries for each job, not more". |
| After retries exhausted, follow failure flow | ✅ Done | After 3 failover attempts, the worker throws `"Job failed after 3 failover attempts"`, which causes BullMQ to mark the job as failed. `job_failed` event is emitted. |

**What exists:**
- Full retry + failover pipeline.
- Per-printer blacklisting during failover.
- Event emission on final failure.

**What needs fixing:**
- Change `attempts: 4` → `attempts: 3` (1 initial + 2 retries).
- Change `attemptedPrinters.length >= 3` → `attemptedPrinters.length >= 2`.

---

### 3.4 — User choice on failure (wait or quit)

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Give user option to wait for printer or quit | 🔴 Missing | `JobTracker.tsx` shows "Hardware Error — Please contact administrator" on failure but provides no "Wait for printer" or "Quit" options — only "Start New Job" (which resets everything). |
| User can contact shop owner from their dashboard | 🔴 Missing | No user dashboard exists. No contact/support mechanism or "Ask for help" button. |

**What exists:**
- `JobTracker.tsx` detects `failed` status and shows a "Start New Job" button.

**What's missing:**
- A failure state UI that offers:
  - **"Wait for printer"** — keeps the job in a holding state, re-attempts when a printer comes online.
  - **"Quit"** — cancels the job and resets.
  - **"Contact staff"** — shows a notification to the admin dashboard or a help button.
- Backend support for a "user-hold" job state that waits for admin intervention.

---

### 3.5 — Per-printer force health check from admin dashboard *(New Point)*

> *"If a printer is flagged out of service, but after that the shop owner updates it, there should be an option in the admin dashboard for each printer to force another test and update status."*

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Per-printer "Run Health Check" button in admin Fleet view | 🔴 Missing | `Fleet.tsx` shows each printer card with status badge, paper tray, and ink levels — but there is no button to trigger an on-demand health check for an individual printer. |
| Backend endpoint to trigger health check on a single printer | 🔴 Missing | No such endpoint exists. `printer.service.ts` has `listPrinters()` (which reads `lpstat`) and `getSupplies()` (supply query), but no function that combines them into a "health check" result and updates a persistent flag. |
| Persistent "flagged" / "healthy" status per printer | 🔴 Missing | Printer status is read from `lpstat` in real-time on every call — there is no Redis or DB persistence for a "flagged" state. If a printer is unhealthy at startup, it's never explicitly marked as out-of-service in a way that survives across requests. |
| Clear the flag and mark printer healthy after passing re-test | 🔴 Missing | No flag-clearing mechanism. Printer status only reflects the live `lpstat` output. |
| Show health check progress in admin UI | 🔴 Missing | No loading/progress indicator specific to individual printer health checks. The global "Detect Legacy Hardware" button exists, but that scans for new devices — it does not retest existing flagged printers. |

**What exists:**
- `listPrinters()` in `printer.service.ts` → reads `lpstat -p` for real-time idle/busy/stopped/offline status.
- `getSupplies()` in `supplies.service.ts` → queries ink/paper for a given printer, cached in Redis for 5 min.
- `Fleet.tsx` → per-printer cards with status badge, alias edit, and "Set as Default" button.
- `/health` endpoint in `app.ts` → a simple server ping, **not** a printer health endpoint.

**What's missing:**
- A backend `POST /printers/:name/healthcheck` endpoint that:
  1. Calls `lpstat` to get live status.
  2. Calls `getSupplies()` (bypassing Redis cache) to get fresh supply data.
  3. Optionally sends a small test page to verify the printer responds.
  4. Saves the result (`healthy` / `flagged`) to Redis as a persistent flag.
  5. Returns the updated status to the caller.
- A "Health Check" button on each printer card in `Fleet.tsx` that calls the above endpoint, shows a spinner during the test, and updates the status badge on completion.
- A visual "Flagged — Out of Service" badge that persists on the printer card until a health check passes.

---

## Requirement 4 — Print Admin Special Access

> *"Print admin should have access to special commands which only they can use."*

### 4.1 — Admin authentication & access control

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Admin authentication system | ✅ Done | JWT-based PIN authentication (`auth.service.ts`, `auth.controller.ts`, `auth.middleware.ts`). Login with PIN → JWT token → stored in `localStorage`. Token verification and blacklisting via Redis. |
| Protected admin routes | ✅ Done | `requireAuth` middleware protects `DELETE /jobs/:id`, `POST /jobs/:id/pause`, `POST /jobs/:id/resume`, `POST /jobs/:id/priority`. |

---

### 4.2 — Admin can start/stop any job or job sequence

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Admin can cancel any job | ✅ Done | `cancelJob()` in `job.service.ts` removes from BullMQ and cancels CUPS job if active. Admin UI `Queue.tsx` has cancel button. |
| Admin can pause any job | ✅ Done | `pauseJob()` sends `lp -i <id> -H hold` to CUPS. Admin UI has pause button in `Queue.tsx`. |
| Admin can resume any job | 🟡 Partial | `resumeJob()` backend exists (`lp -i <id> -H resume`). API route exists. But the admin UI `Queue.tsx` does **not** have a resume button — only cancel, pause, and prioritize are rendered. |
| Admin can start a job sequence | 🔴 Missing | No concept of "job sequence" (batch processing). Admin can prioritize individual jobs but cannot start/stop a batch. |
| Admin can stop a job sequence | 🔴 Missing | No batch stop mechanism. Admin would need to cancel jobs one by one. |
| Admin-only special commands | 🟡 Partial | Admin can: set default printer, update aliases, detect/configure legacy printers, manage pricing config, cancel/pause/prioritize jobs. But there are no admin-exclusive commands like: queue flush, pause entire queue, emergency stop all printers, force re-scan, or force reprint. |

**What exists:**
- Admin dashboard with pages: Dashboard (metrics), Fleet (printer management), Queue (job management), Settings (pricing config).
- Queue controls: cancel, pause, prioritize.
- Printer controls: set default, update alias, detect/configure legacy printers.
- Pricing controls: update rates, bulk discounts, duplex discounts, factory reset.

**What's missing:**
- **Resume job** button in admin UI (backend exists).
- **Queue-level controls:**
  - Pause entire queue (stop processing).
  - Resume entire queue.
  - Flush/clear all jobs.
- **Printer-level controls:**
  - Disable/enable individual printers.
  - Force health check on a specific printer.
  - Send test print to a specific printer.
- **Job sequence controls:**
  - Start/stop batch processing.
  - Re-order the entire queue via drag-and-drop.
- **Emergency controls:**
  - Emergency stop all printing.
  - Force cancel all active jobs.

---

## Requirement 5 — Singular Module-Based Backend Architecture

> *"Certain tasks common for all printer types should be clubbed together in a module."*

### 5.1 — Modular, printer-type-aware service layer

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Common tasks in shared modules, with printer-type variants | 🔴 Missing | All printer logic lives in monolithic files: `printer.service.ts` (283 lines), `supplies.service.ts` (267 lines). There is no abstraction by printer type — HP USB, Epson USB, IPP, SNMP logic is all inline with `if/else` chains. |
| Code reusability across printer types | 🟡 Partial | `supplies.service.ts` has separate functions per protocol (`queryIpp`, `querySnmp`, `queryHpUsb`, `queryEpsonUsb`, `queryGenericUsb`) — good separation internally but no shared interface/contract. |
| Easier debugging via module isolation | 🔴 Missing | Since everything is in one file, debugging a specific printer type requires navigating the entire file. No module boundaries. |

**What exists:**
- `supplies.service.ts` → Protocol-specific query functions exist but are private to the file.
- `printer.service.ts` → Mixed concerns: CUPS commands, HP config, capabilities config, job status all in one file.

**What's missing:**
- A module/adapter pattern: e.g., `printers/hp.adapter.ts`, `printers/epson.adapter.ts`, `printers/ipp.adapter.ts` each implementing a common `PrinterAdapter` interface with methods like `getSupplies()`, `configure()`, `testPrint()`.
- A factory that resolves the correct adapter based on printer URI/type.

---

### 5.2 — Centralized shell commands

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| All CLI commands in a single folder, separated by file | 🔴 Missing | Shell commands are scattered across **4 service files** and **1 controller**: `printer.service.ts` (15 calls), `supplies.service.ts` (8 calls), `job.service.ts` (3 calls), `wifi.service.ts` (1 call), `print.controller.ts` (1 call). Raw command strings like `lpstat -p`, `cancel`, `lp -i`, `hp-levels`, `snmpwalk`, `pdfinfo` are hardcoded inline. |
| Exported and imported where needed | 🔴 Missing | No command registry exists. Each service builds its own command strings inline. |
| Reduces duplication and aids debugging | 🔴 Missing | Duplicate patterns exist: `cancel <jobId>` appears in both `printer.service.ts` and `job.service.ts`. `lp -i <id> -H hold/resume` appears in both `printer.service.ts` and `job.service.ts`. |

**What exists:**
- `utils/exec.ts` → Shared `execCommand()` wrapper (good).
- `supplies.service.ts` → Has its own `execWithTimeout()` wrapper (duplicated timeout logic).

**What's missing:**
- A `commands/` folder with files like: `cups.commands.ts` (lpstat, lp, cancel, lpoptions), `hp.commands.ts` (hp-setup, hp-levels), `snmp.commands.ts` (snmpwalk), `system.commands.ts` (pdfinfo, nmcli).
- Each file exports typed functions: e.g., `cups.listPrinters()`, `cups.cancelJob(id)`, `cups.printFile(path, opts)`.

---

## Requirement 6 — Printer Configuration (Capability Auto-Detection)

> *"After adding to the printing queue, check its capabilities and add to capabilities.json."*

### 6.1 — Legacy printer capability detection after configuration

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| After adding legacy printer, detect color/bw capability | 🔴 Missing | `configurePrinter()` in `printer.controller.ts` runs `hp-setup`, then creates a blank entry in `capabilities.json` with `capabilities: []` and guesses `type: "usb"`. No actual capability probing (e.g., `lpoptions -l <printer>`) happens. |
| Detect duplex capability | 🔴 Missing | Same — no duplex detection. The entry is always `capabilities: []`. |
| Write detected capabilities to capabilities.json | 🟡 Partial | The write mechanism works (`updateCapabilitiesConfig()`), but it always writes empty capabilities since detection doesn't run. |

---

### 6.2 — IPP printer configuration

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Detect IPP virtual queues and manually add to CUPS | 🔴 Missing | No IPP auto-detection or `lpadmin` based queue creation exists. Only HP USB printers via `hp-setup` are handled. |
| Check IPP printer capabilities after adding | 🔴 Missing | No capability probing for IPP printers. |

---

### 6.3 — Fallback capability detection via test commands

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Run predefined test commands if capabilities can't be read | 🔴 Missing | No test-command fallback exists. |
| Ask admin for permission before running tests | 🔴 Missing | No admin confirmation flow for capability testing. |

---

### 6.4 — Admin dashboard visibility during setup

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Show configuration process in admin dashboard | 🟡 Partial | `Fleet.tsx` shows detected devices and a "Configure" button, and emits SSE `printer_discovery` event after config. But there's no step-by-step progress view during setup. |
| Ask admin for printer name during setup | 🔴 Missing | `hp-setup` auto-names the queue. No prompt asks the admin for a custom name. The alias can be set separately afterward, but not during the setup flow. |

**What exists:**
- `Fleet.tsx` → "Detect Legacy Hardware" button, device list with "Configure" per device.
- `printer.controller.ts` → `configurePrinter()` creates blank capability entry, emits SSE event.
- `capabilities.json` → Manual entries with capabilities and aliases.

**What's missing:**
- `lpoptions -l <printer>` parsing to auto-detect color, duplex, paper sizes.
- IPP printer detection (`lpinfo -v` filtering for `ipp://` URIs not yet in CUPS).
- `lpadmin -p <name> -v <uri> -E` for manual queue creation.
- Fallback test-print routine with admin confirmation modal.
- Setup wizard in admin UI: detect → name → probe capabilities → confirm → save.

---

## Requirement 7 — UI/UX Segregation for Mobile and PC

> *"The printing website UI should be more mobile centric with clear steps, contained within a single frame."*

### 7.1 — Mobile-first user kiosk design

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Responsive CSS with mobile breakpoints | ✅ Done | `responsive.css` (702 lines) has three breakpoints: Mobile (<640px), Tablet (640-1024px), Desktop (>1024px). All major components have mobile-specific overrides. |
| Single-frame UI without scrollbars | 🟡 Partial | User layout uses `min-height: 100vh` with flexbox. DropZone fills available space (`flex: 1`). However, `ConfigConsole` with its split layout can overflow on small screens — the config grid stacks vertically on mobile but may still require scrolling with all options visible. |
| Clear step-based flow | ✅ Done | Progress bar (`ProgressBar.tsx`) with 4 labeled steps. Step-based rendering in `UserKioskPage`: DropZone → ConfigConsole → QuoteReceipt → JobTracker. |
| Admin layout responsive | ✅ Done | Admin sidebar collapses to slide-over overlay on mobile/tablet with FAB toggle button. Mobile backdrop overlay. |

**What exists:**
- Full responsive CSS system with mobile, tablet, desktop breakpoints.
- Mobile sidebar with slide-in/out + backdrop.
- Grid layouts that collapse (4-col → 2-col → 1-col for dashboard, fleet grid → single column).
- Config split stacks vertically on mobile.
- Receipt card goes full-width on mobile.
- Toast stack adapts to mobile (full-width, positioned at bottom).

**What could be improved:**
- **Scroll avoidance:** ConfigConsole should be more compact on mobile — perhaps collapsible sections or a swipe-based layout instead of showing all 4 config fields at once.
- **Touch targets:** Buttons and interactive elements should be audited for minimum 44x44px touch targets on mobile.
- **Viewport meta tag:** Should verify `index.html` has proper `<meta name="viewport">` tag.
- **Full-screen kiosk mode:** A dedicated mobile kiosk mode that hides browser chrome and locks to portrait could improve the experience.

---

## Requirement 8 — Admin Dashboard System Metrics

> *"Should also show memory usage and disk usage. Add graphs for CPU, memory, and disk usage with time."*

### 8.1 — Memory and disk usage metrics

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| Show CPU usage | ✅ Done | `events.controller.ts` returns `os.loadavg()[0]` as `cpuLoad`. Dashboard renders it via `HealthMeter` component with progress bar. |
| Show memory usage | 🔴 Missing | Backend `getMetrics()` does not include `os.freemem()` or `os.totalmem()`. No memory data in `BackendMetrics` type. Dashboard doesn't render it. |
| Show disk usage | 🔴 Missing | No disk usage check exists (e.g., `df` command or `statvfs`). Not in metrics response, not in UI. |

---

### 8.2 — Time-series graphs

| Sub-requirement | Status | Details |
|:---|:---:|:---|
| CPU usage graph over time | 🔴 Missing | Dashboard has a placeholder card: "Real-time graph placeholder" with an Activity icon (`Dashboard.tsx` lines 69-74). No actual chart library is installed. No historical data collection. |
| Memory usage graph over time | 🔴 Missing | Same — no data, no chart. |
| Disk usage graph over time | 🔴 Missing | Same — no data, no chart. |

**What exists:**
- `Dashboard.tsx` → `HealthMeter` component for CPU load (single-value bar, not time-series).
- Backend polls metrics every 25s from frontend, but each response is a point-in-time snapshot — no history stored.
- Placeholder card exists in the UI for the graph.

**What's missing:**
- **Backend:** Add `os.freemem()` / `os.totalmem()` for memory. Add `execCommand('df -h /')` or similar for disk. Store time-series data points in Redis (e.g., circular buffer of last 60 readings at 30s intervals).
- **Backend:** New endpoint `GET /metrics/history` returning arrays of `{ timestamp, cpu, memory, disk }`.
- **Frontend:** Install a chart library (e.g., `recharts`, `chart.js`, or lightweight `uPlot`). Replace the placeholder card with actual line charts.
- **Frontend:** Update `BackendMetrics` type to include `memoryUsed`, `memoryTotal`, `diskUsed`, `diskTotal`.

---

## Detailed Implementation Matrix

| # | Requirement | Implemented | Partially | Missing | Notes |
|:--|:---|:---:|:---:|:---:|:---|
| 1.1 | Printer availability check on page load | | | ❌ | No frontend gate |
| 1.2 | Filter config options by fleet capabilities | | | ❌ | Config always shows all options |
| 1.3 | Pre-print availability check | | ⚠️ | | Backend-only via matchmaker |
| 2.1 | UI updates on job completion | | ⚠️ | | SSE event type mismatch |
| 2.2 | Session persistence across reloads | | | ❌ | No sessionId, no persist |
| 2.3 | Toast notifications for job status | | ⚠️ | | Only on submission, not on completion/failure |
| 2.4 | Comprehensive multi-job tracker | | ⚠️ | | Single job only, missing details |
| 2.5 | Graceful missing supply data handling | | ⚠️ | | Backend handles it, frontend partially |
| 2.6 | SSE events via global event bus in Zustand | | ⚠️ | | Hook-based, not true event bus; type mismatch |
| 3.1 | Active failure recovery | | ⚠️ | | Failover works, no test-print probe |
| 3.2 | Startup printer health check | | | ❌ | No startup routine |
| 3.3 | Max 2 retries per job | | ⚠️ | | Currently 3 retries, not 2 |
| 3.4 | User choice on failure (wait/quit) | | | ❌ | Only "Start New Job" shown |
| 3.5 | Per-printer force health check (admin) | | | ❌ | No healthcheck endpoint or UI button |
| 4.1 | Admin authentication | ✅ | | | JWT + PIN fully working |
| 4.2 | Admin cancel any job | ✅ | | | Full cancel pipeline |
| 4.3 | Admin pause any job | ✅ | | | Backend + CUPS integration |
| 4.4 | Admin resume any job | | ⚠️ | | Backend exists, no UI button |
| 4.5 | Admin start/stop job sequence | | | ❌ | No batch controls |
| 4.6 | Admin-only special commands | | ⚠️ | | Basic controls exist, no advanced ops |
| 5.1 | Modular printer-type-aware services | | | ❌ | Monolithic files, no adapter pattern |
| 5.2 | Centralized shell commands | | | ❌ | 28+ commands scattered across 5 files |
| 6.1 | Legacy printer capability auto-detect | | | ❌ | Blank capabilities after config |
| 6.2 | IPP printer configuration | | | ❌ | Only HP USB handled |
| 6.3 | Fallback test-command capability detection | | | ❌ | No test commands, no admin prompt |
| 6.4 | Admin dashboard setup visibility | | ⚠️ | | Basic detect/configure, no wizard |
| 7.1 | Mobile-first responsive UI | | ⚠️ | | Good responsive CSS, scroll issues remain |
| 8.1 | Memory and disk usage metrics | | ⚠️ | | CPU only; no memory/disk |
| 8.2 | Time-series usage graphs | | | ❌ | Placeholder only, no chart library |

---

## Updated Overall Progress Summary

| Category | Status | Completion |
|:---|:---:|:---:|
| 1. Security Gates (Printer Availability) | 🔴 Not Implemented | **~10%** |
| 2. UI ↔ Backend Sync | 🟡 Partially Implemented | **~35%** |
| 3. Robust Printing Logic | 🟡 Partially Implemented | **~50%** |
| 4. Print Admin Special Access | 🟡 Partially Implemented | **~35%** |
| 5. Modular Backend Architecture | 🔴 Not Implemented | **~10%** |
| 6. Printer Configuration | 🔴 Mostly Missing | **~15%** |
| 7. Mobile/PC UI Segregation | 🟡 Partially Implemented | **~65%** |
| 8. Admin System Metrics & Graphs | 🔴 Mostly Missing | **~20%** |

**Overall Project Completion: ~30%**

---

## Priority Recommendations

### 🔴 Critical (Must-fix — user-facing breakage)

1. **Fix SSE event type mismatch** — Backend sends `job_completed`, frontend expects `JOB_STATUS`. User's job tracker never updates.
2. **Add printer availability gate** — Users can submit jobs when zero printers are online, leading to indefinitely queued/failed jobs.
3. **Add session persistence** — Page reload loses all state, leaving users stranded.

### 🟠 High Priority (Core missing features)

4. **Global SSE event bus** — Decouple SSE from React lifecycle, add normalization layer.
5. **Dynamic config options** — Filter color/duplex options by fleet capabilities.
6. **Toast notifications for job events** — Wire SSE events to toast system.
7. **Startup health check** — Verify printer fleet on server boot.
8. **Fix retry count** — Change from 3 retries to 2 per spec.
9. **Printer capability auto-detection** — Run `lpoptions -l` after configuring any printer.
10. **IPP printer configuration** — Handle network printers, not just HP USB.
11. **Per-printer health check button** — `POST /printers/:name/healthcheck` + Fleet UI button with spinner to re-test flagged printers.

### 🟡 Medium Priority (Enhanced UX)

11. **Multi-job tracker** — Show all user jobs, not just the latest.
12. **Failure choice UX** — Let user wait or quit on failure.
13. **Add resume button** — Admin UI missing resume control.
14. **Graceful supply data display** — Show "N/A" instead of blank.
15. **Memory & disk metrics** — Add `os.freemem/totalmem` and `df` to backend metrics.
16. **Time-series charts** — Install chart library, replace placeholder with real graphs.
17. **Mobile scroll optimization** — Make ConfigConsole more compact on mobile.

### 🟢 Nice to Have (Architecture improvements)

18. **Modular backend** — Refactor to printer-type adapter pattern.
19. **Centralized commands** — Extract 28+ shell commands into `commands/` folder.
20. **Queue-level controls** — Pause/resume/flush entire queue.
21. **Job sequence management** — Batch start/stop.
22. **Printer setup wizard** — Step-by-step admin flow for new printers.
23. **Emergency stop** — Kill all active printing.

---

## Files That Need Changes

### Backend
| File | Changes Needed |
|:---|:---|
| `server/src/server.ts` | Add startup printer health check routine |
| `server/src/infrastructure/printMaster.queue.ts` | Change `attempts: 4` → `attempts: 3` |
| `server/src/infrastructure/printMaster.worker.ts` | Change failover cap from 3 → 2; normalize SSE event payloads |
| `server/src/app/controllers/events.controller.ts` | Add `os.freemem()`/`os.totalmem()`, disk usage; SSE event type consistency; metrics history endpoint |
| `server/src/app/services/printer.service.ts` | Add `lpoptions -l` capability detection; test-print function; fleet readiness check |
| `server/src/app/services/supplies.service.ts` | Extract into modular adapters |
| `server/src/app/routes/jobs.routes.ts` | Add `GET /jobs?owner=xxx` or session-filtered endpoint |
| `server/src/app/controllers/jobs.controller.ts` | Add resume button route; add queue-level controls |
| `server/src/app/controllers/printer.controller.ts` | Add IPP config; capability auto-detect after configure; admin name prompt |
| **[NEW]** `server/src/commands/*.ts` | Centralized shell command registry |
| **[NEW]** `server/src/app/services/printers/*.adapter.ts` | Printer-type adapter modules |

### Frontend
| File | Changes Needed |
|:---|:---|
| `admin-ui/src/stores/useUserPrintStore.ts` | Add Zustand `persist` middleware; fix SSE event type matching; support multi-job tracking |
| `admin-ui/src/pages/user/DropZone.tsx` | Add printer availability check on mount; block if no printers |
| `admin-ui/src/pages/user/ConfigConsole.tsx` | Fetch fleet capabilities; dynamically filter config options; mobile compactness |
| `admin-ui/src/pages/user/JobTracker.tsx` | Show all jobs; display cost/details; add wait/quit on failure; add "Add New Document" button |
| `admin-ui/src/hooks/useSSE.ts` | Refactor to standalone event bus (e.g., `mitt`); add event type normalization |
| `admin-ui/src/pages/admin/Queue.tsx` | Add resume button; add queue-level controls |
| `admin-ui/src/pages/admin/Dashboard.tsx` | Add memory/disk HealthMeters; replace graph placeholder with real charts |
| `admin-ui/src/pages/admin/Fleet.tsx` | Add setup wizard modal; show capability detection progress; add per-printer "Health Check" button with spinner |
| `admin-ui/src/types/index.ts` | Add `memoryUsed`, `memoryTotal`, `diskUsed`, `diskTotal` to `BackendMetrics`; add `flagged` field to printer type |

---

*Last Updated: 2026-05-13 — End of Report*

