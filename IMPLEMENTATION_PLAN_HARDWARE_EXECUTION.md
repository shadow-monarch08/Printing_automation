# IMPLEMENTATION PLAN — Execution Layer & Cache-First Hardware Lockdown

> **Prime Directive:** The physical hardware bus (USB/Network) is the system's critical bottleneck. All user-facing routes MUST operate on a **Redis Cache-First** architecture. Live shell commands (`ipptool`, `snmpwalk`, `lpstat`, `lsusb`, `escputil`) are **strictly forbidden** in any controller or service called by an HTTP request handler.

---

## Dependency Graph

```mermaid
graph LR
    P1["Phase 1: Secure Execution Wrapper"] --> P2["Phase 2: Command File Refactoring"]
    P2 --> P3["Phase 3: Factory & Adapter Fixes"]
    P3 --> P4["Phase 4: Universal Redis Handshake"]
    P4 --> P5["Phase 5: Hardware Probe Lockdown"]
    P5 --> P6["Phase 6: Standardized Deletion Flow"]
```

---

## Phase 1 — Upgrade the Command Execution Wrapper

### Target File

#### [MODIFY] [exec.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/utils/exec.ts)

### Current State (Flawed)

```typescript
// Uses child_process.exec → spawns /bin/sh → shell interpolation vulnerabilities
exec(command, { timeout: 15000 }, (error, stdout, stderr) => { ... });
```

**Problems identified:**
- `exec` passes the entire command as a single string to `/bin/sh`, which performs shell expansion.
- URIs containing `&`, `?`, `$`, or other shell metacharacters are silently mangled or trigger injection.
- The `sanitize()` regex guards scattered across command files (`/[;&|` + "`" + `$]/`) are a band-aid that actively breaks valid URIs (e.g., `hp:/usb/HP_LaserJet?serial=PH123&port=1`).

### Required Changes

1. **Add** a new function `runSecureCommand` using `child_process.execFile` (promisified):

```typescript
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function runSecureCommand(
  binary: string,
  args: string[],
  options?: { timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync(binary, args, {
    timeout: options?.timeout ?? 15000,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}
```

2. **Add** a companion timeout variant:

