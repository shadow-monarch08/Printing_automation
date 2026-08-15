# Master Implementation Prompt — Onboarding Network Transition, Recovery & One-Time Handoff

## ROLE

You are working as a senior production engineer inside the existing **Printing Automation Platform** codebase.

Your task is to **extend and harden the existing onboarding implementation** according to the requirements below.

This is **NOT a greenfield implementation**.

You MUST first inspect and understand the existing codebase, current onboarding flow, Wi-Fi service/controller/routes, Redis implementation, Axios/API layer, routing, Zustand stores, onboarding components, system configuration persistence, Cloudflare tunnel implementation, and existing styling before modifying anything.

The current onboarding flow is already implemented. **Build on top of it. Do not replace it unnecessarily.**

The authoritative platform architecture/specification is available in:

`platform-specification.md`

Use the existing source code as the source of truth for implementation details.

---

# 1. ABSOLUTE IMPLEMENTATION RULES

## 1.1 No Guessing

Do NOT guess:

* existing API contracts
* existing component behavior
* existing state structures
* Redis key conventions
* routing conventions
* Axios interceptor behavior
* CSS architecture
* naming conventions
* service boundaries
* existing helper utilities
* existing onboarding behavior

Inspect the existing implementation first.

If something already exists, **extend/reuse it rather than creating a parallel implementation**.

Before modifying a subsystem, identify:

1. Existing implementation
2. Existing dependencies
3. Existing callers
4. Existing state flow
5. Existing error handling
6. Existing tests, if any

---

## 1.2 Preserve Existing Architecture

Do NOT:

* rewrite onboarding from scratch
* replace Zustand with another state manager
* replace Axios
* introduce another networking library
* introduce another database
* introduce another backend service
* introduce an external relay/server
* introduce a new persistence technology
* introduce AP+STA as a requirement
* introduce polling infrastructure outside the existing frontend/backend architecture

The solution must remain compatible with the existing:

* Node.js + TypeScript backend
* Express
* React + TypeScript
* Zustand
* SQLite
* Redis
* NetworkManager / `nmcli`
* Cloudflare Quick Tunnel
* existing WebSocket architecture where applicable
* existing authentication architecture
* existing routing architecture

---

# 2. PRIMARY OBJECTIVE

Harden the onboarding system around the fact that **changing the Pi's Wi-Fi network can temporarily make the browser unable to communicate with the Pi.**

This is expected behavior, NOT an application error.

The frontend must therefore distinguish between:

```text
EXPECTED NETWORK TRANSITION
```

and:

```text
ACTUAL ONBOARDING FAILURE
```

The backend must independently complete the provisioning process.

The browser must silently recover communication when the Pi becomes reachable again.

---

# 3. EXISTING ONBOARDING MODES

There are two distinct onboarding situations.

## MODE A — FIRST BOOT

Condition:

```text
isOnboarded === false
setupMode === true
```

Meaning:

> The Pi is being provisioned for the first time and the Pi's onboarding hotspot is being used.

Expected flow:

```text
Pi hotspot ON
        ↓
Admin connects device to Pi hotspot
        ↓
Admin enters shop name + PIN
        ↓
Admin selects Wi-Fi
        ↓
Pi attempts new Wi-Fi connection
        ↓
Pi may lose communication with browser
        ↓
Backend independently completes provisioning
        ↓
Internet verified
        ↓
Cloudflare tunnel established
        ↓
Onboarding committed
        ↓
One-time handoff ticket created
        ↓
Pi hotspot turned OFF
        ↓
Admin device may automatically reconnect
        OR
        ↓
Admin manually changes device to Pi's new Wi-Fi
        ↓
Browser reaches `/`
        ↓
Handoff detected
        ↓
Welcome screen
```

### Failure behavior

If first-boot onboarding fails:

```text
Wi-Fi failure
OR
Internet verification failure
OR
Cloudflare failure
OR
provisioning timeout
        ↓
restore/enable Pi onboarding hotspot
        ↓
admin remains able to access onboarding
```

