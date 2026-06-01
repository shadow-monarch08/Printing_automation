# System Role & Objective
You are an Expert Full-Stack TypeScript Developer specializing in React, Node.js, and Linux networking. 

Your task is to upgrade our Raspberry Pi Captive Portal Wi-Fi Setup component. We are moving from a basic network scan to an "Intelligent Scan" that distinguishes between currently active networks, previously saved networks, and new networks.

# Strict Development Constraints
1. **Respect Existing UI/UX:** The frontend currently uses a modal-driven architecture for password input, not an inline accordion. It also uses specific design tokens (e.g., `--bg-surface`, `--accent-primary`) and a mobile-first `max-w-md` layout. Do NOT redesign the core layout. Adapt the new data states into the existing visual language.
2. **Platform Philosophy:** Keep the backend modular. Use our existing secure command execution wrapper (`execFile`) if one exists.
3. **No Heavy Refactors:** ONLY implement the new commands and logic we are missing. Update existing code ONLY if it is strictly necessary to support this new data flow.

---

# Phase 1: Backend Updates (Node.js / Express)

Update the Wi-Fi scanning service/controller to execute two specific `nmcli` commands and merge their results into a single JSON payload.

### 1. The Required Commands:
* **Get Saved Networks:** Execute `nmcli -t -f NAME connection show`. Parse this output into an array of strings representing networks the Pi already knows the password for.
* **Get Live Network Scan:** Execute `nmcli -t -f IN-USE,SSID,SIGNAL dev wifi`. (You may attempt `nmcli device wifi rescan` wrapped in a silent try/catch before running this to ensure fresh data).

### 2. The Data Merging Logic:
Parse the live network scan (which outputs lines like `*:MyHomeNetwork:85` or `:Starbucks:40`). Cross-reference them with the saved networks array to return this exact interface to the frontend:

```typescript
interface Network {
  ssid: string;
  signal: number;
  isActive: boolean; // true if the IN-USE flag was '*'
  isSaved: boolean;  // true if the SSID exists in the saved networks array
}

```

### 3. The Connection Logic:

Ensure the backend connection endpoint handles two distinct scenarios:

* **Saved network (no password provided):** Execute `nmcli connection up "<SSID>"`
* **New network (password provided):** Execute `nmcli device wifi connect "<SSID>" password "<PASSWORD>"`

---

# Phase 2: Frontend Updates (React / UI)

Update the Wi-Fi setup component to consume the new `Network[]` array and adjust the interaction logic based on the network's state.

### UX Interaction Rules:

Render each network as a row, maintaining the existing monospaced font and signal badges. The interaction changes based on the flags:

1. **If `isActive === true`:**
* Tapping the row does nothing (do not open the modal).
* Display a "Connected" indicator (e.g., a checkmark icon or a specific badge color) instead of the standard connection arrow.


2. **If `isSaved === true` (but isActive is false):**
* Tapping the row OPENS the modal.
* **Crucial:** Inside the modal, hide the password input field. Display a "Connect" button directly, as the backend already knows the password.


3. **If BOTH are false (New Network):**
* Tapping the row OPENS the modal.
* Display the standard view: the password input field and the "Join Network" button.



### Implementation Note:

Leverage the existing Modal component and state management. You only need to add conditional rendering inside the modal based on whether the currently selected network `isSaved`.