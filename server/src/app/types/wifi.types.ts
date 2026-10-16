export interface ConnectPayload {
  ssid?: string;
  profileName?: string;
  uuid?: string;
  password?: string;
  skipWifi?: boolean;
}

export interface WiFiNetwork {
  ssid: string;
  signal: number;
  isActive?: boolean;
  isSaved?: boolean;
  profileName?: string;
  uuid?: string;
  isSecured?: boolean;
  securityType?: string;
}


