import db from "./database";
import { startHeartbeatLoop as runHeartbeatSweep } from "../app/services/printer.service";
import { getActiveConnectionProfile } from "../app/utils/network.utils";

export interface SystemConfigRow {
  id: number;
  is_onboarded: number;
  cloudflare_url: string | null;
  shop_name: string;
  admin_pin_hash: string | null;
  provisioning_state: string;
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
  globalSystemConfig = (db.prepare("SELECT * FROM system_config WHERE id = 1").get() as SystemConfigRow | undefined) || null;
  globalPricingConfig = (db.prepare("SELECT * FROM pricing_config WHERE id = 1").get() as PricingConfigRow | undefined) || null;

  // Auto-detect RECOVERY state if un-onboarded in DB but an active Wi-Fi connection profile exists
  if (globalSystemConfig && !globalSystemConfig.is_onboarded && globalSystemConfig.provisioning_state === "FIRST_BOOT") {
    try {
      const activeProfile = await getActiveConnectionProfile();
      if (activeProfile && activeProfile !== "Kiosk-Hotspot") {
        console.log(`[Boot] 🔄 Active connection profile "${activeProfile}" detected. Setting provisioning_state to RECOVERY.`);
        db.prepare("UPDATE system_config SET provisioning_state = 'RECOVERY', updated_at = datetime('now') WHERE id = 1").run();
        globalSystemConfig = (db.prepare("SELECT * FROM system_config WHERE id = 1").get() as SystemConfigRow | undefined) || null;
      }
    } catch (err) {
      console.warn("[Boot] Could not check active connection profile during boot hydration:", err);
    }
  }

  await runHeartbeatSweep();
}


