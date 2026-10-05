import type { MessageField, MessageTypeDefinition } from "@/lib/types/grpc";
import { bech32Encode, bech32Hrp } from "@/lib/utils/bech32";

/** How a decoded byte value should be interpreted, derived from field metadata. */
export interface DecodedBinaryInterpretation {
	/** Recognized semantic type. Currently only Cosmos sdk.Dec. */
	kind: "cosmos-dec";
	/** Human-readable decimal, e.g. "0.05". */
	value: string;
	/** Human-readable percentage, e.g. "5%". */
	percent?: string;
	/** Source annotation that triggered the interpretation. */
	sourceType?: string;
}

/** A single way of reading an encoded string as bytes. */
export interface BinaryDecoding {
	encoding: "base64" | "hex";
	byteLength: number;
	hexPreview: string;
	text?: string;
	json?: unknown;
	/** Bech32 rendering, when the field is a known address type. */
	bech32?: string;
}

export interface DecodedBinaryValue extends BinaryDecoding {
	__decodedBinary: true;
	original: string;
	interpretation?: DecodedBinaryInterpretation;
	/** Other encodings that also apply to the same original value. */
	alternates?: BinaryDecoding[];
}

/**
 * A plain (non-binary) string whose field metadata gives it a semantic
 * interpretation, e.g. a Cosmos `sdk.Dec` field encoded as a string.
 */
export interface DecodedScalarValue {
	__decodedScalar: true;
	original: string;
	interpretation: DecodedBinaryInterpretation;
}

/** Field metadata keyed by dot-path within the response message. */
export interface ResponseFieldContext {
	/** Protobuf field type, e.g. "bytes" (JSON-encoded as base64). */
	type?: string;
	/** Field name, used to classify rate vs quantity semantics. */
	name?: string;
	/** Containing message name, used as a fallback semantic hint. */
	message?: string;
	customtype?: string;
	scalar?: string;
	/** Chain bech32 prefix, injected at decode time when known. */
	hrp?: string;
}
export type ResponseFieldContextMap = Record<string, ResponseFieldContext>;

const BASE64_RE =
	/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BASE64_MARKER_RE = /[+/=]/;
const HEX_RE = /^(?:0x)?[0-9a-fA-F]+$/;
const PRINTABLE_RE = /^[\t\n\r\x20-\x7E\u00A0-\uFFFF]*$/;
const TEXT_SIGNAL_RE = /[\s!"#$%&'()*,:;<=>?@[\\\]^`{|}~]/;

/** Cosmos sdk.Dec / LegacyDec stores 18 decimal places of precision. */
const DEC_PRECISION = 18;

function decodeBase64(value: string): Uint8Array | null {
	try {
		const decoder = (
			globalThis as typeof globalThis & { atob?: (input: string) => string }
		).atob;
		if (decoder) {
			const binary = decoder(value);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i);
			}
			return bytes;
		}

		const bufferCtor = (
			globalThis as typeof globalThis & {
				Buffer?: { from: (input: string, encoding: "base64") => Uint8Array };
			}
		).Buffer;

		return bufferCtor ? new Uint8Array(bufferCtor.from(value, "base64")) : null;
	} catch {
		return null;
	}
}

function utf8Decode(bytes: Uint8Array): string | null {
	try {
		const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		return decoded && PRINTABLE_RE.test(decoded) ? decoded : null;
	} catch {
		return null;
	}
}

function hexPreview(bytes: Uint8Array, limit = 32): string {
	return Array.from(bytes.slice(0, limit))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join(" ");
}

function parseJsonText(text: string): unknown | undefined {
	const trimmed = text.trim();
	if (!trimmed) return undefined;

	const first = trimmed[0];
	if (
		!["{", "[", '"', "t", "f", "n"].includes(first) &&
		!/^-?\d/.test(trimmed)
	) {
		return undefined;
	}

	try {
		return JSON.parse(trimmed);
	} catch {
		return undefined;
	}
}

function isCosmosDecimal(context?: ResponseFieldContext): boolean {
	if (!context) return false;
	if (context.scalar === "cosmos.Dec") return true;

	const customtype = context.customtype;
	if (!customtype) return false;

	const last = customtype.split(/[./]/).pop() || "";
	return last === "Dec" || last === "LegacyDec";
}

// Cosmos uses sdk.Dec for both fractions (rates, quorums, taxes) and quantities
// (coin amounts, shares, prices). The descriptor does not label which is which,
// so classify by field/message name to decide whether a percentage is meaningful.
const FRACTION_FIELD_RE =
	/fraction|ratio|rate|percent|quorum|threshold|tax|inflation|weight|ema|participation|commission|utilization|bonded|reward|window/i;
