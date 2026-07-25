# Master Prompt: Customer Kiosk Terminal & Responsive Mobile Overhaul

You are tasked with executing the complete overhaul of the **Customer Kiosk Interface** (`src/layouts/UserLayout.tsx`, `ProgressBar.tsx`, `DropZone.tsx`, `ConfigConsole.tsx`, `QuoteReceipt.tsx`, `JobTracker.tsx`, `ActiveJobIndicator.tsx`, and `SystemOfflineOverlay.tsx`).

Your goal is to transform the customer experience into an **Interactive Master Control Console** on desktop/tablet views and a **Touch-First Tactile Kiosk** on mobile screens (`< 640px`).

You MUST enforce all global theme tokens (`var(--bg-primary)`, `var(--bg-surface)`, `var(--bg-paper)`, `var(--border-default)`, `var(--border-active)`, `var(--accent-primary)`, `var(--font-mono)`, `var(--font-body)`). Preserve all internal React hooks, file drop handlers, WebSocket state listeners, and quote calculation formulas.

---

## 1. Kiosk Root Layout & Framework (`src/layouts/UserLayout.tsx`)

### Desktop Layout Architecture (`>= 640px`):
- **Console Frame:** Wrap the layout in a $1024\text{px}$ maximum-width container styled as a **Heavy Machinery Panel** (`background: var(--bg-primary)`, `border: 2px solid var(--border-default)`, `border-radius: var(--radius-md)`, `box-shadow: var(--shadow-paper)`).
- **Header Control Deck:**
  - **Left Title:** Render stenciled title `PRINT_AUTOMATION // KIOSK_TERMINAL_01` in uppercase `IBM Plex Mono` (`font-size: 1.1rem`, `font-weight: 700`).
  - **Right Status Cluster:** Render a live WebSocket badge with a $8\times8\text{px}$ pulsing LED dot (`@keyframes pulseLed`), an inline audio mute switch toggle button (`soundFx.toggleMute()`), and theme switcher.
- **Bottom Status Ticker:** Render a subtle bottom ticker bar displaying real-time hardware status: `SYSTEM: ONLINE | PAPER: READY | CMYK: ACTIVE`.

### Mobile Responsive Adaptations (`< 640px`):
- Expand layout to `width: 100%`, remove outer panel borders, and apply `padding: 12px 8px`.
- Header font size scales down to `0.95rem` to prevent text wrapping.
- Bottom status ticker collapses cleanly into a single line at the very bottom of the screen.

---

## 2. 4-Step Punch-Card Stepper (`src/components/user/ProgressBar.tsx`)

### Visual Blueprint:
- **Desktop (`>= 640px`):** Horizontal row of 4 punch-card step tabs: `1. UPLOAD`, `2. CONFIG`, `3. QUOTE`, `4. TRACKER`.
  - **Active Step:** `border: 2px solid var(--border-active)` (`#FF5500`), filled with `var(--bg-primary)`, bold `var(--font-mono)` typography.
  - **Past Completed Steps:** `border: 2px solid var(--accent-primary)` with translucent background tint (`var(--accent-glow)`).
  - **Future Steps:** `border: 1px solid var(--border-default)` with `var(--bg-surface-alt)` cardstock fill.

### Mobile Responsive Adaptations (`< 640px`):
- Ensure step tabs enforce a minimum touch height of $44\text{px}$ (`min-height: 44px`).
- **Ultra-Narrow Breakpoint (`< 480px`):** Abbreviate step labels automatically (`1. UPLOAD` $\rightarrow$ `1. UP`, `2. CONFIG` $\rightarrow$ `2. CFG`, `3. QUOTE` $\rightarrow$ `3. QTE`, `4. TRACKER` $\rightarrow$ `4. TRK`) so all 4 buttons fit side-by-side without horizontal scrollbars.

---

## 3. Step 1: Hatch Opening Dropzone (`src/pages/user/DropZone.tsx`)

### Visual Blueprint:
- **Card Container (`.dropzone-area`):**
  - Outer Box: `background: var(--bg-surface)`, `border: 3px dashed var(--border-default)`, `border-radius: var(--radius-md)`, `padding: 48px 24px`, `text-align: center`.
  - Hover / Drag-Over State: Frame turns `3px solid var(--accent-primary)`, activating an inner orange laser-glow (`box-shadow: inset 0 0 32px var(--accent-glow)`).
- **Content Elements:**
  - Centered $64\times64\text{px}$ 16-bit retro pixel-art SVG printer hatch graphic (`iconType="printer-hatch"`).
  - Stenciled Header: `[INITIALIZE_JOB_PAYLOAD]` in uppercase `IBM Plex Mono`.
  - Secondary Copy: `"Drag & drop document or tap to browse local storage"` in `Space Grotesk`.
  - Supported Format Badges: Pill badges for `[PDF]`, `[DOCX]`, `[IMAGES]`.
- **Loaded File State:** When a file is attached, transform the container into a **Physical Folder Tag Card** displaying filename, file size, page count badge, and a 3D mechanical `[EJECT_FILE]` button.

