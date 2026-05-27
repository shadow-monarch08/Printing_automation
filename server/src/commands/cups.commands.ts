import { runSecureCommand } from "../app/utils/exec";

export const cupsCommands = {
  listPrinters: async () => {
    return runSecureCommand("lpstat", ["-p"]);
  },

  listDevices: async () => {
    return runSecureCommand("lpinfo", ["-v"]);
  },

  getDefaultPrinter: async () => {
    return runSecureCommand("lpstat", ["-d"]);
  },

  setDefaultPrinter: async (printerName: string) => {
    return runSecureCommand("lpoptions", ["-d", printerName]);
  },

  printFile: async (printerName: string | null, filePath: string, options: { copies?: number; sides?: string } = {}) => {
    const args: string[] = [];
    if (printerName) {
      args.push("-d", printerName);
    }
    if (options.copies) {
      args.push("-n", String(options.copies));
    }
    if (options.sides) {
      args.push("-o", `sides=${options.sides}`);
    }
    args.push("--", filePath);
    return runSecureCommand("lp", args);
  },

  getJobStatus: async (printerName: string) => {
    return runSecureCommand("lpstat", ["-o", printerName]);
  },

  cancelJob: async (cupsJobId: string | number) => {
    return runSecureCommand("cancel", [String(cupsJobId)]);
  },

  cancelAllJobs: async () => {
    return runSecureCommand("cancel", ["-a"]);
  },

  holdJob: async (cupsJobId: string | number) => {
    return runSecureCommand("lp", ["-i", String(cupsJobId), "-H", "hold"]);
  },

  resumeJob: async (cupsJobId: string | number) => {
    return runSecureCommand("lp", ["-i", String(cupsJobId), "-H", "resume"]);
  },

  getPrinterStatus: async () => {
    return runSecureCommand("lpstat", ["-v"]);
  },
  
  getPrinterStatusByName: async (printerName: string) => {
    return runSecureCommand("lpstat", ["-p", printerName]);
  },
  
  getPrinterOptions: async (printerName: string) => {
    return runSecureCommand("lpoptions", ["-p", printerName, "-l"]);
  },
  
  addIppPrinter: async (name: string, uri: string) => {
    return runSecureCommand("sudo", ["lpadmin", "-p", name, "-E", "-v", uri, "-m", "everywhere"]);
  },
  
  addUsbPrinter: async (name: string, uri: string) => {
    return runSecureCommand("sudo", ["lpadmin", "-p", name, "-E", "-v", uri, "-m", "everywhere"]);
  },
  
  probeIppPrinter: async (uri: string) => {
    return runSecureCommand("ipptool", ["-tv", uri, "get-printer-attributes.test"]);
  },

  deletePrinter: async (name: string) => {
    return runSecureCommand("sudo", ["lpadmin", "-x", name]);
  }
};
