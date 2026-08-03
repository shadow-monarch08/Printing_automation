export const REDIS_KEYS = {
  FLEET_PRINTERS: "fleet:printers",
  printerState: (name: string) => `printer:${name}:state`,
  printerHealth: (name: string) => `printer:${name}:health`,
  printerStrikes: (name: string) => `printer:${name}:strikes`,
  printerInfo: (name: string) => `printer:${name}:info`,
  supplies: (name: string) => `supplies:${name}`,
  session: (id: string) => `session:${id}`,
  blacklist: (token: string) => `blacklist:${token}`,
  wifiConnectionStatus: "wifi:connection:status",
} as const;

export const REDIS_TTLS = {
  SUPPLIES: 300,   // 5 minutes in seconds
  SESSION: 43200,  // 12 hours in seconds
  WIFI_STATUS: 120, // 2 minutes transient connection TTL
} as const;
