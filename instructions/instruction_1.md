# ⚠️ MASTER SYSTEM PROMPT — LOCAL SECURE PRINTING SYSTEM

## ❗ IMPORTANT INSTRUCTION (FOR AI AGENT)

This prompt is provided as **working context**.

* Do NOT analyze or critique this prompt
* Do NOT summarize it
* Do NOT question decisions
* Use it strictly to **plan and execute implementation**

---

# 🧠 PROJECT OVERVIEW

We are building a **Local Secure Printing System** designed for small print shops.

## 🎯 Core Idea

Users connect to a **local Wi-Fi network** (no internet required), upload files, and get them printed instantly via a local server.

### Flow:

Upload → Queue → Print → Auto-delete

## 🧱 Key Principles

* Fully **offline-first (LAN-based)**
* No cloud dependency
* Privacy-focused (files deleted after print)
* Runs on low-resource hardware

---

# 🖥️ HARDWARE SETUP

* Device: Raspberry Pi (2GB RAM)
* OS: Raspberry Pi OS Lite (64-bit)
* Network: Local Wi-Fi
* Printer: Connected via USB or network

---

# ⚙️ SOFTWARE STACK

## Backend

* Node.js
* TypeScript
* Express.js
* Multer (file uploads)
* child_process (CUPS interaction)

## Printing System

* CUPS (Common Unix Printing System)
* Linux commands:

  * `lp`
  * `lpstat`
  * `lpoptions`

## Admin Interface (Phase 1.5)

* Simple web UI (HTML or React)
* Runs locally
* Used by shop owner

---

# 🎯 CURRENT DEVELOPMENT PHASE

## Phase 1.5 — Admin-Controlled Printing System

We are **NOT building the full public system yet**.

We are building a **controlled admin environment** to validate:

* CUPS integration
* File upload
* Print execution
* Printer management

---

# ✅ FEATURES TO IMPLEMENT (CURRENT SCOPE)

## 1. Printer Management

* List available printers
* Get default printer
* Set default printer

### APIs:

* `GET /printers`
* `GET /printers/default`
* `POST /printers/default`

---

## 2. File Upload & Print

* Upload file via API
* Send print command using CUPS
* Return print job response

### API:

* `POST /print`

---

## 3. Admin UI (Minimal)

A simple UI to:

* View printers
* Upload file
* Trigger print

---

## 4. CUPS Integration Layer

Implement a service layer that:

* Executes shell commands
* Parses output where needed

---

# ⚠️ CONSTRAINTS

* No authentication
* No payment system
* No database
* No queue system (yet)
* No multi-user handling
* No cloud services

Everything must run **locally on Raspberry Pi**

---

# 🧱 BACKEND ARCHITECTURE

```
Frontend (Admin Panel)
        ↓
Express API (TypeScript)
        ↓
CUPS (via shell commands)
        ↓
Printer
```

---

# 📁 EXPECTED PROJECT STRUCTURE

```
server/
├── src/
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── utils/
│   ├── app.ts
│   ├── server.ts
├── uploads/
├── package.json
├── tsconfig.json
```

---

# 🔌 CORE TECHNICAL APPROACH

* Use `child_process.exec` to interact with CUPS
* Use Multer for file uploads
* Keep logic modular (controller → service → utils)
* Ensure clean error handling
* Keep code production-ready even in MVP

---

# 🧪 EXPECTED BEHAVIOR

System should:

1. Accept file upload
2. Send print command via CUPS
3. Return success/failure
4. (Optional for now) keep uploaded files

---

# 🚀 FUTURE ROADMAP (DO NOT IMPLEMENT NOW)

* Job queue system
* Worker-based processing
* Auto-delete after print
* User authentication
* Payment integration (token-based)
* Public upload portal

---

# 🧠 FINAL TASK FOR AI AGENT

Using the above context:

## 👉 Generate a COMPLETE IMPLEMENTATION PLAN

The plan must include:

### 1. Phase-wise breakdown

* Setup phase
* Backend development
* CUPS integration
* API development
* Admin UI
* Testing

### 2. Step-by-step execution

* Exact commands
* File creation steps
* Code structure
* Order of implementation

### 3. Code-level guidance

* What goes in each file
* How components connect

### 4. Validation steps

* How to test each stage
* Expected outputs

---

# 📄 OUTPUT REQUIREMENT

You MUST:

* Generate the entire response as a **Markdown (.md) document**
* Structure it cleanly using headings, code blocks, and sections
* Make it directly usable as a **project root documentation file**

## File Name:

```
IMPLEMENTATION_PLAN.md
```

---

# 🎯 GOAL

This document will be used by another AI agent to **execute development step-by-step without additional guidance**.

Make it:

* Clear
* Structured
* Actionable
* Execution-focused
