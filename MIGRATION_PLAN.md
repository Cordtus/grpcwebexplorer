# gRPC Reflection Client Consolidation - Migration Plan

## Executive Summary

Consolidate three separate reflection implementations into a single native implementation that:
1. Eliminates grpc-reflection-js dependency (fixes enum bugs)
2. Provides full type introspection for form generation
3. Uses consistent naming aligned with original codebase patterns
4. Maintains backward compatibility with frontend

## Historical Context

The project evolved from grpcurl → grpc-reflection-js → native implementation in stages:
- **Oct 26**: Added all three implementations simultaneously during grpcurl removal
- **Oct 28**: Added form generation requiring detailed type definitions
- **Oct 29**: Fixed enum bugs in native client (proving superiority over grpc-reflection-js)
- **Current**: Hybrid state with execute using native, services using old library

## Current Issues

1. **Inconsistent implementations**: Services route uses grpc-reflection-js, execute route uses native
2. **Orphaned code**: `lib/grpc/reflection.ts` not used anywhere
3. **Missing functionality**: Native client lacks type definition extraction
4. **Confusing naming**: "NativeReflectionClient" doesn't match codebase conventions
5. **Unnecessary dependency**: grpc-reflection-js only used by services route

## Migration Strategy

### Phase 1: Enhance Native Implementation

**Goal**: Add type definition extraction matching utils/grpcReflection.ts API

**Files to modify:**
- `lib/grpc/native-reflection.ts`

**Changes:**
1. Add `MessageTypeDefinition` and `MessageField` interfaces
2. Implement `extractMessageTypeDefinition(typeName: string)` private method
3. Update `GrpcMethod` interface to include type definitions
4. Modify `getServices()` to populate type definitions

**Key implementation details:**
```typescript
private extractMessageTypeDefinition(typeName: string): MessageTypeDefinition {
  const message = this.root.lookupType(typeName);

  const fields: MessageField[] = Object.entries(message.fields).map(([name, field]) => {
    const fieldType = (field as any).type;
    const isNested = /* check if custom type */;
    const enumValues = /* extract enum values if applicable */;

    return {
      name,
      type: fieldType,
      rule: /* repeated/required/optional */,
      nested: isNested,
      enumValues: enumValues || undefined,
    };
  });

  return {
    name: message.name,
    fullName: typeName,
    fields,
  };
}
```

### Phase 2: Rename and Reorganize

**Goal**: Match existing codebase naming conventions

**File operations:**
```
lib/grpc/native-reflection.ts → lib/grpc/reflection-client.ts
```

**Naming changes:**
```typescript
// OLD
export class NativeReflectionClient
export interface NativeReflectionOptions

// NEW
export class ReflectionClient
export interface ReflectionOptions
```

**Rationale:**
- `ReflectionClient` matches the old `grpc-reflection-js` import: `Client as ReflectionClient`
- Shorter, cleaner, no redundant "Native" prefix
- Consistent with utils/grpcReflection.ts function naming

### Phase 3: Create Migration Wrapper

**Goal**: Ensure backward compatibility during migration

**New file:** `lib/grpc/reflection-utils.ts`

**Purpose:** Export helper functions matching utils/grpcReflection.ts API

```typescript
import { ReflectionClient } from './reflection-client';

export async function fetchServicesViaReflection(
  options: ReflectionOptions
): Promise<GrpcService[]> {
  const client = new ReflectionClient(options);

  try {
    await client.initialize();
    return client.getServices(); // Now includes type definitions
  } finally {
    client.close();
  }
}

// Re-export types for compatibility
export type { GrpcService, GrpcMethod, MessageTypeDefinition, MessageField };
```

### Phase 4: Update API Routes

**Files to modify:**
1. `app/api/grpc/services/route.ts`
2. `app/api/grpc/execute/route.ts`

**Changes for services route:**
```typescript
// OLD
import { fetchServicesViaReflection, type GrpcService } from '@/utils/grpcReflection';

// NEW
import { fetchServicesViaReflection, type GrpcService } from '@/lib/grpc/reflection-utils';
```

**Changes for execute route:**
```typescript
// OLD
import { NativeReflectionClient } from '@/lib/grpc/native-reflection';

// NEW
import { ReflectionClient } from '@/lib/grpc/reflection-client';

const client = new ReflectionClient({ endpoint, tls, timeout });
```

### Phase 5: Clean Up

**Files to delete:**
- `utils/grpcReflection.ts` (replaced by reflection-utils.ts)
- `lib/grpc/reflection.ts` (orphaned, never used)
- `lib/grpc/reflection.proto` (proto definition now inlined in reflection-client.ts)
- `lib/grpc/types.ts` (empty file)

**Package.json changes:**
```json
// REMOVE
"grpc-reflection-js": "^0.3.0"

// ADD (make explicit)
"protobufjs": "^7.2.5"
```

**Why keep protobufjs:** Required for protobuf parsing and type introspection

### Phase 6: Update Tests