Do NOT silently mark the system onboarded on failure.

---

# 4. MODE B — RECOVERY / DATABASE RESET ONBOARDING

Condition:

```text
isOnboarded === false
setupMode === false
```

This is fundamentally different from first boot.

Interpretation:

> Persistent application state has been lost/reset, but the Pi may already have a valid Wi-Fi connection.

The Pi's onboarding hotspot must NOT automatically be enabled for this mode.

The admin is allowed to:

### Option 1 — Skip Wi-Fi setup

Use the Pi's existing Wi-Fi connection.

Flow:

```text
Recovery onboarding
        ↓
Admin chooses SKIP Wi-Fi
        ↓
Keep existing Wi-Fi
        ↓
Verify usable network
        ↓
Verify Internet
        ↓
Start/verify Cloudflare
        ↓
Commit onboarding
        ↓
Create handoff ticket
        ↓
Browser receives immediate response where possible
        ↓
Navigate to `/`
        ↓
Fetch status
        ↓
Consume handoff
        ↓
Welcome
```

### Option 2 — Configure another Wi-Fi

Flow:

```text
Recovery onboarding
        ↓
Admin chooses Wi-Fi configuration
        ↓
Normal Wi-Fi transition process
        ↓
Browser may temporarily lose connectivity
        ↓
Backend independently completes provisioning
        ↓
Internet verification
        ↓
Cloudflare
        ↓
Commit
        ↓
Create handoff
        ↓
Browser reconnects
        ↓
Navigate to `/`
        ↓
Fetch status
        ↓
Welcome
```

### Failure behavior

For recovery onboarding:

**DO NOT enable the Pi onboarding hotspot automatically.**

If changing to another Wi-Fi fails, restore/preserve the previously working NetworkManager connection where appropriate.

Do not blindly allow NetworkManager to choose an arbitrary autoconnect profile if the previous active profile can be explicitly identified and restored.

---

# 5. DO NOT MODEL SUCCESS AS `nmcli` PROCESS SUCCESS

This is critical.

Current behavior must NOT be:

```text
nmcli connection up
        ↓
process returned success
        ↓
start cloudflared immediately
```

`nmcli` returning successfully does NOT necessarily mean usable Internet connectivity is immediately available.

Implement the provisioning sequence as:

```text
CONNECTING_WIFI
        ↓
WIFI_CONNECTED
        ↓
VERIFYING_INTERNET
        ↓
STARTING_TUNNEL
        ↓
VERIFYING_TUNNEL
        ↓
SUCCESS
```

Failure states must be distinguishable.

At minimum support:

```text
WIFI_FAILED
INTERNET_FAILED
TUNNEL_FAILED
TIMEOUT
```

Use the existing Redis/state architecture instead of inventing a new state store.

---

# 6. WIFI CONNECTION READINESS

After activating a NetworkManager profile:

```text
nmcli connection up <profile>
```

DO NOT immediately start Cloudflare.

Wait until the Wi-Fi connection is actually usable.

The implementation should verify, using the existing backend utilities/services where possible:

1. NetworkManager reports the interface as activated
2. An IP address is available
3. DNS resolution works
4. Actual outbound HTTPS connectivity works

The exact commands/utilities must be selected based on the existing codebase.

Do not blindly add arbitrary sleeps as the primary solution.

Retries should be bounded and state-aware.

---

# 7. CLOUDFLARE STARTUP

Cloudflare must only be started after Internet connectivity is confirmed.

Required flow:

```text
Wi-Fi activated
        ↓
IP available
        ↓
Internet verified
        ↓
startQuickTunnel()
        ↓
wait for tunnel URL
        ↓
verify tunnel readiness using an appropriate existing mechanism
        ↓
persist tunnel URL
        ↓
SUCCESS
```

Do not declare onboarding success merely because `cloudflared` produced a URL.

Use the existing `tunnel.service.ts` implementation and extend it where necessary.

