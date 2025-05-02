// app/api/service/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const service = searchParams.get('service');
    const endpoint = searchParams.get('endpoint');
    const useTLS = searchParams.get('useTLS') === 'true';

    if (!service || !endpoint) {
      return NextResponse.json({
        error: 'Service and endpoint parameters are required'
      }, { status: 400 });
    }

    try {
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

      return NextResponse.json({ methods });
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
