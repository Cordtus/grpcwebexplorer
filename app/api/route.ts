// app/api/route.ts
import { NextResponse } from 'next/server';
import { listEndpoints } from 'lib/grpc/client';

export async function GET() {
  const endpoints = listEndpoints();
  return NextResponse.json({ endpoints });
}
