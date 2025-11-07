# Plan: SDK/Tendermint Version-Specific Method Documentation

## Overview

Provide context-aware documentation and example values for gRPC methods based on the Cosmos SDK and Tendermint/CometBFT versions running on the queried node.

## Version Detection Strategy

### 1. Detect Versions from Node Response

When connecting to a node, query `cosmos.base.tendermint.v1beta1.Service/GetNodeInfo` to extract:

```typescript
{
  default_node_info: {
    version: "0.38.17",  // CometBFT/Tendermint version
    // ...
  },
  application_version: {
    cosmos_sdk_version: "v0.50.13",  // Cosmos SDK version
    version: "v29.0.0-2-g20595201",  // Chain-specific version
    // ...
  }
}
```

**Key Data Points**:
- `default_node_info.version` → Tendermint/CometBFT version
- `application_version.cosmos_sdk_version` → Cosmos SDK version
- `application_version.version` → App/chain version (for chain-specific methods)

### 2. Parse Version Strings

Extract semantic versions:
```typescript
interface VersionInfo {
  tendermint: string;      // e.g., "0.38.17"
  cosmosSDK: string;       // e.g., "v0.50.13"
  appVersion: string;      // e.g., "v29.0.0"
  isCometBFT: boolean;     // true if version >= 0.38
}
```

## Documentation Structure

### 3. Version-Specific Method Metadata

Create a structured documentation system:

```typescript
interface MethodDocumentation {
  service: string;                    // e.g., "cosmos.bank.v1beta1.Query"
  method: string;                     // e.g., "Balance"
  minSDKVersion?: string;             // Minimum SDK version required
  maxSDKVersion?: string;             // Maximum SDK version (if deprecated)
  minTendermintVersion?: string;      // Minimum Tendermint version

  description: string;                // Human-readable description
  useCases: string[];                 // Common use cases

  parameters: ParameterDoc[];         // Documentation for each parameter
  exampleValues: Record<string, ExampleValue>;  // Version-specific examples

  relatedMethods: string[];           // Related methods to explore
  externalDocs: DocLink[];            // Links to official docs
}

interface ParameterDoc {
  name: string;                       // Field name
  type: string;                       // Protobuf type
  description: string;                // What this parameter does
  required: boolean;                  // Is it required?
  defaultValue?: any;                 // Default if omitted
  constraints?: {                     // Validation rules
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: string[];
  };
  examples: Example[];                // Multiple examples
}

interface Example {
  value: any;
  description: string;
  context?: string;                   // When to use this example
}

interface ExampleValue {
  sdkVersion?: string;                // Applicable SDK version
  tendermintVersion?: string;         // Applicable Tendermint version
  value: any;                         // The example value
  note?: string;                      // Additional context
}
```

## Implementation Phases

### Phase 1: Infrastructure (Weeks 1-2)

**Tasks**:
1. Add version detection on network connection
   - Store version info in network state
   - Display SDK/Tendermint versions in network card

2. Create documentation schema
   - Define TypeScript interfaces
   - Set up documentation JSON structure

3. Build documentation loader
   - Load docs from JSON files
   - Match method to documentation
   - Filter by version compatibility

**Files to Create**:
- `/lib/docs/schema.ts` - Type definitions
- `/lib/docs/loader.ts` - Documentation loading logic
- `/lib/docs/version-matcher.ts` - Version compatibility checking
- `/data/method-docs/` - Directory for documentation JSON files

### Phase 2: Core Method Documentation (Weeks 3-6)

Document the most commonly used methods across major SDK versions:

**Priority 1: Tendermint/CometBFT Core** (Essential for all chains)
- `cosmos.base.tendermint.v1beta1.Service/GetNodeInfo`
- `cosmos.base.tendermint.v1beta1.Service/GetSyncingStatus`
- `cosmos.base.tendermint.v1beta1.Service/GetLatestBlock`
- `cosmos.base.tendermint.v1beta1.Service/GetBlockByHeight`
- `cosmos.tx.v1beta1.Service/GetTx`
- `cosmos.tx.v1beta1.Service/BroadcastTx`

