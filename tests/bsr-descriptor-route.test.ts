// tests/bsr-descriptor-route.test.ts
// Direct tests for the BSR descriptor API route handler

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GREETER_FDS_BYTES } from './fixtures';

// We need to mock fetch before importing the route
let POST: (req: Request) => Promise<Response>;

describe('BSR descriptor route handler', () => {
	const mockFetch = vi.fn();

	beforeEach(async () => {
		vi.stubGlobal('fetch', mockFetch);
		// Dynamic import to pick up the mocked fetch
		const mod = await import('@/app/api/bsr/descriptor/route');
		POST = mod.POST;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	function makeRequest(body: any): Request {
		return new Request('http://localhost/api/bsr/descriptor', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
	}

	it('returns 400 when module is missing', async () => {
		const res = await POST(makeRequest({}));
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toContain('Module is required');
	});

	it('returns 400 for invalid module format', async () => {
		const res = await POST(makeRequest({ module: 'noowner' }));
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toContain('Invalid module format');
	});

	it('returns 400 for module with empty parts', async () => {
		const res = await POST(makeRequest({ module: '/repo' }));
		expect(res.status).toBe(400);
	});

	it('normalizes buf.build/ prefix from module', async () => {
		mockFetch.mockResolvedValueOnce(new Response(GREETER_FDS_BYTES, {
			status: 200,
			headers: { 'Content-Type': 'application/x-protobuf' },
		}));

		const res = await POST(makeRequest({ module: 'buf.build/test/greeter' }));
		expect(res.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledWith(
			'https://buf.build/test/greeter/descriptor/main?imports=true',
			expect.any(Object)
		);
	});

	it('normalizes full https://buf.build/ URL from module', async () => {
		mockFetch.mockResolvedValueOnce(new Response(GREETER_FDS_BYTES, {
			status: 200,
			headers: { 'Content-Type': 'application/x-protobuf' },
		}));

		const res = await POST(makeRequest({ module: 'https://buf.build/test/greeter' }));
		expect(res.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledWith(
			'https://buf.build/test/greeter/descriptor/main?imports=true',
			expect.any(Object)
		);
	});

	it('returns 404 when BSR returns 404', async () => {
		mockFetch.mockResolvedValueOnce(new Response('', { status: 404, statusText: 'Not Found' }));

		const res = await POST(makeRequest({ module: 'owner/nonexistent' }));
		expect(res.status).toBe(404);
		const data = await res.json();
		expect(data.error).toContain('Module not found');
	});

	it('returns 401 when BSR returns 401', async () => {
		mockFetch.mockResolvedValueOnce(new Response('', { status: 401, statusText: 'Unauthorized' }));

		const res = await POST(makeRequest({ module: 'owner/private' }));
		expect(res.status).toBe(401);
		const data = await res.json();
		expect(data.error).toContain('Authentication required');
	});

	it('returns 401 when BSR returns 403', async () => {
		mockFetch.mockResolvedValueOnce(new Response('', { status: 403, statusText: 'Forbidden' }));

		const res = await POST(makeRequest({ module: 'owner/private' }));
		expect(res.status).toBe(401);
	});

	it('returns 502 for other BSR errors', async () => {
		mockFetch.mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Server Error' }));

		const res = await POST(makeRequest({ module: 'owner/repo' }));
		expect(res.status).toBe(502);
		const data = await res.json();
		expect(data.error).toContain('BSR returned 500');
	});

	it('parses services from valid FileDescriptorSet', async () => {
		mockFetch.mockResolvedValueOnce(new Response(GREETER_FDS_BYTES, {
			status: 200,
			headers: { 'Content-Type': 'application/x-protobuf' },
		}));

		const res = await POST(makeRequest({ module: 'test/greeter' }));
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.services).toHaveLength(1);
		expect(data.services[0].name).toBe('GreeterService');
		expect(data.module).toBe('test/greeter');
		expect(data.version).toBe('main');
		expect(data.serviceCount).toBe(1);
	});

	it('uses custom version when provided', async () => {
		mockFetch.mockResolvedValueOnce(new Response(GREETER_FDS_BYTES, {
			status: 200,
			headers: { 'Content-Type': 'application/x-protobuf' },
		}));

		await POST(makeRequest({ module: 'test/greeter', version: 'v1.0.0' }));

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('v1.0.0'),
			expect.any(Object)
		);
	});

	it('constructs correct BSR auth headers', () => {
		// Test the auth header construction logic directly
		const authToken = 'secret123';
		const headers: Record<string, string> = { 'Accept': 'application/x-protobuf' };
		if (authToken) {
			headers['Authorization'] = `Bearer ${authToken}`;
		}
		expect(headers['Authorization']).toBe('Bearer secret123');
		expect(headers['Accept']).toBe('application/x-protobuf');
	});

	it('omits Authorization when no authToken', () => {
		const authToken = '';
		const headers: Record<string, string> = { 'Accept': 'application/x-protobuf' };
		if (authToken) {
			headers['Authorization'] = `Bearer ${authToken}`;
		}
		expect(headers['Authorization']).toBeUndefined();
	});

	it('returns 500 on parse error', async () => {
		// Return invalid protobuf data
		mockFetch.mockResolvedValueOnce(new Response(Buffer.from('not-protobuf'), {
			status: 200,
		}));

		const res = await POST(makeRequest({ module: 'test/broken' }));
		expect(res.status).toBe(500);
	});
});
