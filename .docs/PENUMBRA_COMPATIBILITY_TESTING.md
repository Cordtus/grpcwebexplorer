# Penumbra Compatibility Testing Guide

This guide explains how to comprehensively test all Penumbra methods to ensure complete compatibility.

## Option 1: Web UI (Recommended)

1. Deploy your changes to Vercel
2. Navigate to: `https://your-deployment.vercel.app/test-compatibility`
3. Configure the test:
   - **Endpoint**: `grpc.testnet.penumbra.zone:443`
   - **Service Filter**: `penumbra` (to test only Penumbra services)
   - **Enable TLS**: ✅ checked
4. Click "Run Compatibility Test"
5. Wait for results (typically 2-5 minutes depending on number of methods)

The UI will show:
- ✅ **Successful methods** - Working correctly
- ❌ **Errors** - Client-side issues we need to fix
- 🔥 **Internal Server Errors** - Penumbra server bugs
- ⚠️ **Unimplemented** - Methods not yet implemented by Penumbra
- ⏭️ **Requires Parameters** - Methods that need input (expected to skip)

## Option 2: API via curl

```bash
# Test all Penumbra services
curl -X POST https://your-deployment.vercel.app/api/grpc/test-compatibility \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "grpc.testnet.penumbra.zone:443",
    "tlsEnabled": true,
    "serviceFilter": "penumbra"
  }' | jq '.'

# Save results to file
curl -X POST https://your-deployment.vercel.app/api/grpc/test-compatibility \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "grpc.testnet.penumbra.zone:443",
    "tlsEnabled": true,
    "serviceFilter": "penumbra"
  }' | jq '.' > penumbra-test-results.json
```

## Understanding Test Results

### Statistics
```json
{
  "stats": {
    "total": 50,           // Total methods tested
    "successful": 35,      // ✅ Working perfectly
    "errors": 3,           // ❌ Client issues to fix
    "internalErrors": 2,   // 🔥 Server-side bugs
    "unimplemented": 5,    // ⚠️ Not implemented yet
    "requiresParams": 5,   // ⏭️ Needs parameters (skipped)
    "totalTime": 45000     // Test duration in ms
  }
}
```

### Grouped Errors

Errors are automatically grouped by type for easy diagnosis:

```json
{
  "groupedErrors": {
    "Missing Type: penumbra.core.component.foo": [
      "penumbra.core.app.v1.QueryService.SomeMethod"
    ],
    "Server Error: failed to parse anchor": [
      "penumbra.core.component.sct.v1.QueryService.SctFrontier"
    ],
    "Dependency Depth Exceeded": [
      "penumbra.core.app.v1.QueryService.ComplexMethod"
    ]
  }
}
```

## What to Look For

### ❌ Client Errors We Need to Fix

1. **"Missing Type: X"**
   - Our recursive dependency loader didn't find a type
   - Fix: Improve type resolution in reflection-client.ts

2. **"Dependency Depth Exceeded"**
   - Hit MAX_DEPTH limit (currently 50)
   - Fix: Investigate circular dependency or increase limit

3. **"Failed to decode"**
   - Response structure mismatch
   - Fix: Check protobuf decoding options

4. **"Circular dependency detected"**
   - Same type loaded multiple times
   - Fix: Improve caching logic

### 🔥 Server Errors (Penumbra Bugs)

1. **"Server Error: X"**
   - Penumbra server returned INTERNAL error
   - Example: "failed to parse anchor" on SctFrontier with withProof
   - Action: Document and report to Penumbra team

### ⚠️ Expected Results

1. **Unimplemented methods** - Normal, methods not ready yet
2. **Requires parameters** - Expected, we only test empty-param methods
3. **PERMISSION_DENIED** - Expected if endpoint requires auth

## Testing Other Networks

To verify backward compatibility with conventional Cosmos networks:

```bash
# Test Juno
curl -X POST https://your-deployment.vercel.app/api/grpc/test-compatibility \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "grpc.juno.basementnodes.ca:443",
    "tlsEnabled": true,
    "serviceFilter": "cosmos"
  }' | jq '.stats'

# Test Osmosis
curl -X POST https://your-deployment.vercel.app/api/grpc/test-compatibility \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "grpc.osmosis.zone:443",
    "tlsEnabled": true,
    "serviceFilter": "osmosis"
  }' | jq '.stats'
```

## Quick Health Check

Just check if basic methods work without full test:

```bash
# Test a known-good method
curl -X POST https://your-deployment.vercel.app/api/grpc/execute \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "grpc.testnet.penumbra.zone:443",
    "service": "penumbra.core.app.v1.QueryService",
    "method": "AppParameters",
    "params": {},
    "tlsEnabled": true
  }' | jq '.'
```

## Reporting Issues

When reporting compatibility issues, include:

1. **Service and method name**
2. **Error type from groupedErrors**
3. **Full error message from results array**
4. **Whether it affects all networks or just Penumbra**
5. **Test results JSON file**

## Success Criteria

For full Penumbra compatibility, we expect:
- ✅ **All Query methods with empty params** work (AppParameters, etc.)
- ❌ **No "Missing Type" errors** (dependency loading complete)
- ❌ **No "Decode errors"** (response handling correct)
- ⚠️ **Some INTERNAL errors are OK** (server-side Penumbra bugs)
- ⚠️ **Unimplemented methods are OK** (Penumbra roadmap)

Current status: **All core functionality working** ✅
- Reflection v1 support ✅
- Recursive dependency loading ✅
- Type caching ✅
- Cross-package type resolution ✅

Known Penumbra server bugs:
- SctFrontier with withProof=true (INTERNAL: failed to parse anchor)
