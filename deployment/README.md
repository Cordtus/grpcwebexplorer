# Deployment Files

This directory contains files and configurations for deploying gRPC Web Explorer outside of Vercel's managed environment. These files are not required for standard Vercel deployments.

## Contents

### Docker Deployment

- **`Dockerfile`** - Multi-stage Docker build configuration for production deployment
  - Uses Node.js 22 Alpine for minimal image size
  - Builds Next.js application with production optimizations
  - Includes custom port auto-detection server

- **`docker-compose.yml`** - Docker Compose orchestration
  - Single-service configuration
  - Persistent cache volume for service discovery results
  - Exposes port 3000 by default

- **`start-server.js`** - Custom Node.js production server
  - Automatic port detection (starts at 3000, increments if unavailable)
  - Prevents deployment failures due to port conflicts
  - Uses Next.js standalone mode

### System Deployment

- **`systemd.service`** - Linux systemd service configuration
  - For running as a system service on Linux servers
  - Includes security hardening options
  - Automatic restart on failure

### Testing

- **`test-grpc-reflection.js`** - Comprehensive gRPC reflection test suite
  - Validates service discovery functionality
  - Tests method invocation and type definitions
  - Useful for local development and troubleshooting

## Usage

### Docker Deployment

From the project root:

```bash
# Build and start
yarn docker:build
yarn docker:up

# View logs
yarn docker:logs

# Stop
yarn docker:down
```

Or use docker-compose directly:

```bash
cd deployment
docker-compose up -d
docker-compose logs -f
docker-compose down
```

### Direct Node.js Deployment

From the project root:

```bash
# Production build
yarn build:prod

# Start server (auto-detects available port)
yarn start:prod
```

### systemd Service (Linux)

```bash
# Copy service file
sudo cp deployment/systemd.service /etc/systemd/system/grpc-explorer.service

# Edit paths in service file as needed
sudo nano /etc/systemd/system/grpc-explorer.service

# Enable and start
sudo systemctl enable grpc-explorer
sudo systemctl start grpc-explorer
sudo systemctl status grpc-explorer
```

### Testing gRPC Reflection

```bash
# Ensure the dev server is running
yarn dev

# In another terminal
yarn test:grpc
```

## Environment Variables

- `NODE_ENV` - Set to `production` for production builds
- `PORT` - Desired port (default: 3000, auto-increments if unavailable)
- `GRPC_ENDPOINTS` - Optional comma-separated list of default endpoints

## Notes

- **Vercel Deployments**: These files are not used for Vercel deployments. Vercel handles building and serving automatically.
- **Port Auto-Detection**: The custom server (`start-server.js`) automatically finds an available port, preventing deployment failures.
- **Cache Persistence**: Docker deployment includes a persistent volume for localStorage cache simulation.
- **Security**: The systemd service includes basic security hardening (ProtectSystem, NoNewPrivileges, PrivateTmp).

## Troubleshooting

### Docker Build Fails

Ensure you're running docker commands from the project root or using the yarn scripts which handle paths automatically.

### Port Already in Use

The custom server automatically finds an available port. If using Docker, modify the port mapping in `docker-compose.yml`.

### Test Script Fails

Ensure the application is running (dev or production) before running the test script. The test script connects to `http://localhost:3000` by default.
