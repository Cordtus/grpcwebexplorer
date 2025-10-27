// utils/process.ts
import { type ChildProcess, spawn } from 'child_process';

// Track active child processes
const activeProcesses = new Set<ChildProcess>();

// Handle cleanup on process exit
if (typeof process !== 'undefined') {
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, () => {
      console.log(`\nReceived ${signal}, cleaning up child processes...`);
      // Convert Set to Array before iteration to avoid the TS error
      Array.from(activeProcesses).forEach(proc => {
        try {
          proc.kill();
        } catch (err) {
          // Ignore errors during cleanup
        }
      });
      process.exit(0);
    });
  });
}

/**
 * Execute a command and track the process
 * @param {string[]} command - Command to execute
 * @param {object} opts - Options including stdin and timeout
 * @param {string} opts.stdin - Optional stdin to write to the process
 * @param {number} opts.timeout - Optional timeout in milliseconds (default: 10000)
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function execCommand(command: string[], opts?: {
  stdin?: string | undefined,
  timeout?: number,
}): Promise<{stdout: string, stderr: string}> {
  const childProcess = spawn(command[0], command.slice(1));
  activeProcesses.add(childProcess);

  const timeout = opts?.timeout ?? 10000; // Default 10 second timeout

  try {
    return await new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout | null = null;

      // Set up timeout
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          childProcess.kill('SIGTERM');
          reject(new Error(`Command timed out after ${timeout}ms: ${command.join(' ')}`));
        }, timeout);
      }

      if (opts?.stdin) {
        childProcess.stdin?.write(opts.stdin, (err) => {
          if (err) {
            console.warn('failed to write to %s stdin', command, err);
          }
          childProcess.stdin?.end();
        });
      }

      childProcess.stdout?.on('data', (data) => {
        stdout += data;
      });

      childProcess.stderr?.on('data', (data) => {
        stderr += data;
      });

      childProcess.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);

        if (code === 0 || stderr === '') {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        }
      });

      childProcess.on('error', (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(err);
      });
    });
  } finally {
    activeProcesses.delete(childProcess);
  }
}
