import { describe, expect, it } from "vitest";
import { bech32Decode, bech32Encode, bech32Hrp } from "@/lib/utils/bech32";

describe("bech32", () => {
	it("decodes BIP-173 test vectors", () => {
		expect(bech32Decode("A12UEL5L")?.hrp).toBe("a");
		expect(bech32Hrp("abcdef1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxw")).toBe(
			"abcdef",
		);
	});

	it("rejects an invalid checksum", () => {
		expect(
			bech32Decode("abcdef1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxx"),
		).toBeNull();
	});

	it("round-trips arbitrary bytes", () => {
		const bytes = Uint8Array.from(Array.from({ length: 20 }, (_, i) => i * 7));
		const encoded = bech32Encode("cosmos", bytes);

		expect(encoded).not.toBeNull();
		expect(encoded?.startsWith("cosmos1")).toBe(true);

		const decoded = bech32Decode(encoded as string);
		expect(decoded?.hrp).toBe("cosmos");
		expect(Array.from(decoded?.data ?? [])).toEqual(Array.from(bytes));
	});

	it("round-trips empty and 32-byte payloads", () => {
		for (const length of [0, 32]) {
			const bytes = Uint8Array.from({ length }, (_, i) => i);
			const encoded = bech32Encode("atone", bytes);
			expect(encoded).not.toBeNull();
			const decoded = bech32Decode(encoded as string);
			expect(Array.from(decoded?.data ?? [])).toEqual(Array.from(bytes));
		}
	});

	it("rejects mixed case and invalid HRP characters", () => {
		expect(bech32Decode("Cosmos1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq")).toBeNull();
		expect(bech32Encode("Cosmos", Uint8Array.from([1, 2, 3]))).toBeNull();
		expect(bech32Encode("bad hrp", Uint8Array.from([1, 2, 3]))).toBeNull();
	});
});
