# Customer Kiosk UI Architecture & Visual Specification Report

---

## 1. Executive Summary & Design System Alignment

The **Customer Kiosk Interface** is designed as a self-service terminal for hardware print automation. Following the Phase 2 & Batch 1–5 UI Overhaul, **100% of Customer Kiosk UI elements** have been fully remodeled using the **Industrial Automation & Mechanical Printshop** design system.

Key visual attributes include:
- **Palette & Tokens:** Pure token-driven styling (`var(--bg-primary)`, `var(--bg-surface)`, `var(--bg-paper)`, `var(--accent-primary)`, `var(--border-default)`).
- **Typography:** `IBM Plex Mono` for technical headers, stenciled tags, and pricing readouts; `Space Grotesk` for body copy and interactive labels.
- **Mobile First Accessibility:** Enforces minimum $44\times44\text{px}$ touch targets across all mobile breakpoints (`@media (max-width: 640px)`).

---

## 2. Customer UI Component Inventory & Remodeling Audit

```
+-----------------------------------------------------------------------------------+
|  PRINT_AUTOMATION [KIOSK_v2]                                     [ONLINE BADGE]   |
|===================================================================================|
|  [ 1. UPLOAD ] =======> [ 2. CONFIG ] =======> [ 3. QUOTE ] =======> [ 4. TRACKER ] |
|-----------------------------------------------------------------------------------|
|                                                                                   |
|                   +------------------------------------------+                    |
|                   |           INITIALIZE JOB PAYLOAD         |                    |
|                   |                                          |                    |
|                   |  [====================================]  |                    |
|                   |  |  ( 16-Bit Pixel Printer Hatch )    |  |                    |
|                   |  [====================================]  |                    |
|                   |                                          |                    |
|                   |    Drag & drop document or tap to browse |                    |
|                   |    [PDF]   [DOCX]   [IMAGES]             |                    |
|                   +------------------------------------------+                    |
|                                                                                   |
|                                                     +---------------------------+ |
|                                                     | (•) ACTIVE: Printing...   | |
|                                                     +---------------------------+ |
+-----------------------------------------------------------------------------------+
```

---

### Component 1: Kiosk Root Layout (`src/layouts/UserLayout.tsx`)
- **Remodeled Status:** **YES (100% Remodeled)**
- **Desktop Appearance:**
  - Centered $1024\text{px}$ maximum-width container mounted on `var(--bg-primary)` (`#1A1D20` dark / `#F4F1EA` light).
  - Header: Displays stenciled title `PRINT_AUTOMATION [KIOSK_v2]` in bold monospace font with an adjacent live WebSocket connection badge (`badge-idle` or `badge-error`).
- **Mobile Screen Appearance (`< 640px`):**
  - Stacks vertically and expands to 100% viewport width with `padding: 16px 12px`.
  - Header font size scales down from `1.5rem` to `1.2rem` to prevent line wrapping on narrow screens.

---

### Component 2: 4-Step Punch-Card Stepper (`src/components/user/ProgressBar.tsx`)
- **Remodeled Status:** **YES (100% Remodeled)**
- **Desktop Appearance:**
  - Horizontal tab strip displaying 4 punch-card step triggers: `1. UPLOAD`, `2. CONFIG`, `3. QUOTE`, `4. TRACKER`.
  - **Active Step:** Highlighted with `2px solid var(--border-active)` (`#FF5500`) and filled with `var(--bg-primary)`.
  - **Completed Past Steps:** Safety Orange border (`2px solid var(--accent-primary)`) with glowing background tint (`var(--accent-glow)`).
  - **Future Steps:** Muted border (`var(--border-default)`) with `var(--bg-surface-alt)` cardstock fill.
- **Mobile Screen Appearance (`< 640px`):**
  - Enforces minimum $44\text{px}$ height touch targets (`min-height: 44px`).
  - On ultra-narrow screens (`< 480px`), text labels abbreviate automatically (`UPLOAD` $\rightarrow$ `UP`, `CONFIG` $\rightarrow$ `CFG`, `QUOTE` $\rightarrow$ `QTE`, `TRACKER` $\rightarrow$ `TRK`) to fit 4 buttons side-by-side without horizontal scrolling.

