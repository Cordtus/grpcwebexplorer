export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { runGrpcurl } from '@/utils/grpcurl';

export async function POST(req: Request) {
  try {
    const { endpoint, service, method, params, tlsEnabled } = await req.json();
    
    if (!endpoint || !service || !method) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    // Parse endpoint to ensure it has a port
    let endpointWithPort = endpoint;
    if (!endpoint.includes(':')) {
      // Default to 443 for TLS, 9090 for plaintext
      endpointWithPort = tlsEnabled !== false ? `${endpoint}:443` : `${endpoint}:9090`;
    }
    
    // Construct the full method name
    const fullMethodName = `${service}/${method}`;
    
    // Prepare the JSON input for grpcurl
    const jsonInput = JSON.stringify(params || {});
    
    // Use grpcurl to execute the method
    try {
      const { stdout } = await runGrpcurl({
        endpoint: endpointWithPort,
        tls: tlsEnabled === true,
        args: fullMethodName,
        stdin: jsonInput,
      });
      
      // Try to parse the response as JSON
      try {
        const result = JSON.parse(stdout);
        return NextResponse.json({ 
          success: true,
          result 
        });
      } catch (parseErr) {
        // If not JSON, return the raw output
        return NextResponse.json({ 
          success: true,
          result: stdout 
        });
      }
    } catch (err: any) {
      console.error('Error executing gRPC method:', err);
      
      // Parse error message for better user feedback
      const errorMessage = err.message || err.toString();
      
      if (errorMessage.includes('unknown service')) {
        return NextResponse.json({ 
          success: false,
          error: `Unknown service: ${service}` 
        }, { status: 404 });
      }
      
      if (errorMessage.includes('unknown method')) {
        return NextResponse.json({ 
          success: false,
          error: `Unknown method: ${method} in service ${service}` 
        }, { status: 404 });
      }
      
      if (errorMessage.includes('connection refused')) {
        return NextResponse.json({ 
          success: false,
          error: `Failed to connect to ${endpointWithPort}. Please check the endpoint is correct and accessible.` 
        }, { status: 503 });
      }
      
      return NextResponse.json({ 
        success: false,
        error: errorMessage 
      }, { status: 500 });
    }
  } catch (err: any) {
    console.error('Error in /api/grpc/execute:', err);
    return NextResponse.json({ 
      success: false,
      error: err.message || 'Internal server error' 
    }, { status: 500 });
  }
}
