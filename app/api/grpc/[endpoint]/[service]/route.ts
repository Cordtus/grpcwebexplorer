export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { listMethods } from 'lib/grpc/client';

export async function GET(
  _req: Request,
  { params }: { params: { endpoint: string; service: string } }
) {
  try {
    const methods = await listMethods(params.endpoint, params.service);
    return NextResponse.json({ methods });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
