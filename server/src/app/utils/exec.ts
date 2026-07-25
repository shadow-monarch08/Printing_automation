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
