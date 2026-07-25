# Component Architecture Overhaul Blueprint

### 1. `Button` (`Button.tsx`)



* **Mechanical Shift:**
* Replace simple border-radius with a **machined-edge switch** aesthetic.


* Extruded 3D bottom shadow (`box-shadow: 0 4px 0 var(--border-default)`). On click, depresses 3px (`translateY(3px)`) and plays a synthesized 15ms Web Audio mechanical switch click.


* Primary actions get **Safety Orange (`#FF5500`)** fills with crisp **IBM Plex Mono** all-caps labels.


* Ghost variants receive a **stamped steel outline** with a 2px offset focus ring.





### 2. `CustomSelect` (`CustomSelect.tsx`)



* **Mechanical Shift:**
* Modeled after an **industrial thumbwheel or rotary switch dial**.
* Trigger field features a dark steel panel fill (`--bg-surface`) with an **IBM Plex Mono** data tag.


* Dropdown menu renders as a **stamped control plate card** with thick outer borders (`2px solid var(--border-default)`) and pixel-accented checkmarks for active items.





### 3. `Checkbox` (`Checkbox.tsx`)



* **Mechanical Shift:**
* Designed like a **physical mechanical toggle / DIP switch**.
* Unchecked: Deep recessed square with a dark iron border.


* Checked: Illuminates with a **Safety Orange** or **Press Cyan** backlit square and a sharp, pixel-drawn or bold SVG check icon.





### 4. `ValidatedInput` (`ValidatedInput.tsx`)



* **Mechanical Shift:**
* Modeled after a **digital terminal display readout / gauge screen**.
* Input field uses dark carbon background (`--bg-surface`) with crisp **IBM Plex Mono** text entry.


* Labels are styled like **stamped aluminum equipment tags** (`font-family: var(--font-mono)`, upper-case, small tracking).


* Validation errors display as a **red danger status LED** + alert bar (`--status-error`).





### 5. `DateRangePicker` (`DateRangePicker.tsx`)



* **Mechanical Shift:**
* Styled like a **punch-card calendar matrix**.
* Quick presets render as a horizontal row of **push-button tabs**.


* Selected dates highlight in solid **Safety Orange**, while intermediate days show a subtle **carbon ink band** (`--accent-glow`).





### 6. `Modal` (`Modal.tsx`)



* **Mechanical Shift:**
* Container renders as a **heavy iron equipment panel** bolted onto the screen.
* Header strip uses a darker gunmetal tone with **stamped rivets/corners** and an **IBM Plex Mono** panel title.


* Action footers house heavy 3D mechanical push buttons (`Execute` / `Abort`).





### 7. `ToastStack` (`ToastStack.tsx`)



* **Mechanical Shift:**
* Styled like **dot-matrix error printout strips** sliding into the bottom-right viewport.


* Features a **perforated left border** (simulating tractor-feed computer paper) with pixelated LED status dots (Green = Online/Success, Red = Jam/Error).





### 8. `LoadingNet` & `LoadingScreen` (`LoadingNet.tsx`, `LoadingScreen.tsx`)



* **Mechanical Shift:**
* Replaces generic spinning icons with a **retro dot-matrix printhead animation**.


* A pixel-art sheet of paper physically feeds back and forth through an active printhead line with an **IBM Plex Mono** status readout below (e.g., `SYSTEM_SYNCING...`).





### 9. `EmptyState` (`EmptyState.tsx`)



* **Mechanical Shift:**
* Features a **16-bit retro pixel-art illustration** of an empty paper tray or open printer hatch.


* Wrapped in a **cardboard/paper container** with dashed tractor-feed borders.





### 10. Master Table Component (`.paper-sheet-table`)



* **Mechanical Shift:**
* Transforms raw HTML tables into a **continuous tractor-feed paper sheet (`--bg-paper`)** resting on top of the darker cast-iron background.


* Top edge features a **dashed perforated tear-off line** with small tractor-feed hole notches on the left and right margins.


* Bottom edge displays a **subtle curved lift shadow** (`box-shadow: 0 12px 20px -8px rgba(0,0,0,0.4)`).


* Headers (`<th>`) and numbers use **IBM Plex Mono** in **Carbon Ink / Press Cyan**.

---

# Phase 2: Custom Shared Components Overhaul

You are tasked with refactoring all custom shared components in `src/components/shared/` to conform strictly to the **Industrial Automation & Mechanical Printshop** design system.

You must apply the design tokens created in Phase 1 (`--bg-primary`, `--bg-surface`, `--bg-paper`, `--accent-primary`, `--font-mono`, `--font-body`, etc.).

---

## 1. Web Audio Sound Utility (`src/utils/sound.ts`)
Create a lightweight Web Audio synthesizer utility (no external mp3 files).

```typescript
// Synthesizes a tiny 15ms mechanical switch click sound
class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  public playClick() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.015);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.015);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.015);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
}

export const soundFx = new SoundManager();

```

---

## 2. Refactor Components in `src/components/shared/`

### A. `Button.tsx`

* Add `onClick` event sound trigger calling `soundFx.playClick()`.
* Add extruded 3D shadow: `box-shadow: var(--shadow-3d-btn)`.
* On `:active`, apply `transform: translateY(3px)` and reduce box-shadow to `0 1px 0`.
* Font family must be `var(--font-mono)`, uppercase, with `letter-spacing: 0.05em`.

### B. `ValidatedInput.tsx` & `CustomSelect.tsx`

* Apply dark carbon field backgrounds (`background-color: var(--bg-surface)`).
* Labels must use `font-family: var(--font-mono)` with a stamped-label uppercase aesthetic.
* Focus rings must light up in **Safety Orange** (`--border-active`).

### C. `Checkbox.tsx`

* Style as a square tactile DIP-switch button.
* Checked state fills with `var(--accent-primary)` and displays a bold checkmark.

### D. `ToastStack.tsx` & `Modal.tsx`

* Modals must render as heavy industrial cards (`background: var(--bg-surface)`), wrapped in steel-colored borders (`--border-default`), with `IBM Plex Mono` titles.
* Toasts render with a perforated left border (`border-left: 4px dashed var(--accent-primary)`) and pixelated status indicators.

### E. `PaperTable` Wrapper (`src/components/shared/PaperTable.tsx`)

Create a new reusable `PaperTable` wrapper component for data tables across the app:

```tsx
import React from 'react';

export const PaperTable: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="paper-sheet-container relative bg-[var(--bg-paper)] text-[var(--text-primary)] shadow-[var(--shadow-paper)] border-t-2 border-dashed border-[var(--border-default)] rounded-b-sm my-6 overflow-hidden">
      {/* Tractor Feed Left & Right Perforation Accents */}
      <div className="absolute top-0 left-0 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)]" />
      <div className="absolute top-0 right-0 w-3 h-3 translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)]" />
      
      <div className="overflow-x-auto p-4">
        {children}
      </div>
    </div>
  );
};

```

---