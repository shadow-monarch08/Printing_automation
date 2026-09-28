# Architecture Specification: Event Bus Remodel, Delivery Networks & Kiosk Decoupling

**Document Version:** 1.0.0  
**Date:** September 28, 2026  
**Status:** Approved Specification / Pre-Implementation  
**Target Path:** `Printing_automation/reports/event_bus_and_architecture_remodel_spec.md`

---

## 1. Executive Summary

This specification defines the architectural overhaul for the **Smart Spooler & Kiosk Ecosystem**. It addresses structural limitations identified during mobile onboarding, cross-customer data leakage over WebSockets, sticky error states, and memory overhead on the Raspberry Pi display.

### Core Objectives
1. **Catalog & Unify All Events:** Standardize all internal events under a clean hierarchical taxonomy.
2. **Channel-Based Delivery Network:** Replace the naive global WebSocket broadcast with a multiplexed, room-based gateway isolating **Admin**, **Customer (session-scoped)**, and **Kiosk (hardware-scoped)** traffic.
3. **Formal Onboarding State Machine (FSM):** Persist onboarding failures in SQLite, enforce strict state transition guards, and implement deterministic auto-rollback with auto-acknowledgment.
4. **Consolidated Transport (Retire SSE):** Unify all real-time delivery under WebSockets, eliminating redundant SSE streaming infrastructure.
5. **Extract Kiosk Display into Standalone `kiosk-ui` App:** Decouple the 800×480 physical touchscreen app from the desktop Admin/Customer bundle to eliminate memory pressure, styling collisions, and cursor bugs on the Raspberry Pi.

---

## 2. Complete Inventory of Existing Events

Audit of all events currently emitted, published, or handled across the codebase:

| Event Identifier | Emitter Source | Trigger Condition | Current Payload | Current Consumers | Current Flaws & Risks |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `job_queued` | `print.controller.ts:75` | Customer submits print job after quote | `{ id, filename, pageCount, copies, colorMode, duplex, cost, status: "queued", sessionId, ... }` | `events.controller.ts` (WS broadcast), `useUserPrintStore.ts` | **Data Leak:** Broadcast to all connected customer browsers. Every customer sees other people's filenames and IDs. |
| `job_active` | `printMaster.worker.ts:20, 149` | BullMQ worker picks up job; starts spooling/rendering | `{ id: job.id, data: { ...job.data, status: "spooling" } }` | `events.controller.ts` (WS broadcast), `useUserPrintStore.ts` | Broadcast globally without session scoping. |
| `job_completed` | `printMaster.worker.ts:163` | CUPS printer successfully finishes printing | `{ id: job.id, data: job.data }` | `events.controller.ts` (WS broadcast), `useUserPrintStore.ts` (triggers toast) | Frontend filters on client (`if (userState.jobId === id)`); payload leaked to all clients. |
| `job_failed` | `printMaster.worker.ts:102, 185` | Rendering or CUPS execution fails | `{ id: job?.id, reason: err.message }` | `events.controller.ts` (WS broadcast), `cloudSync.service.ts:328`, `useUserPrintStore.ts` | Failure reason broadcast to every connected phone in the shop. |
| `printer_state_changed` | `printMaster.worker.ts:28, 160, 182`, `printer.service.ts:478` | Printer begins job, returns to idle, or CUPS heartbeat sweep updates state | `{ printer: string, state: "idle" \| "busy" \| ... }` | `events.controller.ts` (WS broadcast), `cloudSync.service.ts:341` | Sent to customer browsers who have no need for raw CUPS printer state transitions. |
| `printer_quarantined` | `printMaster.worker.ts:70` | Printer fails repeatedly or reports hardware paper/media fault | `{ printer: string, reason: string }` | `events.controller.ts` (WS broadcast), `websocketService.ts` (triggers toast) | Global toast pops up on customer phones even if their job is on a different printer. |
| `queue_paused` | `printMaster.worker.ts:89` | Zero healthy printers available in fleet | `{ reason: string, ... }` | `events.controller.ts` (WS broadcast), `websocketService.ts` | Global toast displayed across all UI personas. |
| `queue_resumed` | `printer.controller.ts:84` | Admin resolves printer error or resumes queue | `{ message: string }` | `events.controller.ts` (WS broadcast), `websocketService.ts` | Global toast displayed across all UI personas. |
| `printer_discovery` | `printer.controller.ts:138, 163, 208, 237` | USB printer plugged in, scanned, or configured | `{ timestamp: string }` | `events.controller.ts` (WS broadcast) | Admin-only hardware event broadcast to customer phones. |
| `system_critical` | `metrics.service.ts:48` | Disk usage > 90% or system load critical | `{ type: string, message: string, ... }` | `events.controller.ts` (WS broadcast), `cloudSync.service.ts:318`, `websocketService.ts` | Admin alert shown to all customers. |
| *`provisioning:telemetry` (Siloed)* | `onboarding.service.ts:46` | Onboarding hardware phase progression | `{ status, phase, step, totalSteps, progressPercent, message, ssid, shopName, cloudflareUrl, code, error, rollbackActive, ... }` | Redis key `kiosk:wifi:status`, Redis pubsub `channel:provisioning:telemetry`, `/setup/provision-stream` (SSE) | **Completely disconnected from `eventBus`!** Polled every 750ms in SSE route; not accessible to Central NMS or WebSockets. |
| *`network_recovery:*` (Implicit)* | `networkRecovery.service.ts` | Internet drop detected; rescue hotspot activated/deactivated | Console log only | None | Not published to EventBus at all; UI cannot react to automatic rescue hotspot state changes. |

