import { execCommand, execWithTimeout } from "../app/utils/exec";

function sanitize(input: string): string {
  if (/[;&|`$]/.test(input)) {
    throw new Error(`Invalid input detected: potentially unsafe characters in "${input}"`);
  }
  return input;
}

export const hpCommands = {
  setupPrinter: async (uri: string) => {
    if (/[;&|`$]/.test(uri)) {
      throw new Error("Invalid HP URI");
    }
    return execCommand(`sudo hp-setup -i -a -q "${uri}"`);
  },

  getLevels: async (printerName: string) => {
    const safeName = sanitize(printerName);
    return execWithTimeout(`hp-levels -p ${safeName}`, 4000);
  }
};
