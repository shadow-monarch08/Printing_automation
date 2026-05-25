# Gap Analysis Report: Spooler Architecture & SSE Mapping

This audit report establishes the technical baseline of the current spooler and status polling implementation across the `server/src/` folder.

---

### 1. 📡 The SSE (Server-Sent Events) Matrix

The table below outlines all current events emitted by the backend via the centralized `eventBus`:

| Event Name | Source File & Line | Trigger Condition | Payload Data |
| :--- | :--- | :--- | :--- |
| `job_queued` | [print.controller.ts:L54](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/print.controller.ts#L54) | A user submits a document; it passes pricing quote calculation and is successfully queued. | Complete job payload: `id`, `filename`, `filePath`, `owner`, `sessionId`, `pages`, `copies`, `colorMode`, `duplex`, `orientation`, `targetPrinter`, `cost`, `attemptedPrinters`, `submittedAt`. |
| `job_active` | [printMaster.worker.ts:L101](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts#L101) | The BullMQ queue worker picks up the print job and starts processing it. | `{ id: job.id, data: job.data }` |
| `job_completed` | [printMaster.worker.ts:L106](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts#L106) | The printer adapter reports the job status as successfully completed. | `{ id: job.id, data: job.data }` |
| `job_failed` | [printMaster.worker.ts:L120](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts#L120) | Job fails to print, exceeding retry thresholds or encountering a fatal error. | `{ id: job.id, reason: err.message }` |
| `printer_discovery` | [printer.controller.ts:L185](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/printer.controller.ts#L185) & [L214](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/printer.controller.ts#L214) | A new hardware queue is registered, or capabilities/aliases are edited by an administrator. | `{ timestamp: string }` |
| `system_critical` | [metrics.service.ts:L54](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/metrics.service.ts#L54) | Disk space usage exceeds the 95% threshold safety limit. | `{ message: string }` |

#### **Gaps & Disconnected Mappings**
* **`system_critical` is Dead:** Although `system_critical` is emitted by the metrics service, it is **missing** from the subscription registry array inside [events.controller.ts:L28](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/events.controller.ts#L28). Frontend clients subscribing to SSE never receive this event.
* **Missing Events for Cache-First Architecture:** We need to implement new events to notify the admin UI and kiosk when:
  * `printer_state_changed` (e.g., transitions between `idle` / `busy` / `flagged`).
  * `queue_paused` / `queue_resumed`.
  * `printer_quarantined` (strike threshold breached).

---

### 2. 🟢 Existing & Aligned Infrastructure

* **Centralized Redis Connection**
  * Implemented cleanly in [redis.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/redis.ts) and shared across all background workers and queues.
* **Serial Worker Concurrency**
  * [printMaster.worker.ts:L76](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts#L76) runs with `concurrency: 1`, aligning with the core constraint to process one job at a time.
* **Hardware Adapter Structure**
  * Hardware-specific checking mechanisms are modularized into adapters under [server/src/adapters/](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/adapters).
* **Supply Caching Service**
  * [supplies.service.ts:L24-L41](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/supplies.service.ts#L24-L41) already checks the `supplies:<name>` Redis key and enforces a 60-second TTL.

---

### 3. 🟡 Disconnected / High-Risk Code (Needs Refactoring)

* **Direct Shell Execution Bypassing Redis**
  * **Matchmaker:** [matchmaker.service.ts:L5](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/matchmaker.service.ts#L5) runs `printerService.listPrinters()`, executing `lpstat -p` directly on the operating system for every matchmaking ticket.
  * **Kiosk Status:** [printer.controller.ts:L224](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/printer.controller.ts#L224) makes a live `listPrinters()` query to build `isAcceptingJobs` on page loads.
  * **Dashboard Fleet:** [printer.controller.ts:L9](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/printer.controller.ts#L9) executes `listPrinters()` on every GET query to `/printers`.
* **Lock-Free Delayed Retries**
  * [printMaster.worker.ts:L17](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts#L17) invokes `job.moveToDelayed()` without checking or locking state, bypassing optimistic locks.
* **Matchmaker Bypassing Cache Health State**
  * [matchmaker.service.ts:L8](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/matchmaker.service.ts#L8) filters only on the live `status === "idle"` and completely ignores the persistent `printer:<name>:health` flag in Redis.

---

### 4. 🔴 Missing Architectural Components

* **Heartbeat loop:** No recurring background scheduler (heartbeat loop) exists to poll printer adapter health periodically and populate the cache.
* **The 3-Strike Progressive Flagging System:** The Redis state `printer:<name>:strikes` key and progressive quarantine logic are not yet implemented.
* **Optimistic State Lock:** The Redis key `printer:<name>:state` with options `"busy"` / `"idle"` does not exist.
* **Global Queue Emergency Cascade:** No automatic cascade logic pauses the queue and issues user alerts when all printers are quarantined.

---

### 5. 🗑️ Dead Code to Discard

* **Real-time `lpstat` Command Executions**
  * The command executions within `listPrinters()` in [printer.service.ts:L53](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/printer.service.ts#L53) will become redundant once we read strictly from the Redis cache keys.
* **Ad-hoc Status Modifiers**
  * The inline modifier checking supply status to override printer status:
    `status: supplies.status === 'offline' ? 'offline' : p.status` in [printer.controller.ts:L14](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/printer.controller.ts#L14)
    will be replaced by a clean read of the unified Redis cache.
* **Worker In-line Status Loop**
  * The `while(true)` polling logic inside [printMaster.worker.ts:L33-L65](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts#L33-L65) that pings job completion status will be simplified when status checks are handled by the background process.
