import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '../data');
const dbPath = path.join(dataDir, 'print_spooler.db');

if (!fs.existsSync(dbPath)) {
  console.log(`[Reset Onboarding] Database file does not exist at ${dbPath}. Nothing to reset.`);
  process.exit(0);
}

try {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.prepare(`
    UPDATE system_config 
    SET is_onboarded = 0, provisioning_state = 'FIRST_BOOT', cloudflare_url = NULL, updated_at = datetime('now')
    WHERE id = 1;
  `).run();

  // Also reset cloudflare_url.txt if present
  const cloudflareUrlFile = path.join(dataDir, 'cloudflare_url.txt');
  if (fs.existsSync(cloudflareUrlFile)) {
    fs.writeFileSync(cloudflareUrlFile, '# TUNNEL_DISABLED (System Reset to Un-onboarded State)\n');
  }

  console.log('---------------------------------------------------------');
  console.log('✅ [Reset Onboarding] Success! is_onboarded set to 0 (false).');
  console.log('   Target database: server/data/print_spooler.db');
  console.log('   On next server start, the terminal will require Onboarding.');
  console.log('---------------------------------------------------------');
} catch (error: any) {
  console.error('❌ [Reset Onboarding] Failed to reset onboarding state in SQLite:', error.message || error);
  process.exit(1);
}
