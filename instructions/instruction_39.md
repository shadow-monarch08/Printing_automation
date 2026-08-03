# Master Prompt: Onboarding Suite & Wi-Fi Provisioning UI Overhaul

You are tasked with executing a 100% visual and structural overhaul of the **Kiosk Onboarding Suite** across the following files:
- `src/layouts/OnboardingLayout.tsx`
- `src/pages/onboarding/Step1NameAndPin.tsx`
- `src/pages/onboarding/Step2WifiSetup.tsx` (and `src/components/user/WifiSetup.tsx`)
- `src/pages/onboarding/Step3Completion.tsx`
- `src/components/onboarding/WifiConnectModalBody.tsx`

Your primary objective is to transform the generic SaaS onboarding flow into a **Tactile Industrial Equipment Provisioning Console**.

You MUST strictly enforce the global design system tokens (`var(--bg-primary)`, `var(--bg-surface)`, `var(--bg-paper)`, `var(--border-default)`, `var(--border-active)`, `var(--accent-primary)`, `var(--accent-secondary)`, `var(--font-mono)`, `var(--font-body)`, `var(--status-idle)`, `var(--status-error)`). Retain all underlying React hooks, state management, Redis polling API handlers, and SQLite persistence methods.

---

## 1. Outer Console Frame & Layout Architecture (`OnboardingLayout.tsx`)

### Visual Blueprint:
- **Viewport Canvas:** Center the container on a full-screen dark gunmetal canvas (`background: var(--bg-primary)`).
- **Master Console Card (`.onboarding-console-card`):**
  - Dimensions: `max-width: 680px`, `width: 92%`, `margin: 40px auto`, `padding: 0`.
  - Surface & Border: `background: var(--bg-surface)`, `border: 2px solid var(--border-default)`, `border-radius: 4px`, `box-shadow: var(--shadow-paper)`.
  - Stenciled Corner Accents: Add 4 pseudo-element corner rivets (`▪`) using `::before` and `::after` positioned `-6px` at the corners in `var(--border-default)`.

### Header Deck & Punch-Card Stepper:
- **Header Strip (`.onboarding-header`):**
  - Background: Recessed dark iron strip (`background: rgba(0, 0, 0, 0.2)`), `padding: 16px 24px`, `border-bottom: 1px solid var(--border-default)`.
  - Stenciled Title: Monospace header `SYSTEM_PROVISIONING // TERMINAL_INITIALIZATION` in `IBM Plex Mono` (`font-size: 13px`, `font-weight: 700`, `letter-spacing: 0.08em`, color `var(--text-primary)`).
- **2-Step Punch-Card Stepper Bar:**
  - Layout: `display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px 24px; background: var(--bg-primary); border-bottom: 1px solid var(--border-default);`.
  - **Step 1 Tab (`1. IDENTITY & SECURITY`):**
    - Active State: `border: 2px solid var(--accent-primary)`, `background: var(--bg-surface)`, color `var(--accent-primary)`, bold `IBM Plex Mono`. Includes a glowing background tint (`background: rgba(255, 85, 0, 0.08)`).
  - **Step 2 Tab (`2. NETWORK PROVISIONING`):**
    - Locked/Future State: `border: 1px dashed var(--border-default)`, `background: transparent`, color `var(--text-secondary)`.
    - Active Connecting State: Flashes a pulsing amber LED badge (`[ RECONNECTING_RADIO ]`).

---

## 2. Step 1: Shop Identity & Master Admin PIN (`Step1NameAndPin.tsx`)

### Visual Blueprint:
- **Form Card Layout:** `padding: 32px 28px`, `display: flex`, `flex-direction: column`, `gap: 24px`.

### Component Specifications:
1. **Shop Name Field:**
   - Label: Stamped aluminum tag tag string `[EQUIPMENT_TAG // SHOP_NAME]` in `IBM Plex Mono` (`font-size: 11px`, `color: var(--text-secondary)`).
   - Input: Use `<ValidatedInput>` with `background: var(--bg-primary)`, `border: 1px solid var(--border-default)`, focus ring `border-color: var(--accent-primary)`, typography `Space Grotesk`.
2. **4-Digit Master Admin PIN & Confirmation:**
   - Label: `[MASTER_SECURITY_PIN // 4_DIGITS]`.
   - Digit Slots Container: `display: flex; gap: 12px; margin-top: 8px;`.
   - **4 Tactile Digit Box Slots:**
     - Render 4 individual square slot boxes (`width: 52px; height: 52px; display: flex; align-items: center; justify-content: center;`).
     - Surface: `background: var(--bg-primary)`, `border: 2px solid var(--border-default)`, `border-radius: 4px`, `box-shadow: 0 4px 0 var(--border-default)`.
     - Active Digit State: Displays a solid Safety Orange bullet (`•`) in `IBM Plex Mono` (`font-size: 24px`, color `var(--accent-primary)`).
     - Haptic Audio: Keypress on PIN slots invokes `soundFx.playClick()` (15ms Web Audio switch click).
3. **Primary Action Button:**
   - Render 3D mechanical button `<Button variant="primary">`: `[ CONTINUE TO WI-FI PROVISIONING ➔ ]`.
   - Dimensions: `width: 100%`, `height: 48px`, font `IBM Plex Mono`, `font-weight: 700`, uppercase.

---

## 3. Step 2: Network Scanner & Modal (`WifiSetup.tsx`)

