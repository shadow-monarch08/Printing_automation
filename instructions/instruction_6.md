**SYSTEM ROLE:** Backend Developer & Node.js Engineer
**PROJECT CONTEXT:** We are adding a new hardware discovery and auto-configuration module to an existing Express.js print server. 
**CURRENT SCOPE:** We currently only have the `hplip` drivers installed on the host machine. Therefore, this implementation must specifically target and handle HP legacy USB printers.

**YOUR DIRECTIVE:** You are tasked with writing the Node.js service, controller, and route to automatically detect plugged-in (but unconfigured) HP USB printers, and programmatically build their CUPS queues using the `hp-setup` utility.

Please write the exact TypeScript code to implement the following flow:

### **1. THE DISCOVERY SERVICE (`printer.service.ts`)**
Write a function `getUnconfiguredHpPrinters()` that performs the following:
* Run `lpinfo -v` to get a list of all raw, physically connected hardware URIs.
* Run `lpstat -v` to get a list of all currently configured CUPS printer URIs.
* Find the "Orphans" (plugged in, but not configured).
* **Filter:** Strictly filter the orphans to only return URIs that contain `usb://HP` (since we only support HP auto-config right now).
* Return an array of objects containing the `uri` and a parsed `makeModel` string.

### **2. THE CONFIGURATION SERVICE (`printer.service.ts`)**
Write a function `configureHpPrinter(uri: string, modelName: string)` that performs the following:
* Sanitize the `modelName` to create a valid CUPS queue name (no spaces or special characters).
* Use `child_process.exec` to run the specific HP configuration command:
  `sudo hp-setup -i -a -q "<uri>"`
  *(Note: `-i` disables interactive prompts, `-a` auto-accepts defaults, `-q` runs quietly).*
* Wrap this in a try/catch block and return a standard success/error object.

### **3. THE CONTROLLER & ROUTE (`printer.controller.ts` & `printer.routes.ts`)**
* Create a `GET /printers/detect-legacy` route that calls the discovery service and returns the list of unconfigured HP printers.
* Create a `POST /printers/configure` route that accepts `{ uri, modelName }` in the body, calls the configuration service, and returns the success/failure result.

**SECURITY NOTE FOR DOCUMENTATION:** Include a comment in the code reminding the deployment team that `visudo` must be updated on the host machine to allow the Node user to run `/usr/bin/hp-setup` without a password, otherwise this command will hang indefinitely.

---
**YOUR ACTION:** Please update the `BACKEND_EXECUTION_PLAN.md` and include the new HP auto-configuration feature implementation phase in it. Don't start coding report back once the update is done.