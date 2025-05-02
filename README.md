# gRPC Explorer Web UI

Web interface for exploring and interacting with gRPC services using reflection.

## Features

- Connect to gRPC servers with reflection enabled
- Dynamic service and method discovery
- Hierarchical navigation (chain > module > service > methods)
- Parameter form generation based on protobuf definitions
- TLS/non-TLS connection support
- JSON response viewer with filtering and formatting

## Prerequisites

- Node.js v14+
- Yarn or npm
- [grpcurl](https://github.com/fullstorydev/grpcurl) in PATH

## Installation

```bash
# Clone repository
git clone <repo-url> grpc-explorer-web
cd grpc-explorer-web

# Install dependencies and bootstrap project
yarn install
yarn bootstrap

# Start development server
yarn dev
```

## Usage

1. Enter gRPC endpoint (`host:port`)
2. Toggle TLS if required
3. Click "Connect"
4. Navigate services in left panel
5. Select method to view parameters
6. Input parameters in center panel
7. Click "Execute"
8. View response in right panel

## Requirements

- Target gRPC server must have reflection enabled
- Network access to gRPC server
- grpcurl installed and in PATH

## Troubleshooting

### Connection Issues
- Verify server is running
- Check endpoint format (`host:port`)
- Confirm reflection is enabled
- Verify TLS setting matches server configuration

### Execution Errors
- Ensure all required parameters are provided
- Check parameter types
- Verify server access with grpcurl directly
- Check server logs

## License

MIT
