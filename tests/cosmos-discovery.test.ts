// tests/cosmos-discovery.test.ts
// v2alpha1 discovery must not re-enumerate the chain, but must not drop
// standard-only services either.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GrpcService } from "@/lib/types/grpc";

const fake = vi.hoisted(() => ({
	queryServices: [] as GrpcService[],
	serviceNames: [] as string[],
	loaded: new Map<string, GrpcService>(),
	initialize: vi.fn(),
	initializeForMethod: vi.fn(),
	listServiceNames: vi.fn(),
	getServices: vi.fn(),
	close: vi.fn(),
}));

vi.mock("@/lib/grpc/reflection-client", () => ({
	ReflectionClient: class {
		getQueryServicesViaV2Alpha1() {
			return Promise.resolve(fake.queryServices);
		}
		listServiceNames = fake.listServiceNames;
		initializeForMethod = fake.initializeForMethod;
		getServices = fake.getServices;
		initialize = fake.initialize;
		close = fake.close;
	},
}));

import { fetchServicesWithCosmosOptimization } from "@/lib/grpc/reflection-utils";

function service(fullName: string): GrpcService {
	const name = fullName.split(".").pop() || fullName;
	return {
		name,
		fullName,
		methods: [
			{
				name: "Do",
				fullName: `${fullName}.Do`,
				serviceName: fullName,
				requestType: `${fullName}.DoRequest`,
				responseType: `${fullName}.DoResponse`,
				requestStreaming: false,
				responseStreaming: false,
				requestTypeDefinition: {
					name: "DoRequest",
					fullName: `${fullName}.DoRequest`,
					fields: [],
				},
				responseTypeDefinition: {
					name: "DoResponse",
					fullName: `${fullName}.DoResponse`,
					fields: [],
				},
			},
		],
	};
}

describe("Cosmos service discovery", () => {
	beforeEach(() => {
		fake.queryServices = [];
		fake.serviceNames = [];
		fake.loaded.clear();
		vi.clearAllMocks();
		fake.listServiceNames.mockResolvedValue([]);
		fake.initializeForMethod.mockImplementation(async (name: string) => {
			fake.loaded.set(name, service(name));
		});
		fake.getServices.mockImplementation(() => [...fake.loaded.values()]);
	});

	it("keeps v2alpha1 query services pending without a full initialize", async () => {
		fake.queryServices = [service("cosmos.bank.v1beta1.Query")];
		fake.serviceNames = [
			"cosmos.bank.v1beta1.Query",
			"cosmos.tx.v1beta1.Service",
			"grpc.reflection.v1.ServerReflection",
		];
		fake.listServiceNames.mockResolvedValue(fake.serviceNames);

		const services = await fetchServicesWithCosmosOptimization({
			endpoint: "grpc.example.com:443",
			tls: true,
		});

		expect(fake.initialize).not.toHaveBeenCalled();
		expect(fake.initializeForMethod).toHaveBeenCalledWith(
			"cosmos.tx.v1beta1.Service",
		);
		expect(fake.initializeForMethod).not.toHaveBeenCalledWith(
			"cosmos.bank.v1beta1.Query",
		);

		const query = services.find(
			(entry) => entry.fullName === "cosmos.bank.v1beta1.Query",
		);
		const tx = services.find(
			(entry) => entry.fullName === "cosmos.tx.v1beta1.Service",
		);
		expect(query?.descriptorStatus).toBe("pending");
		expect(tx?.descriptorStatus).toBe("loaded");
		expect(
			services.some((entry) => entry.fullName.includes("ServerReflection")),
		).toBe(false);
	});

	it("falls back to standard reflection when v2alpha1 returns no query services", async () => {
		fake.queryServices = [];
		fake.initialize.mockResolvedValue(undefined);
		fake.getServices.mockReturnValue([service("cosmos.bank.v1beta1.Query")]);

		const services = await fetchServicesWithCosmosOptimization({
			endpoint: "grpc.example.com:443",
			tls: true,
		});

		expect(fake.initialize).toHaveBeenCalledTimes(1);
		expect(services).toHaveLength(1);
		expect(services[0].descriptorStatus).toBe("loaded");
	});

	it("still returns v2alpha1 results when the name listing fails", async () => {
		fake.queryServices = [service("cosmos.bank.v1beta1.Query")];
		fake.listServiceNames.mockRejectedValue(new Error("reflection timeout"));

		const services = await fetchServicesWithCosmosOptimization({
			endpoint: "grpc.example.com:443",
			tls: true,
		});

		expect(fake.initialize).not.toHaveBeenCalled();
		expect(fake.initializeForMethod).not.toHaveBeenCalled();
		expect(services[0].descriptorStatus).toBe("pending");
	});
});