---

### Component 3: Step 1 — Document Upload Dropzone (`src/pages/user/DropZone.tsx`)
- **Remodeled Status:** **YES (100% Remodeled - Refactored in Batches 1 & 5)**
- **Desktop Appearance:**
  - Large equipment hatch container (`.dropzone-area`) with a `3px dashed var(--border-default)` frame.
  - Hovering over the zone illuminates the border in Safety Orange and activates an inner glow (`box-shadow: inset 0 0 40px var(--accent-glow)`).
  - Features a centered $64\times64\text{px}$ 16-bit retro SVG printer hatch illustration, stenciled title `[INITIALIZE_JOB_PAYLOAD]`, and file type pill badges (`[PDF]`, `[DOCX]`, `[IMAGES]`).
- **Mobile Screen Appearance (`< 640px`):**
  - Minimum height set to `300px` with `padding: 2rem 1rem`.
  - Converts drag-and-drop into a 100% width touch-to-browse trigger (`onClick` fires native OS file picker).

---

### Component 4: Step 2 — Interactive Configuration Console (`src/pages/user/ConfigConsole.tsx`)
- **Remodeled Status:** **YES (100% Remodeled - Refactored in Batches 1, 2 & 4)**
- **Desktop Appearance:**
  - Two-column split layout (`.config-split`).
  - **Left Column:** Live document preview card displaying thumbnail page frames, total page count badge, and page navigation controls.
  - **Right Column:** Heavy panel card (`.config-settings-card`) wrapped in `2px solid var(--accent-primary)` with depth shadow (`box-shadow: 0 8px 32px var(--accent-glow)`). Houses copies increment/decrement stepper, Color vs. Grayscale selection cards, and Duplex DIP-switch checkbox (`<Checkbox>`).
- **Mobile Screen Appearance (`< 640px`):**
  - The two-column layout switches to a single-column vertical stack (`flex-direction: column`).
  - Document preview card stacks above the settings card.
  - Copies steppers and selection buttons stretch to fill 100% card width with 44px minimum touch targets.

---

### Component 5: Step 3 — Stenciled Punch-Card Quote Receipt (`src/pages/user/QuoteReceipt.tsx`)
- **Remodeled Status:** **YES (100% Remodeled - Refactored in Batches 1, 2 & 4)**
- **Desktop Appearance:**
  - Centered $450\text{px}$ wide receipt sheet (`.receipt-card`) rendered on `--bg-paper` fresh cardstock fill.
  - Top serrated scissor tear-line accent, stenciled header (`[OFFICIAL_QUOTE_SLIP]`), itemized cost rows (`Pages`, `Color Mode`, `Duplex Discount`), total cost in bold monospace (`₹`), and a 3D mechanical button (`GENERATE JOB TICKET`).
- **Mobile Screen Appearance (`< 640px`):**
  - Receipt card scales down smoothly to `max-width: 100%`.
  - Action button container (`.receipt-actions`) switches to a vertical column (`flex-direction: column`), expanding `BACK` and `GENERATE TICKET` buttons to 100% width.

---

### Component 6: Step 4 — Real-Time Job Status Tracker (`src/pages/user/JobTracker.tsx`)
- **Remodeled Status:** **YES (100% Remodeled - Refactored in Batches 1, 3, 4 & 5)**
- **Desktop Appearance:**
  - Stenciled status card featuring pulsing LED diodes, live status badges (`QUEUED`, `SPOOLING`, `PRINTING`, `DONE`, `FAILED`), queue position indicator (`X jobs ahead`), and document metadata tags.
  - If no active job exists in the session, displays the new Batch 5 `<EmptyState iconType="empty-paper" title="[NO_ACTIVE_SUBMISSION]">`.
