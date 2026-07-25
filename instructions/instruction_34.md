# Master Prompt: Batch 5 — Empty States, Terminal Error Readouts, and System Interceptions

You are tasked with executing **Batch 5** of the UI overhaul. You will rebuild the Master Empty State primitive, refactor the Customer System Offline screen, and resolve the 3 missing error state gaps identified in the UI audit.

You MUST strictly enforce the global design system tokens (`var(--bg-primary)`, `var(--bg-surface)`, `var(--bg-paper)`, `var(--border-default)`, `var(--border-active)`, `var(--accent-primary)`, `var(--font-mono)`, `var(--font-body)`, `var(--status-error)`).

---

## 1. Visual & Architectural Blueprint for Master Primitive `EmptyState.tsx`
**Target File:** `src/components/shared/EmptyState.tsx`

Refactor the `<EmptyState>` component into a **Recessed Unlatched Equipment Hatch** container that sits directly on the page grid.

### Visual Styling Details:
- **Card Shell (`.empty-state-card`):**
  - Background: `var(--bg-surface)` (`#24282D` in Dark Mode / `#EBE6DC` in Light Mode).
  - Border Frame: `2px dashed var(--border-default)` (`#3A4047` / `#D2CBBE`).
  - Corner Radius: `4px` (`var(--radius-md)`).
  - Layout: Centered column flex, `padding: 48px 24px`, `max-width: 560px`, `margin: 24px auto`.
  - Inner Accent: Add a subtle inner border shadow: `box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.2)`.

### 16-bit Retro Pixel-Art SVG Graphics:
Create an internal SVG renderer that renders 16-bit pixelated illustrations (`width: 64px`, `height: 64px`, `shape-rendering: crispEdges`) based on an `iconType` prop:
1. `printer-hatch` (Default): A pixel-drawn open printer lid with an empty paper feed tray and a dashed arrow pointing down into the tray.
2. `unlinked-cable` (Hardware missing): A pixel-drawn USB/Ethernet cable severed in the middle with tiny 2px spark pixels floating around the break.
3. `empty-paper` (Queue/Archive empty): A pixelated single sheet of continuous tractor-feed paper with torn jagged top/bottom edges and tiny side perforation holes.
4. `gear-jam` (Error/Crash): Two interlocking 16-bit gears with an 'X' badge stamped over the junction.

*Graphic Colors:* Use `var(--text-secondary)` (`#9098A2` / `#626A72`) for main body outlines and `var(--accent-primary)` (`#FF5500` / `#D03B00`) for warning/accent highlights.

### Typography & Content Structure:
- **Stenciled Title:**
  - Render an upper-case monospace header: `font-family: var(--font-mono)` (`IBM Plex Mono`), `font-size: 15px`, `font-weight: 700`, `letter-spacing: 0.08em`, color `var(--text-primary)`.
  - Prefix: Prepend a stenciled tag string, e.g., `[SYS_NOTICE] YOUR FLEET IS EMPTY`.
- **Secondary Description Copy:**
  - `font-family: var(--font-body)` (`Space Grotesk`), `font-size: 13px`, color `var(--text-secondary)`, `max-width: 380px`, `margin-top: 10px`, `line-height: 1.5`, `text-align: center`.
- **Mechanical Action Slot:**
  - Render passed `children` (such as CTA buttons) in a horizontal flex container (`margin-top: 20px`, `gap: 12px`).
  - Ensure all passed buttons use the refactored 3D mechanical `<Button>` component with 3D press depression and Web Audio switch click sounds.

---

## 2. Visual & Architectural Blueprint for System Offline Interception
**Target File:** `src/App.tsx` (or root layout guard)

When `isAcceptingJobs === false` (no active printers connected, all hardware in error, or master queue paused), execute a full-screen layout interception.

### Visual Styling Details:
- **Backdrop Screen Overlay:**
  - `position: fixed`, `inset: 0`, `z-index: 9999`, `background: var(--bg-primary)` (`#1A1D20` dark / `#F4F1EA` light).
  - Background Texture: Subtle $20\times20\text{px}$ CSS crosshatch grid lines in `rgba(255, 255, 255, 0.02)`.
