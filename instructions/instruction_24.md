# System Role & Task
You are an Expert Backend Engineer. Your task is to resolve two critical database disconnects in our kiosk backend architecture:
1. Move pricing configurations from a local JSON file to SQLite.
2. Update the authentication service to read the admin PIN hash from SQLite rather than environment variables.

# Strict Development Constraints
- Do NOT modify any frontend React code.
- Do NOT touch the `payments` or `print_jobs` tables.
- Use `better-sqlite3` standard synchronous execution methods (`.get()`, `.run()`).

---

# Phase 1: SQLite Schema Update
**Target File:** `server/src/infrastructure/database.ts`

Locate the database initialization block and add the following table creation statement:
```sql
CREATE TABLE IF NOT EXISTS pricing_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  base_price_bw INTEGER NOT NULL DEFAULT 200,    -- Prices in Paise/Cents
  base_price_color INTEGER NOT NULL DEFAULT 1000,
  duplex_discount_percent INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

```

Ensure you insert a default row `(1, 200, 1000, 0)` if it does not already exist so the system has baseline prices on first boot using `INSERT OR IGNORE`.

---

# Phase 2: Refactor Pricing Service

**Target File:** `server/src/app/services/pricing.service.ts`

1. Remove the `fs` (file system) module imports and logic completely.
2. Import the `db` singleton from `../../infrastructure/database`.
3. Refactor `getPricing()` to execute `SELECT * FROM pricing_config WHERE id = 1`. Map the database columns (snake_case) to your standard camelCase return object.
4. Refactor `updatePricing(newPricing)` to execute an `UPDATE pricing_config SET ...` query using parameterized inputs, and update the `updated_at` timestamp.

---

# Phase 3: Secure the Authentication Service

**Target File:** `server/src/app/services/auth.service.ts` (or the relevant auth controller)

1. Import the `db` singleton.
2. Refactor the login/validation function.
3. The logic must flow strictly as follows:
* Execute: `SELECT admin_pin_hash FROM system_config WHERE id = 1`.
* If the database returns a valid hash, use `bcrypt.compare` to validate the user's inputted PIN against the database hash.
* ONLY if the database row is empty/null, fall back to comparing against `process.env.ADMIN_PIN_HASH` or the default fallback.