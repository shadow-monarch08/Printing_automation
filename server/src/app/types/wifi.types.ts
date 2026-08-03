export interface ConnectPayload {
  ssid?: string;
  profileName?: string;
  password?: string;
  skipWifi?: boolean;
}

export interface WiFiNetwork {
  ssid: string;
  signal: number;
  isActive?: boolean;
  isSaved?: boolean;
  profileName?: string;
}
