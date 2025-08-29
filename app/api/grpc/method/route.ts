export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { endpoint, service, method } = await req.json();
    
    if (!endpoint || !service || !method) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    // Mock field data for demonstration
    const mockFields: Record<string, any[]> = {
      'Balance': [
        { name: 'address', type: 'string', description: 'The address to query balance for' },
        { name: 'denom', type: 'string', description: 'The denomination of the token' }
      ],
      'AllBalances': [
        { name: 'address', type: 'string', description: 'The address to query all balances for' },
        { name: 'pagination', type: 'object', description: 'Pagination parameters (optional)' }
      ],
      'Validators': [
        { name: 'status', type: 'string', description: 'The validator status to filter by' },
        { name: 'pagination', type: 'object', description: 'Pagination parameters (optional)' }
      ],
      'GetTx': [
        { name: 'hash', type: 'string', description: 'The transaction hash to query' }
      ],
      'BroadcastTx': [
        { name: 'tx_bytes', type: 'bytes', description: 'The encoded transaction' },
        { name: 'mode', type: 'string', description: 'The broadcast mode (SYNC, ASYNC, BLOCK)' }
      ]
    };
    
    const fields = mockFields[method] || [
      { name: 'request', type: 'object', description: 'Request parameters' }
    ];
    
    return NextResponse.json({ fields });
  } catch (err: any) {
    console.error('Error in /api/grpc/method:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
