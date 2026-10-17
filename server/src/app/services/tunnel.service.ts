import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { updateSystemConfig, getSystemConfig } from "./config.db.service";
import { HardwareError } from "../utils/errors";
import { eventBus } from "../utils/eventBus";
import { redisConnection } from "../../infrastructure/redis";
import { REDIS_KEYS } from "../../infrastructure/redisKeys";

export type TunnelState = "STOPPED" | "STARTING" | "ONLINE" | "RECONNECTING" | "CRASHED";

export interface TunnelStatus {
  state: TunnelState;
  url: string | null;
  pid: number | null;
  consecutiveCrashes: number;
  uptimeSeconds: number;
}

interface TunnelWaiter {
  resolve: (url: string) => void;
  reject: (err: any) => void;
  timer: NodeJS.Timeout;
}

class TunnelSupervisor {
  private tunnelProcess: ChildProcess | null = null;
  private currentTunnelUrl: string | null = null;
  private state: TunnelState = "STOPPED";
  private isExplicitlyStopped: boolean = false;
  private consecutiveCrashes: number = 0;
  private onlineStartedAt: number | null = null;
  private restartTimer: NodeJS.Timeout | null = null;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private stableOnlineTimer: NodeJS.Timeout | null = null;
  private waiters: TunnelWaiter[] = [];
  private port: number = 3000;
  private recentCrashTimestamps: number[] = [];

  constructor() {
    this.startWatchdog();
  }

  public getActiveUrl(): string | null {
    if (this.currentTunnelUrl) return this.currentTunnelUrl;
    const config = getSystemConfig();
    return config?.cloudflareUrl || null;
  }

  public getStatus(): TunnelStatus {
    return {
      state: this.state,
      url: this.currentTunnelUrl,
      pid: this.tunnelProcess?.pid || null,
      consecutiveCrashes: this.consecutiveCrashes,
      uptimeSeconds: this.onlineStartedAt ? Math.floor((Date.now() - this.onlineStartedAt) / 1000) : 0,
    };
  }

  public shouldBeActive(): boolean {
    const config = getSystemConfig();
    const isOnboarded = config ? Boolean(config.isOnboarded) : false;
    const isReady = config?.provisioningState === "READY";
    return isOnboarded && isReady;
  }

  private startWatchdog(): void {
    if (this.watchdogTimer) return;
    this.watchdogTimer = setInterval(() => {
      this.performWatchdogCheck();
    }, 60000);
    if (this.watchdogTimer.unref) {
      this.watchdogTimer.unref();
    }
  }

  private performWatchdogCheck(): void {
    const shouldRun = this.shouldBeActive();

    if (!shouldRun) {
      if (this.state !== "STOPPED") {
        console.log("[Tunnel Supervisor] 🔒 Watchdog: System not in READY state. Ensuring tunnel is stopped.");
        this.stop();
      }
      return;
    }

    if (!this.tunnelProcess) {
      if (!this.isExplicitlyStopped && this.state !== "RECONNECTING" && this.state !== "STARTING") {
        console.log("[Tunnel Supervisor] ⚠️ Watchdog detected inactive tunnel while system is READY. Triggering startup...");
        this.start(this.port);
      }
      return;
    }

    const pid = this.tunnelProcess.pid;
    if (pid) {
      try {
        process.kill(pid, 0);
      } catch (err: any) {
        if (err.code === "ESRCH") {
          console.warn(`[Tunnel Supervisor] ⚠️ Watchdog found dead PID ${pid}. Process vanished. Cleaning up and restarting...`);
          this.handleProcessTermination(-1, "WATCHDOG_DEAD_PID");
        }
      }
    }
  }

  public start(port: number = 3000): void {
    this.port = port;

    if (!this.shouldBeActive()) {
      console.log("[Tunnel Supervisor] 🔒 Security Gate: Quick Cloudflare Tunnel start blocked because system is not in READY provisioning state.");
      this.stop();
      this.writeTunnelDisabledFile();
      return;
    }

    if (this.state === "ONLINE" && this.tunnelProcess && this.currentTunnelUrl) {
      console.log(`[Tunnel Supervisor] Quick Cloudflare Tunnel already active and online: ${this.currentTunnelUrl}`);
      return;
    }

    if (this.state === "STARTING" && this.tunnelProcess) {
      console.log("[Tunnel Supervisor] Quick Cloudflare Tunnel already starting...");
      return;
    }

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    this.isExplicitlyStopped = false;
    this.state = "STARTING";
    console.log(`[Tunnel Supervisor] Initializing Quick Cloudflare Tunnel for http://localhost:${port}...`);
    eventBus.emit("system:tunnel:updated", { url: null, status: "STARTING", timestamp: Date.now() });

    try {
      const isWindows = process.platform === "win32";
      const child = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], {
        detached: !isWindows,
        stdio: ["ignore", "pipe", "pipe"],
      });

      this.tunnelProcess = child;

      const handleOutput = (data: Buffer) => {
        const output = data.toString();
        const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);

