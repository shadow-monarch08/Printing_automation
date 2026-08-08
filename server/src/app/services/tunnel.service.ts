import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { updateSystemConfig, getSystemConfig } from "./config.db.service";
import { HardwareError } from "../utils/errors";

let tunnelProcess: ChildProcess | null = null;
let currentTunnelUrl: string | null = null;

export function getActiveTunnelUrl(): string | null {
  if (currentTunnelUrl) return currentTunnelUrl;
  const config = getSystemConfig();
  return config?.cloudflareUrl || null;
}

export function shouldTunnelBeActive(): boolean {
  const config = getSystemConfig();
  const isOnboarded = config ? Boolean(config.isOnboarded) : false;
  const isSetupMode = process.env.SETUP_MODE === "true";

  return isOnboarded && !isSetupMode;
}

export function stopQuickTunnel(): void {
  currentTunnelUrl = null;
  if (tunnelProcess) {
    try {
      tunnelProcess.kill("SIGTERM");
      console.log("[Tunnel Service] Quick Cloudflare Tunnel process stopped.");
    } catch (e) {
      /* ignored */
    }
    tunnelProcess = null;
  }
}

export function startQuickTunnel(port: number = 3000): void {
  if (!shouldTunnelBeActive()) {
    console.log("[Tunnel Service] 🔒 Security Gate: Quick Cloudflare Tunnel start blocked because system is not onboarded or SETUP_MODE is active.");
    stopQuickTunnel();
    try {
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(dataDir, "cloudflare_url.txt"),
        "# TUNNEL_DISABLED (System in Setup / Provisioning Mode)\n"
      );
    } catch (fileErr) {
      /* ignored */
    }
    return;
  }

  if (tunnelProcess) {
    console.log("[Tunnel Service] Quick Cloudflare Tunnel already active.");
    return;
  }

  console.log(`[Tunnel Service] Initializing Quick Cloudflare Tunnel for http://localhost:${port}...`);

  try {
    // Spawn cloudflared CLI child process
    tunnelProcess = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`]);

    const handleOutput = (data: Buffer) => {
      const output = data.toString();
      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);

      if (match && match[0]) {
        const liveUrl = match[0];
        // Ignore Cloudflare's internal API control plane endpoint
        if (liveUrl.includes("api.trycloudflare.com")) {
          return;
        }

        if (currentTunnelUrl !== liveUrl) {
          currentTunnelUrl = liveUrl;
          console.log(`🌐 [Tunnel Service] Quick Cloudflare Tunnel online: ${liveUrl}`);

          // 1. Update SQLite DB
          try {
            updateSystemConfig({ cloudflareUrl: liveUrl });
          } catch (dbErr) {
            console.warn("[Tunnel Service] Failed to update SQLite system_config:", dbErr);
          }

          // 2. Write to server/data/cloudflare_url.txt
          try {
            const dataDir = path.join(process.cwd(), "data");
            if (!fs.existsSync(dataDir)) {
              fs.mkdirSync(dataDir, { recursive: true });
            }
            fs.writeFileSync(
              path.join(dataDir, "cloudflare_url.txt"),
              `${liveUrl}\n# Kiosk Quick Tunnel Online`
            );
          } catch (fileErr) {
            console.warn("[Tunnel Service] Failed to write cloudflare_url.txt:", fileErr);
          }
        }
      }
    };

    if (tunnelProcess.stdout) {
      tunnelProcess.stdout.on("data", handleOutput);
    }

    if (tunnelProcess.stderr) {
      tunnelProcess.stderr.on("data", handleOutput);
    }

    tunnelProcess.on("error", (err: any) => {
      if (err.code === "ENOENT") {
        console.warn("[Tunnel Service] 'cloudflared' CLI binary is not installed on system PATH. Quick Tunnel disabled.");
      } else {
        console.warn("[Tunnel Service] Process error:", err.message || err);
      }
      tunnelProcess = null;
    });

    tunnelProcess.on("exit", (code) => {
      console.log(`[Tunnel Service] Quick Cloudflare Tunnel process exited with code ${code}`);
      tunnelProcess = null;
    });
  } catch (err: any) {
    console.warn("[Tunnel Service] Failed to spawn cloudflared:", err.message || err);
    tunnelProcess = null;
  }
}

export function waitForTunnelPromise(port: number = 3000, timeoutMs: number = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (currentTunnelUrl && !currentTunnelUrl.includes("api.trycloudflare.com")) {
      return resolve(currentTunnelUrl);
    }

    let isSettled = false;
    let spawnErrorMsg: string | null = null;

    const cleanup = () => {
      isSettled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };

    const timeoutTimer = setTimeout(() => {
      if (!isSettled) {
        cleanup();
        reject(new HardwareError("CLOUDFLARE_TUNNEL_TIMEOUT", spawnErrorMsg || "Cloudflare Quick Tunnel timed out. Verify WAN internet connection."));
      }
    }, timeoutMs);

    // Force spawn if not active
    if (!tunnelProcess) {
      try {
        console.log(`[Tunnel Service] Spawning cloudflared for onboarding tunnel verification...`);
        tunnelProcess = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`]);
      } catch (err: any) {
        cleanup();
        return reject(new HardwareError("CLOUDFLARE_PROCESS_ERROR", err.message || "Failed to spawn cloudflared process"));
      }
    }

    const handleOutput = (data: Buffer) => {
      if (isSettled) return;
      const output = data.toString();
      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);

      if (match && match[0]) {
        const liveUrl = match[0];
        if (liveUrl.includes("api.trycloudflare.com")) return;

        currentTunnelUrl = liveUrl;
        console.log(`🌐 [Tunnel Service] Quick Cloudflare Tunnel verified online: ${liveUrl}`);

        try {
          updateSystemConfig({ cloudflareUrl: liveUrl });
        } catch (e) { /* ignored */ }

        try {
          const dataDir = path.join(process.cwd(), "data");
          if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
          fs.writeFileSync(path.join(dataDir, "cloudflare_url.txt"), `${liveUrl}\n# Kiosk Quick Tunnel Online`);
        } catch (e) { /* ignored */ }

        cleanup();
        resolve(liveUrl);
      }
    };

    if (tunnelProcess.stdout) {
      tunnelProcess.stdout.on("data", handleOutput);
    }

    if (tunnelProcess.stderr) {
      tunnelProcess.stderr.on("data", handleOutput);
    }

    tunnelProcess.on("error", (err: any) => {
      let code = "CLOUDFLARE_PROCESS_ERROR";
      if (err.code === "ENOENT") {
        code = "CLOUDFLARE_BINARY_MISSING";
        spawnErrorMsg = "'cloudflared' CLI binary is not installed on system PATH.";
      } else {
        spawnErrorMsg = err.message || "Cloudflare process execution error";
      }
      if (!isSettled) {
        cleanup();
        reject(new HardwareError(code, spawnErrorMsg || "Cloudflare process execution error"));
      }
    });

    tunnelProcess.on("exit", (code) => {
      tunnelProcess = null;
      if (!isSettled) {
        cleanup();
        reject(new HardwareError("CLOUDFLARE_PROCESS_ERROR", spawnErrorMsg || `cloudflared process exited unexpectedly with code ${code}`));
      }
    });
  });
}
