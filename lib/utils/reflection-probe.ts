export type ReflectionFailureKind = 'incompatible' | 'transient';

export function classifyReflectionFailure(message: string): ReflectionFailureKind {
  const normalized = message.toLowerCase();
  return normalized.includes('permission_denied') ||
    normalized.includes('http status code 403') ||
    normalized.includes('unimplemented') ||
    normalized.includes('http status code 404')
    ? 'incompatible'
    : 'transient';
}