const QUANTITY_FIELD_RE =
	/amount|shares|stake|provisions|supply|balance|coefficient|step|price|conversion/i;

function isFractionField(context?: ResponseFieldContext): boolean {
	const name = context?.name ?? "";
	const message = context?.message ?? "";
	if (QUANTITY_FIELD_RE.test(name) || QUANTITY_FIELD_RE.test(message)) {
		return false;
	}
	return FRACTION_FIELD_RE.test(name) || FRACTION_FIELD_RE.test(message);
}

/**
 * Format an integer string as a fixed-point decimal with `precision` implied
 * decimals, trimming trailing zeros. Returns null when the input is not an
 * integer. e.g. ("50000000000000000", 18) -> "0.05".
 */
function formatScaledDecimal(raw: string, precision: number): string | null {
	const negative = raw.startsWith("-");
	const unsigned = negative ? raw.slice(1) : raw;
	if (!/^\d+$/.test(unsigned)) return null;

	const trimmed = unsigned.replace(/^0+(?=\d)/, "");
	const padded = trimmed.padStart(precision + 1, "0");
	const intPart = padded.slice(0, padded.length - precision) || "0";
	const frac = padded.slice(padded.length - precision).replace(/0+$/, "");
	return `${negative ? "-" : ""}${intPart}${frac ? `.${frac}` : ""}`;
}

/** Normalize a decimal string, trimming redundant zeros. Returns null if not decimal. */
function normalizeDecimal(raw: string): string | null {
	const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw.trim());
	if (!match) return null;

	const sign = match[1];
	const intPart = match[2].replace(/^0+(?=\d)/, "");
	const fracPart = (match[3] ?? "").replace(/0+$/, "");
	return `${sign}${intPart}${fracPart ? `.${fracPart}` : ""}`;
}

/** Shift a normalized decimal's point right by `places` (multiply by 10^places). */
function shiftDecimalPoint(value: string, places: number): string {
	const negative = value.startsWith("-");
	const body = negative ? value.slice(1) : value;
	let [intPart, fracPart = ""] = body.split(".");
	const moved = fracPart.slice(0, places).padEnd(places, "0");
	intPart = (intPart + moved).replace(/^0+(?=\d)/, "");
	fracPart = fracPart.slice(places);
	const result = `${intPart}${fracPart ? `.${fracPart}` : ""}`;
	return negative ? `-${result}` : result;
}

/**
 * Interpret a Cosmos `sdk.Dec` value as a decimal and percentage. Accepts the
 * raw scaled integer ("50000000000000000") or a decimal string ("0.05").
 * Returns null when the context is not a Dec or the value is not decimal.
 */
function interpretCosmosDecimal(
	raw: string,
	context: ResponseFieldContext | undefined,
): DecodedBinaryInterpretation | null {
	if (!isCosmosDecimal(context)) return null;

	const trimmed = raw.trim();
	const value = /^-?\d+$/.test(trimmed)
		? formatScaledDecimal(trimmed, DEC_PRECISION)
		: normalizeDecimal(trimmed);
	if (value === null) return null;

	const interpretation: DecodedBinaryInterpretation = {
		kind: "cosmos-dec",
		value,
		...(context?.customtype ? { sourceType: context.customtype } : {}),
	};

	// Cosmos Dec is used for both rates (fractions of 1) and quantities such as
	// coin amounts or prices. Only surface a percentage for fields classified as
	// fractions, and only when the value can actually be a fraction.
	const numeric = Number.parseFloat(value);
	if (
		isFractionField(context) &&
		Number.isFinite(numeric) &&
		numeric >= 0 &&
		numeric <= 1
	) {
		interpretation.percent = `${shiftDecimalPoint(value, 2)}%`;
	}

	return interpretation;
}

function buildDecoding(
	bytes: Uint8Array,
	encoding: BinaryDecoding["encoding"],
): BinaryDecoding {
	const decoding: BinaryDecoding = {
		encoding,
		byteLength: bytes.length,
		hexPreview: hexPreview(bytes),
	};
	const text = utf8Decode(bytes);
	if (text !== null) decoding.text = text;
	return decoding;
}

type AddressKind = "acc" | "valoper" | "valcons";

/** Identify address-typed bytes fields from their customtype/scalar annotation. */
function addressKind(context?: ResponseFieldContext): AddressKind | null {
	if (!context) return null;
	const customtype = context.customtype ?? "";
	const scalar = context.scalar ?? "";
	if (
		/ConsAddress$/.test(customtype) ||
		scalar === "cosmos.ConsensusAddressBytes"
	) {
		return "valcons";
	}
	if (
		/ValAddress$/.test(customtype) ||
		scalar === "cosmos.ValidatorAddressBytes"
	) {
		return "valoper";
	}
	if (/AccAddress$/.test(customtype) || scalar === "cosmos.AddressBytes") {
		return "acc";
	}
	return null;
}

