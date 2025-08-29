export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { callUnary } from 'lib/grpc/client';

export async function POST(
  req: Request,
  { params }: { params: { endpoint: string; service: string; method: string } }
) {
  const payload = await req.json();
  try {
    const response = await callUnary(
      params.endpoint,
      params.service,
      params.method,
      payload
    );
    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
