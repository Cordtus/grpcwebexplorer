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
		expect(method.requestType).toBe("/cosmos.bank.v1beta1.Query/Balance");
		expect(method.requestTypeDefinition.fullName).toBe(
			"/cosmos.bank.v1beta1.Query/Balance",
		);
	});

	it("reads snake_case tx message type URLs", async () => {
		client = buildClient({
			tx: {
				msgs: [
					{ msg_type_url: "/cosmos.bank.v1beta1.MsgSend" },
					{ msg_type_url: "/cosmos.staking.v1beta1.MsgDelegate" },
				],
			},
		});

		const service = await client.getTxDescriptorViaV2Alpha1();

		expect(service?.methods.map((method) => method.requestType)).toEqual([
			"/cosmos.bank.v1beta1.MsgSend",
			"/cosmos.staking.v1beta1.MsgDelegate",
		]);
	});

	it("still accepts camelCase v2alpha1 fields", async () => {
		client = buildClient({
			tx: {
				msgs: [{ msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend" }],
			},
		});

		const service = await client.getTxDescriptorViaV2Alpha1();

		expect(service?.methods[0].requestType).toBe(
			"/cosmos.bank.v1beta1.MsgSend",
		);
	});
});