**Priority 2: Bank Module** (Money transfers)
- `cosmos.bank.v1beta1.Query/Balance`
- `cosmos.bank.v1beta1.Query/AllBalances`
- `cosmos.bank.v1beta1.Query/TotalSupply`
- `cosmos.bank.v1beta1.Query/DenomMetadata`

**Priority 3: Staking Module** (Validators, delegations)
- `cosmos.staking.v1beta1.Query/Validators`
- `cosmos.staking.v1beta1.Query/Validator`
- `cosmos.staking.v1beta1.Query/Delegation`
- `cosmos.staking.v1beta1.Query/DelegatorDelegations`

**Priority 4: Governance** (Proposals, voting)
- `cosmos.gov.v1beta1.Query/Proposals`
- `cosmos.gov.v1beta1.Query/Proposal`
- `cosmos.gov.v1.Query/Proposals`
- `cosmos.gov.v1.Query/Proposal`

### Phase 3: SDK Version Coverage (Weeks 7-10)

Document version-specific differences:

**SDK v0.45.x**:
- Gov v1beta1 only
- Legacy staking params
- No IBC-Go v6 features

**SDK v0.47.x**:
- Introduced Gov v1
- Updated staking module
- IBC-Go v6

**SDK v0.50.x**:
- Removed legacy endpoints
- Updated protobuf packages
- New query methods

### Phase 4: UI Integration (Weeks 11-12)

**Tasks**:
1. Enhance Method Descriptor Panel
   - Show detected SDK/Tendermint versions
   - Display method documentation
   - Show version compatibility warnings
   - Provide contextual parameter help

2. Intelligent Form Generation
   - Pre-fill example values based on version
   - Show parameter descriptions inline
   - Validation based on documented constraints

3. Contextual Help System
   - Hover tooltips with parameter docs
   - "?" icons linking to external docs
   - "Show Examples" dropdown for each parameter

## Documentation Sources

### Manual Research Required:

1. **Official Cosmos SDK Docs**
   - https://docs.cosmos.network/
   - Version-specific documentation for each release
   - Proto file documentation

2. **CometBFT/Tendermint Docs**
   - https://docs.cometbft.com/
   - RPC and query documentation
   - Version-specific changes

3. **Chain Registry**
   - https://github.com/cosmos/chain-registry
   - Real-world endpoint examples
   - Chain-specific parameters

4. **Proto Files Analysis**
   - https://buf.build/cosmos/cosmos-sdk
   - Parse proto comments for descriptions
   - Extract field documentation
   - Identify deprecated methods

5. **IBC Documentation**
   - https://ibc.cosmos.network/
   - IBC-specific query methods
   - Version compatibility

### Automated Extraction:

```typescript
// Extract from proto comments
async function extractProtoDocumentation(serviceName: string): Promise<MethodDoc[]> {
  // 1. Fetch proto file from buf.build
  // 2. Parse proto comments
  // 3. Extract field documentation
  // 4. Build MethodDoc objects
}
```

## Example Documentation File

`/data/method-docs/cosmos.bank.v1beta1.Query.Balance.json`:

