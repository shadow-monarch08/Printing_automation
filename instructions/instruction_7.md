# SYSTEM CONTEXT
You are an expert Full-Stack IoT Engineer. We are building a "Smart Bulb" style Wi-Fi onboarding flow (Captive Portal) for an embedded Raspberry Pi appliance running Node.js (Express) and React (TypeScript + Tailwind). 

The hardware boot script has already placed the Pi into Hotspot Mode (`10.42.0.1`) and started `dnsmasq` to force a captive portal pop-up on the user's smartphone. 

Your job is to build the Backend Service to interface with Linux `nmcli`, the Express routes, and the React UI that the user interacts with on their phone.

---

# 1. BACKEND REQUIREMENTS (Node.js/Express)

## A. Service Layer: `services/wifi.service.ts`
Create a service to interface with the Linux NetworkManager using `child_process.exec`.
* **`scanNetworks()`:** * Execute: `nmcli -t -f ssid,signal dev wifi`
    * Parse the output. Remove empty/hidden SSIDs (where SSID is `--` or empty).
    * Deduplicate networks with the same name (common with 2.4/5Ghz bands).
    * Sort the array by signal strength descending.
    * Return: `Array<{ ssid: string, signal: number }>`
* **`connectToNetwork(ssid, password)`:**
    * Execute: `sudo nmcli device wifi connect "<ssid>" password "<password>"`
    * Wrap in a try/catch and return a boolean success state.

## B. API Routes: `routes/wifi.routes.ts`
* **`GET /api/wifi/scan`:** Calls the service and returns the network array.
* **`POST /api/wifi/connect`:** Takes `{ ssid, password }`.
    * **CRITICAL HARDWARE CONSTRAINT:** Do NOT await the `connectToNetwork` command before sending the HTTP response. The moment `nmcli` runs, the Pi's hotspot will shut down, physically severing the HTTP connection. 
    * You MUST return a `200 OK` JSON response immediately (e.g., "Applying credentials..."), and then execute the connection command inside a `setTimeout` of 1000ms.

---

# 2. FRONTEND REQUIREMENTS (React)

## A. Captive Portal UI: `components/WifiSetup.tsx`
Create a standalone setup component. 
* **States:** `scanning` (loading spinner), `ready` (form), `connecting` (success message).
* **On Mount:** Fetch `/api/wifi/scan`.
* **Form:** * A clean `<select>` dropdown populated with the scanned SSIDs (displaying signal strength).
    * A password `<input>` that only appears after an SSID is selected.
    * A Submit button (disabled if form is incomplete).
* **On Submit:** * POST to `/api/wifi/connect`. 
    * Change state to `connecting`. 
    * Display a persistent message: *"Applying credentials. The Spooler will now reboot its network. Please close this window and reconnect your phone to your main Wi-Fi."*
    * Catch and swallow any subsequent network errors, as the connection *will* drop violently.

## B. Global Routing Integration: `App.tsx`
* Assume there is a global state or initial API check that determines if the app is in `SETUP_MODE`. 
* Write the conditional rendering logic: If `SETUP_MODE` is true, render `<WifiSetup />`. Otherwise, render the main `<AdminDashboard />`.

---

# 3. UI/UX CONSTRAINTS (Tailwind CSS)
* **Mobile-First:** Captive portals are almost exclusively opened on smartphones. Ensure padding, tap targets, and font sizes are optimized for mobile screens.
* **No External Assets:** The Raspberry Pi has NO internet access during this phase. You CANNOT use external CDN links for fonts (like Google Fonts) or external images. All CSS must be bundled Tailwind, and icons must be inline SVG.
* **Branding:** Keep it clean, enterprise-grade, and minimal. Use a neutral gray background (`bg-gray-50`), a crisp white card for the form (`bg-white shadow-md`), and standard blue/indigo accents for buttons and spinners. Ensure high contrast for readability outdoors.