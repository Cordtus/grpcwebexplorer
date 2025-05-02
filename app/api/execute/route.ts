// app/api/execute/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { execCommand } from '@/utils/process';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, service, method, params, useTLS } = body;

    if (!endpoint || !service || !method) {
      return NextResponse.json(
        { error: 'Endpoint, service, and method are required' },
        { status: 400 }
      );
    }

    try {
      // Execute grpcurl command with the provided parameters
      const grpcurlCommand = buildGrpcurlCommand(endpoint, service, method, params, useTLS);

      const { stdout, stderr } = await execCommand(grpcurlCommand);

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
