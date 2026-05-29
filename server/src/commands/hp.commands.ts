import { runSecureCommand, runSecureCommandWithTimeout } from "../app/utils/exec";

export const hpCommands = {
  setupPrinter: async (uri: string) => {
    return Promise.resolve(runSecureCommand('sudo', ['hp-setup', '-i', '-a', uri]));
  },

  getLevels: async (printerName: string) => {
    return Promise.resolve(runSecureCommandWithTimeout('hp-levels', ['-p', printerName], 4000));
  }
};
