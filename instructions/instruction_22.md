# System Role & Task
You are an Expert Full-Stack TypeScript Developer. Your objective is to migrate our current kiosk session management to a "Self-Healing Interceptor" architecture (similar to OAuth2 refresh token logic). 

We are decoupling session generation from our standard endpoints. The backend will strictly reject unauthorized traffic, and the frontend will intercept these rejections, silently provision a new session, and replay the paused requests.

# Strict Development Constraints & Anti-Hallucination Rules
1. **File Locations:** You must strictly create or modify files within the existing paths defined below. Do NOT create new directories or hallucinate new file structures.
2. **No UI Changes:** Do NOT modify any React components (`.tsx` files) or page layouts. This is strictly a network and middleware layer migration.
3. **No Code Redundancy:** Do NOT rewrite the existing `useUserPrintStore` Zustand logic. Assume the store already has `sessionId` state and a `setSessionId` action.

---

# Phase 1: Backend Migration (Node.js/Express)

**Target Directory:** `server/src/app/`

### Task 1.1: The Session Service & Controller
* **File 1 (Create):** `services/session.service.ts`
  * Create a service function that generates a native crypto UUID.
  * Execute an SQLite insertion into the `kiosk_sessions` table (Columns: `id`, `user_agent`).
  * Return the generated `sessionId`.
* **File 2 (Create):** `controllers/session.controller.ts`
  * Expose an endpoint handler (e.g., `POST /init`) that calls the session service and returns the ID in a JSON payload.
* **File 3 (Create/Modify):** `routes/session.routes.ts`
  * Wire the controller to the Express router.

### Task 1.2: The Strict Auth Middleware
* **File 4 (Modify):** `middlewares/auth.middleware.ts`
  * Implement `requireValidSession`.
  * Extract the `X-Session-ID` header.
  * **Crucial Logic:** It must NOT generate new sessions. 
  * If the header is missing, immediately return a `401` status code with `SESSION_MISSING`.
  * If the header exists, validate it against the SQLite `kiosk_sessions` table. If invalid/expired, return a `401` status code with `SESSION_INVALID`.
  * If valid, attach `{ id: sessionId }` to the `req.session` object and call `next()`.

---

# Phase 2: Frontend Migration (React/Axios)

**Target Directory:** `admin-ui/src/`

### Task 2.1: The Self-Healing Axios Interceptor
* **File 5 (Modify):** `services/api.ts` (where the Axios instance is defined).
  * **Request Interceptor:** Always pull the current `sessionId` from `useUserPrintStore.getState()` and inject it into the `X-Session-ID` header for every outgoing request.
  * **Response Interceptor:** Implement the `401` catch-and-replay logic.
  * **Concurrency Lock:** You MUST implement a state variable (e.g., `isFetchingSession: boolean`) and a queue array. If multiple requests fail with `401` simultaneously, pause them.
  * **The Replay Flow:**
    1. Catch `401`.
    2. Check if a session fetch is already in progress. If yes, add the request's Promise `resolve`/`reject` to the queue.
    3. If no fetch is in progress, lock the state (`isFetchingSession = true`).
    4. Make an Axios call to your new `POST /api/session/init` endpoint.
    5. Update the Zustand store with the new ID via `useUserPrintStore.getState().setSessionId(newId)`.
    6. Iterate through the paused queue, updating their headers with the new ID, and resolve them to replay the requests.
    7. Replay the original request that triggered the `401`.
    8. Release the lock (`isFetchingSession = false`) in a `finally` block.

**Execution:** Please provide the code implementations for these specific files following the conceptual logic outlined above.

**Extra Note** : For now just leave out the database operations and just create the files with the logic required for session management. Leave comments in their places so that we can work on that when we are creating the complete database persistence logic.