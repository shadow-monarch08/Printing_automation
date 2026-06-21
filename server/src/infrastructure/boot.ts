import db from "./database";
import { startHeartbeatLoop as runHeartbeatSweep } from "../app/services/printer.service";

export interface SystemConfigRow {
  id: number;
  is_onboarded: number;
  cloudflare_url: string | null;
  shop_name: string;
  admin_pin_hash: string | null;
  updated_at: string;
}

export interface PricingConfigRow {
  id: number;
  base_price_bw: number;
  base_price_color: number;
  duplex_discount_percent: number;
  updated_at: string;
}

export let globalPricingConfig: PricingConfigRow | null = null;
export let globalSystemConfig: SystemConfigRow | null = null;

export function setGlobalSystemConfig(config: SystemConfigRow | null) {
  globalSystemConfig = config;
}

export function setGlobalPricingConfig(config: PricingConfigRow | null) {
  globalPricingConfig = config;
}

export async function hydrateSystem() {
  globalSystemConfig = db.prepare("SELECT * FROM system_config WHERE id = 1").get() as SystemConfigRow | undefined || null;
  globalPricingConfig = db.prepare("SELECT * FROM pricing_config WHERE id = 1").get() as PricingConfigRow | undefined || null;
  await runHeartbeatSweep();
}

