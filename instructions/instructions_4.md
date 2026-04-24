**SYSTEM ROLE:** Senior Backend Architect & Node.js System Engineer
**PROJECT CONTEXT:** You are rewriting the Express.js backend for an enterprise-grade printing management system running locally on a headless Raspberry Pi. The system interfaces with the Linux CUPS (Common UNIX Printing System) via CLI commands (`child_process`).
**SYSTEM CONSTRAINTS:** The Raspberry Pi has limited RAM and CPU. The backend MUST protect the hardware from crashing under heavy loads (e.g., 50 concurrent print requests) using a "drip-feed" queue architecture. All connections operate on a local LAN with NO internet access.

**YOUR DIRECTIVE:** You are tasked with completely rewriting the backend job handling, routing, and hardware monitoring logic. You must implement a "Smart Spooler" architecture utilizing **Redis**, **BullMQ**, and **Server-Sent Events (SSE)**. 

Before writing the application code, acknowledge this master prompt and output a brief `BACKEND_EXECUTION_PLAN.md` outlining how you will structure these 5 phases. Wait for my approval before coding.

---

### **PHASE 1: THE INFRASTRUCTURE (Redis + BullMQ)**
We are abandoning SQLite/Memory arrays for job tracking. You must implement a lightning-fast Staging Queue.
* **Redis Configuration:** Ensure your documentation/setup scripts configure Redis with AOF persistence (`appendonly yes`, `appendfsync everysec`) so the queue survives power outages.
* **BullMQ Integration:** Create a `PrintMasterQueue`. 
* **The "Drip-Feed" Worker:** Create a BullMQ Worker for this queue. To protect the Pi's RAM from rasterizing too many PDFs at once, the worker's `concurrency` must be strictly managed (pulling only one job per idle printer at a time).

### **PHASE 2: THE SMART DISPATCHER (Matchmaking)**
CUPS is business-blind. You must build a Matchmaking routing engine inside the BullMQ Worker.
* **Capabilities Matrix:** Create a JSON config (or simple DB table) that defines each connected printer's capabilities (e.g., `HP_M1005: ["bw", "single"]`, `Canon_Pro: ["color", "bw", "duplex"]`).
* **The Logic:** When the worker picks up a job (e.g., Color + Duplex), it must poll `lpstat -p` to find all currently `idle` printers, intersect that list with the Capabilities Matrix, and use `lp -d <printer_name>` to send the job ONLY to an idle, fully compatible printer.
* **Delay Logic:** If no compatible printer is currently idle, the worker must gracefully delay the job in BullMQ until one frees up.

### **PHASE 3: THE JUMP-THE-LINE FAILOVER PROTOCOL**
The system must be fault-tolerant. If a printer jams or runs out of paper mid-print, the user must not lose their place in line.
* **Monitor:** The worker must actively check the CUPS queue status while a job is printing.
* **Catch & Cancel:** If CUPS reports an error, `held`, or `paused` state for the active job, the worker must execute `cancel <cups-job-id>` to clear the broken hardware.
* **Re-Queue & Re-Route:** The worker must tag the broken printer's ID onto the job's `attempted_printers` array (to avoid routing it there again). It must then re-add the job to the Master Redis Queue using **Priority 1** (BullMQ priority routing) so it instantly jumps to the front of the line and is routed to the next available backup printer.

### **PHASE 4: REAL-TIME COMMUNICATION (SSE)**
We are abandoning HTTP polling for the frontend React application.
* **SSE Endpoint:** Implement a `GET /events/jobs` endpoint using Server-Sent Events.
* **Event Broadcasting:** The backend must hold the connection open and push unidirectional JSON payloads (`{ type: "JOB_STATUS", jobId: 123, status: "printing" }`) whenever the BullMQ worker updates a job's state, or when the heartbeat detects a new printer via `lpstat -p`.

### **PHASE 5: DETERMINISTIC HARDWARE POLLING (Ink/Toner)**
We need to monitor legacy USB printer supply levels without wasting CPU cycles on hit-and-trial CLI commands.
* **The Strategy:** Create a function that runs `lpstat -v <printer_name>` to extract the specific device URI (e.g., `usb://HP/LaserJet...`).
* **Deterministic Routing:** * If the URI contains `HP`, execute `hp-levels`.
  * If the URI contains `EPSON`, execute `sudo escputil -i -u -r /dev/usb/lp0`.
  * If it's another USB brand, execute `ink -p usb`.
  * If it's a network printer (`ipp://` or `socket://`), bypass these legacy commands entirely.
* **Graceful Fallback:** If a command fails or returns no data, gracefully return `null` so the frontend can display a generic "Supplies Unknown" badge instead of crashing.

---
**YOUR FIRST ACTION:** Do not write the full codebase yet. Acknowledge these instructions, confirm you understand the "drip-feed" and failover constraints, and output the `BACKEND_EXECUTION_PLAN.md`. Wait for my command to begin coding Phase 1.