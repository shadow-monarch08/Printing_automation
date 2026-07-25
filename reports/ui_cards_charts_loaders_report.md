# Comprehensive UI Specification & Lifecycle Audit: Cards, Graphs & Loaders

---

## 1. Custom Card Components (`.card` & `.dashboard-metrics`)

### Visual Blueprint & Aesthetic
The custom card components serve as the primary **Machined Iron Panel** containers for key metrics, system health gauges, and data visualization charts across the **Dashboard** and **Analytics** tabs.

```
+-----------------------------------------------------------------------+
|  ▪ ACTIVE PRINTERS                                           [Icon]   |  <- Left Accent Border: 3px solid
|                                                                       |     Safety Orange (#FF5500)
|  4 / 5                                                                |  <- Monospace Data Display
+-----------------------------------------------------------------------+
```

### Component Variations

#### A. Metric Indicator Card (`MetricCard` / `.dashboard-metrics .card`)
- **Container Styling:**
  - Background: `var(--bg-surface)` (`#24282D` in Dark Mode / `#EBE6DC` in Light Mode).
  - Outer Frame: `1px solid var(--border-default)` (`#3A4047` / `#D2CBBE`).
  - Left Accent Strip: `3px solid var(--accent-primary)` (Safety Orange / Industrial Red-Orange). Switchable to `3px solid var(--status-error)` (`#FF4444` / `#DC2626`) when `alert={true}` (e.g., queued jobs > 10).
  - Border Radius: `var(--radius-sm)` (`2px` sharp industrial corners).
  - Box Shadow: `0 4px 12px rgba(0, 0, 0, 0.15)`.
- **Header Label:** Monospace uppercase string (`font-family: var(--font-mono)`, `font-size: 0.85rem`, `letter-spacing: 0.05em`, color `var(--text-secondary)`).
- **Data Value Display:** Monospace typography (`.data-mono`, `font-size: 1.75rem`, `font-weight: 700`, color `var(--text-primary)` or `var(--status-error)` during alert state).

#### B. Panel Card (`.card`)
- **Usage:** Wraps multi-row metrics, health progress bars, data tables, and Recharts graph containers on the Dashboard and Analytics pages.
- **Container Styling:**
  - Background: `var(--bg-surface)`.
  - Padding: `var(--spacing-lg)` (`24px`).
  - Border: `1px solid var(--border-default)`.
  - Section Title (`h3`): Monospace uppercase header (`font-family: var(--font-mono)`, `font-size: 1.1rem`, `font-weight: 700`, `letter-spacing: 0.05em`, `margin-bottom: 1.5rem`).

---

## 2. Data Visualization & Graph Components

All charts on the platform utilize responsive `Recharts` primitives styled to match the Industrial Automation theme.

```
+-----------------------------------------------------------------------+
| RESOURCE USAGE HISTORY                                                |
|                                                                       |
| 100% |                                                                |
|  75% |               /---\                                            |  <- Area Chart Gradients
|  50% |   /---\  /---/     \---/---\                                   |     CPU: Cyan (#00E5FF)
|  25% | -/-----\/-------------------\-                                 |     Memory: Purple (#8A2BE2)
|   0% +----------------------------------                              |     Disk: Red (#EA3943)
|      12:00:00    12:01:00    12:02:00                                 |
+-----------------------------------------------------------------------+
```

### A. Resource Usage History Area Chart (`Dashboard.tsx`)
- **Purpose:** Real-time multi-series area chart displaying system hardware consumption (CPU %, Memory Used %, Disk Usage %).
- **Styling & Gradients:**
  - **CPU Series:** Cyan stroke (`#00E5FF`) with vertical linear gradient fill (`stopColor="#00E5FF"` fading from 30% opacity to 0%).
  - **Memory Series:** Purple stroke (`#8A2BE2`) with vertical linear gradient fill (`stopColor="#8A2BE2"` fading from 30% opacity to 0%).
  - **Disk Series:** Red stroke (`#EA3943`) with vertical linear gradient fill (`stopColor="#EA3943"` fading from 30% opacity to 0%).
- **Axes & Grid Lines:**
  - Grid: Horizontal dashed rules (`strokeDasharray="3 3"`, `stroke="var(--border-default)"`, `vertical={false}`).
  - X-Axis: Timestamp formatted as `HH:mm:ss` using `IBM Plex Mono` (`font-size: 11px`, `stroke="var(--text-muted)"`).
  - Y-Axis: Percentage values `0%` to `100%`.
