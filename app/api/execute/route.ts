// app/api/execute/route.ts
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, service, method, params, useTLS, useCache = true } = body;

    if (!endpoint || !service || !method) {
      return NextResponse.json(
        { error: 'Endpoint, service, and method are required' },
        { status: 400 }
      );
    }

    // Unique identifier for this request - used for caching
    const safeEndpoint = endpoint.replace(/[:/.]/g, '_');
    const safeService = service.replace(/[:.]/g, '_');
    const safeMethod = method.replace(/[:.]/g, '_');
    const paramsHash = JSON.stringify(params).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const cacheFileName = `${safeEndpoint}${useTLS ? '_tls' : ''}_${safeService}_${safeMethod}_${paramsHash}_result.json`;

    try {
      // Check cache first if enabled
      if (useCache) {
        const outputDir = await ensureOutputDir();
        const cacheFilePath = path.join(outputDir, cacheFileName);

        try {
          const stats = await fs.promises.stat(cacheFilePath);
          const fileAge = Date.now() - stats.mtimeMs;
          const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

          if (fileAge < maxAge) {
            // Cache file exists and is not expired
            const cachedData = await fs.promises.readFile(cacheFilePath, 'utf8');
            return NextResponse.json({ response: JSON.parse(cachedData) });
          }
        } catch (err) {
          // File doesn't exist or other error, proceed to fetch fresh data
        }
      }

      // Execute grpcurl command with the provided parameters
      const grpcurlCommand = buildGrpcurlCommand(endpoint, service, method, params, useTLS);

      const { stdout, stderr } = await execAsync(grpcurlCommand);

      if (stderr && !stdout) {
        return NextResponse.json(
          { error: stderr },
          { status: 500 }
        );
      }

      // Parse JSON response
      let response;
      try {
        response = JSON.parse(stdout);
      } catch (parseError) {
        return NextResponse.json(
          { error: `Failed to parse response: ${stdout}` },
          { status: 500 }
        );
      }

      // Cache the result if caching is enabled
      if (useCache) {
        try {
          const outputDir = await ensureOutputDir();
          const cacheFilePath = path.join(outputDir, cacheFileName);
          await fs.promises.writeFile(cacheFilePath, JSON.stringify(response, null, 2), 'utf8');
        } catch (err) {
          console.error('Failed to cache response:', err);
          // Continue even if caching fails
        }
      }

      return NextResponse.json({ response });
    } catch (execError: any) {
      console.error('grpcurl execution error:', execError);

      // Try to extract error message from stderr
      let errorMessage = 'Failed to execute gRPC query';

      if (execError.stderr) {
        if (execError.stderr.includes('certificate') || execError.stderr.includes('x509')) {
          errorMessage = 'TLS certificate error. Try adjusting the TLS setting.';
        } else {
          errorMessage = execError.stderr.toString();
        }
      } else if (execError.message) {
        errorMessage = execError.message;
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

// Build the grpcurl command
function buildGrpcurlCommand(
  endpoint: string,
  service: string,
  method: string,
  params: any,
  useTLS: boolean
): string {
  // Create data parameter if params are provided
  const dataParam = Object.keys(params).length > 0
  ? `-d '${JSON.stringify(params).replace(/'/g, "\\'")}'`
  : '';

  // Set TLS flag based on useTLS parameter
  const tlsFlag = useTLS ? '' : '-plaintext';

  // Build the command
  return `grpcurl ${tlsFlag} ${dataParam} ${endpoint} ${service}/${method}`;
}
