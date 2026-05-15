export interface DecodedBinaryValue {
  __decodedBinary: true;
  encoding: 'base64';
  original: string;
  byteLength: number;
  hexPreview: string;
  text?: string;
  json?: unknown;
}

const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BASE64_MARKER_RE = /[+/=]/;
const HEX_RE = /^(?:0x)?[0-9a-fA-F]+$/;
const PRINTABLE_RE = /^[\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]*$/;
const TEXT_SIGNAL_RE = /[\s!"#$%&'()*,:;<=>?@[\\\]^`{|}~]/;

function decodeBase64(value: string): Uint8Array | null {
  try {
    const decoder = (globalThis as typeof globalThis & { atob?: (input: string) => string }).atob;
    if (decoder) {
      const binary = decoder(value);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    const bufferCtor = (globalThis as typeof globalThis & {
      Buffer?: { from: (input: string, encoding: 'base64') => Uint8Array };
    }).Buffer;

    return bufferCtor ? new Uint8Array(bufferCtor.from(value, 'base64')) : null;
  } catch {
    return null;
  }
}

function utf8Decode(bytes: Uint8Array): string | null {
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return decoded && PRINTABLE_RE.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function hexPreview(bytes: Uint8Array, limit = 32): string {
  return Array.from(bytes.slice(0, limit))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ');
}

function parseJsonText(text: string): unknown | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const first = trimmed[0];
  if (!['{', '[', '"', 't', 'f', 'n'].includes(first) && !/^-?\d/.test(trimmed)) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

export function inspectBase64Value(value: string): DecodedBinaryValue | null {
  const normalized = value.trim();

  if (
    normalized.length < 8 ||
    normalized.length % 4 !== 0 ||
    !BASE64_RE.test(normalized) ||
    HEX_RE.test(normalized)
  ) {
    return null;
  }

  const bytes = decodeBase64(normalized);
  if (!bytes || bytes.length === 0) return null;

  const text = utf8Decode(bytes);
  const hasBase64Marker = BASE64_MARKER_RE.test(normalized);

  if (!hasBase64Marker && (text === null || !TEXT_SIGNAL_RE.test(text))) {
    return null;
  }

  const decoded: DecodedBinaryValue = {
    __decodedBinary: true,
    encoding: 'base64',
    original: value,
    byteLength: bytes.length,
    hexPreview: hexPreview(bytes),
  };

  if (text !== null) {
    decoded.text = text;
    const json = parseJsonText(text);
    if (json !== undefined) {
      decoded.json = json;
    }
  }

  return decoded;
}

export function isDecodedBinaryValue(value: unknown): value is DecodedBinaryValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<DecodedBinaryValue>).__decodedBinary === true
  );
}

export function decodeBinaryValuesForDisplay<T>(value: T): T | DecodedBinaryValue {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    const decoded = inspectBase64Value(value);
    if (!decoded) return value;

    if (decoded.json !== undefined) {
      decoded.json = decodeBinaryValuesForDisplay(decoded.json);
    }

    return decoded;
  }

  if (Array.isArray(value)) {
    return value.map((item) => decodeBinaryValuesForDisplay(item)) as T;
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        decodeBinaryValuesForDisplay(child),
      ])
    ) as T;
  }

  return value;
}