function hrpForKind(base: string, kind: AddressKind): string {
	if (kind === "valoper") return `${base}valoper`;
	if (kind === "valcons") return `${base}valcons`;
	return base;
}

/**
 * Infer a chain's base bech32 prefix from any valid bech32 string in a response.
 * Validator/consensus prefixes are reduced to the base prefix.
 */
function inferBech32Prefix(value: unknown): string | undefined {
	let prefix: string | undefined;
	const visit = (node: unknown) => {
		if (prefix) return;
		if (typeof node === "string") {
			const hrp = bech32Hrp(node);
			if (hrp) prefix = hrp.replace(/(valoper|valcons)$/, "");
		} else if (Array.isArray(node)) {
			for (const item of node) visit(item);
		} else if (node && typeof node === "object") {
			for (const child of Object.values(node)) visit(child);
		}
	};
	visit(value);
	return prefix;
}

type Decoding = BinaryDecoding & {
	interpretation?: DecodedBinaryInterpretation;
};

/**
 * Try reading the value as base64. `force` is set for fields known to be bytes
 * (protobuf JSON always base64-encodes them) or known sdk.Dec values, which
 * bypasses the conservative false-positive heuristic.
 */
function buildBase64Decoding(
	value: string,
	context: ResponseFieldContext | undefined,
	force: boolean,
): Decoding | null {
	const normalized = value.trim();

	if (
		normalized.length === 0 ||
		normalized.length % 4 !== 0 ||
		!BASE64_RE.test(normalized)
	) {
		return null;
	}

	// A pure hex string is far more likely hex-encoded than base64.
	if (!force && (normalized.length < 8 || HEX_RE.test(normalized))) {
		return null;
	}

	const bytes = decodeBase64(normalized);
	if (!bytes || bytes.length === 0) return null;

	const decoding: Decoding = buildDecoding(bytes, "base64");
	const hasBase64Marker = BASE64_MARKER_RE.test(normalized);
	const knownDecimal = isCosmosDecimal(context);

	// Address-typed bytes fields can be rendered as bech32 when the chain prefix
	// is known (from the response or an explicit override).
	const kind = addressKind(context);
	if (kind && context?.hrp) {
		const bech32 = bech32Encode(hrpForKind(context.hrp, kind), bytes);
		if (bech32) decoding.bech32 = bech32;
	}

	if (
		!hasBase64Marker &&
		!knownDecimal &&
		!force &&
		(decoding.text === undefined || !TEXT_SIGNAL_RE.test(decoding.text))
	) {
		return null;
	}

	if (decoding.text !== undefined) {
		if (knownDecimal) {
			const interpretation = interpretCosmosDecimal(decoding.text, context);
			if (interpretation) {
				decoding.interpretation = interpretation;
			}
		}

		if (!decoding.interpretation) {
			const json = parseJsonText(decoding.text);
			if (json !== undefined) {
				decoding.json = json;
			}
		}
	}

	return decoding;
}

/** Try reading the value as hex. Rejects plain decimal strings and short bare tokens. */
function buildHexDecoding(value: string): BinaryDecoding | null {
	const normalized = value.trim();
	const hasPrefix = /^0x/i.test(normalized);
	const stripped = hasPrefix ? normalized.slice(2) : normalized;

	if (stripped.length === 0 || stripped.length % 2 !== 0) return null;
	if (!/^[0-9a-fA-F]+$/.test(stripped)) return null;
	// Bare numeric strings ("10000") are not meaningful hex.
	if (!hasPrefix && /^\d+$/.test(stripped)) return null;
	// Require a plausible length for bare hex to avoid noise.
	if (!hasPrefix && stripped.length < 8) return null;

	const bytes = new Uint8Array(stripped.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
	}
	return buildDecoding(bytes, "hex");
}

function decodingScore(decoding: Decoding): number {
	if (decoding.interpretation) return 3;
	if (decoding.json !== undefined) return 2;
	if (decoding.text !== undefined) return 1;
	return 0;
}

