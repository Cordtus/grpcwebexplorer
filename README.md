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

Build the application for production:

```bash
yarn build:prod
```

## Running in Production

Start the production server:

```bash
yarn start
# Or with custom port
PORT=3001 yarn start
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
- `yarn build:prod` - Build production with telemetry disabled
- `yarn start` - Run production server
- `yarn lint` - Run ESLint
- `yarn docker:build` - Build Docker image
- `yarn docker:up` - Start Docker container
- `yarn docker:down` - Stop Docker container
- `yarn docker:logs` - View Docker logs

## Docker Deployment

### Using Docker Compose (Recommended)

The easiest way to deploy the application:

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

The application will be available at `http://localhost:3000`

### Using Docker Directly

Build the Docker image:

```bash
docker build -t grpc-explorer .
```

Run the container:

```bash
docker run -d \
  --name grpc-explorer \
  -p 3000:3000 \
  -v grpc-cache:/app/.cache \
  -e NODE_ENV=production \
  grpc-explorer
```

### Docker Configuration

The Docker setup includes:
- Multi-stage build for optimized image size
- grpcurl pre-installed for gRPC communication
- Persistent cache volume for service definitions
- Production-optimized Node.js configuration
- Automatic container restart on failure

## Alternative Deployment Methods

### PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
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