# Backend Integration & Database Connection Audit Report

This report analyzes the synchronization and integration level of the various server-side subsystems with the SQLite persistence backend (Cold Tier) and Redis cache (Hot Tier). It highlights areas where data or logic is currently disconnected and identifies what needs to be linked.

---

## 📊 Summary of Integration Levels

| Subsystem | Primary Storage Layer | SQLite Table | Integration Status |
| :--- | :--- | :--- | :---: |
| **Kiosk Session Mgmt** | SQLite + Memory | `kiosk_sessions` | **100% Connected** |
| **Print Job Tracking** | SQLite + BullMQ (Redis) | `print_jobs` | **100% Connected** |
| **Printers Fleet Config** | SQLite + Redis + JSON | `printers` | **100% Connected** (Hot/Cold Separated) |
| **System Configurations** | SQLite | `system_config` | ⚠️ **Partially Connected** (PIN Hash mismatch) |
| **Pricing Policies** | local JSON file | *None* | ❌ **Disconnected** |
| **Payment Records** | *None* | `payments` | ❌ **Completely Disconnected** |
| **System Metrics Polling** | WebSocket Broadcast | *None* | ❌ **Disconnected** |

---

## 🔍 Detailed Analysis of Disconnected Subsystems

### 1. ⚠️ System Configuration (`admin_pin_hash`)
* **The Disconnect:** The `system_config` table in SQLite has a column for `admin_pin_hash`. The onboarding logic in `config.db.service.ts` updates it. However, the authentication logic in [auth.service.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/auth.service.ts) completely ignores SQLite. It reads only from:
  1. `process.env.ADMIN_PIN_HASH`
  2. A hardcoded default credential fallback (`"1234"`).
* **Fix Needed:** Update [auth.service.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/auth.service.ts) to query the `system_config` table for the hashed admin PIN, falling back to env/default values only if the database is un-onboarded.

### 2. ❌ Payments Subsystem (`payments` table)
* **The Disconnect:** The SQLite schema contains a fully-defined `payments` table containing columns for `amount`, `currency`, `status`, `gateway`, `gateway_reference_id`, and a foreign key relation linking it to `print_jobs(id)`.
* **Current State:** There are **zero CRUD queries or service integrations** in the backend code that interact with the `payments` table.
* **Fix Needed:** If the kiosk requires payment confirmation before spooling:
  1. A service needs to insert payment entries when quotes are accepted.
  2. The webhook/gateway handlers must update the payment status inside the database.
  3. Job execution flow should query the payment status before printing.

### 3. ❌ Pricing Configuration (`pricing.json` file)
* **The Disconnect:** Changing rates, duplex discounts, or bulk thresholds updates a local JSON file (`server/config/pricing.json`) via [pricing.service.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/pricing.service.ts). 
* **Implication:** The SQLite database doesn't manage pricing settings. While JSON persistence is simple, it prevents running database-level queries/analytics on historic price changes, and prevents configuring pricing via standard SQL updates.
* **Fix Option:** Migration of the pricing configuration into a SQLite table (`pricing_config`), allowing single-source management of all configurations.

### 4. ❌ System Metrics Telemetry
* **The Disconnect:** [metrics.service.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/metrics.service.ts) polls host telemetry metrics (CPU, RAM, disk space) and broadcasts it to the frontend via WebSockets.
* **Implication:** These data points are purely transient; they are never saved to SQLite. Admins cannot check historical server load, disk space trends, or error logs over time.
* **Fix Option:** Create a `system_telemetry` table in SQLite to archive metrics on a coarser interval (e.g., hourly averages) to facilitate reporting graphs without high write amplification.