/** Build a dot-path -> field metadata map from a response type definition. */
export function buildResponseFieldContext(
	definition: MessageTypeDefinition | undefined,
): ResponseFieldContextMap | undefined {
	if (!definition?.fields?.length) return undefined;

	const map: ResponseFieldContextMap = {};
	const walk = (
		fields: MessageField[],
		prefix: string,
		parentType: string | undefined,
	) => {
		for (const field of fields) {
			const path = prefix ? `${prefix}.${field.name}` : field.name;
			const isBytes = field.type === "bytes";
			if (field.customtype || field.scalar || isBytes) {
				const entry: ResponseFieldContext = { name: field.name };
				if (parentType) entry.message = parentType;
				if (isBytes) entry.type = field.type;
				if (field.customtype) entry.customtype = field.customtype;
				if (field.scalar) entry.scalar = field.scalar;
				map[path] = entry;
			}
			if (field.nestedFields?.length) {
				walk(field.nestedFields, path, field.type);
			}
		}
	};
	walk(definition.fields, "", definition.name);

	return Object.keys(map).length > 0 ? map : undefined;
}

/** Inspect a value as base64 only. Kept for callers that need a single encoding. */
export function inspectBase64Value(
	value: string,
	context?: ResponseFieldContext,
): DecodedBinaryValue | null {
	const decoding = buildBase64Decoding(
		value,
		context,
		isCosmosDecimal(context),
	);
	if (!decoding) return null;
	return { __decodedBinary: true, original: value, ...decoding };
}

/**
 * Inspect a value and decode it as base64, hex, or both when applicable.
 * Field context (bytes vs string, customtype/scalar) drives the choice.
 */
export function inspectBinaryValue(
	value: string,
	context?: ResponseFieldContext,
): DecodedBinaryValue | null {
	const isBytes = context?.type === "bytes";
	const force = isBytes || isCosmosDecimal(context);

	const base64 = buildBase64Decoding(value, context, force);
	const hex = buildHexDecoding(value);

	if (!base64 && !hex) return null;

	let primary: Decoding;
	let alternate: BinaryDecoding | undefined;

	if (base64 && hex) {
		// Base64 is authoritative for bytes fields; otherwise prefer whichever
		// decoding yields richer text/JSON.
		if (!isBytes && decodingScore(hex) > decodingScore(base64)) {
			primary = hex;
			alternate = base64;
		} else {
			primary = base64;
			alternate = hex;
		}
	} else {
		primary = (base64 ?? hex) as Decoding;
	}

	const decoded: DecodedBinaryValue = {
		__decodedBinary: true,
		original: value,
		...primary,
	};
	if (alternate) decoded.alternates = [alternate];
	return decoded;
}

export function isDecodedBinaryValue(
	value: unknown,
): value is DecodedBinaryValue {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as Partial<DecodedBinaryValue>).__decodedBinary === true
	);
}

export function isDecodedScalarValue(
	value: unknown,
): value is DecodedScalarValue {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as Partial<DecodedScalarValue>).__decodedScalar === true
	);
}

/**
 * Decode a response for display. An explicit chain `hrp` (from the chain
 * registry) takes precedence; otherwise the prefix is inferred from any valid
 * bech32 string in the response.
 */
export function decodeBinaryValuesForDisplay<T>(
	value: T,
	context?: ResponseFieldContextMap,
	hrp?: string,
): T | DecodedBinaryValue | DecodedScalarValue {
	return decodeNode(value, context, "", hrp ?? inferBech32Prefix(value));
}

function decodeNode<T>(
	value: T,
	context: ResponseFieldContextMap | undefined,
	path: string,
	hrp: string | undefined,
): T | DecodedBinaryValue | DecodedScalarValue {
	if (value === null || value === undefined) return value;

	if (typeof value === "string") {
		const fieldContext = context?.[path];
		const effectiveContext =
			fieldContext && hrp ? { ...fieldContext, hrp } : fieldContext;

		// String-encoded Cosmos sdk.Dec values (e.g. min_commission_rate) are not
		// binary; interpret them directly from the descriptor metadata.
		if (isCosmosDecimal(effectiveContext)) {
			const interpretation = interpretCosmosDecimal(value, effectiveContext);
			if (interpretation) {
				return { __decodedScalar: true, original: value, interpretation };
			}
		}

		const decoded = inspectBinaryValue(value, effectiveContext);
		if (!decoded) return value;

		if (decoded.json !== undefined) {
			// Embedded JSON has no schema; decode it without the parent field context.
			decoded.json = decodeNode(decoded.json, undefined, "", hrp);
		}

		return decoded;
	}

	if (Array.isArray(value)) {
		return value.map((item) => decodeNode(item, context, path, hrp)) as T;
	}

	if (typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, child]) => [
				key,
				decodeNode(child, context, path ? `${path}.${key}` : key, hrp),
			]),
		) as T;
	}

	return value;
}
