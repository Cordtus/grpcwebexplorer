// app/api/grpc/test-compatibility/route.ts
// Comprehensive compatibility testing for gRPC networks

import { NextResponse } from 'next/server';
import { ReflectionClient } from '@/lib/grpc/reflection-client';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for comprehensive testing

interface TestResult {
  service: string;
  method: string;
  status: 'success' | 'error' | 'skip' | 'unimplemented' | 'requires_params' | 'internal_error';
  error?: string;
  executionTime?: number;
  details?: any;
}

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const { endpoint, tlsEnabled, serviceFilter } = await req.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Missing required parameter: endpoint' },
        { status: 400 }
      );
    }

    let endpointWithPort = endpoint;
    if (!endpoint.includes(':')) {
      endpointWithPort = tlsEnabled !== false ? `${endpoint}:443` : `${endpoint}:9090`;
    }

    console.log(`[TestCompatibility] Testing ${endpointWithPort} (TLS: ${tlsEnabled !== false})`);

    const client = new ReflectionClient({
      endpoint: endpointWithPort,
      tls: tlsEnabled !== false,
      timeout: 30000,
    });

    const results: TestResult[] = [];

    try {
      // Initialize to get all services
      await client.initialize();

      const services = client.getServices();
      let servicesToTest = services;

      // Filter services if requested
      if (serviceFilter) {
        servicesToTest = services.filter(s => s.fullName.includes(serviceFilter));
        console.log(`[TestCompatibility] Filtered to ${servicesToTest.length} services matching "${serviceFilter}"`);
      }

      for (const service of servicesToTest) {
        console.log(`[TestCompatibility] Testing ${service.fullName} (${service.methods.length} methods)`);

        for (const method of service.methods) {
          const methodStartTime = Date.now();

          try {
            // Determine if we should test this method
            // For now, test methods that commonly work without parameters
            const shouldTest =
              method.requestType.includes('Empty') ||
              method.name.includes('Parameters') ||
              method.name.includes('Params') ||
              method.name.includes('Info') ||
              method.name.includes('Version') ||
              method.name.includes('Status');

            if (!shouldTest) {
              results.push({
                service: service.fullName,
                method: method.name,
                status: 'skip',
                executionTime: 0,
              });
              continue;
            }

            // Try to invoke the method
            const result = await client.invokeMethod(service.fullName, method.name, {}, 15000);
            const executionTime = Date.now() - methodStartTime;

            console.log(`[TestCompatibility] ✅ ${service.fullName}.${method.name} (${executionTime}ms)`);

            results.push({
              service: service.fullName,
              method: method.name,
              status: 'success',
              executionTime,
            });

          } catch (err: any) {
            const executionTime = Date.now() - methodStartTime;
            const errorMsg = err.message || String(err);

            let status: TestResult['status'] = 'error';

            if (errorMsg.includes('UNIMPLEMENTED') || errorMsg.includes('not implemented')) {
              status = 'unimplemented';
              console.log(`[TestCompatibility] ⚠️  ${service.fullName}.${method.name} - Unimplemented`);
            } else if (errorMsg.includes('INVALID_ARGUMENT') || errorMsg.includes('missing') || errorMsg.includes('required')) {
              status = 'requires_params';
              console.log(`[TestCompatibility] ⏭️  ${service.fullName}.${method.name} - Requires params`);
            } else if (errorMsg.includes('INTERNAL')) {
              status = 'internal_error';
              console.error(`[TestCompatibility] ❌ ${service.fullName}.${method.name} - INTERNAL error`);
            } else {
              console.error(`[TestCompatibility] ❌ ${service.fullName}.${method.name} - ${errorMsg.substring(0, 100)}`);
            }

            results.push({
              service: service.fullName,
              method: method.name,
              status,
              error: errorMsg,
              executionTime,
            });
          }
        }
      }

    } finally {
      client.close();
    }

    const totalTime = Date.now() - startTime;

    // Calculate statistics
    const stats = {
      total: results.length,
      successful: results.filter(r => r.status === 'success').length,
      errors: results.filter(r => r.status === 'error').length,
      internalErrors: results.filter(r => r.status === 'internal_error').length,
      unimplemented: results.filter(r => r.status === 'unimplemented').length,
      requiresParams: results.filter(r => r.status === 'requires_params').length,
      skipped: results.filter(r => r.status === 'skip').length,
      totalTime,
    };

    // Group errors by type for easier debugging
    const errorGroups = new Map<string, TestResult[]>();
    const criticalErrors = results.filter(r => r.status === 'error' || r.status === 'internal_error');

    for (const result of criticalErrors) {
      let errorType = 'Unknown';

      if (result.error?.includes('no such Type or Enum')) {
        const match = result.error.match(/no such Type or Enum '([^']+)'/);
        errorType = match ? `Missing Type: ${match[1].split('.').slice(0, -1).join('.')}` : 'Missing Type';
      } else if (result.error?.includes('Exceeded maximum dependency depth')) {
        errorType = 'Dependency Depth Exceeded';
      } else if (result.error?.includes('Circular dependency')) {
        errorType = 'Circular Dependency';
      } else if (result.error?.includes('INTERNAL:')) {
        const match = result.error.match(/INTERNAL: (.+?)(?:\n|$)/);
        errorType = match ? `Server Error: ${match[1]}` : 'Server INTERNAL Error';
      } else if (result.error?.includes('Failed to decode')) {
        errorType = 'Decode Error';
      } else if (result.error?.includes('Failed to load')) {
        errorType = 'Type Loading Error';
      } else {
        const firstLine = result.error?.split('\n')[0].substring(0, 60);
        errorType = firstLine || 'Unknown Error';
      }

      if (!errorGroups.has(errorType)) {
        errorGroups.set(errorType, []);
      }
      errorGroups.get(errorType)!.push(result);
    }

    const groupedErrors: Record<string, string[]> = {};
    for (const [errorType, methods] of Array.from(errorGroups.entries())) {
      groupedErrors[errorType] = methods.map((m: TestResult) => `${m.service}.${m.method}`);
    }

    console.log(`[TestCompatibility] Completed in ${totalTime}ms - ${stats.successful}/${stats.total} successful`);

    return NextResponse.json({
      success: true,
      endpoint: endpointWithPort,
      tls: tlsEnabled !== false,
      stats,
      results,
      groupedErrors,
    });

  } catch (err: any) {
    const totalTime = Date.now() - startTime;

    console.error('[TestCompatibility] Fatal error:', err);

    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to test compatibility',
      totalTime,
      details: err.stack,
    }, { status: 500 });
  }
}
