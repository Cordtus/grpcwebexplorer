export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { execCommand } from '@/utils/process';
import { getCache, setCache } from '@/lib/grpc/cache';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { endpoint, tlsEnabled, forceRefresh } = body;
    
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }
    
    // Parse endpoint to ensure it has a port
    let endpointWithPort = endpoint;
    if (!endpoint.includes(':')) {
      // Default to 443 for TLS, 9090 for plaintext
      endpointWithPort = tlsEnabled !== false ? `${endpoint}:443` : `${endpoint}:9090`;
    }
    
    // First, fetch the chain_id using GetLatestBlock
    const tlsFlag = tlsEnabled === false ? '-plaintext ' : '';
    let chainId = '';
    
    try {
      const getLatestBlockCommand = `grpcurl ${tlsFlag}${endpointWithPort} cosmos.base.tendermint.v1beta1.Service.GetLatestBlock 2>/dev/null`;
      const { stdout: blockOutput } = await execCommand(getLatestBlockCommand);
      
      // Parse the response to extract chain_id
      const blockData = JSON.parse(blockOutput);
      if (blockData?.sdkBlock?.header?.chainId || blockData?.block?.header?.chainId) {
        chainId = blockData?.sdkBlock?.header?.chainId || blockData?.block?.header?.chainId;
        console.log(`Detected chain_id: ${chainId} for endpoint ${endpointWithPort}`);
      }
    } catch (err) {
      console.warn(`Could not fetch chain_id for ${endpointWithPort}, using endpoint as cache key`);
    }
    
    // Create cache key based on chain_id if available, otherwise use endpoint
    const cacheKey = chainId ? `services:chain:${chainId}` : `services:${endpointWithPort}:${tlsEnabled !== false}`;
    
    // Check cache first unless force refresh is requested
    if (!forceRefresh) {
      const cached = await getCache<any[]>(cacheKey);
      if (cached) {
        // Check if cache is less than 1 hour old
        const cacheAge = Date.now() - cached.timestamp;
        if (cacheAge < 60 * 60 * 1000) {
          console.log(`Returning cached services for ${chainId || endpointWithPort}`);
          return NextResponse.json({ services: cached.data, cached: true, chainId });
        }
      }
    }
    
    // Use grpcurl to list services
    const listCommand = `grpcurl ${tlsFlag}${endpointWithPort} list 2>/dev/null`;
    
    try {
      const { stdout } = await execCommand(listCommand);
      const serviceNames = stdout.trim().split('\n').filter(Boolean);
      
      // Now fetch methods for each service
      const services = await Promise.all(
        serviceNames.map(async (serviceName) => {
          try {
            const describeCommand = `grpcurl ${tlsFlag}${endpointWithPort} describe ${serviceName} 2>/dev/null`;
            const { stdout: describeOutput } = await execCommand(describeCommand);
            
            // Parse the describe output to extract methods
            const methods = [];
            const lines = describeOutput.split('\n');
            
            // Look for rpc method definitions
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line.startsWith('rpc ')) {
                // Parse method signature like: rpc Balance ( .cosmos.bank.v1beta1.QueryBalanceRequest ) returns ( .cosmos.bank.v1beta1.QueryBalanceResponse );
                const match = line.match(/rpc\s+(\w+)\s*\(\s*([^)]+)\s*\)\s+returns\s+\(\s*([^)]+)\s*\)/);
                if (match) {
                  const [, methodName, requestType, responseType] = match;
                  methods.push({
                    name: methodName,
                    fullName: `${serviceName}.${methodName}`,
                    requestType: requestType.trim().replace(/^\./, ''),
                    responseType: responseType.trim().replace(/^\./, ''),
                    requestStreaming: false,
                    responseStreaming: false,
                    description: ''
                  });
                }
              }
            }
            
            // Extract service name parts for display
            const parts = serviceName.split('.');
            const shortName = parts[parts.length - 1];
            
            return {
              name: shortName,
              fullName: serviceName,
              methods
            };
          } catch (err) {
            console.error(`Error describing service ${serviceName}:`, err);
            return {
              name: serviceName.split('.').pop() || serviceName,
              fullName: serviceName,
              methods: []
            };
          }
        })
      );
      
      // Filter out services with no methods
      const servicesWithMethods = services.filter(s => s.methods.length > 0);
      
      // Cache the results
      await setCache({
        key: cacheKey,
        data: servicesWithMethods,
        timestamp: Date.now()
      });
      
      return NextResponse.json({ services: servicesWithMethods, cached: false, chainId });
    } catch (err: any) {
      console.error('Error listing services with grpcurl:', err);
      
      // If grpcurl fails, return a helpful error message
      if (err.message.includes('command not found')) {
        return NextResponse.json({ 
          error: 'grpcurl is not installed. Please install it to use this feature.' 
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: `Failed to connect to gRPC endpoint: ${err.message}` 
      }, { status: 500 });
    }
  } catch (err: any) {
    console.error('Error in /api/grpc/services:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