```typescript
export async function runSecureCommandWithTimeout(
  binary: string,
  args: string[],
  timeoutMs = 4000
): Promise<{ stdout: string; stderr: string }> {
  return Promise.race([
    runSecureCommand(binary, args, { timeout: timeoutMs }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Command timed out: ${binary} ${args.join(" ")}`)), timeoutMs)
    ),
  ]);
}
```

3. **Deprecate** (but do not delete yet) the legacy `execCommand` and `execWithTimeout` functions. Add a `@deprecated` JSDoc tag and a `console.warn` on first invocation to catch any missed call sites during testing.

> [!IMPORTANT]
> **Rule:** From this point forward, no code in the repository may construct a shell command string. All invocations MUST use `runSecureCommand(binary, [...args])`.

---

## Phase 2 — Refactor All Command Files

Every file in `server/src/commands/` must be migrated from `execCommand(string)` to `runSecureCommand(binary, args[])`. All legacy `sanitize()` regex functions must be **deleted** — `execFile` does not invoke a shell, so metacharacter sanitization is unnecessary and actively harmful.

---

### 2A. Refactor `cups.commands.ts`

#### [MODIFY] [cups.commands.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/commands/cups.commands.ts)

**Delete:** The `sanitize()` function (lines 7–12).

**Refactor every method** from interpolated strings to array-based arguments:

| Method | Before (Flawed) | After (Secure) |
|---|---|---|
| `listPrinters` | `execCommand("lpstat -p")` | `runSecureCommand('lpstat', ['-p'])` |
| `listDevices` | `execCommand("lpinfo -v")` | `runSecureCommand('lpinfo', ['-v'])` |
| `getDefaultPrinter` | `execCommand("lpstat -d")` | `runSecureCommand('lpstat', ['-d'])` |
| `setDefaultPrinter` | `` execCommand(`lpoptions -d ${safeName}`) `` | `runSecureCommand('lpoptions', ['-d', printerName])` |
| `printFile` | String concatenation with `lp` | `runSecureCommand('lp', ['-d', printerName, '-n', String(copies), '-o', `sides=${sides}`, '--', filePath])` |
| `getJobStatus` | `` execCommand(`lpstat -o ${safeName}`) `` | `runSecureCommand('lpstat', ['-o', printerName])` |
| `cancelJob` | `` execCommand(`cancel ${safeId}`) `` | `runSecureCommand('cancel', [String(cupsJobId)])` |
| `cancelAllJobs` | `execCommand("cancel -a")` | `runSecureCommand('cancel', ['-a'])` |
| `holdJob` | `` execCommand(`lp -i ${safeId} -H hold`) `` | `runSecureCommand('lp', ['-i', String(cupsJobId), '-H', 'hold'])` |
| `resumeJob` | `` execCommand(`lp -i ${safeId} -H resume`) `` | `runSecureCommand('lp', ['-i', String(cupsJobId), '-H', 'resume'])` |
| `getPrinterStatus` | `execCommand("lpstat -v")` | `runSecureCommand('lpstat', ['-v'])` |
| `getPrinterStatusByName` | `` execCommand(`lpstat -p ${safeName}`) `` | `runSecureCommand('lpstat', ['-p', printerName])` |
| `getPrinterOptions` | `` execCommand(`lpoptions -p ${safeName} -l`) `` | `runSecureCommand('lpoptions', ['-p', printerName, '-l'])` |
| `addIppPrinter` | `` execCommand(`sudo lpadmin -p "${safeName}" -E -v "${uri}" -m everywhere`) `` | `runSecureCommand('sudo', ['lpadmin', '-p', name, '-E', '-v', uri, '-m', 'everywhere'])` |
| `probeIppPrinter` | `` execCommand(`ipptool -tv "${uri}" get-printer-attributes.test`) `` | `runSecureCommand('ipptool', ['-tv', uri, 'get-printer-attributes.test'])` |

---

### 2B. Refactor `hp.commands.ts`

#### [MODIFY] [hp.commands.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/commands/hp.commands.ts)

**Delete:** The inline regex guard (lines 12–14).

**Fix the contradictory flags** (Mandate #3):

| Method | Before (Flawed) | After (Secure) |
|---|---|---|
| `setupPrinter` | `` execCommand(`sudo hp-setup -i -a -q "${uri}"`) `` | `runSecureCommand('sudo', ['hp-setup', '-a', '-x', '-q', uri])` |
| `getLevels` | `` execWithTimeout(`hp-levels -p ${safeName}`, 4000) `` | `runSecureCommandWithTimeout('hp-levels', ['-p', printerName], 4000)` |

> [!WARNING]
> **Critical fix:** The `-i` (interactive) flag is **removed**. The `-x` flag is **added** to enforce strict headless execution. This prevents the process from hanging on a headless Raspberry Pi where no TTY is attached.

---

### 2C. Refactor `system.commands.ts`

#### [MODIFY] [system.commands.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/commands/system.commands.ts)

**Delete:** The `sanitize()` function (lines 3–8).

| Method | Before (Flawed) | After (Secure) |
|---|---|---|
| `getPdfInfo` | `` execCommand(`pdfinfo "${filePath}"`) `` | `runSecureCommand('pdfinfo', [filePath])` |
| `getWifiStatus` | `execCommand('nmcli -t -f ssid,signal dev wifi')` | `runSecureCommand('nmcli', ['-t', '-f', 'ssid,signal', 'dev', 'wifi'])` |
| `snmpWalk` | `` execWithTimeout(`snmpwalk -v1 -c public ${safeIp} ${safeOid}`, 4000) `` | `runSecureCommandWithTimeout('snmpwalk', ['-v1', '-c', 'public', ip, oid], 4000)` |
| `escputilInkLevel` | `execWithTimeout('sudo escputil -i -u -r /dev/usb/lp0', 4000)` | `runSecureCommandWithTimeout('sudo', ['escputil', '-i', '-u', '-r', '/dev/usb/lp0'], 4000)` |
| `genericUsbInkLevel` | `execWithTimeout('ink -p usb', 4000)` | `runSecureCommandWithTimeout('ink', ['-p', 'usb'], 4000)` |
| `getDiskUsage` | `execCommand('df -h /')` | `runSecureCommand('df', ['-h', '/'])` |
| `checkUsbDevices` | `execCommand('lsusb')` | `runSecureCommand('lsusb', [])` |
| `connectToWifi` | String interpolation with quote-escaping hack | `runSecureCommand('sudo', ['nmcli', 'device', 'wifi', 'connect', ssid, ...(password ? ['password', password] : [])])` |

> [!CAUTION]
> The current `connectToWifi` implementation has a **critical injection vulnerability**: it attempts to manually escape double quotes in the password string before interpolating it into a shell command. This is fundamentally unsafe. Migrating to `execFile` eliminates this entire class of vulnerability because arguments are passed as an array directly to the OS process, bypassing shell parsing.

---

## Phase 3 — Fix the Printer Factory URI Routing & Adapters

### 3A. Fix URI Routing in `printer.factory.ts`

#### [MODIFY] [printer.factory.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/factories/printer.factory.ts)

**Current State (Flawed):**
```typescript
// Line 35: Routes "usb://hp" URIs to HpLegacyAdapter
} else if (lowerUri.includes("usb://hp") || lowerUri.startsWith("hp:/usb/")) {
  return new HpLegacyAdapter(printerName, uri);
```

**Problem:** `HpLegacyAdapter` invokes `hp-setup`, which only accepts HPLIP-native `hp:/` URIs. Passing a standard CUPS `usb://HP/...` URI causes `hp-setup` to crash.

**Fix:** Update `getAdapterByUri` to split routing:

```typescript
static getAdapterByUri(printerName: string, uri: string): IPrinterAdapter | null {
  const lowerUri = uri.toLowerCase();

  if (lowerUri.startsWith("ipp://")) {
    return new IppModernAdapter(printerName, uri);
  } else if (lowerUri.startsWith("socket://") || lowerUri.startsWith("lpd://")) {
    return new SnmpAdapter(printerName, uri);
  } else if (lowerUri.startsWith("hp:/")) {
    // HPLIP-native URI → uses hp-setup / hp-levels
    return new HpLegacyAdapter(printerName, uri);
  } else if (lowerUri.startsWith("usb://epson")) {
    return new EpsonLegacyAdapter(printerName, uri);
  } else if (lowerUri.startsWith("usb://")) {
    // ALL other USB (including usb://HP/) → standard CUPS lpadmin
    return new GenericUsbAdapter(printerName, uri);
  }

  return null;
}
```

### 3B. Fix URI Routing in `configurePrinter` Controller

#### [MODIFY] [printer.controller.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/printer.controller.ts)

**Current State (Flawed — line 170–174):**
```typescript
if (uri.includes("ipp://")) {
  await printerService.configureIppPrinter(queueName, uri);
} else {
  // Assumes ALL non-IPP is HP — wrong!
  await printerService.configureHpPrinter(uri, rawModel);
}
```

**Fix:** Add explicit URI scheme checks:

```typescript
if (uri.includes("ipp://")) {
  await printerService.configureIppPrinter(queueName, uri);
} else if (uri.startsWith("hp:/")) {
  await printerService.configureHpPrinter(uri, rawModel);
} else {
  // Generic USB (including usb://HP/, usb://Epson/, etc.) → lpadmin
  await printerService.configureGenericUsbPrinter(queueName, uri);
}
```

### 3C. Add Generic USB Configuration to `printer.service.ts`

#### [MODIFY] [printer.service.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/printer.service.ts)

**Add** a new function:

```typescript
export async function configureGenericUsbPrinter(queueName: string, uri: string): Promise<void> {
  console.log(`[configureGenericUsbPrinter] Configuring USB device: ${uri} as ${queueName}`);
  await cupsCommands.addUsbPrinter(queueName, uri);
}
```

**Add** the corresponding command to `cups.commands.ts`:

```typescript
addUsbPrinter: async (name: string, uri: string) => {
  return runSecureCommand('sudo', ['lpadmin', '-p', name, '-E', '-v', uri, '-m', 'everywhere']);
},
```

---

## Phase 4 — Enforce the Universal Redis Handshake

### Problem

After a printer is configured via `POST /printers/configure`, the controller currently:
1. Calls the OS-level setup command (`hp-setup` or `lpadmin`). ✅
2. Probes capabilities via `lpoptions -l`. ✅
3. Saves to `capabilities.json`. ✅
4. Emits `printer_discovery` SSE. ✅
5. **Does NOT register the printer in Redis.** ❌

This means the newly configured printer is **invisible** to the matchmaker, the heartbeat, and the fleet API until the next 5-minute heartbeat sweep happens to pick it up.

### Fix

#### [MODIFY] [printer.controller.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/printer.controller.ts) — `configurePrinter` function

After saving to `capabilities.json` and **before** emitting the SSE event, inject the following Redis handshake:

```typescript
// ── Universal Redis Handshake ──
const printerType = uri.includes("ipp://") ? "ipp" : uri.startsWith("hp:/") ? "usb" : "usb";
const printerInfo = {
  name: queueName,
  alias: rawModel,
  capabilities: capabilities,
  type: printerType,
};

await redisConnection.sadd("fleet:printers", queueName);
await redisConnection.set(`printer:${queueName}:health`, "healthy");
await redisConnection.set(`printer:${queueName}:state`, "idle");
await redisConnection.set(`printer:${queueName}:strikes`, "0");
await redisConnection.set(`printer:${queueName}:info`, JSON.stringify(printerInfo));

// Emit SSE event AFTER Redis is populated
eventBus.emit("printer_discovery", { timestamp: new Date().toISOString() });
```

> [!IMPORTANT]
> This handshake is **mandatory** for ALL adapter types (IPP, HP, Epson, Generic USB, SNMP). No printer may emit `printer_discovery` before its Redis keys are populated. Failure to enforce this means the matchmaker cannot route jobs to the printer.

---

## Phase 5 — Lockdown Hardware Probes

### 5A. Seal `supplies.service.ts` to Cache-Only

#### [MODIFY] [supplies.service.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/services/supplies.service.ts)

**Current State (Flawed — lines 28–34):**
```typescript
// 2. Resolve adapter
const adapter = await PrinterFactory.getAdapter(printerName);
let result: PrinterSupplyStatus = { ...EMPTY_RESULT };

if (adapter) {
  result = await adapter.getSupplies(); // ← LIVE HARDWARE CALL in user route!
}
```

**Problem:** If the Redis cache misses (expired TTL or first request), the service falls through to calling `adapter.getSupplies()`, which executes live shell commands (`hp-levels`, `snmpwalk`, `escputil`, `ink`) in the context of a user-facing HTTP request. On a Raspberry Pi, these commands can block for 4+ seconds per printer.

**Fix:** Remove the hardware fallback entirely. Return `EMPTY_RESULT` on cache miss:

```typescript
export async function getSupplies(printerName: string): Promise<PrinterSupplyStatus> {
  const cacheKey = `supplies:${printerName}`;

  // Redis cache ONLY — no hardware fallback
  const cached = await redisConnection.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as PrinterSupplyStatus;
  }

  // Cache miss → return empty (heartbeat will populate on next sweep)
  return { ...EMPTY_RESULT };
}
```

### 5B. Audit `forceRefreshPrinter` Controller

#### [MODIFY] [printer.controller.ts](file:///c:/Users/narendra/Desktop/documents/web%20Development%20Programming/Printing_automation/server/src/app/controllers/printer.controller.ts) — `forceRefreshPrinter` function

**Current State:** This admin-only route calls `adapter.healthCheck()` and `adapter.getSupplies()` (line 120, 132).

**Decision:** This is an **admin-initiated, explicit action** (not a passive user route). The hardware call is intentional and expected to block. However, the supplies result must be **written to Redis cache** so subsequent reads use the cache:

```typescript
// Line 132: Write the result to cache
const supplies = await adapter.getSupplies();
await redisConnection.setex(`supplies:${name}`, 300, JSON.stringify(supplies));
```

> [!NOTE]
> `forceRefreshPrinter` is the **only** user-facing route permitted to execute live hardware probes, and only because it is explicitly triggered by an admin action behind `requireAuth`. The result MUST be cached immediately.

### 5C. Hardware Probe Boundary Rules

| Caller | `adapter.healthCheck()` | `adapter.getSupplies()` |
|---|---|---|
| `runComprehensiveHealthCheck` (heartbeat) | ✅ Allowed | ✅ Allowed |
| `forceRefreshPrinter` (admin route) | ✅ Allowed | ✅ Allowed (must cache result) |
| `getSupplies` controller (user route) | ❌ Forbidden | ❌ Forbidden — cache-only |
| `getKioskStatus` controller (user route) | ❌ Forbidden | ❌ Forbidden — reads from `listPrinters()` which is cache-only |
| `configurePrinter` controller (admin route) | ❌ Not needed | ❌ Not needed — capabilities probed once via `lpoptions` |

---

## Phase 6 — Standardized Printer Deletion Flow

### Problem

There is currently **no delete printer endpoint**. If a printer is physically disconnected, orphaned Redis keys (`health`, `state`, `strikes`, `info`, `supplies`) and the `fleet:printers` set entry persist indefinitely, causing phantom printers in the dashboard and potential matchmaker routing failures.

### Fix

#### [NEW] Add `deletePrinter` to `printer.controller.ts`

```typescript
export async function deletePrinter(req: Request, res: Response) {
  const name = req.params.name as string;

  try {
    // 1. OS Level — Remove CUPS queue
    await cupsCommands.deletePrinter(name);

    // 2. Cache Level — Purge ALL Redis keys
    await redisConnection.srem("fleet:printers", name);
    await redisConnection.del(
      `printer:${name}:health`,
      `printer:${name}:state`,
      `printer:${name}:strikes`,
      `printer:${name}:info`,
      `supplies:${name}`
    );

    // 3. Notify frontend
    eventBus.emit("printer_discovery", { timestamp: new Date().toISOString() });

    res.json({ success: true, message: `Printer ${name} deleted.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to delete printer", error: String(err) });
  }
}
```

#### [MODIFY] Add `deletePrinter` command to `cups.commands.ts`

```typescript
deletePrinter: async (name: string) => {
  return runSecureCommand('sudo', ['lpadmin', '-x', name]);
},
```

#### [MODIFY] Register route in `printer.routes.ts`

```typescript
router.delete("/:name", requireAuth, printerCtrl.deletePrinter);
```

---

## Verification Plan

### Automated Tests

Run the following after each phase:

```bash
# Phase 1: Ensure exec.ts compiles and exports both new functions
npx tsc --noEmit

