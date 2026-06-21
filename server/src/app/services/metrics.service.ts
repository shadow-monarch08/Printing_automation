import os from 'os';
import { systemCommands } from '../../commands/system.commands';
import { pauseQueue } from './job.service';
import { eventBus } from '../utils/eventBus';
import { MetricSnapshot } from '../types';

const history: MetricSnapshot[] = [];
let pollingInterval: NodeJS.Timeout | null = null;

export async function getDiskUsagePercent(): Promise<number> {
  try {
    const { stdout } = await systemCommands.getDiskUsage();
    // expected output:
    // Filesystem      Size  Used Avail Use% Mounted on
    // /dev/root        59G  4.1G   52G   8% /
    const lines = stdout.trim().split('\n');
    if (lines.length > 1) {
      const columns = lines[1].trim().split(/\s+/);
      const usePercentStr = columns.find(col => col.endsWith('%'));
      if (usePercentStr) {
        return parseInt(usePercentStr.replace('%', ''), 10);
      }
    }
    return 0; // fallback
  } catch (error) {
    console.error('Failed to get disk usage', error);
    // Fallback for dev environments where df isn't available
    return 50; 
  }
}

export async function captureMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = (usedMem / totalMem) * 100;
  
  // A simplistic approximation for CPU load for UI display purposes
  const cpus = os.cpus().length;
  const cpuPercent = (os.loadavg()[0] / cpus) * 100; 
  
  const diskPercent = await getDiskUsagePercent();
  
  // SD Card Failsafe (Task 8.2)
  if (diskPercent > 95) {
     try {
       await pauseQueue();
       eventBus.emit('system_critical', { 
         message: `CRITICAL: Disk usage at ${diskPercent}%. Master queue automatically paused to prevent corruption.` 
       });
     } catch(e) {
       console.error("Failed to pause queue during disk failsafe", e);
     }
  }

  const snapshot: MetricSnapshot = {
    timestamp: new Date().toISOString(),
    cpu: Math.min(Math.round(cpuPercent), 100),
    memory: Math.round(memPercent),
    disk: diskPercent
  };
  
  history.push(snapshot);
  if (history.length > 60) { // 30 mins at 1 per 30s
    history.shift();
  }
}

export function getMetricsHistory() {
  return history;
}

export function startMetricsPolling() {
  if (pollingInterval) return;
  // Poll every 30 seconds
  pollingInterval = setInterval(captureMetrics, 30000);
  captureMetrics(); // Initial capture
}
