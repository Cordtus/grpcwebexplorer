import { NextRequest, NextResponse } from 'next/server';
import { loadServiceDescriptor } from '@/lib/grpc/reflection-utils';

export async function POST(request: NextRequest) {
  try {
    const { endpoint, tlsEnabled, serviceName } = await request.json();

    if (!endpoint || typeof tlsEnabled !== 'boolean' || !serviceName) {
      return NextResponse.json(
        { error: 'Missing required fields: endpoint, tlsEnabled, serviceName' },
        { status: 400 }
      );
    }

    console.log(`[API] Loading descriptor for ${serviceName} from ${endpoint}`);

    const service = await loadServiceDescriptor(
      { endpoint, tls: tlsEnabled, timeout: 10000 },
      serviceName
    );

    if (!service) {
      return NextResponse.json(
        { error: `Service ${serviceName} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ service });
  } catch (error) {
    console.error('[API] Descriptor loading error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
