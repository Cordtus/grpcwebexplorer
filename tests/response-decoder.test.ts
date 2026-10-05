import { describe, expect, it } from "vitest";
import { bech32Encode } from "@/lib/utils/bech32";
import {
	buildResponseFieldContext,
	decodeBinaryValuesForDisplay,
	inspectBase64Value,
	inspectBinaryValue,
	isDecodedBinaryValue,
	isDecodedScalarValue,
} from "@/lib/utils/response-decoder";

describe("response decoder", () => {
	it("annotates printable base64 text without replacing the original value", () => {
		const decoded = inspectBase64Value("SGVsbG8=");

		expect(decoded).toMatchObject({
			__decodedBinary: true,
			encoding: "base64",
			original: "SGVsbG8=",
			byteLength: 5,
			text: "Hello",
		});
	});

	it("parses decoded JSON payloads into structured values", () => {
		const decoded = inspectBase64Value("eyJmb28iOiJiYXIiLCJjb3VudCI6M30=");

		expect(decoded).toMatchObject({
			__decodedBinary: true,
			encoding: "base64",
			original: "eyJmb28iOiJiYXIiLCJjb3VudCI6M30=",
			text: '{"foo":"bar","count":3}',
			json: {
				foo: "bar",
				count: 3,
			},
		});
	});

	it("annotates binary base64 with byte metadata", () => {
		const decoded = inspectBase64Value("AAECAwQ=");

		expect(decoded).toMatchObject({
			__decodedBinary: true,
			encoding: "base64",
			original: "AAECAwQ=",
			byteLength: 5,
			hexPreview: "00 01 02 03 04",
		});
		expect(decoded).not.toHaveProperty("text");
	});

	it("leaves ordinary strings alone", () => {
		expect(inspectBase64Value("cosmoshub-4")).toBeNull();
		expect(inspectBase64Value("test")).toBeNull();
	});

	it("does not annotate hex hashes or plain opaque tokens as base64", () => {
		expect(inspectBase64Value("deadbeefdeadbeef")).toBeNull();
		expect(inspectBase64Value("0123456789abcdef0123456789abcdef")).toBeNull();
		expect(inspectBase64Value("abcdefghijklmnop")).toBeNull();
	});

	it("recurses through arrays and objects without mutating input", () => {
		const input = {
			id: "cosmoshub-4",
			values: ["SGVsbG8=", "eyJwYXlsb2FkIjoiU0dWc2JHOD0ifQ==", null],
			nested: { payload: "AAECAwQ=" },
		};

		const output = decodeBinaryValuesForDisplay(input);

		expect(output).not.toBe(input);
		expect(input.values[0]).toBe("SGVsbG8=");
		expect(isDecodedBinaryValue((output as any).values[0])).toBe(true);
		expect(isDecodedBinaryValue((output as any).values[1])).toBe(true);
		expect((output as any).values[1].json.payload).toMatchObject({
			__decodedBinary: true,
			text: "Hello",
		});
		expect(isDecodedBinaryValue((output as any).nested.payload)).toBe(true);
		expect((output as any).id).toBe("cosmoshub-4");
	});

	it("builds a field context map from customtype/scalar annotations", () => {
		const context = buildResponseFieldContext({
			name: "QueryParamsResponse",
			fullName: "cosmos.slashing.v1beta1.QueryParamsResponse",
			fields: [
				{
					name: "params",
					type: "cosmos.slashing.v1beta1.Params",
					nestedFields: [
						{ name: "signed_blocks_window", type: "int64" },
						{
							name: "slash_fraction_downtime",
							type: "bytes",
							customtype: "cosmossdk.io/math.LegacyDec",
						},
					],
				},
			],
		});

		expect(context).toEqual({
			"params.slash_fraction_downtime": {
				name: "slash_fraction_downtime",
				message: "cosmos.slashing.v1beta1.Params",
				type: "bytes",
				customtype: "cosmossdk.io/math.LegacyDec",
			},
		});
		expect(buildResponseFieldContext(undefined)).toBeUndefined();
	});

	it("interprets sdk.Dec bytes fields as decimals and percentages", () => {
		const context = buildResponseFieldContext({
			name: "QueryParamsResponse",
			fullName: "cosmos.slashing.v1beta1.QueryParamsResponse",
			fields: [
				{
					name: "params",
					type: "cosmos.slashing.v1beta1.Params",
					nestedFields: [
						{ name: "signed_blocks_window", type: "int64" },
						{
							name: "min_signed_per_window",
							type: "bytes",
							customtype: "cosmossdk.io/math.LegacyDec",
						},
						{
							name: "slash_fraction_double_sign",
							type: "bytes",
							customtype: "cosmossdk.io/math.LegacyDec",
						},
						{
							name: "slash_fraction_downtime",
							type: "bytes",
							customtype: "cosmossdk.io/math.LegacyDec",
						},
					],
				},
			],
		});

		const output: any = decodeBinaryValuesForDisplay(
			{
				params: {
					signed_blocks_window: "10000",
					min_signed_per_window: "NTAwMDAwMDAwMDAwMDAwMDA=",
					slash_fraction_double_sign: "NTAwMDAwMDAwMDAwMDAwMDA=",
					// no base64 marker: only decodable because context says it's a Dec
					slash_fraction_downtime: "MTAwMDAwMDAwMDAwMDAw",
				},
			},
			context,
		);

		expect(output.params.min_signed_per_window.interpretation).toMatchObject({
			kind: "cosmos-dec",
			value: "0.05",
			percent: "5%",
			sourceType: "cosmossdk.io/math.LegacyDec",
		});
		expect(output.params.slash_fraction_double_sign.interpretation.value).toBe(
			"0.05",
		);
		expect(output.params.slash_fraction_downtime.interpretation).toMatchObject({
			value: "0.0001",
			percent: "0.01%",
		});
		// original raw values are preserved
		expect(output.params.min_signed_per_window.original).toBe(
			"NTAwMDAwMDAwMDAwMDAwMDA=",
		);
	});

	it("does not interpret decimal bytes without field context", () => {
		const decoded = inspectBase64Value("NTAwMDAwMDAwMDAwMDAwMDA=");
		expect(decoded?.interpretation).toBeUndefined();
		expect(decoded?.text).toBe("50000000000000000");
		// markerless decimal bytes stay untouched when there is no context
		expect(inspectBase64Value("MTAwMDAwMDAwMDAwMDAw")).toBeNull();
	});

	it("decodes hex hashes and 0x-prefixed values", () => {
		expect(inspectBinaryValue("DEADBEEFDEADBEEF")).toMatchObject({
			__decodedBinary: true,
			encoding: "hex",
			byteLength: 8,
		});
		expect(inspectBinaryValue("0xdeadbeef")).toMatchObject({
			encoding: "hex",
			byteLength: 4,
		});
		// decimal strings and non-hex tokens are left alone
		expect(inspectBinaryValue("10000")).toBeNull();
		expect(inspectBinaryValue("12345678")).toBeNull();
		expect(inspectBinaryValue("cosmoshub-4")).toBeNull();
	});

	it("shows both base64 and hex when a bytes value is ambiguous", () => {
		const decoded = inspectBinaryValue("deadbeefdeadbeef", { type: "bytes" });

		expect(decoded).toMatchObject({ encoding: "base64", byteLength: 12 });
		expect(decoded?.alternates).toHaveLength(1);
		expect(decoded?.alternates?.[0]).toMatchObject({
			encoding: "hex",
			byteLength: 8,
		});
	});

	it("force-decodes markerless bytes fields", () => {
		// "AAAA" is base64 for three zero bytes; too short for the base64 heuristic
		expect(inspectBinaryValue("AAAA")).toBeNull();
		expect(inspectBinaryValue("AAAA", { type: "bytes" })).toMatchObject({
			encoding: "base64",
			byteLength: 3,
			hexPreview: "00 00 00",
		});
	});

	it("interprets string-encoded sdk.Dec fields from descriptor metadata", () => {
		const context = buildResponseFieldContext({
			name: "QueryParamsResponse",
			fullName: "cosmos.staking.v1beta1.QueryParamsResponse",
			fields: [
				{
					name: "params",
					type: "cosmos.staking.v1beta1.Params",
					nestedFields: [
						{ name: "bond_denom", type: "string" },
						{
							name: "min_commission_rate",
							type: "string",
							customtype: "cosmossdk.io/math.LegacyDec",
							scalar: "cosmos.Dec",
						},
					],
				},
			],
		});

		const output: any = decodeBinaryValuesForDisplay(
			{
				params: {
					bond_denom: "uatone",
					min_commission_rate: "50000000000000000",
				},
			},
			context,
		);

		expect(isDecodedScalarValue(output.params.min_commission_rate)).toBe(true);
		expect(output.params.min_commission_rate.interpretation).toMatchObject({
			kind: "cosmos-dec",
			value: "0.05",
			percent: "5%",
		});
		expect(output.params.min_commission_rate.original).toBe(
			"50000000000000000",
		);
		// non-Dec strings are untouched
		expect(output.params.bond_denom).toBe("uatone");
	});

	it("normalizes decimal-string sdk.Dec values", () => {
		const context = buildResponseFieldContext({
			name: "Response",
			fullName: "test.Response",
			fields: [
				{
					name: "rate",
					type: "string",
					scalar: "cosmos.Dec",
				},
			],
		});

		const output: any = decodeBinaryValuesForDisplay(
			{ rate: "0.050000000000000000" },
			context,
		);

		expect(output.rate.interpretation).toMatchObject({
			value: "0.05",
			percent: "5%",
		});
	});

	it("omits the percentage for Dec values above 1 (e.g. prices)", () => {
		const context = buildResponseFieldContext({
			name: "Response",
			fullName: "test.Response",
			fields: [{ name: "price", type: "string", scalar: "cosmos.Dec" }],
		});

		const output: any = decodeBinaryValuesForDisplay(
			{ price: "1500000000000000000" },
			context,
		);

		expect(output.price.interpretation).toMatchObject({ value: "1.5" });
		expect(output.price.interpretation.percent).toBeUndefined();
	});

	it("normalizes but does not percent-encode Dec quantities", () => {
		const context = buildResponseFieldContext({
			name: "Response",
			fullName: "test.Response",
			fields: [
				{
					name: "amount",
					type: "string",
					customtype: "cosmossdk.io/math.LegacyDec",
					scalar: "cosmos.Dec",
				},
				{
					name: "shares",
					type: "string",
					customtype: "cosmossdk.io/math.LegacyDec",
					scalar: "cosmos.Dec",
				},
				{
					name: "base_gas_price",
					type: "string",
					customtype: "cosmossdk.io/math.LegacyDec",
					scalar: "cosmos.Dec",
				},
			],
		});

		const output: any = decodeBinaryValuesForDisplay(
			{
				amount: "500000000000000000",
				shares: "500000000000000000",
				base_gas_price: "500000000000000000",
			},
			context,
		);

		expect(output.amount.interpretation).toMatchObject({ value: "0.5" });
		expect(output.amount.interpretation.percent).toBeUndefined();
		expect(output.shares.interpretation.percent).toBeUndefined();
		expect(output.base_gas_price.interpretation.percent).toBeUndefined();
	});

	it("classifies Dec fractions by containing message when the field name is generic", () => {
		const context = buildResponseFieldContext({
			name: "Response",
			fullName: "test.Response",
			fields: [
				{
					name: "quorum_range",
					type: "cosmos.gov.v1.QuorumRange",
					nestedFields: [
						{ name: "min", type: "string", scalar: "cosmos.Dec" },
						{ name: "max", type: "string", scalar: "cosmos.Dec" },
					],
				},
			],
		});

		const output: any = decodeBinaryValuesForDisplay(
			{
				quorum_range: {
					min: "500000000000000000",
					max: "900000000000000000",
				},
			},
			context,
		);

		expect(output.quorum_range.min.interpretation).toMatchObject({
			value: "0.5",
			percent: "50%",
		});
		expect(output.quorum_range.max.interpretation.percent).toBe("90%");
	});

	it("renders address bytes as bech32 using the prefix inferred from the response", () => {
		const bytes20 = Uint8Array.from(
			Array.from({ length: 20 }, (_, i) => i + 1),
		);
		const operator = bech32Encode("cosmosvaloper", bytes20) as string;
		const context = buildResponseFieldContext({
			name: "Response",
			fullName: "test.Response",
			fields: [
				{ name: "operator_address", type: "string" },
				{
					name: "address",
					type: "bytes",
					customtype: "github.com/cosmos/cosmos-sdk/types.AccAddress",
				},
			],
		});

		const output: any = decodeBinaryValuesForDisplay(
			{
				operator_address: operator,
				address: Buffer.from(bytes20).toString("base64"),
			},
			context,
		);

		// valoper prefix in the response is reduced to the base prefix for an AccAddress
		expect(output.address.bech32).toBe(bech32Encode("cosmos", bytes20));
	});

	it("uses an explicit chain-registry prefix for address bytes", () => {
		const bytes20 = Uint8Array.from(
			Array.from({ length: 20 }, (_, i) => i + 1),
		);
		const context = buildResponseFieldContext({
			name: "Response",
			fullName: "test.Response",
			fields: [
				{
					name: "address",
					type: "bytes",
					customtype: "github.com/cosmos/cosmos-sdk/types.AccAddress",
				},
			],
		});

		const output: any = decodeBinaryValuesForDisplay(
			{ address: Buffer.from(bytes20).toString("base64") },
			context,
			"atone",
		);

		expect(output.address.bech32).toBe(bech32Encode("atone", bytes20));
	});
});