Do not create a second tunnel implementation.

---

# 8. PROVISIONING DEADLINE

The existing frontend recovery window is approximately 35 seconds.

Do NOT use that same value as the backend's entire provisioning deadline.

The entire backend onboarding operation should have an approximately:

```text
90 second overall provisioning deadline
```

This is an overall deadline, NOT 90 seconds per operation.

The backend should have reasonable internal timeouts for:

* Wi-Fi activation
* Internet readiness
* Cloudflare startup
* tunnel verification

Do not make the system wait indefinitely.

The frontend browser recovery mechanism can remain active for approximately:

```text
90–120 seconds
```

because backend completion and browser reconnection are separate events.

Use the existing project conventions rather than introducing unnecessary timers everywhere.

---

# 9. FRONTEND NETWORK TRANSITION BEHAVIOR

This is one of the most important changes.

Currently the Axios interceptor interprets a failed API call during Wi-Fi switching as a normal application failure.

That behavior is incorrect during onboarding.

When onboarding enters the Wi-Fi transition phase:

```text
PROVISIONING_NETWORK = true
```

or equivalent existing state should be used/extended.

During this state:

### Expected network errors must NOT:

* trigger generic Axios rollback
* reset onboarding state
* show error toasts
* display generic "network error"
* cancel the onboarding flow
* treat the Pi as having failed

A lost connection is expected.

The user should instead see an appropriate onboarding state such as:

```text
NETWORK TRANSITION IN PROGRESS

The terminal is configuring its network connection.
Please keep this page open.
```

Follow the existing industrial design language.

---

# 10. BROWSER-LEVEL RECOVERY

Keep the existing polling/reconnection concept, but change its semantic meaning.

It is NOT:

> "Polling to determine whether Wi-Fi succeeded."

It is:

> "Silently attempting to reconnect to the Pi after an expected network transition."

The browser should use an adaptive retry/reconnection strategy.

For example:

```text
immediate
↓
1s
↓
2s
↓
4s
↓
8s
↓
10s
↓
10s
...
```

Use sensible existing project utilities if available.

Do not blindly hardcode this exact schedule if the existing implementation has a better mechanism.

---

# 11. IMPORTANT POLLING SEMANTICS

The browser must distinguish:

### Pi unreachable

Meaning:

```text
UNKNOWN / NETWORK TRANSITION
```

NOT:

```text
FAILURE
```

### Pi reachable + onboarding still running

Examples:

```text
CONNECTING_WIFI
WIFI_CONNECTED
VERIFYING_INTERNET
STARTING_TUNNEL
VERIFYING_TUNNEL
```

Continue waiting.

### Pi reachable + success

```text
SUCCESS
```

Proceed to `/`.

### Pi reachable + actual failure

```text
FAILED
```

Show the appropriate error and allow retry/recovery.

### Maximum browser recovery time exceeded

Treat as a genuine timeout/recovery failure and provide the appropriate recovery UX.

---

# 12. ONE-TIME ONBOARDING HANDOFF TOKEN

Implement a browser-local token specifically for fresh onboarding handoff.

When the fresh onboarding process begins, generate a cryptographically strong random token.

Store the token in:

```text
localStorage
```

Use an existing application storage convention if available.

Do NOT use:

* shop name
* Wi-Fi SSID
* timestamp
* predictable identifiers
* normal session IDs
* authentication JWT
* printer IDs

The token exists specifically to identify the browser/device that initiated fresh onboarding.

---

# 13. REDIS ONE-TIME HANDOFF TICKET

After onboarding successfully completes, create a Redis-backed one-time handoff ticket.

The ticket is UX handoff metadata, NOT the source of truth for onboarding.

Conceptually:

```text
onboarding:handoff:<secure-token>
```

The actual key naming MUST follow the existing Redis key conventions in the codebase.

The ticket should contain enough information for the welcome screen, such as:

