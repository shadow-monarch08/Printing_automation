# Onboarding & Network Recovery Layout — Implementation Plan

## Overview

This plan implements a dedicated, stateful `OnboardingLayout` that replaces the current loosely-coupled Wi-Fi setup rendering in `App.tsx`. The layout will function as a client-side state machine that conditionally renders a multi-step wizard, a PIN-locked recovery flow, or an exportable Wi-Fi widget — all driven by backend flags (`setup_mode` and `is_onboarded`).

---

## Phase 1: Architectural Discovery & Theme Sync (Completed)

### 1.1 Existing Wi-Fi Setup Analysis

The current Wi-Fi setup (Screen 3) is defined in:
- **Component**: [`WifiSetup.tsx`](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/components/user/WifiSetup.tsx) (`components/user/WifiSetup.tsx`)
- **Styles**: [`wifi-setup.css`](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/styles/wifi-setup.css)

**Current state model:**
| State | Type | Purpose |
|-------|------|---------|
| `networks` | `WifiNetwork[]` | Scanned network list |
| `isScanning` | `boolean` | Active scan indicator |
| `errorMsg` | `string` | Error message buffer |
| `status` | `'scanning' \| 'ready' \| 'connecting' \| 'error'` | FSM for UI transitions |

**Current rendering context (in `App.tsx`):**
```tsx
// Line 72-78 — isSetupMode blocks the entire app and shows ONLY WifiSetup
if (isSetupMode) {
  return (
    <UserLayout subtitle="// INITIAL SETUP PORTAL">
      <WifiSetup />
    </UserLayout>
  );
}
```
This is a flat, undifferentiated render — it does not distinguish between **initial onboarding** vs. **network recovery**. The `WifiSetup` uses the shared `Modal` context for password input via `WifiConnectModalBody`.

**API surface used:**
- `api.scanWifiNetworks()` → `GET /wifi/scan`
- `api.connectToWifi(payload)` → `POST /wifi/connect`
- Setup mode check: `GET /wifi/setup-mode` → reads `process.env.SETUP_MODE`

### 1.2 Platform Theme Tokens

The design system uses **vanilla CSS custom properties** (no Tailwind) with a dual-theme architecture:

| Category | Dark Token | Light Token |
|----------|------------|-------------|
| Background | `--bg-primary: #121212` | `--bg-primary: #F9F9F6` |
| Surface | `--bg-surface: #1E1E1E` | `--bg-surface: #FFFFFF` |
| Surface Hover | `--bg-surface-hover: #2A2A2A` | `--bg-surface-hover: #F0F0ED` |
| Border | `--border-default: #333333` | `--border-default: #222222` |
| Border Active | `--border-active: #00FFFF` | `--border-active: #0A2463` |
| Accent | `--accent-primary: #00FFFF` | `--accent-primary: #0A2463` |
| Input BG | `--input-bg: #151515` | `--input-bg: #FFFFFF` |
| Input Focus | `--input-focus-border: #00FFFF` | `--input-focus-border: #0A2463` |
| Status OK | `--status-idle: #00FF88` | `--status-idle: #16A34A` |
| Status Error | `--status-error: #FF4444` | `--status-error: #DC2626` |

**Typography**: `IBM Plex Sans` (body), `JetBrains Mono` (data/mono).  
**Spacing scale**: `--spacing-xs` (4px) through `--spacing-xl` (40px).  
**Radii**: `--radius-sm: 2px`, `--radius-md: 4px`, `--radius-lg: 8px`.  
**Button system**: Mechanical press buttons (`.btn-mechanical`, `.btn-primary`, `.btn-ghost`, `.btn-danger`) with 3D shadow + active transform.  
**Card pattern**: `.card` — surface bg, 2px border, `border-radius: 2px`.

### 1.3 Backend API Integrity

**Existing endpoints:**

| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| `GET /wifi/setup-mode` | Returns `{ isSetupMode: boolean }` from env var | No |
| `GET /wifi/scan` | Scans for Wi-Fi networks | No |
| `POST /wifi/connect` | Connects to a network | No |
| `POST /auth/login` | PIN verification → JWT | No |
| `GET /auth/verify` | Verifies JWT validity | Yes |
| `GET /config/system` | Returns `isOnboarded`, `shopName`, `adminPinHash`, `cloudflareUrl` | No |
| `PUT /config/system` | Updates system config | Yes |

