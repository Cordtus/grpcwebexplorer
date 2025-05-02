// app/api/services/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { execCommand } from '@/utils/process';

export async function GET(request: NextRequest) {
  try {
    const endpoint = request.nextUrl.searchParams.get('endpoint');
    const useTLS = request.nextUrl.searchParams.get('useTLS') === 'true';

    if (!endpoint) {
      // Return empty list when no endpoint is provided
      return NextResponse.json([]);
    }

    try {
      // Build grpcurl command with or without TLS
      const tlsFlag = useTLS ? '' : '-plaintext';
      const command = `grpcurl ${tlsFlag} ${endpoint} list`;

      const { stdout, stderr } = await execCommand(command);

      if (stderr && !stdout) {
        return NextResponse.json({ error: stderr }, { status: 500 });
      }

      // Parse the list of services
      const servicesList = stdout.split('\n').filter(Boolean);

      // Group services by chain and module
      const services = servicesList.map(service => {
        const parts = service.split('.');
        let chain = 'default';
        let module = 'default';

        // Try to identify chain and module from service name
      if (parts.length >= 3) {
        chain = parts[0];
        module = parts[1];
      } else if (parts.length === 2) {
        module = parts[0];
      }

      return {
        service,
        chain,
        module,
        path: service // Use the service name as the path
      };
      });

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
