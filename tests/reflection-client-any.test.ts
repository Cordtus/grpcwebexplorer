// tests/reflection-client-any.test.ts
// Any-wrapper decoding in execute responses (descriptor field names are snake_case)

import * as protobuf from "protobufjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReflectionClient } from "@/lib/grpc/reflection-client";

function buildClient() {
	const root = new protobuf.Root();
	root.addJSON({
		google: {
			nested: {
				protobuf: {
					nested: {
						Any: {
							fields: {
								type_url: { type: "string", id: 1 },
								value: { type: "bytes", id: 2 },
							},
						},
					},
				},
			},
		},
		example: {
			nested: {
				Msg: {
					fields: {
						sender: { type: "string", id: 1 },
						amount: { type: "uint64", id: 2 },
					},
				},
				Outer: {
					fields: {
						inner: { type: "google.protobuf.Any", id: 1 },
					},
				},
			},
		},
	});

	const client = new ReflectionClient({ endpoint: "127.0.0.1:1", tls: false });
	(client as any).parser = { getRoot: () => root };

	const msgType = root.lookupType("example.Msg");
	const value = Buffer.from(
		msgType
			.encode(msgType.fromObject({ sender: "inj1abc", amount: "42" }))
			.finish(),
	).toString("base64");

	return { client, value };
}

describe("ReflectionClient Any decoding", () => {
	let client: ReflectionClient | undefined;

	afterEach(() => {
		client?.close();
		client = undefined;
	});

	it("decodes Any wrappers using the snake_case field names emitted by descriptors", async () => {
		const built = buildClient();
		client = built.client;

		const decoded = await (client as any).decodeAnyFields({
			type_url: "/example.Msg",
			value: built.value,
		});

		expect(decoded).toEqual({
			sender: "inj1abc",
			amount: "42",
			"@type": "example.Msg",
		});
	});

	it("still decodes camelCase Any wrappers", async () => {
		const built = buildClient();
		client = built.client;

		const decoded = await (client as any).decodeAnyFields({
			typeUrl: "/example.Msg",
			value: built.value,
		});

		expect(decoded).toEqual({
			sender: "inj1abc",
			amount: "42",
			"@type": "example.Msg",
		});
	});

	it("recurses into Any wrappers nested inside a decoded Any", async () => {
		const built = buildClient();
		client = built.client;

		const root = (client as any).parser.getRoot() as protobuf.Root;
		const msgType = root.lookupType("example.Msg");
		const outerType = root.lookupType("example.Outer");
		const innerBytes = msgType
			.encode(msgType.fromObject({ sender: "inj1nested", amount: "7" }))
			.finish();
		const outerBytes = outerType
			.encode(
				outerType.fromObject({
					inner: { type_url: "/example.Msg", value: innerBytes },
				}),
			)
			.finish();

		const decoded = await (client as any).decodeAnyFields({
			type_url: "/example.Outer",
			value: Buffer.from(outerBytes).toString("base64"),
		});

		expect(decoded).toEqual({
			inner: {
				sender: "inj1nested",
				amount: "7",
				"@type": "example.Msg",
			},
			"@type": "example.Outer",
		});
	});

	it("leaves an Any wrapper untouched when its type cannot be loaded", async () => {
		const built = buildClient();
		client = built.client;
		(client as any).loadServiceDescriptor = vi
			.fn()
			.mockRejectedValue(new Error("symbol not found"));

		const wrapper = { type_url: "/missing.Msg", value: built.value };
		expect(await (client as any).decodeAnyFields(wrapper)).toEqual(wrapper);
	});
});