- **Hover Tooltip:** Floating panel styled with `background: var(--bg-surface-alt)`, `border: 1px solid var(--border-default)`, `border-radius: 4px`.

### B. Revenue Trend Area Chart (`FinancialView.tsx`)
- **Purpose:** Visualizes daily revenue accumulation over the selected date range.
- **Styling:** Blue stroke (`#007bff`) with gradient area fill fading from 80% opacity to 0%.

### C. Color vs. B&W Split Bar Chart (`FinancialView.tsx`)
- **Purpose:** Grouped bar chart comparing revenue in Rupees vs. total print job count between Color and Grayscale jobs.
- **Styling:** Revenue bars in Purple (`#8884d8`), Job count bars in Green (`#82ca9d`).

### D. Fleet Telemetry Stacked Bar Chart (`TelemetryView.tsx`)
- **Purpose:** Stacked bar chart breaking down Completed jobs vs. Failed jobs for each active hardware printer target.
- **Styling:** Completed jobs in Emerald (`#82ca9d`), Failed jobs in Red (`#ff4d4f`).

---

## 3. Platform Loading Components & Mount Lifecycle Audit

```
+-----------------------------------------------------------------------+
|                                                                       |
|                     +-----------------------+                         |
|                     | o   o   o   o   o   o | <- Continuous Paper Box
|                     | --------------------- |    (--bg-paper)
|                     | ========|============ | <- Scanning Printhead
|                     | o   o   o   o   o   o |    (printScan animation)
|                     +-----------------------+                         |
|                                                                       |
|                     ▪ LINKING_TO_HARDWARE...                          | <- Monospace Readout
|                                                                       |
+-----------------------------------------------------------------------+
```

### Loading Component Matrix & Lifecycle Table

| Component | Mounting Trigger / Conditions | Unmounting Trigger / Conditions | Visual Styling & Animation |
| :--- | :--- | :--- | :--- |
| **`LoadingScreen`** | 1. Initial application boot when checking auth / system state.<br>2. On `Dashboard` tab when `metrics === null`. | Unmounts as soon as `metrics` state is populated or auth check completes. | **Full-Viewport Overlay:** `position: fixed`, `inset: 0`, `z-index: 9999`, `background: var(--bg-primary)`. Centers `<LoadingNet />`. |
| **`LoadingNet`** | 1. Async data fetching inside `FinancialView` (`loading === true`).<br>2. Async telemetry fetching inside `TelemetryView`.<br>3. Async archive table load (`ArchiveView`).<br>4. Queue table synchronization (`Queue.tsx`). | Unmounts when async API response resolves or fails (`loading = false`). | **Dot-Matrix Printhead Box:** `120px x 80px` `--bg-paper` sheet with left/right tractor holes. Scanning orange line (`@keyframes printScan` 1.8s loop). Monospace status text (`▪ MESSAGE...`). |
| **Button Spinner** (`Loader2` inside `<Button>`) | 1. `isLoading={true}` prop set on `<Button>`.<br>2. User clicks a button with an async `onClick` handler returning a pending `Promise`. | 1. `isLoading` set to `false`.<br>2. Async `onClick` `Promise` resolves or rejects. | **Machined Overlay:** `position: absolute`, `inset: 0`, `backdrop-filter: blur(4px)`, `background: rgba(128,128,128,0.1)`. Rotating `Loader2` icon. |
| **Table Row Loader** (`<tr className="loading-row">`) | Mounted inside `PaperTable` `<tbody>` when table data is actively fetching (`isLoadingQueue === true` or `loading === true`). | Unmounts when table data array is populated. | Spans full table column width (`colSpan={N}`), centering `<LoadingNet message="..." />` inside a padded table row. |

---

## 4. Visual Visualization & Motion Guide

### A. Dot-Matrix Scan Line (`printScan`)
- **Keyframes:**
  - `0%`: Top offset `4px`.
  - `50%`: Top offset `74px` (traverses down the paper box).
  - `100%`: Top offset `4px` (returns to origin).
- **Aesthetic:** Simulates a physical tractor-feed dot-matrix printer head scanning paper back and forth across document lines.

### B. Status LED Pulsing (`pulseLed`)
- **Keyframes:**
  - `0%, 100%`: Opacity `1.0`.
  - `50%`: Opacity `0.4`.
- **Aesthetic:** Simulates a physical LED status diode blinking on an industrial equipment control board.
