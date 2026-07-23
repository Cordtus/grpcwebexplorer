import { describe, expect, it } from 'vitest';
import { classifyReflectionFailure } from '@/lib/utils/reflection-probe';

describe('reflection probe failures', () => {
	it('classifies denied and unimplemented reflection as incompatible', () => {
		expect(classifyReflectionFailure('7 PERMISSION_DENIED: Received HTTP status code 403')).toBe('incompatible');
		expect(classifyReflectionFailure('12 UNIMPLEMENTED: Received HTTP status code 404')).toBe('incompatible');
	});

	it('classifies connection timeouts as transient', () => {
		expect(classifyReflectionFailure('14 UNAVAILABLE: connect ETIMEDOUT 167.235.196.205:8443')).toBe('transient');
	});
});
