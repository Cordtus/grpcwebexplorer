// lib/grpc/client.ts
import { credentials, loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { getCache, setCache } from './cache';

const SERVICES_CACHE = (endpoint: string) => `services:${endpoint}`;
const METHODS_CACHE = (endpoint: string, svc: string) => `methods:${endpoint}:${svc}`;

/**
 * You can drive this from an ENV var, or hard-code known endpoints.
 */
export function listEndpoints(): string[] {
  return (process.env.GRPC_ENDPOINTS || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);
}

/**
 * List services at `endpoint`. Replace the loadSync stub
 * with a reflection call when you pull in a reflection helper.
 */
export async function listServices(endpoint: string): Promise<string[]> {
  const cacheKey = SERVICES_CACHE(endpoint);
  const cached = await getCache<string[]>(cacheKey);
  if (cached) return cached.data;

  // TODO: replace with reflection-based enumeration
  const pkgDef = loadSync(
    /* path to your .proto for this endpoint if you have it,
       or else leave a TODO to wire up grpc-reflection */
    `${process.env.GRPC_PROTO_PATH}/${endpoint}.proto`,
    { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
  );
  const pkg = loadPackageDefinition(pkgDef) as any;
  const services = Object.keys(pkg[endpoint] || {});
  await setCache({
    key: cacheKey,
    data: services,
    timestamp: Date.now()
  });
  return services;
}

/**
 * List methods on a given service.
 */
export async function listMethods(endpoint: string, service: string): Promise<string[]> {
  const cacheKey = METHODS_CACHE(endpoint, service);
  const cached = await getCache<string[]>(cacheKey);
  if (cached) return cached.data;

  // TODO: replace with reflection-based enumeration
  const pkgDef = loadSync(
    `${process.env.GRPC_PROTO_PATH}/${endpoint}.proto`,
    { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
  );
  const pkg = loadPackageDefinition(pkgDef) as any;
  const svc = pkg[endpoint][service];
  const methods = Object.keys(svc.service || {});
  await setCache({
    key: cacheKey,
    data: methods,
    timestamp: Date.now()
  });
  return methods;
}

/**
 * Make a unary RPC.
 */
export async function callUnary(
  endpoint: string,
  service: string,
  method: string,
  message: unknown
): Promise<any> {
  // TODO: swap this for reflection-based client factory
  const pkgDef = loadSync(
    `${process.env.GRPC_PROTO_PATH}/${endpoint}.proto`,
    { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
  );
  const pkg = loadPackageDefinition(pkgDef) as any;
  const Client = pkg[endpoint][service] as any;
  const client = new Client(endpoint, credentials.createInsecure());
  return new Promise((resolve, reject) => {
    client[method](message, (err: any, resp: any) => {
      if (err) reject(err);
      else resolve(resp);
    });
  });
}

/**
 * Make a server-streaming RPC.
 */
export function callStream(
  endpoint: string,
  service: string,
  method: string,
  message: unknown,
  onData: (data: any) => void,
  onEnd: () => void,
  onError: (err: any) => void
): void {
  // TODO: swap this for reflection-based client factory
  const pkgDef = loadSync(
    `${process.env.GRPC_PROTO_PATH}/${endpoint}.proto`,
    { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
  );
  const pkg = loadPackageDefinition(pkgDef) as any;
  const Client = pkg[endpoint][service] as any;
  const client = new Client(endpoint, credentials.createInsecure());
  const stream = client[method](message);
  stream.on('data', onData);
  stream.on('end', onEnd);
  stream.on('error', onError);
}
