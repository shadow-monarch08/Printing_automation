## Task 0: Create the Web Audio Sound Utility
**Target File (Create):** `src/utils/sound.ts` (or equivalent utility directory matching the project structure)

Implement a synthesized Web Audio click manager:

```typescript
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

## Component 1: `Button.tsx` (`src/components/shared/Button.tsx`)

### Structural Rules & Preservations:

* Keep all existing TypeScript interfaces (`variant`, `size`, `isLoading`, `disabled`, `children`, `onClick`, etc.).
* Maintain existing `Loader2` spinning state when `isLoading` is true.

### Mechanical Visual & Sound Overhaul:

1. **Audio Trigger:** Inside `handleClick` (or directly attached to `onClick`), call `soundFx.playClick()` before executing `props.onClick?.(e)`.
2. **Machined 3D Styling:**
* **Base:** `font-family: var(--font-mono)`, uppercase typography, `letter-spacing: 0.05em`, `font-weight: 600`, `border-radius: var(--radius-sm)` (sharp, machined 2px corners).
* **Extruded 3D Shadow:** Apply `box-shadow: var(--shadow-3d-btn)`.
* **Active Click Press (`:active`):** Apply `transform: translateY(3px)` and flatten shadow to `0 1px 0 rgba(0,0,0,0.4)` to simulate a physical mechanical press.


3. **Variants:**
* `primary` / `mechanical`: Solid fill with `var(--accent-primary)`, high-contrast text (`#FFFFFF` or `var(--bg-primary)`).
* `danger`: Solid fill with `var(--status-error)`.
* `ghost`: Background transparent, `2px solid var(--border-default)`. On hover: `border-color: var(--accent-primary)`, `background: var(--bg-surface-hover)`.

---

## Component 2: `CustomSelect.tsx` (`src/components/shared/CustomSelect.tsx`)

### Structural Rules & Preservations:

* Keep all dropdown open/close state, keyboard navigation (`Escape`, `ArrowDown`), and select handlers.

### Industrial Thumbwheel / Rotary Switch Overhaul:

1. **Trigger Field:**
* Background: `var(--bg-surface)` (Machined Iron/Panel).
* Border: `1px solid var(--border-default)`.
* Typography: Active selection label rendered using `font-family: var(--font-mono)`, text color `var(--text-primary)`.
* Focus state: Outline/border lights up with `var(--border-active)` (Safety Orange/Press Red).
* Audio: Call `soundFx.playClick()` when opening/closing the dropdown trigger.


2. **Dropdown Menu Panel:**
* Render dropdown overlay card with heavy industrial styling: `background: var(--bg-surface)`, `border: 2px solid var(--border-default)`, `box-shadow: var(--shadow-paper)`.
* Option Rows: Hover state uses `var(--bg-surface-hover)`. Selected option highlights in `var(--accent-glow)` with `color: var(--accent-primary)` and a sharp, pixel-crisp checkmark icon.

---

## Component 3: `Checkbox.tsx` (`src/components/shared/Checkbox.tsx`)

### Structural Rules & Preservations:

* Keep all input change handlers, label bindings, and accessibility `id`/`htmlFor` links.

### Tactile DIP-Switch Overhaul:

1. **Unchecked Box:**
* Recessed square (`18px × 18px`), `background: var(--bg-primary)`, `border: 2px solid var(--border-default)`, `border-radius: var(--radius-sm)`.


2. **Checked Box:**
* Fills with `var(--accent-primary)` (Safety Orange/Press Red).
* Renders a crisp SVG checkmark in contrasting color (`var(--bg-primary)` or white).


3. **Interactive Feel:**
* Call `soundFx.playClick()` inside the toggle handler when state changes.
* Focus ring: `outline: 2px solid var(--border-active)` with `outline-offset: 2px`.


4. **Label:** Uses `font-family: var(--font-body)` or `var(--font-mono)` matching the stamped equipment label style.