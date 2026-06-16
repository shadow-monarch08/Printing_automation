# System Role & Task
You are an Expert Technical Architect. Your objective is to update an existing markdown documentation file (`IMPLEMENTATION_PLAN_COLD_TIER.md`) to reflect our finalized SQLite database schema. 

We are moving from a standard `users` table to an ephemeral `kiosk_sessions` table, introducing a single-row `system_config` table for hardware state, and adding quarantine properties to the `printers` table.

# Target File
Open and modify: `IMPLEMENTATION_PLAN_COLD_TIER.md`

# Execution Instructions

## 1. Update the SQL Schema Definitions (Step 1.2)
Locate the `db.exec()` table creation statements in **Step 1.2**. Replace the existing SQL for `users`, `printers`, and `print_jobs`, and insert the new `system_config` table using exactly these definitions:

**kiosk_sessions table (Replaces users table):**
```sql
CREATE TABLE IF NOT EXISTS kiosk_sessions (
  session_id TEXT PRIMARY KEY,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

```

**system_config table (NEW):**

```sql
CREATE TABLE IF NOT EXISTS system_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_onboarded BOOLEAN NOT NULL DEFAULT 0,
  cloudflare_url TEXT,
  shop_name TEXT DEFAULT 'Modern Press',
  admin_pin_hash TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

```

**printers table (Updated):**

```sql
CREATE TABLE IF NOT EXISTS printers (
  id TEXT PRIMARY KEY,
  alias TEXT,
  capabilities TEXT DEFAULT '[]',
  is_quarantined BOOLEAN NOT NULL DEFAULT 0,
  strike_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

```

**print_jobs table (Updated Foreign Key):**

```sql
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

```

*Note: Keep the `payments` table definition exactly as it currently is in the document.*

## 2. Update Database Indexes (Step 1.2)

Update the index section to remove the old `idx_users_session` (since it is now a primary key) and add any relevant new ones.
Remove: `CREATE INDEX IF NOT EXISTS idx_users_session ON users(session_id);`

## 3. Update Service Signatures (Step 2.3)

Locate **Step 2.3 — Create Print Job Database Service**.

* Change the `insertJob` signature: Replace `userId: string | null;` with `sessionId: string;`.
* Change the `upsertUser(sessionId: string): string` block to instead describe a `upsertSession(sessionId: string, userAgent?: string, ipAddress?: string): void` or remove references to creating a generic user, adapting the SQL described there to: `INSERT INTO kiosk_sessions (session_id, user_agent, ip_address) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`.

## 4. Update the Controller "Seam" (Step 2.6)

Locate **Step 2.6 — Insert SQLite Record at Job Birth**.

* Update the TypeScript imports to reflect `upsertSession` instead of `upsertUser`.
* Update the code block to pass `sessionId` into the `insertJob` payload instead of `userId`.

# Strict Constraints

* Do NOT rewrite the entire document. Only target the specific Steps (1.2, 2.3, 2.6) mentioned.
* Ensure the markdown formatting (headers, code blocks) remains completely intact.