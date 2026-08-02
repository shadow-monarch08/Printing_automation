import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'print_spooler.db');
const db: DatabaseType = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS kiosk_sessions (
  session_id TEXT PRIMARY KEY,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS system_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_onboarded BOOLEAN NOT NULL DEFAULT 1,
  cloudflare_url TEXT,
  shop_name TEXT DEFAULT 'Modern Press',
  admin_pin_hash TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS printers (
  id TEXT PRIMARY KEY,
  alias TEXT,
  capabilities TEXT DEFAULT '[]',
  ipp_uri TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pricing_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  base_price_bw INTEGER NOT NULL DEFAULT 200,    -- Prices in Paise/Cents
  base_price_color INTEGER NOT NULL DEFAULT 1000,
  duplex_discount_percent INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

UPDATE system_config SET is_onboarded = 1;

INSERT OR IGNORE INTO pricing_config (id, base_price_bw, base_price_color, duplex_discount_percent) VALUES (1, 200, 1000, 0);

CREATE TABLE IF NOT EXISTS print_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  pages INTEGER NOT NULL DEFAULT 1,
  copies INTEGER NOT NULL DEFAULT 1,
  color_mode TEXT NOT NULL DEFAULT 'grayscale',
  duplex TEXT NOT NULL DEFAULT 'single',
  cost INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  executed_by_printer TEXT,
  error_message TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (session_id) REFERENCES kiosk_sessions(session_id),
  FOREIGN KEY (executed_by_printer) REFERENCES printers(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  print_job_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'initiated',
  gateway TEXT,
  gateway_reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (print_job_id) REFERENCES print_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_submitted_at ON print_jobs(submitted_at);
CREATE INDEX IF NOT EXISTS idx_print_jobs_printer ON print_jobs(executed_by_printer);
CREATE INDEX IF NOT EXISTS idx_print_jobs_color ON print_jobs(color_mode);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON kiosk_sessions(expires_at);
`);

try {
  db.exec(`ALTER TABLE printers ADD COLUMN ipp_uri TEXT`);
} catch (e) {
  // Column already exists
}

console.log("🗄️ SQLite Cold Tier initialized (WAL mode)");

export default db;
