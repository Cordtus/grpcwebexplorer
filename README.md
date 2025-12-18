# gRPC Web Explorer

Web interface for exploring and interacting with gRPC services via server reflection. Supports multiple concurrent endpoints with auto-generated forms and real-time execution.

## Features

- **Multi-Network**: Concurrent connections to multiple gRPC endpoints with color-coded interface (8 colors)
- **Chain Registry Integration**: Direct access to 100+ Cosmos chain endpoints with automatic fallback
- **Round-Robin Endpoints**: Optional load distribution across all available chain endpoints (configurable)
- **Recently Used Chains**: Quick re-selection of previously cached chains from the Add Network dialog
- **Auto-Generated Forms**: Type-specific input fields generated from protobuf definitions
- **Smart Search**: Filter services/methods by namespace, service name, or method name with sticky search bar
- **Client-Side Caching**: Configurable TTL (None/1hr/6hr/24hr/36hr/72hr/Never), localStorage-backed
- **Base64 Decoding**: Automatic decoding of bytes fields in gRPC responses to human-readable strings
- **Resizable Layout**: 3-panel interface with adjustable widths and collapsible sections
- **Responsive Design**: Overlay mode for screens <1024px, adaptive panel sizing 1024px-1600px
- **Method Pinning**: Pin method panels to prevent auto-collapse
- **Keyboard Shortcuts**: Full navigation support (`Cmd/Ctrl+Shift+?` for help)
- **Theme Support**: Light, dark, retro (8-bit), or system preference
- **Execution History**: Last 50 method executions with timing data

## Requirements

- Node.js 20+
- Yarn package manager

## Quick Start

### Development

```bash
yarn install
yarn dev          # http://localhost:3000
```

### Production

```bash
yarn build:prod
yarn start:prod   # Auto-detects available port (starts at 3000)
```

### Docker

```bash
yarn docker:build
yarn docker:up    # http://localhost:3000
yarn docker:logs  # View logs
yarn docker:down  # Stop container
```

See [deployment/README.md](deployment/README.md) for systemd service configuration and advanced deployment options.

## Usage

### Adding Networks

The Add Network dialog features a searchable dropdown of all chains from the Cosmos Chain Registry.

**Select from chain list** (recommended):
1. Click "Add Network" (or `Cmd/Ctrl+N`)
2. The dropdown shows all available chains - type to filter
3. Click a chain name to select it
4. With **Round-robin ON**: Chain is added immediately with all endpoints
5. With **Round-robin OFF**: Choose "Use All Endpoints" or pick a specific one

**Direct endpoint** (for custom gRPC servers):
1. Paste or type a gRPC endpoint (e.g., `grpc.myserver.com:443`)
2. The label changes to "Direct Endpoint" when you enter an address
3. Configure TLS toggle as needed
4. Click "Add Network"

**Recently used chains**:
1. Click "Recent" button (shows count of cached chains)
2. Select from chains you've used before
3. Shows chain-id, service count, and cache age

### Executing Methods

1. Expand network → service → click method name
2. Complete auto-generated form fields
3. Click "Execute Method" (or `Cmd/Ctrl+Enter`)
4. View response in results panel (right side)

### Settings

Access via menu bar (top-right gear icon):

- **Theme**: System, Light, Dark, or 8-bit Retro
- **Request Timeout**: Default gRPC request timeout (1s-60s)
- **Auto-Collapse Panels**: Enable/disable automatic panel collapse on selection
- **Round-Robin Endpoints**: Toggle load distribution across available endpoints
  - Disabled (default): Uses primary endpoint for all method calls
  - Enabled: Rotates through all available endpoints per request
- **Cache Duration**: None/1hr/6hr/24hr/36hr/72hr/Never (default: Never)
- **Cache Management**: View statistics and clear cache

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+N` | Add network |
| `Cmd/Ctrl+W` | Close active method tab |
| `Cmd/Ctrl+Enter` | Execute selected method |
| `Cmd/Ctrl+Shift+?` | Show help dialog |

### Panel Management

- **Method Descriptor Panel**: Three states (expanded/small/minimized) via chevron controls
- **Network Panel**: Collapsible via chevron button, overlay mode on narrow screens
- **Method Pinning**: Pin icon in method header prevents auto-collapse
- **Resizable Dividers**: Drag handles between panels to adjust widths

## Architecture

### Technology Stack

- **Framework**: Next.js 14 (App Router, Server Components)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 3.4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **gRPC**: @grpc/grpc-js, @grpc/proto-loader, protobufjs
- **State Management**: React hooks, localStorage persistence
- **Layout**: react-resizable-panels
- **Icons**: lucide-react

### Proxy Architecture

```
Browser (HTTP/JSON) → Next.js API Routes → gRPC Server (gRPC protocol)
```

Standard gRPC servers use HTTP/2 with protocol-specific framing that browsers cannot handle directly. This application proxies requests through Next.js API routes to translate between browser-compatible HTTP/JSON and native gRPC.

### API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/grpc/services` | POST | Service discovery via server reflection |
| `/api/grpc/execute` | POST | Method invocation with parameter marshalling |
| `/api/chains` | GET | Cosmos chain registry list |
| `/api/chains?name={chain}` | GET | Chain-specific endpoint data |