```text
type
shopName
tunnelUrl
localAccessUrl if available
printerCount
createdAt
expiresAt
```

Use an appropriate Redis TTL.

Recommended:

```text
10–15 minutes
```

Do not leave onboarding tickets permanently in Redis.

---

# 14. TICKET SECURITY

When the browser calls the onboarding/status or entry-related endpoint, the server should only return the fresh-onboarding handoff when the browser presents the correct locally stored onboarding token.

A random LAN client must NOT receive the handoff.

A random Cloudflare client must NOT receive the handoff.

A normal customer must NOT receive the handoff.

If the token is:

* missing
* invalid
* expired
* already consumed

return the normal system/onboarding state without exposing the welcome handoff.

---

# 15. ONE-TIME CONSUMPTION

The handoff must be consumed atomically.

Do not implement:

```text
GET ticket
↓
later
DELETE ticket
```

with a race window.

Use an atomic Redis mechanism or equivalent existing Redis primitive so that only one request can consume the ticket.

Conceptually:

```text
GETDEL
```

or an equivalent atomic implementation.

After successful consumption:

```text
next request → no handoff
```

This prevents:

* duplicate welcome screens
* repeated redirects
* another browser receiving the ticket
* refresh repeatedly triggering onboarding welcome

---

# 16. IMPORTANT: `/` IS THE ENTRY POINT

When the user says "entry point", they mean the existing website's:

```text
/
```

route.

Do NOT create a separate `/entry` route unless the existing architecture genuinely requires it.

The intended flow is:

```text
Browser reaches /
        ↓
Existing root routing/status logic executes
        ↓
Fetch onboarding/system status
        ↓
Check authenticated/system state
        ↓
Check one-time onboarding handoff
        ↓
Route appropriately
```

Build this into the existing `/` entry behavior.

---

# 17. AUTO-RECONNECT SUCCESS CASE

There is an important edge case in first boot.

After the Pi disables its hotspot, the admin's device may automatically connect to the same Wi-Fi network that the Pi just joined.

In that case:

```text
Pi hotspot OFF
        ↓
Browser automatically reconnects
        ↓
Polling request succeeds
```

The browser MUST NOT assume that successful communication itself means the onboarding flow is finished.

Instead:

```text
poll succeeds
        ↓
navigate/reload /
        ↓
normal root status check
        ↓
handoff token submitted
        ↓
one-time handoff returned
        ↓
WELCOME
```

If no handoff exists:

```text
normal application flow
```

This fallback is mandatory.

---

# 18. MANUAL WIFI SWITCH CASE

If automatic reconnection does NOT happen:

```text
Pi hotspot OFF
        ↓
browser cannot reach Pi
```

The browser must:

* remain on the provisioning/recovery UI
* suppress expected network errors
* silently retry
* not show generic Axios errors
* not reset the onboarding form
* not falsely declare failure

The admin manually changes the device to the newly configured Wi-Fi.

Once communication returns:

```text
browser reaches /
        ↓
status check
        ↓
handoff consumed
        ↓
WELCOME
```

---

# 19. WELCOME SCREEN

After a fresh successful onboarding handoff is consumed, redirect/render the new welcome experience.

It should communicate:

```text
TERMINAL PROVISIONED
```

and show:

### Shop/platform name

Example:

```text
MODERN PRESS
```

### Cloudflare remote access

Show:

```text
https://xxxxx.trycloudflare.com
```

with:

```text
[ OPEN REMOTE ACCESS ]
```

The button should open the URL using the existing application conventions.

### Local access

If the platform already has a reliable local access URL/IP available, show it too:

```text
LOCAL ACCESS
http://<pi-local-address>

[ OPEN LOCAL ACCESS ]
```

Do NOT use:

```text
localhost
```

as the Pi address for the admin's phone/laptop.

`localhost` refers to the device running the browser.

### Printer count

Show:

```text
0 PRINTERS CONFIGURED
```

or:

```text
3 PRINTERS CONFIGURED
```

