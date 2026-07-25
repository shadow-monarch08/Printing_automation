# Fleet Tab Architecture & Component Specification Report

---

## 1. Overview & Fleet Tab Architecture

The **Hardware Fleet Tab** (`src/pages/admin/Fleet.tsx`) is the central control console for managing all physical print hardware connected to the automation platform. It displays real-time device topology, paper tray states, black & CMYK color toner levels, legacy device discovery, and CUPS driver configurations.

```
+-----------------------------------------------------------------------------------+
|  [Printer Icon]  HP LaserJet Pro M404 [Edit] [Refresh]       [DEFAULT RIBBON]     |
|  [USB Icon] cups://localhost/printers/HP_M404                                     |
|-----------------------------------------------------------------------------------|
|  Status: [READY BADGE]                                                            |
|  Paper Tray: Ready                                                                |
|  [=============================================================================]  |
|  Ink / Toner Levels:                                                              |
|  Black: 85%  [========================================                     ]      |
|  Color: N/A   [N/A Badge]                                                         |
|-----------------------------------------------------------------------------------|
|  [ SET AS DEFAULT ]                                               [ TRASH BUTTON ] |
+-----------------------------------------------------------------------------------+
```

---

## 2. Payload Data Structures & TypeScript Interfaces

### A. Hardware Device Payload (`BackendPrinter`)
File Location: `src/types/index.ts`

```typescript
export interface BackendPrinter {
  name: string;             // CUPS system queue identifier (e.g. "HP_LaserJet_M404")
  description: string;      // Physical connection URI / driver string
  status: 'idle' | 'busy' | 'error' | 'offline'; // Real-time CUPS health state
  type: 'usb' | 'network' | 'unknown';            // Interface connection protocol
  isDefault?: boolean;      // Flag indicating primary fallback target
  alias?: string;           // Custom human-readable label (e.g. "Front Desk Printer")
  capabilities?: string[];  // Feature flags: ["color", "duplex", "grayscale"]
  paper: 'ready' | 'empty' | 'unknown'; // Physical paper tray sensor reading
  supplyBlack: number | null; // Black toner percentage (0 - 100 or null if unsupported)
  supplyColor: number | null; // Color CMYK toner percentage (0 - 100 or null if B&W)
}
```

### B. Hardware Discovery Payload (`DetectedDevice`)

```typescript
export interface DetectedDevice {
  uri: string;      // Hardware connection address (e.g. "usb://HP/LaserJet%20M404?serial=PH123")
  rawModel: string; // Auto-probed hardware model string (e.g. "HP LaserJet Pro M404n")
}
```

---

## 3. Custom Component Deep-Dive: `PrinterCard` (`src/components/admin/PrinterCard.tsx`)

### Visual Blueprint & Mental Visualization
The `PrinterCard` renders each physical printer as a **Machined Hardware Equipment Panel** with live analog-style status meters.

1. **Card Frame & Header Ribbon:**
   - Container Shell: Heavy card fill `var(--bg-surface)` (`#24282D` dark / `#EBE6DC` light), `1px solid var(--border-default)`, `2px` sharp corners, paper shadow `var(--shadow-paper)`.
   - Stenciled Default Badge: When `isDefault={true}`, a solid Safety Orange ribbon (`var(--accent-primary)`) anchors to the top-right corner displaying `DEFAULT` in bold uppercase text.
2. **Device Hardware Header:**
   - Left Icon Badge: Recessed square container (`var(--bg-surface-alt)`) housing a `<Printer />` icon. Color turns `var(--status-error)` if status is `error`.
   - Title Row: Renders `printer.alias` if available, falling back to `printer.name`. Includes inline `<Button variant="ghost">` triggers for alias editing (`<Edit3 />`) and force health refresh (`<RefreshCw />`).
   - Protocol Tag: Displays USB (`<Usb />`) or Network (`<Wifi />`) connection icon with the raw CUPS URI formatted in monospace text (`.data-mono`).
