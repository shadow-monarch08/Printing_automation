# Master Prompt: Batch 4 — Cards, Industrial Recharts, Component Folder Structuring, and Custom Page-Specific Skeleton Architecture

You are tasked with executing **Batch 4** of the platform UI overhaul. Your goals are:
1. Refactor Custom Cards & Metric Gauges to match the Heavy Equipment Panel aesthetic[cite: 9].
2. Remap Recharts Data Visualizations to the Industrial Oscilloscope / Chart Plotter theme[cite: 9, 10].
3. Ensure proper file structure by creating and exporting missing shared UI elements inside appropriate subfolders under `src/components/`[cite: 5].
4. Build custom, layout-matching Industrial Skeleton Loaders for EVERY page and tab across both Admin and Customer Kiosk interfaces[cite: 9].

You MUST preserve all data-binding logic, state hooks, Recharts wrappers, calculation functions, and user interaction handlers[cite: 9].

---

## Task 1: Component Folder Organization & File Creation Guidelines

Before refactoring, enforce clean folder boundaries under `src/components/`[cite: 5]:
- **Shared Primitives:** Place general UI components (cards, skeletons, badges) in `src/components/shared/`[cite: 5].
- **Admin Components:** Place dashboard metrics, fleet cards, telemetry meters, and table wrappers in `src/components/admin/`[cite: 5].
- **User Kiosk Components:** Place quote receipts, page steppers, active job indicators, and file dropzone containers in `src/components/user/`[cite: 5].

If any UI element mentioned below was previously declared inlined inside a page file (e.g., metric cards or chart wrappers defined inside `Dashboard.tsx` or `Analytics.tsx`), **extract it into its own file inside the appropriate directory and export it cleanly**[cite: 5].

---

## Task 2: Custom Cards & Metric Gauges (`MetricCard` & `.card`)

### Target Directory: `src/components/admin/MetricCard.tsx` & global CSS[cite: 5]

1. **`MetricCard.tsx` Overhaul:**
   - **Container Shell:** `background: var(--bg-surface)` (`#24282D` dark / `#EBE6DC` light), `border: 1px solid var(--border-default)`, `border-radius: var(--radius-sm)` (sharp 2px corners)[cite: 9, 10].
   - **Left Accent Bar:** `3px solid var(--accent-primary)` (Safety Orange `#FF5500` dark / `#D03B00` light)[cite: 9, 10].
   - **Alert State (`alert={true}`):** Left border switches to `3px solid var(--status-error)` (`#FF4444` / `#DC2626`)[cite: 9, 10].
   - **Header Row:**
     - Title: `font-family: var(--font-mono)`, uppercase, `font-size: 11px`, `letter-spacing: 0.08em`, color `var(--text-secondary)`[cite: 9, 10].
     - Stenciled ID Tag: Render an upper-right ID tag (e.g., `[GAUGE_ID]`)[cite: 9, 10].
     - Pulsing LED Indicator: When `alert={true}`, render an $8\times8\text{px}$ pixelated red LED dot pulsing next to the title (`@keyframes pulseLed`)[cite: 9].
   - **Data Metric Display:** `font-family: var(--font-mono)`, `font-size: 1.75rem`, `font-weight: 700`, color `var(--text-primary)` (or `var(--status-error)` during alerts)[cite: 9, 10].

2. **Panel Cards (`.card`):**
   - Apply heavy equipment panel frame: `background: var(--bg-surface)`, `border: 1px solid var(--border-default)`, `padding: 24px`, `box-shadow: var(--shadow-paper)`[cite: 9, 10].
   - Section Titles (`h3` inside `.card`): `font-family: var(--font-mono)`, uppercase, `font-weight: 700`, `letter-spacing: 0.05em`, color `var(--text-primary)`, `border-bottom: 1px dashed var(--border-default)`, `padding-bottom: 8px`, `margin-bottom: 16px`[cite: 9, 10].

---

## Task 3: Remap Recharts Data Visualization

### Target Directories: `src/components/admin/charts/` or respective page wrappers[cite: 5]

Update all `Recharts` primitives (`AreaChart`, `BarChart`, `XAxis`, `YAxis`, `Tooltip`, `CartesianGrid`) to use the **Industrial Oscilloscope / Print Plotter** palette[cite: 9, 10]:

1. **Color Mapping:**
   - **Primary Metric (CPU / Revenue):** Stroke `var(--accent-primary)` (`#FF5500` dark / `#D03B00` light), linear gradient fill from `rgba(255,85,0,0.2)` fading to `0%`[cite: 9, 10].
   - **Secondary Metric (Memory / Job Volume):** Stroke `var(--accent-secondary)` (`#00A396` dark / `#00665E` light), linear gradient fill from `rgba(0,163,150,0.2)` fading to `0%`[cite: 9, 10].
   - **Tertiary Metric (Disk / Failures):** Stroke `var(--status-error)` (`#FF4444` / `#DC2626`)[cite: 9, 10].
2. **Axes & Grids:**
   - `CartesianGrid`: `stroke="var(--border-default)"`, `strokeDasharray="2 2"`, `vertical={false}`[cite: 9, 10].
   - `XAxis` & `YAxis`: Tick fonts set to `font-family: var(--font-mono)`, `font-size: 11px`, `fill: var(--text-secondary)`[cite: 9, 10].
