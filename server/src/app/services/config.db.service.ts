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
    nmsDeviceId: globalSystemConfig.nms_device_id || null,
    nmsDeviceSecret: globalSystemConfig.nms_device_secret || null,
    localAccessUrl: process.env.LOCAL_ACCESS_URL || globalSystemConfig.local_access_url || 'http://piprint.local:3000/',
    updatedAt: globalSystemConfig.updated_at
  };
}

export function updateSystemConfig(data: {
  isOnboarded?: boolean;
  cloudflareUrl?: string | null;
  shopName?: string;
  adminPinHash?: string | null;
  provisioningState?: string;
  nmsDeviceId?: string | null;
  nmsDeviceSecret?: string | null;
  localAccessUrl?: string | null;
}) {
  const current = getSystemConfig() || {
    isOnboarded: false,
    cloudflareUrl: null,
    shopName: 'Modern Press',
    adminPinHash: null,
    provisioningState: 'FIRST_BOOT',
    nmsDeviceId: null,
    nmsDeviceSecret: null,
    localAccessUrl: 'http://piprint.local:3000/'
  };

  const isOnboarded = data.isOnboarded !== undefined ? data.isOnboarded : current.isOnboarded;
  const cloudflareUrl = data.cloudflareUrl !== undefined ? data.cloudflareUrl : current.cloudflareUrl;
  const shopName = data.shopName !== undefined ? data.shopName : current.shopName;
  const adminPinHash = data.adminPinHash !== undefined ? data.adminPinHash : current.adminPinHash;
  const provisioningState = data.provisioningState !== undefined ? data.provisioningState : current.provisioningState;
  const nmsDeviceId = data.nmsDeviceId !== undefined ? data.nmsDeviceId : current.nmsDeviceId;
  const nmsDeviceSecret = data.nmsDeviceSecret !== undefined ? data.nmsDeviceSecret : current.nmsDeviceSecret;
  const localAccessUrl = data.localAccessUrl !== undefined ? data.localAccessUrl : current.localAccessUrl;

  const stmt = db.prepare(`
    INSERT INTO system_config (id, is_onboarded, cloudflare_url, shop_name, admin_pin_hash, provisioning_state, nms_device_id, nms_device_secret, local_access_url, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      is_onboarded = excluded.is_onboarded,
      cloudflare_url = excluded.cloudflare_url,
      shop_name = excluded.shop_name,
      admin_pin_hash = excluded.admin_pin_hash,
      provisioning_state = excluded.provisioning_state,
      nms_device_id = excluded.nms_device_id,
      nms_device_secret = excluded.nms_device_secret,
      local_access_url = excluded.local_access_url,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    isOnboarded ? 1 : 0,
    cloudflareUrl,
    shopName,
    adminPinHash,
    provisioningState,
    nmsDeviceId,
    nmsDeviceSecret,
    localAccessUrl
  );

  const newRow = db.prepare(`SELECT * FROM system_config WHERE id = 1`).get() as SystemConfigRow | undefined;
  setGlobalSystemConfig(newRow || null);

  return getSystemConfig();
}

