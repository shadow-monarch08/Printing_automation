import db from '../../infrastructure/database';

export function getSystemConfig() {
  const row = db.prepare(`SELECT * FROM system_config WHERE id = 1`).get() as any;
  if (!row) return null;
  return {
    isOnboarded: Boolean(row.is_onboarded),
    cloudflareUrl: row.cloudflare_url,
    shopName: row.shop_name,
    adminPinHash: row.admin_pin_hash,
    updatedAt: row.updated_at
  };
}

export function updateSystemConfig(data: {
  isOnboarded?: boolean;
  cloudflareUrl?: string | null;
  shopName?: string;
  adminPinHash?: string | null;
}) {
  const current = getSystemConfig() || {
    isOnboarded: false,
    cloudflareUrl: null,
    shopName: 'Modern Press',
    adminPinHash: null
  };

  const isOnboarded = data.isOnboarded !== undefined ? data.isOnboarded : current.isOnboarded;
  const cloudflareUrl = data.cloudflareUrl !== undefined ? data.cloudflareUrl : current.cloudflareUrl;
  const shopName = data.shopName !== undefined ? data.shopName : current.shopName;
  const adminPinHash = data.adminPinHash !== undefined ? data.adminPinHash : current.adminPinHash;

  const stmt = db.prepare(`
    INSERT INTO system_config (id, is_onboarded, cloudflare_url, shop_name, admin_pin_hash, updated_at)
    VALUES (1, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      is_onboarded = excluded.is_onboarded,
      cloudflare_url = excluded.cloudflare_url,
      shop_name = excluded.shop_name,
      admin_pin_hash = excluded.admin_pin_hash,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    isOnboarded ? 1 : 0,
    cloudflareUrl,
    shopName,
    adminPinHash
  );

  return getSystemConfig();
}
