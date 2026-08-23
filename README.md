# gRPC Web Explorer

A web UI for gRPC servers, in the style of [Postman](https://www.postman.com/)
or [grpcui](https://github.com/fullstorydev/grpcui). Easily self-hosted, works with any
gRPC service that supports [reflection](https://github.com/grpc/grpc/blob/master/src/proto/grpc/reflection/v1/reflection.proto).
Schemas can be imported from the [Buf Schema Registry](https://buf.build/) if reflection service is not supported / exposed.

Requests proxy through Next.js API routes using `@grpc/grpc-js`. Deploys to
Vercel as-is or self-host via Docker / Node.js.

## Features

- Server reflection (v1/v1alpha, auto-detected) and BSR schema import
- Multiple simultaneous connections, color-coded
- Request forms generated from protobuf definitions (nested messages, repeated
  fields, enums, maps, all scalar types)
- Auth: Bearer tokens, API keys, mTLS
- Code stub export: grpcurl, curl/REST, TypeScript, Go, Python -- includes current
  params, metadata, and auth
- Optional base64/binary response inspection that parses decoded JSON when
  present, preserving original response JSON for copy and save actions
- REST path mapping from `google.api.http` annotations
- Search by namespace, service, or method
- Cosmos SDK chain registry integration

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

Runs on first available port, starting at 3000.

### Development Server

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

**Cosmos SDK** is the original purpose of this application, preserved as an entirely separate mode with its own wofkflow. Either search / select a chain to pull any registered gRPC endpoints from [cosmos/chain-registry](https://github.com/cosmos/chain-registry).
Supports multi-endpoint selection for round-robin execution.
Endpoints are DNS-validated only.

### Browsing

Services are listed by namespace in the left source/network panel. The search
bar filters across namespaces, services, and methods.

### Executing

Select a method to get a generated form. Fill in fields, hit **Execute**
(`Cmd/Ctrl+Enter`). The right panel shows:

- **Proto** -- request/response type definitions
- **Code** -- client stubs in 5 languages (snippet or full scaffold)
- **Results** -- response JSON, timing, status

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+N` | Open connection dialog |
| `Cmd/Ctrl+W` | Close tab |
| `Cmd/Ctrl+Enter` | Execute |
| `Cmd/Ctrl+Shift+?` | Shortcut help |

### Settings

Basic UI / UX preferences:
- Theme (Light, Dark, 8-bit Retro, System)
- Default mode (Generic / Cosmos)
- Service discovery timeout (1s--60s, default 10s)
- Auto-collapse panels
- Cache TTL (None / 1hr / 6hr / 24hr / 36hr / 72hr / Never)

## Technical Notes

### Routes

| Route | Purpose |
|---|---|
| `POST /api/grpc/services` | Service discovery via reflection |
| `POST /api/grpc/execute` | RPC invocation |
| `POST /api/grpc/descriptor` | Lazy-load service field definitions |
| `POST /api/grpc/validate-endpoints` | DNS plus bounded gRPC reflection qualification |
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

## License

MIT
