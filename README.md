# gRPC Web Explorer

`grpc-web-explorer` is a web-based tool for interacting with gRPC servers. It's
like [Postman](https://www.postman.com/) or [grpcui](https://github.com/fullstorydev/grpcui),
but runs as a self-hosted web application with built-in support for
[Cosmos SDK](https://cosmos.network/) chains.

The tool uses [server reflection](https://github.com/grpc/grpc/blob/master/src/proto/grpc/reflection/v1/reflection.proto)
to discover services and methods, then dynamically generates input forms from protobuf
schemas. You select a method, fill in the fields, hit execute, and see the response --
no `.proto` files or code generation required.

Because browsers can't speak gRPC natively (HTTP/2 with binary framing), the application
proxies requests through Next.js API routes: your browser sends JSON, the server translates
it to protobuf and forwards it over gRPC, then returns the response as JSON.

## Features

- Connect to multiple gRPC endpoints simultaneously, with color-coded UI to keep them distinct
- Auto-generated request forms from protobuf definitions -- supports nested messages, repeated
  fields, enums, maps, and all scalar types
- Hierarchical search across namespaces, services, and methods
- Cosmos chain registry integration with 100+ chains available out of the box
- Round-robin load distribution across multiple endpoints for the same chain
- Client-side caching with configurable TTL (1hr to indefinite) -- no server-side state
- Automatic base64 decoding of `bytes` fields in responses
- Execution history with timing data (last 50 per method)
- Both plaintext and TLS connections, with automatic TLS retry on SSL errors
- Supports v1 and v1alpha reflection protocols with automatic version detection
- Keyboard shortcuts for common operations

## Installation

### Docker (recommended)

```shell
docker compose -f deployment/docker-compose.yml up -d
```

The web UI is then available at `http://localhost:3000`.

### Yarn

Requires Node.js 20+.

```shell
yarn install
yarn build:prod
yarn start:prod
```

The server auto-detects an available port starting at 3000.

### Development

```shell
yarn install
yarn dev
```

Starts a dev server at `http://localhost:3000`.

See [deployment/README.md](deployment/README.md) for systemd service configuration and
other deployment options.

## Usage

When you open the application, you're presented with a three-panel interface: networks
on the left, method forms in the center, and results on the right.

### Connecting to a Server

Click **Add Network** (or `Cmd/Ctrl+N`) to open the connection dialog. You have three
options:

**Chain registry** -- type to search 100+ Cosmos chains. Select a chain and the tool
fetches its gRPC endpoints automatically. With round-robin enabled, all endpoints are
added for load distribution. Otherwise, pick a specific one.

**Direct endpoint** -- paste any gRPC address (e.g. `grpc.myserver.com:443`). Toggle
TLS as needed. Works with any gRPC server that supports reflection, not just Cosmos.

**Recently used** -- re-connect to chains you've used before. Shows chain ID, endpoint,
service count, and cache age.

### Browsing Services

Once connected, the left panel shows all services discovered via reflection, organized
by namespace. Use the search bar to filter:

- Type a namespace prefix (e.g. `cosmos.bank`) to see all services in that namespace
- Type a service name to see all its methods
- Type a method name to jump directly to matching methods

Click a method name to open it in the center panel.

### Executing RPCs

The center panel shows a dynamically generated form based on the method's protobuf
request type. Fill in the fields and click **Execute** (or `Cmd/Ctrl+Enter`).

The response appears in the right panel with:
- Response data (JSON)
- Protobuf schema for request and response types
- Execution timing

For methods that take no parameters (like many query methods), just hit execute with
the empty form.

### Caching

Service discovery results are cached client-side in localStorage. Configure the TTL
in Settings (gear icon): None, 1hr, 6hr, 24hr, 36hr, 72hr, or Never expire. The cache
indicator in the menu bar shows current cache status and provides a quick clear button.

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+N` | Add network |
| `Cmd/Ctrl+W` | Close active method tab |
| `Cmd/Ctrl+Enter` | Execute selected method |
| `Cmd/Ctrl+Shift+?` | Show keyboard shortcut help |

### Settings

Access via the gear icon in the menu bar:

- **Theme**: Light, Dark, 8-bit Retro, or match system preference
- **Request Timeout**: 1s -- 60s (default: 60s)
- **Auto-Collapse**: Automatically collapse panels when selecting new methods
- **Round-Robin**: Distribute requests across all available endpoints
- **Cache Duration**: Configure or disable client-side caching

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port (production) | `3000` |
| `GRPC_ENDPOINTS` | Comma-separated default endpoints | None |
| `NEXT_TELEMETRY_DISABLED` | Disable Next.js telemetry | `1` (prod build) |

## How It Works

```
Browser (HTTP/JSON)  -->  Next.js API Routes  -->  gRPC Server (protobuf/HTTP2)
```

The application exposes four API routes:

| Route | Purpose |
|---|---|
| `POST /api/grpc/services` | Service discovery via server reflection |
| `POST /api/grpc/execute` | Method invocation with JSON-to-protobuf marshalling |
| `GET /api/chains` | Cosmos chain registry listing (1hr server cache) |
| `GET /api/chains?name={chain}` | Endpoint data for a specific chain |

The reflection client supports both v1 and v1alpha protocols, detects the server's
version automatically, and recursively resolves nested protobuf type dependencies
(up to depth 50 for complex Cosmos SDK chains). For Cosmos chains, it also tries the
v2alpha1 `ReflectionService` for faster query/tx enumeration before falling back to
standard reflection.

## Troubleshooting

**Connection failures**: Verify the endpoint format is `hostname:port` with no protocol
prefix. Ensure TLS setting matches the server (port 443 typically requires TLS). The
application automatically retries without TLS on SSL errors.

**No services found**: The gRPC server must have
[reflection enabled](https://github.com/grpc/grpc/blob/master/doc/server-reflection.md#known-implementations).
Unlike grpcurl/grpcui, this tool does not support `.proto` files or protoset files as
descriptor sources -- reflection is required.

**Stale data**: Check cache TTL in Settings. Clear cache via the cache indicator in
the menu bar or Settings > Cache > Clear Cache.

**Chain registry rate limits**: The GitHub API allows 60 requests/hour. Chain data is
cached for 1 hour. If the registry is unavailable, use direct endpoint entry.

**Network issues**: The browser must reach the Next.js server, and the server must have
outbound access to gRPC endpoints (typically ports 9090, 443).

## License

MIT
