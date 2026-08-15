# UPDATE: Migrate SETUP_MODE to Persistent Provisioning + Network Recovery

The previous onboarding implementation is already complete. **Do not reimplement or redesign it.** This task is an incremental migration of the existing implementation to the new network/recovery architecture below.

First inspect the existing implementation and modify it in-place. Follow the existing architecture, naming conventions, shared components, coding standards, and platform design system. **No guessing and no unrelated refactoring.**

---

## 1. Remove `SETUP_MODE` as Runtime State

Completely migrate away from the current `.env` / `SETUP_MODE` mechanism.

Remove its use from:

- startup script
- backend
- frontend
- routing
- onboarding guards
- Wi-Fi-only rendering
- API responses
- state management

Do not simply replace the `.env` value with another environment variable.

The persistent database/system configuration becomes the source of truth for provisioning state.

Use/extend the existing `system_config` implementation rather than creating a parallel configuration store.

Provisioning should distinguish:

```text
FIRST_BOOT
RECOVERY
READY
````

Do not use Internet availability to determine onboarding state.

---

## 2. Simplify Startup

The existing `start_spooler.sh` must no longer:

* ping the Internet to determine setup mode
* set `SETUP_MODE`
* decide whether the Pi is onboarded
* continuously manage the hotspot

Move initialization into the existing bootstrap/backend architecture.

The startup script should only perform the minimum required startup/bootstrap work and launch the Node server.

Do not make bootstrap itself a continuous connectivity-monitoring loop.

---

## 3. Add `NetworkRecoveryService`

Create/extend a dedicated backend service responsible for **emergency network recovery**.

It starts with the Node server and continuously monitors connectivity.

Its responsibility is:

```text
Monitor connectivity
        ↓
Detect prolonged Internet loss
        ↓
Activate recovery hotspot
        ↓
Maintain hotspot state
        ↓
Coordinate with Wi-Fi changes
        ↓
Disable hotspot safely after recovery
```

This service is **not onboarding**.

---

## 4. Hotspot Must Be Idempotent

This is critical.

Never execute:

```text
Internet check failed
→ nmcli hotspot
```

on every monitoring interval.

Use an explicit state machine such as:

```text
ONLINE
  ↓
CONNECTIVITY_FAILURE
  ↓
GRACE_PERIOD
  ↓
HOTSPOT_ACTIVATING
  ↓
HOTSPOT_ACTIVE
```

Once `HOTSPOT_ACTIVE`, repeated failed connectivity checks must **not recreate the hotspot**.

Before activating it, verify the actual NetworkManager state.

Redis may store transient recovery state/locks, but **NetworkManager is the physical source of truth**.

The service must also recover correctly if Redis contains stale state after a reboot.

---

## 5. Grace Period + Backoff

Do not activate the hotspot because of one failed ping/check.

Use a reasonable grace period and consecutive failure threshold.

Also use bounded retry/backoff if hotspot activation itself fails.

Do not continuously spawn `nmcli` commands.

Connectivity checks must be lightweight and Raspberry-Pi friendly.

Prefer the existing network utilities, but Internet readiness should not rely exclusively on ICMP to `1.1.1.1`.

---

## 6. Hotspot Recovery Rules

### Fully onboarded + Internet available

```text
isOnboarded = true
Internet = ONLINE
Hotspot = OFF
```

Normal operation.

### Fully onboarded + prolonged Internet failure

```text
isOnboarded = true
Internet = OFFLINE
        ↓
Recovery hotspot ON
```

The platform remains fully onboarded.

### Hotspot already active

Do nothing. Do not repeatedly recreate it.

### Internet returns

Do not immediately disable the hotspot if an admin may be actively connected.

Verify stable connectivity and safely transition the hotspot off when appropriate.

---

## 7. Wi-Fi Service Coordination

The existing Wi-Fi service remains responsible for explicit Wi-Fi changes.

When an admin starts changing Wi-Fi from the Admin UI:

```text
WiFiService
    ↓
pause/suspend NetworkRecoveryService
    ↓
change Wi-Fi
    ↓
verify connection + Internet
    ↓
