# gRPC Web Explorer

Web-based interface for exploring and interacting with gRPC services via reflection. Features multi-network support, hierarchical method browsing, typed parameter forms, and real-time method execution.

## Features

- **Multi-Network Support**: Connect to multiple gRPC endpoints simultaneously with color-coded network tabs
- **Cosmos Chain Registry Integration**: Quick setup with 100+ Cosmos chains via integrated chain registry browser
- **Protobuf-Based Form Generation**: Automatically generates typed input forms from gRPC message definitions
  - Type-specific inputs (string, numbers, booleans, enums, arrays, nested messages)
  - Field validation with required/optional support
  - Array field management with add/remove controls
- **Client-Side Caching**: 1-hour localStorage cache for fast repeat access to endpoints
- **Resizable 3-Panel Layout**:
  - Left: Network tabs with hierarchical service/method trees
  - Center: Collapsible method descriptors (compact/normal/detailed views)
  - Right: Method execution with parameter forms and response viewer
- **Keyboard Shortcuts**: Full keyboard navigation support (press `Cmd/Ctrl+Shift+?` to open help guide)
- **Execution History**: Track and replay previous method executions
- **Dark Mode Support**: Automatic theme detection with manual toggle
- **Cache Management**: View cache statistics and clear cached data via menu bar

## Setup

**Requirements**: Node.js 20+, Yarn

```bash
yarn install
yarn dev          # Development server at http://localhost:3000
yarn build:prod   # Production build
yarn start:prod   # Production server (auto port selection)
```

**Docker**:
```bash
yarn docker:up    # Start container
yarn docker:down  # Stop container
```

## Usage

### Adding Networks

**Method 1: Direct Endpoint**
1. Click "Add Network" button
2. Enter gRPC endpoint (e.g., `grpc.cosmos.directory:443`)
3. Enable TLS toggle for port 443 endpoints
4. Click "Add Network"

**Method 2: Chain Registry**
1. Click "Add Network" button
2. Click "Browse Chain Registry"
3. Search for a chain (e.g., "Cosmos Hub", "Osmosis")
4. Select chain to view available gRPC endpoints
5. Click "Use All Endpoints (Round-Robin)" or select a specific endpoint

**Method 3: Chain Name Shortcut**
1. Click "Add Network" button
2. Type just the chain name (e.g., "dydx", "osmosis")
3. System auto-detects and uses round-robin across all chain endpoints

### Executing Methods

1. Select a network tab from the left panel
2. Expand a service to view its methods
3. Click a method to open it in the center panel
4. Fill in the generated parameter form with typed inputs
5. Click "Execute Method" to send the request
6. View response in the right panel

### Help & Keyboard Shortcuts

Press `Cmd/Ctrl+Shift+?` or click the help icon in the menu bar to open the comprehensive help guide with:
- Quick start guide
- Network setup instructions (3 methods)
- Method execution workflow
- Complete keyboard shortcuts reference
- Cache management details
- Troubleshooting tips

**Quick Shortcuts:**
- `Cmd/Ctrl+N` - Add new network
- `Cmd/Ctrl+W` - Close active method tab
- `Cmd/Ctrl+Enter` - Execute method
- `Cmd/Ctrl+Tab` - Cycle through method tabs
- `Cmd/Ctrl+Shift+?` - Show help guide

### Cache Management

Click the cache indicator in the menu bar to:
- View cache statistics (entry count, size in KB)
- Clear all cached data to force refresh from servers

## Architecture

**Technology Stack**:
- Next.js 14 (App Router) with TypeScript
- Tailwind CSS + shadcn/ui components
- gRPC reflection via @grpc/grpc-js and protobufjs
- Client-side caching with localStorage (1-hour TTL)
- React resizable panels for layout management

**API Proxy Architecture**:
```
Browser (HTTP) → Next.js API Routes (Node.js) → gRPC Server
```

This architecture is required because Cosmos SDK nodes use standard gRPC (not gRPC-Web), which browsers cannot connect to directly. The Next.js API routes act as a proxy, translating between browser HTTP and native gRPC.

**Key Endpoints**:
- `POST /api/grpc/services` - Service discovery via gRPC reflection
- `POST /api/grpc/execute` - Method execution
- `GET /api/chains` - Cosmos chain registry data

## Deployment

### Production Build

```bash
yarn build:prod   # Creates .next/standalone/ output
yarn start:prod   # Starts production server with auto port selection
```

The production build uses Next.js standalone output mode for optimized deployment.

### Environment Variables

- `NODE_ENV` - Set to `production` for production builds
- `PORT` - Server port (default: 3000, auto-increments if unavailable)
- `GRPC_ENDPOINTS` - Optional comma-separated list of default endpoints

### Docker Deployment

```bash
docker build -t grpc-explorer .
docker run -p 3000:3000 grpc-explorer
```

### Port Conflict Handling

The custom `start-server.js` automatically finds an available port starting from 3000, preventing deployment failures when the default port is in use.

## Development

### Project Structure

```
/app/api/grpc/          # API routes for gRPC operations
/components/            # React components (shadcn/ui + custom)
/lib/grpc/             # gRPC reflection client and utilities
/lib/utils/            # Utility functions (colors, client-cache)
/lib/hooks/            # React hooks (keyboard shortcuts, history)
```

### Key Components

- `GrpcExplorerApp` - Main 3-panel layout with state management
- `NetworkPanel` - Network tabs with hierarchical service trees
- `MethodBlock` - Method instance with protobuf form generation
- `ProtobufFormGenerator` - Type-aware form generator for protobuf messages
- `MenuBar` - Compact menu with cache management and settings
- `AddNetworkDialog` - Network configuration with chain registry browser

### Testing

Run test script with Node.js:

```bash
node test-grpc-reflection.js     # Comprehensive reflection client tests
```

The test validates:
- Service discovery via gRPC reflection
- Type definition extraction for form generation
- Method invocation with various parameter types
- Enum field detection and handling

## Troubleshooting

### Cache Issues
- Click the cache indicator in the menu bar and select "Clear all cache"
- Cache is stored in browser localStorage with 1-hour TTL

### Reflection Failures
- Ensure gRPC reflection is enabled on the target server
- Check network connectivity and firewall rules
- Verify TLS settings match the endpoint configuration

### Chain Registry Rate Limits
- GitHub API limits to 60 requests/hour without authentication
- Chain list is cached for 1 hour to minimize API calls

## License

MIT