**Files to modify:**
- `test-reflection.js` (uses /api/grpc/reflect endpoint that doesn't exist)
- `test-native-reflection.js` (uses correct endpoints)

**Consolidate to single test file:** `test-grpc-reflection.js`

**Test matrix:**
```javascript
// Test both service discovery and execution
// Test multiple endpoints (Juno, Cosmos Hub, Osmosis)
// Test enum handling specifically
// Test nested message types
// Test type definition extraction
```

## Implementation Checklist

### Phase 1: Enhance
- [ ] Add MessageTypeDefinition/MessageField interfaces to reflection-client.ts
- [ ] Implement extractMessageTypeDefinition() private method
- [ ] Add getMessageTypeDefinition() public method (for debugging)
- [ ] Update GrpcMethod interface to include type definitions
- [ ] Modify getServices() to call extractMessageTypeDefinition()
- [ ] Test with complex Cosmos message types (enums, nested, repeated)

### Phase 2: Rename
- [ ] Rename lib/grpc/native-reflection.ts to lib/grpc/reflection-client.ts
- [ ] Replace NativeReflectionClient with ReflectionClient
- [ ] Replace NativeReflectionOptions with ReflectionOptions
- [ ] Update all docstrings and comments

### Phase 3: Wrapper
- [ ] Create lib/grpc/reflection-utils.ts
- [ ] Implement fetchServicesViaReflection() function
- [ ] Re-export all necessary types
- [ ] Add JSDoc comments matching old API

### Phase 4: Routes
- [ ] Update app/api/grpc/services/route.ts imports
- [ ] Update app/api/grpc/execute/route.ts imports
- [ ] Verify no other files import from old locations
- [ ] Test service discovery endpoint
- [ ] Test method execution endpoint

### Phase 5: Cleanup
- [ ] Delete utils/grpcReflection.ts
- [ ] Delete lib/grpc/reflection.ts
- [ ] Delete lib/grpc/reflection.proto (optional - could keep for reference)
- [ ] Delete lib/grpc/types.ts
- [ ] Add protobufjs to package.json
- [ ] Remove grpc-reflection-js from package.json
- [ ] Run yarn install

### Phase 6: Testing
- [ ] Consolidate test files
- [ ] Add enum-specific test cases
- [ ] Add nested message test cases
- [ ] Test form generation with new type definitions
- [ ] Test with multiple chains (Juno, Cosmos Hub, Osmosis, dYdX)
- [ ] Verify caching still works
- [ ] Test round-robin endpoint selection

### Phase 7: Documentation
- [ ] Update CLAUDE.md to reflect single implementation
- [ ] Update README.md if needed
- [ ] Add comments explaining type definition extraction
- [ ] Document any breaking changes (should be none)
- [ ] Create this migration summary

## Risk Assessment

### Low Risk ✅
- Native implementation already working for method execution
- Type definitions straightforward to extract from protobuf.js
- No frontend changes needed
- Backward compatible API

### Medium Risk ⚠️
- Edge cases in complex nested message types
- Enum value mapping differences
- Protobufjs version compatibility

### Mitigation Strategies
1. Extensive testing with real Cosmos chains
2. Keep old implementation alongside until fully validated
3. Use existing test endpoints for regression testing
4. Test form generation specifically

## Testing Strategy

### Unit Testing
```typescript
// Test type definition extraction
const client = new ReflectionClient({ endpoint, tls: true });
await client.initialize();

const bankQuery = client.getServices().find(s =>
  s.fullName === 'cosmos.bank.v1beta1.Query'
);

const totalSupply = bankQuery.methods.find(m => m.name === 'TotalSupply');

// Verify type definitions present
assert(totalSupply.requestTypeDefinition);
assert(totalSupply.responseTypeDefinition);

// Verify fields extracted
assert(totalSupply.responseTypeDefinition.fields.length > 0);

// Verify enum values for enum fields
const enumField = /* find enum field */;
assert(enumField.enumValues && enumField.enumValues.length > 0);
```

### Integration Testing
```bash
# 1. Service discovery
curl -X POST http://localhost:3000/api/grpc/services \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "grpc.cosmos.directory:443", "tlsEnabled": true}'

# 2. Method execution
curl -X POST http://localhost:3000/api/grpc/execute \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "grpc.cosmos.directory:443",
    "tlsEnabled": true,
    "service": "cosmos.bank.v1beta1.Query",
    "method": "TotalSupply",
    "params": {}
  }'

# 3. Enum handling test
# Find a method with enum parameters and verify form generation
```

### UI Testing
1. Add network (verify type definitions loaded)
2. Expand service (verify methods listed)
3. Click method (verify form generated correctly)
4. Check enum fields render as dropdowns
5. Check nested messages render as expandable sections
6. Execute method (verify response)

## Rollback Plan

If issues arise:
1. Keep old implementation files in git history
2. Revert imports in API routes
3. Re-add grpc-reflection-js to package.json
4. Run yarn install
5. Restart server

Git commands:
```bash
git checkout main -- utils/grpcReflection.ts
git checkout main -- app/api/grpc/services/route.ts
yarn install
```

## Success Criteria

- [ ] Single reflection client implementation
- [ ] grpc-reflection-js dependency removed
- [ ] All tests passing
- [ ] Service discovery works with type definitions
- [ ] Method execution works
- [ ] Form generation works (especially enums)
- [ ] No regression in caching
- [ ] No regression in chain registry integration
- [ ] Cleaner codebase with less duplication
- [ ] Documentation updated

## Timeline Estimate

- Phase 1: 2-3 hours (type definition extraction)
- Phase 2: 30 minutes (renaming)
- Phase 3: 1 hour (wrapper functions)
- Phase 4: 30 minutes (update routes)
- Phase 5: 30 minutes (cleanup)
- Phase 6: 2 hours (testing)
- Phase 7: 1 hour (documentation)

**Total: 7-8 hours** (can be split across multiple sessions)

## Next Actions

1. Review and approve this plan
2. Start with Phase 1 (enhance native implementation)
3. Test incrementally after each phase
4. Commit frequently with clear messages
5. Update ARCHITECTURE_ANALYSIS.md as we go
