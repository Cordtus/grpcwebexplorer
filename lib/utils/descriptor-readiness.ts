import type { GrpcService } from '@/lib/types/grpc';

/**
 * A pending service came from the Cosmos v2alpha1 summary and still needs its
 * full protobuf descriptor. A loaded service may legitimately have an empty
 * request message, so field count is not a readiness signal.
 */
export function isServiceDescriptorReady(service: Pick<GrpcService, 'descriptorStatus'>): boolean {
  return service.descriptorStatus !== 'pending';
}

export function servicesNeedingDescriptors(services: GrpcService[]): GrpcService[] {
  return services.filter(
    (service) => service.methods.length > 0 && !isServiceDescriptorReady(service)
  );
}
