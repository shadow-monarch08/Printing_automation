import { exec, execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function runSecureCommand(
  binary: string,
  args: string[],
  options?: { timeout?: number; inputString?: string }
): Promise<{ stdout: string; stderr: string }> {
  const timeoutMs = options?.timeout ?? 15000;
  
  // Spawn the child process promise
  const childPromise = execFileAsync(binary, args, { timeout: timeoutMs });

  // If we have keystrokes to inject (like pressing Enter for hp-setup),
  // we write them directly to the running process's stdin stream.
  if (options?.inputString && childPromise.child && childPromise.child.stdin) {
    childPromise.child.stdin.write(options.inputString);
    childPromise.child.stdin.end();
  }

  // Now wait for the command to finish
  const { stdout, stderr } = await childPromise;
  
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

export async function runSecureCommandWithTimeout(
  binary: string,
  args: string[],
  timeoutMs = 4000,
  inputString?: string
): Promise<{ stdout: string; stderr: string }> {
  return Promise.race([
    runSecureCommand(binary, args, { timeout: timeoutMs, inputString }),
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