**Missing endpoint needed:**
- `POST /api/setup/provision` — A new orchestrating endpoint that accepts `{ adminPin, shopName, wifiSsid, wifiPassword }` and atomically:
  1. Hashes the admin PIN and stores it in `system_config.admin_pin_hash`
  2. Updates `shop_name`
  3. Sets `is_onboarded = true`
  4. Triggers the Wi-Fi connection
  5. Returns the Cloudflare Dashboard URL

> [!IMPORTANT]
> The current `GET /wifi/setup-mode` only checks `process.env.SETUP_MODE`. It does **not** return `is_onboarded`. The API response must be extended to return **both** `isSetupMode` and `isOnboarded` so the frontend can differentiate Scenario 1 vs Scenario 2.

---

## Phase 2: Core State Engine & Conditional Flow

### 2.1 Scenario Matrix

```
┌──────────────────────────┬────────────────┬───────────────────────────────┐
│ Condition                │ UI Rendered    │ Steps                        │
├──────────────────────────┼────────────────┼───────────────────────────────┤
│ setup_mode && !onboarded │ Full Wizard    │ PIN → Shop Name → WiFi → ✓   │
│ setup_mode && onboarded  │ Recovery Flow  │ PIN Auth → WiFi Only         │
│ !setup_mode && onboarded │ Export Widget  │ WifiSetup in Admin Settings  │
└──────────────────────────┴────────────────┴───────────────────────────────┘
```

### 2.2 State Machine Design

```
                    ┌─── Scenario 1 ───┐
                    │                   │
    [LOADING] ──→ [PIN_CREATE] → [BRANDING] → [WIFI_SELECT] → [PROVISIONING] → [SUCCESS]
                    │                   │
                    └─── Scenario 2 ───┘
                    │
    [LOADING] ──→ [PIN_AUTH] → [WIFI_SELECT] → [CONNECTING]
```

---

## Phase 3: Proposed Changes

### Component: Backend API Layer

---

#### [MODIFY] [wifi.controller.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/wifi.controller.ts)

Extend `getWifiSetupMode` to return both `isSetupMode` and `isOnboarded`:
```diff
 export async function getWifiSetupMode(req: Request, res: Response) {
-  res.json({ isSetupMode: process.env.SETUP_MODE === "true" });
+  const config = getSystemConfig();
+  res.json({
+    isSetupMode: process.env.SETUP_MODE === "true",
+    isOnboarded: config?.isOnboarded ?? false
+  });
 }
```

---

#### [NEW] [setup.routes.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/routes/setup.routes.ts)

New route file for the provisioning endpoint:
```typescript
router.post("/provision", setupController.provision);
router.post("/validate-pin", setupController.validatePin);
```

#### [NEW] [setup.controller.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/setup.controller.ts)

New controller with two actions:
- **`provision`** — Accepts `{ adminPin, shopName, wifiSsid, wifiPassword }`. Hashes PIN via bcrypt, saves to `system_config` (PIN hash, shop name, `is_onboarded=true`), triggers WiFi connection, returns Cloudflare URL.
- **`validatePin`** — Accepts `{ pin }`. For Scenario 2 recovery, validates the entered PIN against the stored `admin_pin_hash` and returns a short-lived recovery token or boolean success.

#### [MODIFY] [app.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app.ts)

Mount the new setup route:
```diff
+import setupRoutes from "./app/routes/setup.routes";
 // ...
+app.use("/setup", setupRoutes);
```

---

### Component: Frontend — New Layout & State Machine

---

#### [NEW] [OnboardingLayout.tsx](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/layouts/OnboardingLayout.tsx)

The core new file. A stateful layout component implementing:

**Responsibilities:**
1. **Scenario Detection**: On mount, fetches `GET /wifi/setup-mode` (extended) to read `isSetupMode` + `isOnboarded`. Sets initial state machine state accordingly.
2. **Step State Machine**: Manages `currentStep` via `useState` with a union type:
   - Scenario 1 steps: `'pin-create' | 'branding' | 'wifi' | 'provisioning' | 'success'`
   - Scenario 2 steps: `'pin-auth' | 'wifi' | 'connecting'`
