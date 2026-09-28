export interface ErrorMapping {
  title: string;
  defaultMessage: string;
}

export const ERROR_CODE_MAP: Record<string, ErrorMapping> = {
  // Auth & Session
  AUTH_TOKEN_MISSING: { title: "Authentication Required", defaultMessage: "Please log in to continue." },
  AUTH_TOKEN_INVALID: { title: "Session Expired", defaultMessage: "Your admin session has expired. Please log in again." },
  SESSION_MISSING: { title: "Session Missing", defaultMessage: "Customer kiosk session ID is missing." },
  SESSION_INVALID: { title: "Session Expired", defaultMessage: "Your kiosk session has expired. Initializing new session..." },
  AUTH_LOGIN_FAILED: { title: "Login Failed", defaultMessage: "Invalid PIN. Please verify your admin credentials." },
  SETUP_SKIP_FORBIDDEN: { title: "Action Restricted", defaultMessage: "Wi-Fi setup cannot be skipped in maintenance mode." },

  // Validation
  VALIDATION_PIN_REQUIRED: { title: "PIN Required", defaultMessage: "Please enter your admin PIN." },
  VALIDATION_TOKEN_REQUIRED: { title: "Token Required", defaultMessage: "No token provided for logout." },
  VALIDATION_SSID_REQUIRED: { title: "SSID Required", defaultMessage: "Wi-Fi network SSID is required." },
  VALIDATION_FILE_REQUIRED: { title: "No File Selected", defaultMessage: "Please attach a document or image to print." },
  VALIDATION_MISSING_FIELDS: { title: "Missing Information", defaultMessage: "Please fill in all required calculation fields." },
  VALIDATION_PRINTER_NAME_REQUIRED: { title: "Printer Name Required", defaultMessage: "Target printer name must be specified." },
  VALIDATION_ALIAS_REQUIRED: { title: "Alias Required", defaultMessage: "Printer alias cannot be empty." },
  VALIDATION_URI_REQUIRED: { title: "URI Required", defaultMessage: "Missing printer URI or raw model name." },
  VALIDATION_CAPABILITIES_FORMAT: { title: "Format Error", defaultMessage: "Capabilities payload must be a list." },
  VALIDATION_PRIORITY_REQUIRED: { title: "Priority Value Required", defaultMessage: "Priority level is required." },

  // Hardware & Infrastructure
  WIFI_AUTH_FAILED: { title: "Wi-Fi Authentication Failed", defaultMessage: "Invalid passphrase. Please verify security key." },
  WIFI_CONNECTION_FAILED: { title: "Wi-Fi Connection Failed", defaultMessage: "Could not connect to the selected wireless network." },
  WIFI_NETWORK_NOT_FOUND: { title: "Network Out of Range", defaultMessage: "Target Wi-Fi network is out of range or no longer broadcasting." },
  WIFI_SCAN_FAILED: { title: "Scan Failed", defaultMessage: "Unable to scan local wireless networks." },
  CLOUDFLARE_TUNNEL_TIMEOUT: { title: "Tunnel Setup Failed", defaultMessage: "Remote access tunnel timed out. Verify WAN connection." },
  CLOUDFLARE_BINARY_MISSING: { title: "Tunnel Binary Missing", defaultMessage: "Cloudflare tunnel binary is not installed on system PATH." },
  CLOUDFLARE_PROCESS_ERROR: { title: "Tunnel Execution Error", defaultMessage: "Cloudflare tunnel process exited unexpectedly." },
  INTERNET_FAILED: { title: "Internet Verification Failed", defaultMessage: "Wi-Fi connected but Internet access could not be verified." },
  TUNNEL_FAILED: { title: "Remote Access Failed", defaultMessage: "Cloudflare tunnel could not be established." },
  PROVISION_TIMEOUT: { title: "Provisioning Timed Out", defaultMessage: "The terminal setup process exceeded the maximum allowed time." },
  NETWORK_RECOVERY_ACTIVE: { title: "Recovery Hotspot Active", defaultMessage: "Emergency recovery access point is active due to prolonged WAN connectivity failure." },
  SETUP_PROVISION_FAILED: { title: "Setup Provisioning Failed", defaultMessage: "Failed to apply system setup configuration." },
  HARDWARE_POLLING_TIMEOUT: { title: "Connection Timed Out", defaultMessage: "Connection polling timed out. Please check hardware connection." },
  PRINTER_CONFIGURE_FAILED: { title: "Setup Failed", defaultMessage: "Failed to configure CUPS queue or hardware adapter." },
  PRINTER_UNSUPPORTED_URI: { title: "Unsupported Device", defaultMessage: "Printer URI scheme is not supported by system adapters." },
  CUPS_COMMAND_FAILED: { title: "CUPS Execution Fault", defaultMessage: "CUPS printing daemon command failed." },

  // Resources
  JOB_NOT_FOUND: { title: "Job Not Found", defaultMessage: "The specified print job no longer exists in queue." },
  JOB_NO_CUPS_ID: { title: "Job State Conflict", defaultMessage: "Job has no active CUPS print process." },
  PRINTER_ADAPTER_NOT_FOUND: { title: "Printer Not Found", defaultMessage: "No compatible adapter found for this printer." },

  // Internal Fallback
  INTERNAL_SERVER_ERROR: { title: "System Error", defaultMessage: "An unexpected server error occurred." },
};

export function mapApiError(payload: any): { title: string; description: string } {
  const code = payload?.error?.code || payload?.code || "INTERNAL_SERVER_ERROR";
  const serverMessage = payload?.error?.message || payload?.message;
  const mapping = ERROR_CODE_MAP[code];

  if (mapping) {
    return {
      title: mapping.title,
      description: serverMessage || mapping.defaultMessage,
    };
  }

  return {
    title: "Request Error",
    description: serverMessage || "An unexpected error occurred while communicating with server.",
  };
}
