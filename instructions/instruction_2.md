# ⚠️ MASTER SYSTEM PROMPT — PRODUCTION READINESS & DEPLOYMENT (RASPBERRY PI)

## ❗ IMPORTANT INSTRUCTION (FOR AI AGENT)

This prompt is provided as **execution context**.

* Do NOT analyze or critique this prompt
* Do NOT summarize it
* Do NOT question architectural decisions
* Execute tasks **step-by-step with implementation focus**

---

# 🧠 PROJECT CONTEXT

We are building a **Local Secure Printing System** designed to run on a **Raspberry Pi (2GB RAM)**.

The system enables:

* File upload over local Wi-Fi
* Printing via CUPS
* Fully offline-first architecture (LAN-based)
* No cloud dependency

---

# 🎯 CURRENT OBJECTIVE

Prepare the project so that it can be:

✅ Pulled from GitHub onto Raspberry Pi
✅ Installed with minimal setup
✅ Built and run successfully
✅ Accessed over local network
✅ Ready for printing integration

---

# 🧱 EXISTING ARCHITECTURE

```id="arch-main"
Frontend (React / Vite)
        ↓
Node.js Backend (TypeScript / Express)
        ↓
CUPS (Linux printing system)
        ↓
Printer
```

---

# ⚙️ REQUIRED TRANSFORMATION (CRITICAL)

The project must be converted from **development mode → production-ready mode**.

---

# ✅ TASKS TO IMPLEMENT

## 1️⃣ FRONTEND CHANGES

### A. API Calls

* Replace ALL absolute URLs like:

```id="bad-api"
http://localhost:3000/...
```

* With:

```id="good-api"
/...
```

---

### B. Build Configuration

* Ensure frontend builds using:

```id="build-fe"
npm run build
```

* Output directory should be:

```id="fe-out"
dist/
```

---

## 2️⃣ BACKEND CHANGES

### A. Serve Frontend via Express

Modify backend to serve static files:

```ts id="serve-fe"
import path from "path";

app.use(express.static(path.join(__dirname, "../public")));

app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});
```

---

### B. Enable LAN Access

Server must bind to:

```ts id="lan-bind"
app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on LAN");
});
```

---

### C. File Upload Handling

* Ensure uploads directory exists
* Add basic cleanup (optional but preferred)

---

### D. Error Handling

* Add proper logging for all API failures

---

## 3️⃣ PROJECT STRUCTURE ALIGNMENT

Ensure final structure:

```id="final-struct"
project-root/
├── server/
│   ├── src/
│   ├── dist/
│   ├── public/        ← frontend build goes here
│   ├── uploads/
│   ├── package.json
├── admin-ui/
│   ├── dist/
│   ├── package.json
```

---

## 4️⃣ BUILD FLOW STANDARDIZATION

Ensure the following workflow works:

### Backend

```bash id="build-backend"
cd server
npm install
npm run build
```

---

### Frontend

```bash id="build-frontend"
cd admin-ui
npm install
npm run build
```

---

### Move frontend into backend

```bash id="move-fe"
cp -r admin-ui/dist server/public
```

---

### Run server

```bash id="run-server"
node server/dist/server.js
```

---

## 5️⃣ ADD DEPLOYMENT SCRIPT (REQUIRED)

Create a file:

```id="deploy-name"
deploy.sh
```

Contents:

```bash id="deploy-script"
#!/bin/bash

echo "Pulling latest code..."
git pull

echo "Installing frontend..."
cd admin-ui
npm install
npm run build

echo "Copying frontend build..."
rm -rf ../server/public
cp -r dist ../server/public

echo "Installing backend..."
cd ../server
npm install
npm run build

echo "Starting server..."
node dist/server.js
```

---

## 6️⃣ ADD .gitignore (IMPORTANT)

Ensure the following are ignored:

```id="gitignore"
node_modules/
dist/
.env
uploads/
server/public/
```

---

## 7️⃣ VERIFY PRODUCTION READINESS

Ensure:

* No `localhost` references exist
* App works via:

```id="lan-url"
http://<PI_IP>:3000
```

* Frontend loads correctly
* API calls succeed

---

# 📄 TASK 2 — CREATE README.md

After completing all changes:

## Generate a detailed `README.md` in project root

---

## README MUST INCLUDE:

### 1. Project Overview

* What the system does
* Real-world use case (print shop)

---

### 2. Features

* Local file upload
* Admin print portal
* Offline-first system
* CUPS integration (mention, even if partial)

---

### 3. Architecture Diagram (text-based)

---

### 4. Tech Stack

---

### 5. Installation Guide (Raspberry Pi)

Step-by-step:

* Install Node.js
* Install Git
* Clone repo
* Run deploy script

---

### 6. Development Setup

* How to run frontend + backend separately

---

### 7. Usage Guide

* Access admin panel
* Upload file
* Print document

---

### 8. Folder Structure

---

### 9. Future Scope

* Queue system
* Payments
* Public user portal

---

### 10. Troubleshooting

* CUPS issues
* Port access issues
* LAN access issues

---

# 🚀 TASK 3 — PUSH TO GITHUB

Repository:

```id="repo"
https://github.com/shadow-monarch08/Printing_automation.git
```

---

## Steps:

1. Stage all changes
2. Commit with message:

```id="commit"
"Production-ready setup for Raspberry Pi deployment with admin UI"
```

3. Push to main branch

---

# 🎯 FINAL GOAL

After execution:

* Project can be cloned on Raspberry Pi
* Single command deploy works
* Accessible via LAN
* Ready for CUPS integration

---

# 🧠 OUTPUT REQUIREMENT

The AI agent must:

* Perform all code modifications
* Generate README.md
* Ensure project builds successfully
* Push final code to repository

---

# ⚠️ FINAL INSTRUCTION

Focus on:

* Execution
* Simplicity
* Reliability

Avoid:

* Overengineering
* Unnecessary dependencies
* Complex tooling

---
