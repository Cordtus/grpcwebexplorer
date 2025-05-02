// utils/process.js
import { exec } from 'child_process';
import { promisify } from 'util';

// Track active child processes
const activeProcesses = new Set();

// Handle cleanup on process exit
if (typeof process !== 'undefined') {
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, () => {
      console.log(`\nReceived ${signal}, cleaning up child processes...`);
      for (const proc of activeProcesses) {
        try {
          proc.kill();
        } catch (err) {
          // Ignore errors during cleanup
        }
      }
      process.exit(0);
    });
  });

  // Ensure cleanup on uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    process.exit(1);
  });
}

/**
 * Execute a command and track the process
 * @param {string} command - Command to execute
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function execCommand(command) {
  const childProcess = exec(command);
  activeProcesses.add(childProcess);
  
  try {
    return await new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      
      childProcess.stdout?.on('data', (data) => {
        stdout += data;
      });
      
      childProcess.stderr?.on('data', (data) => {
        stderr += data;
      });
      
      childProcess.on('close', (code) => {
        if (code === 0 || stderr === '') {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        }
      });
      
      childProcess.on('error', (err) => {
        reject(err);
      });
    });
  } finally {
    activeProcesses.delete(childProcess);
  }
}

// For backwards compatibility
export const execAsync = promisify(exec);