        if (match && match[0]) {
          const liveUrl = match[0];
          if (liveUrl.includes("api.trycloudflare.com")) {
            return;
          }

          if (this.currentTunnelUrl !== liveUrl) {
            this.handleTunnelOnline(liveUrl);
          }
        }
      };

      if (child.stdout) {
        child.stdout.on("data", handleOutput);
      }
      if (child.stderr) {
        child.stderr.on("data", handleOutput);
      }

      child.on("error", (err: any) => {
        if (err.code === "ENOENT") {
          console.warn("[Tunnel Supervisor] 'cloudflared' CLI binary is not installed on system PATH. Quick Tunnel disabled.");
          this.state = "STOPPED";
          this.isExplicitlyStopped = true;
          this.rejectAllWaiters(
            new HardwareError("CLOUDFLARE_BINARY_MISSING", "'cloudflared' CLI binary is not installed on system PATH.")
          );
        } else {
          console.warn("[Tunnel Supervisor] Process error:", err.message || err);
        }
      });

      child.on("exit", (code, signal) => {
        if (this.tunnelProcess === child) {
          this.handleProcessTermination(code, signal);
        }
      });
    } catch (err: any) {
      console.warn("[Tunnel Supervisor] Failed to spawn cloudflared:", err.message || err);
      this.tunnelProcess = null;
      this.state = "CRASHED";
      this.rejectAllWaiters(new HardwareError("CLOUDFLARE_PROCESS_ERROR", err.message || "Failed to spawn cloudflared"));
      this.scheduleRestart(err.message || "Spawn failure");
    }
  }

  private handleTunnelOnline(liveUrl: string): void {
    this.currentTunnelUrl = liveUrl;
    this.state = "ONLINE";
    this.onlineStartedAt = Date.now();
    console.log(`🌐 [Tunnel Supervisor] Quick Cloudflare Tunnel online: ${liveUrl}`);

    // 1. Update SQLite DB
    try {
      updateSystemConfig({ cloudflareUrl: liveUrl });
    } catch (dbErr) {
      console.warn("[Tunnel Supervisor] Failed to update SQLite system_config:", dbErr);
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
      console.warn("[Tunnel Supervisor] Failed to write cloudflare_url.txt:", fileErr);
    }

    // 3. Update Redis telemetry
    this.syncWithRedis(liveUrl);

    // 4. Broadcast across EventBus
    eventBus.emit("system:tunnel:updated", {
      url: liveUrl,
      status: "ONLINE",
      timestamp: Date.now(),
    });

    // 5. Resolve any pending waiters
    const pending = [...this.waiters];
    this.waiters = [];
    for (const w of pending) {
      clearTimeout(w.timer);
      w.resolve(liveUrl);
    }

    // 6. Set 60s sustained stability timer to reset crash backoff
    if (this.stableOnlineTimer) {
      clearTimeout(this.stableOnlineTimer);
    }
    this.stableOnlineTimer = setTimeout(() => {
      this.stableOnlineTimer = null;
      if (this.state === "ONLINE") {
        this.consecutiveCrashes = 0;
        this.recentCrashTimestamps = [];
      }
    }, 60000);
    if (this.stableOnlineTimer.unref) {
      this.stableOnlineTimer.unref();
    }
  }

  private async syncWithRedis(liveUrl: string): Promise<void> {
    try {
      const raw = await redisConnection.get(REDIS_KEYS.wifiConnectionStatus);
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.cloudflareUrl = liveUrl;
        await redisConnection.set(REDIS_KEYS.wifiConnectionStatus, JSON.stringify(parsed));
      }
    } catch {
      /* redis warning ignored */
    }
  }

  private handleProcessTermination(code: number | null, signal: string | null): void {
    this.tunnelProcess = null;
    this.onlineStartedAt = null;
    if (this.stableOnlineTimer) {
      clearTimeout(this.stableOnlineTimer);
      this.stableOnlineTimer = null;
    }

    if (this.isExplicitlyStopped) {
      console.log(`[Tunnel Supervisor] Quick Cloudflare Tunnel stopped as intended (code: ${code}, signal: ${signal}).`);
      this.state = "STOPPED";
      this.currentTunnelUrl = null;
      eventBus.emit("system:tunnel:updated", { url: null, status: "STOPPED", timestamp: Date.now() });
      return;
    }

    console.warn(`[Tunnel Supervisor] ⚠️ Quick Cloudflare Tunnel process exited unexpectedly (code: ${code}, signal: ${signal}).`);
    this.currentTunnelUrl = null;
    this.state = "CRASHED";
    eventBus.emit("system:tunnel:updated", { url: null, status: "CRASHED", timestamp: Date.now() });

    if (!this.shouldBeActive()) {
      this.state = "STOPPED";
      return;
    }

    this.scheduleRestart(`exit code ${code}`);
  }

  private scheduleRestart(reason: string): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    const now = Date.now();
    this.recentCrashTimestamps = this.recentCrashTimestamps.filter((t) => now - t < 300000);
    this.recentCrashTimestamps.push(now);
    this.consecutiveCrashes++;

    let backoffMs =
      Math.min(30000, 2000 * Math.pow(2, Math.max(0, this.consecutiveCrashes - 1))) +
      Math.floor(Math.random() * 1000);

    if (this.recentCrashTimestamps.length >= 6) {
      console.warn(
        `[Tunnel Supervisor] 🚨 Circuit breaker: ${this.recentCrashTimestamps.length} crashes in 5m. Entering 60s cool-down.`
      );
      backoffMs = 60000;
    }

    this.state = "RECONNECTING";
    console.log(
      `[Tunnel Supervisor] 🔄 Scheduling restart in ${Math.round(backoffMs / 1000)}s (crash #${this.consecutiveCrashes}, reason: ${reason})...`
    );
    eventBus.emit("system:tunnel:updated", { url: null, status: "RECONNECTING", timestamp: Date.now() });

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.isExplicitlyStopped && this.shouldBeActive()) {
        console.log(`[Tunnel Supervisor] 🚀 Executing auto-restart after backoff cooldown...`);
        this.start(this.port);
      }
    }, backoffMs);
  }

  public stop(): void {
    this.isExplicitlyStopped = true;
    this.currentTunnelUrl = null;
    this.state = "STOPPED";

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.stableOnlineTimer) {
      clearTimeout(this.stableOnlineTimer);
      this.stableOnlineTimer = null;
    }

    this.rejectAllWaiters(new HardwareError("TUNNEL_STOPPED", "Cloudflare tunnel stopped by supervisor."));

    if (this.tunnelProcess) {
      const proc = this.tunnelProcess;
      const pid = proc.pid;
      this.tunnelProcess = null;

      try {
        if (process.platform !== "win32" && pid) {
          process.kill(-pid, "SIGTERM");
        } else {
          proc.kill("SIGTERM");
        }
        console.log("[Tunnel Supervisor] Quick Cloudflare Tunnel process stopped.");
      } catch {
        try {
          proc.kill("SIGTERM");
        } catch {}
      }

      setTimeout(() => {
        try {
          if (process.platform !== "win32" && pid) {
            process.kill(-pid, "SIGKILL");
          } else {
            proc.kill("SIGKILL");
          }
        } catch {}
      }, 1000);
    }

    eventBus.emit("system:tunnel:updated", { url: null, status: "STOPPED", timestamp: Date.now() });
  }

  public ensureOnline(port?: number): void {
    if (!this.shouldBeActive()) return;

    if (this.state !== "ONLINE" || !this.tunnelProcess || !this.currentTunnelUrl) {
      console.log(`[Tunnel Supervisor] ⚡ ensureOnline: Tunnel not online (state: ${this.state}). Triggering startup...`);
      this.isExplicitlyStopped = false;
      this.start(port || this.port);
    }
  }

  public waitForTunnel(port: number = 3000, timeoutMs: number = 25000): Promise<string> {
    if (this.currentTunnelUrl && this.state === "ONLINE" && !this.currentTunnelUrl.includes("api.trycloudflare.com")) {
      return Promise.resolve(this.currentTunnelUrl);
    }

    this.isExplicitlyStopped = false;
    if (this.state === "STOPPED" || this.state === "CRASHED") {
      this.start(port);
    }

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.resolve === resolve);
        if (idx !== -1) {
          this.waiters.splice(idx, 1);
        }
        reject(
          new HardwareError(
            "CLOUDFLARE_TUNNEL_TIMEOUT",
            "Cloudflare Quick Tunnel timed out. Verify WAN internet connection."
          )
        );
      }, timeoutMs);

      this.waiters.push({ resolve, reject, timer });
    });
  }

  private rejectAllWaiters(error: Error): void {
    const pending = [...this.waiters];
    this.waiters = [];
    for (const w of pending) {
      clearTimeout(w.timer);
      w.reject(error);
    }
  }

  private writeTunnelDisabledFile(): void {
    try {
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(dataDir, "cloudflare_url.txt"),
        "# TUNNEL_DISABLED (System in Setup / Provisioning Mode)\n"
      );
    } catch {
      /* ignored */
    }
  }
}

// Global Singleton Instance
const supervisor = new TunnelSupervisor();

export function getActiveTunnelUrl(): string | null {
  return supervisor.getActiveUrl();
}

export function shouldTunnelBeActive(): boolean {
  return supervisor.shouldBeActive();
}

export function stopQuickTunnel(): void {
  supervisor.stop();
}

export function startQuickTunnel(port: number = 3000): void {
  supervisor.start(port);
}

export function ensureTunnelOnline(port?: number): void {
  supervisor.ensureOnline(port);
}

export function waitForTunnelPromise(port: number = 3000, timeoutMs: number = 25000): Promise<string> {
  return supervisor.waitForTunnel(port, timeoutMs);
}

export function getTunnelStatus(): TunnelStatus {
  return supervisor.getStatus();
}
