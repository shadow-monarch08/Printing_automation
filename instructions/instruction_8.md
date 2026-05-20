# 1st Feature Implementation: Security Gates & Printer Availability

## Context
We are building a Raspberry Pi-based local print spooler with a React frontend kiosk and a Node.js backend. We need to prevent users from submitting print jobs or paying for configurations (like Color or Duplex) if the physical hardware is offline or does not support those features.

## Objective
Implement a lightweight, polling-based security gate that blocks the UI when no printers are available, and gracefully disables unsupported configuration options. Do NOT over-engineer this with WebSockets.

## Task 1: Backend API (GET /api/fleet/kiosk-status)
Create a new, fast endpoint that the frontend can poll to check the aggregate status of the printer fleet.
1. Check the status of all configured printers (via CUPS/existing printer service).
2. Determine 'isAcceptingJobs': True if at least one printer is online, idle, or busy (printing). False ONLY if all printers are offline, unplugged, or have physical errors (e.g., paper out).
3. Determine 'fleetCapabilities': Aggregate the capabilities.json of all available printers. If at least one available printer supports color, 'color': true. If at least one supports duplex, 'duplex': true.
4. Expected JSON Response:
{
  "isAcceptingJobs": true,
  "fleetCapabilities": {
    "color": false,
    "duplex": true
  }
}

## Task 2: Frontend App Wrapper / DropZone (DropZone.tsx)
1. On component mount, fetch /api/fleet/kiosk-status.
2. If 'isAcceptingJobs' is false: 
   - Render a blocking full-screen overlay/modal preventing file upload.
   - Show text: "Machine Offline / No printers available — please contact staff."
   - Initiate a polling interval (every 5 seconds) to check the endpoint again. Once true, instantly remove the overlay.
3. If 'isAcceptingJobs' is true, proceed as normal (no polling required unless they stay idle on the screen for a long time).

## Task 3: Configuration Console (ConfigConsole.tsx)
1. Consume the 'fleetCapabilities' object fetched from the backend.
2. DO NOT HIDE BUTTONS. If a capability is missing, hiding the button makes users think the UI is broken.
3. If 'fleetCapabilities.color' is false: Render the "Color" selection button, but set it to a disabled state (greyed out) and add a small UI badge or tooltip that says "Not available at this shop."
4. If 'fleetCapabilities.duplex' is false: Apply the exact same disabled state and badge to the "Double-Sided" option.


# 2nd Feature Implementation: UI ↔ Backend Sync (Global Events, Tracking & Session)

## Context
We are building a local print spooler using a BYOD (Bring Your Own Device) model where users access the web app via their smartphones. We must ensure real-time status updates are reliable, user sessions survive mobile browser tab backgrounding/refreshing, and legacy hardware quirks do not break the admin UI. 

## Objective
Decouple Server-Sent Events (SSE) from the React lifecycle into a global singleton, fix backend-to-frontend event mapping, implement Zustand session persistence, add global toast notifications, and expand the Job Tracker for multi-job session history.

## Task 1: Decouple SSE & Fix Event Mapping (sseService.ts)
1. Remove the 'useSSE' React hook entirely, as tying EventSource to component lifecycles causes dropped connections on remounts.
2. Create a vanilla TypeScript singleton ('src/services/sseService.ts') that manages the EventSource connection.
3. Implement an Event Normalization Layer: The backend emits snake_case events ('job_active', 'job_completed', 'job_failed'). Map these explicitly to the frontend store's expected types.
4. Update 'useAdminStore' and 'useUserPrintStore' to subscribe to this new singleton outside the React tree.

## Task 2: BYOD Session Persistence (useUserPrintStore.ts)
1. Wrap 'useUserPrintStore' with Zustand's 'persist' middleware.
2. Configure the persistence to use 'sessionStorage' so data survives accidental page reloads but clears when the tab is closed.
3. Persist the user's 'jobId', 'jobStatus', and 'currentStep'.
4. Implement an Auto-Clear mechanism: When the active 'jobStatus' reaches 'done' or 'failed', start a 60-second inactivity timer. If no user action occurs, automatically clear the session storage and reset to the DropZone.

