# gRPC Explorer Web UI

A sleek, MacOS-themed web interface for exploring and querying gRPC services using gRPC reflection.

## Features

- Connect to any gRPC server with reflection enabled
- Automatic service and method discovery
- Hierarchical organization by chain > module > service > methods
- Auto-generated forms for method parameters
- Execute queries with parameter validation
- View responses in an expandable/collapsible JSON viewer
- Dark mode interface inspired by MacOS Terminal

## Prerequisites

- Node.js v14 or later
- Yarn (preferred) or npm
- [grpcurl](https://github.com/fullstorydev/grpcurl) installed and available in PATH

## Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone <repo-url> grpc-explorer-web
   cd grpc-explorer-web
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Set up development environment:
   ```bash
   yarn setup
   ```

4. Start the development server:
   ```bash
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Enter your gRPC endpoint in the format `host:port` at the top of the application
2. Click "Connect" to discover available services using gRPC reflection
3. Browse the available services in the left panel, organized by chain > module > service
4. Click on a service to expand and see its methods
5. Select a method to view its parameters in the center panel
6. Fill in the required parameters
7. Click "Execute" to run the query
8. View the JSON response in the right panel
   - Use the filter to search within results
   - Use "Expand All" and "Collapse All" to manage the view
   - Click "Copy" to copy the entire JSON response to clipboard

## Requirements for Production Use

1. Your gRPC server must have reflection enabled
2. The server must be accessible from the machine running this app
3. grpcurl must be installed and available on the PATH

## Troubleshooting

### Connection Issues

If you can't connect to your gRPC server:
- Verify the server is running and accessible
- Check that the endpoint format is correct (host:port)
- Ensure the server has reflection enabled
- Check network connectivity and firewall settings

### Execution Errors

If you receive errors when executing queries:
- Check that required parameters are correctly filled
- Ensure parameter types match expected types
- Verify the grpcurl command execution works in terminal
- Check server logs for detailed error information

## License

MIT
