# BACKEND_EXECUTION_PLAN.md — Smart Spooler Architecture

> **Target:** Raspberry Pi (headless, local LAN, no internet)  
> **Stack:** Express.js + Redis + BullMQ + SSE  
> **Status:** Phase 1 ✅ complete | Architecture refactor ✅ complete | Phases 2-6 pending

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

| File                    | What It Does                                   | Verdict                                                        |
| ----------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| `printer.service.ts`    | `lpstat -p`, `lpstat -d`, `lpoptions -d`, `lp` | **Keep & extend.** Core CUPS wrapper functions are solid.      |
| `printer.controller.ts` | GET `/printers`, GET/POST `/printers/default`  | **Keep.** Will add new routes alongside.                       |
| `print.controller.ts`   | POST `/print` (basic file upload + `lp`)       | **Rewrite.** Must route through BullMQ instead of direct `lp`. |
| `utils/exec.ts`         | `child_process.exec` wrapper                   | **Keep as-is.** All CUPS commands use this.                    |

### What Gets Added

| New Module                       | Purpose                                                   |
| -------------------------------- | --------------------------------------------------------- |
| `config/redis.ts`                | Redis connection factory + health check                   |
| `queues/printMaster.queue.ts`    | BullMQ Queue definition ("PrintMasterQueue")              |
| `workers/printMaster.worker.ts`  | The Drip-Feed worker with matchmaking + failover          |
| `config/capabilities.json`       | Printer capabilities matrix (static JSON)                 |
| `services/matchmaker.service.ts` | Intersects job requirements with idle+capable printers    |
| `services/supplies.service.ts`   | Deterministic ink/toner polling via URI routing           |
| `services/job.service.ts`        | Job CRUD: list, status, cancel, pause, resume, prioritize |
| `services/metrics.service.ts`    | CPU, uptime, storage, queue depth, revenue aggregation    |
| `services/pricing.service.ts`    | Read/write `config/pricing.json` + quote calculation      |
| `services/auth.service.ts`       | PIN hashing + JWT generation/verification                 |
| `routes/events.routes.ts`        | SSE endpoint `GET /events/jobs`                           |
| `routes/jobs.routes.ts`          | Job management endpoints                                  |
| `routes/config.routes.ts`        | Pricing + capabilities config endpoints                   |
| `routes/auth.routes.ts`          | Login/logout/verify endpoints                             |
| `middleware/auth.middleware.ts`  | JWT verification guard for admin routes                   |

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

### PHASE 5: DETERMINISTIC HARDWARE POLLING (Ink & Paper)

**Goal:** Read printer supply levels AND paper availability using the exact protocol required by the hardware.

#### 5.1 URI-Based Routing
- `services/supplies.service.ts`
- **Step 1:** `lpstat -v <printer_name>` → extract device URI.
- **Step 2:** Route based on URI content:

| URI Contains                      | Protocol/Command                                      | Parses                                        |
| --------------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| `ipp://<ip>` or `ipp://localhost` | `ipptool -tv "<uri>" get-printer-attributes.test`     | `marker-levels` (ink) & `media-empty` (paper) |
| `socket://` or `lpd://`           | `snmpwalk -v1 -c public <ip> 1.3.6.1.2.1.43.11.1.1.9` | Legacy SNMP ink levels                        |
| `usb://HP`                        | `hp-levels`                                           | Ink percentages & "out of paper" status       |
| `usb://EPSON`                     | `sudo escputil -i -u -r /dev/usb/lp0`                 | Ink level data                                |
| Other `usb://`                    | `ink -p usb`                                          | Generic USB ink query                         |

#### 5.2 Universal Return Object
- The service MUST parse the disparate CLI outputs into one strictly typed, unified JSON object for the frontend:
  `{ status: 'online'|'offline', paper: 'ready'|'empty'|'unknown', supplies: { black: number|null, color: number|null } }`
- **Graceful Fallback:** Wrap all `child_process.exec` calls with a strict 4000ms timeout. If any command fails, times out, or returns unparseable output → catch the error and gracefully return `null` for the supplies instead of crashing the server.