## Task 3: Global Background Toasts
1. Ensure the Toast system (e.g., 'toast.success()') can be triggered imperatively outside of React components.
2. Inside 'sseService.ts', attach a listener for user-facing print events.
3. Upon receiving 'job_completed' for the current session, trigger a global success toast: "Job [Filename] completed successfully."
4. Upon receiving 'job_failed', trigger an error toast with the provided failure reason. 

## Task 4: Session-Based Job History & Queue Flow (JobTracker.tsx)
1. Expand the 'JobTracker' UI to handle a multi-job session view.
2. On mount, use the BYOD 'sessionId' to fetch all jobs tied to this session via 'GET /api/jobs?sessionId={id}'.
3. For each job, display: Document Name, Cost, Color Mode, and Duplex status.
4. For active jobs in the 'queued' status, calculate and display 'jobsAhead' based on backend queue data.
5. Add a "Print Another Document" button visible during active print states. Clicking this must reset the main UI back to Step 1 (DropZone) while keeping a minimized persistent indicator that the previous job is still processing.

## Task 5: UI Fallbacks for Legacy Hardware (Fleet.tsx)
1. In the Admin Dashboard's Printer Fleet view, validate the supply objects ('supplyBlack', 'supplyColor', 'paper').
2. If the backend returns 'null' or "unknown" (which is expected behavior for legacy printers without SNMP/IPP), do not render blank spaces or allow the UI to break.
3. Render a grayed-out badge stating "N/A" or "Unknown" to clearly indicate the hardware simply does not report this metric.


# 3rd Feature Implementation: Robust Printing Logic & Failure Recovery

## Context
We need to harden the print spooler's error handling to survive hardware failures. Relying solely on `lpstat` is dangerous because CUPS queues report as "idle" even when the printer is unplugged. We must implement "Digital Probes" to verify physical/network connectivity, limit failover retries to prevent queue clogging, and give the admin a way to force-refresh a printer's status.

## Objective
Adjust the BullMQ retry limits, implement a non-destructive startup health sweep using digital probes (lsusb/ipptool), ensure supply checks are always performed after a successful probe, build an admin "Force Refresh" endpoint, and improve the user-facing hardware error UI.

## Task 1: Fix Job Retry Limits (printMaster.queue.ts & printMaster.worker.ts)
1. The requirement explicitly states a maximum of 2 retries per job.
2. In 'printMaster.queue.ts', change the BullMQ queue configuration from 'attempts: 4' to 'attempts: 3' (1 initial attempt + 2 retries).
3. In 'printMaster.worker.ts', locate the failover logic loop. Change the condition that throws the final error from 'attemptedPrinters.length >= 3' to 'attemptedPrinters.length >= 2'.

## Task 2: Digital Startup Health Sweep (server.ts)
1. Create a lightweight boot sequence that runs once when the Node server starts to flag printers as 'healthy' or 'flagged'.
2. STRICT CONSTRAINT: Under no circumstances should this startup sequence send a physical test print to the printers.
3. For Legacy USB printers: Run a digital probe using `lsusb | grep "Vendor:Product"` to verify the physical copper connection.
4. For Modern IPP printers (USB & LAN): Run a digital probe using `ipptool -tv "<uri>" get-printer-attributes.test` to verify the network/software connection.
5. IF AND ONLY IF the digital probe passes, you MUST execute `getSupplies()` at the end of the check to fetch the latest ink and paper levels and cache them. If the probe fails, immediately flag as offline.

## Task 3: Admin "Force Refresh" Button (Fleet.tsx & printer.controller.ts)
1. Create a new backend endpoint: 'POST /api/printers/:name/refresh'.
2. This endpoint must explicitly delete the Redis cache for that specific printer.
3. It must perform the exact same Digital Probe logic from Task 2 (lsusb for legacy, ipptool for modern). 
4. If the probe passes, it MUST execute the supply check at the end to get fresh data, update the 'flagged'/'healthy' status, and return the result.
5. In the Admin UI ('Fleet.tsx'), add a prominent "Force Refresh" or "Check Health" button to each individual printer card. When clicked, show a loading spinner on that card until the fresh data returns.

## Task 4: Simplified User Hardware Error UI (JobTracker.tsx)
1. If a job exhausts its 2 retries, the backend emits 'job_failed'.
2. Update the 'JobTracker.tsx' UI for the 'failed' state. Instead of just a generic error, explicitly state: "Hardware Error. We have paused your job. Please notify the shop staff."
3. Do NOT build a digital "Contact Admin" messaging feature. 
4. Provide a single "Cancel Job & Start Over" button that wipes the session and returns the user to the DropZone.


