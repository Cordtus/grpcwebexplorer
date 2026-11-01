import type * as protobuf from "protobufjs";
import { describe, expect, it } from "vitest";
import { DescriptorParser } from "@/lib/grpc/descriptor-parser";
import { normalizeWellKnownParams } from "@/lib/grpc/well-known-json";
import { encodeFileDescriptor } from "./fixtures";

/**
 * Synthetic descriptors mirroring what reflection returns for struct.proto,
 * plus a request message holding Struct, Value and ListValue fields.
 */
const STRUCT_FILE = {
	name: "google/protobuf/struct.proto",
	package: "google.protobuf",
	syntax: "proto3",
	enumType: [{ name: "NullValue", value: [{ name: "NULL_VALUE", number: 0 }] }],
	messageType: [
		{
			name: "Struct",
			field: [
				{
					name: "fields",
					number: 1,
					label: 3,
					type: 11,
					typeName: ".google.protobuf.Struct.FieldsEntry",
				},
			],
			nestedType: [
				{
					name: "FieldsEntry",
					options: { mapEntry: true },
					field: [
						{ name: "key", number: 1, label: 1, type: 9 },
						{
							name: "value",
							number: 2,
							label: 1,
							type: 11,
							typeName: ".google.protobuf.Value",
						},
					],
				},
			],
		},
		{
			name: "Value",
			oneofDecl: [{ name: "kind" }],
			field: [
				{
					name: "null_value",
					number: 1,
					label: 1,
					type: 14,
					typeName: ".google.protobuf.NullValue",
					oneofIndex: 0,
				},
				{ name: "number_value", number: 2, label: 1, type: 1, oneofIndex: 0 },
				{ name: "string_value", number: 3, label: 1, type: 9, oneofIndex: 0 },
				{ name: "bool_value", number: 4, label: 1, type: 8, oneofIndex: 0 },
				{
					name: "struct_value",
					number: 5,
					label: 1,
					type: 11,
					typeName: ".google.protobuf.Struct",
					oneofIndex: 0,
				},
				{
					name: "list_value",
					number: 6,
					label: 1,
					type: 11,
					typeName: ".google.protobuf.ListValue",
					oneofIndex: 0,
				},
			],
		},
		{
			name: "ListValue",
			field: [
				{
					name: "values",
					number: 1,
					label: 3,
					type: 11,
					typeName: ".google.protobuf.Value",
				},
			],
		},
	],
};

const TEST_FILE = {
	name: "test.proto",
	package: "test",
	syntax: "proto3",
	dependency: ["google/protobuf/struct.proto"],
	messageType: [
		{
			name: "Nested",
			field: [
				{
					name: "meta",
					number: 1,
					label: 1,
					type: 11,
					typeName: ".google.protobuf.Struct",
				},
			],
		},
		{
			name: "Req",
			field: [
				{ name: "name", number: 1, label: 1, type: 9 },
				{
					name: "payload",
					number: 2,
					label: 1,
					type: 11,
					typeName: ".google.protobuf.Struct",
				},
				{
					name: "value",
					number: 3,
					label: 1,
					type: 11,
					typeName: ".google.protobuf.Value",
				},
				{
					name: "list",
					number: 4,
					label: 1,
					type: 11,
					typeName: ".google.protobuf.ListValue",
				},
				{
					name: "nested",
					number: 5,
					label: 1,
					type: 11,
					typeName: ".test.Nested",
				},
				{
					name: "entries",
					number: 6,
					label: 3,
					type: 11,
					typeName: ".google.protobuf.Struct",
				},
			],
		},
	],
	service: [
		{
			name: "Svc",
			method: [{ name: "Do", inputType: ".test.Req", outputType: ".test.Req" }],
		},
	],
};

function buildParser(): DescriptorParser {
	const parser = new DescriptorParser();
	for (const file of [STRUCT_FILE, TEST_FILE]) {
		parser.processFileDescriptor(encodeFileDescriptor(file));
	}
	return parser;
}

