# BACKEND_EXECUTION_PLAN.md — Smart Spooler Architecture

> **Target:** Raspberry Pi (headless, local LAN, no internet)  
> **Stack:** Express.js + Redis + BullMQ + SSE  
> **Status:** Awaiting approval before coding begins

---

## Acknowledgement

I have fully reviewed `instructions_4.md` and `INTEGRATION_REPORT.md`. I understand:

1. **The "Drip-Feed" Constraint** — The Pi's limited RAM cannot handle rasterizing multiple PDFs concurrently. The BullMQ worker must pull exactly **one job per idle printer** at a time, never more.
2. **The "Jump-the-Line" Failover** — If CUPS reports an error mid-print, the job must be cancelled on the broken hardware, the printer ID tagged onto an `attempted_printers` blacklist, and the job re-queued at **Priority 1** so it jumps to the front and routes to the next compatible backup.
3. **Abandoning Polling** — The frontend's current `setInterval` polling (10s in Queue, 4s fake timers in JobTracker) will be replaced by a persistent SSE connection that pushes state changes in real time.
4. **Deterministic Supply Monitoring** — Ink/toner levels must be read via vendor-specific CLI commands (`hp-levels`, `escputil`, `ink`), selected based on the printer's device URI, not guessed.

---

## Current Backend vs. Target Backend

### What Exists Today (3 files, 4 endpoints)

| File | What It Does | Verdict |
|---|---|---|
| `printer.service.ts` | `lpstat -p`, `lpstat -d`, `lpoptions -d`, `lp` | **Keep & extend.** Core CUPS wrapper functions are solid. |
| `printer.controller.ts` | GET `/printers`, GET/POST `/printers/default` | **Keep.** Will add new routes alongside. |
| `print.controller.ts` | POST `/print` (basic file upload + `lp`) | **Rewrite.** Must route through BullMQ instead of direct `lp`. |
| `utils/exec.ts` | `child_process.exec` wrapper | **Keep as-is.** All CUPS commands use this. |

### What Gets Added

| New Module | Purpose |
|---|---|
| `config/redis.ts` | Redis connection factory + health check |
| `queues/printMaster.queue.ts` | BullMQ Queue definition ("PrintMasterQueue") |
| `workers/printMaster.worker.ts` | The Drip-Feed worker with matchmaking + failover |
| `config/capabilities.json` | Printer capabilities matrix (static JSON) |
| `services/matchmaker.service.ts` | Intersects job requirements with idle+capable printers |
| `services/supplies.service.ts` | Deterministic ink/toner polling via URI routing |
| `services/job.service.ts` | Job CRUD: list, status, cancel, pause, resume, prioritize |
| `services/metrics.service.ts` | CPU, uptime, storage, queue depth, revenue aggregation |
| `services/pricing.service.ts` | Read/write `config/pricing.json` + quote calculation |
| `services/auth.service.ts` | PIN hashing + JWT generation/verification |
| `routes/events.routes.ts` | SSE endpoint `GET /events/jobs` |
| `routes/jobs.routes.ts` | Job management endpoints |
| `routes/config.routes.ts` | Pricing + capabilities config endpoints |
| `routes/auth.routes.ts` | Login/logout/verify endpoints |
| `middleware/auth.middleware.ts` | JWT verification guard for admin routes |

---

## Phase Breakdown

### PHASE 1: Infrastructure (Redis + BullMQ)

**Goal:** Replace in-memory job tracking with a crash-safe Redis-backed queue.

#### 1.1 Dependencies
```bash
npm install ioredis bullmq bcrypt jsonwebtoken
npm install -D @types/bcrypt @types/jsonwebtoken
```

#### 1.2 Redis Configuration
- Create `config/redis.ts` — exports a singleton `IORedis` connection.
- **Documentation note:** The deployment README will specify Redis must be configured with:
  ```
  appendonly yes
  appendfsync everysec
  maxmemory 128mb
  maxmemory-policy allkeys-lru
  ```
  This ensures the queue survives power outages (critical for Pi).

