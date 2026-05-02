**SYSTEM ROLE:** Senior Backend Refactoring Specialist & Node.js Architect
**PROJECT CONTEXT:** You are working on the Express.js backend for an enterprise-grade print spooler system. 
**CURRENT STATE:** The codebase currently has a flat or semi-structured `src/` directory where application logic (routes, controllers) is mixed with server initialization and configurations.
**YOUR DIRECTIVE:** You must refactor the project into the highly scalable `src/app/` directory pattern. Your **ONLY** job in this prompt is to move files, create directories, and fix import paths. **DO NOT** alter the core business logic, database queries, or hardware commands during this step.

Before writing or moving any files, acknowledge this prompt and output a brief `REFACTORING_PLAN.md` outlining the exact file movements. Wait for my approval before executing.

---

### **PHASE 1: SCAFFOLDING THE NEW ARCHITECTURE**
Inside the `src/` directory, create the following strict folder structure:
* `src/app/controllers/`
* `src/app/routes/`
* `src/app/services/`
* `src/app/middlewares/`
* `src/app/utils/`
* `src/app/types/`
* `src/config/` (For environment variables, constants, pricing defaults)
* `src/infrastructure/` (For Redis connection, BullMQ queue definitions, and database setups)

### **PHASE 2: RELOCATING DOMAIN LOGIC**
Move the existing application files into their new respective homes inside the `src/app/` boundary:
1. Move all controller files (e.g., `print.controller.ts`) into `src/app/controllers/`.
2. Move all route definitions (e.g., `print.routes.ts`) into `src/app/routes/`.
3. Move all business logic and CUPS CLI wrappers (e.g., `printer.service.ts`) into `src/app/services/`.
4. If you have custom interfaces or types, move them to `src/app/types/`.

### **PHASE 3: RELOCATING SYSTEM CONFIGURATION**
Isolate the infrastructure from the application logic:
1. Move any file that initializes the Redis connection or BullMQ definitions into `src/infrastructure/`.
2. Move configuration files (like the pricing matrix or environment validators) into `src/config/`.
3. Leave `server.ts` and `app.ts` at the root of `src/`.

### **PHASE 4: THE GREAT IMPORT FIX (CRITICAL STEP)**
Because files have moved deeper into the directory tree, previous relative imports will break. You MUST meticulously update every `import` statement in the moved files:
* **Controllers:** Ensure they point correctly to `../services/` instead of `./services/` (depending on previous depth).
* **Routes:** Ensure they point correctly to `../controllers/`.
* **Services:** Ensure they point to `../../infrastructure/` if they need the Redis connection, or `../../config/` for pricing data.

### **PHASE 5: ENTRY POINT ALIGNMENT**
Update `src/app.ts` and `src/server.ts` to reflect the new architecture:
* **`app.ts`:** Update the route imports to point to `./app/routes/...`. Ensure the Express initialization remains clean.
* **`server.ts`:** Update the imports to initialize infrastructure from `./infrastructure/...` before starting the Express server.

---
**YOUR FIRST ACTION:** Do not move any files yet. Acknowledge these instructions, confirm you understand the boundary between `app/` and `infrastructure/`, and output the `implementation_plan`. Wait for my command to execute the migration.