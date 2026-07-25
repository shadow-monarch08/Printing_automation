# Batch 2 Component Refactor: ValidatedInput, DateRangePicker, and Modal

You are tasked with executing **Batch 2 of Phase 2** of the UI overhaul. 
Refactor `ValidatedInput.tsx`, `DateRangePicker.tsx`, and `Modal.tsx` to match the exact **Industrial Automation & Mechanical Printshop** aesthetic specified below. 

You MUST preserve all existing React props, state hooks, validation logic, date calculations, keyboard trap listeners, and backdrop handlers.

Import `soundFx` from `src/utils/sound` (or your sound utility path) for click events.

---

## Component 4: `ValidatedInput.tsx` (`src/components/shared/ValidatedInput.tsx`)

### Visual Blueprint: Digital Terminal Gauge / Readout
- **Container Layout:** Vertical stack with `gap: 6px`.
- **Label Tag (`.stamped-label`):**
  - Font: `font-family: var(--font-mono)` (`IBM Plex Mono`), uppercase, `font-weight: 600`, `font-size: 11px`, `letter-spacing: 0.08em`.
  - Color: `var(--text-secondary)` (`#9098A2` in dark / `#626A72` in light).
  - Prefix Accent: Prepend a small dim character or square before the text label (e.g., `▪ LABEL_NAME`).
- **Input Field Box (`.terminal-input`):**
  - Background: `var(--bg-surface)` (`#24282D` dark / `#EBE6DC` light).
  - Border: `1px solid var(--border-default)` (`#3A4047` dark / `#D2CBBE` light) with sharp `2px` corners (`border-radius: 2px`).
  - Text Entry: `font-family: var(--font-mono)`, `font-size: 14px`, `color: var(--text-primary)`.
  - Placeholder: `color: var(--text-secondary)`, opacity `0.5`.
  - Focus State: Border switches to `1px solid var(--border-active)` (`#FF5500` dark / `#D03B00` light) with an outer glow `box-shadow: 0 0 0 3px var(--accent-glow)`.
- **Password Eye Toggle Button:**
  - Styled as an embedded square icon button on the far right edge of the input box.
  - Hover: background turns `var(--bg-surface-hover)`.
  - Click: Triggers `soundFx.playClick()`.
- **Validation Error State:**
  - Field border switches to `1px solid var(--status-error)` (`#FF4444` / `#DC2626`).
  - Error Message: Renders below the input field with `font-family: var(--font-mono)`, `font-size: 11px`, color `var(--status-error)`. Include a small warning indicator prefix (e.g., `[!] Invalid Entry`).

---

## Component 5: `DateRangePicker.tsx` (`src/components/shared/DateRangePicker.tsx`)

### Visual Blueprint: Punch-Card Calendar Matrix
- **Preset Bar (`.preset-tab-bar`):**
  - Render quick presets ("Today", "Last 7 Days", "Last 30 Days", "Custom") as a horizontal segmented control bar.
  - Button Tabs: `font-family: var(--font-mono)`, `font-size: 12px`, uppercase, `padding: 6px 12px`, `border: 1px solid var(--border-default)`, `border-radius: 2px`.
  - Active Tab: `background: var(--accent-primary)` (`#FF5500` dark / `#D03B00` light), color `#FFFFFF` (or `var(--bg-primary)`), `font-weight: 700`.
  - Audio: Call `soundFx.playClick()` on tab clicks.
- **Calendar Panel Overlay (`.punchcard-calendar`):**
  - Background: `var(--bg-surface)`, `border: 2px solid var(--border-default)`, `box-shadow: var(--shadow-paper)` (`0 12px 24px -6px rgba(0,0,0,0.5)`).
  - Corner Detail: Add a 2px inset border or dark steel header bar to simulate a physical punch-card holder.
- **Calendar Grid & Header:**
  - Header Month/Year & Navigation Arrows: `font-family: var(--font-mono)`, uppercase, bold. Arrows play `soundFx.playClick()`.
  - Weekday Labels (`S M T W T F S`): `font-family: var(--font-mono)`, `font-size: 11px`, `color: var(--text-secondary)`, `text-align: center`, `padding-bottom: 8px`.
- **Day Cells (`.calendar-day-cell`):**
  - Font: `font-family: var(--font-mono)`, `font-size: 13px`.
  - Unselected Days: `background: transparent`, `border-radius: 2px`. Hover state: `background: var(--bg-surface-hover)`.
  - Selected Start & End Days: Square fill in solid `var(--accent-primary)`, text color `#FFFFFF` or `var(--bg-primary)`, `font-weight: 700`, `box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2)`.
  - Days In-Between Range: `background: var(--accent-glow)` (translucent orange band), `color: var(--text-primary)`, `border-radius: 0`.

---

## Component 6: `Modal.tsx` (`src/components/shared/Modal.tsx`)

### Visual Blueprint: Heavy Equipment Control Panel
- **Backdrop Sheet:**
  - `background: rgba(10, 12, 14, 0.82)` with `backdrop-filter: blur(4px)`.
- **Panel Container Shell (`.industrial-modal-panel`):**
  - Background: `var(--bg-surface)` (`#24282D` dark / `#EBE6DC` light).
  - Outer Frame: `2px solid var(--border-default)` (`#3A4047` dark / `#D2CBBE` light), `border-radius: 4px`.
  - Drop Shadow: Heavy industrial depth `box-shadow: 0 24px 60px rgba(0, 0, 0, 0.75), 0 0 0 1px var(--border-default)`.
- **Header Strip (`.modal-panel-header`):**
  - Background: `var(--bg-primary)` (`#1A1D20` dark / `#F4F1EA` light).
  - Border Bottom: `2px solid var(--border-default)`.
  - Layout: `display: flex`, `align-items: center`, `justify-content: space-between`, `padding: 12px 16px`.
  - Title Text: `font-family: var(--font-mono)`, `font-size: 14px`, `font-weight: 700`, uppercase, `letter-spacing: 0.05em`, color `var(--text-primary)`. Prepend an industrial plate tag symbol (e.g., `[SYS_PANEL]`).
  - Close Cross Button (`X`): Square `28px x 28px` button, `border: 1px solid var(--border-default)`, `background: var(--bg-surface)`. On hover: `border-color: var(--status-error)`, `color: var(--status-error)`. Plays `soundFx.playClick()` on click.
- **Body & Footer:**
  - Body Container: `padding: 20px 16px`, scrollable with custom slim scrollbar.
  - Footer Action Bar: `padding: 12px 16px`, `border-top: 1px solid var(--border-default)`, `background: var(--bg-surface-alt)`, `display: flex`, `justify-content: flex-end`, `gap: 12px`.
  - Actions: Ensure footer buttons pass through the newly refactored 3D mechanical `Button` components (`Cancel` ghost variant + `Execute` 3D mechanical variant).

---

## Batch 2 Verification Checklist
1. Focus `ValidatedInput`: Verify the top label uses uppercase `IBM Plex Mono` with a `▪` prefix tag, and field focus emits an orange ring.
2. Open `DateRangePicker`: Verify presets render as tab buttons, and range dates render in solid Safety Orange with transclucent range bands.
3. Open `Modal`: Confirm it renders with a dark gunmetal header strip (`[SYS_PANEL]`), `IBM Plex Mono` titles, a square close button, and heavy panel shadows.