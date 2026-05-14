import { describe, expect, it } from 'vitest';
import {
	decodeBinaryValuesForDisplay,
	inspectBase64Value,
	isDecodedBinaryValue,
} from '@/lib/utils/response-decoder';

describe('response decoder', () => {
	it('annotates printable base64 text without replacing the original value', () => {
		const decoded = inspectBase64Value('SGVsbG8=');

		expect(decoded).toMatchObject({
			__decodedBinary: true,
			encoding: 'base64',
			original: 'SGVsbG8=',
			byteLength: 5,
			text: 'Hello',
		});
	});

	it('annotates binary base64 with byte metadata', () => {
		const decoded = inspectBase64Value('AAECAwQ=');

		expect(decoded).toMatchObject({
			__decodedBinary: true,
			encoding: 'base64',
			original: 'AAECAwQ=',
			byteLength: 5,
			hexPreview: '00 01 02 03 04',
		});
		expect(decoded).not.toHaveProperty('text');
	});

	it('leaves ordinary strings alone', () => {
		expect(inspectBase64Value('cosmoshub-4')).toBeNull();
		expect(inspectBase64Value('test')).toBeNull();
	});

	it('does not annotate hex hashes or plain opaque tokens as base64', () => {
		expect(inspectBase64Value('deadbeefdeadbeef')).toBeNull();
		expect(inspectBase64Value('0123456789abcdef0123456789abcdef')).toBeNull();
		expect(inspectBase64Value('abcdefghijklmnop')).toBeNull();
	});

	it('recurses through arrays and objects without mutating input', () => {
		const input = {
			id: 'cosmoshub-4',
			values: ['SGVsbG8=', null],
			nested: { payload: 'AAECAwQ=' },
		};

		const output = decodeBinaryValuesForDisplay(input);

		expect(output).not.toBe(input);
		expect(input.values[0]).toBe('SGVsbG8=');
		expect(isDecodedBinaryValue((output as any).values[0])).toBe(true);
		expect(isDecodedBinaryValue((output as any).nested.payload)).toBe(true);
		expect((output as any).id).toBe('cosmoshub-4');
	});
});
