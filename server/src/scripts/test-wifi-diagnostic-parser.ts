import { parseDetailedWifiError } from "../app/services/wifi.service";

console.log("=== Testing Wi-Fi Diagnostic Error Parser ===");

const testCases = [
  {
    name: "1. Saved Profile Expired / Secrets Required",
    raw: "Error: Connection activation failed: Secrets were required, but not provided",
    target: "netplan-wlan0-spam4G",
    isSaved: true,
    expectedCode: "WIFI_SAVED_PROFILE_EXPIRED",
  },
  {
    name: "2. Wrong Passphrase on New Network",
    raw: "Error: Connection activation failed: 802-11-wireless-security.psk: property is invalid",
    target: "Office-Guest",
    isSaved: false,
    expectedCode: "WIFI_AUTH_FAILED",
  },
  {
    name: "3. 4-Way Handshake Failure (Deauth/Auth rejection)",
    raw: "Error: Connection activation failed: (8) WPA: 4-Way Handshake failed - pre-shared key may be incorrect",
    target: "CoffeeShop",
    isSaved: false,
    expectedCode: "WIFI_AUTH_FAILED",
  },
  {
    name: "4. Network Out of Range / Not Found",
    raw: "Error: Connection activation failed: No network with SSID 'GhostNetwork' found.",
    target: "GhostNetwork",
    isSaved: false,
    expectedCode: "WIFI_NETWORK_NOT_FOUND",
  },
  {
    name: "5. Radio Disabled / Soft-Blocked",
    raw: "Error: Connection activation failed: Device 'wlan0' is not available: Wi-Fi is disabled",
    target: "HomeNetwork",
    isSaved: false,
    expectedCode: "WIFI_RADIO_BLOCKED",
  },
  {
    name: "6. Radio Mode Transition Interrupted",
    raw: "Error: Connection activation failed: The base network connection was interrupted",
    target: "HomeNetwork",
    isSaved: false,
    expectedCode: "WIFI_INTERRUPTED",
  },
  {
    name: "7. DHCP Lease Acquisition Failure",
    raw: "Error: Connection activation failed: IP configuration could not be reserved (no lease, etc.)",
    target: "RouterNoDHCP",
    isSaved: false,
    expectedCode: "WIFI_DHCP_FAILED",
  },
  {
    name: "8. Supplicant Association Timeout",
    raw: "Error: Connection activation failed: Association took too long",
    target: "WeakSignalAP",
    isSaved: false,
    expectedCode: "WIFI_TIMEOUT",
  },
];

let failed = 0;
for (const tc of testCases) {
  const result = parseDetailedWifiError(tc.raw, tc.target, tc.isSaved);
  const pass = result.code === tc.expectedCode;
  if (pass) {
    console.log(`[PASS] ${tc.name} => Code: ${result.code} | Msg: "${result.message}"`);
  } else {
    console.error(`[FAIL] ${tc.name} => Expected: ${tc.expectedCode}, Got: ${result.code}`);
    failed++;
  }
}

if (failed === 0) {
  console.log(`\nALL ${testCases.length} DIAGNOSTIC PARSER TESTS PASSED!`);
  process.exit(0);
} else {
  console.error(`\n${failed} TESTS FAILED.`);
  process.exit(1);
}