#### 1.3 PrintMasterQueue
- Create `queues/printMaster.queue.ts` — defines the BullMQ `Queue` named `"print-master"`.
- Job data schema:
  ```typescript
  interface PrintJobData {
    id: string;              // UUID
    filename: string;        // Original filename
    filePath: string;        // Absolute path to uploaded file
    owner: string;           // "Guest" for kiosk
    pages: number;
    copies: number;
    colorMode: 'color' | 'grayscale';
    duplex: 'single' | 'double';
    orientation: 'portrait' | 'landscape';
    cost: number;
    attemptedPrinters: string[];  // Failover blacklist
    submittedAt: string;
  }
  ```

#### 1.4 Drip-Feed Worker
- Create `workers/printMaster.worker.ts`.
- `concurrency: 1` initially — processes exactly one job at a time.
- In Phase 2, the worker will scale to "one job per idle printer" by using BullMQ's rate limiter and the matchmaker service.

#### 1.5 Rewire `POST /print`
- The existing `print.controller.ts` will stop calling `printerService.printFile()` directly.
- Instead, it will `queue.add('print', jobData)` — enqueuing the job in Redis.
- The response returns immediately with `{ jobId, status: 'queued' }`.

#### Integration Report Coverage
This phase addresses:
- **Endpoint #7** (`POST /print`) — rewritten to enqueue via BullMQ
- **Endpoint #8** (`POST /print/quote`) — new, reads pricing config and calculates cost
- **Data Model: JobRecord** — implemented as BullMQ job data + Redis hash for metadata

---

### PHASE 2: Smart Dispatcher (Matchmaking)

**Goal:** Route each job to an idle, compatible printer automatically.

