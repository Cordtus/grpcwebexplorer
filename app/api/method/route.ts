// app/api/method/route.ts
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
    const method = searchParams.get('method');
    const endpoint = searchParams.get('endpoint');
    const useTLS = searchParams.get('useTLS') === 'true';
    const useCache = searchParams.get('useCache') !== 'false'; // Default to true

    if (!service || !method || !endpoint) {
      return NextResponse.json({
        error: 'Service, method, and endpoint parameters are required'
      }, { status: 400 });
    }

    // Create file-safe endpoint, service, and method name for caching
    const safeEndpoint = endpoint.replace(/[:/.]/g, '_');
    const safeService = service.replace(/[:.]/g, '_');
    const safeMethod = method.replace(/[:.]/g, '_');
    const cacheFileName = `${safeEndpoint}${useTLS ? '_tls' : ''}_${safeService}_${safeMethod}.json`;

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

      // First, get the method description to find the request type
      const describeMethodCommand = `grpcurl ${tlsFlag} ${endpoint} describe ${service}.${method}`;
      const { stdout: methodDescription, stderr: methodError } = await execAsync(describeMethodCommand);

      if (methodError && !methodDescription) {
        return NextResponse.json({ error: methodError }, { status: 500 });
      }

      // Extract the request type from the method description
      const requestTypeMatch = methodDescription.match(/rpc\s+\w+\s*\(\s*\.?([\w\.]+)\s*\)/);
      if (!requestTypeMatch) {
        return NextResponse.json({
          error: `Failed to extract request type from method description`
        }, { status: 500 });
      }

      const requestType = requestTypeMatch[1];
      console.log(`Request type for ${method}: ${requestType}`);

      // Now describe the request type to get the fields
      const describeRequestCommand = `grpcurl ${tlsFlag} ${endpoint} describe ${requestType}`;
      const { stdout: requestDescription, stderr: requestError } = await execAsync(describeRequestCommand);

      if (requestError && !requestDescription) {
        return NextResponse.json({ error: requestError }, { status: 500 });
      }

      // Save the full method description to a separate file for reference
      const methodDescFileName = `${safeEndpoint}${useTLS ? '_tls' : ''}_${safeService}_${safeMethod}_desc.txt`;
      const methodDescFilePath = path.join(outputDir, methodDescFileName);
      await fs.promises.writeFile(methodDescFilePath, methodDescription, 'utf8');

      // Also save the request description
      const requestDescFileName = `${safeEndpoint}${useTLS ? '_tls' : ''}_${requestType.replace(/[:.]/g, '_')}_desc.txt`;
      const requestDescFilePath = path.join(outputDir, requestDescFileName);
      await fs.promises.writeFile(requestDescFilePath, requestDescription, 'utf8');

      // Parse fields from the request description
      const fields = [];
      const lines = requestDescription.split('\n');

      // Look for field definitions in the message
      let inMessageBlock = false;

      for (const line of lines) {
        // Look for the start of the message definition
        if (line.match(/^message\s+\w+\s*{/) && !inMessageBlock) {
          inMessageBlock = true;
          continue;
        }

        // End of message block
        if (inMessageBlock && line.trim() === '}') {
          break;
        }

        // Parse field definitions within the message
        if (inMessageBlock) {
          // Match format like: "  string address = 1 [(.cosmos_proto.scalar) = "cosmos.AddressString"];"
          const fieldMatch = /\s*(repeated)?\s*(\w+)\s+(\w+)\s+=\s+(\d+)/.exec(line);
          if (fieldMatch) {
            // Check if there are any type qualifiers/options in square brackets
            const options = line.includes('[') ? line.substring(line.indexOf('[')) : '';

            fields.push({
              name: fieldMatch[3],
              type: fieldMatch[2],
              repeated: Boolean(fieldMatch[1]),
                        id: parseInt(fieldMatch[4], 10),
                        options: options || undefined
            });
          }
        }
        }

        const result = { fields };

        // Cache the result to file
        await fs.promises.writeFile(cacheFilePath, JSON.stringify(result, null, 2), 'utf8');

        return NextResponse.json(result);
      } catch (err: any) {
        console.error('grpcurl execution error:', err);

        let errorMessage = 'Failed to describe method';

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
