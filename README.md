# gRPC Web Explorer

Web interface for exploring and interacting with gRPC services via reflection. Multi-network support with auto-generated forms and real-time execution.

## Features

- **Multi-Network**: Connect to multiple gRPC endpoints with color-coded tabs
- **Chain Registry**: Quick setup with 100+ Cosmos chains
- **Auto Forms**: Type-specific inputs generated from protobuf definitions
- **Client Caching**: 1-hour localStorage cache (configurable)
- **Resizable Layout**: 3-panel interface with collapsible sections
- **Keyboard Shortcuts**: Full navigation support (`Cmd/Ctrl+Shift+?` for help)
- **Dark Mode**: Automatic theme detection

## Quick Start

**Requirements**: Node.js 20+, Yarn

```bash
yarn install
yarn dev          # http://localhost:3000
```

**Production**:
```bash
yarn build:prod
yarn start:prod   # Auto port selection
```

**Docker**:
```bash
yarn docker:build && yarn docker:up
```

See [deployment/README.md](deployment/README.md) for advanced deployment options.

## Usage

### Add Network

**Direct endpoint**:
1. Click "Add Network"
2. Enter endpoint (e.g., `grpc.cosmos.directory:443`)
3. Enable TLS for port 443
4. Click "Add Network"

**Chain registry**:
1. Click "Add Network" → "Browse Chain Registry"
2. Search and select chain
3. Choose endpoint or use round-robin

**Quick shortcut**: Enter chain name directly (e.g., "osmosis", "dydx")

### Execute Methods

1. Select network → Expand service → Click method
2. Fill auto-generated form
3. Click "Execute Method"
4. View response in right panel

### Settings

- **Cache Duration**: Adjust TTL (5min - 24hr)
- **Auto-Collapse**: Toggle panel auto-collapse behavior
- **Pin Methods**: Pin method panels to prevent auto-collapse

### Keyboard Shortcuts

- `Cmd/Ctrl+N` - Add network
- `Cmd/Ctrl+W` - Close method tab
- `Cmd/Ctrl+Enter` - Execute method
- `Cmd/Ctrl+Shift+?` - Help guide

## Architecture

**Stack**: Next.js 14, TypeScript, Tailwind, shadcn/ui, @grpc/grpc-js

**Proxy Pattern**:
```
Browser (HTTP) → Next.js API → gRPC Server
```

Required because browsers cannot connect to standard gRPC (non-gRPC-Web).

**API Endpoints**:
- `POST /api/grpc/services` - Service discovery
- `POST /api/grpc/execute` - Method execution
- `GET /api/chains` - Chain registry

## Development

### Project Structure

```
/app/api/grpc/     # API routes
/components/       # React components
/lib/grpc/        # gRPC client
/lib/utils/       # Utilities
/deployment/      # Docker, systemd, tests
```

### Key Components

- `GrpcExplorerApp` - Main layout and state
- `NetworkBlock` - Network panel with service tree
- `MethodBlock` - Method instance with form
- `ProtobufFormGenerator` - Type-aware form generation
- `AddNetworkDialog` - Network setup with registry

### Testing

```bash
yarn dev          # Start dev server
yarn test:grpc    # Run reflection tests
```

## Troubleshooting

**Cache issues**: Menu bar → Cache indicator → Clear cache

**Reflection fails**:
- Verify gRPC reflection enabled on server
- Check TLS settings match endpoint

**Chain registry rate limits**: 60 req/hour (GitHub API), cached 1 hour

## Environment Variables

- `NODE_ENV` - production | development
- `PORT` - Server port (default: 3000)
- `GRPC_ENDPOINTS` - Comma-separated default endpoints

## License

MIT
