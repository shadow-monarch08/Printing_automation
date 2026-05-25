# Implementation Plan: Bulletproof Print Spooler — Cache-First Architecture

> Based on [instruction_11.md](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/instructions/instruction_11.md) and findings from the [GAP_ANALYSIS_REPORT.md](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/reports/GAP_ANALYSIS_REPORT.md).

---

## Prime Directive

> **No user-facing route or the job matchmaker may execute live shell commands** (`lpstat`, `lsusb`, `ipptool`). All runtime decisions must read from **Redis as the Single Source of Truth**. Only background tasks are permitted to touch hardware.

---

## Redis Key Schema (New)

Before any code changes, the new Redis key namespace must be agreed upon. Every printer `<name>` will have these keys:

| Redis Key | Type | Values | Written By | Read By |
|---|---|---|---|---|
| `printer:<name>:health` | String | `"healthy"` / `"flagged"` | Heartbeat, Force Refresh, Worker (on quarantine) | Matchmaker, Kiosk Status, Fleet API |
| `printer:<name>:state` | String | `"idle"` / `"busy"` | Worker (before/after dispatch), Heartbeat (reconciliation) | Matchmaker, Fleet API |
| `printer:<name>:strikes` | String (numeric) | `"0"` – `"3"` | Worker (on failure/success) | Heartbeat (skip if ≥ 3), Worker (quarantine check) |
| `printer:<name>:info` | Hash | `name`, `description`, `alias`, `capabilities` (JSON), `type`, `uri` | Heartbeat (on startup + periodic), Configure endpoint | Fleet API, Kiosk Status |
| `supplies:<name>` | String (JSON) | `PrinterSupplyStatus` object | Heartbeat, Force Refresh | Fleet API |

---

## Phase 0: Dead Code Eradication

> **Goal:** Remove all live hardware polling from user-facing code paths before building new features. This prevents regressions and makes the codebase ready for cache-first reads.

### Step 0.1 — Strip live `lpstat` from `listPrinters()`

**File:** [printer.service.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/printer.service.ts) (L53–L125)

**Current:** `listPrinters()` executes `cupsCommands.listPrinters()` → `exec('lpstat -p')` on every call.

**Action:**
1. Rename the existing `listPrinters()` to `listPrintersFromCUPS()` — this becomes a private/internal function used **only** by the heartbeat background task.
2. Create a new `listPrinters()` that reads entirely from Redis:
   - Scan all keys matching `printer:*:info` using `SCAN` or maintain a Redis Set `fleet:printers` containing all known printer names.
   - For each printer name, `MGET` the `:health`, `:state`, and `:info` keys.
   - Merge with cached supplies from `supplies:<name>`.
   - Return the same `PrinterInfo[]` shape the rest of the codebase expects.

**Risk:** Every controller and the metrics endpoint currently depends on `listPrinters()`. By making the new version cache-first, all downstream consumers automatically become cache-first with zero signature changes.

---

### Step 0.2 — Strip live `lpstat` from `getKioskStatus()`

**File:** [printer.controller.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/printer.controller.ts) (L222–L263)

**Current:** `getKioskStatus()` calls `listPrinters()` (which currently runs `lpstat`).

**Action:** After Step 0.1, `getKioskStatus()` automatically reads from cache because `listPrinters()` is now cache-first. No further changes needed to this controller — it inherits the fix.

---

### Step 0.3 — Strip live `lpstat` from `getPrinters()`

**File:** [printer.controller.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/printer.controller.ts) (L7–L30)

**Current:** Calls `listPrinters()` + loops through each printer to call `suppliesService.getSupplies()`.

**Action:** After Step 0.1, the cache-first `listPrinters()` already includes merged supply data. Simplify `getPrinters()` to just return `listPrinters()` without the per-printer supply loop (supply data will be baked into the cached `PrinterInfo`).

---

### Step 0.4 — Strip live polling from `getMetrics()`

**File:** [events.controller.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/events.controller.ts) (L58)

