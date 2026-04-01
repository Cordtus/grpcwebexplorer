// app/api/bsr/modules/route.ts
// List and browse BSR modules by organization + curated popular list

import { NextResponse } from 'next/server';
import { errorMessage } from '@/lib/utils';

export const runtime = 'nodejs';

interface BsrModule {
	name: string;
	owner: string;
	description: string;
	visibility: string;
}

/** Curated list of well-known public BSR modules */
const POPULAR_MODULES: BsrModule[] = [
	{ name: 'googleapis', owner: 'googleapis', description: 'Google APIs protobuf definitions', visibility: 'public' },
	{ name: 'eliza', owner: 'connectrpc', description: 'Example Connect service (Eliza chatbot)', visibility: 'public' },
	{ name: 'grpc-health', owner: 'grpc', description: 'gRPC Health Checking Protocol', visibility: 'public' },
	{ name: 'grpc-reflection', owner: 'grpc', description: 'gRPC Server Reflection Protocol', visibility: 'public' },
	{ name: 'cosmos-sdk', owner: 'cosmos', description: 'Cosmos SDK protobuf definitions', visibility: 'public' },
	{ name: 'buf', owner: 'bufbuild', description: 'Buf CLI and BSR APIs', visibility: 'public' },
	{ name: 'protovalidate', owner: 'bufbuild', description: 'Protobuf field validation', visibility: 'public' },
	{ name: 'wellknowntypes', owner: 'bufbuild', description: 'Protocol Buffers well-known types', visibility: 'public' },
];

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const owner = searchParams.get('owner');
	const popular = searchParams.get('popular');

	// Return curated popular modules
	if (popular === 'true') {
		return NextResponse.json({ modules: POPULAR_MODULES });
	}

	// List modules for an organization
	if (owner) {
		try {
			console.log(`[BSR] Listing modules for owner: ${owner}`);

			// Use BSR's Connect-protocol API (JSON POST)
			const response = await fetch('https://buf.build/buf.registry.module.v1.ModuleService/ListModules', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					ownerRefs: [{ owner }],
					pageSize: 50,
				}),
			});

			if (!response.ok) {
				// Fall back to an empty list on error (org may not exist or API may differ)
				console.warn(`[BSR] ListModules failed: ${response.status}`);
				return NextResponse.json({ modules: [] });
			}

			const data = await response.json();
			const modules: BsrModule[] = (data.modules || []).map((m: any) => ({
				name: m.name || '',
				owner: m.ownerName || owner,
				description: m.description || '',
				visibility: m.visibility === 1 ? 'public' : 'private',
			}));

			console.log(`[BSR] Found ${modules.length} modules for ${owner}`);
			return NextResponse.json({ modules });
		} catch (err: unknown) {
			console.error(`[BSR] Error listing modules for ${owner}:`, err);
			return NextResponse.json({ modules: [] });
		}
	}

	return NextResponse.json(
		{ error: 'Provide ?owner={org} or ?popular=true' },
		{ status: 400 }
	);
}
