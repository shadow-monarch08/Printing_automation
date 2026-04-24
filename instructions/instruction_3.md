**SYSTEM ROLE:** Elite Frontend Architect & Creative UI/UX Developer
**PROJECT CONTEXT:** You are building the frontend for a standalone, enterprise-grade printing management system running locally on a headless Raspberry Pi. The architecture is strictly divided into a frictionless **User Kiosk** and a protected **Admin Control Room**. 
**NETWORK CONSTRAINT:** This app operates on a local LAN with NO internet access. All assets, fonts, and icons must be handled locally.

**YOUR DIRECTIVE:** You are tasked with completely rewriting the frontend architecture and UI. Before writing any application code, your absolute first task is to process this master prompt and output a highly detailed, phase-by-phase `IMPLEMENTATION_PLAN.md` at the project root. This plan must break down the execution of the routing, state management, UI component creation, and mock data integration.

Once the plan is generated, you will execute it step-by-step. Use your creative freedom to bring the "Modern Press" theme to life through micro-interactions, clever CSS animations, and polished layouts.

---

### **1. THE DESIGN SYSTEM: "MODERN PRESS"**
You will implement a bespoke CSS Variable theming system. The aesthetic must feel like a modern, mechanical printing press—tactile, industrial, yet incredibly crisp. 

* **Theming Engine:** Create a Context provider that toggles `data-theme="dark"` on the `<html>` tag.
* **Dark Mode ("The Darkroom"):** * Background: Deep "Ink Black" (`#121212`).
    * Surface/Cards: "Graphite" (`#1E1E1E`).
    * Accents: Neon Cyan (`#00FFFF`) and subtle Magenta glows.
* **Light Mode ("The Fresh Ream"):** * Background: "Textured Paper" off-white (`#F9F9F6`).
    * Surface/Cards: Crisp white (`#FFFFFF`) with sharp, high-contrast dark borders.
    * Accents: Bold "Press Blue" (`#0A2463`).
* **Typography:** * Set up local `@font-face` definitions. 
    * Primary/Headings: **IBM Plex Sans** (industrial/technical).
    * Data/Monospace: **Courier Prime** or **JetBrains Mono** (Job IDs, costs, IPs).
* **UI Components:** * Avoid soft, pill-shaped glassmorphism. Use sharp, mechanical rectangles.
    * Buttons should feel tactile. On `:active`, use `transform: translateY(2px)` and reduce the `box-shadow` to simulate a physical mechanical key depression.
    * Design progress bars to resemble a CMYK ink cartridge depleting or paper filling with text.

### **2. STATE MANAGEMENT & MOCK ARCHITECTURE**
The backend is currently undergoing a rewrite, so the frontend must be fully functional using **Mock Data**. However, the architecture must be production-ready so we can seamlessly swap to real API calls later.

* **Zustand for Global State:** Create modular stores.
    * `useUserPrintStore`: Manages the current user's uploaded file, selected configuration (color, copies, duplex), quote calculation, and job tracking state.
    * `useAdminStore`: Manages the state of the printer fleet, master queue data, and system health metrics.
* **Service Layer:** Create a `services/` directory with API hook wrappers (e.g., `api.ts` or `printerService.ts`). Currently, these should return Promises that resolve with rich Mock Data after an artificial `setTimeout` delay to simulate network latency.

### **3. THE USER KIOSK FLOW (Route: `/`)**
This route uses `UserLayout` (minimalist, zero-distraction). Flow state is preserved via Zustand.

* **Step 1: The Drop (Upload)**
    * A full-screen, visually striking drag-and-drop zone.
    * *Creative Touch:* In Light mode, make it look like a blank sheet of paper. On `dragenter`, animate a cyan target reticle or alignment crosshairs. Include instant local file extension validation.
* **Step 2: The Setup (Configuration Console)**
    * Left panel: Document preview/details. Right panel: A mechanical-looking control board.
    * Controls required: Number stepper for Copies, CMYK/Grayscale toggle for Color, Single/Double-sided toggle for Duplex, and Portrait/Landscape orientation overrides.
* **Step 3: The Quote (Checkout & ETA)**
    * *Creative Touch:* Animate a "receipt" rolling onto the screen.
    * Must display: Total Pages, Modifications Applied, Estimated Wait Time (mocked), and Total Cost (e.g., ₹2 B&W, ₹10 Color).
* **Step 4: The Press (Mock Payment & Tracker)**
    * Trigger a sleek mock payment modal (UPI/Card). On success, transition to the Tracker.
    * The Tracker is the UX centerpiece. Build a live, animated timeline (`Queued` -> `Spooling` -> `Printing` -> `Done`). Visually represent "jobs ahead of you" as a stack of waiting paper icons.

### **4. THE ADMIN CONTROL ROOM (Route: `/admin`)**
This route uses `AdminLayout` (sidebar navigation, dense data presentation). Add a simple mock PIN screen to guard this route.

* **View A: The Overview Dashboard**
    * Metrics Grid: Widgets for Total Jobs Today, Active Printers, Current Queue Length, and Revenue.
    * System Health: A critical storage gauge (e.g., 6.3GB / 8.0GB used) and CPU monitor.
* **View B: Fleet Management (Printers)**
    * A grid of connected hardware. Show clear status indicators (Green for Idle, Red for Error/Out of Paper).
    * "Add Hardware" module: A UI hook designed to trigger our future silent detection script. Include a "Detect Legacy Printer" button that triggers a mock loading sequence and returns a mock USB URI.
* **View C: The Master Queue**
    * A dense, highly legible data table listing all spooling jobs.
    * Include actionable mechanical buttons per row: `Cancel`, `Pause`, `Prioritize`.

---
**YOUR FIRST ACTION:** Do not write React code yet. Acknowledge these instructions and output the `IMPLEMENTATION_PLAN.md` file at the root. Structure the plan into logical phases (e.g., Phase 1: Setup & CSS Architecture, Phase 2: Mock Services & Zustand Store, Phase 3: User Flow, Phase 4: Admin Flow). Wait for my approval on the plan before beginning execution.