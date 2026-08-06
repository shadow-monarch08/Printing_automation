# Printing Automation Platform — System Architecture & Product Specification

> **Document Version:** 2.0.0  
> **Revision Date:** 2026-08-04  
> **Classification:** Internal Engineering Reference  
> **Authors:** Platform Architecture Team

---

## Table of Contents

1. [System Overview & Infrastructure](#1-system-overview--infrastructure)
2. [Core Modules & Workflows](#2-core-modules--workflows)
3. [UI/UX Design System](#3-uiux-design-system)
4. [Codebase Architecture](#4-codebase-architecture)

---

## 1. System Overview & Infrastructure

### 1.1 High-Level Architecture

The Printing Automation Platform is a self-contained, edge-deployed print management system designed to operate as a headless kiosk on a Raspberry Pi (or equivalent ARM/x86 SBC). The platform bridges a local fleet of USB and network-attached printers to a customer-facing web kiosk interface, with full administrative telemetry, job queue orchestration, and cloud tunneling for remote access.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CLOUD / WAN LAYER                                 │
│                                                                              │
│   ┌──────────────────┐     ┌───────────────────────────────────────────┐     │
│   │  Cloudflare Quick │     │  Customer's Phone / Laptop Browser       │     │
│   │  Tunnel (dynamic  │◄────│  (accesses kiosk via *.trycloudflare.com │     │
│   │  trycloudflare.   │     │   or local LAN IP)                       │     │
│   │  com subdomain)   │     └───────────────────────────────────────────┘     │
│   └────────┬─────────┘                                                       │
│            │ HTTP reverse proxy to localhost:3000                             │
└────────────┼─────────────────────────────────────────────────────────────────┘
             │
┌────────────┼─────────────────────────────────────────────────────────────────┐
│            ▼                  EDGE NODE (Raspberry Pi)                        │
│   ┌────────────────────────────────────────────────────────────────────┐     │
│   │                     Node.js Express Server (port 3000)             │     │
│   │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐     │     │
│   │  │ REST API│  │WebSocket │  │ BullMQ   │  │ Printer        │     │     │
│   │  │ Layer   │  │ Events   │  │ Worker   │  │ Adapter Factory│     │     │
│   │  └────┬────┘  └─────┬────┘  └────┬─────┘  └───────┬────────┘     │     │
│   │       │              │            │                │              │     │
│   │  ┌────┴──────────────┴────────────┴────────────────┴──────────┐  │     │
│   │  │                    Service Layer                            │  │     │
│   │  │  printer.service │ job.service │ wifi.service │ analytics  │  │     │
│   │  │  pricing.service │ auth.service│ tunnel.service│ metrics   │  │     │
│   │  └────┬──────────────────────────────────────────────┬────────┘  │     │
│   │       │                                              │           │     │
│   │  ┌────┴──────────┐    ┌──────────────────────────────┴────────┐  │     │
│   │  │  SQLite (WAL) │    │          Redis (ioredis)              │  │     │
│   │  │  Cold Tier    │    │          Hot Tier                     │  │     │
│   │  │  print_spooler│    │  Fleet state, session cache, queue   │  │     │
│   │  │  .db          │    │  telemetry, supplies TTL cache       │  │     │
│   │  └───────────────┘    └──────────────────────────────────────┘  │     │
│   └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│   ┌────────────────────────────────────────────────────────────────────┐     │
│   │                    Hardware Integration Layer                       │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────┐   │     │
│   │  │ CUPS     │  │ HPLIP    │  │ SNMP     │  │ IPP/IPP-USB     │   │     │
│   │  │ (lp/     │  │ (hp-setup│  │ (snmpwalk│  │ (ipptool,       │   │     │
│   │  │  lpstat/ │  │  hp-     │  │  supply  │  │  ipp:// URIs)   │   │     │
│   │  │  lpadmin)│  │  levels) │  │  OIDs)   │  │                 │   │     │
│   │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬─────────┘   │     │
│   │       └──────────────┴─────────────┴────────────────┘             │     │
│   │                         │                                         │     │
│   │              ┌──────────┴──────────────────────────┐              │     │
│   │              │    Physical Printers (USB / Network) │              │     │
│   │              │    HP DeskJet, LaserJet, Epson,      │              │     │
│   │              │    Brother, Canon (any CUPS-compat)  │              │     │
│   │              └─────────────────────────────────────┘              │     │
│   └────────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Role |
|:---|:---|:---|
| **Runtime** | Node.js 18+ (TypeScript) | Server-side execution environment |
| **Web Framework** | Express.js | REST API, static file serving, SPA catch-all |
| **Frontend Framework** | React 18+ (Vite, TypeScript) | SPA for Admin Dashboard, Customer Kiosk, and Onboarding |
| **State Management** | Zustand | Lightweight global stores (`useAdminStore`, `useUserPrintStore`) |
| **Job Queue** | BullMQ (Redis-backed) | Durable print job queue with retry, delay, and priority support |
| **Hot Tier Cache** | Redis (ioredis) | Fleet state, session cache, supply TTLs, Wi-Fi connection status |
| **Cold Tier Database** | SQLite (better-sqlite3, WAL mode) | Persistent storage for sessions, jobs, printers, pricing, system config |
| **Real-Time Events** | WebSocket (ws library) | Bidirectional push for job status, printer state, system alerts |
| **Print Spooler** | CUPS (Common Unix Printing System) | OS-level print queue, driver management, job dispatch via `lp`/`lpadmin` |
| **Hardware Telemetry** | HPLIP (`hp-levels`), SNMP (`snmpwalk`), IPP (`ipptool`), escputil | Supply levels, device status, health probes |
| **Network Management** | NetworkManager (`nmcli`) | Wi-Fi scanning, connection, and profile management |
| **Cloud Tunnel** | Cloudflare Quick Tunnel (`cloudflared`) | Dynamic public URL for remote kiosk access |
| **Authentication** | bcrypt + JWT | Admin PIN hashing and session tokens |

### 1.3 Database Schema

The platform employs a **dual-tier data architecture**: a Redis hot tier for ephemeral, high-frequency state and a SQLite cold tier for durable, queryable records.

#### 1.3.1 SQLite Cold Tier (`server/data/print_spooler.db`)

The database operates in WAL (Write-Ahead Logging) mode with foreign keys enabled for referential integrity.

**Table: `system_config`** — Singleton row (id=1) for global system configuration.

| Column | Type | Default | Description |
|:---|:---|:---|:---|
| `id` | INTEGER PK | CHECK (id=1) | Enforced singleton |
| `is_onboarded` | BOOLEAN | 1 | Whether initial provisioning is complete |
| `cloudflare_url` | TEXT | NULL | Active Cloudflare Quick Tunnel URL |
| `shop_name` | TEXT | 'Modern Press' | Operator-configured shop identity |
| `admin_pin_hash` | TEXT | NULL | bcrypt hash of the 4-digit master admin PIN |
| `updated_at` | TEXT | datetime('now') | Last modification timestamp |

**Table: `printers`** — Registered fleet hardware targets.

| Column | Type | Default | Description |
|:---|:---|:---|:---|
| `id` | TEXT PK | — | CUPS queue name (e.g., `HP_DeskJet_2700`) |
| `alias` | TEXT | NULL | Human-friendly label set by admin |
| `capabilities` | TEXT | '[]' | JSON array: `["color", "duplex", "a3"]` |
| `ipp_uri` | TEXT | NULL | IPP device URI for network printers |
| `added_at` | TEXT | datetime('now') | Registration timestamp |

**Table: `pricing_config`** — Singleton row for per-page pricing rules.

| Column | Type | Default | Description |
|:---|:---|:---|:---|
| `id` | INTEGER PK | CHECK (id=1) | Enforced singleton |
| `base_price_bw` | INTEGER | 200 | B&W cost per page in paise/cents |
| `base_price_color` | INTEGER | 1000 | Color cost per page in paise/cents |
| `duplex_discount_percent` | INTEGER | 0 | Percentage discount for double-sided printing |
| `updated_at` | TEXT | datetime('now') | Last modification timestamp |

**Table: `print_jobs`** — Complete job ledger for analytics and audit trail.

| Column | Type | Default | Description |
|:---|:---|:---|:---|
| `id` | TEXT PK | — | UUID job identifier |
| `session_id` | TEXT FK | — | References `kiosk_sessions.session_id` |
| `filename` | TEXT | — | Original uploaded document filename |
| `pages` | INTEGER | 1 | Detected page count (via `pdfinfo`) |
| `copies` | INTEGER | 1 | Number of copies requested |
| `color_mode` | TEXT | 'grayscale' | `'color'` or `'grayscale'` |
| `duplex` | TEXT | 'single' | `'single'` or `'double'` |
| `cost` | INTEGER | 0 | Calculated cost in paise/cents |
| `status` | TEXT | 'queued' | `queued → spooling → printing → done/failed` |
| `executed_by_printer` | TEXT FK | NULL | Which printer handled the job |
| `error_message` | TEXT | NULL | Failure reason if applicable |
| `submitted_at` | TEXT | datetime('now') | Submission timestamp |
| `completed_at` | TEXT | NULL | Completion timestamp |

**Table: `kiosk_sessions`** — Ephemeral customer sessions.

| Column | Type | Default | Description |
|:---|:---|:---|:---|
| `session_id` | TEXT PK | — | UUID session token |
| `ip_address` | TEXT | NULL | Client IP for audit |
| `user_agent` | TEXT | NULL | Browser user-agent string |
| `created_at` | TEXT | datetime('now') | Session creation time |
| `expires_at` | TEXT | NULL | TTL expiration time |

**Table: `payments`** — Payment gateway transaction records.

| Column | Type | Default | Description |
|:---|:---|:---|:---|
| `id` | TEXT PK | — | Payment transaction UUID |
| `print_job_id` | TEXT FK | — | Associated print job |
| `amount` | INTEGER | — | Amount in smallest currency unit |
| `currency` | TEXT | 'INR' | ISO currency code |
| `status` | TEXT | 'initiated' | `initiated → completed → refunded` |
| `gateway` | TEXT | NULL | Payment provider identifier |
| `gateway_reference_id` | TEXT | NULL | External transaction ID |

**Performance Indexes:**
- `idx_print_jobs_status` — Fast status filtering for queue views
- `idx_print_jobs_submitted_at` — Chronological ordering for analytics
- `idx_print_jobs_printer` — Per-printer job history lookups
- `idx_print_jobs_color` — Color mode segmentation for financial reports
- `idx_sessions_expires` — Efficient session cleanup sweeps

#### 1.3.2 Redis Hot Tier

Redis stores volatile, high-frequency state with defined key patterns and TTLs:

| Key Pattern | TTL | Description |
|:---|:---|:---|
| `fleet:printers` | Persistent | SET of all registered printer names |
| `printer:{name}:state` | Persistent | `idle`, `busy` — optimistic lock for worker |
| `printer:{name}:health` | Persistent | `healthy`, `flagged` — quarantine status |
| `printer:{name}:strikes` | Persistent | Integer counter of consecutive failures |
| `printer:{name}:info` | Persistent | JSON blob: alias, capabilities, description |
| `supplies:{name}` | 300s (5 min) | Cached ink/toner/paper levels |
| `session:{id}` | 43200s (12 hr) | Customer kiosk session data |
| `blacklist:{token}` | Varies | Revoked JWT tokens |
| `wifi:connection:status` | 120s (2 min) | Transient Wi-Fi connection state during onboarding |

### 1.4 Cloud Deployment & Tunneling Strategy

The platform uses **Cloudflare Quick Tunnels** (`cloudflared tunnel --url http://localhost:3000`) for zero-configuration public access:

1. The `tunnel.service.ts` spawns a `cloudflared` child process on server boot (if system is onboarded) or after successful Wi-Fi provisioning.
2. The process's `stderr` stream is parsed for the dynamically assigned `https://*.trycloudflare.com` URL using regex extraction.
3. Upon detection, the live URL is:
   - Written to SQLite `system_config.cloudflare_url`
   - Persisted to `server/data/cloudflare_url.txt` for local filesystem fallback
4. The tunnel process is supervised with automatic restart-on-exit semantics.
5. A `SIGTERM` cleanup handler (`stopQuickTunnel()`) ensures graceful teardown.

---

## 2. Core Modules & Workflows

### 2.1 Onboarding & Network Configuration

The onboarding system is the first-contact provisioning workflow that transforms a raw Raspberry Pi into a fully operational kiosk terminal. It operates in two distinct modes:

#### 2.1.1 Mode Selection Logic

```
GET /api/wifi/setup-mode → { isSetupMode: boolean, isOnboarded: boolean }

Decision Matrix:
┌─────────────────┬──────────────┬───────────────────────────────────┐
│ isOnboarded     │ isSetupMode  │ Result                            │
├─────────────────┼──────────────┼───────────────────────────────────┤
│ false           │ any          │ Full Onboarding (mode="full")     │
│ true            │ true         │ Wi-Fi Only (mode="wifi-only")     │
│ true            │ false        │ Normal App (Dashboard/Kiosk)      │
└─────────────────┴──────────────┴───────────────────────────────────┘
```

#### 2.1.2 Full Onboarding Flow (`mode="full"`)

**Step 1 — Identity & Security (`Step1NameAndPin.tsx`)**
1. Admin enters a shop name (defaults to "Modern Press") via a `ValidatedInput` component.
2. Admin creates a 4-digit master PIN using the shared `PinInput` component (4-slot tactile digit grid with focus ring animations and password visibility toggle).
3. Admin confirms the PIN in a second `PinInput` field.
4. On "CONTINUE TO WI-FI PROVISIONING" button press, shop name and PIN are passed to Step 2.

**Step 2 — Network Provisioning (`Step2WifiSetup.tsx`)**
1. Component mounts and immediately calls `GET /api/wifi/scan` to enumerate available SSIDs via `nmcli -t -f IN-USE,SSID,SIGNAL dev wifi`.
2. Networks are rendered in a `PaperTable` with signal strength gauges (5-block ASCII bars) and "SELECT ➔" action buttons.
3. Selecting a network opens a `Modal` containing `WifiConnectModalBody.tsx` for password entry.
4. On submission, the system posts `POST /api/wifi/connect` with `{ ssid, password, adminPin, shopName }`.
5. The controller returns immediately (critical: the HTTP response must precede the Wi-Fi radio cycling that would drop the connection).
6. A hazard overlay (`hazard-overlay-backdrop`) renders with a progress gauge polling `GET /api/wifi/connection-status` from Redis (`wifi:connection:status` key, 120s TTL).
7. The 36-second polling engine checks for `{ status: "success" }` to advance, or `{ status: "failed" }` to display error.
8. **Skip Option**: A dashed ghost button at the bottom allows proceeding with the current active network, calling `POST /api/wifi/skip` which completes onboarding without radio cycling.

**Step 3 — Completion (`Step3Completion.tsx`)**
1. Displays emerald success badge: `[ ✓ ] TERMINAL_ONLINE_AND_PROVISIONED`.
2. Instructs the admin to check the HDMI display for the live Cloudflare QR code.
3. Provides the local filesystem path `server/data/cloudflare_url.txt` as a fallback.

**Backend Persistence (`wifi.service.ts → persistSuccessState()`):**
- Hashes the admin PIN with bcrypt (10 rounds).
- Writes `isOnboarded: true`, `shopName`, and `adminPinHash` to SQLite `system_config`.
- Creates `server/data/cloudflare_url.txt` with initial placeholder.
- Spawns `startQuickTunnel(PORT)` to initialize the Cloudflare tunnel.

#### 2.1.3 Wi-Fi Only Flow (`mode="wifi-only"`)

This flow renders when `isOnboarded === true && isSetupMode === true` (e.g., the operator has set `SETUP_MODE=true` in `.env` to reconfigure Wi-Fi without resetting identity).

- Step 1 is completely skipped; the layout starts at Step 2.
- The stepper bar renders a single tab: `1. NETWORK PROVISIONING`.
- Header reads: `SYSTEM_MAINTENANCE // WI-FI_RECONFIGURATION`.
- Backend `persistSuccessState()` does NOT overwrite existing `shopName` or `adminPinHash` — it only updates network state and re-launches the tunnel.
- Completion screen reads: `[ ✓ ] WI-FI_RECONFIGURED_SUCCESSFULLY`.

### 2.2 Printer Setup & Hardware Integration

#### 2.2.1 Discovery & Registration

Printers are discovered and registered through the admin Fleet management page:

1. **USB Discovery**: `lpinfo -v` enumerates all locally attached USB and network devices visible to CUPS.
2. **Network Printer Probing**: `ipptool -tv {uri} get-printer-attributes.test` validates IPP endpoint connectivity.
3. **CUPS Registration**: `lpadmin -p {name} -E -v {uri} -m everywhere` registers the printer with driverless IPP Everywhere support. For HPLIP devices, `hp-setup -i -a --printer={name} {uri}` is used instead.
4. **Fleet Cache Hydration**: On registration, the printer name is added to the Redis SET `fleet:printers`, and its info blob (`{ alias, capabilities, description }`) is stored at `printer:{name}:info`.

#### 2.2.2 Adapter Strategy Pattern

The `PrinterFactory` resolves the appropriate hardware communication adapter based on the device URI scheme:

| URI Prefix | Adapter | Supply Method | Health Check |
|:---|:---|:---|:---|
| `ipp://` | `IppModernAdapter` | IPP `Get-Printer-Attributes` | IPP socket probe |
| `socket://`, `lpd://` | `SnmpAdapter` | SNMP OID walk (`.1.3.6.1.2.1.43.11.1.1.9`) | SNMP reachability |
| `hp:/` | `HpLegacyAdapter` | `hp-levels -p {name}` | `lpstat -p {name}` |
| `usb://epson` | `EpsonLegacyAdapter` | `escputil -i -u -r /dev/usb/lp0` | `lpstat -p {name}` |
| `usb://` (other) | `GenericUsbAdapter` | `ink -p usb` (fallback) | `lpstat -p {name}` |

Each adapter implements the `IPrinterAdapter` interface:
- `healthCheck(): Promise<boolean>` — Digital probe to verify device responsiveness.
- `getSupplies(): Promise<PrinterSupplyStatus>` — Retrieves paper status and ink/toner percentage levels.
- `configure(name: string): Promise<void>` — CUPS queue registration.
- `printFile(printerName, filePath, options): Promise<PrintDispatchResult>` — Physical document dispatch via `lp` command.
- `getJobStatus(printerName, jobId): Promise<JobPollStatus>` — Active job polling (`printing`, `completed`, `held_or_stopped`, `unreachable`).
- `cancelJob(printerName, jobId): Promise<boolean>` — Abort active job.

#### 2.2.3 Heartbeat Loop & Telemetry

The `printer.service.ts` `startHeartbeatLoop()` function runs on server boot (`hydrateSystem()`) and continuously monitors the fleet:

1. Iterates all members of the `fleet:printers` Redis SET.
2. For each printer, resolves its adapter via `PrinterFactory.getAdapter()`.
3. Calls `adapter.healthCheck()` and `adapter.getSupplies()`.
4. Updates Redis keys: `printer:{name}:health` (`healthy`/`flagged`) and `supplies:{name}` (5-minute TTL cache).
5. Emits WebSocket events for real-time UI updates: `printer_state_changed`, `printer_quarantined`.

### 2.3 Print Job Queue & Execution Engine

#### 2.3.1 Job Submission Pipeline

```
Customer uploads document
         │
         ▼
POST /print/submit (multipart/form-data)
         │
         ├── 1. File saved to server/uploads/{uuid}.pdf
         ├── 2. Page count extracted via `pdfinfo {filePath}`
         ├── 3. Cost calculated by pricing.service.calculateQuote()
         ├── 4. Job record inserted into SQLite `print_jobs`
         ├── 5. Job enqueued in BullMQ "print-master" queue
         └── 6. WebSocket event "job_queued" emitted
```

#### 2.3.2 BullMQ Worker Execution

The `printMaster.worker.ts` processes jobs with `concurrency: 1` (drip-feed constraint — one physical print at a time):

1. **Matchmaking** (`matchmaker.service.ts`): Finds the first idle, healthy printer whose capabilities match the job requirements (color, duplex). Excludes printers in the job's `attemptedPrinters` blacklist.
2. **Optimistic Locking**: Sets `printer:{name}:state → "busy"` in Redis before dispatch.
3. **Physical Dispatch**: Resolves adapter via `PrinterFactory.getAdapter()`, calls `adapter.printFile()` which executes the `lp` command and returns a CUPS job ID.
4. **Status Polling Loop**: Every 3 seconds, the worker polls `adapter.getJobStatus()`. Monitors for `completed`, `held_or_stopped`, `unreachable`, or a 30-second stale timeout.
5. **On Success**: Returns `{ cupsJobId, status: "completed", printer }`. The worker event handler releases the printer lock, resets strike counter to 0, cleans up the uploaded file, and wakes any delayed jobs.
6. **On Failure/Jam**: Cancels the jammed CUPS job, increments the printer's strike counter, and triggers failover by re-throwing with priority escalation.

#### 2.3.3 Resilience Architecture

**Strike Counter System:**
- Each failed job increments `printer:{name}:strikes` in Redis.
- At 3 consecutive strikes, the printer's health is set to `flagged` (quarantine), and a `printer_quarantined` WebSocket event fires.
- On any successful job, the strike counter resets to 0.

**Failover Protocol:**
- When a printer jams/stalls, the failed printer is added to `attemptedPrinters[]`.
- The job is re-thrown with elevated `priority: 1` to trigger a BullMQ retry.
- On retry, the matchmaker excludes all previously attempted printers.
- After 2 distinct printers fail, the job is flagged as a "bad document" and discarded.

**Circuit Breaker:**
- If ALL printers in the fleet are quarantined (`health === "flagged"`), the entire BullMQ queue is paused.
- A `queue_paused` WebSocket event alerts the admin.
- Queue resumes via admin action: `POST /jobs/resume`.

**SD Card Failsafe:**
- `metrics.service.ts` monitors disk usage every 30 seconds via `df -h /`.
- If disk usage exceeds 95%, the master queue is automatically paused to prevent SQLite corruption.
- A `system_critical` WebSocket event is emitted.

**Delayed Job Wake-Up:**
- When no printer is available, the worker delays the job for 15 seconds.
- When any printer becomes idle (on job completion or failure), `wakeUpDelayedJobs()` promotes all delayed jobs back to "waiting" state.

### 2.4 Customer Kiosk Page

The customer kiosk is the public-facing document submission interface. It operates as a linear, step-by-step wizard:

#### 2.4.1 Session Management

- On first visit, the client calls `POST /session/create` which generates a UUID session token stored in both SQLite `kiosk_sessions` and Redis `session:{id}` (12-hour TTL).
- The session ID is persisted in `localStorage` and attached to all subsequent API calls.

#### 2.4.2 User Flow

**Step 1 — File Upload (`DropZone.tsx`)**
- Drag-and-drop or click-to-browse file upload zone.
- Accepted formats: PDF, DOCX, images (the server validates and extracts page count).
- On upload, the file is sent to `POST /print/upload` as multipart form data.
- Server responds with `{ pages, filename }` after `pdfinfo` analysis.

**Step 2 — Configuration (`ConfigConsole.tsx`)**
- User selects print options:
  - **Color Mode**: Grayscale / Color (via `CustomSelect` component)
  - **Duplex**: Single-sided / Double-sided
  - **Copies**: Numeric stepper (1–99)
  - **Orientation**: Portrait / Landscape
- All selections are managed by the `useUserPrintStore` Zustand store.

**Step 3 — Quote & Payment (`QuoteReceipt.tsx`)**
- Client calls `POST /print/quote` with configuration payload.
- Server calculates cost using `pricing.service.calculateQuote()`:
  - Base cost = `pages × copies × pricePerPage`
  - Duplex discount = `totalCost × (duplexDiscount / 100)`
  - Bulk discount = if `totalPages >= bulkThreshold`: `totalCost × (bulkDiscount / 100)`
- Receipt renders with itemized breakdown in monospace typography.
- On confirmation, `POST /print/submit` enqueues the job.

**Step 4 — Job Tracking (`JobTracker.tsx`)**
- Real-time job status via WebSocket events:
  - `job_queued` → Shows position in queue
  - `job_active` / `spooling` → Shows printer assignment
  - `job_completed` → Success confirmation with timestamp
  - `job_failed` → Error message with reason

#### 2.4.3 System Offline Overlay (`SystemOfflineOverlay.tsx`)

When all printers in the fleet are offline/quarantined, a top-pinned industrial banner overlays the kiosk:
- Fixed to `top: 20px`, centered, max-width 860px.
- Corner bolt rivets (`▪`), pulsing red LED diode, monospace status readout.
- No drop-shadow (flat industrial aesthetic).
- Title: `[SYSTEM_OFFLINE]`, status: `STATUS: NO_HARDWARE_TARGETS_AVAILABLE`.

### 2.5 Admin Panel & Analytics

#### 2.5.1 Authentication

- Admin authenticates via a 4-digit PIN entered through the shared `PinInput` component.
- `POST /auth/login` validates the PIN against the bcrypt hash in `system_config.admin_pin_hash`.
- On success, a JWT token is issued and stored in `localStorage`.
- All admin API routes are protected by `auth.middleware.ts` which validates the JWT.
- Logout calls `POST /auth/logout` which blacklists the token in Redis.

#### 2.5.2 Dashboard (`Dashboard.tsx`)

The main admin overview renders:
- **Metric Cards** (`MetricCard.tsx`): Total jobs today, revenue, active printers, failed jobs — each with delta indicators and sparkline trends.
- **System Telemetry Gauges**: CPU load, memory usage, disk utilization (from `metrics.service.ts` polling every 30s).
- **Live Queue Summary**: Waiting, active, delayed, completed, failed job counts from BullMQ.

#### 2.5.3 Fleet Management (`Fleet.tsx`)

- **Printer Cards** (`PrinterCard.tsx`): Each registered printer rendered as an industrial card showing:
  - Status LED (green=idle, orange=busy, red=error/flagged)
  - Supply gauges (black ink %, color ink %, paper status)
  - Capabilities badges (color, duplex, A3)
  - Actions: Set default, edit alias, update capabilities, force refresh, delete
- **Discovery Mode**: `POST /printers/discover` triggers `lpinfo -v` and displays new USB/network devices with one-click registration.
- **Health Meter** (`HealthMeter.tsx`): Visual indicator of fleet-wide health percentage.

#### 2.5.4 Queue Management (`Queue.tsx`)

- Live job table powered by `PaperTable` with built-in native pagination.
- Job status pills with color coding: queued (grey), active (orange), completed (green), failed (red).
- Admin actions: Cancel job, hold job, resume job, pause/resume entire queue.
- WebSocket-driven real-time updates — no polling required.

#### 2.5.5 Analytics (`Analytics.tsx`)

Three tabbed sub-views:

**Financial View (`FinancialView.tsx`):**
- Revenue trend line chart (date range selectable via `DateRangePicker`).
- Total revenue, total jobs, completed vs. failed ratio, average cost per job.
- Color vs. B&W revenue split.

**Telemetry View (`TelemetryView.tsx`):**
- Per-printer job volume charts.
- Fleet utilization heatmaps.
- Hardware uptime percentages.

**Archive View (`ArchiveView.tsx`):**
- Historical job table with server-side pagination.
- Filterable by: date range, status, printer.
- CSV export via `GET /analytics/jobs/export`.

#### 2.5.6 Settings (`Settings.tsx`)

- **Pricing Configuration**: Edit per-page B&W/color pricing, duplex discount, bulk threshold/discount.
- **System Information**: Cloudflare tunnel URL, shop name, system uptime, OS/hardware info.
- **Danger Zone**: Factory reset, delete all printers, clear job history.

---

## 3. UI/UX Design System

### 3.1 Design Philosophy

The platform adopts an **"Industrial Automation Console"** visual identity, inspired by factory control panels, CNC machine interfaces, and dot-matrix printer terminals. The aesthetic is deliberately mechanical and tactile — designed to feel like operating physical industrial equipment rather than browsing a typical SaaS application.

Key design principles:
- **Monospace-first typography** for data readouts, labels, and status indicators.
- **Bolted steel access panel** motif with corner rivet accents (`▪`).
- **LED status diodes** that pulse to indicate system state.
- **3D tactile buttons** with CSS drop-shadow depth that depress on click.
- **Hazard overlay patterns** using dot-matrix radial gradients for critical system states.

### 3.2 Color Palette

#### Dark Mode ("Cast Iron & Carbon")

| Token | Hex Value | Usage |
|:---|:---|:---|
| `--bg-primary` | `#1A1D20` | Cast Iron Base — page background |
| `--bg-surface` | `#24282D` | Machined Panel — cards, modals |
| `--bg-surface-hover` | `#2D3238` | Panel hover state |
| `--bg-surface-alt` | `#202327` | Alternating table row tint |
| `--bg-paper` | `#2D3238` | Dark carbon sheet |
| `--border-default` | `#3A4047` | Steel trim — default borders |
| `--border-active` | `#FF5500` | Safety Orange focus rings |
| `--text-primary` | `#E6E8EA` | Bright Zinc — primary text |
| `--text-secondary` | `#9098A2` | Stamped Steel — secondary text |
| `--text-mono` | `#FF5500` | Safety Orange — monospace data |
| `--text-muted` | `#626A72` | Disabled/placeholder text |
| `--accent-primary` | `#FF5500` | Safety Orange — primary brand accent |
| `--accent-primary-hover` | `#E04B00` | Darker Safety Orange — hover states |
| `--accent-secondary` | `#00A396` | Press Cyan — secondary accent |
| `--accent-glow` | `rgba(255, 85, 0, 0.15)` | Orange glow for active states |
| `--status-idle` | `#00FF88` | Online Green — healthy/idle |
| `--status-error` | `#FF4444` | Industrial Red — error/fault |
| `--status-busy` | `#FFAA00` | Warning Orange — busy/processing |

#### Light Mode ("Raw Newsprint & Ink")

| Token | Hex Value | Usage |
|:---|:---|:---|
| `--bg-primary` | `#F4F1EA` | Aged Cotton Paper Base |
| `--bg-surface` | `#EBE6DC` | Pressed Cardstock |
| `--bg-surface-hover` | `#E2DDD2` | Cardstock hover state |
| `--text-primary` | `#1C2024` | Carbon Ink — primary text |
| `--text-secondary` | `#626A72` | Faded Stamp |
| `--accent-primary` | `#D03B00` | Deep Industrial Red-Orange |
| `--status-idle` | `#16A34A` | Forest Green |
| `--status-error` | `#DC2626` | Press Red |
| `--status-busy` | `#D97706` | Amber warning |

### 3.3 Typography

| Token | Font Family | Usage |
|:---|:---|:---|
| `--font-mono` | `'IBM Plex Mono', monospace` | Status readouts, labels, data values, table headers, PIN digits, system tags |
| `--font-body` | `'Space Grotesk', 'Inter', sans-serif` | Body text, descriptions, paragraphs |

All monospace labels use `text-transform: uppercase` and `letter-spacing: 0.05–0.1em` for the industrial stenciled effect.

### 3.4 Spacing System

| Token | Value | Usage |
|:---|:---|:---|
| `--spacing-xs` | 4px | Tight internal gaps |
| `--spacing-sm` | 8px | Small padding, table cell gaps |
| `--spacing-md` | 16px | Standard padding, card padding |
| `--spacing-lg` | 24px | Section spacing, modal padding |
| `--spacing-xl` | 40px | Page-level vertical rhythm |

### 3.5 Border Radii

| Token | Value | Usage |
|:---|:---|:---|
| `--radius-sm` | 2px | Badges, small elements |
| `--radius-md` | 4px | Cards, inputs, buttons |
| `--radius-lg` | 6px | Modals, large containers |

### 3.6 Interactive States

**Buttons (`Button.tsx`):**
- **Primary**: `background: var(--btn-bg)` with `box-shadow: var(--btn-shadow)` creating a 4px 3D depth effect. On hover, translateY(-1px). On active/click, translateY(2px) with shadow reduction to simulate physical depression.
- **Ghost**: Transparent background with dashed border, used for secondary actions.
- **Danger**: Red variant for destructive actions.
- **Loading**: In-house `LoadingNet` component (compact mode, 28px dot-matrix printhead scanner) rendered inside the button with a glassmorphic `backdrop-filter: blur(4px)` overlay.

**PIN Input (`PinInput.tsx`):**
- 4 fixed-width (52px) digit slots with `box-shadow: 0 4px 0` for 3D key-cap effect.
- **Focused state**: translateY(-2px), orange border, orange glow ring (`0 0 0 3px rgba(255, 107, 0, 0.3)`).
- **Filled state**: Orange border with orange drop-shadow.
- Password visibility toggle (👁 icon) positioned inline with the digit grid.

**Custom Select (`CustomSelect.tsx`):**
- **Desktop (>640px)**: Standard dropdown with `max-height: 260px` and `overflow-y: auto`.
- **Mobile (≤640px)**: Triggers the global `<Modal />` with scrollable option list (`max-height: 320px`) — avoids cramped inline dropdowns on touch screens.

### 3.7 Layout Differences: Admin vs. Customer Kiosk

| Aspect | Admin Dashboard | Customer Kiosk |
|:---|:---|:---|
| **Layout** | Sidebar navigation + content area | Full-screen wizard, step-by-step linear flow |
| **Complexity** | Multi-page SPA with tabs, charts, tables | Single-page progressive form |
| **Typography** | Mix of `--font-mono` and `--font-body` | Primarily `--font-body` with mono accents |
| **Authentication** | PIN-gated admin access | Session-based anonymous access |
| **Navigation** | `AdminLayout.tsx` with sidebar links: Dashboard, Fleet, Queue, Settings, Analytics | `UserLayout.tsx` with floating controls widget |
| **Data Density** | High — charts, tables, multi-column grids | Low — focused, single-task screens |
| **Interactive Elements** | Complex: printer cards, queue tables, analytics charts, date pickers | Simple: file upload, radio buttons, copy stepper |
| **Mobile Priority** | Secondary (admin typically uses desktop/tablet) | Primary (customers access via phone) |

### 3.8 Shared Component Library

| Component | Description |
|:---|:---|
| `Button.tsx` | 3D tactile button with primary/ghost/danger variants and loading state |
| `PinInput.tsx` | 4-digit PIN entry with focus animations and visibility toggle |
| `PaperTable.tsx` | Styled data table with native client-side pagination and optional server-controlled pagination |
| `Modal.tsx` | Bolted steel access panel modal with rivet accents and mono title bar |
| `CustomSelect.tsx` | Dropdown with mobile-modal fallback and scroll limits |
| `ValidatedInput.tsx` | Form input with inline validation rules and error messaging |
| `LoadingNet.tsx` | Dot-matrix printhead scanner animation (full-page and compact modes) |
| `LoadingScreen.tsx` | Full-page loading overlay |
| `EmptyState.tsx` | Illustrated empty state placeholders for tables and lists |
| `ToastStack.tsx` | Stacked notification system (success/error/info/warning variants) |
| `DateRangePicker.tsx` | Calendar-based date range selector for analytics filtering |
| `Checkbox.tsx` | Styled checkbox with monospace label |
| `SkeletonPrimitives.tsx` | Loading skeleton placeholders (lines, circles, rectangles) |

---

## 4. Codebase Architecture

### 4.1 Client Codebase (`admin-ui/`)

```
admin-ui/
├── public/                          # Static assets served by Vite
├── src/
│   ├── App.tsx                      # Root component: setup mode routing, route definitions
│   ├── main.tsx                     # React DOM entry point, provider wrappers (Theme, Modal, Toast)
│   ├── index.css                    # Master stylesheet import chain (9 CSS modules)
│   │
│   ├── assets/                      # Static images, icons, and media
│   │
│   ├── fonts/                       # Self-hosted web fonts (IBM Plex Mono, Space Grotesk)
│   │   ├── *.woff2                  # WOFF2 font files for all weights (400-700)
│   │
│   ├── styles/                      # Modular CSS design system
│   │   ├── reset.css                # Browser reset, box-sizing, scroll behavior
│   │   ├── theme.css                # CSS variable tokens: dark mode + light mode palettes
│   │   ├── components.css           # Shared component styles: buttons, inputs, selects, tables
│   │   ├── modal.css                # Modal backdrop, panel, header, animation keyframes
│   │   ├── toast.css                # Toast notification container, variant styles, animations
│   │   ├── animations.css           # Global keyframe animations (fade, slide, pulse)
│   │   ├── onboarding.css           # Onboarding console: canvas, card, stepper, PIN grid, LED, hazard overlay
│   │   ├── analytics.css            # Analytics-specific chart and tab styles
│   │   └── responsive.css           # Media query overrides (must load last in cascade)
│   │
│   ├── context/                     # React Context providers
│   │   ├── ThemeContext.tsx          # Dark/light theme toggle with localStorage persistence
│   │   ├── ModalContext.tsx          # Global modal state: openModal(config), closeModal()
│   │   └── ToastContext.tsx          # Toast notification queue: addToast(type, message, duration)
│   │
│   ├── stores/                      # Zustand global state stores
│   │   ├── useAdminStore.ts         # Admin state: auth, printers, queue, metrics, WebSocket handler
│   │   └── useUserPrintStore.ts     # Customer kiosk state: session, file, config, quote, job tracking
│   │
│   ├── services/                    # API communication layer
│   │   ├── apiClient.ts             # Base HTTP client: GET/POST/PUT/DELETE with JWT auth headers
│   │   ├── api.ts                   # Typed API methods: fetchPrinters(), submitPrintJob(), scanWifi(), etc.
│   │   └── websocketService.ts      # WebSocket client: auto-connect, reconnect, event dispatching
│   │
│   ├── hooks/                       # Custom React hooks
│   │   └── useSessionJobs.ts        # Session-scoped job filtering from admin store
│   │
│   ├── types/                       # TypeScript type definitions
│   │   └── index.ts                 # Shared interfaces: BackendPrinter, BackendJob, BackendMetrics,
│   │                                #   MetricSnapshot, WebSocketEvent, PricingConfig, WifiNetwork
│   │
│   ├── utils/                       # Utility modules
│   │   ├── sound.ts                 # UI sound effects: click, success, error (AudioContext API)
│   │   └── validationRules.ts       # Input validation: required, minLength, maxLength, pattern matchers
│   │
│   ├── layouts/                     # Page layout shells
│   │   ├── AdminLayout.tsx          # Admin chrome: sidebar nav, PIN login gate, header, content slot
│   │   ├── UserLayout.tsx           # Customer kiosk chrome: minimal wrapper, offline overlay, floating controls
│   │   └── OnboardingLayout.tsx     # Onboarding console: mode="full" (2-step) / mode="wifi-only" (1-step)
│   │
│   ├── components/                  # UI component library
│   │   ├── shared/                  # Cross-cutting shared components
│   │   │   ├── Button.tsx           # 3D tactile button: primary/ghost/danger, loading with LoadingNet
│   │   │   ├── PinInput.tsx         # 4-digit PIN entry: focus ring, visibility toggle, auto-advance
│   │   │   ├── PaperTable.tsx       # Data table: native + server pagination, sortable headers
│   │   │   ├── Modal.tsx            # Bolted steel panel modal: rivet accents, mono title, size variants
│   │   │   ├── CustomSelect.tsx     # Dropdown (desktop) / modal picker (mobile) with scroll limits
│   │   │   ├── ValidatedInput.tsx   # Form input with validation rules, error state, monospace label
│   │   │   ├── LoadingNet.tsx       # Dot-matrix printhead scanner: full-page and compact button modes
│   │   │   ├── LoadingScreen.tsx    # Full-page centered loading indicator
│   │   │   ├── EmptyState.tsx       # Illustrated empty states for various data views
│   │   │   ├── ToastStack.tsx       # Stacked notification system with auto-dismiss timers
│   │   │   ├── DateRangePicker.tsx  # Calendar date range selector for analytics
│   │   │   ├── Checkbox.tsx         # Styled checkbox with label
│   │   │   └── SkeletonPrimitives.tsx # Loading skeletons: lines, circles, rectangles
│   │   │
│   │   ├── admin/                   # Admin-specific components
│   │   │   ├── PrinterCard.tsx      # Fleet printer card: status LED, supply gauges, action buttons
│   │   │   ├── MetricCard.tsx       # Dashboard stat card: value, label, delta, sparkline
│   │   │   ├── HealthMeter.tsx      # Fleet health percentage indicator
│   │   │   ├── charts/             # Chart components (Recharts wrappers)
│   │   │   └── skeletons/          # Admin-specific loading skeletons
│   │   │
│   │   ├── user/                    # Customer kiosk components
│   │   │   ├── ActiveJobIndicator.tsx    # Real-time job status badge with progress
│   │   │   ├── FloatingControlsWidget.tsx # Floating action panel: theme toggle, Wi-Fi, admin link
│   │   │   ├── ProgressBar.tsx           # Linear progress bar component
│   │   │   ├── SystemOfflineOverlay.tsx  # Top-pinned offline banner with LED and bolts
│   │   │   ├── WifiSetup.tsx             # In-kiosk Wi-Fi configuration panel
│   │   │   └── skeletons/               # Kiosk-specific loading skeletons
│   │   │
│   │   └── onboarding/             # Onboarding wizard step components
│   │       ├── Step1NameAndPin.tsx       # Shop name + master PIN configuration
│   │       ├── Step2WifiSetup.tsx        # Wi-Fi scanner, network selection, connection overlay
│   │       ├── Step3Completion.tsx       # Success confirmation screen (mode-aware)
│   │       └── WifiConnectModalBody.tsx  # Password entry modal for Wi-Fi networks
│   │
│   └── pages/                       # Route-level page components
│       ├── admin/
│       │   ├── Dashboard.tsx        # Admin overview: metric cards, system gauges, queue summary
│       │   ├── Fleet.tsx            # Printer fleet management: cards, discovery, bulk actions
│       │   ├── Queue.tsx            # Live job queue table with admin controls
│       │   ├── Settings.tsx         # Pricing config, system info, danger zone
│       │   ├── Analytics.tsx        # Analytics container with tab navigation
│       │   └── analytics/
│       │       ├── FinancialView.tsx   # Revenue charts, color/BW split, trend lines
│       │       ├── TelemetryView.tsx   # Per-printer telemetry and utilization
│       │       └── ArchiveView.tsx     # Historical job archive with export
│       │
│       └── user/
│           ├── DropZone.tsx         # File upload: drag-and-drop, file validation
│           ├── ConfigConsole.tsx    # Print options: color, duplex, copies, orientation
│           ├── QuoteReceipt.tsx     # Cost breakdown and payment confirmation
│           └── JobTracker.tsx       # Real-time job status tracker
│
├── vite.config.ts                   # Vite build configuration, proxy settings, output paths
├── tsconfig.json                    # TypeScript compiler configuration
└── package.json                     # Dependencies: react, zustand, recharts, lucide-react, etc.
```

### 4.2 Server Codebase (`server/`)

```
server/
├── src/
│   ├── server.ts                    # HTTP server entry point: boots Express, WebSocket, BullMQ,
│   │                                #   hydrates system config, starts metrics polling, launches tunnel
│   ├── app.ts                       # Express application: CORS, body parsing, static serving,
│   │                                #   route mounting, health check, SPA catch-all
│   │
│   ├── adapters/                    # Hardware communication strategy adapters (Strategy Pattern)
│   │   ├── IPrinterAdapter.ts       # Interface contract: healthCheck, getSupplies, printFile,
│   │   │                            #   getJobStatus, cancelJob, configure
│   │   ├── IppModernAdapter.ts      # IPP protocol adapter: ipp:// URIs, Get-Printer-Attributes
│   │   ├── HpLegacyAdapter.ts       # HPLIP adapter: hp:/ URIs, hp-setup, hp-levels
│   │   ├── EpsonLegacyAdapter.ts    # Epson USB adapter: escputil ink level queries
│   │   ├── SnmpAdapter.ts           # SNMP adapter: socket://, lpd:// URIs, OID-based supply walks
│   │   └── GenericUsbAdapter.ts     # Fallback USB adapter: generic lpadmin, ink CLI tool
│   │
│   ├── factories/                   # Creational patterns
│   │   └── printer.factory.ts       # PrinterFactory: resolves adapter by URI scheme from CUPS
│   │
│   ├── commands/                    # OS command wrappers (shell command abstraction layer)
│   │   ├── cups.commands.ts         # CUPS CLI: lpstat, lpadmin, lp, lpinfo, lpoptions, ipptool
│   │   ├── hp.commands.ts           # HPLIP CLI: hp-setup, hp-levels
│   │   └── system.commands.ts       # System CLI: pdfinfo, nmcli, wpa_cli, snmpwalk, escputil,
│   │                                #   df, lsusb, ink
│   │
│   ├── config/                      # Static configuration files
│   │   ├── capabilities.json        # Printer capability definitions (extensible)
│   │   └── pricing.json             # Default pricing configuration seed
│   │
│   ├── infrastructure/              # Core infrastructure modules
│   │   ├── database.ts              # SQLite initialization: schema DDL, WAL mode, indexes,
│   │   │                            #   table creation (system_config, printers, pricing_config,
│   │   │                            #   print_jobs, kiosk_sessions, payments)
│   │   ├── redis.ts                 # Redis client factory: connection, publisher, subscriber instances
│   │   ├── redisKeys.ts             # Redis key patterns and TTL constants
│   │   ├── boot.ts                  # System hydration: load SQLite configs into memory,
│   │   │                            #   global pricing/system config caches, heartbeat loop start
│   │   ├── printMaster.queue.ts     # BullMQ queue definition: "print-master", 3 attempts,
│   │   │                            #   PrintJobData interface, removePrinterFromAttemptedJobs()
│   │   ├── printMaster.worker.ts    # BullMQ worker: matchmaking → dispatch → poll → failover,
│   │   │                            #   strike counter, quarantine, circuit breaker, delayed job wake-up
│   │   └── printMaster.events.ts    # BullMQ queue events: completed/failed → SQLite cold tier sync
│   │
│   └── app/                         # Application layer (MVC-style)
│       ├── controllers/             # Route handlers (request → response)
│       │   ├── printer.controller.ts    # Printer CRUD, discovery, configuration, supply reads,
│       │   │                            #   capability management, health status
│       │   ├── print.controller.ts      # File upload, page count, quote calculation, job submission
│       │   ├── jobs.controller.ts       # Queue inspection, job cancellation, hold/resume, pause/resume queue
│       │   ├── events.controller.ts     # WebSocket server initialization, event broadcasting,
│       │   │                            #   eventBus subscription relay to connected clients
│       │   ├── wifi.controller.ts       # Wi-Fi scan, connect, skip, connection status, setup mode check
│       │   ├── auth.controller.ts       # PIN login, JWT issuance, logout/token blacklist
│       │   ├── config.controller.ts     # Pricing config CRUD, system config reads
│       │   ├── analytics.controller.ts  # Financial summaries, revenue trends, color splits,
│       │   │                            #   fleet telemetry, job archive with pagination, CSV export
│       │   └── session.controller.ts    # Kiosk session creation
│       │
│       ├── routes/                  # Express router definitions
│       │   ├── printer.routes.ts    # /printers/* — CRUD, discover, configure, capabilities, refresh
│       │   ├── print.routes.ts      # /print/* — upload, quote, submit
│       │   ├── jobs.routes.ts       # /jobs/* — list, cancel, hold, resume, pause, flush
│       │   ├── events.routes.ts     # / — WebSocket upgrade endpoint
│       │   ├── wifi.routes.ts       # /wifi/* — scan, connect, skip, setup-mode, connection-status
│       │   ├── auth.routes.ts       # /auth/* — login, logout, verify
│       │   ├── config.routes.ts     # /config/* — pricing CRUD, system config
│       │   ├── analytics.routes.ts  # /analytics/* — financial, fleet, jobs, export
│       │   ├── fleet.routes.ts      # /fleet/* — fleet-level aggregate endpoints
│       │   ├── session.routes.ts    # /session/* — create session
│       │   └── utils.routes.ts      # /utils/* — page count, system diagnostics
│       │
│       ├── services/                # Business logic layer
│       │   ├── printer.service.ts   # Fleet hydration, heartbeat loop, CUPS integration,
│       │   │                        #   printer registration, supply fetching, capability management
│       │   ├── job.service.ts       # Queue operations: enqueue, cancel, hold, resume, pause, flush
│       │   ├── matchmaker.service.ts # Printer matchmaking: capability matching, health filtering,
│       │   │                        #   failover blacklist exclusion, target preference
│       │   ├── pricing.service.ts   # Quote calculation engine: per-page pricing, duplex discount,
│       │   │                        #   bulk discount, pricing CRUD with SQLite sync
│       │   ├── wifi.service.ts      # Network management: nmcli scan/connect, skip-wifi flow,
│       │   │                        #   onboarding persistence (isOnboarded, shopName, adminPinHash)
│       │   ├── tunnel.service.ts    # Cloudflare Quick Tunnel: process spawn, URL parsing,
│       │   │                        #   SQLite/filesystem persistence, start/stop lifecycle
│       │   ├── auth.service.ts      # PIN validation (bcrypt compare), JWT sign/verify
│       │   ├── analytics.service.ts # SQLite aggregate queries: financial summaries, trends,
│       │   │                        #   color splits, fleet telemetry, paginated job archives
│       │   ├── metrics.service.ts   # System telemetry: CPU load, memory, disk usage polling (30s),
│       │   │                        #   SD card failsafe (>95% → auto-pause queue)
│       │   ├── supplies.service.ts  # Supply level abstraction: adapter delegation, Redis TTL cache
│       │   ├── config.db.service.ts # SQLite system_config singleton CRUD: get/update with
│       │   │                        #   in-memory cache sync via boot.ts globals
│       │   ├── printJob.db.service.ts # SQLite print_jobs write-through: markCompleted, markFailed
│       │   └── session.service.ts   # Session token generation and SQLite persistence
│       │
│       ├── middlewares/             # Express middleware
│       │   └── auth.middleware.ts   # JWT validation, token blacklist check, admin route protection
│       │
│       ├── types/                   # Server-side TypeScript interfaces
│       │   ├── index.ts             # Re-export barrel
│       │   ├── wifi.types.ts        # ConnectPayload, WiFiNetwork interfaces
│       │   ├── printer.types.ts     # PrinterSupplyStatus, PrinterInfo interfaces
│       │   ├── pricing.types.ts     # PricingConfig interface
│       │   └── metrics.types.ts     # MetricSnapshot interface
│       │
│       └── utils/                   # Server utilities
│           ├── exec.ts              # Secure child process execution: runSecureCommand(),
│           │                        #   runSecureCommandWithTimeout() — spawns with input sanitization
│           └── eventBus.ts          # Node.js EventEmitter singleton for internal event routing
│
├── data/                            # Runtime data directory (gitignored)
│   ├── print_spooler.db            # SQLite database file
│   ├── cloudflare_url.txt          # Persisted Cloudflare tunnel URL
│   └── uploads/                    # Temporary file upload staging area
│
├── public/                          # Built admin-ui static files (Vite output target)
│   └── admin/                       # SPA bundle served by Express static middleware
│
├── tsconfig.json                    # TypeScript compiler configuration
├── package.json                     # Dependencies: express, bullmq, ioredis, better-sqlite3,
│                                    #   bcrypt, jsonwebtoken, multer, cors, ws, dotenv
└── .env                             # Environment variables: PORT, REDIS_HOST, SETUP_MODE, JWT_SECRET
```

### 4.3 Deployment Architecture

```
deploy.sh
├── 1. cd admin-ui && npm run build  # Vite production build → outputs to ../admin/
├── 2. cp -r admin/* server/public/  # Copy built SPA into Express static serving directory
├── 3. cd server && npm run build    # TypeScript compilation → dist/
└── 4. node dist/server.js           # Launch production server on port 3000
```

The deployment strategy is a **monolithic edge deployment**: the Vite-built SPA is copied into the Express server's `public/` directory, and the entire platform runs as a single Node.js process. The Express catch-all route (`app.get(/.*/)`) serves `index.html` for client-side routing. All API routes are mounted under their respective prefixes (`/printers`, `/print`, `/jobs`, `/wifi`, `/auth`, `/config`, `/analytics`, `/fleet`, `/session`).

---

> *End of Platform Specification Document*