describe("normalizeWellKnownParams", () => {
	const parser = buildParser();
	const requestType = parser.getRoot().lookupType("test.Req") as protobuf.Type;

	const roundTrip = (params: Record<string, any>) => {
		const message = requestType.fromObject(
			normalizeWellKnownParams(requestType, params),
		);
		const decoded = requestType.decode(requestType.encode(message).finish());
		return requestType.toObject(decoded, { defaults: false }) as any;
	};

	it("encodes a Struct field from plain JSON", () => {
		const encoded = roundTrip({
			payload: {
				name: "demo",
				count: 3,
				ok: true,
				nothing: null,
				tags: ["a", "b"],
			},
		});

		const fields = Object.fromEntries(
			encoded.payload.fields.map((entry: any) => [entry.key, entry.value]),
		);

		expect(fields.name).toEqual({ string_value: "demo" });
		expect(fields.count).toEqual({ number_value: 3 });
		expect(fields.ok).toEqual({ bool_value: true });
		expect(fields.nothing).toEqual({ null_value: 0 });
		expect(fields.tags.list_value.values).toHaveLength(2);
	});

	it("encodes nested Structs, Value and ListValue fields", () => {
		const encoded = roundTrip({
			value: { nested: { deep: "yes" } },
			list: [1, "two", false, null, [{ k: "v" }]],
			nested: { meta: { region: "eu" } },
		});

		expect(
			encoded.value.struct_value.fields[0].value.struct_value.fields[0].key,
		).toBe("deep");
		expect(encoded.list.values).toHaveLength(5);
		expect(encoded.list.values[1]).toEqual({ string_value: "two" });
		expect(encoded.nested.meta.fields[0].key).toBe("region");
	});

	it("encodes repeated Struct fields", () => {
		const encoded = roundTrip({ entries: [{ a: 1 }, { b: "two" }] });

		expect(encoded.entries).toHaveLength(2);
		expect(encoded.entries[1].fields[0]).toEqual({
			key: "b",
			value: { string_value: "two" },
		});
	});

	it("encodes a Value field holding an empty string", () => {
		expect(roundTrip({ value: "" })).toEqual({
			value: { string_value: "" },
		});
	});

	it("leaves null Struct values unset", () => {
		expect(roundTrip({ payload: null })).toEqual({});
	});

	it("rejects non-object Struct and non-array ListValue values", () => {
		expect(() =>
			normalizeWellKnownParams(requestType, { payload: [1] }),
		).toThrow(/Struct: object expected/);
		expect(() => normalizeWellKnownParams(requestType, { list: 5 })).toThrow(
			/ListValue: array expected/,
		);
	});

	it("does not mutate the input params", () => {
		const params = { payload: { a: 1 } };
		normalizeWellKnownParams(requestType, params);
		expect(params).toEqual({ payload: { a: 1 } });
	});

	it("converts a request type that is itself a Struct", () => {
		const structType = parser
			.getRoot()
			.lookupType("google.protobuf.Struct") as protobuf.Type;
		const message = structType.fromObject(
			normalizeWellKnownParams(structType, { a: 1 } as any),
		);
		const decoded = structType.decode(structType.encode(message).finish());
		const json = structType.toObject(decoded, { defaults: false }) as any;

		expect(json.fields[0]).toEqual({ key: "a", value: { number_value: 1 } });
	});

	it("converts a request type that is itself a Value or ListValue", () => {
		const valueType = parser
			.getRoot()
			.lookupType("google.protobuf.Value") as protobuf.Type;
		expect(normalizeWellKnownParams(valueType, "text")).toEqual({
			string_value: "text",
		});

		const listType = parser
			.getRoot()
			.lookupType("google.protobuf.ListValue") as protobuf.Type;
		expect(normalizeWellKnownParams(listType, [1])).toEqual({
			values: [{ number_value: 1 }],
		});
	});

	it("leaves ordinary fields untouched", () => {
		expect(roundTrip({ name: "plain" })).toEqual({ name: "plain" });
	});
});
