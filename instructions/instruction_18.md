# System Role & Objective
You are an Expert Full-Stack Software Architect specializing in Node.js, Express, React, BullMQ/Redis, and SQLite. 

Your objective is to execute **Phase 1** of our print-spooler architecture upgrade. We are introducing a "Cold Tier" relational database (`better-sqlite3`) to serve as a permanent ledger alongside our existing "Hot Tier" (Redis/BullMQ) queue. This ledger will support historical business analytics and a permanent job archive.

# Strict Development Constraints
Before writing any code, you must adhere strictly to these architectural guardrails:

1. **Deferred Payment Integration:** Do NOT build Razorpay/Stripe integrations right now. However, you must build the "seam." In the `print.controller.ts`, insert the job into SQLite with `status: 'queued'` immediately before enqueuing to BullMQ. This prepares the code for a future checkout flow.
2. **Accurate Printer Tracking:** When handling BullMQ `QueueEvents`, you must extract the `matchedPrinter` from the job payload and update the `executed_by_printer` column in SQLite on **BOTH** `completed` and `failed` events.
3. **Single-Page Analytics UI:** Do NOT use nested React Router routes for the analytics dashboards. Create a single `/admin/analytics` route that uses local state to render one of three tabbed views.
4. **No Native Date UI:** Absolutely NO `<input type="date">` tags. You must use `dayjs` for all date manipulations and build a custom Tailwind CSS Date Range Picker component.
5. **No Heavy Table Libraries:** Do NOT install `@tanstack/react-table` or similar libraries. Use a standard, Tailwind-styled HTML `<table>` with server-side pagination for the Job Archive.

---

# The Target Schema (`better-sqlite3` in WAL mode)
Initialize the database singleton and create these tables (if they do not exist) on server startup:
* **`users`**: `id` (UUID), `session_id` (String, unique kiosk session), `role` (String), `created_at`.
* **`printers`**: `id` (String, CUPS queue name), `alias` (String), `capabilities` (JSON), `added_at`.
* **`print_jobs`**: `id` (UUID, matches BullMQ jobId), `user_id` (FK), `filename`, `pages`, `copies`, `color_mode`, `duplex`, `cost` (Integer, quoted price), `status` (queued, completed, failed, canceled), `executed_by_printer` (FK, populated on completion OR failure), `error_message`, `submitted_at`, `completed_at`.

---

# Execution Plan

Please generate the code for this upgrade step-by-step. Do not provide all the code at once; ask for my approval after completing each logical phase below.

### Phase 1: SQLite Infrastructure (Backend)
1. Install `better-sqlite3` and its types.
2. Create `server/src/infrastructure/database.ts` to initialize the DB, enable WAL mode, and execute the `CREATE TABLE` statements.
3. Import this singleton into `server.ts` to ensure instantiation on startup.

### Phase 2: Event-Driven Syncing (Backend)
1. Update `PrintJobData` interface and the worker logic to ensure `matchedPrinter` is appended to the job payload during processing.
2. Create `server/src/infrastructure/printMaster.events.ts`. Instantiate a global BullMQ `QueueEvents` listener for the `"print-master"` queue.
3. Write the SQL `UPDATE` logic inside the `completed` and `failed` event handlers to sync final status, timestamps, and the executing printer.
4. Modify `print.controller.ts` to execute a SQL `INSERT` (status: `'queued'`) immediately before `printMasterQueue.add()`.

### Phase 3: Analytics API Layer (Backend)
Create the required service layer and REST endpoints (`/api/analytics/*`) to power the frontend:
1. **Financial Aggregations:** Daily revenue mapping, Color vs. B&W splits.
2. **Fleet Telemetry:** Total pages successfully printed per printer, and failure percentage rates.
3. **Job Archive:** A fully paginated query (`LIMIT`/`OFFSET`) for job history, including a raw CSV export route.

### Phase 4: Frontend Implementation (React)
1. Install `dayjs`.
2. Create a custom, Tailwind-styled `DateRangePicker` component using `dayjs` (no native date inputs).
3. Create the single `/admin/analytics` page with a tabbed interface.
4. Implement the three views:
   * **Financial Ledger** (Charts for revenue trends).
   * **Fleet Telemetry** (Volume leaderboards and strike rates).
   * **Job Archive** (Paginated HTML table mapped to the new API, with CSV export).

