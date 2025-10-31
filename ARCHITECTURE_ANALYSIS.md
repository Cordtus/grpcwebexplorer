# Architecture Analysis - gRPC Reflection Client Consolidation

## Project Evolution (Git History Analysis)

### Key Milestones

**Oct 26, 2025 - Remove grpcurl dependency (commit 4abe800)**
- Replaced grpcurl CLI with native gRPC reflection
- Added THREE separate implementations:
  - `lib/grpc/native-reflection.ts` - Custom implementation
  - `lib/grpc/reflection.ts` - Class-based wrapper around grpc-reflection-js
  - `utils/grpcReflection.ts` - Function-based wrapper around grpc-reflection-js
- All added in single massive commit (2,822 insertions, 500 deletions)
- Created test files for validation
- Added chain registry integration

**Oct 27, 2025 - Client-side caching (commit 511b398)**
- Removed server-side caching (`lib/grpc/cache.ts` deleted)
- Moved to localStorage in browser
- Fixed Vercel read-only filesystem issues
- Deleted `lib/grpc/client.ts` (was a server-side cache wrapper)

**Oct 28, 2025 - Protobuf form generation (commit d62e597)**
- Added `ProtobufFormGenerator.tsx` component
- Enhanced `utils/grpcReflection.ts` with `extractMessageTypeDefinition()`
- Simplified `MethodBlock.tsx` to use new form generator
- **This made requestTypeDefinition/responseTypeDefinition critical**

**Oct 29, 2025 - Fix enum handling (commit 555a14f)**
- Added `addEnumType()` method to native reflection client
- Fixed nested enum support
- **This was the reason for creating native implementation**
- grpc-reflection-js didn't handle enums correctly

### Development Direction

**Pattern**: Incremental migration from grpc-reflection-js to native
- Execute route switched to native implementation (works)
- Services route still using old implementation (blocked by type definitions)
- Native implementation being enhanced piece by piece

**Issues Encountered:**
1. Enum serialization bugs with grpc-reflection-js
2. Server-side caching incompatible with Vercel
3. Need for detailed type definitions for form generation
4. Protobuf introspection complexity

**Current Trajectory:**
- Moving toward full native implementation
- Eliminating external dependencies
- Better control over protobuf handling
- Client-side caching for scalability

## Current State Analysis

### Existing Dependencies

**Core gRPC Libraries:**
- `@grpc/grpc-js` v1.13.3 - Native gRPC for Node.js (KEEP)
- `@grpc/proto-loader` v0.7.15 - Protobuf loader (KEEP)
- `grpc-reflection-js` v0.3.0 - Third-party reflection library (TO REMOVE)
- `protobufjs` - Transitive dependency from grpc-reflection-js (NEEDS EXPLICIT ADDITION)

**UI/Framework:**
- Next.js v14.1.0 with App Router
- React v18.2.0
- TypeScript v5.3.3
- Tailwind CSS + shadcn/ui components

### Current Reflection Implementations

**THREE SEPARATE IMPLEMENTATIONS EXIST:**

1. **`utils/grpcReflection.ts`** (Currently USED by services route)
   - Uses `grpc-reflection-js` library
   - Exports: `fetchServicesViaReflection()`, types
   - Function-based API (not class-based)
   - **CRITICAL:** Returns `requestTypeDefinition` and `responseTypeDefinition` objects for form generation

2. **`lib/grpc/reflection.ts`** (NOT USED - orphaned code)
   - Also uses `grpc-reflection-js` library
   - Exports: `GrpcReflectionClient` class, `invokeGrpcMethod()`, utility functions
   - Class-based API with retry logic
   - More sophisticated than utils version
   - Based on "yaci patterns" (likely from another project)

3. **`lib/grpc/native-reflection.ts`** (Currently USED by execute route)
   - Custom implementation using only `@grpc/grpc-js` + `protobufjs`
   - Exports: `NativeReflectionClient` class
   - **MISSING:** Does NOT export type definitions for request/response messages
   - More control over enum handling and serialization

### Current Usage Patterns

**Service Discovery:** `app/api/grpc/services/route.ts`
```typescript
import { fetchServicesViaReflection, type GrpcService } from '@/utils/grpcReflection';

// Calls fetchServicesViaReflection() which returns:
{
  services: GrpcService[] // includes requestTypeDefinition and responseTypeDefinition
}
```

**Method Execution:** `app/api/grpc/execute/route.ts`
```typescript
import { NativeReflectionClient } from '@/lib/grpc/native-reflection';

const client = new NativeReflectionClient({ endpoint, tls, timeout });
await client.initialize();
const result = await client.invokeMethod(service, method, params, timeout);
```

### Key Issue: Type Definition Mismatch

**The Problem:**
- Service discovery needs `requestTypeDefinition` and `responseTypeDefinition` for the frontend to generate forms
- Native implementation doesn't expose this information
- Old implementation (utils/grpcReflection.ts) provides this via `extractMessageTypeDefinition()`

**Type Structure Required:**
```typescript
interface MessageTypeDefinition {
  name: string;
  fullName: string;
  fields: MessageField[];
}

interface MessageField {
  name: string;
  type: string;
  rule?: 'optional' | 'required' | 'repeated';
  defaultValue?: any;
  comment?: string;
  nested?: boolean;
  enumValues?: string[];
}
```

### Test Files