# Phase 2: Grep for any remaining execCommand calls (should be 0 in commands/)
grep -rn "execCommand\|execWithTimeout" server/src/commands/

# Phase 2: Grep for any remaining sanitize() functions (should be 0)
grep -rn "function sanitize" server/src/commands/

# Phase 3: Verify factory routing — no "usb://hp" routes to HpLegacyAdapter
grep -n "usb://hp" server/src/factories/printer.factory.ts

# Phase 5: Verify no adapter calls in supplies.service.ts
grep -n "adapter\.\|PrinterFactory" server/src/app/services/supplies.service.ts
```

### Manual Verification

1. **HP USB Printer (HPLIP URI):** Connect an HP printer recognized by HPLIP. Trigger `POST /printers/configure`. Verify `hp-setup -a -x -q <uri>` runs headlessly without hanging. Confirm Redis keys are populated immediately.
2. **HP USB Printer (CUPS URI):** If `lpinfo -v` reports `usb://HP/...`, verify the factory routes to `GenericUsbAdapter` (not `HpLegacyAdapter`) and uses `lpadmin` for setup.
3. **IPP Network Printer:** Configure via `POST /printers/configure` with an `ipp://` URI. Verify `lpadmin -p ... -m everywhere` is called and Redis handshake completes.
4. **Supplies Cache Miss:** Call `GET /printers/:name/supplies` when no Redis cache exists. Verify it returns `EMPTY_RESULT` immediately without blocking on hardware.
5. **Printer Deletion:** Call `DELETE /printers/:name`. Verify CUPS queue is removed, all Redis keys are purged, and the SSE event fires.

---

## File Change Summary

| File | Action | Phase |
|---|---|---|
| `server/src/app/utils/exec.ts` | MODIFY — Add `runSecureCommand`, `runSecureCommandWithTimeout` | 1 |
| `server/src/commands/cups.commands.ts` | MODIFY — Full refactor to array-based args, delete `sanitize()` | 2A |
| `server/src/commands/hp.commands.ts` | MODIFY — Fix flags (`-i` → `-x`), refactor to array-based args | 2B |
| `server/src/commands/system.commands.ts` | MODIFY — Full refactor to array-based args, delete `sanitize()` | 2C |
| `server/src/factories/printer.factory.ts` | MODIFY — Split `usb://hp` vs `hp:/` routing | 3A |
| `server/src/app/controllers/printer.controller.ts` | MODIFY — Fix URI routing in `configurePrinter`, add Redis handshake, add `deletePrinter` | 3B, 4, 6 |
| `server/src/app/services/printer.service.ts` | MODIFY — Add `configureGenericUsbPrinter` | 3C |
| `server/src/app/services/supplies.service.ts` | MODIFY — Remove hardware fallback, cache-only reads | 5A |
| `server/src/app/routes/printer.routes.ts` | MODIFY — Add `DELETE /:name` route | 6 |