---

## 3. Remodeled Event Taxonomy & Delivery Architecture

### 3.1 Hierarchical Taxonomy
Events will follow standard hierarchical namespacing: `<domain>:<resource>:<action>`

```
events/
├── customer/
│   ├── job:queued         ({ sessionId, jobId, filename, pages, cost })
│   ├── job:active         ({ sessionId, jobId, status: "spooling" | "printing" })
│   ├── job:completed      ({ sessionId, jobId, filename })
│   ├── job:failed         ({ sessionId, jobId, reason })
│   └── quote:override     ({ sessionId, quoteId, adjustedCost, reason })
│
├── admin/
│   ├── fleet:changed      ({ printer, state, queueLength })
│   ├── printer:error      ({ printer, code, reason })
│   ├── queue:state        ({ paused: boolean, reason })
│   ├── hardware:discovery ({ deviceType, id, timestamp })
│   └── metrics:critical   ({ metric: "DISK" | "CPU" | "RAM", value, alertLevel })
│
├── kiosk/
│   ├── onboarding:status  ({ phase, step, percent, message })
│   ├── onboarding:error   ({ code, error, rollbackActive })
│   ├── onboarding:done    ({ cloudflareUrl, nmsDeviceId })
│   └── chassis:alert      ({ type: "PAPER_JAM" | "DOOR_OPEN", printer })
│
└── system/
    └── broadcast:alert    ({ level: "INFO" | "WARN" | "CRITICAL", message })
```

### 3.2 Realtime Delivery Gateway (Room-Based Multiplexing)

```
                            ┌────────────────────────┐
                            │  Internal Event Bus    │
                            │   (Redis 'events:bus') │
                            └───────────┬────────────┘
                                        │
                                        ▼
                            ┌────────────────────────┐
                            │   Realtime Dispatcher  │
                            │ (Evaluates routing tag)│
                            └───┬───────┬────────┬───┘
                                │       │        │
            ┌───────────────────┘       │        └───────────────────┐
            ▼                           ▼                            ▼
   ┌─────────────────┐        ┌──────────────────┐        ┌─────────────────────┐
   │   room:admin    │        │    room:kiosk    │        │room:customer:{sess} │
   │                 │        │                  │        │                     │
   │ Authenticated:  │        │ Authenticated:   │        │ Scoped to single    │
   │ Admin PIN/JWT   │        │ Loopback 127.0.0.1│       │ client sessionId    │
   └─────────────────┘        └──────────────────┘        └─────────────────────┘
```

#### Room Specifications:
1. **`room:admin`**:
   - Connection URL: `/ws?role=admin` (Requires Admin PIN / Session token).
   - Receives: `admin:*`, `customer:job:*` (aggregated), `kiosk:*`, `system:*`.
2. **`room:customer:<sessionId>`**:
   - Connection URL: `/ws?role=customer&sessionId=<SESSION_ID>`.
   - Receives: `customer:*` where `payload.sessionId === clientSessionId`, plus `system:broadcast:alert`.
   - **Isolation Guarantee:** Zero visibility into any other customer's jobs, file names, or print parameters.
3. **`room:kiosk`**:
   - Connection URL: `/ws?role=kiosk` (Restricted to loopback `127.0.0.1`).
   - Receives: `kiosk:*`, `onboarding:*`, `system:broadcast:alert`.
   - Replaces the legacy `/setup/provision-stream` SSE endpoint entirely.
