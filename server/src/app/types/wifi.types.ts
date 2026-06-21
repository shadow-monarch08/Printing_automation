export interface ConnectPayload {
  ssid: string;
  profileName?: string;
  password?: string;
}

export interface WiFiNetwork {
  ssid: string;
  signal: number;
  isActive?: boolean;
  isSaved?: boolean;
  profileName?: string;
}
