# Comprehensive Codebase Audit: Spooler Architecture & SSE Mapping

## Context
Before we implement our final "Unified Cache-Driven Printer Health & State Locking" architecture, I need a strict baseline audit of the current codebase. We must identify what is currently built, what is disconnected, what SSE channels exist, and what "dead code" (like live `lpstat` polling) needs to be ripped out. Do NOT write any new code yet. Only analyze and report.

## Target Directories & Files to Scan
Please read and analyze the following areas:
1. `src/services/` (Specifically `printer.service.ts`, `matchmaker.service.ts`, `job.service.ts`)
2. `src/infrastructure/` (Specifically `printMaster.worker.ts`, `printMaster.queue.ts`, `redis.ts`)
3. `src/controllers/` (Specifically `fleet.controller.ts`, `events.controller.ts`, `printer.controller.ts`)
4. Any file handling Server-Sent Events (SSE) or WebSockets (e.g., `eventBus.ts`, `events.routes.ts`)

## Required Output Format
Provide a strictly formatted Gap Analysis Report using the following four categories. Be brief and reference exact file names and line numbers.

### 1. 📡 The SSE (Server-Sent Events) Matrix
List every single SSE event currently being emitted by the backend. 
* Identify the trigger (What causes it?).
* Identify the payload (What data is sent?).
* Note any missing events we will need for the new architecture (e.g., "Queue Paused", "Printer Quarantined", "Faulty Document Flagged").

### 2. 🟢 Existing & Aligned Infrastructure
List the exact functions, Redis connections, and BullMQ setups that are fully built and align with our goal of a cache-first, locked-state architecture.

### 3. 🟡 Disconnected / High-Risk Code (Needs Refactoring)
List the areas that exist but are actively violating the new architecture:
* Any controller or service bypassing Redis to poll hardware directly (e.g., `exec('lpstat')` or `exec('lsusb')` outside of a background loop).
* Worker failover logic that uses `moveToDelayed` without the `DelayedError` lock-release mechanism.
* Matchmaker logic that does not check Redis for `state: "busy"` or `health: "flagged"`.

### 4. 🔴 Missing Architectural Components
List the pieces that do not exist yet, specifically looking for:
* The 5-minute `setInterval` background heartbeat loop.
* The 3-strike progressive flagging system (`printer:<name>:strikes`).
* The Optimistic State Lock (`printer:<name>:state = "busy" / "idle"`).
* The Global Queue Emergency Pause logic.

### 5. 🗑️ Dead Code to Discard
Identify any functions, redundant checks, or legacy failover loops that will become entirely useless once the Redis Single-Source-of-Truth is implemented.