```json
{
  "service": "cosmos.bank.v1beta1.Query",
  "method": "Balance",
  "minSDKVersion": "0.40.0",
  "description": "Query the balance of a single coin denomination for an account",
  "useCases": [
    "Check an account's balance of a specific token",
    "Verify payment received",
    "Display wallet balance in UI"
  ],
  "parameters": [
    {
      "name": "address",
      "type": "string",
      "description": "The account address to query (bech32 format)",
      "required": true,
      "constraints": {
        "pattern": "^[a-z]+1[a-z0-9]{38}$",
        "minLength": 39,
        "maxLength": 90
      },
      "examples": [
        {
          "value": "juno1dcf045a77c28bab9f66a831b3eba653f954f6ad6",
          "description": "Juno mainnet address",
          "context": "When querying Juno chain"
        },
        {
          "value": "cosmos1dcf045a77c28bab9f66a831b3eba653f9e5h8w",
          "description": "Cosmos Hub address",
          "context": "When querying Cosmos Hub"
        }
      ]
    },
    {
      "name": "denom",
      "type": "string",
      "description": "The denomination to query (e.g., 'ujuno', 'uatom')",
      "required": true,
      "examples": [
        {
          "value": "ujuno",
          "description": "Juno native token (micro-juno)",
          "context": "Juno mainnet"
        },
        {
          "value": "uatom",
          "description": "Cosmos Hub native token (micro-atom)",
          "context": "Cosmos Hub"
        },
        {
          "value": "ibc/...",
          "description": "IBC transferred token",
          "context": "When querying IBC tokens"
        }
      ]
    }
  ],
  "exampleValues": {
    "juno-1": {
      "value": {
        "address": "juno1dcf045a77c28bab9f66a831b3eba653f954f6ad6",
        "denom": "ujuno"
      },
      "note": "Query native JUNO balance on Juno mainnet"
    },
    "cosmoshub-4": {
      "value": {
        "address": "cosmos1dcf045a77c28bab9f66a831b3eba653f9e5h8w",
        "denom": "uatom"
      },
      "note": "Query native ATOM balance on Cosmos Hub"
    }
  },
  "relatedMethods": [
    "cosmos.bank.v1beta1.Query/AllBalances",
    "cosmos.bank.v1beta1.Query/DenomMetadata"
  ],
  "externalDocs": [
    {
      "title": "Cosmos SDK Bank Module",
      "url": "https://docs.cosmos.network/main/modules/bank"
    },
    {
      "title": "Buf.build Proto Docs",
      "url": "https://buf.build/cosmos/cosmos-sdk/docs/main:cosmos.bank.v1beta1"
    }
  ]
}
```

## UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│ Method Descriptor                                           │
├─────────────────────────────────────────────────────────────┤
│ Balance                                                      │
│ cosmos.bank.v1beta1.Query [copy]                            │
│                                                              │
│ ℹ️ Query the balance of a single coin denomination         │
│    for an account                                           │
│                                                              │
│ 📦 SDK: v0.50.13  ⚙️ CometBFT: 0.38.17                      │
│ ✅ Compatible                                               │
│                                                              │
│ 📚 Common Use Cases:                                        │
│   • Check account balance                                   │
│   • Verify payment received                                 │
│                                                              │
│ 🔗 Documentation: [Cosmos SDK Bank Module]                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Parameters                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ address * [?]                                               │
│ └─ Account address to query (bech32 format)                │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ juno1dcf045a77c28bab9f66a831b3eba653f954f6ad6       │   │
│ └──────────────────────────────────────────────────────┘   │
│ 💡 Example: juno1dcf... (Juno mainnet address)             │
│                                                              │
│ denom * [?]                                                 │
│ └─ Denomination to query (e.g., 'ujuno', 'uatom')          │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ ujuno                                                 │   │
│ └──────────────────────────────────────────────────────┘   │
│ 💡 Example: ujuno (Juno native token)                      │
│    ▼ Show more examples                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Timeline Summary

- **Weeks 1-2**: Infrastructure setup
- **Weeks 3-6**: Core method documentation (30-40 methods)
- **Weeks 7-10**: SDK version coverage and differences
- **Weeks 11-12**: UI integration and testing

**Total Estimated Time**: 12 weeks for comprehensive coverage of top 100 methods

## Maintenance Strategy

1. **Community Contributions**
   - Open-source the documentation JSON files
   - Accept PRs for new method docs
   - Maintain documentation repo separate from app

2. **Automated Updates**
   - Script to scrape buf.build for new SDK versions
   - Detect new methods automatically
   - Flag documentation gaps

3. **Version Deprecation Warnings**
   - Detect when connected to older SDK versions
   - Warn about deprecated methods
   - Suggest migration paths

## Success Metrics

- **Coverage**: Document top 100 most-used methods (80% of queries)
- **Accuracy**: Version-specific examples work on first try
- **Usability**: Reduce "invalid parameter" errors by 70%
- **Adoption**: Increase successful method executions by 50%
