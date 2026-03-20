// tests/bsr-modules-route.test.ts
// Direct tests for the BSR modules API route handler

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let GET: (req: Request) => Promise<Response>;

describe('BSR modules route handler', () => {
	const mockFetch = vi.fn();

	beforeEach(async () => {
		vi.stubGlobal('fetch', mockFetch);
		const mod = await import('@/app/api/bsr/modules/route');
		GET = mod.GET;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it('returns popular modules when ?popular=true', async () => {
		const req = new Request('http://localhost/api/bsr/modules?popular=true');
		const res = await GET(req);
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.modules).toBeDefined();
		expect(Array.isArray(data.modules)).toBe(true);
		expect(data.modules.length).toBeGreaterThan(0);

		// Check structure
		const first = data.modules[0];
		expect(first).toHaveProperty('name');
		expect(first).toHaveProperty('owner');
		expect(first).toHaveProperty('description');
		expect(first).toHaveProperty('visibility');
	});

	it('popular modules include well-known entries', async () => {
		const req = new Request('http://localhost/api/bsr/modules?popular=true');
		const res = await GET(req);
		const data = await res.json();

		const names = data.modules.map((m: any) => `${m.owner}/${m.name}`);
		expect(names).toContain('connectrpc/eliza');
		expect(names).toContain('cosmos/cosmos-sdk');
	});

	it('lists modules for an organization', async () => {
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
			modules: [
				{ name: 'eliza', ownerName: 'connectrpc', description: 'Eliza chatbot', visibility: 1 },
				{ name: 'grpc-go', ownerName: 'connectrpc', description: 'gRPC Go', visibility: 1 },
			],
		}), { status: 200 }));

		const req = new Request('http://localhost/api/bsr/modules?owner=connectrpc');
		const res = await GET(req);
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.modules).toHaveLength(2);
		expect(data.modules[0].name).toBe('eliza');
		expect(data.modules[0].visibility).toBe('public');
	});

	it('returns empty array when BSR API fails', async () => {
		mockFetch.mockResolvedValueOnce(new Response('', { status: 500 }));

		const req = new Request('http://localhost/api/bsr/modules?owner=nonexistent');
		const res = await GET(req);
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.modules).toEqual([]);
	});

	it('returns empty array on fetch error', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Network error'));

		const req = new Request('http://localhost/api/bsr/modules?owner=bad');
		const res = await GET(req);
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.modules).toEqual([]);
	});

	it('returns 400 when no params provided', async () => {
		const req = new Request('http://localhost/api/bsr/modules');
		const res = await GET(req);
		expect(res.status).toBe(400);

		const data = await res.json();
		expect(data.error).toContain('owner');
	});

	it('maps visibility correctly', async () => {
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
			modules: [
				{ name: 'pub', ownerName: 'org', visibility: 1 },
				{ name: 'priv', ownerName: 'org', visibility: 2 },
			],
		}), { status: 200 }));

		const req = new Request('http://localhost/api/bsr/modules?owner=org');
		const res = await GET(req);
		const data = await res.json();

		expect(data.modules[0].visibility).toBe('public');
		expect(data.modules[1].visibility).toBe('private');
	});
});