**Current:** `getMetrics()` calls `listPrinters()` to count active/total printers.

**Action:** Inherits the fix from Step 0.1 automatically.

---

### Step 0.5 — Fix the lock-free `moveToDelayed` in worker

**File:** [printMaster.worker.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts) (L17)

**Current:**
```typescript
await job.moveToDelayed(Date.now() + 15000, job.token!);
return; // ← This does NOT release the BullMQ lock properly
```

**Action:** Replace with the correct BullMQ pattern:
```typescript
import { DelayedError } from "bullmq";
// ...
await job.moveToDelayed(Date.now() + 15000, job.token!);
throw new DelayedError(); // Correctly releases the lock
```

---

## Phase 1: The Heartbeat & State Reconciler

> **Goal:** Create a unified background loop that is the **only** component permitted to touch hardware. It populates Redis with the authoritative state for all printers.

### Step 1.1 — Create `runComprehensiveHealthCheck(printerName)`

**File:** [printer.service.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/printer.service.ts) — add new exported function

**Execution order (strict):**

1. **Guard — Skip quarantined printers:**
   ```
   const strikes = await redis.get(`printer:${name}:strikes`);
   if (parseInt(strikes || "0") >= 3) → log and return early
   ```

2. **Digital Probe — Run `adapter.healthCheck()`:**
   - Resolve adapter via `PrinterFactory.getAdapter(name)`.
   - If `healthCheck()` fails → `SET printer:<name>:health "flagged"` → return early.

3. **CUPS Status Check — Run `lpstat -p <name>` (via `cupsCommands`):**
   - Parse the output for this specific printer.
   - If output contains `"stopped"` or `"rejecting"` → `SET printer:<name>:health "flagged"` → return early.
   - If output contains `"idle"` AND Redis `printer:<name>:state` is currently `"busy"` → `SET printer:<name>:state "idle"` (reconcile orphaned lock).
   - If output contains `"printing"` → `SET printer:<name>:state "busy"`.

4. **Supply Check — Run `adapter.getSupplies()`:**
   - Cache result to `supplies:<name>` with 300s TTL (5 minutes, matching heartbeat frequency).

5. **Finalize:**
   - `SET printer:<name>:health "healthy"`.
   - Update `printer:<name>:info` hash with latest metadata (capabilities from `capabilities.json`, alias, type, description).

---

### Step 1.2 — Create `startHeartbeatLoop()`

**File:** [printer.service.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/printer.service.ts) — add new exported function

**Behavior:**
1. On first call, execute a full sweep immediately (replaces the existing `digitalStartupHealthSweep()`).
2. Start a `setInterval` at 300,000ms (5 minutes).
3. Each tick:
   - Discover all CUPS queues via `listPrintersFromCUPS()` (the renamed original function).
   - Update the Redis Set `fleet:printers` with the discovered names.
   - For each printer name, call `runComprehensiveHealthCheck(name)`.
4. After the full sweep, emit `printer_state_changed` SSE for any printer whose health or state has changed since the last sweep.

---

### Step 1.3 — Wire heartbeat into server startup

**File:** [server.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/server.ts)

**Action:**
1. Remove the import and call of `digitalStartupHealthSweep()`.
2. Import and call `startHeartbeatLoop()` in its place.
3. The heartbeat's first tick replaces the old startup sweep.

---

### Step 1.4 — Add CUPS single-printer status command

**File:** [cups.commands.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/commands/cups.commands.ts)

**Action:** Add a new command method:
```typescript
getPrinterStatusByName: async (printerName: string) => {
  const safeName = sanitize(printerName);
  return execCommand(`lpstat -p ${safeName}`);
},
```
This is used by `runComprehensiveHealthCheck()` in Step 1.1 to check a single printer's CUPS status without querying the entire fleet.

---

## Phase 2: Optimistic State Locking & Cache-First Matchmaking

> **Goal:** The matchmaker reads exclusively from Redis. The worker explicitly locks/unlocks printer state around dispatch.

### Step 2.1 — Rewrite `matchmaker.service.ts`

