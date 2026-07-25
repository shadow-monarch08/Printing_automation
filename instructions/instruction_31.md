# Batch 3 Component Refactor: ToastStack, Loading Components, EmptyState, and PaperTable

You are tasked with executing **Batch 3 of Phase 2** of the UI overhaul.
Refactor `ToastStack.tsx`, `LoadingNet.tsx` / `LoadingScreen.tsx`, `EmptyState.tsx`, and create `PaperTable.tsx` to match the exact **Industrial Automation & Mechanical Printshop** aesthetic specified below.

You MUST preserve all existing React props, state hooks, timers, auto-dismiss logic, and rendering children.

Import `soundFx` from `src/utils/sound` (or your sound utility path) where audio triggers are required.

---

## Component 7: `ToastStack.tsx` (`src/components/shared/ToastStack.tsx`)

### Visual Blueprint: Dot-Matrix Error Printout Strip
- **Stack Positioning:** Fixed bottom-right anchor (`bottom: 24px`, `right: 24px`), vertical stack with `gap: 12px`, `z-index: 9999`.
- **Toast Card Shell (`.dotmatrix-toast`):**
  - Dimensions: `width: 360px`, `max-width: calc(100vw - 32px)`.
  - Background: `var(--bg-surface)` (`#24282D` dark / `#EBE6DC` light).
  - Border: `1px solid var(--border-default)` (`#3A4047` dark / `#D2CBBE` light) with `border-radius: 2px`.
  - Left Perforated Accent Bar: `border-left: 6px dashed var(--toast-accent-color)`.
    - **Success:** `--toast-accent-color: var(--status-idle)` (`#00FF88` / `#16A34A`).
    - **Error:** `--toast-accent-color: var(--status-error)` (`#FF4444` / `#DC2626`).
    - **Warning:** `--toast-accent-color: var(--status-busy)` (`#FFAA00` / `#D97706`).
    - **Info:** `--toast-accent-color: var(--accent-secondary)` (`#00A396` / `#00665E`).
  - Drop Shadow: Heavy industrial shadow `box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4)`.
- **Content Layout:**
  - Header Tag: Prepend a small monospace tag matching the toast type: `[OK_STATUS]`, `[SYS_ERROR]`, `[WARN_ALERT]`, or `[INFO_LOG]`.
  - Text Message: `font-family: var(--font-mono)` (`IBM Plex Mono`), `font-size: 12px`, `line-height: 1.4`, color `var(--text-primary)`.
  - Pixelated Status LED Dot: A square `8px x 8px` pixel indicator pulsing next to the status title.
- **Progress Countdown Bar:**
  - Hairline `2px` progress bar along the bottom edge, animated from `width: 100%` to `0%` over the toast duration using `background: var(--toast-accent-color)`.

---

## Component 8: `LoadingNet.tsx` & `LoadingScreen.tsx` (`src/components/shared/`)

### Visual Blueprint: Retro Dot-Matrix Printhead Animation
- **Graphic Animation (`LoadingNet.tsx`):**
  - Replace generic spinning circles with a custom inline SVG / CSS animation representing a **dot-matrix printhead traversing continuous paper**.
  - Visual Elements:
    1. A dark rectangular paper sheet box (`width: 120px`, `height: 80px`, `background: var(--bg-paper)`, `border: 1px solid var(--border-default)`).
    2. A moving horizontal printhead bar (`width: 100%`, `height: 2px`, `background: var(--accent-primary)`) animating up and down (`keyframes printScan`).
    3. Dashed tractor-feed hole guides along the left and right edges of the paper box.
- **Status Readout Label:**
  - Render the loading message string directly below in `font-family: var(--font-mono)`, `font-size: 13px`, uppercase, `letter-spacing: 0.08em`, color `var(--accent-primary)`.
  - Example: `▪ PROCESSING_PRINT_JOB...`
- **Full Viewport Overlay (`LoadingScreen.tsx`):**
  - Opaque sheet background: `background: var(--bg-primary)` (`#1A1D20` dark / `#F4F1EA` light), `z-index: 999`.
  - Perfectly centers the refactored `<LoadingNet />` component.

---

## Component 9: `EmptyState.tsx` (`src/components/shared/EmptyState.tsx`)

### Visual Blueprint: Cardboard / Open Hatch Paper Container
- **Container Box (`.empty-tray-container`):**
  - Layout: Centered column, `padding: 40px 24px`, `margin: 24px 0`.
  - Background: `var(--bg-surface)` (`#24282D` dark / `#EBE6DC` light).
  - Border: `2px dashed var(--border-default)` (`#3A4047` dark / `#D2CBBE` light), `border-radius: 4px`.
- **Pixel Art Graphic Badge:**
  - Render a retro pixel-art SVG illustration in the center representing an **Empty Paper Tray / Open Printer Hatch**.
  - Style: Sharp stroke pixels using `var(--text-secondary)` and `var(--accent-primary)` accents.
- **Typography:**
  - Title: `font-family: var(--font-mono)`, `font-size: 16px`, `font-weight: 700`, uppercase, `letter-spacing: 0.05em`, color `var(--text-primary)`.
  - Description Copy: `font-family: var(--font-body)`, `font-size: 13px`, color `var(--text-secondary)`, `max-width: 360px`, `margin-top: 8px`.
- **Action CTA:**
  - If action buttons or children are passed, ensure they wrap inside the 3D mechanical `Button` component.

---

## Component 10: `PaperTable.tsx` (`src/components/shared/PaperTable.tsx`)

### Target File (Create/Refactor): `src/components/shared/PaperTable.tsx`

Create a reusable layout container wrapper for HTML tables across the application that converts standard tables into physical tractor-feed paper sheets[cite: 8].

```tsx
import React from 'react';

export interface PaperTableProps {
  children: React.ReactNode;
  className?: string;
}

export const PaperTable: React.FC<PaperTableProps> = ({ children, className = '' }) => {
  return (
    <div className={`paper-sheet-container relative bg-[var(--bg-paper)] text-[var(--text-primary)] shadow-[var(--shadow-paper)] border-t-2 border-dashed border-[var(--border-default)] rounded-b-sm my-6 overflow-hidden ${className}`}>
      {/* Tractor Feed Left & Right Perforation Hole Accents */}
      <div className="absolute top-0 left-0 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] pointer-events-none" />
      <div className="absolute top-0 right-0 w-3 h-3 translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] pointer-events-none" />
      
      {/* Scrollable Table Area */}
      <div className="overflow-x-auto p-4">
        {children}
      </div>
      
      {/* Bottom Subtle Paper Curl Drop-Shadow Accent */}
      <div className="h-1 bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.05)] pointer-events-none" />
    </div>
  );
};

```
**Note: Styles are defined in tailwind, as we are not using it, reseprocate the same style in vanilla CSS.**

Ensure table elements rendered inside `PaperTable` adhere to these styles:

* `th`: `font-family: var(--font-mono)`, uppercase, `font-size: 11px`, `letter-spacing: 0.05em`, `color: var(--text-secondary)`, `border-bottom: 2px solid var(--border-default)`.
* `td`: `font-family: var(--font-body)` or `var(--font-mono)` for numbers, `border-bottom: 1px solid var(--border-default)`.
* Alternating rows (`tr:nth-child(even)`): `background: var(--bg-surface-alt)`.