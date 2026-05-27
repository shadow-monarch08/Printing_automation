import { exec, execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function runSecureCommand(
  binary: string,
  args: string[],
  options?: { timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync(binary, args, {
    timeout: options?.timeout ?? 15000,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

export async function runSecureCommandWithTimeout(
  binary: string,
  args: string[],
  timeoutMs = 4000
): Promise<{ stdout: string; stderr: string }> {
  return Promise.race([
    runSecureCommand(binary, args, { timeout: timeoutMs }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Command timed out: ${binary} ${args.join(" ")}`)), timeoutMs)
    ),
  ]);
}

/**
 * Runs a shell command and returns { stdout, stderr }.
 * Rejects on non-zero exit code.
 * @deprecated Use runSecureCommand instead
 */
export function execCommand(
  command: string
): Promise<{ stdout: string; stderr: string }> {
  console.warn("[DEPRECATED] execCommand is deprecated. Use runSecureCommand instead.");
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
        return;
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

/**
 * Runs a shell command with a specific timeout, rejecting if it takes too long.
 * @deprecated Use runSecureCommandWithTimeout instead
 */
export async function execWithTimeout(cmd: string, timeoutMs = 4000): Promise<{ stdout: string; stderr: string }> {
  console.warn("[DEPRECATED] execWithTimeout is deprecated. Use runSecureCommandWithTimeout instead.");
  return Promise.race([
    execCommand(cmd),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Command timed out: ${cmd}`)), timeoutMs)
    ),
  ]);
}
