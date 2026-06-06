import { runSecureCommand, runSecureCommandWithTimeout } from "../app/utils/exec";

export const systemCommands = {
  getPdfInfo: async (filePath: string) => {
    return runSecureCommand('pdfinfo', [filePath]);
  },

  getWifiStatus: async () => {
    return runSecureCommand('nmcli', ['-t', '-f', 'IN-USE,SSID,SIGNAL', 'dev', 'wifi']);
  },

  getSavedNetworks: async () => {
    return runSecureCommand('nmcli', ['-t', '-f', 'NAME', 'connection', 'show']);
  },

  rescanWifi: async () => {
    return runSecureCommand('sudo', ['wpa_cli', '-i', 'wlan0', 'scan']); 
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

};