3. **Form State**: Consolidated via `useState` holding `{ adminPin, adminPinConfirm, shopName, wifiSsid, wifiPassword }`.
4. **Responsive Wrapper**: Mobile-first layout.
   - Mobile: Full-screen, flush form fields, no extra padding.
   - Desktop (`md:` and up): Centered container `max-width: 480px`, `min-height: 100vh`, `display: flex; align-items: center; justify-content: center`, wrapped in a softly-shadowed card against `--bg-primary`.
5. **Step Rendering**: Renders appropriate step sub-component based on `currentStep`.

**Layout CSS Structure (inline + new CSS file):**
```css
.onboarding-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  padding: var(--spacing-md);
}

.onboarding-card {
  width: 100%;
  max-width: 480px;
  background: var(--bg-surface);
  border: 2px solid var(--border-default);
  border-radius: var(--radius-sm);
  padding: var(--spacing-xl);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.15);
}

/* On mobile, go full-width with no card shadow */
@media (max-width: 768px) {
  .onboarding-wrapper { padding: 0; align-items: flex-start; }
  .onboarding-card {
    max-width: 100%;
    border: none;
    border-radius: 0;
    box-shadow: none;
    min-height: 100vh;
    padding: var(--spacing-lg);
  }
}
```

---

#### [NEW] [OnboardingStepIndicator.tsx](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/components/user/OnboardingStepIndicator.tsx)

A thin step progress indicator showing the current position in the wizard (e.g., 4 dots for Scenario 1, 2 dots for Scenario 2). Uses `--accent-primary` for the active dot and `--border-default` for inactive.

---

#### [NEW] [PinCreateStep.tsx](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/components/onboarding/PinCreateStep.tsx)

**Scenario 1, Step 1 — Security:**
- Two `ValidatedInput` fields: "Create 4-digit Admin PIN" + "Confirm PIN".
- Client-side validation: PIN must be exactly 4 digits, both fields must match.
- Uses the existing `ValidatedInput` component with `validateFn` for real-time feedback.
- "Continue" button (`Button variant="mechanical"`).
- Icon header: `Lock` from lucide-react.

---

#### [NEW] [BrandingStep.tsx](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/components/onboarding/BrandingStep.tsx)

**Scenario 1, Step 2 — Branding:**
- Single `ValidatedInput` field: "Shop Name" (pre-filled with "Modern Press").
- Validation: Non-empty, max 50 characters.
- "Continue" button + "Back" ghost button.
- Icon header: `Store` from lucide-react.

---

#### [MODIFY] [WifiSetup.tsx](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/components/user/WifiSetup.tsx)

Refactor to accept optional props for integration into the onboarding flow:
```diff
-export function WifiSetup() {
+interface WifiSetupProps {
+  /** When provided, the selected network's credentials are piped to the parent instead of connecting directly */
+  onNetworkSelected?: (ssid: string, password: string) => void;
+  /** Hides the title/description header when embedded in OnboardingLayout */
+  embedded?: boolean;
+}
+
+export function WifiSetup({ onNetworkSelected, embedded }: WifiSetupProps = {}) {
```

When `onNetworkSelected` is provided:
- Instead of calling `api.connectToWifi()` directly, the component calls `onNetworkSelected(ssid, password)` and lets the parent handle the actual connection via the provisioning endpoint.
- The `WifiConnectModalBody` submit handler is updated to invoke `onNetworkSelected` when available.

When `embedded` is true:
- The title block ("Wi-Fi Connection Setup" / "Provision the Spooler…") is hidden.
- The component renders only the network list + scanning states.

**This preserves full backward compatibility** — when called without props (Scenario 3 / Admin Settings), it works identically to current behavior.

---

#### [NEW] [PinAuthStep.tsx](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/components/onboarding/PinAuthStep.tsx)

**Scenario 2, Step 1 — Authentication Lock Screen:**
- Full-screen focused PIN pad with a single `ValidatedInput` (password type).
- Submits PIN to `POST /setup/validate-pin` for backend verification against stored hash.
- On success: transitions to `wifi` step.
- On failure: shakes the input, shows error badge `"Invalid Authorization Code"`.
- Design: Centered lock icon (`Shield` from lucide-react), heavy border accent.

---

#### [NEW] [ProvisioningStep.tsx](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/components/onboarding/ProvisioningStep.tsx)