**File:** [matchmaker.service.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/matchmaker.service.ts) (full rewrite, 46 lines)

**Current:** Calls `printerService.listPrinters()` → live `lpstat`.

**New logic:**
1. Read all printer names from the Redis Set `fleet:printers`.
2. For each printer, pipeline-fetch: `printer:<name>:health`, `printer:<name>:state`, `printer:<name>:info`.
3. Filter candidates:
   - `health === "healthy"` ✓
   - `state === "idle"` ✓
   - Not in `jobData.attemptedPrinters` ✓
   - Capabilities match job requirements (`color`, `duplex`) ✓
4. If `jobData.targetPrinter` is specified and is in the filtered candidates, return it.
5. Otherwise return the first valid candidate, or `null`.

---

### Step 2.2 — Add Optimistic Lock in Worker (Pre-Dispatch)

**File:** [printMaster.worker.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts)

**Action:** Immediately after the matchmaker returns a printer name (L13), and before calling `printerService.printFile()` (L22):
```typescript
await redisConnection.set(`printer:${matchedPrinter}:state`, "busy");
eventBus.emit("printer_state_changed", { printer: matchedPrinter, state: "busy" });
```

---

### Step 2.3 — Release Optimistic Lock in Worker (Post-Dispatch)

**File:** [printMaster.worker.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts)

**Action:** In the `completed` event listener (L104–L116):
```typescript
printMasterWorker.on("completed", async (job) => {
  // Extract which printer was used from the job's return value
  const printer = job.returnvalue?.printer;
  if (printer) {
    await redisConnection.set(`printer:${printer}:state`, "idle");
    eventBus.emit("printer_state_changed", { printer, state: "idle" });
  }
  // ... existing cleanup and wakeUpDelayedJobs() ...
});
```

In the `failed` event listener (L118–L132):
```typescript
printMasterWorker.on("failed", async (job, err) => {
  // Release lock for the printer that was being used
  const printer = job?.data?.targetPrinter; // or from return value if available
  if (printer) {
    await redisConnection.set(`printer:${printer}:state`, "idle");
    eventBus.emit("printer_state_changed", { printer, state: "idle" });
  }
  // ... existing cleanup and wakeUpDelayedJobs() ...
});
```

---

## Phase 3: The 3-Strike Failover & Quarantine Matrix

> **Goal:** Build progressive failure tracking with automatic quarantine, bad-document isolation, and an absolute circuit breaker.

### Step 3.1 — Increment Strike Counter on Failure

**File:** [printMaster.worker.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts) — inside the worker's failure/failover logic block (L44–L63)

**Action:** After a job fails on a printer and before the failover retry:
```typescript
const strikeKey = `printer:${matchedPrinter}:strikes`;
const newStrikes = await redisConnection.incr(strikeKey);
console.log(`[Worker] Printer ${matchedPrinter} strike count: ${newStrikes}`);
```

---

### Step 3.2 — Reset Strike Counter on Success

**File:** [printMaster.worker.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts) — in the `completed` event listener

**Action:** When a job completes successfully:
```typescript
const printer = job.returnvalue?.printer;
if (printer) {
  await redisConnection.set(`printer:${printer}:strikes`, "0");
}
```

---

### Step 3.3 — Quarantine at 3 Strikes

**File:** [printMaster.worker.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts) — immediately after the `incr` in Step 3.1

**Action:**
```typescript
if (newStrikes >= 3) {
  await redisConnection.set(`printer:${matchedPrinter}:health`, "flagged");
  eventBus.emit("printer_quarantined", {
    printer: matchedPrinter,
    message: `Printer ${matchedPrinter} quarantined after ${newStrikes} consecutive failures.`
  });
  console.warn(`[Worker] QUARANTINE: ${matchedPrinter} flagged after ${newStrikes} strikes.`);
}
```

---

### Step 3.4 — Bad Document Isolation

**File:** [printMaster.worker.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts)