Use the existing printer/fleet API/data source.

Do not create duplicated printer-count state just for this page.

### Admin navigation

Provide:

```text
[ GO TO ADMIN PANEL ]
```

If no printers are configured, make the admin navigation particularly clear so the operator knows the next action is printer setup.

---

# 20. NORMAL USERS MUST NEVER SEE THE WELCOME HANDOFF

This is a strict requirement.

A customer opening:

```text
/
```

normally must continue into the customer experience.

A customer using the Cloudflare URL must NOT see:

```text
TERMINAL PROVISIONED
```

A random LAN device must NOT see it.

Only the browser carrying the correct fresh-onboarding handoff token can receive it.

---

# 21. RECOVERY ONBOARDING MUST ALSO FOLLOW THE HANDOFF MODEL

For:

```text
isOnboarded=false
setupMode=false
```

if onboarding succeeds:

```text
commit
↓
create handoff
↓
browser reaches /
↓
status check
↓
handoff
↓
WELCOME
```

If the admin selected **Skip Wi-Fi** and the backend can complete the operation without losing browser connectivity:

```text
backend responds immediately
↓
same root `/` flow
↓
handoff
↓
WELCOME
```

Do NOT create a completely separate frontend success architecture for this case.

Reuse the same handoff mechanism.

---

# 22. RECOVERY FAILURE BEHAVIOR

For:

```text
isOnboarded=false
setupMode=false
```

DO NOT automatically start the onboarding hotspot after failure.

For skip-Wi-Fi failure:

```text
preserve existing network
```

where possible.

For changed-Wi-Fi failure:

```text
restore the previously active/known-good NetworkManager profile
```

where appropriate.

Do not blindly let NetworkManager select an arbitrary connection if the previous active profile can be identified.

---

# 23. SETUP MODE PERSISTENCE

For first boot:

Successful onboarding must result in:

```text
isOnboarded = true
setupMode = false
```

Use the existing persistence mechanism.

Do NOT directly mutate `.env` at runtime unless the existing codebase already intentionally does so.

The current platform specification describes `SETUP_MODE` as an environment configuration and `is_onboarded` as persisted SQLite state.

Therefore:

**Inspect the existing implementation before deciding how `setupMode` is persisted/derived.**

Do not invent a runtime `.env` mutation mechanism.

---

# 24. DESIGN / UI REQUIREMENTS

This implementation MUST strictly follow the existing Printing Automation design system.

Do NOT introduce generic SaaS UI.

Use the existing:

* Industrial Automation Console aesthetic
* mechanical/printshop visual language
* `IBM Plex Mono` for system/data labels
* `Space Grotesk` / `Inter` for body copy
* Safety Orange `#FF5500`
* Press Cyan `#00A396`
* Warm Mechanical Slate surfaces
* tactile 3D buttons
* LED status indicators
* hazard overlays where appropriate
* existing modal/input/button components
* existing spacing/radius/border tokens
* existing dark/light theme behavior

Reuse existing components such as:

```text
Button
PinInput
Modal
ValidatedInput
LoadingNet
ToastStack
PaperTable
```

and existing onboarding-specific styles/components wherever applicable.

Do NOT create duplicate versions of existing components.

---

# 25. UX REQUIREMENTS

During Wi-Fi transition, the UI should communicate that the system is intentionally working.

Example states:

```text
NETWORK PROVISIONING
CONNECTING TO NETWORK...
```

```text
NETWORK PROVISIONING
VERIFYING INTERNET CONNECTION...
```

```text
REMOTE ACCESS
ESTABLISHING CLOUD CONNECTION...
```

```text
TERMINAL READY
```

Do not expose:

```text
AxiosError
ERR_NETWORK
Request failed
ECONNRESET
fetch failed
```

to the administrator.

Those are implementation details.

---

# 26. ERROR HANDLING

Actual failures must still be surfaced.

Examples:

```text
WIFI_FAILED
```

→ tell admin the network could not be connected.