# 4th Feature Implementation: Print Admin Special Access & Emergency Controls

## Context
We need to finalize the Admin Dashboard controls. The backend supports pausing and resuming jobs, but the UI is missing the Resume button. Furthermore, we must reject complex "batch processing" and "drag-and-drop" in favor of real-world survival tools: a global queue pause (for maintenance) and an Emergency Kill Switch (for rogue print jobs).

## Objective
Implement the missing Resume button for individual jobs, build a Global Queue Pause toggle to safely hold incoming jobs, and wire up an Emergency Kill Switch to instantly flush all active queues and physical printers.

## Task 1: Fix Individual Job Controls (Queue.tsx)
1. The backend already supports 'POST /api/jobs/:id/resume'.
2. In 'Queue.tsx', locate the job control action buttons. 
3. If a job is currently in a 'paused' state, render a "Resume" button next to the Cancel button. 
4. Ensure clicking it calls the endpoint and updates the UI state.

## Task 2: Global Queue Pause/Resume (Backend & Frontend)
1. Create two new admin-protected endpoints: 'POST /api/queue/pause' and 'POST /api/queue/resume'.
2. In the backend, these endpoints must interact with BullMQ to pause the worker (stopping it from pulling new jobs off the queue) and resume it. Existing printing jobs will finish, but no new jobs will be sent to the physical printers.
3. In the Admin 'Queue.tsx' UI, add a prominent global toggle switch at the top of the page: "Accepting Jobs vs. Queue Paused". 
4. While paused, the frontend Kiosk UI must remain active (students can still upload and pay), but their jobs will remain in 'queued' status until the admin resumes.

## Task 3: The Emergency "Kill Switch" (Backend & Frontend)
1. Create a new admin-protected endpoint: 'POST /api/queue/emergency-stop'.
2. This endpoint must do two things simultaneously:
   - Command BullMQ to completely empty/flush all waiting jobs.
   - Execute the Linux CUPS command `cancel -a` to instantly wipe all physical hardware queues across all printers.
3. In the Admin UI ('Queue.tsx' and 'Dashboard.tsx'), add a massive, red "EMERGENCY STOP ALL" button.
4. Clicking this button MUST trigger a strict confirmation modal ("Are you sure? This will wipe all current jobs without refunding the users.") before executing the endpoint.


# 5th Feature Implementation: Singular Module-Based Backend Architecture

## Context
The current backend has accumulated severe technical debt. Printer logic (HP vs Epson vs IPP) is tangled in massive if/else blocks inside monolithic service files, and raw Linux shell commands (`exec()`) are scattered dangerously across multiple controllers and services. We need to refactor this to ensure maintainability, allow easy addition of new printer brands, and secure against command injection.

## Objective
Refactor the backend architecture to use the Factory/Adapter design pattern for hardware interaction, and centralize all Linux shell executions into a dedicated, sanitized command registry.

## Task 1: Centralized Shell Command Registry (src/commands/)
1. Create a new directory: 'src/commands/'.
2. Separate CLI interactions into domain-specific files: 'cups.commands.ts', 'hp.commands.ts', 'system.commands.ts'.
3. Find every instance of `exec()` or `execPromise()` scattered across 'printer.service.ts', 'supplies.service.ts', 'job.service.ts', etc., and move them into these new files.
4. Export typed, sanitized functions. Example: Instead of running `exec('cancel ' + id)` in a controller, the controller calls `cups.cancelJob(id)`.
5. Ensure the new command wrappers handle input sanitization (e.g., rejecting job IDs with semicolons or spaces) to prevent command injection vulnerabilities.

## Task 2: The Printer Adapter Pattern (src/adapters/)
1. Create a common interface 'IPrinterAdapter' defining the strict contract every hardware type must follow. Required methods: 'healthCheck()', 'getSupplies()', 'configure()'.
2. Create dedicated adapter classes implementing this interface: 'HpLegacyAdapter.ts', 'IppModernAdapter.ts', and 'EpsonLegacyAdapter.ts'.
3. Move the protocol-specific logic (currently buried in 'supplies.service.ts') into these specific adapters.

