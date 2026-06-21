import { PrintJobData } from "../../infrastructure/printMaster.queue";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS } from "../../infrastructure/redisKeys";

export async function findPrinter(jobData: PrintJobData): Promise<string | null> {
  const printerNames = await redisConnection.smembers(REDIS_KEYS.FLEET_PRINTERS);
  const candidates: Array<{name: string, alias: string, capabilities: string[]}> = [];

  for (const name of printerNames) {
    const [health, state, infoRaw] = await Promise.all([
      redisConnection.get(REDIS_KEYS.printerHealth(name)),
      redisConnection.get(REDIS_KEYS.printerState(name)),
      redisConnection.get(REDIS_KEYS.printerInfo(name))
    ]);

    // 1. health === "healthy" AND state === "idle"
    if (health !== "healthy" || state !== "idle") continue;

    // 2. Exclude attempted/failed printers
    if (jobData.attemptedPrinters && jobData.attemptedPrinters.includes(name)) continue;

    let info: any = {};
    try { if (infoRaw) info = JSON.parse(infoRaw); } catch {}
    const caps: string[] = info.capabilities || [];

    // 3. Match capabilities
    if (jobData.colorMode === "color" && !caps.includes("color")) continue;
    if (jobData.duplex === "double" && !caps.includes("duplex")) continue;

    candidates.push({
      name,
      alias: info.alias || "",
      capabilities: caps
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  // 4. If target printer is specified and it's in candidates, use it
  if (jobData.targetPrinter) {
    const target = candidates.find(p => p.name === jobData.targetPrinter || p.alias === jobData.targetPrinter);
    if (target) {
      return target.name;
    }
  }

  // 5. Otherwise, pick the first available
  return candidates[0].name;
}