**Action:** In the existing failover logic (around L57), when `attempts.length >= 2` (the job has failed on 2 different printers):
```typescript
if (attempts.length >= 2) {
  eventBus.emit("job_failed", {
    id: job.id,
    reason: `Bad document detected: Job failed on ${attempts.length} different printers. Discarding.`,
    isBadDocument: true
  });
  throw new Error(`Job ${job.id} flagged as bad document — failed on ${attempts.join(", ")}.`);
}
```

---

### Step 3.5 — Absolute Circuit Breaker (Global Queue Pause)

**File:** [printMaster.worker.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts) — immediately after the quarantine check in Step 3.3

**Action:** After quarantining a printer, check if ANY healthy printers remain:
```typescript
if (newStrikes >= 3) {
  // ... quarantine logic from Step 3.3 ...

  // Circuit Breaker: Are there ANY healthy printers left?
  const allPrinterNames = await redisConnection.smembers("fleet:printers");
  let hasHealthyPrinter = false;
  for (const name of allPrinterNames) {
    const health = await redisConnection.get(`printer:${name}:health`);
    if (health === "healthy") {
      hasHealthyPrinter = true;
      break;
    }
  }

  if (!hasHealthyPrinter) {
    await printMasterQueue.pause();
    eventBus.emit("queue_paused", {
      message: "EMERGENCY: All printers quarantined. Queue paused. Admin intervention required."
    });
  }
}
```

---

### Step 3.6 — Safe Sleep with DelayedError

**File:** [printMaster.worker.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts) — the "no printer found" block (L15–L18)

**Action:** Replace the existing block:
```typescript
// Before (broken):
await job.moveToDelayed(Date.now() + 15000, job.token!);
return;

// After (correct):
import { DelayedError } from "bullmq";
await job.moveToDelayed(Date.now() + 15000, job.token!);
throw new DelayedError(); // Drops the BullMQ lock safely
```

---

### Step 3.7 — Wire Force Refresh to clear strikes

**File:** [printer.controller.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/printer.controller.ts) (L113–L145)

**Action:** In `forceRefreshPrinter()`, after a successful health check:
1. Reset strikes: `await redisConnection.set(\`printer:${name}:strikes\`, "0");`
2. Set state to idle: `await redisConnection.set(\`printer:${name}:state\`, "idle");`
3. Check if the queue is paused and at least one printer is now healthy → auto-resume:
   ```typescript
   const isPaused = await printMasterQueue.isPaused();
   if (isPaused && isHealthy) {
     await printMasterQueue.resume();
     eventBus.emit("queue_resumed", { message: `Queue resumed. Printer ${name} is back online.` });
   }
   ```

---

## Phase 4: Full-Stack SSE Matrix

> **Goal:** Ensure all new events are emitted on the backend and correctly handled on the frontend.

### Step 4.1 — Register new events in SSE subscription list

**File:** [events.controller.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/events.controller.ts) (L28)

**Current:**
```typescript
const eventsToListen = ["job_queued", "job_active", "job_completed", "job_failed", "printer_discovery"];
```

**New:**
```typescript
const eventsToListen = [
  "job_queued", "job_active", "job_completed", "job_failed",
  "printer_discovery", "system_critical",
  "printer_state_changed", "printer_quarantined",
  "queue_paused", "queue_resumed"
];
```

---

### Step 4.2 — Update frontend `SSEEvent` type union

**File:** [admin-ui/src/types/index.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/types/index.ts) (L69–L76)

**Action:** Add new event types:
```typescript
export type SSEEvent =
  | { type: 'connected'; timestamp: string }
  | { type: 'job_queued'; id: string; filename: string; owner: string; sessionId?: string; [key: string]: any }
  | { type: 'job_active'; id: string; data: { id: string; filename: string; sessionId?: string; [key: string]: any } }
  | { type: 'job_completed'; id: string; data: { id: string; filename: string; sessionId?: string; [key: string]: any } }
  | { type: 'job_failed'; id: string; reason: string; isBadDocument?: boolean }
  | { type: 'printer_discovery'; timestamp: string }
  | { type: 'system_critical'; message: string }
  // New events:
  | { type: 'printer_state_changed'; printer: string; state: 'idle' | 'busy' | 'flagged' }
  | { type: 'printer_quarantined'; printer: string; message: string }
  | { type: 'queue_paused'; message: string }
  | { type: 'queue_resumed'; message: string };
```

