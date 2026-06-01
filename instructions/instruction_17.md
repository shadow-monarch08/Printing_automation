# System Role & Objective
You are an Expert Full-Stack Software Architect specializing in Node.js, Express, React, BullMQ/Redis, and SQL databases. 

We are upgrading our existing print-spooler architecture. Currently, we rely exclusively on a "Hot Tier" (Redis/BullMQ) for live print queues and ephemeral printer states. We are now introducing a "Cold Tier" relational database (`better-sqlite3`) to serve as a permanent ledger. This ledger will support a new Payment Gateway integration, historical business analytics, and a permanent job archive.

# Your Task: Codebase Sweep & Gap Analysis
Perform a comprehensive sweep of the backend (`server/src/`) and frontend (`admin-ui/src/`) directories. Generate a detailed "Gap Analysis & Implementation Report" that compares our **Current State** against the **Target State** defined below. Do not write the implementation code yet; solely analyze the gaps and provide a chronological execution plan.

---

# Target Architecture Context

## 1. The Target Database Schema (SQLite)
We will use `better-sqlite3` configured with `WAL` (Write-Ahead Logging) mode. The target schema requires four core tables:

* **`users`**: `id` (UUID), `session_id` (String, unique kiosk session), `role` (String), `created_at`.
* **`printers`**: `id` (String, CUPS queue name), `alias` (String), `capabilities` (JSON), `added_at`.
* **`print_jobs`**: `id` (UUID, matches BullMQ jobId), `user_id` (FK), `filename`, `pages`, `copies`, `color_mode`, `duplex`, `paper_size` (String, e.g., A4/Letter), `cost` (Integer in minimum currency unit, representing quoted price), `status` (pending_payment, queued, completed, failed, canceled), `executed_by_printer` (FK, populated on completion), `error_message`, `submitted_at`, `completed_at`.
* **`payments`**: `id` (UUID), `print_job_id` (FK), `amount` (Integer in minimum currency unit), `currency`, `status` (initiated, successful, failed, refunded), `gateway` (String), `gateway_reference_id`, `created_at`, `updated_at`.

## 2. Event-Driven Write-Behind Syncing
We cannot bottleneck the live queue. SQLite insertions must happen at two specific lifecycle events:
1.  **Job Birth:** In the print controller, prior to enqueuing to BullMQ, a job is recorded in SQLite with status `pending_payment`.
2.  **Job Death:** Using BullMQ's global `QueueEvents` (`completed`, `failed`), the SQLite record is updated with final timestamps, final status, and the executing printer.

## 3. The Analytics & Admin UI
The React frontend will feature a global Date Range Picker powering three distinct views:
1.  **Financial Ledger:** Heatmaps/trendlines comparing `print_jobs.cost` vs. `payments.amount`, and revenue splits (Color vs. B&W).
2.  **Fleet Telemetry:** Volume leaderboards (total pages per printer) and strike/error rates calculated from failed jobs.
3.  **Job Archive:** A paginated, server-side filtered data table pulling directly from SQLite, completely decoupled from the live Redis queue, featuring a CSV export function.

---

# Audit Requirements

Please analyze the codebase and report on the following four domains:

### Domain 1: Database & Event Infrastructure
* **Audit:** Search for existing SQL/SQLite dependencies, initialization files, or ORMs. 
* **Audit:** Analyze `printMaster.queue.ts` and `printMaster.worker.ts`. Identify where global `QueueEvents` can be attached to listen for job completions/failures outside of the active worker threads.
* **Gap:** What is required to inject `better-sqlite3` into the dependency injection container or singleton services?

### Domain 2: Payment Gateway & Submission Flow
* **Audit:** Analyze `print.controller.ts` (specifically `printFile`). Identify the exact line between pricing calculation and BullMQ enqueueing.
* **Gap:** Outline the exact middleware or controller restructuring needed to pause the BullMQ insertion, generate a payment intent/order, return the checkout UI to the client, and handle the asynchronous webhook confirmation before finally pushing to Redis.

### Domain 3: Analytics API Layer
* **Audit:** Review existing controllers (e.g., `job.controller.ts`, `events.controller.ts`) for any current reporting or revenue summation logic that relies on the ephemeral Redis cache.
* **Gap:** Define the new REST endpoint structures required to serve the aggregated SQL data (e.g., `/api/analytics/financial?startDate=X&endDate=Y`). Detail how date-range filtering and pagination will be handled via SQL `LIMIT`/`OFFSET`.

### Domain 4: Frontend Admin Dashboard
* **Audit:** Scan `admin-ui/package.json` and the routing logic. Identify existing charting libraries (e.g., Recharts, Chart.js), table libraries, and the layout structure for the admin portal.
* **Gap:** What components need to be built to support a global Date Range Picker context? Detail the component tree needed for the 3 target views (Financial, Telemetry, Archive).

---

# Required Output Format

Provide a highly structured Markdown report containing:
1.  **Executive Summary:** A brief overview of the system's readiness for this upgrade.
2.  **Domain-by-Domain Analysis:** Clear "Current State" vs. "Target State" comparisons for all 4 domains listed above.
3.  **Dependency Updates:** A list of `npm` packages that need to be installed (e.g., `better-sqlite3`, charting libraries, date utilities).
4.  **Phase 1 Execution Plan:** A strict, chronological, step-by-step blueprint of which files to create or modify first (e.g., "Step 1: Create `database.ts` and run table schemas. Step 2: Update BullMQ event listeners..."). Do not output the code for these steps, only the architectural plan.