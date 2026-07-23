import { describe, expect, it } from 'vitest';
import { isServiceDescriptorReady, servicesNeedingDescriptors } from '@/lib/utils/descriptor-readiness';
import type { GrpcService } from '@/lib/types/grpc';

const emptyRequestService: GrpcService = {
	name: 'Query',
	fullName: 'example.v1.Query',
	descriptorStatus: 'loaded',
	methods: [{
		name: 'Params',
		fullName: 'example.v1.Query.Params',
		serviceName: 'example.v1.Query',
		requestType: 'example.v1.ParamsRequest',
		responseType: 'example.v1.ParamsResponse',
		requestStreaming: false,
		responseStreaming: false,
		requestTypeDefinition: { name: 'ParamsRequest', fullName: 'example.v1.ParamsRequest', fields: [] },
		responseTypeDefinition: { name: 'ParamsResponse', fullName: 'example.v1.ParamsResponse', fields: [] },
	}],
};

describe('descriptor readiness', () => {
	it('treats an explicitly loaded empty protobuf request as ready', () => {
		expect(isServiceDescriptorReady(emptyRequestService)).toBe(true);
		expect(servicesNeedingDescriptors([emptyRequestService])).toEqual([]);
	});

	it('keeps a v2alpha1-only service pending even when it has method names', () => {
		const pendingService: GrpcService = { ...emptyRequestService, descriptorStatus: 'pending' };

		expect(isServiceDescriptorReady(pendingService)).toBe(false);
		expect(servicesNeedingDescriptors([pendingService])).toEqual([pendingService]);
	});
});
