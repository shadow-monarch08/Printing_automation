import db from '../../infrastructure/database';
import { globalSystemConfig, setGlobalSystemConfig, SystemConfigRow } from '../../infrastructure/boot';

export function getSystemConfig() {
  if (!globalSystemConfig) return null;
  return {
    isOnboarded: Boolean(globalSystemConfig.is_onboarded),
    cloudflareUrl: globalSystemConfig.cloudflare_url,
    shopName: globalSystemConfig.shop_name,
    adminPinHash: globalSystemConfig.admin_pin_hash,
    provisioningState: globalSystemConfig.provisioning_state || (globalSystemConfig.is_onboarded ? 'READY' : 'FIRST_BOOT'),
    updatedAt: globalSystemConfig.updated_at
  };
}

export function updateSystemConfig(data: {
  isOnboarded?: boolean;
  cloudflareUrl?: string | null;
  shopName?: string;
  adminPinHash?: string | null;
  provisioningState?: string;
}) {
  const current = getSystemConfig() || {
    isOnboarded: false,
    cloudflareUrl: null,
    shopName: 'Modern Press',
    adminPinHash: null,
    provisioningState: 'FIRST_BOOT'
  };

  const isOnboarded = data.isOnboarded !== undefined ? data.isOnboarded : current.isOnboarded;
  const cloudflareUrl = data.cloudflareUrl !== undefined ? data.cloudflareUrl : current.cloudflareUrl;
  const shopName = data.shopName !== undefined ? data.shopName : current.shopName;
  const adminPinHash = data.adminPinHash !== undefined ? data.adminPinHash : current.adminPinHash;
  const provisioningState = data.provisioningState !== undefined ? data.provisioningState : current.provisioningState;

  const stmt = db.prepare(`
    INSERT INTO system_config (id, is_onboarded, cloudflare_url, shop_name, admin_pin_hash, provisioning_state, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      is_onboarded = excluded.is_onboarded,
      cloudflare_url = excluded.cloudflare_url,
      shop_name = excluded.shop_name,
      admin_pin_hash = excluded.admin_pin_hash,
      provisioning_state = excluded.provisioning_state,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    isOnboarded ? 1 : 0,
    cloudflareUrl,
    shopName,
    adminPinHash,
    provisioningState
  );

  const newRow = db.prepare(`SELECT * FROM system_config WHERE id = 1`).get() as SystemConfigRow | undefined;
  setGlobalSystemConfig(newRow || null);

  return getSystemConfig();
}

