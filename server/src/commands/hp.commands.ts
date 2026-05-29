import { runSecureCommand, runSecureCommandWithTimeout } from "../app/utils/exec";

export const hpCommands = {
  setupPrinter: async (uri: string, printerName: string) => {
    const args = ['-i', '-a', '-q', `--printer=${printerName}`, uri];
    return Promise.resolve(runSecureCommand('sudo', ['hp-setup', ...args]));
  },

  getLevels: async (printerName: string) => {
    return Promise.resolve(runSecureCommandWithTimeout('hp-levels', ['-p', printerName], 4000));
  }
};