3. **Consumables & Status Meters:**
   - **Status Badge:** Renders a stenciled status badge (`badge-idle`, `badge-busy`, `badge-error`, `badge-offline`).
   - **Paper Tray Level Bar:** 4px horizontal meter displaying paper status (`ready`, `empty`, `unknown`). Color-coded fill: Green/Primary for Ready, Danger Red (`var(--status-error)`) for Empty, Muted Grey for Unknown.
   - **Black Toner Level Meter:** Horizontal bar showing monospace percentage (`85%`) with a solid charcoal dark fill (`#333333`).
   - **CMYK Color Toner Level Meter:** Horizontal bar showing monospace percentage (`65%`) filled with a vibrant CMYK gradient (`linear-gradient(90deg, #00FFFF, #FF00FF, #FFFF00)`). If printer is B&W, displays an `N/A` badge.
4. **Action Footer Bar:**
   - Left Action: `Set as Default` ghost button (`<Button variant="ghost">`).
   - Right Action: Danger trash icon button (`<Button variant="ghost">` with `color: var(--status-error)`).

---

## 4. Premade Shared Components Used Inside the Fleet Tab

The Fleet tab seamlessly integrates multiple reusable primitives from `src/components/shared/` and `src/components/admin/`:

| Reusable Component | Import Path | Role in Fleet Tab |
| :--- | :--- | :--- |
| **`<Button>`** | `src/components/shared/Button.tsx` | Used for `Detect Legacy Hardware`, `Delete All`, `Set as Default`, `Refresh Printer`, `Delete Printer`, and modal submit/abort triggers. Handles 3D button depression, loading spinners, and audio click sounds. |
| **`<ValidatedInput>`** | `src/components/shared/ValidatedInput.tsx` | Used inside `AliasModalBody` and `SetupWizardModalBody` for stenciled alias name entry with required field validation rules (`validateRequired`). |
| **`<Checkbox>`** | `src/components/shared/Checkbox.tsx` | Used inside `SetupWizardModalBody` (Step 2) for selecting hardware capabilities (Color Support, Automatic Duplex, Grayscale Only). |
| **`<Modal>`** | `src/context/ModalContext.tsx` & `Modal.tsx` | Renders heavy equipment control panel overlays for alias editing, printer deletion confirmation, setup wizards, and fleet clearing. |
| **`<EmptyState>`** | `src/components/shared/EmptyState.tsx` | Renders a retro 16-bit pixel-art empty printer hatch illustration when `printers.length === 0`. |
| **`<LoadingNet>`** | `src/components/shared/LoadingNet.tsx` | Renders the dot-matrix printhead scan animation while scanning hardware topology. |
| **`<FleetSkeleton>`** | `src/components/admin/skeletons/FleetSkeleton.tsx` | Renders 3 laser-shimmer wireframe printer card placeholders during initial page load. |

---

## 5. Modal Workflows & State Lifecycle

### A. Alias Editing (`AliasModalBody`)
- **Trigger:** Click `Edit` pencil icon on any printer card.
- **Workflow:** Opens a modal titled `Edit Printer Alias` containing a `<ValidatedInput>` field. On save, triggers `api.updateAlias()`, updates Zustand store (`useAdminStore`), displays a success toast (`addToast`), and closes the modal.

### B. Hardware Setup Wizard (`SetupWizardModalBody`)
- **Trigger:** Click `Configure` button on any auto-discovered device in the `Discovered Devices` section.
- **Step 1 (Device Identity):** Prompts for an alias name and displays detected model and URI. Clicking `Install Device` executes `api.configurePrinter()`.
- **Step 2 (Capabilities Probe):** Displays DIP-switch checkboxes (`<Checkbox>`) for Color, Duplex, and Grayscale capabilities. Clicking `Save & Finish` persists settings and updates the fleet state.

### C. Printer Deletion (`DeletePrinterModalBody` / `DeleteAllPrintersModalBody`)
- **Trigger:** Click trash button on a card or click `Delete All` in the header.
- **Workflow:** Prompts confirmation in a dark panel modal with a red danger action button (`variant="mechanical"`, `background: var(--status-error)`).