#### 2.1 Capabilities Matrix
- Create `config/capabilities.json`:
  ```json
  {
    "HP_LaserJet_Pro_M404n": {
      "alias": "Main Office Laser",
      "capabilities": ["bw", "single"],
      "type": "network"
    },
    "EPSON_L3250": {
      "alias": "Color Press",
      "capabilities": ["color", "bw", "duplex", "single"],
      "type": "network"
    }
  }
  ```
  This file is the single source of truth for printer aliases (addressing the Integration Report's **Endpoint #23** — `PUT /printers/:name/alias`) and capability tags.

#### 2.2 Matchmaker Service
- `services/matchmaker.service.ts`
- **Step 1:** Poll `lpstat -p` → get all printers and their CUPS status.
- **Step 2:** Filter to `idle` printers only.
- **Step 3:** Exclude any printers in the job's `attemptedPrinters` array.
- **Step 4:** Intersect with `capabilities.json` — e.g., a `color + duplex` job only matches printers with both tags.
- **Step 5:** Return the best match (prefer default printer if tied).

#### 2.3 Worker Integration
- Before calling `lp`, the worker calls `matchmaker.findPrinter(jobData)`.
- If a match is found → `lp -d <matched_printer> -n <copies> -o sides=<duplex> -- <file>`.
- If no match → delay the job using `moveToDelayed(15000)` (retry in 15s).

#### Integration Report Coverage
This phase addresses:
- **Endpoint #1** (`GET /printers`) — enriched with capabilities + alias from config
- **Endpoint #4** (`GET /printers/:name/status`) — live `lpstat -p <name>` check
- **Endpoint #6** (`POST /printers/detect`) — `lpinfo -v` discovery
- **Endpoint #23** (`PUT /printers/:name/alias`) — updates `capabilities.json`

---

### PHASE 3: Jump-the-Line Failover Protocol

**Goal:** Fault tolerance. Failed jobs automatically re-route to backup printers.

#### 3.1 CUPS Status Monitor
- After `lp` dispatches a job, the worker enters a polling loop:
  ```
  lpstat -o <printer_name> | grep <cups_job_id>
  ```
- Checks every 3 seconds for status keywords: `printing`, `held`, `stopped`, `completed`.

#### 3.2 Catch & Cancel
- If status contains `held`, `stopped`, or remains stale for >30s:
  1. Execute `cancel <cups_job_id>` to clear the jammed hardware.
  2. Tag the printer name onto `job.data.attemptedPrinters`.

#### 3.3 Re-Queue at Priority 1
- Re-add the job to PrintMasterQueue with `priority: 1` (BullMQ places it at the front).
- The matchmaker will exclude the broken printer on the next pass.
- Log the failover event for admin dashboard visibility.

#### 3.4 Retry Limits
- Maximum 3 failover attempts per job (across all printers).
- After 3 failures → mark job as `'failed'` and push error event via SSE.

#### Integration Report Coverage
This phase addresses:
- **Endpoint #12** (`POST /jobs/:jobId/pause`) — `lp -i <id> -H hold`
- **Endpoint #13** (`POST /jobs/:jobId/resume`) — `lp -i <id> -H resume`
- **Endpoint #14** (`POST /jobs/:jobId/priority`) — BullMQ priority manipulation
- Job Tracker Step 4 — real error/failed state propagation

---

### PHASE 4: Real-Time Communication (SSE)

**Goal:** Replace HTTP polling with push-based Server-Sent Events.

#### 4.1 SSE Endpoint
- `GET /events/jobs` — holds the HTTP connection open.
- Uses `res.writeHead(200, { 'Content-Type': 'text/event-stream', ... })`.
- Each connected client is stored in a `Set<Response>` managed by an `EventBus` singleton.

#### 4.2 Event Types Broadcast
```typescript
type SSEEvent =
  | { type: 'JOB_STATUS';      jobId: string; status: string; printer?: string }
  | { type: 'JOB_CREATED';     jobId: string; filename: string; owner: string }
  | { type: 'JOB_FAILED';      jobId: string; error: string }
  | { type: 'PRINTER_STATUS';  printerName: string; status: 'idle' | 'printing' | 'error' }
  | { type: 'PRINTER_DISCOVERED'; printerName: string; uri: string }
  | { type: 'QUEUE_UPDATE';    queueLength: number }
  | { type: 'METRICS_UPDATE';  metrics: DashboardMetrics };
```

#### 4.3 Heartbeat
- Every 30 seconds, send a `:heartbeat\n\n` comment to keep connections alive.
- On disconnect, remove the client from the `Set`.

#### 4.4 Printer Discovery Push
- A background interval (every 60s) runs `lpstat -p` and compares against the last known state.
- If a new printer appears → broadcast `PRINTER_DISCOVERED`.
- If a printer's status changes → broadcast `PRINTER_STATUS`.

#### 4.5 Frontend Migration
- `admin-ui/src/services/api.ts` will add an `EventSource` connection to `/events/jobs`.
- The Zustand stores will subscribe to SSE events instead of polling.
- `setInterval` calls in Queue.tsx and JobTracker.tsx will be removed.

#### Integration Report Coverage
This phase addresses:
- **Endpoint #10** (`GET /jobs/:jobId/status`) — superseded by SSE push
- **Step 4: Job Tracker** — real-time status without polling
- **Admin Queue auto-refresh** — SSE `QUEUE_UPDATE` replaces `setInterval`
- **Admin Dashboard metrics** — SSE `METRICS_UPDATE` replaces polling

---

### PHASE 5: Deterministic Hardware Polling (Ink/Toner)

**Goal:** Read printer supply levels using vendor-specific CLI commands.

#### 5.1 URI-Based Routing
- `services/supplies.service.ts`
- **Step 1:** `lpstat -v <printer_name>` → extract device URI.
- **Step 2:** Route based on URI content:

| URI Contains | Command | Parses |
|---|---|---|
| `HP` | `hp-levels` | Ink percentages per cartridge |
| `EPSON` | `sudo escputil -i -u -r /dev/usb/lp0` | Ink level data |
| Other USB brands | `ink -p usb` | Generic ink query |
| `ipp://` or `socket://` | Skip (no CLI) | Return `null` |

#### 5.2 Graceful Fallback
- If any command fails, times out (5s), or returns unparseable output → return `null`.
- Frontend displays "Supplies Unknown" badge instead of crashing.

#### 5.3 Caching
- Supply levels don't change rapidly. Cache results for **5 minutes** in Redis.
- The SSE heartbeat can optionally refresh supply data and push updates.

#### Integration Report Coverage
This phase addresses:
- **Endpoint #5** (`GET /printers/:name/supplies`) — vendor-specific supply polling
- **Fleet page ink/toner bars** — real data instead of hardcoded values

---

## Remaining Integration Report Endpoints (Not in Instructions, Added for Completeness)

These endpoints are required by the frontend but are not explicitly part of the 5 phases above. They will be implemented as lightweight layers during the relevant phase:

| # | Endpoint | Implemented During | Notes |
|---|---|---|---|
| 9 | `GET /jobs` | Phase 1 | Query BullMQ queue + completed set |
| 11 | `DELETE /jobs/:jobId` | Phase 1 | `cancel` CUPS job + remove from BullMQ |
| 15 | `GET /metrics` | Phase 4 | `os.loadavg()`, `process.uptime()`, `df`, queue stats |
| 16 | `GET /config/pricing` | Phase 1 | Read `config/pricing.json` |
| 17 | `PUT /config/pricing` | Phase 1 | Write `config/pricing.json` |
| 18 | `POST /config/pricing/reset` | Phase 1 | Overwrite with defaults |
| 19 | `POST /auth/login` | Phase 1 | bcrypt PIN + JWT |
| 20 | `POST /auth/logout` | Phase 1 | Token blacklist (Redis SET) |
| 21 | `GET /auth/verify` | Phase 1 | JWT decode + blacklist check |
| 22 | `POST /utils/pagecount` | Phase 1 | `pdfinfo` for PDFs |

---

## Final File Tree (After All 5 Phases)

```
server/src/
├── app.ts                          ← Extended with new route mounts
├── server.ts                       ← Unchanged
├── config/
│   ├── redis.ts                    ← Redis connection singleton
│   ├── capabilities.json           ← Printer capabilities matrix
│   └── pricing.json                ← Persisted pricing config
├── queues/
│   └── printMaster.queue.ts        ← BullMQ Queue definition
├── workers/
│   └── printMaster.worker.ts       ← Drip-feed worker + failover
├── middleware/
│   └── auth.middleware.ts          ← JWT guard
├── routes/
│   ├── print.routes.ts             ← Extended (quote endpoint)
│   ├── printer.routes.ts           ← Extended (supplies, detect, alias)
│   ├── jobs.routes.ts              ← NEW: Job CRUD
│   ├── events.routes.ts            ← NEW: SSE stream
│   ├── config.routes.ts            ← NEW: Pricing + capabilities
│   └── auth.routes.ts              ← NEW: Login/logout/verify
├── controllers/
│   ├── print.controller.ts         ← Rewritten to enqueue via BullMQ
│   ├── printer.controller.ts       ← Extended
│   ├── jobs.controller.ts          ← NEW
│   ├── events.controller.ts        ← NEW
│   ├── config.controller.ts        ← NEW
│   └── auth.controller.ts          ← NEW
├── services/
│   ├── printer.service.ts          ← Extended (detect, capabilities)
│   ├── matchmaker.service.ts       ← NEW: Smart routing engine
│   ├── supplies.service.ts         ← NEW: Vendor-specific ink polling
│   ├── job.service.ts              ← NEW: BullMQ job CRUD
│   ├── metrics.service.ts          ← NEW: System telemetry
│   ├── pricing.service.ts          ← NEW: Config file CRUD
│   ├── auth.service.ts             ← NEW: PIN + JWT
│   └── eventBus.ts                 ← NEW: SSE client manager
└── utils/
    └── exec.ts                     ← Unchanged
```

---

## Execution Order

```
Phase 1 ──────────────────────────────────────────────────►
  ├── Redis + BullMQ setup
  ├── Auth (PIN + JWT)
  ├── Pricing config CRUD
  ├── Quote calculator
  ├── Page count utility
  └── Rewire POST /print to enqueue

Phase 2 ──────────────────────────────────────────────────►
  ├── capabilities.json + alias management
  ├── Matchmaker service
  ├── Worker calls matchmaker before lp
  └── Printer detection (lpinfo -v)

Phase 3 ──────────────────────────────────────────────────►
  ├── CUPS status monitor loop
  ├── Failover catch/cancel/re-queue
  ├── Priority manipulation
  └── Pause/resume endpoints

Phase 4 ──────────────────────────────────────────────────►
  ├── SSE endpoint + EventBus
  ├── Worker → SSE event broadcasting
  ├── Printer discovery push
  ├── Metrics endpoint
  └── Frontend SSE migration (api.ts)

Phase 5 ──────────────────────────────────────────────────►
  ├── URI-based supply routing
  ├── Vendor-specific CLI parsers
  ├── Redis caching (5 min TTL)
  └── Frontend Fleet page wiring
```

---

> **Awaiting your command to begin Phase 1.**
