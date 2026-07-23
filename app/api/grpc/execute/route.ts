// app/api/grpc/execute/route.ts
// gRPC method execution via reflection service

import { NextResponse } from 'next/server';
import { ReflectionClient } from '@/lib/grpc/reflection-client';
import { errorMessage } from '@/lib/utils';
import { normalizeRequestTimeoutMs } from '@/lib/utils/client-cache';
import { EndpointFailoverError, executeWithEndpointFailover, type ExecutionEndpoint } from '@/lib/utils/execution-endpoints';
import { endpointManager } from '@/lib/utils/endpoint-manager';

export const runtime = 'nodejs';
export const maxDuration = 90; // 90 seconds to allow for 60s method timeout + overhead

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const { endpoint, endpointAttempts, service, method, params, tlsEnabled, metadata, authConfig, timeoutMs } = await req.json();
    const requestTimeoutMs = normalizeRequestTimeoutMs(timeoutMs, 60000);

    if (!endpoint || !service || !method) {
      return NextResponse.json(
        { error: 'Missing required parameters: endpoint, service, method' },
        { status: 400 }
      );
    }

    // Check if endpoint is a chain marker (should have been resolved by now)
    if (endpoint.startsWith('chain:')) {
      return NextResponse.json(
        {
          error: 'Invalid endpoint format',
          details: 'Chain marker was not resolved to actual endpoint. This is a bug - please refresh the network.'
        },
        { status: 400 }
      );
    }

    const configuredAttempts: ExecutionEndpoint[] = Array.isArray(endpointAttempts)
      ? endpointAttempts
        .filter((attempt): attempt is ExecutionEndpoint =>
          typeof attempt?.address === 'string' && typeof attempt?.tlsEnabled === 'boolean'
        )
        .slice(0, 3)
      : [];
    const attempts = configuredAttempts.length > 0
      ? configuredAttempts
      : [{ address: endpoint, tlsEnabled: tlsEnabled !== false }];

    // Build enriched metadata from auth config
    const enrichedMetadata: Record<string, string> = { ...(metadata || {}) };
    let clientCert: string | undefined;
    let clientKey: string | undefined;

    if (authConfig) {
      if (authConfig.type === 'bearer' && authConfig.bearerToken) {
        enrichedMetadata['authorization'] = `Bearer ${authConfig.bearerToken}`;
      } else if (authConfig.type === 'api-key' && authConfig.apiKeyHeader && authConfig.apiKeyValue) {
        enrichedMetadata[authConfig.apiKeyHeader] = authConfig.apiKeyValue;
      } else if (authConfig.type === 'mtls') {
        clientCert = authConfig.clientCert;
        clientKey = authConfig.clientKey;
      }
    }

    const execution = await executeWithEndpointFailover(attempts, async (attempt) => {
      let endpointWithPort = attempt.address;
      if (!endpointWithPort.includes(':')) {
        endpointWithPort = attempt.tlsEnabled ? `${endpointWithPort}:443` : `${endpointWithPort}:9090`;
      }

      console.log(`[Execute] Invoking ${service}.${method} on ${endpointWithPort} (TLS: ${attempt.tlsEnabled})`);
      const invoke = async (usedTls: boolean) => {
        const client = new ReflectionClient({
          endpoint: endpointWithPort,
          tls: usedTls,
          timeout: requestTimeoutMs,
          clientCert,
          clientKey,
        });

        try {
          await client.initializeForMethod(service);
          return await client.invokeMethod(service, method, params || {}, requestTimeoutMs, enrichedMetadata);
        } finally {
          client.close();
        }
      };

      try {
        const result = await invoke(attempt.tlsEnabled);
        endpointManager.recordSuccess(endpointWithPort, Date.now() - startTime);
        return { result, endpoint: endpointWithPort, usedTls: attempt.tlsEnabled };
      } catch (err: unknown) {
        const msg = errorMessage(err);
        const isTLSError = msg.includes('wrong version number') ||
                          msg.includes('SSL routines') ||
                          msg.includes('EPROTO');

        if (attempt.tlsEnabled && isTLSError) {
          console.log(`[Execute] TLS error detected, retrying ${endpointWithPort} without TLS...`);
          try {
            const result = await invoke(false);
            endpointManager.recordSuccess(endpointWithPort, Date.now() - startTime);
            return { result, endpoint: endpointWithPort, usedTls: false };
          } catch (retryErr: unknown) {
            const retryMessage = errorMessage(retryErr);
            endpointManager.recordFailure(endpointWithPort, retryMessage.includes('timeout') || retryMessage.includes('ETIMEDOUT'));
            throw retryErr;
          }
        }

        endpointManager.recordFailure(endpointWithPort, msg.includes('timeout') || msg.includes('ETIMEDOUT'));
        throw err;
      }
    });

    const executionTime = Date.now() - startTime;
    console.log(`[Execute] ${service}.${method} completed in ${executionTime}ms`);

    return NextResponse.json({
      success: true,
      result: execution.value.result,
      executionTime,
      service,
      method,
      endpoint: execution.value.endpoint,
      tls: execution.value.usedTls,
      failedEndpoints: execution.failures,
    });

  } catch (err: unknown) {
    const executionTime = Date.now() - startTime;

    console.error('[Execute] Error:', err);

    const failedEndpoints = err instanceof EndpointFailoverError ? err.failures : undefined;
    return NextResponse.json({
      success: false,
      error: errorMessage(err),
      executionTime,
      details: err instanceof Error ? err.stack : undefined,
      failedEndpoints,
    }, { status: failedEndpoints ? 502 : 500 });
  }
}
