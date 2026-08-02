export interface PrinterInfo {
  name: string;
  description: string;
  status: string;
  alias?: string;
  capabilities?: string[];
  type?: string;
  ippUri?: string;
  hostIp?: string;
  paper?: string;
  supplyBlack?: number | null;
  supplyColor?: number | null;
}

export interface PrinterSupplyStatus {
  paper: "ready" | "empty" | "unknown";
  supplies: {
    black: number | null;
    color: number | null;
  };
}
