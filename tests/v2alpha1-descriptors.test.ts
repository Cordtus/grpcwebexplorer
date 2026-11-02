// tests/v2alpha1-descriptors.test.ts
// v2alpha1 reflection responses use descriptor field names (snake_case).

import { afterEach, describe, expect, it, vi } from "vitest";
import { ReflectionClient } from "@/lib/grpc/reflection-client";

function buildClient(response: unknown) {
	const client = new ReflectionClient({ endpoint: "127.0.0.1:1", tls: false });
	(client as any).initializeForMethod = vi.fn().mockResolvedValue(undefined);
	(client as any).invokeMethod = vi.fn().mockResolvedValue(response);
	return client;
}

describe("v2alpha1 descriptor parsing", () => {
	let client: ReflectionClient | undefined;

	afterEach(() => {
		client?.close();
		client = undefined;
	});

	it("reads snake_case query service fields", async () => {
		client = buildClient({
			queries: {
				query_services: [
					{
						fullname: "cosmos.bank.v1beta1.Query",
						methods: [
							{
								name: "Balance",
								full_query_path: "/cosmos.bank.v1beta1.Query/Balance",
							},
						],
					},
				],
			},
		});

		const services = await client.getQueryServicesViaV2Alpha1();
		const method = services[0].methods[0];

		expect(services[0].fullName).toBe("cosmos.bank.v1beta1.Query");
		expect(method.name).toBe("Balance");
		// v2alpha1 has no message type name; use the conventional placeholder
		// until the full descriptor is loaded on demand.
		expect(method.requestType).toBe("cosmos.bank.v1beta1.Query.BalanceRequest");
		expect(method.requestTypeDefinition.fullName).toBe(
			"cosmos.bank.v1beta1.Query.BalanceRequest",
		);
	});
});
