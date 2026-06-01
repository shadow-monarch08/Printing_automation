# Architecture State Report

> **Generated from:** Full codebase traversal of `Printing_automation/server/src/`
> **Purpose:** Inform the design of a relational SQL database (SQLite/PostgreSQL) to run alongside Redis for historical analytics, permanent job archiving, and a new payment gateway.

---

## 1. The Print Job Payload (BullMQ Analysis)

### 1.1 Queue Definition

The print queue is defined in [printMaster.queue.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.queue.ts). It uses **BullMQ** with the queue name `"print-master"`.

```typescript
export const printMasterQueue = new Queue<PrintJobData>("print-master", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,              // 1 initial try + 2 failover retries
    removeOnComplete: 100,    // Keep last 100 completed jobs in Redis
    removeOnFail: 500,        // Keep last 500 failed jobs in Redis
  },
});
```

> [!IMPORTANT]
> **Data Retention Gap:** Only the last 100 completed and 500 failed jobs are retained in Redis. All older jobs are permanently deleted. There is **no historical archive** — this is the primary reason a SQL database is needed.

### 1.2 Exact `PrintJobData` Interface

Source: [printMaster.queue.ts#L4-L19](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.queue.ts#L4-L19)

```typescript
export interface PrintJobData {
  id: string;                          // UUID (generated via uuidv4)
  filename: string;                    // Original filename from upload
  filePath: string;                    // Absolute path to uploaded file on server
  owner: string;                       // "Guest" for kiosk users (hardcoded default)
  pages: number;                       // Total page count of the document
  copies: number;                      // Number of copies requested
  colorMode: 'color' | 'grayscale';    // Print color mode
  duplex: 'single' | 'double';        // Simplex or duplex printing
  orientation: 'portrait' | 'landscape';
  targetPrinter?: string;             // Optional: admin-specified target printer
  cost: number;                        // Pre-calculated cost in ₹ (integer, rounded)
  attemptedPrinters: string[];         // Failover blacklist — printers that failed this job
  submittedAt: string;                 // ISO 8601 timestamp
  cupsJobId?: string;                  // Assigned after CUPS dispatch (e.g., "HP_LaserJet-42")
}
```

### 1.3 Actual Payload at Enqueue Time

The controller at [print.controller.ts#L34-L49](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/print.controller.ts#L34-L49) constructs the payload. It adds one additional field **not in the interface**:

```typescript
const jobData = {
  id: jobId,                                    // uuidv4()
  filename: req.file.originalname,
  filePath,                                     // path.resolve(req.file.path)
  owner,                                        // req.body.owner || "Guest"
  sessionId,                                    // req.body.sessionId || null  ← NOT IN INTERFACE
  pages,                                        // parseInt(req.body.pages || "1")
  copies,                                       // parseInt(req.body.copies || "1")
  colorMode,                                    // req.body.colorMode || "grayscale"
  duplex,                                       // req.body.duplex || "single"
  orientation,                                  // req.body.orientation || "portrait"
  targetPrinter,                                // req.body.printer || undefined
  cost,                                         // From pricingService.calculateQuote()
  attemptedPrinters: [],                        // Empty at submission
  submittedAt: new Date().toISOString()
};

await printMasterQueue.add("print", jobData as any, { jobId });
```

> [!WARNING]
> **Type Drift:** The `sessionId` field is passed into the queue payload but is **not declared** on the `PrintJobData` interface. The `as any` cast hides this. The SQL schema should formalize `sessionId` as a first-class column.

### 1.4 Worker Return Value (Job Completion)

On successful completion, the worker returns ([printMaster.worker.ts#L45](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts#L45)):

```typescript
return { cupsJobId, status: "completed", printer: matchedPrinter };
```

This `returnvalue` is later read to identify which printer handled the job.

### 1.5 Mapped Job Structure (API Response)

The [job.service.ts#L13-L32](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/job.service.ts#L13-L32) maps BullMQ jobs to the API response:

```typescript
{
  id: string,
  cupsJobId: string | null,       // From returnvalue (only populated after CUPS dispatch)
  filename: string,
  owner: string,
  sessionId: string,              // Used for kiosk session filtering
  pages: number,
  copies: number,
  colorMode: string,
  duplex: string,
  orientation: string,
  targetPrinter: string,          // Falls back to 'Auto'
  status: string,                 // "printing" | "queued" | "spooling" | "done" | "failed"
  cost: number,
  submittedAt: string,
  completedAt: string | null,     // Derived from job.finishedOn
  error: string | null            // From job.failedReason
}
```

### 1.6 Document Metadata — What IS and IS NOT Tracked

| Property | Tracked? | Notes |
|---|---|---|
| Page count | ✅ | Detected via `pdfinfo` for PDFs, defaults to 1 for images/other |
| Color mode | ✅ | `'color'` or `'grayscale'` |
| Copies | ✅ | Integer |
| Duplex | ✅ | `'single'` or `'double'` |
| Orientation | ✅ | `'portrait'` or `'landscape'` |
| File path | ✅ | Absolute server path (deleted after completion) |
| Original filename | ✅ | From `req.file.originalname` |
| **File size** | ❌ | Available in `req.file.size` but never captured |
| **MIME type** | ❌ | Used for page counting but not stored in job data |
| **Paper size** | ❌ | Not tracked at all (e.g., A4 vs. Letter) |

---

## 2. The User & Authentication Model

### 2.1 Current Authentication Flow

Source: [auth.service.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/auth.service.ts), [auth.middleware.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/middlewares/auth.middleware.ts), [auth.controller.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/auth.controller.ts)

The system uses a **single-PIN authentication model** for the admin dashboard:

```
┌──────────┐    POST /auth/login     ┌──────────────┐
│  Admin   │ ──── { pin: "1234" } ──►│ auth.service  │
│  Browser │                         │  bcrypt.compare│
│          │ ◄── { token: "jwt..." } │  jwt.sign()   │
└──────────┘                         └──────────────┘
```

**Login process:**
1. Admin sends a **4-digit PIN** to `POST /auth/login`
2. PIN is compared against `ADMIN_PIN_HASH` env var (or hardcoded `"1234"` fallback)
3. On success, a JWT is issued with payload `{ role: "admin" }` and 24-hour expiry
4. Token is sent as `Authorization: Bearer <token>` for subsequent requests

**Logout process:**
- The token is added to a Redis blacklist key `blacklist:<token>` with a TTL matching the token's remaining lifetime

**Token verification** ([auth.middleware.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/middlewares/auth.middleware.ts)):
1. Verify JWT signature
2. Check Redis blacklist
3. If both pass → `next()`

### 2.2 User Identity for Print Jobs

> [!IMPORTANT]
> **There is no user registration or login system for print job submitters.** Print jobs are submitted from the public-facing kiosk UI with **no authentication required**.

The `POST /print` route has **no `requireAuth` middleware**:

```typescript
// print.routes.ts
router.post("/", upload.single("file"), printController.printFile);  // ← NO AUTH
```

User identity at job submission:
- `owner`: Defaults to `"Guest"` — a free-text field with no identity verification
- `sessionId`: An optional field sent from the frontend — appears to be a client-generated identifier for filtering "my jobs" in the kiosk view

**There is no:**
- User registration / sign-up
- Email / phone collection
- MAC address or captive portal integration
- Session management beyond the optional `sessionId`

### 2.3 Role-Based Access Control (RBAC)

The JWT payload contains `{ role: "admin" }`, but **there is only one role defined**:

| Role | How it works |
|---|---|
| `admin` | Single shared PIN, JWT with `role: "admin"`. Protects destructive operations. |
| *Guest / User* | **No role exists.** Anyone on the network can submit print jobs. |

**Routes protected by `requireAuth`:**
- `POST /jobs/queue/pause`
- `POST /jobs/queue/resume`
- `POST /jobs/queue/emergency-stop`
- `DELETE /jobs/:jobId`
- `POST /jobs/:jobId/pause`
- `POST /jobs/:jobId/resume`
- `POST /jobs/:jobId/priority`
- `DELETE /printers/`
- `DELETE /printers/:name`
- `GET /auth/verify`

**Routes with NO authentication:**
- `POST /print` (submit job)
- `GET /jobs` (list all jobs)
- `GET /printers` (list printers)
- `POST /printers/configure`
- `GET /fleet/kiosk-status`
- All SSE/events endpoints

---

## 3. Payment & Pricing Logic

### 3.1 Payment Gateway Status

> [!CAUTION]
> **No payment gateway exists.** There are zero references to Stripe, Razorpay, PayPal, UPI, or any payment SDK in the entire codebase. The `cost` field is calculated and stored but never charged.

### 3.2 Pricing Configuration

Source: [pricing.service.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/pricing.service.ts), [pricing.json](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/config/pricing.json)

```typescript
export interface PricingConfig {
  bwPerPage: number;        // ₹2 default — cost per B&W page
  colorPerPage: number;     // ₹10 default — cost per color page
  currency: string;         // "₹" (Indian Rupees)
  duplexDiscount: number;   // 10 (percentage discount for duplex)
  bulkThreshold: number;    // 50 (page count to qualify for bulk)
  bulkDiscount: number;     // 15 (percentage discount for bulk)
}
```

Current live config (`pricing.json`):

```json
{
  "bwPerPage": 2,
  "colorPerPage": 10,
  "currency": "₹",
  "duplexDiscount": 10,
  "bulkThreshold": 50,
  "bulkDiscount": 15
}
```

### 3.3 Pricing Calculation Rules

Source: [pricing.service.ts#L45-L82](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/pricing.service.ts#L45-L82)

The pricing is **dynamic**, not flat-rate. The formula:

```
1. totalPages = pages × copies
2. basePricePerSheet = (colorMode === "color") ? colorPerPage : bwPerPage
3. totalCost = totalPages × basePricePerSheet

4. IF duplex === "double":
     duplexDiscount = totalCost × (duplexDiscount% / 100)
     totalCost -= duplexDiscount

5. IF totalPages >= bulkThreshold:
     bulkDiscount = totalCost × (bulkDiscount% / 100)
     totalCost -= bulkDiscount

6. RETURN Math.round(totalCost)
```

**Example:** 60 color pages, duplex, 1 copy:
- Base: 60 × ₹10 = ₹600
- Duplex discount (10%): −₹60 → ₹540
- Bulk discount (15%, since 60 ≥ 50): −₹81 → **₹459**

### 3.4 Where the Cost is Computed and Stored

1. **Quote API** — `POST /print/quote` → calls `pricingService.calculateQuote()` and returns the cost to the frontend for display
2. **Job Submission** — `POST /print` → calls `calculateQuote()` internally, stores the result in `jobData.cost`, and enqueues it

### 3.5 Payment Injection Point

> [!TIP]
> The exact insertion point for a payment/checkout flow is in [print.controller.ts#L30-L52](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/print.controller.ts#L30-L52), **between** the cost calculation (line 31) and the queue enqueue (line 52).

```typescript
// print.controller.ts — CURRENT FLOW (no payment):
const { cost } = await pricingService.calculateQuote(pages, copies, colorMode, duplex);
// ← ★ INSERT PAYMENT CHECKOUT HERE ★
//    1. Create payment intent/order with gateway (Razorpay/Stripe)
//    2. Verify payment confirmation
//    3. Only proceed to enqueue if payment succeeded
await printMasterQueue.add("print", jobData, { jobId });
```

### 3.6 Revenue Tracking (Current State)

The [events.controller.ts#L77-L84](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/events.controller.ts#L77-L84) sums revenue from completed BullMQ jobs:

```typescript
for (const job of completedJobs) {
  if (job.finishedOn && job.finishedOn >= todayStartTime) {
    completedToday++;
    revenue += (job.data.cost || 0);
  }
}
```

> [!WARNING]
> This revenue figure is **unreliable** because: (a) it only sums jobs still in BullMQ's 100-job completed buffer, and (b) `cost` is a pre-quote, not a confirmed payment. The SQL database should store verified payment amounts separately.

---

## 4. Hardware Telemetry & Matchmaker Mapping

### 4.1 Complete Redis Key Schema

Every printer `<name>` in the fleet has these Redis keys:

| Redis Key | Type | Values | TTL | Set By |
|---|---|---|---|---|
| `fleet:printers` | SET | All printer queue names | Permanent | Heartbeat, configurePrinter |
| `printer:<name>:health` | STRING | `"healthy"` \| `"flagged"` | Permanent | HealthCheck, Worker |
| `printer:<name>:state` | STRING | `"idle"` \| `"busy"` | Permanent | Worker, HealthCheck |
| `printer:<name>:strikes` | STRING | Integer counter (`"0"`, `"1"`, `"2"`, `"3"+`) | Permanent | Worker (incr on failure, reset on success) |
| `printer:<name>:info` | STRING (JSON) | Printer metadata object (see §4.2) | Permanent | Heartbeat, configurePrinter |
| `supplies:<name>` | STRING (JSON) | Supply status object (see §4.3) | **300s (5 min)** | HealthCheck |
| `blacklist:<token>` | STRING | `"true"` | Matches JWT expiry | auth.service logout |

### 4.2 Printer Info JSON Structure

Stored at `printer:<name>:info`. Assembled in [printer.controller.ts#L193-L198](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/printer.controller.ts#L193-L198) and [printer.service.ts#L415-L421](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/printer.service.ts#L415-L421):

```json
{
  "name": "HP_LaserJet_Pro_MFP",
  "alias": "Front Desk Printer",
  "capabilities": ["color", "duplex"],
  "type": "usb",
  "description": "is idle. enabled since ..."
}
```

| Field | Type | Source |
|---|---|---|
| `name` | `string` | CUPS queue name (e.g., `HP_LaserJet_Pro_MFP`) |
| `alias` | `string` | Human-readable name from `capabilities.json` config |
| `capabilities` | `string[]` | `["color", "duplex", "grayscale"]` — probed via `lpoptions -l` |
| `type` | `string` | `"usb"` \| `"ipp"` \| `"unknown"` — determined from device URI |
| `description` | `string` | Raw `lpstat -p` output text |

### 4.3 Printer Supply Status Interface

Source: [supplies.service.ts#L5-L11](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/supplies.service.ts#L5-L11)

```typescript
export interface PrinterSupplyStatus {
  paper: "ready" | "empty" | "unknown";
  supplies: {
    black: number | null;    // Percentage (0-100), null if unavailable
    color: number | null;    // Percentage (0-100), null if unavailable
  };
}
```

### 4.4 `PrinterInfo` Interface (API Response)

Source: [printer.service.ts#L12-L22](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/printer.service.ts#L12-L22)

```typescript
export interface PrinterInfo {
  name: string;
  description: string;
  status: string;               // Derived: "idle" | "busy" | "error"
  alias?: string;
  capabilities?: string[];
  type?: string;
  paper?: string;               // From supplies: "ready" | "empty" | "unknown"
  supplyBlack?: number | null;  // From supplies
  supplyColor?: number | null;  // From supplies
}
```

### 4.5 Printer Adapter Interface (Hardware Abstraction)

Source: [IPrinterAdapter.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/adapters/IPrinterAdapter.ts)

```typescript
export interface IPrinterAdapter {
  healthCheck(): Promise<boolean>;
  getSupplies(): Promise<PrinterSupplyStatus>;
  configure(name: string): Promise<void>;
}
```

**Adapter implementations** (resolved by [PrinterFactory](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/factories/printer.factory.ts) based on device URI):

| URI Pattern | Adapter | Protocol |
|---|---|---|
| `ipp://...` | `IppModernAdapter` | IPP |
| `socket://...` / `lpd://...` | `SnmpAdapter` | SNMP |
| `hp:/...` | `HpLegacyAdapter` | HPLIP (`hp-levels`) |
| `usb://epson...` | `EpsonLegacyAdapter` | Epson-specific |
| `usb://...` (other) | `GenericUsbAdapter` | Standard CUPS `lpadmin` |

### 4.6 Matchmaker Logic

Source: [matchmaker.service.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/matchmaker.service.ts)

The `findPrinter()` algorithm:

```
1. Get all printer names from Redis SET `fleet:printers`
2. For each printer:
   a. Read health, state, info from Redis
   b. SKIP if health ≠ "healthy" OR state ≠ "idle"
   c. SKIP if printer is in job's `attemptedPrinters` blacklist
   d. SKIP if job needs "color" but printer lacks "color" capability
   e. SKIP if job needs "double" (duplex) but printer lacks "duplex" capability
   f. Add to candidates list
3. If `targetPrinter` is specified and is in candidates → return it
4. Otherwise → return first available candidate (no load-balancing)
```

### 4.7 Job-to-Printer Tracking

**Does the system log which printer executed a job?**

**Yes**, but only ephemerally:
- The **worker return value** includes `{ printer: matchedPrinter }` ([printMaster.worker.ts#L45](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts#L45))
- On **failure**, the printer name is appended to `attemptedPrinters[]` in the job data
- However, the `job.service.ts` API response does **not expose** which printer completed the job — it only exposes `targetPrinter` (the *requested* printer, not the *actual* one)

> [!WARNING]
> The actual executing printer is stored in `job.returnvalue.printer`, but this data is **lost** when BullMQ evicts completed jobs (after 100 completions). The SQL database must capture this at completion time.

### 4.8 Strike & Quarantine System

| State | Trigger | Recovery |
|---|---|---|
| Strike incremented | Job fails on a printer | `printer:<name>:strikes` incremented via `INCR` |
| Strikes reset | Job completes successfully | Set to `"0"` |
| Quarantined (`"flagged"`) | 3+ strikes accumulated | `printer:<name>:health` → `"flagged"` |
| Global queue paused | ALL printers flagged | `printMasterQueue.pause()` |
| Bad document isolation | Same job fails on 2+ different printers | Job discarded, event emitted |
| Manual recovery | Admin hits `POST /printers/:name/refresh` | Health check re-run, strikes reset if healthy |

### 4.9 Heartbeat Loop

Source: [printer.service.ts#L435-L483](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/printer.service.ts#L435-L483)

Runs every **5 minutes** (`setInterval(sweep, 300000)`):
1. Queries CUPS via `lpstat -p` for all configured printers
2. Adds printer names to `fleet:printers` SET
3. Runs `runComprehensiveHealthCheck()` for each — which:
   - Skips quarantined printers (3+ strikes)
   - Runs adapter-specific digital probe (`healthCheck()`)
   - Checks CUPS status for stopped/rejecting
   - Fetches supplies and caches with 5-minute TTL
   - Updates health, state, and info keys

---

## Summary of Critical Gaps for SQL Database Design

| Gap | Impact | SQL Table Suggestion |
|---|---|---|
| Jobs evicted after 100/500 (complete/fail) | No historical analytics possible | `print_jobs` — permanent archive |
| `sessionId` not in TypeScript interface | Type-unsafe, invisible to schema tools | Formalize in `print_jobs.session_id` |
| No file size or MIME type stored | Cannot analyze usage patterns by file type | Add `file_size_bytes`, `mime_type` columns |
| No paper size tracking | Cannot detect A4/Letter mismatches | Add `paper_size` column |
| Revenue is a pre-quote, not confirmed payment | Revenue metrics are estimates, not actuals | `payments` table with `status`, `gateway_ref` |
| No user model | Cannot build loyalty, history, or payment profiles | `users` table with auth provider |
| Executing printer lost on eviction | Cannot analyze printer utilization | `print_jobs.executed_by_printer` column |
| Supplies cached 5 min, then gone | No supply usage trends | `supply_snapshots` table |
| System metrics in-memory array (60 entries) | No long-term system health history | `system_metrics` table |
