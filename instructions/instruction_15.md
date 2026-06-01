**System Role & Objective:**
You are an expert Full-Stack TypeScript Developer specializing in React, Node.js, and Linux networking (NetworkManager/nmcli). Your task is to upgrade a Raspberry Pi Captive Portal Wi-Fi Setup application.

**Current Architecture Context:**

* **Backend:** Express.js + TypeScript. Interacts with the OS via a custom `runSecureCommand` wrapper (using `execFile`).
* **Frontend:** React + TypeScript + Tailwind CSS.

Please implement the following updates across the stack:

### 1. Backend Updates (`wifi.service.ts`)

Update the `scanNetworks()` function to force a physical hardware rescan before fetching the network list.

* Execute `runSecureCommand('nmcli', ['device', 'wifi', 'rescan'])` before the existing list command.
* Wrap the `rescan` command in a `try/catch` block. If it fails (due to NetworkManager rate-limiting/throttling), log a warning but DO NOT throw the error. Proceed immediately to the `list` command.
* Ensure the subsequent list command `nmcli -t -f ssid,signal dev wifi` continues to deduplicate SSIDs and passes the `signal` strength as an integer to the frontend.

### 2. Frontend Updates (`WifiSetup.tsx`)

Completely rewrite the `<WifiSetup />` component to use a mobile-first, tabular list view instead of a dropdown.

**State Management Requirements:**

* `networks`: Array of objects containing `ssid` and `signal`.
* `isScanning`: Boolean for the refresh button loading state.
* `selectedSsid`: String | null to track which row's accordion is open.
* `password`: String for the active network password.
* `isConnecting`: Boolean for the submit button loading state.

**UI/UX & Tailwind Requirements:**

* **Layout:** A centered column with a max-width (e.g., `max-w-md`) so it looks like a native mobile app even on a PC browser.
* **Header:** Include a title and a "Refresh List" button. The button must show a loading state tied to `isScanning`.
* **Network List:** Render a vertical list of available networks.
* **Signal Icons:** Do not just print the signal percentage. Create a helper function that returns an inline SVG Wi-Fi icon (0 bars, 1 bar, 2 bars, 3 bars) based on the `signal` integer. Render this icon next to the SSID.
* **Modal Accordion:** When a user taps a network row, open the custom modal component containing the password input and "Join Network" button.
* **Input Bug Prevention:** The password `<input>` must be `type="password"`. Do **not** use `maxLength` or `type="number"` attributes, as these break Captive Network Assistant mini-browsers on macOS/Windows.