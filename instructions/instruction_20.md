# System Role & Task
You are an Expert Full-Stack TypeScript Developer specializing in React, Node.js, and Linux networking. 

Your objective is to refactor our Wi-Fi connection logic to gracefully handle Linux/Netplan saved profiles. We are separating the connection logic into two explicit flows based on whether a network is already known to the Raspberry Pi's NetworkManager.

# The CLI Data Sources
You must extract the data for our interfaces from these specific commands:
1. **The `ssid` field:** Must be parsed exclusively from the output of:
   `nmcli -t -f IN-USE,SSID,SIGNAL dev wifi` (This represents the live airwaves).
2. **The `profileName` field:** Must be parsed exclusively from the output of:
   `nmcli -t -f NAME connection show` (This represents saved profiles/Netplan configurations).

---

# Phase 1: The API Data Contract

Update the API types shared between the frontend and backend. The frontend will now explicitly send the `profileName` if the network is saved.

```typescript
// The Network object mapped from the scan
interface Network {
  ssid: string; 
  signal: number;
  isActive: boolean;
  isSaved: boolean;
  profileName?: string | null; // e.g., 'netplan-wlan0-spam4G'
}

// The exact JSON body sent in the POST /connect request
interface ConnectPayload {
  ssid: string;          // ALWAYS sent (for logging/UI purposes)
  profileName?: string;  // SENT ONLY if the network isSaved === true
  password?: string;     // SENT ONLY if the network is new
}

```

---

# Phase 1.5: The Netplan Mapping Logic (Backend Scanner)

When merging the results of the two CLI commands to build the `Network[]` array, you must account for OS-generated profiles. Netplan often prefixes saved profiles with `netplan-wlan0-[SSID]`.

Update your parsing logic so that a live `ssid` is flagged as `isSaved: true` if the saved profiles array contains EITHER the exact `ssid` OR the prefixed version.

**Required Mapping Logic Implementation:**

```typescript
// Assume `savedProfiles` is an array of strings from `nmcli connection show`
// Assume `ssid` is the current network name from the live scan loop

const matchedProfile = savedProfiles.find(profile => 
    profile === ssid || profile === `netplan-wlan0-${ssid}`
);

const networkObject: Network = {
    ssid: ssid,
    // ...other fields...
    isSaved: !!matchedProfile,
    profileName: matchedProfile || null
};

```

---

# Phase 2: Refactor the Frontend API Call (React)

Update the connection submit handler inside the React modal component.

**The Logic:**
When the user submits the form or clicks "Connect", assemble the `ConnectPayload` based on the selected `Network` object:

1. **If `network.isSaved === true`:**
Send: `{ ssid: network.ssid, profileName: network.profileName }`
*(Do not include the password field).*
2. **If `network.isSaved === false`:**
Send: `{ ssid: network.ssid, password: userTypedPassword }`
*(Do not include the profileName field).*

*Do not change any visual UI, layout, or CSS tokens. Only update the payload formatting before the API call.*

---

# Phase 3: Refactor the Backend Controller (Node.js)

Update the `connectToWifi` Express controller/service to process the `ConnectPayload`.

**The Logic Flow:**

### Flow A: Known Network (Triggered by the presence of `profileName`)

If `req.body.profileName` exists, completely ignore the password and SSID for connection purposes.

* **Execute:** `sudo nmcli connection up "<req.body.profileName>"`

### Flow B: New Network (Triggered by the lack of `profileName`)

If `req.body.profileName` is undefined/falsy, fall back to the `req.body.ssid` and `req.body.password`. Implement the declarative 3-step creation flow:

1. **Delete:** `sudo nmcli connection delete "<req.body.ssid>"` *(Catch and ignore errors here)*
2. **Add:** `sudo nmcli connection add type wifi ifname wlan0 con-name "<req.body.ssid>" ssid "<req.body.ssid>" wifi-sec.key-mgmt wpa-psk wifi-sec.psk "<req.body.password>"`
3. **Up:** `sudo nmcli connection up "<req.body.ssid>"`

**Reference Implementation:**

```typescript
export const connectToWifi = async (payload: ConnectPayload) => {
  const { ssid, profileName, password } = payload;

  // FLOW A: Saved Network
  if (profileName) {
    return runSecureCommand('sudo', ['nmcli', 'connection', 'up', profileName]);
  }

  // FLOW B: New Network
  if (!password) throw new Error("Password is required for new networks");

  try {
    // Attempt cleanup of ghost profiles, ignore if it fails
    await runSecureCommand('sudo', ['nmcli', 'connection', 'delete', ssid]);
  } catch (e) { /* ignored */ }

  await runSecureCommand('sudo', [
    'nmcli', 'connection', 'add', 
    'type', 'wifi', 
    'ifname', 'wlan0', 
    'con-name', ssid, 
    'ssid', ssid, 
    'wifi-sec.key-mgmt', 'wpa-psk', 
    'wifi-sec.psk', password
  ]);

  return runSecureCommand('sudo', ['nmcli', 'connection', 'up', ssid]);
};

```

---

# Phase 4: Strict Modularity & Code Reuse Constraints

* **No Redundancy:** Do NOT re-create or rewrite existing utility wrappers like `runSecureCommand` or existing network parser boilerplate.
* **Keep Things Modular:** Integrate this logic directly into the existing controller and service files. Do not create new, disconnected files or endpoints for this change.
* **Locality of Change:** Modify only the specific block parsing the arrays and the specific block executing the execution commands. Leave the surrounding server configurations, error-handling middleware, and layout setups fully intact.