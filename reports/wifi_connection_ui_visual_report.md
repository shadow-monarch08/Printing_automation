# Complete Onboarding Flow: Visual Screens & Component Architecture Report

This report presents a comprehensive end-to-end visual walkthrough of the **2-Step Kiosk Onboarding Architecture** (`OnboardingLayout.tsx`), detailing every screen in the flow, how the **actual codebase Wi-Fi Connection Screen (`WifiSetup.tsx`)** integrates as Step 2, the connecting state machine, and the final completion view.

---

## 1. Complete Flow Sequence & State Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                     STEP 1: IDENTITY & ADMIN PIN                       │
│  - Shop / Business Name Input                                          │
│  - 4-Digit Master Admin PIN Creation & Confirmation                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ [Click: "CONTINUE TO WI-FI ➔"]
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               STEP 2: WI-FI SETUP & LIST (`WifiSetup.tsx`)             │
│  - Real-time 2.4GHz / 5GHz SSID Scan List                              │
│  - Active Connection Card & Signal Telemetry badges                    │
│  - Network Selection Modal Dialog (`WifiConnectModalBody`)             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ [Click: "Join Network ➔"]
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  FULLSCREEN CONNECTING OVERLAY (36s)                   │
│  - Centered Card: "Applying Credentials" & Shield Icon                 │
│  - Industrial Segmented Progress Bar & 36s Timeout                     │
│  - Redis Polling (GET /wifi/connection-status every 2000ms)            │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
      [Network AP Disconnect >= 36s                │ [Explicit Failure Payload:
       OR Redis Status === 'success']                │  { status: 'failed', error }]
                    │                                │
                    ▼                                ▼
┌───────────────────────────────────────┐ ┌──────────────────────────────┐
│       STEP 3: COMPLETION VIEW         │ │ STEP 2: RECOVERY & ERROR TOAST│
│  - Emerald Checkmark Badge [ ✓ ]      │ │ - Amber Alert Toast Banner   │
│  - HDMI Display QR Code Instructions  │ │ - Preserves Selected SSID    │
│  - `server/data/cloudflare_url.txt`   │ │ - Refocuses Password Field   │
└───────────────────────────────────────┘ └──────────────────────────────┘
```

---

## 2. Screen 1: Shop Identity & Master Admin PIN (`Step1NameAndPin.tsx`)

This is the initial entry screen when the kiosk boots in setup mode (`SETUP_MODE=true` & `is_onboarded=0`). It combines business identity and security credentials into a single machined-edge control card.

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      ONBOARDING HEADER STEPS (1/2)                     │
 │  Step 1: Identity & PIN [ACTIVE ●] ──► Step 2: Wi-Fi Setup [LOCKED]   │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
 ┌───────────────────────────────────▼────────────────────────────────────┐
 │                  SHOP IDENTITY & SECURITY CREDENTIALS                  │
 │                                                                        │
 │  [ Field 1: Business / Shop Title ]                                    │
 │  SHOP NAME:     [ Modern Press Kiosk                             ]     │
 │                 Subtext: Displayed on customer receipts & tracker UI.  │
 │                                                                        │
 │  [ Field 2: 4-Digit Master Admin PIN ]                                 │
 │  CREATE PIN:    [  •  |  •  |  •  |  •  ]  (4 Numeric Digits)          │
 │                                                                        │
 │  [ Field 3: Confirm Admin PIN ]                                        │
 │  CONFIRM PIN:   [  •  |  •  |  •  |  •  ]  (Must Match PIN)            │
 │                                                                        │
 │  [ Button ]  CONTINUE TO WI-FI SETUP ➔                                 │
 └────────────────────────────────────────────────────────────────────────┘
```

### Visual & Component Details:
- **Header**: Top progress bar highlighting `[STEP 01/02] KIOSK INITIALIZATION` with active cyan LED indicator.
- **Shop Name Field**: Machined dark steel panel (`var(--bg-surface)`) with **Space Grotesk** text input.
- **PIN Keypad / Digit Slots**: 4 distinct square digit boxes with thick borders (`2px solid var(--border-default)`). Upon keypress, digits render masked bullet indicators with subtle Web Audio click feedback.
- **Validation**: Primary Safety Orange button (`CONTINUE TO WI-FI SETUP ➔`) enables only when Shop Name is non-empty and both 4-digit PIN fields match.

---

## 3. Screen 2: Codebase Wi-Fi Setup & Modal (`WifiSetup.tsx`)

After completing Step 1, the user advances to Step 2. This screen utilizes the **actual code component (`WifiSetup.tsx`)** existing in `admin-ui/src/components/user/WifiSetup.tsx`.

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │  Wi-Fi Connection Setup                       [ Refresh List 🔄 ]     │
 │  Provision the Spooler by linking it to a local hotspot               │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
 ┌───────────────────────────────────▼────────────────────────────────────┐
 │  CURRENTLY CONNECTED                                                   │
 │  ┌──────────────────────────────────────────────────────────────────┐  │
 │  │ (🛡️)  Shop_5G_Main   [Active Connection]                         │  │
 │  │      📶 Signal Strength: 92%                                     │  │
 │  └──────────────────────────────────────────────────────────────────┘  │
 │                                                                        │
 │  AVAILABLE NETWORKS                                                    │
 │  ┌──────────────────────────────────────────────────────────────────┐  │
 │  │ 📶 Shop_Guest_WiFi               [84%]                       ➔  │  │
 │  ├──────────────────────────────────────────────────────────────────┤  │
 │  │ 📶 Office_Printer_Net  [Saved]   [68%]                       ➔  │  │
 │  ├──────────────────────────────────────────────────────────────────┤  │
 │  │ 📶 Neighbor_Store                [45%]                       ➔  │  │
 │  └──────────────────────────────────────────────────────────────────┘  │
 └────────────────────────────────────────────────────────────────────────┘
