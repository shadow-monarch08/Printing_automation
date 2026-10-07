import { execFile, ChildProcess } from "child_process";

export class CommandTimeoutError extends Error {
  constructor(
    public readonly binary: string,
    public readonly args: string[],
    public readonly timeoutMs: number
  ) {
    super(`Command timed out after ${timeoutMs}ms: ${binary} ${args.join(" ")}`);
    this.name = "CommandTimeoutError";
  }
}

export class BinaryNotFoundError extends Error {
  constructor(
    public readonly binary: string,
    public readonly originalError: Error
  ) {
    super(`Executable not found on system: '${binary}'. Ensure the required package is installed.`);
    this.name = "BinaryNotFoundError";
  }
}

export class CommandExecutionError extends Error {
  public stdout: string;
  public stderr: string;
  public exitCode: number | null;

  constructor(
    public readonly binary: string,
    public readonly args: string[],
    exitCode: number | null,
    stdout: string,
    stderr: string,
    message?: string
  ) {
    super(
      message ||
        `Command failed with exit code ${exitCode}: ${binary} ${args.join(" ")}${
          stderr ? `\nSTDERR: ${stderr}` : ""
        }`
    );
    this.name = "CommandExecutionError";
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

export interface SecureCommandOptions {
  timeout?: number;
  inputString?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  maxBuffer?: number;
}

export interface SecureCommandResult {
  stdout: string;
  stderr: string;
}

/**
 * Safely kills a child process and its process tree across both POSIX and Windows.
 */
function killProcessTree(child: ChildProcess, signal: NodeJS.Signals = "SIGTERM"): void {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }

  const pid = child.pid;
  if (!pid) return;

  try {
    if (process.platform !== "win32") {
      // On POSIX with detached process group, kill the entire group (-pid)
      try {
        process.kill(-pid, signal);
      } catch {
        child.kill(signal);
      }
    } else {
      // On Windows, kill the process directly
      child.kill(signal);
    }
  } catch {
    // Process may have already exited
  }
}

/**
 * Executes a terminal command safely with:
 * 1. Forced POSIX English environment (LC_ALL=C, LANG=C)
 * 2. Hard timeout with dual-stage process group termination (SIGTERM -> SIGKILL)
 * 3. Protected stdin stream with EPIPE error handling
 * 4. Strongly typed errors (CommandTimeoutError, BinaryNotFoundError, CommandExecutionError)
 */
export async function runSecureCommand(
  binary: string,
  args: string[] = [],
  options?: SecureCommandOptions
): Promise<SecureCommandResult> {
  const timeoutMs = options?.timeout ?? 15000;
  const maxBuffer = options?.maxBuffer ?? 10 * 1024 * 1024; // 10MB buffer safeguard

  // Standardize environment to invariant POSIX C locale
  const mergedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    LC_ALL: "C",
    LANG: "C",
    ...(options?.env || {}),
  };

  return new Promise<SecureCommandResult>((resolve, reject) => {
    let timedOut = false;
    let sigkillTimer: NodeJS.Timeout | null = null;
    let timeoutTimer: NodeJS.Timeout | null = null;

    const child = execFile(
      binary,
      args,
      {
        timeout: 0, // We manage timeout manually for dual-stage SIGTERM -> SIGKILL escalation
        maxBuffer,
        cwd: options?.cwd,
        env: mergedEnv,
        detached: process.platform !== "win32", // Enable process group on POSIX for clean tree kills
      } as any,
      (error: any, stdoutRaw: string, stderrRaw: string) => {
        // Clear all timers on exit
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (sigkillTimer) clearTimeout(sigkillTimer);

        const stdout = (stdoutRaw || "").trim();
        const stderr = (stderrRaw || "").trim();

        if (timedOut) {
          return reject(new CommandTimeoutError(binary, args, timeoutMs));
        }

        if (error) {
          // Binary not found (ENOENT)
          if ((error as any).code === "ENOENT") {
            return reject(new BinaryNotFoundError(binary, error));
          }

          const exitCode = typeof (error as any).code === "number" ? (error as any).code : child.exitCode;
          return reject(
            new CommandExecutionError(
              binary,
              args,
              exitCode,
              stdout,
              stderr,
              error.message
            )
          );
        }

        resolve({ stdout, stderr });
      }
    );

    // Setup hard timeout with dual-stage termination
    if (timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        killProcessTree(child, "SIGTERM");

        // Escalate to SIGKILL if the process hasn't exited after 500ms grace period
        sigkillTimer = setTimeout(() => {
          killProcessTree(child, "SIGKILL");
        }, 500);
      }, timeoutMs);
    }

    // Safely write to stdin if input is provided
    if (options?.inputString && child.stdin) {
      child.stdin.on("error", () => {
        // Suppress EPIPE errors if child terminates before reading stdin
      });

      child.stdin.write(options.inputString, () => {
        child.stdin?.end();
      });
    }
  });
}

/**
 * Executes a terminal command with an explicit timeout.
 * Replaces the legacy Promise.race approach with safe process termination.
 */
export async function runSecureCommandWithTimeout(
  binary: string,
  args: string[] = [],
  timeoutMs = 4000,
  inputString?: string
): Promise<SecureCommandResult> {
  return runSecureCommand(binary, args, { timeout: timeoutMs, inputString });
}

/**
 * Preflight check to verify whether a given binary/tool is available on the system PATH.
 */
export async function isBinaryAvailable(binary: string): Promise<boolean> {
  try {
    const checker = process.platform === "win32" ? "where" : "which";
    await runSecureCommand(checker, [binary], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
