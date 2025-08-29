# gRPC Explorer Web UI

A modern web interface for exploring and interacting with gRPC services using reflection. Features a clean 3-panel layout for efficient service discovery and method testing.

## ✨ Features

### Core Functionality
- 🔌 **Multi-Network Support** - Connect to multiple gRPC endpoints simultaneously
- 🎨 **Color-Coded Networks** - Visual differentiation between different networks
- 🌳 **Hierarchical Method Browser** - Methods organized by their full path structure
- 📝 **Dynamic Parameter Forms** - JSON editor for request parameters
- 📊 **Response Visualization** - Clean JSON viewer with syntax highlighting
- 🔐 **TLS/SSL Support** - Connect to secure and insecure endpoints

### User Experience
- ⌨️ **Keyboard Shortcuts** - Quick actions for power users
- 📥 **Import/Export** - Save and load method parameters
- 📚 **Example Endpoints** - Pre-configured popular gRPC services
- 💾 **Execution History** - Track your API calls (stored locally)
- 🎯 **Smart Tab Management** - Method tabs with no duplicates
- 🔍 **Search & Filter** - Find methods quickly

## 🚀 Quick Start

### Prerequisites
- Node.js v14 or later
- Yarn (preferred) or npm

### Installation

```bash
# Clone the repository
git clone <repo-url> grpc-explorer-web
cd grpc-explorer-web

# Install dependencies
yarn install

# Start development server
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎮 Usage

### Adding Networks

1. Click **"Add Network"** button or press `Ctrl+N`
2. Enter your gRPC endpoint (e.g., `grpc.example.com:443`)
3. Toggle TLS/SSL if needed
4. Choose from example endpoints for quick testing

### Exploring Services

1. **Left Panel**: Expand network tabs to see available services
2. **Navigate**: Click through the hierarchical tree structure
3. **Search**: Use the filter box to find specific methods

### Testing Methods

1. **Select**: Click any method to open it in the center panel
2. **Parameters**: Edit JSON parameters in the right panel
3. **Execute**: Click Execute or press `Ctrl+Enter`
4. **View Response**: See results in the response tab

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | Add new network |
| `Ctrl+W` | Close current tab |
| `Ctrl+Enter` | Execute method |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+Shift+E` | Export parameters |
| `Ctrl+Shift+I` | Import parameters |
| `Ctrl+Shift+?` | Show shortcuts help |

## 🏗️ Architecture

### UI Layout
- **Left Panel (20%)**: Network explorer with collapsible tabs
- **Center Panel (40%)**: Method descriptors and documentation
- **Right Panel (40%)**: Parameter editor and response viewer

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React hooks + localStorage
- **Icons**: Lucide React

### Project Structure
```
├── app/                    # Next.js app router
│   ├── api/grpc/          # API routes for gRPC operations
│   └── page.tsx           # Main page
├── components/            # React components
│   ├── NetworkPanel       # Left panel - network explorer
│   ├── MethodTabsPanel    # Center panel - method tabs
│   └── MethodInteractionPanel # Right panel - interaction
├── lib/                   # Utilities and hooks
│   ├── hooks/            # Custom React hooks
│   ├── constants/        # App constants
│   └── utils/            # Helper functions
└── public/               # Static assets
```

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file for configuration:

```env
# gRPC Configuration (optional)
GRPC_ENDPOINTS=endpoint1:443,endpoint2:443

# Cache settings (optional)
CACHE_TTL=3600000
```

## 📦 Building for Production

```bash
# Build the application
yarn build:prod

# The standalone build will be in .next/standalone/
cd .next/standalone

# Run the production server
NODE_ENV=production PORT=3000 node server.js
```

## 🚢 Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start the application
cd .next/standalone
pm2 start server.js --name grpc-explorer --env production

# Save PM2 configuration
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
EXPOSE 3000
ENV NODE_ENV production
CMD ["node", "server.js"]
```

### Using systemd

See the [systemd deployment guide](./docs/systemd-deployment.md) for detailed instructions.

## 🎯 Roadmap

### In Progress
- [ ] Native gRPC client implementation (replacing mock data)
- [ ] Real-time streaming support
- [ ] Method documentation from proto comments

### Planned
- [ ] Dark/light theme toggle
- [ ] Request/response templates
- [ ] Performance metrics
- [ ] Collaboration features
- [ ] Proto file upload support

## ⚠️ Current Limitations

1. **Mock Data**: Currently returns mock responses (gRPC integration pending)
2. **No Streaming**: Server-streaming and bidirectional streaming not yet supported
3. **No Authentication**: Token/certificate authentication not implemented
4. **Browser Only**: No offline/desktop version available

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- [gRPC](https://grpc.io/) for the amazing RPC framework
- [shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components
- [Next.js](https://nextjs.org/) for the React framework
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework

## 📧 Support

For issues and questions:
- Open an issue on [GitHub](https://github.com/your-repo/issues)
- Check existing issues before creating new ones
- Provide detailed reproduction steps for bugs

---

Built with ❤️ for the gRPC community