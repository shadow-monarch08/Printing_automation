# TASK: SSE ARCHITECTURE REFACTOR — DELTA MERGING & EVENT-CARRIED STATE TRANSFER

## Context & Prime Directive
You are an expert React and State Management (Zustand) architect. We are refactoring how our frontend consumes Server-Sent Events (SSE) from the Print Spooler backend. 
Currently, the Admin UI uses SSE merely as a "ping" to trigger full HTTP GET requests (e.g., calling `loadPrinters()` or `loadQueue()`). This causes severe visual flickering (loading spinners replacing content) and creates a "Thundering Herd" bottleneck where multiple clients spam the Raspberry Pi backend with identical API requests simultaneously.

**The Prime Directive:** You must transition the stores (`useAdminStore.ts` and `useUserPrintStore.ts`) to an **Event-Carried State Transfer** model. You will update the Zustand stores to silently merge the SSE JSON payloads directly into the local state arrays (Delta Merging) without making HTTP network calls, eliminating UI flickers and saving backend bandwidth.

---

## 🚫 STRICT ENGINEERING CONSTRAINTS (CRITICAL)

1. **The Payload Inconsistency Trap:** You MUST normalize Print Job payloads before merging.
   - `job_queued` sends the job data flat at the root of the event (e.g., `event.filename`).
   - `job_active` and `job_completed` nest the job data inside a `data` property (e.g., `event.data.filename`).
   - *Requirement:* You must extract the correct payload object based on the event type before applying it to the state.
2. **Immutability:** When updating arrays (like `queue` or `printers`), you must return a new array map/filter. Do not mutate the existing array directly.
3. **No HTTP Calls in Delta Events:** For the specific events listed in the "Silent Merge" category below, you are strictly forbidden from calling `loadQueue()`, `loadPrinters()`, or `fetchJobs()`.

---

## Phase 1: Implement Silent Delta Merging (No HTTP)

Update the `handleSSEEvent` functions in the Zustand stores to perform in-place array updates for the following events:

### Print Job Events (Update the `queue` or `jobs` arrays)
* **`job_queued`:** Unshift (add to the top) the new job payload into the queue array.
* **`job_active` / `job_completed`:** Find the job by `id` in the state array. Merge the nested `event.data` object into the existing job object to update its status.
* **`job_failed`:** Find the job by `id`. Merge the provided `reason` and `isBadDocument` flags into the object, and set its local status to "failed".

### Printer Hardware Events (Update the `printers` array)
* **`printer_state_changed`:** Find the printer by matching `event.printer` to `printer.name`. Merge the new `state` string (e.g., 'busy', 'idle').
* **`printer_quarantined`:** Find the printer by matching `event.printer` to `printer.name`. Update its state to 'quarantined' and store the error message.

### System Flags (Update boolean states)
* **`queue_paused`:** Set `isQueuePaused: true` (Admin) or `isAcceptingJobs: false` (User).
* **`queue_resumed`:** Set `isQueuePaused: false` (Admin).

---

## Phase 2: Retain Full HTTP Reloads for Structural Events

You MUST continue to use the heavy HTTP fetch functions (`loadPrinters`, `loadQueue`, `loadMetrics`) for the following scenarios, as the SSE payload does not contain enough data to update the UI safely:

1. **`printer_discovery`:** A new hardware sweep was completed. You must call `loadPrinters()` to fetch the new fleet topology.
2. **`system_critical`:** The backend hardware is failing (e.g., full SD card). You must immediately call `loadMetrics()` and `loadQueue()` to sync the exact failure state.
3. **Reconnection Logic:** If the SSE connection drops and reconnects, you must execute a full HTTP fetch of all data to catch up on any events missed during the network drop.

---

## Deliverables
Please provide the updated code for the Zustand stores (specifically `useAdminStore.ts` and `useUserPrintStore.ts`). Ensure the `handleSSEEvent` switch statements clearly separate the Delta Merge logic from the HTTP Reload logic, and explicitly handle the flat vs. nested job payload inconsistency.