### Request Flow

1. **Service Discovery**:
   - POST to `/api/grpc/services` with `{endpoint, tlsEnabled}`
   - Server uses gRPC reflection to enumerate services/methods
   - Response cached client-side with configurable TTL
   - Network state persisted to localStorage

2. **Method Execution**:
   - POST to `/api/grpc/execute` with `{endpoint, tlsEnabled, service, method, params}`
   - Server constructs gRPC client, marshals parameters to protobuf
   - Response unmarshalled to JSON and returned to client
   - Execution result added to history (max 50 entries)

3. **Chain Registry**:
   - GET `/api/chains` fetches chain list from GitHub API (cached 1 hour)
   - GET `/api/chains?name={chain}` fetches chain.json from cosmos/chain-registry
   - gRPC endpoints extracted and normalized (port 443 → TLS enabled)

### Caching Strategy

- **Service Discovery**: Client-side localStorage with user-configurable TTL (None to Never)
- **Network State**: Persisted to localStorage with same TTL as service cache
- **Recently Used Chains**: All cached chains can be quickly re-added via "Recent" button
- **Chain Registry**: Server-side in-memory cache (1 hour TTL)
- **Automatic Invalidation**: Cache respects TTL, manual clear available in settings

### Directory Structure

```
/
├── app/
│   ├── api/
│   │   ├── chains/         # Chain registry endpoints
│   │   └── grpc/
│   │       ├── execute/    # Method execution
│   │       └── services/   # Service discovery
│   ├── layout.tsx          # Root layout with theme provider
│   └── page.tsx            # Entry point (dynamic import)
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── AddNetworkDialog.tsx
│   ├── GrpcExplorerApp.tsx # Main application component
│   ├── MethodBlock.tsx
│   ├── NetworkBlock.tsx
│   ├── ProtobufFormGenerator.tsx
│   ├── ResultsPanel.tsx
│   ├── SettingsDialog.tsx
│   └── ThemeProvider.tsx
├── lib/
│   ├── contexts/           # React contexts (TabManager)
│   ├── grpc/              # gRPC reflection utilities
│   ├── hooks/             # Custom hooks (keyboard shortcuts, execution history)
│   ├── services/          # Chain registry API client
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Client cache, colors, debug logging
├── deployment/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── start-server.js    # Custom production server with port detection
│   ├── systemd.service
│   └── test-grpc-reflection.js
├── public/                # Static assets (favicon, icons, manifest)
└── styles/                # Global CSS

```

## Development

### Available Scripts

```bash
yarn dev          # Development server (port 3000)
yarn build        # Production build
yarn build:prod   # Production build with telemetry disabled
yarn start        # Start production server
yarn start:prod   # Start production server (NODE_ENV=production)
yarn lint         # ESLint
yarn test:grpc    # gRPC reflection integration tests
```

### Key Components

- **GrpcExplorerApp**: Root component managing networks, methods, execution state, and round-robin distribution
- **NetworkBlock**: Collapsible network panel with service tree and smart search (namespace/service/method filtering)
- **MethodBlock**: Method instance with form and execution controls
- **ProtobufFormGenerator**: Recursive form generator for protobuf message types
- **AddNetworkDialog**: Network configuration with chain registry browser and recently used chains
- **SettingsDialog**: Application settings (theme, cache, behavior, round-robin)
- **ThemeProvider**: Theme management with localStorage persistence

### Adding New Features

1. **New API Route**: Add route handler in `app/api/`
2. **UI Component**: Add component in `components/`, use existing shadcn/ui primitives
3. **Type Definitions**: Extend types in `lib/types/grpc.ts`
4. **State Management**: Use React hooks in `GrpcExplorerApp.tsx` or create context in `lib/contexts/`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port (production) | `3000` |
| `GRPC_ENDPOINTS` | Comma-separated default endpoints | None |
| `NEXT_TELEMETRY_DISABLED` | Disable Next.js telemetry | `1` (prod build) |

## Troubleshooting

### Cache Issues

- Menu bar → cache indicator → "Clear Cache" button
- Or use Settings → Cache → "Clear Cache"
- Check cache TTL in Settings if data appears stale

### Reflection Failures

- Verify gRPC server has reflection enabled
- Confirm TLS setting matches server configuration (port 443 typically requires TLS)
- Check endpoint format: `hostname:port` (no protocol prefix)

### Chain Registry

- Rate limit: 60 requests/hour (GitHub API)
- Cached for 1 hour after first request
- Fallback to manual endpoint entry if registry unavailable

### Network Connectivity

- Browser must be able to reach Next.js server
- Next.js server must have network access to gRPC endpoints
- Firewalls must allow outbound connections on gRPC ports (typically 9090, 443)

### Build/Deploy Errors

- Ensure Node.js 20+ installed (`node --version`)
- Clear `.next` directory and rebuild
- For Docker: verify Docker daemon running and sufficient disk space
- For systemd: check service logs with `journalctl -u grpc-explorer -f`

## Testing

Run gRPC reflection integration tests:

```bash
yarn dev          # Start dev server in one terminal
yarn test:grpc    # Run tests in another terminal
```

Tests validate:
- Service discovery via reflection
- Method invocation
- Type definition parsing
- Error handling

## License

MIT
