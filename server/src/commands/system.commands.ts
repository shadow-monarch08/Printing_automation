import { runSecureCommand, runSecureCommandWithTimeout } from "../app/utils/exec";

export const systemCommands = {
  getPdfInfo: async (filePath: string) => {
    return runSecureCommand('pdfinfo', [filePath]);
  },

  getWifiStatus: async () => {
    return runSecureCommand('nmcli', ['-t', '-f', 'IN-USE,SSID,SIGNAL', 'dev', 'wifi']);
  },

  getSavedNetworks: async () => {
    return runSecureCommand('sudo', ["wpa_cli", "-i", "wlan0", "scan"]);
  },

  rescanWifi: async () => {
    return runSecureCommand('nmcli', ['device', 'wifi', 'rescan']);
  },

  snmpWalk: async (ip: string, oid: string) => {
    return runSecureCommandWithTimeout('snmpwalk', ['-v1', '-c', 'public', ip, oid], 4000);
  },

  escputilInkLevel: async () => {
    return runSecureCommandWithTimeout('sudo', ['escputil', '-i', '-u', '-r', '/dev/usb/lp0'], 4000);
  },

  genericUsbInkLevel: async () => {
    return runSecureCommandWithTimeout('ink', ['-p', 'usb'], 4000);
  },
  
  getDiskUsage: async () => {
    return runSecureCommand('df', ['-h', '/']);
  },
  
  checkUsbDevices: async () => {
     return runSecureCommand('lsusb', []);
  },

  connectToWifi: async (ssid: string, password?: string): Promise<{ stdout: string; stderr: string }> => {
    const args = ['nmcli', 'device', 'wifi', 'connect', ssid];
    if (password) {
      args.push('password', password);
    }
    return runSecureCommand('sudo', args);
  }
};
