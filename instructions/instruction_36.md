# Master Prompt: Mobile-First Kiosk & Touch UI Overhaul (@media max-width: 640px)

You are tasked with executing the **Mobile-First Touch Overhaul** for the Customer Kiosk view across the following files:
- `src/layouts/UserLayout.tsx`
- `src/components/user/ProgressBar.tsx`
- `src/pages/user/DropZone.tsx`
- `src/pages/user/ConfigConsole.tsx`
- `src/pages/user/QuoteReceipt.tsx`
- `src/pages/user/JobTracker.tsx`
- `src/components/user/ActiveJobIndicator.tsx`

Your core objective is to convert standard desktop components into an intuitive, high-grade mobile touch interface (`@media (max-width: 640px)`) that eliminates horizontal scrolling, cramped touch targets, and unreachable action buttons.

You MUST enforce all global design system tokens (`var(--bg-primary)`, `var(--bg-surface)`, `var(--bg-paper)`, `var(--border-default)`, `var(--accent-primary)`, `var(--font-mono)`, `var(--font-body)`). Maintain all React state hooks, file upload triggers, WebSocket listeners, and pricing formulas.

---

## 1. Global Viewport & Fixed Bottom Action Bar Architecture

### A. Viewport Guard & Padding
- Set `max-width: 100vw` and `overflow-x: hidden` on the root kiosk container (`.kiosk-mobile-root`).
- Replace dense desktop margins with `padding: 12px` to maximize screen real estate.
- Ensure all long strings (UUIDs, file names, driver URIs) enforce text truncation:
  `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;`

### B. Touch Target Enforcer
- All interactive controls (buttons, selection cards, step tabs, steppers, inputs) MUST enforce a strict minimum touch target of `48px x 48px`:
  `min-height: 48px; min-width: 48px; display: inline-flex; align-items: center; justify-content: center;`

### C. Fixed Bottom Sticky Action Bar (`.mobile-bottom-bar`)
For Step 1 (Upload), Step 2 (Config), and Step 3 (Quote), implement a bottom-pinned sticky action zone so the primary CTA button is always within natural thumb reach:
```css
.mobile-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  background: rgba(36, 40, 45, 0.92); /* var(--bg-surface) with opacity */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--border-default);
  z-index: 500;
  display: flex;
  gap: 12px;
}

/* Ensure body scrollable area doesn't get covered by fixed bottom bar */
.kiosk-step-content-container {
  padding-bottom: 80px; 
}

```

* The primary action button inside `.mobile-bottom-bar` must span `width: 100%`, height `48px`, utilizing the 3D mechanical button style (`box-shadow: 0 4px 0 var(--border-default)`).

---

## 2. Component-Specific Mobile Remodeling Specifications

### A. Root Framework (`src/layouts/UserLayout.tsx`)

* On screens `< 640px`, remove heavy panel side borders and outer desktop margins.
* Header Deck:
* Header height set to `48px`, layout: `display: flex; align-items: center; justify-content: space-between; padding: 0 12px;`.
* Title font size scales down to `0.9rem` (`font-family: var(--font-mono)`).
* Status cluster collapses into a compact row containing the $8\times8\text{px}$ pulsing LED diode (`@keyframes pulseLed`), the sound mute button (`soundFx.toggleMute()`), and theme switch.



### B. Punch-Card Stepper Bar (`src/components/user/ProgressBar.tsx`)

* Container: `display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 8px 12px; min-height: 48px;`.
* Active Step: `border: 2px solid var(--border-active)`, `background: var(--bg-primary)`, `color: var(--accent-primary)`, `font-weight: 700`.
* **Ultra-Narrow Breakpoint (`@media (max-width: 480px)`):**
Automatically swap text labels to 2-letter or 3-letter stenciled abbreviations so all 4 steps render cleanly without horizontal scrollbars:
* `1. UPLOAD` $\rightarrow$ `1. UP`
* `2. CONFIG` $\rightarrow$ `2. CFG`
* `3. QUOTE` $\rightarrow$ `3. QTE`
* `4. TRACKER` $\rightarrow$ `4. TRK`



### C. Step 1: Document DropZone (`src/pages/user/DropZone.tsx`)

* Convert the drag-and-drop container into a full-width **Touch-Native File Picker Target**:
* `min-height: 240px; padding: 24px 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: 2px dashed var(--border-default); background: var(--bg-surface); border-radius: 4px; cursor: pointer;`
* Active Tap Flash: Tapping anywhere inside the box triggers `border-color: var(--accent-primary)` and opens native OS file picker.


