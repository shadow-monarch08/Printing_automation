# Master Prompt: Deterministic Wi-Fi Onboarding Engine & Reconnection Architecture

You are tasked with implementing the **Deterministic Wi-Fi Onboarding & Reconnection Engine** across the backend (`wifi.service.ts`, `wifi.routes.ts`) and frontend onboarding UI (`Step2WifiSetup.tsx`).

### Core Architecture Goal

When a user configures shop Wi-Fi credentials via the temporary setup Access Point (AP), the Raspberry Pi's single Wi-Fi radio (`wlan0`) must tear down its hotspot AP to join the target router.

To prevent false positives (such as wrong passwords or timeouts being mistaken for success), you will implement a **Redis-backed transient state machine** on the backend and an **Explicit Disconnect Window (36-Second Rule)** on the frontend.

---

## 1. Backend Engine & State Management Architecture

### A. Redis Transient State Machine

Do NOT perform disk-heavy SQLite reads during high-frequency client polling. Use the existing **Redis store** to manage transient connection states.

* **Redis Key Structure:** Use a dedicated key (e.g., `wifi:connection:status`) with an expiry TTL (e.g., 120 seconds).
* **State Payload Object Schema:**
```typescript
{
  status: 'idle' | 'connecting' | 'success' | 'failed',
  error?: string,
  timestamp: number
}

```


* **State Lifecycle:**
1. **Initialization:** Set state to `'connecting'` in Redis when credentials are submitted.
2. **Failure:** Update state to `'failed'` with specific error descriptions when authentication or DHCP fails.
3. **Success:** Update state to `'success'` when the connection succeeds. Write permanent configuration (`shop_name`, `admin_pin_hash`, `is_onboarded = 1`) to SQLite **only once**, and write the public tunnel URL to `server/data/cloudflare_url.txt`.



### B. Non-Blocking Async Connection & Fail-Fast Timeouts

1. When credentials are submitted via `POST /api/wifi/connect`, handle `nmcli` execution asynchronously in a background task so the initial HTTP submission returns immediately.
2. Enforce a **strict 15-second timeout** on the connection attempt (`nmcli --wait 15 dev wifi connect...`).
3. **If Connection Fails (Wrong Password / Timeout / Out of Range):**
* Automatically re-enable the hotspot AP (`nmcli connection up Kiosk-Hotspot`).
* Store the explicit failure reason in Redis: `{ status: 'failed', error: '...' }`.


4. **If Connection Succeeds:**
* Store `{ status: 'success' }` in Redis.
* Launch the Cloudflare tunnel service and persist the active public URL.



### C. Fast Polling Route

* Implement/update `GET /api/wifi/connection-status`.
* This route MUST read directly from Redis (`0ms` disk I/O, no SQLite overhead) and return the JSON state object.

---

## 2. Frontend Polling State Machine (The 36-Second Disconnect Window)

The frontend must handle the physical radio teardown, mobile OS auto-reconnection behavior, and potential cellular data fallbacks smoothly inside `Step2WifiSetup.tsx`.

### A. Submission & Visual Overlay

* Upon submitting Wi-Fi credentials, trigger a full-screen industrial modal overlay reading `"CONNECTING TERMINAL TO WI-FI..."`.
* Initiate an HTTP polling loop to `[http://192.168.4.1:3000/api/wifi/connection-status](http://192.168.4.1:3000/api/wifi/connection-status)` every **2000ms** (using short fetch timeouts, e.g., 1800ms).

### B. Deterministic Branching Rules

1. **Explicit Backend Response Branch:**
* If a poll returns HTTP 200 and the Redis payload reads `{ status: 'failed', error }`:
* Immediately stop polling and cancel the overlay.
* Display an industrial error toast (`"Connection Failed: <error>"`), allowing the user to correct their passphrase on Step 2.


* If a poll returns HTTP 200 and the payload reads `{ status: 'success' }`:
* Stop polling immediately and transition to the **Completion Screen**.




2. **Network Disconnect Branch (The 36-Second Disconnect Rule):**
* When the Pi tears down its hotspot AP to attempt connection, fetching `192.168.4.1` will throw continuous network/fetch errors.
* **Track consecutive failed poll attempts.**
* **The 36-Second Threshold:** Require **18 consecutive failed polls** (18 attempts $\times$ 2000ms = 36 seconds) before inferring true connection success.
* *Why 36 seconds:* If credentials are incorrect, the Pi will fail `nmcli` within 15 seconds, restore the AP within 5–8 seconds, and the user's phone will re-associate around second 22–24 (causing poll #12 to succeed with the `'failed'` status). Passing 36 seconds without AP re-association mathematically guarantees that the Pi successfully joined the shop Wi-Fi and shut down the AP.



### C. Industrial Completion View

Once success is confirmed (either via explicit Redis status or passing the 36-second threshold):

* Render a stenciled completion card adhering to theme tokens (`var(--bg-surface)`, `var(--font-mono)`).
* Display stenciled instructions telling the user to:
1. Inspect the attached HDMI kiosk display for the live Cloudflare access URL.
2. Or inspect `server/data/cloudflare_url.txt` directly on disk.



---

## 3. Verification & Acceptance Criteria

1. **Wrong Password Handling:** Submit an invalid passphrase -> Verify the Pi attempts connection for 15s, restores the hotspot AP, the mobile browser reconnects, and the UI displays an error toast without showing false success.
2. **Success Path Handling:** Submit correct credentials -> Verify the hotspot shuts down, the frontend poll fails continuously until the 36-second threshold is met, and the UI cleanly transitions to the "Setup Complete" view.
3. **Redis Performance Check:** Verify `GET /api/wifi/connection-status` queries Redis memory without triggering disk reads or SQLite lock errors during setup.
4. **Disk Persistence Check:** Confirm successful setup writes `cloudflare_url.txt` and updates SQLite onboarding flags.