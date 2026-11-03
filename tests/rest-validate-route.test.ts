// tests/rest-validate-route.test.ts
// Direct tests for the chain-registry REST endpoint validator.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let POST: (req: Request) => Promise<Response>;

describe("REST endpoint validation route", () => {
	const mockFetch = vi.fn();

	beforeEach(async () => {
		vi.stubGlobal("fetch", mockFetch);
		const mod = await import("@/app/api/rest/validate/route");
		POST = mod.POST;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
		mockFetch.mockReset();
	});

	function makeRequest(body: Record<string, unknown>): Request {
		return new Request("http://localhost/api/rest/validate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	}

	it("prefers non-Lavender providers among verified REST endpoints", async () => {
		mockFetch.mockImplementation((input: string | URL) => {
			const url = String(input);
			if (url.endsWith("/chain.json")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							apis: {
								rest: [
									{ address: "https://rest.lavenderfive.com/cosmos" },
									{ address: "https://rest.example.com" },
								],
							},
						}),
						{ status: 200 },
					),
				);
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});

		const response = await POST(makeRequest({ chainName: "cosmoshub" }));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			endpoints: ["https://rest.example.com"],
		});
	});

	it("keeps Lavender when it is the only working provider", async () => {
		mockFetch.mockImplementation((input: string | URL) => {
			const url = String(input);
			if (url.endsWith("/chain.json")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							apis: {
								rest: [{ address: "https://rest.lavenderfive.com/cosmos" }],
							},
						}),
						{ status: 200 },
					),
				);
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});

		const response = await POST(makeRequest({ chainName: "cosmoshub" }));
		expect(await response.json()).toEqual({
			endpoints: ["https://rest.lavenderfive.com/cosmos"],
		});
	});

	it("rejects invalid chain names", async () => {
		const response = await POST(makeRequest({ chainName: "../etc/passwd" }));
		expect(response.status).toBe(400);
	});
});
