// Minimal BIP-173 bech32 codec (Cosmos uses bech32, not bech32m, for addresses).
// No dependency: the algorithm is small and stable.

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: number[]): number {
	let chk = 1;
	for (const value of values) {
		const top = chk >> 25;
		chk = ((chk & 0x1ffffff) << 5) ^ value;
		for (let i = 0; i < 5; i++) {
			if ((top >> i) & 1) chk ^= GENERATOR[i];
		}
	}
	return chk;
}

function hrpExpand(hrp: string): number[] {
	const out: number[] = [];
	for (const char of hrp) out.push(char.charCodeAt(0) >> 5);
	out.push(0);
	for (const char of hrp) out.push(char.charCodeAt(0) & 31);
	return out;
}

function createChecksum(hrp: string, data: number[]): number[] {
	const mod = polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
	return [0, 1, 2, 3, 4, 5].map((i) => (mod >> (5 * (5 - i))) & 31);
}

function convertBits(
	data: number[],
	from: number,
	to: number,
	pad: boolean,
): number[] | null {
	let acc = 0;
	let bits = 0;
	const maxv = (1 << to) - 1;
	const result: number[] = [];
	for (const value of data) {
		if (value < 0 || value >> from !== 0) return null;
		acc = (acc << from) | value;
		bits += from;
		while (bits >= to) {
			bits -= to;
			result.push((acc >> bits) & maxv);
		}
	}
	if (pad) {
		if (bits > 0) result.push((acc << (to - bits)) & maxv);
	} else if (bits >= from || ((acc << (to - bits)) & maxv) !== 0) {
		return null;
	}
	return result;
}

/** Encode raw bytes as a bech32 string with the given human-readable prefix. */
export function bech32Encode(hrp: string, bytes: Uint8Array): string | null {
	if (!hrp || hrp.length > 83 || /[^\x21-\x7e]/.test(hrp)) return null;
	if (hrp !== hrp.toLowerCase()) return null;

	const words = convertBits(Array.from(bytes), 8, 5, true);
	if (!words) return null;
	if (hrp.length + 1 + words.length + 6 > 90) return null;

	const checksum = createChecksum(hrp, words);
	return `${hrp}1${[...words, ...checksum].map((d) => CHARSET[d]).join("")}`;
}

/** Decode and checksum-verify a bech32 string. Returns null when invalid. */
export function bech32Decode(
	value: string,
): { hrp: string; data: Uint8Array } | null {
	if (typeof value !== "string" || value.length < 8 || value.length > 90) {
		return null;
	}
	if (value !== value.toLowerCase() && value !== value.toUpperCase()) {
		return null;
	}

	const lower = value.toLowerCase();
	const separator = lower.lastIndexOf("1");
	if (separator < 1 || separator + 7 > lower.length) return null;

	const hrp = lower.slice(0, separator);
	if (/[^\x21-\x7e]/.test(hrp)) return null;
	const data: number[] = [];
	for (const char of lower.slice(separator + 1)) {
		const index = CHARSET.indexOf(char);
		if (index === -1) return null;
		data.push(index);
	}

	if (polymod([...hrpExpand(hrp), ...data]) !== 1) return null;

	const bytes = convertBits(data.slice(0, -6), 5, 8, false);
	if (!bytes) return null;
	return { hrp, data: Uint8Array.from(bytes) };
}

/** Return the human-readable prefix of a valid bech32 string, else null. */
export function bech32Hrp(value: string): string | null {
	return bech32Decode(value)?.hrp ?? null;
}