```

### Visual & Component Details:
- **Top Bar Area**:
  - Title: Bold heading `"Wi-Fi Connection Setup"` with subtitle `"Provision the Spooler by linking it to a local hotspot"`.
  - Top-Right Action: Mechanical refresh button labeled **"Refresh List"** with a spinning `<RefreshCw />` icon when scanning.
- **"Currently Connected" Active Card**:
  - Highlights active Wi-Fi profile with a green border (`border: 2px solid var(--status-idle)`).
  - Contains green circular shield icon (`<ShieldCheck size={25} />`), SSID in large monospaced font (`data-mono`), `"Active Connection"` badge, and signal strength percentage (`92%`).
- **"Available Networks" Card List**:
  - A central dark surface card (`.card`) displaying clickable network rows (`.wifi-network-item-row`).
  - Left: Cyan Wi-Fi icon (`<Wifi size={20} />`).
  - Center: SSID in monospace font (`data-mono`).
  - Badges: Green `"Saved"` badge (with a green left-accent line `border-left: 4px solid var(--status-idle)` if saved) and signal percentage pill (`[ 84% ]`).
  - Right: Chevron arrow icon (`<ArrowRight size={18} />`).

### Password Modal Dialog (`WifiConnectModalBody`)
Clicking any network row opens a **Modal Dialog Popup** via `useModal()` context:

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │  Connect to Shop_Guest_WiFi                                      [X]   │
 ├────────────────────────────────────────────────────────────────────────┤
 │                                                                        │
 │  Password                                                              │
 │  [ Leave blank if open                                              ]  │
 │                                                                        │
 │                                            [ Cancel ]  [ Join Network ]│
 └────────────────────────────────────────────────────────────────────────┘
```
- **Unsaved Network**: Renders `<ValidatedInput label="Password" type="password" placeholder="Leave blank if open" />`.
- **Saved Network**: Displays text *"This network is already saved. You can connect without entering a password."*
- **Action Buttons**: Ghost `"Cancel"` button and primary `"Join Network"` button featuring a spinning loader when submitting.

---

## 4. Connecting Fullscreen Overlay (The 36-Second Disconnect Window)

When credentials are submitted from the modal (`status === 'connecting'`), the viewport displays the centered **"Applying Credentials"** card overlay:

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                                                                        │
 │                             ( 🛡️ )                                     │
 │                      Applying Credentials                              │
 │                                                                        │
 │  The Spooler will now reboot its network. Please close this           │
 │  window and reconnect your device to your main Wi-Fi.                  │
 │                                                                        │
 │             [ ❚❚❚❚❚❚❚❚❚❚❚❚❚❚❚❚❚❚❚❚░░░░░░░░░░ ] 36s Timeout             │
 │                                                                        │
 │                             ( 🔄 )                                     │
 │                                                                        │
 └────────────────────────────────────────────────────────────────────────┘
```

### Visual & Component Details:
- **Centered Card**: Dark container (`maxWidth: 440px`, `border: 2px solid var(--border-default)`).
- **Header Icon**: Large green shield icon (`<ShieldCheck size={48} />`).
- **Heading**: Bold text `"Applying Credentials"`.
- **Instructional Subtitle**: *"The Spooler will now reboot its network. Please close this window and reconnect your device to your main Wi-Fi."*
- **36s Progress Bar**: Segmented progress bar tracking network disconnects and Redis polling (`GET /wifi/connection-status` every 2000ms).

---

## 5. Screen 3: Industrial Completion View

Once 36 seconds of AP disconnect elapse or explicit success is confirmed by Redis:

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                                                                        │
 │    ┌───┐                                                               │
 │    │ ✓ │   SETUP COMPLETE & TERMINAL ONLINE                            │
 │    └───┘                                                               │
 │                                                                        │
 │  Your kiosk terminal has successfully connected to your network.       │
 │                                                                        │
 │  ┌──────────────────────────────────────────────────────────────────┐  │
 │  │ 🖥️ DISPLAY LOCATION                                              │  │
 │  │ Inspect the attached HDMI kiosk screen for the live Cloudflare   │  │
 │  │ public access QR code and URL.                                   │  │
 │  ├──────────────────────────────────────────────────────────────────┤  │
 │  │ 📁 DISK FILE BACKUP                                              │  │
 │  │ Alternatively, inspect the live access URL on disk at:           │  │
 │  │ server/data/cloudflare_url.txt                                   │  │
 │  └──────────────────────────────────────────────────────────────────┘  │
 │                                                                        │
 │  [ Button ] LAUNCH ADMIN DASHBOARD ➔                                    │
 └────────────────────────────────────────────────────────────────────────┘
```

### Visual & Component Details:
- **Emerald Badge**: Glowing checkmark icon (`[ ✓ ]`).
- **HDMI Display Instruction Card**: Directions for viewing the live Cloudflare QR code on the attached Raspberry Pi HDMI screen.
- **Disk Backup Card**: Monospace file path display (`server/data/cloudflare_url.txt`).
- **Launch CTA**: Button to enter the management dashboard directly.
