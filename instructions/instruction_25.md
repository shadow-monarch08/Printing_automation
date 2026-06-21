# System Role & Task
You are an Expert Backend Engineer. Your objective is to implement a high-performance caching architecture to reduce SQLite I/O load. This consists of two phases: 
1. A **Startup Hydration Sequence** that loads single-row database configs into local Node.js memory and triggers a Redis hardware sweep before the server accepts requests.
2. A **Cache-Aside (Hit/Miss) Pattern** for the session validation middleware using Redis.

# Strict Development Constraints & Anti-Hallucination Rules
1. **No Code Duplication:** Do NOT write raw Redis queries to hydrate the printer fleet. You must import and invoke the existing `runHeartbeatSweep` function.
2. **Synchronous SQLite:** Use `better-sqlite3` synchronous methods (`.get()`) for the configuration hydration.
3. **File Boundaries:** Only modify or create the exact files listed below. Do not touch UI or React code.

---

# Phase 1: The Startup Hydration Sequence

### Task 1.1: Create the Boot Sequence
**Target File (Create/Modify):** `server/src/infrastructure/boot.ts`
1. Define and export two mutable variables: `globalPricingConfig` and `globalSystemConfig` (initialized to `null`).
2. Export an async function named `hydrateSystem()`.
3. Inside `hydrateSystem()`:
   - Query SQLite: `SELECT * FROM system_config WHERE id = 1` and assign to `globalSystemConfig`.
   - Query SQLite: `SELECT * FROM pricing_config WHERE id = 1` and assign to `globalPricingConfig`.
   - Import the existing `runHeartbeatSweep` function from your heartbeat service and `await` its execution. This hydrates the Redis printer fleet to prevent cold starts.

### Task 1.2: Bind the Boot Sequence to Server Startup
**Target File:** `server/src/server.ts` (or your main entry point)
1. Import `hydrateSystem` from `./infrastructure/boot.ts`.
2. Locate the block where the Express app starts listening (`app.listen(...)`) and BullMQ workers are initialized.
3. You MUST `await hydrateSystem()` *before* the server starts listening for HTTP traffic and before workers start pulling jobs.

---

# Phase 2: The Cache-Aside Session Middleware

### Task 2.1: Implement Redis Session Caching
**Target File:** `server/src/app/middlewares/auth.middleware.ts`
1. Import the Redis client and the SQLite `db` singleton.
2. Define a constant `SESSION_TTL = 43200` (12 hours in seconds).
3. Update the `requireValidSession` middleware to implement this exact Hit/Miss logic:
   - Extract `req.headers['x-session-id']`. If missing, return `401 SESSION_MISSING`.
   - Define the Redis key as `session:${sessionId}`.
   - **The Hit:** Await a `redis.get(key)`. If it exists, update the TTL using `redis.expire(key, SESSION_TTL)`, attach the session ID to `req.session`, and call `next()`.
   - **The Miss:** If Redis returns null, execute a synchronous SQLite query: `SELECT session_id FROM kiosk_sessions WHERE session_id = ?`.
   - If SQLite returns nothing, return `401 SESSION_INVALID`.
   - **The Hydration:** If SQLite validates the session, execute `await redis.setex(key, SESSION_TTL, JSON.stringify({ active: true }))`. Attach the session to `req.session` and call `next()`.
   - Wrap the logic in a `try/catch`. On error, log it and return `500`.

**Execution:** Please provide the updated code for these specific files implementing the logic exactly as described.