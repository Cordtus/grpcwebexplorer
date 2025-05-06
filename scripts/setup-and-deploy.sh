#!/bin/bash
# Combined setup and deployment script for gRPC Explorer Web UI
set -e  # Exit on any error

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

function print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

function print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

function print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check command line arguments
MODE="full"
if [ $# -gt 0 ]; then
    case "$1" in
        dev)
            MODE="dev"
            ;;
        build)
            MODE="build"
            ;;
        *)
            echo "Usage: $0 [dev|build]"
            echo "  dev   - Only set up development environment"
            echo "  build - Only build for production"
            echo "  (no args) - Do both setup and build"
            exit 1
            ;;
    esac
fi

# PART 1: Development Setup
if [ "$MODE" = "full" ] || [ "$MODE" = "dev" ]; then
    print_section "Setting up development environment"
    
    # Create API directories if they don't exist
    mkdir -p app/api/services
    mkdir -p app/api/service
    mkdir -p app/api/method
    mkdir -p app/api/execute
    print_success "API directories created"

    # Ensure public and output directories exist
    mkdir -p public/output
    print_success "Public directories created"

    # Check if output directory exists in project root and move it if needed
    if [ -d "output" ] && [ ! -d "public/output" ]; then
        print_warning "Found output directory in wrong location, moving it..."
        mkdir -p public/output
        cp -r output/* public/output/
        rm -rf output
        print_success "Moved output directory to public/output"
    fi

    # Check for grpcurl
    if command -v grpcurl &> /dev/null; then
        print_success "grpcurl is installed and available"
    else
        print_warning "grpcurl not found in PATH"
        echo "Please install grpcurl: https://github.com/fullstorydev/grpcurl#installation"
        echo "This tool is required for the gRPC Explorer to work properly in production mode."
        echo "The application will still start in development mode with mock data."
    fi

    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_section "Installing dependencies"
        yarn install
        print_success "Dependencies installed"
    fi

    print_success "Development environment setup complete!"
    
    # Show next steps for development
    echo ""
    echo "Next steps for development:"
    echo "1. Run 'yarn dev' to start the development server"
    echo "2. Enter a gRPC endpoint (e.g., localhost:50051) and click \"Connect\""
    echo "3. Browse the services and methods"
    echo ""
    echo "Note: Make sure your gRPC server has reflection enabled"
fi

# PART 2: Production Build
if [ "$MODE" = "full" ] || [ "$MODE" = "build" ]; then
    print_section "Building for production"

    # Check next.config.js for standalone setting
    if ! grep -q '"output": "standalone"' next.config.js && ! grep -q "output: 'standalone'" next.config.js; then
        print_warning "output: \"standalone\" setting might be missing in next.config.js"
        echo "Please ensure your next.config.js contains this setting for proper standalone builds."
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Clean any previous build
    rm -rf .next
    rm -rf node_modules/.cache
    print_success "Cleaned previous builds"

    # Ensure dependencies are installed
    if [ ! -d "node_modules" ]; then
        print_section "Installing dependencies"
        yarn install
        print_success "Dependencies installed"
    fi

    # Build the application
    export NEXT_TELEMETRY_DISABLED=1
    echo "Building production version..."
    yarn build

    # Check if standalone directory was created
    if [ ! -d ".next/standalone" ]; then
        print_error "Standalone directory was not created. Build failed."
        echo "Please check your next.config.js and ensure 'output: \"standalone\"' is set."
        exit 1
    fi
    print_success "Next.js build completed"

    # Ensure public directory exists in standalone
    mkdir -p .next/standalone/public
    mkdir -p .next/standalone/public/_next

    # Copy public directory content to standalone
    cp -r public/* .next/standalone/public/
    print_success "Copied public files"

    # Copy static files from .next/static to standalone
    cp -r .next/static .next/standalone/public/_next/
    print_success "Copied Next.js static files"

    # Copy server.js if it exists at the root level
    if [ -f "server.js" ]; then
        cp server.js .next/standalone/
        print_success "Copied custom server.js"
    fi

    # Set up scripts directory in standalone
    mkdir -p .next/standalone/scripts
    
    # Create run script for easier execution
    cat > .next/standalone/run.sh << 'EOL'
#!/bin/bash
export NODE_ENV=production
export PORT=3000
node server.js
EOL

    chmod +x .next/standalone/run.sh
    print_success "Created startup script"

    print_success "Production build and setup completed successfully!"
    echo ""
    echo "To start the production server, run:"
    echo "cd .next/standalone && ./run.sh"
    echo ""
    echo "Or manually with:"
    echo "cd .next/standalone && NODE_ENV=production PORT=3000 node server.js"
fi

if [ "$MODE" = "full" ]; then
    print_section "Setup and build process completed"
    echo "You can now run the application in development mode with 'yarn dev'"
    echo "or start the production build with 'cd .next/standalone && ./run.sh'"
fi