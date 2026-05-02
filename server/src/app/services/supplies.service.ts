import { execCommand } from "../utils/exec";
import { redisConnection } from "../../infrastructure/redis";

// ── Canonical return type ────────────────────────────────────────────────────
export interface PrinterSupplyStatus {
  status: "online" | "offline";
  paper: "ready" | "empty" | "unknown";
  supplies: {
    black: number | null;
    color: number | null;
  };
}

const EMPTY_RESULT: PrinterSupplyStatus = {
  status: "offline",
  paper: "unknown",
  supplies: { black: null, color: null },
};

// ── Shared timeout wrapper ───────────────────────────────────────────────────
async function execWithTimeout(cmd: string, timeoutMs = 4000): Promise<{ stdout: string; stderr: string }> {
  return Promise.race([
    execCommand(cmd),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Command timed out: ${cmd}`)), timeoutMs)
    ),
  ]);
}

// ── Get device URI from CUPS ─────────────────────────────────────────────────
async function getDeviceUri(printerName: string): Promise<string | null> {
  try {
    const { stdout } = await execWithTimeout(`lpstat -v ${printerName}`);
    const match = stdout.match(/device for [^:]+:\s*(.+)/);
    return match ? match[1].trim() : null;
  } catch (err) {
    console.error(`[getDeviceUri] Failed for ${printerName}:`, err);
    return null;
  }
}

// ── IPP printer (e.g. ipp://<ip> or ipp://localhost) ────────────────────────
// Uses `ipptool -tv "<uri>" get-printer-attributes.test`
// Parses marker-levels (ink) and media-empty (paper)
async function queryIpp(uri: string): Promise<PrinterSupplyStatus> {
  try {
    const { stdout } = await execWithTimeout(`ipptool -tv "${uri}" get-printer-attributes.test`, 4000);

    // Parse marker-levels — output may contain lines like:
    //   marker-levels (1setOf integer(MIN:100)): 75
    const levelMatches = [...stdout.matchAll(/marker-levels[^:]*:\s*([\d,\s]+)/g)];
    const levels: number[] = levelMatches.flatMap(m =>
      m[1].split(",").map(v => parseInt(v.trim(), 10)).filter(n => !isNaN(n))
    );

    const black = levels[0] ?? null;
    const color = levels.length > 1 ? Math.min(...levels.slice(1)) : null;

    // Parse media-empty — look for 'true' to indicate paper empty
    const paperEmpty = /media-empty[^:]*:\s*true/i.test(stdout);

    return {
      status: "online",
      paper: paperEmpty ? "empty" : "ready",
      supplies: { black, color },
    };
  } catch (err) {
    console.error(`[queryIpp] Failed for ${uri}:`, err);
    return EMPTY_RESULT;
  }
}

// ── Network printer via SNMP (socket:// or lpd://) ───────────────────────────
// OID 1.3.6.1.2.1.43.11.1.1.9 = prtMarkerSuppliesLevel
async function querySnmp(ip: string): Promise<PrinterSupplyStatus> {
  try {
    const { stdout } = await execWithTimeout(
      `snmpwalk -v1 -c public ${ip} 1.3.6.1.2.1.43.11.1.1.9`,
      4000
    );

    // Each line: SNMPv2-SMI::mib-2.43.11.1.1.9.1.X = INTEGER: YY
    const levels = [...stdout.matchAll(/INTEGER:\s*(\d+)/g)].map(m => parseInt(m[1], 10));
    const black = levels[0] ?? null;
    const color = levels.length > 1 ? Math.min(...levels.slice(1)) : null;

    return {
      status: "online",
      paper: "unknown", // SNMP basic OID doesn't expose paper status in most printers
      supplies: { black, color },
    };
  } catch (err) {
    console.error(`[querySnmp] Failed for ip ${ip}:`, err);
    return EMPTY_RESULT;
  }
}

// ── HP USB printer — hp-levels ───────────────────────────────────────────────
async function queryHpUsb(printerName: string): Promise<PrinterSupplyStatus> {
  try {
    const { stdout } = await execWithTimeout(`hp-levels -p ${printerName}`, 4000);

    // hp-levels output format:
    //   agent1-color: black
    //   agent1-level: 75
    //   agent2-color: cyan
    //   agent2-level: 60
    const agents: Record<string, { color: string; level: number }> = {};

    for (const line of stdout.split("\n")) {
      const colorMatch = line.match(/agent(\d+)-color:\s*(\w+)/i);
      const levelMatch = line.match(/agent(\d+)-level:\s*(\d+)/i);
      if (colorMatch) {
        const id = colorMatch[1];
        if (!agents[id]) agents[id] = { color: "", level: -1 };
        agents[id].color = colorMatch[2].toLowerCase();
      }
      if (levelMatch) {
        const id = levelMatch[1];
        if (!agents[id]) agents[id] = { color: "", level: -1 };
        agents[id].level = parseInt(levelMatch[2], 10);
      }
    }

    const levels = Object.values(agents);
    const blackAgent = levels.find(a => a.color === "black");
    const colorAgents = levels.filter(a => a.color !== "black" && a.level >= 0);

    const black = blackAgent?.level ?? null;
    const color = colorAgents.length > 0 ? Math.min(...colorAgents.map(a => a.level)) : null;

    // hp-levels will mention "out of paper" or "paper empty" in stderr/stdout
    const paperEmpty = /out.of.paper|paper.empty/i.test(stdout);

    return {
      status: "online",
      paper: paperEmpty ? "empty" : "ready",
      supplies: { black, color },
    };
  } catch (err) {
    console.error(`[queryHpUsb] Failed for ${printerName}:`, err);
    return EMPTY_RESULT;
  }
}

// ── Epson USB printer — escputil ─────────────────────────────────────────────
async function queryEpsonUsb(): Promise<PrinterSupplyStatus> {
  try {
    const { stdout } = await execWithTimeout(`sudo escputil -i -u -r /dev/usb/lp0`, 4000);

    // Output:
    //   Ink color       Percent remaining
    //   Black           80
    //   Cyan            40
    //   Magenta         100
    //   Yellow          20

    const lines = stdout.split("\n");
    let reading = false;
    let black: number | null = null;
    const colorLevels: number[] = [];

    for (const line of lines) {
      if (line.toLowerCase().includes("ink color")) { reading = true; continue; }
      if (!reading || !line.trim()) continue;

      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const level = parseInt(parts[parts.length - 1], 10);
        const colorName = parts.slice(0, parts.length - 1).join(" ").toLowerCase();
        if (!isNaN(level)) {
          if (colorName === "black") black = level;
          else colorLevels.push(level);
        }
      }
    }

    return {
      status: "online",
      paper: "unknown",
      supplies: {
        black,
        color: colorLevels.length > 0 ? Math.min(...colorLevels) : null,
      },
    };
  } catch (err) {
    console.error(`[queryEpsonUsb] Failed:`, err);
    return EMPTY_RESULT;
  }
}

// ── Generic USB ink (fallback) ────────────────────────────────────────────────
async function queryGenericUsb(): Promise<PrinterSupplyStatus> {
  try {
    const { stdout } = await execWithTimeout(`ink -p usb`, 4000);

    // `ink` output varies widely; attempt a best-effort numeric parse
    const numbers = [...stdout.matchAll(/(\d+)%/g)].map(m => parseInt(m[1], 10));
    const black = numbers[0] ?? null;
    const color = numbers.length > 1 ? Math.min(...numbers.slice(1)) : null;

    return {
      status: "online",
      paper: "unknown",
      supplies: { black, color },
    };
  } catch (err) {
    console.error(`[queryGenericUsb] Failed:`, err);
    return EMPTY_RESULT;
  }
}

// ── Extract IP address from a URI string ─────────────────────────────────────
function extractIp(uri: string): string | null {
  const match = uri.match(/(?:socket|lpd|ipp):\/\/([^/:]+)/);
  return match ? match[1] : null;
}

// ── Public entry point ───────────────────────────────────────────────────────
export async function getSupplies(printerName: string): Promise<PrinterSupplyStatus> {
  const cacheKey = `supplies:${printerName}`;

  // 1. Redis cache check (5-minute TTL)
  const cached = await redisConnection.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as PrinterSupplyStatus;
  }

  // 2. Resolve device URI
  const uri = await getDeviceUri(printerName);
  let result: PrinterSupplyStatus = { ...EMPTY_RESULT };

  if (uri) {
    const lowerUri = uri.toLowerCase();

    if (lowerUri.startsWith("ipp://")) {
      result = await queryIpp(uri);
    } else if (lowerUri.startsWith("socket://") || lowerUri.startsWith("lpd://")) {
      const ip = extractIp(uri);
      result = ip ? await querySnmp(ip) : EMPTY_RESULT;
    } else if (lowerUri.includes("usb://hp")) {
      result = await queryHpUsb(printerName);
    } else if (lowerUri.includes("usb://epson")) {
      result = await queryEpsonUsb();
    } else if (lowerUri.startsWith("usb://")) {
      result = await queryGenericUsb();
    }
    // Any other URI → return EMPTY_RESULT (offline/unknown)
  }

  // 3. Cache result for 5 minutes
  await redisConnection.setex(cacheKey, 300, JSON.stringify(result));

  return result;
}