---

### Step 4.3 — Handle new events in Admin Store

**File:** [admin-ui/src/stores/useAdminStore.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/stores/useAdminStore.ts) (L328–L344)

**Action:** Extend the `handleSSEEvent` switch:
```typescript
handleSSEEvent: (event) => {
  const state = get();
  switch (event.type) {
    case 'job_queued':
    case 'job_active':
    case 'job_completed':
    case 'job_failed':
      state.loadQueue();
      break;
    case 'printer_discovery':
    case 'printer_state_changed':
    case 'printer_quarantined':
      state.loadPrinters();
      break;
    case 'queue_paused':
      set({ isQueuePaused: true });
      break;
    case 'queue_resumed':
      set({ isQueuePaused: false });
      break;
    case 'system_critical':
      state.checkQueueStatus();
      state.loadMetrics();
      break;
  }
},
```

---

### Step 4.4 — Handle new events in User Kiosk Store

**File:** [admin-ui/src/stores/useUserPrintStore.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/stores/useUserPrintStore.ts) (L189–L213)

**Action:** Add handling for `queue_paused` and `queue_resumed` in `handleSSEEvent`:
```typescript
if (event.type === 'queue_paused') {
  set({ isAcceptingJobs: false });
} else if (event.type === 'queue_resumed') {
  get().fetchKioskStatus(); // Re-check availability
}
```

---

### Step 4.5 — Handle new events in SSE Service (global toasts)

**File:** [admin-ui/src/services/sseService.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/services/sseService.ts) (L38–L49)

**Action:** Add toast notifications for new events:
```typescript
if (parsed.type === 'printer_quarantined') {
  toast.error('Printer Quarantined', parsed.message);
} else if (parsed.type === 'queue_paused') {
  toast.error('Queue Paused', parsed.message);
} else if (parsed.type === 'queue_resumed') {
  toast.success('Queue Resumed', parsed.message);
}
```

---

## Execution Order Summary

| Order | Phase | Step | File(s) Modified | Description |
|---|---|---|---|---|
| 1 | 0 | 0.5 | `printMaster.worker.ts` | Fix `moveToDelayed` → add `throw new DelayedError()` |
| 2 | 1 | 1.4 | `cups.commands.ts` | Add `getPrinterStatusByName()` command |
| 3 | 1 | 1.1 | `printer.service.ts` | Create `runComprehensiveHealthCheck()` |
| 4 | 1 | 1.2 | `printer.service.ts` | Create `startHeartbeatLoop()` |
| 5 | 0 | 0.1 | `printer.service.ts` | Rename `listPrinters()` → `listPrintersFromCUPS()`, create cache-first `listPrinters()` |
| 6 | 0 | 0.3 | `printer.controller.ts` | Simplify `getPrinters()` to use cache-first data |
| 7 | 1 | 1.3 | `server.ts` | Replace `digitalStartupHealthSweep()` with `startHeartbeatLoop()` |
| 8 | 2 | 2.1 | `matchmaker.service.ts` | Full rewrite to Redis-only matching |
| 9 | 2 | 2.2 | `printMaster.worker.ts` | Add pre-dispatch `SET state "busy"` |
| 10 | 2 | 2.3 | `printMaster.worker.ts` | Add post-dispatch `SET state "idle"` in event listeners |
| 11 | 3 | 3.1 | `printMaster.worker.ts` | Increment strike counter on failure |
| 12 | 3 | 3.2 | `printMaster.worker.ts` | Reset strike counter on success |
| 13 | 3 | 3.3 | `printMaster.worker.ts` | Quarantine printer at 3 strikes |
| 14 | 3 | 3.4 | `printMaster.worker.ts` | Bad document isolation logic |
| 15 | 3 | 3.5 | `printMaster.worker.ts` | Absolute circuit breaker (global queue pause) |
| 16 | 3 | 3.6 | `printMaster.worker.ts` | Safe sleep with `DelayedError` (if not done in Step 1) |
| 17 | 3 | 3.7 | `printer.controller.ts` | Force refresh clears strikes + auto-resume |
| 18 | 4 | 4.1 | `events.controller.ts` | Register new SSE event names |
| 19 | 4 | 4.2 | `admin-ui/src/types/index.ts` | Add new SSEEvent type variants |
| 20 | 4 | 4.3 | `admin-ui/src/stores/useAdminStore.ts` | Handle new events in admin store |
| 21 | 4 | 4.4 | `admin-ui/src/stores/useUserPrintStore.ts` | Handle `queue_paused`/`queue_resumed` in kiosk store |
| 22 | 4 | 4.5 | `admin-ui/src/services/sseService.ts` | Add global toast notifications for new events |

