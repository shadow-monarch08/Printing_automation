# TASK: CREATE IMPLEMENTATION PLAN — EXECUTION LAYER & CACHE-FIRST HARDWARE LOCKDOWN

## Context & Prime Directive
You are an expert embedded systems and Node.js backend engineer. We are finalizing the architecture of a highly resilient, offline-first print spooler running on a Raspberry Pi. 
Your task is to generate a strict, step-by-step Implementation Plan (in Markdown) that integrates a series of critical execution layer fixes and hardware probing rules. 

**The Prime Directive:** The physical hardware (USB/Network bus) is a severe bottleneck. The system must operate on a strictly enforced **Redis Cache-First** architecture. Live shell commands (`ipptool`, `snmpwalk`, `lpstat`) are strictly forbidden in user-facing routes.

## Required Updates to Map in the Implementation Plan

Please generate a phase-by-phase plan that incorporates the following six architectural mandates:

### 1. Upgrade the Command Execution Wrapper (`utils/exec.ts`) & Refactor All Caller Sites
* **The Flaw:** The current system uses `child_process.exec`, which relies on `/bin/sh`. This causes shell interpolation issues (breaking URIs with `&` characters) and introduces injection vulnerabilities.
* **The Fix:** Outline the transition to `child_process.execFile` (promisified) using a new `runSecureCommand(binary: string, args: string[])` signature. 
* **The Execution:** All shell commands are isolated in a specific commands directory (e.g., `hp.commands.ts`, `cups.commands.ts`). You MUST instruct the refactoring of *every single file* in this directory. 
* **Rule:** You are strictly forbidden from passing a single interpolated string. All command calls must be updated to pass the binary and an array of arguments.
  - *Before:* `await execCommand("sudo hp-setup -a -x -q \"${uri}\"")`
  - *After:* `await runSecureCommand('sudo', ['hp-setup', '-a', '-x', '-q', uri])`
* **Actionable:** Remove any legacy regex sanitizers that were previously blocking the `&` character, as `execFile` passes arguments safely.

### 2. Fix the Printer Factory URI Routing (`printer.factory.ts`)
* **The Flaw:** HPLIP strictly requires `hp:/usb/` URIs, but CUPS native discovery sometimes returns `usb://HP/...` URIs. Passing a native CUPS URI to `hp-setup` causes a crash.
* **The Fix:** The factory must explicitly check the URI scheme.
  - If `uri.startsWith("hp:/")` → Route to `HpLegacyAdapter` (uses `hp-setup`).
  - If `uri.startsWith("usb://hp")` → Route to `GenericUsbAdapter` (uses standard CUPS `lpadmin`).

### 3. Correct the Headless HP Setup Command (`hp.commands.ts`)
* **The Flaw:** The `hp-setup` command currently uses contradictory flags (`-i` interactive mixed with `-a -q` auto/quiet), which causes the worker to hang waiting for user input.
* **The Fix:** Ensure the plan specifies updating the execution array to: `['hp-setup', '-a', '-x', '-q', uri]`. (Dropping `-i` and adding `-x` for strict headless execution).

### 4. Enforce the "Universal Redis Handshake" (Post-Setup Flow)
* **The Flaw:** Currently, after a printer is configured and its capabilities are probed (e.g., via `lpoptions -l`), the data is only saved to `capabilities.json`. This bypasses the matchmaker, rendering the printer invisible to the queue.
* **The Fix:** Outline a mandatory step for ALL adapters (IPP, HP, Generic, SNMP). Immediately after queue creation and capability probing, the backend MUST inject the initial state into Redis before emitting the `printer_discovery` SSE.
  - `SADD fleet:printers <queueName>`
  - `SET printer:<queueName>:health "healthy"`
  - `SET printer:<queueName>:state "idle"`
  - `SET printer:<queueName>:strikes "0"`
  - `HSET printer:<queueName>:info` (Inject the capabilities JSON here).

### 5. Lockdown Hardware Probes (The Monitoring Flaw)
* **The Flaw:** User-facing routes might attempt to call `adapter.getSupplies()` or `adapter.healthCheck()` directly, blocking the Node event loop with network timeouts.
* **The Fix:** Explicitly state that all adapter hardware commands (`ipptool`, `snmpwalk`, `escputil`) must ONLY be executed by the 5-minute background heartbeat loop (`runComprehensiveHealthCheck`). 
* **Rule:** Any controller or frontend route asking for printer status or ink levels must only read from the `supplies:<name>` Redis cache.

### 6. The Standardized Deletion Flow
* **The Fix:** Define the exact sequence for safely deleting a printer from the ecosystem to prevent orphaned queue locks.
  1. **OS Level:** Execute `runSecureCommand('sudo', ['lpadmin', '-x', queueName])`.
  2. **Cache Level:** Execute Redis `DEL` on `health`, `state`, `strikes`, `info`, and `supplies` keys, plus `SREM` from `fleet:printers`.

## Output Requirements
Draft the comprehensive `IMPLEMENTATION_PLAN_HARDWARE_EXECUTION.md` document detailing these steps. Ensure the dependency order logically builds the execution wrapper first, then refactors the isolated command files, and finally updates the factory and adapters.