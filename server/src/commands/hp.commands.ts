import { runSecureCommand, runSecureCommandWithTimeout } from "../app/utils/exec";

export const hpCommands = {
  setupPrinter: async (uri: string, printerName: string) => {
    const args = ['-i', '-a', `--printer=${printerName}`, uri];
    return Promise.resolve(runSecureCommand('sudo', ['hp-setup', ...args], { inputString: '\n\n\n' }));
  },

  getLevels: async (printerName: string) => {
    return Promise.resolve(runSecureCommandWithTimeout('hp-levels', ['-p', printerName], 4000));
  }
};
