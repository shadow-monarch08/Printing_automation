# Component Refactor Prompt: `PrinterCard` (`src/components/admin/PrinterCard.tsx`)

You are tasked with refactoring the `PrinterCard` component (`src/components/admin/PrinterCard.tsx`) to align strictly with the **Industrial Automation & Mechanical Printshop** design system.

The component must be styled as a **Physical Industrial Hardware Equipment Control Module** mounted directly into the rack, using the global theme tokens (`--bg-surface`, `--border-default`, `--accent-primary`, `--font-mono`, etc.).

---

## 1. Data Structure & Props Contract
Preserve the exact `BackendPrinter` interface from `src/types/index.ts` without altering prop signatures or breaking API triggers:

```typescript
export interface PrinterCardProps {
  printer: BackendPrinter;
  onEditAlias: (printer: BackendPrinter) => void;
  onRefresh: (printerName: string) => void;
  onSetDefault: (printerName: string) => void;
  onDelete: (printer: BackendPrinter) => void;
  isRefreshing?: boolean;
}

```

---

## 2. Visual & Structural Specifications

### A. Card Shell & Stenciled Default Ribbon

* **Container Frame:** `background: var(--bg-surface)` (`#24282D` dark / `#EBE6DC` light), `border: 1px solid var(--border-default)`, sharp `2px` corners (`border-radius: var(--radius-sm)`), `box-shadow: var(--shadow-paper)`.
* **Hover Effect:** Border transitions to `1px solid var(--border-active)` (`#FF5500` dark / `#D03B00` light).
* **Stenciled Default Ribbon:** When `printer.isDefault === true`, render a solid **Safety Orange** ribbon anchored to the top-right corner containing stenciled typography: `DEFAULT`.

### B. Device Hardware Header

* **Hardware Icon Badge:** Recessed square icon container (`var(--bg-primary)`) holding a `<Printer size={20} />` icon. Color switches to `var(--status-error)` if `printer.status === 'error'`.
* **Title Row:** Display `printer.alias || printer.name` in bold `IBM Plex Mono` typography.
* **Local Header Triggers:**
* **Edit Alias:** Recessed square button (`<Edit3 size={14} />`) styled locally (transparent background, subtle border on hover). On click, calls `onEditAlias(printer)`.
* **Health Refresh:** Recessed square button (`<RefreshCw size={14} />`) styled locally. When `isRefreshing === true`, apply CSS spinning animation (`@keyframes spin`). On click, calls `onRefresh(printer.name)`.


* **Protocol Line:** Render `<Usb size={12} />` or `<Wifi size={12} />` alongside the raw CUPS URI (`printer.description`) formatted in `.data-mono` typography.

### C. Consumables & Analog Meters

* **Hardware Status Badge:** Render a stenciled badge (`READY`, `PRINTING`, `ERROR`, `OFFLINE`) with an adjacent $5\text{px}$ **pulsing LED diode** (`@keyframes pulseLed`):
* `idle`: Green LED (`#00C853`).
* `busy`: Orange LED (`#FFAA00`).
* `error`: Flashing Red LED (`#FF4444`).
* `offline`: Muted Gray LED (`#9098A2`).


* **Paper Tray Meter:** A $5\text{px}$ horizontal track. Fills $100\%$ green when `ready`, $0\%$ red when `empty`, and $50\%$ muted gray when `unknown`.
* **Black Toner Meter:** Horizontal track displaying monospace percentage (e.g., `85%`) with a solid carbon-black fill.
* **CMYK Color Meter:** Horizontal track displaying percentage with a vibrant 3-color gradient fill (`linear-gradient(90deg, #00FFFF, #FF00FF, #FFFF00)`). If monochrome (`printer.supplyColor === null`), display a stenciled `UNSUPPORTED` badge instead of a zero percent bar.

### D. Action Footer Mechanics

Re-use the refactored shared `<Button>` component (`src/components/shared/Button.tsx`) for main actions:

* **Set as Default Button:**
* Render `<Button variant="ghost" size="sm" onClick={() => onSetDefault(printer.name)} disabled={printer.status === 'offline'}>SET AS DEFAULT</Button>`.
* If already default, render a non-clickable indicator tag: `<Check size={14} /> PRIMARY TARGET` in Safety Orange.


* **Delete Hardware Button:**
* Render `<Button variant="danger" size="sm" onClick={() => onDelete(printer)} aria-label="Delete Printer"><Trash2 size={15} /></Button>`.

---

## 3. Verification Checklist

1. Verify `PrinterCard` renders on a dark surface with sharp 2px corners, stenciled `IBM Plex Mono` labels, and a top-right `DEFAULT` ribbon when applicable.
2. Verify local quick-action icons (Pencil & Refresh) render inline in the header without using global `<Button>` styles, and the refresh icon spins during loading.
3. Confirm status badges display pulsing LED dots (`READY`, `PRINTING`, `ERROR`, `OFFLINE`).
4. Confirm Black toner and CMYK color meters handle `null` values gracefully without breaking.
5. Confirm "Set as Default" and "Trash" actions pass through the shared mechanical `<Button>` component with 3D press depression and Web Audio click triggers.