// app/api/services/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Ensure output directory exists
async function ensureOutputDir() {
  const outputDir = path.join(process.cwd(), 'public', 'output');
  try {
    await fs.promises.mkdir(outputDir, { recursive: true });
    return outputDir;
  } catch (err) {
    console.error('Failed to create output directory:', err);
    throw err;
  }
}

export async function GET(request: NextRequest) {
  try {
    const endpoint = request.nextUrl.searchParams.get('endpoint');
    const useTLS = request.nextUrl.searchParams.get('useTLS') === 'true';
    const useCache = request.nextUrl.searchParams.get('useCache') !== 'false'; // Default to true

    if (!endpoint) {
      // Return empty list when no endpoint is provided
      return NextResponse.json([]);
    }

    // Create file-safe endpoint name for caching
    const safeEndpoint = endpoint.replace(/[:/.]/g, '_');
    const cacheFileName = `${safeEndpoint}${useTLS ? '_tls' : ''}_services.json`;
    
    try {
      // Create output directory if it doesn't exist
      const outputDir = await ensureOutputDir();
      const cacheFilePath = path.join(outputDir, cacheFileName);
      
      // Check if cached file exists and is not expired
      if (useCache) {
        try {
          const stats = await fs.promises.stat(cacheFilePath);
          const fileAge = Date.now() - stats.mtimeMs;
          const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
          
          if (fileAge < maxAge) {
            // Cache file exists and is not expired
            const cachedData = await fs.promises.readFile(cacheFilePath, 'utf8');
            return NextResponse.json(JSON.parse(cachedData));
          }
        } catch (err) {
          // File doesn't exist or other error, proceed to fetch fresh data
        }
      }

      // Build grpcurl command with or without TLS
      const tlsFlag = useTLS ? '' : '-plaintext';
      const command = `grpcurl ${tlsFlag} ${endpoint} list`;

      const { stdout, stderr } = await execAsync(command);

      if (stderr && !stdout) {
        return NextResponse.json({ error: stderr }, { status: 500 });
      }

      // Parse the list of services
      const servicesList = stdout.split('\n').filter(Boolean);

      // Group services by chain and module
      const services = servicesList.map(service => {
        const parts = service.split('.');
        let chain = 'default';
        let moduleItem = 'default';  // Renamed from 'module' to 'moduleItem'

        // Try to identify chain and module from service name
      if (parts.length >= 3) {
        chain = parts[0];
        moduleItem = parts[1];  // Renamed from 'module' to 'moduleItem'
      } else if (parts.length === 2) {
        moduleItem = parts[0];  // Renamed from 'module' to 'moduleItem'
      }

      return {
        service,
        chain,
        module: moduleItem,  // We still use 'module' in the returned object as that's what the frontend expects
        path: service // Use the service name as the path
      };
      });

      // Cache the result to file
      await fs.promises.writeFile(cacheFilePath, JSON.stringify(services, null, 2), 'utf8');

      return NextResponse.json(services);
    } catch (err: any) {
      console.error('grpcurl execution error:', err);

      // If grpcurl fails, return a more helpful error message
      let errorMessage = 'Failed to connect to gRPC server';

      if (err.stderr) {
        if (err.stderr.includes('refused')) {
          errorMessage = 'Connection refused. Make sure the gRPC server is running and accessible.';
        } else if (err.stderr.includes('certificate') || err.stderr.includes('x509')) {
          errorMessage = 'TLS certificate error. Try adjusting the TLS setting.';
        } else {
          errorMessage = err.stderr;
        }
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}