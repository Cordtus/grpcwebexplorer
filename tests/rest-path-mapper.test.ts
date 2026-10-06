import { describe, expect, it } from "vitest";
import { generateRestUrl } from "@/lib/utils/rest-path-mapper";

describe("generateRestUrl", () => {
	it("uses the google.api.http annotation and substitutes path params", () => {
		const rest = generateRestUrl(
			"cosmos.tx.v1beta1.Service",
			{ hash: "ABC" },
			"https://api.example.com",
			{ get: "/cosmos/tx/v1beta1/txs/{hash}" },
		);

		expect(rest).toMatchObject({
			supported: true,
			method: "GET",
			url: "https://api.example.com/cosmos/tx/v1beta1/txs/ABC",
			usedParams: ["hash"],
		});
	});

	it("builds a query string from params not used in the path", () => {
		const rest = generateRestUrl(
			"cosmos.bank.v1beta1.Query",
			{ address: "cosmos1abc", pagination: { limit: "10" } },
			"https://api.example.com",
			{ get: "/cosmos/bank/v1beta1/balances/{address}" },
		);

		expect(rest.url).toBe(
			"https://api.example.com/cosmos/bank/v1beta1/balances/cosmos1abc?pagination.limit=10",
		);
	});

	it("handles POST body annotations", () => {
		const rest = generateRestUrl(
			"cosmos.tx.v1beta1.Service",
			{},
			"https://api.example.com",
			{ post: "/cosmos/tx/v1beta1/simulate", body: "*" },
		);

		expect(rest).toMatchObject({
			supported: true,
			method: "POST",
			url: "https://api.example.com/cosmos/tx/v1beta1/simulate",
		});
	});

	it("reports no mapping when there is no annotation", () => {
		const rest = generateRestUrl(
			"custom.v1.Service",
			{},
			"https://api.example.com",
		);

		expect(rest.supported).toBe(false);
		expect(rest.warning).toContain("No REST annotation");
	});

	it("reports Msg transactions as POST and unsupported", () => {
		const rest = generateRestUrl(
			"cosmos.bank.v1beta1.Msg",
			{},
			"https://api.example.com",
		);

		expect(rest.supported).toBe(false);
		expect(rest.method).toBe("POST");
		expect(rest.warning).toContain("signing");
	});
});
