// app/api/bsr/descriptor/route.ts
// Fetch and parse buf.build BSR module descriptors

import { NextResponse } from 'next/server';
import { DescriptorParser } from '@/lib/grpc/descriptor-parser';
import { errorMessage } from '@/lib/utils';

export const runtime = 'nodejs';

export async function POST(req: Request) {
	try {
		const { module, version, symbols, authToken } = await req.json();

		if (!module) {
			return NextResponse.json({ error: 'Module is required' }, { status: 400 });
		}

		// Normalize: strip buf.build prefix and protocol if present
		const normalized = module
			.replace(/^https?:\/\//, '')
			.replace(/^buf\.build\//, '');

		// Validate module format: "owner/repository"
		const parts = normalized.split('/');
		if (parts.length !== 2 || !parts[0] || !parts[1]) {
			return NextResponse.json(
				{ error: 'Invalid module format. Expected "owner/repository".' },
				{ status: 400 }
			);
		}

		const [owner, repo] = parts;
		const ref = version || 'main';

		// Fetch the FileDescriptorSet from BSR
		const url = `https://buf.build/${owner}/${repo}/descriptor/${ref}?imports=true`;
		console.log(`[BSR] Fetching descriptor: ${url}`);

		const headers: Record<string, string> = {
			'Accept': 'application/x-protobuf',
		};

		if (authToken) {
			headers['Authorization'] = `Bearer ${authToken}`;
		}

		const response = await fetch(url, { headers });

		if (!response.ok) {
			const statusText = response.statusText || 'Unknown error';
			console.error(`[BSR] Fetch failed: ${response.status} ${statusText}`);

			if (response.status === 404) {
				return NextResponse.json(
					{ error: `Module not found: ${module}@${ref}` },
					{ status: 404 }
				);
			}
			if (response.status === 401 || response.status === 403) {
				return NextResponse.json(
					{ error: 'Authentication required for this module. Provide a BSR auth token.' },
					{ status: 401 }
				);
			}

			return NextResponse.json(
				{ error: `BSR returned ${response.status}: ${statusText}` },
				{ status: 502 }
			);
		}

		const buffer = Buffer.from(await response.arrayBuffer());
		console.log(`[BSR] Got FileDescriptorSet: ${buffer.length} bytes`);

		// Parse the FileDescriptorSet using DescriptorParser
		const parser = new DescriptorParser();
		parser.loadFileDescriptorSet(buffer);

		const services = parser.getServices();
		console.log(`[BSR] Parsed ${services.length} services from ${module}@${ref}`);

		return NextResponse.json({
			services,
			module,
			version: ref,
			serviceCount: services.length,
		});
	} catch (err: unknown) {
		console.error('[BSR] Error:', err);
		return NextResponse.json(
			{ error: errorMessage(err) },
			{ status: 500 }
		);
	}
}