**Scenario 1, Step 4 — Loading & Success:**
- **Loading state**: Full-card loading overlay with animated spinner, pulsing status text: "Setting up admin credentials…", "Configuring shop identity…", "Connecting to network…", "Securing kiosk…"
- Calls `POST /setup/provision` with the consolidated payload.
- **Success state**: Transitions to a success view with:
  - Animated checkmark icon (`CheckCircle` from lucide-react).
  - Cloudflare Dashboard URL displayed in a monospaced, copy-able text block.
  - "Open Dashboard" button.

---

#### [NEW] [onboarding.css](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/styles/onboarding.css)

New CSS file for all onboarding-specific styles:
- `.onboarding-wrapper` — centering container
- `.onboarding-card` — the card shell
- `.onboarding-header` — icon + title + subtitle area
- `.onboarding-step-indicator` — dot progress
- `.onboarding-form-group` — form field wrappers
- `.pin-pad-lockscreen` — Scenario 2 lock screen
- `.provision-loading` — animated loading overlay
- `.provision-success` — success checkmark + URL display
- Mobile responsive overrides at `max-width: 768px`

All styles use exclusively the platform's CSS custom properties.

---

#### [MODIFY] [index.css](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/index.css)

Add import for the new stylesheet:
```diff
 @import './styles/wifi-setup.css';
+@import './styles/onboarding.css';
 @import './styles/analytics.css';
```

---

### Component: Frontend — Routing & App Integration

---

#### [MODIFY] [App.tsx](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/App.tsx)

Replace the current flat `isSetupMode` block with the new `OnboardingLayout`:
```diff
-import { WifiSetup } from './components/user/WifiSetup';
+import { OnboardingLayout } from './layouts/OnboardingLayout';
 
 // ...
 
   if (isSetupMode) {
     return (
-      <UserLayout subtitle="// INITIAL SETUP PORTAL">
-        <WifiSetup />
-      </UserLayout>
+      <OnboardingLayout isOnboarded={isOnboarded} />
     );
   }
```

Remove the `/setup` catch-all route since `OnboardingLayout` handles it internally.

---

#### [MODIFY] [useAdminStore.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/stores/useAdminStore.ts)

Extend the store to track `isOnboarded`:
```diff
   isSetupMode: false,
+  isOnboarded: false,
   checkSetupMode: async () => {
     try {
-      const res = await apiClient.get<{ isSetupMode: boolean }>('/wifi/setup-mode');
-      set({ isSetupMode: res.isSetupMode });
+      const res = await apiClient.get<{ isSetupMode: boolean; isOnboarded: boolean }>('/wifi/setup-mode');
+      set({ isSetupMode: res.isSetupMode, isOnboarded: res.isOnboarded });
     } catch (e) {
```

---

#### [MODIFY] [api.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/admin-ui/src/services/api.ts)

Add the new setup API methods:
```typescript
  provisionSetup: async (payload: {
    adminPin: string;
    shopName: string;
    wifiSsid: string;
    wifiPassword: string;
  }) => {
    return apiClient.post<{
      success: boolean;
      cloudflareUrl: string;
      message: string;
    }>('/setup/provision', payload);
  },

  validateSetupPin: async (pin: string) => {
    return apiClient.post<{
      success: boolean;
      message: string;
    }>('/setup/validate-pin', { pin });
  },
```

---

## Phase 4: Edge-Case & Loading States

### 4.1 Loading Overlays
- **Provisioning step**: Multi-phase animated text that cycles through status messages every 2 seconds via `useEffect` + `setInterval`:
  1. "Setting up admin credentials…"
  2. "Configuring shop identity…"
  3. "Connecting to network…"
  4. "Securing kiosk…"
- Each message fades in/out using CSS `opacity` transitions.
- Central spinner uses `Loader2` from lucide with `animate-spin` class.

### 4.2 Error Handling
- **WiFi connection failure**: If `POST /setup/provision` returns an error (e.g., wrong router password), the `ProvisioningStep` catches the error and calls `onError(message)` which:
  - Transitions the state machine back to the `wifi` step.
  - Preserves all previously entered data (PIN, shop name).
  - Displays an error banner at the top of the WiFi step with the backend error message.
  - Portal session is not dropped — the user can retry.

### 4.3 Validation Rules
| Field | Rule | Error Message |
|-------|------|---------------|
| Admin PIN | Exactly 4 digits | "PIN must be 4 digits" |
| PIN Confirm | Must match PIN | "PINs do not match" |
| Shop Name | Non-empty, ≤ 50 chars | "Shop name is required" / "Max 50 characters" |
| WiFi SSID | Auto-selected from list | N/A (list-driven) |
| WiFi Password | Optional (open networks) | N/A |

