# Comprehensive Audit & Specification Report: Empty States & Error State UIs

---

## 1. Overview & Design System Role

In an **Industrial Automation & Mechanical Printshop** platform, Empty States and Error States are critical communication interfaces. Rather than displaying blank white spaces or generic browser alerts, the platform uses stenciled equipment tags, 16-bit retro pixel-art illustrations, dot-matrix paper containers, and pulsing LED status indicators to maintain constant user feedback.

```
+-----------------------------------------------------------------------+
|                                                                       |
|                     +-----------------------+                         |
|                     | [===================] | <- Empty Printer Hatch  |
|                     | | --- OUT OF PAPER -- |    Pixel Illustration   |
|                     | [===================] |                         |
|                     +-----------------------+                         |
|                                                                       |
|                       YOUR FLEET IS EMPTY                             | <- Monospace Title
|  Get started by detecting hardware or manually adding a printer.      | <- Secondary Copy
|                                                                       |
+-----------------------------------------------------------------------+
```

---

## 2. Customer Kiosk Specific Error States

### Customer System Offline / Inactive Hardware Screen (`src/App.tsx`)
- **Mounting Criteria:** Triggered automatically when `isAcceptingJobs === false`. This state occurs whenever:
  1. No active printers are connected to the hardware topology (`activePrinters === 0`).
  2. All connected printers are in an `offline` or `error` state.
  3. The administrator has activated the **Global Master Queue Pause** (`isQueuePaused === true`).
- **Visual & Structural Design:**
  - **Full Layout Interception:** Completely replaces the 4-step customer kiosk flow (`DropZone`, `ConfigConsole`, `QuoteReceipt`, `JobTracker`) to prevent users from attempting unusable uploads.
  - **Warning Badge:** Displays a prominent 64px `<AlertTriangle />` icon in Industrial Danger Red (`var(--status-error)` / `var(--btn-danger-bg)`).
  - **Header Readout:** `<h2 className="offline-title">SYSTEM OFFLINE</h2>` rendered in bold `IBM Plex Mono` monospace typography.
  - **Secondary Message:** `<p className="offline-desc">No printers are currently available. Please check back later.</p>` styled with centered text in `var(--status-error)`.
- **System Behavior:** Blocks document drag-and-drop triggers, file input clicks, and WebSocket job creation requests until at least one printer reports `idle` or `ready`.

---

## 3. Platform-Wide Reusable Primitives & Design Specs

### A. Master Empty State Primitive (`src/components/shared/EmptyState.tsx`)
- **Visual Aesthetic:** Styled like an open cardboard shipping box or an unlatched printer hatch tray.
- **Container Box:**
  - Background: `var(--bg-surface)` (`#24282D` in Dark Mode / `#EBE6DC` in Light Mode).
  - Frame Rule: `2px dashed var(--border-default)` (`#3A4047` / `#D2CBBE`).
  - Corners: `4px` slightly rounded corners.
  - Padding & Alignment: `padding: 40px 24px`, `margin: 24px auto`, `max-width: 560px`, centered column layout.
- **Pixel-Art Graphic Badge:**
  - Centered $64\times64\text{px}$ retro pixel-art SVG illustration of an open printer hatch and empty paper tray, drawn with sharp pixel strokes in `var(--text-secondary)` and `var(--accent-primary)`.
- **Typography:**
  - **Title:** `font-family: var(--font-mono)` (`IBM Plex Mono`), `font-size: 16px`, `font-weight: 700`, uppercase, `letter-spacing: 0.05em`, color `var(--text-primary)`.
  - **Description Copy:** `font-family: var(--font-body)` (`Space Grotesk`), `font-size: 13px`, color `var(--text-secondary)`, `max-width: 360px`, `margin-top: 8px`, `line-height: 1.5`.

### B. Terminal Error Readout (`src/components/shared/ValidatedInput.tsx`)
- **Mounting Trigger:** Fired on field blur or text change when validation function fails (`error !== null`).
- **Visual Design:**
  - Input box border switches to `1px solid var(--status-error)` (`#FF4444` / `#DC2626`).
  - Error readout slides down below the field: `font-family: var(--font-mono)`, `font-size: 11px`, color `var(--status-error)`, prepended with a warning prefix: `[!] INVALID_ENTRY`.