---

## Verification Checklist

After implementation, validate with these checks:

### Backend
- [ ] Server starts and heartbeat runs immediately — all printers appear in Redis.
- [ ] Heartbeat runs again after 5 minutes — Redis keys are refreshed.
- [ ] `GET /printers` returns data without triggering `lpstat` (check server logs for absence of `[listPrinters] raw lpstat output`).
- [ ] `GET /fleet/kiosk-status` returns data from Redis cache.
- [ ] `GET /metrics` returns printer counts from Redis cache.
- [ ] Matchmaker selects only printers with `health: "healthy"` AND `state: "idle"`.
- [ ] Worker sets `state: "busy"` before dispatch and `state: "idle"` after completion/failure.
- [ ] Strike counter increments on failure and resets on success.
- [ ] Printer is quarantined (health set to `"flagged"`) at 3 strikes.
- [ ] Global queue pauses when all printers are quarantined.
- [ ] Force Refresh clears strikes, resets health, and auto-resumes queue if applicable.
- [ ] `DelayedError` is thrown correctly when no printer is available.

### Frontend
- [ ] All new SSE events (`printer_state_changed`, `printer_quarantined`, `queue_paused`, `queue_resumed`, `system_critical`) are received by the frontend.
- [ ] Kiosk UI locks (shows "System Offline") when `queue_paused` is received.
- [ ] Kiosk UI unlocks when `queue_resumed` is received.
- [ ] Admin dashboard refreshes printer list on `printer_state_changed`.
- [ ] Toast notifications fire for quarantine, queue pause, queue resume, and system critical events.

---

## Files Modified Summary

| File | Changes |
|---|---|
| `server/src/app/services/printer.service.ts` | Rename `listPrinters` → `listPrintersFromCUPS`, new cache-first `listPrinters()`, new `runComprehensiveHealthCheck()`, new `startHeartbeatLoop()`, remove `digitalStartupHealthSweep()` |
| `server/src/app/services/matchmaker.service.ts` | Full rewrite — Redis-only matching |
| `server/src/infrastructure/printMaster.worker.ts` | Optimistic locking, strike system, quarantine, circuit breaker, `DelayedError` fix |
| `server/src/app/controllers/printer.controller.ts` | Simplify `getPrinters()`, add strike/state clearing to `forceRefreshPrinter()` |
| `server/src/app/controllers/events.controller.ts` | Register new SSE events in subscription array |
| `server/src/commands/cups.commands.ts` | Add `getPrinterStatusByName()` |
| `server/src/server.ts` | Replace startup sweep with heartbeat loop |
| `admin-ui/src/types/index.ts` | Add new SSEEvent variants |
| `admin-ui/src/stores/useAdminStore.ts` | Handle new SSE events |
| `admin-ui/src/stores/useUserPrintStore.ts` | Handle queue pause/resume events |
| `admin-ui/src/services/sseService.ts` | Add toast notifications for new events |