---

## File Structure Summary

```
admin-ui/src/
├── layouts/
│   ├── AdminLayout.tsx           [UNCHANGED]
│   ├── UserLayout.tsx            [UNCHANGED]
│   └── OnboardingLayout.tsx      [NEW] — Core state machine & responsive wrapper
├── components/
│   ├── onboarding/
│   │   ├── PinCreateStep.tsx     [NEW] — Scenario 1, Step 1
│   │   ├── BrandingStep.tsx      [NEW] — Scenario 1, Step 2
│   │   ├── PinAuthStep.tsx       [NEW] — Scenario 2, Step 1
│   │   ├── ProvisioningStep.tsx  [NEW] — Loading + Success view
│   │   └── OnboardingStepIndicator.tsx [NEW] — Progress dots
│   └── user/
│       └── WifiSetup.tsx         [MODIFY] — Add onNetworkSelected & embedded props
├── styles/
│   └── onboarding.css            [NEW] — All onboarding layout styles
├── services/
│   └── api.ts                    [MODIFY] — Add provisionSetup & validateSetupPin
├── stores/
│   └── useAdminStore.ts          [MODIFY] — Add isOnboarded state
├── App.tsx                       [MODIFY] — Replace WifiSetup block with OnboardingLayout
└── index.css                     [MODIFY] — Import onboarding.css

server/src/
├── app/
│   ├── routes/
│   │   └── setup.routes.ts       [NEW] — /setup/provision, /setup/validate-pin
│   ├── controllers/
│   │   ├── setup.controller.ts   [NEW] — Provision & PIN validation logic
│   │   └── wifi.controller.ts    [MODIFY] — Return isOnboarded in setup-mode
│   └── services/
│       └── (uses existing config.db.service, auth.service, wifi.service)
└── app.ts                        [MODIFY] — Mount setup routes
```

---

## Open Questions

> [!IMPORTANT]
> **1. Cloudflare URL source**: The `system_config` table has a `cloudflare_url` column. Where does this URL come from during provisioning? Is it:
> - (a) Pre-configured before the appliance ships?
> - (b) Generated dynamically during provisioning via a Cloudflare API call?
> - (c) Hardcoded/environment variable?
>
> This affects the `POST /setup/provision` implementation.

> [!IMPORTANT]
> **2. PIN validation for Scenario 2**: The current `auth.service.login()` returns a JWT on success. Should the Scenario 2 recovery PIN validation:
> - (a) Reuse the existing `/auth/login` endpoint and JWT flow? (Simpler, but the token would be unnecessary for just unlocking WiFi setup.)
> - (b) Use a new dedicated `/setup/validate-pin` that returns a simple boolean? (Cleaner separation.)

> [!NOTE]
> **3. `SETUP_MODE` persistence**: Currently, `setup_mode` is driven by `process.env.SETUP_MODE`. After successful provisioning, should the server automatically clear this flag (e.g., remove from environment / write to a persistent flag file), or is this managed externally by the appliance's boot script?

---

## Verification Plan

### Automated Tests
- Server: Unit test the `POST /setup/provision` endpoint with mock bcrypt + database.
- Server: Unit test `POST /setup/validate-pin` with correct and incorrect PINs.
- Frontend: Verify `WifiSetup` renders correctly with and without the new optional props (backward compatibility).

### Manual Verification
- **Scenario 1**: Set `SETUP_MODE=true`, ensure `system_config.is_onboarded = 0`. Walk through the full 4-step wizard on both mobile and desktop viewports. Verify PIN is hashed and stored, shop name is saved, WiFi connects.
- **Scenario 2**: Set `SETUP_MODE=true`, ensure `system_config.is_onboarded = 1`. Verify the PIN lock screen appears first. Enter correct PIN → WiFi step. Enter wrong PIN → error feedback.
- **Scenario 3**: Set `SETUP_MODE=false`. Navigate to Admin Settings. Verify `WifiSetup` still renders correctly as an isolated widget.
- **Responsive check**: Test on a 375px viewport (iPhone SE) and a 1440px viewport. Verify the centered card behavior on desktop and the flush full-screen behavior on mobile.