### C. Dot-Matrix Error Toast (`src/components/shared/ToastStack.tsx`)
- **Mounting Trigger:** Fired when `addToast({ type: 'error', title: '...', description: '...' })` is invoked.
- **Visual Design:**
  - 360px card shell anchored to bottom-right with a `6px dashed var(--status-error)` left perforated accent bar.
  - Monospace header tag: `[SYS_ERROR]`.
  - Pulsing LED Indicator: A square $8\times8\text{px}$ pixelated red dot blinking next to the status title (`@keyframes pulseLed`).

### D. Alert Metric Gauges (`src/components/admin/MetricCard.tsx`)
- **Mounting Trigger:** Mounted on Dashboard when `alert={true}` (e.g., queued jobs > 10).
- **Visual Design:**
  - Left border switches to `3px solid var(--status-error)`.
  - Metric number text turns Red (`#FF4444`).
  - Pulsing red LED diode blinks next to the metric label.

---

## 4. Tab-by-Tab Empty & Error State Inventory

### 1. Hardware Fleet Page (`src/pages/admin/Fleet.tsx`)
- **Empty State (Fleet Empty):**
  - **Mounting Criteria:** `!isLoadingPrinters && printers.length === 0`.
  - **Visual Design:** Renders `<EmptyState>` with a `<Printer size={48} />` badge, title `"YOUR FLEET IS EMPTY"`, and description copy prompting the user to detect legacy hardware.
- **Printer Card Error State (`src/components/admin/PrinterCard.tsx`):**
  - **Mounting Criteria:** `printer.status === 'error'` or `printer.paper === 'empty'`.
  - **Visual Design:**
    - Printer icon badge background turns Red.
    - Paper tray status bar fills with `var(--status-error)` (`#FF4444`).
    - Status badge renders as `badge-error` (`[ERROR]`).

### 2. Master Print Queue Page (`src/pages/admin/Queue.tsx`)
- **Empty State (Queue Empty):**
  - **Mounting Criteria:** `!isLoadingQueue && queue.length === 0`.
  - **Visual Design:** Embedded directly inside the continuous tractor-feed `<PaperTable>` component. Displays `<EmptyState title="Queue Empty" description="There are no active or pending print jobs in the master queue." />`.
- **Master Queue Paused Warning Bar:**
  - **Mounting Criteria:** Mounted at top of table when `isQueuePaused === true`.
  - **Visual Design:** Amber alert banner (`background: rgba(234, 179, 8, 0.1)`), border `1px solid var(--border-default)`, displaying monospace warning text: `MASTER QUEUE PAUSED - NEW JOBS ARE ON HOLD`.

### 3. Job Archive View (`src/pages/admin/analytics/ArchiveView.tsx`)
- **Empty State (No Records Found):**
  - **Mounting Criteria:** `!loading && jobs.length === 0`.
  - **Visual Design:** Embedded inside `<PaperTable>` displaying `<EmptyState title="No Records Found" description="No jobs matched the selected filter criteria." />`.

### 4. Fleet Telemetry View (`src/pages/admin/analytics/TelemetryView.tsx`)
- **Empty State (Telemetry Unavailable):**
  - **Mounting Criteria:** `!loading && telemetry.length === 0`.
  - **Visual Design:** Full-width card with monospace text: `"No telemetry data available for this period."`.

### 5. Dashboard Overview (`src/pages/admin/Dashboard.tsx`)
- **Empty Chart State (Awaiting Telemetry):**
  - **Mounting Criteria:** `metricsHistory.length === 0`.
  - **Visual Design:** Recharts container displays a centered monospace notice: `"Awaiting telemetry..."`.

---

## 5. Gap Analysis & Recommended UI Enhancements

The audit revealed three areas where an empty or error state UI is currently missing or could be improved:

| Tab / Component | Current Behavior (Gap) | Recommended Empty State Solution |
| :--- | :--- | :--- |
| **Discovered Devices Section** (`Fleet.tsx`) | When a legacy hardware scan finds 0 devices, only a toast is shown; the `Discovered Devices` section remains invisible. | Render a dedicated `<EmptyState>` panel inside the section stating `"No Unconfigured Hardware Discovered"` with a rescored manual IP entry button. |
| **Settings Page Load Failure** (`Settings.tsx`) | If `pricingConfig` fetch fails or returns `null`, the page renders `null` (blank screen). | Render an error `<EmptyState>` card titled `"Failed to Load Configuration"` with a mechanical `Retry` button. |
| **Kiosk Active Job Tracker** (`ActiveJobIndicator.tsx`) | When a user lands on the tracker page without an active job submission, the page renders an unhelpful static message. | Render an `<EmptyState>` card titled `"No Active Submission"` with a primary button redirecting to Step 1 (Upload Document). |
