import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { updateSystemConfig, getSystemConfig } from "./config.db.service";

let tunnelProcess: ChildProcess | null = null;
let currentTunnelUrl: string | null = null;

export function getActiveTunnelUrl(): string | null {
  if (currentTunnelUrl) return currentTunnelUrl;
  const config = getSystemConfig();
  return config?.cloudflareUrl || null;
}

export function stopQuickTunnel(): void {
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