- `test-reflection.js` - Tests reflection using `/api/grpc/reflect` endpoint (DOES NOT EXIST!)
- `test-native-reflection.js` - Tests using `/api/grpc/services` and `/api/grpc/execute` (CURRENT ENDPOINTS)

## Architecture Map

### Component Dependency Graph

```
Frontend (Browser)
├── components/GrpcExplorerApp.tsx
│   ├── Fetches from /api/grpc/services (needs type definitions)
│   └── Posts to /api/grpc/execute (sends params)
│
API Routes (Next.js Server)
├── app/api/grpc/services/route.ts
│   └── Uses: utils/grpcReflection.ts
│       └── Depends: grpc-reflection-js
│
├── app/api/grpc/execute/route.ts
│   └── Uses: lib/grpc/native-reflection.ts
│       └── Depends: @grpc/grpc-js + protobufjs
│
└── app/api/chains/route.ts
    └── Independent (chain registry only)

Orphaned Files
└── lib/grpc/reflection.ts (NOT USED ANYWHERE)
```

### Data Flow

```
1. Service Discovery Flow:
   User clicks "Add Network"
   → POST /api/grpc/services
   → fetchServicesViaReflection(endpoint, tls)
   → grpc-reflection-js.Client.listServices()
   → grpc-reflection-js.Client.fileContainingSymbol()
   → extractMessageTypeDefinition() for each method
   → Returns: { services: GrpcService[] with type definitions }
   → Frontend generates forms from requestTypeDefinition

2. Method Execution Flow:
   User fills form and clicks "Execute"
   → POST /api/grpc/execute
   → new NativeReflectionClient()
   → client.initialize() (loads all descriptors)
   → client.invokeMethod(service, method, params)
   → Returns: JSON response

3. Mismatch:
   - Services route provides type defs using old library
   - Execute route uses new library but doesn't need type defs
   - Frontend depends on type defs from services route
```

## Migration Strategy

### Goals

1. Consolidate to single reflection implementation
2. Remove grpc-reflection-js dependency
3. Keep native implementation for better control
4. Ensure type definitions still available for form generation
5. Maintain backward compatibility with frontend
6. Improve naming consistency

### Required Changes

#### Phase 1: Enhance Native Implementation

**Add type definition extraction to `native-reflection.ts`:**
- Add `getMessageTypeDefinition(typeName: string): MessageTypeDefinition` method
- Extract field information from protobuf.js `Type` objects
- Handle enums, nested messages, repeated fields
- Match the output structure of old `extractMessageTypeDefinition()`

**Update `GrpcMethod` interface:**
```typescript
export interface GrpcMethod {
  name: string;
  fullName: string;
  serviceName: string;
  requestType: string;
  responseType: string;
  requestStreaming: boolean;
  responseStreaming: boolean;
  description?: string;
  requestTypeDefinition: MessageTypeDefinition;  // ADD
  responseTypeDefinition: MessageTypeDefinition; // ADD
}
```

#### Phase 2: Rename and Reorganize

**File Structure Changes:**
- Rename `lib/grpc/native-reflection.ts` → `lib/grpc/client.ts`
- Delete `lib/grpc/reflection.ts` (orphaned)
- Delete `utils/grpcReflection.ts` (after migration)
- Keep `lib/grpc/reflection.proto` (may be useful)

**Naming Changes:**
- `NativeReflectionClient` → `ReflectionClient`
- `NativeReflectionOptions` → `ReflectionOptions`

#### Phase 3: Update API Routes

**`app/api/grpc/services/route.ts`:**
```typescript
import { ReflectionClient } from '@/lib/grpc/client';

const client = new ReflectionClient({ endpoint, tls, timeout });
await client.initialize();
const services = client.getServices(); // Now includes type definitions
```

**`app/api/grpc/execute/route.ts`:**
```typescript
import { ReflectionClient } from '@/lib/grpc/client';
// No changes needed except import path
```

#### Phase 4: Clean Up

- Remove `grpc-reflection-js` from package.json
- Add `protobufjs` as explicit dependency
- Update test files to use consistent endpoints
- Update CLAUDE.md to reflect single implementation
- Remove orphaned files

## Risk Assessment

### Low Risk
- Native implementation already working for method execution
- Type definitions are straightforward to extract from protobuf.js
- No frontend changes needed (API contract stays same)

### Medium Risk
- Enum handling differences between libraries
- Edge cases in nested message types
- Potential protobufjs version conflicts

### Mitigation
- Extensive testing with various Cosmos chains
- Keep old implementation until new one fully tested
- Use existing test files to validate

## Implementation Checklist

- [ ] Add protobufjs to package.json as explicit dependency
- [ ] Add getMessageTypeDefinition() to NativeReflectionClient
- [ ] Update GrpcMethod interface with type definitions
- [ ] Update getServices() to populate type definitions
- [ ] Test type definition extraction with complex types
- [ ] Rename NativeReflectionClient to ReflectionClient
- [ ] Rename file to lib/grpc/client.ts
- [ ] Update services route import
- [ ] Update execute route import
- [ ] Test both service discovery and execution
- [ ] Delete utils/grpcReflection.ts
- [ ] Delete lib/grpc/reflection.ts
- [ ] Remove grpc-reflection-js from package.json
- [ ] Update test files
- [ ] Update CLAUDE.md
- [ ] Run full test suite

## Next Steps

1. Research protobufjs API for type introspection
2. Implement getMessageTypeDefinition() method
3. Test with real Cosmos chain endpoints
4. Validate form generation still works
5. Complete migration and cleanup
