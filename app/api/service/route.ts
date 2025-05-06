// app/api/service/route.ts
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
    const searchParams = request.nextUrl.searchParams;
    const service = searchParams.get('service');
    const endpoint = searchParams.get('endpoint');
    const useTLS = searchParams.get('useTLS') === 'true';
    const useCache = searchParams.get('useCache') !== 'false'; // Default to true

    if (!service || !endpoint) {
      return NextResponse.json({
        error: 'Service and endpoint parameters are required'
      }, { status: 400 });
    }

    // Create file-safe endpoint and service name for caching
    const safeEndpoint = endpoint.replace(/[:/.]/g, '_');
    const safeService = service.replace(/[:.]/g, '_');
    const cacheFileName = `${safeEndpoint}${useTLS ? '_tls' : ''}_${safeService}.json`;

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
      const command = `grpcurl ${tlsFlag} ${endpoint} list ${service}`;

      const { stdout, stderr } = await execAsync(command);

      if (stderr && !stdout) {
        return NextResponse.json({ error: stderr }, { status: 500 });
      }

      // Parse the list of methods
      const methodsList = stdout.split('\n')
      .filter(Boolean)
      .map(method => method.replace(`${service}.`, ''));

      // Format methods as needed by the frontend
      const methods = methodsList.map(name => ({
        name,
        requestType: `${name}Request`,  // Assuming naming convention
        responseType: `${name}Response` // Assuming naming convention
      }));

      const result = { methods };

      // Cache the result to file
      await fs.promises.writeFile(cacheFilePath, JSON.stringify(result, null, 2), 'utf8');

      return NextResponse.json(result);
    } catch (err: any) {
      console.error('grpcurl execution error:', err);

      let errorMessage = 'Failed to list methods for service';

      if (err.stderr) {
        if (err.stderr.includes('certificate') || err.stderr.includes('x509')) {
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