4. **Cross-Boundary Action (Admin $\rightarrow$ Specific Customer)**:
   - When an Admin modifies or cancels a job from the Admin Panel, the server emits:
     `eventBus.emit("customer:job:failed", { sessionId: targetJob.sessionId, jobId: targetJob.id, reason: "Cancelled by Operator" })`
   - The Realtime Dispatcher extracts `sessionId` and pushes directly to `room:customer:<sessionId>`. The customer's mobile browser receives the update instantaneously without polling.

---

## 4. Onboarding State Machine (FSM) & Database Persistence

### 4.1 SQLite Schema Update
Add permanent audit columns to `system_config`:

```sql
-- Migration: Add audit and error tracking to system_config
ALTER TABLE system_config ADD COLUMN onboarding_stage TEXT DEFAULT 'IDLE';
ALTER TABLE system_config ADD COLUMN last_error_code TEXT DEFAULT NULL;
ALTER TABLE system_config ADD COLUMN last_error_message TEXT DEFAULT NULL;
ALTER TABLE system_config ADD COLUMN last_failed_at DATETIME DEFAULT NULL;
ALTER TABLE system_config ADD COLUMN failed_step_number INTEGER DEFAULT NULL;
ALTER TABLE system_config ADD COLUMN attempt_count INTEGER DEFAULT 0;
```

### 4.2 State Transition Matrix
Strict transition guards implemented in `OnboardingStateMachine`:

```
                       [ IDLE ]
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
     [ HOTSPOT_ACTIVE ]          [ RADIO_ASSOCIATING ]
            │                           │
            ▼                           ▼
  [ DEACTIVATING_HOTSPOT ] ───► [ RADIO_ASSOCIATING ]
                                        │
                                        ▼
                             [ NEGOTIATING_DHCP ]
                                        │
                                        ▼
                            [ SPAWNING_TUNNEL ]
                                        │
                                        ▼
                           [ VERIFYING_DAEMONS ]
                                        │
                                        ▼
                                    [ READY ]
```

#### Failure & Rollback Loop:
```
Any Active State ─────(On Exception)────► [ FAILED ]
                                              │
                                              ▼
                                    [ AUTO_ROLLING_BACK ]
                                              │
                         ┌────────────────────┴────────────────────┐
                         ▼ (Mobile Mode)                           ▼ (Screen Mode)
                 [ HOTSPOT_RESTORED ]                              [ IDLE_FAILED ]
                         │                                                 │
                         └─────────────────┬───────────────────────────────┘
                                           │ (10s Auto-Acknowledge TTL)
                                           ▼
                                        [ IDLE ]
```

#### Transition Guard Rules:
1. `READY` can only be entered from `VERIFYING_DAEMONS`.
2. Skipping to `READY` directly from `IDLE` or `HOTSPOT_ACTIVE` throws `InvalidStateTransitionError`.
3. When transitioning to `FAILED`, `last_error_code`, `last_error_message`, and `last_failed_at` are immediately written to SQLite.
4. After rollback actions complete, the system enters `IDLE_FAILED` with an auto-acknowledge timer (10 seconds) that transitions telemetry back to `IDLE`. This eliminates sticky error screens and breaks infinite ping-pong loops permanently.

---

## 5. Transport Consolidation: Retire SSE for WebSocket

### Why Retiring SSE Is the Superior Architecture
1. **Single Real-time Protocol:** The application already requires WebSockets for bi-directional customer and admin communications. Maintaining an additional SSE pipeline creates duplicated connection management, heartbeats, and error-handling code.
2. **True Event-Driven Delivery:** The existing `/setup/provision-stream` endpoint fakes real-time by polling Redis every 750ms (`setInterval`). A WebSocket room (`room:kiosk`) subscribes directly to `eventBus`, delivering events in sub-millisecond time.
3. **Bi-directional Capability:** The physical kiosk screen can send back acknowledgments (e.g. `kiosk:ack_error` or `kiosk:screen_mounted`), which SSE cannot support without auxiliary HTTP requests.

---

## 6. Frontend Decoupling: Standalone `kiosk-ui` Project

### 6.1 Architectural Comparison

