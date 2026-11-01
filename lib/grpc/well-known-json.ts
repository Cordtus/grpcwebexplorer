// lib/grpc/well-known-json.ts
// Proto3 JSON represents google.protobuf.Struct / Value / ListValue as plain
// JSON values, but protobufjs' fromObject expects their internal message shape
// ({ fields: [{ key, value: { string_value } }] }). Convert at the encode
// boundary so callers can send standard JSON.
//
// DescriptorParser builds every field as a protobuf.Field (it ignores
// map_entry), so Struct's `fields` is a repeated map-entry field here.

import * as protobuf from "protobufjs";
import { JSON_WELL_KNOWN_TYPES } from "@/lib/types/grpc";

const [STRUCT, VALUE, LIST_VALUE] = JSON_WELL_KNOWN_TYPES;

/** Convert proto3-JSON Struct/Value/ListValue values in `params` to protobufjs shape. */
export function normalizeWellKnownParams(
	requestType: protobuf.Type,
	params: any,
): any {
	const name = bareName(requestType);
	// The request type itself may be a well-known type, in which case params is
	// the JSON value itself (not a message object).
	if (name === STRUCT || name === VALUE || name === LIST_VALUE) {
		return params === undefined ? params : normalizeValue(requestType, params);
	}
	if (!params || typeof params !== "object" || Array.isArray(params)) {
		return params;
	}
	return normalizeMessage(requestType, params);
}

function bareName(type: protobuf.Type): string {
	return type.fullName.replace(/^\./, "");
}

function valueJsonToObject(value: unknown): any {
	if (value === null || value === undefined)
		return { null_value: "NULL_VALUE" };
	if (Array.isArray(value)) {
		return { list_value: { values: value.map(valueJsonToObject) } };
	}
	switch (typeof value) {
		case "number":
			return { number_value: value };
		case "boolean":
			return { bool_value: value };
		case "string":
			return { string_value: value };
		default: {
			const entries = Object.entries(value as Record<string, unknown>).map(
				([key, item]) => ({ key, value: valueJsonToObject(item) }),
			);
			return { struct_value: { fields: entries } };
		}
	}
}

function structJsonToObject(value: unknown): any {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError(`${STRUCT}: object expected`);
	}
	return {
		fields: Object.entries(value as Record<string, unknown>).map(
			([key, item]) => ({ key, value: valueJsonToObject(item) }),
		),
	};
}

function normalizeValue(resolved: protobuf.Type, value: unknown): any {
	switch (bareName(resolved)) {
		case STRUCT:
			return structJsonToObject(value);
		case VALUE:
			return valueJsonToObject(value);
		case LIST_VALUE:
			if (!Array.isArray(value)) {
				throw new TypeError(`${LIST_VALUE}: array expected`);
			}
			return { values: value.map(valueJsonToObject) };
		default:
			return normalizeMessage(resolved, value);
	}
}

function normalizeMessage(type: protobuf.Type, value: unknown): any {
	if (!value || typeof value !== "object" || Array.isArray(value)) return value;
	const input = value as Record<string, any>;
	const output: Record<string, any> = { ...input };

	for (const field of type.fieldsArray) {
		const fieldValue = input[field.name];
		if (fieldValue === undefined) continue;

		field.resolve();
		const resolved = field.resolvedType;
		if (!(resolved instanceof protobuf.Type)) continue;
		// null means "unset" for Struct/ListValue (as protobufjs already treats
		// it), but is a real NullValue for a Value field.
		if (fieldValue === null && bareName(resolved) !== VALUE) continue;

		if (field.repeated) {
			if (!Array.isArray(fieldValue)) continue;
			output[field.name] = fieldValue.map((item) =>
				normalizeValue(resolved, item),
			);
		} else {
			output[field.name] = normalizeValue(resolved, fieldValue);
		}
	}

	return output;
}