resume NetworkRecoveryService
```

Do NOT rely solely on deleting a Redis key as the event.

The recovery service and Wi-Fi service must never simultaneously manipulate `wlan0`/NetworkManager.

### If the new Wi-Fi succeeds

```text
Internet verified
→ safely disable recovery hotspot
→ resume normal monitoring
```

### If the new Wi-Fi fails

```text
Wi-Fi failure
→ preserve/restore previous usable connection where possible
→ recovery hotspot becomes available again
```

For recovery/database-reset onboarding, do NOT force the first-boot onboarding hotspot behavior.

---

## 8. Remove Standalone Wi-Fi Screen

The existing behavior:

```text
SETUP_MODE=true
→ replace entire website with Wi-Fi setup screen
```

must be removed.

An onboarded Pi with no Internet must still render the **normal platform UI**.

The user should access:

```text
Admin → Network / Wi-Fi
```

to repair the connection.

Do not leave stale routing/guards/components that still depend on `SETUP_MODE`.

Search the entire frontend and backend for all old setup-mode logic and migrate/remove it.

---

## 9. Add Admin Network / Wi-Fi Tab

Add a permanent Wi-Fi/Network section to the existing Admin navigation.

Reuse the existing Admin layout and existing Wi-Fi components/services.

It should allow the admin to:

* view current Wi-Fi
* view Internet connectivity
* see recovery-hotspot status
* scan available networks
* select a network
* enter credentials
* connect/change Wi-Fi
* see connection progress
* recover from failed Wi-Fi configuration

Example state:

```text
NETWORK STATUS
● OFFLINE

CURRENT NETWORK
Redmi

RECOVERY HOTSPOT
● ACTIVE

[ CHANGE WI-FI ]
```

The UI must remain usable locally through the Pi hotspot.

Cloud-dependent functionality can indicate that remote access is unavailable, but Wi-Fi repair itself must not require Internet access.

---

## 10. Preserve Existing Onboarding

Do not redesign the onboarding flow that was implemented in the previous task.

Only adapt it to the new persistent-state/network-recovery architecture.

First boot remains:

```text
FIRST_BOOT
→ onboarding
→ Wi-Fi
→ Internet
→ Cloudflare
→ success
→ READY
```

Recovery onboarding remains:

```text
RECOVERY
→ skip Wi-Fi OR change Wi-Fi
→ Internet
→ Cloudflare
→ success
→ READY
```

The existing browser reconnection, `/` entry-point, one-time handoff token, Redis ticket, and Welcome flow should continue working.

Only update them where required to remove dependencies on `SETUP_MODE`.

---

## 11. Cloudflare Must Remain Independent

Do not allow the NetworkRecoveryService to interfere with Cloudflare provisioning.

During onboarding/Wi-Fi changes:

```text
Wi-Fi connected
→ verify IP
→ verify DNS/Internet
→ Cloudflare
```

Cloudflare should only start after actual Internet readiness.

The recovery monitor must be paused during deliberate Wi-Fi transitions so it cannot race with Cloudflare/Wi-Fi provisioning.

---

## 12. Design + Coding Constraints

Strictly follow the existing platform theme and design system.

Reuse existing:

* components
* buttons
* modals
* inputs
* status indicators
* Toast system
* Admin navigation
* typography
* Tailwind/design tokens
* industrial printshop visual language

Do not introduce generic SaaS styling.

Do not introduce new dependencies unless absolutely necessary.

Do not run Node as root.

Reuse the existing secure command execution/sudo architecture.

Do not log Wi-Fi passwords, admin PINs, or handoff tokens.

---

## 13. Acceptance Criteria

The migration is complete only when:

* `SETUP_MODE` is no longer used as application state.
* Internet loss does not force the application into a standalone Wi-Fi screen.
* Persistent provisioning state is the source of truth.
* `NetworkRecoveryService` owns emergency hotspot recovery.
* Hotspot activation is idempotent.
* Already-active hotspot is never recreated every polling interval.
* Grace period prevents hotspot flapping.
* Redis stale state cannot permanently prevent recovery.
* Wi-Fi changes pause recovery monitoring.
* Recovery monitoring resumes after Wi-Fi changes.
* Admin has a permanent Network/Wi-Fi tab.
* Wi-Fi can be repaired locally through the normal Admin UI.
* First-boot onboarding still works.
* Recovery onboarding still works.
* Existing `/` + handoff flow still works.
* Cloudflare provisioning is not broken.
* No AP+STA capability is required.
* Existing UI/design system is preserved.
* Existing functionality outside this migration remains unaffected.

---

## Execution

First inspect the current implementation and identify every existing `SETUP_MODE` dependency and the current Wi-Fi/hotspot ownership.

Then provide a concise implementation plan and implement the migration incrementally.

At the end report:

1. Files changed
2. `SETUP_MODE` references removed/migrated
3. Database/state changes
4. NetworkRecoveryService behavior
5. Admin Network/Wi-Fi changes
6. Wi-Fi/recovery coordination
7. Tests/build/type checks performed
8. Any remaining risks