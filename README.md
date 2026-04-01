# gRPC Web Explorer

A web UI for gRPC servers, in the style of [Postman](https://www.postman.com/)
or [grpcui](https://github.com/fullstorydev/grpcui). Easily self-hosted, and works with any
gRPC servive over
[server reflection](https://github.com/grpc/grpc/blob/master/src/proto/grpc/reflection/v1/reflection.proto).
Schemas can also be imported from the [Buf Schema Registry](https://buf.build/) if reflection service is not exposed.

Requests are proxied through server-side API routes (browsers can't make native
gRPC calls), so the app needs a Node.js backend -- it's not purely client-side.

## Features

- Server reflection (v1/v1alpha, auto-detected) and BSR schema import
- Multiple simultaneous connections, color-coded
- Request forms generated from protobuf definitions (nested messages, repeated
  fields, enums, maps, all scalar types)
- Auth: Bearer tokens, API keys, mTLS
- Code export: grpcurl, curl/REST, TypeScript, Go, Python -- includes current
  params, metadata, and auth
- REST path mapping from `google.api.http` annotations
- Round-robin endpoints, DNS validation, automatic blacklisting on failure,
  TLS auto-retry
- Search by namespace, service, or method
- Client-side caching (configurable TTL, localStorage)
- Execution history with timing
- Keyboard shortcuts
- Light/Dark/Retro themes
- Optional Cosmos SDK chain registry integration (100+ chains)

## Installation

### Docker

```shell
docker compose -f deployment/docker-compose.yml up -d
```

### Yarn

Node.js 20+.

```shell
yarn install
yarn build:prod
yarn start:prod
```

Auto-detects an available port starting at 3000.

### Development

```shell
yarn install
yarn dev
```

See [deployment/README.md](deployment/README.md) for systemd and other deployment
options.

## Usage

### Connecting

`Cmd/Ctrl+N` opens the connection dialog. Two modes:

**Generic gRPC** (default) has two tabs:

- *Endpoint* -- enter `host:port`, configure TLS and optional auth (Bearer,
  API key, or mTLS). Discovers services via reflection.

- *buf.build* -- search BSR modules by org or browse popular ones. Pick a
  module and version, provide an execution endpoint. Private modules supported
  with auth token.

**Cosmos SDK** -- searchable chain registry. Select a chain to pull its gRPC
endpoints from [cosmos/chain-registry](https://github.com/cosmos/chain-registry).
Supports multi-endpoint selection for round-robin. Endpoints are DNS-validated
before use.

Both modes show recently used connections.

### Browsing

Services are listed by namespace in the left panel. The search bar filters
across namespaces, services, and methods.

### Executing

Select a method to get a generated form. Fill in fields, hit **Execute**
(`Cmd/Ctrl+Enter`). The right panel shows:

- **Proto** -- request/response type definitions
- **Code** -- client stubs in 5 languages (snippet or full scaffold)
- **Results** -- response JSON, timing, status

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+N` | Add network |
| `Cmd/Ctrl+W` | Close tab |
| `Cmd/Ctrl+Enter` | Execute |
| `Cmd/Ctrl+/` | Focus search |
| `Cmd/Ctrl+Tab` | Next tab |
| `Cmd/Ctrl+Shift+Tab` | Previous tab |
| `Cmd/Ctrl+Shift+E` | Export params |
| `Cmd/Ctrl+Shift+I` | Import params |
| `Cmd/Ctrl+Shift+?` | Shortcut help |

### Settings

Gear icon in the menu bar:

- Theme (Light, Dark, 8-bit Retro, System)
- Default mode (Generic / Cosmos)
- Request timeout (1s--60s, default 10s)
- Auto-collapse panels
- Cache TTL (None / 1hr / 6hr / 24hr / 36hr / 72hr / Never)

## Architecture

```
Browser (JSON)  -->  Next.js API Routes  -->  gRPC Server (protobuf/HTTP2)
```

### Routes

| Route | Purpose |
|---|---|
| `POST /api/grpc/services` | Service discovery via reflection |
| `POST /api/grpc/execute` | RPC invocation |
| `POST /api/grpc/descriptor` | Lazy-load service field definitions |
| `POST /api/grpc/validate-endpoints` | DNS validation |
| `POST /api/grpc/test-compatibility` | Bulk method testing |
| `GET /api/bsr/modules` | BSR module search |
| `POST /api/bsr/descriptor` | Fetch FileDescriptorSet from BSR |
| `GET /api/chains` | Cosmos chain registry |

### Reflection

Custom implementation on `@grpc/grpc-js` and `protobufjs`. Supports v1 and
v1alpha with auto-detection. Recursively resolves nested type dependencies
(depth limit 50). Cosmos chains also try v2alpha1 for faster service enumeration.

### Endpoint Management

Tracks per-endpoint health: success/failure counts, response times. Blacklists
after 5 consecutive failures (recovers after 3 successes or 1 hour). Retries
without TLS on SSL errors.

## Environment Variables

| Variable | Default |
|---|---|
| `PORT` | `3000` |
| `NEXT_TELEMETRY_DISABLED` | `1` (prod build) |

## Testing

```shell
yarn test              # Unit tests (vitest)
yarn test:watch        # Watch mode
yarn test:coverage     # Coverage

# Integration (needs dev server running)
yarn dev               # Terminal 1
yarn test:grpc         # Terminal 2
```

## Troubleshooting

**Connection failures**: Endpoint format is `host:port`, no protocol prefix.
Port 443 usually needs TLS on; other ports usually need it off. The UI warns
on mismatches and retries without TLS on SSL errors.

**No services**: Server must support reflection, or import from BSR. No
`.proto` / protoset support.

**BSR issues**: Module path is `owner/repository`. Version defaults to `main`.
Private modules need an auth token.

**Stale data**: Check cache TTL in settings, or clear via the menu bar cache
indicator.

**Unreachable endpoints**: DNS validation runs before connecting. If all
endpoints fail, verify the server has outbound access to the gRPC ports
(typically 9090, 443).

## License

MIT
