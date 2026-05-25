
---

# MASTER ARCHITECTURE IMPLEMENTATION: BULLETPROOF PRINT SPOOLER

## 1. Context & Prime Directive
You are an expert full-stack engineer. You are building a highly resilient print spooler using Express, BullMQ, Redis, and a React frontend.

**The Prime Directive:** The physical hardware (USB/Network bus) is a severe bottleneck. User-facing routes and the job matchmaker are STRICTLY FORBIDDEN from executing live shell commands (`lpstat`, `lsusb`, `ipptool`). The entire system must operate on a **Redis Cache-First (Single Source of Truth)** architecture with **Optimistic State Locking** and **Background Reconciliation**.

## 2. Codebase Architecture Enforcement (Scan & Adapt)
Before writing or modifying a single line of code, you MUST scan the entire repository (both frontend and backend). 
* Identify the existing folder structures, architectural patterns, and file naming conventions.
* Find out where services, controllers, queues, workers, and React components currently reside.
* You must strictly adhere to the established architecture. Do not create new structural paradigms or nested folders that violate the current setup. Place all new logic exactly where the existing project expects it to be.

## 3. Code Eradication (Dead Code Cleanup)
Before writing new features, locate and remove the following dangerous patterns in the backend:
* **Remove live polling:** Find `listPrinters()` and `getKioskStatus()` (or their equivalents) and strip out `exec('lpstat')`. They must only read from Redis. Matchmaker logic must also be stripped of live polling.
* **Remove inline delays:** Find any `moveToDelayed` logic in the worker that lacks the `throw new DelayedError()` lock-release and remove it.

## 4. Phase 1: The Heartbeat & State Reconciler
Create a unified background loop that runs every 5 minutes (300,000ms) triggered on server startup.
Create `runComprehensiveHealthCheck(printerName: string)`. Execution order must be exact:
1. **Digital Probe:** Run the adapter's `healthCheck()`. If it fails -> set Redis `printer:<name>:health` to `"flagged"` and exit.
2. **CUPS Status Check:** Run `lpstat -p <name>`.
   - If "stopped/rejecting" -> set Redis `health` to `"flagged"` and exit.
   - If "idle" AND Redis `printer:<name>:state` is currently `"busy"` -> overwrite Redis state to `"idle"` (Reconciling an orphaned lock).
   - If "printing" -> overwrite Redis state to `"busy"`.
3. **Supplies:** Run the adapter's supply check and cache results.
4. **Finalize:** Set Redis `printer:<name>:health` to `"healthy"`.
*Note: The heartbeat MUST skip any printer where Redis `printer:<name>:strikes` >= 3 (Quarantined).*

## 5. Phase 2: Optimistic State Locking & Cache-First Matchmaking
1. **Matchmaker:** The function responsible for finding an idle printer must query Redis. A valid printer must have `health === "healthy"` AND `state === "idle"` AND match required capabilities.
2. **Worker Locks:** - Milliseconds before dispatching a job to a printer, explicitly `SET printer:<name>:state "busy"`.
   - On the `completed` or `failed` event listeners, explicitly `SET printer:<name>:state "idle"`.

## 6. Phase 3: The 3-Strike Failover & Quarantine Matrix
Inside the worker's failure handling logic:
1. **The Strike:** On job failure, increment `printer:<name>:strikes` in Redis.
2. **The Interleave & Self-Heal:** If a job succeeds on a printer, instantly reset its strike counter to `0`.
3. **The Quarantine:** If strikes hit 3, forcefully set `printer:<name>:health` to `"flagged"`. Emit `printer_quarantined` SSE.
4. **Bad Document Isolation:** If Job 1 fails on Printer A, fails over, and ALSO fails on Printer B (or fails 3 times on one printer while interleaved jobs succeed), permanently mark the job as `failed_bad_document`, discard it, and notify the user via SSE.
5. **Absolute Circuit Breaker:** If a printer hits 3 strikes and `Redis` shows ZERO other `healthy` printers, execute a queue pause (`worker.pause()`), emit `queue_paused` to all frontend clients, and safely park all pending jobs until an Admin manually calls the Force Refresh endpoint.
6. **Safe Sleep:** When no printers are idle, move the job:
   ```typescript
   await job.moveToDelayed(Date.now() + 15000, job.token!);
   throw new DelayedError(); // Drops the BullMQ lock safely
   ```

## 7. Phase 4: Full-Stack SSE Matrix

Ensure the backend event bus emits and the frontend UI (Kiosk/Dashboard) subscribes to and correctly handles the following SSE payloads:

* `job_queued`, `job_active`, `job_completed`, `job_failed` (must include failure reason for user toast notifications).
* `printer_state_changed` (`{ printer, state: "idle" | "busy" | "flagged" }`)
* `queue_paused` / `queue_resumed` (`{ message }`) - Frontend must visually lock new submissions.
* `printer_quarantined` (`{ printer, message }`)
* `system_critical` - Ensure this is correctly subscribed to on the frontend for disk-space alerts.