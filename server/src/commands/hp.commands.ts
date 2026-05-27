import { runSecureCommand, runSecureCommandWithTimeout } from "../app/utils/exec";

export const hpCommands = {
  setupPrinter: async (uri: string) => {
    return runSecureCommand('sudo', ['hp-setup', '-a', '-x', '-q', uri]);
  },

  getLevels: async (printerName: string) => {
    return runSecureCommandWithTimeout('hp-levels', ['-p', printerName], 4000);
  }
};