* **Attached File Display:**
* Render as a full-width **Stenciled Folder Tag Card**:
`width: 100%; padding: 12px; background: var(--bg-surface-alt); border: 1px solid var(--border-default); display: flex; align-items: center; justify-content: space-between;`
* Left side: Page count badge (`[12_PAGES]`) and truncated filename (`font-family: var(--font-mono)`, `font-size: 13px`).
* Right side: Red 3D mechanical button `[EJECT]` (`min-height: 36px`).



### D. Step 2: Configuration Console (`src/pages/user/ConfigConsole.tsx`)

* **Single Column Stack:** Force two-column split layout to stack vertically (`flex-direction: column; gap: 16px;`).
* **Collapsible Document Preview Bar:**
* Convert full preview panel into a compact top summary accordion bar:
`width: 100%; height: 44px; padding: 0 12px; background: var(--bg-paper); border: 1px solid var(--border-default); display: flex; align-items: center; justify-content: space-between; font-family: var(--font-mono); font-size: 12px;`
* Left: `📄 DOCUMENT_PREVIEW (12 PAGES)`.
* Right: `[TAP TO INSPECT]`. Tapping opens a full-screen modal preview overlay.


* **Form Controls:**
* **Copies Stepper:**
`display: grid; grid-template-columns: 56px 1fr 56px; height: 48px; border: 1px solid var(--border-default); background: var(--bg-surface);`
* Stepper buttons `(-)` and `(+)` fill the `56px x 48px` end blocks with `font-size: 20px` and `font-weight: 700`.
* Center count displays oversized monospace digits (`font-size: 18px`, centered).


* **Color Mode Selector:**
`display: grid; grid-template-columns: 1fr 1fr; gap: 8px;`
* Each color option renders as a `48px` tall pressable plate with bold `IBM Plex Mono` labels (`MONOCHROME` vs `FULL COLOR`).


* **Duplex Checkbox:** Render as a full-width `48px` tall row with an enlarged `20px x 20px` square DIP switch.



### E. Step 3: Tractor-Feed Quote Receipt (`src/pages/user/QuoteReceipt.tsx`)

* Receipt Card: `width: 100%; margin: 0 auto; background: var(--bg-paper); border: 1px solid var(--border-default); box-shadow: var(--shadow-paper);`
* Top Serrated Tear Line: Retain zig-zag tear-line pseudo-element and tractor-feed side holes.
* Itemized Pricing Rows: `display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed var(--border-default); font-family: var(--font-mono); font-size: 13px;`
* Sticky Bottom Action Bar Integration:
* Display the total price directly inside the bottom mechanical button:
`<Button className="mobile-bottom-bar-btn">[ CONFIRM & PRINT TICKET — ₹15.00 ]</Button>`



### F. Step 4: Real-Time Job Tracker (`src/pages/user/JobTracker.tsx`)

* **Vertical Factory Assembly Line:** Convert horizontal status step dots into a vertical pipeline:
```
.vertical-pipeline-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
}
.pipeline-step {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 13px;
}

```


* `[🟢] 1. SPOOLING COMPLETED`
* `[🟠] 2. RASTERIZING PAGES...` (Active step with pulsing orange LED)
* `[⚪] 3. PRINTING IN PROGRESS`
* `[⚪] 4. DISPATCHED TO TRAY`


* Monospace metadata card displays UUID and queue position in stacked full-width rows with ellipsis truncation.

### G. Floating Ticker Pill (`src/components/user/ActiveJobIndicator.tsx`)

* On screens `< 640px`, transform floating pill into a full-width bottom status bar:
`position: fixed; bottom: 12px; left: 12px; right: 12px; height: 48px; background: rgba(36, 40, 45, 0.95); backdrop-filter: blur(8px); border: 1px solid var(--accent-primary); border-radius: 4px; z-index: 450; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font-family: var(--font-mono); font-size: 12px;`

---

## 3. Mobile Overhaul Verification Checklist

1. Viewport Overflow Check: Open mobile inspect tool at `360px` width. Confirm zero horizontal scrollbars or clipping.
2. Touch Target Audit: Verify every button, step tab, stepper, and selection plate enforces at least `48px` touch height.
3. Bottom Action Bar Check: Navigate through Steps 1, 2, and 3 on mobile -> Confirm the primary action button remains pinned to the bottom of the screen with a blurred backdrop.
4. Tracker Pipeline Check: View Step 4 on mobile -> Confirm the status pipeline renders as a vertical factory assembly line.