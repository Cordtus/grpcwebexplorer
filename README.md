# gRPC Web Explorer

Web-based interface for exploring and interacting with gRPC services via reflection. Features multi-network support, hierarchical method browsing, and real-time method execution.

## Setup

**Requirements**: Node.js 20+, Yarn

```bash
yarn install
yarn dev          # Development server at http://localhost:3000
yarn build:prod   # Production build
yarn start:prod   # Production server
```

**Docker**:
```bash
yarn docker:up    # Start container
yarn docker:down  # Stop container
```

## Usage

1. Click "Add Network" or select from Cosmos chain registry
2. Enter gRPC endpoint (e.g., `grpc.cosmos.directory:443`)
3. Enable TLS toggle for port 443 endpoints
4. Select methods from left panel, enter JSON parameters, execute
5. Use resizable 3-panel layout: services (left), method details (center), execution (right)

**Keyboard shortcuts**: `Cmd/Ctrl+N` (add network), `Cmd/Ctrl+K` (shortcuts), `Cmd/Ctrl+H` (history)