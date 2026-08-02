# Comprehensive Outstanding Real-Time & Backend Issues Report

This report summarizes all currently outstanding and unresolved technical issues identified across the Printing Automation codebase following the SSE to WebSocket migration and recent architectural audits.

---

## 1. Unhealthy Printer Jobs Prematurely Marked as `done`

### Symptom:
When a printer is offline, unpowered, or unavailable, jobs assigned to it are automatically marked as `done` / `completed` on both Customer and Admin interfaces instead of remaining in `spooling` / `queued` mode or retrying across alternative fleet printers.

### Technical Root Cause:
1. **CUPS Status Fallback ([`printer.service.ts:243-246`](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/printer.service.ts#L243-L246))**:
   When `lpstat -o <printerName>` returns no queue lines (which occurs when a printer is unreachable or unconfigured in CUPS), `getJobStatus` defaults to returning `"completed_or_missing"`.
2. **Worker Resolution Loophole ([`printMaster.worker.ts:45-47`](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/infrastructure/printMaster.worker.ts#L45-L47))**:
   `printMasterWorker` evaluates `"completed_or_missing"` as successful completion:
   ```typescript
   if (status === "completed_or_missing") {
     return { cupsJobId, status: "completed", printer: matchedPrinter };
   }
   ```
3. This triggers `printMasterWorker.on("completed")`, emitting a `job_completed` event over WebSocket and marking the job completed prematurely.

---

## 2. Job Failure Notifications Not Displaying

### Symptom:
When a print job fails due to hardware faults, unprocessable files, or printer timeouts, no error toast or notification banner appears on the Customer or Admin UIs.

### Technical Root Cause:
1. **Single-Job ID Filter Constraint ([`websocketService.ts:50-54`](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/services/websocketService.ts#L50-L54))**:
   `websocketService.ts` guards failure notifications with:
   ```typescript
   if (userState.jobId === normalizedPayload.id) {
     toast.error('Job Failed', ...);
   }
   ```
   `userState.jobId` only stores the ID of the single most recent submission. If the user submits multiple jobs or navigates steps, `userState.jobId` does not match, suppressing the toast notification.
2. **Missing Admin Toast Triggers**:
   The Admin UI does not trigger global toast notifications upon receiving `job_failed` events.

---

## 3. Admin Queue Filter Leakage (`X-Session-ID` Header Interference)

### Symptom:
Jobs submitted from mobile devices or external kiosk browsers do not appear on the Admin Queue table (`GET /jobs`), even after a full browser refresh on the admin panel.

### Technical Root Cause:
1. **Header Injection ([`apiClient.ts:16-19`](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/services/apiClient.ts#L16-L19))**:
   `apiClient.ts` injects the local browser's session ID into every outgoing API request header (`X-Session-ID`).
2. **Controller Session Assignment ([`jobs.controller.ts:6`](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/jobs.controller.ts#L6))**:
   The server session middleware sets `req.session.id` from `X-Session-ID`. `jobsController.getJobs` reads:
   ```typescript
   const sessionId = (req as any).session?.id || req.query.sessionId as string;
   const jobs = await jobService.getAllJobs(sessionId);
   ```
3. **Queue Filtering ([`job.service.ts:42-44`](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/job.service.ts#L42-L44))**:
   Because `sessionId` is populated, `getAllJobs` filters the global queue down to ONLY jobs matching the admin browser's local session, effectively filtering out all mobile and external kiosk print jobs from the Admin Panel view.

---

## 4. In-Memory `EventEmitter` vs. Distributed Redis Pub/Sub

### Symptom:
Potential event delivery drops or state desynchronization when running worker processes separately from the Express web server.

### Technical Root Cause:
- `eventBus` is currently implemented as an in-process Node.js `EventEmitter` ([`eventBus.ts`](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/utils/eventBus.ts)).
- If the BullMQ worker (`printMaster.worker.ts`) and the Express WebSocket server (`events.controller.ts`) run in separate processes or instances, `eventBus.emit()` calls from the worker cannot reach WebSocket clients.

---

## 5. Missing `job_spooling` / `job_delayed` Real-Time WebSocket Events

### Symptom:
When no healthy printer is immediately available and a job is delayed by 15 seconds in BullMQ, the UI remains on `queued` without displaying a `spooling` or `retrying` status update.

### Technical Root Cause:
- When `matchmakerService.findPrinter()` returns `null`, `printMasterWorker` executes:
  ```typescript
  await job.moveToDelayed(Date.now() + 15000, job.token!);
  ```
- No WebSocket event is emitted when a job enters delayed/spooling mode.