## Task 3: The Printer Factory (src/factories/printer.factory.ts)
1. Create a Factory class that takes a printer URI or model string.
2. The Factory will evaluate the URI (e.g., matching 'ipp://' or 'hp:/usb/') and return the instantiated instance of the correct Adapter.

## Task 4: Refactor Monolithic Services
1. Gut the massive 'if/else' protocol-checking blocks inside 'printer.service.ts' and 'supplies.service.ts'.
2. Replace them with clean Factory calls. Example flow: `const adapter = PrinterFactory.getAdapter(printerUri); const supplies = await adapter.getSupplies();`
3. Ensure no features break during this refactor (specifically ensure the new adapters correctly map to the new centralized command registry).


# 6th Feature Implementation: Printer Configuration, Auto-Detection & UI Segregation

## Context
When a new printer is connected, the system must automatically detect it, segregate it in the UI, configure it, and accurately detect its physical capabilities (Color vs B&W, Duplex) without printing a physical test page. If auto-detection fails, the system must gracefully fall back to asking the Admin for manual input.

## Objective
Implement UI segregation for configured vs unconfigured hardware, build an Admin UI setup wizard, handle backend IPP/Legacy queue creation, parse `lpoptions` for capabilities, and build a manual-override UI for when digital detection fails.

## Task 1: UI Segregation of Fleet (Fleet.tsx)
1. Redesign the 'Fleet.tsx' view to feature two distinct, clearly separated sections: "Active Printers" (Configured) and "Detected Hardware" (Unconfigured).
2. The backend 'GET /api/printers' must return these as two separate arrays. Configured printers exist in CUPS/'capabilities.json'. Detected hardware is found via raw USB/IPP scans but lacks active queues.
3. Upon successful completion of the Setup Wizard (Task 2), the frontend must instantly refresh its state so the newly configured printer visually moves from the "Detected Hardware" list into the "Active Printers" list.

## Task 2: Admin Setup Wizard & Custom Naming (Fleet.tsx)
1. In the "Detected Hardware" section, the "Configure" button must open a "Setup Wizard" modal.
2. Prompt the admin to enter a custom, clean name for the printer (e.g., "Counter_HP_LaserJet"). Sanitize this input to remove spaces or invalid CUPS characters.
3. When they click "Start Setup", show a loading spinner inside the modal while the backend processes the queue creation and capability detection.

## Task 3: Backend Queue Creation (IPP & Legacy)
1. Update the 'POST /api/printers/configure' endpoint to accept the custom name provided by the admin.
2. For Legacy Printers (HP): Execute the standard `hp-setup -i -a -x -q` (or similar non-interactive command) and rename the resulting queue to the admin's custom name.
3. For Modern IPP Printers: Use the universal driverless command: `sudo lpadmin -p "[Clean_Name]" -E -v "[IPP_URI]" -m everywhere`.

## Task 4: Capability Probing via 'lpoptions' (printer.controller.ts)
1. Immediately after the queue is created, the backend must run `lpoptions -p [Clean_Name] -l`.
2. Parse the output text:
   - Check for `Color`, `Grayscale`, or `RGB`.
   - Check for `Duplex`, `Two-Sided`, or `sides`.
3. Based on the parsed string, determine the boolean values for `color` and `duplex`. Write these values into 'capabilities.json'.

## Task 5: Graceful Fallback & Manual Override (Strict Veto on Physical Tests)
1. NEVER run physical test prints if capabilities cannot be read.
2. If `lpoptions` fails to return clear capability data, the backend must save the printer with defaults (`color: false`, `duplex: false`) BUT return a flag in the API response: `requiresManualConfig: true`.
3. In the Admin UI, if the setup response includes `requiresManualConfig: true`, instantly transition the modal to a Manual Override screen.
4. Display the message: "We couldn't automatically detect this printer's features. Please confirm its capabilities."
5. Provide two toggle switches (Color Printing and Double-Sided Printing). When the admin saves this, send a 'PUT /api/printers/:name/capabilities' request to update 'capabilities.json' and close the modal.


# 7th Feature Implementation: Mobile-First UI/UX Refinements