#### 5.3 Caching
- Hardware polling is expensive. Cache the result object in Redis for **5 minutes** per printer.
- The SSE heartbeat will read from this Redis cache to push updates to the UI.

---

### PHASE 6: HP Legacy Auto-Configuration

**Goal:** Automatically detect plugged-in but unconfigured HP USB printers and programmatically build their CUPS queues using `hp-setup`.

> **Constraint:** Only `hplip` drivers are currently installed on the host machine. This phase strictly targets HP devices. Support for other vendors can be added later by following the same pattern.

#### 6.1 Discovery Service — `getUnconfiguredHpPrinters()`
Add to `src/app/services/printer.service.ts`:
- **Step 1:** Run `lpinfo -v` → collect all physically connected hardware URIs (raw devices).
- **Step 2:** Run `lpstat -v` → collect all currently configured CUPS printer URIs.
- **Step 3:** Diff the two lists → find "orphans" (plugged in, but no CUPS queue exists).
- **Step 4:** Strictly filter orphans to only those matching `usb://HP`.
- **Step 5:** Parse each URI to extract a `makeModel` string (e.g., `"HP LaserJet M1005"`).
- **Return:** `Array<{ uri: string; makeModel: string }>`

#### 6.2 Configuration Service — `configureHpPrinter()`
Add to `src/app/services/printer.service.ts`:
- **Input:** `uri: string`, `modelName: string`
- **Step 1:** Sanitize `modelName` to create a valid CUPS queue name:
  ```typescript
  const queueName = modelName.replace(/[^a-zA-Z0-9_-]/g, "_");
  ```
- **Step 2:** Execute the HP auto-configuration command:
  ```bash
  sudo hp-setup -i -a -q "<uri>"
  ```
  - `-i` = non-interactive (disables GUI prompts)
  - `-a` = auto-accept defaults
  - `-q` = quiet mode
- **Step 3:** Wrap in try/catch. Return `{ success: boolean; queueName?: string; error?: string }`.

> [!CAUTION]
> **Deployment Requirement:** The `visudo` file on the Raspberry Pi **must** be updated to allow the Node.js process user to execute `/usr/bin/hp-setup` without a password prompt. Without this, the `sudo hp-setup` command will hang indefinitely and the worker will stall.
> ```
> nodeuser ALL=(ALL) NOPASSWD: /usr/bin/hp-setup
> ```

#### 6.3 Controller & Routes
- **`GET /printers/detect-legacy`** — Calls `getUnconfiguredHpPrinters()`. Returns the orphan list.
  - Modify: `src/app/controllers/printer.controller.ts`
  - Modify: `src/app/routes/printer.routes.ts`
- **`POST /printers/configure`** — Accepts `{ uri, modelName }` body. Calls `configureHpPrinter()`. Returns success/failure.
  - Modify: `src/app/controllers/printer.controller.ts`
  - Modify: `src/app/routes/printer.routes.ts`

#### 6.4 Post-Configuration Hook
After a successful `hp-setup`, the system should:
1. Re-run `lpstat -p` to confirm the new queue appeared.
2. Auto-add a default entry to `capabilities.json` with `"capabilities": ["bw", "single"]` and `"type": "usb"`.
3. Broadcast a `PRINTER_DISCOVERED` SSE event (when Phase 4 is wired).

#### Integration Report Coverage
This phase addresses:
- **Endpoint #6** (`POST /printers/detect`) — now specifically targets HP USB orphans
- **Frontend Fleet page "Detect Legacy Hardware"** button — replaces the 3.5s mock with real `lpinfo`
- Closes the loop on **Printer Aliasing** — newly configured printers get a default alias from `modelName`

---

## Remaining Integration Report Endpoints (Not in Instructions, Added for Completeness)

These endpoints are required by the frontend but are not explicitly part of the 5 phases above. They will be implemented as lightweight layers during the relevant phase:

