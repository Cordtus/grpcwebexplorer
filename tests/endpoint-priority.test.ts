import { describe, expect, it } from "vitest";
import { endpointManager } from "@/lib/utils/endpoint-manager";
import { isLavenderFiveEndpoint } from "@/lib/utils/endpoint-priority";

describe("endpoint priority", () => {
	it("recognizes Lavender Five addresses and providers", () => {
		expect(isLavenderFiveEndpoint("injective.lavenderfive.com:443")).toBe(true);
		expect(
			isLavenderFiveEndpoint("node.example.com:443", "Lavender.Five"),
		).toBe(true);
		expect(isLavenderFiveEndpoint("node.example.com:443")).toBe(false);
	});

	it("keeps Lavender Five last regardless of input order", () => {
		const ordered = endpointManager.prioritizeEndpoints([
			{ address: "injective.lavenderfive.com:443", tls: true },
			{ address: "normal:443", tls: true },
		]);
		expect(ordered.map((endpoint) => endpoint.address)).toEqual([
			"normal:443",
			"injective.lavenderfive.com:443",
		]);
	});
});
