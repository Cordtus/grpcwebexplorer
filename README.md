# gRPC Web Explorer

A web-based interface for exploring and interacting with gRPC services through reflection.

## Prerequisites

- Node.js 20.0 or higher
- Yarn package manager

## Installation

```bash
git clone <repository-url>
cd grpcWebExplorer
yarn install
```

## Running the Application

### Development Mode

```bash
yarn dev
```

Access at `http://localhost:3000`

### Production Mode

```bash
yarn build:prod
yarn start
```

## Docker Deployment

### Quick Start

```bash
docker-compose up -d
```

Access at `http://localhost:3000`

### Docker Commands

```bash
docker-compose up -d     # Start container
docker-compose logs -f   # View logs
docker-compose down      # Stop container
```

## Usage

### Connecting to Services

1. Click "Add Network"
2. Enter gRPC endpoint (e.g., `grpc.example.com:443`)
3. Configure TLS if needed
4. Services will be discovered automatically via reflection

### Executing Methods

1. Select a method from the left panel
2. Enter parameters in JSON format on the right panel
3. Click "Execute"
4. View response below

### Panel Layout

The interface has resizable panels:
- **Left**: Service/method tree
- **Top**: Method descriptor
- **Center**: Selected methods
- **Right**: Parameters and results

Drag the dividers to resize panels according to your needs.

### Keyboard Shortcuts

- `Ctrl/Cmd + N`: Add network
- `Ctrl/Cmd + K`: Show shortcuts
- `Ctrl/Cmd + H`: Execution history
- `Ctrl/Cmd + W`: Close tab
- `Ctrl/Cmd + Tab`: Switch tabs

## Example Endpoints

### Cosmos Ecosystem

- `grpc.juno.basementnodes.ca:443`
- `grpc.noble.basementnodes.ca:443`
- `grpc.neutron.basementnodes.ca:443`
- `grpc.cosmos.directory:443`

All use TLS by default. For local nodes, typically use port 9090 without TLS.

## Alternative Deployment

### PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### systemd

Copy `systemd.service` to `/etc/systemd/system/grpc-explorer.service` and:

```bash
systemctl enable grpc-explorer
systemctl start grpc-explorer
```

## Troubleshooting

### Connection Issues

- Check TLS settings match server (port 443 typically uses TLS, port 9090 typically does not)
- Ensure server has gRPC reflection enabled
- Verify network connectivity to the endpoint

### Clear Cache

```bash
rm -rf .cache/
```

## License

MIT