- **Heavy Industrial Hazard Panel (`.offline-panel`):**
  - Centered Shell: `background: var(--bg-surface)`, `border: 2px solid var(--status-error)` (`#FF4444` / `#DC2626`), `border-radius: 4px`, `padding: 48px 32px`, `max-width: 500px`, `width: 90%`.
  - Depth Shadow: `box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px var(--status-error)`.
- **Top Pulsing LED Hazard Diode:**
  - A $16\times16\text{px}$ square pixelated diode housing centered above the title.
  - Outer Ring: `border: 2px solid var(--status-error)`.
  - Inner Core: Flashes between `#FF4444` (full opacity) and `rgba(255, 68, 68, 0.2)` every 1 second (`@keyframes pulseLed`).
- **Typography:**
  - Title: `<h2 className="offline-title">[SYSTEM_OFFLINE]</h2>` rendered in `IBM Plex Mono`, `font-size: 20px`, `font-weight: 800`, `letter-spacing: 0.1em`, color `var(--status-error)`.
  - Status Tag: A stenciled warning badge directly below the title: `STATUS: NO_HARDWARE_TARGETS_AVAILABLE`.
  - Explanation Message: `<p className="offline-desc">Kiosk operations have been suspended. All local print hardware targets are currently offline, faulted, or paused by administration.</p>` rendered in `Space Grotesk`, color `var(--text-secondary)`, `font-size: 13px`, `margin-top: 16px`, `line-height: 1.6`.

---

## 3. Detailed UI Fixes for the 3 Audit Gaps

### A. Discovered Devices Section (`src/pages/admin/Fleet.tsx`)
- **Condition:** When `discoveredDevices.length === 0` after a hardware probe scan, do NOT collapse or hide the section.
- **Visual Design:** Render a dedicated inline `<EmptyState>` panel:
  - Icon: `iconType="unlinked-cable"`.
  - Title: `[NO_UNCONFIGURED_HARDWARE_FOUND]`.
  - Description: `"Network discovery sweep complete. No unconfigured CUPS print hardware detected on local subnet."`.
  - Action Slot: Render a 3D mechanical `<Button variant="ghost" onClick={openManualIpModal}>+ MANUAL IP ENTRY</Button>`.

### B. Settings Load Crash (`src/pages/admin/Settings.tsx`)
- **Condition:** If `pricingConfig` or `systemConfig` API query fails or returns `null`.
- **Visual Design:** Replace the blank `null` return with an explicit Error Panel card:
  - Outer Frame: `2px solid var(--status-error)`, `background: var(--bg-surface)`.
  - Header Tag: `[DATABASE_LINK_FAILED]`.
  - Icon: `iconType="gear-jam"`.
  - Description: `"Unable to pull pricing rules or operational flags from local SQLite config store."`.
  - Action Slot: Render a 3D mechanical `<Button variant="danger" onClick={retryFetch}>RECONNECT DATABASE</Button>`.

### C. Active Job Indicator (`src/components/user/ActiveJobIndicator.tsx` or Kiosk Tracker Page)
- **Condition:** When a user opens the Job Tracker step without an active job ID in session state.
- **Visual Design:** Render a centered receipt-style `<EmptyState>` card:
  - Icon: `iconType="empty-paper"`.
  - Title: `[NO_ACTIVE_SUBMISSION]`.
  - Description: `"No active print jobs are currently processing or queued for this session terminal."`.
  - Action Slot: Render a 3D mechanical `<Button variant="primary" onClick={() => navigate('/upload')}>SUBMIT NEW DOCUMENT</Button>`.

---

## 4. Verification Checklist
1. Verify `<EmptyState>` renders on a dark surface with cardboard dashed borders, 16-bit pixelated SVG icons, and `IBM Plex Mono` titles.
2. Trigger the Offline Interception (`isAcceptingJobs = false`): Confirm a full-screen gunmetal backdrop blocks customer access with a pulsing red LED hazard panel.
3. Test Fleet Tab Scan: Run scan with 0 devices -> Confirm `[NO_UNCONFIGURED_HARDWARE_FOUND]` card renders with a manual IP button instead of disappearing.
4. Test Settings Failure: Simulate network drop on Settings -> Confirm `[DATABASE_LINK_FAILED]` error panel renders with a mechanical Retry button.