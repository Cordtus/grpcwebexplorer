# Changelog

## [1.3.0] - 2026-02-05

### Added
- **Per-Endpoint TLS Configuration**: Individual TLS settings for each endpoint in multi-endpoint setups
  - `EndpointConfig` type with per-endpoint TLS toggle
  - `EndpointSelector` component for managing endpoint list with individual TLS controls
  - `/api/grpc/validate-endpoints` API for DNS reachability checks before connecting
- **Stub Pool for Descriptor Loading**: Distributes descriptor load requests across multiple endpoints
  - Configurable concurrency cap and per-call timeouts
  - Rate-limiting resilience for high-volume service discovery
- **Toast Notifications**: Sonner-based toast notifications for connection errors and round-robin status

### Changed
- **Automatic Load Balancing**: Removed manual round-robin toggle; load balancing is now automatic when multiple endpoints are configured
- **AddNetworkDialog**: Unified dialog always shows endpoint selector regardless of endpoint count
- **Select All Toggle**: Now correctly deselects when any endpoints are selected

### Fixed
- Methods incorrectly showing no parameters required (PR #40)
- TLS mismatch causing descriptor loading failures when endpoint TLS settings differed from network default (PR #42)
- Rate-limited endpoints causing cascading descriptor load failures

## [1.2.0] - 2025-12-18

### Added
- **Real-Time Code Snippets**: Snippet generation updates live as form parameters change
  - `selectedMethod` derived from `methodInstances` for real-time state
  - 64-bit integer fields correctly use string representation in JSON
  - Value merge logic preserves correct field types
- **Dynamic REST Path Generation**: Auto-generate REST API paths from proto HTTP annotations
  - TLS configuration mismatch warnings in Add Network dialog
- **Cached Chains UI**: Browse and reuse previously connected chains
  - Searchable chain dropdown in AddNetworkDialog with full chain list (scrollable, no truncation)
  - Server-side caching for chain list to avoid GitHub API rate limits
  - Browser autocomplete disabled to prevent duplicate dropdown overlays
- **Round-Robin Endpoints**: Distribute method execution across multiple endpoints
  - User-configurable round-robin toggle setting
  - Endpoint rotation via mutable ref for consistent distribution

### Changed
- **CSS Consolidation**: Merged stylesheets and removed unused CSS files
- **Package Manager**: Removed `package-lock.json` (yarn-only project)

### Fixed
- Results panel overflow with proper `min-w-0` width constraints (PR #34)
- TLS toggle not being respected when adding networks (PR #33)
- Left panel collapse button not working

## [1.1.0] - 2025-11-17

### Added
- **Background Descriptor Loading**: Progressive loading system with intelligent priority queue
  - Automatic background loading of all service descriptors at controlled rate (500ms intervals)
  - High-priority loading when user expands networks or selects methods
  - Smart caching prevents duplicate loads and updates UI in real-time
- **Lazy-Loading Architecture**: Field definitions loaded on-demand for instant service list display
  - Created `/api/grpc/descriptor` endpoint for server-side descriptor loading
  - Individual service descriptor caching with configurable TTL
  - Prevents Node.js gRPC code from entering browser bundle
- **v2alpha1 Cosmos Reflection Optimization**: Use Cosmos v2alpha1 reflection as source of truth
  - `GetQueryServicesDescriptor` returns all services with methods instantly
  - Significantly faster initial load (sub-second vs 10-30 seconds)
  - Fallback to standard gRPC reflection for non-Cosmos chains
  - Flexible response structure handling (camelCase/snake_case/direct array)
- **Empty Service Visual Distinction**: Services without methods now displayed with clear indicators
  - Muted border and 50% opacity
  - Circle icon instead of chevron
  - Non-clickable state
  - Method count badge shows "0"
- **Enhanced Cache System**:
  - MAX (never expire) cache TTL option added as new default
  - 72-hour cache TTL option
  - Infinity TTL handling in validation logic
  - Per-service descriptor caching separate from service list

### Changed
- **Service Display**: All services now visible immediately regardless of method count
  - Removed filtering of services with 0 methods
  - Services load in <1 second with v2alpha1
  - All 49+ Osmosis services now appear correctly
- **Default Cache Behavior**: Changed default TTL from 1 hour to MAX (never expire)
- **Reflection Concurrency**: Increased parallel descriptor loading from 3 to 5
- **API Response**: `/api/grpc/services` returns all services (removed `servicesWithMethods` filtering)

### Fixed
- Missing services when querying Osmosis endpoints (was showing ~30/49, now shows all 49)
- Menu bar vanishing issue with z-index fix (`shrink-0 relative z-50`)
- Layout overflow preventing menu bar display (`min-h-0` to parent container)
- Build errors from importing gRPC client code in browser components
- Retry logic for failed descriptor loads (sequential retry after parallel batch)

### Performance
- **Initial Load Time**: Reduced from 10-30 seconds to <1 second for service list
- **User Interaction**: Instant method selection with background-loaded descriptors
- **Progressive Enhancement**: Field definitions load automatically in background
- **Smart Prioritization**: User-selected services jump to front of loading queue

## [1.0.0] - 2025-11-17

### Added
- **Complete Theme System**:
  - Light mode with clean blue-gray color palette
  - Dark mode with true black backgrounds
  - Retro 8-bit theme with authentic color palette
  - Theme persistence in localStorage
  - Fixed hardcoded colors replaced with semantic CSS variables
- **Light Mode Improvements**:
  - Replaced clashing gray colors with blue-gray system (#0a84ff blue accent)
  - Pure white cards on soft blue-gray background
  - Improved contrast and readability
- **JSON Formatting Overhaul**:
  - Fixed text wrapping (removed `break-all`, added `break-words` for strings)
  - Horizontal scroll for overflow
  - Better whitespace handling (`whitespace-pre`)
  - Removed dialog flickering by fixing animation conflicts
- **Nested Message Field Support**: Recursively expand nested message fields in parameter forms
- **Error Messaging**: Improved error messages for UNIMPLEMENTED and other gRPC errors

### Changed
- All hardcoded `bg-black` values replaced with theme-aware `bg-muted` colors
- Tailwind configuration for proper dark mode variant handling
- Theme variables use HSL color system for consistent theming

### Fixed
- Light mode theme with ugly gray colors
- JSON text wrapping in response panel
- Dialog flickering animations
- Dark theme code block visibility
- Theme application across all components

## [0.9.0] - 2025-11-09

### Added
- **Penumbra Compatibility**:
  - Support for grpc.reflection.v1 protocol
  - Recursive dependency loading for complex gRPC responses
  - Circular dependency detection and caching
  - Comprehensive compatibility testing endpoint (`/api/grpc/test-compatibility`)
- **Enhanced Debugging**:
  - Detailed timing logs for performance diagnosis
  - Request encoding logging
  - Method invocation debugging
  - Better error context for timeouts

### Changed
- Increased timeout limits (60s for methods, 90s max duration for Vercel)
- Added gRPC deadline enforcement
- Fixed grpcurl snippets to use actual field names

### Fixed
- ValidatorInfo timeout issues
- Missing dependent types in Penumbra response decoding
- Slow Penumbra method execution
- Package dependency version locking

## [0.8.0] - 2025-11-08

### Added
- **Cosmos v2alpha1 Reflection Optimizations**:
  - Faster query service discovery
  - Custom module support
  - Detailed logging for v2alpha1 operations
- **Chain Suggestions**: Auto-populate endpoint field from chain selection
- **Method Validation**: Validate methods before execution

### Changed
- Endpoint normalization unified across chain selection
- Improved v2alpha1 and standard reflection merging

### Fixed
- Missing methods from custom modules in v2alpha1 reflection
- Empty v2alpha1 services not merging with standard reflection
- Chain suggestion endpoint population

## [0.7.0] - 2025-11-07

### Added
- **Auto-Collapse & Pin Functionality**:
  - Method instances can be pinned to prevent auto-collapse
  - Network panels auto-collapse when another expands
  - User preference for auto-collapse behavior
- **Responsive Left Panel**:
  - Auto-collapse at 1024px breakpoint
  - Overlay mode for narrow screens
  - Adaptive width (320px - 420px based on window size)
- **Chain-ID Features**:
  - Automatic chain-ID detection via GetChainDescriptor (v2alpha1) and GetNodeInfo (v1beta1)
  - Duplicate chain deduplication with fallback endpoint support
  - Network persistence across sessions
- **TLS Improvements**:
  - Automatic TLS fallback on SSL errors
  - Smart endpoint normalization with TLS detection
  - Better error messages for TLS issues
- **Shared Type System**: Created unified type definitions in `lib/types/grpc.ts`
- **UI Enhancements**:
  - Marquee text effect for long method names
  - Improved network panel styling
  - Better loading indicators
  - Left panel width increased for method name readability

### Changed
- Panel sizing improvements for better space utilization
- Method descriptor panel layout refinement
- Code snippet scrollbar improvements

### Fixed
- Loading indicator display when adding networks
- Mobile web app deprecation warning (added `mobile-web-app-capable` meta tag)
- TypeScript build errors with Map.entries() iteration
- Set spread syntax TypeScript error

## [0.6.0] - 2025-11-07

### Added
- **Performance Optimizations**:
  - Major service discovery optimizations
  - Improved rendering performance
  - Concurrent endpoint fetching with intelligent failure handling
  - Endpoint manager for tracking health and prioritization
- **Copy & Export Features**:
  - Granular copy functionality for method paths, proto definitions, code snippets
  - Save response as JSON feature
  - Copy indicators with checkmarks
- **Keyboard Shortcuts**:
  - `Cmd/Ctrl+N`: Add network
  - `Cmd/Ctrl+W`: Close current method tab
  - `Cmd/Ctrl+Enter`: Execute method
  - `Cmd/Ctrl+Shift+?`: Show help
- **Settings Dialog**: Configurable application preferences
- **Help Dialog**: Comprehensive keyboard shortcuts and usage guide

### Changed
- Left panel width increased for better readability
- Panel auto-collapse behavior refinements

### Fixed
- Missing methods and runtime errors with service loading
- Concurrent endpoint fetching data loss regression (reverted to sequential)

## [0.5.0] - 2025-11-06

### Added
- **Configurable Cache TTL**:
  - Multiple duration options (None, 1hr, 6hr, 24hr, 36hr)
  - User-selectable cache lifetime
  - Cache visibility indicators
  - Per-network refresh button
- **Collapsible Panels**: Method descriptor panel with three size states (expanded, small, minimized)
- **Cache UI Improvements**:
  - Visual cache age indicators
  - Manual cache refresh controls
  - Cache timestamp display

### Changed
- Improved TTL selection UI
- Panel sizing for better content visibility

### Fixed
- Critical performance issue with cache handling
- Right panel disappearing with large responses
- Panel collapse issues with large JSON payloads
- HTML structure in JsonViewer component

## [0.4.0] - 2025-10-31

### Added
- **Comprehensive Help System**: In-app help dialog with feature documentation
- **Consolidated Reflection**: Single gRPC reflection implementation using `@grpc/grpc-js`
- **PWA Support**:
  - Progressive Web App manifest
  - Mobile installation capability
  - Offline support infrastructure

### Changed
- README updates with improved clarity
- Consolidated reflection client architecture

### Fixed
- Right panel disappearing when loading large responses
- Documentation file organization

## [0.3.0] - 2025-10-30

### Added
- **Mobile Support**:
  - Hybrid layout with bottom drawer
  - Tab navigation for mobile devices
  - Stacked layout option
  - Responsive design for small screens
- **shadcn/ui Components**: Integration for consistent UI components

### Removed
- Redundant documentation files
- Code clutter and duplicate implementations

## [0.2.0] - 2025-10-28

### Added
- **Protobuf Form Generation**: Automatic form generation from protobuf schema
  - Recursive field expansion
  - Nested message support
  - Enum dropdowns with values
  - Repeated field handling (arrays)
  - Primitive type support (string, int32, int64, uint64, bool, bytes, etc.)
- **Method Descriptor Panel**: Enhanced display of method information
  - Proto definition
  - Code examples (curl, JavaScript)
  - Tabbed examples with TLS conditional support
  - Request/response type information
  - Streaming indicators

### Changed
- Left panel restructure for full vertical height utilization
- Namespace tabs no longer show method counts
- Type flow display inline with method header
- Proto file guidance in descriptor panel

### Fixed
- Enum handling in native reflection client
- exactOptionalPropertyTypes TypeScript build errors

## [0.1.0] - 2025-08-29

### Added
- **Resizable Panels**: Draggable panel boundaries for customizable layout
- **UI Improvements**: General interface enhancements
- **Deployment Scripts**: Docker and production deployment automation
- **Local Caching**: Client-side caching for service discovery

### Changed
- Backend architecture improvements
- Updated to Node.js 22 (from 18)
- README simplification

### Fixed
- Production deployment configuration
- Build issues and type errors
- Child process usage safety and robustness

## [0.0.1] - 2025-05-05

### Added
- **Initial Release**: Basic gRPC Web Explorer functionality
- **Service Discovery**: List and explore gRPC services
- **Method Execution**: Execute gRPC methods with parameter input
- **grpcurl Integration**: Backend powered by grpcurl
- **Next.js Framework**: Modern React-based UI
- **Tailwind CSS**: Utility-first styling
- **Loading Indicators**: Visual feedback for async operations
- **Logo and Icons**: Branding assets
- **Process Shutdown Handling**: Graceful shutdown on SIGTERM/SIGINT

### Infrastructure
- Docker deployment support
- PM2 configuration for process management
- Standalone mode for production builds

---

## Version Guidelines

This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backwards compatible manner
- **PATCH** version for backwards compatible bug fixes

## Links
- [Repository](https://github.com/Cordtus/grpcwebexplorer)
- [Issues](https://github.com/Cordtus/grpcwebexplorer/issues)
- [Pull Requests](https://github.com/Cordtus/grpcwebexplorer/pulls)
