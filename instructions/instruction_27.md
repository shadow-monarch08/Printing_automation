# System Role & Task
You are an Expert Embedded Linux Systems Architect and Senior Node.js Core Developer. Your task is to audit the current onboarding backend implementation, strip out placeholder code, and build a production-ready hardware orchestration layer for a Raspberry Pi kiosk.

---

# 🔎 Context: The 3-State Appliance Operational Flow
The application dynamically determines its state and API restrictions by checking the environment variable `process.env.SETUP_MODE` and the SQLite configuration state (`SELECT is_onboarded, admin_pin_hash, cloudflare_url FROM system_config WHERE id = 1`).

1. **Scenario 1: Initial Onboarding** (`SETUP_MODE === true` && `is_onboarded === false`)
   - The device acts as an open setup appliance. 
   - `POST /setup/provision` takes the user inputs, processes hardware actions, commits records to SQLite, and transitions the box out of setup mode.
2. **Scenario 2: Network Recovery Mode** (`SETUP_MODE === true` && `is_onboarded === true`)
   - The kiosk lost network connectivity and dropped back into a hotspot. 
   - The UI is explicitly locked. `POST /setup/validate-pin` handles the security challenge. Only when validated can network updates be executed.
3. **Scenario 3: Active Production** (`SETUP_MODE === false` && `is_onboarded === true`)
   - Standard execution mode. The machine uses background cron/intervals to handle internal sweeps.

---

# 🛑 Codebase Audit & Immediate Corrections

You must inspect the existing files and execute the following refactoring work immediately:

### 1. Fix the Network Disconnection Race Condition in `POST /setup/provision`
- **Current Broken Behavior:** The current handler updates the database, generates a mock URL (`https://dash.cloudflare.com`), immediately flushes a JSON response, and sets a 1-second background timeout to connect to the new Wi-Fi network. **This is fundamentally backward.** If the user submits a wrong Wi-Fi password, the database is already corrupted with `isOnboarded: true`, trapping the machine in a broken loop.
- **Correct Hardware Sequence Requirement:**
  1. Receive configuration values. Validate payloads.
  2. Perform the synchronous bcrypt hash of the `adminPin` (10 rounds).
  3. Execute the hardware Wi-Fi swap **first**. You must connect to the target Wi-Fi router and verify an outbound ping to `1.1.1.1`.
  4. Sprout the **actual** background Cloudflare Quick Tunnel daemon. Scrape the live unique string ending in `.trycloudflare.com` from its logging stream.
  5. Only if steps 3 and 4 succeed can you execute the database commit:
     `UPDATE system_config SET is_onboarded = 1, shop_name = ?, admin_pin_hash = ?, cloudflare_url = ? WHERE id = 1`
  6. Return the **real** Cloudflare URL to the frontend in the JSON response payload.
  7. Gracefully kill the Node process (`process.exit(0)`) after a short delay so the system service manager restarts the app in normal production mode.

---

# 🛠️ New Services & Refactoring Architecture

### Task 1: Build `server/src/app/services/wifi.service.ts`
Implement a bare-metal network configuration wrapper utilizing Node's `child_process`.
- Export an async function `connectToWifi(ssid: string, password?: string): Promise<void>`.
- Inside, execute the following shell command to instruct the Linux NetworkManager:
```bash
  nmcli dev wifi connect "${ssid}" password "${password}"
```

* If the exit code of the command is non-zero (indicating authorization failures, timeouts, or missing routers), reject the promise with a clear error so the controller can abort the provisioning phase and leave the database clean.

### Task 2: Build `server/src/app/services/cloudflare.service.ts`

Implement a runtime lifecycle manager for the public routing layer.

* Export an async function `startCloudflareTunnel(): Promise<string>`.
* Use `child_process.spawn` to instantiate the persistent background daemon:
```typescript
const tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:3000']);

```


* Bind an event listener to `tunnel.stderr` (Cloudflare pipes runtime logging through standard error, not standard out).
* Use a regular expression to capture the transient URL: `/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/`.
* Resolve the promise with the URL the exact millisecond it is matched. Maintain the process execution stream in the background.

### Task 3: Complete `setup.controller.ts` & Route Bindings

* **`POST /setup/provision`**: Enforce the core hardware sequence detailed above. Inject the `wifi.service` and `cloudflare.service`.
* **`POST /setup/validate-pin`**: Ensure it queries `admin_pin_hash` safely from your SQLite singleton using `better-sqlite3`. Verify the raw string parameter against the hash using `bcrypt.compare`. Do not accept dummy fallbacks if a record exists in the database.
* **`GET /wifi/setup-mode`**: Ensure it accurately aggregates both `process.env.SETUP_MODE` and the database state to return `{ isSetupMode: boolean, isOnboarded: boolean }`.

Please scan your current routes workspace, completely remove the static mock values, and provide the fully integrated system code files.