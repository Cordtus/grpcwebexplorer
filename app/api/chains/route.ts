export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { fetchChainList, fetchChainData } from '@/lib/services/chainRegistry';

/**
 * GET /api/chains - Fetch list of chains from registry
 * GET /api/chains?name=<chain-name> - Fetch specific chain data
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chainName = searchParams.get('name');

    if (chainName) {
      // Fetch specific chain data
      const chainData = await fetchChainData(chainName);

      if (!chainData) {
        return NextResponse.json(
          { error: `Chain '${chainName}' not found` },
          { status: 404 }
        );
      }

      return NextResponse.json(chainData);
    } else {
      // Fetch list of all chains
      const chains = await fetchChainList();
      return NextResponse.json({ chains });
    }
  } catch (error: any) {
    console.error('Error in /api/chains:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chain data' },
      { status: 500 }
    );
  }
}