| #   | Endpoint                     | Implemented During | Notes                                                 |
| --- | ---------------------------- | ------------------ | ----------------------------------------------------- |
| 9   | `GET /jobs`                  | Phase 1            | Query BullMQ queue + completed set                    |
| 11  | `DELETE /jobs/:jobId`        | Phase 1            | `cancel` CUPS job + remove from BullMQ                |
| 15  | `GET /metrics`               | Phase 4            | `os.loadavg()`, `process.uptime()`, `df`, queue stats |
| 16  | `GET /config/pricing`        | Phase 1            | Read `config/pricing.json`                            |
| 17  | `PUT /config/pricing`        | Phase 1            | Write `config/pricing.json`                           |
| 18  | `POST /config/pricing/reset` | Phase 1            | Overwrite with defaults                               |
| 19  | `POST /auth/login`           | Phase 1            | bcrypt PIN + JWT                                      |
| 20  | `POST /auth/logout`          | Phase 1            | Token blacklist (Redis SET)                           |
| 21  | `GET /auth/verify`           | Phase 1            | JWT decode + blacklist check                          |
| 22  | `POST /utils/pagecount`      | Phase 1            | `pdfinfo` for PDFs                                    |

---

## Final File Tree (After All 6 Phases)

> **Note:** The codebase has been refactored into the `src/app/` architecture per `instruction_5.md`.

```
server/src/
├── app.ts                              ← Extended with new route mounts
├── server.ts                           ← Boots infrastructure then Express
├── config/
│   ├── capabilities.json               ← Printer capabilities matrix
│   └── pricing.json                    ← Persisted pricing config
├── infrastructure/
│   ├── redis.ts                        ← Redis connection singleton
│   ├── printMaster.queue.ts            ← BullMQ Queue definition
│   └── printMaster.worker.ts           ← Drip-feed worker + failover
├── app/
│   ├── controllers/
│   │   ├── print.controller.ts         ← Rewritten to enqueue via BullMQ
│   │   ├── printer.controller.ts       ← Extended (detect-legacy, configure)
│   │   ├── jobs.controller.ts          ← Job CRUD
│   │   ├── events.controller.ts        ← SSE stream
│   │   ├── config.controller.ts        ← Pricing CRUD
│   │   └── auth.controller.ts          ← Login/logout/verify
│   ├── routes/
│   │   ├── print.routes.ts             ← Extended (quote endpoint)
│   │   ├── printer.routes.ts           ← Extended (supplies, detect-legacy, configure, alias)
│   │   ├── jobs.routes.ts              ← Job CRUD
│   │   ├── events.routes.ts            ← SSE stream
│   │   ├── config.routes.ts            ← Pricing + capabilities
│   │   ├── utils.routes.ts             ← Page count utility
│   │   └── auth.routes.ts              ← Login/logout/verify
│   ├── services/
│   │   ├── printer.service.ts          ← Extended (detect orphans, configure HP)
│   │   ├── matchmaker.service.ts       ← Smart routing engine
│   │   ├── supplies.service.ts         ← Vendor-specific ink polling
│   │   ├── job.service.ts              ← BullMQ job CRUD
│   │   ├── metrics.service.ts          ← System telemetry
│   │   ├── pricing.service.ts          ← Config file CRUD
│   │   ├── auth.service.ts             ← PIN + JWT
│   │   └── eventBus.ts                 ← SSE client manager
│   ├── middlewares/
│   │   └── auth.middleware.ts          ← JWT guard
│   ├── utils/
│   │   └── exec.ts                     ← child_process wrapper
│   └── types/
│       └── (future shared interfaces)
```

---

## Execution Order

```
Phase 1 ✅ COMPLETE ───────────────────────────────────────►
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

Phase 6 ──────────────────────────────────────────────────►
  ├── getUnconfiguredHpPrinters() discovery
  ├── configureHpPrinter() via hp-setup
  ├── GET /printers/detect-legacy endpoint
  ├── POST /printers/configure endpoint
  └── Post-config hook → capabilities.json + SSE event
```

---

> **Phase 1 is complete. Awaiting your command to begin Phase 2.**