| Dimension | Current Monolithic Bundle (`admin-ui`) | Decoupled Architecture (`kiosk-ui` + `admin-ui`) |
| :--- | :--- | :--- |
| **Pi Memory Footprint** | ~180MB RAM (Chromium loads Recharts, Chart.js, admin tables, customer dropzones) | **~35MB RAM** (Only primitive UI, Lucide icons, and zero-dependency kiosk stores) |
| **Cold Boot Time on Pi** | 3.8s to 5.2s initial script evaluation | **< 600ms** evaluation time |
| **Viewport & Styling** | Shared global CSS. Mobile/desktop resets bleed into the 800×480 screen | **100% isolated 800×480 viewport**. Dedicated touch CSS, virtual keyboard, hidden cursor |
| **Blast Radius** | Syntax error or dependency failure in Admin breaks physical hardware screen | **Zero blast radius**. Kiosk screen is completely isolated from admin or customer changes |
| **Security Surface** | Kiosk bundle exposes customer file upload and admin routes in bundle chunks | Kiosk bundle contains **zero admin code** or customer endpoints |

### 6.2 Proposed Directory Structure

```text
Printing_automation/
├── kiosk-ui/                       # Standalone 800x480 Hardware App
│   ├── package.json                # Lightweight dependencies: React, Lucide, Zustand
│   ├── vite.config.ts              # Builds to ../server/kiosk-dist
│   ├── src/
│   │   ├── components/             # Touch buttons (48px+), VirtualKeyboard, Gauges
│   │   ├── pages/                  # ModeChoice, MobileHandoff, KioskWifi, HUD
│   │   ├── stores/                 # Clean useKioskStore (WebSocket driven)
│   │   └── index.css               # Exact 800x480 styling, cursor: none, zero-scroll
│
├── admin-ui/                       # Web Portal App (Customer + Admin Control Room)
│   ├── package.json                # Full dependencies: Recharts, react-router, etc.
│   ├── vite.config.ts              # Builds to ../server/public
│   └── src/
│       ├── pages/admin/            # Dashboard, Fleet, Queue, Settings, Analytics
│       ├── pages/user/             # DropZone, ConfigConsole, QuoteReceipt, Tracker
│       └── stores/                 # useAdminStore, useUserPrintStore
│
└── server/                         # Express Backend
    ├── kiosk-dist/                 # Static files for physical screen (/terminal)
    └── public/                     # Static files for web portal (/ and /admin)
```

### 6.3 Server Routing Strategy
In `server/src/app.ts`:
```ts
// 1. Loopback-only route serves physical kiosk app
app.use("/terminal", requireLoopbackOnly, express.static(path.join(__dirname, "../kiosk-dist")));
app.get("/terminal*", requireLoopbackOnly, (_req, res) => {
  res.sendFile(path.join(__dirname, "../kiosk-dist/index.html"));
});

// 2. Public route serves customer portal and admin panel
app.use(express.static(path.join(__dirname, "../public")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});
```

---

## 7. Implementation Roadmap

### Phase 1: Event Bus Overhaul & Taxonomy Standardization
* Refactor [eventBus.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_ecosystem/Printing_automation/server/src/app/utils/eventBus.ts) to support wildcard topic matching (`customer:*`, `admin:*`, `kiosk:*`).
* Connect `onboarding.service.ts` telemetry emissions to `eventBus`.
* Connect `networkRecovery.service.ts` lifecycle state changes to `eventBus`.

### Phase 2: Unified WebSocket Realtime Gateway
* Overhaul [events.controller.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_ecosystem/Printing_automation/server/src/app/controllers/events.controller.ts) with authenticated room management (`room:admin`, `room:customer:<sessionId>`, `room:kiosk`).
* Implement session-scoped message dispatching to prevent cross-customer data leakage.
* Retire `/setup/provision-stream` SSE route and migrate kiosk telemetry to `room:kiosk`.

### Phase 3: Onboarding State Machine & SQLite Persistence
* Run SQLite migration adding audit columns (`onboarding_stage`, `last_error_code`, `last_error_message`, `last_failed_at`, `failed_step_number`) to `system_config`.
* Implement `OnboardingStateMachine` with strict transition guards and an automated 10-second failure acknowledgment timer.
* Fix hotspot deactivation race condition by disabling rogue background auto-reconnects during deliberate onboarding transitions.

### Phase 4: Kiosk-UI Extraction & Build Integration
* Initialize `kiosk-ui/` as a dedicated Vite React project.
* Migrate kiosk components (`KioskTerminalHub`, `KioskWifiStep`, `KioskProvisioningHUD`, `KioskOperationalHUD`, `VirtualKeyboard`).
* Configure backend dual-static serving (`/terminal` $\rightarrow$ `kiosk-dist`, `/` $\rightarrow$ `public`).
* Verify hardware performance, touch response, and memory usage on the physical Raspberry Pi.

---
*Report compiled and saved to `Printing_automation/reports/event_bus_and_architecture_remodel_spec.md`.*