- **Mobile Screen Appearance (`< 640px`):**
  - Job metadata rows switch from horizontal rows to vertical columns (`.tracker-meta-row` $\rightarrow$ `flex-direction: column`).
  - Long document filenames and UUIDs truncate safely with ellipsis (`text-overflow: ellipsis`).

---

### Component 7: Floating Active Job Ticker Pill (`src/components/user/ActiveJobIndicator.tsx`)
- **Remodeled Status:** **YES (100% Remodeled - Refactored in Batch 1)**
- **Desktop Appearance:**
  - Floating pill fixed to the bottom-right corner (`position: fixed`, `bottom: 24px`, `right: 24px`, `z-index: 500`).
  - Machined surface fill (`var(--bg-surface)`), Safety Orange border, pulsing green LED dot, real-time status text, and click-to-navigate action.
- **Mobile Screen Appearance (`< 640px`):**
  - Transforms into a full-width bottom bar (`left: 12px`, `right: 12px`, `bottom: 12px`) with `backdrop-filter: blur(8px)` and 44px minimum touch height.

---

### Component 8: Customer System Offline Interception (`src/components/user/SystemOfflineOverlay.tsx`)
- **Remodeled Status:** **YES (100% Remodeled & Extracted in Batch 5)**
- **Desktop Appearance:**
  - Full-screen backdrop overlay (`position: fixed`, `inset: 0`, `z-index: 9999`) with $20\times20\text{px}$ crosshatch grid lines.
  - Centered $500\text{px}$ industrial hazard panel (`2px solid var(--status-error)`), pulsing red LED hazard diode, `[SYSTEM_OFFLINE]` monospace heading, and `STATUS: NO_HARDWARE_TARGETS_AVAILABLE` badge.
- **Mobile Screen Appearance (`< 640px`):**
  - Panel width scales down to `width: 90%` with `padding: 32px 20px`.
  - Title font size scales down from `20px` to `16px` while maintaining 100% backdrop coverage.

---

### Component 9: Wi-Fi Provisioning Modal (`src/components/user/WifiSetup.tsx`)
- **Remodeled Status:** **YES (100% Remodeled - Refactored in Batch 2)**
- **Desktop Appearance:**
  - Embedded inside custom `<Modal>`, displays SSID signal strength bars, security badges (`WPA2`, `OPEN`), terminal password entry, and a 3D mechanical `CONNECT DEVICE` button.
- **Mobile Screen Appearance (`< 640px`):**
  - Available networks list constrains height to `220px` with vertical touch scrolling. Action buttons expand to 100% width.

---

## 3. Remodeling Verification Summary Table

| Kiosk Component | Remodeled? | Key Design Features | Mobile Behavior (`< 640px`) |
| :--- | :---: | :--- | :--- |
| **`UserLayout`** | **YES** | Monospace logo header, live WS badge | Stacks vertically, padding: 16px |
| **`ProgressBar`** | **YES** | 4-step punch-card tab bar | Abbreviates text (`UP`, `CFG`), 44px touch height |
| **`DropZone`** | **YES** | 16-bit SVG hatch, dashed border | Touch-to-browse trigger, 300px min-height |
| **`ConfigConsole`** | **YES** | 2-column preview/settings split, DIP switches | Single column stack, 100% width buttons |
| **`QuoteReceipt`** | **YES** | Serrated paper slip, itemized rows | Max-width 100%, stacked action buttons |
| **`JobTracker`** | **YES** | Pulsing LED status, queue position tag | Vertical metadata rows, safe text truncation |
| **`ActiveJobIndicator`** | **YES** | Floating ticker pill, pulsing LED | Full-width bottom bar with blur backdrop |
| **`SystemOfflineOverlay`** | **YES** | Gunmetal grid backdrop, pulsing hazard LED | 90% width panel, 100% backdrop coverage |
| **`WifiSetup`** | **YES** | Signal strength meters, WPA2 badges | 220px scrollable network list, 100% width buttons |
