# Getting Started with gRPC Explorer Web UI

This guide will help you set up and start using the gRPC Explorer Web UI.

## Prerequisites

- **Node.js** v14 or later
- **Yarn** (preferred) or npm
- **grpcurl** installed and available in PATH (for production use)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/grpc-explorer-web.git
cd grpc-explorer-web
```

### 2. Install Dependencies

Using Yarn (recommended):
```bash
yarn install
```

Or using npm:
```bash
npm install
```

### 3. Set Up Development Environment

This step creates mock proto files for development:
```bash
yarn setup
```

### 4. Start the Development Server

```bash
yarn dev
```

Now open [http://localhost:3000](http://localhost:3000) in your browser.

## Development Mode

In development mode, the application uses mock data and simulated responses:

1. Enter any endpoint value (e.g., `localhost:50051`) and click "Save"
2. Browse the mock services in the left panel
3. Select a service to see its methods
4. Select a method to see its parameters
5. Fill in parameters and click "Execute"
6. View the mock response in the JSON viewer

## Production Mode

For production use with real gRPC servers:

### 1. Build the Application

```bash
yarn build
```

### 2. Start the Production Server

```bash
yarn start
```

### 3. Connect to a Real gRPC Server

1. Enter your gRPC server endpoint (e.g., `localhost:50051`) and click "Save"
2. The application will use grpcurl to list available services
3. Select a service to explore its methods
4. Select a method to see its parameters
5. Fill in the required parameters and click "Execute"
6. View the actual gRPC response in the JSON viewer

## Requirements for Production Use

1. **Server Reflection**: Your gRPC server must have reflection enabled
2. **Accessibility**: The server must be accessible from the machine running this app
3. **grpcurl**: Must be installed and available on the system PATH

## Troubleshooting

### Connection Issues

If you can't connect to your gRPC server:
- Verify the server is running and accessible
- Check that the endpoint format is correct (host:port)
- Ensure the server has reflection enabled
- Check network connectivity and firewall settings

### Missing Methods or Fields

If methods or fields are not displaying correctly:
- Ensure server reflection is properly configured
- Verify proto definitions are correctly implemented
- Try restarting the server and refreshing the app

### Execution Errors

If you receive errors when executing queries:
- Check that required parameters are correctly filled
- Ensure parameter types match expected types
- Verify the grpcurl command execution works in terminal
- Check server logs for detailed error information

## Using JSON Mode

For complex requests, you can switch to JSON mode:

1. Select a method in the left panel
2. Click "JSON Mode" in the method form
3. Enter your request parameters as a JSON object
4. Click "Execute" to send the request

## Next Steps

- To add authentication, modify the `buildGrpcurlCommand` function in `app/api/execute/route.ts`
- To support custom headers, update the API execution code
- To add SSL/TLS support, remove the `-plaintext` flag and add appropriate certificate options

For more information, refer to the [gRPC documentation](https://grpc.io/docs/) and [grpcurl documentation](https://github.com/fullstorydev/grpcurl).