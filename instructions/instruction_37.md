# Backend Refactor Prompt: Class-Based Polymorphic Printer Adapter Strategy

You are tasked with refactoring the print job dispatch and status polling system in the backend (`server/src/infrastructure/printMaster.worker.ts` and `server/src/app/services/printer.service.ts`).

### Objective
Create a clean, polymorphic **Printer Adapter Strategy Pattern** (`IPrinterAdapter`). This isolates protocol-specific communication so that:
1. **Legacy USB/CUPS Printers** use `LegacyCupsAdapter.ts` (preserving the exact current `lp` / `lpstat -o` polling logic, `staleCounter`, strikes, and cancellation flows).
2. **Modern IPP/Network Printers** use `IppPrinterAdapter.ts` (sending direct IPP binary socket queries via `Get-Job-Attributes` for hardware-verified physical completion tracking).

---

## 1. Directory Structure & File Creation

Create a new directory for printer strategy adapters: `server/src/app/adapters/`

Files to create:
- `server/src/app/adapters/IPrinterAdapter.ts` (Interface contract)
- `server/src/app/adapters/LegacyCupsAdapter.ts` (Preserved current `lpstat` logic)
- `server/src/app/adapters/IppPrinterAdapter.ts` (Direct IPP socket client)
- `server/src/app/adapters/PrinterAdapterFactory.ts` (Dynamic strategy resolver)

---

## 2. Define Strategy Interface (`IPrinterAdapter.ts`)

```typescript
export interface PrintDispatchResult {
  cupsJobId: string;
  dispatchedAt: number;
}

export type JobPollStatus = 
  | "printing"          // Active in spooler or physical hardware rasterizing
  | "completed"         // Confirmed finished (lpstat missing or IPP job-state === 9)
  | "held_or_stopped"   // Stalled, jammed, paper empty, or paused
  | "unreachable";      // Socket timeout or connection failure

export interface IPrinterAdapter {
  /**
   * Dispatches the physical document to the target printer.
   */
  printFile(printerName: string, filePath: string, options?: Record<string, any>): Promise<PrintDispatchResult>;

  /**
   * Polls the job status using protocol-specific methods.
   */
  getJobStatus(printerName: string, jobId: string, metadata?: Record<string, any>): Promise<JobPollStatus>;

  /**
   * Cancels an active job on the hardware/spooler.
   */
  cancelJob(printerName: string, jobId: string): Promise<boolean>;
}

```

---

## 3. Implement Strategy Classes

### A. `LegacyCupsAdapter.ts` (Preserving Current Logic)

Encapsulate the current logic from `printer.service.ts` without changing how legacy polling works:

* **`printFile()`**: Executes `lp -d <printerName> -- <filePath>` using `cupsCommands.printFile()`. Returns `cupsJobId`.
* **`getJobStatus()`**:
1. Executes `lpstat -o <printerName>` via `cupsCommands.getJobStatus()`.
2. Searches stdout for `jobId`.
3. If `!jobLine` $\rightarrow$ returns `"completed"`.
4. If `jobLine` contains `"printing"` or `"pending"` $\rightarrow$ returns `"printing"`.
5. If `jobLine` contains `"held"` or `"stopped"` $\rightarrow$ returns `"held_or_stopped"`.


* **`cancelJob()`**: Executes `cancel <jobId>`.

### B. `IppPrinterAdapter.ts` (Native IPP Direct Polling)

Use the `ipp` npm package (`import ipp from 'ipp'`) for binary IPP socket communication:

* **`printFile()`**: Dispatches job via standard `lp` OR direct IPP `Print-Job` request to `metadata.ippUri`.
* **`getJobStatus()`**: Sends an IPP `Get-Job-Attributes` binary request for `job-id`:
* `job-state === 9` $\rightarrow$ returns `"completed"` (Hardware verified!).
* `job-state === 5` or `3` $\rightarrow$ returns `"printing"`.
* `job-state === 7` or `8` OR `job-state-reasons` contains `'offline-report'`, `'media-empty'`, or `'media-jam'` $\rightarrow$ returns `"held_or_stopped"`.
* Socket timeout / Error $\rightarrow$ returns `"unreachable"`.


* **`cancelJob()`**: Sends an IPP `Cancel-Job` attribute request to `metadata.ippUri`.

### C. `PrinterAdapterFactory.ts`

```typescript
import { IPrinterAdapter } from './IPrinterAdapter';
import { LegacyCupsAdapter } from './LegacyCupsAdapter';
import { IppPrinterAdapter } from './IppPrinterAdapter';
import { BackendPrinter } from '../../types';

export class PrinterAdapterFactory {
  private static legacyAdapter = new LegacyCupsAdapter();
  private static ippAdapter = new IppPrinterAdapter();

  public static getAdapter(printer: BackendPrinter): IPrinterAdapter {
    if (printer.type === 'network' || (printer.description && printer.description.startsWith('ipp'))) {
      return this.ippAdapter;
    }
    return this.legacyAdapter;
  }
}

```

---

## 4. Refactor `printMaster.worker.ts`

Update the `printMasterWorker` process loop to consume the strategy factory:

1. Fetch target printer metadata and resolve strategy adapter:
```typescript
const adapter = PrinterAdapterFactory.getAdapter(targetPrinter);

```


2. Lock Redis state to `"busy"` and emit WebSocket state updates.
3. Call `const { cupsJobId } = await adapter.printFile(matchedPrinter, tempFilePath)`.
4. Enter `while (true)` 3-second polling loop:
```typescript
await new Promise(resolve => setTimeout(resolve, 3000));
staleCounter += 3;

const status = await adapter.getJobStatus(matchedPrinter, cupsJobId, { 
  ippUri: targetPrinter.description 
});

if (status === "completed") {
  // Branch A: Success Completion
  return { cupsJobId, status: "completed", printer: matchedPrinter };
}

if (status === "held_or_stopped" || status === "unreachable" || staleCounter >= 30) {
  // Branch C: Fault / Stall / Timeout Failure
  await adapter.cancelJob(matchedPrinter, cupsJobId);

  // Increment Redis strikes (REDIS_KEYS.printerStrikes)
  // Check Quarantine (strikes >= 3)
  // Check Bad Document (attempts.length >= 2)
  // Trigger BullMQ failover retry
  throw new Error(`Job execution failed on ${matchedPrinter} with status: ${status}`);
}

// Branch B: In-Progress ("printing") -> Continue while loop

```



---

## Verification Checklist

1. **Legacy USB Printer Test:** Send job to a USB/legacy CUPS printer -> Confirm system resolves `LegacyCupsAdapter` and executes standard `lp` / `lpstat -o` polling without behavioral regression.
2. **Network IPP Printer Test:** Send job to an IPP printer -> Confirm system resolves `IppPrinterAdapter` and queries binary `Get-Job-Attributes` socket.
3. **IPP Offline Test:** Unplug an IPP printer mid-job -> Confirm IPP returns `"unreachable"` or `"held_or_stopped"`, triggering strikes and failover re-routing instead of false completion.