### Visual Blueprint:
- **Top Telemetry Header:**
  - Layout: `display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px dashed var(--border-default);`.
  - Title: Monospace header `WI-FI_RADIO_PROVISIONING` in `IBM Plex Mono`.
  - Action Button: Render a 3D mechanical ghost button `[ Refresh Scan 🔄 ]`. Clicking animates a spinning `<RefreshCw size={14} />` icon during `nmcli` scan sweeps.
- **"Currently Connected" Active Plate:**
  - Recessed dark green panel: `background: rgba(0, 200, 83, 0.05)`, `border: 2px solid var(--status-idle)`, `border-radius: 4px`, `padding: 16px`.
  - Features a $8\times8\text{px}$ pulsing green LED diode (`@keyframes pulseLed`), active SSID in `IBM Plex Mono`, and a stenciled badge `[ACTIVE_LINK // 92%]`.
- **"Available Networks" Signal Matrix:**
  - Wrap network list inside the `<PaperTable>` wrapper component (`.paper-sheet-container`) featuring continuous top perforated tear-off lines and tractor-feed side hole accents.
  - Network Item Rows:
    - Row style: `padding: 12px 16px`, `border-bottom: 1px dashed var(--border-default)`, `display: flex`, `align-items: center`, `justify-content: space-between`.
    - Left: Monospace SSID string in `IBM Plex Mono` (`font-weight: 600`).
    - Signal Telemetry Meter: Render 4-block signal gauge in `var(--accent-secondary)` Press Cyan (e.g., `[ █ █ █ ░ ] 84%`).
    - Badges: Show `[SAVED_PROFILE]` badge with a `4px` left-accent line for saved networks.
    - Right Action: Render a mechanical trigger button `[ SELECT ➔ ]`.

### Password Modal Dialog (`WifiConnectModalBody.tsx`):
- Modal Shell: Custom `<Modal>` rendered as a **Bolted Steel Access Panel** (`background: var(--bg-surface)`, `border: 2px solid var(--border-default)`).
- Header: Monospace target title `CONNECT_TO: [SSID_NAME]`.
- Input Field: `<ValidatedInput>` with label `[WPA2_PASSPHRASE]`, placeholder `"Leave blank if open"`.
- Action Buttons: `[ ABORT / CANCEL ]` ghost button + `[ JOIN NETWORK ➔ ]` Safety Orange primary push button.

---

## 4. Connecting Fullscreen Hazard Overlay (36s Timeout Counter)

When credentials are submitted (`status === 'connecting'`):

- **Backdrop Screen Overlay:**
  - `position: fixed; inset: 0; z-index: 9999; background: var(--bg-primary);` with $20\times20\text{px}$ crosshatch grid lines in `rgba(255, 255, 255, 0.02)`.
- **Center Industrial Hazard Panel:**
  - Card: `max-width: 460px; width: 90%; background: var(--bg-surface); border: 2px solid var(--border-default); border-radius: 4px; padding: 36px 24px; text-align: center;`.
  - Header Diode: A $16\times16\text{px}$ pulsing amber LED diode indicating radio teardown (`@keyframes pulseLed`).
  - Monospace Title: `<h3 className="data-mono">[ APPLYING_NETWORK_CREDENTIALS ]</h3>`.
  - Description: `"The kiosk spooler is cycling its Wi-Fi radio. Please wait while the terminal authenticates."` in `Space Grotesk` (`color: var(--text-secondary)`).
- **Segmented Progress Bar:**
  - Render a 36-segment block progress bar tracking Redis polling (`GET /wifi/connection-status` every 2000ms) and network disconnect count:
    `[ █ █ █ █ █ █ █ █ ░ ░ ░ ░ ] 36s` in `IBM Plex Mono` (`color: var(--accent-primary)`).

---

## 5. Step 3: Industrial Completion View (`Step3Completion.tsx`)

Rendered when setup completes successfully:

- **Header Badge:** Square emerald status badge containing a stenciled checkmark: `[ ✓ ] TERMINAL_ONLINE_AND_PROVISIONED`.
- **HDMI QR Code Instruction Panel:**
  - Stamped steel panel card (`background: var(--bg-primary)`, `border: 1px solid var(--border-default)`, `padding: 20px`).
  - Heading: `[1] ATTACHED DISPLAY ACCESS` in `IBM Plex Mono`.
  - Body: `"Inspect the attached Raspberry Pi HDMI screen for the live Cloudflare public QR code and terminal status."` in `Space Grotesk`.
- **Disk Backup Path Display Panel:**
  - Stamped steel panel card (`margin-top: 12px`).
  - Heading: `[2] LOCAL FILE BACKUP` in `IBM Plex Mono`.
  - Body: `"Inspect the live public tunnel access URL on local storage at:"`.
  - Monospace Path: `<code className="data-mono">server/data/cloudflare_url.txt</code>`.
- **Primary Launch CTA:**
  - Oversized Safety Orange 3D mechanical push button: `[ INITIALIZE MANAGEMENT DASHBOARD ➔ ]`.

---

## Verification Checklist
1. Verify onboarding console renders inside a 680px gunmetal frame with stenciled `IBM Plex Mono` headers and corner rivet styling.
2. Confirm 4-digit PIN input slots render as 3D boxes and invoke Web Audio switch clicks on keypress.
3. Confirm available networks list renders inside a `<PaperTable>` card with 4-block signal meters (`[ █ █ █ ░ ]`).
4. Test Wi-Fi submission -> Confirm 36s segmented progress bar overlay renders with crosshatch backdrop and pulsing amber hazard LED.
5. Confirm completion view displays emerald checkmark badge, HDMI instructions, and monospace file path references.