```text
INTERNET_FAILED
```

→ tell admin the Wi-Fi connected but Internet could not be verified.

```text
TUNNEL_FAILED
```

→ tell admin remote access could not be established.

```text
TIMEOUT
```

→ provide an actionable recovery message.

Use the existing Toast system and error components.

Do NOT weaken global error handling outside onboarding.

The Axios interceptor changes must be narrowly scoped to onboarding transition behavior.

---

# 27. DO NOT BREAK NORMAL CUSTOMER/ADMIN FLOWS

After onboarding:

```text
isOnboarded=true
setupMode=false
```

normal behavior must remain unchanged.

The following must continue working:

* customer kiosk
* admin login
* printer fleet
* print queue
* analytics
* settings
* WebSocket events
* Cloudflare access
* Wi-Fi maintenance
* existing admin routing

The onboarding changes must be isolated as much as reasonably possible.

---

# 28. TESTING REQUIREMENTS

Before considering implementation complete, test all of these scenarios.

## Scenario 1 — First boot + successful Wi-Fi + browser disconnect

```text
isOnboarded=false
setupMode=true
```

Expected:

```text
hotspot
→ Wi-Fi configured
→ browser loses connection
→ backend continues
→ Internet verified
→ Cloudflare ready
→ handoff created
→ hotspot disabled
→ manual Wi-Fi switch
→ /
→ handoff consumed
→ Welcome
```

---

## Scenario 2 — First boot + automatic device reconnection

Expected:

```text
hotspot OFF
→ browser automatically reconnects
→ polling succeeds
→ /
→ handoff
→ Welcome
```

---

## Scenario 3 — First boot + Wi-Fi failure

Expected:

```text
Wi-Fi fails
→ backend reports FAILED
→ hotspot restored
→ onboarding remains usable
→ no corrupted onboarded state
```

---

## Scenario 4 — First boot + Internet delay

Expected:

```text
nmcli succeeds
→ Internet not immediately available
→ backend waits
→ Internet becomes available
→ cloudflared starts
→ success
```

Cloudflare must NOT fail simply because DHCP/DNS/Internet readiness took additional time.

---

## Scenario 5 — First boot + Cloudflare failure

Expected:

```text
Wi-Fi connected
→ Internet verified
→ Cloudflare fails
→ onboarding FAILED
→ first-boot hotspot recovery
```

---

## Scenario 6 — Recovery onboarding + skip Wi-Fi

```text
isOnboarded=false
setupMode=false
```

Expected:

```text
existing Wi-Fi
→ skip
→ Internet verification
→ Cloudflare
→ success
→ immediate browser response if possible
→ /
→ handoff
→ Welcome
```

No hotspot activation.

---

## Scenario 7 — Recovery onboarding + change Wi-Fi + browser disconnect

Expected:

```text
new Wi-Fi
→ browser loses connection
→ backend continues
→ success
→ handoff
→ device reconnects
→ /
→ Welcome
```

---

## Scenario 8 — Recovery onboarding + changed Wi-Fi failure

Expected:

```text
new Wi-Fi fails
→ previous usable connection restored/preserved
→ hotspot NOT enabled
→ onboarding remains recoverable
```

---

## Scenario 9 — Handoff token missing

Expected:

```text
GET /
→ normal application
```

No Welcome screen.

---

## Scenario 10 — Wrong handoff token

Expected:

```text
GET /
→ normal application
```

No Welcome screen.

---

## Scenario 11 — Handoff already consumed

Expected:

```text
GET /
→ normal application
```

No Welcome screen.

---

## Scenario 12 — Handoff expired

Expected:

```text
GET /
→ normal application
```

No Welcome screen.

---

## Scenario 13 — Normal customer opens Cloudflare URL immediately after onboarding

Expected:

```text
normal customer experience
```

NOT the onboarding Welcome screen.

---

# 29. CODE QUALITY REQUIREMENTS

Follow the existing project's coding conventions exactly.

Before writing code:

