# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Changelog Format

CHANGELOG.md follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format with [Semantic Versioning](https://semver.org/spec/v2.0.0.html). When updating, group changes under Added/Changed/Fixed/Removed headers per version entry.

## Project Overview

gRPC Web Explorer is a Next.js 14 application for exploring and executing gRPC methods via server reflection. Built with TypeScript, React, and Tailwind CSS, it bridges browser HTTP/JSON to native gRPC through Next.js API routes. Targets Cosmos SDK chains but works with any gRPC server supporting reflection.

## Development Commands

```bash
yarn dev          # Dev server at localhost:3000
yarn build        # Production build
yarn build:prod   # Production build with telemetry disabled
yarn lint         # Run ESLint
yarn test:grpc    # gRPC reflection integration tests (requires dev server running)

# Docker deployment
yarn docker:build
yarn docker:up
yarn docker:down
yarn docker:logs
```

## Architecture

### Request Flow Pattern

All gRPC operations follow browser -> Next.js API route -> gRPC server pattern:

1. **Service Discovery**: Client POSTs to `/api/grpc/services` with `{endpoint, tlsEnabled}`. Server uses reflection to enumerate services/methods, client caches response in localStorage with configurable TTL.

2. **Method Execution**: Client POSTs to `/api/grpc/execute` with `{endpoint, tlsEnabled, service, method, params}`. Server constructs gRPC client, marshals params to protobuf, returns JSON response.

3. **Chain Registry**: GET `/api/chains` fetches chain list (1hr server cache). GET `/api/chains?name={chain}` fetches endpoints from cosmos/chain-registry.

4. **Descriptor Loading**: Client POSTs to `/api/grpc/descriptor` with `{endpoint, tlsEnabled, serviceName}` to lazy-load field definitions for a single service (used by v2alpha1 optimization path).

5. **Compatibility Testing**: POST to `/api/grpc/test-compatibility` with `{endpoint, tlsEnabled, serviceFilter?}` runs comprehensive method testing across all services (5min timeout, useful for debugging).

### Core gRPC Reflection Implementation

`lib/grpc/reflection-client.ts` is the heart of the application:

- Custom implementation using `@grpc/grpc-js` and `protobufjs` without grpc-reflection-js
- Supports both v1 and v1alpha reflection protocols with automatic version detection
- **Two initialization modes**:
  - `initialize()`: Loads all services with parallel batching (concurrency limit: 5)
  - `initializeForMethod(serviceName)`: Fast single-service loading for execution
- **Recursive missing type loading**: Automatically loads nested protobuf dependencies on-demand (max depth: 50 for complex Cosmos chains)
- **Cosmos optimization**: Uses v2alpha1 ReflectionService when available for faster query/tx enumeration
- Always use `initializeForMethod()` for execution routes to minimize latency

`lib/grpc/reflection-utils.ts` provides high-level helpers:

- `fetchServicesViaReflection()`: Standard reflection for any gRPC server
- `fetchServicesWithCosmosOptimization()`: Tries v2alpha1 first, falls back to standard
- `loadServiceDescriptor()`: Lazy-loads field definitions for a specific service with caching

### Client-Side Caching Strategy

`lib/utils/client-cache.ts` implements localStorage-based caching:

- **No server-side caching** - all caching is client-side
- User-configurable TTL: None/1hr/6hr/24hr/36hr/72hr/Never (default: Never)
- Cache keys: `grpc-explorer:services:{endpoint}:{tls}`
- Version-aware cache with automatic invalidation on version bumps
- Networks persisted to `grpc-explorer-networks` with same TTL as services
- `listCachedChains()`: Enumerates all cached service entries for the "Recently Used" UI
- `CachedChainInfo`: Type containing endpoint, chainId, tlsEnabled, serviceCount, cachedAt, age

### State Management Pattern

`components/GrpcExplorerApp.tsx` is the root state container:

- **Networks**: Array of `GrpcNetwork` objects with services, loaded from localStorage on mount
- **Method Instances**: Array of `MethodInstance` objects representing open method tabs
- **Auto-collapse behavior**: Controlled by `autoCollapseEnabled` setting (default: true)
- **Round-robin endpoints**: Controlled by `roundRobinEnabled` setting (default: false)
  - When disabled: Uses primary endpoint (`network.endpoint`) for method execution
  - When enabled: Rotates through all endpoints using `endpointIndexRef` (useRef for mutable state)
  - Setting persisted to `grpc-explorer-round-robin` in localStorage
- **Responsive layout**: Three breakpoints - <1024px (overlay), 1024-1600px (adaptive), >=1600px (full width)
- When adding networks, always check for duplicate chain-IDs to enable fallback endpoint mode

### Endpoint Management

`lib/utils/endpoint-manager.ts` tracks endpoint health:

- Records success/failure with response times
- Blacklists endpoints after 3 consecutive failures
- Prioritizes endpoints by success rate and response time
- Automatically retries with TLS disabled on SSL errors

## Type Definitions

Core types in `lib/types/grpc.ts`:

- `GrpcService`: Service with name, fullName, methods array
- `GrpcMethod`: Method descriptor with serviceName, request/response types, streaming flags, and full MessageTypeDefinition
- `GrpcNetwork`: Network state including services, color, cached status, chainId, fallback endpoints
- `MethodInstance`: Open method tab with params, pinned state, and execution state
- `ExecutionResult`: Method execution result with success, data/error, timestamp, and duration
- `MessageTypeDefinition`: Protobuf message schema with fields array (defined in ProtobufFormGenerator)

Always use these shared types - never redefine locally.

## Form Generation

`components/ProtobufFormGenerator.tsx` recursively generates forms from protobuf schemas:

- Handles primitive types (string, int32, int64, uint64, bool, bytes, etc.)
- Supports nested messages (recursive expansion)
- Handles repeated fields (arrays)
- Enum dropdowns with values from schema
- Uses `MessageTypeDefinition.fields` array to iterate

When working with forms, remember that `requestTypeDefinition` is always defined (may have empty fields array for methods with no params).

## Color System

Networks use a fixed 8-color palette (`NETWORK_COLORS` in GrpcExplorerApp.tsx):

- blue, emerald, amber, red, purple, pink, teal, lime
- Colors assigned sequentially, wrap around after 8 networks
- Method instances inherit network color for visual consistency

## Smart Search Filtering

`components/NetworkBlock.tsx` implements hierarchical search:

- Search input stays sticky at top while scrolling through results
- Matches against namespace (e.g., "cosmos.bank"), service name, and method name
- If namespace matches: Shows all services/methods in that namespace
- If service matches: Shows all methods in that service
- Otherwise: Filters to matching method names only

## Base64/Binary Decoding

Response bytes are preserved as base64 in API JSON. Decoding is an explicit
display choice in the results UI:

- `lib/utils/response-decoder.ts`: Recursively annotates base64/binary-looking
  strings for formatted display only, parses decoded JSON when present, and
  falls back to decoded text or byte metadata
- `components/MethodDetailPanel.tsx`: Provides the "Decode" toggle in the
  Results toolbar
- Raw response JSON, whole-response copy, and saved JSON keep original base64
  values
- Field-level copy from a decoded formatted value copies decoded JSON when
  available, then decoded text, otherwise the original base64 value

## Keyboard Shortcuts

Registered via `lib/hooks/useKeyboardShortcuts.ts`:

- `Cmd/Ctrl+N`: Open connection dialog
- `Cmd/Ctrl+W`: Close current method tab
- `Cmd/Ctrl+Enter`: Execute method
- `Cmd/Ctrl+Shift+?`: Show help

## Error Handling Patterns

1. **TLS Errors**: Always retry without TLS on `wrong version number`, `SSL routines`, or `EPROTO` errors
2. **Missing Types**: ReflectionClient automatically loads missing protobuf types recursively (see `loadAllMissingTypes()`)
3. **Timeouts**: Default 60s for method execution, 10s for service discovery per endpoint
4. **Chain Markers**: Endpoints starting with `chain:` are resolved via chain registry before connection
5. **Chain-ID Detection**: Two-step process - tries `GetChainDescriptor` (v2alpha1), falls back to `GetNodeInfo` (v1beta1)

## Important Constraints

- Never create server-side caches for gRPC data - use client localStorage only
- Always close ReflectionClient instances in finally blocks to prevent connection leaks
- Use `fetchServicesWithCosmosOptimization()` in services route for Cosmos chain performance
- Method execution routes must use `initializeForMethod()` not full `initialize()`
- Respect the 50-depth limit for recursive type loading to prevent infinite loops

## Path Aliases

TypeScript paths configured in tsconfig.json:
- `@/*` maps to repository root
- Use absolute imports: `@/lib/utils/cache` not `../../lib/utils/cache`

## Component Structure

UI components follow shadcn/ui patterns:
- Base primitives in `components/ui/` (button, dialog, input, etc.)
- Feature components in `components/` root
- All components use Tailwind with theme variables (no hardcoded colors)
- Theme managed by `ThemeProvider.tsx` with localStorage persistence

## Execution History

`lib/hooks/useExecutionHistory.ts` manages method execution history:
- Stores last 50 executions per method in localStorage
- Tracks timing data, success/failure, and response payloads
- Used by MethodBlock for re-executing previous requests

## Descriptor Loader

`lib/utils/descriptor-loader.ts` handles background loading of protobuf field definitions:
- Queues lazy-load requests for services discovered via v2alpha1
- Emits events when descriptors are loaded so UI can update
- Prevents duplicate loads with internal tracking

## AddNetworkDialog Features

`components/AddNetworkDialog.tsx` provides mode-specific connection flows:
- Generic gRPC mode connects reflection endpoints or buf.build schemas
- Cosmos SDK mode adds chain networks by direct endpoint, chain registry search,
  or recent cached chains
- Recently used chains via `listCachedChains()` are Cosmos-only and show
  chain-id, endpoint, service count, and cache age
- Inline chain suggestions are Cosmos-only when typing non-endpoint text
