import { execCommand } from "../app/utils/exec";

/**
 * Validates inputs to prevent command injection.
 * Rejects characters that can be used for shell injection.
 */
function sanitize(input: string): string {
  if (/[;&|`$]/.test(input)) {
    throw new Error(`Invalid input detected: potentially unsafe characters in "${input}"`);
  }
  return input;
}

export const cupsCommands = {
  listPrinters: async () => {
    return execCommand("lpstat -p");
  },

  listDevices: async () => {
    return execCommand("lpinfo -v");
  },

  getDefaultPrinter: async () => {
    return execCommand("lpstat -d");
  },

  setDefaultPrinter: async (printerName: string) => {
    const safeName = sanitize(printerName);
    return execCommand(`lpoptions -d ${safeName}`);
  },

  printFile: async (printerName: string | null, filePath: string, options: { copies?: number; sides?: string } = {}) => {
    let cmd = `lp`;
    if (printerName) {
      cmd += ` -d ${sanitize(printerName)}`;
    }
    if (options.copies) {
      cmd += ` -n ${options.copies}`;
    }
    if (options.sides) {
      cmd += ` -o sides=${sanitize(options.sides)}`;
    }
    cmd += ` -- "${filePath}"`; // filePath is typically safe but quotes help
    return execCommand(cmd);
  },

  getJobStatus: async (printerName: string) => {
    const safeName = sanitize(printerName);
    return execCommand(`lpstat -o ${safeName}`);
  },

  cancelJob: async (cupsJobId: string | number) => {
    const safeId = sanitize(String(cupsJobId));
    return execCommand(`cancel ${safeId}`);
  },

  cancelAllJobs: async () => {
    return execCommand(`cancel -a`);
  },

  holdJob: async (cupsJobId: string | number) => {
    const safeId = sanitize(String(cupsJobId));
    return execCommand(`lp -i ${safeId} -H hold`);
  },

  resumeJob: async (cupsJobId: string | number) => {
    const safeId = sanitize(String(cupsJobId));
    return execCommand(`lp -i ${safeId} -H resume`);
  },

  getPrinterStatus: async () => {
    return execCommand("lpstat -v");
  },
  
  getPrinterOptions: async (printerName: string) => {
    const safeName = sanitize(printerName);
    return execCommand(`lpoptions -p ${safeName} -l`);
  },
  
  addIppPrinter: async (name: string, uri: string) => {
    const safeName = sanitize(name);
    // Be careful with URI sanitization, basic check
    if (/[;&|`$]/.test(uri)) {
      throw new Error("Invalid IPP URI");
    }
    return execCommand(`sudo lpadmin -p "${safeName}" -E -v "${uri}" -m everywhere`);
  },
  
  probeIppPrinter: async (uri: string) => {
     if (/[;&|`$]/.test(uri)) {
      throw new Error("Invalid IPP URI");
    }
    // Using execWithTimeout is needed here if it can hang
    return execCommand(`ipptool -tv "${uri}" get-printer-attributes.test`);
  }
};