## Context
The application relies heavily on a BYOD (Bring Your Own Device) flow. The web app needs to feel like a native mobile application when opened via a QR code. We must prevent accidental zooming, ensure buttons are easily tappable, and compact the configuration screen so it fits within a single viewport frame without requiring complex scroll/swipe logic.

## Objective
Update HTML meta tags to enforce an app-like viewport, audit CSS for touch accessibility standards, and streamline the ConfigConsole layout for mobile breakpoints without using heavy carousel libraries.

## Task 1: Viewport & Native App Meta Tags (index.html)
1. Locate the `<meta name="viewport">` tag in `index.html`.
2. Update it to prevent pinch-to-zoom and double-tap-to-zoom: `content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"`.
3. Add iOS web app capable meta tags to hide Safari UI elements if the user bookmarks it: `<meta name="apple-mobile-web-app-capable" content="yes">` and `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`.

## Task 2: Touch Target Accessibility (responsive.css)
1. Audit all interactive elements (buttons, inputs, toggles, plus/minus steppers) inside the user flow components (`DropZone`, `ConfigConsole`, `JobTracker`).
2. Apply CSS rules to ensure every interactive element has a minimum height and width of `44px` (the mobile accessibility standard) to prevent misclicks on small screens.

## Task 3: Compact Config Console (ConfigConsole.tsx)
1. The requirement suggested complex "swipe-based layouts". REJECT THIS. Keep the UI simple and static.
2. Instead, target the mobile breakpoint (`@media (max-width: 640px)`) in your CSS/Tailwind.
3. Reduce internal padding, margins, and font sizes within the `ConfigConsole` specifically for mobile. 
4. The goal is to stack the 4 configuration blocks (Copies, Pages, Color, Duplex) tightly enough that they fit entirely within the viewport of a standard 6-inch phone screen, eliminating the need for the user to scroll down to find the "Submit" button.


# 8th Feature Implementation: Admin System Metrics & Resource Protection

## Context
The Raspberry Pi print spooler is highly susceptible to SD card exhaustion (due to massive CUPS raster files) and RAM limitations. The Admin Dashboard must provide real-time visibility into CPU, RAM, and Disk Usage. Furthermore, we need a simple 30-minute historical graph and a failsafe to protect the Pi from crashing if the disk fills up.

## Objective
Expand the backend metrics service to capture memory and disk data, implement a lightweight rolling history buffer, visualize this in the React Admin UI, and build an automatic disk-space kill switch.

## Task 1: Expand Backend Metrics (events.controller.ts / system.service.ts)
1. Add Memory Metrics: Use Node's built-in `os.freemem()` and `os.totalmem()` to calculate percentage used.
2. Add Disk Metrics: Create a sanitized shell command wrapper (in the `src/commands/` folder from Section 5) to run `df -h /` (or `statvfs`) and parse the exact percentage of disk space used on the root partition.
3. Update the `BackendMetrics` TypeScript interface to include `memoryUsed`, `memoryTotal`, `diskUsed`, `diskTotal`, and `diskPercent`.

## Task 2: The SD Card Failsafe (Disk Space Kill Switch)
1. Inside the system metrics polling loop, check the `diskPercent`.
2. If `diskPercent` > 95%, the backend MUST automatically trigger the "Global Queue Pause" endpoint (built in Section 4). 
3. Emit a critical SSE alert to the Admin UI so the shop owner knows they need to clear old jobs/files before the Pi crashes.

## Task 3: Lightweight Time-Series History (Backend)
1. Do not install heavy database plugins for metrics. 
2. Create a rolling buffer (either an in-memory Node array or a Redis List using `LTRIM`).
3. Store exactly one metric snapshot every 30 seconds, capped at 60 entries (a 30-minute sliding window).
4. Create a new endpoint `GET /api/metrics/history` that returns this array of `{ timestamp, cpu, memory, disk }`.

## Task 4: Admin Dashboard Visualization (Dashboard.tsx)
1. Install a React-native, tree-shakeable charting library (e.g., `recharts`). Do not use heavy canvas libraries like `chart.js` unless already installed.
2. Replace the placeholder "Real-time graph" cards in `Dashboard.tsx` with three simple, clean line charts (CPU, Memory, Disk) mapping the data from the `/history` endpoint.
3. Apply standard UI health colors to the current status text (Green for <70%, Yellow for 70-89%, Red for >90%).