### Mobile Responsive Adaptations (`< 640px`):
- Minimum container height set to `280px` with `padding: 24px 16px`.
- Drag-and-drop converts seamlessly into a full-width $44\text{px}$ touch-to-browse button trigger.

---

## 4. Step 2: Configuration Console (`src/pages/user/ConfigConsole.tsx`)

### Visual Blueprint:
- **Desktop Layout (`>= 640px`):** Two-column split container (`.config-split`).
  - **Left Column (Live Paper Preview):** Displays document page inside a physical **Paper Sheet Frame** (`background: var(--bg-paper)`). Features top perforated tear-off line and bottom curved drop-shadow (`box-shadow: var(--shadow-paper)`). Includes page navigation arrows and total page badge.
  - **Right Column (Machined Control Panel):** Panel card (`.card`) wrapped in `2px solid var(--border-default)` housing:
    1. **Copies Stepper:** Industrial `(-)` / `(+)` mechanical stepper with an oversized monospace count display (`font-family: var(--font-mono)`).
    2. **Color Mode Toggle:** Beveled switch cards for `MONOCHROME [BLACK_INK]` vs `COLOR [CMYK_OFFSET]`.
    3. **Duplex Option:** DIP-switch square checkbox (`<Checkbox>`) for double-sided print discount.

### Mobile Responsive Adaptations (`< 640px`):
- Two-column split layout collapses into a single vertical column (`flex-direction: column`).
- Document preview card sits above settings panel card.
- Steppers, color selection cards, and action buttons stretch to 100% width with $44\text{px}$ minimum touch height.

---

## 5. Step 3: Tractor-Feed Quote Receipt (`src/pages/user/QuoteReceipt.tsx`)

### Visual Blueprint:
- **Receipt Sheet (`.receipt-card`):**
  - Centered $450\text{px}$ wide card rendered on `--bg-paper` fresh cardstock fill.
  - Top Serrated Tear Line: Zig-zag serrated border pseudo-element (`.tear-line`) with left/right tractor-feed side hole accents.
  - Stenciled Title: `[OFFICIAL_QUOTE_SLIP]` in uppercase `IBM Plex Mono`.
  - Itemized Cost Table: Monospace table showing page count calculation, color tier, duplex discount, and total price (`₹` / `$`) in bold `24px` `IBM Plex Mono`.
- **Submit Action:** Oversized 3D Mechanical Button (`GENERATE JOB TICKET`). On click, depresses by $3\text{px}$ and plays a synthesized switch click sound.

### Mobile Responsive Adaptations (`< 640px`):
- Receipt sheet width scales down smoothly to `max-width: 100%`.
- Footer action button bar switches to a full-width vertical stack (`BACK` button on top of `GENERATE TICKET` button).

---

## 6. Step 4: Real-Time Job Tracker (`src/pages/user/JobTracker.tsx`)

### Visual Blueprint:
- **Pipeline Status Matrix:** Render a 4-stage processing pipeline:
  `[1. SPOOLING]` $\rightarrow$ `[2. RASTERIZING]` $\rightarrow$ `[3. PRINTING]` $\rightarrow$ `[4. COMPLETED]`.
- **Status Panel:**
  - Displays a $8\times8\text{px}$ pulsing LED dot (Orange during spooling/printing, Green when complete, Flashing Red on failure).
  - Stenciled UUID badge (`.data-mono`), live queue position tag (`JOBS_AHEAD: 0`), and page count telemetry.
- **Fallback Empty State:** If session has no active job ID, render Batch 5 `<EmptyState iconType="empty-paper" title="[NO_ACTIVE_SUBMISSION]">`[cite: 13].

### Mobile Responsive Adaptations (`< 640px`):
- Pipeline stage tags stack into 2-column or 1-column rows.
- Document metadata rows switch from horizontal side-by-side rows to vertical columns with text truncation (`text-overflow: ellipsis`).

---

## 7. Floating Ticker Pill (`src/components/user/ActiveJobIndicator.tsx`)

### Visual Blueprint:
- **Desktop (`>= 640px`):** Floating pill fixed to bottom-right viewport (`bottom: 24px`, `right: 24px`). Machined surface fill (`var(--bg-surface)`), Safety Orange border, pulsing green LED dot, live progress text, and click-to-navigate action.
- **Mobile Responsive Adaptations (`< 640px`):**
  - Transforms into a full-width bottom bar anchored to `left: 12px`, `right: 12px`, `bottom: 12px`.
  - Includes frosted glass blur (`backdrop-filter: blur(8px)`), $44\text{px}$ touch height, and bold monospace status text.

---

## Verification Checklist
1. Desktop Console Test: Verify kiosk renders inside a $1024\text{px}$ panel frame with live header LEDs, sound mute switch, and bottom status ticker.
2. Mobile Responsiveness Test (`< 640px`): Confirm step labels abbreviate (`1. UP`, `2. CFG`), configuration console switches to 1-column stack, and all touch targets enforce $44\text{px}$ minimum height.
3. Step 1 Dropzone: Confirm hover activates orange laser scan line and loaded files display page count folder badges.
4. Step 3 Quote Receipt: Confirm receipt sheet renders on `--bg-paper` cardstock with serrated tear-line accents and monospace itemized pricing.