import { exec } from "child_process";

/**
 * Runs a shell command and returns { stdout, stderr }.
 * Rejects on non-zero exit code.
 */
export function execCommand(
  command: string
): Promise<{ stdout: string; stderr: string }> {
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
 */
export async function execWithTimeout(cmd: string, timeoutMs = 4000): Promise<{ stdout: string; stderr: string }> {
  return Promise.race([
    execCommand(cmd),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Command timed out: ${cmd}`)), timeoutMs)
    ),
  ]);
}
