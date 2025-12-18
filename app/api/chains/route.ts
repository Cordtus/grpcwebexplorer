import { NextResponse } from 'next/server';
import { fetchChainList, fetchChainData } from '@/lib/services/chainRegistry';

export const runtime = 'nodejs';

// Allow Next.js to cache this route (uses fetch cache internally)
// Revalidate every hour
export const revalidate = 3600;

/**
 * GET /api/chains - Fetch list of chains from registry
 * GET /api/chains?name=<chain-name> - Fetch specific chain data
 *
 * Chain list is cached at CDN level for 1 hour to avoid GitHub API rate limits
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chainName = searchParams.get('name');

    if (chainName) {
      // Fetch specific chain data (uses raw.githubusercontent.com, less rate limited)
      const chainData = await fetchChainData(chainName);

      if (!chainData) {
        return NextResponse.json(
          { error: `Chain '${chainName}' not found` },
          { status: 404 }
        );
      }

      // Cache individual chain data for 1 hour
      return NextResponse.json(chainData, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    } else {
      // Fetch list of all chains
      const chains = await fetchChainList();

      // Cache chain list for 1 hour, allow stale for 24 hours while revalidating
      return NextResponse.json({ chains }, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    }
  } catch (error: any) {
    console.error('Error in /api/chains:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chain data' },
      { status: 500 }
    );
  }
}
