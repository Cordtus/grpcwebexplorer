// scripts/setup-dev.js
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

// Get proper directory path in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'output');

// Create directories
async function ensureDir(dir) {
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  } catch (err) {
    console.error(`Failed to create directory ${dir}:`, err);
  }
}

// Move directory if it exists in the wrong location
async function moveDirectoryIfNeeded(srcDir, destDir) {
  if (fs.existsSync(srcDir) && !fs.existsSync(destDir)) {
    console.log(`Moving directory from ${srcDir} to ${destDir}...`);

    // Create destination directory
    await ensureDir(destDir);

    // Get all files and directories in the source directory
    const items = await fs.promises.readdir(srcDir, { withFileTypes: true });

    // Copy each item to the destination
    for (const item of items) {
      const srcPath = path.join(srcDir, item.name);
      const destPath = path.join(destDir, item.name);

      if (item.isDirectory()) {
        // Recursively copy directory
        await moveDirectoryIfNeeded(srcPath, destPath);
      } else {
        // Copy file
        await fs.promises.copyFile(srcPath, destPath);
        console.log(`✅ Copied file: ${srcPath} -> ${destPath}`);
      }
    }

    // Remove source directory after copying
    try {
      await fs.promises.rm(srcDir, { recursive: true, force: true });
      console.log(`✅ Removed old directory: ${srcDir}`);
    } catch (err) {
      console.error(`Failed to remove directory ${srcDir}:`, err);
    }
  }
}

// Check if grpcurl is installed
async function checkGrpcurl() {
  try {
    const { exec } = await import('child_process');
    const util = await import('util');
    const execAsync = util.promisify(exec);

    await execAsync('grpcurl --version');
    console.log('✅ grpcurl is installed and available');
    return true;
  } catch (err) {
    console.error('❌ grpcurl not found in PATH');
    console.log('Please install grpcurl: https://github.com/fullstorydev/grpcurl#installation');
    console.log('This tool is required for the gRPC Explorer to work properly.');
    return false;
  }
}

async function main() {
  try {
    console.log('Setting up gRPC Explorer development environment...');

    // Ensure public directory exists
    await ensureDir(PUBLIC_DIR);

    // Ensure output directory is inside public directory
    await ensureDir(OUTPUT_DIR);

    // Check if output directory exists in project root and move it if needed
    const rootOutputDir = path.join(PROJECT_ROOT, 'output');
    await moveDirectoryIfNeeded(rootOutputDir, OUTPUT_DIR);

    // Check for grpcurl
    const hasGrpcurl = await checkGrpcurl();
    if (!hasGrpcurl) {
      console.log('⚠️ The application will still start, but you need grpcurl to actually connect to gRPC servers.');
    }

    console.log('✅ Development setup complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run `yarn dev` to start the development server');
    console.log('2. Enter a gRPC endpoint (e.g., localhost:50051) and click "Connect"');
    console.log('3. Browse the services and methods');
    console.log('');
    console.log('Note: Make sure your gRPC server has reflection enabled');

  } catch (err) {
    console.error('❌ Setup failed:', err);
  }
}

main();
