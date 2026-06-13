User Intent: Migrate the real-time event communication layer from Server-Sent Events (SSE) to native WebSockets (`ws`) to bypass proxy buffering restrictions (e.g., Cloudflare Tunnels), while preserving the existing internal application architecture.

### 1. Existing Architecture Context
The application currently passes lightweight system metrics, queue notifications, and hardware status updates uniaxially through these layers:
1. System/Workers emit events via a singleton Node.js native `EventEmitter` wrapper (`eventBus.ts`).
2. An Express route (`GET /events`) listens to the `eventBus` and streams text chunks (`text/event-stream`) to the client.
3. The frontend utilizes a vanilla TypeScript singleton service (`sseService.ts`) outside the React lifecycle to listen, auto-reconnect, and map the payloads to dual-phase Zustand stores (`useUserPrintStore` and `useAdminStore`) via a `.handleSSEEvent(normalizedPayload)` method.

### 2. Core Constraints (What MUST be preserved)
- Do NOT rewrite or modify the Zustand stores (`useUserPrintStore.ts`, `useAdminStore.ts`) or their internal `.handleSSEEvent()` payload handler logic.
- Do NOT alter the native `EventEmitter` core implementation (`eventBus.ts`).
- Preserve the exact schema and naming conventions of the current Event Dictionary (e.g., `connected`, `job_queued`, `job_active`, `job_completed`, `job_failed`, `printer_state_changed`, `printer_quarantined`, `queue_paused`, `queue_resumed`, `printer_discovery`, `system_critical`).
- Ensure the frontend connection engine remains a decoupled vanilla TypeScript singleton instance to isolate connectivity state from React route transitions and avoid unmount/remount churn.

### 3. Step-by-Step Migration Requirements

#### Task A: Backend WebSockets Server Integration
1. Install the lightweight `ws` package and its TypeScript types (`@types/ws`) if missing.
2. Refactor the backend server initialization file (e.g., `server.ts` or `app.ts`) to wrap the Express app in a standard Node `http.createServer(app)`.
3. Create or refactor `events.controller.ts` to expose an `initWebSocketServer(server)` function. 
4. Implement safe protocol upgrade interception on the HTTP server for path `/events` using `server.on('upgrade', ...)`.
5. Inside the WebSocket connection pool loop:
   - On connection, immediately fire an emission matching the structural legacy `{ event: 'connected', data: { timestamp: ISOString } }` payload.
   - Bind clean subscriber callbacks to the native `eventBus` for every event in the dictionary.
   - Ensure that whenever `eventBus` fires, the handler wraps the payload into a clean stringified JSON frame (`ws.send(JSON.stringify({ event: eventName, data }))`) and transmits it only if `ws.readyState === WebSocket.OPEN`.
   - **Crucial:** Implement strict lifecycle cleanup inside `ws.on('close', ...)` to remove all matching listeners from the `eventBus` instance using `.removeListener()` or `.off()` to prevent catastrophic memory leaks.

#### Task B: Frontend Service Transition
1. Rename or refactor `sseService.ts` to `websocketService.ts` (or update it directly).
2. Swap the native browser `new EventSource()` constructor out for a native `new WebSocket()` constructor.
3. Dynamically derive the target URL connection string based on the current context (`window.location.protocol === 'https:' ? 'wss:' : 'ws:'` combined with `${window.location.host}/events`).
4. In the `.onmessage` receiver callback:
   - Safely extract and parse the data frame frame (`const { event, data } = JSON.parse(messageEvent.data)`).
   - Normalize the payload shape to perfectly match what the legacy stores expect by merging the schema fields: `const normalizedPayload = { type: event, ...data };`
   - Direct-dispatch the normalized data down into `useUserPrintStore.getState().handleSSEEvent(normalizedPayload)` and `useAdminStore.getState().handleSSEEvent(normalizedPayload)`.
5. Maintain the legacy auto-reconnect logic on connection breakage (`onclose` / `onerror`) using a safe `setTimeout` loop.

Review the existing code files carefully, locate the connection entry points, and execute the migration accurately while leaving structural interfaces intact.