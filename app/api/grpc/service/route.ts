export const runtime = 'nodejs';
// app/api/grpc/service/route.ts
import { NextResponse } from 'next/server';
import { listServices } from 'lib/grpc/client';

export async function POST(req: Request) {
  const { endpoint } = await req.json();
  try {
    const services = await listServices(endpoint);
    return NextResponse.json({ services });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
