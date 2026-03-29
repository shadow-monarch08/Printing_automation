# 🖨️ IMPLEMENTATION PLAN — Local Secure Printing System (Phase 1.5)

> **Target:** Raspberry Pi (2 GB RAM) · Raspberry Pi OS Lite 64-bit  
> **Stack:** Node.js · TypeScript · Express.js · Multer · CUPS  
> **Scope:** Admin-Controlled Printing — no auth, no DB, no queue, no cloud.

---

## Table of Contents

1. [Phase 0 — Environment Setup](#phase-0--environment-setup)
2. [Phase 1 — Project Scaffolding](#phase-1--project-scaffolding)
3. [Phase 2 — CUPS Service Layer](#phase-2--cups-service-layer)
4. [Phase 3 — API Development](#phase-3--api-development)
5. [Phase 4 — Admin UI](#phase-4--admin-ui)
6. [Phase 5 — Integration & Testing](#phase-5--integration--testing)
7. [File-by-File Code Guide](#file-by-file-code-guide)
8. [Validation Checklist](#validation-checklist)

---

## Phase 0 — Environment Setup

### 0.1 System Dependencies (Raspberry Pi)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # Expected: v20.x.x
npm -v    # Expected: 10.x.x

# Install CUPS
sudo apt install -y cups

# Allow CUPS to be managed from the browser (optional, for debugging)
sudo cupsctl --remote-admin
sudo usermod -aG lpadmin $USER

# Start CUPS
sudo systemctl enable cups
sudo systemctl start cups

# Verify CUPS
lpstat -t   # Should show scheduler status & any configured printers
```

### 0.2 Connect a Printer

1. Plug in a USB printer **or** connect a network printer.
2. Open `http://localhost:631` in a browser on the Pi.
3. **Administration → Add Printer** → follow the wizard.
4. Verify with `lpstat -p -d` — the printer should appear.

> **Dev note (Windows / macOS):** During development on a non-Pi machine you can still scaffold the code. The `child_process` calls to `lp` / `lpstat` will fail gracefully—this is expected; actual printing is tested on the Pi.

---

## Phase 1 — Project Scaffolding

### 1.1 Create the project

```bash
# From the repo root (Printing_automation/)
mkdir -p server/src/{controllers,services,routes,utils}
mkdir -p server/uploads
cd server
```

### 1.2 Initialise npm & install dependencies

```bash
npm init -y

# Runtime
npm install express multer cors

# Dev
npm install -D typescript ts-node nodemon @types/node @types/express @types/multer @types/cors
```

### 1.3 TypeScript config — `server/tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.4 npm scripts — add to `server/package.json`

```jsonc
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

### 1.5 Verify scaffolding

```bash
npx tsc --noEmit   # Should succeed with zero errors (no source files yet is okay)
```

---

## Phase 2 — CUPS Service Layer

> All CUPS interaction lives in **one service file** so the rest of the app never touches `child_process` directly.

### 2.1 Utility — `server/src/utils/exec.ts`

**Purpose:** Promisified wrapper around `child_process.exec`.

```typescript
import { exec } from "child_process";

/**
 * Runs a shell command and returns { stdout, stderr }.
 * Rejects on non-zero exit code.
 */
export function execCommand(
  command: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
        return;
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}
```

### 2.2 Service — `server/src/services/printer.service.ts`

**Purpose:** High-level functions that call CUPS CLI and parse output.

```typescript
import { execCommand } from "../utils/exec";
import path from "path";

export interface PrinterInfo {
  name: string;
  description: string;
  status: string;
}

/**
 * List all printers known to CUPS.
 * Parses `lpstat -p -d` output.
 */
export async function listPrinters(): Promise<PrinterInfo[]> {
  const { stdout } = await execCommand("lpstat -p");
  // Each line: "printer <name> is idle. ..." or "printer <name> disabled ..."
  const printers: PrinterInfo[] = [];
  const lines = stdout.split("\n").filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^printer\s+(\S+)\s+(.*)/);
    if (match) {
      printers.push({
        name: match[1],
        description: match[2],
        status: line.includes("idle") ? "idle" : "busy",
      });
    }
  }
  return printers;
}

/**
 * Get the system default printer.
 * Parses `lpstat -d` output → "system default destination: <name>"
 */
export async function getDefaultPrinter(): Promise<string | null> {
  try {
    const { stdout } = await execCommand("lpstat -d");
    const match = stdout.match(/system default destination:\s*(\S+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Set the system default printer.
 * Runs `lpoptions -d <printerName>`.
 */
export async function setDefaultPrinter(printerName: string): Promise<void> {
  await execCommand(`lpoptions -d ${printerName}`);
}

/**
 * Print a file.
 * @param filePath  - Absolute path to the uploaded file.
 * @param printer   - (Optional) Target printer name; uses default if omitted.
 * @returns The CUPS job ID string.
 */
export async function printFile(
  filePath: string,
  printer?: string
): Promise<string> {
  const printerFlag = printer ? `-d ${printer}` : "";
  const { stdout } = await execCommand(
    `lp ${printerFlag} -- "${filePath}"`
  );
  // stdout example: "request id is MyPrinter-42 (1 file(s))"
  const match = stdout.match(/request id is (\S+)/);
  return match ? match[1] : stdout;
}
```

### 2.3 Verify CUPS service (manual)

```bash
# On the Raspberry Pi with a printer installed:
npx ts-node -e "
  import { listPrinters, getDefaultPrinter } from './src/services/printer.service';
  (async () => {
    console.log('Printers:', await listPrinters());
    console.log('Default:', await getDefaultPrinter());
  })();
"
```

**Expected output:** An array of printer objects and/or `null` for default.

---

## Phase 3 — API Development

### 3.1 Controller — `server/src/controllers/printer.controller.ts`

```typescript
import { Request, Response } from "express";
import * as printerService from "../services/printer.service";

/**
 * GET /printers
 */
export async function getPrinters(req: Request, res: Response) {
  try {
    const printers = await printerService.listPrinters();
    res.json({ success: true, printers });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to list printers",
      error: err?.error?.message || String(err),
    });
  }
}

/**
 * GET /printers/default
 */
export async function getDefaultPrinter(req: Request, res: Response) {
  try {
    const defaultPrinter = await printerService.getDefaultPrinter();
    res.json({ success: true, defaultPrinter });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to get default printer",
      error: err?.error?.message || String(err),
    });
  }
}

/**
 * POST /printers/default  { printerName: string }
 */
export async function setDefaultPrinter(req: Request, res: Response) {
  const { printerName } = req.body;
  if (!printerName) {
    return res
      .status(400)
      .json({ success: false, message: "printerName is required" });
  }

  try {
    await printerService.setDefaultPrinter(printerName);
    res.json({ success: true, message: `Default printer set to ${printerName}` });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Failed to set default printer",
      error: err?.error?.message || String(err),
    });
  }
}
```

### 3.2 Controller — `server/src/controllers/print.controller.ts`

```typescript
import { Request, Response } from "express";
import * as printerService from "../services/printer.service";
import path from "path";
import fs from "fs";

/**
 * POST /print
 * Expects multipart form-data with a `file` field.
 * Optional body field: `printer` (target printer name).
 */
export async function printFile(req: Request, res: Response) {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }

  const filePath = path.resolve(req.file.path);
  const targetPrinter = req.body.printer || undefined;

  try {
    const jobId = await printerService.printFile(filePath, targetPrinter);
    res.json({
      success: true,
      message: "Print job submitted",
      jobId,
      file: req.file.originalname,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: "Print job failed",
      error: err?.error?.message || String(err),
    });
  }
}
```

### 3.3 Routes — `server/src/routes/printer.routes.ts`

```typescript
import { Router } from "express";
import * as printerCtrl from "../controllers/printer.controller";

const router = Router();

router.get("/", printerCtrl.getPrinters);
router.get("/default", printerCtrl.getDefaultPrinter);
router.post("/default", printerCtrl.setDefaultPrinter);

export default router;
```

### 3.4 Routes — `server/src/routes/print.routes.ts`

```typescript
import { Router } from "express";
import multer from "multer";
import path from "path";
import * as printCtrl from "../controllers/print.controller";

const upload = multer({
  dest: path.join(__dirname, "../../uploads"),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

const router = Router();

router.post("/", upload.single("file"), printCtrl.printFile);

export default router;
```

### 3.5 App — `server/src/app.ts`

```typescript
import express from "express";
import cors from "cors";
import path from "path";
import printerRoutes from "./routes/printer.routes";
import printRoutes from "./routes/print.routes";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the admin UI (static files)
app.use(express.static(path.join(__dirname, "../../admin")));

// API routes
app.use("/printers", printerRoutes);
app.use("/print", printRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
```

### 3.6 Server entry — `server/src/server.ts`

```typescript
import app from "./app";

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🖨️  Print server running at http://0.0.0.0:${PORT}`);
});
```

### 3.7 Verify APIs

```bash
# Start the server
cd server
npm run dev

# In another terminal:
curl http://localhost:3000/health
# Expected: { "status": "ok", "timestamp": "..." }

curl http://localhost:3000/printers
# Expected: { "success": true, "printers": [...] }

curl http://localhost:3000/printers/default
# Expected: { "success": true, "defaultPrinter": "..." }

curl -X POST http://localhost:3000/printers/default \
  -H "Content-Type: application/json" \
  -d '{"printerName":"MyPrinter"}'
# Expected: { "success": true, "message": "Default printer set to MyPrinter" }

curl -X POST http://localhost:3000/print \
  -F "file=@/path/to/test.pdf"
# Expected: { "success": true, "jobId": "...", "file": "test.pdf" }
```

---

## Phase 4 — Admin UI

> A single-page HTML interface saved at `admin/index.html`.  
> Served as static files by Express (configured in `app.ts`).

### 4.1 Create the admin folder

```bash
# From the repo root (Printing_automation/)
mkdir -p admin
```

### 4.2 File — `admin/index.html`

**Purpose:** Minimal, functional Admin Panel with three sections:

| Section          | Functionality                                  |
|------------------|-------------------------------------------------|
| Printers List    | Fetch & display all printers, show default      |
| Set Default      | Dropdown to pick a printer + "Set Default" btn  |
| Upload & Print   | File picker + optional printer select + Print   |

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Print Admin Panel</title>
  <style>
    /* ─── Reset & Base ──────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #0f1117;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 2rem 1rem;
    }

    .container {
      width: 100%;
      max-width: 680px;
    }

    /* ─── Header ────────────────────────────────────── */
    header {
      text-align: center;
      margin-bottom: 2rem;
    }
    header h1 {
      font-size: 1.8rem;
      background: linear-gradient(135deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    header p {
      color: #94a3b8;
      margin-top: .4rem;
      font-size: .95rem;
    }

    /* ─── Card ──────────────────────────────────────── */
    .card {
      background: #1a1d2e;
      border: 1px solid #2d3148;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.25rem;
      transition: border-color .2s;
    }
    .card:hover { border-color: #60a5fa44; }
    .card h2 {
      font-size: 1.15rem;
      margin-bottom: 1rem;
      color: #c4b5fd;
    }

    /* ─── Buttons ───────────────────────────────────── */
    button, .btn {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      border: none;
      padding: .6rem 1.4rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: .9rem;
      font-weight: 600;
      transition: transform .15s, box-shadow .15s;
    }
    button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 14px #6366f155;
    }
    button:active { transform: scale(.97); }
    button:disabled {
      opacity: .5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    /* ─── Form elements ─────────────────────────────── */
    select, input[type="file"] {
      background: #0f1117;
      color: #e2e8f0;
      border: 1px solid #2d3148;
      border-radius: 8px;
      padding: .55rem .75rem;
      width: 100%;
      font-size: .9rem;
      margin-bottom: .75rem;
    }
    select:focus, input[type="file"]:focus {
      outline: none;
      border-color: #6366f1;
    }

    /* ─── Printer list ──────────────────────────────── */
    .printer-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: .6rem .85rem;
      background: #0f1117;
      border-radius: 8px;
      margin-bottom: .5rem;
      font-size: .9rem;
    }
    .printer-item .name { font-weight: 600; }
    .printer-item .badge {
      font-size: .75rem;
      padding: .2rem .6rem;
      border-radius: 999px;
      background: #22c55e22;
      color: #4ade80;
    }
    .printer-item .badge.default {
      background: #6366f122;
      color: #a78bfa;
    }

    /* ─── Status bar ────────────────────────────────── */
    #status {
      margin-top: .75rem;
      padding: .6rem;
      border-radius: 8px;
      font-size: .85rem;
      display: none;
    }
    #status.success { display: block; background: #22c55e18; color: #4ade80; border: 1px solid #22c55e33; }
    #status.error   { display: block; background: #ef444418; color: #f87171; border: 1px solid #ef444433; }
    #status.info    { display: block; background: #3b82f618; color: #60a5fa; border: 1px solid #3b82f633; }

    /* ─── Misc ──────────────────────────────────────── */
    .row { display: flex; gap: .75rem; align-items: center; }
    .grow { flex: 1; }
  </style>
</head>
<body>
  <div class="container">

    <!-- Header -->
    <header>
      <h1>🖨️ Print Admin Panel</h1>
      <p>Local Secure Printing System · Phase 1.5</p>
    </header>

    <!-- Printers List -->
    <div class="card" id="printers-card">
      <h2>📋 Available Printers</h2>
      <div id="printer-list"><em style="color:#64748b">Loading…</em></div>
      <br />
      <button id="btn-refresh" onclick="loadPrinters()">Refresh</button>
    </div>

    <!-- Set Default Printer -->
    <div class="card">
      <h2>⭐ Set Default Printer</h2>
      <div class="row">
        <select id="select-default" class="grow"></select>
        <button onclick="setDefault()">Set Default</button>
      </div>
    </div>

    <!-- Upload & Print -->
    <div class="card">
      <h2>🖨️ Upload & Print</h2>
      <input type="file" id="file-input" />
      <div class="row">
        <select id="select-printer" class="grow">
          <option value="">Use default printer</option>
        </select>
        <button onclick="submitPrint()">Print</button>
      </div>
    </div>

    <!-- Status -->
    <div id="status"></div>
  </div>

  <script>
    const API = window.location.origin;

    // ── Status helper ────────────────────────────────
    function showStatus(msg, type = "info") {
      const el = document.getElementById("status");
      el.textContent = msg;
      el.className = type;
    }

    // ── Load printers ────────────────────────────────
    async function loadPrinters() {
      try {
        showStatus("Fetching printers…", "info");

        const [printersRes, defaultRes] = await Promise.all([
          fetch(`${API}/printers`).then((r) => r.json()),
          fetch(`${API}/printers/default`).then((r) => r.json()),
        ]);

        const printers = printersRes.printers || [];
        const defaultName = defaultRes.defaultPrinter || "";

        // Render list
        const listEl = document.getElementById("printer-list");
        if (printers.length === 0) {
          listEl.innerHTML = '<em style="color:#64748b">No printers found.</em>';
        } else {
          listEl.innerHTML = printers
            .map(
              (p) => `
            <div class="printer-item">
              <span class="name">${p.name}</span>
              <span>
                <span class="badge">${p.status}</span>
                ${p.name === defaultName ? '<span class="badge default">default</span>' : ""}
              </span>
            </div>`
            )
            .join("");
        }

        // Populate dropdowns
        const options = printers
          .map((p) => `<option value="${p.name}">${p.name}</option>`)
          .join("");

        document.getElementById("select-default").innerHTML = options;
        document.getElementById("select-printer").innerHTML =
          '<option value="">Use default printer</option>' + options;

        showStatus(`Found ${printers.length} printer(s). Default: ${defaultName || "none"}`, "success");
      } catch (e) {
        showStatus("Failed to load printers: " + e.message, "error");
      }
    }

    // ── Set default printer ──────────────────────────
    async function setDefault() {
      const printerName = document.getElementById("select-default").value;
      if (!printerName) return showStatus("Select a printer first", "error");

      try {
        const res = await fetch(`${API}/printers/default`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ printerName }),
        }).then((r) => r.json());

        showStatus(res.message || "Default printer updated", res.success ? "success" : "error");
        if (res.success) loadPrinters();
      } catch (e) {
        showStatus("Error: " + e.message, "error");
      }
    }

    // ── Submit print job ─────────────────────────────
    async function submitPrint() {
      const fileInput = document.getElementById("file-input");
      if (!fileInput.files.length) return showStatus("Choose a file first", "error");

      const formData = new FormData();
      formData.append("file", fileInput.files[0]);

      const printer = document.getElementById("select-printer").value;
      if (printer) formData.append("printer", printer);

      try {
        showStatus("Uploading & printing…", "info");
        const res = await fetch(`${API}/print`, {
          method: "POST",
          body: formData,
        }).then((r) => r.json());

        if (res.success) {
          showStatus(`✅ Printed "${res.file}" — Job ID: ${res.jobId}`, "success");
          fileInput.value = "";
        } else {
          showStatus(`❌ ${res.message}`, "error");
        }
      } catch (e) {
        showStatus("Print failed: " + e.message, "error");
      }
    }

    // ── Init ─────────────────────────────────────────
    loadPrinters();
  </script>
</body>
</html>
```

### 4.3 Verify Admin UI

1. Start the server: `cd server && npm run dev`
2. Open `http://localhost:3000` in a browser.
3. The admin panel should load with the printer list, set-default dropdown, and upload+print form.

---

## Phase 5 — Integration & Testing

### 5.1 Smoke Tests (manual, on Raspberry Pi)

| # | Test                            | Command / Action                                                   | Expected Result                         |
|---|----------------------------------|---------------------------------------------------------------------|-----------------------------------------|
| 1 | Health check                    | `curl http://localhost:3000/health`                                | `{ "status": "ok", ... }`              |
| 2 | List printers                   | `curl http://localhost:3000/printers`                              | Array of printer objects                |
| 3 | Get default printer             | `curl http://localhost:3000/printers/default`                      | `{ "defaultPrinter": "..." }`          |
| 4 | Set default printer             | `curl -X POST … -d '{"printerName":"…"}'`                        | `{ "success": true }`                  |
| 5 | Print a file via API            | `curl -X POST http://localhost:3000/print -F "file=@test.pdf"`    | `{ "success": true, "jobId": "..." }`  |
| 6 | Print via Admin UI              | Open browser → Upload file → Click "Print"                        | Success status in UI                    |
| 7 | Large file rejection (>50 MB)   | Upload a >50 MB file via API                                       | `413` or Multer error response          |
| 8 | No file submitted               | `curl -X POST http://localhost:3000/print`                         | `{ "success": false, "message": "No file uploaded" }` |

### 5.2 Error Cases to Verify

* **CUPS not running:** Stop CUPS (`sudo systemctl stop cups`), hit `/printers` → should get 500 error with descriptive message.
* **Invalid printer name:** `POST /printers/default` with a non-existent name → should get 500 error.
* **No printers configured:** Remove all printers from CUPS → `/printers` should return empty array.

### 5.3 Production Readiness (on Pi)

```bash
# Build TypeScript
cd server && npm run build

# Run compiled JS
node dist/server.js

# (Optional) Run as a systemd service for boot persistence:
sudo tee /etc/systemd/system/print-server.service > /dev/null <<EOF
[Unit]
Description=Local Print Server
After=network.target cups.service

[Service]
ExecStart=/usr/bin/node /home/pi/Printing_automation/server/dist/server.js
WorkingDirectory=/home/pi/Printing_automation/server
Restart=always
User=pi
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable print-server
sudo systemctl start print-server
```

---

## File-by-File Code Guide

### Final Project Tree

```
Printing_automation/
├── admin/
│   └── index.html              ← Admin Panel UI
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── printer.controller.ts   ← Handles /printers routes
│   │   │   └── print.controller.ts     ← Handles /print route
│   │   ├── services/
│   │   │   └── printer.service.ts      ← CUPS interaction layer
│   │   ├── routes/
│   │   │   ├── printer.routes.ts       ← Router for /printers
│   │   │   └── print.routes.ts         ← Router for /print
│   │   ├── utils/
│   │   │   └── exec.ts                 ← Promisified child_process.exec
│   │   ├── app.ts                      ← Express app configuration
│   │   └── server.ts                   ← Entry point — starts listening
│   ├── uploads/                        ← Multer upload destination
│   ├── package.json
│   └── tsconfig.json
├── instructions/
│   └── instruction_1.md
└── IMPLEMENTATION_PLAN.md              ← This file
```

### Component Connection Diagram

```
┌──────────────────────────────────────────────────────┐
│                   Admin UI (browser)                 │
│                  admin/index.html                    │
└──────────┬───────────────────────────────┬───────────┘
           │ fetch /printers/*             │ fetch /print
           ▼                               ▼
┌──────────────────┐            ┌──────────────────────┐
│  printer.routes  │            │    print.routes       │
│   (Express)      │            │   (Express + Multer)  │
└────────┬─────────┘            └──────────┬───────────┘
         │                                 │
         ▼                                 ▼
┌──────────────────┐            ┌──────────────────────┐
│ printer.controller│           │  print.controller     │
└────────┬─────────┘            └──────────┬───────────┘
         │                                 │
         └──────────────┬──────────────────┘
                        ▼
              ┌───────────────────┐
              │ printer.service   │
              │ (CUPS wrapper)    │
              └────────┬──────────┘
                       ▼
              ┌───────────────────┐
              │   utils/exec.ts   │
              │ (child_process)   │
              └────────┬──────────┘
                       ▼
              ┌───────────────────┐
              │   CUPS / lp CLI   │
              └────────┬──────────┘
                       ▼
              ┌───────────────────┐
              │     Printer 🖨️    │
              └───────────────────┘
```

---

## Validation Checklist

Use this checklist to verify each phase before moving on:

- [ ] **Phase 0:** `node -v` returns v20+, `lpstat -t` shows CUPS running
- [ ] **Phase 1:** `npx tsc --noEmit` passes with zero errors
- [ ] **Phase 2:** `listPrinters()` returns printer data on the Pi
- [ ] **Phase 3:** `/health`, `/printers`, `/printers/default`, `/print` all respond correctly
- [ ] **Phase 4:** Admin UI loads at `http://localhost:3000` and all three sections work
- [ ] **Phase 5:** All 8 smoke tests pass; error cases handled gracefully

---

## Execution Order Summary

```
1.  Install Node.js + CUPS on Pi           (Phase 0)
2.  Create folders + npm init              (Phase 1)
3.  Install dependencies                   (Phase 1)
4.  Create tsconfig.json                   (Phase 1)
5.  Create utils/exec.ts                   (Phase 2)
6.  Create services/printer.service.ts     (Phase 2)
7.  Create controllers/printer.controller  (Phase 3)
8.  Create controllers/print.controller    (Phase 3)
9.  Create routes/printer.routes.ts        (Phase 3)
10. Create routes/print.routes.ts          (Phase 3)
11. Create app.ts                          (Phase 3)
12. Create server.ts                       (Phase 3)
13. Start server + test APIs with curl     (Phase 3)
14. Create admin/index.html                (Phase 4)
15. Test Admin UI in browser               (Phase 4)
16. Run full smoke test suite              (Phase 5)
17. Build + deploy as systemd service      (Phase 5)
```

---

> **This document is self-contained.** An AI agent (or developer) can follow it top-to-bottom to produce a working Phase 1.5 system without additional context.
