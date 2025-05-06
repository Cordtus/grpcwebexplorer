# gRPC Explorer Web UI

Web interface for exploring and interacting with gRPC services using reflection.

## Features

- Connect to gRPC servers with reflection enabled
- Dynamic service and method discovery
- Hierarchical navigation (chain > module > service > methods)
- Parameter form generation based on protobuf definitions
- TLS/non-TLS connection support
- JSON response viewer with filtering and formatting
- Supports multiple endpoints per network

## Prerequisites

- Node.js v14+
- Yarn (preferred) or npm
- [grpcurl](https://github.com/fullstorydev/grpcurl) *make sure to configure in PATH*

## Installation & Development

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

## Production Deployment

The application can be built as a standalone Next.js application that includes its own server. Here's how to build and deploy it:

### Building for Production

```bash
# Clean and build the production standalone version
yarn build:prod

# Verify the build was successful
ls -la .next/standalone/
```

### Running the Production Build

The standalone application must be run from within the `.next/standalone` directory:

```bash
# Change to the standalone directory
cd .next/standalone

# Start the production server
NODE_ENV=production PORT=3000 node server.js
```

Alternatively, you can create a simple launch script:

```bash
# Create a launch script (from project root)
echo '#!/bin/bash
cd .next/standalone
NODE_ENV=production PORT=3000 node server.js' > start-prod.sh

# Make it executable
chmod +x start-prod.sh

# Run it
./start-prod.sh
```

### Deployment to a Server

To deploy to a remote server:

```bash
# Build the application
yarn build:prod

# Copy the standalone directory to your server
# (Replace user@server:/path with your server details)
rsync -avz --exclude node_modules .next/standalone/ user@server:/path/to/deployment/

# SSH into your server and run the application
ssh user@server "cd /path/to/deployment && NODE_ENV=production PORT=3000 node server.js"
```

### Using PM2 for Process Management

For production environments, you may want to use PM2 to manage the Node.js process:

```bash
# Install PM2 globally on your server
npm install -g pm2

# Start the application with PM2
cd .next/standalone
pm2 start server.js --name grpc-explorer -- PORT=3000 NODE_ENV=production

# Make PM2 restart the app on server reboot
pm2 save
pm2 startup
```

### Troubleshooting Production Builds

If you encounter issues with the production build:

1. **Missing static assets (404 errors)**:

   ```bash
   # Ensure static files are copied correctly
   mkdir -p .next/standalone/public/_next
   cp -r .next/static .next/standalone/public/_next/
   cp -r public/* .next/standalone/public/
   ```

2. **Next.js configuration issues**:
   - Verify your `next.config.js` includes `output: 'standalone'`
   - Make sure the server can find static assets:

   ```js
   // next.config.js
   const nextConfig = {
     output: 'standalone',
     // Other settings...
   };
   ```

3. **Connection refused errors**:
   - Ensure server.js is running inside the standalone directory
   - Check the PORT environment variable is set correctly
   - Verify no firewall is blocking the port

**Important**: Due to Next.js limitations you *must* launch the production server from within the `.next/standalone` directory, not from the project root.

<details>
<summary>Running as systemd service</summary>

## Deploying gRPC Explorer with systemd

This guide explains how to set up the gRPC Explorer Web UI as a systemd service for reliable operation on Linux servers.

### Prerequisites

- A Linux server with systemd (Ubuntu, Debian, CentOS, Fedora, etc.)
- Node.js v14+ installed
- Git for cloning the repository
- A user account to run the service (we'll use `grpc-user` in this example)

### Create a system user (optional but recommended)

For better security, create a dedicated system user to run the application:

```bash
sudo useradd --system --create-home --shell /bin/false grpc-user
```

### Install and build the application

```bash
# Clone repository to /opt
sudo git clone <repo-url> /opt/grpc-explorer
cd /opt/grpc-explorer

# Install dependencies and build
sudo yarn install
sudo yarn build:prod

# Set appropriate permissions
sudo chown -R grpc-user:grpc-user /opt/grpc-explorer
```

### Create a systemd service file

Create the service file at `/etc/systemd/system/grpc-explorer.service`:

```bash
sudo nano /etc/systemd/system/grpc-explorer.service
```

Paste the following content:

```ini
[Unit]
Description=gRPC Explorer Web UI
After=network.target

[Service]
Type=simple
User=grpc-user
Group=grpc-user
WorkingDirectory=/opt/grpc-explorer/.next/standalone
ExecStart=/usr/bin/node server.js
Environment=NODE_ENV=production
Environment=PORT=3000
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=grpc-explorer

# Security hardening (optional but recommended)
ProtectSystem=full
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### Enable and start the service

```bash
# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable grpc-explorer

# Start the service
sudo systemctl start grpc-explorer

# Check status
sudo systemctl status grpc-explorer
```

### Configure firewall (if needed)

If you have a firewall enabled, allow traffic on the port:

```bash
# For UFW (Ubuntu/Debian)
sudo ufw allow 3000/tcp

# For firewalld (CentOS/Fedora)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### Set up a reverse proxy (optional but recommended)

For production use, it's recommended to set up Nginx or Apache as a reverse proxy:

#### Nginx example

```bash
sudo nano /etc/nginx/sites-available/grpc-explorer
```

```nginx
server {
    listen 80;
    server_name grpc-explorer.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/grpc-explorer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Managing the service

```bash
# Stop the service
sudo systemctl stop grpc-explorer

# Restart the service
sudo systemctl restart grpc-explorer

# View logs
sudo journalctl -u grpc-explorer

# Follow logs in real-time
sudo journalctl -u grpc-explorer -f
```

### Updating the application

```bash
cd /opt/grpc-explorer
sudo git pull
sudo yarn install
sudo yarn build:prod
sudo chown -R grpc-user:grpc-user /opt/grpc-explorer
sudo systemctl restart grpc-explorer
```

#### Troubleshooting

If the service fails to start:

1. Check the logs: `sudo journalctl -u grpc-explorer -n 50`
2. Verify the working directory: Make sure `/opt/grpc-explorer/.next/standalone` exists
3. Check permissions: Ensure `grpc-user` has access to all required files
4. Validate Node.js path: Confirm that `/usr/bin/node` exists (adjust path if needed)
5. Test manually:

   ```bash
   sudo -u grpc-user bash -c "cd /opt/grpc-explorer/.next/standalone && NODE_ENV=production PORT=3000 node server.js"
   ```

</details>