1. Inspect relevant files.
2. Identify existing services/controllers/routes/stores/components.
3. Identify existing Redis key utilities.
4. Identify existing API client/interceptor behavior.
5. Identify existing onboarding state.
6. Identify existing tunnel lifecycle.
7. Identify existing Wi-Fi command wrappers.
8. Identify existing root `/` routing.
9. Identify existing printer count endpoint/state.
10. Identify existing tests.

Then implement the smallest coherent change.

Avoid:

* duplicate services
* duplicate API clients
* duplicate state
* unnecessary abstractions
* unnecessary dependencies
* speculative refactors
* unrelated cleanup

---

# 30. IMPORTANT IMPLEMENTATION CONSTRAINT

Do NOT stop at the first working implementation.

After implementation, inspect the complete flow end-to-end:

```text
UI
→ API
→ controller
→ service
→ NetworkManager
→ Internet verification
→ Cloudflare
→ Redis
→ SQLite
→ browser recovery
→ /
→ handoff
→ Welcome
→ normal application
```

Make sure the state transitions are consistent across every layer.

There must not be a situation where:

```text
frontend says SUCCESS
backend says FAILED
```

or:

```text
backend says SUCCESS
but system_config says NOT ONBOARDED
```

or:

```text
ticket exists
but onboarding never actually committed
```

---

# 31. FINAL ACCEPTANCE CRITERIA

The implementation is complete only when all of the following are true:

* Existing onboarding functionality still works.
* First boot and recovery onboarding are treated differently.
* Browser network loss during Wi-Fi transition is treated as expected.
* Axios does not produce false error toasts during the transition.
* Backend independently completes Wi-Fi → Internet → Cloudflare provisioning.
* Cloudflare starts only after actual Internet readiness.
* Backend has a bounded overall provisioning timeout of approximately 90 seconds.
* Browser recovery can continue approximately 90–120 seconds.
* A secure one-time browser token identifies the onboarding initiator.
* Redis stores a short-lived onboarding handoff ticket.
* Handoff is atomically consumed.
* Wrong/missing/expired tokens never expose onboarding information.
* `/` is the central post-reconnection entry point.
* Automatic Wi-Fi reconnection is handled.
* Manual Wi-Fi switching is handled.
* First-boot failures restore the Pi hotspot.
* Recovery failures do NOT automatically enable the Pi hotspot.
* Recovery supports skipping Wi-Fi configuration.
* Successful onboarding produces the Welcome screen.
* Welcome screen shows platform/shop name.
* Welcome screen shows Cloudflare URL.
* Welcome screen provides remote-access action.
* Welcome screen shows local access where reliably available.
* Welcome screen shows configured printer count.
* Welcome screen provides admin navigation.
* Normal customers never receive the onboarding handoff.
* Existing customer/admin functionality remains unaffected.
* No external relay/server is introduced.
* No AP+STA hardware capability is required.
* Existing platform theme/design system is strictly followed.
* Existing coding architecture and conventions are preserved.

---

# EXECUTION INSTRUCTION

**Start by inspecting the existing implementation.**

Do not immediately modify files.

First identify the exact files responsible for:

```text
Onboarding routing
Wi-Fi onboarding service
Wi-Fi controller/routes
Cloudflare tunnel service
Redis keys/state
System configuration persistence
Axios interceptor
Onboarding Zustand state
Onboarding polling/reconnection
Root `/` route
Welcome/entry routing
Printer count retrieval
Existing onboarding styles/components
```

Then produce a concise implementation plan based on the actual code you found.

After that, implement the changes incrementally.

**Do not invent missing architecture. Reuse the existing implementation wherever possible.**

At the end, report:

1. Files changed
2. What changed in each file
3. New/modified API contracts
4. Redis keys/state introduced or modified
5. Onboarding state transitions
6. Error/recovery behavior
7. Tests performed
8. Any remaining risks or hardware/environment dependencies

**Do not modify unrelated functionality.**