3. **Custom Tooltip Overlay (`<Tooltip content={...} />`):**
   - Style floating overlay as a **Stenciled Carbon Copy Slip**:
     - `background: var(--bg-paper)` (`#2D3238` dark / `#FDFBF7` light)[cite: 9, 10].
     - `border: 2px solid var(--border-default)`, `box-shadow: var(--shadow-paper)`[cite: 9, 10].
     - Typography inside tooltip: `font-family: var(--font-mono)`, `font-size: 12px`, color `var(--text-primary)`[cite: 9, 10].

---

## Task 4: Page-Specific & Layout-Matching Skeleton Architecture

Replace generic spinners and blank screens with **custom wireframe skeleton components** that mirror the exact layout structure of the upcoming content[cite: 9].

All skeletons MUST utilize our **Laser-Shimmer Wave**:
`after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.5s_infinite] after:bg-gradient-to-r after:from-transparent after:via-[var(--accent-glow)] after:to-transparent`[cite: 10]

### A. Shared Base Primitives (`src/components/shared/SkeletonPrimitives.tsx`)
Create atomic skeleton building blocks[cite: 5]:
- `SkeletonBox`: Rectangular block with `background: var(--bg-surface-alt)` and shimmer effect[cite: 10].
- `SkeletonText`: Inline bar matching typography height (`h-4` or `h-6`)[cite: 10].
- `SkeletonPaperTable`: A tractor-feed paper sheet container with perforated top hole accents housing 5 shimmer table rows[cite: 8, 10].

### B. Admin Page Custom Skeletons (`src/components/admin/skeletons/`)[cite: 5]

1. **`DashboardSkeleton.tsx` (Dashboard Tab):**
   - Top Bar: 4 metric card wireframes (each matching `MetricCard` dimensions with left border and title text placeholders)[cite: 9].
   - Middle Section: Dual panel cards (Left: CPU/Memory usage graph wireframe with fake axis lines; Right: System health progress bar wireframes)[cite: 9].
   - Bottom Section: A `SkeletonPaperTable` matching the recent jobs table layout[cite: 8, 9].

2. **`FleetSkeleton.tsx` (Fleet Tab):**
   - Top Header: Add printer CTA button wireframe[cite: 5].
   - Grid Layout: 3 rectangular printer card wireframes, each showing placeholders for printer icon, status badge tag, alias input field, and capability tag pills[cite: 5].

3. **`QueueSkeleton.tsx` (Queue Tab):**
   - Top Bar: Filter tabs and bulk action button placeholders[cite: 5].
   - Main Body: Full-width `SkeletonPaperTable` displaying 6 row wireframes with action button placeholders[cite: 5, 8].

4. **`AnalyticsSkeleton.tsx` (Analytics Tab):**
   - Top Control Bar: Date range picker tab placeholders[cite: 5].
   - Metric Row: 3 financial metric card wireframes[cite: 5].
   - Visualization Grid: Large area/bar chart wireframes with fake grid rules and legend placeholders[cite: 9].

5. **`SettingsSkeleton.tsx` (Settings Tab):**
   - Form Panels: 3 stacked panel card wireframes with form field label tags and input box placeholders[cite: 5].

### C. Customer Kiosk Custom Skeletons (`src/components/user/skeletons/`)[cite: 5]

1. **`KioskUploadSkeleton.tsx` (Step 1: Upload / Dropzone):**
   - Top Progress Tracker: 4-step horizontal bar wireframe (`Upload` $\rightarrow$ `Configure` $\rightarrow$ `Quote` $\rightarrow$ `Tracker`)[cite: 5].
   - Main Container: Large dashed drag-and-drop dropzone card wireframe with centered icon and upload button placeholder[cite: 5].

2. **`KioskConfigSkeleton.tsx` (Step 2: Config Console):**
   - Progress Tracker wireframe at top[cite: 5].
   - Two-Column Layout: Left column showing document preview card wireframe; Right column showing page selection pills, color mode cards, and copy stepper wireframes[cite: 5].

3. **`KioskQuoteSkeleton.tsx` (Step 3: Quote Receipt):**
   - Progress Tracker wireframe at top[cite: 5].
   - Main Body: Centered receipt sheet paper wireframe featuring top tear-line scissor accent, itemized pricing row placeholders, and a bottom mechanical button placeholder[cite: 5, 10].

4. **`KioskTrackerSkeleton.tsx` (Step 4: Job Tracker):**
   - Status Card wireframe with pulsing LED dot placeholder and monospace job ID badge[cite: 5, 9].

---

## Batch 4 Verification Checklist
1. **Component Folder Check:** Verify that new elements are cleanly organized in `src/components/shared/`, `src/components/admin/`, or `src/components/user/` without floating in root folders[cite: 5].
2. **Metric Cards Check:** Verify cards feature sharp 2px corners, monospace titles, stenciled ID tags (`[GAUGE_ID]`), and pulsing red LEDs during alert states[cite: 9, 10].
3. **Recharts Check:** Verify chart curves use Safety Orange (`#FF5500`) and Press Cyan (`#00A396`) with grid graph-paper lines and carbon-copy receipt tooltips[cite: 9, 10].