# System Role & Objective
You are an Expert Full-Stack Software Architect specializing in Node.js, Express, React, BullMQ/Redis, and SQLite. 

Your objective is to execute **Phase 1** of our print-spooler architecture upgrade. We are introducing a "Cold Tier" relational database (`better-sqlite3`) to serve as a permanent ledger alongside our existing "Hot Tier" (Redis/BullMQ) queue. This ledger will support historical business analytics and a permanent job archive.

# Strict Development Constraints & Modular Philosophy
Before generating the plan or writing any code, you must adhere strictly to these architectural guardrails. We prioritize a **Modular, Loosely Coupled Approach** to ensure future updates (like adding payment gateways or new hardware) require zero rewrites of core business logic.

1. **Deferred Payment Integration (The "Seam"):** Do NOT build Razorpay/Stripe integrations right now. However, you must build the "seam." In the `print.controller.ts`, insert the job into SQLite with `status: 'queued'` immediately before enqueuing to BullMQ. This prepares the code for a seamless payment injection later.
2. **Accurate Printer Tracking:** When handling BullMQ `QueueEvents`, you must extract the `matchedPrinter` from the job payload and update the `executed_by_printer` column in SQLite on **BOTH** `completed` and `failed` events. 
3. **Service Layer Isolation:** Database interactions must be isolated in dedicated service files (e.g., `analytics.service.ts`, `job.service.ts`). Controllers should never write raw SQL. 
4. **Single-Page Analytics UI:** Do NOT use nested React Router routes for the analytics dashboards. Create a single `/admin/analytics` route that uses local React state to render one of three tabbed views.
5. **No Native Date UI:** Absolutely NO `<input type="date">` tags. You must use `dayjs` for all date manipulations and build a custom Tailwind CSS Date Range Picker component.
6. **No Heavy Table Libraries:** Do NOT install `@tanstack/react-table` or similar libraries. Use a standard, Tailwind-styled HTML `<table>` with server-side pagination for the Job Archive.

---

# The Target Schema (`better-sqlite3` in WAL mode)
Initialize the database singleton and create these tables (if they do not exist) on server startup:
* **`users`**: `id` (UUID, PK), `session_id` (String, unique kiosk session), `role` (String), `created_at` (Timestamp).
* **`printers`**: `id` (String, PK - CUPS queue name), `alias` (String), `capabilities` (JSON), `added_at` (Timestamp).
* **`print_jobs`**: `id` (UUID, PK - matches BullMQ jobId), `user_id` (FK), `filename` (String), `pages` (Integer), `copies` (Integer), `color_mode` (String), `duplex` (String), `cost` (Integer - quoted price), `status` (String - queued, completed, failed, canceled), `executed_by_printer` (FK - populated on completion OR failure), `error_message` (Text), `submitted_at` (Timestamp), `completed_at` (Timestamp).
* **`payments`**: `id` (UUID, PK), `print_job_id` (FK), `amount` (Integer), `currency` (String), `status` (String), `gateway` (String), `gateway_reference_id` (String), `created_at` (Timestamp), `updated_at` (Timestamp). *(Note: We create the table now, even if unused in Phase 1).*

---

# Your Task: The Step-by-Step Execution Plan

Based on the schema and modular constraints above, generate a strict, chronological execution plan. Break the plan down into the following phases. **Do not write the code yet; just provide the plan for my approval.**

### Phase 1: SQLite Infrastructure & Initialization (Backend)
Detail how you will install `better-sqlite3`, set up the singleton connection with WAL mode, and execute the schema creation securely on server startup.

### Phase 2: Modular Event Syncing (Backend)
Detail how you will decouple the event tracking by setting up a global BullMQ `QueueEvents` listener. Explain exactly how the SQL `INSERT` (at job birth) and SQL `UPDATE` (at job death/failure, capturing the executing printer) will be integrated without blocking the main worker threads.

### Phase 3: Analytics API Layer (Backend)
Detail the REST endpoints (`/api/analytics/*`) and the underlying service methods required to calculate Financial Aggregations, Fleet Telemetry, and the Paginated Job Archive (including CSV export). 

### Phase 4: Frontend Implementation (React)
Detail the component structure for the single `/admin/analytics` page. Explain how you will build the custom `dayjs` DateRangePicker, manage the 3 tabbed views via local state, and implement the lightweight HTML data table.