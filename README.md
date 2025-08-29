# gRPC Web Explorer

A web-based interface for exploring and interacting with gRPC services through reflection. The application provides a three-panel layout for service discovery, method inspection, and real-time execution.

## Prerequisites

- Node.js 14.0 or higher
- Yarn package manager
- grpcurl installed locally (`brew install grpcurl` on macOS)

## Installation

```bash
git clone <repository-url>
cd grpcWebExplorer
yarn install
```

## Development

Start the development server:

```bash
yarn dev
```

The application will be available at `http://localhost:3000`

## Production Build

```bash
yarn build:prod
```

The production build generates a standalone Node.js application in `.next/standalone/`

## Running in Production

```bash
cd .next/standalone
NODE_ENV=production PORT=3000 node server.js
```

## Usage

### Connecting to gRPC Services

1. Click "Add Network" in the application header
2. Enter the gRPC endpoint (e.g., `grpc.example.com` or `grpc.example.com:443`)
3. Configure TLS settings if required
4. The application will automatically discover available services through reflection

### Service Discovery

The left panel displays connected networks and their services. Services are organized hierarchically and can be expanded to reveal available methods. The application caches service definitions by chain ID (for blockchain services) or by endpoint to improve performance.

### Method Execution

1. Select a method from the service tree
2. The method descriptor appears in the center panel showing request/response types
3. Enter JSON parameters in the right panel's editor
4. Click "Execute" to invoke the method
5. View the response in the results section below

### Caching

Service definitions are cached locally in `.cache/` directory with a 1-hour TTL. The cache uses chain IDs when available (fetched via `GetLatestBlock` for Cosmos-based chains) to ensure multiple endpoints for the same chain share cached data.

### Keyboard Shortcuts

- `Ctrl/Cmd + N`: Add new network
- `Ctrl/Cmd + K`: Show keyboard shortcuts
- `Ctrl/Cmd + H`: Show execution history
- `Ctrl/Cmd + W`: Close active tab
- `Ctrl/Cmd + Tab`: Cycle through tabs

## Architecture

### Technology Stack

- **Framework**: Next.js 14 with App Router
- **UI Components**: Tailwind CSS with shadcn/ui
- **State Management**: React hooks and contexts
- **gRPC Communication**: grpcurl via child process execution
- **Caching**: File-based cache with LRU in-memory layer

### Directory Structure

```
app/
├── api/grpc/         # API routes for gRPC operations
│   ├── services/     # Service discovery endpoint
│   └── execute/      # Method execution endpoint
components/
├── NetworkPanel.tsx           # Left panel - service tree
├── MethodTabsPanel.tsx        # Center panel - method descriptors
└── MethodInteractionPanel.tsx # Right panel - parameter editor
lib/
├── grpc/             # gRPC client utilities
├── hooks/            # Custom React hooks
└── utils/            # Helper functions
```

### API Endpoints

**POST /api/grpc/services**
```json
{
  "endpoint": "grpc.example.com",
  "tlsEnabled": true,
  "forceRefresh": false
}
```

Returns discovered services with their methods and chain ID if applicable.

**POST /api/grpc/execute**
```json
{
  "endpoint": "grpc.example.com",
  "service": "cosmos.bank.v1beta1.Query",
  "method": "Balance",
  "params": {},
  "tlsEnabled": true
}
```

Executes the specified gRPC method and returns the response.

## Configuration

### Environment Variables

Create `.env.local` for custom configuration:

```bash
# Optional: Pre-configured endpoints
GRPC_ENDPOINTS=endpoint1:443,endpoint2:9090

# Optional: Cache directory (defaults to .cache)
CACHE_DIR=/path/to/cache
```

### Package Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn build:prod` - Build standalone production bundle
- `yarn start:prod` - Run production server
- `yarn lint` - Run ESLint

## Deployment

### PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
```

### systemd

```ini
[Unit]
Description=gRPC Web Explorer
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/.next/standalone
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

## Testing Common Endpoints

### Cosmos Ecosystem

- `grpc.cosmos.directory:443` - Cosmos Hub
- `grpc.juno.basementnodes.ca:443` - Juno Network
- `grpc.noble.basementnodes.ca:443` - Noble Chain
- `grpc.neutron.basementnodes.ca:443` - Neutron

### Configuration for Testing

All endpoints above use TLS by default. For local development servers, disable TLS and use appropriate ports (typically 9090 for gRPC).

## Troubleshooting

### grpcurl not found

Install grpcurl:
```bash
# macOS
brew install grpcurl

# Linux
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest
```

### Connection Issues

- Verify the endpoint is accessible: `grpcurl <endpoint> list`
- Check TLS settings match the server configuration
- Ensure the server has reflection enabled
- For blockchain nodes, verify the gRPC port (usually 9090 or 443)

### Cache Issues

Clear the cache directory:
```bash
rm -rf .cache/
```

Or use force refresh when connecting to update cached service definitions.

## License

MIT